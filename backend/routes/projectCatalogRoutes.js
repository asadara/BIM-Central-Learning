const express = require("express");
const fs = require("fs");
const path = require("path");
const { getRequestUser } = require("../utils/auth");

function createProjectCatalogRoutes({
    backendDir,
    projectCatalogService,
    spawn
}) {
    const router = express.Router();
    let activeSync = null;

    function isPcbim02SourceId(sourceId) {
        return String(sourceId || '').toLowerCase().startsWith('pc-bim02');
    }

    function sourceSupportsYear(source, year) {
        if (!source || !Array.isArray(source.fixedYears) || source.fixedYears.length === 0) {
            return true;
        }

        const normalizedYear = String(year || '').trim();
        return source.fixedYears.map(value => String(value || '').trim()).includes(normalizedYear);
    }

    function readProjectsExplorerCache(year) {
        const cachePath = path.resolve(backendDir, '..', 'data', 'projects-explorer-cache', `projects-${year}.json`);
        try {
            if (!fs.existsSync(cachePath)) {
                return null;
            }

            const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function getCachedProjectsForSource(year, sourceId) {
        const cached = readProjectsExplorerCache(year);
        if (!cached) {
            return { projects: [], hiddenProjects: [] };
        }

        const projects = Array.isArray(cached.projects)
            ? cached.projects.filter(project => project && project.sourceId === sourceId)
            : [];
        const hiddenProjects = Array.isArray(cached.hiddenProjects)
            ? cached.hiddenProjects.filter(project => project && project.sourceId === sourceId)
            : [];

        return { projects, hiddenProjects };
    }

    function restoreMissingPcbim02SourcesFromCache(year, projects, hiddenProjects) {
        const projectList = Array.isArray(projects) ? projects : [];
        const hiddenList = Array.isArray(hiddenProjects) ? hiddenProjects : [];
        const existingSourceIds = new Set(projectList.map(project => project && project.sourceId).filter(Boolean));

        for (const source of projectCatalogService.getEnabledSources()) {
            if (!source || !isPcbim02SourceId(source.id) || !sourceSupportsYear(source, year)) {
                continue;
            }
            if (existingSourceIds.has(source.id)) {
                continue;
            }

            const cached = getCachedProjectsForSource(year, source.id);
            if (cached.projects.length === 0) {
                continue;
            }

            cached.projects.forEach(project => projectList.push(project));
            cached.hiddenProjects.forEach(project => hiddenList.push(project));
        }

        return { projects: projectList, hiddenProjects: hiddenList };
    }

    function runPowerShellScript(scriptPath, cwd) {
        return new Promise((resolve, reject) => {
            const child = spawn("powershell.exe", [
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", scriptPath
            ], {
                cwd,
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

                const error = new Error(`${path.basename(scriptPath)} failed with exit code ${code}`);
                error.code = code;
                error.stdout = stdout.trim();
                error.stderr = stderr.trim();
                reject(error);
            });
        });
    }

    function runProjectsExplorerSync() {
        if (activeSync) {
            return activeSync;
        }

        const bclRoot = path.resolve(backendDir, "..");
        const projectSyncScriptPath = path.join(bclRoot, "sync-projects-explorer-cache.ps1");
        const mediaSyncScriptPath = path.join(bclRoot, "sync-project-media-cache.ps1");

        activeSync = (async () => {
            const projectResult = await runPowerShellScript(projectSyncScriptPath, bclRoot);
            const mediaResult = await runPowerShellScript(mediaSyncScriptPath, bclRoot);

            return {
                stdout: [projectResult.stdout, mediaResult.stdout].filter(Boolean).join("\n"),
                stderr: [projectResult.stderr, mediaResult.stderr].filter(Boolean).join("\n")
            };
        })().finally(() => {
            activeSync = null;
        });

        return activeSync;
    }

    router.get('/api/years', async (req, res) => {
        try {
            res.setHeader('Cache-Control', 'no-store');
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
            res.setHeader('Cache-Control', 'no-store');
            const result = await projectCatalogService.getProjectsFromMultipleSources(year, sourceId || null);
            let projects = Array.isArray(result.projects) ? result.projects : [];
            let hiddenProjects = Array.isArray(result.hiddenProjects) ? result.hiddenProjects : [];
            if (sourceId) {
                projects = projects.filter(project => project.sourceId === sourceId);
                hiddenProjects = hiddenProjects.filter(project => project.sourceId === sourceId);
                if (projects.length === 0 && isPcbim02SourceId(sourceId)) {
                    const cached = getCachedProjectsForSource(year, sourceId);
                    if (cached.projects.length > 0) {
                        projects = cached.projects;
                        hiddenProjects = cached.hiddenProjects;
                    }
                }
            } else {
                const restored = restoreMissingPcbim02SourcesFromCache(year, projects, hiddenProjects);
                projects = restored.projects;
                hiddenProjects = restored.hiddenProjects;
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

        res.setHeader('Cache-Control', 'no-store');
        const result = await projectCatalogService.getProjectMedia(year, project, sourceId);
        if (!result) {
            return res.status(404).json({ error: `Project '${project}' not found in any source` });
        }

        res.json(result);
    });

    router.post('/api/projects/refresh-cache', async (req, res) => {
        try {
            const authUser = getRequestUser(req) || {};
            const result = await runProjectsExplorerSync();

            res.json({
                success: true,
                message: 'Projects explorer cache refreshed.',
                requestedBy: authUser.username || authUser.email || 'manual-refresh',
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
