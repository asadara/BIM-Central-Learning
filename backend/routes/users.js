const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const router = express.Router();
const {
    requireAuthenticated,
    requireAuthenticatedPreferBearer,
    requireAdmin
} = require('../utils/auth');
const { createPgConfig } = require('../config/runtimeConfig');
const {
    ensureAccessColumns,
    fetchAccessProfileFromDb,
    fetchAccessProfileFromJson,
    normalizeAccessProfile,
    resolveAccessProfile
} = require('../utils/userAccess');
const {
    mapUserProfileState,
    normalizeBimCompetencyLevel,
    normalizeCompetencyStatus,
    normalizePositionVerificationStatus
} = require('../utils/userProfileSchema');

// PostgreSQL connection configuration
const dbConfig = createPgConfig({
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in users routes:', err.message);
});

// Fallback JSON storage
const USERS_FILE = path.join(__dirname, '..', 'users.json');

// Helper functions for user management
const readUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users file:', err);
        return [];
    }
};

async function fetchMappingAccessFromDb(userId, email) {
    const profile = await fetchAccessProfileFromDb(userId, email);
    if (!profile) return null;
    return !!profile.mappingKompetensiAccess;
}

function fetchMappingAccessFromJson(userId, email) {
    const profile = fetchAccessProfileFromJson(userId, email);
    if (!profile) return null;
    return !!profile.mappingKompetensiAccess;
}

async function requireUserDirectoryAccess(req, res, next) {
    try {
        const authUser = req.authUser || req.user;
        if (!authUser) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (authUser.isAdmin) {
            return next();
        }

        const accessProfile = await resolveAccessProfile(authUser);
        const hasAccess = !!accessProfile.mappingKompetensiAccess;

        if (!hasAccess) {
            return res.status(403).json({ error: 'Insufficient privileges' });
        }

        return next();
    } catch (error) {
        console.error('ERROR: Failed to verify user directory access:', error);
        return res.status(500).json({ error: 'Failed to verify privileges' });
    }
}

// GET /api/users/check-mapping-access - Check mapping kompetensi access
router.get('/check-mapping-access', requireAuthenticatedPreferBearer, async (req, res) => {
    try {
        const authUser = req.authUser || req.user;
        const accessProfile = await resolveAccessProfile(authUser);
        return res.json({ hasAccess: !!accessProfile.mappingKompetensiAccess });
    } catch (error) {
        console.error('ERROR: Error checking mapping access:', error);
        res.status(500).json({
            hasAccess: false,
            error: 'Failed to check mapping access'
        });
    }
});

router.get('/check-dokumen-access', requireAuthenticatedPreferBearer, async (req, res) => {
    try {
        const authUser = req.authUser || req.user;
        const accessProfile = await resolveAccessProfile(authUser);
        return res.json({ hasAccess: !!accessProfile.dokumenAccess });
    } catch (error) {
        console.error('ERROR: Error checking dokumen access:', error);
        res.status(500).json({
            hasAccess: false,
            error: 'Failed to check dokumen access'
        });
    }
});

router.get('/check-audit-2026-access', requireAuthenticatedPreferBearer, async (req, res) => {
    try {
        const authUser = req.authUser || req.user;
        const accessProfile = await resolveAccessProfile(authUser);
        return res.json({ hasAccess: !!accessProfile.audit2026Access });
    } catch (error) {
        console.error('ERROR: Error checking Audit 2026 access:', error);
        res.status(500).json({
            hasAccess: false,
            error: 'Failed to check Audit 2026 access'
        });
    }
});

router.get('/check-project-document-access', requireAuthenticatedPreferBearer, async (req, res) => {
    try {
        const authUser = req.authUser || req.user;
        const accessProfile = await resolveAccessProfile(authUser);
        return res.json({ hasAccess: !!accessProfile.projectDocumentAccess });
    } catch (error) {
        console.error('ERROR: Error checking project document access:', error);
        res.status(500).json({
            hasAccess: false,
            error: 'Failed to check project document access'
        });
    }
});

