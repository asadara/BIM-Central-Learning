const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const LANMountManager = require('../utils/lanMountManager');
const { requireAdmin } = require('../utils/auth');
let sharp = null;
try {
    sharp = require('sharp');
} catch (error) {
    sharp = null;
}

const router = express.Router();

const METHODE_FOLDER_NAME = '20. METHODE ESTIMATE & TENDER';
const LOCAL_PCBIM02_ROOT = path.resolve(__dirname, '..', '..', 'PC-BIM02');
const NETWORK_PCBIM02_ROOT = '\\\\pc-bim02\\PROJECT BIM 2025';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv']);
const DOCUMENT_EXTS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']);
const MODEL_EXTS = new Set(['.dwg', '.dxf', '.rvt', '.rfa', '.skp', '.fbx', '.tm']);
const DOCUMENT_TYPES = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);
const MODEL_TYPES = new Set(['dwg', 'dxf', 'rvt', 'rfa', 'skp', 'fbx', 'tm']);

const CACHE_TTL_MS = 30 * 60 * 1000;
const THUMB_CACHE_DIR = path.resolve(__dirname, '..', 'public', 'cache', 'bim-methode-thumbnails');
const THUMB_STABLE_CACHE_DIR = path.resolve(__dirname, '..', 'public', 'cache', 'bim-methode-thumbnails-stable');
const FILE_CACHE_DIR = path.resolve(__dirname, '..', 'public', 'cache', 'bim-methode-files');
const THUMB_DEFAULT_WIDTH = 480;
const THUMB_MIN_WIDTH = 120;
const THUMB_MAX_WIDTH = 1280;
const THUMB_DEFAULT_QUALITY = 65;
const THUMB_MIN_QUALITY = 40;
const THUMB_MAX_QUALITY = 90;
const FILE_ACCESS_TIMEOUT_MS = Number(process.env.BIM_METHODE_FILE_TIMEOUT_MS) || 12000;
const FILE_CACHE_MAX_BYTES = Number(process.env.BIM_METHODE_FILE_CACHE_MAX_BYTES) || (120 * 1024 * 1024);
const CACHEABLE_FILE_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS, '.pdf']);
const bimMethodeCache = {
    lastUpdated: 0,
    root: null,
    categories: [],
    mediaByCategory: new Map(),
    allMedia: []
};

let refreshInProgress = false;
let refreshPromise = null;
let lastRefreshError = null;
let lastRefreshStart = 0;

try {
    fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true });
    fs.mkdirSync(THUMB_STABLE_CACHE_DIR, { recursive: true });
    fs.mkdirSync(FILE_CACHE_DIR, { recursive: true });
} catch (error) {
    // Keep thumbnail generation functional without cache directory
}

function normalizePathValue(value) {
    if (!value) return '';
    if (value.startsWith('\\\\')) return value.toLowerCase();
    return path.resolve(value).toLowerCase();
}

function getPcbim02Candidates() {
    const candidates = [];

    if (process.env.PCBIM02_ROOT) {
        candidates.push(process.env.PCBIM02_ROOT);
    }

    // Prefer the local synchronized workspace first. It is the most stable
    // source and avoids selecting an empty cache mirror when the live share
    // is still available.
    candidates.push(LOCAL_PCBIM02_ROOT);

    try {
        const lanManager = new LANMountManager();
        const mount = lanManager.getMountById('pc-bim02');
        if (mount) {
            if (mount.localMountPoint) candidates.push(mount.localMountPoint);
            if (mount.remotePath) candidates.push(mount.remotePath);
            if (mount.host && mount.shareName) {
                candidates.push(`\\\\${mount.host}\\${mount.shareName}`);
            }
        }
    } catch (error) {
        // Ignore LAN mount resolution errors; fallback to network path
    }
    candidates.push(NETWORK_PCBIM02_ROOT);

    const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
    const localRootNormalized = normalizePathValue(LOCAL_PCBIM02_ROOT);

    return uniqueCandidates.sort((left, right) => {
        const leftNormalized = normalizePathValue(left);
        const rightNormalized = normalizePathValue(right);
        const leftIsLocal = leftNormalized === localRootNormalized ? 0 : 1;
        const rightIsLocal = rightNormalized === localRootNormalized ? 0 : 1;

        if (leftIsLocal !== rightIsLocal) {
            return leftIsLocal - rightIsLocal;
        }

        const leftIsCacheMirror = /pc-bim02-cache/i.test(String(left));
        const rightIsCacheMirror = /pc-bim02-cache/i.test(String(right));
        if (leftIsCacheMirror !== rightIsCacheMirror) {
            return leftIsCacheMirror ? 1 : -1;
        }

        return 0;
    });
}

