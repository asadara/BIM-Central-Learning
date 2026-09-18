const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
module.exports=async function runAuthTests(){
    assert.ok(process.env.P0_TEST_WORKDIR,'Use test-p0-security.js --p0-2');
    const pg=require('pg'),OriginalPool=pg.Pool,pools=[];
    pg.Pool=class extends OriginalPool{constructor(config){assert.equal(String(config.port),process.env.P0_TEST_PORT);assert.equal(config.host,'127.0.0.1');super(config);pools.push(this);}};
    const {createPgConfig}=require('../config/runtimeConfig');
    const pool=new pg.Pool(createPgConfig());
    const jwt=require('jsonwebtoken'),bcrypt=require('bcrypt'),express=require('express'),session=require('express-session');
    const {OAuth2Client}=require('google-auth-library');
    const {createAuthRuntime,ISSUER,AUDIENCE}=require('../services/authRuntime');
    const {createGoogleIdentityService}=require('../services/googleIdentityService');
    const {createAuthLifecycleRoutes}=require('../routes/authLifecycleRoutes');
    const {requireAuthenticated,requireAdmin}=require('../utils/auth');
    const credentials=require('../utils/credentials');
    const AdminSessionStore=require('../services/adminSessionStore');
    const p1=require('../scripts/run-p0-security-migration'),p2=require('../scripts/run-p0-auth-migration');
    let server,count=0,databaseDown=false,googleDown=false,googleChecks=0,legacyWrites=0;
    const routePool={query(...args){if(databaseDown)throw Object.assign(new Error('Fixture outage'),{code:'ECONNREFUSED'});return pool.query(...args);},connect(){if(databaseDown)throw Error('Fixture outage');return pool.connect();},on(){}};
    const auth=createAuthRuntime({pool:routePool,secret:process.env.JWT_SECRET});
    const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
    const googleClient=new OAuth2Client('fixture-google-client');
    googleClient.getFederatedSignonCertsAsync=async()=>{googleChecks++;if(googleDown)throw Error('network unavailable');return {certs:{fixture:publicKey.export({type:'spki',format:'pem'})},format:'PEM'};};
    const google=createGoogleIdentityService({auth,clientId:'fixture-google-client',client:googleClient});
    const origin='https://bcl.nke.net';let base;
    async function request(url,{method='GET',body,bearer,cookie,requestOrigin=origin,forwarded=true}={}){
        const headers={'Content-Type':'application/json'};
        if(requestOrigin)headers.Origin=requestOrigin;
        if(forwarded)headers['X-Forwarded-Proto']='https';
        if(bearer)headers.Authorization='Bearer '+bearer;
        if(cookie)headers.Cookie=cookie;
        const r=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
        return {status:r.status,data:await r.json(),cookies:r.headers.getSetCookie(),cookie:r.headers.getSetCookie().find(c=>c.startsWith('bcl.admin.sid='))?.split(';')[0]};
    }
    const post=(url,body,extra={})=>request(url,{method:'POST',body,...extra});
    const login=(id,password='old123')=>post('/api/login',{email:'u'+id+'@example.test',password});
    async function check(name,fn){await fn();console.log('PASS '+(++count)+': '+name);}
    async function proof(sub,email='u3@example.test',purpose='login',bearer,overrides={}){
        const c=await post('/api/auth/google/challenge',{purpose},{bearer});assert.equal(c.status,200,JSON.stringify(c.data));
        const now=Math.floor(Date.now()/1000);
        const payload={iss:'https://accounts.google.com',aud:'fixture-google-client',sub,email,email_verified:true,nonce:c.data.nonce,iat:now,exp:now+3600,...overrides};
        return {challengeId:c.data.challengeId,idToken:jwt.sign(payload,privateKey,{algorithm:'RS256',keyid:'fixture'})};
    }
    const googleLogin=async(sub,email)=>post('/api/auth/google',{action:'login',...await proof(sub,email)});
    const userIds=[1,2,3,4,5,6,7,8,9,10,11,15,20,30,31,33];
    let employeeToken,adminToken,adminCookie,newGoogleId,newGoogleToken;
    try{
        await pool.query(fs.readFileSync(path.join(__dirname,'../create-tables.sql'),'utf8'));
        const oldHash=await bcrypt.hash('old123',10);
        for(const id of userIds)await pool.query(`INSERT INTO users(id,username,email,password,bim_level,system_role,is_active)
            VALUES($1,$2,$3,$4,'BIM Modeller',$5,true)`,[id,'u'+id,'u'+id+'@example.test',oldHash,id===9?'system_admin':'employee']);
        await pool.query("SELECT setval('users_id_seq',33,true)");
        const client=await pool.connect();
        try{
            await client.query('BEGIN');await p1.applyMigration(client);await client.query('COMMIT');
            await check('P0-2 forward, pre-use rollback, repeat apply preserve all 16 rows and sequence',async()=>{
                const before=await p1.userSnapshot(client);
                await p2.preflight(client);
                await client.query('BEGIN');await p2.applyMigration(client);await client.query('ROLLBACK');
                await client.query('BEGIN');await p2.applyMigration(client);await client.query('COMMIT');
                await client.query('BEGIN');await client.query(fs.readFileSync(path.join(__dirname,'../scripts/p0-2-auth-rollback.sql'),'utf8'));await client.query('COMMIT');
                await client.query('BEGIN');await p2.applyMigration(client);await p2.applyMigration(client);await client.query('COMMIT');
                assert.deepEqual(await p1.userSnapshot(client),before);
                assert.equal((await client.query('SELECT count(*)::int n FROM bcl_auth_state')).rows[0].n,16);
                assert.equal((await client.query('SELECT count(*)::int n FROM bcl_provider_identities')).rows[0].n,0);
            });
        }finally{client.release();}
        const app=express();app.set('trust proxy','loopback');app.use(express.json());
        app.use(session({name:'bcl.admin.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,rolling:true,
            store:new AdminSessionStore(routePool),cookie:{secure:true,httpOnly:true,sameSite:'lax',maxAge:1800000,path:'/'}}));
        app.use(auth.middleware);
        const noLimit=(req,res,next)=>next();
        app.use(createAuthLifecycleRoutes({auth,google,limiter:noLimit}));
        const userService=require('../services/userAuthService')({backendDir:process.env.P0_TEST_WORKDIR,pgPool:routePool,readUsers:()=>[],writeUsers:()=>{legacyWrites++;}});
        const dependencies={...userService,...credentials,authRuntime:auth,authLimiter:noLimit,googleClientId:'fixture-google-client',pgPool:routePool,jwt,secretKey:process.env.JWT_SECRET,requireAuth:requireAuthenticated};
        app.use(require('../routes/userAuthRoutes')(dependencies));
        app.use(require('../routes/adminSessionRoutes')(dependencies));
        app.use('/api/users',require('../routes/users').createUsersRoutes({pool:routePool,readUsers:()=>[]}));
        app.get('/api/test/identity',requireAuthenticated,(req,res)=>res.json({id:req.authUser.id,role:req.authUser.role}));
        app.get('/api/test/admin',requireAdmin,(req,res)=>res.json({ok:true}));
        server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port;
        await check('existing local bcrypt login by email/username is offline-capable and normalizes JWT',async()=>{
            googleDown=true;const r=await login(1);assert.equal(r.status,200);employeeToken=r.data.token;
            assert.equal((await post('/api/login',{username:'u1',password:'old123'})).status,200);
            const c=jwt.verify(employeeToken,process.env.JWT_SECRET,{issuer:ISSUER,audience:AUDIENCE});
            assert.equal(c.sub,'1');assert.equal(c.userId,c.sub);assert.equal(c.exp-c.iat,3600);assert.ok(c.sid);assert.equal(googleChecks,0);
            assert.equal((await pool.query('SELECT password FROM users WHERE id=1')).rows[0].password,oldHash);googleDown=false;
        });
        await check('legacy JWT, wrong issuer/audience/algorithm, conflicting IDs, and missing session are rejected',async()=>{
            const valid=jwt.decode(employeeToken);
            for(const c of [{userId:1,role:'system_admin'},{...valid,iss:'bcl-online'},{...valid,aud:'bcl-online-api'},{...valid,userId:'9'},{...valid,sid:crypto.randomUUID()},{...valid,sid:'a'.repeat(36)},{...valid,exp:valid.exp+3600}]){
                const t=jwt.sign(c,process.env.JWT_SECRET,{algorithm:'HS256'});assert.equal((await request('/api/test/identity',{bearer:t})).status,401);
            }
            assert.equal((await request('/api/test/identity',{bearer:jwt.sign(valid,process.env.JWT_SECRET,{algorithm:'HS384'})})).status,401);
        });
        await check('profile/job text cannot grant admin, change canonical ID, or extend JWT expiry',async()=>{
            const before=jwt.decode(employeeToken);
            for(const label of [{positionLabel:'System Administrator'},{job_role:'super admin'}]){
                const r=await post('/api/update-profile',{name:'u1',email:'u1@example.test',...label},{bearer:employeeToken});assert.equal(r.status,200,JSON.stringify(r.data));
                assert.equal(r.data.user.id,1);assert.equal(r.data.user.systemRole,'employee');assert.equal(jwt.decode(r.data.token).exp,before.exp);employeeToken=r.data.token;
                assert.equal((await request('/api/test/admin',{bearer:employeeToken})).status,403);
                assert.equal((await post('/api/admin/session/bridge',{}, {bearer:employeeToken})).status,403);
            }
            for(const field of ['id','userId','sub','system_role','metadata','passwordHash'])assert.equal((await post('/api/update-profile',{name:'u1',email:'u1@example.test',[field]:'9'},{bearer:employeeToken})).status,400);
            await assert.rejects(pool.query('UPDATE users SET id=99 WHERE id=1'));
            await assert.rejects(pool.query("UPDATE users SET password='plaintext' WHERE id=1"));
        });
        await check('Google login with matching email never creates or links an account without ownership proof',async()=>{
            const before=await p1.userSnapshot(pool);const r=await googleLogin('google-u3');assert.equal(r.status,409);assert.equal(r.data.code,'GOOGLE_LINK_REQUIRED');
            assert.deepEqual(await p1.userSnapshot(pool),before);assert.equal((await pool.query('SELECT count(*)::int n FROM bcl_provider_identities')).rows[0].n,0);
            assert.equal((await post('/api/auth/google/link',{linkTicket:r.data.linkTicket,identifier:'u3',password:'wrong'})).status,401);
            const linked=await post('/api/auth/google/link',{linkTicket:r.data.linkTicket,identifier:'u3',password:'old123'});assert.equal(linked.status,200);assert.equal(linked.data.id,3);
            assert.equal(jwt.decode(linked.data.token).sub,'3');assert.equal((await login(3)).data.id,3);
            assert.equal((await pool.query('SELECT subject FROM bcl_provider_identities WHERE user_id=3')).rows[0].subject,'google-u3');
            assert.equal((await post('/api/auth/google/link',{linkTicket:r.data.linkTicket,identifier:'u3',password:'old123'})).status,401);
        });
        await check('persistent issuer/sub survives service restart, Google email and local profile email changes',async()=>{
            const u=await login(3);
            const changed=await post('/api/update-profile',{name:'u3',email:'local-new@example.test'},{bearer:u.data.token});assert.equal(changed.status,200);
            const freshService=createGoogleIdentityService({auth,clientId:'fixture-google-client',client:googleClient});
            const p=await proof('google-u3','provider-new@example.test');const verified=await freshService.verifyProof(p.idToken,p.challengeId,'login');
            const result=await freshService.login(verified);assert.equal(result.user.id,3);assert.equal(result.user.email,'local-new@example.test');
            assert.equal(jwt.decode(result.token).sub,'3');assert.equal((await googleLogin('google-u3','provider-new@example.test')).data.id,3);
        });
        await check('production Google verifier rejects signature, issuer, audience, expiry, missing sub, nonce and replay',async()=>{
            for(const override of [{iss:'https://evil.test'},{aud:'other-client'},{exp:1},{sub:''},{nonce:'different'},{email_verified:false},{iat:Math.floor(Date.now()/1000)-1000}]){
                const p=await proof('invalid-proof','u4@example.test','login',undefined,override);assert.equal((await post('/api/auth/google',{action:'login',...p})).status,401);
            }
            const bad=await proof('invalid-proof');bad.idToken=bad.idToken.slice(0,-12)+'notavalidsig';assert.equal((await post('/api/auth/google',{action:'login',...bad})).status,401);
            const p=await proof('google-u3');assert.equal((await post('/api/auth/google',{action:'login',...p})).status,200);
            assert.equal((await post('/api/auth/google',{action:'login',...p})).status,401);
            const wrongPurpose=await proof('another','u4@example.test');assert.equal((await post('/api/auth/google',{action:'register',username:'new',...wrongPurpose})).status,401);
        });
        await check('explicit registration rejects provider/email collisions and does not reinterpret login',async()=>{
            const n=Number((await pool.query('SELECT count(*) n FROM users')).rows[0].n);
            assert.equal((await googleLogin('unknown','unknown@example.test')).status,409);
            assert.equal((await post('/api/auth/google',{...await proof('unknown')})).status,400);
            assert.equal((await post('/api/auth/google',{action:'register',username:'new4',...await proof('other-google','u4@example.test','register')})).status,409);
            assert.equal((await post('/api/auth/google',{action:'register',username:'other3',...await proof('google-u3','another@example.test','register')})).status,409);
            assert.equal(Number((await pool.query('SELECT count(*) n FROM users')).rows[0].n),n);
            const r=await post('/api/auth/google',{action:'register',username:'registeredGoogle',...await proof('new-google','new-google@example.test','register')});assert.equal(r.status,201,JSON.stringify(r.data));
            newGoogleId=r.data.id;newGoogleToken=r.data.token;
            const state=await auth.userState(newGoogleId);assert.equal(state.local_password_enabled,false);assert.ok(await credentials.isPasswordHash(state.password));assert.equal(state.system_role,'employee');
        });
        await check('linked Google proof can set a local password, preserving ID and raw password spaces',async()=>{
            const r=await post('/api/auth/password',{proof:'google',newPassword:' local password ',...await proof('new-google','changed-google@example.test','password',newGoogleToken)},{bearer:newGoogleToken});
            assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.id,newGoogleId);
            assert.equal((await request('/api/test/identity',{bearer:newGoogleToken})).status,401);
            const raw=await post('/api/login',{email:'new-google@example.test',password:' local password '});assert.equal(raw.status,200);assert.equal(raw.data.id,newGoogleId);
            assert.equal((await post('/api/login',{email:'new-google@example.test',password:'local password'})).status,401);
        });
        await check('provider ownership cannot be reassigned; concurrent links have exactly one owner',async()=>{
            const a=await googleLogin('racing-google','shared@example.test'),b=await googleLogin('racing-google','shared@example.test');
            const results=await Promise.all([post('/api/auth/google/link',{linkTicket:a.data.linkTicket,identifier:'u5',password:'old123'}),post('/api/auth/google/link',{linkTicket:b.data.linkTicket,identifier:'u6',password:'old123'})]);
            assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
            assert.equal((await pool.query("SELECT count(*)::int n FROM bcl_provider_identities WHERE subject='racing-google'")).rows[0].n,1);
            const t=(await login(4)).data.token,p=await proof('google-u3','u4@example.test','link',t);
            const req=await post('/api/auth/google/link-proof',p,{bearer:t});assert.equal(req.status,200);
            assert.equal((await post('/api/auth/google/link',{linkTicket:req.data.linkTicket,identifier:'u4',password:'old123'},{bearer:t})).status,409);
            assert.equal((await pool.query("SELECT user_id FROM bcl_provider_identities WHERE subject='google-u3'")).rows[0].user_id,3);
        });
        await check('Google/network outage does not affect local authentication; database outage fails closed',async()=>{
            googleDown=true;const p=await proof('outage');assert.equal((await post('/api/auth/google',{action:'login',...p})).status,503);
            assert.equal((await login(1)).status,200);googleDown=false;
            databaseDown=true;assert.equal((await login(1)).status,503);assert.equal((await request('/api/test/identity',{bearer:employeeToken})).status,503);databaseDown=false;
            assert.equal(legacyWrites,0);
        });
        await check('admin sessions are regenerated, PostgreSQL-backed, Secure/HttpOnly/SameSite, and revalidated',async()=>{
            adminToken=(await login(9)).data.token;
            const first=await post('/api/admin/login',{email:'u9',password:'old123'});assert.equal(first.status,200);assert.ok(first.cookie);
            const attr=first.cookies.find(c=>c.startsWith('bcl.admin.sid='));assert.match(attr,/HttpOnly/);assert.match(attr,/Secure/);assert.match(attr,/SameSite=Lax/);assert.ok(!first.data.sessionId);
            const second=await post('/api/admin/login',{email:'u9',password:'old123'},{cookie:first.cookie});assert.equal(second.status,200);assert.notEqual(second.cookie,first.cookie);adminCookie=second.cookie;
            assert.equal((await request('/api/admin/session',{cookie:first.cookie})).status,401);
            assert.equal((await request('/api/admin/session',{cookie:adminCookie})).data.user.systemRole,'system_admin');
            assert.ok((await pool.query('SELECT count(*)::int n FROM bcl_admin_sessions')).rows[0].n>0);
        });
        await check('Bearer takes precedence; cookies cannot elevate employee or rescue invalid tokens; CSRF rejected',async()=>{
            const employee=(await login(1)).data.token;
            assert.equal((await request('/api/test/admin',{cookie:adminCookie,bearer:employee})).status,403);
            assert.equal((await request('/api/test/admin',{cookie:adminCookie,bearer:'invalid'})).status,401);
            assert.equal((await post('/api/users/create',{}, {cookie:adminCookie,requestOrigin:'https://evil.test'})).status,403);
            assert.equal((await post('/api/users/create',{}, {cookie:adminCookie,requestOrigin:null})).status,403);
            assert.equal((await post('/api/admin/login',{email:'u9',password:'old123'},{requestOrigin:'https://evil.test'})).status,403);
        });
        await check('admin create and local signup retain bcrypt and employee-only role under P0-2',async()=>{
            for(const [endpoint,payload] of [['/api/users/create',{username:'admin_created',email:'admin-created@example.test',password:' new password ',positionLabel:'Administrator'}],['/api/signup',{username:'local_registered',email:'local-registered@example.test',password:' new password ',positionLabel:'Administrator'}]]){
                const r=await post(endpoint,payload,{bearer:adminToken});assert.equal(r.status,201,JSON.stringify(r.data));
                const row=(await pool.query('SELECT password,system_role FROM users WHERE id=$1',[r.data.user.id])).rows[0];assert.equal(row.system_role,'employee');assert.equal(await bcrypt.compare(payload.password,row.password),true);
                assert.equal((await post('/api/login',{email:payload.email,password:payload.password})).status,200);
            }
        });
        await check('admin cookie idle/absolute limits and recent-auth bridge are enforced',async()=>{
            const idle=await post('/api/admin/login',{email:'u9',password:'old123'});
            await pool.query("UPDATE bcl_admin_sessions SET expires_at=now()-interval '1 second'");
            assert.equal((await request('/api/admin/session',{cookie:idle.cookie})).status,401);
            const absolute=await post('/api/admin/login',{email:'u9',password:'old123'});
            await pool.query("UPDATE bcl_admin_sessions SET sess=jsonb_set(sess,'{adminUser,authTime}',to_jsonb($1::bigint))",[Date.now()-9*3600000]);
            assert.equal((await request('/api/admin/session',{cookie:absolute.cookie})).status,401);
            const old=jwt.decode((await login(9)).data.token);old.iat-=600;old.auth_time-=600;old.exp-=600;
            assert.equal((await post('/api/admin/session/bridge',{}, {bearer:jwt.sign(old,process.env.JWT_SECRET)})).status,401);
            const fresh=await post('/api/admin/session/bridge',{}, {bearer:adminToken});assert.equal(fresh.status,200);adminCookie=fresh.cookie;
        });
        await check('legacy Google account uses explicit admin ownership approval, never email-only linking',async()=>{
            const r=await googleLogin('legacy-google-20','u20@example.test');assert.equal(r.status,409);
            const approve='/api/admin/auth/google-link-requests/'+r.data.requestId+'/approve';
            const body={userId:20,currentPassword:'old123',verificationMethod:'organization_identity_check',reason:'Operator verified the original organizational identity record in person.'};
            assert.equal((await post(approve,body,{bearer:employeeToken})).status,403);
            assert.equal((await post(approve,{...body,currentPassword:'wrong'},{cookie:adminCookie})).status,403);
            assert.equal((await post(approve,{...body,verificationMethod:'email_match'},{cookie:adminCookie})).status,400);
            assert.equal((await post('/api/auth/google/complete-link',{linkTicket:r.data.linkTicket})).status,409);
            assert.equal((await post(approve,body,{cookie:adminCookie})).status,200);
            const done=await post('/api/auth/google/complete-link',{linkTicket:r.data.linkTicket});assert.equal(done.status,200);assert.equal(done.data.id,20);
            assert.equal((await googleLogin('legacy-google-20','different@example.test')).data.id,20);
            assert.equal((await pool.query('SELECT count(*)::int n FROM users WHERE id IN(15,20)')).rows[0].n,2);
            assert.equal((await pool.query('SELECT count(*)::int n FROM users WHERE id=23')).rows[0].n,0);
        });
        await check('logout/password change revoke sessions; profile password compatibility also revokes old tokens',async()=>{
            const a=(await login(1)).data.token,b=(await login(1)).data.token;
            assert.equal((await post('/api/auth/logout',{}, {bearer:a})).status,200);assert.equal((await request('/api/test/identity',{bearer:a})).status,401);
            assert.equal((await request('/api/test/identity',{bearer:b})).status,200);
            const r=await post('/api/auth/password',{proof:'local',currentPassword:'old123',newPassword:' changed password '},{bearer:b});assert.equal(r.status,200);
            assert.equal((await request('/api/test/identity',{bearer:b})).status,401);assert.equal((await login(1)).status,401);assert.equal((await login(1,' changed password ')).status,200);
            const c=(await login(2)).data.token;
            const updated=await post('/api/update-profile',{name:'u2',email:'u2@example.test',old_pass:'old123',new_pass:' next password ',c_pass:' next password '},{bearer:c});assert.equal(updated.status,200,JSON.stringify(updated.data));
            assert.equal((await request('/api/test/identity',{bearer:c})).status,401);assert.equal((await request('/api/test/identity',{bearer:updated.data.token})).status,200);
            await post('/api/auth/logout-all',{}, {bearer:updated.data.token});assert.equal((await request('/api/test/identity',{bearer:updated.data.token})).status,401);
        });
        await check('disabled and re-enabled users cannot reuse JWT; role changes revoke prior privileges',async()=>{
            const t=(await login(4)).data.token;await pool.query('UPDATE users SET is_active=false WHERE id=4');
            assert.equal((await request('/api/test/identity',{bearer:t})).status,401);assert.equal((await login(4)).status,401);
            await pool.query('UPDATE users SET is_active=true WHERE id=4');assert.equal((await request('/api/test/identity',{bearer:t})).status,401);
            await pool.query("UPDATE users SET system_role='employee' WHERE id=9");assert.equal((await request('/api/test/admin',{bearer:adminToken})).status,401);assert.equal((await request('/api/admin/session',{cookie:adminCookie})).status,401);
            await pool.query("UPDATE users SET system_role='system_admin' WHERE id=9");assert.equal((await request('/api/test/admin',{bearer:adminToken})).status,401);
            await pool.query('UPDATE users SET is_active=false WHERE id=3');assert.equal((await googleLogin('google-u3')).status,401);await pool.query('UPDATE users SET is_active=true WHERE id=3');
        });
        await check('link tickets expire and admin/target security changes invalidate prior approvals',async()=>{
            for(const changed of [9,4]) {
                const admin=(await login(9)).data.token;
                const pending=await googleLogin('approval-revoked-'+changed,'unrelated@example.test');
                const body={userId:4,currentPassword:'old123',verificationMethod:'in_person',reason:'Fixture verified original identity records and holder in person.'};
                assert.equal((await post('/api/admin/auth/google-link-requests/'+pending.data.requestId+'/approve',body,{bearer:admin})).status,200);
                await auth.revokeUser(changed);
                assert.equal((await post('/api/auth/google/complete-link',{linkTicket:pending.data.linkTicket})).status,403);
            }
            const expired=await googleLogin('expired-request');
            await pool.query("UPDATE bcl_google_link_requests SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.data.requestId]);
            assert.equal((await post('/api/auth/google/link',{linkTicket:expired.data.linkTicket,identifier:'u4',password:'old123'})).status,401);
            const challenge=await proof('expired-challenge');
            await pool.query("UPDATE bcl_google_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",[challenge.challengeId]);
            assert.equal((await post('/api/auth/google',{action:'login',...challenge})).status,401);
        });
        await check('admin reset consumption is atomic, single-use, expires, and revokes JWT and admin sessions',async()=>{
            const resetSource=fs.readFileSync(path.join(__dirname,'../routes/adminSessionRoutes.js'),'utf8');
            const start=resetSource.indexOf('    function getPublicBaseUrl('),end=resetSource.indexOf('    function getConfiguredMailTransport(',start);
            const resetContext=require('vm').createContext({authRuntime:auth});
            require('vm').runInContext(resetSource.slice(start,end),resetContext);
            assert.equal(resetContext.getResetLink({headers:{'x-forwarded-proto':'http'},get:()=> 'attacker.example'},'fixture-token'),'https://bcl.nke.net/pages/sub/admin-password-reset.html?token=fixture-token');
            const a=await post('/api/admin/login',{email:'u9',password:'old123'});const bearer=(await login(9)).data.token;
            // The normal request path creates its existing reset-token table, without SMTP configuration.
            await post('/api/admin/password-recovery/request',{email:'no-account@example.test'});
            await pool.query(`CREATE TABLE IF NOT EXISTS admin_password_reset_tokens(id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL,email TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,requested_ip TEXT,created_at TIMESTAMPTZ DEFAULT now())`);
            const token=crypto.randomBytes(32).toString('hex');const hash=crypto.createHash('sha256').update(token).digest('hex');
            await pool.query("INSERT INTO admin_password_reset_tokens(user_id,email,token_hash,expires_at) VALUES('9','u9@example.test',$1,now()+interval '10 minutes')",[hash]);
            await pool.query("ALTER TABLE bcl_auth_events ADD CONSTRAINT test_reset_rollback CHECK(event<>'admin_password_reset')");
            const body={token,newPassword:'new admin password',confirmPassword:'new admin password'};
            assert.equal((await post('/api/admin/password-recovery/reset',body)).status,503);
            assert.equal((await pool.query('SELECT used_at FROM admin_password_reset_tokens WHERE token_hash=$1',[hash])).rows[0].used_at,null);
            assert.equal((await login(9)).status,200);
            await pool.query('ALTER TABLE bcl_auth_events DROP CONSTRAINT test_reset_rollback');
            assert.equal((await post('/api/admin/password-recovery/reset',body)).status,200);
            assert.equal((await request('/api/test/identity',{bearer})).status,401);assert.equal((await request('/api/admin/session',{cookie:a.cookie})).status,401);
            assert.equal((await post('/api/admin/password-recovery/reset',body)).status,400);assert.equal((await login(9,'new admin password')).status,200);
        });
        await check('unlink is explicitly disabled; post-use schema rollback refuses loss of provider evidence',async()=>{
            const bearer=(await login(4)).data.token;assert.equal((await request('/api/auth/providers/google',{method:'DELETE',bearer,body:{}})).status,409);
            const c=await pool.connect();try{await c.query('BEGIN');await assert.rejects(c.query(fs.readFileSync(path.join(__dirname,'../scripts/p0-2-auth-rollback.sql'),'utf8')));await c.query('ROLLBACK');}finally{c.release();}
            assert.deepEqual((await pool.query('SELECT id FROM users WHERE id=ANY($1::int[]) ORDER BY id',[userIds])).rows.map(r=>r.id),userIds);
            assert.equal(legacyWrites,0);
        });
        await check('password change invalidates unused reset links; expired reset links cannot change credentials',async()=>{
            const stale=crypto.randomBytes(32).toString('hex'),expired=crypto.randomBytes(32).toString('hex');
            for(const [value,when] of [[stale,"now()+interval '10 minutes'"],[expired,"now()-interval '1 second'"]]) {
                await pool.query(`INSERT INTO admin_password_reset_tokens(user_id,email,token_hash,expires_at) VALUES('9','u9@example.test',$1,${when})`,[auth.digest(value)]);
            }
            await auth.changePassword(9,'new admin password','rotated admin password',false);
            for(const token of [stale,expired]) assert.equal((await post('/api/admin/password-recovery/reset',{token,newPassword:'unauthorized password',confirmPassword:'unauthorized password'})).status,400);
            assert.equal((await login(9,'rotated admin password')).status,200);
            const active=(await login(4)).data.token;
            await pool.query("UPDATE bcl_auth_sessions SET expires_at=now()-interval '1 second' WHERE sid=$1",[jwt.decode(active).sid]);
            assert.equal((await request('/api/test/identity',{bearer:active})).status,401);
        });
        await check('production throttling rejects failed attempts while allowing successful/offline local login',async()=>{
            const production=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
            const configured=production.match(/app\.set\('trust proxy', [^;]+;/)[0];
            require('vm').runInNewContext(configured,{app});
            const trusts=app.get('trust proxy fn');
            assert.equal(trusts('127.0.0.1'),true);assert.equal(trusts('10.0.0.50'),false);assert.equal(trusts('169.254.1.1'),false);
            const {ipKeyGenerator}=require('express-rate-limit');
            assert.notEqual(ipKeyGenerator('::ffff:192.0.2.1'),ipKeyGenerator('::ffff:192.0.2.2'));
            const {authLimiter,googleChallengeLimiter}=require('../utils/authLimiters')();
            app.use('/limited',createAuthLifecycleRoutes({auth,google,limiter:authLimiter,challengeLimiter:googleChallengeLimiter}));
            for(let i=0;i<7;i++)assert.equal((await post('/limited/api/login',{email:'u4',password:'old123'})).status,200);
            for(let i=0;i<5;i++)assert.equal((await post('/limited/api/login',{email:'u4',password:'wrong'})).status,401);
            assert.equal((await post('/limited/api/login',{email:'u4',password:'wrong'})).status,429);
            assert.equal((await post('/limited/api/auth/google/challenge',{purpose:'login'})).status,200);
        });
        await check('search download tickets use canonical session identity and honor logout/disable/current permissions',async()=>{
            const policy=require('../utils/searchContentPolicy'),vm=require('vm');
            const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
            const start=source.indexOf('async function requireSearchFileAccess('),end=source.indexOf('\nfunction protectDirectBaseFile',start);
            let permission=true;
            const context=vm.createContext({...policy,BASE_DIR:'G:/BIM CENTRAL LEARNING/',authRuntime:auth,
                getRequestUserPreferBearer:require('../utils/auth').getRequestUserPreferBearer,
                resolveAccessProfile:async()=>({dokumenAccess:permission}),recordSearchFileAccess(){},console:{error(){}}});
            vm.runInContext(source.slice(start,end),context);
            app.get('/api/test/file',context.requireSearchFileAccess,(req,res)=>res.json({id:req.authUser.id}));
            const filename='1. ISO 19650/fixture.pdf';
            const token=(await login(4)).data.token,principal=await auth.verify(token);
            const ticket=policy.createSearchFileTicket(filename,principal);
            const url='/api/test/file?path='+encodeURIComponent(filename)+'&ticket='+encodeURIComponent(ticket);
            assert.equal(policy.verifySearchFileTicket(ticket,filename).sub,'4');
            assert.equal(policy.createSearchFileTicket(filename,{email:'u4@example.test',username:'u4'}),'');
            assert.equal(policy.verifySearchFileTicket(ticket,'2. BIM Planning/other.pdf'),null);
            assert.equal((await request(url)).status,200);
            permission=false;assert.equal((await request(url)).status,403);permission=true;
            await post('/api/auth/logout',{}, {bearer:token});assert.equal((await request(url)).status,401);
            const active=await auth.verify((await login(4)).data.token);
            const disabled=policy.createSearchFileTicket(filename,active);
            await pool.query('UPDATE users SET is_active=false WHERE id=4');
            assert.equal((await request('/api/test/file?path='+encodeURIComponent(filename)+'&ticket='+encodeURIComponent(disabled))).status,401);
            await pool.query('UPDATE users SET is_active=true WHERE id=4');
            const admin=await post('/api/admin/login',{email:'u9',password:'rotated admin password'});
            app.get('/api/test/ticket',requireAuthenticated,(req,res)=>res.json({ticket:policy.createSearchFileTicket(filename,req.authUser)}));
            const adminTicket=(await request('/api/test/ticket',{cookie:admin.cookie})).data.ticket;
            assert.ok(adminTicket);const adminUrl='/api/test/file?path='+encodeURIComponent(filename)+'&ticket='+encodeURIComponent(adminTicket);
            assert.equal((await request(adminUrl)).status,200);
            const employee=(await login(4)).data.token;permission=false;
            assert.equal((await request(adminUrl,{bearer:employee})).status,403);permission=true;
            await post('/api/admin/logout',{}, {cookie:admin.cookie});
            assert.equal((await request(adminUrl)).status,401);
        });
        console.log('P0-2 integration checks passed: '+count);
    }finally{
        if(server)await new Promise(resolve=>server.close(resolve));
        await Promise.allSettled(pools.map(p=>p.end()));pg.Pool=OriginalPool;
    }
};
