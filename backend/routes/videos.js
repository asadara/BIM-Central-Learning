const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { requireAdmin } = require('../utils/auth');
const router = express.Router();
router.use(requireAdmin);

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
    console.warn('WARN: PostgreSQL pool error in videos routes:', err.message);
});

// Fallback JSON storage
const VIDEO_TAGS_FILE = path.join(__dirname, '..', 'video-tags.json');

// Helper functions for video tagging
const readVideoTags = () => {
    if (!fs.existsSync(VIDEO_TAGS_FILE)) {
        // Create default structure if file doesn't exist
        const defaultData = {
            videoTags: {},
            customCategories: [],
            metadata: {
                version: "1.0.0",
                lastUpdated: new Date().toISOString(),
                totalTaggedVideos: 0,
                totalCustomCategories: 0
            }
        };
        fs.writeFileSync(VIDEO_TAGS_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }

    try {
        const data = fs.readFileSync(VIDEO_TAGS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading video tags file:', err);
        return {
            videoTags: {},
            customCategories: [],
            metadata: {
                version: "1.0.0",
                lastUpdated: new Date().toISOString(),
                totalTaggedVideos: 0,
                totalCustomCategories: 0
            }
        };
    }
};

const saveVideoTags = (data) => {
    try {
        // Update metadata
        data.metadata = {
            ...data.metadata,
            lastUpdated: new Date().toISOString(),
            totalTaggedVideos: Object.keys(data.videoTags || {}).length,
            totalCustomCategories: (data.customCategories || []).length
        };

        fs.writeFileSync(VIDEO_TAGS_FILE, JSON.stringify(data, null, 2));
        console.log('✅ Video tags saved to file');
    } catch (err) {
        console.error('Error saving video tags file:', err);
    }
};

// GET /api/admin/videos/tags - Get all video tags
router.get('/tags', (req, res) => {
    try {
        console.log('📊 Getting all video tags');

        // Try PostgreSQL first
        pool.query('SELECT * FROM video_tags ORDER BY updated_at DESC')
            .then(result => {
                console.log(`✅ Retrieved ${result.rows.length} video tags from PostgreSQL`);
                res.json(result.rows);
            })
            .catch(dbError => {
                console.warn('⚠️ PostgreSQL not available for video tags, falling back to JSON:', dbError.message);

                // Fallback to JSON
                const data = readVideoTags();
                console.log(`📄 Returned video tags from JSON fallback`);
                res.json({
                    videoTags: data.videoTags || {},
                    customCategories: data.customCategories || [],
                    metadata: data.metadata
                });
            });

    } catch (error) {
        console.error('❌ Error getting video tags:', error);
        res.status(500).json({
            error: 'Failed to retrieve video tags',
            details: error.message
        });
    }
});

// POST /api/admin/videos/tags - Save video tags
router.post('/tags', (req, res) => {
    try {
        const { videoId, category, bimLevel, duration, language, description, tags } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        console.log('💾 Saving video tags for video:', videoId);

        // Try PostgreSQL first
        const insertQuery = `
            INSERT INTO video_tags (video_id, category, bim_level, duration, language, description, tags, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            ON CONFLICT (video_id)
            DO UPDATE SET
                category = EXCLUDED.category,
                bim_level = EXCLUDED.bim_level,
                duration = EXCLUDED.duration,
                language = EXCLUDED.language,
                description = EXCLUDED.description,
                tags = EXCLUDED.tags,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const tagArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []);

        pool.query(insertQuery, [videoId, category, bimLevel, duration, language, description, tagArray])
            .then(result => {
                console.log('✅ Video tags saved to PostgreSQL');
                res.json({
                    success: true,
                    data: result.rows[0],
                    message: 'Video tags saved successfully'
                });
            })
            .catch(dbError => {
                console.warn('⚠️ PostgreSQL not available for saving tags, falling back to JSON:', dbError.message);

                // Fallback to JSON
                const data = readVideoTags();

                // Initialize videoTags if not exists
                if (!data.videoTags) data.videoTags = {};

                // Save tag data
                data.videoTags[videoId] = {
                    videoId,
                    category: category || 'general',
                    bimLevel: bimLevel || 'beginner',
                    duration: duration || null,
                    language: language || 'id',
                    description: description || '',
                    tags: tagArray,
                    updated_at: new Date().toISOString()
                };

                saveVideoTags(data);

                console.log('📄 Video tags saved to JSON fallback');
                res.json({
                    success: true,
                    data: data.videoTags[videoId],
                    message: 'Video tags saved successfully (JSON fallback)'
                });
            });

    } catch (error) {
        console.error('❌ Error saving video tags:', error);
        res.status(500).json({
            error: 'Failed to save video tags',
            details: error.message
        });
    }
});

// DELETE /api/admin/videos/tags/:videoId - Remove video tags
router.delete('/tags/:videoId', (req, res) => {
    try {
        const videoId = req.params.videoId;
        console.log('🗑️ Removing video tags for video:', videoId);

        // Try PostgreSQL first
        pool.query('DELETE FROM video_tags WHERE video_id = $1', [videoId])
            .then(result => {
                console.log('✅ Video tags removed from PostgreSQL');
                res.json({
                    success: true,
                    message: 'Video tags removed successfully'
                });
            })
            .catch(dbError => {
                console.warn('⚠️ PostgreSQL not available for removing tags, falling back to JSON:', dbError.message);

                // Fallback to JSON
                const data = readVideoTags();

                if (data.videoTags && data.videoTags[videoId]) {
                    delete data.videoTags[videoId];
                    saveVideoTags(data);
                    console.log('📄 Video tags removed from JSON fallback');
                }

                res.json({
                    success: true,
                    message: 'Video tags removed successfully (JSON fallback)'
                });
            });

    } catch (error) {
        console.error('❌ Error removing video tags:', error);
        res.status(500).json({
            error: 'Failed to remove video tags',
            details: error.message
        });
    }
});

// GET /api/admin/videos/categories - Get custom categories
router.get('/categories', (req, res) => {
    try {
        console.log('📂 Getting custom video categories');

        // Try PostgreSQL first
        pool.query('SELECT * FROM video_categories ORDER BY name')
            .then(result => {
                console.log(`✅ Retrieved ${result.rows.length} custom categories from PostgreSQL`);
                res.json(result.rows);
            })
            .catch(dbError => {
                console.warn('⚠️ PostgreSQL not available for categories, falling back to JSON:', dbError.message);

                // Fallback to JSON
                const data = readVideoTags();
                console.log(`📄 Returned ${data.customCategories.length} custom categories from JSON fallback`);
                res.json(data.customCategories || []);
            });

    } catch (error) {
        console.error('❌ Error getting custom categories:', error);
        res.status(500).json({
            error: 'Failed to retrieve custom categories',
            details: error.message
        });
    }
});

// POST /api/admin/videos/categories - Add custom category
router.post('/categories', (req, res) => {
    try {
        const { name, value } = req.body;

        if (!name || !value) {
            return res.status(400).json({ error: 'Category name and value are required' });
        }

        console.log('➕ Adding custom category:', name);

        // Try PostgreSQL first
        const insertQuery = `
            INSERT INTO video_categories (name, value, created_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (value)
            DO NOTHING
            RETURNING *
        `;

        pool.query(insertQuery, [name, value])
            .then(result => {
                if (result.rows.length > 0) {
                    console.log('✅ Custom category added to PostgreSQL');
                    res.json({
                        success: true,
                        data: result.rows[0],
                        message: 'Custom category added successfully'
                    });
                } else {
                    res.status(409).json({
                        error: 'Category already exists'
                    });
                }
            })
            .catch(dbError => {
                console.warn('⚠️ PostgreSQL not available for adding category, falling back to JSON:', dbError.message);

                // Fallback to JSON
                const data = readVideoTags();

                // Initialize customCategories if not exists
                if (!data.customCategories) data.customCategories = [];

                // Check if category already exists
                const existing = data.customCategories.find(cat => cat.value === value);
                if (existing) {
                    return res.status(409).json({ error: 'Category already exists' });
                }

                // Add new category
                const newCategory = {
                    name,
                    value,
                    created_at: new Date().toISOString()
                };

                data.customCategories.push(newCategory);
                saveVideoTags(data);

                console.log('📄 Custom category added to JSON fallback');
                res.json({
                    success: true,
                    data: newCategory,
                    message: 'Custom category added successfully (JSON fallback)'
                });
            });

    } catch (error) {
        console.error('❌ Error adding custom category:', error);
        res.status(500).json({
            error: 'Failed to add custom category',
            details: error.message
        });
    }
});

// GET /api/admin/videos/migrate-localStorage - Migrate localStorage data
router.get('/migrate-localStorage', (req, res) => {
    try {
        console.log('🔄 Migrating localStorage video tagging data...');

        // This endpoint would be called from the frontend to migrate existing localStorage data
        // For now, just return success - actual migration happens in the frontend

        res.json({
            success: true,
            message: 'Migration endpoint ready. Call from frontend to migrate localStorage data.'
        });

    } catch (error) {
        console.error('❌ Error in migration endpoint:', error);
        res.status(500).json({
            error: 'Migration failed',
            details: error.message
        });
    }
});

// GET /api/admin/videos/stats - Get video tagging statistics
router.get('/stats', (req, res) => {
    try {
        console.log('📊 Getting video tagging statistics');

        // Try PostgreSQL first
        pool.query(`
            SELECT
                COUNT(*) as totalTagged,
                COUNT(CASE WHEN category = 'autocad' THEN 1 END) as autocadCount,
                COUNT(CASE WHEN category = 'revit' THEN 1 END) as revitCount,
                COUNT(CASE WHEN category = 'sketchup' THEN 1 END) as sketchupCount,
                COUNT(CASE WHEN category = '3dsmax' THEN 1 END) as dsmaxCount,
                COUNT(CASE WHEN category = 'general' THEN 1 END) as generalCount,
                COUNT(CASE WHEN bim_level = 'beginner' THEN 1 END) as beginnerCount,
                COUNT(CASE WHEN bim_level = 'intermediate' THEN 1 END) as intermediateCount,
                COUNT(CASE WHEN bim_level = 'advanced' THEN 1 END) as advancedCount,
                COUNT(CASE WHEN bim_level = 'expert' THEN 1 END) as expertCount,
                COUNT(CASE WHEN language = 'id' THEN 1 END) as indonesianCount,
                COUNT(CASE WHEN language = 'en' THEN 1 END) as englishCount
            FROM video_tags
        `)
        .then(result => {
            const stats = result.rows[0];
            const totalTagged = parseInt(stats.totaltagged) || 0;

            const statsData = {
                totalTagged: totalTagged,
                totalMedia: totalTagged, // For dashboard compatibility
                byCategory: {
                    'autocad': parseInt(stats.autocadcount) || 0,
                    'revit': parseInt(stats.revcount) || 0,
                    'sketchup': parseInt(stats.sketchupcount) || 0,
                    '3dsmax': parseInt(stats.dsmaxcount) || 0,
                    'general': parseInt(stats.generalcount) || 0
                },
                byLevel: {
                    'beginner': parseInt(stats.beginnercount) || 0,
                    'intermediate': parseInt(stats.intermediatecount) || 0,
                    'advanced': parseInt(stats.advancedcount) || 0,
                    'expert': parseInt(stats.expertcount) || 0
                },
                byLanguage: {
                    'id': parseInt(stats.indonesiancount) || 0,
                    'en': parseInt(stats.englishcount) || 0
                },
                byYear: {}, // Not available in current schema
                byLocation: {}, // Not available in current schema
                byType: {
                    'video': totalTagged // All tagged items are videos
                },
                byDimension: {}, // Not applicable for videos
                excludedCount: 0 // Videos don't have exclusion feature
            };

            console.log(`✅ Retrieved video tagging statistics from PostgreSQL: ${totalTagged} tagged videos`);
            res.json({
                success: true,
                stats: statsData
            });
        })
        .catch(dbError => {
            console.warn('⚠️ PostgreSQL not available for video stats, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const data = readVideoTags();
            const videoTags = data.videoTags || {};
            const totalTagged = Object.keys(videoTags).length;

            // Calculate statistics from JSON data
            const stats = {
                totalTagged: totalTagged,
                totalMedia: totalTagged,
                byCategory: {},
                byLevel: {},
                byLanguage: {},
                byYear: {},
                byLocation: {},
                byType: { 'video': totalTagged },
                byDimension: {},
                excludedCount: 0
            };

            // Count by category, level, and language
            Object.values(videoTags).forEach(tag => {
                // Category
                const category = tag.category || 'general';
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

                // Level
                const level = tag.bimLevel || 'beginner';
                stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;

                // Language
                const language = tag.language || 'id';
                stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;
            });

            console.log(`📄 Retrieved video tagging statistics from JSON: ${totalTagged} tagged videos`);
            res.json({
                success: true,
                stats: stats
            });
        });

    } catch (error) {
        console.error('❌ Error getting video tagging statistics:', error);
        res.status(500).json({
            error: 'Failed to retrieve video tagging statistics',
            details: error.message
        });
    }
});

// POST /api/admin/videos/migrate-data - Migrate data from localStorage
router.post('/migrate-data', (req, res) => {
    try {
        const { videoTags, customCategories } = req.body;

        console.log('🔄 Migrating video data:', {
            videoTagsCount: Object.keys(videoTags || {}).length,
            customCategoriesCount: (customCategories || []).length
        });

        // Try PostgreSQL first
        const migrateToPostgres = async () => {
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Migrate video tags
                if (videoTags && Object.keys(videoTags).length > 0) {
                    for (const [videoId, tagData] of Object.entries(videoTags)) {
                        const tagArray = Array.isArray(tagData.tags) ? tagData.tags :
                            (tagData.tags ? tagData.tags.split(',').map(t => t.trim()).filter(t => t) : []);

                        await client.query(`
                            INSERT INTO video_tags (video_id, category, bim_level, duration, language, description, tags, updated_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                            ON CONFLICT (video_id)
                            DO UPDATE SET
                                category = EXCLUDED.category,
                                bim_level = EXCLUDED.bim_level,
                                duration = EXCLUDED.duration,
                                language = EXCLUDED.language,
                                description = EXCLUDED.description,
                                tags = EXCLUDED.tags,
                                updated_at = CURRENT_TIMESTAMP
                        `, [
                            videoId,
                            tagData.category || 'general',
                            tagData.bimLevel || 'beginner',
                            tagData.duration || null,
                            tagData.language || 'id',
                            tagData.description || '',
                            tagArray
                        ]);
                    }
                }

                // Migrate custom categories
                if (customCategories && customCategories.length > 0) {
                    for (const category of customCategories) {
                        await client.query(`
                            INSERT INTO video_categories (name, value, created_at)
                            VALUES ($1, $2, CURRENT_TIMESTAMP)
                            ON CONFLICT (value)
                            DO NOTHING
                        `, [category.name || category.displayName, category.value]);
                    }
                }

                await client.query('COMMIT');
                console.log('✅ Data migrated to PostgreSQL');

                res.json({
                    success: true,
                    message: 'Data successfully migrated to PostgreSQL',
                    migrated: {
                        videoTags: Object.keys(videoTags || {}).length,
                        customCategories: (customCategories || []).length
                    }
                });

            } catch (dbError) {
                await client.query('ROLLBACK');
                throw dbError;
            } finally {
                client.release();
            }
        };

        migrateToPostgres().catch(dbError => {
            console.warn('⚠️ PostgreSQL migration failed, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const data = readVideoTags();

            // Merge video tags
            if (videoTags) {
                data.videoTags = { ...data.videoTags, ...videoTags };
            }

            // Merge custom categories (avoid duplicates)
            if (customCategories) {
                const existingValues = new Set(data.customCategories.map(cat => cat.value));
                const newCategories = customCategories.filter(cat => !existingValues.has(cat.value));
                data.customCategories = [...data.customCategories, ...newCategories];
            }

            saveVideoTags(data);

            console.log('📄 Data migrated to JSON fallback');
            res.json({
                success: true,
                message: 'Data successfully migrated to JSON storage',
                migrated: {
                    videoTags: Object.keys(videoTags || {}).length,
                    customCategories: (customCategories || []).length
                }
            });
        });

    } catch (error) {
        console.error('❌ Error migrating data:', error);
        res.status(500).json({
            error: 'Migration failed',
            details: error.message
        });
    }
});

module.exports = router;