function getMethodeRootCandidates(base) {
    if (!base) return [];

    const normalizedBase = String(base).replace(/[\\/]+$/, '');
    const roots = [path.join(normalizedBase, METHODE_FOLDER_NAME)];

    // Support both layouts:
    // 1) <base>/20. METHODE ESTIMATE & TENDER
    // 2) <base>/PROJECT BIM 2025/20. METHODE ESTIMATE & TENDER
    if (!/project bim 2025/i.test(normalizedBase)) {
        roots.push(path.join(normalizedBase, 'PROJECT BIM 2025', METHODE_FOLDER_NAME));
    }

    return [...new Set(roots)];
}

function resolveMethodeRoot() {
    const candidates = getPcbim02Candidates();
    let firstExistingRoot = null;

    for (const base of candidates) {
        const rootCandidates = getMethodeRootCandidates(base);
        for (const root of rootCandidates) {
            try {
                if (fs.existsSync(root)) {
                    if (!firstExistingRoot) {
                        firstExistingRoot = { base, root, exists: true };
                    }

                    const entries = fs.readdirSync(root, { withFileTypes: true });
                    const hasCategoryDirs = entries.some(entry => entry.isDirectory());
                    if (hasCategoryDirs) {
                        return { base, root, exists: true };
                    }
                }
            } catch (error) {
                // Skip inaccessible root
            }
        }
    }

    if (firstExistingRoot) {
        return firstExistingRoot;
    }

    const fallbackBase = candidates[0] || NETWORK_PCBIM02_ROOT;
    const fallbackRootCandidates = getMethodeRootCandidates(fallbackBase);
    return {
        base: fallbackBase,
        root: fallbackRootCandidates[0] || path.join(fallbackBase, METHODE_FOLDER_NAME),
        exists: false
    };
}

