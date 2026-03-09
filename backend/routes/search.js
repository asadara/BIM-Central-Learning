const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

// Configuration
const BASE_DIR = process.env.BASE_DIR || "G:/BIM CENTRAL LEARNING/";
const MAX_RESULTS = 1000; // Limit results to prevent performance issues
const MAX_DEPTH = 5; // Limit directory depth for performance

// Valid file extensions to search
const VALID_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.txt', '.rtf',
    '.rvt', '.dwg', '.dxf', '.ifc', '.skp',
    '.mp4', '.mov', '.avi', '.webm', '.mkv',
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.xls', '.xlsx', '.ppt', '.pptx', '.zip'
];

// Excluded folders (same as main server)
const EXCLUDED_FOLDERS = [
    'node_modules', '.git', '__pycache__', 'temp', 'tmp',
    'INCOMING DATA', 'INCOMING', 'DATA', 'TENDER',
    'clash', 'Clash Detection', 'Texture Image Marbel'
];

// GET /api/search?q=searchterm&filter=pdf&type=files
router.get('/', async (req, res) => {
    try {
        const query = (req.query.q || '').trim().toLowerCase();
        let filterType = (req.query.filter || 'all').toLowerCase();
        const searchType = req.query.type || 'files'; // Default to files only

        console.log(`🔍 Search request: query="${query}", filter="${filterType}", type="${searchType}"`);

        // Handle UI filter mapping to file extensions
        const FILTER_MAP = {
            'all': null, // No filter
            'pdf': ['.pdf'],
            'video': ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv'],
            'text': ['.txt', '.doc', '.docx', '.rtf'],
            'rvt': ['.rvt'],
            'dwg': ['.dwg'],
            'rfa': ['.rfa'],
            'pln': ['.pln'],
            'skp': ['.skp'],
            'tm': ['.tm']
        };

        // Convert UI filter to extension array
        const extensions = FILTER_MAP[filterType] || null;

        if (!query) {
            return res.status(400).json({
                error: 'Search query is required',
                usage: '/api/search?q=searchterm&filter=pdf&type=files'
            });
        }

        if (query.length < 2) {
            return res.status(400).json({
                error: 'Search query must be at least 2 characters long'
            });
        }

        // Check if BASE_DIR exists
        if (!fs.existsSync(BASE_DIR)) {
            console.warn(`⚠️ BASE_DIR does not exist: ${BASE_DIR}`);
            return res.status(500).json({
                error: 'Search directory not available',
                detail: 'BASE_DIR not found'
            });
        }

        // Search through directories
        const results = await searchFiles(BASE_DIR, query, extensions, searchType, MAX_DEPTH);

        console.log(`✅ Search completed: ${results.length} results found for "${query}"`);

        res.json({
            query: req.query.q,
            filter: filterType,
            type: searchType,
            totalResults: results.length,
            files: results.slice(0, MAX_RESULTS), // Limit results
            truncated: results.length > MAX_RESULTS
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            detail: error.message
        });
    }
});

// Add ping endpoint for testing
router.get('/ping', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Search API is working',
        baseDir: BASE_DIR,
        baseDirExists: fs.existsSync(BASE_DIR),
        timestamp: new Date().toISOString()
    });
});

// Recursive file search function
async function searchFiles(directory, query, extensions, searchType, maxDepth, currentDepth = 0) {
    const results = [];

    try {
        if (currentDepth >= maxDepth) {
            return results;
        }

        if (!fs.existsSync(directory)) {
            console.warn(`⚠️ Search directory not found: ${directory}`);
            return results;
        }

        const items = fs.readdirSync(directory, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(directory, item.name);

            try {
                // Skip excluded folders
                if (item.isDirectory()) {
                    if (EXCLUDED_FOLDERS.some(excluded =>
                        item.name.toLowerCase().includes(excluded.toLowerCase())
                    )) {
                        continue;
                    }

                    // Search in subdirectories if looking for files or all
                    if (searchType === 'all' || searchType === 'files') {
                        const subResults = await searchFiles(fullPath, query, extensions, searchType, maxDepth, currentDepth + 1);
                        results.push(...subResults);
                    }

                    // Check if folder name matches search
                    if ((searchType === 'all' || searchType === 'folders') &&
                        item.name.toLowerCase().includes(query)) {
                        results.push(createResultItem(fullPath, item.name, true));
                    }

                } else {
                    // Check if file matches search criteria
                    if (searchType === 'all' || searchType === 'files') {
                        const ext = path.extname(item.name).toLowerCase();

                        // Check file extension filter (if extensions array provided)
                        if (extensions && extensions.length > 0) {
                            if (!extensions.includes(ext)) {
                                continue;
                            }
                        } else if (extensions === null) {
                            // No filter - include all valid extensions
                            if (!VALID_EXTENSIONS.includes(ext)) {
                                continue;
                            }
                        }

                        // Check if file name contains search query
                        if (item.name.toLowerCase().includes(query)) {
                            results.push(createResultItem(fullPath, item.name, false));
                        }
                    }
                }

                // Limit results to prevent memory issues
                if (results.length >= MAX_RESULTS * 2) {
                    break;
                }

            } catch (itemError) {
                // Skip problematic items but continue searching
                console.warn(`⚠️ Skipping item ${item.name}:`, itemError.message);
                continue;
            }
        }

    } catch (error) {
        console.error(`❌ Error searching directory ${directory}:`, error.message);
    }

    return results;
}

// Create result item object
function createResultItem(fullPath, name, isDirectory) {
    const stats = fs.statSync(fullPath);
    const relativePath = path.relative(BASE_DIR, fullPath).replace(/\\/g, '/');
    const ext = isDirectory ? '' : path.extname(name).toLowerCase();

    // Get the parent folder name (location)
    let location = '-';

    if (isDirectory) {
        // For directories, show the directory name
        location = decodeURIComponent(name);
    } else {
        // For files, get the parent directory name
        const parentDir = path.dirname(fullPath);
        const parentName = path.basename(parentDir);

        // Check if parent is the BASE_DIR itself
        const normalizedBaseDir = BASE_DIR.replace(/\\/g, '/').replace(/\/$/, '');
        const normalizedParentDir = parentDir.replace(/\\/g, '/');

        if (normalizedParentDir === normalizedBaseDir) {
            location = 'Root Directory';
        } else {
            location = decodeURIComponent(parentName);
        }
    }

    return {
        name: name,
        path: `/files/${encodeURI(relativePath)}`,
        fullPath: fullPath,
        relativePath: relativePath,
        location: location, // Decoded location for display
        type: isDirectory ? 'folder' : ext.substring(1) || 'file',
        size: isDirectory ? null : stats.size,
        sizeFormatted: isDirectory ? '-' : formatFileSize(stats.size),
        modified: stats.mtime.toISOString(),
        modifiedFormatted: stats.mtime.toLocaleString('id-ID'),
        isDirectory: isDirectory,
        extension: ext
    };
}

// Format file size helper
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
