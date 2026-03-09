const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../utils/auth');

const router = express.Router();

const VIDEO_DISPLAY_CONFIG = path.join(__dirname, '../video-display-config.json');

function readConfig() {
    if (!fs.existsSync(VIDEO_DISPLAY_CONFIG)) {
        return { playlist: [], settings: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(VIDEO_DISPLAY_CONFIG, 'utf-8'));
    } catch (error) {
        return { playlist: [], settings: {} };
    }
}

function writeConfig(config) {
    fs.writeFileSync(VIDEO_DISPLAY_CONFIG, JSON.stringify(config, null, 2));
}

// GET /api/admin/video-display/list
router.get('/admin/video-display/list', requireAdmin, (req, res) => {
    try {
        const config = readConfig();
        res.json({
            playlist: config.playlist || [],
            config
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve video display list', detail: error.message });
    }
});

// POST /api/admin/video-display/update
router.post('/admin/video-display/update', requireAdmin, (req, res) => {
    try {
        const { playlist, settings } = req.body || {};
        const config = readConfig();

        if (Array.isArray(playlist)) {
            config.playlist = playlist;
        }

        if (settings && typeof settings === 'object') {
            config.settings = { ...(config.settings || {}), ...settings };
        }

        config.lastUpdated = new Date().toISOString();
        writeConfig(config);

        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update config', detail: error.message });
    }
});

// GET /api/video-display/selected
router.get('/video-display/selected', (req, res) => {
    try {
        const config = readConfig();
        const playlist = config.playlist || [];

        res.json({
            videos: playlist,
            settings: config.settings || {},
            fallback: false,
            totalSelected: playlist.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve videos', detail: error.message });
    }
});

module.exports = router;
