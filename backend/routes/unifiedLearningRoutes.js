const express = require('express');

const CANONICAL_ID_PATTERN = /^(video|pdf|page):[a-z0-9][a-z0-9_:-]*$/i;

function createUnifiedLearningRoutes({ catalogService }) {
    if (!catalogService) throw new Error('catalogService is required');

    const router = express.Router();

    router.get('/catalog/summary', async (req, res) => {
        try {
            res.json({ success: true, data: await catalogService.getSummary() });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Unable to summarize learning catalog' });
        }
    });

    router.get('/catalog', async (req, res) => {
        try {
            const result = await catalogService.getCatalog(req.query);
            res.json({
                success: true,
                data: result.items,
                pagination: { total: result.total, limit: result.limit, offset: result.offset }
            });
        } catch (error) {
            const status = /Unsupported content type/.test(error.message) ? 400 : 500;
            res.status(status).json({
                success: false,
                error: status === 400 ? error.message : 'Unable to load learning catalog'
            });
        }
    });

    router.get('/catalog/:contentId', async (req, res) => {
        try {
            const contentId = String(req.params.contentId || '');
            if (!CANONICAL_ID_PATTERN.test(contentId)) {
                return res.status(400).json({ success: false, error: 'Invalid canonical content ID' });
            }
            const item = await catalogService.getById(contentId);
            if (!item) return res.status(404).json({ success: false, error: 'Learning content not found' });
            return res.json({ success: true, data: item });
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Unable to load learning content' });
        }
    });

    return router;
}

module.exports = createUnifiedLearningRoutes;
