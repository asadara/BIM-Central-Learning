const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getRequestUser } = require('../utils/auth');
const { resolveAccessProfile } = require('../utils/userAccess');

const router = express.Router();

// Path yang benar untuk folder di drive G:

// Helper: Group files by extension recursively
function groupFilesByFormat(dir, groups = {}) {
    const excludedExts = [
        'ac', 'acf', 'arbfp1', 'arbvp1', 'asd', 'bak', 'bat', 'cfg', 'clc', 'cli', 'cmi', 'conf', 'dat', 'dll', 'dot', 'dotx', 'dst', 'extra', 'fbk', 'gfs', 'glslesf', 'glslesv', 'glsllib', 'h', 'htm', 'html', 'ini', 'inp', 'log', 'mb', 'msi', 'mtl', 'nfo', 'nsh', 'ps_2_0', 'qm', 'rcc', 'reg', 'sis', 'slog', 'tfw', 'tmp', 'url', 'vs_2_0', 'vsd', 'vss', 'wkt', 'db'
    ];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const ext = path.extname(file).toLowerCase().replace('.', '');
        if (file.startsWith('~$') || excludedExts.includes(ext)) return;
        if (stat.isDirectory()) {
            groupFilesByFormat(filePath, groups);
        } else {
            if (!ext) return;
            if (!groups[ext]) groups[ext] = [];
            groups[ext].push({
                name: file,
                path: filePath.replace(/\\/g, '/'),
                relPath: path.relative(folderPath, filePath).replace(/\\/g, '/'),
                size: stat.size,
                lastModified: stat.mtime,
            });
        }
    });
    return groups;
}

// API: Grouped BIM library files by format
router.get('/library-groups', (req, res) => {
    try {
        const groups = groupFilesByFormat(folderPath);
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: 'Gagal membaca dan mengelompokkan file library' });
    }
});
const folderPath = "G:\\BIM CENTRAL LEARNING"; // Perbaiki path

function normalizePathValue(targetPath) {
    return path.resolve(targetPath).replace(/\\/g, '/').toLowerCase();
}

function resolveLibraryFilePath(relativePath) {
    const safeRelativePath = String(relativePath || '').replace(/^[/\\]+/, '');
    if (!safeRelativePath) {
        return null;
    }

    const resolvedPath = path.resolve(folderPath, safeRelativePath);
    const rootNormalized = normalizePathValue(folderPath);
    const resolvedNormalized = normalizePathValue(resolvedPath);

    if (!resolvedNormalized.startsWith(rootNormalized)) {
        return null;
    }

    return resolvedPath;
}

router.get('/library-download', async (req, res) => {
    try {
        const requestedPath = String(req.query.path || '').trim();
        if (!requestedPath) {
            return res.status(400).json({ error: 'path parameter is required' });
        }

        const filePath = resolveLibraryFilePath(requestedPath);
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return res.status(404).json({ error: 'Library file not found' });
        }

        const authUser = getRequestUser(req);
        if (!authUser) {
            return res.status(401).json({ error: 'Authentication required for library download' });
        }

        const accessProfile = await resolveAccessProfile(authUser);
        if (!authUser.isAdmin && !accessProfile.libraryDownloadAccess) {
            return res.status(403).json({ error: 'Library download access is not enabled for this account' });
        }

        return res.download(filePath, path.basename(filePath));
    } catch (error) {
        console.error('Error serving protected library download:', error);
        return res.status(500).json({ error: 'Failed to download library file' });
    }
});


// Fungsi untuk membaca folder dan subfolder
const getFilesRecursive = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // Filter: Hilangkan file .db dan file yang diawali ~$ 
        if (file.endsWith('.db') || file.startsWith('~$')) {
            return;
        }

        results.push({
            name: file,
            type: stat.isDirectory() ? 'folder' : 'file'
        });

        //if (stat && stat.isDirectory()) {
        //results.push({
        //name: file,
        //type: 'folder',
        //children: getFilesRecursive(filePath),
        //});
        //} else {
        //results.push({
        //name: file,
        //type: 'file',
        //});
        //}
    });

    return results;
};

// API untuk mendapatkan struktur folder
router.get('/files', (req, res) => {
    try {
        const fileTree = getFilesRecursive(folderPath);
        res.json(fileTree);
    } catch (err) {
        res.status(500).json({ error: "Gagal membaca folder" });
    }
});

// API untuk mendapatkan daftar file di folder G:\BIM CENTRAL LEARNING
router.get('/files', (req, res) => {
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: "Gagal membaca folder" });
        }

        //Filter file yang perlu disembunyikan
        const filteredFiles = files.filter(file => {
            //Daftar extensi yg ingin disembunyikan
            const hiddenExtensions = ['.db', '.bat', '.cmd', '.exe', '.ps1'];

            //Sembunyikan jika:
            return !file.startsWith('~$') &&  //File sementara Microsoft Office
                !hiddenExtensions.some(ext => file.toLowerCase().endsWith(ext)); //File dengan ekstensi tertentu
        })

        res.json({ files: filteredFiles });
    });
});

// Konfigurasi penyimpanan file di folder uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/')); // Simpan file di folder 'uploads'
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Format nama file unik
    }
});

const upload = multer({ storage });

// API untuk upload file ke /uploads
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Harap unggah file' });
    }
    res.json({
        message: 'File berhasil diunggah',
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
    });
});

// API untuk mendapatkan daftar folder atau file dari path tertentu
router.get('/files', (req, res) => {
    let requestedPath = req.query.path || "";
    let fullPath = path.join(baseFolderPath, requestedPath);

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        return res.status(400).json({ error: "Folder tidak ditemukan" });
    }

    try {
        const fileTree = getFilesRecursive(fullPath);
        res.json({ path: requestedPath, files: fileTree });
    } catch (err) {
        res.status(500).json({ error: "Gagal membaca folder" });
    }
});

module.exports = router;