router.get('/me/access', requireAuthenticatedPreferBearer, async (req, res) => {
    try {
        const authUser = req.authUser || req.user;
        const accessProfile = await resolveAccessProfile(authUser);
        return res.json({
            isAdmin: !!authUser.isAdmin,
            ...accessProfile
        });
    } catch (error) {
        console.error('ERROR: Error checking user access profile:', error);
        res.status(500).json({
            error: 'Failed to check user access profile'
        });
    }
});

// GET /api/users/get-all - Get all users (admin only)
router.get('/get-all', requireAuthenticated, requireUserDirectoryAccess, async (req, res) => {
    try {
        console.log('📊 Getting all users for admin dashboard');

        // Try PostgreSQL first
        try {
            await ensureAccessColumns(pool);
            const query = `
                SELECT id, username, email, bim_level, job_role, position_label,
                       position_verification_status, competency_status, target_bim_level, system_role, organization,
                       registration_date, last_login, login_count, is_active,
                       mapping_kompetensi_access, dokumen_access, audit_2026_access, project_document_access,
                       library_download_access,
                       watermark_free_download_access,
                       bim_workspace_access, bim_workspace_role, bim_workspace_staff_role
                FROM users
                ORDER BY registration_date DESC
            `;

            const result = await pool.query(query);
            console.log(`✅ Retrieved ${result.rows.length} users from PostgreSQL`);

            // Map database fields to frontend expected format
            const safeUsers = result.rows.map(user => {
                const profileState = mapUserProfileState(user);
                return ({
                id: user.id, // This will be numeric from PostgreSQL
                username: user.username,
                email: user.email,
                bimLevel: profileState.competencyLevel,
                competencyStatus: profileState.competencyStatus,
                targetBimLevel: profileState.targetCompetencyLevel,
                jobRole: profileState.positionLabel,
                positionLabel: profileState.positionLabel,
                positionVerificationStatus: profileState.positionVerificationStatus,
                organization: user.organization,
                registrationDate: user.registration_date,
                lastLogin: user.last_login,
                loginCount: user.login_count || 0,
                isActive: user.is_active,
                mappingKompetensiAccess: user.mapping_kompetensi_access || false,
                dokumenAccess: user.dokumen_access || false,
                audit2026Access: user.audit_2026_access || false,
                projectDocumentAccess: user.project_document_access || false,
                libraryDownloadAccess: user.library_download_access || false,
                watermarkFreeDownloadAccess: user.watermark_free_download_access || false,
                bimWorkspaceAccess: user.bim_workspace_access || false,
                bimWorkspaceRole: user.bim_workspace_role || 'staff_bim',
                bimWorkspaceStaffRole: user.bim_workspace_staff_role || null
            });
            });

            return res.json(safeUsers);

        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const users = readUsers();

            const safeUsers = users.map(user => {
                const profileState = mapUserProfileState(user);
                return ({
                id: user.id || user.username, // JSON fallback uses string IDs
                username: user.username,
                email: user.email,
                bimLevel: profileState.competencyLevel,
                competencyStatus: profileState.competencyStatus,
                targetBimLevel: profileState.targetCompetencyLevel,
                jobRole: profileState.positionLabel,
                positionLabel: profileState.positionLabel,
                positionVerificationStatus: profileState.positionVerificationStatus,
                organization: user.organization,
                registrationDate: user.registrationDate || user.registration_date,
                lastLogin: user.lastLogin || user.last_login,
                loginCount: user.loginCount || user.login_count || 0,
                isActive: user.isActive !== undefined ? user.isActive : true,
                mappingKompetensiAccess: user.mappingKompetensiAccess || false,
                dokumenAccess: user.dokumenAccess || user.dokumen_access || false,
                audit2026Access: user.audit2026Access || user.audit_2026_access || false,
                projectDocumentAccess: user.projectDocumentAccess || user.project_document_access || false,
                libraryDownloadAccess: user.libraryDownloadAccess || user.library_download_access || false,
                watermarkFreeDownloadAccess: user.watermarkFreeDownloadAccess || user.watermark_free_download_access || false,
                bimWorkspaceAccess: user.bimWorkspaceAccess || user.bim_workspace_access || false,
                bimWorkspaceRole: user.bimWorkspaceRole || user.bim_workspace_role || 'staff_bim',
                bimWorkspaceStaffRole: user.bimWorkspaceStaffRole || user.bim_workspace_staff_role || null
            });
            });

            console.log(`📄 Returned ${safeUsers.length} users from JSON fallback`);
            return res.json(safeUsers);
        }

    } catch (error) {
        console.error('❌ Error getting users:', error);
        res.status(500).json({
            error: 'Failed to retrieve users',
            details: error.message
        });
    }
});

