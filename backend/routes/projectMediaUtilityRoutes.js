const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const VIDEO_THUMBNAIL_CACHE_DIR = path.resolve(__dirname, '..', 'public', 'cache', 'project-media-thumbnails');
const VIDEO_THUMBNAIL_WIDTH = 520;
const VIDEO_THUMBNAIL_TIMEOUT_MS = 25000;
const VIDEO_THUMBNAIL_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv', '.m4v']);

function getFfmpegBinary() {
    try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic) {
            return ffmpegStatic;
        }
    } catch (error) {
        // Fall back to PATH below.
    }

    return process.env.FFMPEG_PATH || process.env.FFMPEG_BIN || 'ffmpeg';
}

const FFMPEG_BIN = getFfmpegBinary();

function ensureVideoThumbnailCacheDir() {
    fs.mkdirSync(VIDEO_THUMBNAIL_CACHE_DIR, { recursive: true });
}

function getVideoThumbnailCachePath(mediaUrl, sourceStat) {
    const statKey = sourceStat
        ? `${sourceStat.size || 0}:${Math.round(sourceStat.mtimeMs || 0)}`
        : 'unknown';
    const cacheKey = crypto
        .createHash('sha1')
        .update(`${String(mediaUrl || '').trim().toLowerCase()}|${statKey}|w${VIDEO_THUMBNAIL_WIDTH}`)
        .digest('hex');
    return path.join(VIDEO_THUMBNAIL_CACHE_DIR, `${cacheKey}.jpg`);
}

