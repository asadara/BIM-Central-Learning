const crypto = require('crypto');
const path = require('path');
const { getJwtSecret } = require('../config/runtimeConfig');

const MAX_SEARCH_DIRECTORY_DEPTH = 4;
const FILE_TICKET_TTL_MS = 15 * 60 * 1000;

const SEARCHABLE_FILE_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.txt', '.rtf', '.rvt', '.rfa', '.dwg', '.dxf',
    '.ifc', '.skp', '.pln', '.tm', '.mp4', '.mov', '.avi', '.webm', '.mkv',
    '.wmv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.xls', '.xlsx',
    '.ppt', '.pptx', '.zip'
]);

const EXCLUDED_SEARCH_DIRECTORIES = new Set([
    'node_modules', '.git', '__pycache__', 'temp', 'tmp', 'incoming data',
    'incoming', 'data', 'backup', 'backups', 'tender', 'clash', 'clash detection',
    'texture image marbel'
]);

const ROOT_POLICIES = new Map([
    ['1. iso 19650', { accessRule: 'dokumenAccess' }],
    ['2. bim planning', { accessRule: 'authenticated' }],
    ['3. prosedur kerja bim nke', { accessRule: 'authenticated' }],
    ['4. regulasi drone dkppu', { accessRule: 'authenticated' }],
    ['4d id formulas', { accessRule: 'authenticated' }],
    ['5. remote pilot spukta', { accessRule: 'authenticated' }],
    ['6. manual books', { accessRule: 'dokumenAccess' }],
    ['7. audio visual learning', { accessRule: 'authenticated' }],
    ['8. knowledge asset', { accessRule: 'authenticated' }],
    ['9. lesson learn', { accessRule: 'authenticated' }],
    ['10. assessment', { accessRule: 'deny', searchable: false, openable: false }],
    ['11. training revit', { accessRule: 'authenticated' }],
    ['12. others', { accessRule: 'deny', searchable: false, openable: false }],
    ['13. rekaman training inhouse divisi bim', { accessRule: 'authenticated' }],
    ['14. bim internship', { accessRule: 'deny', searchable: false, openable: false }],
    ['bahan pembelajaran', { accessRule: 'authenticated' }],
    ['bim guidance & manual books', { accessRule: 'dokumenAccess' }],
    ['bim implementation documents', { accessRule: 'projectDocumentAccess' }],
    ['bim training & manual books', { accessRule: 'dokumenAccess' }],
    ['data', { accessRule: 'deny', searchable: false, openable: false }],
    ['training', { accessRule: 'authenticated' }],
    ['vidio konten youtube', { accessRule: 'authenticated' }]
]);

const FILE_TICKET_SECRET = getJwtSecret();

function safeDecode(value, rounds = 3) {
    let output = String(value || '');
    for (let index = 0; index < rounds; index += 1) {
        try {
            const decoded = decodeURIComponent(output);
            if (decoded === output) break;
            output = decoded;
        } catch (error) {
            break;
        }
    }
    return output;
}

function normalizeSearchRelativePath(value, baseDir = '') {
    let decoded = safeDecode(value).replace(/\\/g, '/').trim();
    if (!decoded || decoded.includes('\0')) return null;

    decoded = decoded
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/?api\/file\?path=/i, '')
        .replace(/^\/?files\//i, '')
        .replace(/^\/?videos\//i, '')
        .replace(/^\/+/, '');
    decoded = safeDecode(decoded).replace(/\\/g, '/').trim();
    if (!decoded) return null;

    if (baseDir) {
        const resolvedBase = path.resolve(baseDir);
        const isAbsoluteWindowsPath = /^[a-zA-Z]:\//.test(decoded);
        const resolvedTarget = isAbsoluteWindowsPath
            ? path.resolve(decoded)
            : path.resolve(resolvedBase, decoded);
        const relative = path.relative(resolvedBase, resolvedTarget);
        if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
            return null;
        }
        decoded = relative.replace(/\\/g, '/');
    }

    const segments = decoded.split('/').filter(Boolean);
    if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) return null;
    return segments.join('/');
}

function isTemporaryOrHiddenPath(segments, isDirectory) {
    if (segments.some((segment) => segment.startsWith('.') || segment.startsWith('~$'))) return true;
    if (isDirectory) return false;
    const filename = segments[segments.length - 1] || '';
    const normalizedFilename = filename.toLowerCase();
    return ['.tmp', '.temp', '.bak', '.backup', '.old', '.orig', '.swp']
        .some((suffix) => normalizedFilename.endsWith(suffix)) || normalizedFilename.endsWith('~');
}

