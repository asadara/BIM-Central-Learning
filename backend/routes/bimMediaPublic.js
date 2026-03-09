const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// BIM Media Tags Storage
const BIM_MEDIA_TAGS_FILE = path.join(__dirname, '..', 'bim-media-tags.json');

// Helper function to read BIM media tags
function readBIMMediaTags() {
    try {
        if (!fs.existsSync(BIM_MEDIA_TAGS_FILE)) {
            // Create default structure if file doesn't exist
            const defaultData = {
                media: {},
                collections: {},
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(BIM_MEDIA_TAGS_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(BIM_MEDIA_TAGS_FILE, 'utf-8'));
    } catch (error) {
        console.error('Error reading BIM media tags:', error);
        return { media: {}, collections: {}, lastUpdated: new Date().toISOString() };
    }
}

// GET /api/bim-media/tags - Get all tagged media (public access for showroom)
router.get('/tags', (req, res) => {
    try {
        const tagsData = readBIMMediaTags();
        const taggedMedia = Object.entries(tagsData.media).map(([filePath, tags]) => ({
            filePath,
            ...tags
        }));

        // Filter out sensitive information and only include what's needed for public display
        const publicMedia = taggedMedia.map(media => ({
            filePath: media.filePath,
            fileName: media.fileName,
            fileType: media.fileType,
            year: media.year,
            location: media.location,
            bimDimension: media.bimDimension,
            type: media.type,
            description: media.description,
            taggedAt: media.taggedAt
        }));

        res.json({
            totalTagged: publicMedia.length,
            media: publicMedia
        });
    } catch (error) {
        console.error('Error getting public media tags:', error);
        res.status(500).json({ error: 'Failed to get media tags', detail: error.message });
    }
});

// GET /api/bim-media/stats - Get public tagging statistics
router.get('/stats', (req, res) => {
    try {
        const tagsData = readBIMMediaTags();
        const taggedMedia = Object.values(tagsData.media);

        const stats = {
            totalTagged: taggedMedia.length,
            byYear: {},
            byLocation: {},
            byBIMDimension: {},
            byType: {},
            lastUpdated: tagsData.lastUpdated
        };

        // Calculate statistics
        taggedMedia.forEach(media => {
            if (media.year) {
                stats.byYear[media.year] = (stats.byYear[media.year] || 0) + 1;
            }
            if (media.location) {
                stats.byLocation[media.location] = (stats.byLocation[media.location] || 0) + 1;
            }
            if (media.bimDimension) {
                stats.byBIMDimension[media.bimDimension] = (stats.byBIMDimension[media.bimDimension] || 0) + 1;
            }
            if (media.type) {
                stats.byType[media.type] = (stats.byType[media.type] || 0) + 1;
            }
        });

        res.json(stats);
    } catch (error) {
        console.error('Error getting public tagging stats:', error);
        res.status(500).json({ error: 'Failed to get tagging statistics', detail: error.message });
    }
});

module.exports = router;
