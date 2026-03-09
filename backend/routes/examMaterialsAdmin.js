const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const EXAM_MATERIALS_FILE = path.join(__dirname, "../exam-materials.json");

const requireAdminBCL = requireAdmin;

// Multer configuration for exam materials upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = req.body.category || 'practice';
        const uploadDir = path.join(__dirname, "../uploads/exam-materials", category);

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

// File filter for exam materials
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/json'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: PDF, Word docs, Excel, text files.`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for exam materials
    }
});

// GET /api/admin/exam-materials - Mendapatkan semua exam materials
router.get("/", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        res.json({
            success: true,
            data: examsData.exams,
            metadata: examsData.metadata
        });
    } catch (error) {
        console.error("Error reading exam materials file:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read exam materials data"
        });
    }
});

// GET /api/admin/exam-materials/:id - Mendapatkan exam material berdasarkan ID
router.get("/:id", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const exam = examsData.exams.find(e => e.id === req.params.id);

        if (!exam) {
            return res.status(404).json({
                success: false,
                error: "Exam material not found"
            });
        }

        res.json({
            success: true,
            data: exam
        });
    } catch (error) {
        console.error("Error reading exam material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read exam material data"
        });
    }
});

// POST /api/admin/exam-materials - Membuat exam material baru
router.post("/", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));

        const newExam = {
            id: req.body.id || `exam-${Date.now()}`,
            title: req.body.title,
            description: req.body.description || '',
            category: req.body.category || 'practice', // certification, practice, assessment
            courseId: req.body.courseId || null,
            level: req.body.level || 'beginner', // beginner, intermediate, advanced
            type: req.body.type || 'pdf', // pdf, docx, quiz, interactive
            filePath: req.body.filePath || null,
            answerKeyPath: req.body.answerKeyPath || null,
            fileSize: req.body.fileSize || 0,
            timeLimit: req.body.timeLimit || 60, // minutes
            passingScore: req.body.passingScore || 75, // percentage
            totalQuestions: req.body.totalQuestions || 0,
            tags: req.body.tags || [],
            instructions: req.body.instructions || '',
            isActive: req.body.isActive !== false,
            uploadedBy: req.body.uploadedBy || 'AdminBCL',
            uploadedAt: new Date().toISOString(),
            version: 1,
            status: req.body.status || 'draft'
        };

        // Validasi required fields
        if (!newExam.title) {
            return res.status(400).json({
                success: false,
                error: "Title is required"
            });
        }

        // Cek duplikasi ID
        if (examsData.exams.find(e => e.id === newExam.id)) {
            return res.status(400).json({
                success: false,
                error: "Exam ID already exists"
            });
        }

        examsData.exams.push(newExam);

        // Update metadata
        updateExamsMetadata(examsData);

        fs.writeFileSync(EXAM_MATERIALS_FILE, JSON.stringify(examsData, null, 2));

        res.json({
            success: true,
            message: "Exam material created successfully",
            data: newExam
        });

    } catch (error) {
        console.error("Error creating exam material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create exam material"
        });
    }
});

// PUT /api/admin/exam-materials/:id - Update exam material
router.put("/:id", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const examIndex = examsData.exams.findIndex(e => e.id === req.params.id);

        if (examIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Exam material not found"
            });
        }

        // Update exam data
        const updatedExam = {
            ...examsData.exams[examIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        examsData.exams[examIndex] = updatedExam;

        // Update metadata
        updateExamsMetadata(examsData);

        fs.writeFileSync(EXAM_MATERIALS_FILE, JSON.stringify(examsData, null, 2));

        res.json({
            success: true,
            message: "Exam material updated successfully",
            data: updatedExam
        });

    } catch (error) {
        console.error("Error updating exam material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update exam material"
        });
    }
});

// DELETE /api/admin/exam-materials/:id - Hapus exam material
router.delete("/:id", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const examIndex = examsData.exams.findIndex(e => e.id === req.params.id);

        if (examIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Exam material not found"
            });
        }

        const deletedExam = examsData.exams[examIndex];

        // Delete physical files if they exist
        if (deletedExam.filePath) {
            const fullPath = path.join(__dirname, "../", deletedExam.filePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        if (deletedExam.answerKeyPath) {
            const fullPath = path.join(__dirname, "../", deletedExam.answerKeyPath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        examsData.exams.splice(examIndex, 1);

        // Update metadata
        updateExamsMetadata(examsData);

        fs.writeFileSync(EXAM_MATERIALS_FILE, JSON.stringify(examsData, null, 2));

        res.json({
            success: true,
            message: "Exam material deleted successfully",
            data: deletedExam
        });

    } catch (error) {
        console.error("Error deleting exam material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete exam material"
        });
    }
});

