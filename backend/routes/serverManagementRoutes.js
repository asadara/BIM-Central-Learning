const express = require("express");
const fs = require("fs");
const path = require("path");

function createServerManagementRoutes({ backendDir, jwt, secretKey, spawn, videoCache }) {
    const router = express.Router();

    function authorizeServerManagement(req, validSecret) {
        const providedSecret = req.body?.secret || req.headers["x-admin-secret"];
        if (providedSecret && providedSecret === validSecret) {
            return { ok: true, method: "secret" };
        }

        if (req.session && req.session.adminUser && req.session.adminUser.isAdmin) {
            return { ok: true, method: "admin-session" };
        }

        const authHeader = req.headers.authorization || "";
        if (authHeader.startsWith("Bearer ")) {
            const token = authHeader.slice(7).trim();
            if (token) {
                try {
                    const decoded = jwt.verify(token, secretKey);
                    const role = String(decoded?.role || decoded?.user?.role || decoded?.userType || "").toLowerCase();
                    const isAdminToken = decoded?.isAdmin === true || role.includes("admin") || role.includes("super");
                    if (isAdminToken) {
                        return { ok: true, method: "jwt" };
                    }
                } catch (error) {
                    // Ignore invalid token.
                }
            }
        }

        return { ok: false, method: "none" };
    }

    function appendServerRestartLog(message) {
        try {
            const logDir = path.resolve(backendDir, "..", "logs");
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            const logFile = path.join(logDir, "restart-api.log");
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`, "utf8");
        } catch (error) {
            // Ignore logging failures.
        }
    }

    function clearVideoCache() {
        if (!videoCache) return false;
        videoCache.tutorials = null;
        videoCache.courses = null;
        videoCache.lastUpdated = 0;
        console.log("ðŸ§¹ Video cache cleared");
        return true;
    }

    function formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    }

    router.post("/api/server/restart-full", (req, res) => {
        const validSecret = process.env.ADMIN_SECRET || "phase4-admin-secret";
        const auth = authorizeServerManagement(req, validSecret);
        if (!auth.ok) {
            appendServerRestartLog(`restart-full denied from ${req.ip} (unauthorized)`);
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const bclRoot = path.resolve(backendDir, "..");
        const stopScript = path.join(bclRoot, "stop-bcl-http.bat");
        const hiddenStartScript = path.join(bclRoot, "start-bcl-http-hidden.bat");
        const visibleStartScript = path.join(bclRoot, "start-bcl-http.bat");
        const startScript = fs.existsSync(hiddenStartScript) ? hiddenStartScript : visibleStartScript;

        if (!fs.existsSync(stopScript)) {
            return res.status(500).json({ error: "Missing stop-bcl-http.bat script" });
        }
        if (!fs.existsSync(startScript)) {
            return res.status(500).json({ error: "Missing start script for full restart" });
        }

        const escapeForPs = (value) => String(value).replace(/'/g, "''");
        const stopEscaped = escapeForPs(stopScript);
        const startEscaped = escapeForPs(startScript);
        const runlockEscaped = escapeForPs(path.join(bclRoot, "runlock"));
        const useHiddenStarter = path.basename(startScript).toLowerCase() === "start-bcl-http-hidden.bat";

        const startCommand = useHiddenStarter
            ? `& '${startEscaped}'`
            : `& '${startEscaped}' --hidden --boot --no-error-console`;

        const psCommand = `Start-Sleep -Milliseconds 800; & '${stopEscaped}'; Start-Sleep -Seconds 2; if (Test-Path '${runlockEscaped}') { Remove-Item -Recurse -Force '${runlockEscaped}' -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800; ${startCommand}`;

        try {
            appendServerRestartLog(`restart-full accepted via ${auth.method}; start=${path.basename(startScript)}`);
            const child = spawn("powershell.exe", [
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-WindowStyle", "Hidden",
                "-Command", psCommand
            ], {
                cwd: bclRoot,
                detached: true,
                stdio: "ignore",
                windowsHide: true
            });

            child.unref();

            res.json({
                success: true,
                message: "Full restart scheduled via batch launcher scripts",
                authorizedBy: auth.method,
                scripts: {
                    stop: path.basename(stopScript),
                    start: path.basename(startScript)
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("Failed to schedule full restart:", error);
            appendServerRestartLog(`restart-full failed: ${error.message}`);
            res.status(500).json({
                success: false,
                error: "Failed to schedule full restart",
                details: error.message
            });
        }
    });

    router.post("/api/server/restart", (req, res) => {
        const validSecret = process.env.ADMIN_SECRET || "phase4-admin-secret";
        const auth = authorizeServerManagement(req, validSecret);
        if (!auth.ok) {
            appendServerRestartLog(`restart denied from ${req.ip} (unauthorized)`);
            return res.status(401).json({ error: "Unauthorized access" });
        }

        console.log("ðŸ”„ Server restart requested by admin dashboard");
        appendServerRestartLog(`restart accepted via ${auth.method}`);

        const isManagedProcess = process.env.PM2_HOME || process.env.FOREVER_ROOT || process.env.pm_id !== undefined;
        if (isManagedProcess) {
            console.log("ðŸš€ Running under process manager, exiting for restart...");
            res.json({
                success: true,
                message: "Server restart initiated (process manager will restart)",
                authorizedBy: auth.method,
                method: "process_manager",
                timestamp: new Date().toISOString()
            });

            setTimeout(() => {
                console.log("ðŸš€ Server process exiting for restart...");
                process.exit(0);
            }, 1000);
            return;
        }

        console.log("ðŸ”„ Not running under process manager, performing soft restart...");
        clearVideoCache();

        Object.keys(require.cache).forEach((key) => {
            if (key.includes("routes") || key.includes("utils")) {
                delete require.cache[key];
                console.log(`ðŸ—‘ï¸ Module cache cleared: ${key}`);
            }
        });

        if (global.gc) {
            global.gc();
            console.log("ðŸ—‘ï¸ Garbage collection completed");
        }

        console.log("âœ… Soft restart completed - server memory optimized");
        res.json({
            success: true,
            message: "Server soft restart completed (not running under process manager)",
            authorizedBy: auth.method,
            method: "soft_restart",
            memory: {
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB"
            },
            timestamp: new Date().toISOString()
        });
    });

    router.post("/api/server/clear-cache", (req, res) => {
        const validSecret = process.env.ADMIN_SECRET || "phase4-admin-secret";
        const auth = authorizeServerManagement(req, validSecret);
        if (!auth.ok) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        try {
            clearVideoCache();
            console.log("ðŸ§¹ Server cache cleared by admin dashboard");

            res.json({
                success: true,
                message: "Server cache cleared successfully",
                authorizedBy: auth.method,
                cleared: ["videoCache"],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("âŒ Error clearing server cache:", error);
            res.status(500).json({
                success: false,
                error: "Failed to clear server cache",
                details: error.message
            });
        }
    });

    router.get("/api/server/status", (req, res) => {
        const uptime = process.uptime();
        const memory = process.memoryUsage();

        res.json({
            status: "running",
            uptime,
            uptimeFormatted: formatUptime(uptime),
            memory: {
                rss: Math.round(memory.rss / 1024 / 1024) + " MB",
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + " MB",
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + " MB",
                external: Math.round(memory.external / 1024 / 1024) + " MB"
            },
            cache: {
                videos: videoCache.tutorials ? videoCache.tutorials.length : 0,
                courses: videoCache.courses ? videoCache.courses.length : 0,
                cacheAge: videoCache.lastUpdated ? Math.round((Date.now() - videoCache.lastUpdated) / 1000) + "s" : "never"
            },
            timestamp: new Date().toISOString()
        });
    });

    return router;
}

module.exports = createServerManagementRoutes;
