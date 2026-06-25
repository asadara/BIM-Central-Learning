const express = require("express");
const fs = require("fs");
const path = require("path");

const DEFAULT_AUDIT_ROOT = "\\\\pc-bim02\\Dokumen Audit 2026";
const DEFAULT_EXCLUDED_FOLDERS = [
    "2.GERBANG UTAMA (OK)",
    "PERSIAPAN AUDIT"
];

const INDEX_TTL_MS = 5 * 60 * 1000;
const MAX_INDEX_ITEMS = 25000;
const MAX_SEARCH_RESULTS = 500;

const DOCUMENT_FAMILIES = {
    pdf: [".pdf"],
    word: [".doc", ".docx", ".rtf"],
    excel: [".xls", ".xlsx", ".csv"],
    powerpoint: [".ppt", ".pptx"],
    image: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"],
    drawing: [".dwg", ".dxf", ".rvt", ".rfa", ".ifc", ".nwd", ".nwc", ".skp"],
    archive: [".zip", ".rar", ".7z"]
};

function createAudit2026Routes(options = {}) {
    const router = express.Router();
    const auditRoot = options.auditRoot || process.env.AUDIT_2026_ROOT || DEFAULT_AUDIT_ROOT;
    const excludedFolders = new Set(
        (options.excludedFolders || DEFAULT_EXCLUDED_FOLDERS).map(normalizeName)
    );

    let indexCache = null;
    let indexCacheBuiltAt = 0;
    let lastIndexError = null;

    router.get("/status", (req, res) => {
        const rootExists = fs.existsSync(auditRoot);
        res.json({
            root: auditRoot,
            rootExists,
            excludedFolders: [...excludedFolders],
            cached: Boolean(indexCache),
            cachedAt: indexCacheBuiltAt ? new Date(indexCacheBuiltAt).toISOString() : null,
            lastError: lastIndexError ? lastIndexError.message : null
        });
    });

    router.get("/index", (req, res) => {
        try {
            const force = req.query.refresh === "1" || req.query.refresh === "true";
            const index = getIndex(force);
            res.json({
                summary: index.summary,
                categories: index.categories,
                documentTypes: index.documentTypes,
                updatedAt: index.updatedAt,
                truncated: index.truncated,
                root: auditRoot,
                excludedFolders: DEFAULT_EXCLUDED_FOLDERS
            });
        } catch (error) {
            res.json(createUnavailableIndexPayload(auditRoot, error));
        }
    });

    router.get("/search", (req, res) => {
        try {
            const query = String(req.query.q || "").trim();
            const category = String(req.query.category || "all").trim();
            const family = String(req.query.family || "all").trim().toLowerCase();
            const sort = String(req.query.sort || "relevance").trim().toLowerCase();
            const limit = Math.min(Number(req.query.limit) || 100, MAX_SEARCH_RESULTS);
            const index = getIndex(false);

            let results = index.files
                .filter((item) => matchesCategory(item, category))
                .filter((item) => matchesFamily(item, family))
                .map((item) => ({
                    ...item,
                    score: scoreSearchItem(item, query)
                }))
                .filter((item) => !query || item.score > 0);

            results = sortSearchResults(results, sort);

            res.json({
                query,
                category,
                family,
                sort,
                totalResults: results.length,
                files: results.slice(0, limit),
                truncated: results.length > limit,
                updatedAt: index.updatedAt
            });
        } catch (error) {
            res.json({
                state: "waiting_pc_bim02",
                retryAfterSeconds: 15,
                message: "Menunggu koneksi PC-BIM02. Search Audit 2026 akan aktif setelah share tersedia.",
                query: String(req.query.q || "").trim(),
                category: String(req.query.category || "all").trim(),
                family: String(req.query.family || "all").trim().toLowerCase(),
                sort: String(req.query.sort || "relevance").trim().toLowerCase(),
                totalResults: 0,
                files: [],
                truncated: false,
                updatedAt: new Date().toISOString(),
                unavailable: true,
                error: "Audit 2026 source unavailable",
                detail: error.message
            });
        }
    });

    router.get("/browse", (req, res) => {
        try {
            const requestedPath = String(req.query.path || "");
            const targetPath = resolveAuditPath(auditRoot, requestedPath);
            if (!targetPath) {
                return res.status(400).json({ error: "Invalid audit path" });
            }

            if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
                if (!requestedPath) {
                    return res.json(createUnavailableBrowsePayload(auditRoot, errorFromUnavailableRoot(auditRoot)));
                }
                return res.status(404).json({ error: "Audit folder not found" });
            }

            const entries = fs.readdirSync(targetPath, { withFileTypes: true })
                .filter((entry) => !shouldSkipEntry(entry.name, entry.isDirectory(), excludedFolders))
                .map((entry) => createBrowseItem(auditRoot, targetPath, entry))
                .filter(Boolean)
                .sort(sortBrowseItems);

            res.json({
                path: normalizeRelativePath(path.relative(auditRoot, targetPath)),
                breadcrumbs: createBreadcrumbs(auditRoot, targetPath),
                entries,
                totalEntries: entries.length,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            res.json(createUnavailableBrowsePayload(auditRoot, error));
        }
    });

    router.get("/file", (req, res) => {
        try {
            const requestedPath = String(req.query.path || "");
            const targetPath = resolveAuditPath(auditRoot, requestedPath);
            if (!targetPath) {
                return res.status(400).json({ error: "Invalid audit path" });
            }

            if (isExcludedRelativePath(auditRoot, targetPath, excludedFolders)) {
                return res.status(404).json({ error: "Audit file not found" });
            }

            if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
                return res.status(404).json({ error: "Audit file not found" });
            }

            if (req.query.download === "1" || req.query.download === "true") {
                return res.download(targetPath, path.basename(targetPath));
            }

            return res.sendFile(targetPath);
        } catch (error) {
            res.status(500).json({
                error: "Failed to open Audit 2026 file",
                detail: error.message
            });
        }
    });

    router.post("/refresh-index", (req, res) => {
        try {
            const index = getIndex(true);
            res.json({
                success: true,
                summary: index.summary,
                updatedAt: index.updatedAt,
                truncated: index.truncated
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: "Failed to refresh Audit 2026 index",
                detail: error.message
            });
        }
    });

    function getIndex(force) {
        const now = Date.now();
        if (!force && indexCache && now - indexCacheBuiltAt < INDEX_TTL_MS) {
            return indexCache;
        }

        if (!fs.existsSync(auditRoot)) {
            throw new Error(`Audit root not available: ${auditRoot}`);
        }

        try {
            indexCache = buildIndex(auditRoot, excludedFolders);
            indexCacheBuiltAt = now;
            lastIndexError = null;
            return indexCache;
        } catch (error) {
            lastIndexError = error;
            throw error;
        }
    }

    return router;
}

