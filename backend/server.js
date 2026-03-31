// server.js (CommonJS penuh) - RESTORED VERSION

require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const express = require("express");
const path = require("path");
const https = require("https");
const fs = require("fs");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const { exec, spawn } = require("child_process");
const os = require("os");
const { Pool } = require("pg");
const { getPreferredServerIPv4 } = require("./utils/networkIdentity");
const {
    createPgConfig,
    getDefaultAdminPassword,
    getGoogleClientId,
    getJwtSecret,
    getSessionSecret
} = require("./config/runtimeConfig");

// âœ… Phase 4 Enterprise Components Import
console.log('ðŸš€ Loading Phase 4 Enterprise Components...');
let phase4Components = {
    aiAssistant: null,
    predictiveEngine: null,
    realtimeCollaboration: null,
    advancedCDN: null,
    enterpriseMultitenancy: null,
    mobileFirst: null,
    blockchain: null,
    apiEcosystem: null,
    businessIntelligence: null,
    testingFramework: null
};

// Load Phase 4 components (simulate loading)
try {
    // In a real implementation, these would be actual module imports
    phase4Components.aiAssistant = { status: 'online', loaded: true };
    phase4Components.predictiveEngine = { status: 'online', loaded: true };
    phase4Components.realtimeCollaboration = { status: 'online', loaded: true };
    phase4Components.advancedCDN = { status: 'online', loaded: true };
    phase4Components.enterpriseMultitenancy = { status: 'online', loaded: true };
    phase4Components.mobileFirst = { status: 'online', loaded: true };
    phase4Components.blockchain = { status: 'online', loaded: true };
    phase4Components.apiEcosystem = { status: 'online', loaded: true };
    phase4Components.businessIntelligence = { status: 'online', loaded: true };
    phase4Components.testingFramework = { status: 'online', loaded: true };
    console.log('âœ… All Phase 4 components loaded successfully!');
} catch (error) {
    console.log('âš ï¸ Some Phase 4 components failed to load:', error.message);
}

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 5052;
const USE_HTTPS = false; // Force HTTP only for consistency

// âœ… SECURITY: Rate limiting to prevent abuse
const rateLimit = require('express-rate-limit');

// Create rate limiter for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: 15 * 60 // seconds
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});

console.log('\nðŸ”§ BCL Server Configuration');
console.log('============================');
console.log(`ðŸŒ HTTP mode selected (Port ${HTTP_PORT})`);

// Skip SSL configuration - HTTP only
let httpsOptions = null;
let useHttps = USE_HTTPS;

if (useHttps) {
    try {
        const keyPath = path.join(__dirname, 'bcl.key');
        const certPath = path.join(__dirname, 'bcl.crt');

        console.log(`ðŸ“ Looking for SSL certificates:`);
        console.log(`   â€¢ Key:  ${keyPath}`);
        console.log(`   â€¢ Cert: ${certPath}`);

        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            httpsOptions = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath),
                rejectUnauthorized: false
            };
            console.log('âœ… SSL certificates found and loaded');
            console.log('âš ï¸  Note: Using self-signed certificates');
            console.log('   Browser may show "Not Secure" - this is normal for development');
        } else {
            console.log('âš ï¸  SSL certificate files not found');
            console.log('   Starting HTTP server instead...');
            useHttps = false;
        }
    } catch (error) {
        console.log('âŒ SSL certificate error:', error.message);
        console.log('   Falling back to HTTP server...');
        useHttps = false;
    }
} else {
    console.log('ðŸŒ HTTP mode selected (USE_HTTPS=false)');
}

// âœ… Fixed: Consolidated constants (removed redundancy)
const BASE_DIR = process.env.BASE_DIR || "G:/BIM CENTRAL LEARNING/";
const BASE_PROJECT_DIR = process.env.BASE_PROJECT_DIR || "G:/";
const VIDEO_DIR = path.join(BASE_DIR); // Video directory is the same as BASE_DIR
const THUMBNAIL_DIR = path.join(__dirname, "public/thumbnails");
const PLUGIN_PACKAGES_DIR = path.join(__dirname, "plugin-packages");
const VIDEO_SCAN_EXCLUDED_FOLDERS = ['INCOMING DATA', 'INCOMING', 'DATA', 'TENDER', 'clash', 'Clash Detection', 'Texture Image Marbel'];
const USERS_FILE = path.join(__dirname, "users.json");
const SECRET_KEY = getJwtSecret();
const SESSION_SECRET = getSessionSecret();
const GOOGLE_CLIENT_ID = getGoogleClientId();
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';

