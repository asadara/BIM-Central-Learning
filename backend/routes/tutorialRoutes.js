const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { Pool } = require("pg");

const router = express.Router();
const videoFolder = "G:/BIM CENTRAL LEARNING/"; // Lokasi utama
const TAGS_FILE = path.join(__dirname, "../tags.json");
const VIDEO_TAGS_FILE = path.join(__dirname, "../video-tags.json");
const THUMBNAIL_DIR = path.join(__dirname, "../public/thumbnails");

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "bcl_database",
    user: process.env.DB_USER || "bcl_user",
    password: process.env.DB_PASSWORD || "secure_password_2025",
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
};

const pool = new Pool(dbConfig);
pool.on("error", (err) => {
    console.warn("WARN: PostgreSQL pool error in tutorial routes:", err.message);
});

// Import view counter utility
const { getViewCount, incrementViewCount } = require("../utils/viewCounter");

// ✅ FIXED: Unified sanitization function (same as server.js)
function sanitizeFilenameForThumbnail(filename) {
    const baseName = path.parse(filename).name;
    return baseName
        .replace(/[^a-zA-Z0-9_\-]/g, '_')  // Replace non-alphanumeric dengan underscore
        .replace(/_+/g, '_')                 // Collapse multiple underscores
        .toLowerCase();                      // Lowercase untuk consistency
}

function ensureThumbnailDir() {
    if (!fs.existsSync(THUMBNAIL_DIR)) {
        fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
    }
}

function generateThumbnail(videoPath, thumbnailPath, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-ss', '00:00:05',
            '-i', videoPath,
            '-vframes', '1',
            '-q:v', '2',
            thumbnailPath
        ];

        execFile('ffmpeg', args, { timeout: timeoutMs }, (error) => {
            if (error) {
                return reject(error);
            }
            resolve(thumbnailPath);
        });
    });
}

function normalizeTagList(tags) {
    if (!Array.isArray(tags)) return [];

    const uniqueTags = [];
    const seen = new Set();

    tags.forEach((tag) => {
        const cleanTag = String(tag || "").trim();
        if (!cleanTag) return;

        const dedupeKey = cleanTag.toLowerCase();
        if (seen.has(dedupeKey)) return;

        seen.add(dedupeKey);
        uniqueTags.push(cleanTag);
    });

    return uniqueTags;
}

function mergeTagLists(...tagLists) {
    const merged = [];
    const seen = new Set();

    tagLists.forEach((tags) => {
        normalizeTagList(tags).forEach((tag) => {
            const dedupeKey = tag.toLowerCase();
            if (seen.has(dedupeKey)) return;

            seen.add(dedupeKey);
            merged.push(tag);
        });
    });

    return merged;
}

function normalizeLookupKey(value) {
    return String(value || "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .toLowerCase();
}

function registerTagEntryLookup(lookup, key, value) {
    if (!key) return;
    lookup[key] = value;

    const normalizedKey = normalizeLookupKey(key);
    if (normalizedKey && !lookup[normalizedKey]) {
        lookup[normalizedKey] = value;
    }
}

function findAdminTagData(lookup, keys = []) {
    if (!lookup) return null;

    for (const key of keys) {
        if (!key) continue;
        if (lookup[key]) return lookup[key];

        const normalized = normalizeLookupKey(key);
        if (normalized && lookup[normalized]) return lookup[normalized];
    }

    return null;
}

function readLegacyTagsData() {
    if (!fs.existsSync(TAGS_FILE)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));
    } catch (error) {
        console.error("Error reading legacy tags file:", error.message);
        return null;
    }
}

