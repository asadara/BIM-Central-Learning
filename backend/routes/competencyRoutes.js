// Competency Mapping Routes
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { getRequestUser } = require('../utils/auth');
const { createPgConfig } = require('../config/runtimeConfig');
const {
    RUBRIC,
    getRubricContext,
    calculateCompetencyProfile
} = require('../services/competencyScoringService');

// Competency data storage
const REPORTS_DATA_FILE = path.join(__dirname, '..', 'competency-reports.json');
const AUTHORITY_DATA_FILE = path.join(__dirname, '..', 'competency-authorities.json');
const USERS_FILE = path.join(__dirname, '..', 'users.json');

// PostgreSQL connection configuration
const dbConfig = createPgConfig({
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in competencyRoutes:', err.message);
});

// Helper function to read reports data
async function readReportsData() {
    try {
        const data = await fs.readFile(REPORTS_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Helper function to write reports data
async function writeReportsData(data) {
    await fs.writeFile(REPORTS_DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper function to read authorities data
async function readAuthoritiesData() {
    try {
        const data = await fs.readFile(AUTHORITY_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Helper function to write authorities data
async function writeAuthoritiesData(data) {
    await fs.writeFile(AUTHORITY_DATA_FILE, JSON.stringify(data, null, 2));
}

async function readUsersFile() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function fetchMappingAccessFromDb(userId, email) {
    const result = await pool.query(
        `SELECT mapping_kompetensi_access
         FROM users
         WHERE ($1::text IS NOT NULL AND id::text = $1::text)
            OR ($2::text IS NOT NULL AND email = $2)
         LIMIT 1`,
        [userId ? String(userId) : null, email || null]
    );

    if (result.rows.length === 0) return null;
    return !!result.rows[0].mapping_kompetensi_access;
}

async function fetchMappingAccessFromJson(userId, email) {
    const users = await readUsersFile();
    const user = users.find(u =>
        (userId && (u.id === userId || u.id == userId)) ||
        (email && u.email === email)
    );

    if (!user) return null;
    return !!(user.mappingKompetensiAccess || user.mapping_kompetensi_access);
}

async function ensureCompetencyEvidenceSchema() {
    await pool.query(`ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE user_certificates ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS learning_activity_events (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT,
            user_email TEXT,
            module_id TEXT NOT NULL,
            module_type TEXT NOT NULL,
            event_type TEXT NOT NULL,
            title TEXT,
            category TEXT,
            source TEXT,
            progress_percent INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

function applyCompetencyProfile(user, evidence = user.competencyEvidence || {}) {
    const profile = calculateCompetencyProfile(evidence, getRubricContext());
    return {
        ...user,
        ...profile,
        competency: profile
    };
}

function normalizeLevelName(level) {
    const value = String(level || '').trim().toLowerCase();
    if (value === 'unassessed') return 'Unassessed';
    if (value === 'expert') return 'Expert';
    if (value === 'advanced') return 'Advanced';
    if (value === 'intermediate') return 'Intermediate';
    if (value === 'beginner') return 'Beginner';
    return 'Unassessed';
}

function buildLevelDistribution(users) {
    const distribution = {
        unassessed: 0,
        novice: 0,
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0
    };

    users.forEach((user) => {
        const level = normalizeLevelName(user.competencyLevel);
        distribution[level.toLowerCase()] += 1;
    });

    return distribution;
}

function computeAverageCompetency(users) {
    const assessedUsers = (Array.isArray(users) ? users : [])
        .filter((user) => user.competencyStatus === 'assessed');
    if (assessedUsers.length === 0) return null;
    const total = assessedUsers.reduce((sum, user) => sum + Number(user.competencyScore || 0), 0);
    return Math.round(total / assessedUsers.length);
}

async function fetchCompetencyUsersFromDb() {
    await ensureCompetencyEvidenceSchema();
    const result = await pool.query(
        `WITH attempt_stats AS (
            SELECT
                user_id,
                COUNT(*)::int AS total_attempts,
                COUNT(*) FILTER (WHERE source_type = 'quiz')::int AS quiz_attempts,
                COUNT(*) FILTER (WHERE source_type = 'practice')::int AS practice_attempts,
                COUNT(*) FILTER (WHERE source_type = 'exam')::int AS exam_attempts,
                COUNT(*) FILTER (WHERE source_type = 'exam' AND passed = true)::int AS exams_passed,
                COUNT(*) FILTER (WHERE passed = true)::int AS passed_attempts,
                COALESCE(ROUND(AVG(percentage)), 0)::int AS average_attempt_score,
                MAX(submitted_at) AS last_attempt_at,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT quiz_category), NULL) AS categories_attempted
            FROM learning_attempts
            WHERE user_id IS NOT NULL AND is_verified = true
            GROUP BY user_id
        ), certificate_stats AS (
            SELECT
                user_id,
                COUNT(*)::int AS certificate_count,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT quiz_id), NULL) AS certificate_exam_ids
            FROM user_certificates
            WHERE user_id IS NOT NULL AND is_verified = true
            GROUP BY user_id
        ), activity_stats AS (
            SELECT
                user_id,
                COUNT(DISTINCT (module_type, module_id)) FILTER (WHERE event_type = 'completed')::int AS completed_modules,
                COUNT(*)::int AS total_events
            FROM learning_activity_events
            WHERE user_id IS NOT NULL
            GROUP BY user_id
        )
        SELECT
            u.id,
            u.username,
            u.email,
            u.organization,
            u.bim_level,
            u.login_count,
            u.last_login,
            u.registration_date,
            COALESCE(act.completed_modules, 0) AS courses_completed,
            COALESCE(act.total_events, 0) AS learning_events,
            COALESCE(ast.total_attempts, 0) AS total_attempts,
            COALESCE(ast.quiz_attempts, 0) AS quiz_attempts,
            COALESCE(ast.practice_attempts, 0) AS practice_attempts,
            COALESCE(ast.exam_attempts, 0) AS exam_attempts,
            COALESCE(ast.exams_passed, 0) AS exams_passed,
            COALESCE(ast.passed_attempts, 0) AS passed_attempts,
            COALESCE(ast.average_attempt_score, 0) AS average_attempt_score,
            COALESCE(ast.categories_attempted, ARRAY[]::text[]) AS categories_attempted,
            ast.last_attempt_at,
            COALESCE(cert.certificate_count, 0) AS certificates_earned,
            COALESCE(cert.certificate_exam_ids, ARRAY[]::text[]) AS certificate_exam_ids
         FROM users u
         LEFT JOIN attempt_stats ast ON ast.user_id = u.id
         LEFT JOIN certificate_stats cert ON cert.user_id = u.id
         LEFT JOIN activity_stats act ON act.user_id = u.id::text
         WHERE COALESCE(u.is_active, true) = true
         ORDER BY u.id ASC`
    );

    return result.rows.map((row) => {
        const learningProgress = {
            coursesCompleted: Number(row.courses_completed || 0),
            totalEvents: Number(row.learning_events || 0),
            source: 'authenticated-activity-events'
        };
        const assessment = {
            quizAttempts: Number(row.quiz_attempts || 0),
            practiceAttempts: Number(row.practice_attempts || 0),
            examAttempts: Number(row.exam_attempts || 0),
            examsPassed: Number(row.exams_passed || 0),
            passedAttempts: Number(row.passed_attempts || 0),
            totalAttempts: Number(row.total_attempts || 0),
            averageAttemptScore: Number(row.average_attempt_score || 0),
            categoriesAttempted: Array.isArray(row.categories_attempted) ? row.categories_attempted.filter(Boolean) : [],
            source: 'verified-server-attempts'
        };
        const credentials = {
            certificatesEarned: Number(row.certificates_earned || 0),
            examIds: Array.isArray(row.certificate_exam_ids) ? row.certificate_exam_ids.filter(Boolean) : [],
            source: 'verified-server-certificates'
        };

        const normalizedUser = {
            id: row.id,
            username: row.username,
            email: row.email || null,
            organization: row.organization || 'Unspecified',
            bimLevel: row.bim_level || 'BIM Modeller',
            bimRole: row.bim_level || 'BIM Modeller',
            loginCount: Number(row.login_count || 0),
            lastLogin: row.last_login || row.last_attempt_at || row.registration_date || null,
            learningProgress,
            assessment,
            credentials,
            progress: {
                coursesCompleted: learningProgress.coursesCompleted,
                quizAttempts: assessment.quizAttempts,
                practiceAttempts: assessment.practiceAttempts,
                examAttempts: assessment.examAttempts,
                examsPassed: assessment.examsPassed,
                certificatesEarned: credentials.certificatesEarned,
                totalAttempts: assessment.totalAttempts,
                averageAttemptScore: assessment.averageAttemptScore,
                categoriesAttempted: assessment.categoriesAttempted
            }
        };

        return applyCompetencyProfile(normalizedUser, {
            verifiedAttempts: assessment.totalAttempts,
            verifiedPassedAttempts: assessment.passedAttempts,
            verifiedAverageScore: assessment.averageAttemptScore,
            verifiedCategories: assessment.categoriesAttempted,
            verifiedCertificateExamIds: credentials.examIds
        });
    });
}

async function fetchCompetencyUserDetailFromDb(userId) {
    const users = await fetchCompetencyUsersFromDb();
    const user = users.find((item) => String(item.id) === String(userId));
    if (!user) {
        return null;
    }

    const attemptsResult = await pool.query(
        `SELECT
            id,
            quiz_id,
            quiz_name,
            quiz_category,
            source_type,
            score,
            total_questions,
            percentage,
            passed,
            time_taken,
            verification_method,
            submitted_at
         FROM learning_attempts
         WHERE user_id::text = $1::text AND is_verified = true
         ORDER BY submitted_at DESC
         LIMIT 100`,
        [String(userId)]
    );

    let activitySummary = {
        pdfReads: 0,
        videosWatched: 0,
        completedModules: 0,
        totalEvents: 0
    };
    let activityEvents = [];

    try {
        const activitySummaryResult = await pool.query(
            `SELECT
                COUNT(*)::int AS total_events,
                COUNT(*) FILTER (
                    WHERE module_type = 'pdf' AND event_type = 'opened'
                )::int AS pdf_reads,
                COUNT(DISTINCT CASE
                    WHEN module_type = 'video' AND event_type IN ('opened', 'completed')
                    THEN module_id
                END)::int AS videos_watched,
                COUNT(DISTINCT CASE
                    WHEN event_type = 'completed'
                    THEN module_type || ':' || module_id
                END)::int AS completed_modules
             FROM learning_activity_events
             WHERE user_id::text = $1::text
                OR ($2::text IS NOT NULL AND lower(user_email) = lower($2::text))`,
            [String(userId), user.email || null]
        );

        const row = activitySummaryResult.rows[0] || {};
        activitySummary = {
            pdfReads: Number(row.pdf_reads || 0),
            videosWatched: Number(row.videos_watched || 0),
            completedModules: Number(row.completed_modules || 0),
            totalEvents: Number(row.total_events || 0)
        };

        const activityEventsResult = await pool.query(
            `SELECT
                module_id,
                module_type,
                event_type,
                title,
                category,
                source,
                progress_percent,
                created_at
             FROM learning_activity_events
             WHERE user_id::text = $1::text
                OR ($2::text IS NOT NULL AND lower(user_email) = lower($2::text))
             ORDER BY created_at DESC
             LIMIT 100`,
            [String(userId), user.email || null]
        );

        activityEvents = activityEventsResult.rows.map((event) => ({
            moduleId: event.module_id,
            moduleType: event.module_type,
            eventType: event.event_type,
            title: event.title || event.module_id || 'Learning activity',
            category: event.category || '',
            source: event.source || '',
            progressPercent: Number(event.progress_percent || 0),
            createdAt: event.created_at
        }));
    } catch (error) {
        console.warn('WARN: Failed to load learning activity detail:', error.message);
    }

    const attempts = attemptsResult.rows.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizName: attempt.quiz_name,
        quizCategory: attempt.quiz_category,
        sourceType: attempt.source_type,
        score: Number(attempt.score || 0),
        totalQuestions: Number(attempt.total_questions || 0),
        percentage: Number(attempt.percentage || 0),
        passed: !!attempt.passed,
        timeTaken: Number(attempt.time_taken || 0),
        verified: true,
        verificationMethod: attempt.verification_method || null,
        submittedAt: attempt.submitted_at
    }));

    const categorySummary = attempts.reduce((summary, attempt) => {
        const key = attempt.quizCategory || attempt.sourceType || 'uncategorized';
        if (!summary[key]) {
            summary[key] = {
                category: key,
                attempts: 0,
                passed: 0,
                bestScore: 0,
                averageScore: 0,
                latestAt: null,
                totalScore: 0
            };
        }

        summary[key].attempts += 1;
        summary[key].passed += attempt.passed ? 1 : 0;
        summary[key].bestScore = Math.max(summary[key].bestScore, attempt.percentage);
        summary[key].totalScore += attempt.percentage;
        summary[key].averageScore = Math.round(summary[key].totalScore / summary[key].attempts);
        summary[key].latestAt = summary[key].latestAt || attempt.submittedAt;
        return summary;
    }, {});

    const timeline = [
        ...attempts.slice(0, 50).map((attempt) => ({
            type: attempt.sourceType || 'quiz',
            title: attempt.quizName || 'Quiz attempt',
            category: attempt.quizCategory || '',
            score: attempt.percentage,
            status: attempt.passed ? 'passed' : 'completed',
            occurredAt: attempt.submittedAt
        })),
        ...activityEvents.slice(0, 50).map((event) => ({
            type: event.moduleType || 'activity',
            title: event.title || 'Learning activity',
            category: event.category || '',
            status: event.eventType || 'opened',
            progressPercent: event.progressPercent,
            occurredAt: event.createdAt
        }))
    ]
        .filter((item) => item.occurredAt)
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, 80);

    return {
        user,
        attemptSummary: {
            totalAttempts: attempts.length,
            quizAttempts: attempts.filter((attempt) => attempt.sourceType === 'quiz').length,
            practiceAttempts: attempts.filter((attempt) => attempt.sourceType === 'practice').length,
            examAttempts: attempts.filter((attempt) => attempt.sourceType === 'exam').length,
            passedAttempts: attempts.filter((attempt) => attempt.passed).length,
            averageScore: attempts.length
                ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length)
                : 0
        },
        categorySummary: Object.values(categorySummary).map((item) => {
            const { totalScore, ...publicItem } = item;
            return publicItem;
        }),
        attempts,
        activitySummary,
        activityEvents,
        timeline
    };
}

async function fetchDashboardInsightsFromDb(users) {
    let certificatesIssued = 0;
    let avgImprovement = null;
    let improvementSampleSize = 0;
    let activeUsers = 0;
    await ensureCompetencyEvidenceSchema();

    try {
        const certResult = await pool.query(
            `SELECT COUNT(*)::int AS certificates_issued
             FROM user_certificates
             WHERE is_verified = true`
        );
        certificatesIssued = Number(certResult.rows[0]?.certificates_issued || 0);
    } catch (error) {
        certificatesIssued = users.reduce((sum, user) => {
            return sum + Number(user.progress?.certificatesEarned || 0);
        }, 0);
    }

    try {
        const attemptsResult = await pool.query(
            `WITH per_user AS (
                SELECT
                    COALESCE(user_id::text, user_identifier) AS evidence_user,
                    AVG(percentage) FILTER (
                        WHERE submitted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                    ) AS recent_avg,
                    AVG(percentage) FILTER (
                        WHERE submitted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
                          AND submitted_at >= CURRENT_TIMESTAMP - INTERVAL '60 days'
                    ) AS previous_avg
                FROM learning_attempts
                WHERE is_verified = true
                GROUP BY COALESCE(user_id::text, user_identifier)
             )
             SELECT
                (SELECT ROUND(AVG(recent_avg - previous_avg))::int
                 FROM per_user
                 WHERE recent_avg IS NOT NULL AND previous_avg IS NOT NULL) AS avg_improvement_points,
                (SELECT COUNT(*)::int
                 FROM per_user
                 WHERE recent_avg IS NOT NULL AND previous_avg IS NOT NULL) AS improvement_sample_size,
                (SELECT COUNT(DISTINCT COALESCE(user_id::text, user_identifier))::int
                 FROM learning_attempts
                 WHERE is_verified = true
                   AND submitted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS active_users_30d`
        );

        activeUsers = Number(attemptsResult.rows[0]?.active_users_30d || 0);
        improvementSampleSize = Number(attemptsResult.rows[0]?.improvement_sample_size || 0);
        avgImprovement = improvementSampleSize > 0
            ? Number(attemptsResult.rows[0]?.avg_improvement_points || 0)
            : null;
    } catch (error) {
        activeUsers = 0;
        avgImprovement = null;
        improvementSampleSize = 0;
    }

    return {
        avgImprovement,
        improvementUnit: 'percentage-points',
        improvementSampleSize,
        activeUsers,
        activeWindowDays: 30,
        certificatesIssued
    };
}

// Middleware to check competency authority
async function requireCompetencyAuthority(req, res, next) {
    const authUser = getRequestUser(req);
    if (!authUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        let hasAccess = authUser.isAdmin ? true : null;
        if (hasAccess === null) {
            try {
                hasAccess = await fetchMappingAccessFromDb(authUser.id, authUser.email);
            } catch (dbError) {
                console.warn('WARN: PostgreSQL not available for mapping access, falling back to JSON:', dbError.message);
            }
        }

        if (hasAccess === null) {
            hasAccess = await fetchMappingAccessFromJson(authUser.id, authUser.email);
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'Mapping kompetensi access required' });
        }

        req.user = {
            userId: authUser.id || authUser.email || authUser.username,
            username: authUser.username || authUser.email || 'user',
            role: authUser.isAdmin ? 'admin' : String(authUser.role || 'user').toLowerCase()
        };
        next();
    } catch (error) {
        console.error('Error checking competency authority:', error);
        res.status(500).json({ error: 'Failed to verify access' });
    }
}

// GET /api/competency/dashboard - Get dashboard data
router.get('/dashboard', requireCompetencyAuthority, async (req, res) => {
    try {
        const reports = await readReportsData();
        let users = [];

        try {
            users = await fetchCompetencyUsersFromDb();
        } catch (dbError) {
            console.error('Failed to load verified competency evidence from PostgreSQL:', dbError.message);
            return res.status(503).json({ error: 'Verified competency evidence is unavailable' });
        }

        const visibleReports = req.user?.role === 'admin'
            ? reports
            : reports.filter((report) => String(report.generated_by) === String(req.user?.userId) || report.status === 'approved');
        const totalUsers = users.length;
        const totalReports = visibleReports.length;
        const pendingApprovals = visibleReports.filter(r => r.status === 'pending_approval').length;
        const averageCompetency = computeAverageCompetency(users);
        const competencyLevels = buildLevelDistribution(users);
        const insights = await fetchDashboardInsightsFromDb(users);

        // Recent reports
        const recentReports = visibleReports
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        res.json({
            totalUsers,
            averageCompetency,
            totalReports,
            pendingApprovals,
            competencyLevels,
            avgImprovement: insights.avgImprovement,
            improvementUnit: insights.improvementUnit,
            improvementSampleSize: insights.improvementSampleSize,
            activeUsers: insights.activeUsers,
            activeWindowDays: insights.activeWindowDays,
            certificatesIssued: insights.certificatesIssued,
            recentReports,
            users: users || [],
            dataSource: 'postgresql',
            rubric: getRubricContext()
        });

    } catch (error) {
        console.error('Error loading competency dashboard:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// GET /api/competency/users - Get all users with competency data
router.get('/users', requireCompetencyAuthority, async (req, res) => {
    try {
        let usersWithCompetency = [];

        try {
            usersWithCompetency = await fetchCompetencyUsersFromDb();
        } catch (dbError) {
            console.error('Failed to load verified competency evidence from PostgreSQL:', dbError.message);
            return res.status(503).json({ error: 'Verified competency evidence is unavailable' });
        }

        res.json(usersWithCompetency);

    } catch (error) {
        console.error('Error loading competency users:', error);
        res.status(500).json({ error: 'Failed to load users data' });
    }
});

// GET /api/competency/users/:userId/detail - Get selected user competency and learning history
router.get('/users/:userId/detail', requireCompetencyAuthority, async (req, res) => {
    try {
        let detail = null;

        try {
            detail = await fetchCompetencyUserDetailFromDb(req.params.userId);
        } catch (dbError) {
            console.error('Failed to load verified competency user detail:', dbError.message);
            return res.status(503).json({ error: 'Verified competency evidence is unavailable' });
        }

        if (!detail) {
            return res.status(404).json({ error: 'User competency detail not found' });
        }

        return res.json(detail);
    } catch (error) {
        console.error('Error loading competency user detail:', error);
        return res.status(500).json({ error: 'Failed to load user competency detail' });
    }
});

// POST /api/competency-reports/generate - Generate new report
router.post('/generate', requireCompetencyAuthority, async (req, res) => {
    try {
        const { title, type, userId, organizationId, notes } = req.body;

        if (!title || !type) {
            return res.status(400).json({ error: 'Title and type are required' });
        }

        const reports = await readReportsData();

        // Generate new report
        const newReport = {
            id: Date.now(),
            title,
            type,
            userId: userId || null,
            organizationId: organizationId || null,
            notes: notes || '',
            status: 'draft', // Will be changed to 'pending_approval' after generation
            created_at: new Date().toISOString(),
            generated_by: req.user ? req.user.userId : 'system',
            approved_by: null,
            approved_at: null,
            rejection_reason: null
        };

        // Generate report content based on type
        switch(type) {
            case 'individual':
                if (!userId) {
                    return res.status(400).json({ error: 'User ID required for individual report' });
                }
                newReport.content = await generateIndividualReport(userId);
                break;
            case 'organization':
                if (!organizationId) {
                    return res.status(400).json({ error: 'Organization ID required for organization report' });
                }
                newReport.content = await generateOrganizationReport(organizationId);
                break;
            case 'summary':
                newReport.content = await generateSummaryReport();
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        // Change status to pending approval
        newReport.status = 'pending_approval';

        reports.push(newReport);
        await writeReportsData(reports);

        console.log(`✅ Report generated: ${title} (${type})`);

        res.json({
            success: true,
            reportId: newReport.id,
            message: 'Report generated successfully'
        });

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// GET /api/competency-reports - Get all reports
router.get('/', requireCompetencyAuthority, async (req, res) => {
    try {
        const reports = await readReportsData();

        // Filter reports based on user authority
        let filteredReports = reports;

        // If user is not admin, only show their own reports or public approved reports
        if (req.user && req.user.role !== 'admin') {
            filteredReports = reports.filter(report =>
                String(report.generated_by) === String(req.user.userId) ||
                report.status === 'approved'
            );
        }

        res.json(filteredReports);

    } catch (error) {
        console.error('Error loading reports:', error);
        res.status(500).json({ error: 'Failed to load reports' });
    }
});

// POST /api/competency-reports/:id/approve - Approve report (Authority only)
router.post('/:id/approve', requireCompetencyAuthority, async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const { comments } = req.body;

        const reports = await readReportsData();
        const reportIndex = reports.findIndex(r => r.id === reportId);

        if (reportIndex === -1) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const report = reports[reportIndex];

        // Check if user has authority to approve
        const authorities = await readAuthoritiesData();
        const userAuthority = authorities.find(a =>
            String(a.user_id) === String(req.user.userId) &&
            a.role === 'authority' &&
            a.is_active
        );

        if (!userAuthority && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient authority to approve reports' });
        }

        // Update report
        report.status = 'approved';
        report.approved_by = req.user.userId;
        report.approved_at = new Date().toISOString();
        report.approval_comments = comments || '';

        await writeReportsData(reports);

        console.log(`✅ Report ${reportId} approved by ${req.user.userId}`);

        res.json({
            success: true,
            message: 'Report approved successfully'
        });

    } catch (error) {
        console.error('Error approving report:', error);
        res.status(500).json({ error: 'Failed to approve report' });
    }
});

// POST /api/competency-reports/:id/reject - Reject report (Authority only)
router.post('/:id/reject', requireCompetencyAuthority, async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const reports = await readReportsData();
        const reportIndex = reports.findIndex(r => r.id === reportId);

        if (reportIndex === -1) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const report = reports[reportIndex];

        // Check authority (same as approve)
        const authorities = await readAuthoritiesData();
        const userAuthority = authorities.find(a =>
            String(a.user_id) === String(req.user.userId) &&
            a.role === 'authority' &&
            a.is_active
        );

        if (!userAuthority && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient authority to reject reports' });
        }

        // Update report
        report.status = 'rejected';
        report.approved_by = req.user.userId;
        report.approved_at = new Date().toISOString();
        report.rejection_reason = reason;

        await writeReportsData(reports);

        console.log(`❌ Report ${reportId} rejected by ${req.user.userId}: ${reason}`);

        res.json({
            success: true,
            message: 'Report rejected successfully'
        });

    } catch (error) {
        console.error('Error rejecting report:', error);
        res.status(500).json({ error: 'Failed to reject report' });
    }
});

// GET /api/competency/authorities/check - Check user authority
router.get('/authorities/check', requireCompetencyAuthority, async (req, res) => {
    try {
        if (req.user && req.user.role === 'admin') {
            res.json({
                hasAuthority: true,
                authority: {
                    id: `admin:${req.user.userId}`,
                    user_id: req.user.userId,
                    username: req.user.username,
                    role: 'authority',
                    status: 'approved',
                    is_active: true,
                    source: 'admin-privilege'
                }
            });
            return;
        }

        const authorities = await readAuthoritiesData();
        const userAuthority = authorities.find(a =>
            String(a.user_id) === String(req.user.userId) && a.is_active
        );

        if (userAuthority) {
            res.json({
                hasAuthority: true,
                authority: userAuthority
            });
        } else {
            res.json({
                hasAuthority: false,
                authority: null
            });
        }

    } catch (error) {
        console.error('Error checking authority:', error);
        res.status(500).json({ error: 'Failed to check authority' });
    }
});

// POST /api/competency-authorities/request - Request authority role
router.post('/authorities/request', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { role, reason } = req.body;

        if (!role || !['manager', 'authority'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        const authorities = await readAuthoritiesData();

        // Check if user already has authority
        const existingAuthority = authorities.find(a => String(a.user_id) === String(req.user.userId));
        if (existingAuthority && existingAuthority.is_active) {
            return res.status(409).json({ error: 'User already has authority' });
        }

        // Create new authority request
        const newAuthority = {
            id: Date.now(),
            user_id: req.user.userId,
            username: req.user.username,
            role: role,
            requested_at: new Date().toISOString(),
            reason: reason || '',
            status: 'pending', // pending, approved, rejected
            granted_by: null,
            granted_at: null,
            is_active: false
        };

        authorities.push(newAuthority);
        await writeAuthoritiesData(authorities);

        console.log(`📝 Authority request submitted by ${req.user.username} for role: ${role}`);

        res.json({
            success: true,
            message: 'Authority request submitted successfully',
            requestId: newAuthority.id
        });

    } catch (error) {
        console.error('Error requesting authority:', error);
        res.status(500).json({ error: 'Failed to submit authority request' });
    }
});

// PUT /api/admin/competency-authorities/:id/approve - Approve authority request (Admin only)
router.put('/admin/authorities/:id/approve', requireAdminSession, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        const authorities = await readAuthoritiesData();
        const authorityIndex = authorities.findIndex(a => a.id === requestId);

        if (authorityIndex === -1) {
            return res.status(404).json({ error: 'Authority request not found' });
        }

        const authority = authorities[authorityIndex];

        // Update authority
        authority.status = 'approved';
        authority.granted_by = req.user.userId;
        authority.granted_at = new Date().toISOString();
        authority.is_active = true;

        await writeAuthoritiesData(authorities);

        console.log(`✅ Authority approved for user ${authority.username}: ${authority.role}`);

        res.json({
            success: true,
            message: 'Authority approved successfully'
        });

    } catch (error) {
        console.error('Error approving authority:', error);
        res.status(500).json({ error: 'Failed to approve authority' });
    }
});

// PUT /api/admin/competency-authorities/:id/reject - Reject authority request (Admin only)
router.put('/admin/authorities/:id/reject', requireAdminSession, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { reason } = req.body;

        const authorities = await readAuthoritiesData();
        const authorityIndex = authorities.findIndex(a => a.id === requestId);

        if (authorityIndex === -1) {
            return res.status(404).json({ error: 'Authority request not found' });
        }

        const authority = authorities[authorityIndex];

        // Update authority
        authority.status = 'rejected';
        authority.rejection_reason = reason || '';
        authority.processed_by = req.user.userId;
        authority.processed_at = new Date().toISOString();

        await writeAuthoritiesData(authorities);

        console.log(`❌ Authority rejected for user ${authority.username}: ${reason}`);

        res.json({
            success: true,
            message: 'Authority request rejected'
        });

    } catch (error) {
        console.error('Error rejecting authority:', error);
        res.status(500).json({ error: 'Failed to reject authority' });
    }
});

// GET /api/admin/competency-authorities - Get all authority requests (Admin only)
router.get('/admin/authorities', requireAdminSession, async (req, res) => {
    try {
        const authorities = await readAuthoritiesData();
        res.json(authorities);
    } catch (error) {
        console.error('Error loading authorities:', error);
        res.status(500).json({ error: 'Failed to load authorities' });
    }
});

// Helper Functions for Report Generation
async function generateIndividualReport(userId) {
    const users = await fetchCompetencyUsersFromDb();

    const user = users.find(u => String(u.id) === String(userId));

    if (!user) {
        throw new Error('User not found');
    }

    return {
        rubricVersion: user.rubricVersion || RUBRIC.id,
        userInfo: {
            name: user.username,
            email: user.email,
            organization: user.organization,
            bimRole: user.bimRole || user.bimLevel,
            jobRole: user.jobRole || null
        },
        learningProgress: user.learningProgress || {},
        assessment: user.assessment || {},
        credentials: user.credentials || {},
        competency: user.competency || {
            rubricVersion: user.rubricVersion,
            competencyStatus: user.competencyStatus,
            competencyScore: user.competencyScore,
            competencyLevel: user.competencyLevel,
            dimensions: user.dimensions
        },
        generatedAt: new Date().toISOString()
    };
}

async function generateOrganizationReport(organizationId) {
    const users = await fetchCompetencyUsersFromDb();

    const orgUsers = users.filter(u => u.organization === organizationId);

    const totalUsers = orgUsers.length;
    const avgScore = computeAverageCompetency(orgUsers);
    const levelDistribution = buildLevelDistribution(orgUsers);

    return {
        organization: organizationId,
        totalUsers,
        averageScore: avgScore,
        rubricVersion: RUBRIC.id,
        levelDistribution,
        topPerformers: orgUsers
            .filter((user) => user.competencyStatus === 'assessed')
            .map(u => ({ ...u, score: Number(u.competencyScore || 0) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5),
        generatedAt: new Date().toISOString()
    };
}

async function generateSummaryReport() {
    const users = await fetchCompetencyUsersFromDb();

    const totalUsers = users.length;
    const avgScore = computeAverageCompetency(users);
    const levelDistribution = buildLevelDistribution(users);

    // Organization breakdown
    const orgBreakdown = {};
    users.forEach(user => {
        const org = user.organization || 'Unspecified';
        if (!orgBreakdown[org]) {
            orgBreakdown[org] = { count: 0, assessedCount: 0, totalScore: 0 };
        }
        orgBreakdown[org].count++;
        if (user.competencyStatus === 'assessed') {
            orgBreakdown[org].assessedCount = (orgBreakdown[org].assessedCount || 0) + 1;
            orgBreakdown[org].totalScore += Number(user.competencyScore || 0);
        }
    });

    Object.keys(orgBreakdown).forEach(org => {
        orgBreakdown[org].averageScore = orgBreakdown[org].assessedCount
            ? Math.round(orgBreakdown[org].totalScore / orgBreakdown[org].assessedCount)
            : null;
    });

    return {
        totalUsers,
        averageScore: avgScore,
        rubricVersion: RUBRIC.id,
        levelDistribution,
        organizationBreakdown: orgBreakdown,
        topPerformers: users
            .filter((user) => user.competencyStatus === 'assessed')
            .map(u => ({ ...u, score: Number(u.competencyScore || 0) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10),
        generatedAt: new Date().toISOString()
    };
}

module.exports = router;

// Helper middleware for admin session check
function requireAdminSession(req, res, next) {
    const authUser = getRequestUser(req);
    if (authUser && authUser.isAdmin) {
        req.authUser = authUser;
        req.user = {
            userId: authUser.id || authUser.email || 'admin',
            username: authUser.username || authUser.email || 'admin',
            role: 'admin'
        };
        return next();
    }

    res.status(401).json({ error: 'Admin authentication required' });
}

