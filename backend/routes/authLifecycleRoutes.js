const express=require('express');
const {requireAuthenticated,requireAdmin}=require('../utils/auth');
const {protectedUserField}=require('../utils/canonicalIdentity');
const {mapUserProfileState}=require('../utils/userProfileSchema');
const {fail}=require('../services/authRuntime');
function authResponse(user,token,createdUser=false) {
    const profile=mapUserProfileState(user);
    return {success:true,id:user.id,name:user.username,username:user.username,email:user.email,token,
        role:profile.positionLabel,positionLabel:profile.positionLabel,positionVerificationStatus:profile.positionVerificationStatus,
        systemRole:profile.systemRole,isAdmin:profile.systemRole==='system_admin',bimLevel:profile.competencyLevel,
        competencyStatus:profile.competencyStatus,targetBimLevel:profile.targetCompetencyLevel,organization:user.organization,
        photo:user.profile_image||'/img/user-default.svg',profileImage:user.profile_image||'/img/user-default.svg',
        storage:'postgresql',createdUser};
}
function createAuthLifecycleRoutes({auth,google,limiter,challengeLimiter=limiter}) {
    const router=express.Router();
    const run=fn=>async(req,res)=>{
        try {
            if(!auth.originAllowed(req)) throw fail('UNTRUSTED_ORIGIN',403);
            await fn(req,res);
        } catch(error) {
            res.status(error.status||503).json({success:false,code:error.status?error.code:'AUTH_STORAGE_UNAVAILABLE',error:error.status?error.message:'Authentication storage unavailable'});
        }
    };
    const send=(res,result)=>result.needsLink ? res.status(409).json({success:false,code:'GOOGLE_LINK_REQUIRED',
        error:'Hubungkan akun Google dengan akun BCL melalui bukti kepemilikan.',requestId:result.requestId,linkTicket:result.linkTicket})
        : res.status(result.createdUser?201:200).json(authResponse(result.user,result.token,!!result.createdUser));
    router.post('/api/login',limiter,run(async(req,res)=>{
        const result=await auth.transaction(async db=>{
            const user=await auth.localProof(req.body.email||req.body.username,req.body.password,db);
            await db.query('UPDATE users SET login_count=COALESCE(login_count,0)+1,last_login=now() WHERE id=$1',[user.id]);
            return {user,token:await auth.issue(user.id,'pwd',db)};
        });
        send(res,result);
    }));
    router.post('/api/auth/google/challenge',challengeLimiter,run(async(req,res)=>{
        const purpose=req.body.purpose;
        res.json({success:true,...await google.challenge(purpose,['link','password'].includes(purpose)?req.authPrincipal?.sub||null:null)});
    }));
    router.post('/api/auth/google',limiter,run(async(req,res)=>{
        const protectedField=protectedUserField(req.body);
        if(protectedField) throw fail('PROTECTED_USER_FIELD',400);
        const action=req.body.action==='signup'?'register':req.body.action;
        if(!['login','register'].includes(action)) throw fail('EXPLICIT_GOOGLE_ACTION_REQUIRED',400);
        const proof=await google.verifyProof(req.body.idToken,req.body.challengeId,action);
        send(res,action==='login'?await google.login(proof):await google.register(proof,{username:req.body.username}));
    }));
    router.post('/api/auth/google/link',limiter,run(async(req,res)=>{
        send(res,await google.linkWithPassword(req.body.linkTicket,req.body.identifier,req.body.password,req.authPrincipal?.sub));
    }));
    router.post('/api/auth/google/link-proof',limiter,requireAuthenticated,run(async(req,res)=>{
        const proof=await google.verifyProof(req.body.idToken,req.body.challengeId,'link',req.authUser.sub);
        res.json({success:true,...await google.pending(proof)});
    }));
    router.post('/api/auth/google/complete-link',limiter,run(async(req,res)=>send(res,await google.completeApproval(req.body.linkTicket))));
    router.get('/api/admin/auth/google-link-requests',requireAdmin,run(async(req,res)=>{
        const rows=await auth.pool.query(`SELECT id,provider_email,expires_at,approved_user_id,verification_method
            FROM bcl_google_link_requests WHERE used_at IS NULL AND expires_at>now() ORDER BY expires_at DESC LIMIT 100`);
        res.json({success:true,requests:rows.rows});
    }));
    router.post('/api/admin/auth/google-link-requests/:id/approve',limiter,requireAdmin,run(async(req,res)=>{
        await google.approve({adminId:req.authUser.id,password:req.body.currentPassword,requestId:req.params.id,
            userId:req.body.userId,method:req.body.verificationMethod,reason:req.body.reason});
        res.json({success:true,message:'Approval recorded. The Google account holder must complete the request.'});
    }));
    router.delete('/api/auth/providers/google',requireAuthenticated,run(async()=>{
        throw fail('UNLINK_NOT_ENABLED',409); // Explicitly disabled until recovery/last-credential policy is approved.
    }));
    router.get('/api/auth/providers',requireAuthenticated,run(async(req,res)=>{
        const user=await auth.userState(req.authUser.id);
        const providers=await auth.pool.query('SELECT provider,issuer,linked_at,proof_method FROM bcl_provider_identities WHERE user_id=$1',[user.id]);
        res.json({success:true,id:user.id,localPasswordEnabled:user.local_password_enabled,providers:providers.rows});
    }));
    router.post('/api/auth/password',limiter,requireAuthenticated,run(async(req,res)=>{
        let token;
        if(req.body.proof==='google') {
            const proof=await google.verifyProof(req.body.idToken,req.body.challengeId,'password',req.authUser.sub);
            token=await google.setPassword(proof,req.authUser.sub,req.body.newPassword);
        } else if(req.body.proof==='local') {
            token=await auth.changePassword(req.authUser.sub,req.body.currentPassword,req.body.newPassword);
        } else throw fail('PASSWORD_PROOF_REQUIRED',400);
        res.json({success:true,token,id:Number(req.authUser.sub),reauthenticated:true});
    }));
    router.post('/api/auth/logout',run(async(req,res)=>{
        if(req.authFailure===503) throw fail('AUTH_STORAGE_UNAVAILABLE',503);
        if(req.authPrincipal) {
            await auth.pool.query('UPDATE bcl_auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE sid=$1 AND user_id=$2',[req.authPrincipal.sid,req.authPrincipal.sub]);
            await auth.audit('logout',req.authPrincipal.sub,req.authPrincipal.sub);
        }
        res.json({success:true});
    }));
    router.post('/api/auth/logout-all',requireAuthenticated,run(async(req,res)=>{
        await auth.revokeUser(req.authUser.id); await auth.audit('logout_all',req.authUser.id,req.authUser.id);
        res.json({success:true});
    }));
    return router;
}
module.exports={createAuthLifecycleRoutes,authResponse};
