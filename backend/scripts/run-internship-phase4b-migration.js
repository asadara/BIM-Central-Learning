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
            to_regclass(current_schema() || '.internship_program_policy_versions') IS NOT NULL AS policy_versions,
            to_regclass(current_schema() || '.internship_program_closeouts') IS NOT NULL AS closeouts,
            to_regclass(current_schema() || '.internship_program_completion_audit') IS NOT NULL AS completion_audit,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'internship_batch_config'
                  AND column_name = 'policy_version_id'
            ) AS batch_policy_reference
    `);
    return result.rows[0];
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        const before = await inspect(pool);
        if (apply) {
            await pool.query(fs.readFileSync(path.join(__dirname, '20260925-internship-phase4b.sql'), 'utf8'));
        }

        let after = await inspect(pool);
        let rollback = null;
        if (validate) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const dependency = await client.query(`
                    SELECT
                        to_regclass(current_schema() || '.internship_batch_config') IS NOT NULL AS phase1,
                        to_regclass(current_schema() || '.classwork_content_links') IS NOT NULL AS phase2a,
                        to_regclass(current_schema() || '.submission_status_history') IS NOT NULL AS phase2b1,
                        to_regclass(current_schema() || '.submission_reviews') IS NOT NULL AS phase3a,
                        to_regclass(current_schema() || '.submission_revisions') IS NOT NULL AS phase3b
                `);
                const temporary = [];
                const dependencies = [
                    ['phase1', '20260924-internship-phase1a.sql'],
                    ['phase2a', '20260925-internship-phase2a.sql'],
                    ['phase2b1', '20260925-internship-phase2b1.sql'],
                    ['phase3a', '20260925-internship-phase3a.sql'],
                    ['phase3b', '20260925-internship-phase3b.sql']
                ];
                for (const [key, filename] of dependencies) {
                    if (!dependency.rows[0][key]) {
                        await client.query(transactionBody(filename));
                        temporary.push(key);
                    }
                }
                await client.query(transactionBody('20260925-internship-phase4b.sql'));
                after = await inspect(client);
                await client.query(transactionBody('20260925-internship-phase4b-rollback.sql'));
                const rollbackFiles = {
                    phase3b: '20260925-internship-phase3b-rollback.sql',
                    phase3a: '20260925-internship-phase3a-rollback.sql',
                    phase2b1: '20260925-internship-phase2b1-rollback.sql',
                    phase2a: '20260925-internship-phase2a-rollback.sql',
                    phase1: '20260924-internship-phase1a-rollback.sql'
                };
                for (const key of [...temporary].reverse()) {
                    await client.query(transactionBody(rollbackFiles[key]));
                }
                rollback = await inspect(client);
                await client.query('ROLLBACK');
                console.log(JSON.stringify({
                    mode: 'validated-and-rolled-back', before, after, rollback, temporarilyApplied: temporary
                }, null, 2));
                return;
            } catch (error) {
                await client.query('ROLLBACK').catch(() => {});
                throw error;
            } finally {
                client.release();
            }
        }

        console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', before, after }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
