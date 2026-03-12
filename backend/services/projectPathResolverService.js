const fs = require("fs");
const path = require("path");

function createProjectPathResolverService({
    backendDir
}) {
    const LOCAL_PCBIM02_ROOT = path.resolve(backendDir, '..', 'PC-BIM02');
    const LOCAL_PCBIM02_PROJECT_2025_ROOT = LOCAL_PCBIM02_ROOT;

    function escapeRegex(input = '') {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildYearMatchRegex(pattern) {
        let escaped = escapeRegex(pattern);
        escaped = escaped.replace('\\{year\\}', '(\\d{4})');
        escaped = escaped.replace(/\\ /g, '\\s+');
        return new RegExp(`^${escaped}$`, 'i');
    }

    function buildYearFolderRegex(pattern, year) {
        let escaped = escapeRegex(pattern);
        escaped = escaped.replace('\\{year\\}', year);
        escaped = escaped.replace(/\\ /g, '\\s+');
        return new RegExp(`^${escaped}$`, 'i');
    }

    function findYearFolderForSource(sourcePath, source, year, mount = null) {
        if (!sourcePath || !source || !source.folderPattern) return null;

        const sourceBaseName = path.basename(sourcePath);
        const directMatch = buildYearFolderRegex(source.folderPattern, year);
        if (directMatch.test(sourceBaseName)) {
            return { name: sourceBaseName, path: sourcePath };
        }

        if (mount) {
            const mountName = mount.shareName || '';
            if (mountName && directMatch.test(mountName)) {
                return { name: mountName, path: sourcePath };
            }
            const remoteBase = mount.remotePath ? path.basename(mount.remotePath) : '';
            if (remoteBase && directMatch.test(remoteBase)) {
                return { name: remoteBase, path: sourcePath };
            }
        }

        const expectedName = source.folderPattern.replace('{year}', year);
        const expectedPath = path.join(sourcePath, expectedName);

        if (fs.existsSync(expectedPath)) {
            return { name: expectedName, path: expectedPath };
        }

        try {
            const yearRegex = buildYearFolderRegex(source.folderPattern, year);
            const items = fs.readdirSync(sourcePath, { withFileTypes: true })
                .filter(item => item.isDirectory());
            const match = items.find(item => yearRegex.test(item.name));
            if (match) {
                return { name: match.name, path: path.join(sourcePath, match.name) };
            }
        } catch (error) {
            console.warn(`⚠️ Error finding year folder for ${source.id}:`, error.message);
        }

        return null;
    }

    function extractYearFromLabel(label) {
        if (!label || typeof label !== 'string') return null;
        const match = label.match(/(19|20)\d{2}/);
        return match ? match[0] : null;
    }

    function normalizeYears(years = []) {
        if (!Array.isArray(years)) return [];

        return Array.from(
            new Set(
                years
                    .map(year => String(year || '').trim())
                    .filter(year => /^(19|20)\d{2}$/.test(year))
            )
        ).sort((a, b) => b.localeCompare(a));
    }

    function getStaticMountPath(mountId, fallbackPath) {
        if (mountId === 'pc-bim02') {
            try {
                const stats = fs.statSync(LOCAL_PCBIM02_PROJECT_2025_ROOT);
                if (stats.isDirectory()) {
                    return LOCAL_PCBIM02_PROJECT_2025_ROOT;
                }
            } catch (error) {
                // Ignore local override failures and continue.
            }
        }

        try {
            const LANMountManager = require('../utils/lanMountManager');
            const staticMountManager = new LANMountManager();
            const mount = staticMountManager.getMountById(mountId);
            if (mount && mount.remotePath) {
                return mount.remotePath;
            }
        } catch (error) {
            // Ignore and use fallback.
        }

        return fallbackPath;
    }

    async function resolveSourcePath(source, lanManager, options = {}) {
        if (!source) {
            return null;
        }

        if (source.path) {
            try {
                const stats = fs.statSync(source.path);
                if (stats.isDirectory()) {
                    return source.path;
                }
            } catch (error) {
                // Ignore local path fallback and continue to mount resolution.
            }
        }

        if (!source.mountId) {
            return source ? source.path : null;
        }

        const mount = lanManager.getMountById(source.mountId);
        if (!mount) {
            console.warn(`⚠️ LAN mount configuration not found for ${source.id}: ${source.mountId}`);
            return null;
        }

        const markConnectedAndReturn = (resolvedPath) => {
            mount.status = 'connected';
            mount.lastConnected = new Date().toISOString();
            lanManager.saveConfiguration();
            return resolvedPath;
        };

        const resolveExistingPath = (candidatePath) => {
            if (!candidatePath) return null;
            try {
                const stats = fs.statSync(candidatePath);
                if (stats.isDirectory()) {
                    return markConnectedAndReturn(candidatePath);
                }
            } catch (error) {
                // Ignore inaccessible paths and continue fallback flow.
            }
            return null;
        };

        const isWindowsDriveRoot = (candidatePath) => {
            if (!candidatePath || typeof candidatePath !== 'string') return false;
            return /^[a-zA-Z]:[\\\/]?$/.test(candidatePath.trim());
        };

        const testMountWithTimeout = async (timeoutMs) => {
            try {
                return await Promise.race([
                    lanManager.testMountAccess(source.mountId),
                    new Promise(resolve => setTimeout(() => resolve({
                        accessible: false,
                        message: `Timeout after ${timeoutMs}ms`,
                        method: 'timeout'
                    }), timeoutMs))
                ]);
            } catch (accessError) {
                console.error(`❌ LAN mount ${source.id} access test error: ${accessError.message}`);
                return null;
            }
        };

        if (isWindowsDriveRoot(mount.localMountPoint)) {
            const existingLocalPath = resolveExistingPath(mount.localMountPoint);
            if (existingLocalPath) {
                return existingLocalPath;
            }
            const existingUncPath = resolveExistingPath(mount.remotePath);
            if (existingUncPath) {
                return existingUncPath;
            }
        } else {
            const existingUncPath = resolveExistingPath(mount.remotePath);
            if (existingUncPath) {
                return existingUncPath;
            }
            const existingLocalPath = resolveExistingPath(mount.localMountPoint);
            if (existingLocalPath) {
                return existingLocalPath;
            }
        }

        const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 3000;
        let accessResult = await testMountWithTimeout(timeoutMs);
        if (accessResult && accessResult.accessible) {
            return markConnectedAndReturn(accessResult.path);
        }

        const shouldAttemptReconnect = options.allowReconnect !== false && mount.enabled !== false;
        if (shouldAttemptReconnect) {
            try {
                const connectTimeoutMs = Math.max(timeoutMs, 8000);
                await Promise.race([
                    lanManager.connectMount(source.mountId),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${connectTimeoutMs}ms`)), connectTimeoutMs))
                ]);
            } catch (connectError) {
                console.warn(`⚠️ LAN mount ${source.id} reconnect attempt failed: ${connectError.message}`);
            }

            if (isWindowsDriveRoot(mount.localMountPoint)) {
                const connectedLocalPath = resolveExistingPath(mount.localMountPoint);
                if (connectedLocalPath) {
                    return connectedLocalPath;
                }
                const connectedUncPath = resolveExistingPath(mount.remotePath);
                if (connectedUncPath) {
                    return connectedUncPath;
                }
            } else {
                const connectedUncPath = resolveExistingPath(mount.remotePath);
                if (connectedUncPath) {
                    return connectedUncPath;
                }
                const connectedLocalPath = resolveExistingPath(mount.localMountPoint);
                if (connectedLocalPath) {
                    return connectedLocalPath;
                }
            }

            accessResult = await testMountWithTimeout(timeoutMs);
            if (accessResult && accessResult.accessible) {
                return markConnectedAndReturn(accessResult.path);
            }
        }

        if (accessResult) {
            console.warn(`⚠️ LAN mount ${source.id} not accessible: ${accessResult.message}`);
        }

        return null;
    }

    return {
        buildYearMatchRegex,
        extractYearFromLabel,
        findYearFolderForSource,
        getStaticMountPath,
        normalizeYears,
        resolveSourcePath
    };
}

module.exports = createProjectPathResolverService;
