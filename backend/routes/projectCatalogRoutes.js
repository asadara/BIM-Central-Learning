const express = require("express");

function createProjectCatalogRoutes({
    projectCatalogService
}) {
    const router = express.Router();

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
            const result = await projectCatalogService.getProjectsFromMultipleSources(year);
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

    return router;
}

module.exports = createProjectCatalogRoutes;