// POST /api/admin/exam-materials/upload - Upload file untuk exam material
router.post("/upload", requireAdminBCL, upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerKey', maxCount: 1 }
]), (req, res) => {
    try {
        const category = req.body.category || 'practice';

        const response = {
            success: true,
            message: "Files uploaded successfully",
            files: {}
        };

        // Handle main exam file
        if (req.files.examFile && req.files.examFile[0]) {
            const examFile = req.files.examFile[0];
            const stats = fs.statSync(examFile.path);

            response.files.examFile = {
                filePath: `/uploads/exam-materials/${category}/${examFile.filename}`,
                fileName: examFile.originalname,
                fileSize: stats.size,
                mimeType: examFile.mimetype
            };
        }

        // Handle answer key file
        if (req.files.answerKey && req.files.answerKey[0]) {
            const answerKeyFile = req.files.answerKey[0];
            const stats = fs.statSync(answerKeyFile.path);

            response.files.answerKey = {
                filePath: `/uploads/exam-materials/${category}/${answerKeyFile.filename}`,
                fileName: answerKeyFile.originalname,
                fileSize: stats.size,
                mimeType: answerKeyFile.mimetype
            };
        }

        if (!req.files.examFile && !req.files.answerKey) {
            return res.status(400).json({
                success: false,
                error: "No files uploaded"
            });
        }

        res.json(response);

    } catch (error) {
        console.error("Error uploading exam files:", error);
        res.status(500).json({
            success: false,
            error: "Failed to upload files",
            detail: error.message
        });
    }
});

// GET /api/admin/exam-materials/levels/:level - Get exams by level
router.get("/levels/:level", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const level = req.params.level;

        const filteredExams = examsData.exams.filter(e =>
            e.level.toLowerCase() === level.toLowerCase()
        );

        res.json({
            success: true,
            level: level,
            count: filteredExams.length,
            data: filteredExams
        });
    } catch (error) {
        console.error("Error getting exams by level:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get exams by level"
        });
    }
});

// GET /api/admin/exam-materials/categories/:category - Get exams by category
router.get("/categories/:category", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const category = req.params.category;

        const filteredExams = examsData.exams.filter(e =>
            e.category.toLowerCase() === category.toLowerCase()
        );

        res.json({
            success: true,
            category: category,
            count: filteredExams.length,
            data: filteredExams
        });
    } catch (error) {
        console.error("Error getting exams by category:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get exams by category"
        });
    }
});

// PUT /api/admin/exam-materials/:id/publish - Publish exam
router.put("/:id/publish", requireAdminBCL, (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const examIndex = examsData.exams.findIndex(e => e.id === req.params.id);

        if (examIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Exam material not found"
            });
        }

        // Update exam status to published
        examsData.exams[examIndex].status = 'published';
        examsData.exams[examIndex].isActive = true;
        examsData.exams[examIndex].publishedAt = new Date().toISOString();
        examsData.exams[examIndex].publishedBy = 'AdminBCL';

        // Update metadata
        updateExamsMetadata(examsData);

        fs.writeFileSync(EXAM_MATERIALS_FILE, JSON.stringify(examsData, null, 2));

        res.json({
            success: true,
            message: "Exam published successfully",
            data: examsData.exams[examIndex]
        });

    } catch (error) {
        console.error("Error publishing exam:", error);
        res.status(500).json({
            success: false,
            error: "Failed to publish exam"
        });
    }
});

// Helper function to update exams metadata
function updateExamsMetadata(examsData) {
    const exams = examsData.exams;

    // Reset counters
    const levels = {};
    const categories = {};
    const types = {};

    exams.forEach(exam => {
        // Count by level
        levels[exam.level] = (levels[exam.level] || 0) + 1;

        // Count by category
        categories[exam.category] = (categories[exam.category] || 0) + 1;

        // Count by type
        types[exam.type] = (types[exam.type] || 0) + 1;
    });

    // Update metadata
    examsData.metadata.totalExams = exams.length;
    examsData.metadata.levels = levels;
    examsData.metadata.categories = categories;
    examsData.metadata.types = types;
    examsData.metadata.lastUpdated = new Date().toISOString();
    examsData.metadata.updatedBy = "AdminBCL";
}

module.exports = router;
