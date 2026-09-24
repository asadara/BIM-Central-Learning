const fs=require('fs');
const path=require('path');
const {Client}=require('pg');
const {createPgConfig}=require('../config/runtimeConfig');
const {userSnapshot}=require('./run-p0-security-migration');
async function applyMigration(client) {
    const prerequisite=await client.query("SELECT 1 FROM bcl_schema_migrations WHERE migration_key='20260918_p0_2_auth'");
    if(prerequisite.rowCount!==1) throw new Error('P0-2 authentication migration is required');
    await client.query(fs.readFileSync(path.join(__dirname,'google-legacy-link.sql'),'utf8'));
}
async function main() {
    const apply=process.argv.includes('--apply');
    const client=new Client(createPgConfig({connectionTimeoutMillis:5000}));
    try {
        await client.connect(); await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'");
        await client.query('LOCK TABLE users,bcl_auth_state,bcl_provider_identities IN SHARE ROW EXCLUSIVE MODE');
        const before=await userSnapshot(client);
        await applyMigration(client);
        if(JSON.stringify(before)!==JSON.stringify(await userSnapshot(client))) throw new Error('User data/sequence changed; migration aborted');
        const report=(await client.query(`SELECT count(*)::int AS eligible,
            count(*) FILTER(WHERE email LIKE '%@gmail.com')::int AS gmail,
            count(*) FILTER(WHERE claimed_at IS NOT NULL)::int AS linked
            FROM bcl_google_legacy_candidates`)).rows[0];
        await client.query(apply?'COMMIT':'ROLLBACK');
        console.log(JSON.stringify({mode:apply?'committed':'dry-run rolled back',...report,userDataUnchanged:true}));
    } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally {await client.end();}
}
module.exports={applyMigration};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