function createUnavailableIndexPayload(auditRoot, error) {
    return {
        state: "waiting_pc_bim02",
        retryAfterSeconds: 15,
        message: "Menunggu koneksi PC-BIM02. Data Audit 2026 akan muncul otomatis setelah share tersedia.",
        summary: {
            files: 0,
            folders: 0,
            totalSize: 0,
            totalSizeFormatted: "0 B"
        },
        categories: [],
        documentTypes: [],
        updatedAt: new Date().toISOString(),
        truncated: false,
        root: auditRoot,
        excludedFolders: DEFAULT_EXCLUDED_FOLDERS,
        unavailable: true,
        error: "Audit 2026 source unavailable",
        detail: error ? error.message : `Audit root not available: ${auditRoot}`
    };
}

function createUnavailableBrowsePayload(auditRoot, error) {
    return {
        state: "waiting_pc_bim02",
        retryAfterSeconds: 15,
        message: "Menunggu koneksi PC-BIM02. Explorer Audit 2026 akan aktif setelah share tersedia.",
        path: "",
        breadcrumbs: [{ label: "Audit 2026", path: "" }],
        entries: [],
        totalEntries: 0,
        updatedAt: new Date().toISOString(),
        root: auditRoot,
        unavailable: true,
        error: "Audit 2026 source unavailable",
        detail: error ? error.message : `Audit root not available: ${auditRoot}`
    };
}

