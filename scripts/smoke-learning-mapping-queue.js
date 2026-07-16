const assert = require('assert');
const { Pool } = require('pg');
const { createPgConfig } = require('../backend/config/runtimeConfig');
const createLearningMappingQueueService = require('../backend/services/learningMappingQueueService');

const smokeContentId = 'page:smoke-learning-mapping-queue';

async function main() {
    const pool = new Pool(createPgConfig({ max: 3 }));
    const service = createLearningMappingQueueService({ pgPool: pool });
    try {
        const summary = await service.getSummary();
        assert.strictEqual(summary.total, 337, 'seeded queue count must match canonical catalog');
        assert.strictEqual(summary.approved, 0, 'seed must not auto-approve content');
        assert.strictEqual(summary.unresolved, 21, 'needs-review count mismatch');
        assert.strictEqual(summary.publishEnabled, false, 'publish must remain disabled');

        const needsReview = await service.getQueue({ reviewStatus: 'needs_review', limit: 100 });
        assert.strictEqual(needsReview.total, 21, 'needs-review filter mismatch');
        assert(needsReview.items.every((item) => item.reviewStatus === 'needs_review'));
        const options = service.getOptions();
        assert.strictEqual(options.paths.length, 8, 'expected eight candidate path taxonomies');

        await pool.query(`
            INSERT INTO learning_content_registry (
                content_id, source_type, source_id, source_locator, status,
                review_disposition, metadata
            ) VALUES ($1, 'page', 'smoke-learning-mapping-queue', '/pages/bim-mindset.html',
                      'active', 'needs_review', '{"sourceTitle":"Smoke queue item"}'::jsonb)
            ON CONFLICT (content_id) DO NOTHING
        `, [smokeContentId]);
        await pool.query(`
            INSERT INTO learning_mapping_review_queue (
                content_id, decision, review_status, review_notes, candidate_payload
            ) VALUES ($1, 'needs_review', 'needs_review', 'temporary smoke item',
                      '{"title":"Smoke queue item","category":"smoke"}'::jsonb)
            ON CONFLICT (content_id) DO NOTHING
        `, [smokeContentId]);

        const updated = await service.updateQueueItem(smokeContentId, {
            revision: 1,
            decision: 'library_only',
            reviewStatus: 'approved',
            reviewNotes: 'Verified by automated queue contract smoke',
            titleOverride: 'Smoke queue item reviewed',
            categoryOverride: 'smoke',
            levelOverride: ''
        }, {
            id: 'smoke-admin',
            username: 'Automated queue smoke'
        });
        assert.strictEqual(updated.reviewStatus, 'approved');
        assert.strictEqual(updated.decision, 'library_only');
        assert.strictEqual(updated.revision, 2);
        const events = await service.getEvents(smokeContentId);
        assert.strictEqual(events[0].action, 'approved');

        let conflict = null;
        try {
            await service.updateQueueItem(smokeContentId, {
                revision: 1,
                decision: 'library_only',
                reviewStatus: 'candidate',
                reviewNotes: 'stale write'
            }, { id: 'smoke-admin' });
        } catch (error) {
            conflict = error;
        }
        assert(conflict && conflict.status === 409, 'stale revision must be rejected with 409');

        console.log(JSON.stringify({
            success: true,
            queueTotal: summary.total,
            needsReview: summary.unresolved,
            pathOptions: options.paths.length,
            transactionalUpdate: true,
            optimisticConcurrency: true,
            publishEnabled: summary.publishEnabled
        }, null, 2));
    } finally {
        await pool.query('DELETE FROM learning_mapping_review_events WHERE content_id = $1', [smokeContentId]).catch(() => {});
        await pool.query('DELETE FROM learning_mapping_review_queue WHERE content_id = $1', [smokeContentId]).catch(() => {});
        await pool.query('DELETE FROM learning_content_registry WHERE content_id = $1', [smokeContentId]).catch(() => {});
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
