const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../utils/auth');
const router = express.Router();
router.use(requireAdmin);

// BIM Media Tags Storage
const BIM_MEDIA_TAGS_FILE = path.join(__dirname, '..', 'bim-media-tags.json');

// Helper function to read BIM media tags
function readBIMMediaTags() {
    try {
        if (!fs.existsSync(BIM_MEDIA_TAGS_FILE)) {
            // Create default structure if file doesn't exist
            const defaultData = {
                media: {},
                collections: {},
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(BIM_MEDIA_TAGS_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(BIM_MEDIA_TAGS_FILE, 'utf-8'));
    } catch (error) {
        console.error('Error reading BIM media tags:', error);
        return { media: {}, collections: {}, lastUpdated: new Date().toISOString() };
    }
}

// Helper function to write BIM media tags
function writeBIMMediaTags(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(BIM_MEDIA_TAGS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing BIM media tags:', error);
        return false;
    }
}

// Available media sources
const MEDIA_SOURCES = [
    {
        id: 'local-g-drive',
        name: 'Local G Drive',
        path: 'G:/',
        type: 'local'
    },
    {
        id: 'pc-bim02',
        name: 'PC-BIM02 Network Share',
        path: '\\\\pc-bim02\\PROJECT BIM 2025',
        type: 'network'
    }
];

// GET /api/admin/bim-media/sources - Get available media sources
router.get('/sources', (req, res) => {
    res.json(MEDIA_SOURCES);
});

// GET /api/admin/bim-media/files - Scan files from a source
router.get('/files', (req, res) => {
    const { source } = req.query;

    if (!source) {
        return res.status(400).json({ error: 'Source parameter is required' });
    }

    const sourceConfig = MEDIA_SOURCES.find(s => s.id === source);
    if (!sourceConfig) {
        return res.status(404).json({ error: 'Source not found' });
    }

    try {
        const files = scanMediaFiles(sourceConfig);
        res.json(files);
    } catch (error) {
        console.error('Error scanning media files:', error);
        res.status(500).json({ error: 'Failed to scan media files', detail: error.message });
    }
});

// POST /api/admin/bim-media/tags - Save tags for a media file
router.post('/tags', (req, res) => {
    const {
        filePath,
        fileName,
        fileType,
        year,
        location,
        bimDimension,
        type,
        description
    } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }

    try {
        const tagsData = readBIMMediaTags();

        // Create or update media tags
        tagsData.media[filePath] = {
            fileName,
            fileType,
            year,
            location,
            bimDimension,
            type,
            description,
            taggedAt: new Date().toISOString(),
            taggedBy: (req.authUser && (req.authUser.username || req.authUser.email)) || 'admin'
        };

        // Update collections
        updateCollections(tagsData);

        if (writeBIMMediaTags(tagsData)) {
            console.log(`✅ Media tags saved for: ${fileName}`);
            res.json({ success: true, message: 'Media tags saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save media tags' });
        }
    } catch (error) {
        console.error('Error saving media tags:', error);
        res.status(500).json({ error: 'Failed to save media tags', detail: error.message });
    }
});

// GET /api/admin/bim-media/tags/:filePath - Get tags for a specific file
router.get('/tags/:filePath(*)', (req, res) => {
    const filePath = req.params.filePath;

    try {
        const tagsData = readBIMMediaTags();
        const tags = tagsData.media[filePath];

        if (tags) {
            res.json(tags);
        } else {
            res.status(404).json({ error: 'No tags found for this file' });
        }
    } catch (error) {
        console.error('Error getting media tags:', error);
        res.status(500).json({ error: 'Failed to get media tags', detail: error.message });
    }
});

// GET /api/admin/bim-media/tags - Get all tagged media
router.get('/tags', (req, res) => {
    try {
        const tagsData = readBIMMediaTags();
        const taggedMedia = Object.entries(tagsData.media).map(([filePath, tags]) => ({
            filePath,
            ...tags
        }));

        res.json({
            totalTagged: taggedMedia.length,
            totalCategories: Object.keys(tagsData.collections).length,
            media: taggedMedia
        });
    } catch (error) {
        console.error('Error getting all media tags:', error);
        res.status(500).json({ error: 'Failed to get media tags', detail: error.message });
    }
});

// GET /api/admin/bim-media/stats - Get tagging statistics
router.get('/stats', (req, res) => {
    try {
        const tagsData = readBIMMediaTags();
        const taggedMedia = Object.values(tagsData.media);

        const stats = {
            totalTagged: taggedMedia.length,
            totalCategories: Object.keys(tagsData.collections).length,
            byYear: {},
            byLocation: {},
            byBIMDimension: {},
            byType: {},
            lastUpdated: tagsData.lastUpdated
        };

        // Calculate statistics
        taggedMedia.forEach(media => {
            if (media.year) {
                stats.byYear[media.year] = (stats.byYear[media.year] || 0) + 1;
            }
            if (media.location) {
                stats.byLocation[media.location] = (stats.byLocation[media.location] || 0) + 1;
            }
            if (media.bimDimension) {
                stats.byBIMDimension[media.bimDimension] = (stats.byBIMDimension[media.bimDimension] || 0) + 1;
            }
            if (media.type) {
                stats.byType[media.type] = (stats.byType[media.type] || 0) + 1;
            }
        });

        res.json(stats);
    } catch (error) {
        console.error('Error getting tagging stats:', error);
        res.status(500).json({ error: 'Failed to get tagging statistics', detail: error.message });
    }
});

// DELETE /api/admin/bim-media/tags/:filePath - Remove tags for a file
router.delete('/tags/:filePath(*)', (req, res) => {
    const filePath = req.params.filePath;

    try {
        const tagsData = readBIMMediaTags();

        if (tagsData.media[filePath]) {
            delete tagsData.media[filePath];
            updateCollections(tagsData);

            if (writeBIMMediaTags(tagsData)) {
                console.log(`✅ Media tags removed for: ${filePath}`);
                res.json({ success: true, message: 'Media tags removed successfully' });
            } else {
                res.status(500).json({ error: 'Failed to remove media tags' });
            }
        } else {
            res.status(404).json({ error: 'No tags found for this file' });
        }
    } catch (error) {
        console.error('Error removing media tags:', error);
        res.status(500).json({ error: 'Failed to remove media tags', detail: error.message });
    }
});

// Helper function to scan media files from a source - REAL DIRECTORY SCANNING
function scanMediaFiles(sourceConfig) {
    console.log(`🔍 Scanning media source: ${sourceConfig.id} - ${sourceConfig.path}`);

    const files = [];
    const validExtensions = ['.mp4', '.mov', '.avi', '.webm', '.jpg', '.jpeg', '.png', '.gif'];

    try {
        let basePath;
        let mediaBaseUrl;

        if (sourceConfig.id === 'local-g-drive') {
            basePath = sourceConfig.path;
            mediaBaseUrl = '/media';
        } else if (sourceConfig.id === 'pc-bim02') {
            basePath = sourceConfig.path;
            mediaBaseUrl = '/media-bim02';
        } else {
            throw new Error(`Unsupported source: ${sourceConfig.id}`);
        }

        // Check if base path exists
        if (!fs.existsSync(basePath)) {
            console.warn(`⚠️ Source path does not exist: ${basePath}`);
            // Return empty array instead of throwing error
            console.log(`ℹ️ Returning empty file list for ${sourceConfig.id}`);
            return [];
        }

        console.log(`📂 Scanning directory: ${basePath}`);

        // Scan for project directories
        const projectDirs = scanProjectDirectories(basePath, sourceConfig);

        console.log(`📁 Found ${projectDirs.length} project directories`);

        // For each project directory, scan for media files
        for (const projectDir of projectDirs) {
            try {
                const projectPath = path.join(basePath, projectDir);
                const mediaFiles = scanMediaInProject(projectPath, validExtensions);

                for (const mediaFile of mediaFiles) {
                    const fullPath = path.join(projectPath, mediaFile);
                    const relativePath = path.relative(basePath, fullPath);

                    try {
                        const stats = fs.statSync(fullPath);
                        const ext = path.extname(mediaFile).toLowerCase();

                        files.push({
                            path: fullPath,
                            name: mediaFile,
                            type: getFileType(ext),
                            size: stats.size,
                            lastModified: stats.mtime.toISOString(),
                            url: `${mediaBaseUrl}/${encodeURIComponent(relativePath.replace(/\\/g, '/'))}`
                        });
                    } catch (statError) {
                        console.warn(`⚠️ Could not get stats for ${fullPath}:`, statError.message);
                    }
                }
            } catch (projectError) {
                console.warn(`⚠️ Error scanning project ${projectDir}:`, projectError.message);
            }
        }

        // Check existing tags
        const tagsData = readBIMMediaTags();

        console.log(`✅ Found ${files.length} media files in source ${sourceConfig.id}`);

        return files.map(file => ({
            ...file,
            tagged: !!tagsData.media[file.path]
        }));

    } catch (error) {
        console.error('❌ Error scanning media files:', error);
        // Return empty array instead of throwing error to prevent UI breakage
        return [];
    }
}

// Helper function to scan project directories
function scanProjectDirectories(basePath, sourceConfig) {
    try {
        const items = fs.readdirSync(basePath, { withFileTypes: true });
        const projectDirs = [];

        if (sourceConfig.id === 'local-g-drive') {
            // For local G drive, look for PROJECT XXXX folders
            for (const item of items) {
                if (item.isDirectory() && item.name.startsWith('PROJECT ')) {
                    const year = item.name.replace('PROJECT ', '');
                    if (/^\d{4}$/.test(year)) {
                        // Found a PROJECT XXXX folder, now scan its subdirectories
                        const projectPath = path.join(basePath, item.name);
                        try {
                            const subItems = fs.readdirSync(projectPath, { withFileTypes: true });
                            for (const subItem of subItems) {
                                if (subItem.isDirectory()) {
                                    projectDirs.push(path.join(item.name, subItem.name));
                                }
                            }
                        } catch (subError) {
                            console.warn(`⚠️ Could not scan ${projectPath}:`, subError.message);
                        }
                    }
                }
            }
        } else if (sourceConfig.id === 'pc-bim02') {
            // For PC-BIM02, scan all directories directly
            for (const item of items) {
                if (item.isDirectory()) {
                    projectDirs.push(item.name);
                }
            }
        }

        return projectDirs;
    } catch (error) {
        console.warn(`⚠️ Error scanning project directories:`, error.message);
        return [];
    }
}

// BIM-specific folder keywords for targeted scanning
const BIM_FOLDER_KEYWORDS = ['render', 'presentation', '4D', 'timeliner'];

// Helper function to check if folder name contains BIM keywords
function isBIMMediaFolder(folderName) {
    if (!folderName) return false;
    const lowerName = folderName.toLowerCase();
    return BIM_FOLDER_KEYWORDS.some(keyword => lowerName.includes(keyword.toLowerCase()));
}

// Helper function to scan media files in a project directory with BIM-specific filtering
function scanMediaInProject(projectPath, validExtensions) {
    const mediaFiles = [];
    let totalScanned = 0;
    const maxFiles = 1000; // Safety limit to prevent memory issues

    try {
        console.log(`🔍 Starting BIM-targeted scan of project: ${path.basename(projectPath)}`);
        console.log(`🎯 Looking for folders with keywords: ${BIM_FOLDER_KEYWORDS.join(', ')}`);

        // First pass: Find BIM-specific folders
        const bimFolders = findBIMMediaFolders(projectPath);
        console.log(`📁 Found ${bimFolders.length} BIM media folders: ${bimFolders.map(f => path.basename(f)).join(', ')}`);

        // Second pass: Scan only BIM folders for media files
        for (const bimFolder of bimFolders) {
            if (totalScanned >= maxFiles) {
                console.log(`⏹️ Max files limit reached (${maxFiles})`);
                break;
            }

            try {
                console.log(`🎬 Scanning BIM folder: ${path.basename(bimFolder)}`);
                const folderMediaFiles = scanMediaInBIMFolder(bimFolder, validExtensions, totalScanned, maxFiles);

                for (const mediaFile of folderMediaFiles) {
                    const fullPath = path.join(bimFolder, mediaFile);
                    const relativePath = path.relative(projectPath, fullPath);
                    mediaFiles.push(relativePath);
                    totalScanned++;

                    if (totalScanned >= maxFiles) break;
                }

                console.log(`📊 ${path.basename(bimFolder)}: ${folderMediaFiles.length} media files found`);
            } catch (folderError) {
                console.warn(`⚠️ Error scanning BIM folder ${bimFolder}:`, folderError.message);
            }
        }

        console.log(`✅ Completed BIM-targeted scan: ${mediaFiles.length} media files found in ${bimFolders.length} BIM folders`);

    } catch (error) {
        console.warn(`⚠️ Error in BIM project scan ${projectPath}:`, error.message);
    }

    return mediaFiles;
}

// Helper function to find BIM-specific folders in a project
function findBIMMediaFolders(projectPath) {
    const bimFolders = [];

    try {
        const items = fs.readdirSync(projectPath, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                const folderName = item.name;
                const folderPath = path.join(projectPath, folderName);

                // Check if this folder contains BIM keywords
                if (isBIMMediaFolder(folderName)) {
                    bimFolders.push(folderPath);
                    console.log(`🎯 Found BIM folder: ${folderName}`);
                } else {
                    // Also check subfolders (one level deep) for BIM keywords
                    try {
                        const subItems = fs.readdirSync(folderPath, { withFileTypes: true });
                        for (const subItem of subItems) {
                            if (subItem.isDirectory() && isBIMMediaFolder(subItem.name)) {
                                const subFolderPath = path.join(folderPath, subItem.name);
                                bimFolders.push(subFolderPath);
                                console.log(`🎯 Found BIM subfolder: ${folderName}/${subItem.name}`);
                            }
                        }
                    } catch (subError) {
                        // Ignore subfolder scanning errors
                    }
                }
            }
        }
    } catch (error) {
        console.warn(`⚠️ Error finding BIM folders in ${projectPath}:`, error.message);
    }

    return bimFolders;
}

