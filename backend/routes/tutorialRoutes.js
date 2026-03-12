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

const GENERIC_CATEGORY_KEYS = new Set([
    "general",
    "other",
    "others",
    "beginner",
    "intermediate",
    "advanced",
    "modeling",
    "coordination",
    "analysis",
    "documentation",
    "workflow"
]);

const CATEGORY_RULES = [
    { key: "civil-3d", label: "Civil 3D", aliases: ["civil 3d", "civil3d", "c3d", "autocad civil 3d"] },
    { key: "navisworks", label: "Navisworks", aliases: ["navisworks", "naviswork", "nwd", "timeliner", "project timeliner"] },
    { key: "trimble-connect", label: "Trimble Connect", aliases: ["trimble connect"] },
    { key: "infraworks", label: "InfraWorks", aliases: ["infraworks", "autodesk infraworks"] },
    { key: "twinmotion", label: "Twinmotion", aliases: ["twinmotion", "flashclass", "vrex", "bimcollab"] },
    { key: "fulcrum", label: "Fulcrum", aliases: ["fulcrum", "inspection fulcrum", "mobile fulcrum"] },
    { key: "global-mapper", label: "Global Mapper", aliases: ["global mapper"] },
    { key: "google-earth", label: "Google Earth", aliases: ["google earth"] },
    { key: "point-cloud", label: "Point Cloud", aliases: ["point cloud"] },
    { key: "drone-survey", label: "Drone Survey", aliases: ["drone survey", "aerial survey", "terra drone", "remote pilot", "lidar", "drone", "zenmuse", "matrice"] },
    { key: "plannerly", label: "Plannerly", aliases: ["plannerly"] },
    { key: "revit", label: "Revit", aliases: ["revit", "rvt"] },
    { key: "autocad", label: "AutoCAD", aliases: ["autocad", "acad", "dwg"] },
    { key: "enscape", label: "Enscape", aliases: ["enscape"] },
    { key: "lumion", label: "Lumion", aliases: ["lumion"] },
    { key: "dynamo", label: "Dynamo", aliases: ["dynamo"] },
    { key: "archicad", label: "ArchiCAD", aliases: ["archicad", "archi cad"] },
    { key: "strubim-cype", label: "StruBIM Cype", aliases: ["strubim cype", "strubim", "cype"] },
    { key: "sketchup", label: "SketchUp", aliases: ["sketchup", "sketch up"] },
    { key: "tekla", label: "Tekla", aliases: ["tekla"] },
    { key: "inventor", label: "Inventor", aliases: ["inventor"] },
    { key: "fusion-360", label: "Fusion 360", aliases: ["fusion 360", "fusion360"] },
    { key: "solidworks", label: "SolidWorks", aliases: ["solidworks"] },
    { key: "bentley", label: "Bentley", aliases: ["bentley"] },
    { key: "vray", label: "V-Ray", aliases: ["vray", "v ray"] },
    { key: "workflow", label: "Workflow", aliases: ["workflow"] },
    { key: "traffic-management", label: "Traffic Management", aliases: ["traffic management"] },
    { key: "design", label: "Design", aliases: ["design"] },
    { key: "tender", label: "Tender", aliases: ["tender"] },
    { key: "work-stage", label: "Work Stage", aliases: ["work stage", "workstage"] },
    { key: "animasi", label: "Animasi", aliases: ["animasi", "animation"] },
    { key: "projects", label: "Projects / Case Studies", aliases: ["proyek fakultas", "fakultas teknik unp", "office interior", "global dinamika kencana", "anyer", "tanjung lesung", "lampesue bridge", "phisiotherapy room", "physiotherapy room", "radio theraphy linac", "radiotherapy linac", "rsau", "pps unp", "tmii"] },
    { key: "open-bim", label: "Open BIM", aliases: ["open bim"] },
    { key: "bim", label: "BIM", aliases: ["building information modeling", "bim"] }
];

const CATEGORY_STOPWORDS = new Set([
    "and", "atau", "yang", "dengan", "untuk", "the", "how", "to", "use", "using",
    "tutorial", "tutorials", "lesson", "lessons", "part", "bagian", "video", "vidio",
    "learning", "audio", "visual", "introduction", "intro", "complete", "new",
    "features", "feature", "overview", "basic", "advanced", "beginner", "intermediate",
    "kelas", "course", "courses", "training", "day", "batch", "gmt", "fps", "with",
    "from", "into", "your", "dan", "pada", "dalam", "serta", "ini", "itu", "for",
    "by", "of", "in", "on", "at", "a", "an"
]);

