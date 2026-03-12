const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function createProjectMediaUtilityService({
    backendDir,
    baseProjectDir,
    getStaticMountPath,
    getVideoMimeType,
    projectMediaProxyCacheDir,
    projectMediaProxyCacheMaxBytes,
    projectMediaProxyCacheableExt,
    projectMediaProxyMime,
    projectMediaProxyTimeoutMs,
    validVideoExt
}) {
    const WATERMARK_TEXT = 'BIM NKE';
    const WATERMARK_FONT_PRIMARY = 'C:/Windows/Fonts/segoeuib.ttf';
    const WATERMARK_FONT_FALLBACK = 'C:/Windows/Fonts/arialbd.ttf';
    const WATERMARK_FILL_ALPHA = 0.1;
    const WATERMARK_STROKE_ALPHA = 0.12;
    const WATERMARK_STROKE_WIDTH = 5;
    const WATERMARK_STROKE_COLOR = '0xd9d9d9';
    const WATERMARK_LOGO_WIDTH = 140;
    const WATERMARK_LOGO_MARGIN = 20;
    const WATERMARK_LOGO_BIM = path.resolve(backendDir, '..', 'public', 'bim_nke.png');
    const WATERMARK_LOGO_NKE = path.resolve(backendDir, '..', 'public', 'logo_nke.png');
    const WATERMARK_SIZE_SCALE = 0.2;
    const BIM_METHODE_FOLDER_NAME = '20. METHODE ESTIMATE & TENDER';
    const LOCAL_PCBIM02_ROOT = path.resolve(backendDir, '..', 'PC-BIM02');
    const LOCAL_PCBIM02_PROJECT_2025_ROOT = LOCAL_PCBIM02_ROOT;
    const NETWORK_PCBIM02_ROOT = '\\\\pc-bim02\\PROJECT BIM 2025';

    function getWatermarkFontFile() {
        const primaryPath = WATERMARK_FONT_PRIMARY;
        const fallbackPath = WATERMARK_FONT_FALLBACK;
        if (fs.existsSync(primaryPath)) {
            return primaryPath;
        }
        return fallbackPath;
    }

    function escapeDrawtextValue(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/:/g, '\\:')
            .replace(/'/g, "\\'");
    }

    function getWatermarkLogos() {
        const logos = [];
        if (fs.existsSync(WATERMARK_LOGO_BIM)) {
            logos.push({ path: WATERMARK_LOGO_BIM, position: 'left' });
        }
        if (fs.existsSync(WATERMARK_LOGO_NKE)) {
            logos.push({ path: WATERMARK_LOGO_NKE, position: 'right' });
        }
        return logos;
    }

    function buildWatermarkFilter() {
        const fontFile = getWatermarkFontFile();
        const safeFontFile = escapeDrawtextValue(fontFile);
        const safeText = escapeDrawtextValue(WATERMARK_TEXT);
        const options = [
            `fontfile='${safeFontFile}'`,
            `text='${safeText}'`,
            'x=(w-text_w)/2',
            'y=(h-text_h)/2',
            `fontsize=w*${WATERMARK_SIZE_SCALE}`,
            `fontcolor=white@${WATERMARK_FILL_ALPHA}`,
            `bordercolor=${WATERMARK_STROKE_COLOR}@${WATERMARK_STROKE_ALPHA}`,
            `borderw=${WATERMARK_STROKE_WIDTH}`
        ];
        return `drawtext=${options.join(':')}`;
    }

    function buildWatermarkFilterGraph(logos) {
        const parts = [];
        let currentLabel = 'base0';
        parts.push(`[0:v]format=rgba[${currentLabel}]`);

        let logoInputIndex = 1;
        const overlayForLogo = (position) => {
            const logoLabel = `logo${logoInputIndex}`;
            const outLabel = `base${logoInputIndex}o`;
            parts.push(`[${logoInputIndex}:v]format=rgba,scale=${WATERMARK_LOGO_WIDTH}:-1[${logoLabel}]`);
            const xPos = position === 'right'
                ? `W-w-${WATERMARK_LOGO_MARGIN}`
                : `${WATERMARK_LOGO_MARGIN}`;
            parts.push(`[${currentLabel}][${logoLabel}]overlay=${xPos}:${WATERMARK_LOGO_MARGIN}[${outLabel}]`);
            currentLabel = outLabel;
            logoInputIndex += 1;
        };

        if (Array.isArray(logos) && logos.length > 0) {
            logos.forEach(logo => {
                overlayForLogo(logo.position || 'left');
            });
        }

        parts.push(`[${currentLabel}]${buildWatermarkFilter()}[vout]`);
        return parts.join(';');
    }

    function normalizePathValue(value) {
        if (!value) return '';
        if (value.startsWith('\\\\')) return value.toLowerCase();
        return path.resolve(value).toLowerCase();
    }

    function isPathAllowed(filePath, allowedRoots) {
        const normalizedFilePath = normalizePathValue(filePath);
        return allowedRoots.some(root => {
            const normalizedRoot = normalizePathValue(root);
            return normalizedRoot && normalizedFilePath.startsWith(normalizedRoot);
        });
    }

    function getPcbim02Candidates() {
        const candidates = [];

        if (process.env.PCBIM02_ROOT) {
            candidates.push(process.env.PCBIM02_ROOT);
        }

        candidates.push(LOCAL_PCBIM02_ROOT);

        try {
            const LANMountManager = require('../utils/lanMountManager');
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
            // Ignore LAN mount resolution errors; fallback to network path.
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

    function resolveBimMethodeRoot() {
        const candidates = getPcbim02Candidates();
        let firstExistingRoot = null;

        for (const base of candidates) {
            const root = path.join(base, BIM_METHODE_FOLDER_NAME);
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
                // Skip inaccessible root.
            }
        }

        if (firstExistingRoot) {
            return firstExistingRoot;
        }

        const fallbackBase = candidates[0] || NETWORK_PCBIM02_ROOT;
        return {
            base: fallbackBase,
            root: path.join(fallbackBase, BIM_METHODE_FOLDER_NAME),
            exists: false
        };
    }

    function decodeUrlSafeBase64(value) {
        if (!value) return '';
        let base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }
        return Buffer.from(base64, 'base64').toString('utf8');
    }

    function resolveBimMethodeFileFromId(encodedId) {
        const decodedPath = decodeUrlSafeBase64(encodedId);
        if (!decodedPath) return null;

        const { root } = resolveBimMethodeRoot();
        const allowedRoots = [root, ...getPcbim02Candidates()].filter(Boolean);

        if (!isPathAllowed(decodedPath, allowedRoots)) {
            return null;
        }

        return decodedPath;
    }

    function getMediaRouteMap() {
        return [
            { prefix: '/media-bim02-2026', base: getStaticMountPath('pc-bim02-2026', 'V:') },
            { prefix: '/media-bim02', base: getStaticMountPath('pc-bim02', 'X:') },
            { prefix: '/media-bim1-2025', base: getStaticMountPath('pc-bim1', 'Y:') },
            { prefix: '/media-bim1-2024', base: getStaticMountPath('pc-bim1-2024', 'Z:') },
            { prefix: '/media-bim1-2023', base: getStaticMountPath('pc-bim1-2023', 'W:') },
            { prefix: '/media-bim1-2022', base: getStaticMountPath('pc-bim1-2022', 'U:') },
            { prefix: '/media-bim1-2021', base: getStaticMountPath('pc-bim1-2021', 'T:') },
            { prefix: '/media-bim1-2020', base: getStaticMountPath('pc-bim1-2020', 'S:') },
            { prefix: '/media', base: baseProjectDir }
        ];
    }

    function safeDecodePath(value, maxRounds = 2) {
        let output = value;
        for (let i = 0; i < maxRounds; i++) {
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

    function isPathWithinBase(baseDir, targetPath) {
        const baseResolved = path.resolve(baseDir);
        const targetResolved = path.resolve(targetPath);
        const baseNormalized = baseResolved.toLowerCase();
        const targetNormalized = targetResolved.toLowerCase();
        if (targetNormalized === baseNormalized) {
            return true;
        }
        const baseWithSep = baseNormalized.endsWith(path.sep)
            ? baseNormalized
            : baseNormalized + path.sep;
        return targetNormalized.startsWith(baseWithSep);
    }

    function resolveMediaFileFromUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return null;

        let cleanUrl = rawUrl.trim();
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
            try {
                cleanUrl = new URL(cleanUrl).pathname;
            } catch (error) {
                return null;
            }
        }

        cleanUrl = cleanUrl.split('?')[0].split('#')[0];
        if (!cleanUrl.startsWith('/')) return null;
        if (cleanUrl.includes('..')) return null;

        const routeMap = getMediaRouteMap();
        const match = routeMap.find(route => cleanUrl === route.prefix || cleanUrl.startsWith(`${route.prefix}/`));
        if (!match) return null;

        let relativePart = cleanUrl.slice(match.prefix.length);
        relativePart = relativePart.replace(/^\/+/, '');
        if (!relativePart) return null;

        const decoded = safeDecodePath(relativePart, 3);
        const normalized = path.normalize(decoded.replace(/[\\/]+/g, path.sep));
        const segments = normalized.split(path.sep);
        if (segments.some(segment => segment === '..')) {
            return null;
        }

        const fullPath = path.resolve(match.base, normalized);
        if (!isPathWithinBase(match.base, fullPath)) {
            return null;
        }

        return fullPath;
    }

    function sanitizeDownloadName(filename) {
        if (!filename || typeof filename !== 'string') return 'media';
        return filename.replace(/[\\/:*?"<>|]+/g, '_');
    }

    function buildProjectMediaDisplayUrl(mediaUrl) {
        return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
    }

    function getProjectMediaMimeType(filePath) {
        const ext = path.extname(filePath || '').toLowerCase();
        if (validVideoExt.includes(ext)) {
            return getVideoMimeType(filePath);
        }
        return projectMediaProxyMime[ext] || 'application/octet-stream';
    }

    function getProjectMediaCachePath(mediaUrl, filePath) {
        const ext = path.extname(filePath || '').toLowerCase();
        const safeExt = ext && /^[.a-z0-9]+$/.test(ext) ? ext : '.bin';
        const cacheKey = crypto
            .createHash('sha1')
            .update(String(mediaUrl || '').trim().toLowerCase())
            .digest('hex');
        return path.join(projectMediaProxyCacheDir, `${cacheKey}${safeExt}`);
    }

    function isTimeoutError(error) {
        if (!error) return false;
        return error.code === 'ETIMEDOUT' || String(error.message || '').toLowerCase().includes('timed out');
    }

    async function statFileWithTimeout(filePath, timeoutMs = projectMediaProxyTimeoutMs) {
        let timer = null;
        try {
            const statPromise = fs.promises.stat(filePath);
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const error = new Error(`stat timeout after ${timeoutMs}ms`);
                    error.code = 'ETIMEDOUT';
                    reject(error);
                }, timeoutMs);
            });
            return await Promise.race([statPromise, timeoutPromise]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    function isProjectMediaCacheable(filePath, stat) {
        const ext = path.extname(filePath || '').toLowerCase();
        if (!projectMediaProxyCacheableExt.has(ext)) return false;
        if (!stat || typeof stat.size !== 'number') return false;
        return stat.size > 0 && stat.size <= projectMediaProxyCacheMaxBytes;
    }

    function refreshProjectMediaCacheCopy(sourcePath, cachePath, sourceStat) {
        if (!isProjectMediaCacheable(sourcePath, sourceStat)) {
            return;
        }

        setImmediate(async () => {
            try {
                let cacheStat = null;
                try {
                    cacheStat = await fs.promises.stat(cachePath);
                } catch (ignoreError) {
                    cacheStat = null;
                }

                const cacheIsFresh = cacheStat
                    && cacheStat.size === sourceStat.size
                    && Math.round(cacheStat.mtimeMs) === Math.round(sourceStat.mtimeMs);

                if (cacheIsFresh) {
                    return;
                }

                const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
                await fs.promises.copyFile(sourcePath, tempPath);
                await fs.promises.utimes(tempPath, sourceStat.atime || new Date(), sourceStat.mtime || new Date());
                await fs.promises.rename(tempPath, cachePath);
            } catch (error) {
                // Cache update failure should not block primary response path.
            }
        });
    }

    function streamMediaWithRange(req, res, filePath, stat, contentType, cacheControl, sourceLabel) {
        const fileSize = stat.size;
        const range = req.headers.range;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', cacheControl);
        res.setHeader('X-Media-Source', sourceLabel);

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

    return {
        buildProjectMediaDisplayUrl,
        buildWatermarkFilterGraph,
        getProjectMediaCachePath,
        getProjectMediaMimeType,
        getWatermarkLogos,
        isTimeoutError,
        refreshProjectMediaCacheCopy,
        resolveBimMethodeFileFromId,
        resolveMediaFileFromUrl,
        sanitizeDownloadName,
        statFileWithTimeout,
        streamMediaWithRange
    };
}

module.exports = createProjectMediaUtilityService;
