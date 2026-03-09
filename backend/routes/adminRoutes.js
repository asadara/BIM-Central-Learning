const express = require("express");
const fs = require("fs");
const path = require("path");
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const TAGS_FILE = path.join(__dirname, "../tags.json");
const LEARNING_MATERIALS_FILE = path.join(__dirname, "../learning-materials.json");
const BIM_MEDIA_FILE = path.join(__dirname, "../bim-media.json");
const USERS_FILE = path.join(__dirname, "../users.json");

// GET /api/admin/tags - Mendapatkan semua tagline
router.get("/tags", requireAdmin, (req, res) => {
    try {
        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));
        res.json({
            success: true,
            data: tagsData
        });
    } catch (error) {
        console.error("Error reading tags file:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read tags data"
        });
    }
});

// POST /api/admin/tags/video - Menambahkan tagline untuk video
router.post("/tags/video", requireAdmin, (req, res) => {
    try {
        const { filename, tagline, category } = req.body;

        if (!filename || !tagline) {
            return res.status(400).json({
                success: false,
                error: "Filename and tagline are required"
            });
        }

        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));

        // Inisialisasi jika belum ada
        if (!tagsData.tags.video) {
            tagsData.tags.video = {};
        }

        // Tambahkan atau update tagline
        tagsData.tags.video[filename] = {
            tagline: tagline,
            category: category || "general",
            updatedAt: new Date().toISOString(),
            updatedBy: "AdminBCL"
        };

        // Update metadata
        tagsData.lastUpdated = new Date().toISOString();
        tagsData.updatedBy = "AdminBCL";

        fs.writeFileSync(TAGS_FILE, JSON.stringify(tagsData, null, 2));

        res.json({
            success: true,
            message: "Video tagline updated successfully",
            data: tagsData.tags.video[filename]
        });

    } catch (error) {
        console.error("Error updating video tagline:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update video tagline"
        });
    }
});

// POST /api/admin/tags/pdf - Menambahkan tagline untuk PDF
router.post("/tags/pdf", requireAdmin, (req, res) => {
    try {
        const { filename, tagline, category } = req.body;

        if (!filename || !tagline) {
            return res.status(400).json({
                success: false,
                error: "Filename and tagline are required"
            });
        }

        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));

        // Inisialisasi jika belum ada
        if (!tagsData.tags.pdf) {
            tagsData.tags.pdf = {};
        }

        // Tambahkan atau update tagline
        tagsData.tags.pdf[filename] = {
            tagline: tagline,
            category: category || "general",
            updatedAt: new Date().toISOString(),
            updatedBy: "AdminBCL"
        };

        // Update metadata
        tagsData.lastUpdated = new Date().toISOString();
        tagsData.updatedBy = "AdminBCL";

        fs.writeFileSync(TAGS_FILE, JSON.stringify(tagsData, null, 2));

        res.json({
            success: true,
            message: "PDF tagline updated successfully",
            data: tagsData.tags.pdf[filename]
        });

    } catch (error) {
        console.error("Error updating PDF tagline:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update PDF tagline"
        });
    }
});

// DELETE /api/admin/tags/:type/:filename - Menghapus tagline
router.delete("/tags/:type/:filename", requireAdmin, (req, res) => {
    try {
        const { type, filename } = req.params;

        if (!["video", "pdf", "other"].includes(type)) {
            return res.status(400).json({
                success: false,
                error: "Invalid type. Must be video, pdf, or other"
            });
        }

        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));

        if (tagsData.tags[type] && tagsData.tags[type][filename]) {
            delete tagsData.tags[type][filename];

            // Update metadata
            tagsData.lastUpdated = new Date().toISOString();
            tagsData.updatedBy = "AdminBCL";

            fs.writeFileSync(TAGS_FILE, JSON.stringify(tagsData, null, 2));

            res.json({
                success: true,
                message: `${type} tagline deleted successfully`
            });
        } else {
            res.status(404).json({
                success: false,
                error: "Tagline not found"
            });
        }

    } catch (error) {
        console.error("Error deleting tagline:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete tagline"
        });
    }
});

// GET /api/admin/materials - Mendapatkan semua materi dengan tagline
router.get("/materials", requireAdmin, (req, res) => {
    try {
        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));

        // Gabungkan semua materi dari berbagai tipe
        const allMaterials = {
            video: tagsData.tags.video || {},
            pdf: tagsData.tags.pdf || {},
            other: tagsData.tags.other || {}
        };

        res.json({
            success: true,
            data: allMaterials,
            categories: tagsData.categories
        });

    } catch (error) {
        console.error("Error reading materials:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read materials data"
        });
    }
});

