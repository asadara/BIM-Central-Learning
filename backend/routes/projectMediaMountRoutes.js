const express = require("express");
const fs = require("fs");
const path = require("path");

function createProjectMediaMountRoutes({
    backendDir,
    baseProjectDir,
    getStaticMountPath
}) {
    const router = express.Router();

    router.get('/bim-showroom-metadata.json', (req, res) => {
        try {
            const metadataPath = path.join(backendDir, 'bim-showroom-metadata.json');
            if (!fs.existsSync(metadataPath)) {
                return res.status(404).json({ error: 'Metadata file not found' });
            }

            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            res.json(metadata);
        } catch (error) {
            console.error('Error serving BIM showroom metadata:', error);
            res.status(500).json({ error: 'Failed to load metadata' });
        }
    });

    const mountStaticMedia = (routePath, targetPath) => {
        router.use(routePath, (req, res, next) => {
            if (req.path.includes('..')) {
                return res.status(403).json({ error: 'Access denied' });
            }
            next();
        }, express.static(targetPath));
    };

    mountStaticMedia('/media', baseProjectDir);
    mountStaticMedia('/media-bim02', getStaticMountPath('pc-bim02', 'X:'));
    mountStaticMedia('/media-bim02-2026', getStaticMountPath('pc-bim02-2026', 'V:'));
    mountStaticMedia('/media-bim1-2025', getStaticMountPath('pc-bim1', 'Y:'));
    mountStaticMedia('/media-bim1-2024', getStaticMountPath('pc-bim1-2024', 'Z:'));
    mountStaticMedia('/media-bim1-2023', getStaticMountPath('pc-bim1-2023', 'W:'));
    mountStaticMedia('/media-bim1-2022', getStaticMountPath('pc-bim1-2022', 'U:'));
    mountStaticMedia('/media-bim1-2021', getStaticMountPath('pc-bim1-2021', 'T:'));
    mountStaticMedia('/media-bim1-2020', getStaticMountPath('pc-bim1-2020', 'S:'));

    return router;
}

module.exports = createProjectMediaMountRoutes;