async function loadAdminVideoTagsLookup() {
    const lookup = {};

    try {
        const result = await pool.query(`
            SELECT video_id, category, bim_level, duration, language, description, tags, updated_at
            FROM video_tags
        `);

        result.rows.forEach((row) => {
            registerTagEntryLookup(lookup, row.video_id, {
                videoId: row.video_id,
                category: row.category || null,
                bimLevel: row.bim_level || null,
                duration: row.duration || null,
                language: row.language || null,
                description: row.description || null,
                tags: normalizeTagList(row.tags),
                updatedAt: row.updated_at || null
            });
        });
    } catch (dbError) {
        console.warn("WARN: Failed loading admin video tags from PostgreSQL:", dbError.message);
    }

    try {
        if (!fs.existsSync(VIDEO_TAGS_FILE)) {
            return lookup;
        }

        const raw = JSON.parse(fs.readFileSync(VIDEO_TAGS_FILE, "utf8"));
        const jsonVideoTags = raw?.videoTags || {};

        Object.entries(jsonVideoTags).forEach(([videoId, tagData]) => {
            const normalizedVideoId = normalizeLookupKey(videoId);
            if (lookup[videoId] || (normalizedVideoId && lookup[normalizedVideoId])) {
                return;
            }

            registerTagEntryLookup(lookup, videoId, {
                videoId,
                category: tagData?.category || null,
                bimLevel: tagData?.bimLevel || null,
                duration: tagData?.duration || null,
                language: tagData?.language || null,
                description: tagData?.description || null,
                tags: normalizeTagList(tagData?.tags),
                updatedAt: tagData?.updated_at || null
            });
        });
    } catch (jsonError) {
        console.error("Error reading admin video tags JSON fallback:", jsonError.message);
    }

    return lookup;
}

// Fungsi untuk membaca tagline manual dari file
function getManualTagline(filename, type = 'video', tagsData = null) {
    try {
        const data = tagsData && tagsData.tags ? tagsData : (
            fs.existsSync(TAGS_FILE) ? JSON.parse(fs.readFileSync(TAGS_FILE, "utf8")) : null
        );

        if (data && data.tags && data.tags[type] && data.tags[type][filename]) {
            return data.tags[type][filename];
        }
    } catch (error) {
        console.error("Error reading tags file:", error);
    }
    return null;
}

// Fungsi untuk mencari file video di dalam semua subfolder
function findVideosInFolder(folder, baseFolder = null, tagsData = null, adminTagsLookup = null) {
    if (!baseFolder) baseFolder = folder; // Set baseFolder pada level pertama

    let videoFiles = [];
    const videoExtensions = ['.mp4', '.avi', '.webm', '.mov'];

    fs.readdirSync(folder).forEach(item => {
        let fullPath = path.join(folder, item);
        let stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            // Jika item adalah folder, lakukan pencarian rekursif
            videoFiles = videoFiles.concat(findVideosInFolder(fullPath, baseFolder, tagsData, adminTagsLookup));
        } else if (videoExtensions.includes(path.extname(item).toLowerCase())) {
            // ✅ FIXED: Use unified sanitization function
            const sanitizedFileName = sanitizeFilenameForThumbnail(item);
            const manualTagline = getManualTagline(item, 'video', tagsData);
            const baseName = path.parse(item).name;
            const lowerBaseName = baseName.toLowerCase();
            const tagEntry = tagsData?.tags?.video?.[item] || null;

            if (lowerBaseName.endsWith('_h264')) {
                const originalBase = baseName.slice(0, -5);
                const originalExists = videoExtensions.some(originalExt =>
                    fs.existsSync(path.join(folder, `${originalBase}${originalExt}`))
                );
                if (originalExists) {
                    return;
                }
            }

            let effectiveFullPath = fullPath;
            if (!lowerBaseName.endsWith('_h264')) {
                const h264Candidate = path.join(folder, `${baseName}_h264.mp4`);
                if (fs.existsSync(h264Candidate)) {
                    effectiveFullPath = h264Candidate;
                }
            }

            // ✅ FIXED: Calculate relative path from base folder (WITHOUT /api/video-stream/ prefix)
            // Frontend will add /api/video-stream/ when constructing the URL
            const relativePath = path.relative(baseFolder, effectiveFullPath).replace(/\\/g, '/');
            const idPath = path.relative(baseFolder, fullPath).replace(/\\/g, '/');

            // Create a unique ID based on the full relative path to avoid collisions
            const uniqueId = idPath.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const filenameOnlyId = item.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const adminTagData = findAdminTagData(adminTagsLookup, [uniqueId, idPath, item, filenameOnlyId]);
            const legacyTags = Array.isArray(tagEntry?.tags) ? tagEntry.tags : [];
            const adminTags = normalizeTagList(adminTagData?.tags);
            // Keep tutorial cards aligned with Admin tagging source.
            // Legacy tags are used only as fallback when admin tags are empty.
            const videoTags = adminTags.length > 0 ? adminTags : normalizeTagList(legacyTags);
            const resolvedCategory = manualTagline?.category || adminTagData?.category || null;

            videoFiles.push({
                id: uniqueId, // ✅ Add unique ID for view counting (based on path to avoid filename collisions)
                name: item,
                size: (fs.statSync(effectiveFullPath).size / (1024 * 1024)).toFixed(2) + " MB", // Konversi ke MB
                path: relativePath,  // ✅ Just the relative path, no prefix
                thumbnail: `/thumbnails/${sanitizedFileName}.jpg`,
                viewCount: getViewCount(uniqueId),
                tagline: manualTagline ? manualTagline.tagline : null,
                category: resolvedCategory,
                manualTag: manualTagline ? true : false,
                tags: videoTags,
                bimLevel: adminTagData?.bimLevel || null,
                duration: adminTagData?.duration || null,
                language: adminTagData?.language || null,
                description: adminTagData?.description || null
            });
        }
    });

    return videoFiles;
}

