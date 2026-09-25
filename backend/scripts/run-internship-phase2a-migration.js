'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
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
            to_regclass(current_schema() || '.classwork_items') IS NOT NULL AS classwork_items,
            to_regclass(current_schema() || '.internship_batch_config') IS NOT NULL AS internship_config,
            to_regclass(current_schema() || '.classwork_content_links') IS NOT NULL AS content_links,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'classwork_items'
                  AND column_name = 'available_at'
            ) AS available_at,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'classwork_items'
                  AND column_name = 'required_deliverable'
            ) AS required_deliverable,
            EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'classwork_items'
                  AND column_name = 'participant_visibility'
            ) AS participant_visibility
    `);
    return result.rows[0];
}

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        const before = await inspect(pool);
        if (apply) {
            await pool.query(fs.readFileSync(path.join(__dirname, '20260925-internship-phase2a.sql'), 'utf8'));
        }

        let after = await inspect(pool);
        let rollback = null;
        let phase1TemporarilyApplied = false;

        if (validate) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const validationStart = await inspect(client);
                if (!validationStart.internship_config) {
                    phase1TemporarilyApplied = true;
                    await client.query(transactionBody('20260924-internship-phase1a.sql'));
                }
                await client.query(transactionBody('20260925-internship-phase2a.sql'));
                after = await inspect(client);
                await client.query(transactionBody('20260925-internship-phase2a-rollback.sql'));
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
            ...(rollback ? { rollback, phase1TemporarilyApplied } : {})
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
