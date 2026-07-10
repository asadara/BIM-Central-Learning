const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const nodemailer = require("nodemailer");
const path = require("path");

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
    const RESET_TOKEN_TTL_MINUTES = 30;
    const RESET_TOKEN_BYTES = 32;
    const RESET_TOKEN_FILE = path.resolve(__dirname, "..", "admin-password-reset-tokens.json");

    function normalizeEmail(value) {
        return String(value || "").trim().toLowerCase();
    }

    function hashResetToken(token) {
        return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
    }

    function getPublicBaseUrl(req) {
        const configured = String(process.env.BCL_BASE_URL || "").trim().replace(/\/+$/, "");
        if (configured) return configured;
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
        const host = req.get("host") || `localhost:${process.env.HTTP_PORT || 5052}`;
        return `${protocol}://${host}`;
    }

    function getResetLink(req, token) {
        return `${getPublicBaseUrl(req)}/pages/sub/admin-password-reset.html?token=${encodeURIComponent(token)}`;
    }

    function getConfiguredMailTransport() {
        const host = String(process.env.SMTP_HOST || "").trim();
        const port = Number(process.env.SMTP_PORT || 587);
        const user = String(process.env.SMTP_USER || "").trim();
        const pass = String(process.env.SMTP_PASS || "").trim();
        const from = String(process.env.SMTP_FROM || user || "").trim();

        if (!host || !user || !pass || !from) {
            return null;
        }

        return {
            from,
            transporter: nodemailer.createTransport({
                host,
                port,
                secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465,
                auth: { user, pass }
            })
        };
    }

    function isRoutableEmail(value) {
        const email = normalizeEmail(value);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith(".local");
    }

    function getRecoveryRecipient(user) {
        const configured = String(process.env.ADMIN_RECOVERY_EMAIL || "").trim();
        if (configured) {
            return configured;
        }

        if (isRoutableEmail(user.email)) {
            return user.email;
        }

        return "";
    }

    async function sendRecoveryEmail({ req, user, token }) {
        const mail = getConfiguredMailTransport();
        const resetLink = getResetLink(req, token);
        const recipient = getRecoveryRecipient(user);

        if (!mail) {
            console.warn(`Admin password recovery email skipped; SMTP is not configured. target=${user.email || user.username}`);
            return false;
        }

        if (!recipient) {
            console.warn(`Admin password recovery email skipped; no routable ADMIN_RECOVERY_EMAIL for account=${user.email || user.username}`);
            return false;
        }

        const expiresText = `${RESET_TOKEN_TTL_MINUTES} menit`;
        await mail.transporter.sendMail({
            from: mail.from,
            to: recipient,
            subject: "BCL Admin Password Recovery",
            text: [
                "Permintaan pemulihan password admin BCL diterima.",
                "",
                `Gunakan link berikut untuk membuat password baru. Link berlaku ${expiresText} dan hanya bisa dipakai sekali:`,
                resetLink,
                "",
                `Akun admin: ${user.email || user.username}`,
                "",
                "Jika Anda tidak meminta reset password ini, abaikan email ini."
            ].join("\n"),
            html: [
                "<p>Permintaan pemulihan password admin BCL diterima.</p>",
                `<p>Gunakan link berikut untuk membuat password baru. Link berlaku <strong>${expiresText}</strong> dan hanya bisa dipakai sekali:</p>`,
                `<p><a href="${resetLink}">Reset password admin BCL</a></p>`,
                `<p>Akun admin: <code>${user.email || user.username}</code></p>`,
                "<p>Jika Anda tidak meminta reset password ini, abaikan email ini.</p>"
            ].join("")
        });

        return true;
    }

    async function ensurePasswordResetTable() {
        if (!pgPool) return false;

        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                email TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                requested_ip TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pgPool.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_hash
            ON admin_password_reset_tokens(token_hash)
        `);

        await pgPool.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_password_reset_tokens_email
            ON admin_password_reset_tokens(lower(email))
        `);

        return true;
    }

    function readResetTokensFromJson() {
        try {
            if (!fs.existsSync(RESET_TOKEN_FILE)) return [];
            const parsed = JSON.parse(fs.readFileSync(RESET_TOKEN_FILE, "utf8"));
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn("Failed to read admin reset token file:", error.message);
            return [];
        }
    }

    function writeResetTokensToJson(tokens) {
        try {
            fs.writeFileSync(RESET_TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf8");
            return true;
        } catch (error) {
            console.warn("Failed to write admin reset token file:", error.message);
            return false;
        }
    }

    async function storeResetToken({ user, tokenHash, expiresAt, requestedIp, storageType }) {
        if (storageType === "postgresql") {
            await ensurePasswordResetTable();
            await pgPool.query(
                `UPDATE admin_password_reset_tokens
                 SET used_at = CURRENT_TIMESTAMP
                 WHERE lower(email) = lower($1)
                   AND used_at IS NULL`,
                [user.email]
            );
            await pgPool.query(
                `INSERT INTO admin_password_reset_tokens (
                    user_id, email, token_hash, expires_at, requested_ip, created_at
                 ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
                [String(user.id), user.email, tokenHash, expiresAt, requestedIp]
            );
            return;
        }

        const now = Date.now();
        const tokens = readResetTokensFromJson()
            .filter((entry) => !entry.usedAt && new Date(entry.expiresAt).getTime() > now)
            .filter((entry) => normalizeEmail(entry.email) !== normalizeEmail(user.email));

        tokens.push({
            userId: String(user.id),
            email: user.email,
            tokenHash,
            expiresAt: expiresAt.toISOString(),
            requestedIp,
            createdAt: new Date().toISOString()
        });
        writeResetTokensToJson(tokens);
    }

    async function consumeResetToken(tokenHash) {
        try {
            await ensurePasswordResetTable();
            const result = await pgPool.query(
                `UPDATE admin_password_reset_tokens
                 SET used_at = CURRENT_TIMESTAMP
                 WHERE token_hash = $1
                   AND used_at IS NULL
                   AND expires_at > CURRENT_TIMESTAMP
                 RETURNING user_id, email`,
                [tokenHash]
            );

            if (result.rows.length > 0) {
                return { storageType: "postgresql", userId: result.rows[0].user_id, email: result.rows[0].email };
            }
        } catch (dbError) {
            if (!isPostgresConnectionError(dbError)) {
                throw dbError;
            }
        }

        const tokens = readResetTokensFromJson();
        const now = Date.now();
        const index = tokens.findIndex((entry) =>
            entry.tokenHash === tokenHash &&
            !entry.usedAt &&
            new Date(entry.expiresAt).getTime() > now
        );

        if (index === -1) return null;

        tokens[index].usedAt = new Date().toISOString();
        writeResetTokensToJson(tokens);
        return { storageType: "json", userId: tokens[index].userId, email: tokens[index].email };
    }

    async function findAdminForRecovery(identifier) {
        const email = normalizeEmail(identifier);
        if (!email) return null;

        try {
            const user = await findUserInPostgresByEmail(email, true);
            if (user && user.is_admin && user.email) {
                return { user, storageType: "postgresql" };
            }
        } catch (dbError) {
            if (!isPostgresConnectionError(dbError)) {
                throw dbError;
            }
        }

        const fallbackUser = findUserInJsonByEmail(email, true, true);
        if (fallbackUser && fallbackUser.is_admin && fallbackUser.email) {
            return { user: fallbackUser, storageType: "json" };
        }

        return null;
    }

    async function updateAdminPasswordFromRecovery({ tokenRecord, passwordHash }) {
        let user = null;
        if (tokenRecord.storageType === "postgresql") {
            try {
                user = await findUserInPostgresByIdentity(tokenRecord.email, tokenRecord.userId, true);
            } catch (dbError) {
                if (!isPostgresConnectionError(dbError)) {
                    throw dbError;
                }
            }

            if (user && user.is_admin) {
                await pgPool.query(
                    `UPDATE users
                     SET password = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id::text = $2::text`,
                    [passwordHash, String(user.id)]
                );
                return true;
            }
        }

        user = findUserInJsonByIdentity(tokenRecord.email, tokenRecord.userId, true, true);
        if (!user || !user.is_admin) return false;

        const users = readUsers();
        const userIndex = users.findIndex((entry) =>
            (tokenRecord.userId && (entry.id === tokenRecord.userId || entry.id == tokenRecord.userId)) ||
            (tokenRecord.email && normalizeEmail(entry.email) === normalizeEmail(tokenRecord.email))
        );

        if (userIndex === -1) return false;

        users[userIndex].password = passwordHash;
        users[userIndex].updatedAt = new Date().toISOString();
        writeUsers(users);
        return true;
    }

    router.post("/api/admin/password-recovery/request", async (req, res) => {
        const genericResponse = {
            success: true,
            message: "Jika email admin valid dan SMTP sudah dikonfigurasi, link recovery akan dikirim."
        };

        try {
            const email = normalizeEmail(req.body.email);
            if (!email) {
                return res.status(400).json({ success: false, error: "Email is required" });
            }

            const found = await findAdminForRecovery(email);
            if (!found) {
                console.warn(`Admin password recovery requested for unknown/non-admin email: ${email}`);
                return res.json(genericResponse);
            }

            const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
            const tokenHash = hashResetToken(token);
            const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

            await storeResetToken({
                user: found.user,
                tokenHash,
                expiresAt,
                requestedIp: req.ip,
                storageType: found.storageType
            });

            const sent = await sendRecoveryEmail({ req, user: found.user, token });
            console.log(`Admin password recovery requested for ${found.user.email}; emailSent=${sent}`);
            return res.json(genericResponse);
        } catch (error) {
            console.error("Admin password recovery request error:", error);
            return res.status(500).json({
                success: false,
                error: "Failed to process password recovery request"
            });
        }
    });

    router.post("/api/admin/password-recovery/reset", async (req, res) => {
        try {
            const token = String(req.body.token || "").trim();
            const newPassword = String(req.body.newPassword || "");
            const confirmPassword = String(req.body.confirmPassword || "");

            if (!token || !newPassword || !confirmPassword) {
                return res.status(400).json({ success: false, error: "Token and password fields are required" });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({ success: false, error: "New password and confirmation do not match" });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, error: "New password must be at least 8 characters long" });
            }

            const tokenRecord = await consumeResetToken(hashResetToken(token));
            if (!tokenRecord) {
                return res.status(400).json({ success: false, error: "Recovery link is invalid or expired" });
            }

            const passwordHash = await hashPassword(newPassword);
            const updated = await updateAdminPasswordFromRecovery({ tokenRecord, passwordHash });
            if (!updated) {
                return res.status(404).json({ success: false, error: "Admin account not found" });
            }

            console.log(`Admin password recovered successfully for ${tokenRecord.email || tokenRecord.userId}`);
            return res.json({
                success: true,
                message: "Password reset successfully. You can now sign in with the new password."
            });
        } catch (error) {
            console.error("Admin password recovery reset error:", error);
            return res.status(500).json({
                success: false,
                error: "Failed to reset password"
            });
        }
    });

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
