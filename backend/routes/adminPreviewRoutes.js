const express = require("express");
const fs = require("fs");
const path = require("path");

function createAdminPreviewRoutes({ getVideoMimeType }) {
    const router = express.Router();

    router.get("/api/admin/preview-media", (req, res) => {
        const { path: filePath } = req.query;

        if (!filePath) {
            return res.status(400).json({ error: "File path is required" });
        }

        try {
            const allowedPaths = ["G:/", "\\\\pc-bim02\\"];
            const isAllowed = allowedPaths.some((allowedPath) => filePath.startsWith(allowedPath));

            if (!isAllowed) {
                return res.status(403).json({ error: "Access denied to this path" });
            }

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: "File not found" });
            }

            const ext = path.extname(filePath).toLowerCase();
            const videoTypes = [".mp4", ".mov", ".avi", ".webm", ".mkv"];
            const imageTypes = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

            if (videoTypes.includes(ext)) {
                const stat = fs.statSync(filePath);
                const fileSize = stat.size;
                const range = req.headers.range;

                res.setHeader("Content-Type", getVideoMimeType(filePath));
                res.setHeader("Accept-Ranges", "bytes");

                if (range) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                    const chunksize = (end - start) + 1;

                    res.status(206);
                    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
                    res.setHeader("Content-Length", chunksize);

                    const stream = fs.createReadStream(filePath, { start, end });
                    stream.pipe(res);
                } else {
                    res.setHeader("Content-Length", fileSize);
                    fs.createReadStream(filePath).pipe(res);
                }
            } else if (imageTypes.includes(ext)) {
                const contentType = ext === ".jpg" ? "image/jpeg"
                    : ext === ".jpeg" ? "image/jpeg"
                        : ext === ".png" ? "image/png"
                            : ext === ".gif" ? "image/gif"
                                : "image/webp";

                res.setHeader("Content-Type", contentType);
                res.setHeader("Cache-Control", "public, max-age=3600");

                fs.createReadStream(filePath).pipe(res);
            } else {
                res.status(400).json({ error: "Unsupported file type for preview" });
            }
        } catch (error) {
            console.error("Error serving media preview:", error);
            res.status(500).json({ error: "Failed to serve media preview", detail: error.message });
        }
    });

    return router;
}

module.exports = createAdminPreviewRoutes;
