// Read-only operational evidence. No passwords, emails, provider subjects or tokens in output.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Client}=require('pg');
const {createPgConfig}=require('../config/runtimeConfig');
const work=path.resolve(__dirname,'../../.tmp/p0-2-activation');
const baselinePath=path.join(work,'baseline.json');
async function snapshot(db) {
    const rows=(await db.query('SELECT * FROM public.users ORDER BY id')).rows;
    const users=rows.map(row=>({id:row.id,loginCount:row.login_count,fields:Object.fromEntries(Object.entries(row).map(([key,value])=>
        [key,crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')]))}));
    const sequence=(await db.query('SELECT last_value::text,is_called FROM public.users_id_seq')).rows[0];
    return {capturedAt:new Date().toISOString(),users,sequence};
}
async function main() {
    const db=new Client(createPgConfig({connectionTimeoutMillis:5000}));
    try {
        await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const current=await snapshot(db);
        if(process.argv.includes('--baseline')) {
            if(fs.existsSync(baselinePath)) throw Error('Baseline already exists; refusing overwrite');
            if(current.users.length!==16) throw Error('Expected 16 existing users; review before activation');
            fs.mkdirSync(work,{recursive:true});fs.writeFileSync(baselinePath,JSON.stringify(current,null,2));
            console.log(JSON.stringify({baselineCreated:true,userCount:current.users.length,sequence:current.sequence}));
        } else {
            const before=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
            const changes=before.users.map(old=>{const next=current.users.find(u=>u.id===old.id);return {
                id:old.id,removed:!next,changedColumns:next?Object.keys(old.fields).filter(k=>old.fields[k]!==next.fields[k]):[],loginDelta:next?next.loginCount-old.loginCount:0};}).filter(c=>c.removed||c.changedColumns.length);
            const schema=(await db.query("SELECT to_regclass('public.bcl_provider_identities') AS providers")).rows[0].providers;
            const providerMappings=schema?(await db.query('SELECT user_id,provider,issuer,proof_method,approved_by,linked_at FROM bcl_provider_identities ORDER BY user_id')).rows:[];
            const sessions=schema?(await db.query('SELECT user_id,method,count(*)::int AS total,count(*) FILTER(WHERE revoked_at IS NULL AND expires_at>now())::int AS active FROM bcl_auth_sessions GROUP BY user_id,method ORDER BY user_id,method')).rows:[];
            const events=schema?(await db.query('SELECT event,user_id,actor_id,created_at FROM bcl_auth_events ORDER BY id DESC LIMIT 30')).rows:[];
            const result={capturedAt:current.capturedAt,userCount:current.users.length,baselineCount:before.users.length,changes,
                addedIds:current.users.filter(u=>!before.users.some(old=>old.id===u.id)).map(u=>u.id),
                sequenceBefore:before.sequence,sequenceAfter:current.sequence,providerMappings,sessions,events};
            fs.writeFileSync(path.join(work,'latest-evidence.json'),JSON.stringify(result,null,2));
            console.log(JSON.stringify(result,null,2));
        }
        await db.query('ROLLBACK');
    } finally {await db.end();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={snapshot};
