const bcrypt = require('bcrypt');

// Passwords are opaque: never trim or normalize them. Existing hashes remain valid.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt must not silently truncate a new credential.
const PASSWORD_COST = 10;

function passwordValidationError(password) {
    if (typeof password !== 'string') return 'Password must be a string';
    if (password.length < PASSWORD_MIN_LENGTH) return 'Password must be at least 8 characters long';
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return 'Password must not exceed 72 UTF-8 bytes';
    return null;
}

function isPasswordHash(value) {
    return typeof value === 'string' && /^\$2[ab]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(value);
}

async function hashPassword(password) {
    const message = passwordValidationError(password);
    if (message) throw Object.assign(new Error(message), { code: 'PASSWORD_POLICY', status: 400 });
    return bcrypt.hash(password, PASSWORD_COST);
}

async function verifyPassword(password, hash) {
    if (typeof password !== 'string' || !isPasswordHash(hash)) return false;
    // Do not apply the new-password policy to existing credentials.
    return bcrypt.compare(password, hash);
}

module.exports = { passwordValidationError, isPasswordHash, hashPassword, verifyPassword };
