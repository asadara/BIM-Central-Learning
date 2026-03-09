const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const LEARNING_MATERIALS_FILE = path.join(__dirname, "../learning-materials.json");

function writeJsonSafe(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizePageCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// GET /api/learning-materials - Mendapatkan semua learning materials untuk student
router.get("/", (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));

        // Filter materials yang aktif (atau tidak memiliki status field - dianggap aktif)
        const activeMaterials = (materialsData.materials || []).filter(m => 
            m.status === 'active' || m.status === undefined || m.status === null
        );

        console.log(`📚 Learning materials API: Found ${activeMaterials.length} active materials`);

        res.json({
            success: true,
            data: activeMaterials,
            count: activeMaterials.length
        });
    } catch (error) {
        console.error("Error reading learning materials for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load learning materials"
        });
    }
});

// GET /api/learning-materials/:id - Mendapatkan material spesifik untuk student
router.get("/:id", (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const requestedId = req.params.id;
        
        // Support both string and number ID comparison
        const material = materialsData.materials.find(m => 
            m.id == requestedId || m.id === parseInt(requestedId) || String(m.id) === requestedId
        );

        // Check if material exists and is active (or has no status field)
        if (!material) {
            console.log(`📚 Material not found for ID: ${requestedId}`);
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        // Check status - allow active, undefined, or null status
        const isActive = material.status === 'active' || material.status === undefined || material.status === null;
        if (!isActive) {
            console.log(`📚 Material ${requestedId} is not active (status: ${material.status})`);
            return res.status(404).json({
                success: false,
                error: "Learning material not available"
            });
        }

        console.log(`📚 Found material: ${material.title} (ID: ${material.id})`);

        res.json({
            success: true,
            data: material
        });
    } catch (error) {
        console.error("Error reading learning material for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load learning material"
        });
    }
});

// GET /api/learning-materials/categories/:category - Get materials by category for students
router.get("/categories/:category", (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const category = req.params.category;

        const filteredMaterials = materialsData.materials.filter(m =>
            m.category.toLowerCase() === category.toLowerCase() && m.status === 'active'
        );

        res.json({
            success: true,
            category: category,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by category for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load materials by category"
        });
    }
});

// GET /api/learning-materials/courses/:courseId - Get materials by course ID
router.get("/courses/:courseId", (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const courseId = req.params.courseId;

        const filteredMaterials = materialsData.materials.filter(m =>
            m.courseId === courseId && m.status === 'active'
        );

        res.json({
            success: true,
            courseId: courseId,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by course for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load materials by course"
        });
    }
});

// GET /api/learning-materials/levels/:level - Get materials by level
router.get("/levels/:level", (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const level = req.params.level;

        const filteredMaterials = materialsData.materials.filter(m =>
            m.level.toLowerCase() === level.toLowerCase() && m.status === 'active'
        );

        res.json({
            success: true,
            level: level,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by level for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load materials by level"
        });
    }
});

// GET /api/learning-materials/search - Search materials
router.get("/search", (req, res) => {
    try {
        const { q, category, level, type } = req.query;
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));

        let filteredMaterials = materialsData.materials.filter(m => m.status === 'active');

        // Apply search query
        if (q) {
            const searchTerm = q.toLowerCase();
            filteredMaterials = filteredMaterials.filter(m =>
                m.title.toLowerCase().includes(searchTerm) ||
                m.description.toLowerCase().includes(searchTerm) ||
                m.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // Apply category filter
        if (category) {
            filteredMaterials = filteredMaterials.filter(m =>
                m.category.toLowerCase() === category.toLowerCase()
            );
        }

        // Apply level filter
        if (level) {
            filteredMaterials = filteredMaterials.filter(m =>
                m.level.toLowerCase() === level.toLowerCase()
            );
        }

        // Apply type filter
        if (type) {
            filteredMaterials = filteredMaterials.filter(m =>
                m.type.toLowerCase() === type.toLowerCase()
            );
        }

        res.json({
            success: true,
            query: q,
            filters: { category, level, type },
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error searching materials for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to search materials"
        });
    }
});

