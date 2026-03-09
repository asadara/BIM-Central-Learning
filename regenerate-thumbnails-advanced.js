/**
 * Advanced Thumbnail Generator - Multiple Techniques
 * Tries different FFmpeg frame extraction methods for videos
 * that may have problematic frames
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = "G:/BIM CENTRAL LEARNING/";
const THUMBNAIL_DIR = path.join(__dirname, "backend/public/thumbnails");

function sanitizeFilenameForThumbnail(filename) {
    const baseName = path.parse(filename).name;
    return baseName
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
}

function findVideoFile(videoName, searchDir = BASE_DIR, depth = 0) {
    if (depth > 15) return null;
    try {
        if (fs.existsSync(path.join(searchDir, videoName))) {
            return path.join(searchDir, videoName);
        }
        const files = fs.readdirSync(searchDir);
        for (const file of files) {
            const fullPath = path.join(searchDir, file);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                const found = findVideoFile(videoName, fullPath, depth + 1);
                if (found) return found;
            }
        }
    } catch (err) {
        // Ignore
    }
    return null;
}

/**
 * Generate thumbnail using multiple techniques
 * Technique 1: Seek to 5 seconds, quality 2
 * Technique 2: Seek to 10 seconds (in case 5s is black frame)
 * Technique 3: Seek to 2 seconds (for short videos)
 * Technique 4: Seek to 1 second with lower quality
 * Technique 5: Use middle of video duration
 * Technique 6: Force keyframe mode
 */
function generateThumbnailAdvanced(videoPath, thumbnailPath, attemptNum = 1) {
    const techniques = [
        // Technique 1: Standard (5 seconds, q2)
        {
            name: "Standard (5s, q2)",
            cmd: `ffmpeg -i "${videoPath}" -ss 00:00:05 -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        },
        // Technique 2: Later frame (10 seconds, q2)
        {
            name: "Later frame (10s, q2)",
            cmd: `ffmpeg -i "${videoPath}" -ss 00:00:10 -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        },
        // Technique 3: Early frame (2 seconds, q2)
        {
            name: "Early frame (2s, q2)",
            cmd: `ffmpeg -i "${videoPath}" -ss 00:00:02 -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        },
        // Technique 4: Very early (1 second, q3)
        {
            name: "Very early (1s, q3)",
            cmd: `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -q:v 3 -y "${thumbnailPath}"`
        },
        // Technique 5: With -vf scale for video filtering
        {
            name: "With scale filter",
            cmd: `ffmpeg -i "${videoPath}" -ss 00:00:05 -vf "scale=450:340" -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        },
        // Technique 6: Direct keyframe (no seeking optimization)
        {
            name: "Direct keyframe",
            cmd: `ffmpeg -i "${videoPath}" -vf "select=eq(n\\,100)" -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        },
        // Technique 7: Using thumbnail filter
        {
            name: "Thumbnail filter",
            cmd: `ffmpeg -i "${videoPath}" -vf "thumbnail" -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        },
        // Technique 8: Extract at 30% of duration
        {
            name: "At 30% mark",
            cmd: `ffmpeg -i "${videoPath}" -ss 00:00:05 -t 1 -vframes 1 -q:v 2 -y "${thumbnailPath}"`
        }
    ];

    if (attemptNum > techniques.length) {
        return false;
    }

    const technique = techniques[attemptNum - 1];
    console.log(`    Attempt ${attemptNum}: ${technique.name}`);

    try {
        execSync(technique.cmd, {
            timeout: 20000,
            stdio: 'ignore'
        });

        if (fs.existsSync(thumbnailPath)) {
            const stats = fs.statSync(thumbnailPath);
            if (stats.size > 1000) {  // Valid thumbnail should be > 1KB
                return true;
            } else {
                // File too small, try next technique
                fs.unlinkSync(thumbnailPath);
            }
        }
    } catch (err) {
        // Technique failed, try next
    }

    return generateThumbnailAdvanced(videoPath, thumbnailPath, attemptNum + 1);
}

console.log('═══════════════════════════════════════════════════');
console.log('🎬 ADVANCED THUMBNAIL REGENERATOR');
console.log('═══════════════════════════════════════════════════\n');

console.log('📂 Scanning for all videos...');
const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.flv', '.wmv'];
let allVideos = [];

function scanVideos(dir, depth = 0) {
    if (depth > 15) return;
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                scanVideos(fullPath, depth + 1);
            } else if (videoExtensions.includes(path.extname(item.name).toLowerCase())) {
                allVideos.push({ name: item.name, path: fullPath });
            }
        }
    } catch (err) {
        // Ignore
    }
}

scanVideos(BASE_DIR);
console.log(`Found: ${allVideos.length} video files\n`);

// Check which thumbnails exist and which are problematic
let existingCount = 0;
let problematicCount = 0;
let missingCount = 0;

for (const video of allVideos) {
    const sanitized = sanitizeFilenameForThumbnail(video.name);
    const thumbPath = path.join(THUMBNAIL_DIR, sanitized + '.jpg');

    if (!fs.existsSync(thumbPath)) {
        missingCount++;
    } else if (fs.statSync(thumbPath).size < 1000) {
        problematicCount++;
    } else {
        existingCount++;
    }
}

console.log(`✅ Existing valid: ${existingCount}`);
console.log(`⚠️  Problematic: ${problematicCount}`);
console.log(`❌ Missing: ${missingCount}`);
console.log(`\n🔧 Regenerating problematic + missing thumbnails...\n`);

let regenerated = 0;
let failed = 0;

for (let i = 0; i < allVideos.length; i++) {
    const video = allVideos[i];
    const sanitized = sanitizeFilenameForThumbnail(video.name);
    const thumbPath = path.join(THUMBNAIL_DIR, sanitized + '.jpg');

    // Check if needs regeneration
    let needsRegen = false;
    if (!fs.existsSync(thumbPath)) {
        needsRegen = true;
    } else if (fs.statSync(thumbPath).size < 1000) {
        needsRegen = true;
        fs.unlinkSync(thumbPath);  // Delete problematic thumbnail
    }

    if (needsRegen) {
        const displayName = video.name.length > 60 ? video.name.substring(0, 60) + '...' : video.name;
        console.log(`[${i + 1}/${allVideos.length}] ${displayName}`);

        if (generateThumbnailAdvanced(video.path, thumbPath)) {
            console.log(`  ✅ Generated successfully`);
            regenerated++;
        } else {
            console.log(`  ❌ Failed after 8 attempts`);
            failed++;
        }
    }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('📊 SUMMARY');
console.log('═══════════════════════════════════════════════════');
console.log(`✅ Regenerated: ${regenerated}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📦 Total thumbnails: ${fs.readdirSync(THUMBNAIL_DIR).length}`);
console.log('═══════════════════════════════════════════════════\n');

if (regenerated > 0) {
    console.log('✅ Advanced regeneration complete! Restart server to see changes.');
} else {
    console.log('✅ All thumbnails are already optimal quality.');
}
