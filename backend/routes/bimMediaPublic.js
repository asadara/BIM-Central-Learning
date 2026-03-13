const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// BIM Media Tags Storage
const BIM_MEDIA_TAGS_FILE = path.join(__dirname, '..', 'bim-media-tags.json');
const G_DRIVE_ROOT = 'G:/';
const PCBIM02_2025_ROOT = '\\\\pc-bim02\\PROJECT BIM 2025';
const PCBIM02_2026_ROOT = '\\\\pc-bim02\\PROJECT BIM 2026';
const PUBLIC_MEDIA_SEARCH_ROOTS = [PCBIM02_2025_ROOT, PCBIM02_2026_ROOT];
const mediaResolutionCache = new Map();

const MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.m4v': 'video/mp4'
};

// Helper function to read BIM media tags
function readBIMMediaTags() {
    try {
        if (!fs.existsSync(BIM_MEDIA_TAGS_FILE)) {
            // Create default structure if file doesn't exist
            const defaultData = {
                media: {},
                collections: {},
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(BIM_MEDIA_TAGS_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(BIM_MEDIA_TAGS_FILE, 'utf-8'));
    } catch (error) {
        console.error('Error reading BIM media tags:', error);
        return { media: {}, collections: {}, lastUpdated: new Date().toISOString() };
    }
}

function decodePathValue(value) {
    let output = String(value || '').trim();
    for (let i = 0; i < 3; i += 1) {
        try {
            const decoded = decodeURIComponent(output);
            if (decoded === output) {
                break;
            }
            output = decoded;
        } catch (error) {
            break;
        }
    }
    return output;
}

function normalizeSeparators(value) {
    return decodePathValue(value).replace(/\\/g, '/');
}

function getPublicMediaRoute(filePath) {
    const normalizedPath = normalizeSeparators(filePath);
    if (!normalizedPath) {
        return null;
    }

    if (normalizedPath.startsWith('/api/bim-media/file?path=')) {
        return normalizedPath;
    }

    return `/api/bim-media/file?path=${encodeURIComponent(normalizedPath)}`;
}

function safeJoin(basePath, relativePath) {
    const normalizedRelative = relativePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean);
    return path.join(basePath, ...normalizedRelative);
}

function getNormalizedCacheKey(filePath) {
    return normalizeSeparators(filePath).toLowerCase();
}

function getExistingFile(candidatePath) {
    if (!candidatePath) {
        return null;
    }

    try {
        const stat = fs.statSync(candidatePath);
        return stat.isFile() ? candidatePath : null;
    } catch (error) {
        return null;
    }
}

function searchFileByName(searchRoots, fileName) {
    const normalizedName = String(fileName || '').trim();
    if (!normalizedName) {
        return null;
    }

    for (const rootPath of searchRoots) {
        try {
            const stack = [rootPath];

            while (stack.length > 0) {
                const currentPath = stack.pop();
                let entries = [];

                try {
                    entries = fs.readdirSync(currentPath, { withFileTypes: true });
                } catch (error) {
                    continue;
                }

                for (const entry of entries) {
                    const entryPath = path.join(currentPath, entry.name);

                    if (entry.isDirectory()) {
                        stack.push(entryPath);
                        continue;
                    }

                    if (entry.isFile() && entry.name.toLowerCase() === normalizedName.toLowerCase()) {
                        return entryPath;
                    }
                }
            }
        } catch (error) {
            continue;
        }
    }

    return null;
}

function isPathWithinBase(basePath, targetPath) {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(targetPath);
    const baseLower = resolvedBase.toLowerCase();
    const targetLower = resolvedTarget.toLowerCase();

    if (baseLower === targetLower) {
        return true;
    }

    return targetLower.startsWith(baseLower.endsWith(path.sep) ? baseLower : `${baseLower}${path.sep}`);
}

function resolvePublicMediaFilePath(filePath) {
    const normalizedPath = normalizeSeparators(filePath);
    if (!normalizedPath || normalizedPath.includes('..')) {
        return null;
    }

    const cacheKey = getNormalizedCacheKey(normalizedPath);
    if (mediaResolutionCache.has(cacheKey)) {
        return mediaResolutionCache.get(cacheKey);
    }

    const unc2025Prefix = '//pc-bim02/project bim 2025/';
    const unc2026Prefix = '//pc-bim02/project bim 2026/';
    const lowerPath = normalizedPath.toLowerCase();
    let resolvedPath = null;

    if (lowerPath.startsWith('pc-bim02/')) {
        resolvedPath = safeJoin(PCBIM02_2025_ROOT, normalizedPath.slice('PC-BIM02/'.length));
        resolvedPath = getExistingFile(resolvedPath)
            || searchFileByName(PUBLIC_MEDIA_SEARCH_ROOTS, path.basename(normalizedPath));
        mediaResolutionCache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    if (lowerPath.startsWith(unc2025Prefix)) {
        resolvedPath = safeJoin(PCBIM02_2025_ROOT, normalizedPath.slice(unc2025Prefix.length));
        resolvedPath = getExistingFile(resolvedPath)
            || searchFileByName(PUBLIC_MEDIA_SEARCH_ROOTS, path.basename(normalizedPath));
        mediaResolutionCache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    if (lowerPath.startsWith(unc2026Prefix)) {
        resolvedPath = safeJoin(PCBIM02_2026_ROOT, normalizedPath.slice(unc2026Prefix.length));
        resolvedPath = getExistingFile(resolvedPath)
            || searchFileByName(PUBLIC_MEDIA_SEARCH_ROOTS, path.basename(normalizedPath));
        mediaResolutionCache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    if (lowerPath.startsWith('x:/') || lowerPath.startsWith('x:')) {
        resolvedPath = safeJoin(PCBIM02_2025_ROOT, normalizedPath.slice(2));
        resolvedPath = getExistingFile(resolvedPath)
            || searchFileByName(PUBLIC_MEDIA_SEARCH_ROOTS, path.basename(normalizedPath));
        mediaResolutionCache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    if (lowerPath.startsWith('v:/') || lowerPath.startsWith('v:')) {
        resolvedPath = safeJoin(PCBIM02_2026_ROOT, normalizedPath.slice(2));
        resolvedPath = getExistingFile(resolvedPath)
            || searchFileByName(PUBLIC_MEDIA_SEARCH_ROOTS, path.basename(normalizedPath));
        mediaResolutionCache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    if (lowerPath.startsWith('g:/') || lowerPath.startsWith('g:')) {
        const resolved = path.resolve(normalizedPath);
        resolvedPath = isPathWithinBase(G_DRIVE_ROOT, resolved) ? resolved : null;
        mediaResolutionCache.set(cacheKey, resolvedPath);
        return resolvedPath;
    }

    mediaResolutionCache.set(cacheKey, null);
    return null;
}

function getContentType(filePath) {
    return MIME_TYPES[path.extname(filePath || '').toLowerCase()] || 'application/octet-stream';
}

function streamFileWithRange(req, res, filePath, stat) {
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = getContentType(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (range) {
        const parts = String(range).replace(/bytes=/, '').split('-');
        const start = Number.parseInt(parts[0], 10);
        const requestedEnd = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
        const end = Number.isFinite(requestedEnd) ? Math.min(requestedEnd, fileSize - 1) : fileSize - 1;

        if (!Number.isFinite(start) || start < 0 || start >= fileSize || end < start) {
            return res.status(416).send('Requested range not satisfiable');
        }

        const chunkSize = (end - start) + 1;
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunkSize
        });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    res.setHeader('Content-Length', fileSize);
    return fs.createReadStream(filePath).pipe(res);
}

// GET /api/bim-media/tags - Get all tagged media (public access for showroom)
router.get('/tags', (req, res) => {
    try {
        const tagsData = readBIMMediaTags();
        const taggedMedia = Object.entries(tagsData.media).map(([filePath, tags]) => ({
            filePath,
            ...tags
        }));

        // Filter out sensitive information and only include what's needed for public display
        const publicMedia = taggedMedia.map(media => ({
            filePath: media.filePath,
            fileName: media.fileName,
            fileType: media.fileType,
            year: media.year,
            location: media.location,
            bimDimension: media.bimDimension,
            type: media.type,
            description: media.description,
            taggedAt: media.taggedAt,
            mediaUrl: getPublicMediaRoute(media.filePath)
        }));

        res.json({
            totalTagged: publicMedia.length,
            media: publicMedia
        });
    } catch (error) {
        console.error('Error getting public media tags:', error);
        res.status(500).json({ error: 'Failed to get media tags', detail: error.message });
    }
});

// GET /api/bim-media/file?path=... - Stream tagged BIM media for public pages
router.get('/file', async (req, res) => {
    try {
        const requestedPath = String(req.query.path || '').trim();
        if (!requestedPath) {
            return res.status(400).json({ error: 'path parameter is required' });
        }

        const resolvedPath = resolvePublicMediaFilePath(requestedPath);
        if (!resolvedPath) {
            return res.status(400).json({ error: 'Invalid media path' });
        }

        const stat = await fs.promises.stat(resolvedPath);
        if (!stat.isFile()) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        return streamFileWithRange(req, res, resolvedPath, stat);
    } catch (error) {
        const status = error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 503;
        return res.status(status).json({
            error: status === 404 ? 'Media file not found' : 'Media source temporarily unavailable',
            detail: error.message
        });
    }
});

// GET /api/bim-media/stats - Get public tagging statistics
router.get('/stats', (req, res) => {
    try {
        const tagsData = readBIMMediaTags();
        const taggedMedia = Object.values(tagsData.media);

        const stats = {
            totalTagged: taggedMedia.length,
            byYear: {},
            byLocation: {},
            byBIMDimension: {},
            byType: {},
            lastUpdated: tagsData.lastUpdated
        };

        // Calculate statistics
        taggedMedia.forEach(media => {
            if (media.year) {
                stats.byYear[media.year] = (stats.byYear[media.year] || 0) + 1;
            }
            if (media.location) {
                stats.byLocation[media.location] = (stats.byLocation[media.location] || 0) + 1;
            }
            if (media.bimDimension) {
                stats.byBIMDimension[media.bimDimension] = (stats.byBIMDimension[media.bimDimension] || 0) + 1;
            }
            if (media.type) {
                stats.byType[media.type] = (stats.byType[media.type] || 0) + 1;
            }
        });

        res.json(stats);
    } catch (error) {
        console.error('Error getting public tagging stats:', error);
        res.status(500).json({ error: 'Failed to get tagging statistics', detail: error.message });
    }
});

module.exports = router;