router.get('/verify/:id', requireAuthenticated, requireUserDirectoryAccess, async (req, res) => {
    const requestedId = String(req.params.id || '').trim();

    if (!requestedId) {
        return res.status(400).json({
            exists: false,
            error: 'User ID is required'
        });
    }

    try {
        try {
            await ensureAccessColumns(pool);
            const query = `
                SELECT id, username, email, bim_level, job_role, organization, is_active
                FROM users
                WHERE id::text = $1 OR username = $1 OR email = $1
                LIMIT 1
            `;
            const result = await pool.query(query, [requestedId]);
            const matchedUser = result.rows[0];

            if (matchedUser) {
                return res.json({
                    exists: true,
                    message: 'User found in PostgreSQL',
                    details: {
                        source: 'postgres',
                        id: matchedUser.id,
                        username: matchedUser.username,
                        email: matchedUser.email,
                        bimLevel: matchedUser.bim_level,
                        jobRole: matchedUser.job_role,
                        organization: matchedUser.organization,
                        isActive: matchedUser.is_active
                    }
                });
            }
        } catch (dbError) {
            console.warn('WARN: PostgreSQL not available for user verification:', dbError.message);
        }

        const users = readUsers();
        const matchedUser = users.find((user) => {
            const candidateIds = [
                user.id,
                user.user_id,
                user.username,
                user.email
            ].filter(Boolean).map((value) => String(value).trim());

            return candidateIds.includes(requestedId);
        });

        if (!matchedUser) {
            return res.json({
                exists: false,
                message: 'User not found in PostgreSQL or JSON storage',
                details: null
            });
        }

        return res.json({
            exists: true,
            message: 'User found in JSON storage',
            details: {
                source: 'json',
                id: matchedUser.id || matchedUser.user_id || matchedUser.username,
                username: matchedUser.username,
                email: matchedUser.email,
                bimLevel: matchedUser.bimLevel || matchedUser.bim_level || null,
                jobRole: matchedUser.jobRole || matchedUser.job_role || null,
                organization: matchedUser.organization || null,
                isActive: matchedUser.isActive !== undefined ? matchedUser.isActive : matchedUser.is_active !== false
            }
        });
    } catch (error) {
        console.error('ERROR: Failed to verify user:', error);
        return res.status(500).json({
            exists: false,
            error: 'Failed to verify user',
            details: error.message
        });
    }
});

// GET /api/users/stats - Get user statistics (simplified version)
router.get('/stats', requireAuthenticated, requireUserDirectoryAccess, (req, res) => {
    try {
        console.log('📊 Getting user statistics');

        // For now, use JSON stats - PostgreSQL integration can be added later
        getStatsFromJSON(res);

    } catch (error) {
        console.error('❌ Error in stats endpoint:', error);
        res.status(500).json({
            error: 'Failed to retrieve user statistics',
            details: error.message
        });
    }
});

