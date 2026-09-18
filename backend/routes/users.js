const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { hashPassword, passwordValidationError } = require('../utils/credentials');
const { canonicalUserId, protectedUserField } = require('../utils/canonicalIdentity');
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

const USERS_FILE = path.join(__dirname, '..', 'users.json');
const readLegacyUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users file:', err);
        return [];
    }
};


function createUsersRoutes({ pool = new Pool(dbConfig), readUsers = readLegacyUsers } = {}) {
const router = express.Router();
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in users routes:', err.message);
});

// Fallback JSON storage


// Helper functions for user management

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
                id: null, // Legacy identifiers are diagnostic; no canonical mapping is asserted.
                legacyId: user.id || user.username || null,
                identitySource: 'legacy_json',
                canonicalIdentityResolved: false,
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
                mappingKompetensiAccess: false,
                dokumenAccess: false,
                audit2026Access: false,
                projectDocumentAccess: false,
                libraryDownloadAccess: false,
                watermarkFreeDownloadAccess: false,
                bimWorkspaceAccess: false,
                bimWorkspaceRole: 'viewer',
                bimWorkspaceStaffRole: null
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
    const requestedId = canonicalUserId(req.params.id);

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
                WHERE id = $1
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

        return res.json({ exists: false, message: 'Canonical user not found', details: null });

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
        const protectedField = protectedUserField(req.body, { allowPassword: true });
        if (protectedField) return res.status(400).json({ error: `Protected user field: ${protectedField}` });
        const passwordError = passwordValidationError(password);
        if (passwordError) return res.status(400).json({ error: passwordError });
        const normalizedBimLevel = normalizeBimCompetencyLevel(bimLevel);
        const normalizedPositionLabel = String(positionLabel || jobRole || '').trim().slice(0, 100);

        if (typeof username !== "string" || !username.trim() || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
            return res.status(400).json({
                error: 'Username, email, and password are required'
            });
        }

        // Try PostgreSQL first
        try {
            await ensureAccessColumns(pool);
            // Check if user already exists
            const checkQuery = 'SELECT id FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($2)';
            const checkResult = await pool.query(checkQuery, [email, username]);

            if (checkResult.rows.length > 0) {
                return res.status(409).json({
                    error: 'User with this email or username already exists'
                });
            }

            // Shared credential policy; plaintext must never reach storage.
            const hashedPassword = await hashPassword(password);

            // Create new user
            const insertQuery = `
                INSERT INTO users (
                    username, email, password, bim_level, job_role, position_label,
                    position_verification_status, competency_status, system_role, organization, is_active
                )
                VALUES ($1, $2, $3, $4, $5::text, $5::text, 'unverified', $6, 'employee', $7, $8)
                RETURNING id, username, email, bim_level, job_role, position_label,
                          position_verification_status, competency_status, target_bim_level,
                          organization, registration_date, is_active
            `;

            const result = await pool.query(insertQuery, [
                username.trim(),
                email.trim(),
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
            if (dbError.code === '23505') return res.status(409).json({ error: 'Email or username already registered' });
            if (dbError.code === '23503') return res.status(409).json({ error: 'User has dependent records' });
            console.warn('Canonical user operation failed:', dbError.code || dbError.name);
            return res.status(503).json({ error: 'Canonical user storage unavailable; legacy JSON was not modified' });
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
        const userId = canonicalUserId(req.params.id);
        if (!userId) return res.status(400).json({ error: 'Canonical user ID required' });
        const updates = req.body;
        const protectedField = protectedUserField(updates);
        if (protectedField) return res.status(400).json({ error: `Protected user field: ${protectedField}` });

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
                req.authUser?.id || req.user?.id
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
                WHERE id = $${paramIndex}
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
            if (dbError.code === '23505') return res.status(409).json({ error: 'Email or username already registered' });
            if (dbError.code === '23503') return res.status(409).json({ error: 'User has dependent records' });
            console.warn('Canonical user operation failed:', dbError.code || dbError.name);
            return res.status(503).json({ error: 'Canonical user storage unavailable; legacy JSON was not modified' });
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
        const userId = canonicalUserId(req.params.id);
        if (!userId) return res.status(400).json({ error: 'Canonical user ID required' });
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
            if (dbError.code === '23505') return res.status(409).json({ error: 'Email or username already registered' });
            if (dbError.code === '23503') return res.status(409).json({ error: 'User has dependent records' });
            console.warn('Canonical user operation failed:', dbError.code || dbError.name);
            return res.status(503).json({ error: 'Canonical user storage unavailable; legacy JSON was not modified' });
        }

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            error: 'Failed to delete user',
            details: error.message
        });
    }
});

return router;
}

module.exports = createUsersRoutes();
module.exports.createUsersRoutes = createUsersRoutes;
