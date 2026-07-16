const { Pool } = require('pg');
const { createPgConfig } = require('../backend/config/runtimeConfig');

const REQUIRED_TABLES = [
    'learning_content_registry',
    'learning_paths',
    'learning_path_versions',
    'learning_path_modules',
    'module_content_mappings',
    'content_equivalence_groups',
    'content_equivalence_members',
    'user_content_progress'
];

async function main() {
    const pool = new Pool(createPgConfig({ max: 1 }));
    try {
        const tableResult = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        `, [REQUIRED_TABLES]);
        const found = new Set(tableResult.rows.map((row) => row.table_name));
        const missing = REQUIRED_TABLES.filter((table) => !found.has(table));
        if (missing.length) throw new Error(`Missing unified learning tables: ${missing.join(', ')}`);

        const jsonResult = await pool.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ANY($1::text[])
              AND column_name IN ('metadata', 'definition', 'completion_rule')
        `, [REQUIRED_TABLES]);
        const invalidJson = jsonResult.rows.filter((row) => row.data_type !== 'jsonb');
        if (invalidJson.length) throw new Error(`Expected JSONB columns: ${JSON.stringify(invalidJson)}`);

        const legacyResult = await pool.query(`
            SELECT
                to_regclass('public.users') IS NOT NULL AS users_exists,
                to_regclass('public.user_progress') IS NOT NULL AS user_progress_exists,
                to_regclass('public.training_batches') IS NOT NULL AS training_batches_exists,
                to_regclass('public.learning_activity_events') IS NOT NULL AS activity_events_exists,
                EXISTS (
                    SELECT 1
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    WHERE t.relname = 'training_batches'
                      AND c.contype = 'f'
                      AND pg_get_constraintdef(c.oid) ILIKE '%learning_paths%'
                ) AS training_batches_has_path_fk
        `);
        const legacy = legacyResult.rows[0];
        if (!legacy.users_exists || !legacy.user_progress_exists || !legacy.training_batches_exists || !legacy.activity_events_exists) {
            throw new Error(`Legacy table compatibility check failed: ${JSON.stringify(legacy)}`);
        }
        if (legacy.training_batches_has_path_fk) throw new Error('training_batches must not reference unified learning_paths in Phase 1');

        const registryResult = await pool.query(`
            SELECT source_type, COUNT(*)::int AS count
            FROM learning_content_registry
            GROUP BY source_type ORDER BY source_type
        `);
        const phaseStateResult = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM learning_paths) AS paths,
                (SELECT COUNT(*)::int FROM learning_path_versions) AS versions,
                (SELECT COUNT(*)::int FROM module_content_mappings) AS mappings,
                (SELECT COUNT(*)::int FROM content_equivalence_groups) AS equivalence_groups,
                (SELECT COUNT(*)::int FROM user_content_progress) AS unified_progress,
                (SELECT COUNT(*)::int FROM learning_mapping_review_queue) AS mapping_queue,
                (SELECT COUNT(*)::int FROM learning_mapping_review_queue WHERE review_status = 'approved') AS approved_reviews,
                (SELECT COUNT(*)::int FROM learning_mapping_review_events) AS mapping_review_events
        `);
        console.log(JSON.stringify({
            success: true,
            mode: 'read-only',
            tables: REQUIRED_TABLES,
            registry: registryResult.rows,
            phaseState: phaseStateResult.rows[0],
            legacyCompatibility: legacy
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