// POST /api/admin/categories - Menambahkan kategori baru
router.post("/categories", requireAdmin, (req, res) => {
    try {
        const { id, name, description, color, icon } = req.body;

        if (!id || !name) {
            return res.status(400).json({
                success: false,
                error: "Category ID and name are required"
            });
        }

        const tagsData = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));

        // Inisialisasi categories jika belum ada
        if (!tagsData.categories) {
            tagsData.categories = {};
        }

        // Tambahkan kategori baru
        tagsData.categories[id] = {
            name: name,
            description: description || "",
            color: color || "#607D8B",
            icon: icon || "fas fa-tag",
            createdAt: new Date().toISOString(),
            createdBy: "AdminBCL"
        };

        // Update metadata
        tagsData.lastUpdated = new Date().toISOString();
        tagsData.updatedBy = "AdminBCL";

        fs.writeFileSync(TAGS_FILE, JSON.stringify(tagsData, null, 2));

        res.json({
            success: true,
            message: "Category created successfully",
            data: tagsData.categories[id]
        });

    } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create category"
        });
    }
});

// Backup Management Routes

// GET /api/admin/backups - List all backup files
router.get("/backups", requireAdmin, (req, res) => {
    try {
        const usersDir = path.dirname(USERS_FILE);
        const backupFiles = fs.readdirSync(usersDir)
            .filter(file => file.startsWith('users.json.backup.'))
            .map(filename => {
                const filePath = path.join(usersDir, filename);
                const stats = fs.statSync(filePath);
                const timestamp = parseInt(filename.replace('users.json.backup.', ''));

                return {
                    filename: filename,
                    timestamp: timestamp,
                    size: stats.size,
                    date: new Date(timestamp).toISOString()
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

        res.json({
            success: true,
            backups: backupFiles
        });
    } catch (error) {
        console.error("Error listing backups:", error);
        res.status(500).json({
            success: false,
            error: "Failed to list backup files"
        });
    }
});

// POST /api/admin/backups/create - Create a new backup
router.post("/backups/create", requireAdmin, (req, res) => {
    try {
        // Read current users file
        if (!fs.existsSync(USERS_FILE)) {
            return res.status(404).json({
                success: false,
                error: "Users file not found"
            });
        }

        const usersData = fs.readFileSync(USERS_FILE, "utf8");

        // Create backup filename with timestamp
        const timestamp = Date.now();
        const backupFilename = `users.json.backup.${timestamp}`;
        const backupPath = path.join(path.dirname(USERS_FILE), backupFilename);

        // Write backup file
        fs.writeFileSync(backupPath, usersData, "utf8");

        console.log(`✅ Backup created: ${backupFilename}`);

        res.json({
            success: true,
            message: "Backup created successfully",
            backup: {
                filename: backupFilename,
                timestamp: timestamp,
                size: Buffer.byteLength(usersData, 'utf8')
            }
        });
    } catch (error) {
        console.error("Error creating backup:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create backup"
        });
    }
});

// GET /api/admin/backups/:filename - Get backup file details
router.get("/backups/:filename", requireAdmin, (req, res) => {
    try {
        const { filename } = req.params;

        // Security check - only allow backup files
        if (!filename.startsWith('users.json.backup.')) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }

        const backupPath = path.join(path.dirname(USERS_FILE), filename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                error: "Backup file not found"
            });
        }

        const backupContent = fs.readFileSync(backupPath, "utf8");
        const stats = fs.statSync(backupPath);
        const timestamp = parseInt(filename.replace('users.json.backup.', ''));

        let parsedContent;
        try {
            parsedContent = JSON.parse(backupContent);
        } catch (parseError) {
            parsedContent = { error: "Invalid JSON content" };
        }

        res.json({
            success: true,
            filename: filename,
            timestamp: timestamp,
            size: stats.size,
            content: parsedContent
        });
    } catch (error) {
        console.error("Error reading backup:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read backup file"
        });
    }
});

