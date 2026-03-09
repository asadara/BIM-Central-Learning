/**
 * Fix Missing Thumbnails Script
 * Untuk video yang gagal di-generate, gunakan fallback thumbnail
 * atau coba lagi dengan FFmpeg options yang berbeda
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = "G:/BIM CENTRAL LEARNING/";
const THUMBNAIL_DIR = path.join(__dirname, "backend/public/thumbnails");

// Fungsi sanitasi yang sama seperti server.js
function sanitizeFilenameForThumbnail(filename) {
    const baseName = path.parse(filename).name;
    return baseName
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
}

// Video yang hilang thumbnailnya
const missingVideos = [
    "Video Pelatihan Pengolahan 1.mp4",
    "Video Pelatihan Pengolahan 2.mp4",
    "video1213112062.mp4",
    "video1916104376.mp4",
    "video1906443449.mp4",
    "video1104030158.mp4",
    "Open BIM COVID-19_ Creating a bill of quantities for the COVID-19 safety plan.mp4",
    "Open BIM COVID-19_ Develop a shop safety plan against the spread of COVID-19.mp4",
    "Webinar_ Adopting Open BIM to develop workplace reentry plans.mp4",
    "WEBINAR_ Automatic generation of bill of quantities adopting an Open BIM workflo.mp4",
    "Webinar_ Building Energy Analysis and HVAC Design with Open BIM software.mp4",
    "WEBINAR_ Design and analysis of fire protection installations.mp4",
    "Guest House AMMAN (1).mp4",
    "Guest House AMMAN (2).mp4"
];

// Fungsi untuk cari video file di folder
function findVideoFile(videoName, searchDir = BASE_DIR) {
    try {
        if (fs.existsSync(path.join(searchDir, videoName))) {
            return path.join(searchDir, videoName);
        }

        const files = fs.readdirSync(searchDir);
        for (const file of files) {
            const fullPath = path.join(searchDir, file);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                const found = findVideoFile(videoName, fullPath);
                if (found) return found;
            }
        }
    } catch (err) {
        // Ignore
    }
    return null;
}

// Fungsi untuk generate thumbnail dengan berbagai options
function generateThumbnail(videoPath, thumbnailPath, attemptNum = 1) {
    console.log(`  Attempt ${attemptNum}: Generating thumbnail...`);

    const attempts = [
        // Attempt 1: Normal (5 second mark)
        `ffmpeg -i "${videoPath}" -ss 00:00:05 -vframes 1 -q:v 2 -y "${thumbnailPath}" 2>nul`,

        // Attempt 2: Dari awal video (0 second)
        `ffmpeg -i "${videoPath}" -ss 00:00:00 -vframes 1 -q:v 2 -y "${thumbnailPath}" 2>nul`,

        // Attempt 3: Dari 2 detik
        `ffmpeg -i "${videoPath}" -ss 00:00:02 -vframes 1 -q:v 2 -y "${thumbnailPath}" 2>nul`,

        // Attempt 4: Dengan codec specification
        `ffmpeg -c:v h264 -i "${videoPath}" -ss 00:00:05 -vframes 1 -q:v 2 -y "${thumbnailPath}" 2>nul`,
    ];

    try {
        execSync(attempts[attemptNum - 1], {
            timeout: 15000,
            stdio: 'ignore'
        });

        if (fs.existsSync(thumbnailPath)) {
            const stats = fs.statSync(thumbnailPath);
            if (stats.size > 500) { // Minimum size untuk valid JPG
                return true;
            }
        }
    } catch (err) {
        // Try next attempt
    }

    if (attemptNum < attempts.length) {
        return generateThumbnail(videoPath, thumbnailPath, attemptNum + 1);
    }

    return false;
}

console.log('═══════════════════════════════════════════════════');
console.log('🔧 FIX MISSING THUMBNAILS');
console.log('═══════════════════════════════════════════════════\n');

let generated = 0;
let failed = 0;

for (let i = 0; i < missingVideos.length; i++) {
    const videoName = missingVideos[i];
    const sanitized = sanitizeFilenameForThumbnail(videoName);
    const thumbnailPath = path.join(THUMBNAIL_DIR, sanitized + ".jpg");

    console.log(`[${i + 1}/${missingVideos.length}] ${videoName.substring(0, 60)}`);

    // Skip jika sudah ada
    if (fs.existsSync(thumbnailPath)) {
        console.log(`  ✓ Already exists`);
        generated++;
        continue;
    }

    // Cari video file
    const videoPath = findVideoFile(videoName);
    if (!videoPath) {
        console.log(`  ✗ Video file not found`);
        failed++;
        continue;
    }

    // Coba generate
    if (generateThumbnail(videoPath, thumbnailPath)) {
        console.log(`  ✅ Thumbnail generated`);
        generated++;
    } else {
        console.log(`  ⚠️  Failed to generate - creating placeholder`);
        // Copy fallback thumbnail
        const fallbackPath = path.join(__dirname, 'BC-Learning-Main', 'img', 'fallback-thumb.png');
        if (fs.existsSync(fallbackPath)) {
            fs.copyFileSync(fallbackPath, thumbnailPath);
            console.log(`  ✅ Used fallback thumbnail`);
            generated++;
        } else {
            console.log(`  ✗ Fallback thumbnail not found`);
            failed++;
        }
    }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('📊 SUMMARY');
console.log('═══════════════════════════════════════════════════');
console.log(`✅ Generated: ${generated}`);
console.log(`✗ Failed: ${failed}`);
console.log('═══════════════════════════════════════════════════\n');

if (failed === 0) {
    console.log('✅ All missing thumbnails fixed! Server restart diperlukan.');
} else {
    console.log(`⚠️  ${failed} thumbnail(s) still missing.`);
}
