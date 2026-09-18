// Only runtime middleware can validate a principal; signed tokens may be revoked.
function isAdminRole(value) { return value === 'system_admin'; }
function getBearerRequestUser(req) {
    return req.authChecked === true && req.headers.authorization !== undefined ? req.authPrincipal || null : null;
}
function getRequestUser(req) {
    if(req.authChecked !== true) return null;
    return req.headers.authorization !== undefined ? req.authPrincipal || null : req.adminPrincipal || null;
}
const getRequestUserPreferBearer = getRequestUser;
function requireAuthenticated(req,res,next) {
    const user=getRequestUser(req);
    if(!user) return res.status(req.authFailure||401).json({error:'Authentication required'});
    req.authUser=user; req.user=user; return next();
}
function requireAdmin(req,res,next) {
    return requireAuthenticated(req,res,()=>{
        if(!req.authUser.isAdmin) return res.status(403).json({error:'Admin privileges required'});
        return next();
    });
}
module.exports={isAdminRole,getBearerRequestUser,getRequestUser,getRequestUserPreferBearer,
    requireAuthenticated,requireAuthenticatedPreferBearer:requireAuthenticated,requireAdmin};
