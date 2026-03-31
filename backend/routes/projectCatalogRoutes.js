const express = require("express");
const path = require("path");
const { requireAuthenticated } = require("../utils/auth");

function createProjectCatalogRoutes({
    backendDir,
    projectCatalogService,
    spawn
}) {
    const router = express.Router();
    let activeSync = null;

    function runProjectsExplorerSync() {
        if (activeSync) {
            return activeSync;
        }

        const bclRoot = path.resolve(backendDir, "..");
        const syncScriptPath = path.join(bclRoot, "sync-projects-explorer-cache.ps1");

        activeSync = new Promise((resolve, reject) => {
            const child = spawn("powershell.exe", [
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", syncScriptPath
            ], {
                cwd: bclRoot,
                windowsHide: true
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });

            child.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });

            child.on("error", (error) => {
                reject(error);
            });

            child.on("close", (code) => {
                if (code === 0) {
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                    return;
                }

                const error = new Error(`Projects explorer sync failed with exit code ${code}`);
                error.code = code;
                error.stdout = stdout.trim();
                error.stderr = stderr.trim();
                reject(error);
            });
        }).finally(() => {
            activeSync = null;
        });

        return activeSync;
    }

    router.get('/api/years', async (req, res) => {
        try {
            const result = await projectCatalogService.getYearsFromMultipleSources();
            console.log('📊 Final years list from all sources:', result.years);

            res.json({
                years: result.years,
                yearsBySource: result.yearsBySource,
                sources: projectCatalogService.getEnabledSources(),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error reading years from multiple sources:', error);
            res.status(500).json({
                error: 'Failed to read year folders from all sources',
                detail: error.message
            });
        }
    });

    router.get('/api/projects/:year', async (req, res) => {
        const { year } = req.params;
        const { sourceId } = req.query;

        if (!year || !/^\d{4}$/.test(year)) {
            return res.status(400).json({ error: 'Invalid year format' });
        }

        try {
            const result = await projectCatalogService.getProjectsFromMultipleSources(year, sourceId || null);
            let projects = Array.isArray(result.projects) ? result.projects : [];
            let hiddenProjects = Array.isArray(result.hiddenProjects) ? result.hiddenProjects : [];
            if (sourceId) {
                projects = projects.filter(project => project.sourceId === sourceId);
                hiddenProjects = hiddenProjects.filter(project => project.sourceId === sourceId);
            }
            console.log(`📊 ${year}: Found ${projects.length} projects from all sources`);

            res.json({
                year,
                projects,
                totalProjects: projects.length,
                hiddenProjects,
                hiddenProjectCount: hiddenProjects.length,
                hiddenProjectReason: 'Folder proyek disembunyikan karena belum ada media visual (gambar/video).',
                sources: projectCatalogService.getEnabledSources()
            });
        } catch (error) {
            console.error(`❌ Error reading projects for year ${year}:`, error);
            res.status(500).json({
                error: 'Failed to read projects from all sources',
                detail: error.message
            });
        }
    });

    router.get('/api/project-media/:year/:project', async (req, res) => {
        const { year, project } = req.params;
        const { sourceId } = req.query;

        if (!year || !project) {
            return res.status(400).json({ error: 'Year and project parameters are required' });
        }

        const result = await projectCatalogService.getProjectMedia(year, project, sourceId);
        if (!result) {
            return res.status(404).json({ error: `Project '${project}' not found in any source` });
        }

        res.json(result);
    });

    router.post('/api/projects/refresh-cache', requireAuthenticated, async (req, res) => {
        try {
            const authUser = req.authUser || req.user || {};
            const result = await runProjectsExplorerSync();

            res.json({
                success: true,
                message: 'Projects explorer cache refreshed.',
                requestedBy: authUser.username || authUser.email || 'user',
                output: result.stdout || null,
                warnings: result.stderr || null,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to refresh projects explorer cache:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to refresh projects explorer cache',
                detail: error.message,
                output: error.stdout || null,
                warnings: error.stderr || null
            });
        }
    });

    return router;
}

module.exports = createProjectCatalogRoutes;
