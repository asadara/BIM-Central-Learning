const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const router = express.Router();
const { requireAuthenticated, requireAdmin } = require('../utils/auth');

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

function fetchMappingAccessFromJson(userId, email) {
    const users = readUsers();
    const user = users.find(u =>
        (userId && (u.id === userId || u.id == userId)) ||
        (email && u.email === email)
    );

    if (!user) return null;
    return !!(user.mappingKompetensiAccess || user.mapping_kompetensi_access);
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

        let hasAccess = null;
        try {
            hasAccess = await fetchMappingAccessFromDb(authUser.id, authUser.email);
        } catch (dbError) {
            console.warn('WARN: PostgreSQL not available for mapping access, falling back to JSON:', dbError.message);
        }

        if (hasAccess === null) {
            hasAccess = fetchMappingAccessFromJson(authUser.id, authUser.email);
        }

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
router.get('/check-mapping-access', requireAuthenticated, async (req, res) => {
    try {
        const authUser = req.authUser || req.user;
        if (authUser && authUser.isAdmin) {
            return res.json({ hasAccess: true, reason: 'admin-bypass' });
        }

        try {
            const dbAccess = await fetchMappingAccessFromDb(authUser.id, authUser.email);
            if (dbAccess !== null) {
                return res.json({ hasAccess: dbAccess });
            }
        } catch (dbError) {
            console.warn('WARN: PostgreSQL not available for mapping access, falling back to JSON:', dbError.message);
        }

        const jsonAccess = fetchMappingAccessFromJson(authUser.id, authUser.email);
        return res.json({ hasAccess: !!jsonAccess });
    } catch (error) {
        console.error('ERROR: Error checking mapping access:', error);
        res.status(500).json({
            hasAccess: false,
            error: 'Failed to check mapping access'
        });
    }
});

// GET /api/users/get-all - Get all users (admin only)
router.get('/get-all', requireAuthenticated, requireUserDirectoryAccess, async (req, res) => {
    try {
        console.log('📊 Getting all users for admin dashboard');

        // Try PostgreSQL first
        try {
            const query = `
                SELECT id, username, email, bim_level, job_role, organization,
                       registration_date, last_login, login_count, is_active,
                       mapping_kompetensi_access
                FROM users
                ORDER BY registration_date DESC
            `;

            const result = await pool.query(query);
            console.log(`✅ Retrieved ${result.rows.length} users from PostgreSQL`);

            // Map database fields to frontend expected format
            const safeUsers = result.rows.map(user => ({
                id: user.id, // This will be numeric from PostgreSQL
                username: user.username,
                email: user.email,
                bimLevel: user.bim_level,
                jobRole: user.job_role,
                organization: user.organization,
                registrationDate: user.registration_date,
                lastLogin: user.last_login,
                loginCount: user.login_count || 0,
                isActive: user.is_active,
                mappingKompetensiAccess: user.mapping_kompetensi_access || false
            }));

            return res.json(safeUsers);

        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const users = readUsers();

            const safeUsers = users.map(user => ({
                id: user.id || user.username, // JSON fallback uses string IDs
                username: user.username,
                email: user.email,
                bimLevel: user.bimLevel || user.bim_level,
                jobRole: user.jobRole || user.job_role,
                organization: user.organization,
                registrationDate: user.registrationDate || user.registration_date,
                lastLogin: user.lastLogin || user.last_login,
                loginCount: user.loginCount || user.login_count || 0,
                isActive: user.isActive !== undefined ? user.isActive : true,
                mappingKompetensiAccess: user.mappingKompetensiAccess || false
            }));

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
        const { username, email, password, bimLevel, jobRole, organization } = req.body;

        if (!username || !email || !password || !bimLevel) {
            return res.status(400).json({
                error: 'Username, email, password, and BIM level are required'
            });
        }

        // Try PostgreSQL first
        try {
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
                INSERT INTO users (username, email, password, bim_level, job_role, organization, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, username, email, bim_level, job_role, organization, registration_date, is_active
            `;

            const result = await pool.query(insertQuery, [
                username,
                email,
                hashedPassword,
                bimLevel,
                jobRole || 'BIM Specialist',
                organization || '',
                true
            ]);

            console.log(`✅ Created new user in PostgreSQL: ${username} (${email})`);

            // Map to frontend format
            const newUser = result.rows[0];
            const safeUser = {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                bimLevel: newUser.bim_level,
                jobRole: newUser.job_role,
                organization: newUser.organization,
                registrationDate: newUser.registration_date,
                isActive: newUser.is_active,
                mappingKompetensiAccess: false
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
                bimLevel,
                jobRole: jobRole || 'BIM Specialist',
                organization: organization || '',
                registrationDate: new Date().toISOString(),
                lastLogin: null,
                loginCount: 0,
                isActive: true,
                mappingKompetensiAccess: false
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
            // Build dynamic update query based on provided fields
            const updateFields = [];
            const values = [];
            let paramIndex = 1;

            // Map frontend field names to database column names
            const fieldMapping = {
                username: 'username',
                email: 'email',
                bimLevel: 'bim_level',
                jobRole: 'job_role',
                organization: 'organization',
                isActive: 'is_active',
                mappingKompetensiAccess: 'mapping_kompetensi_access'
            };

            // Build SET clause and values array
            Object.keys(updates).forEach(key => {
                if (fieldMapping[key] && key !== 'password') { // Exclude password updates
                    updateFields.push(`${fieldMapping[key]} = $${paramIndex}`);
                    values.push(updates[key]);
                    paramIndex++;
                }
            });

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
                RETURNING id, username, email, bim_level, job_role, organization,
                         registration_date, last_login, login_count, is_active,
                         mapping_kompetensi_access
            `;

            const result = await pool.query(updateQuery, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            console.log(`✅ Updated user in PostgreSQL: ${result.rows[0].username}`);

            // Map to frontend format
            const updatedUser = result.rows[0];
            const safeUser = {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                bimLevel: updatedUser.bim_level,
                jobRole: updatedUser.job_role,
                organization: updatedUser.organization,
                registrationDate: updatedUser.registration_date,
                lastLogin: updatedUser.last_login,
                loginCount: updatedUser.login_count || 0,
                isActive: updatedUser.is_active,
                mappingKompetensiAccess: updatedUser.mapping_kompetensi_access || false
            };

            return res.json({
                message: 'User updated successfully',
                user: safeUser
            });

        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available for update, falling back to JSON:', dbError.message);

            // Fallback to JSON
            const users = readUsers();
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Update user (exclude sensitive fields)
            const safeUpdates = { ...updates };
            delete safeUpdates.password; // Don't allow password updates via this endpoint

            users[userIndex] = { ...users[userIndex], ...safeUpdates };

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
