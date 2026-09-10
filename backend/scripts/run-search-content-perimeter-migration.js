require('dotenv').config();

const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const apply = process.argv.includes('--apply');

async function inspectSchema(pool) {
    const accessColumn = await pool.query(`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'users'
              AND column_name = 'project_document_access'
        ) AS exists
    `);
    const auditTable = await pool.query(`
        SELECT to_regclass(current_schema() || '.search_file_access_events') IS NOT NULL AS exists
    `);
    return {
        projectDocumentAccessColumn: accessColumn.rows[0].exists,
        searchFileAccessEventsTable: auditTable.rows[0].exists
    };
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        const before = await inspectSchema(pool);
        if (apply) {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS project_document_access BOOLEAN DEFAULT false');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS search_file_access_events (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT,
                    relative_path TEXT NOT NULL,
                    access_rule TEXT NOT NULL,
                    request_route TEXT,
                    client_ip TEXT,
                    user_agent TEXT,
                    http_status INTEGER,
                    accessed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_search_file_access_events_accessed_at
                ON search_file_access_events(accessed_at DESC)
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_search_file_access_events_user_id
                ON search_file_access_events(user_id)
            `);
        }
        const after = await inspectSchema(pool);
        console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', before, after }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
