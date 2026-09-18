const crypto=require('crypto');
const {OAuth2Client}=require('google-auth-library');
const {digest,fail,UUID_PATTERN}=require('./authRuntime');
const {hashPassword,verifyPassword}=require('../utils/credentials');
const ISSUER='https://accounts.google.com';
const GOOGLE_ISSUERS=['accounts.google.com',ISSUER];
function createGoogleIdentityService({auth,clientId,client=new OAuth2Client(clientId)}) {
    async function challenge(purpose,userId=null) {
        if(!['login','register','link','password'].includes(purpose)) throw fail('INVALID_GOOGLE_ACTION',400);
        if(['link','password'].includes(purpose)&&!userId) throw fail('AUTHENTICATION_REQUIRED');
        const id=crypto.randomUUID(),nonce=crypto.randomBytes(32).toString('base64url');
        await auth.pool.query(`INSERT INTO bcl_google_challenges(id,nonce_hash,purpose,user_id,expires_at)
            VALUES($1,$2,$3,$4,now()+interval '5 minutes')`,[id,digest(nonce),purpose,userId]);
        return {challengeId:id,nonce};
    }
    async function verifyProof(idToken,challengeId,purpose,userId=null) {
        if(!clientId) throw fail('GOOGLE_NOT_CONFIGURED',503);
        if(typeof idToken!=='string'||idToken.length>12000||!UUID_PATTERN.test(challengeId||'')) throw fail('GOOGLE_PROOF_REQUIRED',400);
        const row=(await auth.pool.query('SELECT * FROM bcl_google_challenges WHERE id=$1 AND used_at IS NULL AND expires_at>now()',[challengeId])).rows[0];
        if(!row||row.purpose!==purpose||String(row.user_id||'')!==String(userId||'')) throw fail('GOOGLE_CHALLENGE_INVALID');
        let payload;
        try { payload=(await client.verifyIdToken({idToken,audience:clientId})).getPayload(); }
        catch(error) {
            const outage=/fetch|network|ENOTFOUND|ECONN|timeout/i.test(error.message);
            throw fail(outage?'GOOGLE_UNAVAILABLE':'GOOGLE_TOKEN_INVALID',outage?503:401);
        }
        const now=Math.floor(Date.now()/1000);
        if(!payload||!GOOGLE_ISSUERS.includes(payload.iss)||payload.aud!==clientId||
            (payload.azp&&payload.azp!==clientId)||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||
            !Number.isFinite(payload.exp)||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+60||now-payload.iat>300||
            payload.email_verified!==true||typeof payload.email!=='string'||!payload.email.includes('@')||
            typeof payload.nonce!=='string'||digest(payload.nonce)!==row.nonce_hash) throw fail('GOOGLE_CLAIMS_INVALID');
        const consumed=await auth.pool.query('UPDATE bcl_google_challenges SET used_at=now() WHERE id=$1 AND used_at IS NULL AND expires_at>now() RETURNING id',[challengeId]);
        if(consumed.rowCount!==1) throw fail('GOOGLE_CHALLENGE_REPLAYED');
        return {issuer:ISSUER,sub:payload.sub,email:payload.email.trim().toLowerCase(),name:String(payload.name||'Google user').slice(0,100)};
    }
    async function mapping(proof,db=auth.pool) {
        return (await db.query('SELECT user_id FROM bcl_provider_identities WHERE provider=$1 AND issuer=$2 AND subject=$3',['google',proof.issuer,proof.sub])).rows[0];
    }
    async function pending(proof) {
        const id=crypto.randomUUID(),secret=crypto.randomBytes(32).toString('base64url');
        await auth.pool.query(`INSERT INTO bcl_google_link_requests(id,secret_hash,issuer,subject,provider_email,expires_at)
            VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')`,[id,digest(secret),proof.issuer,proof.sub,proof.email]);
        return {requestId:id,linkTicket:secret};
    }
    async function insertMapping(proof,userId,method,db,actorId=null) {
        try { await db.query(`INSERT INTO bcl_provider_identities(provider,issuer,subject,user_id,provider_email,proof_method,approved_by)
            VALUES('google',$1,$2,$3,$4,$5,$6)`,[proof.issuer,proof.sub,userId,proof.email,method,actorId]); }
        catch(error) { if(error.code==='23505') throw fail('PROVIDER_ALREADY_LINKED',409); throw error; }
        await auth.audit('google_linked',userId,actorId||userId,{method,provider:'google',issuer:proof.issuer,subjectDigest:digest(proof.sub)},db);
    }
    async function login(proof) {
        const linked=await mapping(proof);
        if(!linked) return {needsLink:true,...await pending(proof)};
        return auth.transaction(async db=>{
            const user=await auth.userState(linked.user_id,db,true);
            await db.query('UPDATE users SET login_count=COALESCE(login_count,0)+1,last_login=now() WHERE id=$1',[user.id]);
            return {user,token:await auth.issue(user.id,'google',db)};
        });
    }
    async function register(proof,{username}) {
        if(await mapping(proof)) throw fail('GOOGLE_ALREADY_REGISTERED_USE_LOGIN',409);
        if(typeof username!=='string'||!username.trim()||username.length>50) throw fail('USERNAME_REQUIRED',400);
        const collision=await auth.pool.query(`SELECT id FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($1)
            OR lower(username)=lower($2) OR lower(email)=lower($2)`,[proof.email,username.trim()]);
        if(collision.rowCount) return {needsLink:true,...await pending(proof)};
        const password=await hashPassword(crypto.randomBytes(32).toString('base64url'));
        return auth.transaction(async db=>{
            let user;
            try { user=(await db.query(`INSERT INTO users(username,email,password,system_role,is_active)
                VALUES($1,$2,$3,'employee',true) RETURNING *`,[username.trim(),proof.email,password])).rows[0]; }
            catch(error) { if(error.code==='23505') throw fail('IDENTITY_COLLISION_LINK_REQUIRED',409); throw error; }
            await db.query('UPDATE bcl_auth_state SET local_password_enabled=false WHERE user_id=$1',[user.id]);
            await insertMapping(proof,user.id,'registration',db);
            return {user,token:await auth.issue(user.id,'google',db),createdUser:true};
        });
    }
    async function pendingRequest(ticket,db) {
        if(typeof ticket!=='string'||ticket.length>128) throw fail('LINK_REQUEST_INVALID');
        const request=(await db.query('SELECT * FROM bcl_google_link_requests WHERE secret_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[digest(ticket)])).rows[0];
        if(!request) throw fail('LINK_REQUEST_EXPIRED');
        return request;
    }
    async function linkWithPassword(ticket,identifier,password,expectedUserId=null) {
        return auth.transaction(async db=>{
            const request=await pendingRequest(ticket,db);
            const user=await auth.localProof(identifier,password,db);
            if(expectedUserId&&String(user.id)!==String(expectedUserId)) throw fail('ACCOUNT_MISMATCH',403);
            await insertMapping({issuer:request.issuer,sub:request.subject,email:request.provider_email},user.id,'local_reauthentication',db);
            await db.query('UPDATE bcl_google_link_requests SET used_at=now() WHERE id=$1',[request.id]);
            await auth.revokeUser(user.id,db);
            return {user,token:await auth.issue(user.id,'pwd',db)};
        });
    }
    async function approve({adminId,password,requestId,userId,method,reason}) {
        if(!['in_person','organization_identity_check'].includes(method)||typeof reason!=='string'||reason.trim().length<20||reason.length>500||!UUID_PATTERN.test(requestId||'')) throw fail('MANUAL_OWNERSHIP_VERIFICATION_REQUIRED',400);
        return auth.transaction(async db=>{
            const request=await db.query('SELECT id FROM bcl_google_link_requests WHERE id=$1 AND used_at IS NULL AND expires_at>now() AND approved_by IS NULL FOR UPDATE',[requestId]);
            if(request.rowCount!==1) throw fail('LINK_REQUEST_NOT_APPROVABLE',409);
            for(const id of [...new Set([adminId,userId].map(String))].sort((a,b)=>Number(a)-Number(b))) await auth.userState(id,db,true);
            const admin=await auth.userState(adminId,db);
            if(admin.system_role!=='system_admin'||!admin.local_password_enabled||!await verifyPassword(password,admin.password)) throw fail('ADMIN_REAUTHENTICATION_REQUIRED',403);
            const target=await auth.userState(userId,db);
            const approved=await db.query(`UPDATE bcl_google_link_requests SET approved_user_id=$2,approved_by=$3,
                approver_version=$4,target_version=$5,verification_method=$6,approval_reason=$7
                WHERE id=$1 AND used_at IS NULL AND expires_at>now() AND approved_by IS NULL RETURNING id`,[requestId,target.id,admin.id,admin.auth_version,target.auth_version,method,reason.trim()]);
            if(approved.rowCount!==1) throw fail('LINK_REQUEST_NOT_APPROVABLE',409);
            await auth.audit('google_link_approved',target.id,admin.id,{requestId,method,reason:reason.trim()},db);
        });
    }
    async function completeApproval(ticket) {
        return auth.transaction(async db=>{
            const request=await pendingRequest(ticket,db);
            if(!request.approved_user_id) throw fail('LINK_APPROVAL_REQUIRED',409);
            for(const id of [...new Set([request.approved_by,request.approved_user_id])].sort((a,b)=>a-b)) await auth.userState(id,db,true);
            const admin=await auth.userState(request.approved_by,db);
            if(admin.system_role!=='system_admin'||admin.auth_version!==request.approver_version) throw fail('LINK_APPROVAL_REVOKED',403);
            const user=await auth.userState(request.approved_user_id,db);
            if(user.auth_version!==request.target_version) throw fail('LINK_APPROVAL_REVOKED',403);
            await insertMapping({issuer:request.issuer,sub:request.subject,email:request.provider_email},user.id,'admin_approved',db,admin.id);
            await db.query('UPDATE bcl_google_link_requests SET used_at=now() WHERE id=$1',[request.id]);
            await auth.revokeUser(user.id,db);
            return {user,token:await auth.issue(user.id,'google',db)};
        });
    }
    async function setPassword(proof,userId,password) {
        const linked=await mapping(proof);
        if(!linked||String(linked.user_id)!==String(userId)) throw fail('LINKED_GOOGLE_PROOF_REQUIRED',403);
        const hashed=await hashPassword(password);
        return auth.transaction(async db=>{
            await auth.userState(userId,db,true);
            await db.query('UPDATE users SET password=$1 WHERE id=$2',[hashed,userId]);
            await auth.audit('local_password_set_with_google',userId,userId,{},db);
            return auth.issue(userId,'google',db);
        });
    }
    return {challenge,verifyProof,mapping,pending,login,register,linkWithPassword,approve,completeApproval,setPassword};
}
module.exports={createGoogleIdentityService,ISSUER};
