const crypto = require("crypto");
const { passwordValidationError, isPasswordHash } = require("../utils/credentials");
const { authenticatedUserId, identityStoreUnavailable } = require("../utils/canonicalIdentity");
const express = require("express");
const nodemailer = require("nodemailer");

function createAdminSessionRoutes({
    authRuntime,
    authLimiter,
    findUserInPostgresByEmail,
    findUserInPostgresByIdentity,
    hashPassword,
    incrementUserLoginInPostgres,
    isPostgresConnectionError,
    jwt,
    pgPool,
    secretKey,
    verifyPassword,
}) {
    const router = express.Router();
    router.use('/api/admin', (req,res,next) => {
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && !authRuntime.originAllowed(req)) {
            return res.status(403).json({success:false,error:'Untrusted origin'});
        }
        next();
    });
    for (const endpoint of ['login','session/bridge','change-password','password-recovery/request','password-recovery/reset']) {
        router.use('/api/admin/' + endpoint, authLimiter);
    }
    const RESET_TOKEN_TTL_MINUTES = 30;
    const RESET_TOKEN_BYTES = 32;

    function normalizeEmail(value) {
        return String(value || "").trim().toLowerCase();
    }

    function hashResetToken(token) {
        return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
    }

    function getPublicBaseUrl(req) {
        // Recovery links must never inherit a caller-controlled Host or forwarded scheme.
        return authRuntime.trustedOrigin;
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

    function getRecoveryRecipient() {
        const configured = String(process.env.ADMIN_RECOVERY_EMAIL || "").trim();
        return isRoutableEmail(configured) ? configured : "";
    }

    async function sendRecoveryEmail({ req, user, token }) {
        const mail = getConfiguredMailTransport();
        const resetLink = getResetLink(req, token);
        const recipient = getRecoveryRecipient();

        if (!mail) {
            console.warn(`Admin password recovery email skipped; SMTP is not configured. target=${user.email || user.username}`);
            return false;
        }

        if (!recipient) {
            console.warn(`Admin password recovery email skipped; ADMIN_RECOVERY_EMAIL is missing or invalid for account=${user.email || user.username}`);
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

    async function storeResetToken({ user, tokenHash, expiresAt, requestedIp, storageType }) {
        if (storageType === "postgresql") {
            await ensurePasswordResetTable();
            await pgPool.query(
                `UPDATE admin_password_reset_tokens
                 SET used_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1::text
                   AND used_at IS NULL`,
                [String(user.id)]
            );
            await pgPool.query(
                `INSERT INTO admin_password_reset_tokens (
                    user_id, email, token_hash, expires_at, requested_ip, created_at
                 ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
                [String(user.id), user.email, tokenHash, expiresAt, requestedIp]
            );
            return;
        }

        throw identityStoreUnavailable();
    }

    async function findAdminForRecovery(identifier) {
        const user = await findUserInPostgresByEmail(normalizeEmail(identifier), true);
        return user?.system_role === "system_admin" ? { user, storageType: "postgresql" } : null;
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

    router.post('/api/admin/password-recovery/reset', async(req,res)=>{
        try {
            const {token,newPassword,confirmPassword}=req.body;
            if(typeof token!=='string'||!token||newPassword!==confirmPassword) return res.status(400).json({success:false,error:'Invalid reset request'});
            const passwordHash=await hashPassword(newPassword);
            await ensurePasswordResetTable();
            await authRuntime.transaction(async db=>{
                const rows=await db.query(                    'SELECT r.id,r.user_id FROM admin_password_reset_tokens r JOIN users u ON u.id::text=r.user_id WHERE r.token_hash=$1 AND r.used_at IS NULL AND r.expires_at>now() AND u.is_active=true AND u.system_role=$2 FOR UPDATE OF r,u',
                    [hashResetToken(token),'system_admin']);
                if(rows.rowCount!==1) throw authRuntime.fail('RESET_INVALID_OR_EXPIRED',400);
                const id=rows.rows[0].user_id;
                await db.query('UPDATE users SET password=$1 WHERE id=$2',[passwordHash,id]);
                await db.query('UPDATE admin_password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',[id]);
                await authRuntime.audit('admin_password_reset',id,null,{},db);
            });
            res.json({success:true,message:'Password reset. Sign in again.'});
        } catch(error) { res.status(error.status||503).json({success:false,error:error.status?error.code||error.message:'Password reset unavailable'}); }
    });

    async function establishAdminSession(req,user) {
        await new Promise((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
        req.session.adminUser={id:user.id,username:user.username,email:user.email,role:'system_admin',
            systemRole:'system_admin',isAdmin:true,authVersion:user.auth_version,authTime:Date.now()};
        await new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
    }
    router.post('/api/admin/login', async(req,res)=>{
        try {
            const user=await authRuntime.transaction(async db=>{
                const user=await authRuntime.localProof(req.body.email||req.body.username,req.body.password,db);
                if(user.system_role!=='system_admin') throw authRuntime.fail('ADMIN_REQUIRED',403);
                await db.query('UPDATE users SET login_count=COALESCE(login_count,0)+1,last_login=now() WHERE id=$1',[user.id]);
                return user;
            });
            await establishAdminSession(req,user);
            res.json({success:true,user:req.session.adminUser});
        } catch(error) { res.status(error.status||503).json({success:false,error:error.status?error.code:'Admin authentication unavailable'}); }
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

                res.clearCookie("bcl.admin.sid", {
                    path: "/",
                    httpOnly: true,
                    secure: true, sameSite: "lax"
                });
                res.json({ success: true, message: "Admin logged out successfully" });
            });
        } catch (error) {
            console.error("❌ Admin logout error:", error);
            res.status(500).json({ error: "Logout failed" });
        }
    });

    router.post('/api/admin/session/bridge', async(req,res)=>{
        try {
            const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):req.body.token;
            const principal=await authRuntime.verify(token);
            if(!principal.isAdmin) throw authRuntime.fail('ADMIN_REQUIRED',403);
            if(Date.now()/1000-principal.auth_time>300) throw authRuntime.fail('RECENT_AUTHENTICATION_REQUIRED');
            const user=await authRuntime.userState(principal.sub);
            await establishAdminSession(req,user);
            res.json({authenticated:true,user:req.session.adminUser});
        } catch(error) { res.status(error.status||503).json({authenticated:false,error:error.status?error.code:'Admin authentication unavailable'}); }
    });

    router.get("/api/admin/session", (req, res) => {
        if (req.adminPrincipal?.isAdmin) {
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

    router.post('/api/admin/change-password', async(req,res)=>{
        try {
            if(!req.adminPrincipal?.isAdmin) throw authRuntime.fail('ADMIN_SESSION_REQUIRED');
            if(req.body.newPassword!==req.body.confirmPassword) throw authRuntime.fail('PASSWORD_CONFIRMATION_MISMATCH',400);
            await authRuntime.changePassword(req.adminPrincipal.id,req.body.currentPassword,req.body.newPassword,false);
            await new Promise((resolve,reject)=>req.session.destroy(error=>error?reject(error):resolve()));
            res.clearCookie('bcl.admin.sid',{path:'/',httpOnly:true,secure:true,sameSite:'lax'});
            res.json({success:true,reauthenticationRequired:true,message:'Password changed. Sign in again.'});
        } catch(error) { res.status(error.status||503).json({success:false,error:error.status?error.code:'Password change unavailable'}); }
    });

    return router;
}

module.exports = createAdminSessionRoutes;
