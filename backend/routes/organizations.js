const express = require('express');
const { canonicalUserId, authenticatedUserId } = require('../utils/canonicalIdentity');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { createPgConfig, getJwtSecret } = require('../config/runtimeConfig');

const router = express.Router();

const USERS_FILE = path.join(__dirname, '..', 'users.json');
const SECRET_KEY = getJwtSecret();

// PostgreSQL connection configuration
const dbConfig = createPgConfig({
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in organizations:', err.message);
});

function getAuthFromRequest(req) { return require('../utils/auth').getRequestUser(req); }

async function fetchMappingAccessFromDb(userId, email) {
    const id = canonicalUserId(userId);
    if (!id) return null;
    const result = await pool.query(
        `SELECT mapping_kompetensi_access
         FROM users
         WHERE id = $1 AND is_active = true
         LIMIT 1`,
        [id]
    );

    if (result.rows.length === 0) return null;
    return !!result.rows[0].mapping_kompetensi_access;
}

function fetchMappingAccessFromJson() {
    return null; // Unmapped legacy records cannot grant access.
}

async function ensureMappingAccess(req, res) {
    const authUser = getAuthFromRequest(req);
    if (!authUser) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }

    let hasAccess = null;
    try {
        hasAccess = await fetchMappingAccessFromDb(authUser.id, authUser.email);
    } catch (dbError) {
        console.warn('WARN: PostgreSQL not available for mapping access, falling back to JSON:', dbError.message);
    }

    if (hasAccess === null) {
        hasAccess = fetchMappingAccessFromJson(authUser.id, authUser.email);
    }

    if (!hasAccess) {
        res.status(403).json({ error: 'Mapping kompetensi access required' });
        return null;
    }

    return authUser;
}

// GET /api/organizations/list - List organizations (mapping access required)
router.get('/list', async (req, res) => {
    try {
        const authUser = await ensureMappingAccess(req, res);
        if (!authUser) return;

        try {
            const result = await pool.query(
                `SELECT DISTINCT organization
                 FROM users
                 WHERE organization IS NOT NULL AND organization <> ''
                 ORDER BY organization ASC`
            );
            const organizations = result.rows.map(row => row.organization);
            return res.json(organizations);
        } catch (dbError) {
            console.warn('WARN: PostgreSQL not available for organizations list, falling back to JSON:', dbError.message);
        }

        if (!fs.existsSync(USERS_FILE)) return res.json([]);
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        const organizations = [...new Set(
            users
                .map(u => u.organization)
                .filter(org => org && org.trim() !== '')
        )].sort((a, b) => a.localeCompare(b));

        return res.json(organizations);
    } catch (error) {
        console.error('ERROR: Error loading organizations list:', error);
        res.status(500).json({ error: 'Failed to load organizations list' });
    }
});

module.exports = router;
