const express = require("express");

function createAdminSessionRoutes({
    findUserInJsonByEmail,
    findUserInJsonByIdentity,
    findUserInPostgresByEmail,
    findUserInPostgresByIdentity,
    hashPassword,
    incrementUserLoginInJson,
    incrementUserLoginInPostgres,
    isPostgresConnectionError,
    jwt,
    pgPool,
    readUsers,
    secretKey,
    verifyPassword,
    writeUsers
}) {
    const router = express.Router();

    router.post("/api/admin/login", async (req, res) => {
        try {
            const identifier = String(req.body.email || req.body.username || "").trim();
            const { password } = req.body;

            if (!identifier || !password) {
                return res.status(400).json({
                    success: false,
                    error: "Email/username and password are required"
                });
            }

            let user = null;
            let storageType = "postgresql";
            let postgresLookupFailed = false;

            try {
                user = await findUserInPostgresByEmail(identifier, true);
            } catch (dbError) {
                postgresLookupFailed = isPostgresConnectionError(dbError);
                console.warn(
                    postgresLookupFailed
                        ? "⚠️ PostgreSQL unavailable, falling back to JSON storage:"
                        : "⚠️ PostgreSQL lookup failed:",
                    dbError.message
                );

                if (!postgresLookupFailed) {
                    throw dbError;
                }
            }

            if (!user && postgresLookupFailed) {
                user = findUserInJsonByEmail(identifier, true);
                storageType = "json";
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: "Invalid email or password"
                });
            }

            if (!user.is_admin) {
                return res.status(403).json({
                    success: false,
                    error: "Access denied. Admin privileges required."
                });
            }

            const isValidPassword = await verifyPassword(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    error: "Invalid email or password"
                });
            }

            if (storageType === "postgresql") {
                await incrementUserLoginInPostgres(user.id);
            } else if (user.id) {
                incrementUserLoginInJson(user.id);
            }

            req.session.adminUser = {
                id: user.id,
                username: user.username || user.username,
                email: user.email,
                role: user.jobRole || user.job_role || "System Administrator",
                bimLevel: user.bimLevel || user.bim_level || "Expert",
                organization: user.organization || "BCL Enterprise",
                isAdmin: true
            };

            console.log(`✅ Admin logged in from ${storageType}: ${user.email || user.username} (ID: ${user.id})`);

            const loginCount = user.loginCount || user.login_count || 0;
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username || user.username,
                    email: user.email,
                    role: user.jobRole || user.job_role || "System Administrator",
                    bimLevel: user.bimLevel || user.bim_level || "Expert",
                    organization: user.organization || "BCL Enterprise",
                    loginCount: loginCount + 1
                },
                sessionId: req.session.id
            });
        } catch (error) {
            console.error("❌ Admin login error:", error);
            res.status(500).json({
                success: false,
                error: "Admin login failed. Please try again."
            });
        }
    });

    router.post("/api/admin/logout", (req, res) => {
        try {
            if (req.session && req.session.adminUser) {
                console.log(`✅ Admin logged out: ${req.session.adminUser.email}`);
            }

            req.session.destroy((err) => {
                if (err) {
                    console.error("❌ Error destroying session:", err);
                    return res.status(500).json({ error: "Logout failed" });
                }

                res.clearCookie("connect.sid", {
                    path: "/",
                    httpOnly: true,
                    secure: false
                });
                res.json({ success: true, message: "Admin logged out successfully" });
            });
        } catch (error) {
            console.error("❌ Admin logout error:", error);
            res.status(500).json({ error: "Logout failed" });
        }
    });

    router.post("/api/admin/session/bridge", async (req, res) => {
        try {
            const authHeader = req.headers.authorization || "";
            const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
            const token = bearerToken || req.body.token;

            if (!token) {
                return res.status(400).json({ authenticated: false, error: "Token is required" });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, secretKey);
            } catch (error) {
                return res.status(401).json({ authenticated: false, error: "Invalid or expired token" });
            }

            const email = decoded.email;
            const userId = decoded.userId;
            let user = null;
            let postgresLookupFailed = false;

            try {
                user = await findUserInPostgresByIdentity(email, userId, true);
            } catch (dbError) {
                postgresLookupFailed = isPostgresConnectionError(dbError);
                console.warn(
                    postgresLookupFailed
                        ? "⚠️ PostgreSQL unavailable during admin bridge, falling back to JSON:"
                        : "⚠️ PostgreSQL lookup failed during admin bridge:",
                    dbError.message
                );

                if (!postgresLookupFailed) {
                    throw dbError;
                }
            }

            if (!user && postgresLookupFailed) {
                user = findUserInJsonByIdentity(email, userId, true, false);
            }

            if (!user) {
                return res.status(401).json({ authenticated: false, error: "User not found" });
            }

            const role = (user?.jobRole || user?.job_role || decoded.role || "").toString().toLowerCase();
            const isAdmin =
                user?.is_admin === true ||
                user?.isAdmin === true ||
                role.includes("admin") ||
                role.includes("administrator");

            if (!isAdmin) {
                return res.status(403).json({ authenticated: false, error: "Admin privileges required" });
            }

            req.session.adminUser = {
                id: user?.id || userId || "admin",
                username: user?.username || user?.name || decoded.name || "admin",
                email: user?.email || email || "admin@bcl.local",
                role: user?.jobRole || user?.job_role || decoded.role || "System Administrator",
                bimLevel: user?.bimLevel || user?.bim_level || "Expert",
                organization: user?.organization || "BCL Enterprise",
                isAdmin: true
            };

            req.session.save(() => {
                res.json({ authenticated: true, user: req.session.adminUser });
            });
        } catch (error) {
            console.error("❌ Admin session bridge error:", error);
            res.status(500).json({ authenticated: false, error: "Failed to bridge admin session" });
        }
    });

    router.get("/api/admin/session", (req, res) => {
        if (req.session && req.session.adminUser && req.session.adminUser.isAdmin) {
            return res.json({
                authenticated: true,
                user: req.session.adminUser
            });
        }

        res.status(401).json({
            authenticated: false,
            error: "No active admin session"
        });
    });

    router.post("/api/admin/change-password", async (req, res) => {
        try {
            const sessionUser = req.session && req.session.adminUser;
            if (!sessionUser || !sessionUser.isAdmin) {
                return res.status(401).json({
                    success: false,
                    error: "Admin authentication required"
                });
            }

            const currentPassword = String(req.body.currentPassword || "");
            const newPassword = String(req.body.newPassword || "");
            const confirmPassword = String(req.body.confirmPassword || "");

            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: "All password fields are required"
                });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    error: "New password and confirmation do not match"
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    error: "New password must be at least 8 characters long"
                });
            }

            let user = null;
            let storageType = "postgresql";
            let postgresLookupFailed = false;

            try {
                user = await findUserInPostgresByIdentity(sessionUser.email, sessionUser.id, true);
            } catch (dbError) {
                postgresLookupFailed = isPostgresConnectionError(dbError);
                console.warn(
                    postgresLookupFailed
                        ? "PostgreSQL unavailable during admin password change, falling back to JSON:"
                        : "PostgreSQL lookup failed during admin password change:",
                    dbError.message
                );

                if (!postgresLookupFailed) {
                    throw dbError;
                }
            }

            if (!user) {
                user = findUserInJsonByIdentity(sessionUser.email, sessionUser.id, true, false);
                storageType = user ? "json" : storageType;
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: "Admin account not found"
                });
            }

            const isValidPassword = await verifyPassword(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(400).json({
                    success: false,
                    error: "Current password is incorrect"
                });
            }

            const nextPasswordHash = await hashPassword(newPassword);

            if (storageType === "postgresql" && pgPool) {
                await pgPool.query(
                    `UPDATE users
                     SET password = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [nextPasswordHash, user.id]
                );
            } else {
                const users = readUsers();
                const userIndex = users.findIndex((entry) => (
                    (sessionUser.id && (entry.id === sessionUser.id || entry.id == sessionUser.id)) ||
                    (sessionUser.email && String(entry.email || "").toLowerCase() === String(sessionUser.email).toLowerCase())
                ));

                if (userIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        error: "Admin account not found in JSON storage"
                    });
                }

                users[userIndex] = {
                    ...users[userIndex],
                    password: nextPasswordHash,
                    updatedAt: new Date().toISOString()
                };
                writeUsers(users);
            }

            console.log(`Admin password updated successfully for ${sessionUser.email || sessionUser.username}`);
            return res.json({
                success: true,
                message: "Password changed successfully"
            });
        } catch (error) {
            console.error("Admin change password error:", error);
            return res.status(500).json({
                success: false,
                error: "Failed to change password"
            });
        }
    });

    return router;
}

module.exports = createAdminSessionRoutes;
