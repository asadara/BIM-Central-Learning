const express = require('express');
const { requireAdmin } = require('../utils/auth');

const CONTENT_ID_PATTERN = /^(video|pdf|page):[a-z0-9][a-z0-9_:-]*$/i;

function createLearningMappingAdminRoutes({ queueService }) {
    if (!queueService) throw new Error('queueService is required');
    const router = express.Router();

    router.use(requireAdmin);

    router.get('/summary', async (req, res) => {
        try {
            res.json({ success: true, data: await queueService.getSummary() });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Unable to summarize mapping queue' });
        }
    });

    router.get('/options', (req, res) => {
        res.json({ success: true, data: queueService.getOptions() });
    });

    router.get('/queue', async (req, res) => {
        try {
            const result = await queueService.getQueue(req.query);
            res.json({
                success: true,
                data: result.items,
                pagination: { total: result.total, limit: result.limit, offset: result.offset }
            });
        } catch (error) {
            const status = Number(error.status) || 500;
            res.status(status).json({
                success: false,
                error: status < 500 ? error.message : 'Unable to load mapping queue'
            });
        }
    });

    router.get('/queue/:contentId/events', async (req, res) => {
        try {
            const contentId = String(req.params.contentId || '');
            if (!CONTENT_ID_PATTERN.test(contentId)) {
                return res.status(400).json({ success: false, error: 'Invalid canonical content ID' });
            }
            return res.json({ success: true, data: await queueService.getEvents(contentId) });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Unable to load review history' });
        }
    });

    router.put('/queue/:contentId', async (req, res) => {
        try {
            const contentId = String(req.params.contentId || '');
            if (!CONTENT_ID_PATTERN.test(contentId)) {
                return res.status(400).json({ success: false, error: 'Invalid canonical content ID' });
            }
            const item = await queueService.updateQueueItem(contentId, req.body || {}, req.authUser);
            return res.json({ success: true, data: item });
        } catch (error) {
            const status = Number(error.status) || 500;
            return res.status(status).json({
                success: false,
                error: status < 500 ? error.message : 'Unable to update mapping review'
            });
        }
    });

    return router;
}

module.exports = createLearningMappingAdminRoutes;
