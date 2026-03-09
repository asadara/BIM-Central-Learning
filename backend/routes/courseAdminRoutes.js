const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const COURSES_FILE = path.join(__dirname, "../courses.json");

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../uploads/courses");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// GET /api/admin/courses - Mendapatkan semua courses
router.get("/courses", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        res.json({
            success: true,
            data: coursesData.courses,
            categories: coursesData.categories,
            metadata: coursesData.metadata
        });
    } catch (error) {
        console.error("Error reading courses file:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read courses data"
        });
    }
});

// GET /api/admin/courses/:id - Mendapatkan course berdasarkan ID
router.get("/courses/:id", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        const course = coursesData.courses.find(c => c.id === req.params.id);

        if (!course) {
            return res.status(404).json({
                success: false,
                error: "Course not found"
            });
        }

        res.json({
            success: true,
            data: course
        });
    } catch (error) {
        console.error("Error reading course:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read course data"
        });
    }
});

// POST /api/admin/courses - Membuat course baru
router.post("/courses", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));

        const newCourse = {
            id: req.body.id || `course-${Date.now()}`,
            title: req.body.title,
            description: req.body.description,
            category: req.body.category,
            instructor: req.body.instructor,
            videoCount: parseInt(req.body.videoCount) || 1,
            duration: req.body.duration || "1 jam",
            level: req.body.level || "Beginner",
            language: req.body.language || "Bahasa Indonesia",
            thumbnail: req.body.thumbnail || "images/course-default.jpg",
            price: req.body.price || "Gratis",
            tags: req.body.tags || [],
            modules: req.body.modules || [],
            createdDate: new Date().toISOString().split('T')[0],
            updatedDate: new Date().toISOString().split('T')[0],
            status: req.body.status || "Draft",
            completionRate: 0
        };

        // Validasi required fields
        if (!newCourse.title || !newCourse.description) {
            return res.status(400).json({
                success: false,
                error: "Title and description are required"
            });
        }

        // Cek duplikasi ID
        if (coursesData.courses.find(c => c.id === newCourse.id)) {
            return res.status(400).json({
                success: false,
                error: "Course ID already exists"
            });
        }

        coursesData.courses.push(newCourse);

        // Update metadata
        coursesData.metadata.lastUpdated = new Date().toISOString();
        coursesData.metadata.updatedBy = "AdminBCL";
        coursesData.metadata.totalCourses = coursesData.courses.length;
        coursesData.metadata.publishedCourses = coursesData.courses.filter(c => c.status === "Published").length;
        coursesData.metadata.draftCourses = coursesData.courses.filter(c => c.status === "Draft").length;

        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Course created successfully",
            data: newCourse
        });

    } catch (error) {
        console.error("Error creating course:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create course"
        });
    }
});

// PUT /api/admin/courses/:id - Update course
router.put("/courses/:id", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        const courseIndex = coursesData.courses.findIndex(c => c.id === req.params.id);

        if (courseIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Course not found"
            });
        }

        // Update course data
        const updatedCourse = { ...coursesData.courses[courseIndex], ...req.body };
        updatedCourse.updatedDate = new Date().toISOString().split('T')[0];

        coursesData.courses[courseIndex] = updatedCourse;

        // Update metadata
        coursesData.metadata.lastUpdated = new Date().toISOString();
        coursesData.metadata.updatedBy = "AdminBCL";
        coursesData.metadata.publishedCourses = coursesData.courses.filter(c => c.status === "Published").length;
        coursesData.metadata.draftCourses = coursesData.courses.filter(c => c.status === "Draft").length;

        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Course updated successfully",
            data: updatedCourse
        });

    } catch (error) {
        console.error("Error updating course:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update course"
        });
    }
});

// DELETE /api/admin/courses/:id - Hapus course
router.delete("/courses/:id", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        const courseIndex = coursesData.courses.findIndex(c => c.id === req.params.id);

        if (courseIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Course not found"
            });
        }

        const deletedCourse = coursesData.courses[courseIndex];
        coursesData.courses.splice(courseIndex, 1);

        // Update metadata
        coursesData.metadata.lastUpdated = new Date().toISOString();
        coursesData.metadata.updatedBy = "AdminBCL";
        coursesData.metadata.totalCourses = coursesData.courses.length;
        coursesData.metadata.publishedCourses = coursesData.courses.filter(c => c.status === "Published").length;
        coursesData.metadata.draftCourses = coursesData.courses.filter(c => c.status === "Draft").length;

        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Course deleted successfully",
            data: deletedCourse
        });

    } catch (error) {
        console.error("Error deleting course:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete course"
        });
    }
});

// POST /api/admin/courses/:id/upload - Upload thumbnail untuk course
router.post("/courses/:id/upload", requireAdmin, upload.single('thumbnail'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        const courseIndex = coursesData.courses.findIndex(c => c.id === req.params.id);

        if (courseIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Course not found"
            });
        }

        const thumbnailPath = `/uploads/courses/${req.file.filename}`;
        coursesData.courses[courseIndex].thumbnail = thumbnailPath;
        coursesData.courses[courseIndex].updatedDate = new Date().toISOString().split('T')[0];

        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Thumbnail uploaded successfully",
            thumbnailUrl: thumbnailPath
        });

    } catch (error) {
        console.error("Error uploading thumbnail:", error);
        res.status(500).json({
            success: false,
            error: "Failed to upload thumbnail"
        });
    }
});

// GET /api/admin/categories - Mendapatkan semua categories
router.get("/categories", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        res.json({
            success: true,
            data: coursesData.categories
        });
    } catch (error) {
        console.error("Error reading categories:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read categories data"
        });
    }
});

// POST /api/admin/categories - Membuat category baru
router.post("/categories", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));

        const newCategory = {
            id: req.body.id,
            name: req.body.name,
            description: req.body.description,
            color: req.body.color || "#667eea",
            icon: req.body.icon || "fas fa-tag"
        };

        // Validasi required fields
        if (!newCategory.id || !newCategory.name) {
            return res.status(400).json({
                success: false,
                error: "Category ID and name are required"
            });
        }

        // Cek duplikasi ID
        if (coursesData.categories.find(c => c.id === newCategory.id)) {
            return res.status(400).json({
                success: false,
                error: "Category ID already exists"
            });
        }

        coursesData.categories.push(newCategory);
        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Category created successfully",
            data: newCategory
        });

    } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create category"
        });
    }
});

// PUT /api/admin/categories/:id - Update category
router.put("/categories/:id", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        const categoryIndex = coursesData.categories.findIndex(c => c.id === req.params.id);

        if (categoryIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Category not found"
            });
        }

        coursesData.categories[categoryIndex] = { ...coursesData.categories[categoryIndex], ...req.body };
        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Category updated successfully",
            data: coursesData.categories[categoryIndex]
        });

    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update category"
        });
    }
});

// DELETE /api/admin/categories/:id - Hapus category
router.delete("/categories/:id", requireAdmin, (req, res) => {
    try {
        const coursesData = JSON.parse(fs.readFileSync(COURSES_FILE, "utf8"));
        const categoryIndex = coursesData.categories.findIndex(c => c.id === req.params.id);

        if (categoryIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Category not found"
            });
        }

        const deletedCategory = coursesData.categories[categoryIndex];
        coursesData.categories.splice(categoryIndex, 1);

        fs.writeFileSync(COURSES_FILE, JSON.stringify(coursesData, null, 2));

        res.json({
            success: true,
            message: "Category deleted successfully",
            data: deletedCategory
        });

    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete category"
        });
    }
});

module.exports = router;