function generateVideoThumbnail(sourcePath, outputPath) {
    ensureVideoThumbnailCacheDir();

    const generateAtSeek = (seekTime) => new Promise((resolve, reject) => {
        const tempPath = `${outputPath}.${process.pid}.${Date.now()}.tmp.jpg`;
        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-ss', seekTime,
            '-i', sourcePath,
            '-frames:v', '1',
            '-vf', `scale=${VIDEO_THUMBNAIL_WIDTH}:-2:flags=lanczos`,
            '-q:v', '4',
            tempPath
        ];
        const child = spawn(FFMPEG_BIN, args, {
            stdio: ['ignore', 'ignore', 'pipe'],
            windowsHide: true
        });
        let stderr = '';
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            fs.promises.rm(tempPath, { force: true }).catch(() => {});
            reject(new Error(`thumbnail timeout after ${VIDEO_THUMBNAIL_TIMEOUT_MS}ms`));
        }, VIDEO_THUMBNAIL_TIMEOUT_MS);

        child.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });

        child.on('error', error => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fs.promises.rm(tempPath, { force: true }).catch(() => {});
            reject(error);
        });

        child.on('close', async (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            if (code !== 0) {
                await fs.promises.rm(tempPath, { force: true }).catch(() => {});
                reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
                return;
            }

            try {
                const generatedStat = await fs.promises.stat(tempPath);
                if (!generatedStat.isFile() || generatedStat.size <= 0) {
                    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
                    reject(new Error('empty thumbnail output'));
                    return;
                }

                await fs.promises.rename(tempPath, outputPath);
                resolve(outputPath);
            } catch (error) {
                await fs.promises.rm(tempPath, { force: true }).catch(() => {});
                reject(error);
            }
        });
    });

    return (async () => {
        const seekTimes = ['00:00:01', '00:00:00.1', '00:00:03'];
        let lastError = null;

        for (const seekTime of seekTimes) {
            try {
                return await generateAtSeek(seekTime);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Failed to generate thumbnail');
    })();
}

function createProjectMediaUtilityRoutes({
    buildWatermarkFilterGraph,
    getProjectMediaCachePath,
    getProjectMediaMimeType,
    getWatermarkLogos,
    isTimeoutError,
    refreshProjectMediaCacheCopy,
    resolveBimMethodeFileFromId,
    resolveMediaFileInfo,
    resolveMediaFileFromUrl,
    sanitizeDownloadName,
    statFileWithTimeout,
    streamMediaWithRange
}) {
    const router = express.Router();

    router.get('/api/project-media-thumbnail', async (req, res) => {
        const mediaUrl = String(req.query.url || '').trim();
        if (!mediaUrl) {
            return res.status(400).json({ error: 'url parameter is required' });
        }

        const sourceInfo = typeof resolveMediaFileInfo === 'function'
            ? resolveMediaFileInfo(mediaUrl)
            : { ok: false, filePath: resolveMediaFileFromUrl(mediaUrl), attempts: [] };
        const sourcePath = sourceInfo && sourceInfo.filePath;
        if (!sourcePath) {
            return res.status(400).json({
                error: 'Invalid media url',
                reason: sourceInfo && sourceInfo.reason ? sourceInfo.reason : undefined
            });
        }

        const ext = path.extname(sourcePath).toLowerCase();
        if (!VIDEO_THUMBNAIL_EXTENSIONS.has(ext)) {
            return res.status(400).json({ error: 'Thumbnail is only supported for project video media' });
        }

        let sourceStat = null;
        try {
            sourceStat = await statFileWithTimeout(sourcePath, 10000);
        } catch (error) {
            return res.status(isTimeoutError(error) ? 503 : 404).json({
                error: isTimeoutError(error) ? 'Media source temporarily unavailable' : 'Media file not found',
                detail: isTimeoutError(error) ? 'source timeout' : undefined
            });
        }

        if (!sourceStat || !sourceStat.isFile()) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        const cachePath = getVideoThumbnailCachePath(mediaUrl, sourceStat);
        try {
            ensureVideoThumbnailCacheDir();
            const cacheStat = await fs.promises.stat(cachePath);
            if (cacheStat && cacheStat.isFile() && cacheStat.size > 0) {
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('X-Media-Source', 'thumbnail-cache');
                return res.sendFile(cachePath);
            }
        } catch (cacheMiss) {
            // Generate below.
        }

        try {
            const thumbnailPath = await generateVideoThumbnail(sourcePath, cachePath);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('X-Media-Source', 'thumbnail-origin');
            return res.sendFile(thumbnailPath);
        } catch (error) {
            console.warn(`Project media thumbnail generation failed for ${mediaUrl}: ${error.message}`);
            return res.status(500).json({ error: 'Failed to generate video thumbnail' });
        }
    });

    router.get('/api/media-proxy', async (req, res) => {
        const mediaUrl = String(req.query.url || '').trim();
        if (!mediaUrl) {
            return res.status(400).json({ error: 'url parameter is required' });
        }

        const sourceInfo = typeof resolveMediaFileInfo === 'function'
            ? resolveMediaFileInfo(mediaUrl)
            : { ok: false, filePath: resolveMediaFileFromUrl(mediaUrl), attempts: [] };
        const sourcePath = sourceInfo && sourceInfo.filePath;
        if (!sourcePath) {
            return res.status(400).json({
                error: 'Invalid media url',
                reason: sourceInfo && sourceInfo.reason ? sourceInfo.reason : undefined
            });
        }

        const cachePath = getProjectMediaCachePath(mediaUrl, sourcePath);
        const contentType = getProjectMediaMimeType(sourcePath);

        let sourceStat = null;
        let sourceError = null;
        try {
            sourceStat = await statFileWithTimeout(sourcePath);
        } catch (error) {
            sourceStat = null;
            sourceError = error;
        }

        if (sourceStat && sourceStat.isFile()) {
            refreshProjectMediaCacheCopy(sourcePath, cachePath, sourceStat);
            return streamMediaWithRange(
                req,
                res,
                sourcePath,
                sourceStat,
                contentType,
                'public, max-age=300',
                sourceInfo && sourceInfo.sourceLabel ? sourceInfo.sourceLabel : 'origin'
            );
        }

        try {
            const cacheStat = await fs.promises.stat(cachePath);
            if (cacheStat && cacheStat.isFile()) {
                return streamMediaWithRange(req, res, cachePath, cacheStat, contentType, 'public, max-age=3600', 'cache');
            }
        } catch (cacheError) {
            // Ignore cache miss.
        }

        const notFound = sourceError && (sourceError.code === 'ENOENT' || sourceError.code === 'ENOTDIR');
        const sourceUnavailable = sourceInfo && sourceInfo.routePrefix && /^\/media-bim02(?:-2026)?$/i.test(sourceInfo.routePrefix);
        const statusCode = sourceUnavailable && !notFound ? 503 : (notFound ? 404 : 503);
        const errorMessage = notFound
            ? 'Media file not found in configured source paths'
            : 'Media source temporarily unavailable and no cache is available';
        return res.status(statusCode).json({
            error: errorMessage,
            detail: isTimeoutError(sourceError) ? 'source timeout' : undefined,
            sourceStatus: sourceUnavailable ? 'pc-bim02-unavailable-or-path-missing' : 'unavailable',
            sourceLabel: sourceInfo && sourceInfo.sourceLabel ? sourceInfo.sourceLabel : undefined,
            routePrefix: sourceInfo && sourceInfo.routePrefix ? sourceInfo.routePrefix : undefined
        });
    });

    router.get('/api/watermark', async (req, res) => {
        const { url, id } = req.query;

        if (!url && !id) {
            return res.status(400).json({ error: 'url or id parameter is required' });
        }

        const sourcePath = url
            ? resolveMediaFileFromUrl(url)
            : resolveBimMethodeFileFromId(id);
        let filePath = sourcePath;

        if (url && sourcePath) {
            try {
                const sourceStat = await statFileWithTimeout(sourcePath);
                if (sourceStat && sourceStat.isFile()) {
                    refreshProjectMediaCacheCopy(sourcePath, getProjectMediaCachePath(url, sourcePath), sourceStat);
                }
            } catch (sourceError) {
                try {
                    const cachePath = getProjectMediaCachePath(url, sourcePath);
                    const cacheStat = await fs.promises.stat(cachePath);
                    if (cacheStat && cacheStat.isFile()) {
                        filePath = cachePath;
                    }
                } catch (cacheError) {
                    // Keep the original source path so the 404 below remains accurate.
                }
            }
        }

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        const downloadNamePath = sourcePath || filePath;
        const ext = path.extname(filePath).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const videoExts = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv', '.m4v'];
        const isImage = imageExts.includes(ext);
        const isVideo = videoExts.includes(ext);

        if (!isImage && !isVideo) {
            return res.status(400).json({ error: 'Unsupported media type' });
        }

        const baseName = sanitizeDownloadName(path.parse(downloadNamePath).name || 'media');

        const streamWatermark = (options) => {
            const { args, contentType, outputName, label } = options;
            const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let hasOutput = false;
            let finished = false;

            const sendHeaders = () => {
                if (res.headersSent) return;
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
                res.setHeader('Cache-Control', 'no-store');
            };

            const endWithError = (message) => {
                if (finished) return;
                finished = true;
                if (!res.headersSent) {
                    res.status(500).json({ error: message });
                } else if (!res.writableEnded) {
                    res.end();
                }
            };

            ffmpeg.stdout.on('data', chunk => {
                if (!hasOutput) {
                    sendHeaders();
                    hasOutput = true;
                }
                res.write(chunk);
            });

            ffmpeg.stdout.on('end', () => {
                if (finished) return;
                finished = true;
                if (!hasOutput && !res.headersSent) {
                    res.status(500).json({ error: 'Failed to render watermark' });
                    return;
                }
                if (!res.writableEnded) {
                    res.end();
                }
            });

            ffmpeg.stderr.on('data', data => {
                console.error(`FFmpeg ${label} watermark error:`, data.toString());
            });

            ffmpeg.on('error', err => {
                console.error(`FFmpeg spawn error (${label} watermark):`, err.message);
                endWithError('Failed to start watermark process');
            });

            ffmpeg.on('close', code => {
                if (code !== 0 && !hasOutput) {
                    endWithError('Failed to render watermark');
                } else if (code !== 0 && hasOutput && !res.writableEnded) {
                    res.end();
                }
            });

            req.on('close', () => {
                if (!res.writableEnded) {
                    ffmpeg.kill('SIGKILL');
                }
            });
        };

        if (isImage) {
            const outputIsPng = ext === '.png';
            const outputExt = outputIsPng ? 'png' : 'jpg';
            const outputName = `${baseName}-wm.${outputExt}`;
            const logos = getWatermarkLogos();
            const logoInputs = logos.flatMap(logo => ['-i', logo.path]);

            const args = [
                '-hide_banner',
                '-loglevel', 'error',
                '-i', filePath,
                ...logoInputs,
                '-filter_complex', buildWatermarkFilterGraph(logos),
                '-map', '[vout]',
                '-frames:v', '1',
                '-f', 'image2pipe',
                '-vcodec', outputIsPng ? 'png' : 'mjpeg',
                'pipe:1'
            ];
            streamWatermark({
                args,
                contentType: outputIsPng ? 'image/png' : 'image/jpeg',
                outputName,
                label: 'image'
            });

            return;
        }

        const outputName = `${baseName}-wm.mp4`;
        const logos = getWatermarkLogos();
        const logoInputs = logos.flatMap(logo => ['-loop', '1', '-i', logo.path]);

        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', filePath,
            ...logoInputs,
            '-filter_complex', buildWatermarkFilterGraph(logos),
            '-map', '[vout]',
            '-map', '0:a?',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-shortest',
            '-movflags', 'frag_keyframe+empty_moov',
            '-f', 'mp4',
            'pipe:1'
        ];
        streamWatermark({
            args,
            contentType: 'video/mp4',
            outputName,
            label: 'video'
        });
    });

    return router;
}

module.exports = createProjectMediaUtilityRoutes;
