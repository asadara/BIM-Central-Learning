const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const sqlPath = path.join(__dirname, 'postgres-create-unified-learning.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const apply = process.argv.includes('--apply');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');

async function main() {
    if (!apply) {
        console.log(JSON.stringify({
            mode: 'dry-run',
            migration: path.basename(sqlPath),
            checksum,
            mutatesDatabase: false,
            next: 'Run with --apply after reviewing the SQL and backup state.'
        }, null, 2));
        return;
    }

    const pool = new Pool(createPgConfig({ max: 1 }));
    try {
        await pool.query(sql);
        const result = await pool.query(`
            SELECT migration_key, applied_at
            FROM bcl_schema_migrations
            WHERE migration_key = '20260715_unified_learning_phase_1'
        `);
        console.log(JSON.stringify({
            mode: 'apply',
            migration: path.basename(sqlPath),
            checksum,
            applied: result.rowCount === 1,
            ledger: result.rows[0] || null
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
