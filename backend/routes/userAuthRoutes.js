const crypto = require("crypto");
const express = require("express");

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
                const jobRole = sanitizeOptionalText(req.body?.jobRole, 80) || "BIM Specialist";
                const organization = sanitizeOptionalText(req.body?.organization, 120) || "Google User";
                const usernameSeed = buildGoogleUsernameSeed(googleProfile);
                const generatedPasswordHash = await hashPassword(crypto.randomBytes(24).toString("hex"));

                if (!postgresLookupFailed) {
                    try {
                        const username = await findAvailableUsernameInPostgres(usernameSeed);
                        const insertResult = await pgPool.query(
                            `INSERT INTO users (
                                username, email, password, bim_level, job_role, organization,
                                registration_date, login_count, last_login, is_active, profile_image,
                                created_at, updated_at
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6,
                                $7, 0, NULL, true, $8,
                                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                            RETURNING id, username, email, bim_level, job_role, organization, profile_image, login_count, is_active`,
                            [
                                username,
                                email,
                                generatedPasswordHash,
                                bimLevel,
                                jobRole,
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
                            jobRole,
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

            const bimLevel = user.bimLevel || user.bim_level || normalizeBimLevelInput(req.body?.bimLevel);

            if (storageType === "postgresql" && user.id) {
                await ensureUserProgressInPostgres(user.id, bimLevel);
                await incrementUserLoginInPostgres(user.id);
            } else if (user.id) {
                incrementUserLoginInJson(user.id);
            }

            const role = user.jobRole || user.job_role || "BIM Specialist";
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role
                },
                secretKey,
                { expiresIn: "7d" }
            );

            const existingProfileImage = user.profileImage || user.profile_image || null;
            const finalProfileImage = existingProfileImage || googleProfile.picture || "/img/user-default.png";

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
                role,
                bimLevel,
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
                organization,
                registrationDate,
                progress
            } = req.body;

            if (!username || !email || !password || !bimLevel) {
                return res.status(400).json({
                    success: false,
                    error: "Username, email, password, and BIM level are required"
                });
            }

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
                        username, email, password, bim_level, job_role, organization,
                        registration_date, login_count, last_login, is_active,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6,
                        $7, 0, NULL, true,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    RETURNING id`,
                    [
                        username.trim(),
                        email.trim(),
                        hashedPassword,
                        bimLevel,
                        jobRole || null,
                        organization || null,
                        registrationDate || new Date().toISOString()
                    ]
                );

                userId = insertResult.rows[0].id;
                await ensureUserProgressInPostgres(userId, bimLevel);
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
                    bimLevel,
                    jobRole: jobRole || null,
                    organization: organization || null,
                    registrationDate: registrationDate || new Date().toISOString(),
                    lastLogin: null,
                    profileImage: null,
                    progress: progress || {
                        coursesCompleted: 0,
                        practiceAttempts: 0,
                        examsPassed: 0,
                        certificatesEarned: 0,
                        currentLevel: bimLevel,
                        levelProgress: {
                            toCoordinator: bimLevel === "BIM Modeller" ? 0 : null,
                            toManager: bimLevel === "BIM Coordinator" ? null : null
                        },
                        badges: [],
                        achievements: [],
                        learningPath: {
                            completed: [],
                            current: bimLevel === "BIM Modeller" ? "autocad-basics"
                                : bimLevel === "BIM Coordinator" ? "bim-coordination"
                                    : "bim-management",
                            available: bimLevel === "BIM Modeller"
                                ? ["autocad-basics", "revit-introduction", "sketchup-basics"]
                                : bimLevel === "BIM Coordinator"
                                    ? ["bim-coordination", "advanced-modeling"]
                                    : ["bim-management", "project-leadership"],
                            locked: bimLevel === "BIM Modeller"
                                ? ["bim-coordination", "advanced-modeling", "bim-management"]
                                : bimLevel === "BIM Coordinator"
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
                    bimLevel,
                    role: jobRole || "BIM Specialist"
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

            const bimLevel = user.bimLevel || user.bim_level || "BIM Modeller";

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
                    role: user.jobRole || user.job_role || "Student"
                },
                secretKey,
                { expiresIn: "7d" }
            );

            console.log(`✅ User logged in from ${storageType}: ${user.email || user.username} (ID: ${user.id})`);

            const loginCount = user.loginCount || user.login_count || 0;
            const storedProfileImage =
                (await fetchProfileImageFromPostgres(user.id, user.email)) ||
                user.profileImage ||
                user.profile_image ||
                null;

            res.json({
                success: true,
                token,
                id: user.id,
                username: user.username,
                name: user.username,
                email: user.email,
                role: user.jobRole || user.job_role || "BIM Specialist",
                bimLevel,
                organization: user.organization,
                loginCount: loginCount + 1,
                photo: storedProfileImage || "/img/user-default.png",
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

            if (!req.file) {
                return res.status(400).json({ error: "No image uploaded" });
            }

            const userId = req.user && req.user.userId ? req.user.userId : null;
            const email = req.user && req.user.email ? req.user.email : null;
            const imageUrl = `/uploads/profile-images/${req.file.filename}`;

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

            res.json({ success: true, imageUrl });
        });
    });

    router.post("/api/update-profile", (req, res) => {
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

                const refreshedToken = jwt.sign(
                    {
                        userId: updatedUser.id,
                        email: updatedUser.email,
                        role: updatedUser.job_role || "Student"
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
                        profileImage: updates.profileImage || updatedUser.profile_image || null,
                        profile_pic: updates.profileImage || updatedUser.profile_image || null
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