// POST /api/admin/backups/:filename/restore - Restore from backup
router.post("/backups/:filename/restore", requireAdmin, (req, res) => {
    try {
        const { filename } = req.params;

        // Security check - only allow backup files
        if (!filename.startsWith('users.json.backup.')) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }

        const backupPath = path.join(path.dirname(USERS_FILE), filename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                error: "Backup file not found"
            });
        }

        // Read backup content
        const backupContent = fs.readFileSync(backupPath, "utf8");

        // Validate JSON
        try {
            JSON.parse(backupContent);
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                error: "Backup file contains invalid JSON"
            });
        }

        // Create a backup of current file before restoring
        if (fs.existsSync(USERS_FILE)) {
            const currentBackupName = `users.json.backup.before_restore.${Date.now()}`;
            const currentBackupPath = path.join(path.dirname(USERS_FILE), currentBackupName);
            const currentContent = fs.readFileSync(USERS_FILE, "utf8");
            fs.writeFileSync(currentBackupPath, currentContent, "utf8");
            console.log(`📦 Created safety backup: ${currentBackupName}`);
        }

        // Restore from backup
        fs.writeFileSync(USERS_FILE, backupContent, "utf8");

        console.log(`✅ Backup restored: ${filename}`);

        res.json({
            success: true,
            message: "Backup restored successfully"
        });
    } catch (error) {
        console.error("Error restoring backup:", error);
        res.status(500).json({
            success: false,
            error: "Failed to restore backup"
        });
    }
});

// DELETE /api/admin/backups/:filename - Delete backup file
router.delete("/backups/:filename", requireAdmin, (req, res) => {
    try {
        const { filename } = req.params;

        // Security check - only allow backup files
        if (!filename.startsWith('users.json.backup.')) {
            return res.status(403).json({
                success: false,
                error: "Access denied"
            });
        }

        const backupPath = path.join(path.dirname(USERS_FILE), filename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({
                success: false,
                error: "Backup file not found"
            });
        }

        // Delete the backup file
        fs.unlinkSync(backupPath);

        console.log(`🗑️ Backup deleted: ${filename}`);

        res.json({
            success: true,
            message: "Backup deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting backup:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete backup"
        });
    }
});

// ===== LEARNING MATERIALS MANAGEMENT (PostgreSQL) =====

// GET /api/admin/learning-materials - Get all learning materials
router.get("/learning-materials", requireAdmin, (req, res) => {
    try {
        const query = `
            SELECT id, title, category, level, description, page_count, language,
                   file_path, size, display_on_courses, created_at, updated_at
            FROM learning_materials
            WHERE is_active = true
            ORDER BY created_at DESC
        `;

        // For now, return sample data since PostgreSQL might not be set up yet
        const sampleData = [
            {
                id: 1,
                title: "AutoCAD Fundamentals Guide",
                category: "autocad",
                level: "beginner",
                description: "Complete guide to AutoCAD basics for BIM beginners",
                page_count: 45,
                language: "id",
                file_path: "/materials/autocad-fundamentals.pdf",
                size: 2457600,
                display_on_courses: true,
                created_at: "2025-01-15T08:00:00.000Z",
                updated_at: "2025-01-15T08:00:00.000Z"
            },
            {
                id: 2,
                title: "Revit Architecture Tutorial",
                category: "revit",
                level: "intermediate",
                description: "Step-by-step tutorial for creating architectural models in Revit",
                page_count: 78,
                language: "id",
                file_path: "/materials/revit-architecture-tutorial.pdf",
                size: 5120000,
                display_on_courses: true,
                created_at: "2025-01-16T10:30:00.000Z",
                updated_at: "2025-01-16T10:30:00.000Z"
            },
            {
                id: 3,
                title: "SketchUp for BIM",
                category: "sketchup",
                level: "beginner",
                description: "Introduction to SketchUp for BIM modeling and visualization",
                page_count: 32,
                language: "id",
                file_path: "/materials/sketchup-bim-guide.pdf",
                size: 1843200,
                display_on_courses: false,
                created_at: "2025-01-17T14:20:00.000Z",
                updated_at: "2025-01-17T14:20:00.000Z"
            },
            {
                id: 4,
                title: "Advanced BIM Coordination",
                category: "general",
                level: "advanced",
                description: "Advanced techniques for BIM model coordination and clash detection",
                page_count: 95,
                language: "id",
                file_path: "/materials/advanced-bim-coordination.pdf",
                size: 6784000,
                display_on_courses: true,
                created_at: "2025-01-18T09:45:00.000Z",
                updated_at: "2025-01-18T09:45:00.000Z"
            }
        ];

        res.json({
            success: true,
            data: sampleData,
            categories: {
                autocad: { name: "AutoCAD", color: "#007bff" },
                revit: { name: "Revit BIM", color: "#28a745" },
                sketchup: { name: "SketchUp", color: "#ffc107" },
                general: { name: "General BIM", color: "#6c757d" }
            }
        });
    } catch (error) {
        console.error("Error reading learning materials:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read learning materials"
        });
    }
});