// GET /api/learning-materials/toc/:materialId - Get TOC for specific material
router.get("/toc/:materialId", async (req, res) => {
    try {
        const { materialId } = req.params;
        const PdfTocExtractor = require('../utils/pdfTocExtractor');
        const extractor = new PdfTocExtractor();

        // Find the material to get its file path (support both string and number ID)
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const material = materialsData.materials.find(m => 
            m.id == materialId || m.id === parseInt(materialId) || String(m.id) === materialId
        );

        if (!material) {
            console.log(`📖 TOC: Material not found for ID: ${materialId}`);
            return res.status(404).json({
                success: false,
                error: "Material not found"
            });
        }

        console.log(`📖 TOC: Found material: ${material.title} (ID: ${material.id})`);

        // Convert URL path to file system path
        // material.filePath is like "/elearning-assets/materials/filename.pdf"
        // Need to convert to actual file system path
        let fileSystemPath;
        const materialFilePath = material.filePath || '';

        console.log(`📖 Processing filePath: "${materialFilePath}" for material ${materialId}`);
        console.log(`📖 __dirname is: ${__dirname}`);

        if (materialFilePath.startsWith('/elearning-assets/materials/')) {
            // Remove the URL prefix and add the actual file system path
            const filename = materialFilePath.replace('/elearning-assets/materials/', '');
            fileSystemPath = path.join(__dirname, '../../BC-Learning-Main/elearning-assets/materials', filename);
            console.log(`📁 New format detected. Filename: "${filename}"`);
            console.log(`📁 Converted to filesystem path: ${fileSystemPath}`);
        } else if (materialFilePath.startsWith('/BC-Learning-Main/')) {
            // Old format - remove the /BC-Learning-Main prefix and resolve from backend directory
            const relativePath = materialFilePath.replace('/BC-Learning-Main/', '');
            fileSystemPath = path.join(__dirname, '../../BC-Learning-Main', relativePath);
            console.log(`📁 Old format detected. Relative path: "${relativePath}"`);
            console.log(`📁 Converted to filesystem path: ${fileSystemPath}`);
        } else {
            // Fallback for other paths
            fileSystemPath = path.join(__dirname, '../', materialFilePath);
            console.log(`📁 Unknown format, using fallback filesystem path: ${fileSystemPath}`);
        }

        console.log(`📖 Final filesystem path for TOC extraction: ${fileSystemPath}`);
        console.log(`📖 File exists check: ${fs.existsSync(fileSystemPath) ? 'EXISTS' : 'NOT FOUND'}`);

        // Check if file exists
        if (!fs.existsSync(fileSystemPath)) {
            const fallbackPageCount = normalizePageCount(material.pageCount);
            console.warn(`⚠️ PDF file not found: ${fileSystemPath}`);
            return res.json({
                success: true,
                materialId,
                toc: {
                    materialId,
                    chapters: [],
                    totalPages: fallbackPageCount || 1,
                    method: fallbackPageCount ? 'file-not-found+metadata' : 'file-not-found',
                    lastAnalyzed: new Date().toISOString(),
                    confidence: 0,
                    error: 'PDF file not found'
                }
            });
        }

        // Get TOC data (from cache or extract)
        console.log(`📖 Calling getTOC with materialId: ${materialId}, fileSystemPath: ${fileSystemPath}`);

        if (!fileSystemPath) {
            console.error(`❌ fileSystemPath is null/undefined for material ${materialId}`);
            return res.json({
                success: true,
                materialId,
                toc: {
                    materialId,
                    chapters: [],
                    totalPages: 1,
                    method: 'error-no-path',
                    lastAnalyzed: new Date().toISOString(),
                    confidence: 0,
                    error: 'File system path could not be determined'
                }
            });
        }

        const tocData = await extractor.getTOC(materialId, fileSystemPath);

        const existingPageCount = normalizePageCount(material.pageCount);

        // If extractor returns an invalid page count, fall back to stored metadata
        if ((!tocData.totalPages || tocData.totalPages <= 1) && existingPageCount) {
            tocData.totalPages = existingPageCount;
            tocData.method = tocData.method ? `${tocData.method}+metadata` : 'metadata';
        }

        const resolvedPageCount = normalizePageCount(tocData.totalPages);
        if (!existingPageCount && resolvedPageCount) {
            material.pageCount = resolvedPageCount;
            materialsData.materials = materialsData.materials.map(m =>
                m.id == materialId || m.id === parseInt(materialId) || String(m.id) === materialId
                    ? material
                    : m
            );
            writeJsonSafe(LEARNING_MATERIALS_FILE, materialsData);
        }

        res.json({
            success: true,
            materialId,
            toc: tocData
        });

    } catch (error) {
        console.error("Error getting TOC for material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get TOC data",
            details: error.message
        });
    }
});

// GET /api/learning-materials/toc-stats - Get TOC extraction statistics
router.get("/toc-stats", (req, res) => {
    try {
        const PdfTocExtractor = require('../utils/pdfTocExtractor');
        const extractor = new PdfTocExtractor();
        const stats = extractor.getCacheStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error("Error getting TOC stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get TOC statistics"
        });
    }
});

module.exports = router;
