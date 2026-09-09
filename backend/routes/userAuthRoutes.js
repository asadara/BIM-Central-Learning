const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
    ensureUserProfileColumns,
    mapUserProfileState,
    normalizeBimCompetencyLevel
} = require("../utils/userProfileSchema");

function createUserAuthRoutes({
    authLimiter,
    buildGoogleUsernameSeed,
    ensureUniqueProfileIdentity,
    ensureUserProgressInPostgres,
    fetchProfileImageFromPostgres,
    findAvailableUsernameInJson,
    findAvailableUsernameInPostgres,
    findUserForProfileUpdate,
    findUserInJsonByEmail,
    findUserInPostgresByEmail,
    googleClientId,
    hashPassword,
    incrementUserLoginInJson,
    incrementUserLoginInPostgres,
    isPostgresConnectionError,
    jwt,
    normalizeBimLevelInput,
    normalizeGoogleAction,
    normalizeUserRecord,
    pgPool,
    profileImageUpload,
    profileUpdateUpload,
    readUsers,
    requireAuth,
    sanitizeOptionalText,
    secretKey,
    updateProfileImageInJson,
    updateProfileImageInPostgres,
    updateUserProfileInJson,
    updateUserProfileInPostgres,
    verifyGoogleIdToken,
    verifyPassword,
    writeUsers
}) {
    const router = express.Router();
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
            const decoded = jwt.verify(token, secretKey);
            const lookup = await findUserForProfileUpdate(decoded.email || null, decoded.userId || null);
            return lookup && lookup.user ? lookup.user : null;
        } catch (error) {
            return null;
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

    router.get("/api/profile", requireAuth, async (req, res) => {
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
    });

    router.get("/api/profile/stats", requireAuth, async (req, res) => {
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
    });

    router.get("/api/profile/achievements", requireAuth, async (req, res) => {
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
    });

    router.get("/api/profile/activity", requireAuth, async (req, res) => {
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
    });

    router.get("/api/profile/courses", requireAuth, async (req, res) => {
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
    });

    router.get("/api/profile/social", requireAuth, async (req, res) => {
        return res.json({
            available: false,
            followers: null,
            following: null,
            discussions: null
        });
    });

    router.get("/api/auth/google/config", (req, res) => {
        res.json({
            success: true,
            enabled: !!googleClientId,
            clientId: googleClientId || null
        });
    });

    router.post("/api/auth/google", authLimiter, async (req, res) => {
        try {
            const action = normalizeGoogleAction(req.body?.action);
            const idToken = String(req.body?.idToken || "").trim();

            if (!googleClientId) {
                return res.status(503).json({
                    success: false,
                    error: "Google login belum dikonfigurasi di server."
                });
            }

            if (!idToken) {
                return res.status(400).json({
                    success: false,
                    error: "Google ID token is required"
                });
            }

            const googleProfile = await verifyGoogleIdToken(idToken);
            const email = googleProfile.email;

            let user = null;
            let storageType = "postgresql";
            let postgresLookupFailed = false;
            let createdUser = false;

            try {
                user = await findUserInPostgresByEmail(email, true);
            } catch (dbError) {
                postgresLookupFailed = isPostgresConnectionError(dbError);
                console.warn(
                    postgresLookupFailed
                        ? "⚠️ PostgreSQL unavailable for Google auth, falling back to JSON:"
                        : "⚠️ PostgreSQL lookup failed for Google auth:",
                    dbError.message
                );

                if (!postgresLookupFailed) {
                    throw dbError;
                }
            }

            if (!user) {
                const jsonUser = findUserInJsonByEmail(email, true, false);
                if (jsonUser) {
                    user = jsonUser;
                    storageType = "json";
                }
            }

            if (!user) {
                const bimLevel = normalizeBimLevelInput(req.body?.bimLevel);
                const positionLabel = sanitizeOptionalText(req.body?.positionLabel || req.body?.jobRole, 80);
                const organization = sanitizeOptionalText(req.body?.organization, 120) || null;
                const usernameSeed = buildGoogleUsernameSeed(googleProfile);
                const generatedPasswordHash = await hashPassword(crypto.randomBytes(24).toString("hex"));

                if (!postgresLookupFailed) {
                    try {
                        const username = await findAvailableUsernameInPostgres(usernameSeed);
                        const insertResult = await pgPool.query(
                            `INSERT INTO users (
                                username, email, password, bim_level, job_role, position_label,
                                position_verification_status, competency_status, system_role, organization,
                                registration_date, login_count, last_login, is_active, profile_image,
                                created_at, updated_at
                            ) VALUES (
                                $1, $2, $3, $4, $5, $5,
                                'unverified', $6, 'employee', $7,
                                $8, 0, NULL, true, $9,
                                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                            RETURNING id, username, email, bim_level, job_role, position_label,
                                      position_verification_status, competency_status, system_role,
                                      organization, profile_image, login_count, is_active`,
                            [
                                username,
                                email,
                                generatedPasswordHash,
                                bimLevel,
                                positionLabel || null,
                                bimLevel ? 'self_declared' : 'not_assessed',
                                organization,
                                new Date().toISOString(),
                                googleProfile.picture || null
                            ]
                        );

                        user = normalizeUserRecord(insertResult.rows[0]);
                        storageType = "postgresql";
                        createdUser = true;
                        console.log(`✅ Google user registered in PostgreSQL: ${email} (ID: ${user.id})`);
                    } catch (dbInsertError) {
                        if (dbInsertError && dbInsertError.code === "23505") {
                            user = await findUserInPostgresByEmail(email, true);
                            if (user) {
                                storageType = "postgresql";
                            } else {
                                return res.status(409).json({
                                    success: false,
                                    error: "Email already registered"
                                });
                            }
                        } else if (isPostgresConnectionError(dbInsertError)) {
                            postgresLookupFailed = true;
                            storageType = "json";
                            console.warn("⚠️ PostgreSQL insert failed for Google auth, fallback to JSON:", dbInsertError.message);
                        } else {
                            throw dbInsertError;
                        }
                    }
                }

                if (!user) {
                    const users = readUsers();
                    const existingByEmail = users.find((item) => String(item.email || "").toLowerCase() === email);

                    if (existingByEmail) {
                        user = normalizeUserRecord(existingByEmail);
                        storageType = "json";
                    } else {
                        const username = findAvailableUsernameInJson(usernameSeed);
                        const newUser = {
                            id: `json_google_${Date.now()}`,
                            username,
                            email,
                            password: generatedPasswordHash,
                            bimLevel,
                            jobRole: positionLabel || null,
                            positionLabel: positionLabel || null,
                            positionVerificationStatus: "unverified",
                            competencyStatus: bimLevel ? "self_declared" : "not_assessed",
                            systemRole: "employee",
                            organization,
                            registrationDate: new Date().toISOString(),
                            lastLogin: null,
                            loginCount: 0,
                            isActive: true,
                            profileImage: googleProfile.picture || null,
                            metadata: {
                                provider: "google",
                                googleSub: googleProfile.sub || null
                            }
                        };

                        users.push(newUser);
                        writeUsers(users);
                        user = normalizeUserRecord(newUser);
                        storageType = "json";
                        createdUser = true;
                        console.log(`✅ Google user registered in JSON fallback: ${email} (ID: ${user.id})`);
                    }
                }
            }

            if (!user) {
                return res.status(500).json({
                    success: false,
                    error: "Failed to resolve user account"
                });
            }

            const userProfileState = mapUserProfileState(user);
            const bimLevel = userProfileState.competencyLevel || normalizeBimLevelInput(req.body?.bimLevel);

            if (storageType === "postgresql" && user.id) {
                await ensureUserProgressInPostgres(user.id, bimLevel);
                await incrementUserLoginInPostgres(user.id);
            } else if (user.id) {
                incrementUserLoginInJson(user.id);
            }

            const systemRole = userProfileState.systemRole || "employee";
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role: systemRole
                },
                secretKey,
                { expiresIn: "7d" }
            );

            const existingProfileImage = user.profileImage || user.profile_image || null;
            const finalProfileImage = normalizeProfileImageUrl(
                existingProfileImage || googleProfile.picture || "/img/user-default.svg"
            );

            if (!existingProfileImage && googleProfile.picture) {
                if (storageType === "postgresql") {
                    await updateProfileImageInPostgres(user.id, user.email, googleProfile.picture);
                } else {
                    updateProfileImageInJson(user.id, user.email, googleProfile.picture);
                }
            }

            return res.json({
                success: true,
                token,
                id: user.id,
                name: user.username,
                username: user.username,
                email: user.email,
                role: userProfileState.positionLabel,
                positionLabel: userProfileState.positionLabel,
                positionVerificationStatus: userProfileState.positionVerificationStatus,
                systemRole,
                isAdmin: systemRole === 'system_admin',
                bimLevel,
                competencyStatus: userProfileState.competencyStatus,
                targetBimLevel: userProfileState.targetCompetencyLevel,
                organization: user.organization || sanitizeOptionalText(req.body?.organization, 120) || null,
                photo: finalProfileImage,
                profileImage: finalProfileImage,
                createdUser,
                storage: storageType,
                message: action === "signup" && createdUser
                    ? "Akun Google berhasil dibuat dan login."
                    : "Login dengan Google berhasil."
            });
        } catch (error) {
            const message = String(error.message || "");
            if (message === "GOOGLE_CLIENT_ID_NOT_CONFIGURED") {
                return res.status(503).json({
                    success: false,
                    error: "Google login belum dikonfigurasi di server."
                });
            }

            if (message.startsWith("GOOGLE_")) {
                return res.status(401).json({
                    success: false,
                    error: "Token Google tidak valid atau akun belum terverifikasi."
                });
            }

            console.error("❌ Google auth error:", error);
            return res.status(500).json({
                success: false,
                error: "Google authentication failed. Please try again."
            });
        }
    });

    router.post("/api/signup", async (req, res) => {
        try {
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

            if (!username || !email || !password) {
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

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: "Password must be at least 6 characters long"
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
                        $1, $2, $3, $4, $5, $5,
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

                console.warn("⚠️ PostgreSQL unavailable, falling back to JSON storage:", dbError.message);
                storageType = "json";

                const users = readUsers();
                const existingUser = users.find((u) =>
                    String(u.email || "").toLowerCase() === String(email).toLowerCase() ||
                    String(u.username || "").toLowerCase() === String(username).toLowerCase()
                );

                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        error: "Email or username already registered"
                    });
                }

                userId = `json_${Date.now()}`;
                const newUser = {
                    id: userId,
                    username: username.trim(),
                    email: email.trim(),
                    password: hashedPassword,
                    bimLevel: normalizedBimLevel,
                    jobRole: normalizedPositionLabel || null,
                    positionLabel: normalizedPositionLabel || null,
                    positionVerificationStatus: 'unverified',
                    competencyStatus: normalizedBimLevel ? 'self_declared' : 'not_assessed',
                    systemRole: 'employee',
                    organization: organization || null,
                    registrationDate: registrationDate || new Date().toISOString(),
                    lastLogin: null,
                    profileImage: null,
                    progress: progress || {
                        coursesCompleted: 0,
                        practiceAttempts: 0,
                        examsPassed: 0,
                        certificatesEarned: 0,
                        currentLevel: normalizedBimLevel,
                        levelProgress: {
                            toCoordinator: normalizedBimLevel === "BIM Modeller" ? 0 : null,
                            toManager: normalizedBimLevel === "BIM Coordinator" ? null : null
                        },
                        badges: [],
                        achievements: [],
                        learningPath: {
                            completed: [],
                            current: normalizedBimLevel === "BIM Modeller" ? "autocad-basics"
                                : normalizedBimLevel === "BIM Coordinator" ? "bim-coordination"
                                    : null,
                            available: normalizedBimLevel === "BIM Modeller"
                                ? ["autocad-basics", "revit-introduction", "sketchup-basics"]
                                : normalizedBimLevel === "BIM Coordinator"
                                    ? ["bim-coordination", "advanced-modeling"]
                                    : [],
                            locked: normalizedBimLevel === "BIM Modeller"
                                ? ["bim-coordination", "advanced-modeling", "bim-management"]
                                : normalizedBimLevel === "BIM Coordinator"
                                    ? ["bim-management"]
                                    : []
                        }
                    },
                    preferences: {
                        notifications: true,
                        theme: "light",
                        language: "id"
                    }
                };

                users.push(newUser);
                writeUsers(users);
                console.log(`✅ User registered in JSON fallback: ${email} (ID: ${userId})`);
            }

            res.status(201).json({
                success: true,
                message: storageType === "postgresql"
                    ? "Account created successfully!"
                    : "Account created successfully (using local storage)!",
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

    router.post("/api/login", authLimiter, async (req, res) => {
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

            const isValidPassword = await verifyPassword(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    error: "Invalid email or password"
                });
            }

            const userProfileState = mapUserProfileState(user);
            const bimLevel = userProfileState.competencyLevel;

            if (storageType === "postgresql") {
                await ensureUserProgressInPostgres(user.id, bimLevel);
                await incrementUserLoginInPostgres(user.id);
            } else if (user.id) {
                incrementUserLoginInJson(user.id);
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role: userProfileState.systemRole || "employee"
                },
                secretKey,
                { expiresIn: "7d" }
            );

            console.log(`✅ User logged in from ${storageType}: ${user.email || user.username} (ID: ${user.id})`);

            const loginCount = user.loginCount || user.login_count || 0;
            const storedProfileImage = normalizeProfileImageUrl(
                (await fetchProfileImageFromPostgres(user.id, user.email)) ||
                user.profileImage ||
                user.profile_image ||
                null
            );

            res.json({
                success: true,
                token,
                id: user.id,
                username: user.username,
                name: user.username,
                email: user.email,
                role: userProfileState.positionLabel,
                positionLabel: userProfileState.positionLabel,
                positionVerificationStatus: userProfileState.positionVerificationStatus,
                systemRole: userProfileState.systemRole,
                isAdmin: userProfileState.systemRole === 'system_admin',
                bimLevel,
                competencyStatus: userProfileState.competencyStatus,
                targetBimLevel: userProfileState.targetCompetencyLevel,
                organization: user.organization,
                loginCount: loginCount + 1,
                photo: storedProfileImage || "/img/user-default.svg",
                profileImage: storedProfileImage || null
            });
        } catch (error) {
            console.error("❌ Login error:", error);
            res.status(500).json({
                success: false,
                error: "Login failed. Please try again."
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

            const userId = req.user && req.user.userId ? req.user.userId : null;
            const email = req.user && req.user.email ? req.user.email : null;
            const imageUrl = `/uploads/profile-images/${uploadedImage.filename}`;

            let saved = false;
            if (userId || email) {
                saved = await updateProfileImageInPostgres(userId, email, imageUrl);
                if (!saved) {
                    saved = updateProfileImageInJson(userId, email, imageUrl);
                }
            }

            if (!saved) {
                return res.status(404).json({ error: "User not found for profile update" });
            }

            res.json({
                success: true,
                imageUrl: normalizeProfileImageUrl(imageUrl),
                storedPath: imageUrl
            });
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
                        authUser = jwt.verify(bearerToken, secretKey);
                    } catch (tokenError) {
                        return res.status(403).json({ success: false, error: "Invalid or expired token" });
                    }
                }

                const requestedEmail = sanitizeOptionalText(req.body?.email, 120).toLowerCase();
                const currentEmail = sanitizeOptionalText(
                    req.body?.current_email || req.body?.email,
                    120
                ).toLowerCase();
                const requestedUsername = sanitizeOptionalText(
                    req.body?.name || req.body?.username,
                    80
                );
                const hasPositionUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, "positionLabel") ||
                    Object.prototype.hasOwnProperty.call(req.body || {}, "position_label");
                const requestedPositionLabel = hasPositionUpdate
                    ? sanitizeOptionalText(req.body?.positionLabel || req.body?.position_label, 100)
                    : null;
                const oldPassword = String(req.body?.old_pass || req.body?.oldPassword || "").trim();
                const newPassword = String(req.body?.new_pass || req.body?.newPassword || "").trim();
                const confirmPassword = String(req.body?.c_pass || req.body?.confirmPassword || "").trim();

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

                if (newPassword && newPassword.length < 6) {
                    return res.status(400).json({
                        success: false,
                        error: "Password must be at least 6 characters long"
                    });
                }

                if (newPassword && confirmPassword && newPassword !== confirmPassword) {
                    return res.status(400).json({
                        success: false,
                        error: "Password confirmation does not match"
                    });
                }

                const lookupEmail = authUser?.email || currentEmail || requestedEmail;
                const lookupUserId = authUser?.userId || null;
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

                let updatedUser = null;
                let storage = "postgresql";

                if (pgPool) {
                    try {
                        updatedUser = await updateUserProfileInPostgres(currentUser, updates);
                    } catch (dbError) {
                        if (dbError && dbError.code === "23505") {
                            return res.status(409).json({
                                success: false,
                                error: "Email or username already in use"
                            });
                        }

                        if (!isPostgresConnectionError(dbError)) {
                            throw dbError;
                        }

                        console.warn("⚠️ PostgreSQL unavailable during profile update, falling back to JSON:", dbError.message);
                        storage = "json";
                    }
                } else {
                    storage = "json";
                }

                if (!updatedUser) {
                    updatedUser = updateUserProfileInJson(currentUser, updates);
                    storage = "json";
                }

                if (!updatedUser) {
                    return res.status(404).json({
                        success: false,
                        error: "User not found for profile update"
                    });
                }

                const refreshedProfileState = mapUserProfileState(updatedUser);
                const refreshedToken = jwt.sign(
                    {
                        userId: updatedUser.id,
                        email: updatedUser.email,
                        role: refreshedProfileState.systemRole || "employee"
                    },
                    secretKey,
                    { expiresIn: "7d" }
                );

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
                return res.status(500).json({
                    success: false,
                    error: "Failed to update profile"
                });
            }
        });
    });

    return router;
}

module.exports = createUserAuthRoutes;
