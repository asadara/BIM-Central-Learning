const { Pool } = require('pg');
const { createPgConfig } = require('../../config/runtimeConfig');

const pool = new Pool(createPgConfig({
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in certificateController:', err.message);
});

let ensureTablesPromise = null;

function ensureTables() {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
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

async function resolveUserIdentity(identity) {
    const normalized = trimText(identity, 255);
    if (!normalized) {
        return {
            userId: null,
            userIdentifier: '',
            userName: null,
            userEmail: null,
            matchValues: []
        };
    }

    const row = await pool.query(
        `SELECT id, username, email
         FROM users
         WHERE id::text = $1::text
            OR lower(email) = lower($1)
            OR lower(username) = lower($1)
         LIMIT 1`,
        [normalized]
    );

    const user = row.rows[0] || null;
    const matchValues = new Set([normalized.toLowerCase()]);

    if (user) {
        matchValues.add(String(user.id).toLowerCase());
        if (user.email) matchValues.add(String(user.email).toLowerCase());
        if (user.username) matchValues.add(String(user.username).toLowerCase());
    }

    return {
        userId: user ? toNonNegativeInt(user.id, null) : toNonNegativeInt(normalized, null),
        userIdentifier: user ? String(user.id) : normalized,
        userName: user ? user.username : null,
        userEmail: user ? String(user.email || '').toLowerCase() : null,
        matchValues: Array.from(matchValues).filter(Boolean)
    };
}

function mapCertificateRow(row) {
    const issuedAt = row.issued_at || row.issuedAt || null;
    const certificateUrl = row.certificate_url || row.certificateUrl || null;
    return {
        id: row.id,
        userId: row.user_id || row.userId || row.user_identifier || null,
        userIdentifier: row.user_identifier || null,
        userName: row.user_name || null,
        userEmail: row.user_email || null,
        moduleId: row.module_id || null,
        quizId: row.quiz_id || null,
        title: row.title || 'Certificate',
        issuer: row.issuer || 'BC Learning Academy',
        score: toNonNegativeInt(row.score, 0),
        issuedAt,
        url: certificateUrl,
        certificateUrl
    };
}

exports.getUserCertificates = async (req, res) => {
    try {
        await ensureTables();
        const userRef = await resolveUserIdentity(req.params.userId);
        if (!userRef.userIdentifier && !userRef.userId) {
            return res.json([]);
        }

        const query = await pool.query(
            `SELECT
                id,
                user_id,
                user_identifier,
                user_name,
                user_email,
                module_id,
                quiz_id,
                title,
                issuer,
                score,
                certificate_url,
                issued_at
             FROM user_certificates
             WHERE ($1::int IS NOT NULL AND user_id = $1)
                OR lower(COALESCE(user_identifier, '')) = ANY($2::text[])
                OR lower(COALESCE(user_email, '')) = ANY($2::text[])
                OR lower(COALESCE(user_name, '')) = ANY($2::text[])
             ORDER BY issued_at DESC`,
            [userRef.userId, userRef.matchValues]
        );

        return res.json(query.rows.map(mapCertificateRow));
    } catch (error) {
        console.error('Error getting user certificates:', error);
        return res.status(500).json({ error: 'Failed to load certificates' });
    }
};

exports.issueCertificate = async (req, res) => {
    try {
        await ensureTables();

        const payload = req.body || {};
        const identity = trimText(payload.userId || payload.userIdentifier || payload.email, 255);
        if (!identity) {
            return res.status(400).json({ error: 'userId or userIdentifier is required' });
        }

        const userRef = await resolveUserIdentity(identity);
        const quizId = trimText(payload.quizId, 120) || null;
        const moduleId = trimText(payload.moduleId, 120) || null;
        const title = trimText(payload.title || payload.certificateTitle, 255) || 'Certificate';
        const issuer = trimText(payload.issuer, 120) || 'BC Learning Academy';
        const score = toNonNegativeInt(payload.score, 0);
        const certificateId = trimText(payload.id, 120) || `cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const certificateUrl = trimText(payload.url || payload.certificateUrl, 500) || `/certificates/${certificateId}.pdf`;
        const userName = trimText(payload.userName, 120) || userRef.userName;
        const userEmail = trimText(payload.userEmail, 255).toLowerCase() || userRef.userEmail;

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
             ON CONFLICT (user_identifier, quiz_id) DO UPDATE SET
                title = EXCLUDED.title,
                issuer = EXCLUDED.issuer,
                score = EXCLUDED.score,
                certificate_url = EXCLUDED.certificate_url,
                metadata = EXCLUDED.metadata
             RETURNING
                id,
                user_id,
                user_identifier,
                user_name,
                user_email,
                module_id,
                quiz_id,
                title,
                issuer,
                score,
                certificate_url,
                issued_at`,
            [
                certificateId,
                userRef.userId,
                userRef.userIdentifier || identity,
                userName || null,
                userEmail || null,
                quizId,
                moduleId,
                title,
                issuer,
                score,
                certificateUrl,
                JSON.stringify({
                    source: 'manual-issue'
                })
            ]
        );

        return res.json(mapCertificateRow(result.rows[0]));
    } catch (error) {
        console.error('Error issuing certificate:', error);
        return res.status(500).json({ error: 'Failed to issue certificate' });
    }
};