// API untuk mendapatkan daftar video dari semua subfolder
router.get("/", async (req, res) => {
    console.log("📂 Mencari video di dalam:", videoFolder);

    try {
        const tagsData = readLegacyTagsData();
        const adminTagsLookup = await loadAdminVideoTagsLookup();

        const videos = findVideosInFolder(videoFolder, null, tagsData, adminTagsLookup);
        console.log("🎥 Video ditemukan:", videos);
        res.json(videos);
    } catch (err) {
        console.error("❌ Error membaca folder:", err);
        res.status(500).json({ error: "Gagal membaca folder video" });
    }
});

// ✅ On-demand thumbnail generation for missing thumbnails
router.get("/thumbnail", async (req, res) => {
    try {
        const relativePath = req.query.path;
        if (!relativePath) {
            return res.status(400).json({ error: "path is required" });
        }

        const safeRelative = decodeURIComponent(relativePath).replace(/^[\\/]+/, '');
        const fullPath = path.resolve(videoFolder, safeRelative);
        const basePath = path.resolve(videoFolder);

        if (!fullPath.startsWith(basePath)) {
            return res.status(403).json({ error: "Invalid path" });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: "Video not found" });
        }

        ensureThumbnailDir();

        const filename = path.basename(fullPath);
        const sanitizedFileName = sanitizeFilenameForThumbnail(filename);
        const thumbnailPath = path.join(THUMBNAIL_DIR, `${sanitizedFileName}.jpg`);
        const thumbnailUrl = `/thumbnails/${sanitizedFileName}.jpg`;

        if (fs.existsSync(thumbnailPath)) {
            return res.json({ thumbnail: thumbnailUrl, cached: true });
        }

        await generateThumbnail(fullPath, thumbnailPath);
        return res.json({ thumbnail: thumbnailUrl, cached: false });
    } catch (err) {
        console.error("❌ Thumbnail generation error:", err.message);
        return res.status(500).json({ error: "Failed to generate thumbnail" });
    }
});