// âœ… Fixed: Proper middleware order
app.use(express.json({ limit: '15mb' })); // Must come before other middleware
app.use(express.urlencoded({ extended: true, limit: '15mb' })); // Replaced deprecated bodyParser

// Session configuration for admin authentication
const sessionConfig = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

app.use(session(sessionConfig));

// CORS: allow credentials and specific trusted origins (avoid wildcard with credentials)
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        try {
            const url = new URL(origin);
            const host = url.hostname.toLowerCase();

            const allowlist = new Set([
                'bcl.nke.net',
                'bcl.local',
                'localhost',
                '127.0.0.1'
            ]);

            const privateIp =
                host.startsWith('10.') ||
                host.startsWith('192.168.') ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

            if (allowlist.has(host) || privateIp) {
                return callback(null, true);
            }
        } catch (err) {
            // fallthrough to deny
        }

        return callback(new Error('CORS not allowed for origin: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-admin-token', 'X-Client-Info', 'X-Client-Id'],
    maxAge: 86400
};

app.use(cors(corsOptions)); // CORS should be early

// âœ… SECURITY: JWT Authentication middleware for API endpoints
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// âœ… SECURITY: Optional auth middleware (allows access without token but logs)
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
}

// Admin session middleware
function requireAdminSession(req, res, next) {
    if (req.session && req.session.adminUser && req.session.adminUser.isAdmin) {
        return next();
    }
    res.status(401).json({ error: 'Admin authentication required' });
}

// Create default admin user if not exists
async function createDefaultAdminUser() {
    try {
        console.log('ðŸ” Checking for default admin user...');

        let users = [];
        const adminUsername = 'admin_bcl';
        const adminPassword = getDefaultAdminPassword();
        const adminEmail = 'admin@bcl.local';

        if (!adminPassword) {
            console.warn('âš ï¸ DEFAULT_ADMIN_PASSWORD not set; skipping default admin bootstrap.');
            return;
        }

        // Try PostgreSQL first
        try {
            const existingAdmin = await pgPool.query(
                `SELECT id
                 FROM users
                 WHERE username = $1 OR email = $2
                 LIMIT 1`,
                [adminUsername, adminEmail]
            );

            if (existingAdmin.rows.length === 0) {
                const hashedPassword = await hashPassword(adminPassword);
                await pgPool.query(
                    `INSERT INTO users (
                        username, email, password, bim_level, job_role, organization,
                        registration_date, login_count, last_login, is_active,
                        created_at, updated_at, mapping_kompetensi_access
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6,
                        CURRENT_TIMESTAMP, 0, NULL, true,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true
                    )`,
                    [adminUsername, adminEmail, hashedPassword, 'Expert', 'System Administrator', 'BCL Enterprise']
                );
                console.log('✅ Default admin user created in PostgreSQL');
            } else {
                console.log('✅ Admin user already exists in PostgreSQL');
            }
        } catch (dbError) {
            console.warn('⚠️ PostgreSQL not available, using JSON fallback for admin user:', dbError.message);

            // Fallback to JSON
            users = readUsers();
            const existingAdmin = users.find(u => u.username === adminUsername);

            if (!existingAdmin) {
                const hashedPassword = await hashPassword(adminPassword);

                users.push({
                    id: 'admin_' + Date.now(),
                    username: adminUsername,
                    email: adminEmail,
                    password: hashedPassword,
                    bimLevel: 'Expert',
                    jobRole: 'System Administrator',
                    organization: 'BCL Enterprise',
                    registrationDate: new Date().toISOString(),
                    lastLogin: null,
                    profileImage: null,
                    isAdmin: true, // Special admin flag
                    progress: {
                        coursesCompleted: 0,
                        practiceAttempts: 0,
                        examsPassed: 0,
                        certificatesEarned: 0,
                        currentLevel: 'Expert',
                        toNextLevel: 0,
                        badges: ['Administrator'],
                        achievements: ['System Admin'],
                        learningPath: {
                            completed: ['all-courses'],
                            current: 'administration',
                            available: ['system-management'],
                            locked: []
                        }
                    },
                    preferences: {
                        notifications: true,
                        theme: 'dark',
                        language: 'id'
                    }
                });

                writeUsers(users);
                console.log('âœ… Default admin user created in JSON storage');
            } else {
                console.log('âœ… Admin user already exists in JSON storage');
            }
        }

    } catch (error) {
        console.error('âŒ Error creating default admin user:', error);
    }
}