function errorFromUnavailableRoot(auditRoot) {
    return new Error(`Audit root not available: ${auditRoot}`);
}

function buildIndex(auditRoot, excludedFolders) {
    const files = [];
    const folders = [];
    const categoriesMap = new Map();
    const typeMap = new Map();
    let truncated = false;

    scanDirectory(auditRoot, auditRoot, excludedFolders, files, folders, () => {
        truncated = true;
        return files.length + folders.length >= MAX_INDEX_ITEMS;
    });

    files.forEach((file) => {
        incrementMap(categoriesMap, file.category || "Root");
        incrementMap(typeMap, file.family || "other");
    });

    return {
        files,
        folders,
        categories: [...categoriesMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((left, right) => left.name.localeCompare(right.name, "id", { sensitivity: "base" })),
        documentTypes: [...typeMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((left, right) => left.name.localeCompare(right.name, "id", { sensitivity: "base" })),
        summary: {
            files: files.length,
            folders: folders.length,
            totalSize: files.reduce((total, file) => total + Number(file.size || 0), 0),
            totalSizeFormatted: formatFileSize(files.reduce((total, file) => total + Number(file.size || 0), 0))
        },
        updatedAt: new Date().toISOString(),
        truncated
    };
}

function scanDirectory(root, currentDir, excludedFolders, files, folders, shouldStop) {
    if (shouldStop()) {
        return;
    }

    let entries = [];
    try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
        return;
    }

    for (const entry of entries) {
        if (shouldStop()) {
            return;
        }

        if (shouldSkipEntry(entry.name, entry.isDirectory(), excludedFolders)) {
            continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            const folderItem = createIndexItem(root, fullPath, true);
            folders.push(folderItem);
            scanDirectory(root, fullPath, excludedFolders, files, folders, shouldStop);
            continue;
        }

        const fileItem = createIndexItem(root, fullPath, false);
        if (fileItem) {
            files.push(fileItem);
        }
    }
}

function createBrowseItem(root, targetPath, entry) {
    const fullPath = path.join(targetPath, entry.name);
    return createIndexItem(root, fullPath, entry.isDirectory());
}

function createIndexItem(root, fullPath, isDirectory) {
    let stat;
    try {
        stat = fs.statSync(fullPath);
    } catch (error) {
        return null;
    }

    const relativePath = normalizeRelativePath(path.relative(root, fullPath));
    const pathParts = relativePath.split("/").filter(Boolean);
    const name = path.basename(fullPath);
    const ext = isDirectory ? "" : path.extname(name).toLowerCase();
    const family = isDirectory ? "folder" : getDocumentFamily(ext);

    return {
        name,
        relativePath,
        networkPath: fullPath,
        parentPath: normalizeRelativePath(path.dirname(relativePath) === "." ? "" : path.dirname(relativePath)),
        category: pathParts[0] || "Root",
        type: isDirectory ? "folder" : "file",
        family,
        extension: ext.replace(".", "") || family,
        size: isDirectory ? null : stat.size,
        sizeFormatted: isDirectory ? "-" : formatFileSize(stat.size),
        modified: stat.mtime.toISOString(),
        modifiedFormatted: stat.mtime.toLocaleString("id-ID"),
        openUrl: isDirectory ? null : `/api/audit-2026/file?path=${encodeURIComponent(relativePath)}`,
        downloadUrl: isDirectory ? null : `/api/audit-2026/file?download=1&path=${encodeURIComponent(relativePath)}`,
        searchText: [
            name,
            relativePath,
            pathParts.join(" "),
            ext.replace(".", ""),
            family
        ].join(" ").toLowerCase()
    };
}

function sortBrowseItems(left, right) {
    if (left.type !== right.type) {
        return left.type === "folder" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "id", { sensitivity: "base", numeric: true });
}

function sortSearchResults(results, sort) {
    const sorted = [...results];
    if (sort === "modified-desc") {
        return sorted.sort((left, right) => new Date(right.modified) - new Date(left.modified));
    }
    if (sort === "modified-asc") {
        return sorted.sort((left, right) => new Date(left.modified) - new Date(right.modified));
    }
    if (sort === "name") {
        return sorted.sort((left, right) => left.name.localeCompare(right.name, "id", { sensitivity: "base", numeric: true }));
    }
    return sorted.sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return left.name.localeCompare(right.name, "id", { sensitivity: "base", numeric: true });
    });
}

