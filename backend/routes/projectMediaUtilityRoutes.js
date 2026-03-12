const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function createProjectMediaUtilityRoutes({
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
}) {
    const router = express.Router();

    router.get('/api/media-proxy', async (req, res) => {
        const mediaUrl = String(req.query.url || '').trim();
        if (!mediaUrl) {
            return res.status(400).json({ error: 'url parameter is required' });
        }

        const sourcePath = resolveMediaFileFromUrl(mediaUrl);
        if (!sourcePath) {
            return res.status(400).json({ error: 'Invalid media url' });
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
            return streamMediaWithRange(req, res, sourcePath, sourceStat, contentType, 'public, max-age=300', 'origin');
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
        const statusCode = notFound ? 404 : 503;
        const errorMessage = notFound
            ? 'Media file not found'
            : 'Media source temporarily unavailable and no cache is available';
        return res.status(statusCode).json({
            error: errorMessage,
            detail: isTimeoutError(sourceError) ? 'source timeout' : undefined
        });
    });

    router.get('/api/watermark', (req, res) => {
        const { url, id } = req.query;

        if (!url && !id) {
            return res.status(400).json({ error: 'url or id parameter is required' });
        }

        const filePath = url
            ? resolveMediaFileFromUrl(url)
            : resolveBimMethodeFileFromId(id);

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Media file not found' });
        }

        const ext = path.extname(filePath).toLowerCase();
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const videoExts = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv'];
        const isImage = imageExts.includes(ext);
        const isVideo = videoExts.includes(ext);

        if (!isImage && !isVideo) {
            return res.status(400).json({ error: 'Unsupported media type' });
        }

        const baseName = sanitizeDownloadName(path.parse(filePath).name || 'media');

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
