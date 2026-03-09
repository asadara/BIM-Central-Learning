const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const EXAM_MATERIALS_FILE = path.join(__dirname, "../exam-materials.json");

// GET /api/exam-materials - Mendapatkan semua exam materials untuk student
router.get("/", (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));

        // Filter hanya exams yang aktif dan published
        const activeExams = examsData.exams.filter(e => e.status === 'published' && e.isActive);

        // Remove sensitive information like answer keys for public access
        const publicExams = activeExams.map(exam => {
            const { answerKeyPath, ...publicExam } = exam;
            return publicExam;
        });

        res.json({
            success: true,
            data: publicExams,
            count: publicExams.length
        });
    } catch (error) {
        console.error("Error reading exam materials for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load exam materials"
        });
    }
});

// GET /api/exam-materials/:id - Mendapatkan exam material spesifik untuk student
router.get("/:id", (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const exam = examsData.exams.find(e => e.id === req.params.id);

        if (!exam || exam.status !== 'published' || !exam.isActive) {
            return res.status(404).json({
                success: false,
                error: "Exam material not found or not available"
            });
        }

        // Remove sensitive information
        const { answerKeyPath, ...publicExam } = exam;

        res.json({
            success: true,
            data: publicExam
        });
    } catch (error) {
        console.error("Error reading exam material for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load exam material"
        });
    }
});

// GET /api/exam-materials/categories/:category - Get exams by category for students
router.get("/categories/:category", (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const category = req.params.category;

        const filteredExams = examsData.exams.filter(e =>
            e.category.toLowerCase() === category.toLowerCase() &&
            e.status === 'published' && e.isActive
        );

        // Remove sensitive information
        const publicExams = filteredExams.map(exam => {
            const { answerKeyPath, ...publicExam } = exam;
            return publicExam;
        });

        res.json({
            success: true,
            category: category,
            count: publicExams.length,
            data: publicExams
        });
    } catch (error) {
        console.error("Error getting exams by category for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load exams by category"
        });
    }
});

// GET /api/exam-materials/levels/:level - Get exams by level for students
router.get("/levels/:level", (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const level = req.params.level;

        const filteredExams = examsData.exams.filter(e =>
            e.level.toLowerCase() === level.toLowerCase() &&
            e.status === 'published' && e.isActive
        );

        // Remove sensitive information
        const publicExams = filteredExams.map(exam => {
            const { answerKeyPath, ...publicExam } = exam;
            return publicExam;
        });

        res.json({
            success: true,
            level: level,
            count: publicExams.length,
            data: publicExams
        });
    } catch (error) {
        console.error("Error getting exams by level for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load exams by level"
        });
    }
});

// GET /api/exam-materials/search - Search exams
router.get("/search", (req, res) => {
    try {
        const { q, category, level } = req.query;
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));

        let filteredExams = examsData.exams.filter(e => e.status === 'published' && e.isActive);

        // Apply search query
        if (q) {
            const searchTerm = q.toLowerCase();
            filteredExams = filteredExams.filter(e =>
                e.title.toLowerCase().includes(searchTerm) ||
                e.description.toLowerCase().includes(searchTerm) ||
                e.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // Apply category filter
        if (category) {
            filteredExams = filteredExams.filter(e =>
                e.category.toLowerCase() === category.toLowerCase()
            );
        }

        // Apply level filter
        if (level) {
            filteredExams = filteredExams.filter(e =>
                e.level.toLowerCase() === level.toLowerCase()
            );
        }

        // Remove sensitive information
        const publicExams = filteredExams.map(exam => {
            const { answerKeyPath, ...publicExam } = exam;
            return publicExam;
        });

        res.json({
            success: true,
            query: q,
            filters: { category, level },
            count: publicExams.length,
            data: publicExams
        });
    } catch (error) {
        console.error("Error searching exams for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to search exams"
        });
    }
});

// GET /api/exam-materials/courses/:courseId - Get exams by course ID
router.get("/courses/:courseId", (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));
        const courseId = req.params.courseId;

        const filteredExams = examsData.exams.filter(e =>
            e.courseId === courseId &&
            e.status === 'published' && e.isActive
        );

        // Remove sensitive information
        const publicExams = filteredExams.map(exam => {
            const { answerKeyPath, ...publicExam } = exam;
            return publicExam;
        });

        res.json({
            success: true,
            courseId: courseId,
            count: publicExams.length,
            data: publicExams
        });
    } catch (error) {
        console.error("Error getting exams by course for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load exams by course"
        });
    }
});

// GET /api/exam-materials/available - Get available exams for current user
// This would integrate with user progress tracking in a full implementation
router.get("/available", (req, res) => {
    try {
        const examsData = JSON.parse(fs.readFileSync(EXAM_MATERIALS_FILE, "utf8"));

        // In a full implementation, this would filter based on user progress, prerequisites, etc.
        const availableExams = examsData.exams.filter(e =>
            e.status === 'published' && e.isActive
        );

        // Remove sensitive information
        const publicExams = availableExams.map(exam => {
            const { answerKeyPath, ...publicExam } = exam;
            return publicExam;
        });

        res.json({
            success: true,
            count: publicExams.length,
            data: publicExams
        });
    } catch (error) {
        console.error("Error getting available exams for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load available exams"
        });
    }
});

module.exports = router;