async function pathExistsAsync(target) {
    try {
        await fs.promises.access(target, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    }
}

async function resolveMethodeRootAsync() {
    const candidates = getPcbim02Candidates();
    let firstExistingRoot = null;

    for (const base of candidates) {
        const rootCandidates = getMethodeRootCandidates(base);
        for (const root of rootCandidates) {
            try {
                if (await pathExistsAsync(root)) {
                    if (!firstExistingRoot) {
                        firstExistingRoot = { base, root, exists: true };
                    }

                    const entries = await fs.promises.readdir(root, { withFileTypes: true });
                    const hasCategoryDirs = entries.some(entry => entry.isDirectory());
                    if (hasCategoryDirs) {
                        return { base, root, exists: true };
                    }
                }
            } catch (error) {
                // Skip inaccessible root
            }
        }
    }

    if (firstExistingRoot) {
        return firstExistingRoot;
    }

    const fallbackBase = candidates[0] || NETWORK_PCBIM02_ROOT;
    const fallbackRootCandidates = getMethodeRootCandidates(fallbackBase);
    return {
        base: fallbackBase,
        root: fallbackRootCandidates[0] || path.join(fallbackBase, METHODE_FOLDER_NAME),
        exists: false
    };
}

function encodeId(value) {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function decodeId(value) {
    if (!value) return '';
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
}

function isPathAllowed(filePath, allowedRoots) {
    const normalizedFilePath = normalizePathValue(filePath);
    return allowedRoots.some(root => {
        const normalizedRoot = normalizePathValue(root);
        return normalizedRoot && normalizedFilePath.startsWith(normalizedRoot);
    });
}

function getAllowedRoots() {
    const roots = [
        bimMethodeCache.root,
        process.env.PCBIM02_ROOT,
        LOCAL_PCBIM02_ROOT,
        NETWORK_PCBIM02_ROOT
    ];

    try {
        const lanManager = new LANMountManager();
        const mount = lanManager.getMountById('pc-bim02');
        if (mount) {
            if (mount.localMountPoint) roots.push(mount.localMountPoint);
            if (mount.remotePath) roots.push(mount.remotePath);
            if (mount.host && mount.shareName) {
                roots.push(`\\\\${mount.host}\\${mount.shareName}`);
            }
        }
    } catch (error) {
        // Ignore mount lookup errors; static roots still apply
    }

    return [...new Set(roots.filter(Boolean))];
}

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function getThumbnailCachePath(filePath, stats, width, quality) {
    const fingerprint = `${filePath}|${stats.size}|${stats.mtimeMs}|${width}|${quality}`;
    const digest = crypto.createHash('sha1').update(fingerprint).digest('hex');
    return path.join(THUMB_CACHE_DIR, `${digest}.webp`);
}

async function ensureThumbnailFile(filePath, width, quality) {
    const stats = await fs.promises.stat(filePath);
    const cachePath = getThumbnailCachePath(filePath, stats, width, quality);

    if (await pathExistsAsync(cachePath)) {
        return cachePath;
    }

    const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
    await sharp(filePath)
        .rotate()
        .resize({
            width,
            withoutEnlargement: true
        })
        .webp({
            quality,
            effort: 4
        })
        .toFile(tempPath);

    try {
        await fs.promises.rename(tempPath, cachePath);
    } catch (error) {
        if (!(await pathExistsAsync(cachePath))) {
            throw error;
        }
        await fs.promises.unlink(tempPath).catch(() => {});
    }

    return cachePath;
}

function withTimeout(promise, timeoutMs, label) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`${label || 'operation'} timed out after ${timeoutMs}ms`);
            err.code = 'ETIMEDOUT';
            reject(err);
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

async function statFileWithTimeout(filePath, timeoutMs = FILE_ACCESS_TIMEOUT_MS) {
    return withTimeout(fs.promises.stat(filePath), timeoutMs, 'stat');
}

async function statFileWithRetry(filePath) {
    try {
        return await statFileWithTimeout(filePath, FILE_ACCESS_TIMEOUT_MS);
    } catch (error) {
        if (!isTimeoutError(error)) {
            throw error;
        }
        // One longer retry helps when LAN shares are momentarily slow.
        return statFileWithTimeout(filePath, FILE_ACCESS_TIMEOUT_MS * 2);
    }
}

function isTimeoutError(error) {
    if (!error) return false;
    return error.code === 'ETIMEDOUT' || String(error.message || '').toLowerCase().includes('timed out');
}

function getStableThumbnailCachePath(filePath, width, quality) {
    const key = `${normalizePathValue(filePath)}|${width}|${quality}`;
    const digest = crypto.createHash('sha1').update(key).digest('hex');
    return path.join(THUMB_STABLE_CACHE_DIR, `${digest}.webp`);
}

function getStableFileCachePath(filePath) {
    const ext = path.extname(filePath || '').toLowerCase();
    const safeExt = ext && /^[.a-z0-9]+$/.test(ext) ? ext : '.bin';
    const digest = crypto.createHash('sha1').update(normalizePathValue(filePath)).digest('hex');
    return path.join(FILE_CACHE_DIR, `${digest}${safeExt}`);
}

function refreshStableThumbnailCache(sourceThumbPath, stableThumbPath) {
    setImmediate(async () => {
        try {
            const tmpPath = `${stableThumbPath}.${process.pid}.${Date.now()}.tmp`;
            await fs.promises.copyFile(sourceThumbPath, tmpPath);
            await fs.promises.rename(tmpPath, stableThumbPath);
        } catch (error) {
            // Ignore cache update failures.
        }
    });
}

function refreshStableFileCache(sourcePath, sourceStat, stableCachePath) {
    const ext = path.extname(sourcePath || '').toLowerCase();
    if (!CACHEABLE_FILE_EXTS.has(ext)) return;
    if (!sourceStat || typeof sourceStat.size !== 'number' || sourceStat.size <= 0 || sourceStat.size > FILE_CACHE_MAX_BYTES) {
        return;
    }

    setImmediate(async () => {
        try {
            let cacheStat = null;
            try {
                cacheStat = await fs.promises.stat(stableCachePath);
            } catch (error) {
                cacheStat = null;
            }

            const cacheFresh = cacheStat
                && cacheStat.size === sourceStat.size
                && Math.round(cacheStat.mtimeMs) === Math.round(sourceStat.mtimeMs);
            if (cacheFresh) {
                return;
            }

            const tmpPath = `${stableCachePath}.${process.pid}.${Date.now()}.tmp`;
            await fs.promises.copyFile(sourcePath, tmpPath);
            await fs.promises.utimes(tmpPath, sourceStat.atime || new Date(), sourceStat.mtime || new Date());
            await fs.promises.rename(tmpPath, stableCachePath);
        } catch (error) {
            // Ignore cache update failures.
        }
    });
}

function getTypeInfo(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (IMAGE_EXTS.has(ext)) {
        const mimeType = ext === '.png' ? 'image/png'
            : ext === '.gif' ? 'image/gif'
                : ext === '.webp' ? 'image/webp'
                    : 'image/jpeg';
        return { type: 'image', mimeType };
    }

    if (VIDEO_EXTS.has(ext)) {
        const mimeType = ext === '.webm' ? 'video/webm'
            : ext === '.mov' ? 'video/quicktime'
                : ext === '.avi' ? 'video/x-msvideo'
                    : ext === '.mkv' ? 'video/x-matroska'
                        : 'video/mp4';
        return { type: 'video', mimeType };
    }

    if (DOCUMENT_EXTS.has(ext)) {
        const mimeType = ext === '.pdf' ? 'application/pdf'
            : ext === '.ppt' ? 'application/vnd.ms-powerpoint'
                : ext === '.pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                    : ext === '.doc' ? 'application/msword'
                        : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            : 'application/octet-stream';
        return { type: ext.replace('.', ''), mimeType };
    }

    if (MODEL_EXTS.has(ext)) {
        return { type: ext.replace('.', ''), mimeType: 'application/octet-stream' };
    }

    return null;
}

function normalizeMediaTypeFilter(value) {
    const allowed = new Set(['all', 'image', 'video', 'document', 'model']);
    const normalized = String(value || '').toLowerCase();
    return allowed.has(normalized) ? normalized : 'all';
}

function mediaMatchesTypeFilter(mediaItem, typeFilter) {
    if (!typeFilter || typeFilter === 'all') {
        return true;
    }

    const type = String(mediaItem && mediaItem.type ? mediaItem.type : '').toLowerCase();
    if (!type) {
        return false;
    }

    if (typeFilter === 'document') {
        return DOCUMENT_TYPES.has(type);
    }

    if (typeFilter === 'model') {
        return MODEL_TYPES.has(type);
    }

    return type === typeFilter;
}

function parseCategoryName(folderName) {
    const match = folderName.match(/^(\d+)\.\s*(.+)$/);
    if (match) {
        return { id: folderName, number: parseInt(match[1], 10), name: match[2].trim() };
    }
    return { id: folderName, number: 0, name: folderName };
}

async function scanMediaRecursive(dir, categoryId, results, scanState, maxDepth = 6, currentDepth = 0) {
    if (currentDepth > maxDepth) return;

    let items;
    try {
        items = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (error) {
        return;
    }

    for (const item of items) {
        if (scanState) {
            scanState.visited += 1;
            if (scanState.visited % 200 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        if (item.name.startsWith('~') || item.name.startsWith('.')) {
            continue;
        }

        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            await scanMediaRecursive(fullPath, categoryId, results, scanState, maxDepth, currentDepth + 1);
            continue;
        }

        const typeInfo = getTypeInfo(fullPath);
        if (!typeInfo) {
            continue;
        }

        let stats;
        try {
            stats = await fs.promises.stat(fullPath);
        } catch (error) {
            continue;
        }

        results.push({
            id: encodeId(fullPath),
            name: item.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type: typeInfo.type,
            mimeType: typeInfo.mimeType,
            category: categoryId
        });
    }
}

async function refreshCache() {
    const { root, exists } = await resolveMethodeRootAsync();
    if (!exists) {
        const error = new Error(`BIM Methode root not found: ${root}`);
        error.code = 'METHODE_ROOT_NOT_FOUND';
        throw error;
    }

    let categoryEntries = [];
    try {
        const entries = await fs.promises.readdir(root, { withFileTypes: true });
        categoryEntries = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    } catch (error) {
        const err = new Error(`Failed to read BIM Methode categories: ${error.message}`);
        err.code = 'METHODE_READ_FAILED';
        throw err;
    }

    const categories = [];
    const mediaByCategory = new Map();
    const allMedia = [];
    const scanState = { visited: 0 };

    for (const categoryName of categoryEntries) {
        const categoryInfo = parseCategoryName(categoryName);
        const categoryPath = path.join(root, categoryName);
        const mediaItems = [];

        await scanMediaRecursive(categoryPath, categoryInfo.id, mediaItems, scanState);

        categories.push({
            id: categoryInfo.id,
            name: categoryInfo.name,
            number: categoryInfo.number,
            mediaCount: mediaItems.length
        });

        mediaByCategory.set(categoryInfo.id, mediaItems);
        allMedia.push(...mediaItems);
    }

    categories.sort((a, b) => {
        if (a.number && b.number && a.number !== b.number) {
            return a.number - b.number;
        }
        return a.id.localeCompare(b.id);
    });

    bimMethodeCache.root = root;
    bimMethodeCache.categories = categories;
    bimMethodeCache.mediaByCategory = mediaByCategory;
    bimMethodeCache.allMedia = allMedia;
    bimMethodeCache.lastUpdated = Date.now();

    return {
        root,
        categories,
        mediaByCategory,
        allMedia
    };
}

function scheduleRefresh() {
    if (refreshInProgress) {
        return refreshPromise;
    }

    refreshInProgress = true;
    lastRefreshStart = Date.now();
    refreshPromise = new Promise((resolve, reject) => {
        setImmediate(async () => {
            try {
                const result = await refreshCache();
                lastRefreshError = null;
                resolve(result);
            } catch (error) {
                lastRefreshError = error;
                reject(error);
            } finally {
                refreshInProgress = false;
            }
        });
    });

    return refreshPromise;
}

function getCachedData() {
    const hasCache = bimMethodeCache.lastUpdated > 0;
    const isFresh = hasCache && (Date.now() - bimMethodeCache.lastUpdated < CACHE_TTL_MS);
    const cacheHasContent = (bimMethodeCache.categories?.length || 0) > 0 || (bimMethodeCache.allMedia?.length || 0) > 0;

    if (isFresh && !cacheHasContent) {
        scheduleRefresh().catch(() => {});
        return {
            root: bimMethodeCache.root,
            categories: bimMethodeCache.categories,
            mediaByCategory: bimMethodeCache.mediaByCategory,
            allMedia: bimMethodeCache.allMedia,
            stale: true,
            refreshing: true,
            refreshError: lastRefreshError ? lastRefreshError.message : null
        };
    }

    if (isFresh) {
        return {
            root: bimMethodeCache.root,
            categories: bimMethodeCache.categories,
            mediaByCategory: bimMethodeCache.mediaByCategory,
            allMedia: bimMethodeCache.allMedia,
            stale: false,
            refreshing: false,
            refreshError: null
        };
    }

    if (hasCache) {
        scheduleRefresh().catch(() => {});
        return {
            root: bimMethodeCache.root,
            categories: bimMethodeCache.categories,
            mediaByCategory: bimMethodeCache.mediaByCategory,
            allMedia: bimMethodeCache.allMedia,
            stale: true,
            refreshing: true,
            refreshError: lastRefreshError ? lastRefreshError.message : null
        };
    }

    scheduleRefresh().catch(() => {});
    return {
        root: bimMethodeCache.root,
        categories: [],
        mediaByCategory: new Map(),
        allMedia: [],
        stale: true,
        refreshing: true,
        refreshError: lastRefreshError ? lastRefreshError.message : null
    };
}

function sanitizeCategoryName(value) {
    if (!value || typeof value !== 'string') return '';
    return value
        .replace(/[<>:"|?*]/g, '')
        .replace(/\.\./g, '')
        .trim();
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = sanitizeCategoryName(
            req.query.category || req.headers['x-category'] || req.body.category
        );

        if (!category) {
            return cb(new Error('Category is required'));
        }

        const { root, exists } = resolveMethodeRoot();
        if (!exists) {
            return cb(new Error(`BIM Methode root not found: ${root}`));
        }

        const targetDir = path.join(root, category);
        try {
            fs.mkdirSync(targetDir, { recursive: true });
        } catch (error) {
            return cb(error);
        }

        const normalizedRoot = normalizePathValue(root);
        const normalizedTarget = normalizePathValue(targetDir);
        if (!normalizedTarget.startsWith(normalizedRoot)) {
            return cb(new Error('Invalid category path'));
        }

        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

router.get('/categories', (req, res) => {
    try {
        const { categories, root, stale, refreshing, refreshError } = getCachedData();
        res.json({ success: true, categories, root, stale, refreshing, refreshError });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/media', (req, res) => {
    try {
        const { categories, mediaByCategory, allMedia, stale, refreshing, refreshError } = getCachedData();
        const category = req.query.category;
        const typeFilter = normalizeMediaTypeFilter(req.query.type);

        if (category && category !== 'all') {
            const categoryMedia = mediaByCategory.get(category) || [];
            const media = categoryMedia.filter(item => mediaMatchesTypeFilter(item, typeFilter));
            return res.json({
                success: true,
                category,
                type: typeFilter,
                totalCount: media.length,
                media,
                stale,
                refreshing,
                refreshError
            });
        }

        const media = allMedia.filter(item => mediaMatchesTypeFilter(item, typeFilter));
        res.json({
            success: true,
            type: typeFilter,
            totalCount: media.length,
            categoriesCount: categories.length,
            media,
            stale,
            refreshing,
            refreshError
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/thumbnail/:id', async (req, res) => {
    const decodedPath = decodeId(req.params.id);

    if (!decodedPath) {
        return res.status(400).json({ error: 'Invalid media id' });
    }

    const allowedRoots = getAllowedRoots();

    if (!isPathAllowed(decodedPath, allowedRoots)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const typeInfo = getTypeInfo(decodedPath);
    if (!typeInfo || typeInfo.type !== 'image') {
        return res.status(400).json({ error: 'Thumbnail not supported for this file type' });
    }

    const width = clampInteger(req.query.w, THUMB_DEFAULT_WIDTH, THUMB_MIN_WIDTH, THUMB_MAX_WIDTH);
    const quality = clampInteger(req.query.q, THUMB_DEFAULT_QUALITY, THUMB_MIN_QUALITY, THUMB_MAX_QUALITY);
    const stableThumbPath = getStableThumbnailCachePath(decodedPath, width, quality);

    let sourceStat = null;
    let sourceError = null;
    try {
        sourceStat = await statFileWithRetry(decodedPath);
    } catch (error) {
        sourceError = error;
    }

    if (!sourceStat) {
        if (await pathExistsAsync(stableThumbPath)) {
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('X-Media-Source', 'cache');
            return res.sendFile(stableThumbPath);
        }

        const statusCode = sourceError && sourceError.code === 'ENOENT' ? 404 : 503;
        return res.status(statusCode).json({
            error: statusCode === 404 ? 'File not found' : 'Media source temporarily unavailable',
            detail: isTimeoutError(sourceError) ? 'source timeout' : undefined
        });
    }

    const forceOriginal = req.query.original === '1' || req.query.original === 'true';
    if (forceOriginal || !sharp) {
        res.setHeader('Content-Type', typeInfo.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Media-Source', 'origin');
        return fs.createReadStream(decodedPath).pipe(res);
    }

    try {
        const thumbPath = await withTimeout(
            ensureThumbnailFile(decodedPath, width, quality),
            FILE_ACCESS_TIMEOUT_MS * 2,
            'thumbnail generation'
        );
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Media-Source', 'origin');
        refreshStableThumbnailCache(thumbPath, stableThumbPath);
        return res.sendFile(thumbPath);
    } catch (error) {
        if (await pathExistsAsync(stableThumbPath)) {
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('X-Media-Source', 'cache');
            return res.sendFile(stableThumbPath);
        }

        res.setHeader('Content-Type', typeInfo.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Media-Source', 'origin');
        return fs.createReadStream(decodedPath).pipe(res);
    }
});

router.get('/file', async (req, res) => {
    const encodedId = req.query.id;
    if (!encodedId) {
        return res.status(400).json({ error: 'File id is required' });
    }

    const decodedPath = decodeId(encodedId);
    const allowedRoots = getAllowedRoots();

    if (!decodedPath || !isPathAllowed(decodedPath, allowedRoots)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const stableFileCachePath = getStableFileCachePath(decodedPath);
    let sourceStat = null;
    let sourceError = null;
    try {
        sourceStat = await statFileWithRetry(decodedPath);
    } catch (error) {
        sourceError = error;
    }

    const download = req.query.download === '1' || req.query.download === 'true';
    const typeInfo = getTypeInfo(decodedPath);

    if (sourceStat && sourceStat.isFile()) {
        refreshStableFileCache(decodedPath, sourceStat, stableFileCachePath);

        if (download) {
            res.setHeader('X-Media-Source', 'origin');
            return res.download(decodedPath);
        }

        if (typeInfo && typeInfo.mimeType) {
            res.setHeader('Content-Type', typeInfo.mimeType);
        }
        res.setHeader('X-Media-Source', 'origin');
        return res.sendFile(decodedPath);
    }

    if (await pathExistsAsync(stableFileCachePath)) {
        if (download) {
            res.setHeader('X-Media-Source', 'cache');
            return res.download(stableFileCachePath, path.basename(decodedPath));
        }

        if (typeInfo && typeInfo.mimeType) {
            res.setHeader('Content-Type', typeInfo.mimeType);
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Media-Source', 'cache');
        return res.sendFile(stableFileCachePath);
    }

    const statusCode = sourceError && sourceError.code === 'ENOENT' ? 404 : 503;
    return res.status(statusCode).json({
        error: statusCode === 404 ? 'File not found' : 'Media source temporarily unavailable',
        detail: isTimeoutError(sourceError) ? 'source timeout' : undefined
    });
});

router.delete('/file', requireAdmin, (req, res) => {
    const encodedId = req.query.id;
    if (!encodedId) {
        return res.status(400).json({ error: 'File id is required' });
    }

    const decodedPath = decodeId(encodedId);
    const allowedRoots = getAllowedRoots();

    if (!decodedPath || !isPathAllowed(decodedPath, allowedRoots)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        fs.unlinkSync(decodedPath);
        bimMethodeCache.lastUpdated = 0;
        res.json({ success: true, message: 'File deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/upload', requireAdmin, upload.array('files', 20), (req, res) => {
    const category = sanitizeCategoryName(
        req.query.category || req.headers['x-category'] || req.body.category
    );

    if (!category) {
        return res.status(400).json({ success: false, error: 'Category is required' });
    }

    const files = req.files || [];
    bimMethodeCache.lastUpdated = 0;

    res.json({
        success: true,
        message: `Upload berhasil! ${files.length} file telah ditambahkan.`,
        totalFiles: files.length,
        categoryName: category
    });
});

module.exports = router;