// Helper function to scan media files in a specific BIM folder
function scanMediaInBIMFolder(bimFolderPath, validExtensions, currentTotal, maxFiles) {
    const mediaFiles = [];

    try {
        // Recursively scan BIM folder for media files
        function scanBIMFolder(currentPath, depth = 0) {
            if (depth > 3) return; // Limit depth within BIM folder
            if (currentTotal + mediaFiles.length >= maxFiles) return;

            try {
                const items = fs.readdirSync(currentPath, { withFileTypes: true });

                for (const item of items) {
                    const itemPath = path.join(currentPath, item.name);

                    if (item.isDirectory()) {
                        // Continue scanning subfolders in BIM folder
                        scanBIMFolder(itemPath, depth + 1);
                    } else {
                        const ext = path.extname(item.name).toLowerCase();
                        if (validExtensions.includes(ext)) {
                            // Get relative path from BIM folder root
                            const relativePath = path.relative(bimFolderPath, itemPath);
                            mediaFiles.push(relativePath);
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Error scanning BIM folder ${currentPath}:`, error.message);
            }
        }

        scanBIMFolder(bimFolderPath);

    } catch (error) {
        console.warn(`⚠️ Error scanning BIM folder ${bimFolderPath}:`, error.message);
    }

    return mediaFiles;
}

// Helper function to determine file type
function getFileType(extension) {
    const videoExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    if (videoExts.includes(extension)) return 'video';
    if (imageExts.includes(extension)) return 'image';
    return 'unknown';
}

// Helper function to update collections based on tags
function updateCollections(tagsData) {
    const collections = {
        Commercial: [],
        Healthcare: [],
        Residential: [],
        Education: [],
        Infrastructure: [],
        '2024': [],
        '2023': [],
        '2025': [],
        '3D': [],
        '4D': [],
        '5D': [],
        '6D': [],
        '7D': [],
        Jawa: [],
        Sumatra: [],
        Kalimantan: [],
        'Nusa Tenggara': []
    };

    Object.entries(tagsData.media).forEach(([filePath, tags]) => {
        // By type
        if (tags.type && collections[tags.type]) {
            collections[tags.type].push(filePath);
        }

        // By year
        if (tags.year && collections[tags.year]) {
            collections[tags.year].push(filePath);
        }

        // By BIM dimension
        if (tags.bimDimension && collections[tags.bimDimension]) {
            collections[tags.bimDimension].push(filePath);
        }

        // By location
        if (tags.location && collections[tags.location]) {
            collections[tags.location].push(filePath);
        }
    });

    tagsData.collections = collections;
}

module.exports = router;