function classifySearchContentPath(value, options = {}) {
    const isDirectory = options.isDirectory === true;
    const relativePath = normalizeSearchRelativePath(value, options.baseDir || '');
    if (!relativePath) {
        return { relativePath: null, accessRule: 'deny', searchable: false, openable: false, reason: 'invalid_path' };
    }

    const segments = relativePath.split('/');
    const normalizedSegments = segments.map((segment) => segment.trim().toLowerCase());
    const rootPolicy = ROOT_POLICIES.get(normalizedSegments[0]);

    if (!rootPolicy) {
        return { relativePath, accessRule: 'deny', searchable: false, openable: false, reason: 'outside_allowlist' };
    }
    if (normalizedSegments.some((segment) => EXCLUDED_SEARCH_DIRECTORIES.has(segment))) {
        return { relativePath, accessRule: 'deny', searchable: false, openable: false, reason: 'excluded_directory' };
    }
    if (isTemporaryOrHiddenPath(segments, isDirectory)) {
        return { relativePath, accessRule: 'deny', searchable: false, openable: false, reason: 'temporary_or_hidden' };
    }
    if (rootPolicy.openable === false) {
        return { relativePath, accessRule: 'deny', searchable: false, openable: false, reason: 'no_index_root' };
    }

    let accessRule = rootPolicy.accessRule;
    if (normalizedSegments[0] === '1. iso 19650' && normalizedSegments.slice(1).some((segment) => segment.includes('audit'))) {
        accessRule = 'audit2026Access';
    } else if (
        normalizedSegments[0] === 'bahan pembelajaran'
        && normalizedSegments.slice(1).some((segment) => segment.includes('manual book'))
    ) {
        accessRule = 'dokumenAccess';
    }

    const directoryDepth = isDirectory ? segments.length : Math.max(0, segments.length - 1);
    const withinSearchDepth = directoryDepth <= MAX_SEARCH_DIRECTORY_DEPTH;
    const extensionAllowed = isDirectory || SEARCHABLE_FILE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());

    return {
        relativePath,
        root: segments[0],
        accessRule,
        searchable: rootPolicy.searchable !== false && withinSearchDepth && extensionAllowed,
        openable: rootPolicy.openable !== false && extensionAllowed,
        reason: !withinSearchDepth ? 'max_depth_exceeded' : (!extensionAllowed ? 'extension_not_allowed' : 'allowed')
    };
}

function canAccessSearchContent(accessRule, authUser, accessProfile = {}) {
    if (accessRule === 'deny') return false;
    if (authUser && authUser.isAdmin) return true;
    if (accessRule === 'public') return true;
    if (accessRule === 'authenticated') return Boolean(authUser);
    if (!authUser) return false;
    return Boolean(accessProfile[accessRule]);
}

function signTicketPayload(encodedPayload) {
    return crypto
        .createHmac('sha256', `${FILE_TICKET_SECRET}:search-file-ticket`)
        .update(encodedPayload)
        .digest('base64url');
}

function createSearchFileTicket(relativePath, authUser, ttlMs = FILE_TICKET_TTL_MS) {
    const normalizedPath = normalizeSearchRelativePath(relativePath);
    const sub = require('./canonicalIdentity').authenticatedUserId(authUser || {});
    if (!normalizedPath || !sub || !authUser.sid || !Number.isInteger(authUser.sv) ||
        !['jwt','admin'].includes(authUser.sessionType) || !Number.isFinite(authUser.exp)) return '';
    const payload = Buffer.from(JSON.stringify({
        v: 2,
        p: normalizedPath,
        sub, sid:authUser.sid, sv:authUser.sv, kind:authUser.sessionType,
        exp: Math.min(authUser.exp*1000, Date.now() + Math.min(FILE_TICKET_TTL_MS, Math.max(60_000, Number(ttlMs) || FILE_TICKET_TTL_MS)))
    })).toString('base64url');
    return `${payload}.${signTicketPayload(payload)}`;
}

function verifySearchFileTicket(ticket, expectedRelativePath) {
    const [payload, signature] = String(ticket || '').split('.');
    if (!payload || !signature) return null;
    const expectedSignature = signTicketPayload(payload);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        const normalizedExpected = normalizeSearchRelativePath(expectedRelativePath);
        if (decoded.v !== 2 || !decoded.p || decoded.p !== normalizedExpected || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now() ||
            !require('./canonicalIdentity').canonicalUserId(decoded.sub) || !decoded.sid || !Number.isInteger(decoded.sv) || !['jwt','admin'].includes(decoded.kind)) return null;
        return decoded;
    } catch (error) {
        return null;
    }
}

function buildSearchFileUrl(relativePath, authUser) {
    const normalizedPath = normalizeSearchRelativePath(relativePath);
    const ticket = createSearchFileTicket(normalizedPath, authUser);
    if (!normalizedPath || !ticket) return '#';
    return `/api/file?path=${encodeURIComponent(normalizedPath)}&ticket=${encodeURIComponent(ticket)}`;
}

module.exports = {
    EXCLUDED_SEARCH_DIRECTORIES,
    FILE_TICKET_TTL_MS,
    MAX_SEARCH_DIRECTORY_DEPTH,
    ROOT_POLICIES,
    SEARCHABLE_FILE_EXTENSIONS,
    buildSearchFileUrl,
    canAccessSearchContent,
    classifySearchContentPath,
    createSearchFileTicket,
    normalizeSearchRelativePath,
    verifySearchFileTicket
};
