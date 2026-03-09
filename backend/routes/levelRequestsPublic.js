const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { requireAuthenticated } = require('../utils/auth');

const router = express.Router();
const LEVEL_REQUESTS_FILE = path.join(__dirname, "../level-requests.json");
const USERS_FILE = path.join(__dirname, "../users.json");

function resolveRequestUserId(req) {
    const authUser = req.authUser || req.user;
    if (!authUser) return null;

    const userId = authUser.id || authUser.email || authUser.username;
    return userId ? String(userId) : null;
}

router.use(requireAuthenticated);

// Multer configuration for file uploads (evidence/certificates)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../uploads/level-requests");
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

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: PDF, images, documents.`), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit per file
    }
});

// Initialize level requests file if it doesn't exist
function initializeLevelRequestsFile() {
    if (!fs.existsSync(LEVEL_REQUESTS_FILE)) {
        const initialData = {
            requests: [],
            metadata: {
                totalRequests: 0,
                pendingRequests: 0,
                approvedRequests: 0,
                rejectedRequests: 0,
                lastUpdated: new Date().toISOString()
            }
        };
        fs.writeFileSync(LEVEL_REQUESTS_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ Initialized level-requests.json file');
    }
}

// Helper function to update metadata
function updateLevelRequestsMetadata(data) {
    const requests = data.requests;

    const statusCounts = {
        pending: requests.filter(r => r.status === 'pending' || r.status === 'under_review').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        additional_info: requests.filter(r => r.status === 'additional_info').length
    };

    data.metadata = {
        totalRequests: requests.length,
        ...statusCounts,
        lastUpdated: new Date().toISOString()
    };

    return data;
}

// Helper function to read users
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = fs.readFileSync(USERS_FILE, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users file:", err);
        return [];
    }
}

// GET /api/level-requests/my - Get current user's level requests
router.get("/my", (req, res) => {
    try {
        const userId = resolveRequestUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));

        // Filter requests for current user
        const userRequests = data.requests.filter(r => String(r.userId) === userId);

        // Sort by submission date (newest first)
        userRequests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        res.json({
            success: true,
            data: userRequests
        });
    } catch (error) {
        console.error("Error reading user level requests:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read level requests"
        });
    }
});

// POST /api/level-requests - Submit new level request
router.post("/", upload.array('evidenceFiles', 5), (req, res) => {
    try {
        const userId = resolveRequestUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const {
            targetLevel,
            reason,
            workExperience,
            projectExamples,
            additionalCertifications,
            supervisorEmail
        } = req.body;

        // Validation
        if (!targetLevel || !reason) {
            return res.status(400).json({
                success: false,
                error: 'Target level and reason are required'
            });
        }

        // Check if user already has a pending request for this level
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const existingRequest = data.requests.find(r =>
            String(r.userId) === userId &&
            r.targetLevel === targetLevel &&
            ['pending', 'under_review'].includes(r.status)
        );

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                error: 'You already have a pending request for this level'
            });
        }

        // Process uploaded files
        let evidenceFiles = [];
        if (req.files && req.files.length > 0) {
            evidenceFiles = req.files.map(file => ({
                originalName: file.originalname,
                filename: file.filename,
                path: `/uploads/level-requests/${file.filename}`,
                size: file.size,
                mimetype: file.mimetype
            }));
        }

        // Create new request
        const newRequest = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            targetLevel,
            reason,
            workExperience: workExperience || '',
            projectExamples: projectExamples || '',
            additionalCertifications: additionalCertifications || '',
            supervisorEmail: supervisorEmail || '',
            evidenceFiles,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add to requests
        data.requests.push(newRequest);

        // Update metadata
        const updatedData = updateLevelRequestsMetadata(data);
        fs.writeFileSync(LEVEL_REQUESTS_FILE, JSON.stringify(updatedData, null, 2));

        console.log(`✅ Level upgrade request submitted by user ${userId} for ${targetLevel}`);

        res.status(201).json({
            success: true,
            message: 'Level upgrade request submitted successfully',
            data: {
                id: newRequest.id,
                targetLevel: newRequest.targetLevel,
                status: newRequest.status,
                submittedAt: newRequest.submittedAt
            }
        });

    } catch (error) {
        console.error("Error submitting level request:", error);

        // Clean up uploaded files if request failed
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const filePath = path.join(__dirname, "../uploads/level-requests", file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        res.status(500).json({
            success: false,
            error: "Failed to submit level request"
        });
    }
});

// GET /api/level-requests/:id - Get specific request (user can only view their own)
router.get("/:id(req_[^/]+)", (req, res) => {
    try {
        const userId = resolveRequestUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const request = data.requests.find(r => r.id === req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                error: "Level request not found"
            });
        }

        // Check if user owns this request
        if (String(request.userId) !== userId) {
            return res.status(403).json({
                success: false,
                error: "Access denied. You can only view your own requests"
            });
        }

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error("Error reading level request:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read level request"
        });
    }
});

// PUT /api/level-requests/:id - Update request (only if pending)
router.put("/:id(req_[^/]+)", upload.array('evidenceFiles', 5), (req, res) => {
    try {
        const userId = resolveRequestUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const requestIndex = data.requests.findIndex(r => r.id === req.params.id);

        if (requestIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Level request not found"
            });
        }

        const request = data.requests[requestIndex];

        // Check if user owns this request
        if (String(request.userId) !== userId) {
            return res.status(403).json({
                success: false,
                error: "Access denied. You can only update your own requests"
            });
        }

        // Only allow updates if request is still pending
        if (!['pending', 'additional_info'].includes(request.status)) {
            return res.status(400).json({
                success: false,
                error: "Cannot update request that is already under review or completed"
            });
        }

        // Process uploaded files
        let evidenceFiles = request.evidenceFiles || [];
        if (req.files && req.files.length > 0) {
            const newFiles = req.files.map(file => ({
                originalName: file.originalname,
                filename: file.filename,
                path: `/uploads/level-requests/${file.filename}`,
                size: file.size,
                mimetype: file.mimetype
            }));
            evidenceFiles = [...evidenceFiles, ...newFiles];
        }

        // Update request
        const updatedRequest = {
            ...request,
            ...req.body,
            evidenceFiles,
            updatedAt: new Date().toISOString()
        };

        data.requests[requestIndex] = updatedRequest;

        // Update metadata
        const updatedData = updateLevelRequestsMetadata(data);
        fs.writeFileSync(LEVEL_REQUESTS_FILE, JSON.stringify(updatedData, null, 2));

        console.log(`✅ Level request ${req.params.id} updated by user ${userId}`);

        res.json({
            success: true,
            message: 'Level request updated successfully',
            data: updatedRequest
        });

    } catch (error) {
        console.error("Error updating level request:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update level request"
        });
    }
});

// DELETE /api/level-requests/:id - Cancel request (only if pending)
router.delete("/:id(req_[^/]+)", (req, res) => {
    try {
        const userId = resolveRequestUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const requestIndex = data.requests.findIndex(r => r.id === req.params.id);

        if (requestIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Level request not found"
            });
        }

        const request = data.requests[requestIndex];

        // Check if user owns this request
        if (String(request.userId) !== userId) {
            return res.status(403).json({
                success: false,
                error: "Access denied. You can only delete your own requests"
            });
        }

        // Only allow deletion if request is still pending
        if (!['pending'].includes(request.status)) {
            return res.status(400).json({
                success: false,
                error: "Cannot cancel request that is under review or completed"
            });
        }

        // Delete associated files
        if (request.evidenceFiles && request.evidenceFiles.length > 0) {
            request.evidenceFiles.forEach(file => {
                const filePath = path.join(__dirname, "../uploads/level-requests", file.filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        data.requests.splice(requestIndex, 1);

        // Update metadata
        const updatedData = updateLevelRequestsMetadata(data);
        fs.writeFileSync(LEVEL_REQUESTS_FILE, JSON.stringify(updatedData, null, 2));

        console.log(`✅ Level request ${req.params.id} cancelled by user ${userId}`);

        res.json({
            success: true,
            message: "Level request cancelled successfully"
        });

    } catch (error) {
        console.error("Error cancelling level request:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cancel level request"
        });
    }
});

// GET /api/level-requests/user/progress - Get user's level progress info
router.get("/user/progress", (req, res) => {
    try {
        const userId = resolveRequestUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Get user data
        const users = readUsers();
        const user = users.find(u =>
            (u.id != null && String(u.id) === userId) ||
            (u.email && String(u.email) === userId)
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get user's requests
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const userRequests = data.requests.filter(r => String(r.userId) === userId);

        // Calculate progress info
        const currentLevel = user.bimLevel || user.bim_level || 'BIM Modeller';
        const progressInfo = {
            currentLevel,
            levelProgress: calculateLevelProgress(user, userRequests),
            availableUpgrades: getAvailableUpgrades(currentLevel, user),
            recentRequests: userRequests.slice(0, 5) // Last 5 requests
        };

        res.json({
            success: true,
            data: progressInfo
        });

    } catch (error) {
        console.error("Error getting user progress:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get user progress"
        });
    }
});

// Helper functions
function calculateLevelProgress(user, requests) {
    const currentLevel = user.bimLevel || user.bim_level || 'BIM Modeller';
    let progress = 0;

    // Basic progress calculation based on completed requirements
    if (currentLevel === 'BIM Modeller') {
        // Check if user has completed courses and exams
        const completedCourses = user.progress?.coursesCompleted || 0;
        const passedExams = user.progress?.examsPassed || 0;

        progress = Math.min((completedCourses * 0.4 + passedExams * 0.4) * 100, 75);

        // Add time-based progress
        const registrationDate = new Date(user.registrationDate);
        const monthsSinceRegistration = (Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsSinceRegistration >= 6) {
            progress = Math.min(progress + 25, 100);
        }
    }

    return Math.round(progress);
}

function getAvailableUpgrades(currentLevel, user) {
    const upgrades = [];

    if (currentLevel === 'BIM Modeller') {
        const progress = calculateLevelProgress(user, []);
        if (progress >= 75) {
            upgrades.push({
                level: 'BIM Coordinator',
                requirements: [
                    'Complete all BIM Modeller courses',
                    'Pass BIM Modeller certification exam',
                    'Minimum 6 months at current level'
                ],
                progress: progress
            });
        }
    }

    return upgrades;
}

module.exports = router;
