const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const BASE_DIR = "G:/BIM CENTRAL LEARNING/";

// Fungsi untuk membaca file dalam direktori
const getFiles = (dir, fileTypes) => {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });

    list.forEach(file => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getFiles(fullPath, fileTypes));
        } else if (fileTypes.includes(path.extname(file.name).toLowerCase())) {
            results.push(fullPath);
        }
    });

    return results;
};

// Endpoint untuk mengambil daftar file
router.get("/study/files", (req, res) => {
    try {
        const fileTypes = [".pdf", ".mp4", ".avi", ".mkv", ".txt", ".docx", ".html"];
        const files = getFiles(BASE_DIR, fileTypes);

        res.json({
            success: true,
            files: files.map(f => ({
                name: path.basename(f),
                path: f.replace(BASE_DIR, ""), // Hanya path relatif
            })),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Gagal mengambil daftar file", error });
    }
});

module.exports = router;
