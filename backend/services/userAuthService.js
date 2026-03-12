const axios = require("axios");
const multer = require("multer");
const path = require("path");

function createUserAuthService({
    backendDir,
    googleClientId,
    googleTokeninfoEndpoint,
    pgPool,
    readUsers,
    writeUsers
}) {
    function normalizeGoogleAction(action) {
        const value = String(action || "").toLowerCase().trim();
        return value === "signup" ? "signup" : "login";
    }

    function normalizeBimLevelInput(value) {
        const allowed = new Set(["BIM Modeller", "BIM Coordinator", "BIM Manager"]);
        const normalized = String(value || "").trim();
        return allowed.has(normalized) ? normalized : "BIM Modeller";
    }

    function sanitizeOptionalText(value, maxLength = 120) {
        const normalized = String(value || "").trim();
        if (!normalized) return "";
        return normalized.slice(0, maxLength);
    }

    function sanitizeUsernameBase(value) {
        const normalized = String(value || "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^[_\.-]+|[_\.-]+$/g, "");

        return normalized.slice(0, 30) || "user";
    }

    function buildGoogleUsernameSeed(googleProfile) {
        const nameCandidate = sanitizeOptionalText(googleProfile?.name, 80);
        if (nameCandidate) return sanitizeUsernameBase(nameCandidate);

        const emailCandidate = sanitizeOptionalText(googleProfile?.email, 120);
        if (emailCandidate.includes("@")) {
            return sanitizeUsernameBase(emailCandidate.split("@")[0]);
        }

        return `google_${Date.now()}`;
    }

    function findAvailableUsernameInJson(baseUsername) {
        const users = readUsers();
        const taken = new Set(users.map((user) => String(user.username || "").toLowerCase()));

        let candidate = sanitizeUsernameBase(baseUsername);
        let suffix = 1;
        while (taken.has(candidate.toLowerCase())) {
            candidate = sanitizeUsernameBase(`${baseUsername}_${suffix}`);
            suffix += 1;
            if (suffix > 500) {
                candidate = `user_${Date.now()}`;
                break;
            }
        }

        return candidate;
    }

    async function findAvailableUsernameInPostgres(baseUsername) {
        let candidate = sanitizeUsernameBase(baseUsername);
        let suffix = 1;

        while (suffix <= 500) {
            const result = await pgPool.query(
                "SELECT 1 FROM users WHERE lower(username) = lower($1) LIMIT 1",
                [candidate]
            );

            if (result.rowCount === 0) {
                return candidate;
            }

            candidate = sanitizeUsernameBase(`${baseUsername}_${suffix}`);
            suffix += 1;
        }

        return `user_${Date.now()}`;
    }

    async function verifyGoogleIdToken(idToken) {
        if (!googleClientId) {
            throw new Error("GOOGLE_CLIENT_ID_NOT_CONFIGURED");
        }

        let response;
        try {
            response = await axios.get(googleTokeninfoEndpoint, {
                params: { id_token: idToken },
                timeout: 10000
            });
        } catch (error) {
            if (error.response && (error.response.status === 400 || error.response.status === 401)) {
                throw new Error("GOOGLE_TOKEN_INVALID");
            }
            throw error;
        }

        const payload = response.data || {};
        const audience = String(payload.aud || "").trim();
        const issuer = String(payload.iss || "").trim();
        const email = String(payload.email || "").trim().toLowerCase();
        const emailVerified = String(payload.email_verified || "").toLowerCase() === "true";

        if (!audience || audience !== googleClientId) {
            throw new Error("GOOGLE_AUDIENCE_MISMATCH");
        }

        if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
            throw new Error("GOOGLE_ISSUER_INVALID");
        }

        if (!email || !emailVerified) {
            throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
        }

        return {
            email,
            name: sanitizeOptionalText(payload.name, 120),
            picture: sanitizeOptionalText(payload.picture, 512),
            sub: sanitizeOptionalText(payload.sub, 128)
        };
    }

    const profileImageDir = path.join(backendDir, "public", "uploads", "profile-images");
    if (!require("fs").existsSync(profileImageDir)) {
        require("fs").mkdirSync(profileImageDir, { recursive: true });
    }

    const profileImageStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, profileImageDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
            const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
            const userId = req.user && req.user.userId ? String(req.user.userId) : "user";
            const timestamp = Date.now();
            cb(null, `profile_${userId}_${timestamp}${safeExt}`);
        }
    });

    const profileImageUpload = multer({
        storage: profileImageStorage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase();
            if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error("Invalid file type. Only JPG, PNG, or WEBP are allowed."));
            }
        }
    }).single("profile-image");

    const profileUpdateUpload = multer({
        storage: profileImageStorage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase();
            if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error("Invalid file type. Only JPG, PNG, or WEBP are allowed."));
            }
        }
    }).fields([
        { name: "profile_pic", maxCount: 1 },
        { name: "profile-image", maxCount: 1 }
    ]);

    async function fetchProfileImageFromPostgres(userId, email) {
        if (!pgPool) return null;
        try {
            const result = await pgPool.query(
                `SELECT profile_image
                 FROM users
                 WHERE ($1::text IS NOT NULL AND id::text = $1::text)
                    OR ($2::text IS NOT NULL AND email = $2)
                 LIMIT 1`,
                [userId ? String(userId) : null, email || null]
            );

            if (result.rows.length === 0) return null;
            return result.rows[0].profile_image || null;
        } catch (error) {
            console.warn("PostgreSQL profile image fetch failed:", error.message);
            return null;
        }
    }

    async function updateProfileImageInPostgres(userId, email, imageUrl) {
        if (!pgPool) return false;
        try {
            const result = await pgPool.query(
                `UPDATE users
                 SET profile_image = $1
                 WHERE ($2::text IS NOT NULL AND id::text = $2::text)
                    OR ($3::text IS NOT NULL AND email = $3)
                 RETURNING id`,
                [imageUrl, userId ? String(userId) : null, email || null]
            );

            return result.rowCount > 0;
        } catch (error) {
            console.warn("PostgreSQL profile image update failed:", error.message);
            return false;
        }
    }

    function updateProfileImageInJson(userId, email, imageUrl) {
        const users = readUsers();
        const userIndex = users.findIndex((u) =>
            (userId && (u.id === userId || u.id == userId)) ||
            (email && u.email === email)
        );

        if (userIndex === -1) return false;
        users[userIndex].profileImage = imageUrl;
        writeUsers(users);
        return true;
    }

    function normalizeUserRecord(user) {
        if (!user) return null;

        const role = user.job_role || user.jobRole || "";
        const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : null;

        return {
            ...user,
            id: user.id,
            username: user.username || user.name || null,
            email: user.email || null,
            password: user.password || null,
            bim_level: user.bim_level || user.bimLevel || null,
            job_role: role || null,
            organization: user.organization || null,
            login_count: user.login_count ?? user.loginCount ?? 0,
            last_login: user.last_login || user.lastLogin || null,
            is_active: user.is_active !== undefined ? !!user.is_active : (user.isActive !== undefined ? !!user.isActive : true),
            is_admin: user.is_admin !== undefined
                ? !!user.is_admin
                : !!(user.isAdmin || String(role).toLowerCase().includes("admin") || String(metadata?.isAdmin || "").toLowerCase() === "true"),
            profile_image: user.profile_image || user.profileImage || null
        };
    }

    function isUserActive(user) {
        if (!user) return false;
        if (user.is_active === false) return false;
        if (user.isActive === false) return false;
        return true;
    }

    function isPostgresConnectionError(error) {
        if (!error) return false;

        const code = String(error.code || "").toUpperCase();
        const connectionCodes = new Set([
            "ECONNREFUSED",
            "ECONNRESET",
            "ENOTFOUND",
            "ETIMEDOUT",
            "08000",
            "08001",
            "08003",
            "08004",
            "08006",
            "08007",
            "08P01",
            "57P01",
            "57P02",
            "57P03",
            "53300"
        ]);

        if (connectionCodes.has(code)) return true;

        const message = String(error.message || "").toLowerCase();
        return (
            message.includes("connect") ||
            message.includes("connection") ||
            message.includes("timeout") ||
            message.includes("refused") ||
            message.includes("terminated")
        );
    }

    async function findUserInPostgresByEmail(emailOrUsername, requireActive = true) {
        if (!emailOrUsername) return null;

        const query = `
            SELECT id, username, email, password, bim_level, job_role, organization,
                   login_count, last_login, is_active, profile_image, metadata,
                   CASE
                       WHEN lower(coalesce(job_role, '')) LIKE '%admin%' THEN true
                       WHEN lower(coalesce(metadata->>'isAdmin', 'false')) = 'true' THEN true
                       ELSE false
                   END AS is_admin
            FROM users
            WHERE (lower(email) = lower($1) OR lower(username) = lower($1))
              AND ($2::boolean = false OR is_active = true)
            LIMIT 1
        `;

        const result = await pgPool.query(query, [emailOrUsername, requireActive]);
        if (result.rows.length === 0) return null;
        return normalizeUserRecord(result.rows[0]);
    }

    async function findUserInPostgresByIdentity(email, userId, requireActive = true) {
        if (!email && !userId) return null;

        const query = `
            SELECT id, username, email, password, bim_level, job_role, organization,
                   login_count, last_login, is_active, profile_image, metadata,
                   CASE
                       WHEN lower(coalesce(job_role, '')) LIKE '%admin%' THEN true
                       WHEN lower(coalesce(metadata->>'isAdmin', 'false')) = 'true' THEN true
                       ELSE false
                   END AS is_admin
            FROM users
            WHERE (($1::text IS NOT NULL AND lower(email) = lower($1))
                   OR ($2::text IS NOT NULL AND id::text = $2::text))
              AND ($3::boolean = false OR is_active = true)
            LIMIT 1
        `;

        const result = await pgPool.query(query, [
            email || null,
            userId ? String(userId) : null,
            requireActive
        ]);

        if (result.rows.length === 0) return null;
        return normalizeUserRecord(result.rows[0]);
    }

    function findUserInJsonByEmail(emailOrUsername, requireActive = true, requirePassword = true) {
        if (!emailOrUsername) return null;
        const needle = String(emailOrUsername).toLowerCase();
        const users = readUsers();
        const found = users.find((u) =>
            (
                String(u.email || "").toLowerCase() === needle ||
                String(u.username || "").toLowerCase() === needle
            ) &&
            (!requirePassword || u.password)
        );
        if (!found) return null;
        if (requireActive && !isUserActive(found)) return null;
        return normalizeUserRecord(found);
    }

    function findUserInJsonByIdentity(email, userId, requireActive = true, requirePassword = true) {
        const users = readUsers();
        const found = users.find((u) =>
            ((email && u.email === email) || (userId && (u.id === userId || u.id == userId))) &&
            (!requirePassword || u.password)
        );

        if (!found) return null;
        if (requireActive && !isUserActive(found)) return null;
        return normalizeUserRecord(found);
    }

    async function findUserForProfileUpdate(email, userId) {
        let postgresLookupFailed = false;
        let user = null;
        let storage = "postgresql";

        try {
            if (email || userId) {
                user = await findUserInPostgresByIdentity(email, userId, true);
            }
        } catch (error) {
            postgresLookupFailed = isPostgresConnectionError(error);
            if (!postgresLookupFailed) {
                throw error;
            }

            console.warn("PostgreSQL unavailable during profile lookup, falling back to JSON:", error.message);
        }

        if (!user && (postgresLookupFailed || !pgPool)) {
            user = findUserInJsonByIdentity(email, userId, true, false);
            storage = "json";
        } else if (!user && email) {
            user = findUserInJsonByEmail(email, true, false);
            storage = user ? "json" : storage;
        }

        return { user, storage };
    }

    async function ensureUniqueProfileIdentity({ email, username, currentUserId, currentEmail, currentUsername }) {
        if (pgPool) {
            const duplicateResult = await pgPool.query(
                `SELECT id, email, username
                 FROM users
                 WHERE (
                        ($1::text IS NOT NULL AND lower(email) = lower($1))
                     OR ($2::text IS NOT NULL AND lower(username) = lower($2))
                 )
                   AND (
                        ($3::text IS NULL OR id::text <> $3::text)
                     AND ($4::text IS NULL OR lower(email) <> lower($4))
                     AND ($5::text IS NULL OR lower(username) <> lower($5))
                   )
                 LIMIT 1`,
                [
                    email || null,
                    username || null,
                    currentUserId ? String(currentUserId) : null,
                    currentEmail || null,
                    currentUsername || null
                ]
            );

            if (duplicateResult.rowCount > 0) {
                return false;
            }
        }

        const users = readUsers();
        const hasDuplicate = users.some((entry) => {
            const sameUser =
                (currentUserId && (entry.id === currentUserId || entry.id == currentUserId)) ||
                (currentEmail && String(entry.email || "").toLowerCase() === String(currentEmail).toLowerCase()) ||
                (currentUsername && String(entry.username || "").toLowerCase() === String(currentUsername).toLowerCase());

            if (sameUser) return false;

            return (
                (email && String(entry.email || "").toLowerCase() === String(email).toLowerCase()) ||
                (username && String(entry.username || "").toLowerCase() === String(username).toLowerCase())
            );
        });

        return !hasDuplicate;
    }

    async function updateUserProfileInPostgres(currentUser, updates) {
        if (!pgPool || !currentUser) return null;

        const sets = [];
        const values = [];

        if (updates.username) {
            values.push(updates.username);
            sets.push(`username = $${values.length}`);
        }

        if (updates.email) {
            values.push(updates.email);
            sets.push(`email = $${values.length}`);
        }

        if (updates.passwordHash) {
            values.push(updates.passwordHash);
            sets.push(`password = $${values.length}`);
        }

        if (updates.profileImage) {
            values.push(updates.profileImage);
            sets.push(`profile_image = $${values.length}`);
        }

        if (sets.length === 0) {
            return currentUser;
        }

        sets.push("updated_at = CURRENT_TIMESTAMP");

        values.push(currentUser.id ? String(currentUser.id) : null);
        const idIndex = values.length;
        values.push(currentUser.email || null);
        const emailIndex = values.length;

        const result = await pgPool.query(
            `UPDATE users
             SET ${sets.join(", ")}
             WHERE ($${idIndex}::text IS NOT NULL AND id::text = $${idIndex}::text)
                OR ($${emailIndex}::text IS NOT NULL AND lower(email) = lower($${emailIndex}))
             RETURNING id, username, email, password, bim_level, job_role, organization,
                       login_count, last_login, is_active, profile_image, metadata,
                       CASE
                           WHEN lower(coalesce(job_role, '')) LIKE '%admin%' THEN true
                           WHEN lower(coalesce(metadata->>'isAdmin', 'false')) = 'true' THEN true
                           ELSE false
                       END AS is_admin`,
            values
        );

        if (result.rows.length === 0) {
            return null;
        }

        return normalizeUserRecord(result.rows[0]);
    }

    function updateUserProfileInJson(currentUser, updates) {
        if (!currentUser) return null;

        const users = readUsers();
        const userIndex = users.findIndex((entry) =>
            (currentUser.id && (entry.id === currentUser.id || entry.id == currentUser.id)) ||
            (currentUser.email && String(entry.email || "").toLowerCase() === String(currentUser.email).toLowerCase())
        );

        if (userIndex === -1) {
            return null;
        }

        if (updates.username) {
            users[userIndex].username = updates.username;
            users[userIndex].name = updates.username;
        }

        if (updates.email) {
            users[userIndex].email = updates.email;
        }

        if (updates.passwordHash) {
            users[userIndex].password = updates.passwordHash;
        }

        if (updates.profileImage) {
            users[userIndex].profileImage = updates.profileImage;
            users[userIndex].profile_image = updates.profileImage;
        }

        users[userIndex].updatedAt = new Date().toISOString();
        writeUsers(users);
        return normalizeUserRecord(users[userIndex]);
    }

    async function incrementUserLoginInPostgres(userId) {
        if (!userId) return;
        try {
            await pgPool.query(
                `UPDATE users
                 SET login_count = COALESCE(login_count, 0) + 1,
                     last_login = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [userId]
            );
        } catch (error) {
            console.warn("Failed to update login count in PostgreSQL:", error.message);
        }
    }

    function incrementUserLoginInJson(userId) {
        if (!userId) return;
        const users = readUsers();
        const userIndex = users.findIndex((u) => u.id === userId || u.id == userId);
        if (userIndex === -1) return;

        users[userIndex].lastLogin = new Date().toISOString();
        users[userIndex].last_login = users[userIndex].lastLogin;
        users[userIndex].loginCount = (users[userIndex].loginCount || users[userIndex].login_count || 0) + 1;
        users[userIndex].login_count = users[userIndex].loginCount;
        writeUsers(users);
    }

    function normalizeProgressLevel(level) {
        const value = String(level || "").trim();
        const allowed = new Set(["BIM Modeller", "BIM Coordinator", "BIM Manager", "Expert"]);
        return allowed.has(value) ? value : "BIM Modeller";
    }

    function defaultToNextLevelByLevel(level) {
        if (level === "BIM Modeller") return 0;
        if (level === "BIM Coordinator") return 0;
        return 0;
    }

    async function ensureUserProgressInPostgres(userId, levelHint) {
        if (!userId) return;

        const currentLevel = normalizeProgressLevel(levelHint);
        const toNextLevel = defaultToNextLevelByLevel(currentLevel);

        try {
            await pgPool.query(
                `INSERT INTO user_progress (
                    user_id,
                    courses_completed,
                    practice_attempts,
                    exams_passed,
                    certificates_earned,
                    current_level,
                    to_next_level,
                    created_at,
                    updated_at
                ) VALUES (
                    $1, 0, 0, 0, 0, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (user_id) DO NOTHING`,
                [userId, currentLevel, toNextLevel]
            );
        } catch (error) {
            console.warn("Failed to ensure user progress row in PostgreSQL:", error.message);
        }
    }

    return {
        buildGoogleUsernameSeed,
        ensureUniqueProfileIdentity,
        ensureUserProgressInPostgres,
        fetchProfileImageFromPostgres,
        findAvailableUsernameInJson,
        findAvailableUsernameInPostgres,
        findUserForProfileUpdate,
        findUserInJsonByEmail,
        findUserInJsonByIdentity,
        findUserInPostgresByEmail,
        findUserInPostgresByIdentity,
        incrementUserLoginInJson,
        incrementUserLoginInPostgres,
        isPostgresConnectionError,
        normalizeBimLevelInput,
        normalizeGoogleAction,
        normalizeUserRecord,
        profileImageUpload,
        profileUpdateUpload,
        sanitizeOptionalText,
        updateProfileImageInJson,
        updateProfileImageInPostgres,
        updateUserProfileInJson,
        updateUserProfileInPostgres,
        verifyGoogleIdToken
    };
}

module.exports = createUserAuthService;
