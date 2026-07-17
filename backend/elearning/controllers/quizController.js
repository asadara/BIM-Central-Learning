const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { getRequestUser } = require('../../utils/auth');
const { createPgConfig } = require('../../config/runtimeConfig');
const { getExamCertificateRequirements } = require('../services/learningPathService');
const { RUBRIC } = require('../../services/competencyScoringService');

const quizzesPath = path.join(__dirname, '../data/quizzes.json');

const LEVEL_ORDER = ['BIM Modeller', 'BIM Coordinator', 'BIM Manager'];

const pool = new Pool(createPgConfig({
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in quizController:', err.message);
});

let ensureTablesPromise = null;

function ensureTables() {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS learning_attempts (
                    id BIGSERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    user_identifier TEXT NOT NULL,
                    user_name TEXT,
                    user_email TEXT,
                    quiz_id TEXT NOT NULL,
                    quiz_name TEXT,
                    quiz_category TEXT,
                    source_type TEXT DEFAULT 'quiz',
                    score INTEGER DEFAULT 0,
                    total_questions INTEGER DEFAULT 0,
                    percentage INTEGER DEFAULT 0,
                    passed BOOLEAN DEFAULT false,
                    answers JSONB DEFAULT '[]'::jsonb,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    is_verified BOOLEAN DEFAULT false,
                    verification_method TEXT,
                    rubric_version TEXT,
                    time_taken INTEGER DEFAULT 0,
                    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await pool.query(`
                ALTER TABLE learning_attempts
                ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS verification_method TEXT,
                ADD COLUMN IF NOT EXISTS rubric_version TEXT;
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_id
                ON learning_attempts(user_id);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_identifier
                ON learning_attempts(user_identifier);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_attempts_source_type
                ON learning_attempts(source_type);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_attempts_submitted_at
                ON learning_attempts(submitted_at DESC);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_attempts_verified_user
                ON learning_attempts(user_id, is_verified, submitted_at DESC);
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS user_certificates (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    user_identifier TEXT NOT NULL,
                    user_name TEXT,
                    user_email TEXT,
                    quiz_id TEXT,
                    module_id TEXT,
                    title TEXT NOT NULL,
                    issuer TEXT DEFAULT 'BC Learning Academy',
                    score INTEGER DEFAULT 0,
                    certificate_url TEXT,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    is_verified BOOLEAN DEFAULT false,
                    verification_method TEXT,
                    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_identifier, quiz_id)
                );
            `);

            await pool.query(`
                ALTER TABLE user_certificates
                ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS verification_method TEXT;
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_certificates_user_id
                ON user_certificates(user_id);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_certificates_user_identifier
                ON user_certificates(user_identifier);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_certificates_issued_at
                ON user_certificates(issued_at DESC);
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_user_certificates_verified_user
                ON user_certificates(user_id, is_verified, issued_at DESC);
            `);
        })().catch((error) => {
            ensureTablesPromise = null;
            throw error;
        });
    }

    return ensureTablesPromise;
}

function trimText(value, maxLength = 255) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.slice(0, maxLength);
}

function toNonNegativeInt(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return Math.floor(number);
}

function toNullableInt(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.floor(number);
}

function getLevelIndex(level) {
    const index = LEVEL_ORDER.indexOf(String(level || '').trim());
    return index === -1 ? 0 : index;
}

function normalizeSourceType(value) {
    const normalized = trimText(value, 32).toLowerCase();
    if (normalized === 'exam') return 'exam';
    if (normalized === 'practice') return 'practice';
    return 'quiz';
}

