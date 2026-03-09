const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const LEARNING_MATERIALS_FILE = path.join(__dirname, "../learning-materials.json");
const { generateSingleThumbnail } = require('../scripts/generate-pdf-thumbnails');

// Multer configuration for learning materials upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use the new path: BC-Learning-Main/elearning-assets/materials
        const uploadDir = path.join(__dirname, "../../BC-Learning-Main/elearning-assets/materials");

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename to prevent issues
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '-' + sanitizedName);
    }
});

const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../../BC-Learning-Main/elearning-assets/materials/covers");

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, Date.now() + '-' + sanitizedName);
    }
});

// File filter for learning materials
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'video/mp4',
        'video/avi',
        'video/webm',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: PDF, video files, documents, presentations, ZIP.`), false);
    }
};

const coverFileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Cover image must be JPG, PNG, or WEBP.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

const coverUpload = multer({
    storage: coverStorage,
    fileFilter: coverFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for cover images
    }
});

// GET /api/admin/learning-materials - Mendapatkan semua learning materials
router.get("/", requireAdmin, (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        res.json({
            success: true,
            data: materialsData.materials,
            metadata: materialsData.metadata
        });
    } catch (error) {
        console.error("Error reading learning materials file:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read learning materials data"
        });
    }
});

// GET /api/admin/learning-materials/:id - Mendapatkan material berdasarkan ID
router.get("/:id", requireAdmin, (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const material = materialsData.materials.find(m => m.id === req.params.id);

        if (!material) {
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        res.json({
            success: true,
            data: material
        });
    } catch (error) {
        console.error("Error reading learning material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read learning material data"
        });
    }
});

// POST /api/admin/learning-materials - Membuat learning material baru
router.post("/", requireAdmin, (req, res) => {
    try {
        let materialsData;
        try {
            materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        } catch (e) {
            console.warn("Could not parse learning-materials.json, initializing new file.");
            materialsData = { materials: [], metadata: {} };
        }

        const newMaterial = {
            id: req.body.id || `material-${Date.now()}`,
            title: req.body.title,
            description: req.body.description || '',
            category: req.body.category || 'general',
            courseId: req.body.courseId || null,
            type: req.body.type || 'document', // pdf, video, document, presentation
            filePath: req.body.filePath || null,
            fileSize: req.body.fileSize || 0,
            tags: req.body.tags || [],
            level: req.body.level || 'all', // beginner, intermediate, advanced, all
            isDownloadable: req.body.isDownloadable !== false,
            uploadedBy: req.body.uploadedBy || 'AdminBCL',
            uploadedAt: new Date().toISOString(),
            version: 1,
            status: req.body.status || 'active'
        };

        // Validasi required fields
        if (!newMaterial.title) {
            return res.status(400).json({
                success: false,
                error: "Title is required"
            });
        }

        // Cek duplikasi ID
        if (materialsData.materials.find(m => m.id === newMaterial.id)) {
            return res.status(400).json({
                success: false,
                error: "Material ID already exists"
            });
        }

        materialsData.materials.push(newMaterial);

        // Update metadata
        updateMaterialsMetadata(materialsData);

        fs.writeFileSync(LEARNING_MATERIALS_FILE, JSON.stringify(materialsData, null, 2));

        res.json({
            success: true,
            message: "Learning material created successfully",
            data: newMaterial
        });

    } catch (error) {
        console.error("Error creating learning material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create learning material"
        });
    }
});

// PUT /api/admin/learning-materials/:id - Update learning material
router.put("/:id", requireAdmin, (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const materialIndex = materialsData.materials.findIndex(m => m.id === req.params.id);

        if (materialIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        // Update material data
        const updatedMaterial = {
            ...materialsData.materials[materialIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        materialsData.materials[materialIndex] = updatedMaterial;

        // Update metadata
        updateMaterialsMetadata(materialsData);

        fs.writeFileSync(LEARNING_MATERIALS_FILE, JSON.stringify(materialsData, null, 2));

        res.json({
            success: true,
            message: "Learning material updated successfully",
            data: updatedMaterial
        });

    } catch (error) {
        console.error("Error updating learning material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update learning material"
        });
    }
});

// DELETE /api/admin/learning-materials/:id - Hapus learning material
router.delete("/:id", requireAdmin, (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const materialIndex = materialsData.materials.findIndex(m => m.id === req.params.id);

        if (materialIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        const deletedMaterial = materialsData.materials[materialIndex];

        // Delete physical file if it exists
        if (deletedMaterial.filePath) {
            const fullPath = path.join(__dirname, "../", deletedMaterial.filePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        materialsData.materials.splice(materialIndex, 1);

        // Update metadata
        updateMaterialsMetadata(materialsData);

        fs.writeFileSync(LEARNING_MATERIALS_FILE, JSON.stringify(materialsData, null, 2));

        res.json({
            success: true,
            message: "Learning material deleted successfully",
            data: deletedMaterial
        });

    } catch (error) {
        console.error("Error deleting learning material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete learning material"
        });
    }
});

// Error handling middleware for multer
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        let errorMessage = 'File upload error';
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                errorMessage = 'File size exceeds the 100MB limit';
                break;
            case 'LIMIT_FILE_COUNT':
                errorMessage = 'Too many files uploaded';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                errorMessage = 'Unexpected file field';
                break;
            default:
                errorMessage = `Multer error: ${err.message}`;
        }
        return res.status(400).json({
            success: false,
            error: errorMessage
        });
    } else if (err) {
        // Other errors (like file filter errors)
        return res.status(400).json({
            success: false,
            error: err.message || 'File validation failed'
        });
    }
    next();
}

// POST /api/admin/learning-materials/upload - Upload file untuk learning material
router.post("/upload", requireAdmin, (req, res, next) => {
    // Use multer with error handling
    upload.single('file')(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "No file uploaded"
                });
            }

            // Validate required fields
            const title = req.body.title;
            if (!title) {
                return res.status(400).json({
                    success: false,
                    error: "Title is required"
                });
            }

            const category = req.body.category || 'general';
            const filePath = `/elearning-assets/materials/${req.file.filename}`;

            // Get file stats
            const stats = fs.statSync(req.file.path);
            const fileSize = stats.size;

            // Load existing materials
            let materialsData;
            try {
                materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
            } catch (error) {
                // If file doesn't exist or is corrupted, create new structure
                materialsData = { materials: [], metadata: {} };
            }

            // Create new learning material
            // Calculate thumbnail path
            const thumbnailFilename = req.file.filename.replace(/\.pdf$/i, '.jpg');
            const thumbnailPath = `/thumbnails/pdf/${thumbnailFilename}`;

            const newMaterial = {
                id: `material-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: title,
                description: req.body.description || 'Learn about ' + title + ' with this comprehensive learning material.',
                category: category,
                level: req.body.level || 'beginner',
                language: req.body.language || 'id',
                type: req.file.mimetype === 'application/pdf' ? 'pdf' : 'document', // Set correct type for PDFs
                filePath: filePath,
                thumbnailPath: thumbnailPath, // Set thumbnail path immediately
                coverImagePath: null,
                fileSize: fileSize,
                fileName: req.file.originalname,
                tags: [],
                isDownloadable: true,
                uploadedBy: 'AdminBCL',
                uploadedAt: new Date().toISOString(),
                version: 1,
                status: 'active',
                displayOnCourses: req.body.displayOnCourses === 'true' || req.body.displayOnCourses === true
            };

            // Add to materials array
            materialsData.materials.push(newMaterial);

            // Update metadata
            updateMaterialsMetadata(materialsData);

            // Save to file
            fs.writeFileSync(LEARNING_MATERIALS_FILE, JSON.stringify(materialsData, null, 2));

            console.log(`✅ File uploaded successfully: ${req.file.originalname} -> ${req.file.filename}`);

            // Trigger thumbnail generation in background
            if (newMaterial.type === 'pdf') {
                try {
                    // Call without awaiting to prevent blocking response
                    generateSingleThumbnail(newMaterial.id).then(success => {
                        if (success) console.log(`✅ Thumbnail generated for ${newMaterial.title}`);
                        else console.warn(`⚠️ Thumbnail generation failed for ${newMaterial.title}`);
                    }).catch(err => console.error(`❌ Thumbnail generation error: ${err.message}`));
                } catch (genError) {
                    console.error(`❌ Critical error triggering thumbnail generation: ${genError.message}`);
                    // Continue execution to ensure response is sent
                }
            }

            res.json({
                success: true,
                message: "PDF uploaded and material created successfully",
                data: newMaterial,
                filePath: filePath,
                fileName: req.file.originalname,
                fileSize: fileSize,
                mimeType: req.file.mimetype
            });

        } catch (error) {
            console.error("Error processing uploaded file:", error);
            res.status(500).json({
                success: false,
                error: "Failed to process uploaded file",
                detail: error.message
            });
        }
    });
});

