const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { createPgConfig, getJwtSecret } = require('../../config/runtimeConfig');

const router = express.Router();

const SECRET_KEY = getJwtSecret();

const pgPool = new Pool(createPgConfig({
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pgPool.on('error', (err) => {
    console.warn('Progress routes PostgreSQL pool error:', err.message);
});

function requireAuth(req, res, next) {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

function toNonNegativeInt(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < 0) return fallback;
    return Math.floor(parsed);
}

function normalizeLevel(level) {
    const value = String(level || '').trim();
    if (!value) return null;
    const allowed = new Set(['BIM Modeller', 'BIM Coordinator', 'BIM Manager', 'Expert']);
    return allowed.has(value) ? value : null;
}

async function ensureEvidenceSchema() {
    await pgPool.query(`ALTER TABLE learning_attempts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
    await pgPool.query(`ALTER TABLE user_certificates ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false`);
}

async function deriveAuthoritativeProgress(userId) {
    await ensureEvidenceSchema();

    const userResult = await pgPool.query(
        `SELECT id, bim_level FROM users WHERE id = $1 LIMIT 1`,
        [userId]
    );
    if (userResult.rows.length === 0) return null;

    const attemptsResult = await pgPool.query(
        `SELECT
            COUNT(*) FILTER (WHERE source_type = 'practice')::int AS practice_attempts,
            COUNT(*) FILTER (WHERE source_type = 'exam' AND passed = true)::int AS exams_passed
         FROM learning_attempts
         WHERE user_id = $1 AND is_verified = true`,
        [userId]
    );
    const certificatesResult = await pgPool.query(
        `SELECT COUNT(*)::int AS certificates_earned
         FROM user_certificates
         WHERE user_id = $1 AND is_verified = true`,
        [userId]
    );

    let coursesCompleted = 0;
    try {
        const activityResult = await pgPool.query(
            `SELECT COUNT(DISTINCT (module_type, module_id))::int AS courses_completed
             FROM learning_activity_events
             WHERE user_id = $1 AND event_type = 'completed'`,
            [userId]
        );
        coursesCompleted = toNonNegativeInt(activityResult.rows[0]?.courses_completed, 0);
    } catch (error) {
        if (error.code !== '42P01') throw error;
    }

    const currentLevel = normalizeLevel(userResult.rows[0].bim_level) || 'BIM Modeller';
    const attempts = attemptsResult.rows[0] || {};
    const certificates = certificatesResult.rows[0] || {};

    return {
        userId,
        userBimLevel: currentLevel,
        coursesCompleted,
        practiceAttempts: toNonNegativeInt(attempts.practice_attempts, 0),
        examsPassed: toNonNegativeInt(attempts.exams_passed, 0),
        certificatesEarned: toNonNegativeInt(certificates.certificates_earned, 0),
        currentLevel,
        toNextLevel: 0
    };
}

async function persistAuthoritativeProgress(progress) {
    const result = await pgPool.query(
        `INSERT INTO user_progress (
            user_id,
            courses_completed,
            practice_attempts,
            exams_passed,
            certificates_earned,
            current_level,
            to_next_level,
            created_at,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
            courses_completed = EXCLUDED.courses_completed,
            practice_attempts = EXCLUDED.practice_attempts,
            exams_passed = EXCLUDED.exams_passed,
            certificates_earned = EXCLUDED.certificates_earned,
            current_level = EXCLUDED.current_level,
            to_next_level = EXCLUDED.to_next_level,
            updated_at = CURRENT_TIMESTAMP
        RETURNING
            user_id AS progress_user_id,
            courses_completed,
            practice_attempts,
            exams_passed,
            certificates_earned,
            current_level,
            to_next_level,
            updated_at`,
        [
            progress.userId,
            progress.coursesCompleted,
            progress.practiceAttempts,
            progress.examsPassed,
            progress.certificatesEarned,
            progress.currentLevel,
            progress.toNextLevel
        ]
    );
    return result.rows[0];
}

function mapProgressRow(row) {
    return {
        coursesCompleted: toNonNegativeInt(row?.courses_completed, 0),
        practiceAttempts: toNonNegativeInt(row?.practice_attempts, 0),
        examsPassed: toNonNegativeInt(row?.exams_passed, 0),
        certificatesEarned: toNonNegativeInt(row?.certificates_earned, 0),
        currentLevel: normalizeLevel(row?.current_level) || normalizeLevel(row?.user_bim_level) || 'BIM Modeller',
        toNextLevel: toNonNegativeInt(row?.to_next_level, 0),
        updatedAt: row?.updated_at || null
    };
}

router.get('/me', requireAuth, async (req, res) => {
    try {
        const userId = Number(req.user && req.user.userId);
        if (!Number.isFinite(userId)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid user session'
            });
        }

        const derived = await deriveAuthoritativeProgress(userId);
        if (!derived) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const row = await persistAuthoritativeProgress(derived);

        return res.json({
            success: true,
            progress: mapProgressRow({ ...row, user_bim_level: derived.userBimLevel }),
            source: 'server-evidence'
        });
    } catch (error) {
        console.error('Progress GET /me error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch progress'
        });
    }
});

async function upsertProgress(req, res) {
    try {
        const userId = Number(req.user && req.user.userId);
        if (!Number.isFinite(userId)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid user session'
            });
        }

        const derived = await deriveAuthoritativeProgress(userId);
        if (!derived) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const savedRow = await persistAuthoritativeProgress(derived);

        const progress = mapProgressRow({
            ...savedRow,
            user_bim_level: derived.userBimLevel
        });

        return res.json({
            success: true,
            progress,
            source: 'server-evidence',
            ignoredClientSnapshot: true
        });
    } catch (error) {
        console.error('Progress upsert error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to save progress'
        });
    }
}

router.put('/me', requireAuth, upsertProgress);
router.post('/sync', requireAuth, upsertProgress);

module.exports = router;