// API untuk mendapatkan daftar courses (grouping berdasarkan folder)
router.get("/courses", async (req, res) => {
    console.log("📚 Mencari courses di dalam:", videoFolder);

    try {
        const tagsData = readLegacyTagsData();
        const adminTagsLookup = await loadAdminVideoTagsLookup();
        const courses = findCoursesInFolder(videoFolder, tagsData, adminTagsLookup);
        console.log("📖 Courses ditemukan:", courses.length);
        res.json(courses);
    } catch (err) {
        console.error("❌ Error membaca courses:", err);
        res.status(500).json({ error: "Gagal membaca folder courses" });
    }
});

// Fungsi untuk mengelompokkan video menjadi courses berdasarkan tagline judul file video
function findCoursesInFolder(folder, tagsData = null, adminTagsLookup = null) {
    let courses = [];
    let courseGroups = {};

    try {
        // Dapatkan semua video dari semua subfolder
        let allVideos = findVideosInFolder(folder, null, tagsData, adminTagsLookup);

        // Kelompokkan video berdasarkan tagline dari nama file
        allVideos.forEach(video => {
            let category;

            // Prioritas: gunakan tagline manual jika tersedia
            if (video.category) {
                category = video.category;
            } else {
                // Fallback ke ekstraksi otomatis dari nama file
                category = extractCategoryFromFilename(video.name);
            }

            if (!courseGroups[category]) {
                courseGroups[category] = [];
            }
            courseGroups[category].push(video);
        });

        // Konversi groups menjadi format courses
        Object.keys(courseGroups).forEach(categoryName => {
            let courseVideos = courseGroups[categoryName];
            let representativeVideo = courseVideos[0];
            const courseViewCount = courseVideos.reduce((total, video) => {
                return total + Number(video.viewCount || 0);
            }, 0);

            courses.push({
                id: categoryName.toLowerCase().replace(/\s+/g, '-'),
                title: categoryName,
                description: `Kumpulan tutorial ${categoryName} untuk pembelajaran BIM`,
                thumbnail: representativeVideo.thumbnail,
                videoCount: courseVideos.length,
                icon: getCourseIcon(categoryName),
                representativeVideo: {
                    id: path.parse(representativeVideo.name).name,
                    name: representativeVideo.name,
                    viewCount: courseViewCount
                },
                videos: courseVideos
            });
        });

    } catch (err) {
        console.error("❌ Error reading courses:", err);
    }

    return courses;
}

// Fungsi untuk mengekstrak kategori dari nama file video
function extractCategoryFromFilename(filename) {
    const name = filename.toLowerCase();

    // Hilangkan ekstensi file
    const nameWithoutExt = path.parse(filename).name.toLowerCase();

    // Deteksi kategori berdasarkan keyword di nama file
    if (nameWithoutExt.includes('revit')) return 'Revit';
    if (nameWithoutExt.includes('autocad')) return 'AutoCAD';
    if (nameWithoutExt.includes('sketchup')) return 'SketchUp';
    if (nameWithoutExt.includes('3ds') || nameWithoutExt.includes('max')) return '3ds Max';
    if (nameWithoutExt.includes('dynamo')) return 'Dynamo';
    if (nameWithoutExt.includes('navisworks')) return 'Navisworks';
    if (nameWithoutExt.includes('lumion')) return 'Lumion';
    if (nameWithoutExt.includes('tekla')) return 'Tekla';
    if (nameWithoutExt.includes('inventor')) return 'Inventor';
    if (nameWithoutExt.includes('civil')) return 'Civil 3D';
    if (nameWithoutExt.includes('fusion')) return 'Fusion 360';
    if (nameWithoutExt.includes('archicad')) return 'ArchiCAD';
    if (nameWithoutExt.includes('solidworks')) return 'SolidWorks';
    if (nameWithoutExt.includes('bentley')) return 'Bentley';
    if (nameWithoutExt.includes('enscape')) return 'Enscape';
    if (nameWithoutExt.includes('vray')) return 'V-Ray';

    // Jika tidak ada keyword yang cocok, kelompokkan ke "Other"
    // Hindari kategori aneh seperti angka, kata umum, atau ID acak
    return 'Other';
}