const PROJECT_CONTEXT_ALIASES = [
    "anyer",
    "tanjung lesung",
    "lampesue bridge",
    "fakultas teknik unp",
    "global dinamika kencana",
    "office interior",
    "phisiotherapy room",
    "physiotherapy room",
    "radio theraphy linac",
    "radiotherapy linac",
    "rsau",
    "pps unp",
    "tmii"
];

const FINAL_CATEGORY_DEFINITIONS = {
    "civil-3d": { id: "civil-3d", label: "Civil 3D", icon: "fas fa-road", order: 10 },
    "navisworks": { id: "navisworks", label: "Navisworks", icon: "fas fa-project-diagram", order: 20 },
    "revit": { id: "revit", label: "Revit", icon: "fas fa-building", order: 30 },
    "autocad": { id: "autocad", label: "AutoCAD", icon: "fas fa-drafting-compass", order: 40 },
    "archicad": { id: "archicad", label: "ArchiCAD", icon: "fas fa-home", order: 50 },
    "enscape": { id: "enscape", label: "Enscape", icon: "fas fa-camera", order: 60 },
    "twinmotion": { id: "twinmotion", label: "Twinmotion", icon: "fas fa-vr-cardboard", order: 65 },
    "infraworks": { id: "infraworks", label: "InfraWorks", icon: "fas fa-city", order: 70 },
    "trimble-connect": { id: "trimble-connect", label: "Trimble Connect", icon: "fas fa-network-wired", order: 80 },
    "plannerly": { id: "plannerly", label: "Plannerly", icon: "fas fa-sitemap", order: 90 },
    "fulcrum": { id: "fulcrum", label: "Fulcrum", icon: "fas fa-clipboard-check", order: 100 },
    "open-bim": { id: "open-bim", label: "Open BIM", icon: "fas fa-cubes", order: 110 },
    "strubim-cype": { id: "strubim-cype", label: "StruBIM Cype", icon: "fas fa-drafting-compass", order: 120 },
    "bim": { id: "bim", label: "BIM", icon: "fas fa-cubes", order: 130 },
    "drone-survey": { id: "drone-survey", label: "Drone Survey", icon: "fas fa-helicopter", order: 210 },
    "workflow": { id: "workflow", label: "Workflow", icon: "fas fa-stream", order: 220 },
    "traffic-management": { id: "traffic-management", label: "Traffic Management", icon: "fas fa-traffic-light", order: 230 },
    "design": { id: "design", label: "Design", icon: "fas fa-pencil-ruler", order: 240 },
    "tender": { id: "tender", label: "Tender", icon: "fas fa-file-signature", order: 250 },
    "work-stage": { id: "work-stage", label: "Work Stage", icon: "fas fa-layer-group", order: 260 },
    "animasi": { id: "animasi", label: "Animasi", icon: "fas fa-film", order: 270 },
    "projects": { id: "projects", label: "Projects / Case Studies", icon: "fas fa-briefcase", order: 900 },
    "other": { id: "other", label: "Other", icon: "fas fa-folder-open", order: 1000 }
};

const CATEGORY_MERGE_MAP = {
    "inspection-fulcrum": "fulcrum",
    "mobile-fulcrum": "fulcrum",
    "project-timeliner": "navisworks",
    "timeliner": "navisworks",
    "pelatihan-pengolahan": "drone-survey",
    "survey": "drone-survey",
    "whatsapp": "other",
    "youcut": "other",
    "udah-upload": "other",
    "amman": "projects",
    "amman-mineral": "projects",
    "buin-batu": "projects",
    "data-center": "projects",
    "dinamika-kencana": "projects",
    "guest-house": "projects",
    "hemodialisis-depok": "projects",
    "house": "projects",
    "jakarta": "projects",
    "makassar": "projects",
    "nke": "projects",
    "office": "projects",
    "office-interior": "projects",
    "office-nke": "projects",
    "oneject": "projects",
    "oneject-cikarang": "projects",
    "pondasi": "projects",
    "pondasi-pipa": "projects",
    "pondasi-reservoir": "projects",
    "proyek-angkatan": "projects",
    "proyek-fakultas": "projects",
    "fakultas-teknik": "projects",
    "teknik-unp": "projects",
    "sumatra-barat": "projects",
    "global-dinamika": "projects",
    "dinamika-kencana": "projects",
    "rsau": "projects"
};

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

