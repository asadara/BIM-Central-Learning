const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey_change_in_production';
const LEGACY_ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'AdminBCL2025!';
const LEGACY_ADMIN_BEARER = process.env.ADMIN_BEARER_SECRET || 'adminbcl-secret';

function isAdminRole(roleValue) {
    const normalizedRole = String(roleValue || '').toLowerCase();
    return normalizedRole.includes('admin') || normalizedRole.includes('administrator');
}

function buildAdminUser(overrides = {}) {
    return {
        id: overrides.id || 'admin',
        username: overrides.username || 'admin',
        email: overrides.email || 'admin@bcl.local',
        role: overrides.role || 'System Administrator',
        isAdmin: true
    };
}

function getRequestUser(req) {
    if (req.session && req.session.adminUser && req.session.adminUser.isAdmin) {
        return buildAdminUser({
            id: req.session.adminUser.id,
            username: req.session.adminUser.username,
            email: req.session.adminUser.email,
            role: req.session.adminUser.role || 'System Administrator'
        });
    }

    const adminTokenHeader = String(req.headers['x-admin-token'] || '');
    if (adminTokenHeader && adminTokenHeader === LEGACY_ADMIN_TOKEN) {
        return buildAdminUser({
            id: 'legacy-admin-token',
            username: 'legacy_admin_token'
        });
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
        return null;
    }

    if (token === LEGACY_ADMIN_BEARER) {
        return buildAdminUser({
            id: 'legacy-admin-bearer',
            username: 'legacy_admin_bearer'
        });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const role = decoded.role || decoded.jobRole || '';
        return {
            id: decoded.userId || decoded.id || decoded.sub || decoded.email || '',
            username: decoded.username || decoded.name || decoded.email || 'user',
            email: decoded.email || '',
            role,
            isAdmin: decoded.isAdmin === true || isAdminRole(role)
        };
    } catch (error) {
        return null;
    }
}

function requireAuthenticated(req, res, next) {
    const authUser = getRequestUser(req);
    if (!authUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUser = authUser;
    req.user = authUser;
    next();
}

function requireAdmin(req, res, next) {
    const authUser = getRequestUser(req);
    if (!authUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (!authUser.isAdmin) {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    req.authUser = authUser;
    req.user = authUser;
    next();
}

module.exports = {
    isAdminRole,
    getRequestUser,
    requireAuthenticated,
    requireAdmin
};