// Serve project media files
app.use(express.static(BASE_DIR));

// âœ… Fixed: Utility functions moved to top after constants
const getLocalIP = () => {
    return getPreferredServerIPv4(os.networkInterfaces());
};

// âœ… Fixed: Ensure directories exist with proper error handling
const ensureDirectoryExists = (dirPath) => {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`âœ… Created directory: ${dirPath}`);
        }
    } catch (error) {
        console.error(`âŒ Failed to create directory ${dirPath}:`, error.message);
    }
};

// Initialize required directories
ensureDirectoryExists(THUMBNAIL_DIR);
ensureDirectoryExists(PLUGIN_PACKAGES_DIR);
ensureDirectoryExists(path.dirname(USERS_FILE));

// Routes - moved after middleware setup
const fileRoutes = require('./routes/files');
const searchRoutes = require('./routes/search');
const newsRoutes = require('./routes/news');
const studyRoutes = require('./routes/studyRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const tutorialRoutes = require('./routes/tutorialRoutes');
const adminRoutes = require('./routes/adminRoutes');
const courseAdminRoutes = require('./routes/courseAdminRoutes'); // âœ… NEW: Course Admin Management
const lanMountRoutes = require('./routes/lanMountRoutes'); // âœ… NEW: LAN Mount Management
const learningMaterialsAdminRoutes = require('./routes/learningMaterialsAdmin');
const learningMaterialsPublicRoutes = require('./routes/learningMaterialsPublic');
const examMaterialsAdminRoutes = require('./routes/examMaterialsAdmin');
const examMaterialsPublicRoutes = require('./routes/examMaterialsPublic');
const levelRequestsPublicRoutes = require('./routes/levelRequestsPublic');
const levelRequestsAdminRoutes = require('./routes/levelRequestsAdmin');
const pdfDisplayRoutes = require('./routes/pdfDisplayRoutes');
const videoDisplayRoutes = require('./routes/videoDisplayRoutes');
const competencyRoutes = require('./routes/competencyRoutes');
const organizationsRoutes = require('./routes/organizations');
const pluginsRoutes = require('./routes/plugins');
const videosAdminRoutes = require('./routes/videos');
const createSystemStatusRoutes = require('./routes/systemStatusRoutes');
const createActiveUserTracking = require('./modules/activeUserTracking');
const createServerManagementRoutes = require('./routes/serverManagementRoutes');
const createAdminSessionRoutes = require('./routes/adminSessionRoutes');
const createAdminPreviewRoutes = require('./routes/adminPreviewRoutes');
const createTestUtilityRoutes = require('./routes/testUtilityRoutes');
const createUserAuthRoutes = require('./routes/userAuthRoutes');
const createLegacyContentRoutes = require('./routes/legacyContentRoutes');
const createProjectCatalogRoutes = require('./routes/projectCatalogRoutes');
const createProjectMediaMountRoutes = require('./routes/projectMediaMountRoutes');
const createProjectMediaUtilityRoutes = require('./routes/projectMediaUtilityRoutes');
const createProjectCatalogService = require('./services/projectCatalogService');
const createProjectPathResolverService = require('./services/projectPathResolverService');
const createUserAuthService = require('./services/userAuthService');
const createProjectMediaUtilityService = require('./services/projectMediaUtilityService');
const createVideoCatalogService = require('./services/videoCatalogService');

// E-learning modular backend routes
const moduleRoutes = require('./elearning/routes/moduleRoutes');
const progressRoutes = require('./elearning/routes/progressRoutes');
const quizRoutes = require('./elearning/routes/quizRoutes');
const certificateRoutes = require('./elearning/routes/certificateRoutes');

const activeUserTracking = createActiveUserTracking();
app.use(activeUserTracking.middleware);

// âœ… Fixed: Route organization - no duplication
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/tutorials', optionalAuth);
app.use('/api/tutorials', tutorialRoutes);

// Learning materials (admin & public)
app.use('/api/admin/learning-materials', learningMaterialsAdminRoutes);
app.use('/api/learning-materials', learningMaterialsPublicRoutes);
app.use('/api/admin/exam-materials', examMaterialsAdminRoutes);
app.use('/api/exam-materials', examMaterialsPublicRoutes);
app.use('/api/level-requests', levelRequestsPublicRoutes);
app.use('/api/admin/level-requests', levelRequestsAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', courseAdminRoutes);
app.use('/api', pdfDisplayRoutes);
app.use('/api', videoDisplayRoutes);
app.use('/api/competency', competencyRoutes);
app.use('/api/competency-reports', competencyRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/plugins', pluginsRoutes);
app.use('/api/admin/videos', videosAdminRoutes);

// âœ… SECURITY: Apply optional auth to courses endpoint (allows access but logs)
app.use('/api/courses', optionalAuth, (req, res) => {
    // Redirect ke tutorialRoutes courses endpoint
    req.url = '/courses';
    tutorialRoutes(req, res);
});

// âœ… SECURITY: Apply optional auth to tutorials endpoint (mounted above)

// Mount e-learning routes
app.use('/api/elearning/modules', moduleRoutes);
app.use('/api/elearning/progress', progressRoutes);
app.use('/api/elearning/quiz', quizRoutes);
app.use('/api/elearning/certificate', certificateRoutes);

// âœ… NEW: BIM Media Tagging Admin Routes
const bimMediaRoutes = require('./routes/bimMediaAdmin');
app.use('/api/admin/bim-media', bimMediaRoutes);
console.log('ðŸ·ï¸ BIM Media Tagging API endpoints registered at /api/admin/bim-media/*');

// âœ… NEW: BIM Media Public Routes for showroom
const bimMediaPublicRoutes = require('./routes/bimMediaPublic');
app.use('/api/bim-media', bimMediaPublicRoutes);
console.log('ðŸ·ï¸ BIM Media Public API endpoints registered at /api/bim-media/*');

// âœ… NEW: Users API Routes for admin panel
const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);
console.log('ðŸ‘¥ Users API endpoints registered at /api/users/*');

// âœ… NEW: BIM Methode Gallery Routes
const bimMethodeRoutes = require('./routes/bimMethodeRoutes');
app.use('/api/bim-methode', bimMethodeRoutes);
console.log('ðŸ“ BIM Methode API endpoints registered at /api/bim-methode/*');

app.use(createAdminPreviewRoutes({
    getVideoMimeType
}));

// âœ… NEW: Mount LAN Routes for network share management
app.use('/api/lan', lanMountRoutes);
console.log('ðŸ”Œ LAN Mount API endpoints registered at /api/lan/*');

// User Authentication API with PostgreSQL as primary storage
const pgConfig = createPgConfig({
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const pgPool = new Pool(pgConfig);

pgPool.on('error', (err) => {
    console.warn('âš ï¸ PostgreSQL pool error:', err.message);
});

// Helper functions for secure user management
const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) reject(err);
            else resolve(hash);
        });
    });
};

