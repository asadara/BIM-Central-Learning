/**
 * LAN Mount Routes - API endpoints untuk manage network shares
 * Part of BCL Phase 4 Enterprise Features
 */

const express = require('express');
const LANMountManager = require('../utils/lanMountManager');
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const lanManager = new LANMountManager();

/**
 * GET /api/lan/mounts - Get all LAN mount configurations
 */
router.get('/mounts', requireAdmin, (req, res) => {
    try {
        const mounts = lanManager.getAllMounts();
        res.json({
            success: true,
            mounts,
            count: mounts.length,
            settings: lanManager.config
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/lan/mounts/:id - Get specific mount details
 */
router.get('/mounts/:id', requireAdmin, (req, res) => {
    try {
        const mount = lanManager.getMountById(req.params.id);
        if (!mount) {
            return res.status(404).json({ error: 'Mount not found' });
        }
        res.json({ success: true, mount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/lan/mounts - Add new mount configuration
 */
router.post('/mounts', requireAdmin, (req, res) => {
    try {
        const mount = lanManager.addMount(req.body);
        res.status(201).json({
            success: true,
            message: 'Mount added successfully',
            mount
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * PUT /api/lan/mounts/:id - Update mount configuration
 */
router.put('/mounts/:id', requireAdmin, (req, res) => {
    try {
        const mount = lanManager.updateMount(req.params.id, req.body);
        res.json({
            success: true,
            message: 'Mount updated successfully',
            mount
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * DELETE /api/lan/mounts/:id - Delete mount configuration
 */
router.delete('/mounts/:id', requireAdmin, (req, res) => {
    try {
        lanManager.deleteMount(req.params.id);
        res.json({
            success: true,
            message: 'Mount deleted successfully'
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/lan/mounts/:id/connect - Connect to network share
 */
router.post('/mounts/:id/connect', requireAdmin, async (req, res) => {
    try {
        const mount = await lanManager.connectMount(req.params.id);
        res.json({
            success: true,
            message: 'Connected successfully',
            mount
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            details: 'Failed to connect to network share'
        });
    }
});

/**
 * POST /api/lan/mounts/:id/disconnect - Disconnect from network share
 */
router.post('/mounts/:id/disconnect', requireAdmin, async (req, res) => {
    try {
        const mount = await lanManager.disconnectMount(req.params.id);
        res.json({
            success: true,
            message: 'Disconnected successfully',
            mount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/lan/mounts/:id/status - Check mount status
 */
router.get('/mounts/:id/status', requireAdmin, async (req, res) => {
    try {
        const mount = lanManager.getMountById(req.params.id);
        if (!mount) {
            return res.status(404).json({ error: 'Mount not found' });
        }

        const isConnected = await lanManager.checkMountStatus(req.params.id);
        const testAccess = await lanManager.testMountAccess(req.params.id);

        res.json({
            success: true,
            mount,
            isConnected,
            accessTest: testAccess
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/lan/mounts/:id/contents - List mount contents
 * Query param: ?path=subpath/to/list
 */
router.get('/mounts/:id/contents', requireAdmin, (req, res) => {
    try {
        const { path } = req.query;
        const contents = lanManager.listMountContents(req.params.id, path || '');
        res.json({
            success: true,
            mount: req.params.id,
            path: path || '/',
            contents
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/lan/mounts/:id/test - Test mount accessibility
 */
router.post('/mounts/:id/test', requireAdmin, async (req, res) => {
    try {
        const result = await lanManager.testMountAccess(req.params.id);
        res.json({
            success: true,
            result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/lan/reconnect-all - Auto-reconnect all enabled mounts
 */
router.post('/reconnect-all', requireAdmin, async (req, res) => {
    try {
        const count = await lanManager.autoReconnectEnabledMounts();
        res.json({
            success: true,
            message: `Reconnected ${count} mount(s)`,
            connected: count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/lan/info - Get LAN manager info & diagnostics
 */
router.get('/info', requireAdmin, (req, res) => {
    try {
        const mounts = lanManager.getAllMounts();
        const connected = mounts.filter(m => m.status === 'connected').length;
        const enabled = mounts.filter(m => m.enabled).length;

        res.json({
            success: true,
            info: {
                platform: process.platform,
                totalMounts: mounts.length,
                connectedMounts: connected,
                enabledMounts: enabled,
                autoMountEnabled: lanManager.config.autoMount,
                config: lanManager.config
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
