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

    const questionsFilePath = path.join(backendDir, "data", "questions.json");
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

    router.use(express.static(path.join(backendDir, "public")));
    router.use("/data", express.static(path.join(backendDir, "../data")));
    router.use("/img", express.static(path.join(backendDir, "../BC-Learning-Main/img")));
    router.use("/elearning-assets", express.static(path.join(backendDir, "../BC-Learning-Main/elearning-assets")));
    router.use("/plugin-packages", express.static(pluginPackagesDir));
    router.use("/files", express.static(baseDir));

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