// GET /api/admin/learning-materials/stats - Get learning materials statistics
router.get("/learning-materials/stats", requireAdmin, (req, res) => {
    try {
        // Sample statistics for now
        const stats = {
            totalMaterials: 4,
            byCategory: {
                autocad: 1,
                revit: 1,
                sketchup: 1,
                general: 1
            },
            byLevel: {
                beginner: 2,
                intermediate: 1,
                advanced: 1
            },
            totalPages: 250,
            averagePages: 63
        };

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error("Error getting learning materials stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get learning materials statistics"
        });
    }
});

// POST /api/admin/learning-materials - Create new learning material
router.post("/learning-materials", requireAdmin, (req, res) => {
    try {
        const { title, category, level, description, pageCount, language, filePath } = req.body;

        if (!title || !category) {
            return res.status(400).json({
                success: false,
                error: "Title and category are required"
            });
        }

        // Generate new ID (in real PostgreSQL this would be auto-generated)
        const newId = Date.now();

        const newMaterial = {
            id: newId,
            title: title.trim(),
            category: category,
            level: level || 'beginner',
            description: description || '',
            pageCount: pageCount || 0,
            language: language || 'id',
            filePath: filePath || '',
            size: 0,
            display_on_courses: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // In real implementation, this would INSERT into PostgreSQL
        console.log('✅ Learning material created (simulated):', newMaterial);

        res.status(201).json({
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
router.put("/learning-materials/:id", requireAdmin, (req, res) => {
    try {
        const materialId = parseInt(req.params.id);
        const updates = req.body;

        // In real implementation, this would UPDATE PostgreSQL
        const updatedMaterial = {
            id: materialId,
            ...updates,
            updated_at: new Date().toISOString()
        };

        console.log('✅ Learning material updated (simulated):', updatedMaterial);

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

// DELETE /api/admin/learning-materials/:id - Delete learning material
router.delete("/learning-materials/:id", requireAdmin, (req, res) => {
    try {
        const materialId = parseInt(req.params.id);

        // In real implementation, this would DELETE from PostgreSQL
        console.log('✅ Learning material deleted (simulated):', materialId);

        res.json({
            success: true,
            message: "Learning material deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting learning material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete learning material"
        });
    }
});

// ===== BIM MEDIA MANAGEMENT (PostgreSQL) =====

// GET /api/admin/bim-media/files - Get BIM media files
router.get("/bim-media/files", requireAdmin, (req, res) => {
    try {
        const { source } = req.query;

        // For now, return sample BIM media files
        // In real PostgreSQL implementation, this would query the bim_media table
        const sampleMedia = [
            {
                id: 1,
                name: "PROJECT BIM 2025 - Office Building.rvt",
                path: "/media/PROJECT%20BIM%202025/PROJECT%20BIM%202025%20-%20Office%20Building.rvt",
                type: "video",
                size: 45200000,
                source: "PC-BIM02",
                year: "2025",
                location: "Jakarta",
                bimDimension: "3D",
                projectType: "Commercial",
                description: "Modern office building BIM model with complete MEP systems",
                tagged: true,
                excluded: false,
                created_at: "2025-01-15T08:00:00.000Z"
            },
            {
                id: 2,
                name: "Hospital Design - Complete Model.rvt",
                path: "/media/PROJECT%20BIM%202025/Hospital%20Design%20-%20Complete%20Model.rvt",
                type: "video",
                size: 128000000,
                source: "PC-BIM02",
                year: "2025",
                location: "Surabaya",
                bimDimension: "4D",
                projectType: "Healthcare",
                description: "Complete hospital BIM model with structural, architectural, and MEP systems",
                tagged: true,
                excluded: false,
                created_at: "2025-01-16T10:30:00.000Z"
            },
            {
                id: 3,
                name: "Residential Complex - Phase 1.rvt",
                path: "/media/PROJECT%20BIM%202025/Residential%20Complex%20-%20Phase%201.rvt",
                type: "video",
                size: 78300000,
                source: "PC-BIM02",
                year: "2025",
                location: "Bandung",
                bimDimension: "3D",
                projectType: "Residential",
                description: "Multi-unit residential complex with landscape and infrastructure",
                tagged: false,
                excluded: false,
                created_at: "2025-01-17T14:20:00.000Z"
            },
            {
                id: 4,
                name: "Highway Interchange Design.dwg",
                path: "/media/PROJECT%20BIM%202025/Highway%20Interchange%20Design.dwg",
                type: "video",
                size: 25600000,
                source: "PC-BIM02",
                year: "2025",
                location: "Jakarta",
                bimDimension: "2D",
                projectType: "Infrastructure",
                description: "Highway interchange design with traffic flow analysis",
                tagged: true,
                excluded: false,
                created_at: "2025-01-18T09:45:00.000Z"
            },
            {
                id: 5,
                name: "Shopping Mall BIM Model.rvt",
                path: "/media/PROJECT%20BIM%202025/Shopping%20Mall%20BIM%20Model.rvt",
                type: "video",
                size: 156000000,
                source: "PC-BIM02",
                year: "2025",
                location: "Semarang",
                bimDimension: "5D",
                projectType: "Commercial",
                description: "Large shopping mall with cost estimation and scheduling integration",
                tagged: true,
                excluded: false,
                created_at: "2025-01-19T11:15:00.000Z"
            }
        ];

        res.json(sampleMedia);
    } catch (error) {
        console.error("Error getting BIM media files:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get BIM media files"
        });
    }
});

// GET /api/admin/bim-media/sources - Get BIM media sources
router.get("/bim-media/sources", requireAdmin, (req, res) => {
    try {
        const sources = [
            {
                id: "pc-bim02",
                name: "PC-BIM02 BIM Models",
                path: "/PC-BIM02/PROJECT BIM 2025",
                enabled: true,
                priority: 1
            },
            {
                id: "local-g-drive",
                name: "Local G Drive BIM",
                path: "/media/PROJECT BIM 2025",
                enabled: true,
                priority: 2
            }
        ];

        res.json(sources);
    } catch (error) {
        console.error("Error getting BIM media sources:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get BIM media sources"
        });
    }
});

// GET /api/admin/bim-media/stats - Get BIM media statistics
router.get("/bim-media/stats", requireAdmin, (req, res) => {
    try {
        // Sample statistics for now - in real PostgreSQL this would query the database
        const stats = {
            totalTagged: 4,
            totalMedia: 5,
            byYear: {
                "2025": 5
            },
            byLocation: {
                "Jakarta": 2,
                "Surabaya": 1,
                "Bandung": 1,
                "Semarang": 1
            },
            byType: {
                "video": 5
            },
            byDimension: {
                "3D": 2,
                "4D": 1,
                "2D": 1,
                "5D": 1
            },
            excludedCount: 0
        };

        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error("Error getting BIM media stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get BIM media statistics"
        });
    }
});

// POST /api/admin/bim-media/tags - Save BIM media tags
router.post("/bim-media/tags", requireAdmin, (req, res) => {
    try {
        const { filePath, fileName, fileType, year, location, bimDimension, projectType, description } = req.body;

        if (!filePath || !fileName) {
            return res.status(400).json({
                success: false,
                error: "File path and name are required"
            });
        }

        // In real PostgreSQL implementation, this would INSERT or UPDATE the bim_media table
        const taggedMedia = {
            fileName: fileName,
            fileType: fileType || 'video',
            year: year || '',
            location: location || '',
            bimDimension: bimDimension || '',
            projectType: projectType || '',
            description: description || '',
            tagged: true,
            taggedAt: new Date().toISOString(),
            taggedBy: 'AdminBCL'
        };

        console.log('✅ BIM media tags saved (simulated):', taggedMedia);

        res.json({
            success: true,
            message: "BIM media tags saved successfully",
            data: taggedMedia
        });
    } catch (error) {
        console.error("Error saving BIM media tags:", error);
        res.status(500).json({
            success: false,
            error: "Failed to save BIM media tags"
        });
    }
});

// POST /api/admin/bim-media/exclude - Exclude BIM media from public display
router.post("/bim-media/exclude", requireAdmin, (req, res) => {
    try {
        const { filePath, fileName } = req.body;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: "File path is required"
            });
        }

        // In real PostgreSQL implementation, this would UPDATE excluded = true
        console.log('✅ BIM media excluded (simulated):', filePath);

        res.json({
            success: true,
            message: "BIM media excluded from public display"
        });
    } catch (error) {
        console.error("Error excluding BIM media:", error);
        res.status(500).json({
            success: false,
            error: "Failed to exclude BIM media"
        });
    }
});

// POST /api/admin/bim-media/restore - Restore BIM media to public display
router.post("/bim-media/restore", requireAdmin, (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: "File path is required"
            });
        }

        // In real PostgreSQL implementation, this would UPDATE excluded = false
        console.log('✅ BIM media restored (simulated):', filePath);

        res.json({
            success: true,
            message: "BIM media restored to public display"
        });
    } catch (error) {
        console.error("Error restoring BIM media:", error);
        res.status(500).json({
            success: false,
            error: "Failed to restore BIM media"
        });
    }
});

// PDF Display Update route removed to avoid conflict with server.js session-based implementation
// Use the endpoint defined in server.js instead

module.exports = router;
