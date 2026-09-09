require('dotenv').config();

const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { ensureUserProfileColumns } = require('../utils/userProfileSchema');

const apply = process.argv.includes('--apply');

async function main() {
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    try {
        if (apply) {
            await ensureUserProfileColumns(pool);
        }

        const columns = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name IN (
                'position_label', 'position_verification_status', 'position_verified_at',
                'position_verified_by', 'competency_status', 'competency_verified_at',
                'competency_verified_by', 'target_bim_level', 'system_role'
              )
            ORDER BY column_name
        `);

        const stats = await pool.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE NULLIF(BTRIM(job_role), '') IS NULL)::int AS blank_legacy_position,
                COUNT(*) FILTER (WHERE NULLIF(BTRIM(bim_level), '') IS NULL)::int AS no_competency,
                ${apply ? "COUNT(*) FILTER (WHERE competency_status = 'self_declared')::int" : 'NULL::int'} AS self_declared_competency,
                ${apply ? "COUNT(*) FILTER (WHERE position_verification_status = 'verified')::int" : 'NULL::int'} AS verified_positions,
                ${apply ? "COUNT(*) FILTER (WHERE system_role = 'system_admin')::int" : 'NULL::int'} AS system_admins
            FROM users
        `);
        const levels = await pool.query(`
            SELECT COALESCE(NULLIF(BTRIM(bim_level), ''), '(none)') AS level, COUNT(*)::int AS users
            FROM users
            GROUP BY 1
            ORDER BY 1
        `);

        console.log(JSON.stringify({
            mode: apply ? 'applied' : 'dry-run',
            profileColumns: columns.rows.map((row) => row.column_name),
            users: stats.rows[0],
            competencyLevels: levels.rows
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