function scoreSearchItem(item, query) {
    if (!query) {
        return 1;
    }

    const normalizedQuery = query.toLowerCase();
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const name = item.name.toLowerCase();
    const relativePath = item.relativePath.toLowerCase();
    const category = String(item.category || "").toLowerCase();
    const searchText = item.searchText || "";

    let score = 0;
    if (name === normalizedQuery) score += 120;
    if (name.includes(normalizedQuery)) score += 70;
    if (relativePath.includes(normalizedQuery)) score += 35;
    if (category.includes(normalizedQuery)) score += 20;

    for (const term of terms) {
        if (name.includes(term)) score += 20;
        if (relativePath.includes(term)) score += 10;
        if (searchText.includes(term)) score += 5;
    }

    return score;
}

function matchesCategory(item, category) {
    return !category || category === "all" || item.category === category;
}

function matchesFamily(item, family) {
    return !family || family === "all" || item.family === family || item.extension === family;
}

function getDocumentFamily(ext) {
    for (const [family, extensions] of Object.entries(DOCUMENT_FAMILIES)) {
        if (extensions.includes(ext)) {
            return family;
        }
    }
    return ext ? "other" : "file";
}

function resolveAuditPath(root, requestedPath) {
    const cleanRelativePath = String(requestedPath || "").replace(/^[/\\]+/, "");
    const resolvedRoot = path.resolve(root);
    const resolvedPath = path.resolve(resolvedRoot, cleanRelativePath);
    const rootNormalized = normalizePathForCompare(resolvedRoot);
    const targetNormalized = normalizePathForCompare(resolvedPath);

    if (targetNormalized !== rootNormalized && !targetNormalized.startsWith(`${rootNormalized}/`)) {
        return null;
    }

    return resolvedPath;
}

function isExcludedRelativePath(root, fullPath, excludedFolders) {
    const relativePath = normalizeRelativePath(path.relative(root, fullPath));
    const firstPart = relativePath.split("/").filter(Boolean)[0];
    return firstPart ? excludedFolders.has(normalizeName(firstPart)) : false;
}

function shouldSkipEntry(name, isDirectory, excludedFolders) {
    if (!name || name.startsWith("~$") || name === "Thumbs.db" || name === ".DS_Store") {
        return true;
    }

    return isDirectory && excludedFolders.has(normalizeName(name));
}

function createBreadcrumbs(root, targetPath) {
    const relativePath = normalizeRelativePath(path.relative(root, targetPath));
    const parts = relativePath ? relativePath.split("/").filter(Boolean) : [];
    const breadcrumbs = [{ label: "Audit 2026", path: "" }];
    let accumulator = "";

    for (const part of parts) {
        accumulator = accumulator ? `${accumulator}/${part}` : part;
        breadcrumbs.push({ label: part, path: accumulator });
    }

    return breadcrumbs;
}

function normalizeRelativePath(value) {
    return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizePathForCompare(value) {
    return path.resolve(value).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
}

function incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
}

function formatFileSize(bytes) {
    const numericBytes = Number(bytes) || 0;
    if (numericBytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(numericBytes) / Math.log(1024)), units.length - 1);
    const value = numericBytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

module.exports = createAudit2026Routes;
