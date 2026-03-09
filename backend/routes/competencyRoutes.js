// Competency Mapping Routes
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { getRequestUser } = require('../utils/auth');

// Competency data storage
const COMPETENCY_DATA_FILE = path.join(__dirname, '..', 'competency-data.json');
const REPORTS_DATA_FILE = path.join(__dirname, '..', 'competency-reports.json');
const AUTHORITY_DATA_FILE = path.join(__dirname, '..', 'competency-authorities.json');
const USERS_FILE = path.join(__dirname, '..', 'users.json');

// PostgreSQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD || 'secure_password_2025',
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in competencyRoutes:', err.message);
});

// Competency Roles
const COMPETENCY_ROLES = {
    MANAGER: {
        level: 1,
        name: 'Manager Kompetensi',
        permissions: ['view_reports', 'generate_reports', 'export_reports']
    },
    AUTHORITY: {
        level: 2,
        name: 'Otoritas Legal',
        permissions: ['view_reports', 'generate_reports', 'export_reports',
                     'approve_reports', 'reject_reports', 'legal_signing']
    }
};

// Helper function to read competency data
async function readCompetencyData() {
    try {
        const data = await fs.readFile(COMPETENCY_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Return default structure if file doesn't exist
        return {
            users: [],
            lastUpdated: new Date().toISOString()
        };
    }
}

// Helper function to write competency data
async function writeCompetencyData(data) {
    await fs.writeFile(COMPETENCY_DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper function to read reports data
async function readReportsData() {
    try {
        const data = await fs.readFile(REPORTS_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Helper function to write reports data
async function writeReportsData(data) {
    await fs.writeFile(REPORTS_DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper function to read authorities data
async function readAuthoritiesData() {
    try {
        const data = await fs.readFile(AUTHORITY_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Helper function to write authorities data
async function writeAuthoritiesData(data) {
    await fs.writeFile(AUTHORITY_DATA_FILE, JSON.stringify(data, null, 2));
}

async function readUsersFile() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function fetchMappingAccessFromDb(userId, email) {
    const result = await pool.query(
        `SELECT mapping_kompetensi_access
         FROM users
         WHERE ($1::text IS NOT NULL AND id::text = $1::text)
            OR ($2::text IS NOT NULL AND email = $2)
         LIMIT 1`,
        [userId ? String(userId) : null, email || null]
    );

    if (result.rows.length === 0) return null;
    return !!result.rows[0].mapping_kompetensi_access;
}

async function fetchMappingAccessFromJson(userId, email) {
    const users = await readUsersFile();
    const user = users.find(u =>
        (userId && (u.id === userId || u.id == userId)) ||
        (email && u.email === email)
    );

    if (!user) return null;
    return !!(user.mappingKompetensiAccess || user.mapping_kompetensi_access);
}

// Competency Scoring Algorithm
function calculateCompetencyScore(user) {
    let totalScore = 0;

    // BIM Level Score (Base score)
    const bimLevelScores = {
        'BIM Modeller': 100,
        'BIM Coordinator': 200,
        'BIM Manager': 300,
        'Expert': 400
    };
    totalScore += bimLevelScores[user.bimLevel] || 0;

    // Learning Activities Score
    const progress = user.progress || {};
    totalScore += (progress.coursesCompleted || 0) * 50; // 50 points per course
    totalScore += (progress.examsPassed || 0) * 25; // 25 points per exam
    totalScore += (progress.certificatesEarned || 0) * 100; // 100 points per certificate

    // Activity Score (based on login count and recency)
    const loginCount = user.loginCount || 0;
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : new Date(0);
    const daysSinceLastLogin = (new Date() - lastLogin) / (1000 * 60 * 60 * 24);

    // Bonus for recent activity (max 50 points)
    const activityBonus = Math.max(0, 50 - Math.floor(daysSinceLastLogin / 7));
    totalScore += activityBonus;

    return Math.min(totalScore, 1000); // Cap at 1000 points
}

// Determine competency level from score
function getCompetencyLevel(score) {
    if (score >= 800) return 'Expert';
    if (score >= 600) return 'Advanced';
    if (score >= 400) return 'Intermediate';
    if (score >= 200) return 'Beginner';
    return 'Novice';
}

function normalizeLevelName(level) {
    const value = String(level || '').trim().toLowerCase();
    if (value === 'expert') return 'Expert';
    if (value === 'advanced') return 'Advanced';
    if (value === 'intermediate') return 'Intermediate';
    if (value === 'beginner') return 'Beginner';
    return 'Novice';
}

function buildLevelDistribution(users) {
    const distribution = {
        novice: 0,
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0
    };

    users.forEach((user) => {
        const level = normalizeLevelName(user.competencyLevel);
        distribution[level.toLowerCase()] += 1;
    });

    return distribution;
}

function computeAverageCompetency(users) {
    if (!Array.isArray(users) || users.length === 0) return 0;
    const total = users.reduce((sum, user) => sum + Number(user.competencyScore || 0), 0);
    return Math.round(total / users.length);
}

async function fetchCompetencyUsersFromDb() {
    const result = await pool.query(
        `SELECT
            u.id,
            u.username,
            u.email,
            u.organization,
            u.bim_level,
            u.login_count,
            u.last_login,
            u.registration_date,
            COALESCE(up.courses_completed, 0) AS courses_completed,
            COALESCE(up.practice_attempts, 0) AS practice_attempts,
            COALESCE(up.exams_passed, 0) AS exams_passed,
            COALESCE(up.certificates_earned, 0) AS certificates_earned,
            COALESCE(up.current_level, u.bim_level, 'BIM Modeller') AS current_level,
            COALESCE(up.to_next_level, 0) AS to_next_level,
            MAX(la.submitted_at) AS last_attempt_at
         FROM users u
         LEFT JOIN user_progress up ON up.user_id = u.id
         LEFT JOIN learning_attempts la ON la.user_id = u.id
         WHERE COALESCE(u.is_active, true) = true
         GROUP BY
            u.id, u.username, u.email, u.organization, u.bim_level,
            u.login_count, u.last_login, u.registration_date,
            up.courses_completed, up.practice_attempts, up.exams_passed,
            up.certificates_earned, up.current_level, up.to_next_level
         ORDER BY u.id ASC`
    );

    return result.rows.map((row) => {
        const progress = {
            coursesCompleted: Number(row.courses_completed || 0),
            practiceAttempts: Number(row.practice_attempts || 0),
            examsPassed: Number(row.exams_passed || 0),
            certificatesEarned: Number(row.certificates_earned || 0)
        };

        const normalizedUser = {
            id: row.id,
            username: row.username,
            email: row.email || null,
            organization: row.organization || 'Unspecified',
            bimLevel: row.current_level || row.bim_level || 'BIM Modeller',
            loginCount: Number(row.login_count || 0),
            lastLogin: row.last_login || row.last_attempt_at || row.registration_date || null,
            progress
        };

        const competencyScore = calculateCompetencyScore({
            bimLevel: normalizedUser.bimLevel,
            loginCount: normalizedUser.loginCount,
            lastLogin: normalizedUser.lastLogin,
            progress: {
                coursesCompleted: progress.coursesCompleted,
                examsPassed: progress.examsPassed,
                certificatesEarned: progress.certificatesEarned
            }
        });

        return {
            ...normalizedUser,
            competencyScore,
            competencyLevel: getCompetencyLevel(competencyScore)
        };
    });
}

async function fetchDashboardInsightsFromDb(users) {
    let certificatesIssued = 0;
    let avgImprovement = 0;
    let activeUsers = 0;

    try {
        const certResult = await pool.query(
            `SELECT COUNT(*)::int AS certificates_issued FROM user_certificates`
        );
        certificatesIssued = Number(certResult.rows[0]?.certificates_issued || 0);
    } catch (error) {
        certificatesIssued = users.reduce((sum, user) => {
            return sum + Number(user.progress?.certificatesEarned || 0);
        }, 0);
    }

    try {
        const attemptsResult = await pool.query(
            `SELECT
                COALESCE(ROUND(AVG(CASE
                    WHEN submitted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN percentage
                END)), 0)::int AS recent_avg,
                COALESCE(ROUND(AVG(CASE
                    WHEN submitted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
                     AND submitted_at >= CURRENT_TIMESTAMP - INTERVAL '60 days'
                    THEN percentage
                END)), 0)::int AS previous_avg,
                COUNT(DISTINCT CASE
                    WHEN submitted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                    THEN COALESCE(user_id::text, user_identifier)
                END)::int AS active_users_30d
             FROM learning_attempts`
        );

        const recentAvg = Number(attemptsResult.rows[0]?.recent_avg || 0);
        const previousAvg = Number(attemptsResult.rows[0]?.previous_avg || 0);
        activeUsers = Number(attemptsResult.rows[0]?.active_users_30d || 0);

        if (previousAvg > 0) {
            avgImprovement = Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
        } else {
            avgImprovement = recentAvg > 0 ? recentAvg : 0;
        }
    } catch (error) {
        const activeCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        activeUsers = users.filter((user) => {
            const time = user.lastLogin ? new Date(user.lastLogin).getTime() : 0;
            return time > activeCutoff;
        }).length;
        avgImprovement = 0;
    }

    return {
        avgImprovement,
        activeUsers,
        certificatesIssued
    };
}

// Middleware to check competency authority
async function requireCompetencyAuthority(req, res, next) {
    const authUser = getRequestUser(req);
    if (!authUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        if (authUser.isAdmin) {
            req.user = {
                userId: authUser.id || authUser.email || 'admin',
                username: authUser.username || authUser.email || 'admin',
                role: 'admin'
            };
            return next();
        }

        let hasAccess = null;
        try {
            hasAccess = await fetchMappingAccessFromDb(authUser.id, authUser.email);
        } catch (dbError) {
            console.warn('WARN: PostgreSQL not available for mapping access, falling back to JSON:', dbError.message);
        }

        if (hasAccess === null) {
            hasAccess = await fetchMappingAccessFromJson(authUser.id, authUser.email);
        }

        if (!hasAccess) {
            return res.status(403).json({ error: 'Mapping kompetensi access required' });
        }

        req.user = {
            userId: authUser.id,
            username: authUser.username || authUser.email || 'user',
            role: authUser.role || 'user'
        };
        next();
    } catch (error) {
        console.error('Error checking competency authority:', error);
        res.status(500).json({ error: 'Failed to verify access' });
    }
}

// GET /api/competency/dashboard - Get dashboard data
router.get('/dashboard', requireCompetencyAuthority, async (req, res) => {
    try {
        const reports = await readReportsData();
        let users = [];
        let usingDb = true;

        try {
            users = await fetchCompetencyUsersFromDb();
        } catch (dbError) {
            usingDb = false;
            console.warn('WARN: Failed to load competency users from PostgreSQL, fallback to JSON:', dbError.message);
        }

        if (!Array.isArray(users) || users.length === 0) {
            const competencyData = await readCompetencyData();
            users = (competencyData.users || []).map((user) => {
                const score = calculateCompetencyScore(user);
                return {
                    ...user,
                    competencyScore: score,
                    competencyLevel: getCompetencyLevel(score)
                };
            });
            usingDb = false;
        }

        const totalUsers = users.length;
        const totalReports = reports.length;
        const pendingApprovals = reports.filter(r => r.status === 'pending_approval').length;
        const averageCompetency = computeAverageCompetency(users);
        const competencyLevels = buildLevelDistribution(users);
        const insights = await fetchDashboardInsightsFromDb(users);

        // Recent reports
        const recentReports = reports
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        res.json({
            totalUsers,
            averageCompetency,
            totalReports,
            pendingApprovals,
            competencyLevels,
            avgImprovement: insights.avgImprovement,
            activeUsers: insights.activeUsers,
            certificatesIssued: insights.certificatesIssued,
            recentReports,
            users: users || [],
            dataSource: usingDb ? 'postgresql' : 'json-fallback'
        });

    } catch (error) {
        console.error('Error loading competency dashboard:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// GET /api/competency/users - Get all users with competency data
router.get('/users', requireCompetencyAuthority, async (req, res) => {
    try {
        let usersWithCompetency = [];

        try {
            usersWithCompetency = await fetchCompetencyUsersFromDb();
        } catch (dbError) {
            console.warn('WARN: Failed to load competency users from PostgreSQL, fallback to JSON:', dbError.message);
        }

        if (!Array.isArray(usersWithCompetency) || usersWithCompetency.length === 0) {
            const competencyData = await readCompetencyData();
            usersWithCompetency = (competencyData.users || []).map((user) => {
                const score = calculateCompetencyScore(user);
                return {
                    ...user,
                    competencyScore: score,
                    competencyLevel: getCompetencyLevel(score)
                };
            });

            competencyData.users = usersWithCompetency;
            competencyData.lastUpdated = new Date().toISOString();
            await writeCompetencyData(competencyData);
        }

        res.json(usersWithCompetency);

    } catch (error) {
        console.error('Error loading competency users:', error);
        res.status(500).json({ error: 'Failed to load users data' });
    }
});

// POST /api/competency-reports/generate - Generate new report
router.post('/generate', requireCompetencyAuthority, async (req, res) => {
    try {
        const { title, type, userId, organizationId, notes } = req.body;

        if (!title || !type) {
            return res.status(400).json({ error: 'Title and type are required' });
        }

        const reports = await readReportsData();

        // Generate new report
        const newReport = {
            id: Date.now(),
            title,
            type,
            userId: userId || null,
            organizationId: organizationId || null,
            notes: notes || '',
            status: 'draft', // Will be changed to 'pending_approval' after generation
            created_at: new Date().toISOString(),
            generated_by: req.user ? req.user.userId : 'system',
            approved_by: null,
            approved_at: null,
            rejection_reason: null
        };

        // Generate report content based on type
        switch(type) {
            case 'individual':
                if (!userId) {
                    return res.status(400).json({ error: 'User ID required for individual report' });
                }
                newReport.content = await generateIndividualReport(userId);
                break;
            case 'organization':
                if (!organizationId) {
                    return res.status(400).json({ error: 'Organization ID required for organization report' });
                }
                newReport.content = await generateOrganizationReport(organizationId);
                break;
            case 'summary':
                newReport.content = await generateSummaryReport();
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        // Change status to pending approval
        newReport.status = 'pending_approval';

        reports.push(newReport);
        await writeReportsData(reports);

        console.log(`✅ Report generated: ${title} (${type})`);

        res.json({
            success: true,
            reportId: newReport.id,
            message: 'Report generated successfully'
        });

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// GET /api/competency-reports - Get all reports
router.get('/', requireCompetencyAuthority, async (req, res) => {
    try {
        const reports = await readReportsData();

        // Filter reports based on user authority
        let filteredReports = reports;

        // If user is not admin, only show their own reports or public approved reports
        if (req.user && req.user.role !== 'admin') {
            filteredReports = reports.filter(report =>
                report.generated_by === req.user.userId ||
                report.status === 'approved'
            );
        }

        res.json(filteredReports);

    } catch (error) {
        console.error('Error loading reports:', error);
        res.status(500).json({ error: 'Failed to load reports' });
    }
});

// POST /api/competency-reports/:id/approve - Approve report (Authority only)
router.post('/:id/approve', requireCompetencyAuthority, async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const { comments } = req.body;

        const reports = await readReportsData();
        const reportIndex = reports.findIndex(r => r.id === reportId);

        if (reportIndex === -1) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const report = reports[reportIndex];

        // Check if user has authority to approve
        const authorities = await readAuthoritiesData();
        const userAuthority = authorities.find(a =>
            a.user_id === req.user.userId &&
            a.role === 'authority' &&
            a.is_active
        );

        if (!userAuthority && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient authority to approve reports' });
        }

        // Update report
        report.status = 'approved';
        report.approved_by = req.user.userId;
        report.approved_at = new Date().toISOString();
        report.approval_comments = comments || '';

        await writeReportsData(reports);

        console.log(`✅ Report ${reportId} approved by ${req.user.userId}`);

        res.json({
            success: true,
            message: 'Report approved successfully'
        });

    } catch (error) {
        console.error('Error approving report:', error);
        res.status(500).json({ error: 'Failed to approve report' });
    }
});

// POST /api/competency-reports/:id/reject - Reject report (Authority only)
router.post('/:id/reject', requireCompetencyAuthority, async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        const reports = await readReportsData();
        const reportIndex = reports.findIndex(r => r.id === reportId);

        if (reportIndex === -1) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const report = reports[reportIndex];

        // Check authority (same as approve)
        const authorities = await readAuthoritiesData();
        const userAuthority = authorities.find(a =>
            a.user_id === req.user.userId &&
            a.role === 'authority' &&
            a.is_active
        );

        if (!userAuthority && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Insufficient authority to reject reports' });
        }

        // Update report
        report.status = 'rejected';
        report.approved_by = req.user.userId;
        report.approved_at = new Date().toISOString();
        report.rejection_reason = reason;

        await writeReportsData(reports);

        console.log(`❌ Report ${reportId} rejected by ${req.user.userId}: ${reason}`);

        res.json({
            success: true,
            message: 'Report rejected successfully'
        });

    } catch (error) {
        console.error('Error rejecting report:', error);
        res.status(500).json({ error: 'Failed to reject report' });
    }
});

// GET /api/competency/authorities/check - Check user authority
router.get('/authorities/check', requireCompetencyAuthority, async (req, res) => {
    try {
        // For testing mode, always return authority for admin user
        if (req.user && req.user.role === 'admin') {
            res.json({
                hasAuthority: true,
                authority: {
                    id: 1736263066599,
                    user_id: 'admin_default',
                    username: 'admin',
                    role: 'authority',
                    status: 'approved',
                    is_active: true
                }
            });
            return;
        }

        const authorities = await readAuthoritiesData();
        const userAuthority = authorities.find(a =>
            a.user_id === req.user.userId && a.is_active
        );

        if (userAuthority) {
            res.json({
                hasAuthority: true,
                authority: userAuthority
            });
        } else {
            res.json({
                hasAuthority: false,
                authority: null
            });
        }

    } catch (error) {
        console.error('Error checking authority:', error);
        res.status(500).json({ error: 'Failed to check authority' });
    }
});

// POST /api/competency-authorities/request - Request authority role
router.post('/authorities/request', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { role, reason } = req.body;

        if (!role || !['manager', 'authority'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified' });
        }

        const authorities = await readAuthoritiesData();

        // Check if user already has authority
        const existingAuthority = authorities.find(a => a.user_id === req.user.userId);
        if (existingAuthority && existingAuthority.is_active) {
            return res.status(409).json({ error: 'User already has authority' });
        }

        // Create new authority request
        const newAuthority = {
            id: Date.now(),
            user_id: req.user.userId,
            username: req.user.username,
            role: role,
            requested_at: new Date().toISOString(),
            reason: reason || '',
            status: 'pending', // pending, approved, rejected
            granted_by: null,
            granted_at: null,
            is_active: false
        };

        authorities.push(newAuthority);
        await writeAuthoritiesData(authorities);

        console.log(`📝 Authority request submitted by ${req.user.username} for role: ${role}`);

        res.json({
            success: true,
            message: 'Authority request submitted successfully',
            requestId: newAuthority.id
        });

    } catch (error) {
        console.error('Error requesting authority:', error);
        res.status(500).json({ error: 'Failed to submit authority request' });
    }
});

// PUT /api/admin/competency-authorities/:id/approve - Approve authority request (Admin only)
router.put('/admin/authorities/:id/approve', requireAdminSession, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        const authorities = await readAuthoritiesData();
        const authorityIndex = authorities.findIndex(a => a.id === requestId);

        if (authorityIndex === -1) {
            return res.status(404).json({ error: 'Authority request not found' });
        }

        const authority = authorities[authorityIndex];

        // Update authority
        authority.status = 'approved';
        authority.granted_by = req.user.userId;
        authority.granted_at = new Date().toISOString();
        authority.is_active = true;

        await writeAuthoritiesData(authorities);

        console.log(`✅ Authority approved for user ${authority.username}: ${authority.role}`);

        res.json({
            success: true,
            message: 'Authority approved successfully'
        });

    } catch (error) {
        console.error('Error approving authority:', error);
        res.status(500).json({ error: 'Failed to approve authority' });
    }
});

// PUT /api/admin/competency-authorities/:id/reject - Reject authority request (Admin only)
router.put('/admin/authorities/:id/reject', requireAdminSession, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { reason } = req.body;

        const authorities = await readAuthoritiesData();
        const authorityIndex = authorities.findIndex(a => a.id === requestId);

        if (authorityIndex === -1) {
            return res.status(404).json({ error: 'Authority request not found' });
        }

        const authority = authorities[authorityIndex];

        // Update authority
        authority.status = 'rejected';
        authority.rejection_reason = reason || '';
        authority.processed_by = req.user.userId;
        authority.processed_at = new Date().toISOString();

        await writeAuthoritiesData(authorities);

        console.log(`❌ Authority rejected for user ${authority.username}: ${reason}`);

        res.json({
            success: true,
            message: 'Authority request rejected'
        });

    } catch (error) {
        console.error('Error rejecting authority:', error);
        res.status(500).json({ error: 'Failed to reject authority' });
    }
});

// GET /api/admin/competency-authorities - Get all authority requests (Admin only)
router.get('/admin/authorities', requireAdminSession, async (req, res) => {
    try {
        const authorities = await readAuthoritiesData();
        res.json(authorities);
    } catch (error) {
        console.error('Error loading authorities:', error);
        res.status(500).json({ error: 'Failed to load authorities' });
    }
});

// Helper Functions for Report Generation
async function generateIndividualReport(userId) {
    // Load user data and calculate competency
    const competencyData = await readCompetencyData();
    const user = competencyData.users.find(u => u.id == userId);

    if (!user) {
        throw new Error('User not found');
    }

    const score = calculateCompetencyScore(user);
    const level = getCompetencyLevel(score);

    return {
        userInfo: {
            name: user.username,
            email: user.email,
            organization: user.organization,
            bimLevel: user.bimLevel,
            jobRole: user.jobRole
        },
        competencyScore: score,
        competencyLevel: level,
        progress: user.progress || {},
        generatedAt: new Date().toISOString()
    };
}

async function generateOrganizationReport(organizationId) {
    const competencyData = await readCompetencyData();
    const orgUsers = competencyData.users.filter(u => u.organization === organizationId);

    const totalUsers = orgUsers.length;
    const avgScore = orgUsers.length > 0 ?
        Math.round(orgUsers.reduce((sum, u) => sum + calculateCompetencyScore(u), 0) / orgUsers.length) : 0;

    const levelDistribution = {
        novice: orgUsers.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Novice').length,
        beginner: orgUsers.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Beginner').length,
        intermediate: orgUsers.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Intermediate').length,
        advanced: orgUsers.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Advanced').length,
        expert: orgUsers.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Expert').length
    };

    return {
        organization: organizationId,
        totalUsers,
        averageScore: avgScore,
        levelDistribution,
        topPerformers: orgUsers
            .map(u => ({ ...u, score: calculateCompetencyScore(u) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5),
        generatedAt: new Date().toISOString()
    };
}

async function generateSummaryReport() {
    const competencyData = await readCompetencyData();
    const users = competencyData.users;

    const totalUsers = users.length;
    const avgScore = users.length > 0 ?
        Math.round(users.reduce((sum, u) => sum + calculateCompetencyScore(u), 0) / users.length) : 0;

    const levelDistribution = {
        novice: users.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Novice').length,
        beginner: users.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Beginner').length,
        intermediate: users.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Intermediate').length,
        advanced: users.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Advanced').length,
        expert: users.filter(u => getCompetencyLevel(calculateCompetencyScore(u)) === 'Expert').length
    };

    // Organization breakdown
    const orgBreakdown = {};
    users.forEach(user => {
        const org = user.organization || 'Unspecified';
        if (!orgBreakdown[org]) {
            orgBreakdown[org] = { count: 0, totalScore: 0 };
        }
        orgBreakdown[org].count++;
        orgBreakdown[org].totalScore += calculateCompetencyScore(user);
    });

    Object.keys(orgBreakdown).forEach(org => {
        orgBreakdown[org].averageScore = Math.round(orgBreakdown[org].totalScore / orgBreakdown[org].count);
    });

    return {
        totalUsers,
        averageScore: avgScore,
        levelDistribution,
        organizationBreakdown: orgBreakdown,
        topPerformers: users
            .map(u => ({ ...u, score: calculateCompetencyScore(u) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10),
        generatedAt: new Date().toISOString()
    };
}

module.exports = router;

// Helper middleware for admin session check
function requireAdminSession(req, res, next) {
    const authUser = getRequestUser(req);
    if (authUser && authUser.isAdmin) {
        req.authUser = authUser;
        req.user = {
            userId: authUser.id || authUser.email || 'admin',
            username: authUser.username || authUser.email || 'admin',
            role: 'admin'
        };
        return next();
    }

    res.status(401).json({ error: 'Admin authentication required' });
}

