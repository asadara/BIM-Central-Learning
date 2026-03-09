/**
 * Thumbnail Generator - Generate all missing thumbnails from videos
 * Usage: node generate-thumbnails.js [BASE_DIR]
 * 
 * Example: node generate-thumbnails.js "G:/BIM CENTRAL LEARNING"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BASE_DIR = process.argv[2] || 'G:/BIM CENTRAL LEARNING/';
const THUMBNAIL_DIR = path.join(__dirname, 'backend/public/thumbnails');
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
const VALID_VIDEO_EXT = ['.mp4', '.mov', '.webm', '.avi'];

// Ensure thumbnail directory exists
if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
    console.log(`✅ Created thumbnails directory: ${THUMBNAIL_DIR}`);
}

/**
 * Sanitize filename untuk thumbnail naming (sama dengan backend logic)
 */
function sanitizeFilenameForThumbnail(filename) {
    const baseName = path.parse(filename).name;
    return baseName
        .replace(/[^a-zA-Z0-9_\-]/g, '_')  // Replace non-alphanumeric dengan underscore
        .replace(/_+/g, '_')                 // Collapse multiple underscores
        .toLowerCase();                      // Lowercase untuk consistency
}

/**
 * Find all video files recursively
 */
function findAllVideos(dir, maxDepth = 15, currentDepth = 0, videos = []) {
    if (currentDepth >= maxDepth) {
        return videos;
    }

    try {
        if (!fs.existsSync(dir)) {
            console.warn(`⚠️ Directory not found: ${dir}`);
            return videos;
        }

        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
                // Skip certain folders
                if (['incoming', 'incoming data', 'data', 'tender', 'clash detection', 'texture'].some(
                    skip => item.name.toLowerCase().includes(skip)
                )) {
                    continue;
                }
                findAllVideos(fullPath, maxDepth, currentDepth + 1, videos);
            } else {
                const ext = path.extname(item.name).toLowerCase();
                if (VALID_VIDEO_EXT.includes(ext)) {
                    videos.push(fullPath);
                }
            }
        }
    } catch (err) {
        console.error(`❌ Error reading directory ${dir}:`, err.message);
    }

    return videos;
}

/**
 * Generate thumbnail using FFmpeg
 */
function generateThumbnail(videoPath, thumbnailPath, timeout = 20000) {
    return new Promise((resolve, reject) => {
        try {
            const cmd = `ffmpeg -i "${videoPath}" -ss 00:00:05 -vframes 1 -q:v 2 -y "${thumbnailPath}"`;

            try {
                execSync(cmd, {
                    timeout,
                    stdio: 'pipe'  // Suppress ffmpeg output
                });
                resolve(thumbnailPath);
            } catch (err) {
                reject(new Error(`FFmpeg error: ${err.message}`));
            }
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Main function - Generate all thumbnails
 */
async function generateAllThumbnails() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🎬 VIDEO THUMBNAIL GENERATOR');
    console.log('═══════════════════════════════════════════════════\n');

    console.log(`📂 Base Directory: ${BASE_DIR}`);
    console.log(`🖼️ Thumbnail Directory: ${THUMBNAIL_DIR}`);
    console.log(`⏱️  Timeout: 20 seconds per video\n`);

    // Check FFmpeg
    console.log('🔍 Checking FFmpeg...');
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        console.log('✅ FFmpeg found\n');
    } catch (err) {
        console.error('❌ FFmpeg not found! Please install FFmpeg first:');
        console.error('   Windows: choco install ffmpeg');
        console.error('   or download from https://ffmpeg.org/download.html');
        process.exit(1);
    }

    // Find all videos
    console.log('🔎 Scanning for videos...');
    const videos = findAllVideos(BASE_DIR);
    console.log(`📹 Found ${videos.length} video(s)\n`);

    if (videos.length === 0) {
        console.warn('⚠️ No videos found!');
        return;
    }

    // Generate thumbnails
    console.log('═══════════════════════════════════════════════════');
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < videos.length; i++) {
        const videoPath = videos[i];
        const videoName = path.basename(videoPath);
        const sanitizedName = sanitizeFilenameForThumbnail(videoName);
        const thumbnailPath = path.join(THUMBNAIL_DIR, `${sanitizedName}.jpg`);

        // Display progress
        const progress = `[${i + 1}/${videos.length}]`.padEnd(8);
        const status = fs.existsSync(thumbnailPath) ? '⏭️ SKIP' : '⚙️ GEN';

        process.stdout.write(`${progress} ${status}  ${videoName.substring(0, 50)}`);

        // Skip if already exists
        if (fs.existsSync(thumbnailPath)) {
            console.log(' ✓');
            skipped++;
            continue;
        }

        // Generate thumbnail
        try {
            await generateThumbnail(videoPath, thumbnailPath);
            console.log(' ✅');
            generated++;
        } catch (err) {
            console.log(' ❌');
            console.error(`    Error: ${err.message.substring(0, 80)}`);
            failed++;
        }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Generated: ${generated}`);
    console.log(`⏭️ Skipped:   ${skipped}`);
    console.log(`❌ Failed:    ${failed}`);
    console.log(`📹 Total:     ${videos.length}\n`);

    // List thumbnails
    const thumbs = fs.readdirSync(THUMBNAIL_DIR).length;
    console.log(`🖼️ Total thumbnails in folder: ${thumbs}`);
    console.log('═══════════════════════════════════════════════════\n');

    if (failed > 0) {
        console.warn(`⚠️ ${failed} thumbnail(s) failed to generate`);
        console.warn('   Check video format compatibility with FFmpeg');
    }

    if (generated > 0) {
        console.log('✅ Thumbnail generation complete!');
        console.log('   Restart server for changes to take effect\n');
    }
}

// Run
generateAllThumbnails().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
