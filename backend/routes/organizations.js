const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const router = express.Router();

const USERS_FILE = path.join(__dirname, '..', 'users.json');
const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey_change_in_production';

// PostgreSQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD || 'secure_password_2025',
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in organizations:', err.message);
});

function getAuthFromRequest(req) {
    if (req.session && req.session.adminUser && req.session.adminUser.isAdmin) {
        return {
            id: req.session.adminUser.id,
            email: req.session.adminUser.email,
            role: req.session.adminUser.role,
            isAdmin: true
        };
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, SECRET_KEY);
        return {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            isAdmin: false
        };
    } catch (error) {
        return null;
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

function fetchMappingAccessFromJson(userId, email) {
    if (!fs.existsSync(USERS_FILE)) return null;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const user = users.find(u =>
        (userId && (u.id === userId || u.id == userId)) ||
        (email && u.email === email)
    );

    if (!user) return null;
    return !!(user.mappingKompetensiAccess || user.mapping_kompetensi_access);
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
