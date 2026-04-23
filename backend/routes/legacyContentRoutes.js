const express = require("express");
const fs = require("fs");
const path = require("path");

function createLegacyContentRoutes({
    baseDir,
    backendDir,
    ensureDirectoryExists,
    getVideoMimeType,
    getViewCount,
    pluginPackagesDir,
    refreshVideoCache,
    thumbnailDir,
    videoCache
}) {
    const router = express.Router();
    const manualBookRootCandidates = [
        path.join(baseDir, "6. Manual Books"),
        path.join(baseDir, "BAHAN PEMBELAJARAN", "MANUAL BOOK"),
        path.join(baseDir, "BIM GUIDANCE & MANUAL BOOKs")
    ];

    function safeDecodeUriComponent(value, rounds = 3) {
        let output = String(value || "");
        for (let i = 0; i < rounds; i++) {
            try {
                const decoded = decodeURIComponent(output);
                if (decoded === output) break;
                output = decoded;
            } catch (error) {
                break;
            }
        }
        return output;
    }

    function formatManualBookSize(bytes) {
        const size = Number(bytes || 0);
        if (!Number.isFinite(size) || size <= 0) return "Ukuran tidak diketahui";
        const units = ["B", "KB", "MB", "GB"];
        let unitIndex = 0;
        let value = size;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    function buildManualBookKeywords(...parts) {
        const stopWords = new Set([
            "manual", "book", "books", "pdf", "dan", "the", "with", "for", "bim", "nke"
        ]);

        const tokenSet = new Set();
        parts
            .filter(Boolean)
            .join(" ")
            .replace(/[()&/_-]+/g, " ")
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean)
            .forEach((token) => {
                const normalized = token.toLowerCase();
                if (normalized.length < 2 || stopWords.has(normalized)) {
                    return;
                }
                tokenSet.add(token);
            });

        return Array.from(tokenSet).slice(0, 12);
    }

    function toManualBookTitle(folderName) {
        return String(folderName || "")
            .replace(/^\d+\.\s*/i, "")
            .replace(/^manual books?\s*-\s*/i, "")
            .replace(/^manual book\s*-\s*/i, "")
            .trim() || "Manual Book";
    }

    function resolveExistingManualBookRoots() {
        return manualBookRootCandidates.filter((candidate) => {
            try {
                return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
            } catch (error) {
                return false;
            }
        });
    }

    function collectPdfFilesRecursive(rootDir, currentDir = rootDir, bucket = []) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        entries.forEach((entry) => {
            if (entry.name.startsWith("~$")) return;

            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                collectPdfFilesRecursive(rootDir, fullPath, bucket);
                return;
            }

            if (path.extname(entry.name).toLowerCase() !== ".pdf") {
                return;
            }

            const stat = fs.statSync(fullPath);
            const relativeFromBase = path.relative(baseDir, fullPath).replace(/\\/g, "/");
            const relativeFromRoot = path.relative(rootDir, fullPath).replace(/\\/g, "/");

            bucket.push({
                name: entry.name,
                relativePath: relativeFromBase,
                sourceRelativePath: relativeFromRoot,
                mediaUrl: `/media/${relativeFromBase.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`,
                size: stat.size,
                sizeLabel: formatManualBookSize(stat.size),
                modifiedAt: stat.mtime.toISOString()
            });
        });

        return bucket;
    }

    function buildManualBooksPayload() {
        const existingRoots = resolveExistingManualBookRoots();
        if (existingRoots.length === 0) {
            return {
                roots: [],
                quickFilters: [],
                groups: []
            };
        }

        const groups = [];

        existingRoots.forEach((rootDir) => {
            const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
            const rootName = path.basename(rootDir);

            rootEntries
                .filter((entry) => entry.isDirectory())
                .forEach((entry) => {
                    const groupDir = path.join(rootDir, entry.name);
                    const files = collectPdfFilesRecursive(rootDir, groupDir, [])
                        .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

                    if (files.length === 0) {
                        return;
                    }

                    const displayTitle = toManualBookTitle(entry.name);
                    groups.push({
                        sourceRoot: rootName,
                        folderName: entry.name,
                        displayTitle,
                        description: `${files.length} PDF tersedia di ${displayTitle}.`,
                        keywords: buildManualBookKeywords(rootName, entry.name, ...files.map((file) => file.name)),
                        fileCount: files.length,
                        files
                    });
                });
        });

        groups.sort((left, right) => left.displayTitle.localeCompare(right.displayTitle, undefined, { sensitivity: "base" }));

        return {
            roots: existingRoots.map((rootDir) => path.relative(baseDir, rootDir).replace(/\\/g, "/")),
            quickFilters: groups.map((group) => group.displayTitle),
            groups
        };
    }

    function normalizeComparablePath(targetPath) {
        return path.resolve(targetPath).replace(/\\/g, "/").toLowerCase();
    }

    function resolveLegacyRequestedPath(requestedPath) {
        const rawValue = String(requestedPath || "").trim();
        if (!rawValue) {
            return path.resolve(baseDir);
        }

        let decodedValue = safeDecodeUriComponent(rawValue).replace(/\\/g, "/").trim();
        if (!decodedValue) {
            return path.resolve(baseDir);
        }

        if (/^\/+files\//i.test(decodedValue)) {
            decodedValue = decodedValue.replace(/^\/+files\//i, "");
        } else if (/^files\//i.test(decodedValue)) {
            decodedValue = decodedValue.replace(/^files\//i, "");
        }

        const isAbsoluteWindowsPath = /^[a-zA-Z]:\//.test(decodedValue);
        const resolvedPath = isAbsoluteWindowsPath
            ? path.resolve(decodedValue)
            : path.resolve(baseDir, decodedValue.replace(/^\/+/, ""));

        const normalizedBaseDir = normalizeComparablePath(baseDir);
        const normalizedResolvedPath = normalizeComparablePath(resolvedPath);

        if (!normalizedResolvedPath.startsWith(normalizedBaseDir)) {
            return null;
        }

        return resolvedPath;
    }

    function readLegacyFolderContents(directoryPath) {
        const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
        const folders = [];
        const files = [];

        entries.forEach((entry) => {
            if (entry.name.startsWith("~$")) {
                return;
            }

            const fullPath = path.join(directoryPath, entry.name);
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

            if (entry.isDirectory()) {
                let previewFiles = [];
                let itemCount = 0;

                try {
                    const childEntries = fs.readdirSync(fullPath, { withFileTypes: true })
                        .filter((child) => !child.name.startsWith("~$"));
                    itemCount = childEntries.length;
                    previewFiles = childEntries
                        .filter((child) => child.isFile())
                        .slice(0, 3)
                        .map((child) => child.name);
                } catch (error) {
                    previewFiles = [];
                    itemCount = 0;
                }

                folders.push({
                    name: entry.name,
                    path: relativePath,
                    count: itemCount,
                    files: previewFiles,
                    isFolder: true
                });
                return;
            }

            const stat = fs.statSync(fullPath);
            files.push({
                name: entry.name,
                path: relativePath,
                relativePath,
                type: path.extname(entry.name).replace(".", "").toLowerCase() || "file",
                size: stat.size,
                modified: stat.mtime.toISOString(),
                isFolder: false
            });
        });

        folders.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
        files.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

        return {
            path: path.relative(baseDir, directoryPath).replace(/\\/g, "/"),
            folders,
            files
        };
    }

    const questionsFilePath = path.join(backendDir, "data", "questions.json");
    const bimFormSubmissionsPath = path.join(backendDir, "data", "bim-form-submissions.json");
    if (!fs.existsSync(path.join(backendDir, "data"))) {
        fs.mkdirSync(path.join(backendDir, "data"), { recursive: true });
    }

    router.get("/api/questions", (req, res) => {
        try {
            ensureDirectoryExists(path.dirname(questionsFilePath));
            const data = fs.existsSync(questionsFilePath)
                ? JSON.parse(fs.readFileSync(questionsFilePath, "utf8"))
                : [];
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: "Gagal membaca pertanyaan", detail: err.message });
        }
    });

    router.post("/api/questions", (req, res) => {
        try {
            ensureDirectoryExists(path.dirname(questionsFilePath));

            let questions = [];
            if (fs.existsSync(questionsFilePath)) {
                questions = JSON.parse(fs.readFileSync(questionsFilePath, "utf8"));
            }

            const newId = questions.length > 0 ? Math.max(...questions.map((q) => q.id || 0)) + 1 : 1;
            const newQuestion = {
                id: newId,
                ...req.body
            };

            questions.push(newQuestion);
            fs.writeFileSync(questionsFilePath, JSON.stringify(questions, null, 2), "utf8");

            console.log(`✅ New question submitted: ${newQuestion.pertanyaan.substring(0, 50)}...`);
            res.status(201).json({
                success: true,
                message: "Pertanyaan berhasil disimpan!",
                questionId: newId
            });
        } catch (err) {
            console.error("❌ Error saving question:", err);
            res.status(500).json({ error: "Gagal menyimpan pertanyaan", detail: err.message });
        }
    });

    router.put("/api/questions/:id", (req, res) => {
        try {
            ensureDirectoryExists(path.dirname(questionsFilePath));

            if (!fs.existsSync(questionsFilePath)) {
                return res.status(404).json({ error: "File pertanyaan tidak ditemukan" });
            }

            const questions = JSON.parse(fs.readFileSync(questionsFilePath, "utf8"));
            const questionId = parseInt(req.params.id, 10);
            const questionIndex = questions.findIndex((q) => q.id === questionId);

            if (questionIndex === -1) {
                return res.status(404).json({ error: "Pertanyaan tidak ditemukan" });
            }

            questions[questionIndex] = {
                ...questions[questionIndex],
                ...req.body
            };

            fs.writeFileSync(questionsFilePath, JSON.stringify(questions, null, 2), "utf8");

            console.log(`✅ Question ${questionId} updated with answer`);
            res.json({ success: true, message: "Jawaban berhasil disimpan!" });
        } catch (err) {
            console.error("❌ Error updating answer:", err);
            res.status(500).json({ error: "Gagal menyimpan jawaban", detail: err.message });
        }
    });

    router.delete("/api/questions/:id", (req, res) => {
        try {
            ensureDirectoryExists(path.dirname(questionsFilePath));

            if (!fs.existsSync(questionsFilePath)) {
                return res.status(404).json({ error: "File pertanyaan tidak ditemukan" });
            }

            const questions = JSON.parse(fs.readFileSync(questionsFilePath, "utf8"));
            const questionId = parseInt(req.params.id, 10);
            const filteredQuestions = questions.filter((q) => q.id !== questionId);

            if (filteredQuestions.length === questions.length) {
                return res.status(404).json({ error: "Pertanyaan tidak ditemukan" });
            }

            fs.writeFileSync(questionsFilePath, JSON.stringify(filteredQuestions, null, 2), "utf8");

            console.log(`✅ Question ${questionId} deleted`);
            res.json({ success: true, message: "Pertanyaan berhasil dihapus!" });
        } catch (err) {
            console.error("❌ Error deleting question:", err);
            res.status(500).json({ error: "Gagal menghapus pertanyaan", detail: err.message });
        }
    });

    router.use("/videos", express.static(baseDir));
    router.use("/thumbnails", express.static(thumbnailDir));

    router.get("/api/video-stream/:encodedPath(*)", (req, res) => {
        try {
            const encodedPath = req.params.encodedPath;
            const decodedPath = decodeURIComponent(encodedPath);
            const fullPath = path.join(baseDir, decodedPath);

            console.log("🎬 Video stream request:", fullPath);

            const normalizedFullPath = path.resolve(fullPath);
            const normalizedBaseDir = path.resolve(baseDir);

            if (normalizedFullPath.includes("..") || !normalizedFullPath.startsWith(normalizedBaseDir)) {
                console.error("🚫 Security violation: Path traversal attempt");
                console.error("   Requested path:", normalizedFullPath);
                console.error("   Base directory:", normalizedBaseDir);
                return res.status(403).json({ error: "Access denied" });
            }

            if (!fs.existsSync(fullPath)) {
                console.error("❌ Video file not found:", fullPath);
                return res.status(404).json({ error: "Video file not found" });
            }

            const stat = fs.statSync(fullPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                if (start >= fileSize) {
                    res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
                    return;
                }

                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(fullPath, { start, end });

                const head = {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunksize,
                    "Content-Type": getVideoMimeType(fullPath),
                    "Cache-Control": "public, max-age=31536000"
                };

                res.writeHead(206, head);
                file.pipe(res);
            } else {
                const head = {
                    "Content-Length": fileSize,
                    "Content-Type": getVideoMimeType(fullPath),
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "public, max-age=31536000",
                    ETag: `"${path.basename(fullPath)}-${fileSize}-${fs.statSync(fullPath).mtime.getTime()}"`
                };

                res.writeHead(200, head);
                fs.createReadStream(fullPath).pipe(res);
            }

            console.log(`📹 Video stream delivered: ${path.basename(fullPath)} (${range ? "partial" : "full"})`);
        } catch (error) {
            console.error("❌ Video streaming error:", error);
            res.status(500).json({ error: "Failed to stream video", detail: error.message });
        }
    });

    router.get("/api/videoViews/:videoId", (req, res) => {
        try {
            const { videoId } = req.params;

            if (!videoId) {
                return res.status(400).json({ error: "Video ID is required" });
            }

            const viewCount = getViewCount(videoId);
            console.log(`👁️ Retrieved view count for ${videoId}: ${viewCount}`);
            res.send(viewCount.toString());
        } catch (error) {
            console.error("❌ Error getting view count:", error);
            res.status(500).json({ error: "Failed to get view count", detail: error.message });
        }
    });

    router.get("/api/tutorials", async (req, res) => {
        try {
            if (!videoCache.tutorials || Date.now() - videoCache.lastUpdated > videoCache.cacheDuration) {
                await refreshVideoCache();
            }

            const videos = [...videoCache.tutorials];
            const sortBy = req.query.sort || "viewCount";
            if (sortBy === "viewCount") {
                videos.sort((a, b) => b.viewCount - a.viewCount);
            } else if (sortBy === "name") {
                videos.sort((a, b) => a.name.localeCompare(b.name));
            }

            console.log(`📹 Served ${videos.length} videos from cache`);
            res.json(videos);
        } catch (error) {
            console.error("❌ Error serving tutorials:", error);
            res.status(500).json({ error: "Gagal membaca daftar video" });
        }
    });

    router.get("/api/courses", async (req, res) => {
        try {
            if (!videoCache.courses || Date.now() - videoCache.lastUpdated > videoCache.cacheDuration) {
                await refreshVideoCache();
            }

            console.log(`📚 Served ${videoCache.courses.length} course categories from cache`);
            res.json(videoCache.courses);
        } catch (error) {
            console.error("❌ Error serving courses:", error);
            res.status(500).json({ error: "Gagal membuat daftar courses" });
        }
    });

    router.get("/api/manual-books", (req, res) => {
        try {
            const payload = buildManualBooksPayload();
            if (!payload.groups.length) {
                return res.status(404).json({
                    error: "Manual books source directory not found or contains no PDF files"
                });
            }

            return res.json(payload);
        } catch (error) {
            console.error("❌ Failed to build manual books payload:", error);
            return res.status(500).json({
                error: "Failed to load manual books",
                detail: error.message
            });
        }
    });

    router.post("/api/save-bim-form", (req, res) => {
        try {
            ensureDirectoryExists(path.dirname(bimFormSubmissionsPath));

            const existingEntries = fs.existsSync(bimFormSubmissionsPath)
                ? JSON.parse(fs.readFileSync(bimFormSubmissionsPath, "utf8"))
                : [];

            const nextEntry = {
                id: `bim-form-${Date.now()}`,
                submittedAt: new Date().toISOString(),
                data: req.body || {}
            };

            existingEntries.push(nextEntry);
            fs.writeFileSync(bimFormSubmissionsPath, JSON.stringify(existingEntries, null, 2), "utf8");

            return res.json({
                success: true,
                message: "BIM form saved successfully",
                id: nextEntry.id
            });
        } catch (error) {
            console.error("Failed to save BIM form submission:", error);
            return res.status(500).json({
                success: false,
                error: "Failed to save BIM form"
            });
        }
    });

    router.get(["/api/get-folder", "/api/folder"], (req, res) => {
        try {
            const directoryPath = resolveLegacyRequestedPath(req.query.path);
            if (!directoryPath) {
                return res.status(403).json({ error: "Access denied" });
            }

            if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
                return res.status(404).json({ error: "Folder not found" });
            }

            return res.json(readLegacyFolderContents(directoryPath));
        } catch (error) {
            console.error("Failed to read legacy folder contents:", error);
            return res.status(500).json({
                error: "Failed to read folder",
                detail: error.message
            });
        }
    });

    router.get("/api/file", (req, res) => {
        try {
            const targetPath = resolveLegacyRequestedPath(req.query.path);
            if (!targetPath) {
                return res.status(403).json({ error: "Access denied" });
            }

            if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
                return res.status(404).json({ error: "File not found" });
            }

            return res.sendFile(targetPath);
        } catch (error) {
            console.error("Failed to serve legacy file:", error);
            return res.status(500).json({
                error: "Failed to open file",
                detail: error.message
            });
        }
    });

    router.get("/preview", (req, res) => {
        const fileValue = req.query.file || req.query.path;
        if (!fileValue) {
            return res.status(400).json({ error: "file parameter is required" });
        }

        return res.redirect(`/api/file?path=${encodeURIComponent(String(fileValue))}`);
    });

    router.use("/public", express.static(path.join(backendDir, "../BC-Learning-Main/public")));
    router.use(express.static(path.join(backendDir, "..", "public")));
    router.use("/logos", express.static(path.join(backendDir, "..", "public", "logos")));
    router.use("/data", express.static(path.join(backendDir, "../data")));
    router.use("/img", express.static(path.join(backendDir, "../BC-Learning-Main/img")));
    router.use("/elearning-assets", express.static(path.join(backendDir, "../BC-Learning-Main/elearning-assets")));
    router.use("/plugin-packages", express.static(pluginPackagesDir));
    router.use("/files", express.static(baseDir));

    router.get("/favicon.ico", (req, res) => {
        res.sendFile(path.join(backendDir, "..", "public", "logos", "icon_bcl.ico"));
    });

    router.get("/files/:filePath", (req, res) => {
        const filePath = path.join(baseDir, req.params.filePath);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Error:", err);
                res.status(404).send("File tidak ditemukan.");
            }
        });
    });

    router.get("/api/files", (req, res) => {
        try {
            const results = [];

            function scanDirectory(directory) {
                const items = fs.readdirSync(directory, { withFileTypes: true });

                items.forEach((item) => {
                    const itemPath = path.join(directory, item.name);
                    if (item.isDirectory()) {
                        scanDirectory(itemPath);
                    } else {
                        results.push({
                            name: item.name,
                            path: `/files/${path.relative(baseDir, itemPath).replace(/\\/g, "/")}`,
                            type: path.extname(item.name).substring(1) || "unknown"
                        });
                    }
                });
            }

            scanDirectory(baseDir);
            res.json(results);
        } catch (error) {
            console.error("Gagal membaca direktori:", error);
            res.status(500).json({ error: "Gagal membaca direktori" });
        }
    });

    return router;
}

module.exports = createLegacyContentRoutes;
