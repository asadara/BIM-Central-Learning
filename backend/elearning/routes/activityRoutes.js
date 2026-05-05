const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const { createPgConfig, getJwtSecret } = require("../../config/runtimeConfig");

const router = express.Router();
const SECRET_KEY = getJwtSecret();

const pgPool = new Pool(createPgConfig({
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pgPool.on("error", (err) => {
    console.warn("Learning activity routes PostgreSQL pool error:", err.message);
});

let ensureActivityTablePromise = null;

function requireAuth(req, res, next) {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Access token required"
        });
    }

    try {
        req.user = jwt.verify(token, SECRET_KEY);
        return next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: "Invalid or expired token"
        });
    }
}

function toSafeText(value, maxLength = 255) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.slice(0, maxLength);
}

function toProgressPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    if (parsed < 0) return 0;
    if (parsed > 100) return 100;
    return Math.round(parsed);
}

function normalizeModuleType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "video") return "video";
    if (normalized === "page" || normalized === "article" || normalized === "reading") return "page";
    return "pdf";
}

function normalizeEventType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "completed" ? "completed" : "opened";
}

async function ensureActivityTable() {
    if (!ensureActivityTablePromise) {
        ensureActivityTablePromise = (async () => {
            await pgPool.query(`
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

            await pgPool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_activity_user_id
                ON learning_activity_events(user_id)
            `);

            await pgPool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_activity_user_email
                ON learning_activity_events(user_email)
            `);

            await pgPool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_activity_module
                ON learning_activity_events(module_type, module_id)
            `);

            await pgPool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_activity_event_type
                ON learning_activity_events(event_type)
            `);

            await pgPool.query(`
                CREATE INDEX IF NOT EXISTS idx_learning_activity_created_at
                ON learning_activity_events(created_at DESC)
            `);
        })().catch((error) => {
            ensureActivityTablePromise = null;
            throw error;
        });
    }

    return ensureActivityTablePromise;
}

function resolveUserIdentity(req) {
    const userId = req.user && req.user.userId != null ? String(req.user.userId) : null;
    const userEmail = req.user && req.user.email ? String(req.user.email) : null;
    return { userId, userEmail };
}

function mapActivityTitle(event) {
    let baseTitle = "PDF learning";

    if (event.moduleType === "video") {
        baseTitle = "Video learning";
    } else if (event.moduleType === "page") {
        baseTitle = "Learning material";
    }

    if (event.title) {
        baseTitle = event.title;
    }

    if (event.eventType === "completed") {
        return `Completed ${baseTitle}`;
    }
    return `Opened ${baseTitle}`;
}

router.post("/track", requireAuth, async (req, res) => {
    try {
        await ensureActivityTable();

        const moduleId = toSafeText(req.body?.moduleId, 160);
        if (!moduleId) {
            return res.status(400).json({
                success: false,
                error: "Module ID is required"
            });
        }

        const moduleType = normalizeModuleType(req.body?.moduleType);
        const eventType = normalizeEventType(req.body?.eventType);
        const title = toSafeText(req.body?.title, 255);
        const category = toSafeText(req.body?.category, 120);
        const source = toSafeText(req.body?.source, 50) || "elearning";
        const progressPercent = toProgressPercent(req.body?.progressPercent);
        const { userId, userEmail } = resolveUserIdentity(req);

        if (eventType === "completed") {
            const existingResult = await pgPool.query(
                `
                    SELECT id, created_at
                    FROM learning_activity_events
                    WHERE module_id = $1
                      AND module_type = $2
                      AND event_type = 'completed'
                      AND (
                            ($3::text IS NOT NULL AND user_id = $3)
                         OR ($4::text IS NOT NULL AND lower(user_email) = lower($4))
                      )
                    LIMIT 1
                `,
                [moduleId, moduleType, userId, userEmail]
            );

            if (existingResult.rows.length > 0) {
                return res.json({
                    success: true,
                    deduped: true,
                    moduleId,
                    moduleType,
                    eventType
                });
            }
        }

        await pgPool.query(
            `
                INSERT INTO learning_activity_events (
                    user_id,
                    user_email,
                    module_id,
                    module_type,
                    event_type,
                    title,
                    category,
                    source,
                    progress_percent
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [userId, userEmail, moduleId, moduleType, eventType, title, category, source, progressPercent]
        );

        return res.json({
            success: true,
            moduleId,
            moduleType,
            eventType
        });
    } catch (error) {
        console.error("Learning activity track error:", error.message);
        return res.status(500).json({
            success: false,
            error: "Failed to track learning activity"
        });
    }
});

router.get("/summary", requireAuth, async (req, res) => {
    try {
        await ensureActivityTable();
        const { userId, userEmail } = resolveUserIdentity(req);

        const summaryResult = await pgPool.query(
            `
                SELECT
                    COUNT(*) FILTER (
                        WHERE module_type = 'pdf' AND event_type = 'opened'
                    )::INT AS pdf_reads,
                    COUNT(DISTINCT CASE
                        WHEN module_type = 'video' AND event_type IN ('opened', 'completed')
                        THEN module_id
                    END)::INT AS videos_watched,
                    COUNT(DISTINCT CASE
                        WHEN event_type = 'completed'
                        THEN module_type || ':' || module_id
                    END)::INT AS completed_modules
                FROM learning_activity_events
                WHERE ($1::text IS NOT NULL AND user_id = $1)
                   OR ($2::text IS NOT NULL AND lower(user_email) = lower($2))
            `,
            [userId, userEmail]
        );

        const recentResult = await pgPool.query(
            `
                SELECT
                    module_id,
                    module_type,
                    event_type,
                    title,
                    category,
                    progress_percent,
                    created_at
                FROM learning_activity_events
                WHERE ($1::text IS NOT NULL AND user_id = $1)
                   OR ($2::text IS NOT NULL AND lower(user_email) = lower($2))
                ORDER BY created_at DESC
                LIMIT 8
            `,
            [userId, userEmail]
        );

        const row = summaryResult.rows[0] || {};
        const recentEvents = recentResult.rows.map((event) => ({
            moduleId: event.module_id,
            moduleType: event.module_type,
            eventType: event.event_type,
            title: mapActivityTitle({
                title: event.title,
                moduleType: event.module_type,
                eventType: event.event_type
            }),
            rawTitle: event.title || "",
            category: event.category || "",
            progressPercent: toProgressPercent(event.progress_percent),
            createdAt: event.created_at
        }));

        return res.json({
            success: true,
            summary: {
                pdfReads: Number(row.pdf_reads || 0),
                videosWatched: Number(row.videos_watched || 0),
                completedModules: Number(row.completed_modules || 0)
            },
            recentEvents
        });
    } catch (error) {
        console.error("Learning activity summary error:", error.message);
        return res.status(500).json({
            success: false,
            error: "Failed to load learning activity summary"
        });
    }
});

module.exports = router;
