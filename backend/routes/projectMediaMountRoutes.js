const express = require("express");
const fs = require("fs");
const path = require("path");
const {
    mediaPathHasExcludedFile,
    mediaPathHasExcludedFolder,
    mediaPathHasTraversalSegment
} = require("../../shared/rawMediaFolderFilter");

function createProjectMediaMountRoutes({
    backendDir,
    baseProjectDir,
    getStaticMountPath
}) {
    const router = express.Router();
    const staticMiddlewareCache = new Map();

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

    const getStaticMiddleware = (resolvedTargetPath) => {
        const cacheKey = String(resolvedTargetPath || '');
        if (!staticMiddlewareCache.has(cacheKey)) {
            staticMiddlewareCache.set(cacheKey, express.static(resolvedTargetPath));
        }
        return staticMiddlewareCache.get(cacheKey);
    };

    const mountStaticMedia = (routePath, targetPathOrResolver) => {
        router.use(routePath, (req, res, next) => {
            if (mediaPathHasTraversalSegment(req.path)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (mediaPathHasExcludedFolder(req.path)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (mediaPathHasExcludedFile(req.path)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const resolvedTargetValue = typeof targetPathOrResolver === 'function'
                ? targetPathOrResolver()
                : targetPathOrResolver;
            const resolvedTargetPaths = (Array.isArray(resolvedTargetValue)
                ? resolvedTargetValue
                : [resolvedTargetValue])
                .filter(Boolean)
                .filter((targetPath, index, items) => items.indexOf(targetPath) === index)
                .filter(targetPath => fs.existsSync(targetPath));

            if (resolvedTargetPaths.length === 0) {
                return next();
            }

            const serveFromTarget = (index) => {
                if (index >= resolvedTargetPaths.length) {
                    return next();
                }

                return getStaticMiddleware(resolvedTargetPaths[index])(req, res, (error) => {
                    if (error) {
                        return next(error);
                    }
                    return serveFromTarget(index + 1);
                });
            };

            return serveFromTarget(0);
        });
    };

    const getPcBim1StaticRoots = (mountId, fallbackPath, year) => {
        const base = getStaticMountPath(mountId, fallbackPath);
        return [
            base ? path.join(base, `PROJECT ${year}`) : null,
            base
        ].filter(Boolean);
    };

    const getPcBim02StaticRoots = (mountId, fallbackPath, year) => [
        getStaticMountPath(mountId, fallbackPath),
        `\\\\pc-bim02\\PROJECT BIM ${year}`,
        path.resolve(backendDir, '..', 'data', 'pc-bim02-cache', `PROJECT BIM ${year}`)
    ].filter(Boolean);

    mountStaticMedia('/media', () => baseProjectDir);
    mountStaticMedia('/media-bim02', () => getPcBim02StaticRoots('pc-bim02', 'X:', '2025'));
    mountStaticMedia('/media-bim02-2026', () => getPcBim02StaticRoots('pc-bim02-2026', 'V:', '2026'));
    mountStaticMedia('/media-bim1-2025', () => getPcBim1StaticRoots('pc-bim1', 'Y:', '2025'));
    mountStaticMedia('/media-bim1-2024', () => getPcBim1StaticRoots('pc-bim1-2024', 'Z:', '2024'));
    mountStaticMedia('/media-bim1-2023', () => getPcBim1StaticRoots('pc-bim1-2023', 'W:', '2023'));
    mountStaticMedia('/media-bim1-2022', () => getPcBim1StaticRoots('pc-bim1-2022', 'U:', '2022'));
    mountStaticMedia('/media-bim1-2021', () => getPcBim1StaticRoots('pc-bim1-2021', 'T:', '2021'));
    mountStaticMedia('/media-bim1-2020', () => getPcBim1StaticRoots('pc-bim1-2020', 'S:', '2020'));

    return router;
}

module.exports = createProjectMediaMountRoutes;