function slugifyCategory(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function formatCategoryLabel(value) {
    const normalized = String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return "Other";

    const specialLabels = {
        bim: "BIM",
        autocad: "AutoCAD",
        civil3d: "Civil 3D",
        "civil 3d": "Civil 3D",
        archicad: "ArchiCAD",
        enscape: "Enscape",
        navisworks: "Navisworks",
        plannerly: "Plannerly",
        revit: "Revit",
        fulcrum: "Fulcrum",
        sketchup: "SketchUp",
        tekla: "Tekla",
        dynamo: "Dynamo",
        lumion: "Lumion",
        infraworks: "InfraWorks",
        "strubim cype": "StruBIM Cype",
        "trimble connect": "Trimble Connect",
        "global mapper": "Global Mapper",
        "google earth": "Google Earth",
        "point cloud": "Point Cloud",
        "drone survey": "Drone Survey",
        "traffic management": "Traffic Management",
        "work stage": "Work Stage",
        "open bim": "Open BIM",
        "fusion 360": "Fusion 360",
        solidworks: "SolidWorks",
        bentley: "Bentley"
    };

    const lower = normalized.toLowerCase();
    if (specialLabels[lower]) {
        return specialLabels[lower];
    }

    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTitleForMatching(filename) {
    return path.parse(String(filename || "").toLowerCase()).name
        .replace(/[_\-().[\]]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeContextForMatching(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[\\/_\-().[\]]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function titleHasAlias(normalizedTitle, alias) {
    const normalizedAlias = String(alias || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedAlias) return false;

    return ` ${normalizedTitle} `.includes(` ${normalizedAlias} `);
}

function looksLikeRawMedia(filename) {
    const normalizedBaseName = normalizeTitleForMatching(filename);

    if (!normalizedBaseName) {
        return false;
    }

    return (
        normalizedBaseName.startsWith("whatsapp video") ||
        normalizedBaseName.startsWith("youcut") ||
        normalizedBaseName.startsWith("vid ") ||
        /^video\d{6,}$/i.test(path.parse(String(filename || "")).name)
    );
}

function resolveExplicitVideoCategory(video) {
    const baseName = path.parse(String(video?.name || "")).name.toLowerCase();
    const normalizedBaseName = normalizeTitleForMatching(video?.name || "");

    if (baseName === "0718") {
        return { key: "work-stage", label: FINAL_CATEGORY_DEFINITIONS["work-stage"].label, source: "explicit" };
    }

    if (/24fps\.mp4$/i.test(String(video?.name || ""))) {
        return { key: "projects", label: FINAL_CATEGORY_DEFINITIONS.projects.label, source: "explicit" };
    }

    const twinmotionOverrides = new Set([
        "flashclass day 1",
        "flashclass day 2",
        "twinmotion 2021 1 release trailer",
        "vrex bimcollab integration"
    ]);

    if (twinmotionOverrides.has(normalizedBaseName)) {
        return { key: "twinmotion", label: FINAL_CATEGORY_DEFINITIONS.twinmotion.label, source: "explicit" };
    }

    return null;
}

function tokenizeVideoTitle(filename) {
    return normalizeTitleForMatching(filename)
        .split(" ")
        .filter((token) => {
            if (!token) return false;
            if (/^\d+$/.test(token)) return false;
            if (/^\d+(x\d+)+$/i.test(token)) return false;
            if (/^\d+(fps|p)$/i.test(token)) return false;
            if (/^\d{6,}$/.test(token)) return false;
            if (/^(mp4|avi|mov|webm|mkv|h264|lesson\d*|part\d*)$/.test(token)) return false;
            if (/^(hd|uhd|fullhd|version|ver|app|apps)$/i.test(token)) return false;
            if (CATEGORY_STOPWORDS.has(token)) return false;
            return token.length >= 3 || token === "bim";
        });
}

function extractKeywordCandidates(filename) {
    const tokens = tokenizeVideoTitle(filename);
    const candidates = new Set();

    tokens.forEach((token) => {
        candidates.add(token);
    });

    for (let index = 0; index < tokens.length - 1; index += 1) {
        candidates.add(`${tokens[index]} ${tokens[index + 1]}`);
    }

    return [...candidates];
}

function buildKeywordFrequencyIndex(videos) {
    const counts = new Map();

    videos.forEach((video) => {
        const uniqueCandidates = new Set(extractKeywordCandidates(video.name));
        uniqueCandidates.forEach((candidate) => {
            counts.set(candidate, (counts.get(candidate) || 0) + 1);
        });
    });

    return counts;
}

function resolveConfiguredCategory(categoryValue) {
    if (!categoryValue) return null;

    const raw = String(categoryValue).trim();
    if (!raw) return null;

    const slug = slugifyCategory(raw);
    for (const rule of CATEGORY_RULES) {
        if (rule.key === slug) {
            return { key: rule.key, label: rule.label, source: "configured" };
        }

        if (rule.aliases.some((alias) => slugifyCategory(alias) === slug)) {
            return { key: rule.key, label: rule.label, source: "configured" };
        }
    }

    return {
        key: slug || "other",
        label: formatCategoryLabel(raw),
        source: "configured"
    };
}

function resolveKeywordCategory(filename, keywordCounts) {
    const normalizedTitle = normalizeTitleForMatching(filename);

    for (const rule of CATEGORY_RULES) {
        if (rule.aliases.some((alias) => titleHasAlias(normalizedTitle, alias))) {
            return { key: rule.key, label: rule.label, source: "keyword" };
        }
    }

    const dynamicCandidate = extractKeywordCandidates(filename)
        .filter((candidate) => (keywordCounts.get(candidate) || 0) >= 2)
        .sort((left, right) => {
            const leftWords = left.split(" ").length;
            const rightWords = right.split(" ").length;
            if (rightWords !== leftWords) return rightWords - leftWords;

            const leftCount = keywordCounts.get(left) || 0;
            const rightCount = keywordCounts.get(right) || 0;
            if (rightCount !== leftCount) return rightCount - leftCount;

            return right.length - left.length;
        })[0];

    if (dynamicCandidate) {
        return {
            key: slugifyCategory(dynamicCandidate),
            label: formatCategoryLabel(dynamicCandidate),
            source: "keyword"
        };
    }

    return null;
}

function resolveFolderCategory(video) {
    const context = normalizeContextForMatching(video?.path || "");
    if (!context) {
        return null;
    }

    for (const rule of CATEGORY_RULES) {
        if (rule.aliases.some((alias) => titleHasAlias(context, alias))) {
            return { key: rule.key, label: rule.label, source: "folder" };
        }
    }

    if (PROJECT_CONTEXT_ALIASES.some((alias) => titleHasAlias(context, alias))) {
        return { key: "projects", label: FINAL_CATEGORY_DEFINITIONS.projects.label, source: "folder" };
    }

    const inProjectArchive = titleHasAlias(context, "video dokumentasi") || titleHasAlias(context, "video presentasi");
    if (inProjectArchive && !looksLikeRawMedia(video?.name)) {
        return { key: "projects", label: FINAL_CATEGORY_DEFINITIONS.projects.label, source: "folder" };
    }

    return null;
}

function resolveVideoCategory(video, keywordCounts) {
    const explicitCategory = resolveExplicitVideoCategory(video);
    const configured = resolveConfiguredCategory(video.category);
    const keywordCategory = resolveKeywordCategory(video.name, keywordCounts);
    const folderCategory = resolveFolderCategory(video);
    const keywordIsCanonical = keywordCategory && (
        FINAL_CATEGORY_DEFINITIONS[keywordCategory.key] ||
        CATEGORY_MERGE_MAP[keywordCategory.key]
    );

    if (explicitCategory) {
        return explicitCategory;
    }

    if (keywordIsCanonical) {
        return keywordCategory;
    }

    if (configured && !GENERIC_CATEGORY_KEYS.has(configured.key)) {
        return configured;
    }

    if (folderCategory) {
        return folderCategory;
    }

    if (keywordCategory) {
        return keywordCategory;
    }

    if (configured) {
        return {
            key: configured.key,
            label: configured.label || formatCategoryLabel(configured.key),
            source: configured.source
        };
    }

    return { key: "other", label: "Other", source: "fallback" };
}

function normalizeFinalCategory(category) {
    const rawKey = slugifyCategory(category?.key || category?.id || "other") || "other";
    const mergedKey = CATEGORY_MERGE_MAP[rawKey] || rawKey;
    const definition = FINAL_CATEGORY_DEFINITIONS[mergedKey] || FINAL_CATEGORY_DEFINITIONS.other;

    return {
        key: definition.id,
        label: definition.label,
        icon: definition.icon,
        order: definition.order,
        source: category?.source || "keyword"
    };
}

function pickRepresentativeVideo(videos) {
    return [...videos].sort((left, right) => {
        const leftThumbExists = left.thumbnail ? fs.existsSync(path.join(THUMBNAIL_DIR, path.basename(left.thumbnail))) : false;
        const rightThumbExists = right.thumbnail ? fs.existsSync(path.join(THUMBNAIL_DIR, path.basename(right.thumbnail))) : false;

        if (leftThumbExists !== rightThumbExists) {
            return Number(rightThumbExists) - Number(leftThumbExists);
        }

        const leftViews = Number(left.viewCount || 0);
        const rightViews = Number(right.viewCount || 0);
        if (rightViews !== leftViews) {
            return rightViews - leftViews;
        }

        return String(left.name || "").localeCompare(String(right.name || ""));
    })[0];
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
        const keywordCounts = buildKeywordFrequencyIndex(videos);
        const normalizedVideos = videos.map((video) => {
            const resolvedCategory = normalizeFinalCategory(resolveVideoCategory(video, keywordCounts));
            return {
                ...video,
                category: resolvedCategory.label,
                categoryKey: resolvedCategory.key,
                categorySource: resolvedCategory.source
            };
        });
        res.json(normalizedVideos);
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
    const courses = [];
    const courseGroups = {};

    try {
        // Dapatkan semua video dari semua subfolder
        const allVideos = findVideosInFolder(folder, null, tagsData, adminTagsLookup);
        const keywordCounts = buildKeywordFrequencyIndex(allVideos);

        // Kelompokkan video berdasarkan keyword judul file yang sama.
        allVideos.forEach(video => {
            const resolvedCategory = normalizeFinalCategory(resolveVideoCategory(video, keywordCounts));
            const groupKey = resolvedCategory.key || "other";

            video.category = resolvedCategory.label;
            video.categoryKey = groupKey;
            video.categorySource = resolvedCategory.source;

            if (!courseGroups[groupKey]) {
                courseGroups[groupKey] = {
                    key: groupKey,
                    title: resolvedCategory.label,
                    icon: resolvedCategory.icon,
                    order: resolvedCategory.order,
                    videos: []
                };
            }
            courseGroups[groupKey].videos.push(video);
        });

        // Konversi groups menjadi format courses
        Object.values(courseGroups)
            .sort((left, right) => {
                const leftOrder = Number(left.order || 5000);
                const rightOrder = Number(right.order || 5000);
                if (leftOrder !== rightOrder) {
                    return leftOrder - rightOrder;
                }

                return left.title.localeCompare(right.title);
            })
            .forEach((group) => {
            const courseVideos = [...group.videos].sort((left, right) => left.name.localeCompare(right.name));
            const representativeVideo = pickRepresentativeVideo(courseVideos);
            const courseViewCount = courseVideos.reduce((total, video) => {
                return total + Number(video.viewCount || 0);
            }, 0);

            courses.push({
                id: group.key,
                category: group.title,
                categoryKey: group.key,
                title: group.title,
                description: `Kumpulan tutorial ${group.title} untuk pembelajaran BIM`,
                thumbnail: representativeVideo.thumbnail,
                videoCount: courseVideos.length,
                icon: group.icon || getCourseIcon(group.title),
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
    const resolved = resolveKeywordCategory(filename, buildKeywordFrequencyIndex([{ name: filename }]));
    return resolved ? resolved.label : "Other";
}

// Fungsi untuk mendapatkan icon berdasarkan nama course
function getCourseIcon(courseName) {
    const name = courseName.toLowerCase();

    if (name.includes('civil')) return 'fas fa-road';
    if (name.includes('revit')) return 'fas fa-building';
    if (name.includes('autocad')) return 'fas fa-drafting-compass';
    if (name.includes('sketchup')) return 'fas fa-cube';
    if (name.includes('3ds') || name.includes('max')) return 'fas fa-cubes';
    if (name.includes('dynamo')) return 'fas fa-project-diagram';
    if (name.includes('navisworks')) return 'fas fa-eye';
    if (name.includes('lumion')) return 'fas fa-lightbulb';
    if (name.includes('tekla')) return 'fas fa-industry';
    if (name.includes('plannerly')) return 'fas fa-sitemap';
    if (name.includes('drone')) return 'fas fa-helicopter';
    if (name.includes('trimble')) return 'fas fa-network-wired';
    if (name.includes('bim')) return 'fas fa-cubes';

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
