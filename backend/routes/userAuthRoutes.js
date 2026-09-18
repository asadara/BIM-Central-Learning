const { passwordValidationError } = require("../utils/credentials");
const { authenticatedUserId, protectedUserField } = require("../utils/canonicalIdentity");
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
    ensureUserProfileColumns,
    mapUserProfileState,
    normalizeBimCompetencyLevel
} = require("../utils/userProfileSchema");

function createUserAuthRoutes({
    authRuntime,
    authLimiter,
    ensureUniqueProfileIdentity,
    ensureUserProgressInPostgres,
    fetchProfileImageFromPostgres,
    findUserForProfileUpdate,
    findUserInPostgresByEmail,
    googleClientId,
    hashPassword,
    isPostgresConnectionError,
    normalizeBimLevelInput,
    normalizeUserRecord,
    pgPool,
    profileImageUpload,
    profileUpdateUpload,
    requireAuth,
    sanitizeOptionalText,
    updateProfileImageInPostgres,
    updateUserProfileInPostgres,
    verifyPassword,
}) {
    const router = express.Router();
    const handleAsync = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
    function sendStorageError(error, res) {
        const unavailable = isPostgresConnectionError(error) || error.status === 503;
        return res.status(unavailable ? 503 : 500).json({
            success: false,
            error: unavailable ? "Canonical user storage unavailable" : "Profile operation failed"
        });
    }
    const profileImageDir = path.join(__dirname, "..", "public", "uploads", "profile-images");

    function normalizeProfileImageUrl(imageUrl) {
        const value = String(imageUrl || "").trim();
        if (!value) {
            return value;
        }

        if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
            return value;
        }

        const uploadPrefix = "/uploads/profile-images/";
        if (value.startsWith(uploadPrefix)) {
            const filename = path.basename(value);
            return filename ? `/api/profile-images/${encodeURIComponent(filename)}` : value;
        }

        return value;
    }

    function getBearerToken(req) {
        const authHeader = String(req.headers.authorization || "").trim();
        return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    }

    async function resolveProfileUser(req) {
        const token = getBearerToken(req);
        if (!token) {
            return null;
        }

        try {
            const decoded = req.authPrincipal;
            if (!decoded) return null;
            return await findUserForProfileUpdate(null, authenticatedUserId(decoded)).then(lookup => lookup?.user || null);
        } catch (error) {
            if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError" || error.name === "NotBeforeError") return null;
            throw error;
        }
    }

    function formatJoinDate(user) {
        const rawValue =
            user?.registrationDate ||
            user?.registration_date ||
            user?.created_at ||
            user?.createdAt ||
            null;

        if (!rawValue) {
            return null;
        }

        const parsed = new Date(rawValue);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return parsed.toLocaleString("id-ID", {
            month: "short",
            year: "numeric"
        });
    }

    async function buildProfileStats(user) {
        const emptyStats = {
            coursesCompleted: 0,
            verifiedAttempts: 0,
            practiceAttempts: 0,
            examsPassed: 0,
            certifications: 0,
            studyHours: null,
            connections: null,
            lastCourseAt: null,
            lastAttemptAt: null,
            lastCertificateAt: null,
            source: "server-evidence"
        };

        if (!pgPool || !user?.id) {
            return emptyStats;
        }

        const attemptsResult = await pgPool.query(
            `SELECT
                COUNT(*)::int AS verified_attempts,
                COUNT(*) FILTER (WHERE source_type = 'practice')::int AS practice_attempts,
                COUNT(*) FILTER (WHERE source_type = 'exam' AND passed = true)::int AS exams_passed,
                MAX(submitted_at) AS last_attempt_at
             FROM learning_attempts
             WHERE user_id = $1 AND is_verified = true`,
            [user.id]
        );
        const certificatesResult = await pgPool.query(
            `SELECT COUNT(*)::int AS certifications, MAX(issued_at) AS last_certificate_at
             FROM user_certificates
             WHERE user_id = $1 AND is_verified = true`,
            [user.id]
        );

        let coursesCompleted = 0;
        let lastCourseAt = null;
        try {
            const activityResult = await pgPool.query(
                `SELECT
                    COUNT(DISTINCT (module_type, module_id)) FILTER (WHERE event_type = 'completed')::int AS courses_completed,
                    MAX(created_at) FILTER (WHERE event_type = 'completed') AS last_course_at
                 FROM learning_activity_events
                 WHERE user_id = $1::text`,
                [user.id]
            );
            coursesCompleted = Number(activityResult.rows[0]?.courses_completed || 0);
            lastCourseAt = activityResult.rows[0]?.last_course_at || null;
        } catch (error) {
            if (error.code !== "42P01") throw error;
        }

        const attempts = attemptsResult.rows[0] || {};
        const certificates = certificatesResult.rows[0] || {};
        return {
            ...emptyStats,
            coursesCompleted,
            verifiedAttempts: Number(attempts.verified_attempts || 0),
            practiceAttempts: Number(attempts.practice_attempts || 0),
            examsPassed: Number(attempts.exams_passed || 0),
            certifications: Number(certificates.certifications || 0),
            lastCourseAt,
            lastAttemptAt: attempts.last_attempt_at || null,
            lastCertificateAt: certificates.last_certificate_at || null
        };
    }

    router.get("/api/profile-images/:filename", (req, res) => {
        const requestedName = String(req.params.filename || "").trim();
        const safeName = path.basename(requestedName);

        if (!safeName || safeName !== requestedName) {
            return res.status(400).json({
                success: false,
                error: "Invalid profile image path"
            });
        }

        const imagePath = path.join(profileImageDir, safeName);
        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({
                success: false,
                error: "Profile image not found"
            });
        }

        return res.sendFile(imagePath);
    });

    router.get("/api/profile", requireAuth, handleAsync(async (req, res) => {
        const user = await resolveProfileUser(req);
        if (!user) {
            return res.status(404).json({ success: false, error: "Profile not found" });
        }

        const profileState = mapUserProfileState(user);
        return res.json({
            success: true,
            id: user.id,
            name: user.username || user.name || "",
            username: user.username || user.name || "",
            email: user.email || "",
            role: profileState.positionLabel,
            positionLabel: profileState.positionLabel,
            positionVerificationStatus: profileState.positionVerificationStatus,
            systemRole: profileState.systemRole,
            isAdmin: profileState.systemRole === 'system_admin',
            bimLevel: profileState.competencyLevel,
            competencyStatus: profileState.competencyStatus,
            targetBimLevel: profileState.targetCompetencyLevel,
            organization: user.organization || "",
            photo: normalizeProfileImageUrl(user.profileImage || user.profile_image || "/img/user-default.svg"),
            profileImage: normalizeProfileImageUrl(user.profileImage || user.profile_image || "/img/user-default.svg"),
            joinDate: formatJoinDate(user),
            registrationDate: user.registrationDate || user.registration_date || user.created_at || user.createdAt || null,
            lastLogin: user.lastLogin || user.last_login || null,
            updatedAt: user.updatedAt || user.updated_at || null
        });
    }));

    router.get("/api/profile/stats", requireAuth, handleAsync(async (req, res) => {
        const user = await resolveProfileUser(req);
        if (!user) {
            return res.status(404).json({ error: "Profile not found" });
        }

        const stats = await buildProfileStats(user);
        return res.json({
            coursesCompleted: stats.coursesCompleted,
            certifications: stats.certifications,
            verifiedAttempts: stats.verifiedAttempts,
            practiceAttempts: stats.practiceAttempts,
            examsPassed: stats.examsPassed,
            studyHours: stats.studyHours,
            connections: stats.connections,
            lastActivityAt: [stats.lastCourseAt, stats.lastAttemptAt, stats.lastCertificateAt]
                .filter(Boolean)
                .sort((a, b) => new Date(b) - new Date(a))[0] || null,
            source: stats.source
        });
    }));

    router.get("/api/profile/achievements", requireAuth, handleAsync(async (req, res) => {
        const user = await resolveProfileUser(req);
        if (!user) {
            return res.json([]);
        }

        const stats = await buildProfileStats(user);
        const achievements = [];

        if (stats.coursesCompleted > 0) {
            achievements.push({
                title: "Course Starter",
                description: `Completed ${stats.coursesCompleted} learning module${stats.coursesCompleted > 1 ? "s" : ""}.`,
                icon: "fas fa-book-open",
                rarity: "common",
                dateEarned: stats.lastCourseAt,
                evidenceType: "completed-learning-module"
            });
        }

        if (stats.certifications > 0) {
            achievements.push({
                title: "Certified Learner",
                description: `Earned ${stats.certifications} certificate${stats.certifications > 1 ? "s" : ""}.`,
                icon: "fas fa-certificate",
                rarity: "rare",
                dateEarned: stats.lastCertificateAt,
                evidenceType: "verified-certificate"
            });
        }

        if (stats.practiceAttempts >= 5) {
            achievements.push({
                title: "Practice Builder",
                description: `Completed ${stats.practiceAttempts} practice attempt${stats.practiceAttempts > 1 ? "s" : ""}.`,
                icon: "fas fa-dumbbell",
                rarity: "common",
                dateEarned: stats.lastAttemptAt,
                evidenceType: "verified-practice-attempt"
            });
        }

        return res.json(achievements);
    }));

    router.get("/api/profile/activity", requireAuth, handleAsync(async (req, res) => {
        const user = await resolveProfileUser(req);
        if (!user) {
            return res.json([]);
        }

        const activities = [];
        if (pgPool && user.id) {
            try {
                const learningActivityResult = await pgPool.query(
                    `SELECT module_id, module_type, event_type, title, category, source,
                            progress_percent, created_at
                     FROM learning_activity_events
                     WHERE user_id = $1::text
                     ORDER BY created_at DESC
                     LIMIT 20`,
                    [user.id]
                );

                learningActivityResult.rows.forEach((event) => {
                    const completed = event.event_type === "completed";
                    activities.push({
                        type: completed ? "learning-completed" : "learning-opened",
                        icon: completed ? "fas fa-check-circle" : "fas fa-book-open",
                        title: event.title || event.module_id || "Materi pembelajaran",
                        description: completed
                            ? "Materi diselesaikan dan tercatat pada server."
                            : "Materi dibuka dan tercatat pada server.",
                        timestamp: event.created_at,
                        moduleId: event.module_id,
                        moduleType: event.module_type,
                        category: event.category || null,
                        source: event.source || null,
                        progress: Number(event.progress_percent || 0)
                    });
                });
            } catch (error) {
                if (error.code !== "42P01") throw error;
            }
        }

        const lastLogin = user.lastLogin || user.last_login || null;
        const updatedAt = user.updatedAt || user.updated_at || null;

        if (lastLogin) {
            activities.push({
                type: "login",
                icon: "fas fa-sign-in-alt",
                title: "Last login",
                description: "User signed in to the learning platform.",
                timestamp: lastLogin
            });
        }

        if (updatedAt) {
            activities.push({
                type: "profile",
                icon: "fas fa-user-edit",
                title: "Profile updated",
                description: "Profile data was updated on the platform.",
                timestamp: updatedAt
            });
        }

        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return res.json(activities.slice(0, 20));
    }));

    router.get("/api/profile/courses", requireAuth, handleAsync(async (req, res) => {
        const user = await resolveProfileUser(req);
        if (!user || !pgPool) {
            return res.json([]);
        }

        try {
            const result = await pgPool.query(
                `SELECT DISTINCT ON (module_type, module_id)
                        module_id, module_type, title, category, source,
                        event_type, progress_percent, created_at
                 FROM learning_activity_events
                 WHERE user_id = $1::text
                 ORDER BY module_type, module_id, created_at DESC`,
                [user.id]
            );

            return res.json(result.rows.map((course) => ({
                id: course.module_id,
                moduleType: course.module_type,
                title: course.title || course.module_id || "Materi pembelajaran",
                description: course.category || "Aktivitas materi tercatat pada server.",
                progress: course.event_type === "completed"
                    ? 100
                    : Math.min(100, Math.max(0, Number(course.progress_percent || 0))),
                status: course.event_type,
                source: course.source || null,
                lastActivityAt: course.created_at
            })));
        } catch (error) {
            if (error.code === "42P01") {
                return res.json([]);
            }
            throw error;
        }
    }));

    router.get("/api/profile/social", requireAuth, handleAsync(async (req, res) => {
        return res.json({
            available: false,
            followers: null,
            following: null,
            discussions: null
        });
    }));

    router.get("/api/auth/google/config", (req, res) => {
        res.json({
            success: true,
            enabled: !!googleClientId,
            authContract: 'p0-2',
            clientId: googleClientId || null
        });
    });

    router.post("/api/signup", authLimiter, async (req, res) => {
        try {
            const protectedField = protectedUserField(req.body, { allowPassword: true });
            if (protectedField) return res.status(400).json({ success: false, error: `Protected user field: ${protectedField}` });
            const {
                username,
                email,
                password,
                bimLevel,
                jobRole,
                positionLabel,
                organization,
                registrationDate,
                progress
            } = req.body;

            if (typeof username !== "string" || !username.trim() || typeof email !== "string" || !email.trim() || !password) {
                return res.status(400).json({
                    success: false,
                    error: "Username, email, and password are required"
                });
            }

            const normalizedBimLevel = normalizeBimCompetencyLevel(bimLevel);
            const normalizedPositionLabel = sanitizeOptionalText(positionLabel || jobRole, 80);

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid email format"
                });
            }

            const passwordError = passwordValidationError(password);
            if (passwordError) {
                return res.status(400).json({
                    success: false,
                    error: passwordError
                });
            }

            const hashedPassword = await hashPassword(password);
            let storageType = "postgresql";
            let userId = null;

            try {
                await ensureUserProfileColumns(pgPool);
                const existingUser = await pgPool.query(
                    `SELECT id
                     FROM users
                     WHERE lower(email) = lower($1)
                        OR lower(username) = lower($2)
                     LIMIT 1`,
                    [email, username]
                );

                if (existingUser.rows.length > 0) {
                    return res.status(409).json({
                        success: false,
                        error: "Email or username already registered"
                    });
                }

                const insertResult = await pgPool.query(
                    `INSERT INTO users (
                        username, email, password, bim_level, job_role, position_label,
                        position_verification_status, competency_status, system_role, organization,
                        registration_date, login_count, last_login, is_active,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5::text, $5::text,
                        'unverified', $6, 'employee', $7,
                        $8, 0, NULL, true,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    RETURNING id`,
                    [
                        username.trim(),
                        email.trim(),
                        hashedPassword,
                        normalizedBimLevel,
                        normalizedPositionLabel || null,
                        normalizedBimLevel ? 'self_declared' : 'not_assessed',
                        organization || null,
                        registrationDate || new Date().toISOString()
                    ]
                );

                userId = insertResult.rows[0].id;
                await ensureUserProgressInPostgres(userId, normalizedBimLevel);
                console.log(`✅ User registered in PostgreSQL: ${email} (ID: ${userId})`);
            } catch (dbError) {
                if (dbError && dbError.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        error: "Email or username already registered"
                    });
                }

                if (!isPostgresConnectionError(dbError)) {
                    throw dbError;
                }

                console.warn("⚠️ PostgreSQL unavailable:", dbError.message);
                return res.status(503).json({ success: false, error: "Canonical user storage unavailable" });
            }

            res.status(201).json({
                success: true,
                message: "Account created successfully!",
                user: {
                    id: userId,
                    username: username.trim(),
                    email: email.trim(),
                    bimLevel: normalizedBimLevel,
                    competencyStatus: normalizedBimLevel ? 'self_declared' : 'not_assessed',
                    role: normalizedPositionLabel,
                    positionLabel: normalizedPositionLabel,
                    positionVerificationStatus: 'unverified',
                    systemRole: 'employee',
                    isAdmin: false
                },
                storage: storageType
            });
        } catch (error) {
            console.error("❌ Signup error:", error.message);
            console.error("❌ Signup error stack:", error.stack);
            res.status(500).json({
                success: false,
                error: "Registration failed. Please try again."
            });
        }
    });

    router.post("/api/upload-profile-image", requireAuth, (req, res) => {
        profileImageUpload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message || "Upload failed" });
            }

            const uploadedImage =
                (req.files && req.files["profile-image"] && req.files["profile-image"][0]) ||
                (req.files && req.files.profileImage && req.files.profileImage[0]) ||
                null;

            if (!uploadedImage) {
                return res.status(400).json({ error: "No image uploaded" });
            }

            try {
                const protectedField = protectedUserField(req.body);
                if (protectedField) return res.status(400).json({ error: `Protected user field: ${protectedField}` });
                const userId = authenticatedUserId(req.user);
                const imageUrl = `/uploads/profile-images/${uploadedImage.filename}`;
                const saved = await updateProfileImageInPostgres(userId, null, imageUrl);
                if (!saved) return res.status(404).json({ error: "User not found for profile update" });
                return res.json({ success: true, imageUrl: normalizeProfileImageUrl(imageUrl), storedPath: imageUrl });
            } catch (error) {
                return sendStorageError(error, res);
            }
        });
    });

    router.post("/api/update-profile", requireAuth, (req, res) => {
        profileUpdateUpload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err.message || "Upload failed" });
            }

            try {
                const authHeader = req.headers.authorization || "";
                const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
                let authUser = null;

                if (bearerToken) {
                    try {
                        authUser = req.authPrincipal;
                        if (!authUser) throw new Error("Authentication required");
                    } catch (tokenError) {
                        return res.status(403).json({ success: false, error: "Invalid or expired token" });
                    }
                }

                const protectedField = protectedUserField(req.body);
                if (protectedField) return res.status(400).json({ success: false, error: `Protected user field: ${protectedField}` });
                const requestedEmail = sanitizeOptionalText(req.body?.email, 120).toLowerCase();
                const requestedUsername = sanitizeOptionalText(
                    req.body?.name || req.body?.username,
                    80
                );
                const hasPositionUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, "positionLabel") ||
                    Object.prototype.hasOwnProperty.call(req.body || {}, "position_label");
                const requestedPositionLabel = hasPositionUpdate
                    ? sanitizeOptionalText(req.body?.positionLabel || req.body?.position_label, 100)
                    : null;
                const oldPassword = (req.body?.old_pass ?? req.body?.oldPassword ?? "");
                const newPassword = (req.body?.new_pass ?? req.body?.newPassword ?? "");
                const confirmPassword = (req.body?.c_pass ?? req.body?.confirmPassword ?? "");

                if (!requestedUsername || !requestedEmail) {
                    return res.status(400).json({
                        success: false,
                        error: "Name and email are required"
                    });
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(requestedEmail)) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid email format"
                    });
                }

                const passwordError = newPassword ? passwordValidationError(newPassword) : null;
                if (passwordError) {
                    return res.status(400).json({
                        success: false,
                        error: passwordError
                    });
                }

                if (newPassword && confirmPassword && newPassword !== confirmPassword) {
                    return res.status(400).json({
                        success: false,
                        error: "Password confirmation does not match"
                    });
                }

                const lookupEmail = null;
                const lookupUserId = authenticatedUserId(authUser || {});
                const { user: currentUser } = await findUserForProfileUpdate(lookupEmail, lookupUserId);

                if (!currentUser) {
                    return res.status(404).json({
                        success: false,
                        error: "User not found"
                    });
                }

                const requiresPasswordCheck = !authUser || !!newPassword;
                if (requiresPasswordCheck) {
                    if (!oldPassword) {
                        return res.status(401).json({
                            success: false,
                            error: "Previous password is required"
                        });
                    }

                    const isValidPassword = await verifyPassword(oldPassword, currentUser.password);
                    if (!isValidPassword) {
                        return res.status(401).json({
                            success: false,
                            error: "Previous password is incorrect"
                        });
                    }
                }

                const hasUniqueIdentity = await ensureUniqueProfileIdentity({
                    email: requestedEmail,
                    username: requestedUsername,
                    currentUserId: currentUser.id,
                    currentEmail: currentUser.email,
                    currentUsername: currentUser.username
                });

                if (!hasUniqueIdentity) {
                    return res.status(409).json({
                        success: false,
                        error: "Email or username already in use"
                    });
                }

                const uploadedImage =
                    (req.files && req.files.profile_pic && req.files.profile_pic[0]) ||
                    (req.files && req.files["profile-image"] && req.files["profile-image"][0]) ||
                    null;

                const updates = {
                    username: requestedUsername,
                    email: requestedEmail,
                    passwordHash: newPassword ? await hashPassword(newPassword) : null,
                    profileImage: uploadedImage ? `/uploads/profile-images/${uploadedImage.filename}` : null
                };
                if (hasPositionUpdate) updates.positionLabel = requestedPositionLabel;

                let updatedUser;
                const storage = "postgresql";
                try {
                    updatedUser = await updateUserProfileInPostgres(currentUser, updates);
                } catch (dbError) {
                    if (dbError.code === "23505") return res.status(409).json({ success: false, error: "Email or username already in use" });
                    if (isPostgresConnectionError(dbError) || dbError.status === 503) return res.status(503).json({ success: false, error: "Canonical user storage unavailable" });
                    throw dbError;
                }

                if (!updatedUser) {
                    return res.status(404).json({
                        success: false,
                        error: "User not found for profile update"
                    });
                }

                const refreshedProfileState = mapUserProfileState(updatedUser);
                const refreshedToken = updates.passwordHash
                    ? await authRuntime.issue(updatedUser.id, 'pwd')
                    : await authRuntime.reissue(req.authPrincipal);

                return res.json({
                    success: true,
                    storage,
                    token: refreshedToken,
                    user: {
                        id: updatedUser.id,
                        username: updatedUser.username,
                        name: updatedUser.username,
                        email: updatedUser.email,
                        role: refreshedProfileState.positionLabel,
                        positionLabel: refreshedProfileState.positionLabel,
                        positionVerificationStatus: refreshedProfileState.positionVerificationStatus,
                        systemRole: refreshedProfileState.systemRole,
                        isAdmin: refreshedProfileState.systemRole === 'system_admin',
                        bimLevel: refreshedProfileState.competencyLevel,
                        competencyStatus: refreshedProfileState.competencyStatus,
                        targetBimLevel: refreshedProfileState.targetCompetencyLevel,
                        profileImage: normalizeProfileImageUrl(
                            updates.profileImage || updatedUser.profile_image || null
                        ),
                        profile_pic: normalizeProfileImageUrl(
                            updates.profileImage || updatedUser.profile_image || null
                        )
                    }
                });
            } catch (error) {
                console.error("❌ Update profile error:", error);
                return sendStorageError(error, res);
            }
        });
    });

    router.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        return sendStorageError(error, res);
    });
    return router;
}

module.exports = createUserAuthRoutes;