// Helper function for JSON fallback
function getStatsFromJSON(res) {
    try {
        const users = readUsers();

        const stats = {
            total: users.length,
            active: users.filter(u => u.is_active !== false).length,
            byBimLevel: {},
            byJobRole: {},
            recentRegistrations: users.filter(u => {
                if (!u.registrationDate) return false;
                const regDate = new Date(u.registrationDate);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return regDate > weekAgo;
            }).length
        };

        // Count by BIM level
        users.forEach(user => {
            const level = user.bimLevel || user.bim_level || 'Unknown';
            stats.byBimLevel[level] = (stats.byBimLevel[level] || 0) + 1;
        });

        // Count by job role
        users.forEach(user => {
            const role = user.jobRole || user.job_role || 'Unknown';
            stats.byJobRole[role] = (stats.byJobRole[role] || 0) + 1;
        });

        console.log(`✅ User stats from JSON: ${stats.total} total, ${stats.active} active`);
        res.json(stats);

    } catch (error) {
        console.error('❌ Error getting JSON stats:', error);
        res.status(500).json({
            error: 'Failed to retrieve user statistics',
            details: error.message
        });
    }
}

// POST /api/users/create - Create new user (admin only)
router.post('/create', requireAdmin, async (req, res) => {
    try {
        const { username, email, password, bimLevel, jobRole, positionLabel, organization } = req.body;
        const normalizedBimLevel = normalizeBimCompetencyLevel(bimLevel);
        const normalizedPositionLabel = String(positionLabel || jobRole || '').trim().slice(0, 100);

        if (!username || !email || !password) {
            return res.status(400).json({
                error: 'Username, email, and password are required'
            });
        }

        // Try PostgreSQL first
        try {
            await ensureAccessColumns(pool);
            // Check if user already exists
            const checkQuery = 'SELECT id FROM users WHERE email = $1 OR username = $2';
            const checkResult = await pool.query(checkQuery, [email, username]);

            if (checkResult.rows.length > 0) {
                return res.status(409).json({
                    error: 'User with this email or username already exists'
                });
            }

            // Hash password (simple for demo - use bcrypt in production)
            const hashedPassword = password; // In production: await bcrypt.hash(password, 10);

            // Create new user
            const insertQuery = `
                INSERT INTO users (
                    username, email, password, bim_level, job_role, position_label,
                    position_verification_status, competency_status, system_role, organization, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $5, 'unverified', $6, 'employee', $7, $8)
                RETURNING id, username, email, bim_level, job_role, position_label,
                          position_verification_status, competency_status, target_bim_level,
                          organization, registration_date, is_active
            `;

            const result = await pool.query(insertQuery, [
                username,
                email,
                hashedPassword,
                normalizedBimLevel,
                normalizedPositionLabel || null,
                normalizedBimLevel ? 'self_declared' : 'not_assessed',
                organization || '',
                true
            ]);

            console.log(`✅ Created new user in PostgreSQL: ${username} (${email})`);

            // Map to frontend format
            const newUser = result.rows[0];
            const profileState = mapUserProfileState(newUser);
            const safeUser = {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                bimLevel: profileState.competencyLevel,
                competencyStatus: profileState.competencyStatus,
                targetBimLevel: profileState.targetCompetencyLevel,
                jobRole: profileState.positionLabel,
                positionLabel: profileState.positionLabel,
                positionVerificationStatus: profileState.positionVerificationStatus,
                organization: newUser.organization,
                registrationDate: newUser.registration_date,
                isActive: newUser.is_active,
                mappingKompetensiAccess: false,
                dokumenAccess: false,
                audit2026Access: false,
                projectDocumentAccess: false,
                libraryDownloadAccess: false,
                watermarkFreeDownloadAccess: false,
                bimWorkspaceAccess: false,
                bimWorkspaceRole: 'staff_bim',
                bimWorkspaceStaffRole: null
            };

            return res.status(201).json({
                message: 'User created successfully',
                user: safeUser
            });

        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available for create, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const users = readUsers();

            // Check if user already exists
            const existingUser = users.find(u => u.email === email || u.username === username);
            if (existingUser) {
                return res.status(409).json({
                    error: 'User with this email or username already exists'
                });
            }

            // Hash password (simple for demo - use bcrypt in production)
            const hashedPassword = password;

            // Create new user
            const newUser = {
                id: Date.now().toString(),
                username,
                email,
                password: hashedPassword,
                bimLevel: normalizedBimLevel,
                competencyStatus: normalizedBimLevel ? 'self_declared' : 'not_assessed',
                targetBimLevel: null,
                jobRole: normalizedPositionLabel || null,
                positionLabel: normalizedPositionLabel || null,
                positionVerificationStatus: 'unverified',
                systemRole: 'employee',
                organization: organization || '',
                registrationDate: new Date().toISOString(),
                lastLogin: null,
                loginCount: 0,
                isActive: true,
                mappingKompetensiAccess: false,
                mapping_kompetensi_access: false,
                dokumenAccess: false,
                dokumen_access: false,
                audit2026Access: false,
                audit_2026_access: false,
                projectDocumentAccess: false,
                project_document_access: false,
                libraryDownloadAccess: false,
                library_download_access: false,
                watermarkFreeDownloadAccess: false,
                watermark_free_download_access: false,
                bimWorkspaceAccess: false,
                bim_workspace_access: false,
                bimWorkspaceRole: 'staff_bim',
                bim_workspace_role: 'staff_bim',
                bimWorkspaceStaffRole: 'bim_specialist',
                bim_workspace_staff_role: 'bim_specialist'
            };

            users.push(newUser);
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

            console.log(`📄 Created new user in JSON fallback: ${username} (${email})`);

            // Return safe user data
            const { password: _, ...safeUser } = newUser;
            return res.status(201).json({
                message: 'User created successfully',
                user: safeUser
            });
        }

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            error: 'Failed to create user',
            details: error.message
        });
    }
});