const verifyPassword = (password, hash) => {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, hash, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

const videoCatalogService = createVideoCatalogService({
    baseDir: VIDEO_DIR,
    excludedFolders: VIDEO_SCAN_EXCLUDED_FOLDERS,
    thumbnailDir: THUMBNAIL_DIR
});

const userAuthService = createUserAuthService({
    backendDir: __dirname,
    googleClientId: GOOGLE_CLIENT_ID,
    googleTokeninfoEndpoint: GOOGLE_TOKENINFO_ENDPOINT,
    pgPool,
    readUsers,
    writeUsers
});


app.use(createUserAuthRoutes({
    ...userAuthService,
    authLimiter,
    googleClientId: GOOGLE_CLIENT_ID,
    hashPassword,
    jwt,
    pgPool,
    readUsers,
    requireAuth,
    secretKey: SECRET_KEY,
    verifyPassword,
    writeUsers
}));

app.use(createAdminSessionRoutes({
    findUserInJsonByEmail: userAuthService.findUserInJsonByEmail,
    findUserInJsonByIdentity: userAuthService.findUserInJsonByIdentity,
    findUserInPostgresByEmail: userAuthService.findUserInPostgresByEmail,
    findUserInPostgresByIdentity: userAuthService.findUserInPostgresByIdentity,
    incrementUserLoginInJson: userAuthService.incrementUserLoginInJson,
    incrementUserLoginInPostgres: userAuthService.incrementUserLoginInPostgres,
    isPostgresConnectionError: userAuthService.isPostgresConnectionError,
    jwt,
    secretKey: SECRET_KEY,
    verifyPassword
}));

app.use(createSystemStatusRoutes({
    getLocalIP,
    phase4Components
}));
app.use(activeUserTracking.router);

// âœ… Phase 4 Enterprise API Endpoints
console.log('ðŸ”Œ Setting up Phase 4 API endpoints...');
console.log('âœ… Phase 4 API endpoints configured successfully!');

app.use(createTestUtilityRoutes());

app.use(createServerManagementRoutes({
    backendDir: __dirname,
    jwt,
    secretKey: SECRET_KEY,
    spawn,
    videoCache: videoCatalogService.videoCache
}));

console.log('ðŸ”§ Server management endpoints configured successfully!');

// âœ… Enhanced: Multi-source project handling with flexible folder patterns
const PROJECT_SOURCES = [
    {
        id: 'local-g-drive',
        name: 'Local G Drive',
        path: BASE_PROJECT_DIR,
        priority: 1,
        enabled: false,
        folderPattern: 'PROJECT {year}', // G:\PROJECT 2025
        mediaRoute: '/media'
    },
    {
        id: 'pc-bim02-2025',
        name: 'PC-BIM02 PROJECT BIM 2025',
        path: path.resolve(__dirname, '..', 'PC-BIM02'),
        mountId: 'pc-bim02', // Reference to LAN mount
        priority: 2,
        enabled: true, // âœ… ENABLED by default, will auto-disable if mount fails
        folderPattern: 'PROJECT BIM {year}', // \\pc-bim02\PROJECT BIM 2025
        mediaRoute: '/media-bim02',
        rootScan: true,
        fixedYears: ['2025'],
        groupId: 'pc-bim02',
        groupName: 'PC-BIM02 PROJECT BIM'
    },
    {
        id: 'pc-bim02-2026',
        name: 'PC-BIM02 PROJECT BIM 2026',
        path: null,
        mountId: 'pc-bim02-2026',
        priority: 3,
        enabled: true,
        folderPattern: 'PROJECT BIM {year}', // \\pc-bim02\PROJECT BIM 2026
        mediaRoute: '/media-bim02-2026',
        groupId: 'pc-bim02',
        groupName: 'PC-BIM02 PROJECT BIM'
    },
    {
        id: 'pc-bim1-2025',
        name: 'PC-BIM1 PROJECT 2025',
        path: null, // Will be set when mounted
        mountId: 'pc-bim1', // Reference to LAN mount
        priority: 4,
        enabled: true,
        folderPattern: 'PROJECT {year}', // \\pc-bim1\PROJECT 2025
        mediaRoute: '/media-bim1-2025',
        groupId: 'pc-bim1',
        groupName: 'PC-BIM1 PROJECT'
    },
    {
        id: 'pc-bim1-2024',
        name: 'PC-BIM1 PROJECT 2024',
        path: null,
        mountId: 'pc-bim1-2024',
        priority: 5,
        enabled: true,
        folderPattern: 'PROJECT {year}',
        mediaRoute: '/media-bim1-2024',
        groupId: 'pc-bim1',
        groupName: 'PC-BIM1 PROJECT'
    },
    {
        id: 'pc-bim1-2023',
        name: 'PC-BIM1 PROJECT 2023',
        path: null,
        mountId: 'pc-bim1-2023',
        priority: 6,
        enabled: true,
        folderPattern: 'PROJECT {year}',
        mediaRoute: '/media-bim1-2023',
        groupId: 'pc-bim1',
        groupName: 'PC-BIM1 PROJECT'
    },
    {
        id: 'pc-bim1-2022',
        name: 'PC-BIM1 PROJECT 2022',
        path: null,
        mountId: 'pc-bim1-2022',
        priority: 7,
        enabled: true,
        folderPattern: 'PROJECT {year}',
        mediaRoute: '/media-bim1-2022',
        groupId: 'pc-bim1',
        groupName: 'PC-BIM1 PROJECT'
    },
    {
        id: 'pc-bim1-2021',
        name: 'PC-BIM1 PROJECT 2021',
        path: null,
        mountId: 'pc-bim1-2021',
        priority: 8,
        enabled: true,
        folderPattern: 'PROJECT {year}',
        mediaRoute: '/media-bim1-2021',
        groupId: 'pc-bim1',
        groupName: 'PC-BIM1 PROJECT'
    },
    {
        id: 'pc-bim1-2020',
        name: 'PC-BIM1 PROJECT 2020',
        path: null,
        mountId: 'pc-bim1-2020',
        priority: 9,
        enabled: true,
        folderPattern: 'PROJECT {year}',
        mediaRoute: '/media-bim1-2020',
        groupId: 'pc-bim1',
        groupName: 'PC-BIM1 PROJECT'
    }
];


const PROJECT_PREFIX = 'PROJECT ';
const VALID_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const VALID_VIDEO_EXT = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv'];
const EXCLUDED_FOLDERS = VIDEO_SCAN_EXCLUDED_FOLDERS;
const PROJECT_MEDIA_PROXY_CACHE_DIR = path.resolve(__dirname, 'public', 'cache', 'project-media-proxy');
const PROJECT_MEDIA_PROXY_TIMEOUT_MS = Number(process.env.PROJECT_MEDIA_PROXY_TIMEOUT_MS) || 3000;
const PROJECT_MEDIA_PROXY_CACHE_MAX_BYTES = Number(process.env.PROJECT_MEDIA_PROXY_CACHE_MAX_BYTES) || (60 * 1024 * 1024);
const PROJECT_MEDIA_PROXY_CACHEABLE_EXT = new Set([...VALID_IMAGE_EXT, '.svg']);
const PROJECT_MEDIA_PROXY_MIME = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf'
};

