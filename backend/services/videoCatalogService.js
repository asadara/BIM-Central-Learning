const fs = require("fs");
const path = require("path");
const { getViewCount } = require("../utils/viewCounter");

function createVideoCatalogService({
    baseDir,
    excludedFolders,
    thumbnailDir
}) {
    function sanitizeFilenameForThumbnail(filename) {
        const baseName = path.parse(filename).name;
        return baseName
            .replace(/[^a-zA-Z0-9_\-]/g, '_')
            .replace(/_+/g, '_')
            .toLowerCase();
    }

    const CATEGORY_RULES = [
        { key: 'civil-3d', name: 'Civil 3D', icon: 'fas fa-road', aliases: ['civil 3d', 'civil3d', 'c3d', 'autocad civil 3d'] },
        { key: 'navisworks', name: 'Navisworks', icon: 'fas fa-project-diagram', aliases: ['navisworks', 'naviswork', 'nwd'] },
        { key: 'trimble-connect', name: 'Trimble Connect', icon: 'fas fa-network-wired', aliases: ['trimble connect'] },
        { key: 'infraworks', name: 'InfraWorks', icon: 'fas fa-city', aliases: ['infraworks', 'autodesk infraworks'] },
        { key: 'twinmotion', name: 'Twinmotion', icon: 'fas fa-vr-cardboard', aliases: ['twinmotion', 'flashclass', 'vrex', 'bimcollab'] },
        { key: 'global-mapper', name: 'Global Mapper', icon: 'fas fa-globe-asia', aliases: ['global mapper'] },
        { key: 'google-earth', name: 'Google Earth', icon: 'fas fa-globe', aliases: ['google earth'] },
        { key: 'point-cloud', name: 'Point Cloud', icon: 'fas fa-braille', aliases: ['point cloud'] },
        { key: 'drone-survey', name: 'Drone Survey', icon: 'fas fa-helicopter', aliases: ['drone survey', 'aerial survey', 'terra drone', 'remote pilot', 'lidar', 'drone', 'zenmuse', 'matrice'] },
        { key: 'plannerly', name: 'Plannerly', icon: 'fas fa-sitemap', aliases: ['plannerly'] },
        { key: 'fulcrum', name: 'Fulcrum', icon: 'fas fa-clipboard-check', aliases: ['fulcrum'] },
        { key: 'revit', name: 'Revit', icon: 'fas fa-building', aliases: ['revit', 'rvt'] },
        { key: 'autocad', name: 'AutoCAD', icon: 'fas fa-drafting-compass', aliases: ['autocad', 'acad', 'dwg'] },
        { key: 'enscape', name: 'Enscape', icon: 'fas fa-camera', aliases: ['enscape'] },
        { key: 'lumion', name: 'Lumion', icon: 'fas fa-lightbulb', aliases: ['lumion'] },
        { key: 'dynamo', name: 'Dynamo', icon: 'fas fa-code-branch', aliases: ['dynamo'] },
        { key: 'archicad', name: 'ArchiCAD', icon: 'fas fa-home', aliases: ['archicad', 'archi cad'] },
        { key: 'sketchup', name: 'SketchUp', icon: 'fas fa-cube', aliases: ['sketchup', 'sketch up'] },
        { key: 'tekla', name: 'Tekla', icon: 'fas fa-industry', aliases: ['tekla'] },
        { key: 'inventor', name: 'Inventor', icon: 'fas fa-cogs', aliases: ['inventor'] },
        { key: 'fusion-360', name: 'Fusion 360', icon: 'fas fa-draw-polygon', aliases: ['fusion 360', 'fusion360'] },
        { key: 'solidworks', name: 'SolidWorks', icon: 'fas fa-shapes', aliases: ['solidworks'] },
        { key: 'bentley', name: 'Bentley', icon: 'fas fa-bridge', aliases: ['bentley'] },
        { key: 'vray', name: 'V-Ray', icon: 'fas fa-sun', aliases: ['vray', 'v ray'] },
        { key: 'open-bim', name: 'Open BIM', icon: 'fas fa-cubes', aliases: ['open bim'] },
        { key: 'bim', name: 'BIM', icon: 'fas fa-cubes', aliases: ['building information modeling', 'bim'] }
    ];

    const CATEGORY_STOPWORDS = new Set([
        'and', 'atau', 'yang', 'dengan', 'untuk', 'the', 'how', 'to', 'use', 'using',
        'tutorial', 'tutorials', 'lesson', 'lessons', 'part', 'bagian', 'video', 'vidio',
        'learning', 'audio', 'visual', 'introduction', 'intro', 'complete', 'new',
        'features', 'feature', 'overview', 'basic', 'advanced', 'beginner', 'intermediate',
        'kelas', 'course', 'courses', 'training', 'day', 'batch', 'gmt', 'fps', 'with',
        'from', 'into', 'your', 'dan', 'pada', 'dalam', 'serta', 'ini', 'itu', 'for',
        'by', 'of', 'in', 'on', 'at', 'a', 'an'
    ]);

    const FINAL_CATEGORY_DEFINITIONS = {
        'civil-3d': { id: 'civil-3d', name: 'Civil 3D', icon: 'fas fa-road', order: 10 },
        'navisworks': { id: 'navisworks', name: 'Navisworks', icon: 'fas fa-project-diagram', order: 20 },
        'revit': { id: 'revit', name: 'Revit', icon: 'fas fa-building', order: 30 },
        'autocad': { id: 'autocad', name: 'AutoCAD', icon: 'fas fa-drafting-compass', order: 40 },
        'archicad': { id: 'archicad', name: 'ArchiCAD', icon: 'fas fa-home', order: 50 },
        'enscape': { id: 'enscape', name: 'Enscape', icon: 'fas fa-camera', order: 60 },
        'twinmotion': { id: 'twinmotion', name: 'Twinmotion', icon: 'fas fa-vr-cardboard', order: 65 },
        'infraworks': { id: 'infraworks', name: 'InfraWorks', icon: 'fas fa-city', order: 70 },
        'trimble-connect': { id: 'trimble-connect', name: 'Trimble Connect', icon: 'fas fa-network-wired', order: 80 },
        'plannerly': { id: 'plannerly', name: 'Plannerly', icon: 'fas fa-sitemap', order: 90 },
        'fulcrum': { id: 'fulcrum', name: 'Fulcrum', icon: 'fas fa-clipboard-check', order: 100 },
        'open-bim': { id: 'open-bim', name: 'Open BIM', icon: 'fas fa-cubes', order: 110 },
        'strubim-cype': { id: 'strubim-cype', name: 'StruBIM Cype', icon: 'fas fa-drafting-compass', order: 120 },
        'bim': { id: 'bim', name: 'BIM', icon: 'fas fa-cubes', order: 130 },
        'drone-survey': { id: 'drone-survey', name: 'Drone Survey', icon: 'fas fa-helicopter', order: 210 },
        'workflow': { id: 'workflow', name: 'Workflow', icon: 'fas fa-stream', order: 220 },
        'traffic-management': { id: 'traffic-management', name: 'Traffic Management', icon: 'fas fa-traffic-light', order: 230 },
        'design': { id: 'design', name: 'Design', icon: 'fas fa-pencil-ruler', order: 240 },
        'tender': { id: 'tender', name: 'Tender', icon: 'fas fa-file-signature', order: 250 },
        'work-stage': { id: 'work-stage', name: 'Work Stage', icon: 'fas fa-layer-group', order: 260 },
        'animasi': { id: 'animasi', name: 'Animasi', icon: 'fas fa-film', order: 270 },
        'projects': { id: 'projects', name: 'Projects / Case Studies', icon: 'fas fa-briefcase', order: 900 },
        'other': { id: 'other', name: 'Other', icon: 'fas fa-folder-open', order: 1000 }
    };

    const CATEGORY_MERGE_MAP = {
        'inspection-fulcrum': 'fulcrum',
        'mobile-fulcrum': 'fulcrum',
        'project-timeliner': 'navisworks',
        'timeliner': 'navisworks',
        'pelatihan-pengolahan': 'drone-survey',
        'whatsapp': 'other',
        'youcut': 'other',
        'udah-upload': 'other',
        'amman': 'projects',
        'amman-mineral': 'projects',
        'buin-batu': 'projects',
        'data-center': 'projects',
        'dinamika-kencana': 'projects',
        'guest-house': 'projects',
        'hemodialisis-depok': 'projects',
        'house': 'projects',
        'jakarta': 'projects',
        'makassar': 'projects',
        'nke': 'projects',
        'office': 'projects',
        'office-nke': 'projects',
        'oneject': 'projects',
        'oneject-cikarang': 'projects',
        'pondasi': 'projects',
        'pondasi-pipa': 'projects',
        'pondasi-reservoir': 'projects',
        'proyek-angkatan': 'projects',
        'proyek-fakultas': 'projects',
        'rsau': 'projects'
    };

    const videoCache = {
        tutorials: null,
        courses: null,
        lastUpdated: 0,
        cacheDuration: 5 * 60 * 1000
    };

    function normalizeCategorySlug(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function normalizeTitleForMatching(filename) {
        return path.parse(String(filename || '').toLowerCase()).name
            .replace(/[_\-().[\]]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function titleHasAlias(normalizedTitle, alias) {
        const normalizedAlias = String(alias || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!normalizedAlias) return false;
        return ` ${normalizedTitle} `.includes(` ${normalizedAlias} `);
    }

    function tokenizeVideoTitle(filename) {
        return normalizeTitleForMatching(filename)
            .split(' ')
            .filter((token) => {
                if (!token) return false;
                if (/^\d+$/.test(token)) return false;
                if (/^\d+(x\d+)+$/i.test(token)) return false;
                if (/^\d+(fps|p)$/i.test(token)) return false;
                if (/^\d{6,}$/.test(token)) return false;
                if (/^(mp4|avi|mov|webm|mkv|h264|lesson\d*|part\d*)$/.test(token)) return false;
                if (/^(hd|uhd|fullhd|version|ver|app|apps)$/i.test(token)) return false;
                if (CATEGORY_STOPWORDS.has(token)) return false;
                return token.length >= 3 || token === 'bim';
            });
    }

    function extractKeywordCandidates(filename) {
        const tokens = tokenizeVideoTitle(filename);
        const candidates = new Set(tokens);

        for (let index = 0; index < tokens.length - 1; index += 1) {
            candidates.add(`${tokens[index]} ${tokens[index + 1]}`);
        }

        return [...candidates];
    }

    function resolveExplicitVideoCategory(filename) {
        const rawName = String(filename || '');
        const baseName = path.parse(rawName).name.toLowerCase();
        const normalizedBaseName = normalizeTitleForMatching(rawName);

        if (baseName === '0718') {
            return { id: 'work-stage', key: 'work-stage', name: 'Work Stage', icon: 'fas fa-layer-group', source: 'explicit' };
        }

        if (/24fps\.mp4$/i.test(rawName)) {
            return { id: 'projects', key: 'projects', name: 'Projects / Case Studies', icon: 'fas fa-briefcase', source: 'explicit' };
        }

        const twinmotionOverrides = new Set([
            'flashclass day 1',
            'flashclass day 2',
            'twinmotion 2021 1 release trailer',
            'vrex bimcollab integration'
        ]);

        if (twinmotionOverrides.has(normalizedBaseName)) {
            return { id: 'twinmotion', key: 'twinmotion', name: 'Twinmotion', icon: 'fas fa-vr-cardboard', source: 'explicit' };
        }

        return null;
    }

    function buildKeywordFrequencyIndex(fileNames) {
        const counts = new Map();

        fileNames.forEach((fileName) => {
            const uniqueCandidates = new Set(extractKeywordCandidates(fileName));
            uniqueCandidates.forEach((candidate) => {
                counts.set(candidate, (counts.get(candidate) || 0) + 1);
            });
        });

        return counts;
    }

    function resolveVideoCategory(filename, keywordCounts) {
        const explicitCategory = resolveExplicitVideoCategory(filename);
        const normalizedTitle = normalizeTitleForMatching(filename);

        if (explicitCategory) {
            return explicitCategory;
        }

        for (const rule of CATEGORY_RULES) {
            if (rule.aliases.some((alias) => titleHasAlias(normalizedTitle, alias))) {
                return { id: rule.key, key: rule.key, name: rule.name, icon: rule.icon, source: 'keyword' };
            }
        }

        const dynamicCandidate = extractKeywordCandidates(filename)
            .filter((candidate) => (keywordCounts.get(candidate) || 0) >= 2)
            .sort((left, right) => {
                const leftWords = left.split(' ').length;
                const rightWords = right.split(' ').length;
                if (rightWords !== leftWords) return rightWords - leftWords;

                const leftCount = keywordCounts.get(left) || 0;
                const rightCount = keywordCounts.get(right) || 0;
                if (rightCount !== leftCount) return rightCount - leftCount;

                return right.length - left.length;
            })[0];

        if (dynamicCandidate) {
            const label = dynamicCandidate.replace(/\b\w/g, (char) => char.toUpperCase());
            const key = normalizeCategorySlug(dynamicCandidate) || 'other';
            return { id: key, key, name: label, icon: 'fas fa-play-circle', source: 'keyword' };
        }

        return { id: 'other', key: 'other', name: 'Other', icon: 'fas fa-play-circle', source: 'fallback' };
    }

    function normalizeFinalCategory(category) {
        const rawKey = normalizeCategorySlug(category?.key || category?.id || 'other') || 'other';
        const mergedKey = CATEGORY_MERGE_MAP[rawKey] || rawKey;
        const definition = FINAL_CATEGORY_DEFINITIONS[mergedKey] || FINAL_CATEGORY_DEFINITIONS.other;

        return {
            id: definition.id,
            key: definition.id,
            name: definition.name,
            icon: definition.icon,
            order: definition.order,
            source: category?.source || 'keyword'
        };
    }

    function findVideosInFolder(folder, maxDepth = 15, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            console.warn(`⚠️ Max depth reached for video search: ${folder}`);
            return [];
        }

        let videoFiles = [];

        try {
            if (!fs.existsSync(folder)) {
                console.warn(`⚠️ Video folder not found: ${folder}`);
                return [];
            }

            let items;
            try {
                items = fs.readdirSync(folder, { withFileTypes: true });
            } catch (readError) {
                console.error(`❌ Error reading directory: ${folder}`);
                return [];
            }

            for (const item of items) {
                try {
                    const fullPath = path.join(folder, item.name);

                    if (item.isDirectory()) {
                        if (excludedFolders.some(excluded =>
                            item.name.toLowerCase().includes(excluded.toLowerCase())
                        )) {
                            continue;
                        }
                        const subFiles = findVideosInFolder(fullPath, maxDepth, currentDepth + 1);
                        videoFiles = videoFiles.concat(subFiles);
                    } else {
                        const ext = path.extname(item.name).toLowerCase();
                        if (['.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv'].includes(ext)) {
                            videoFiles.push(fullPath);
                        }
                    }
                } catch (itemError) {
                    console.error(`❌ Error processing item in ${folder}:`, itemError.message);
                    continue;
                }
            }
        } catch (error) {
            console.error(`❌ Critical error reading video folder ${folder}:`, error.message);
        }

        return videoFiles;
    }

    function detectVideoCategory(filename) {
        return resolveVideoCategory(filename, buildKeywordFrequencyIndex([filename]));
    }

    async function refreshVideoCache() {
        console.log('🔄 Refreshing video cache...');
        try {
            const videos = [];
            const videoPaths = findVideosInFolder(baseDir);
            const keywordCounts = buildKeywordFrequencyIndex(videoPaths.map((videoPath) => path.basename(videoPath)));
            const categories = new Map();

            for (const videoPath of videoPaths) {
                const file = path.basename(videoPath);
                const sanitizedFileName = sanitizeFilenameForThumbnail(file);
                const thumbnailUrl = `/thumbnails/${sanitizedFileName}.jpg`;
                const relativePath = path.relative(baseDir, videoPath).replace(/\\/g, "/");
                const stats = fs.statSync(videoPath);
                const viewCount = getViewCount(sanitizedFileName);
                const category = normalizeFinalCategory(resolveVideoCategory(file, keywordCounts));

                const videoData = {
                    id: sanitizedFileName,
                    name: file,
                    size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                    path: relativePath.replace(/\\/g, "/"),
                    thumbnail: thumbnailUrl,
                    viewCount,
                    category: category.name,
                    categoryKey: category.key,
                    categorySource: category.source
                };

                videos.push(videoData);

                if (!categories.has(category.key)) {
                    categories.set(category.key, {
                        id: category.key,
                        title: category.name,
                        icon: category.icon,
                        videos: []
                    });
                }

                categories.get(category.key).videos.push(videoData);
            }

            let courses = Array.from(categories.values()).map((group) => {
                const courseVideos = [...group.videos].sort((left, right) => left.name.localeCompare(right.name));
                const representativeVideo = [...courseVideos].sort((left, right) => {
                    const leftThumbExists = left.thumbnail ? fs.existsSync(path.join(thumbnailDir, path.basename(left.thumbnail))) : false;
                    const rightThumbExists = right.thumbnail ? fs.existsSync(path.join(thumbnailDir, path.basename(right.thumbnail))) : false;

                    if (leftThumbExists !== rightThumbExists) {
                        return Number(rightThumbExists) - Number(leftThumbExists);
                    }

                    if (right.viewCount !== left.viewCount) {
                        return right.viewCount - left.viewCount;
                    }

                    return left.name.localeCompare(right.name);
                })[0];

                return {
                    id: group.id,
                    title: group.title,
                    description: `Kumpulan tutorial ${group.title} untuk pembelajaran BIM`,
                    thumbnail: representativeVideo.thumbnail,
                    videoCount: courseVideos.length,
                    representativeVideo: {
                        id: representativeVideo.id,
                        name: representativeVideo.name,
                        viewCount: representativeVideo.viewCount
                    },
                    icon: group.icon,
                    category: group.title,
                    categoryKey: group.id,
                    videos: courseVideos
                };
            });

            courses.sort((a, b) => {
                const leftOrder = FINAL_CATEGORY_DEFINITIONS[a.id]?.order ?? 5000;
                const rightOrder = FINAL_CATEGORY_DEFINITIONS[b.id]?.order ?? 5000;
                if (leftOrder !== rightOrder) {
                    return leftOrder - rightOrder;
                }

                return b.representativeVideo.viewCount - a.representativeVideo.viewCount || a.title.localeCompare(b.title);
            });

            videoCache.tutorials = videos;
            videoCache.courses = courses;
            videoCache.lastUpdated = Date.now();

            console.log(`✅ Cache refreshed: ${videos.length} videos, ${courses.length} categories`);
            return { success: true, videosCount: videos.length };
        } catch (error) {
            console.error('❌ Cache refresh failed:', error.message);
            console.error('❌ Stack:', error.stack);
            throw error;
        }
    }

    return {
        detectVideoCategory,
        findVideosInFolder,
        getViewCount,
        refreshVideoCache,
        videoCache
    };
}

module.exports = createVideoCatalogService;
