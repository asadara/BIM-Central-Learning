require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const apply = process.argv.includes('--apply');
const validate = process.argv.includes('--validate');

if (apply && validate) throw new Error('Choose either --apply or --validate');

async function inspect(pool) {
    const result = await pool.query(`
        SELECT
            to_regclass(current_schema() || '.training_batches') IS NOT NULL AS training_batches,
            to_regclass(current_schema() || '.learning_path_versions') IS NOT NULL AS learning_versions,
            to_regclass(current_schema() || '.internship_batch_config') IS NOT NULL AS internship_config,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'training_batches'
                  AND column_name = 'program_type'
            ) AS program_type
    `);
    return result.rows[0];
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        const before = await inspect(pool);
        if (apply) {
            const sql = fs.readFileSync(path.join(__dirname, '20260924-internship-phase1a.sql'), 'utf8');
            await pool.query(sql);
        }
        let after = await inspect(pool);
        let rollback = null;
        if (validate) {
            const client = await pool.connect();
            try {
                const sql = fs.readFileSync(path.join(__dirname, '20260924-internship-phase1a.sql'), 'utf8')
                    .replace(/^\s*BEGIN;\s*/i, '')
                    .replace(/\s*COMMIT;\s*$/i, '');
                const rollbackSql = fs.readFileSync(path.join(__dirname, '20260924-internship-phase1a-rollback.sql'), 'utf8')
                    .replace(/^\s*BEGIN;\s*/i, '')
                    .replace(/\s*COMMIT;\s*$/i, '');
                await client.query('BEGIN');
                await client.query(sql);
                after = await inspect(client);
                await client.query(rollbackSql);
                rollback = await inspect(client);
                await client.query('ROLLBACK');
            } catch (error) {
                await client.query('ROLLBACK').catch(() => {});
                throw error;
            } finally {
                client.release();
            }
        }
        console.log(JSON.stringify({
            mode: apply ? 'applied' : validate ? 'validated-and-rolled-back' : 'dry-run',
            before,
            after,
            ...(rollback ? { rollback } : {})
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
