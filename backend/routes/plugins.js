const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const { requireAdmin } = require('../utils/auth');

const router = express.Router();

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
    console.warn('WARN: PostgreSQL pool error in plugins:', err.message);
});
const PLUGIN_UPLOAD_DIR = path.join(__dirname, '..', 'plugin-packages');
const PLUGIN_SEED_PATH = path.join(__dirname, '..', 'plugins.json');

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDirectoryExists(PLUGIN_UPLOAD_DIR);
        cb(null, PLUGIN_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${sanitizedName}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.zip') {
            return cb(new Error('Only .zip files are allowed'));
        }
        return cb(null, true);
    }
});

async function seedPluginsIfEmpty() {
    const existing = await pool.query('SELECT COUNT(*)::int AS count FROM plugins');
    if (existing.rows[0]?.count > 0) {
        return;
    }

    if (!fs.existsSync(PLUGIN_SEED_PATH)) {
        return;
    }

    let seedData = [];
    try {
        seedData = JSON.parse(fs.readFileSync(PLUGIN_SEED_PATH, 'utf-8'));
    } catch (error) {
        console.warn('Failed to read plugins.json for seeding:', error.message);
        return;
    }

    if (!Array.isArray(seedData) || seedData.length === 0) {
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const plugin of seedData) {
            await client.query(
                `INSERT INTO plugins (name, description, download, logo, is_active)
                 VALUES ($1, $2, $3, $4, true)`,
                [
                    plugin.name || 'Unnamed Plugin',
                    plugin.description || null,
                    plugin.download || null,
                    plugin.logo || null
                ]
            );
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.warn('Failed to seed plugins:', error.message);
    } finally {
        client.release();
    }
}

// GET /api/plugins - Public list
router.get('/', async (req, res) => {
    try {
        await seedPluginsIfEmpty();

        const result = await pool.query(
            `SELECT id, name, description, download, logo
             FROM plugins
             WHERE is_active = true
             ORDER BY id ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error loading plugins:', error);
        res.status(500).json({ error: 'Failed to load plugins', detail: error.message });
    }
});

// POST /api/plugins - Admin upload
router.post('/', requireAdmin, (req, res, next) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'File upload error' });
        }

        const name = (req.body.name || '').trim();
        const description = (req.body.description || '').trim();
        const logo = (req.body.logo || '').trim() || null;
        const downloadField = (req.body.download || '').trim();
        const repoUrl = (req.body.repoUrl || '').trim();

        if (!name) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: 'Plugin name is required' });
        }

        const file = req.file || null;
        const fileName = file ? file.filename : null;
        const filePath = file ? file.path : null;
        const fileSize = file ? file.size : null;

        const downloadUrl = downloadField
            || (fileName ? `/plugin-packages/${fileName}` : null)
            || repoUrl
            || null;

        try {
            const insert = await pool.query(
                `INSERT INTO plugins
                 (name, description, download, logo, file_name, file_path, file_size, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                 RETURNING id, name, description, download, logo`,
                [name, description || null, downloadUrl, logo, fileName, filePath, fileSize]
            );

            res.status(201).json({
                success: true,
                plugin: insert.rows[0]
            });
        } catch (error) {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            console.error('Error saving plugin:', error);
            res.status(500).json({ error: 'Failed to save plugin', detail: error.message });
        }
    });
});

module.exports = router;