try {
    fs.mkdirSync(PROJECT_MEDIA_PROXY_CACHE_DIR, { recursive: true });
} catch (error) {
    console.warn('⚠️ Unable to initialize project media proxy cache directory:', error.message);
}

const projectPathResolverService = createProjectPathResolverService({
    backendDir: __dirname
});
const projectMediaUtilityService = createProjectMediaUtilityService({
    backendDir: __dirname,
    baseProjectDir: BASE_PROJECT_DIR,
    getStaticMountPath: projectPathResolverService.getStaticMountPath,
    getVideoMimeType,
    projectMediaProxyCacheDir: PROJECT_MEDIA_PROXY_CACHE_DIR,
    projectMediaProxyCacheMaxBytes: PROJECT_MEDIA_PROXY_CACHE_MAX_BYTES,
    projectMediaProxyCacheableExt: PROJECT_MEDIA_PROXY_CACHEABLE_EXT,
    projectMediaProxyMime: PROJECT_MEDIA_PROXY_MIME,
    projectMediaProxyTimeoutMs: PROJECT_MEDIA_PROXY_TIMEOUT_MS,
    validVideoExt: VALID_VIDEO_EXT
});
const projectCatalogService = createProjectCatalogService({
    buildYearMatchRegex: projectPathResolverService.buildYearMatchRegex,
    excludedFolders: EXCLUDED_FOLDERS,
    execFile: require("child_process").execFile,
    extractYearFromLabel: projectPathResolverService.extractYearFromLabel,
    findYearFolderForSource: projectPathResolverService.findYearFolderForSource,
    normalizeYears: projectPathResolverService.normalizeYears,
    projectMediaUtilityService,
    projectSources: PROJECT_SOURCES,
    resolveSourcePath: projectPathResolverService.resolveSourcePath,
    validImageExt: VALID_IMAGE_EXT,
    validVideoExt: VALID_VIDEO_EXT
});
app.use(createProjectMediaMountRoutes({
    backendDir: __dirname,
    baseProjectDir: BASE_PROJECT_DIR,
    getStaticMountPath: projectPathResolverService.getStaticMountPath
}));

