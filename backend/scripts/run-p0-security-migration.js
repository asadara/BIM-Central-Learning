const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

async function preflight(client) {
    const stats = await client.query(`SELECT count(*)::int AS users,
        count(*) FILTER (WHERE password !~ '^\\$2[ab]\\$(0[4-9]|[12][0-9]|3[01])\\$[./A-Za-z0-9]{53}$')::int AS unsupported_passwords,
        count(*) FILTER (WHERE bim_level IS NOT NULL AND bim_level NOT IN ('BIM Modeller','BIM Coordinator','BIM Specialist','BIM Manager'))::int AS unsupported_levels
        FROM public.users`);
    const duplicates = await client.query(`SELECT 'email' AS field, count(*)::int AS groups FROM
        (SELECT lower(btrim(email)) FROM public.users GROUP BY 1 HAVING count(*)>1) e
        UNION ALL SELECT 'username', count(*)::int FROM
        (SELECT lower(btrim(username)) FROM public.users GROUP BY 1 HAVING count(*)>1) n`);
    const constraints = await client.query(`SELECT conname, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint WHERE conrelid='public.users'::regclass ORDER BY conname`);
    const level = await client.query(`SELECT is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='users' AND column_name='bim_level'`);
    return { ...stats.rows[0], duplicates: duplicates.rows, level: level.rows[0], constraints: constraints.rows };
}

async function applyMigration(client) {
    await client.query(fs.readFileSync(path.join(__dirname, 'p0-1-security.sql'), 'utf8'));
}

async function userSnapshot(client) {
    // Aggregate stays in memory; never log user attributes or password hashes.
    const rows = await client.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(u) ORDER BY id)::text, '[]')) AS digest FROM public.users u`);
    const sequence = await client.query('SELECT last_value::text, is_called FROM public.users_id_seq');
    return { digest: rows.rows[0].digest, sequence: sequence.rows[0] };
}

async function main() {
    const apply = process.argv.includes('--apply');
    const client = new Client(createPgConfig({ connectionTimeoutMillis: 5000 }));
    try {
        await client.connect();
        await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
        if (apply) {
            await client.query("SET LOCAL lock_timeout = '3s'; SET LOCAL statement_timeout = '30s'");
            await client.query('LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE');
        }
        const before = await preflight(client);
        console.log(JSON.stringify({ mode: apply ? 'apply' : 'read-only preflight', before }, null, 2));
        if (before.unsupported_passwords || before.unsupported_levels || before.duplicates.some(row => row.groups)) {
            throw new Error('Manual remediation required; no automatic merge or credential conversion is permitted');
        }
        if (apply) {
            const snapshot = await userSnapshot(client);
            await applyMigration(client);
            if (JSON.stringify(await userSnapshot(client)) !== JSON.stringify(snapshot)) {
                throw new Error('User records or ID sequence changed; rolling back P0-1 migration');
            }
            console.log('Verified: every user field, password hash, canonical ID and sequence value is unchanged.');
        }
        await client.query(apply ? 'COMMIT' : 'ROLLBACK');
        console.log(apply ? 'P0-1 schema changes committed; user data was not modified.' : 'Read-only preflight passed.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        await client.end();
    }
}

module.exports = { preflight, applyMigration, userSnapshot };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
