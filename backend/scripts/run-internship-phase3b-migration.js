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
            to_regclass(current_schema() || '.submission_reviews') IS NOT NULL AS phase3a,
            to_regclass(current_schema() || '.submission_revisions') IS NOT NULL AS revisions,
            CASE WHEN to_regclass(current_schema() || '.submission_revisions') IS NULL THEN FALSE ELSE
                EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = current_schema()
                      AND indexname = 'uq_submission_revisions_current'
                )
            END AS single_current_revision
    `);
    return result.rows[0];
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        const before = await inspect(pool);
        if (apply) {
            await pool.query(fs.readFileSync(path.join(__dirname, '20260925-internship-phase3b.sql'), 'utf8'));
        }

        let after = await inspect(pool);
        let rollback = null;
        const temporary = { phase1: false, phase2a: false, phase2b1: false, phase3a: false };

        if (validate) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const validationStart = await inspect(client);
                if (!validationStart.phase3a) {
                    const dependencies = await client.query(`
                        SELECT
                            to_regclass(current_schema() || '.internship_batch_config') IS NOT NULL AS phase1,
                            to_regclass(current_schema() || '.classwork_content_links') IS NOT NULL AS phase2a,
                            to_regclass(current_schema() || '.submission_status_history') IS NOT NULL AS phase2b1
                    `);
                    if (!dependencies.rows[0].phase1) {
                        temporary.phase1 = true;
                        await client.query(transactionBody('20260924-internship-phase1a.sql'));
                    }
                    if (!dependencies.rows[0].phase2a) {
                        temporary.phase2a = true;
                        await client.query(transactionBody('20260925-internship-phase2a.sql'));
                    }
                    if (!dependencies.rows[0].phase2b1) {
                        temporary.phase2b1 = true;
                        await client.query(transactionBody('20260925-internship-phase2b1.sql'));
                    }
                    temporary.phase3a = true;
                    await client.query(transactionBody('20260925-internship-phase3a.sql'));
                }
                await client.query(transactionBody('20260925-internship-phase3b.sql'));
                after = await inspect(client);
                await client.query(transactionBody('20260925-internship-phase3b-rollback.sql'));
                if (temporary.phase3a) await client.query(transactionBody('20260925-internship-phase3a-rollback.sql'));
                if (temporary.phase2b1) await client.query(transactionBody('20260925-internship-phase2b1-rollback.sql'));
                if (temporary.phase2a) await client.query(transactionBody('20260925-internship-phase2a-rollback.sql'));
                if (temporary.phase1) await client.query(transactionBody('20260924-internship-phase1a-rollback.sql'));
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
            ...(rollback ? { rollback, temporarilyApplied: temporary } : {})
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
