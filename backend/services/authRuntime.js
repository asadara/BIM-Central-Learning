const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { canonicalUserId } = require('../utils/canonicalIdentity');
const { verifyPassword, hashPassword } = require('../utils/credentials');
const ISSUER = 'bcl-internal';
const AUDIENCE = 'bcl-internal-api';
const TOKEN_SECONDS = 3600;
const ADMIN_ABSOLUTE_MS = 8 * 3600 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail = (code, status = 401) => Object.assign(new Error(code), { code, status });
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');

function createAuthRuntime({ pool, secret, publicOrigin = 'https://bcl.nke.net' }) {
    const trustedOrigin = new URL(publicOrigin).origin;
    async function transaction(fn) {
        const client = await pool.connect();
        try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
        catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
    }
    async function userState(id, db = pool, lock = false) {
        if (!canonicalUserId(id)) throw fail('CANONICAL_ID_REQUIRED');
        const result = await db.query(`SELECT u.*,a.version AS auth_version,a.local_password_enabled
            FROM users u JOIN bcl_auth_state a ON a.user_id=u.id WHERE u.id=$1 ${lock ? 'FOR UPDATE OF u,a' : ''}`, [id]);
        const user = result.rows[0];
        if (!user || user.is_active !== true) throw fail('USER_INACTIVE_OR_MISSING');
        return user;
    }
    async function localProof(identifier, password, db = pool) {
        if (typeof identifier !== 'string' || typeof password !== 'string') throw fail('INVALID_CREDENTIALS');
        const found = await db.query('SELECT id FROM users WHERE lower(email)=lower($1) OR lower(username)=lower($1)', [identifier.trim()]);
        if (found.rows.length !== 1) throw fail('INVALID_CREDENTIALS');
        const user = await userState(found.rows[0].id, db, db !== pool);
        if (!user.local_password_enabled || !await verifyPassword(password, user.password)) throw fail('INVALID_CREDENTIALS');
        return user;
    }
    async function audit(event, userId, actorId = null, details = {}, db = pool) {
        await db.query('INSERT INTO bcl_auth_events(event,user_id,actor_id,details) VALUES($1,$2,$3,$4)', [event, userId, actorId, JSON.stringify(details)]);
    }
    async function issue(userId, method, db = pool) {
        const user = await userState(userId, db);
        const sid = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);
        await db.query(`INSERT INTO bcl_auth_sessions(sid,user_id,auth_version,method,expires_at)
            VALUES($1,$2,$3,$4,to_timestamp($5))`, [sid,user.id,user.auth_version,method,now+TOKEN_SECONDS]);
        return sign(user, { sid, method, issued: now, expires: now+TOKEN_SECONDS, version: user.auth_version });
    }
    function sign(user, session) {
        const sub = String(user.id);
        return jwt.sign({ sub, userId: sub, sid: session.sid, sv: session.version,
            role: user.system_role, email: user.email, amr: [session.method], auth_time: session.issued,
            iat: session.issued, exp: session.expires }, secret, { algorithm:'HS256', issuer:ISSUER, audience:AUDIENCE });
    }
    async function verify(token) {
        let claims;
        try { claims=jwt.verify(token,secret,{algorithms:['HS256'],issuer:ISSUER,audience:AUDIENCE}); }
        catch { throw fail('TOKEN_INVALID_OR_EXPIRED'); }
        if (typeof claims.sub !== 'string' || canonicalUserId(claims.sub)!==claims.sub || claims.userId!==claims.sub ||
            !UUID_PATTERN.test(claims.sid || '') || !Number.isInteger(claims.sv) || !Number.isInteger(claims.exp) ||
            !Number.isInteger(claims.auth_time) || claims.iat!==claims.auth_time || claims.exp-claims.iat!==TOKEN_SECONDS ||
            claims.iat>Math.floor(Date.now()/1000)+60 || !Array.isArray(claims.amr) || claims.amr.length!==1) throw fail('TOKEN_CONTRACT_INVALID');
        const result = await pool.query(`SELECT u.id,u.username,u.email,u.system_role,a.version,s.method,s.created_at,s.expires_at
            FROM bcl_auth_sessions s JOIN users u ON u.id=s.user_id JOIN bcl_auth_state a ON a.user_id=u.id
            WHERE s.sid=$1 AND s.user_id=$2 AND s.auth_version=$3 AND a.version=$3
              AND u.is_active=true AND s.revoked_at IS NULL AND s.expires_at>now()`, [claims.sid,claims.sub,claims.sv]);
        const user = result.rows[0];
        if (!user || claims.amr[0]!==user.method || claims.role!==user.system_role) throw fail('SESSION_REVOKED');
        return { ...claims, id:String(user.id), userId:String(user.id), sub:String(user.id), username:user.username,
            email:user.email, role:user.system_role, systemRole:user.system_role, isAdmin:user.system_role==='system_admin', sessionType:'jwt' };
    }
    async function verifyFileAccess(ticket) {
        // The caller first verifies the scoped ticket signature/path/expiry. Revalidate its authority here.
        const user=await userState(ticket.sub);
        if(user.auth_version!==ticket.sv) throw fail('SESSION_REVOKED');
        if(ticket.kind==='jwt') {
            if(!UUID_PATTERN.test(ticket.sid||'')) throw fail('SESSION_REVOKED');
            const active=await pool.query('SELECT sid FROM bcl_auth_sessions WHERE sid=$1 AND user_id=$2 AND auth_version=$3 AND revoked_at IS NULL AND expires_at>now()', [ticket.sid,user.id,ticket.sv]);
            if(active.rowCount!==1) throw fail('SESSION_REVOKED');
        } else if(ticket.kind==='admin') {
            const row=(await pool.query('SELECT sess FROM bcl_admin_sessions WHERE sid=$1 AND expires_at>now()',[ticket.sid])).rows[0];
            const admin=row?.sess?.adminUser;
            if(!admin||String(admin.id)!==String(user.id)||admin.authVersion!==ticket.sv||user.system_role!=='system_admin'||
                admin.systemRole!=='system_admin'||!Number.isFinite(admin.authTime)||Date.now()-admin.authTime>=ADMIN_ABSOLUTE_MS) throw fail('SESSION_REVOKED');
        } else throw fail('SESSION_REVOKED');
        return {id:String(user.id),userId:String(user.id),sub:String(user.id),username:user.username,email:user.email,
            role:user.system_role,systemRole:user.system_role,isAdmin:user.system_role==='system_admin'};
    }
    async function reissue(principal) {
        // Profile attribute changes cannot extend the original authenticated session.
        const user=await userState(principal.sub);
        if(user.auth_version!==principal.sv) throw fail('SESSION_REVOKED');
        return sign(user,{sid:principal.sid,method:principal.amr[0],issued:principal.auth_time,expires:principal.exp,version:principal.sv});
    }
    async function revokeUser(id, db=pool) {
        await db.query('UPDATE bcl_auth_state SET version=version+1 WHERE user_id=$1',[id]);
        await db.query('UPDATE bcl_auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1',[id]);
    }
    async function changePassword(id, currentPassword, newPassword, issueNew = true) {
        const hashed=await hashPassword(newPassword);
        return transaction(async db=>{
            const user=await userState(id,db,true);
            if(!user.local_password_enabled || !await verifyPassword(currentPassword,user.password)) throw fail('INVALID_CURRENT_PASSWORD');
            await db.query('UPDATE users SET password=$1 WHERE id=$2',[hashed,id]);
            await audit('password_changed',id,id,{},db);
            return issueNew ? issue(id,'pwd',db) : null;
        });
    }
    function originAllowed(req) {
        return !req.headers.origin || req.headers.origin===trustedOrigin;
    }
    async function middleware(req,res,next) {
        req.authChecked=true; req.authPrincipal=null; req.adminPrincipal=null;
        const authorization=req.headers.authorization;
        try {
            // An explicit invalid Bearer never borrows a more privileged ambient cookie.
            if(authorization!==undefined) {
                if(!/^Bearer [^\s]+$/.test(authorization)) throw fail('TOKEN_INVALID');
                req.authPrincipal=await verify(authorization.slice(7));
            } else if(req.session?.adminUser) {
                const stored=req.session.adminUser;
                try {
                    const user=await userState(stored.id);
                    if(user.system_role!=='system_admin' || stored.systemRole!=='system_admin' ||
                        stored.authVersion!==user.auth_version || !Number.isFinite(stored.authTime) ||
                        Date.now()-stored.authTime>=ADMIN_ABSOLUTE_MS) throw fail('ADMIN_SESSION_EXPIRED');
                    req.adminPrincipal={id:String(user.id),userId:String(user.id),sub:String(user.id),username:user.username,
                        email:user.email,role:'system_admin',systemRole:'system_admin',isAdmin:true,
                        sessionType:'admin',sid:req.sessionID,sv:stored.authVersion,
                        exp:Math.floor(Math.min(Date.now()+30*60*1000,stored.authTime+ADMIN_ABSOLUTE_MS)/1000)};
                    if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin!==trustedOrigin) throw fail('CSRF_ORIGIN_REQUIRED',403);
                } catch(error) {
                    if(error.status===401) { delete req.session.adminUser; req.adminPrincipal=null; }
                    throw error;
                }
            }
            req.user=req.authPrincipal||req.adminPrincipal||undefined;
            return next();
        } catch(error) {
            req.authFailure=error.status||503;
            // Public pages/login remain available after old credentials expire. APIs fail closed.
            if(req.path.startsWith('/api/') && (error.status===403 || !['/api/login','/api/admin/login','/api/admin/logout','/api/auth/logout'].includes(req.path))) {
                return res.status(error.status||503).json({success:false,code:error.status?error.code:'AUTH_STORAGE_UNAVAILABLE',error:'Authentication must be renewed'});
            }
            return next();
        }
    }
    return {pool,trustedOrigin,transaction,userState,localProof,audit,issue,verify,verifyFileAccess,reissue,revokeUser,changePassword,originAllowed,middleware,fail,digest};
}
module.exports={createAuthRuntime,ISSUER,AUDIENCE,TOKEN_SECONDS,ADMIN_ABSOLUTE_MS,UUID_PATTERN,fail,digest};