// Fungsi untuk mendapatkan icon berdasarkan nama course
function getCourseIcon(courseName) {
    const name = courseName.toLowerCase();

    if (name.includes('revit')) return 'fas fa-building';
    if (name.includes('autocad')) return 'fas fa-drafting-compass';
    if (name.includes('sketchup')) return 'fas fa-cube';
    if (name.includes('3ds') || name.includes('max')) return 'fas fa-cubes';
    if (name.includes('dynamo')) return 'fas fa-project-diagram';
    if (name.includes('navisworks')) return 'fas fa-eye';
    if (name.includes('lumion')) return 'fas fa-lightbulb';
    if (name.includes('tekla')) return 'fas fa-industry';

    return 'fas fa-graduation-cap'; // Default icon
}

// ✅ NEW: POST endpoint untuk save tags
router.post("/tags", (req, res) => {
    try {
        const { videoName, tags } = req.body;

        if (!videoName || !Array.isArray(tags)) {
            return res.status(400).json({ error: "videoName dan tags required" });
        }

        console.log(`💾 Saving tags for video: ${videoName}`, tags);

        // Read existing tags file
        let tagsData = {};
        if (fs.existsSync(TAGS_FILE)) {
            tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));
        }

        // Ensure structure exists
        if (!tagsData.tags) tagsData.tags = {};
        if (!tagsData.tags.video) tagsData.tags.video = {};

        // Get or create video entry
        const videoEntry = tagsData.tags.video[videoName] || {};

        // Update tags for this video (preserve existing fields like category, tagline etc)
        tagsData.tags.video[videoName] = {
            ...videoEntry,
            tags: tags,  // Add tags array
            updatedAt: new Date().toISOString()
        };

        // Update top-level timestamp
        tagsData.lastUpdated = new Date().toISOString();

        // Write back to file
        fs.writeFileSync(TAGS_FILE, JSON.stringify(tagsData, null, 2));

        console.log(`✅ Tags saved successfully for: ${videoName}`);
        res.json({
            success: true,
            message: "Tags saved successfully",
            videoName: videoName,
            tags: tags
        });
    } catch (err) {
        console.error("❌ Error saving tags:", err);
        res.status(500).json({ error: "Failed to save tags", detail: err.message });
    }
});

// ✅ GET endpoint untuk fetch tags
router.get("/tags/:videoName", (req, res) => {
    try {
        const { videoName } = req.params;
        const decodedName = decodeURIComponent(videoName);

        console.log(`📖 Fetching tags for: ${decodedName}`);

        if (!fs.existsSync(TAGS_FILE)) {
            return res.json({ tags: [], tagline: null, category: null });
        }

        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));
        const videoTags = tagsData.tags?.video?.[decodedName];

        if (!videoTags) {
            console.log(`⚠️ No tags found for: ${decodedName}`);
            return res.json({ tags: [], tagline: null, category: null });
        }

        console.log(`✅ Tags found for ${decodedName}:`, videoTags);
        res.json(videoTags);
    } catch (err) {
        console.error("❌ Error fetching tags:", err);
        res.status(500).json({ error: "Failed to fetch tags" });
    }
});

// ✅ NEW: PUT endpoint untuk increment view count
router.put("/:videoId/view", (req, res) => {
    try {
        const { videoId } = req.params;

        if (!videoId || videoId.trim() === '' || videoId === 'undefined') {
            return res.status(400).json({ error: "Video ID is required" });
        }

        console.log(`👁️ Incrementing view count for video: ${videoId}`);

        // Increment view count using the utility
        incrementViewCount(videoId);

        res.json({
            success: true,
            message: "View count incremented",
            videoId: videoId
        });
    } catch (err) {
        console.error("❌ Error incrementing view count:", err);
        res.status(500).json({ error: "Failed to increment view count", detail: err.message });
    }
});

module.exports = router;
