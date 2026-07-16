const path = require('path');
const { Pool } = require('pg');
const tutorialRoutes = require('../routes/tutorialRoutes');
const { loadLearningMaterialsData } = require('../services/learningMaterialsSource');
const { readLearningPaths } = require('../elearning/services/learningPathService');
const createUnifiedLearningCatalogService = require('../services/unifiedLearningCatalogService');
const { createPgConfig } = require('../config/runtimeConfig');

const apply = process.argv.includes('--apply');
const candidatePath = path.join(__dirname, '../elearning/learning-mapping-candidates.json');

function dispositionFor(decision) {
    if (!decision) return 'needs_review';
    if (decision === 'library_only') return 'library_only';
    if (decision === 'needs_review') return 'needs_review';
    if (decision === 'retired') return 'retired';
    return 'mapped';
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 2 }));
    try {
        const service = createUnifiedLearningCatalogService({
            loadVideos: tutorialRoutes.loadTutorialCatalog,
            loadMaterials: loadLearningMaterialsData,
            readLearningPaths,
            pgPool: apply ? pool : null
        });
        const items = await service.loadCatalog();
        const candidateData = require(candidatePath);
        const decisions = new Map(candidateData.decisions.map((item) => [item.contentId, item.decision]));

        if (!apply) {
            console.log(JSON.stringify({
                mode: 'dry-run',
                total: items.length,
                decisionsResolved: items.filter((item) => decisions.has(item.contentId)).length,
                writes: 0
            }, null, 2));
            return;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                await client.query(`
                    INSERT INTO learning_content_registry (
                        content_id, source_type, source_id, source_locator, status,
                        review_disposition, metadata, first_seen_at, last_seen_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
                    ON CONFLICT (content_id) DO UPDATE SET
                        source_locator = EXCLUDED.source_locator,
                        status = CASE
                            WHEN learning_content_registry.status = 'retired' THEN 'retired'
                            ELSE EXCLUDED.status
                        END,
                        review_disposition = CASE
                            WHEN learning_content_registry.review_disposition = 'retired' THEN 'retired'
                            ELSE EXCLUDED.review_disposition
                        END,
                        metadata = learning_content_registry.metadata || EXCLUDED.metadata,
                        last_seen_at = NOW(),
                        updated_at = NOW()
                `, [
                    item.contentId,
                    item.sourceType,
                    item.sourceId,
                    item.sourceUrl,
                    item.status === 'inactive' ? 'inactive' : 'active',
                    dispositionFor(decisions.get(item.contentId)),
                    JSON.stringify({
                        sourceTitle: item.title,
                        sourceCategory: item.category,
                        sourceLevel: item.level || null,
                        snapshotMetadata: item.metadata
                    })
                ]);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        const result = await pool.query(`
            SELECT source_type, review_disposition, COUNT(*)::int AS count
            FROM learning_content_registry
            GROUP BY source_type, review_disposition
            ORDER BY source_type, review_disposition
        `);
        console.log(JSON.stringify({ mode: 'apply', upserted: items.length, registry: result.rows }, null, 2));
    } finally {
        await pool.end();
    }
}

main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
