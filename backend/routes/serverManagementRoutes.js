const express = require("express");
const fs = require("fs");
const path = require("path");

function createServerManagementRoutes({ backendDir, jwt, secretKey, spawn, videoCache }) {
    const router = express.Router();
    const serverStartedAt = new Date();

    function authorizeServerManagement(req) {
        if (req.session && req.session.adminUser && req.session.adminUser.isAdmin) {
            return { ok: true, method: "admin-session" };
        }

        const authHeader = req.headers.authorization || "";
        if (authHeader.startsWith("Bearer ")) {
            const token = authHeader.slice(7).trim();
            if (token) {
                try {
                    const decoded = jwt.verify(token, secretKey);
                    const role = String(decoded?.role || decoded?.jobRole || decoded?.user?.role || decoded?.userType || "").toLowerCase();
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

    function getBclRoot() {
        return path.resolve(backendDir, "..");
    }

    function getLogDir() {
        const logDir = path.resolve(getBclRoot(), "logs");
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        return logDir;
    }

    function getRestartStatePath() {
        return path.join(getLogDir(), "restart-state.json");
    }

    function getAdminRestartFlagPath() {
        return path.join(getBclRoot(), "admin-restart-in-progress.flag");
    }

    function writeRestartState(update) {
        try {
            const state = {
                updatedAt: new Date().toISOString(),
                ...update
            };
            fs.writeFileSync(getRestartStatePath(), JSON.stringify(state, null, 2), "utf8");
            return state;
        } catch (error) {
            appendServerRestartLog(`restart-state write failed: ${error.message}`);
            return null;
        }
    }

    function readRestartState() {
        try {
            const file = getRestartStatePath();
            if (!fs.existsSync(file)) return null;
            const rawState = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim();
            return rawState ? JSON.parse(rawState) : null;
        } catch (error) {
            return { state: "unknown", error: error.message };
        }
    }

    function reconcileRestartState(state) {
        const activeStates = new Set(["scheduled", "stopping", "starting", "waiting", "requesting"]);
        if (!state || !activeStates.has(String(state.state || "").toLowerCase())) return state;

        const stateUpdatedAt = new Date(state.updatedAt || 0);
        if (Number.isNaN(stateUpdatedAt.getTime()) || serverStartedAt <= stateUpdatedAt) return state;

        appendServerRestartLog(`restart ${state.requestId || "unknown"} reconciled healthy by new backend pid=${process.pid}`);
        const { updatedAt: _previousUpdatedAt, ...stateWithoutTimestamp } = state;
        return writeRestartState({
            ...stateWithoutTimestamp,
            state: "healthy",
            message: "BCL restart completed; the new backend process is responding",
            backendPid: process.pid,
            recoveredBy: "restart-status"
        }) || state;
    }

    function readRestartLogTail(maxLines = 80) {
        try {
            const file = path.join(getLogDir(), "restart-api.log");
            if (!fs.existsSync(file)) return [];
            return fs.readFileSync(file, "utf8").trim().split(/\r?\n/).slice(-maxLines);
        } catch (error) {
            return [`Unable to read restart log: ${error.message}`];
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
        const auth = authorizeServerManagement(req);
        if (!auth.ok) {
            appendServerRestartLog(`restart-full denied from ${req.ip} (unauthorized)`);
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const bclRoot = getBclRoot();
        const stopScript = path.join(bclRoot, "stop-bcl-http.bat");
        const hiddenStartScript = path.join(bclRoot, "start-bcl-http-hidden.bat");
        const visibleStartScript = path.join(bclRoot, "start-bcl-http.bat");
        const startScript = fs.existsSync(hiddenStartScript) ? hiddenStartScript : visibleStartScript;
        const backendPort = String(process.env.BCL_BACKEND_PORT || process.env.HTTP_PORT || "5052");

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
        const restartFlagEscaped = escapeForPs(getAdminRestartFlagPath());
        const restartStateEscaped = escapeForPs(getRestartStatePath());
        const logDir = getLogDir();
        const restartLogEscaped = escapeForPs(path.join(logDir, "restart-api.log"));
        const useHiddenStarter = path.basename(startScript).toLowerCase() === "start-bcl-http-hidden.bat";

        const startCommand = useHiddenStarter
            ? `& '${startEscaped}'`
            : `& '${startEscaped}' --hidden --boot --no-error-console`;

        const timestamp = Date.now();
        const wrapperScriptPath = path.join(logDir, `restart-full-${timestamp}.ps1`);
        const wrapperScriptEscaped = escapeForPs(wrapperScriptPath);
        const requestId = `restart-${timestamp}`;
        const wrapperScriptContent = [
            `$ErrorActionPreference = 'Continue'`,
            `function Write-RestartState([string]$State, [string]$Message) { $now = (Get-Date).ToUniversalTime().ToString('o'); $payload = [ordered]@{ requestId = '${requestId}'; state = $State; message = $Message; updatedAt = $now; backendPort = '${backendPort}' }; $payload | ConvertTo-Json -Compress | Set-Content -Path '${restartStateEscaped}' -Encoding UTF8; Add-Content -Path '${restartLogEscaped}' -Value ('[' + $now + '] restart ${requestId} state=' + $State + ' message=' + $Message) -Encoding UTF8 }`,
            `New-Item -ItemType File -Path '${restartFlagEscaped}' -Force | Out-Null`,
            `Write-RestartState 'stopping' 'Stopping BCL services'`,
            "Start-Sleep -Milliseconds 800",
            `& '${stopEscaped}'`,
            "Start-Sleep -Seconds 2",
            `if (Test-Path '${runlockEscaped}') { Remove-Item -Recurse -Force '${runlockEscaped}' -ErrorAction SilentlyContinue }`,
            `Write-RestartState 'starting' 'Starting BCL services'`,
            "Start-Sleep -Milliseconds 800",
            startCommand,
            `Write-RestartState 'waiting' 'Waiting for backend health check'`,
            `$healthy = $false`,
            `for ($i = 0; $i -lt 45; $i++) { Start-Sleep -Seconds 2; try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 4 -Uri 'http://127.0.0.1:${backendPort}/ping'; if ($response.StatusCode -eq 200) { $healthy = $true; break } } catch {} }`,
            `if ($healthy) { Write-RestartState 'healthy' 'BCL restart completed and backend /ping is healthy' } else { Write-RestartState 'timeout' 'BCL start was invoked but backend /ping did not become healthy before timeout' }`,
            `Remove-Item -Force '${restartFlagEscaped}' -ErrorAction SilentlyContinue`,
            `Remove-Item -Force '${wrapperScriptEscaped}' -ErrorAction SilentlyContinue`
        ].join("; ");

        try {
            fs.writeFileSync(wrapperScriptPath, wrapperScriptContent, "utf8");
            appendServerRestartLog(`restart-full accepted via ${auth.method}; start=${path.basename(startScript)}`);
            const restartState = writeRestartState({
                requestId,
                state: "scheduled",
                message: "Full restart scheduled",
                backendPort,
                authorizedBy: auth.method,
                startScript: path.basename(startScript)
            });
            const child = spawn("cmd.exe", [
                "/c",
                "start",
                "\"\"",
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-WindowStyle", "Hidden",
                "-File", wrapperScriptPath
            ], {
                cwd: bclRoot,
                detached: true,
                stdio: "ignore",
                windowsHide: true
            });

            appendServerRestartLog(`restart-full launcher pid=${child.pid || "unknown"} wrapper=${path.basename(wrapperScriptPath)}`);
            child.unref();

            res.json({
                success: true,
                message: "Full restart scheduled via batch launcher scripts",
                authorizedBy: auth.method,
                requestId,
                restartState,
                scripts: {
                    stop: path.basename(stopScript),
                    start: path.basename(startScript),
                    wrapper: path.basename(wrapperScriptPath)
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
        const auth = authorizeServerManagement(req);
        if (!auth.ok) {
            appendServerRestartLog(`restart denied from ${req.ip} (unauthorized)`);
            return res.status(401).json({ error: "Unauthorized access" });
        }

        console.log("ðŸ”„ Server restart requested by admin dashboard");
        appendServerRestartLog(`restart accepted via ${auth.method}`);
        writeRestartState({
            requestId: `soft-${Date.now()}`,
            state: "soft_restart",
            message: "Soft restart requested",
            authorizedBy: auth.method,
            backendPort: String(process.env.BCL_BACKEND_PORT || process.env.HTTP_PORT || "5052")
        });

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
        const auth = authorizeServerManagement(req);
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
            pid: process.pid,
            startedAt: serverStartedAt.toISOString(),
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

    router.get("/api/server/restart-status", (req, res) => {
        const auth = authorizeServerManagement(req);
        if (!auth.ok) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const restartState = reconcileRestartState(readRestartState());
        res.json({
            success: true,
            server: {
                status: "running",
                pid: process.pid,
                startedAt: serverStartedAt.toISOString(),
                uptime: process.uptime()
            },
            restart: restartState,
            adminRestartInProgress: fs.existsSync(getAdminRestartFlagPath()),
            logTail: readRestartLogTail(),
            timestamp: new Date().toISOString()
        });
    });

    return router;
}

module.exports = createServerManagementRoutes;
