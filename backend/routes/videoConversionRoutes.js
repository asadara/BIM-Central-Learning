/**
 * Video Conversion API Routes
 * Provides endpoints for video format conversion (H.264/MP4)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../utils/auth');
router.use(requireAdmin);

// Import video converter module
let videoConverter;
try {
    videoConverter = require('../video-converter');
    console.log('✅ Video converter module loaded');
} catch (error) {
    console.warn('⚠️ Video converter module not available:', error.message);
    videoConverter = null;
}

// Track active conversion jobs
const conversionJobs = new Map();

// Configuration
const OUTPUT_DIR = process.env.VIDEO_OUTPUT_DIR || 'Y:\\BCL-Converted-Videos';
const VIDEO_SOURCE_DIR = process.env.VIDEO_SOURCE_DIR || 'G:\\BIM CENTRAL LEARNING';
const CONVERTED_DIR = 'Y:\\BCL-Converted-Videos';

/**
 * Convert URL path to file system path
 * Handles paths like /api/videos/stream/xxx or relative paths
 */
function resolveVideoPath(inputPath) {
    if (!inputPath) return null;
    
    console.log(`🔍 Resolving video path: ${inputPath}`);
    
    // If it's already an absolute Windows path, use it directly
    if (/^[A-Za-z]:\\/.test(inputPath)) {
        console.log(`   Already absolute path: ${inputPath}`);
        return inputPath;
    }
    
    // If it's a URL path like /api/videos/stream/xxx
    if (inputPath.startsWith('/api/videos/stream/')) {
        const videoId = decodeURIComponent(inputPath.replace('/api/videos/stream/', ''));
        // videoId should be the filename or relative path
        const fullPath = path.join(VIDEO_SOURCE_DIR, videoId);
        console.log(`   Resolved from API URL: ${fullPath}`);
        return fullPath;
    }
    
    // If it's a URL path like /videos/xxx
    if (inputPath.startsWith('/videos/')) {
        const relativePath = decodeURIComponent(inputPath.replace('/videos/', ''));
        const fullPath = path.join(VIDEO_SOURCE_DIR, relativePath);
        console.log(`   Resolved from /videos/ URL: ${fullPath}`);
        return fullPath;
    }
    
    // If it looks like a URL-encoded filename or path
    if (inputPath.includes('%')) {
        inputPath = decodeURIComponent(inputPath);
    }
    
    // Try joining with VIDEO_SOURCE_DIR
    const fullPath = path.join(VIDEO_SOURCE_DIR, inputPath);
    console.log(`   Resolved relative path: ${fullPath}`);
    return fullPath;
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    try {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Created video output directory: ${OUTPUT_DIR}`);
    } catch (error) {
        console.error(`❌ Failed to create output directory: ${OUTPUT_DIR}`, error.message);
    }
}

/**
 * GET /api/video-conversion/status
 * Get conversion service status
 */
router.get('/status', (req, res) => {
    res.json({
        available: !!videoConverter,
        outputDir: OUTPUT_DIR,
        outputDirExists: fs.existsSync(OUTPUT_DIR),
        activeJobs: conversionJobs.size,
        jobs: Array.from(conversionJobs.entries()).map(([id, job]) => ({
            id,
            status: job.status,
            progress: job.progress,
            inputFile: path.basename(job.inputPath || ''),
            startedAt: job.startedAt
        }))
    });
});

/**
 * POST /api/video-conversion/check
 * Check if video is H.264 compatible
 */
router.post('/check', async (req, res) => {
    try {
        const { videoPath } = req.body;

        if (!videoPath) {
            return res.status(400).json({ error: 'videoPath is required' });
        }

        if (!videoConverter) {
            return res.status(503).json({ error: 'Video converter not available' });
        }

        // Resolve path from URL/relative to absolute file path
        const resolvedPath = resolveVideoPath(videoPath);
        
        // Security: validate resolved path
        if (resolvedPath.includes('..')) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(resolvedPath)) {
            console.log(`⚠️ Video file not found: ${resolvedPath} (original: ${videoPath})`);
            return res.status(404).json({ error: 'Video file not found', resolvedPath });
        }

        console.log(`🔍 Checking video compatibility: ${path.basename(resolvedPath)}`);

        const isCompatible = await videoConverter.isH264Compatible(resolvedPath);
        const duration = await videoConverter.getVideoDuration(resolvedPath);

        // Check if H.264 version already exists
        const h264Path = videoConverter.getOutputPath(resolvedPath, CONVERTED_DIR);
        const hasH264Version = fs.existsSync(h264Path);

        res.json({
            videoPath: resolvedPath,
            fileName: path.basename(resolvedPath),
            isH264Compatible: isCompatible,
            needsConversion: !isCompatible,
            hasH264Version,
            h264Path: hasH264Version ? h264Path : null,
            duration: duration ? Math.round(duration) : null,
            durationFormatted: duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : null
        });

    } catch (error) {
        console.error('❌ Error checking video:', error);
        res.status(500).json({ error: 'Failed to check video', detail: error.message });
    }
});

/**
 * POST /api/video-conversion/convert
 * Start video conversion job
 */
router.post('/convert', async (req, res) => {
    try {
        const { videoPath, outputDir } = req.body;

        if (!videoPath) {
            return res.status(400).json({ error: 'videoPath is required' });
        }

        if (!videoConverter) {
            return res.status(503).json({ error: 'Video converter not available' });
        }

        // Resolve path from URL/relative to absolute file path
        const resolvedPath = resolveVideoPath(videoPath);
        
        // Security: validate resolved path
        if (resolvedPath.includes('..')) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(resolvedPath)) {
            console.log(`⚠️ Video file not found: ${resolvedPath} (original: ${videoPath})`);
            return res.status(404).json({ error: 'Video file not found', resolvedPath, originalPath: videoPath });
        }

        // Generate job ID
        const jobId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Determine output directory
        const finalOutputDir = outputDir || OUTPUT_DIR;

        // Generate output path
        const outputPath = videoConverter.getOutputPath(resolvedPath, finalOutputDir);

        // Check if already converted
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size > 0) {
                return res.json({
                    jobId: null,
                    status: 'already_converted',
                    outputPath,
                    outputSize: stats.size,
                    message: 'Video already converted'
                });
            }
        }

        // Check if job already running for this video
        for (const [existingId, job] of conversionJobs.entries()) {
            if (job.inputPath === resolvedPath && job.status === 'running') {
                return res.json({
                    jobId: existingId,
                    status: 'already_running',
                    message: 'Conversion already in progress for this video'
                });
            }
        }

        console.log(`🎬 Starting conversion job: ${jobId}`);
        console.log(`   Input: ${resolvedPath}`);
        console.log(`   Output: ${outputPath}`);

        // Create job entry
        const job = {
            id: jobId,
            inputPath: resolvedPath,
            outputPath,
            status: 'running',
            progress: 0,
            startedAt: new Date().toISOString(),
            error: null
        };

        conversionJobs.set(jobId, job);

        // Start conversion in background
        videoConverter.processVideo(resolvedPath, finalOutputDir)
            .then(result => {
                job.status = result.status === 'success' ? 'completed' : 'failed';
                job.completedAt = new Date().toISOString();
                job.result = result;
                job.progress = 100;

                console.log(`✅ Conversion job ${jobId} completed: ${result.status}`);

                // Clean up job after 1 hour
                setTimeout(() => {
                    conversionJobs.delete(jobId);
                }, 3600000);
            })
            .catch(error => {
                job.status = 'failed';
                job.error = error.message;
                job.completedAt = new Date().toISOString();

                console.error(`❌ Conversion job ${jobId} failed:`, error.message);

                // Clean up failed job after 30 minutes
                setTimeout(() => {
                    conversionJobs.delete(jobId);
                }, 1800000);
            });

        res.json({
            jobId,
            conversionId: jobId,
            status: 'started',
            inputPath: resolvedPath,
            outputPath,
            message: 'Conversion started'
        });

    } catch (error) {
        console.error('❌ Error starting conversion:', error);
        res.status(500).json({ error: 'Failed to start conversion', detail: error.message });
    }
});

/**
 * GET /api/video-conversion/check/:videoId
 * Check if video is H.264 compatible (GET method for frontend)
 */
router.get('/check/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;

        if (!videoId) {
            return res.status(400).json({ error: 'videoId is required' });
        }

        // Decode the videoId (may be URL encoded)
        const decodedVideoId = decodeURIComponent(videoId);
        
        // Resolve path - videoId could be a path relative to VIDEO_SOURCE_DIR
        const resolvedPath = resolveVideoPath(decodedVideoId);
        
        console.log(`🔍 GET check for video: ${decodedVideoId} -> ${resolvedPath}`);

        // If video converter not available, return basic info
        if (!videoConverter) {
            return res.json({ 
                compatible: true, // Assume compatible if can't check
                format: 'unknown',
                needsConversion: false,
                error: 'Video converter not available'
            });
        }

        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
            // Return compatible true so UI doesn't show error badge
            return res.json({ 
                compatible: true, // Don't show error for missing files
                format: 'unknown',
                needsConversion: false,
                fileNotFound: true
            });
        }

        // Check H.264 compatibility
        const isCompatible = await videoConverter.isH264Compatible(resolvedPath);
        
        // Check if H.264 version already exists
        const h264Path = videoConverter.getOutputPath(resolvedPath, CONVERTED_DIR);
        const hasH264Version = fs.existsSync(h264Path);

        // Get file extension for format display
        const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
        const format = isCompatible ? 'H.264' : ext.toUpperCase();

        res.json({
            compatible: isCompatible,
            format,
            needsConversion: !isCompatible && !hasH264Version,
            hasH264Version,
            filePath: resolvedPath
        });

    } catch (error) {
        console.error('❌ Error checking video:', error);
        // Return compatible true on error so UI doesn't break
        res.json({ 
            compatible: true, 
            format: 'unknown',
            needsConversion: false,
            error: error.message 
        });
    }
});

/**
 * GET /api/video-conversion/status/:id
 * Get conversion job status by ID
 */
router.get('/status/:id', (req, res) => {
    const { id } = req.params;

    if (!conversionJobs.has(id)) {
        // Job not found - could be completed/expired
        return res.json({ 
            status: 'not_found', 
            message: 'Job not found - may have completed or expired' 
        });
    }

    const job = conversionJobs.get(id);

    res.json({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        inputFile: path.basename(job.inputPath || ''),
        outputFile: path.basename(job.outputPath || ''),
        outputPath: job.outputPath,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        result: job.result
    });
});

/**
 * GET /api/video-conversion/job/:jobId
 * Get conversion job status (alias for /status/:id)
 */
router.get('/job/:jobId', (req, res) => {
    const { jobId } = req.params;

    if (!conversionJobs.has(jobId)) {
        return res.status(404).json({ error: 'Job not found' });
    }

    const job = conversionJobs.get(jobId);

    res.json({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        inputFile: path.basename(job.inputPath),
        outputFile: path.basename(job.outputPath),
        outputPath: job.outputPath,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        result: job.result
    });
});

/**
 * POST /api/video-conversion/batch
 * Start batch conversion for multiple videos
 */
router.post('/batch', async (req, res) => {
    try {
        const { videoPaths, outputDir } = req.body;

        if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length === 0) {
            return res.status(400).json({ error: 'videoPaths array is required' });
        }

        if (!videoConverter) {
            return res.status(503).json({ error: 'Video converter not available' });
        }

        const batchId = `batch_${Date.now()}`;
        const finalOutputDir = outputDir || OUTPUT_DIR;
        const jobs = [];

        console.log(`📦 Starting batch conversion: ${batchId} (${videoPaths.length} videos)`);

        for (const videoPath of videoPaths) {
            // Security: validate path
            if (videoPath.includes('..') || !fs.existsSync(videoPath)) {
                jobs.push({
                    videoPath,
                    status: 'skipped',
                    reason: 'Invalid or missing file'
                });
                continue;
            }

            const jobId = `${batchId}_${jobs.length}`;
            const outputPath = videoConverter.getOutputPath(videoPath, finalOutputDir);

            // Check if already converted
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                jobs.push({
                    jobId,
                    videoPath,
                    outputPath,
                    status: 'already_converted'
                });
                continue;
            }

            // Create job entry
            const job = {
                id: jobId,
                inputPath: videoPath,
                outputPath,
                status: 'queued',
                progress: 0,
                startedAt: null
            };

            conversionJobs.set(jobId, job);

            jobs.push({
                jobId,
                videoPath,
                outputPath,
                status: 'queued'
            });
        }

        // Process queue in background (one at a time to avoid overload)
        processConversionQueue(jobs.filter(j => j.status === 'queued'), finalOutputDir);

        res.json({
            batchId,
            totalVideos: videoPaths.length,
            queued: jobs.filter(j => j.status === 'queued').length,
            skipped: jobs.filter(j => j.status === 'skipped').length,
            alreadyConverted: jobs.filter(j => j.status === 'already_converted').length,
            jobs,
            message: 'Batch conversion started'
        });

    } catch (error) {
        console.error('❌ Error starting batch conversion:', error);
        res.status(500).json({ error: 'Failed to start batch conversion', detail: error.message });
    }
});

/**
 * Process conversion queue sequentially
 */
async function processConversionQueue(queuedJobs, outputDir) {
    for (const jobInfo of queuedJobs) {
        const job = conversionJobs.get(jobInfo.jobId);
        if (!job) continue;

        job.status = 'running';
        job.startedAt = new Date().toISOString();

        try {
            console.log(`🔄 Processing queued job: ${job.id}`);
            const result = await videoConverter.processVideo(job.inputPath, outputDir);

            job.status = result.status === 'success' ? 'completed' : 'failed';
            job.completedAt = new Date().toISOString();
            job.result = result;
            job.progress = 100;

            console.log(`✅ Queued job ${job.id} completed: ${result.status}`);

        } catch (error) {
            job.status = 'failed';
            job.error = error.message;
            job.completedAt = new Date().toISOString();

            console.error(`❌ Queued job ${job.id} failed:`, error.message);
        }

        // Clean up job after 1 hour
        setTimeout(() => {
            conversionJobs.delete(job.id);
        }, 3600000);
    }
}

/**
 * GET /api/video-conversion/output
 * List converted videos in output directory
 */
router.get('/output', (req, res) => {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) {
            return res.json({ outputDir: OUTPUT_DIR, videos: [] });
        }

        const files = fs.readdirSync(OUTPUT_DIR);
        const videos = files
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                const filePath = path.join(OUTPUT_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));

        res.json({
            outputDir: OUTPUT_DIR,
            totalVideos: videos.length,
            totalSize: videos.reduce((sum, v) => sum + v.size, 0),
            totalSizeFormatted: `${(videos.reduce((sum, v) => sum + v.size, 0) / 1024 / 1024 / 1024).toFixed(2)} GB`,
            videos
        });

    } catch (error) {
        console.error('❌ Error listing output videos:', error);
        res.status(500).json({ error: 'Failed to list output videos', detail: error.message });
    }
});

/**
 * DELETE /api/video-conversion/output/:filename
 * Delete a converted video
 */
router.delete('/output/:filename', (req, res) => {
    try {
        const { filename } = req.params;

        // Security: validate filename
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(403).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(OUTPUT_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted converted video: ${filename}`);

        res.json({
            success: true,
            message: `Deleted: ${filename}`
        });

    } catch (error) {
        console.error('❌ Error deleting video:', error);
        res.status(500).json({ error: 'Failed to delete video', detail: error.message });
    }
});

module.exports = router;