// PUT /api/users/:id - Update user (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const updates = req.body;

        console.log(`🔄 Updating user ${userId}:`, updates);

        // Try PostgreSQL first
        try {
            await ensureAccessColumns(pool);
            // Build dynamic update query based on provided fields
            const updateFields = [];
            const values = [];
            const seenUpdateColumns = new Set();
            let paramIndex = 1;

            // Map frontend field names to database column names
            const fieldMapping = {
                username: 'username',
                email: 'email',
                bimLevel: 'bim_level',
                jobRole: 'position_label',
                positionLabel: 'position_label',
                position_label: 'position_label',
                positionVerificationStatus: 'position_verification_status',
                position_verification_status: 'position_verification_status',
                competencyStatus: 'competency_status',
                competency_status: 'competency_status',
                targetBimLevel: 'target_bim_level',
                target_bim_level: 'target_bim_level',
                organization: 'organization',
                isActive: 'is_active',
                mappingKompetensiAccess: 'mapping_kompetensi_access',
                mapping_kompetensi_access: 'mapping_kompetensi_access',
                dokumenAccess: 'dokumen_access',
                dokumen_access: 'dokumen_access',
                audit2026Access: 'audit_2026_access',
                audit_2026_access: 'audit_2026_access',
                projectDocumentAccess: 'project_document_access',
                project_document_access: 'project_document_access',
                libraryDownloadAccess: 'library_download_access',
                library_download_access: 'library_download_access',
                watermarkFreeDownloadAccess: 'watermark_free_download_access',
                watermark_free_download_access: 'watermark_free_download_access',
                bimWorkspaceAccess: 'bim_workspace_access',
                bim_workspace_access: 'bim_workspace_access',
                bimWorkspaceRole: 'bim_workspace_role',
                bim_workspace_role: 'bim_workspace_role',
                bimWorkspaceStaffRole: 'bim_workspace_staff_role',
                bim_workspace_staff_role: 'bim_workspace_staff_role'
            };

            // Build SET clause and values array
            Object.keys(updates).forEach(key => {
                const columnName = fieldMapping[key];
                if (columnName && key !== 'password' && !seenUpdateColumns.has(columnName)) {
                    const normalizedValue = columnName === 'bim_workspace_role'
                        ? normalizeAccessProfile({ bimWorkspaceRole: updates[key] }).bimWorkspaceRole
                        : columnName === 'bim_workspace_staff_role'
                            ? normalizeAccessProfile({ bimWorkspaceStaffRole: updates[key] }).bimWorkspaceStaffRole
                            : columnName === 'bim_level' || columnName === 'target_bim_level'
                                ? normalizeBimCompetencyLevel(updates[key])
                                : columnName === 'competency_status'
                                    ? normalizeCompetencyStatus(updates[key], updates.bimLevel || updates.bim_level)
                                    : columnName === 'position_verification_status'
                                        ? normalizePositionVerificationStatus(updates[key])
                                        : columnName === 'position_label'
                                            ? String(updates[key] || '').trim().slice(0, 100) || null
                                            : updates[key];
                    seenUpdateColumns.add(columnName);
                    updateFields.push(`${columnName} = $${paramIndex}`);
                    values.push(normalizedValue);
                    paramIndex++;
                }
            });

            if (seenUpdateColumns.has('position_label')) {
                const positionValue = String(
                    updates.positionLabel ?? updates.position_label ?? updates.jobRole ?? ''
                ).trim().slice(0, 100) || null;
                updateFields.push(`job_role = $${paramIndex}`);
                values.push(positionValue);
                paramIndex++;
            }

            const verifier = String(
                req.authUser?.username || req.authUser?.email || req.authUser?.userId || req.user?.username || 'admin'
            ).slice(0, 120);

            if (seenUpdateColumns.has('position_verification_status')) {
                if (normalizePositionVerificationStatus(
                    updates.positionVerificationStatus ?? updates.position_verification_status
                ) === 'verified') {
                    updateFields.push('position_verified_at = CURRENT_TIMESTAMP');
                    updateFields.push(`position_verified_by = $${paramIndex}`);
                    values.push(verifier);
                    paramIndex++;
                } else {
                    updateFields.push('position_verified_at = NULL');
                    updateFields.push('position_verified_by = NULL');
                }
            }

            if (seenUpdateColumns.has('competency_status')) {
                if (normalizeCompetencyStatus(
                    updates.competencyStatus ?? updates.competency_status,
                    updates.bimLevel ?? updates.bim_level
                ) === 'verified') {
                    updateFields.push('competency_verified_at = CURRENT_TIMESTAMP');
                    updateFields.push(`competency_verified_by = $${paramIndex}`);
                    values.push(verifier);
                    paramIndex++;
                } else {
                    updateFields.push('competency_verified_at = NULL');
                    updateFields.push('competency_verified_by = NULL');
                }
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }

            // Add updated_at timestamp
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(userId); // Add user ID at the end

            const updateQuery = `
                UPDATE users
                SET ${updateFields.join(', ')}
                WHERE id::text = $${paramIndex}
                   OR username = $${paramIndex}
                   OR lower(email) = lower($${paramIndex})
                RETURNING id, username, email, bim_level, job_role, position_label,
                         position_verification_status, competency_status, target_bim_level, system_role, organization,
                         registration_date, last_login, login_count, is_active,
                         mapping_kompetensi_access, dokumen_access, audit_2026_access, project_document_access,
                         library_download_access,
                         watermark_free_download_access,
                         bim_workspace_access, bim_workspace_role, bim_workspace_staff_role
            `;

            const result = await pool.query(updateQuery, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            console.log(`✅ Updated user in PostgreSQL: ${result.rows[0].username}`);

            // Map to frontend format
            const updatedUser = result.rows[0];
            const profileState = mapUserProfileState(updatedUser);
            const safeUser = {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                bimLevel: profileState.competencyLevel,
                competencyStatus: profileState.competencyStatus,
                targetBimLevel: profileState.targetCompetencyLevel,
                jobRole: profileState.positionLabel,
                positionLabel: profileState.positionLabel,
                positionVerificationStatus: profileState.positionVerificationStatus,
                organization: updatedUser.organization,
                registrationDate: updatedUser.registration_date,
                lastLogin: updatedUser.last_login,
                loginCount: updatedUser.login_count || 0,
                isActive: updatedUser.is_active,
                mappingKompetensiAccess: updatedUser.mapping_kompetensi_access || false,
                dokumenAccess: updatedUser.dokumen_access || false,
                audit2026Access: updatedUser.audit_2026_access || false,
                projectDocumentAccess: updatedUser.project_document_access || false,
                libraryDownloadAccess: updatedUser.library_download_access || false,
                watermarkFreeDownloadAccess: updatedUser.watermark_free_download_access || false,
                bimWorkspaceAccess: updatedUser.bim_workspace_access || false,
                bimWorkspaceRole: updatedUser.bim_workspace_role || 'staff_bim',
                bimWorkspaceStaffRole: updatedUser.bim_workspace_staff_role || null
            };

            return res.json({
                message: 'User updated successfully',
                user: safeUser
            });

        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available for update, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const users = readUsers();
            const requestedId = String(userId || '').trim();
            const userIndex = users.findIndex((user) => {
                const candidateIds = [
                    user.id,
                    user.user_id,
                    user.username,
                    user.email
                ].filter(Boolean).map((value) => String(value).trim());

                return candidateIds.includes(requestedId);
            });

            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Update user (exclude sensitive fields)
            const safeUpdates = { ...updates };
            delete safeUpdates.password; // Don't allow password updates via this endpoint

            const accessUpdates = normalizeAccessProfile(safeUpdates);
            const hasMappingUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'mappingKompetensiAccess') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'mapping_kompetensi_access');
            const hasDokumenUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'dokumenAccess') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'dokumen_access');
            const hasAudit2026Update =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'audit2026Access') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'audit_2026_access');
            const hasProjectDocumentUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'projectDocumentAccess') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'project_document_access');
            const hasLibraryUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'libraryDownloadAccess') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'library_download_access');
            const hasWatermarkUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'watermarkFreeDownloadAccess') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'watermark_free_download_access');
            const hasWorkspaceAccessUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bimWorkspaceAccess') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bim_workspace_access');
            const hasWorkspaceRoleUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bimWorkspaceRole') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bim_workspace_role');
            const hasWorkspaceStaffRoleUpdate =
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bimWorkspaceStaffRole') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bim_workspace_staff_role');

            users[userIndex] = { ...users[userIndex], ...safeUpdates };

            if (Object.prototype.hasOwnProperty.call(safeUpdates, 'positionLabel') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'position_label')) {
                const value = String(safeUpdates.positionLabel ?? safeUpdates.position_label ?? '').trim().slice(0, 100) || null;
                users[userIndex].positionLabel = value;
                users[userIndex].position_label = value;
                users[userIndex].jobRole = value;
                users[userIndex].job_role = value;
            }

            if (Object.prototype.hasOwnProperty.call(safeUpdates, 'positionVerificationStatus') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'position_verification_status')) {
                const value = normalizePositionVerificationStatus(
                    safeUpdates.positionVerificationStatus ?? safeUpdates.position_verification_status
                );
                users[userIndex].positionVerificationStatus = value;
                users[userIndex].position_verification_status = value;
                users[userIndex].positionVerifiedAt = value === 'verified' ? new Date().toISOString() : null;
                users[userIndex].positionVerifiedBy = value === 'verified' ? 'admin' : null;
            }

            if (Object.prototype.hasOwnProperty.call(safeUpdates, 'bimLevel') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'bim_level')) {
                const value = normalizeBimCompetencyLevel(safeUpdates.bimLevel ?? safeUpdates.bim_level);
                users[userIndex].bimLevel = value;
                users[userIndex].bim_level = value;
            }

            if (Object.prototype.hasOwnProperty.call(safeUpdates, 'competencyStatus') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'competency_status')) {
                const value = normalizeCompetencyStatus(
                    safeUpdates.competencyStatus ?? safeUpdates.competency_status,
                    users[userIndex].bimLevel
                );
                users[userIndex].competencyStatus = value;
                users[userIndex].competency_status = value;
                users[userIndex].competencyVerifiedAt = value === 'verified' ? new Date().toISOString() : null;
                users[userIndex].competencyVerifiedBy = value === 'verified' ? 'admin' : null;
            }

            if (Object.prototype.hasOwnProperty.call(safeUpdates, 'targetBimLevel') ||
                Object.prototype.hasOwnProperty.call(safeUpdates, 'target_bim_level')) {
                const value = normalizeBimCompetencyLevel(safeUpdates.targetBimLevel ?? safeUpdates.target_bim_level);
                users[userIndex].targetBimLevel = value;
                users[userIndex].target_bim_level = value;
            }

            if (hasMappingUpdate) {
                users[userIndex].mappingKompetensiAccess = accessUpdates.mappingKompetensiAccess;
                users[userIndex].mapping_kompetensi_access = accessUpdates.mappingKompetensiAccess;
            }

            if (hasDokumenUpdate) {
                users[userIndex].dokumenAccess = accessUpdates.dokumenAccess;
                users[userIndex].dokumen_access = accessUpdates.dokumenAccess;
            }

            if (hasAudit2026Update) {
                users[userIndex].audit2026Access = accessUpdates.audit2026Access;
                users[userIndex].audit_2026_access = accessUpdates.audit2026Access;
            }

            if (hasProjectDocumentUpdate) {
                users[userIndex].projectDocumentAccess = accessUpdates.projectDocumentAccess;
                users[userIndex].project_document_access = accessUpdates.projectDocumentAccess;
            }

            if (hasLibraryUpdate) {
                users[userIndex].libraryDownloadAccess = accessUpdates.libraryDownloadAccess;
                users[userIndex].library_download_access = accessUpdates.libraryDownloadAccess;
            }

            if (hasWatermarkUpdate) {
                users[userIndex].watermarkFreeDownloadAccess = accessUpdates.watermarkFreeDownloadAccess;
                users[userIndex].watermark_free_download_access = accessUpdates.watermarkFreeDownloadAccess;
            }

            if (hasWorkspaceAccessUpdate) {
                users[userIndex].bimWorkspaceAccess = accessUpdates.bimWorkspaceAccess;
                users[userIndex].bim_workspace_access = accessUpdates.bimWorkspaceAccess;
            }

            if (hasWorkspaceRoleUpdate) {
                users[userIndex].bimWorkspaceRole = accessUpdates.bimWorkspaceRole;
                users[userIndex].bim_workspace_role = accessUpdates.bimWorkspaceRole;
            }

            if (hasWorkspaceStaffRoleUpdate) {
                users[userIndex].bimWorkspaceStaffRole = accessUpdates.bimWorkspaceStaffRole;
                users[userIndex].bim_workspace_staff_role = accessUpdates.bimWorkspaceStaffRole;
            }

            // Save users
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

            console.log(`📄 Updated user in JSON fallback: ${users[userIndex].username}`);

            // Return safe user data
            const { password: _, ...safeUser } = users[userIndex];
            return res.json({
                message: 'User updated successfully',
                user: safeUser
            });
        }

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            error: 'Failed to update user',
            details: error.message
        });
    }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(`🗑️ Deleting user ${userId}`);

        // Try PostgreSQL first
        try {
            const deleteQuery = 'DELETE FROM users WHERE id = $1 RETURNING id, username';
            const result = await pool.query(deleteQuery, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            console.log(`✅ Deleted user from PostgreSQL: ${result.rows[0].username}`);
            return res.json({
                message: 'User deleted successfully'
            });

        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available for delete, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const users = readUsers();
            const filteredUsers = users.filter(u => u.id !== userId);

            if (filteredUsers.length === users.length) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Save filtered users
            fs.writeFileSync(USERS_FILE, JSON.stringify(filteredUsers, null, 2));

            console.log(`📄 Deleted user from JSON fallback: ${userId}`);
            return res.json({
                message: 'User deleted successfully'
            });
        }

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            error: 'Failed to delete user',
            details: error.message
        });
    }
});

module.exports = router;
