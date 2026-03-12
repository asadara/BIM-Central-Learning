const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { getRequestUser } = require('../../utils/auth');
const { createPgConfig } = require('../../config/runtimeConfig');

const quizzesPath = path.join(__dirname, '../data/quizzes.json');

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
                    time_taken INTEGER DEFAULT 0,
                    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
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
                    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_identifier, quiz_id)
                );
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

async function resolveUserContext(req, payload = {}) {
    const authUser = getRequestUser(req) || {};
    const rawUserId = trimText(payload.userId || authUser.id, 120);
    const rawEmail = trimText(payload.userEmail || payload.email || authUser.email, 255).toLowerCase();
    const rawUsername = trimText(payload.userName || payload.username || authUser.username, 120);

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
        payload.userName || payload.username || (userRecord && userRecord.username) || rawUsername || '',
        120
    );
    const userEmail = trimText(
        payload.userEmail || payload.email || (userRecord && userRecord.email) || rawEmail || '',
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
        currentLevel: trimText((userRecord && userRecord.bim_level) || payload.currentLevel, 64) || 'BIM Modeller'
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
         WHERE user_id = $1`,
        [userContext.userId]
    );

    const certs = await pool.query(
        `SELECT COUNT(*)::int AS certificates_earned
         FROM user_certificates
         WHERE user_id = $1`,
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
            practice_attempts = GREATEST(user_progress.practice_attempts, EXCLUDED.practice_attempts),
            exams_passed = GREATEST(user_progress.exams_passed, EXCLUDED.exams_passed),
            certificates_earned = GREATEST(user_progress.certificates_earned, EXCLUDED.certificates_earned),
            current_level = COALESCE(EXCLUDED.current_level, user_progress.current_level),
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

async function issueCertificateIfEligible({ userContext, payload, attemptData }) {
    if (!attemptData.passed) return null;

    const shouldIssue = payload.issueCertificate === true || attemptData.sourceType === 'exam';
    if (!shouldIssue) return null;
    if (!userContext || !userContext.userIdentifier || userContext.userIdentifier === 'anonymous') return null;

    const quizId = trimText(attemptData.quizId, 120);
    if (!quizId) return null;

    const certificateTitle = trimText(
        payload.certificateTitle || payload.certificationTitle || `${attemptData.quizName} Certificate`,
        255
    );
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const certificateUrl = trimText(
        payload.certificateUrl || `/certificates/${certificateId}.pdf`,
        500
    ) || null;
    const issuer = trimText(payload.issuer, 120) || 'BC Learning Academy';

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
            issued_at
         ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12::jsonb, CURRENT_TIMESTAMP
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
            })
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
        const sourceType = normalizeSourceType(payload.sourceType || detectCategory(quizId));

        let score = toNullableInt(payload.score);
        let totalQuestions = toNullableInt(payload.totalQuestions);
        const passingScore = toNonNegativeInt(payload.passingScore, 70);

        if (!totalQuestions) {
            if (quizDefinition && Array.isArray(quizDefinition.questions)) {
                totalQuestions = quizDefinition.questions.length;
            } else {
                totalQuestions = answers.length;
            }
        }

        if (score === null) {
            if (quizDefinition && Array.isArray(quizDefinition.questions) && answers.length > 0) {
                let computed = 0;
                quizDefinition.questions.forEach((question, index) => {
                    if (answers[index] === question.answer) {
                        computed += 1;
                    }
                });
                score = computed;
            } else {
                score = 0;
            }
        }

        let percentage = toNullableInt(payload.percentage);
        if (percentage === null) {
            percentage = totalQuestions > 0
                ? Math.round((score / totalQuestions) * 100)
                : 0;
        }

        const passed = typeof payload.passed === 'boolean'
            ? payload.passed
            : percentage >= passingScore;

        const quizName = trimText(payload.quizName || payload.quizTitle, 255) ||
            trimText((quizDefinition && quizDefinition.title) || '', 255) ||
            buildQuizTitle(quizId);
        const quizCategory = trimText(payload.quizCategory, 64).toLowerCase() || detectCategory(quizId);

        const userContext = await resolveUserContext(req, payload);
        const timeTaken = toNonNegativeInt(payload.timeTaken ?? payload.timeSpent, 0);
        const metadata = payload && typeof payload.metadata === 'object' && payload.metadata !== null
            ? payload.metadata
            : {};

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
                time_taken,
                submitted_at
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13::jsonb, $14::jsonb, $15, CURRENT_TIMESTAMP
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
                percentage
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
             WHERE ($1::int IS NOT NULL AND user_id = $1)
                OR (lower(COALESCE(user_identifier, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_email, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_name, '')) = ANY($2::text[]))`,
            [userLookup.userId, userLookup.matchValues]
        );

        const categories = await pool.query(
            `SELECT DISTINCT quiz_category
             FROM learning_attempts
             WHERE (
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
             WHERE ($1::int IS NOT NULL AND user_id = $1)
                OR (lower(COALESCE(user_identifier, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_email, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_name, '')) = ANY($2::text[]))
             ORDER BY submitted_at DESC
             LIMIT 5`,
            [userLookup.userId, userLookup.matchValues]
        );

        const certs = await pool.query(
            `SELECT COUNT(*)::int AS certificates_earned
             FROM user_certificates
             WHERE ($1::int IS NOT NULL AND user_id = $1)
                OR (lower(COALESCE(user_identifier, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_email, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_name, '')) = ANY($2::text[]))`,
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

        const page = Math.max(1, toNonNegativeInt(req.query.page, 1));
        const limit = Math.min(100, Math.max(1, toNonNegativeInt(req.query.limit, 10)));
        const offset = (page - 1) * limit;
        const userLookup = await buildUserLookupContext(req.params.userId);

        const totalQuery = await pool.query(
            `SELECT COUNT(*)::int AS total_results
             FROM learning_attempts
             WHERE ($1::int IS NOT NULL AND user_id = $1)
                OR (lower(COALESCE(user_identifier, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_email, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_name, '')) = ANY($2::text[]))`,
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
             WHERE ($1::int IS NOT NULL AND user_id = $1)
                OR (lower(COALESCE(user_identifier, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_email, '')) = ANY($2::text[]))
                OR (lower(COALESCE(user_name, '')) = ANY($2::text[]))
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
