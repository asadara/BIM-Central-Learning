const { canonicalUserId, identityStoreUnavailable } = require("../utils/canonicalIdentity");
const { isPasswordHash } = require("../utils/credentials");
const multer = require("multer");
const path = require("path");
const {
    ensureUserProfileColumns,
    mapUserProfileState,
    normalizeBimCompetencyLevel
} = require("../utils/userProfileSchema");

function createUserAuthService({
    backendDir,
    pgPool,
    readUsers,
    writeUsers
}) {
    function normalizeBimLevelInput(value) {
        return normalizeBimCompetencyLevel(value);
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
    }).fields([
        { name: "profile-image", maxCount: 1 },
        { name: "profileImage", maxCount: 1 }
    ]);

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

    async function fetchProfileImageFromPostgres(userId) {
        const id = canonicalUserId(userId);
        if (!id || !pgPool) return null;
        const result = await pgPool.query('SELECT profile_image FROM users WHERE id = $1', [id]);
        return result.rows[0]?.profile_image || null;
    }

    async function updateProfileImageInPostgres(userId, _email, imageUrl) {
        const id = canonicalUserId(userId);
        if (!id) return false;
        if (!pgPool) throw identityStoreUnavailable();
        const result = await pgPool.query(
            'UPDATE users SET profile_image = $1 WHERE id = $2 AND is_active = true RETURNING id', [imageUrl, id]
        );
        return result.rowCount === 1;
    }

    function updateProfileImageInJson() {
        // Retained compatibility entrypoint; legacy JSON has no approved canonical mapping.
        throw identityStoreUnavailable();
    }

    function normalizeUserRecord(user) {
        if (!user) return null;

        const role = user.job_role || user.jobRole || "";
        const profileState = mapUserProfileState(user);

        return {
            ...user,
            id: user.id,
            username: user.username || user.name || null,
            email: user.email || null,
            password: user.password || null,
            bim_level: user.bim_level || user.bimLevel || null,
            job_role: role || null,
            position_label: profileState.positionLabel || null,
            position_verification_status: profileState.positionVerificationStatus,
            competency_status: profileState.competencyStatus,
            target_bim_level: profileState.targetCompetencyLevel,
            system_role: profileState.systemRole,
            organization: user.organization || null,
            login_count: user.login_count ?? user.loginCount ?? 0,
            last_login: user.last_login || user.lastLogin || null,
            is_active: user.is_active !== undefined ? !!user.is_active : (user.isActive !== undefined ? !!user.isActive : true),
            is_admin: profileState.systemRole === "system_admin",
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
            "IDENTITY_STORE_UNAVAILABLE",
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
        if (!pgPool) throw identityStoreUnavailable();
        await ensureUserProfileColumns(pgPool);

        const query = `
            SELECT id, username, email, password, bim_level, job_role, position_label,
                   position_verification_status, competency_status, target_bim_level, system_role, organization,
                   login_count, last_login, is_active, profile_image, metadata,
                   registration_date, created_at, updated_at,
                   CASE
                       WHEN system_role = 'system_admin' THEN true
                       ELSE false
                   END AS is_admin
            FROM users
            WHERE (lower(email) = lower($1) OR lower(username) = lower($1))
              AND ($2::boolean = false OR is_active = true)
            LIMIT 2
        `;

        const result = await pgPool.query(query, [emailOrUsername, requireActive]);
        if (result.rows.length !== 1) return null;
        return normalizeUserRecord(result.rows[0]);
    }

    async function findUserInPostgresByIdentity(email, userId, requireActive = true) {
        const id = canonicalUserId(userId);
        if (!id) return null;
        if (!pgPool) throw identityStoreUnavailable();
        await ensureUserProfileColumns(pgPool);

        const query = `
            SELECT id, username, email, password, bim_level, job_role, position_label,
                   position_verification_status, competency_status, target_bim_level, system_role, organization,
                   login_count, last_login, is_active, profile_image, metadata,
                   registration_date, created_at, updated_at,
                   CASE
                       WHEN system_role = 'system_admin' THEN true
                       ELSE false
                   END AS is_admin
            FROM users
            WHERE id = $1
              AND ($2::boolean = false OR is_active = true)
            LIMIT 1
        `;

        const result = await pgPool.query(query, [
            id,
            requireActive
        ]);

        if (result.rows.length === 0) return null;
        return normalizeUserRecord(result.rows[0]);
    }

    function findUserInJsonByEmail() {
        // A legacy record is not an authentication authority without an approved mapping.
        return null;
    }

    function findUserInJsonByIdentity() {
        return null;
    }

    async function findUserForProfileUpdate(_email, userId) {
        return { user: await findUserInPostgresByIdentity(null, userId, true), storage: "postgresql" };
    }

    async function ensureUniqueProfileIdentity({ email, username, currentUserId }) {
        const id = canonicalUserId(currentUserId);
        if (!id) return false;
        if (!pgPool) throw identityStoreUnavailable();
        const result = await pgPool.query(
            `SELECT id FROM users
             WHERE (lower(email) = lower($1) OR lower(username) = lower($2)) AND id <> $3
             LIMIT 1`, [email, username, id]
        );
        return result.rowCount === 0;
    }

    async function updateUserProfileInPostgres(currentUser, updates) {
        const id = canonicalUserId(currentUser?.id);
        if (!id) return null;
        if (!pgPool) throw identityStoreUnavailable();
        if (updates.passwordHash && !isPasswordHash(updates.passwordHash)) {
            throw new Error("A valid password hash is required");
        }
        await ensureUserProfileColumns(pgPool);

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

        if (Object.prototype.hasOwnProperty.call(updates, "positionLabel")) {
            values.push(updates.positionLabel || null);
            sets.push(`position_label = $${values.length}::text`);
            sets.push(`job_role = $${values.length}::text`);
            sets.push(`position_verification_status = 'unverified'`);
            sets.push(`position_verified_at = NULL`);
            sets.push(`position_verified_by = NULL`);
        }

        if (sets.length === 0) {
            return currentUser;
        }

        sets.push("updated_at = CURRENT_TIMESTAMP");

        values.push(id);
        const idIndex = values.length;
        let passwordGuard = "";
        if (updates.passwordHash) { values.push(currentUser.password); passwordGuard = ` AND password = $${values.length}`; }

        const result = await pgPool.query(
            `UPDATE users
             SET ${sets.join(", ")}
             WHERE id = $${idIndex} AND is_active = true${passwordGuard}
             RETURNING id, username, email, password, bim_level, job_role, position_label,
                       position_verification_status, competency_status, target_bim_level, system_role, organization,
                       login_count, last_login, is_active, profile_image, metadata,
                       registration_date, created_at, updated_at,
                       CASE
                           WHEN system_role = 'system_admin' THEN true
                           ELSE false
                       END AS is_admin`,
            values
        );

        if (result.rows.length === 0) {
            return null;
        }

        return normalizeUserRecord(result.rows[0]);
    }

    function updateUserProfileInJson() {
        throw identityStoreUnavailable();
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

    function incrementUserLoginInJson() {
        throw identityStoreUnavailable();
    }

    function normalizeProgressLevel(level) {
        return normalizeBimCompetencyLevel(level);
    }

    function defaultToNextLevelByLevel(level) {
        if (level === "BIM Modeller") return 0;
        if (level === "BIM Coordinator") return 0;
        return 0;
    }

    async function ensureUserProgressInPostgres(userId, levelHint) {
        if (!userId) return;

        const currentLevel = normalizeProgressLevel(levelHint);
        if (!currentLevel) return;
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
        normalizeUserRecord,
        profileImageUpload,
        profileUpdateUpload,
        sanitizeOptionalText,
        updateProfileImageInJson,
        updateProfileImageInPostgres,
        updateUserProfileInJson,
        updateUserProfileInPostgres,
    };
}

module.exports = createUserAuthService;
