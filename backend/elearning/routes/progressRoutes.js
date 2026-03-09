const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey_change_in_production';

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD || 'secure_password_2025',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

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

function defaultToNextLevel(currentLevel) {
    if (currentLevel === 'BIM Modeller') return 0;
    if (currentLevel === 'BIM Coordinator') return 0;
    return 0;
}

async function fetchUserAndProgress(userId) {
    const query = `
        SELECT
            u.id AS user_id,
            u.bim_level AS user_bim_level,
            up.user_id AS progress_user_id,
            up.courses_completed,
            up.practice_attempts,
            up.exams_passed,
            up.certificates_earned,
            up.current_level,
            up.to_next_level,
            up.updated_at
        FROM users u
        LEFT JOIN user_progress up ON up.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
    `;
    const result = await pgPool.query(query, [userId]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
}

async function ensureUserProgressRow(userId, fallbackLevel) {
    const currentLevel = normalizeLevel(fallbackLevel) || 'BIM Modeller';
    const toNext = defaultToNextLevel(currentLevel);

    await pgPool.query(
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
        ) VALUES (
            $1, 0, 0, 0, 0, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id) DO NOTHING`,
        [userId, currentLevel, toNext]
    );
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

        let row = await fetchUserAndProgress(userId);
        if (!row) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!row.progress_user_id) {
            await ensureUserProgressRow(userId, row.user_bim_level);
            row = await fetchUserAndProgress(userId);
        }

        return res.json({
            success: true,
            progress: mapProgressRow(row)
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

        const payload = req.body || {};
        const coursesCompleted = toNonNegativeInt(payload.coursesCompleted, 0);
        const practiceAttempts = toNonNegativeInt(payload.practiceAttempts, 0);
        const examsPassed = toNonNegativeInt(payload.examsPassed, 0);
        const certificatesEarned = toNonNegativeInt(payload.certificatesEarned, 0);

        const userRowResult = await pgPool.query(
            `SELECT id, bim_level
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [userId]
        );

        if (userRowResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const userBimLevel = userRowResult.rows[0].bim_level;
        const currentLevel = normalizeLevel(payload.currentLevel) || normalizeLevel(userBimLevel) || 'BIM Modeller';
        const toNextLevel = toNonNegativeInt(payload.toNextLevel, defaultToNextLevel(currentLevel));

        const upsertResult = await pgPool.query(
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
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id) DO UPDATE SET
                courses_completed = GREATEST(user_progress.courses_completed, EXCLUDED.courses_completed),
                practice_attempts = GREATEST(user_progress.practice_attempts, EXCLUDED.practice_attempts),
                exams_passed = GREATEST(user_progress.exams_passed, EXCLUDED.exams_passed),
                certificates_earned = GREATEST(user_progress.certificates_earned, EXCLUDED.certificates_earned),
                current_level = COALESCE(EXCLUDED.current_level, user_progress.current_level),
                to_next_level = GREATEST(user_progress.to_next_level, EXCLUDED.to_next_level),
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
                userId,
                coursesCompleted,
                practiceAttempts,
                examsPassed,
                certificatesEarned,
                currentLevel,
                toNextLevel
            ]
        );

        const progress = mapProgressRow({
            ...upsertResult.rows[0],
            user_bim_level: userBimLevel
        });

        return res.json({
            success: true,
            progress
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
