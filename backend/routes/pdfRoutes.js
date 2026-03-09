const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const PDF_DIRECTORY = path.resolve("G:/BIM CENTRAL LEARNING/"); // Pastikan absolute path

// Fungsi rekursif untuk mencari semua PDF di subfolder
const getAllPDFs = (dir, baseDir = PDF_DIRECTORY) => {
    let results = [];
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            // Jika folder, lakukan pencarian rekursif
            results = results.concat(getAllPDFs(filePath, baseDir));
        } else if (file.toLowerCase().endsWith(".pdf")) {
            // Buat path relatif agar sesuai dengan struktur folder asli
            let relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/"); // Pastikan format path cocok untuk URL
            results.push({
                name: file,
                size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                path: `/pdfs/${encodeURIComponent(relativePath)}` // Kirim path relatif
            });
        }
    });

    return results;
};


// Route untuk mendapatkan semua PDF dari semua subfolder
router.get("/api/pdf", (req, res) => {
    try {
        const pdfFiles = getAllPDFs(PDF_DIRECTORY);
        res.json(pdfFiles);
    } catch (error) {
        console.error("❌ Error membaca file PDF:", error);
        res.status(500).json({ error: "Gagal membaca file PDF" });
    }
});

// Middleware untuk menyajikan file PDF dengan keamanan lebih
router.use("/pdfs", (req, res, next) => {
    const requestedFile = path.join(PDF_DIRECTORY, req.url);

    if (!requestedFile.startsWith(PDF_DIRECTORY)) {
        return res.status(403).json({ error: "Akses ditolak" });
    }

    res.sendFile(requestedFile, err => {
        if (err) {
            console.error("❌ Gagal mengirim file:", err);
            res.status(err.status || 500).json({ error: "File tidak ditemukan atau tidak dapat diakses" });
        }
    });
});

// Middleware untuk menyajikan file PDF dengan keamanan lebih
router.get("/pdfs/*", (req, res) => {
    const relativePath = decodeURIComponent(req.params[0]); // Ambil path relatif yang dikirim dari frontend
    const requestedFile = path.join(PDF_DIRECTORY, relativePath);
    requestedFile = path.normalize(requestedFile); // Normalisasi path agar cocok dengan sistem operasi

    console.log("📂 Mencoba mengakses file:", requestedFile); // Debugging

    fs.access(requestedFile, fs.constants.F_OK, (err) => {
        if (err) {
            console.error("❌ File tidak ditemukan:", requestedFile);
            return res.status(404).json({ error: "File tidak ditemukan atau tidak dapat diakses" });
        }
        res.sendFile(requestedFile);
    });
});



module.exports = router;