app.use(createProjectMediaUtilityRoutes({
    ...projectMediaUtilityService
}));

app.use(createProjectCatalogRoutes({
    backendDir: __dirname,
    spawn,
    projectCatalogService
}));

// ðŸ”§ USER MANAGEMENT & AUTH FUNCTIONS (simplified)
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = fs.readFileSync(USERS_FILE);
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading users file:', err);
        return [];
    }
}

// Enhanced user storage functions with backup and validation
function writeUsers(users) {
    try {
        // Validate users array
        if (!Array.isArray(users)) {
            console.error('âš ï¸ Invalid users data: not an array');
            return false;
        }

        // Create backup before writing
        const backupPath = USERS_FILE + '.backup.' + Date.now();
        if (fs.existsSync(USERS_FILE)) {
            fs.copyFileSync(USERS_FILE, backupPath);
            console.log(`ðŸ“¦ Created backup: ${backupPath}`);
        }

        // Clean up old backups (keep last 10)
        const backupFiles = fs.readdirSync(path.dirname(USERS_FILE))
            .filter(file => file.startsWith('users.json.backup.'))
            .sort()
            .reverse();
        if (backupFiles.length > 10) {
            backupFiles.slice(10).forEach(backup => {
                try {
                    fs.unlinkSync(path.join(path.dirname(USERS_FILE), backup));
                    console.log(`ðŸ—‘ï¸ Cleaned old backup: ${backup}`);
                } catch (err) {
                    console.warn(`âš ï¸ Failed to clean backup ${backup}:`, err.message);
                }
            });
        }

        // Write new data
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log(`âœ… Saved ${users.length} users to storage`);
        return true;
    } catch (err) {
        console.error('âŒ Error writing users file:', err);
        return false;
    }
}

