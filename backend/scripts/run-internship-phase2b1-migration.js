'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const apply = process.argv.includes('--apply');
const validate = process.argv.includes('--validate');

if (apply && validate) throw new Error('Choose either --apply or --validate');

function transactionBody(filename) {
    return fs.readFileSync(path.join(__dirname, filename), 'utf8')
        .replace(/^\s*BEGIN;\s*/i, '')
        .replace(/\s*COMMIT;\s*$/i, '');
}

async function inspect(queryable) {
    const result = await queryable.query(`
        SELECT
            to_regclass(current_schema() || '.assignment_submissions') IS NOT NULL AS submissions,
            to_regclass(current_schema() || '.submission_files') IS NOT NULL AS submission_files,
            to_regclass(current_schema() || '.submission_status_history') IS NOT NULL AS status_history,
            to_regclass(current_schema() || '.classwork_content_links') IS NOT NULL AS content_links,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'assignment_submissions'
                  AND column_name = 'withdrawn_at'
            ) AS withdrawn_at,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'submission_files'
                  AND column_name = 'storage_key'
            ) AS storage_key,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'submission_files'
                  AND column_name = 'sha256'
            ) AS sha256
    `);
    return result.rows[0];
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        const before = await inspect(pool);
        if (apply) {
            await pool.query(fs.readFileSync(path.join(__dirname, '20260925-internship-phase2b1.sql'), 'utf8'));
        }

        let after = await inspect(pool);
        let rollback = null;
        let phase1TemporarilyApplied = false;
        let phase2aTemporarilyApplied = false;

        if (validate) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const validationStart = await inspect(client);
                if (!validationStart.submissions || !validationStart.submission_files) {
                    throw new Error('Training submission tables are required for Phase 2B-1 validation');
                }
                if (!validationStart.content_links) {
                    const internshipConfig = await client.query(
                        `SELECT to_regclass(current_schema() || '.internship_batch_config') IS NOT NULL AS present`
                    );
                    if (!internshipConfig.rows[0].present) {
                        phase1TemporarilyApplied = true;
                        await client.query(transactionBody('20260924-internship-phase1a.sql'));
                    }
                    phase2aTemporarilyApplied = true;
                    await client.query(transactionBody('20260925-internship-phase2a.sql'));
                }
                await client.query(transactionBody('20260925-internship-phase2b1.sql'));
                after = await inspect(client);
                await client.query(transactionBody('20260925-internship-phase2b1-rollback.sql'));
                if (phase2aTemporarilyApplied) {
                    await client.query(transactionBody('20260925-internship-phase2a-rollback.sql'));
                }
                if (phase1TemporarilyApplied) {
                    await client.query(transactionBody('20260924-internship-phase1a-rollback.sql'));
                }
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
            ...(rollback ? { rollback, phase1TemporarilyApplied, phase2aTemporarilyApplied } : {})
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
