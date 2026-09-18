const fs=require('fs');
const path=require('path');
const {Client}=require('pg');
const {createPgConfig}=require('../config/runtimeConfig');
const {userSnapshot}=require('./run-p0-security-migration');
async function preflight(client) {
    const prerequisite=await client.query("SELECT migration_key FROM bcl_schema_migrations WHERE migration_key='20260917_p0_1_security_identity'");
    if(prerequisite.rowCount!==1) throw new Error('Apply reviewed P0-1 migration before P0-2');
    const counts=await client.query(`SELECT count(*)::int AS users,count(*) FILTER(WHERE is_active IS NOT TRUE)::int AS inactive FROM users`);
    const crossNamespace=await client.query(`SELECT count(*)::int AS conflicts FROM users a JOIN users b
        ON a.id<>b.id AND lower(btrim(a.email))=lower(btrim(b.username))`);
    if(crossNamespace.rows[0].conflicts) throw new Error('Ambiguous login namespace requires manual review; no automatic reassignment');
    return {...counts.rows[0],crossNamespaceConflicts:0,canonicalId:'public.users.id',providerAutoMapping:false};
}
async function applyMigration(client) {
    await client.query(fs.readFileSync(path.join(__dirname,'p0-2-auth.sql'),'utf8'));
}
async function main() {
    const apply=process.argv.includes('--apply'),client=new Client(createPgConfig({connectionTimeoutMillis:5000}));
    try {
        await client.connect(); await client.query(apply?'BEGIN':'BEGIN READ ONLY');
        if(apply) {
            await client.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'");
            await client.query('LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE');
        }
        console.log(JSON.stringify({mode:apply?'apply':'read-only preflight',report:await preflight(client)}));
        if(apply) {
            const before=await userSnapshot(client);
            await applyMigration(client);
            if(JSON.stringify(before)!==JSON.stringify(await userSnapshot(client))) throw new Error('User data/sequence changed; migration aborted');
        }
        await client.query(apply?'COMMIT':'ROLLBACK');
        console.log(apply?'P0-2 committed; every existing user field and sequence preserved.':'P0-2 read-only preflight passed.');
    } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
    finally {await client.end();}
}
module.exports={preflight,applyMigration};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
