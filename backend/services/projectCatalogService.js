const fs = require("fs");
const path = require("path");

function createProjectCatalogService({
    buildYearMatchRegex,
    excludedFolders,
    execFile,
    extractYearFromLabel,
    findYearFolderForSource,
    normalizeYears,
    projectMediaUtilityService,
    projectSources,
    resolveSourcePath,
    validImageExt,
    validVideoExt
}) {
    const FFPROBE_CANDIDATES = [
        process.env.FFPROBE_PATH,
        process.env.FFPROBE_BIN,
        'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
        'C:\\ffmpeg\\bin\\ffprobe.exe',
        'ffprobe',
        '/usr/bin/ffprobe',
        '/usr/local/bin/ffprobe'
    ].filter(Boolean);
    const FFPROBE_BIN = findBinary(FFPROBE_CANDIDATES);
    const videoDurationCache = new Map();
    const PROJECT_MEDIA_JSON_CACHE_DIR = path.resolve(__dirname, '..', '..', 'data', 'projects-explorer-cache', 'media');
    let ffprobeAvailable = !!FFPROBE_BIN;

    try {
        fs.mkdirSync(PROJECT_MEDIA_JSON_CACHE_DIR, { recursive: true });
    } catch (error) {
        // Ignore cache directory init failures.
    }

    function getEnabledSources() {
        return projectSources.filter(source => source && source.enabled);
    }

    function getEnabledSourcesForScan(sourceId = null) {
        const enabledSources = getEnabledSources();
        if (!sourceId) {
            return enabledSources;
        }

        return enabledSources.filter(source => source.id === sourceId);
    }

    function buildProjectMediaCacheFileName(year, sourceId, projectName) {
        const safe = (value) => encodeURIComponent(String(value || '').trim()).replace(/%/g, '_');
        return `${safe(year)}__${safe(sourceId || 'unknown')}__${safe(projectName)}.json`;
    }

    function getProjectMediaCacheFilePath(year, sourceId, projectName) {
        return path.join(PROJECT_MEDIA_JSON_CACHE_DIR, buildProjectMediaCacheFileName(year, sourceId, projectName));
    }

    function readProjectMediaCache(year, sourceId, projectName) {
        const cachePath = getProjectMediaCacheFilePath(year, sourceId, projectName);
        try {
            if (!fs.existsSync(cachePath)) {
                return null;
            }

            const raw = fs.readFileSync(cachePath, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function writeProjectMediaCache(year, sourceId, projectName, payload) {
        const cachePath = getProjectMediaCacheFilePath(year, sourceId, projectName);
        try {
            fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf8');
        } catch (error) {
            // Cache write failure should not block primary response.
        }
    }

    function getProjectScanConfig(source) {
        const sourceId = String(source && source.id ? source.id : '').toLowerCase();
        if (sourceId.startsWith('pc-bim02')) {
            return {
                maxDepth: 12,
                excludedFolders: ['clash', 'Clash Detection', 'Texture Image Marbel']
            };
        }

        return {
            maxDepth: 5,
            excludedFolders: excludedFolders
        };
    }

    function getProjectScanConfigForSourcePath(sourcePath, projectPath) {
        const normalizedSourcePath = String(sourcePath || '').toLowerCase();
        const normalizedProjectPath = String(projectPath || '').toLowerCase();
        if (normalizedSourcePath.includes('\\pc-bim02')
            || normalizedProjectPath.includes('\\pc-bim02')
            || normalizedSourcePath.includes('project bim 2025')
            || normalizedProjectPath.includes('project bim 2025')
            || normalizedSourcePath.includes('project bim 2026')
            || normalizedProjectPath.includes('project bim 2026')) {
            return getProjectScanConfig({ id: 'pc-bim02-detected' });
        }

        return getProjectScanConfig(null);
    }

    function shouldSkipProjectFolder(folderName, scanExcludedFolders = excludedFolders) {
        const normalizedName = String(folderName || '').toLowerCase();
        return scanExcludedFolders.some(excluded =>
            normalizedName.includes(String(excluded || '').toLowerCase())
        );
    }

    function findMediaRecursive(dir, maxDepth = 5, currentDepth = 0, baseDir, mediaRoute = '/media', scanConfig = null) {
        const effectiveBaseDir = baseDir || dir;
        const scanExcludedFolders = scanConfig && Array.isArray(scanConfig.excludedFolders)
            ? scanConfig.excludedFolders
            : excludedFolders;

        if (currentDepth >= maxDepth) {
            console.warn(`⚠️ Max depth reached for: ${dir}`);
            return [];
        }

        let mediaFiles = [];

        try {
            if (!fs.existsSync(dir)) {
                console.warn(`⚠️ Directory not found: ${dir}`);
                return [];
            }

            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    if (shouldSkipProjectFolder(item.name, scanExcludedFolders)) {
                        continue;
                    }
                    mediaFiles = mediaFiles.concat(
                        findMediaRecursive(fullPath, maxDepth, currentDepth + 1, effectiveBaseDir, mediaRoute, scanConfig)
                    );
                } else {
                    const ext = path.extname(item.name).toLowerCase();
                    if (validImageExt.includes(ext) || validVideoExt.includes(ext)) {
                        const relativePath = path.relative(effectiveBaseDir, fullPath).split(path.sep).join('/');
                        mediaFiles.push(`${mediaRoute}/${encodeURI(relativePath)}`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error reading directory ${dir}:`, error.message);
        }

        return mediaFiles;
    }

    function findThumbnailInFolderFromSource(basePath, folderPattern, sourcePath, isRoot = false, mediaRoute = '/media') {
        try {
            let searchPath = basePath;

            if (!isRoot && folderPattern) {
                const subfolders = fs.readdirSync(basePath, { withFileTypes: true })
                    .filter(item => item.isDirectory() && folderPattern.test(item.name));

                if (subfolders.length === 0) return null;
                searchPath = path.join(basePath, subfolders[0].name);
            }

            if (!fs.existsSync(searchPath)) return null;

            const files = fs.readdirSync(searchPath);
            const imageFile = files.find(file => validImageExt.includes(path.extname(file).toLowerCase()));

            if (imageFile) {
                const relativePath = path.relative(sourcePath, path.join(searchPath, imageFile)).split(path.sep).join('/');
                return `${mediaRoute}/${encodeURI(relativePath)}`;
            }
        } catch (error) {
            console.warn(`⚠️ Error searching folder:`, error.message);
        }

        return null;
    }

    function findThumbnailInSubfoldersFromSource(projectPath, sourcePath, mediaRoute = '/media') {
        try {
            const items = fs.readdirSync(projectPath, { withFileTypes: true });

            for (const item of items) {
                if (item.isDirectory()) {
                    const subPath = path.join(projectPath, item.name);
                    const thumbnail = findThumbnailInFolderFromSource(subPath, null, sourcePath, true, mediaRoute);
                    if (thumbnail) return thumbnail;
                }
            }
        } catch (error) {
            console.warn(`⚠️ Error searching subfolders:`, error.message);
        }

        return null;
    }

    function findThumbnailRecursiveFromSource(projectPath, sourcePath, mediaRoute = '/media', scanConfig = null) {
        const effectiveConfig = scanConfig || getProjectScanConfigForSourcePath(sourcePath, projectPath);
        const mediaFiles = findMediaRecursive(
            projectPath,
            Math.max(6, effectiveConfig.maxDepth || 5),
            0,
            sourcePath,
            mediaRoute,
            effectiveConfig
        );

        return mediaFiles.find(url =>
            validImageExt.includes(path.extname(String(url).split('?')[0]).toLowerCase())
        ) || null;
    }

    function findProjectThumbnailFromSource(projectPath, year, projectName, sourcePath, mediaRoute = '/media') {
        const scanConfig = getProjectScanConfigForSourcePath(sourcePath, projectPath);
        const thumbnailPriority = [
            () => findThumbnailInFolderFromSource(projectPath, /render|presentasi/i, sourcePath, false, mediaRoute),
            () => findThumbnailInSubfoldersFromSource(projectPath, sourcePath, mediaRoute),
            () => findThumbnailInFolderFromSource(projectPath, null, sourcePath, true, mediaRoute),
            () => findThumbnailRecursiveFromSource(projectPath, sourcePath, mediaRoute, scanConfig)
        ];

        for (const priorityFunc of thumbnailPriority) {
            try {
                const thumbnail = priorityFunc();
                if (thumbnail) {
                    return thumbnail;
                }
            } catch (error) {
                console.warn(`⚠️ Thumbnail search failed for ${projectName}:`, error.message);
            }
        }

        return null;
    }

    function countProjectMedia(projectPath, baseDir, mediaRoute = '/media', scanConfig = null) {
        try {
            const effectiveConfig = scanConfig || getProjectScanConfigForSourcePath(baseDir, projectPath);
            const mediaFiles = findMediaRecursive(
                projectPath,
                Math.max(5, effectiveConfig.maxDepth || 5),
                0,
                baseDir,
                mediaRoute,
                effectiveConfig
            );
            return mediaFiles.length;
        } catch (error) {
            console.warn(`⚠️ Error counting media:`, error.message);
            return 0;
        }
    }

    async function getYearsFromMultipleSources() {
        const allYears = new Set();
        const yearsBySource = {};
        const LANMountManager = require('../utils/lanMountManager');
        const lanManager = new LANMountManager();

        for (const source of getEnabledSources()) {
            yearsBySource[source.id] = [];

            try {
                const sourcePath = await resolveSourcePath(source, lanManager, { timeoutMs: 3000 });

                if (!sourcePath) {
                    console.warn(`⚠️ Source path not available for ${source.id}`);
                    if (source.mountId && !source.rootScan) {
                        const mount = lanManager.getMountById(source.mountId);
                        if (mount) {
                            const yearRegex = buildYearMatchRegex(source.folderPattern);
                            const candidates = [mount.shareName, mount.remotePath ? path.basename(mount.remotePath) : '', mount.name]
                                .filter(Boolean);
                            const hintedYears = candidates
                                .map(candidate => {
                                    const match = candidate.match(yearRegex);
                                    return match && match[1] ? match[1] : null;
                                })
                                .filter(Boolean);
                            const normalizedHintedYears = normalizeYears(hintedYears);
                            if (normalizedHintedYears.length > 0) {
                                yearsBySource[source.id] = normalizedHintedYears;
                                normalizedHintedYears.forEach(year => allYears.add(year));
                            }
                        }
                    }
                    continue;
                }

                if (!source.mountId && !fs.existsSync(sourcePath)) {
                    console.warn(`⚠️ Source path not found for ${source.id}: ${sourcePath}`);
                    continue;
                }

                let years = [];

                if (source.rootScan) {
                    if (Array.isArray(source.fixedYears) && source.fixedYears.length > 0) {
                        years = normalizeYears(source.fixedYears);
                    } else {
                        let detectedYear = extractYearFromLabel(sourcePath);
                        if (!detectedYear && source.mountId) {
                            const mount = lanManager.getMountById(source.mountId);
                            if (mount) {
                                detectedYear = extractYearFromLabel(mount.shareName)
                                    || extractYearFromLabel(mount.remotePath)
                                    || extractYearFromLabel(mount.name);
                            }
                        }
                        years = normalizeYears(detectedYear ? [detectedYear] : []);
                    }
                    console.log(`✅ ${source.id}: ROOT scan source - detected years: ${years.join(', ') || 'none'}`);
                } else {
                    const items = fs.readdirSync(sourcePath, { withFileTypes: true });
                    const yearRegex = buildYearMatchRegex(source.folderPattern);
                    years = items
                        .filter(item => item.isDirectory() && yearRegex.test(item.name))
                        .map(item => {
                            const match = item.name.match(yearRegex);
                            return match && match[1] ? match[1] : null;
                        })
                        .filter(Boolean);

                    const sourceBaseName = path.basename(sourcePath);
                    if (yearRegex.test(sourceBaseName)) {
                        const match = sourceBaseName.match(yearRegex);
                        if (match && match[1] && !years.includes(match[1])) {
                            years.push(match[1]);
                        }
                    }

                    if (source.mountId) {
                        const mount = lanManager.getMountById(source.mountId);
                        if (mount) {
                            const mountName = mount.shareName || '';
                            const remoteBase = mount.remotePath ? path.basename(mount.remotePath) : '';
                            const candidates = [mountName, remoteBase, mount.name].filter(Boolean);
                            for (const candidate of candidates) {
                                if (yearRegex.test(candidate)) {
                                    const match = candidate.match(yearRegex);
                                    if (match && match[1] && !years.includes(match[1])) {
                                        years.push(match[1]);
                                    }
                                }
                            }
                        }
                    }

                    years = normalizeYears(years);
                    console.log(`✅ ${source.id}: Found ${years.length} years using pattern "${source.folderPattern}"`);
                }

                yearsBySource[source.id] = years;
                years.forEach(year => allYears.add(year));
            } catch (error) {
                console.warn(`⚠️ Error scanning ${source.id}:`, error.message);
            }
        }

        return {
            years: Array.from(allYears).sort((a, b) => b.localeCompare(a)),
            yearsBySource
        };
    }

    async function getProjectsFromMultipleSources(year, sourceId = null) {
        const allProjects = new Map();
        const hiddenProjects = [];
        const LANMountManager = require('../utils/lanMountManager');
        const lanManager = new LANMountManager();

        for (const source of getEnabledSourcesForScan(sourceId)) {
            try {
                const mount = source.mountId ? lanManager.getMountById(source.mountId) : null;
                const sourcePath = await resolveSourcePath(source, lanManager, { timeoutMs: 5000 });

                if (!sourcePath) {
                    console.warn(`⚠️ Source path not available for ${source.id}`);
                    continue;
                }

                if (!source.mountId && !fs.existsSync(sourcePath)) {
                    console.warn(`⚠️ Source path not found for ${source.id}: ${sourcePath}`);
                    continue;
                }

                let projectDir;
                let projectFolders;

                if (source.rootScan) {
                    projectDir = sourcePath;
                    projectFolders = fs.readdirSync(projectDir, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory());

                    console.log(`✅ ${source.id}: ROOT scan - Found ${projectFolders.length} project folders directly in ${projectDir}`);
                } else {
                    const yearFolder = findYearFolderForSource(sourcePath, source, year, mount);
                    if (!yearFolder || !fs.existsSync(yearFolder.path)) {
                        console.log(`📂 ${source.id}: No ${source.folderPattern.replace('{year}', year)} folder found`);
                        continue;
                    }
                    projectDir = yearFolder.path;
                    projectFolders = fs.readdirSync(projectDir, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory());

                    console.log(`✅ ${source.id}: Found ${projectFolders.length} project folders in ${yearFolder.name}`);
                }

                for (const folder of projectFolders) {
                    const projectName = folder.name;
                    const projectPath = path.join(projectDir, projectName);

                    try {
                        const scanConfig = getProjectScanConfig(source);
                        const thumbnail = findProjectThumbnailFromSource(projectPath, year, projectName, sourcePath, source.mediaRoute);
                        const mediaCount = countProjectMedia(projectPath, sourcePath, source.mediaRoute, scanConfig);
                        const isAlwaysIncludedSource = source.id === 'pc-bim02-2025';

                        if (mediaCount > 0 || thumbnail || isAlwaysIncludedSource) {
                            const projectKey = `${projectName}_${source.id}`;
                            allProjects.set(projectKey, {
                                name: projectName,
                                sourceId: source.id,
                                source: source.name,
                                thumbnail,
                                mediaCount,
                                firstImage: thumbnail,
                                path: projectPath
                            });
                        } else {
                            hiddenProjects.push({
                                name: projectName,
                                sourceId: source.id,
                                source: source.name,
                                reason: 'no_visual_media',
                                mediaCount
                            });
                        }
                    } catch (error) {
                        console.warn(`⚠️ Skipping project ${projectName} from ${source.id}:`, error.message);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Error scanning projects in ${source.id}:`, error.message);
            }
        }

        return {
            projects: Array.from(allProjects.values()),
            hiddenProjects
        };
    }

    async function getProjectMedia(year, project, sourceId) {
        const cached = readProjectMediaCache(year, sourceId, project);
        if (cached) {
            return cached;
        }

        let projectPath = null;
        let foundSource = null;
        let foundSourcePath = null;
        const LANMountManager = require('../utils/lanMountManager');
        const lanManager = new LANMountManager();

        for (const source of getEnabledSources()) {
            if (sourceId && source.id !== sourceId) continue;

            try {
                const mount = source.mountId ? lanManager.getMountById(source.mountId) : null;
                const sourcePath = await resolveSourcePath(source, lanManager, { timeoutMs: 8000 });

                if (!sourcePath) {
                    console.warn(`⚠️ Source path not available for ${source.id}`);
                    continue;
                }

                if (!source.mountId && !fs.existsSync(sourcePath)) {
                    console.warn(`⚠️ Source path not found for ${source.id}: ${sourcePath}`);
                    continue;
                }

                if (source.rootScan) {
                    projectPath = path.join(sourcePath, project);
                    if (fs.existsSync(projectPath)) {
                        foundSource = source;
                        foundSourcePath = sourcePath;
                        break;
                    }
                } else {
                    const yearFolder = findYearFolderForSource(sourcePath, source, year, mount);
                    if (!yearFolder || !fs.existsSync(yearFolder.path)) {
                        continue;
                    }
                    projectPath = path.join(yearFolder.path, project);
                    if (fs.existsSync(projectPath)) {
                        foundSource = source;
                        foundSourcePath = sourcePath;
                        break;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        if (!projectPath || !foundSource) {
            return null;
        }

        let media = [];
        let scannedFolders = 0;
        let mediaDetails = [];

        try {
            const baseDir = foundSourcePath || path.resolve('.');
            const mediaRoute = foundSource.mediaRoute || '/media';
            const scanConfig = getProjectScanConfig(foundSource);

            media = findMediaRecursive(projectPath, Math.max(5, scanConfig.maxDepth || 5), 0, baseDir, mediaRoute, scanConfig);
            scannedFolders = 1;

            console.log(`📁 Scanned project directory for media: ${media.length} files found using route ${mediaRoute}`);
        } catch (error) {
            console.warn('⚠️ Error scanning project directory:', error.message);
        }

        try {
            mediaDetails = await buildMediaDetails(media);
        } catch (error) {
            console.warn('⚠️ Error building media details:', error.message);
        }

        const payload = {
            year,
            project,
            media,
            mediaDetails,
            totalMedia: media.length,
            scannedFolders,
            sourceId: foundSource.id,
            sourceName: foundSource.name,
            message: foundSource.rootScan ? 'Root scan project - scanned all folders' : 'Project folder scan complete'
        };

        writeProjectMediaCache(year, foundSource.id, project, payload);
        return payload;
    }

    function getDurationCacheKey(filePath, stat) {
        const size = stat && typeof stat.size === 'number' ? stat.size : 0;
        const mtime = stat && typeof stat.mtimeMs === 'number' ? Math.round(stat.mtimeMs) : 0;
        return `${filePath}|${size}|${mtime}`;
    }

    async function getVideoDurationSeconds(filePath, stat) {
        if (!ffprobeAvailable || !FFPROBE_BIN) {
            return null;
        }

        const cacheKey = getDurationCacheKey(filePath, stat);
        if (videoDurationCache.has(cacheKey)) {
            return videoDurationCache.get(cacheKey);
        }

        return new Promise((resolve) => {
            const args = [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'json',
                filePath
            ];

            execFile(FFPROBE_BIN, args, { timeout: 20000, windowsHide: true }, (error, stdout) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        ffprobeAvailable = false;
                    }
                    resolve(null);
                    return;
                }

                try {
                    const data = JSON.parse(stdout);
                    const duration = parseFloat(data && data.format ? data.format.duration : '');
                    const durationSeconds = Number.isFinite(duration) ? duration : null;
                    if (durationSeconds !== null) {
                        videoDurationCache.set(cacheKey, durationSeconds);
                    }
                    resolve(durationSeconds);
                } catch (parseError) {
                    resolve(null);
                }
            });
        });
    }

    async function mapWithConcurrency(items, limit, task) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const results = new Array(items.length);
        let nextIndex = 0;
        const workerCount = Math.min(limit, items.length);

        const workers = Array.from({ length: workerCount }, async () => {
            while (true) {
                const current = nextIndex;
                nextIndex += 1;
                if (current >= items.length) break;
                results[current] = await task(items[current], current);
            }
        });

        await Promise.all(workers);
        return results;
    }

    async function buildMediaDetails(mediaUrls) {
        if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
            return [];
        }

        return mapWithConcurrency(mediaUrls, 3, async (url) => {
            const filePath = projectMediaUtilityService.resolveMediaFileFromUrl(url);
            const displayUrl = projectMediaUtilityService.buildProjectMediaDisplayUrl(url);
            if (!filePath) {
                return { url, displayUrl, sizeBytes: null, durationSeconds: null };
            }

            let stat;
            try {
                stat = await projectMediaUtilityService.statFileWithTimeout(filePath);
            } catch (error) {
                return { url, displayUrl, sizeBytes: null, durationSeconds: null };
            }

            const sizeBytes = stat.size;
            const ext = path.extname(filePath).toLowerCase();
            const isVideo = validVideoExt.includes(ext);
            const durationSeconds = isVideo ? await getVideoDurationSeconds(filePath, stat) : null;

            return { url, displayUrl, sizeBytes, durationSeconds };
        });
    }

    function findBinary(pathList) {
        for (const binPath of pathList) {
            if (!binPath) continue;
            if (path.isAbsolute(binPath)) {
                if (fs.existsSync(binPath)) {
                    return binPath;
                }
                continue;
            }
            return binPath;
        }
        return null;
    }

    return {
        getEnabledSources,
        getProjectMedia,
        getProjectsFromMultipleSources,
        getYearsFromMultipleSources
    };
}

module.exports = createProjectCatalogService;