// POST /api/admin/learning-materials/:id/cover - Upload cover image for PDF material
router.post("/:id/cover", requireAdmin, (req, res, next) => {
    coverUpload.single('cover')(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "No cover image uploaded"
                });
            }

            const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
            const materialIndex = materialsData.materials.findIndex(m => m.id == req.params.id);

            if (materialIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: "Learning material not found"
                });
            }

            const coverPath = `/elearning-assets/materials/covers/${req.file.filename}`;
            const currentMaterial = materialsData.materials[materialIndex];
            const previousCover = currentMaterial.coverImagePath || currentMaterial.thumbnailPath;

            if (previousCover && previousCover.startsWith('/elearning-assets/materials/covers/')) {
                const normalized = previousCover.replace(/^[\\/]/, '');
                const previousFullPath = path.join(__dirname, "../../BC-Learning-Main", normalized);
                if (fs.existsSync(previousFullPath)) {
                    fs.unlinkSync(previousFullPath);
                }
            }

            const updatedMaterial = {
                ...currentMaterial,
                coverImagePath: coverPath,
                thumbnailPath: coverPath,
                updatedAt: new Date().toISOString()
            };

            materialsData.materials[materialIndex] = updatedMaterial;

            updateMaterialsMetadata(materialsData);
            fs.writeFileSync(LEARNING_MATERIALS_FILE, JSON.stringify(materialsData, null, 2));

            res.json({
                success: true,
                message: "Cover image uploaded successfully",
                coverImagePath: coverPath,
                data: updatedMaterial
            });
        } catch (error) {
            console.error("Error uploading cover image:", error);
            res.status(500).json({
                success: false,
                error: "Failed to upload cover image"
            });
        }
    });
});

// GET /api/admin/learning-materials/categories/:category - Get materials by category
router.get("/categories/:category", requireAdmin, (req, res) => {
    try {
        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, "utf8"));
        const category = req.params.category;

        const filteredMaterials = materialsData.materials.filter(m =>
            m.category.toLowerCase() === category.toLowerCase()
        );

        res.json({
            success: true,
            category: category,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by category:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get materials by category"
        });
    }
});

// Helper function to update materials metadata
function updateMaterialsMetadata(materialsData) {
    if (!materialsData.metadata) {
        materialsData.metadata = {};
    }

    const materials = materialsData.materials || [];

    // Reset counters
    const categories = {};
    const types = {};

    materials.forEach(material => {
        // Count by category
        categories[material.category] = (categories[material.category] || 0) + 1;

        // Count by type
        types[material.type] = (types[material.type] || 0) + 1;
    });

    // Update metadata
    materialsData.metadata.totalMaterials = materials.length;
    materialsData.metadata.categories = categories;
    materialsData.metadata.types = types;
    materialsData.metadata.lastUpdated = new Date().toISOString();
    materialsData.metadata.updatedBy = "AdminBCL";
}

module.exports = router;