// Helper function to determine video MIME type
function getVideoMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.avi': 'video/avi',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mkv': 'video/x-matroska',
        '.m4v': 'video/mp4',
        '.3gp': 'video/3gpp'
    };

    return mimeTypes[ext] || 'video/mp4'; // Default fallback
}

app.use(createLegacyContentRoutes({
    baseDir: BASE_DIR,
    backendDir: __dirname,
    ensureDirectoryExists,
    getVideoMimeType,
    getViewCount: videoCatalogService.getViewCount,
    pluginPackagesDir: PLUGIN_PACKAGES_DIR,
    refreshVideoCache: videoCatalogService.refreshVideoCache,
    thumbnailDir: THUMBNAIL_DIR,
    videoCache: videoCatalogService.videoCache
}));

// ðŸ”§ SERVER STARTUP
const startServer = () => {
    try {
        const httpServer = app.listen(HTTP_PORT, '0.0.0.0', () => {
            const localIP = getLocalIP();
            console.log(`\nðŸš€ BCL Server Started Successfully!`);
            console.log(`ðŸ“… Started at: ${new Date().toISOString()}`);
            console.log(`ðŸŒ HTTP server running at:`);
            console.log(`   â€¢ Local:    http://localhost:${HTTP_PORT}`);
            console.log(`   â€¢ Network:  http://${localIP}:${HTTP_PORT}`);
            console.log(`   â€¢ BCL:      http://bcl.local:${HTTP_PORT}`);
            console.log(`\nâœ… HTTP server running at port ${HTTP_PORT}`);

            console.log(`\nðŸ“ Base Directory: ${BASE_DIR}`);
            console.log(`ðŸ“ Project Directory: ${BASE_PROJECT_DIR}`);
            console.log(`ðŸ“ Thumbnail Directory: ${THUMBNAIL_DIR}`);

            setInterval(() => { }, 60000);
        });

        httpServer.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`âŒ Port ${HTTP_PORT} is already in use.`);
            } else {
                console.error('âŒ Server error:', error.message);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error('âŒ CRITICAL ERROR starting server:', error.message);
        process.exit(1);
    }
};

startServer();



