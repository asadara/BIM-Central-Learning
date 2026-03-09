const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const LEVEL_REQUESTS_FILE = path.join(__dirname, "../level-requests.json");

const requireAdminBCL = requireAdmin;

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
        fileSize: 10 * 1024 * 1024 // 10MB limit
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

// GET /api/admin/level-requests - Get all level requests (admin only)
router.get("/", requireAdminBCL, (req, res) => {
    try {
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));

        // Apply filters if provided
        let requests = [...data.requests];

        if (req.query.status) {
            requests = requests.filter(r => r.status === req.query.status);
        }

        if (req.query.userId) {
            requests = requests.filter(r => r.userId === req.query.userId);
        }

        if (req.query.targetLevel) {
            requests = requests.filter(r => r.targetLevel === req.query.targetLevel);
        }

        // Sort by submission date (newest first)
        requests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        res.json({
            success: true,
            data: requests,
            metadata: data.metadata,
            filters: req.query
        });
    } catch (error) {
        console.error("Error reading level requests:", error);
        res.status(500).json({
            success: false,
            error: "Failed to read level requests data"
        });
    }
});

// GET /api/admin/level-requests/:id - Get specific level request
router.get("/:id", requireAdminBCL, (req, res) => {
    try {
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const request = data.requests.find(r => r.id === req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                error: "Level request not found"
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
            error: "Failed to read level request data"
        });
    }
});

// PUT /api/admin/level-requests/:id/status - Update request status (admin only)
router.put("/:id/status", requireAdminBCL, (req, res) => {
    try {
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const requestIndex = data.requests.findIndex(r => r.id === req.params.id);

        if (requestIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Level request not found"
            });
        }

        const { status, adminComments, reviewDate } = req.body;

        if (!['pending', 'under_review', 'approved', 'rejected', 'additional_info'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: "Invalid status. Must be: pending, under_review, approved, rejected, or additional_info"
            });
        }

        // Update request
        data.requests[requestIndex] = {
            ...data.requests[requestIndex],
            status,
            adminComments: adminComments || data.requests[requestIndex].adminComments,
            reviewedBy: req.user?.email || 'AdminBCL',
            reviewedAt: reviewDate || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Update metadata
        const updatedData = updateLevelRequestsMetadata(data);
        fs.writeFileSync(LEVEL_REQUESTS_FILE, JSON.stringify(updatedData, null, 2));

        // TODO: Send notification email to user about status change

        res.json({
            success: true,
            message: `Level request status updated to ${status}`,
            data: data.requests[requestIndex]
        });

    } catch (error) {
        console.error("Error updating level request status:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update level request status"
        });
    }
});

// DELETE /api/admin/level-requests/:id - Delete level request (admin only)
router.delete("/:id", requireAdminBCL, (req, res) => {
    try {
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));
        const requestIndex = data.requests.findIndex(r => r.id === req.params.id);

        if (requestIndex === -1) {
            return res.status(404).json({
                success: false,
                error: "Level request not found"
            });
        }

        const deletedRequest = data.requests[requestIndex];

        // Delete associated files if they exist
        if (deletedRequest.evidenceFiles && deletedRequest.evidenceFiles.length > 0) {
            deletedRequest.evidenceFiles.forEach(filePath => {
                const fullPath = path.join(__dirname, "../", filePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            });
        }

        data.requests.splice(requestIndex, 1);

        // Update metadata
        const updatedData = updateLevelRequestsMetadata(data);
        fs.writeFileSync(LEVEL_REQUESTS_FILE, JSON.stringify(updatedData, null, 2));

        res.json({
            success: true,
            message: "Level request deleted successfully",
            data: deletedRequest
        });

    } catch (error) {
        console.error("Error deleting level request:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete level request"
        });
    }
});

// GET /api/admin/level-requests/stats/summary - Get request statistics
router.get("/stats/summary", requireAdminBCL, (req, res) => {
    try {
        initializeLevelRequestsFile();
        const data = JSON.parse(fs.readFileSync(LEVEL_REQUESTS_FILE, "utf8"));

        const requests = data.requests;
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const recentRequests = requests.filter(r => new Date(r.submittedAt) > last30Days);

        const stats = {
            total: requests.length,
            pending: requests.filter(r => r.status === 'pending' || r.status === 'under_review').length,
            approved: requests.filter(r => r.status === 'approved').length,
            rejected: requests.filter(r => r.status === 'rejected').length,
            additionalInfo: requests.filter(r => r.status === 'additional_info').length,
            recentRequests: recentRequests.length,
            averageProcessingTime: calculateAverageProcessingTime(requests),
            levelBreakdown: calculateLevelBreakdown(requests)
        };

        res.json({
            success: true,
            data: stats,
            lastUpdated: data.metadata.lastUpdated
        });

    } catch (error) {
        console.error("Error getting level request stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get level request statistics"
        });
    }
});

// Helper functions for statistics
function calculateAverageProcessingTime(requests) {
    const completedRequests = requests.filter(r =>
        r.status === 'approved' || r.status === 'rejected'
    );

    if (completedRequests.length === 0) return 0;

    const totalTime = completedRequests.reduce((sum, r) => {
        const submitted = new Date(r.submittedAt);
        const completed = new Date(r.reviewedAt || r.updatedAt);
        return sum + (completed - submitted);
    }, 0);

    return Math.round(totalTime / completedRequests.length / (1000 * 60 * 60 * 24)); // days
}

function calculateLevelBreakdown(requests) {
    const breakdown = {};

    requests.forEach(r => {
        if (!breakdown[r.targetLevel]) {
            breakdown[r.targetLevel] = {
                total: 0,
                approved: 0,
                rejected: 0,
                pending: 0
            };
        }

        breakdown[r.targetLevel].total++;

        switch (r.status) {
            case 'approved':
                breakdown[r.targetLevel].approved++;
                break;
            case 'rejected':
                breakdown[r.targetLevel].rejected++;
                break;
            default:
                breakdown[r.targetLevel].pending++;
        }
    });

    return breakdown;
}

module.exports = router;