function detectCategory(quizId) {
    const id = String(quizId || '').toLowerCase();
    if (id.includes('practice')) return 'practice';
    if (id.includes('exam') || id.includes('cert')) return 'exam';
    if (id.includes('mindset')) return 'mindset';
    if (id.includes('governance')) return 'governance';
    if (id.includes('workflow')) return 'workflow';
    if (id.includes('autocad') || id.includes('acad')) return 'autocad';
    if (id.includes('revit')) return 'revit';
    if (id.includes('sketchup') || id.includes('sketch')) return 'sketchup';
    if (id.includes('3ds') || id.includes('max')) return '3dsmax';
    if (id.includes('lumion')) return 'lumion';
    if (id.includes('civil')) return 'civil';
    if (id.includes('navisworks') || id.includes('navis')) return 'navisworks';
    return 'general';
}

function buildQuizTitle(quizId) {
    const raw = String(quizId || '').replace(/[-_]+/g, ' ').trim();
    if (!raw) return 'Quiz';
    return raw
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function parseQuizDefinition(quizId) {
    try {
        if (!fs.existsSync(quizzesPath)) return null;
        const quizzes = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'));
        if (!Array.isArray(quizzes)) return null;
        return quizzes.find((q) => String(q.id) === String(quizId)) || null;
    } catch (error) {
        return null;
    }
}

function readQuizQuestionBank(quizDefinition) {
    if (!quizDefinition) return [];

    const configuredPath = trimText(quizDefinition.questionBank, 500);
    if (!configuredPath) {
        return Array.isArray(quizDefinition.questions) ? quizDefinition.questions : [];
    }

    try {
        const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
        const relativePath = configuredPath.replace(/^[/\\]+/, '');
        const questionBankPath = path.resolve(workspaceRoot, 'BC-Learning-Main', relativePath);
        const allowedRoot = path.resolve(workspaceRoot, 'BC-Learning-Main');
        if (!questionBankPath.startsWith(allowedRoot + path.sep)) return [];

        const parsed = JSON.parse(fs.readFileSync(questionBankPath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('WARN: Unable to load server quiz question bank:', error.message);
        return [];
    }
}

function verifyQuizSubmission(quizDefinition, payload) {
    if (!quizDefinition) {
        return { verified: false, method: 'unregistered-assessment' };
    }

    const questionBank = readQuizQuestionBank(quizDefinition);
    const questionIds = Array.isArray(payload?.metadata?.questionIds)
        ? payload.metadata.questionIds.map((value) => trimText(value, 120))
        : [];
    const answers = Array.isArray(payload.answers) ? payload.answers : [];

    if (!questionBank.length || !questionIds.length || questionIds.length !== answers.length) {
        return { verified: false, method: 'incomplete-answer-evidence' };
    }

    const requiredQuestionCount = toNonNegativeInt(quizDefinition.questionCount, 0);
    if (!requiredQuestionCount || questionIds.length !== requiredQuestionCount) {
        return { verified: false, method: 'invalid-question-count' };
    }

    const questionById = new Map(questionBank.map((question) => [
        String(question.id || '').trim(),
        question
    ]));
    const uniqueQuestionIds = new Set(questionIds);
    if (uniqueQuestionIds.size !== questionIds.length || questionIds.some((id) => !questionById.has(id))) {
        return { verified: false, method: 'unknown-question-evidence' };
    }

    const requiredSelection = quizDefinition.selection && typeof quizDefinition.selection === 'object'
        ? quizDefinition.selection
        : {};
    const submittedSelection = questionIds.reduce((counts, id) => {
        const level = trimText(questionById.get(id)?.level, 32).toLowerCase();
        counts[level] = (counts[level] || 0) + 1;
        return counts;
    }, {});
    const selectionIsValid = Object.entries(requiredSelection).every(([level, count]) => (
        Number(submittedSelection[String(level).toLowerCase()] || 0) === toNonNegativeInt(count, 0)
    ));
    if (!selectionIsValid) {
        return { verified: false, method: 'invalid-question-selection' };
    }

    const score = questionIds.reduce((total, questionId, index) => {
        const submittedAnswer = toNullableInt(answers[index]);
        const correctAnswer = toNullableInt(questionById.get(questionId)?.answer_index ?? questionById.get(questionId)?.answer);
        return total + (submittedAnswer === correctAnswer ? 1 : 0);
    }, 0);
    const totalQuestions = questionIds.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passingScore = toNonNegativeInt(quizDefinition.passingScore, 70);

    return {
        verified: true,
        method: 'server-question-bank-v1',
        score,
        totalQuestions,
        percentage,
        passed: percentage >= passingScore,
        passingScore,
        quizName: trimText(quizDefinition.title, 255),
        quizCategory: trimText(quizDefinition.category, 64).toLowerCase(),
        sourceType: normalizeSourceType(quizDefinition.sourceType)
    };
}

async function resolveUserContext(req, payload = {}) {
    const authUser = getRequestUser(req) || {};
    const rawUserId = trimText(authUser.id, 120);
    const rawEmail = trimText(authUser.email, 255).toLowerCase();
    const rawUsername = trimText(authUser.username, 120);

    let userRecord = null;
    if (rawUserId || rawEmail || rawUsername) {
        const query = await pool.query(
            `SELECT id, username, email, bim_level
             FROM users
             WHERE ($1::text <> '' AND id::text = $1::text)
                OR ($2::text <> '' AND lower(email) = lower($2))
                OR ($3::text <> '' AND lower(username) = lower($3))
             LIMIT 1`,
            [rawUserId || '', rawEmail || '', rawUsername || '']
        );
        userRecord = query.rows[0] || null;
    }

    const userId = userRecord ? toNullableInt(userRecord.id) : toNullableInt(rawUserId);
    const userName = trimText(
        (userRecord && userRecord.username) || rawUsername || '',
        120
    );
    const userEmail = trimText(
        (userRecord && userRecord.email) || rawEmail || '',
        255
    ).toLowerCase();

    const userIdentifier = trimText(
        (userRecord && String(userRecord.id)) ||
        rawUserId ||
        userEmail ||
        userName ||
        'anonymous',
        255
    );

    return {
        userId,
        userIdentifier,
        userName: userName || null,
        userEmail: userEmail || null,
        currentLevel: trimText(userRecord && userRecord.bim_level, 64) || 'BIM Modeller'
    };
}

async function refreshUserProgress(userContext) {
    if (!userContext || !userContext.userId) {
        return {
            practiceAttempts: 0,
            examsPassed: 0,
            certificatesEarned: 0
        };
    }

    const attempts = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE source_type = 'practice')::int AS practice_attempts,
            COUNT(*) FILTER (WHERE source_type = 'exam' AND passed = true)::int AS exams_passed
         FROM learning_attempts
         WHERE user_id = $1
           AND is_verified = true`,
        [userContext.userId]
    );

    const certs = await pool.query(
        `SELECT COUNT(*)::int AS certificates_earned
         FROM user_certificates
         WHERE user_id = $1
           AND is_verified = true`,
        [userContext.userId]
    );

    const practiceAttempts = toNonNegativeInt(attempts.rows[0]?.practice_attempts, 0);
    const examsPassed = toNonNegativeInt(attempts.rows[0]?.exams_passed, 0);
    const certificatesEarned = toNonNegativeInt(certs.rows[0]?.certificates_earned, 0);

    await pool.query(
        `INSERT INTO user_progress (
            user_id,
            practice_attempts,
            exams_passed,
            certificates_earned,
            current_level,
            to_next_level,
            created_at,
            updated_at
         ) VALUES ($1, $2, $3, $4, $5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
            practice_attempts = EXCLUDED.practice_attempts,
            exams_passed = EXCLUDED.exams_passed,
            certificates_earned = EXCLUDED.certificates_earned,
            current_level = EXCLUDED.current_level,
            to_next_level = 0,
            updated_at = CURRENT_TIMESTAMP`,
        [
            userContext.userId,
            practiceAttempts,
            examsPassed,
            certificatesEarned,
            userContext.currentLevel || 'BIM Modeller'
        ]
    );

    return { practiceAttempts, examsPassed, certificatesEarned };
}

async function validateExamCertificateReadiness(userContext, quizId) {
    const requirements = getExamCertificateRequirements()[quizId];
    if (!requirements) {
        return { eligible: true };
    }

    const userLevelIndex = getLevelIndex(userContext?.currentLevel);
    const requiredLevelIndex = getLevelIndex(requirements.requiredLevel);
    if (userLevelIndex < requiredLevelIndex) {
        return {
            eligible: false,
            reason: 'level',
            requiredLevel: requirements.requiredLevel
        };
    }

    const targetCategories = Array.isArray(requirements.targetCategories)
        ? requirements.targetCategories.filter(Boolean)
        : [];

    if (targetCategories.length === 0) {
        return { eligible: true };
    }

    const identifier = trimText(userContext?.userIdentifier, 255).toLowerCase();
    const email = trimText(userContext?.userEmail, 255).toLowerCase();
    const name = trimText(userContext?.userName, 120).toLowerCase();

    const result = await pool.query(
        `SELECT
            quiz_category,
            COUNT(*)::int AS attempts,
            COALESCE(ROUND(AVG(percentage)), 0)::int AS average_score
         FROM learning_attempts
         WHERE source_type = 'practice'
           AND is_verified = true
           AND quiz_category = ANY($1::text[])
           AND (
                ($2::int IS NOT NULL AND user_id = $2)
                OR ($3::text <> '' AND lower(COALESCE(user_identifier, '')) = $3)
                OR ($4::text <> '' AND lower(COALESCE(user_email, '')) = $4)
                OR ($5::text <> '' AND lower(COALESCE(user_name, '')) = $5)
           )
         GROUP BY quiz_category`,
        [
            targetCategories,
            userContext?.userId || null,
            identifier,
            email,
            name
        ]
    );

    const coveredCategories = result.rows.filter((row) => targetCategories.includes(row.quiz_category));
    const attempts = coveredCategories.reduce((sum, row) => sum + toNonNegativeInt(row.attempts, 0), 0);
    const accuracy = coveredCategories.length
        ? Math.round(coveredCategories.reduce((sum, row) => sum + toNonNegativeInt(row.average_score, 0), 0) / coveredCategories.length)
        : 0;
    const coverage = coveredCategories.length / targetCategories.length;

    const eligible = accuracy >= requirements.minAccuracy &&
        attempts >= requirements.minAttempts &&
        coverage >= requirements.coverageTarget;

    return {
        eligible,
        reason: eligible ? null : 'readiness',
        accuracy,
        attempts,
        coverage,
        requirements
    };
}

async function issueCertificateIfEligible({ userContext, payload, attemptData }) {
    if (!attemptData.verified || !attemptData.passed) return null;

    const shouldIssue = attemptData.sourceType === 'exam';
    if (!shouldIssue) return null;
    if (!userContext || !userContext.userIdentifier || userContext.userIdentifier === 'anonymous') return null;

    const quizId = trimText(attemptData.quizId, 120);
    if (!quizId) return null;

    const certificateTitle = trimText(
        `${attemptData.quizName} Certificate`,
        255
    );
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const certificateUrl = trimText(
        `/certificates/${certificateId}.pdf`,
        500
    ) || null;
    const issuer = 'BC Learning Academy';

    if (attemptData.sourceType === 'exam') {
        const readiness = await validateExamCertificateReadiness(userContext, quizId);
        if (!readiness.eligible) {
            return null;
        }
    }

    const result = await pool.query(
        `INSERT INTO user_certificates (
            id,
            user_id,
            user_identifier,
            user_name,
            user_email,
            quiz_id,
            module_id,
            title,
            issuer,
            score,
            certificate_url,
            metadata,
            is_verified,
            verification_method,
            issued_at
         ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12::jsonb, true, $13, CURRENT_TIMESTAMP
         )
         ON CONFLICT (user_identifier, quiz_id) DO NOTHING
         RETURNING id, title, issuer, score, certificate_url, issued_at`,
        [
            certificateId,
            userContext.userId,
            userContext.userIdentifier,
            userContext.userName,
            userContext.userEmail,
            quizId,
            trimText(payload.moduleId, 120) || null,
            certificateTitle,
            issuer,
            toNonNegativeInt(attemptData.percentage, 0),
            certificateUrl,
            JSON.stringify({
                quizName: attemptData.quizName,
                sourceType: attemptData.sourceType
            }),
            attemptData.verificationMethod || 'verified-assessment'
        ]
    );

    return result.rows[0] || null;
}

async function buildUserLookupContext(userIdentity) {
    const identity = trimText(userIdentity, 255);
    if (!identity) return { userId: null, matchValues: [] };

    const userQuery = await pool.query(
        `SELECT id, username, email
         FROM users
         WHERE id::text = $1::text
            OR lower(email) = lower($1)
            OR lower(username) = lower($1)
         LIMIT 1`,
        [identity]
    );

    const row = userQuery.rows[0] || null;
    const matchValues = new Set([identity.toLowerCase()]);

    if (row) {
        matchValues.add(String(row.id).toLowerCase());
        if (row.email) matchValues.add(String(row.email).toLowerCase());
        if (row.username) matchValues.add(String(row.username).toLowerCase());
    }

    return {
        userId: row ? toNullableInt(row.id) : toNullableInt(identity),
        matchValues: Array.from(matchValues).filter(Boolean)
    };
}

function canReadUserEvidence(req, requestedIdentity) {
    const authUser = getRequestUser(req);
    if (!authUser) return false;
    if (authUser.isAdmin) return true;

    const requested = String(requestedIdentity || '').trim().toLowerCase();
    return [authUser.id, authUser.email, authUser.username]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .includes(requested);
}

exports.getQuizById = async (req, res) => {
    try {
        await ensureTables();
        const quiz = parseQuizDefinition(req.params.id);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        return res.json(quiz);
    } catch (error) {
        console.error('Error getting quiz by id:', error);
        return res.status(500).json({ error: 'Failed to load quiz' });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        await ensureTables();

        const payload = req.body || {};
        const quizId = trimText(payload.quizId, 120);
        const answers = Array.isArray(payload.answers) ? payload.answers : [];

        if (!quizId) {
            return res.status(400).json({ error: 'quizId is required' });
        }

        const quizDefinition = parseQuizDefinition(quizId);
        const verification = verifyQuizSubmission(quizDefinition, payload);
        const sourceType = verification.verified
            ? verification.sourceType
            : normalizeSourceType(payload.sourceType || detectCategory(quizId));
        const totalQuestions = verification.verified
            ? verification.totalQuestions
            : Math.min(500, toNonNegativeInt(payload.totalQuestions, answers.length));
        const score = verification.verified
            ? verification.score
            : Math.min(totalQuestions, toNonNegativeInt(payload.score, 0));
        const percentage = verification.verified
            ? verification.percentage
            : Math.min(100, toNonNegativeInt(payload.percentage, totalQuestions > 0
                ? Math.round((score / totalQuestions) * 100)
                : 0));
        const passingScore = verification.verified
            ? verification.passingScore
            : 100;
        const passed = verification.verified
            ? verification.passed
            : false;

        const quizName = verification.quizName ||
            trimText(payload.quizName || payload.quizTitle, 255) ||
            buildQuizTitle(quizId);
        const quizCategory = verification.quizCategory ||
            trimText(payload.quizCategory, 64).toLowerCase() ||
            detectCategory(quizId);

        const userContext = await resolveUserContext(req, payload);
        const timeTaken = toNonNegativeInt(payload.timeTaken ?? payload.timeSpent, 0);
        const submittedMetadata = payload && typeof payload.metadata === 'object' && payload.metadata !== null
            ? payload.metadata
            : {};
        const metadata = {
            ...submittedMetadata,
            integrity: {
                verified: verification.verified,
                method: verification.method,
                claimedScore: toNonNegativeInt(payload.score, 0),
                claimedPercentage: Math.min(100, toNonNegativeInt(payload.percentage, 0)),
                claimedPassed: payload.passed === true,
                passingScore
            }
        };

        const insertAttempt = await pool.query(
            `INSERT INTO learning_attempts (
                user_id,
                user_identifier,
                user_name,
                user_email,
                quiz_id,
                quiz_name,
                quiz_category,
                source_type,
                score,
                total_questions,
                percentage,
                passed,
                answers,
                metadata,
                is_verified,
                verification_method,
                rubric_version,
                time_taken,
                submitted_at
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13::jsonb, $14::jsonb, $15, $16, $17, $18, CURRENT_TIMESTAMP
             )
             RETURNING id, submitted_at`,
            [
                userContext.userId,
                userContext.userIdentifier,
                userContext.userName,
                userContext.userEmail,
                quizId,
                quizName,
                quizCategory,
                sourceType,
                score,
                totalQuestions,
                percentage,
                passed,
                JSON.stringify(answers),
                JSON.stringify(metadata),
                verification.verified,
                verification.method,
                RUBRIC.id,
                timeTaken
            ]
        );

        const certificate = await issueCertificateIfEligible({
            userContext,
            payload,
            attemptData: {
                quizId,
                quizName,
                sourceType,
                passed,
                percentage,
                verified: verification.verified,
                verificationMethod: verification.method
            }
        });

        const progress = await refreshUserProgress(userContext);

        return res.json({
            score,
            total: totalQuestions,
            percentage,
            passed,
            resultId: String(insertAttempt.rows[0].id),
            submittedAt: insertAttempt.rows[0].submitted_at,
            sourceType,
            verified: verification.verified,
            verificationMethod: verification.method,
            progress,
            certificate
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        return res.status(500).json({ error: 'Failed to submit quiz' });
    }
};

exports.getUserQuizStats = async (req, res) => {
    try {
        await ensureTables();
        if (!canReadUserEvidence(req, req.params.userId)) {
            return res.status(403).json({ error: 'Insufficient privileges' });
        }
        const userLookup = await buildUserLookupContext(req.params.userId);

        const stats = await pool.query(
            `SELECT
                COUNT(*)::int AS total_attempts,
                COALESCE(MAX(percentage), 0)::int AS highest_score,
                COALESCE(ROUND(AVG(percentage)), 0)::int AS average_score,
                COUNT(*) FILTER (WHERE passed = true)::int AS passed_attempts,
                COUNT(*) FILTER (WHERE source_type = 'practice')::int AS practice_attempts,
                COUNT(*) FILTER (WHERE source_type = 'exam')::int AS exam_attempts,
                COUNT(*) FILTER (WHERE source_type = 'exam' AND passed = true)::int AS exams_passed,
                MAX(submitted_at) AS last_quiz_date
             FROM learning_attempts
             WHERE is_verified = true
               AND (
                    ($1::int IS NOT NULL AND user_id = $1)
                    OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_name, '')) = ANY($2::text[])
               )`,
            [userLookup.userId, userLookup.matchValues]
        );

        const categories = await pool.query(
            `SELECT DISTINCT quiz_category
             FROM learning_attempts
             WHERE is_verified = true
               AND (
                    ($1::int IS NOT NULL AND user_id = $1)
                    OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_name, '')) = ANY($2::text[])
             )
             AND COALESCE(quiz_category, '') <> ''`,
            [userLookup.userId, userLookup.matchValues]
        );

        const recent = await pool.query(
            `SELECT
                id,
                quiz_id AS "quizId",
                quiz_name AS "quizName",
                quiz_category AS "quizCategory",
                source_type AS "sourceType",
                score,
                total_questions AS "totalQuestions",
                percentage,
                passed,
                submitted_at AS "submittedAt"
             FROM learning_attempts
             WHERE is_verified = true
               AND (
                    ($1::int IS NOT NULL AND user_id = $1)
                    OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_name, '')) = ANY($2::text[])
               )
             ORDER BY submitted_at DESC
             LIMIT 5`,
            [userLookup.userId, userLookup.matchValues]
        );

        const certs = await pool.query(
            `SELECT COUNT(*)::int AS certificates_earned
             FROM user_certificates
             WHERE is_verified = true
               AND (
                    ($1::int IS NOT NULL AND user_id = $1)
                    OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_name, '')) = ANY($2::text[])
               )`,
            [userLookup.userId, userLookup.matchValues]
        );

        const row = stats.rows[0] || {};

        return res.json({
            totalAttempts: toNonNegativeInt(row.total_attempts, 0),
            highestScore: toNonNegativeInt(row.highest_score, 0),
            averageScore: toNonNegativeInt(row.average_score, 0),
            passedAttempts: toNonNegativeInt(row.passed_attempts, 0),
            practiceAttempts: toNonNegativeInt(row.practice_attempts, 0),
            examAttempts: toNonNegativeInt(row.exam_attempts, 0),
            examsPassed: toNonNegativeInt(row.exams_passed, 0),
            certificatesEarned: toNonNegativeInt(certs.rows[0]?.certificates_earned, 0),
            lastQuizDate: row.last_quiz_date || null,
            categoriesAttempted: categories.rows.map((item) => item.quiz_category).filter(Boolean),
            recentResults: recent.rows
        });
    } catch (error) {
        console.error('Error loading user quiz stats:', error);
        return res.status(500).json({ error: 'Failed to load quiz stats' });
    }
};

exports.getUserQuizHistory = async (req, res) => {
    try {
        await ensureTables();
        if (!canReadUserEvidence(req, req.params.userId)) {
            return res.status(403).json({ error: 'Insufficient privileges' });
        }

        const page = Math.max(1, toNonNegativeInt(req.query.page, 1));
        const limit = Math.min(100, Math.max(1, toNonNegativeInt(req.query.limit, 10)));
        const offset = (page - 1) * limit;
        const userLookup = await buildUserLookupContext(req.params.userId);

        const totalQuery = await pool.query(
            `SELECT COUNT(*)::int AS total_results
             FROM learning_attempts
             WHERE is_verified = true
               AND (
                    ($1::int IS NOT NULL AND user_id = $1)
                    OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_name, '')) = ANY($2::text[])
               )`,
            [userLookup.userId, userLookup.matchValues]
        );

        const rows = await pool.query(
            `SELECT
                id,
                quiz_id AS "quizId",
                quiz_name AS "quizName",
                quiz_category AS "quizCategory",
                source_type AS "sourceType",
                score,
                total_questions AS "totalQuestions",
                percentage,
                passed,
                submitted_at AS "submittedAt"
             FROM learning_attempts
             WHERE is_verified = true
               AND (
                    ($1::int IS NOT NULL AND user_id = $1)
                    OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                    OR lower(COALESCE(user_name, '')) = ANY($2::text[])
               )
             ORDER BY submitted_at DESC
             LIMIT $3 OFFSET $4`,
            [userLookup.userId, userLookup.matchValues, limit, offset]
        );

        const totalResults = toNonNegativeInt(totalQuery.rows[0]?.total_results, 0);
        const totalPages = Math.max(1, Math.ceil(totalResults / limit));

        return res.json({
            results: rows.rows,
            pagination: {
                currentPage: page,
                totalPages,
                totalResults,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error loading user quiz history:', error);
        return res.status(500).json({ error: 'Failed to load quiz history' });
    }
};
