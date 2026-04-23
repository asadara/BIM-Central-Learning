const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

const ACCESS_COLUMN_DEFINITIONS = [
    ['mapping_kompetensi_access', 'BOOLEAN DEFAULT false'],
    ['library_download_access', 'BOOLEAN DEFAULT false'],
    ['watermark_free_download_access', 'BOOLEAN DEFAULT false']
];

const pool = new Pool(createPgConfig({
    max: 4,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in userAccess helper:', err.message);
});

let ensureColumnsPromise = null;

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function normalizeAccessProfile(source = {}) {
    return {
        mappingKompetensiAccess: normalizeBoolean(
            source.mappingKompetensiAccess ?? source.mapping_kompetensi_access
        ),
        libraryDownloadAccess: normalizeBoolean(
            source.libraryDownloadAccess ?? source.library_download_access
        ),
        watermarkFreeDownloadAccess: normalizeBoolean(
            source.watermarkFreeDownloadAccess ?? source.watermark_free_download_access
        )
    };
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];

    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        console.warn('WARN: Failed to read users.json in userAccess helper:', error.message);
        return [];
    }
}

async function ensureAccessColumns(targetPool = pool) {
    if (!ensureColumnsPromise) {
        ensureColumnsPromise = (async () => {
            for (const [columnName, definition] of ACCESS_COLUMN_DEFINITIONS) {
                await targetPool.query(
                    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${columnName} ${definition}`
                );
            }
        })().catch((error) => {
            ensureColumnsPromise = null;
            throw error;
        });
    }

    return ensureColumnsPromise;
}

async function fetchAccessProfileFromDb(userId, email) {
    await ensureAccessColumns();

    const result = await pool.query(
        `SELECT mapping_kompetensi_access, library_download_access, watermark_free_download_access
         FROM users
         WHERE ($1::text IS NOT NULL AND id::text = $1::text)
            OR ($2::text IS NOT NULL AND lower(email) = lower($2))
         LIMIT 1`,
        [userId ? String(userId) : null, email || null]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return normalizeAccessProfile(result.rows[0]);
}

function fetchAccessProfileFromJson(userId, email) {
    const users = readUsers();
    const user = users.find((entry) =>
        (userId && (entry.id === userId || entry.id == userId)) ||
        (email && String(entry.email || '').toLowerCase() === String(email).toLowerCase())
    );

    if (!user) {
        return null;
    }

    return normalizeAccessProfile(user);
}

async function resolveAccessProfile(authUser) {
    if (!authUser) {
        return normalizeAccessProfile();
    }

    if (authUser.isAdmin) {
        return {
            mappingKompetensiAccess: true,
            libraryDownloadAccess: true,
            watermarkFreeDownloadAccess: true
        };
    }

    try {
        const dbProfile = await fetchAccessProfileFromDb(authUser.id, authUser.email);
        if (dbProfile) {
            return dbProfile;
        }
    } catch (error) {
        console.warn('WARN: PostgreSQL not available for user access lookup, falling back to JSON:', error.message);
    }

    return fetchAccessProfileFromJson(authUser.id, authUser.email) || normalizeAccessProfile();
}

module.exports = {
    ACCESS_COLUMN_DEFINITIONS,
    ensureAccessColumns,
    fetchAccessProfileFromDb,
    fetchAccessProfileFromJson,
    normalizeAccessProfile,
    resolveAccessProfile
};
