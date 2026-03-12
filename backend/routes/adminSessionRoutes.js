const express = require("express");

function createAdminSessionRoutes({
    findUserInJsonByEmail,
    findUserInJsonByIdentity,
    findUserInPostgresByEmail,
    findUserInPostgresByIdentity,
    incrementUserLoginInJson,
    incrementUserLoginInPostgres,
    isPostgresConnectionError,
    jwt,
    secretKey,
    verifyPassword
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

                res.clearCookie("connect.sid");
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

    return router;
}

module.exports = createAdminSessionRoutes;
