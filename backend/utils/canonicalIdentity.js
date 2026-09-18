// public.users.id is the sole canonical identity. No inference from profile attributes.
function canonicalUserId(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value);
    if (!/^[1-9]\d*$/.test(text)) return null;
    const number = Number(text);
    return Number.isSafeInteger(number) && number <= 2147483647 ? text : null;
}

function authenticatedUserId(user = {}) {
    const values = [user.userId, user.id, user.sub].filter(value => value != null);
    if (!values.length) return null;
    const ids = values.map(canonicalUserId);
    return ids.every(id => id && id === ids[0]) ? ids[0] : null;
}

function identityStoreUnavailable() {
    return Object.assign(new Error('Canonical user storage unavailable; unmapped legacy identity is not authoritative'), {
        code: 'IDENTITY_STORE_UNAVAILABLE', status: 503
    });
}

const PROTECTED_USER_FIELDS = new Set([
    'id', 'userId', 'user_id', 'sub', 'canonicalUserId', 'canonical_user_id',
    'system_role', 'systemRole', 'is_admin', 'isAdmin', 'role', 'roles', 'permissions',
    'metadata', 'provider', 'googleSub', 'google_sub', 'password', 'passwordHash', 'password_hash'
]);

function protectedUserField(payload, { allowPassword = false } = {}) {
    return Object.keys(payload || {}).find(key => PROTECTED_USER_FIELDS.has(key) && !(allowPassword && key === 'password')) || null;
}

module.exports = { canonicalUserId, authenticatedUserId, identityStoreUnavailable, protectedUserField };
