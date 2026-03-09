const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFParse = require('pdf-parse');
const { Pool } = require('pg');
const { requireAdmin, requireAuthenticated, getRequestUser } = require('../utils/auth');

const router = express.Router();

const LEARNING_MATERIALS_FILE = path.join(__dirname, '../learning-materials.json');
const PDF_DISPLAY_CONFIG_FILE = path.join(__dirname, '../pdf-display-config.json');

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD || 'secure_password_2025',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pgPool.on('error', (err) => {
    console.warn('PDF display PostgreSQL pool error:', err.message);
});

let pdfReadTableEnsured = false;

async function ensurePdfReadTable() {
    if (pdfReadTableEnsured) return;

    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS pdf_material_reads (
            id BIGSERIAL PRIMARY KEY,
            material_id TEXT NOT NULL,
            user_id TEXT,
            user_email TEXT,
            source TEXT DEFAULT 'courses',
            opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_pdf_material_reads_material_id
        ON pdf_material_reads(material_id)
    `);

    await pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_pdf_material_reads_user_id
        ON pdf_material_reads(user_id)
    `);

    await pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_pdf_material_reads_opened_at
        ON pdf_material_reads(opened_at)
    `);

    pdfReadTableEnsured = true;
}

async function getReadCountMap(materialIds) {
    const ids = Array.isArray(materialIds)
        ? materialIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

    const readCountMap = {};
    if (ids.length === 0) return readCountMap;

    try {
        await ensurePdfReadTable();

        const result = await pgPool.query(
            `
                SELECT material_id, COUNT(*)::INT AS read_count
                FROM pdf_material_reads
                WHERE material_id = ANY($1::text[])
                GROUP BY material_id
            `,
            [ids]
        );

        result.rows.forEach((row) => {
            readCountMap[String(row.material_id)] = Number(row.read_count) || 0;
        });
    } catch (error) {
        console.warn('Failed to load PDF read counts from PostgreSQL:', error.message);
    }

    return readCountMap;
}

function normalizePageCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveMaterialFileSystemPath(material) {
    const materialFilePath = material.filePath || material.file_path || '';
    if (!materialFilePath) return null;

    if (materialFilePath.startsWith('/elearning-assets/materials/')) {
        const filename = materialFilePath.replace('/elearning-assets/materials/', '');
        return path.join(__dirname, '../../BC-Learning-Main/elearning-assets/materials', filename);
    }

    if (materialFilePath.startsWith('/BC-Learning-Main/')) {
        const relativePath = materialFilePath.replace('/BC-Learning-Main/', '');
        return path.join(__dirname, '../../BC-Learning-Main', relativePath);
    }

    if (materialFilePath.startsWith('/elearning-assets/')) {
        const relativePath = materialFilePath.replace('/elearning-assets/', '');
        return path.join(__dirname, '../../BC-Learning-Main/elearning-assets', relativePath);
    }

    if (path.isAbsolute(materialFilePath)) {
        return materialFilePath;
    }

    return path.join(__dirname, '../', materialFilePath);
}

async function getPdfPageCount(fileSystemPath) {
    if (!fileSystemPath || !fs.existsSync(fileSystemPath)) return null;

    const pdfBuffer = fs.readFileSync(fileSystemPath);
    const parser = new PDFParse.PDFParse({ data: pdfBuffer });

    try {
        const info = await parser.getInfo();
        const total = normalizePageCount(info?.total);
        if (total) {
            return total;
        }

        const textResult = await parser.getText();
        return normalizePageCount(textResult?.total);
    } catch (error) {
        console.warn(`Failed to read PDF page count for ${fileSystemPath}: ${error.message}`);
        return null;
    } finally {
        await parser.destroy();
    }
}

function readJsonSafe(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
}

function writeJsonSafe(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function isPdfMaterial(material) {
    if (!material) return false;
    const type = (material.type || '').toLowerCase();
    if (type === 'pdf') return true;

    const filePath = material.filePath || material.file_path || '';
    return filePath.toLowerCase().endsWith('.pdf');
}

function normalizeMaterial(material, selectedSet, readCountMap = {}) {
    const id = material.id != null ? material.id.toString() : '';
    const size = material.size || material.fileSize || material.file_size || 0;

    return {
        id: id,
        title: material.title || material.name || 'Untitled',
        description: material.description || material.summary || '',
        category: material.category || material.category_name || 'general',
        level: material.level || material.bimLevel || 'beginner',
        pageCount: material.pageCount || material.pages || null,
        size: size,
        language: material.language || 'id',
        filePath: material.filePath || material.file_path || null,
        thumbnailPath: material.thumbnailPath || material.thumbnail_path || null,
        readCount: Number(readCountMap[id] || 0),
        displayOnCourses: !!material.displayOnCourses,
        selected: selectedSet ? selectedSet.has(id) : false
    };
}

function getMaterialsData() {
    return readJsonSafe(LEARNING_MATERIALS_FILE, { materials: [], metadata: {} });
}

function getDisplayConfig() {
    return readJsonSafe(PDF_DISPLAY_CONFIG_FILE, {
        selectedPDFs: [],
        settings: {
            autoUpdate: true,
            maxPDFs: 50,
            showCategories: true
        },
        lastUpdated: null
    });
}

// Admin: list PDFs with selection status
router.get('/admin/pdf-display/list', requireAdmin, async (req, res) => {
    const materialsData = getMaterialsData();
    const config = getDisplayConfig();
    const selectedSet = new Set((config.selectedPDFs || []).map(id => id.toString()));

    const pdfs = [];
    let materialsUpdated = false;

    for (const material of (materialsData.materials || [])) {
        if (!isPdfMaterial(material)) continue;

        let pageCount = normalizePageCount(material.pageCount || material.pages);
        if (!pageCount) {
            const fileSystemPath = resolveMaterialFileSystemPath(material);
            const computedPageCount = await getPdfPageCount(fileSystemPath);
            if (computedPageCount) {
                material.pageCount = computedPageCount;
                pageCount = computedPageCount;
                materialsUpdated = true;
            }
        } else if (material.pageCount !== pageCount) {
            material.pageCount = pageCount;
            materialsUpdated = true;
        }

        pdfs.push(normalizeMaterial(material, selectedSet));
    }

    if (materialsUpdated) {
        materialsData.materials = materialsData.materials || [];
        writeJsonSafe(LEARNING_MATERIALS_FILE, materialsData);
    }

    res.json({
        success: true,
        pdfs,
        config,
        count: pdfs.length
    });
});

// Admin: update PDF display selection
router.post('/admin/pdf-display/update', requireAdmin, (req, res) => {
    const selectedPDFIds = Array.isArray(req.body.selectedPDFIds)
        ? req.body.selectedPDFIds.map(id => id.toString())
        : [];

    const config = getDisplayConfig();
    config.selectedPDFs = selectedPDFIds;
    config.lastUpdated = new Date().toISOString();
    writeJsonSafe(PDF_DISPLAY_CONFIG_FILE, config);

    // Also update displayOnCourses flag in learning-materials.json
    const materialsData = getMaterialsData();
    const selectedSet = new Set(selectedPDFIds);
    const materials = materialsData.materials || [];

    materials.forEach(material => {
        if (!isPdfMaterial(material)) return;
        const id = material.id != null ? material.id.toString() : '';
        material.displayOnCourses = selectedSet.has(id);
    });

    materialsData.materials = materials;
    writeJsonSafe(LEARNING_MATERIALS_FILE, materialsData);

    res.json({
        success: true,
        selectedPDFs: selectedPDFIds,
        count: selectedPDFIds.length
    });
});

// Public: selected PDFs for courses page
router.get('/pdf-display/selected', (req, res) => {
    (async () => {
        const materialsData = getMaterialsData();
        const config = getDisplayConfig();
        const selectedIds = (config.selectedPDFs || []).map(id => id.toString());
        const selectedSet = new Set(selectedIds);

        const pdfMaterials = (materialsData.materials || []).filter(isPdfMaterial);
        const readCountMap = await getReadCountMap(
            pdfMaterials.map((material) => (material.id != null ? material.id.toString() : ''))
        );

        const allPdfs = pdfMaterials.map(material => normalizeMaterial(material, null, readCountMap));

        let selectedPdfs = allPdfs.filter(pdf => selectedSet.has(pdf.id));
        if (selectedIds.length > 0 && selectedPdfs.length > 0) {
            const orderIndex = new Map(selectedIds.map((id, index) => [id.toString(), index]));
            selectedPdfs.sort((a, b) => {
                const aIndex = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
                const bIndex = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
                return aIndex - bIndex;
            });
        }

        if (selectedPdfs.length === 0) {
            selectedPdfs = allPdfs.filter(pdf => pdf.displayOnCourses);
        }

        if (selectedPdfs.length === 0) {
            selectedPdfs = allPdfs;
        }

        res.json({
            success: true,
            selectedPDFs: selectedIds,
            pdfs: selectedPdfs,
            count: selectedPdfs.length
        });
    })().catch((error) => {
        console.error('Failed to load selected PDF display list with read counts:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to load selected PDF list'
        });
    });
});

router.post('/pdf-display/read/:materialId', requireAuthenticated, async (req, res) => {
    try {
        const materialId = String(req.params.materialId || '').trim();
        if (!materialId) {
            return res.status(400).json({
                success: false,
                error: 'Material ID is required'
            });
        }

        const materialsData = getMaterialsData();
        const existingMaterial = (materialsData.materials || []).find((material) => {
            const id = material && material.id != null ? String(material.id) : '';
            return id === materialId && isPdfMaterial(material);
        });

        if (!existingMaterial) {
            return res.status(404).json({
                success: false,
                error: 'PDF material not found'
            });
        }

        await ensurePdfReadTable();

        const authUser = req.authUser || getRequestUser(req) || {};
        const userId = authUser.id != null ? String(authUser.id) : null;
        const userEmail = authUser.email ? String(authUser.email) : null;
        const source = String(req.body?.source || 'courses').slice(0, 50);

        await pgPool.query(
            `
                INSERT INTO pdf_material_reads (material_id, user_id, user_email, source)
                VALUES ($1, $2, $3, $4)
            `,
            [materialId, userId, userEmail, source]
        );

        const totalResult = await pgPool.query(
            `
                SELECT COUNT(*)::INT AS read_count
                FROM pdf_material_reads
                WHERE material_id = $1
            `,
            [materialId]
        );

        const userResult = await pgPool.query(
            `
                SELECT COUNT(*)::INT AS user_read_count
                FROM pdf_material_reads
                WHERE material_id = $1
                  AND ($2::text IS NULL OR user_id = $2)
            `,
            [materialId, userId]
        );

        return res.json({
            success: true,
            materialId,
            readCount: Number(totalResult.rows[0]?.read_count || 0),
            userReadCount: Number(userResult.rows[0]?.user_read_count || 0)
        });
    } catch (error) {
        console.error('Failed to track PDF read:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to track PDF read'
        });
    }
});

module.exports = router;
