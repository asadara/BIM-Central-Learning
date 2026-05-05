const express = require("express");
const fs = require("fs");
const path = require("path");
const { LEARNING_MATERIALS_FILE, loadLearningMaterialsData, resolveMaterialFileSystemPath } = require("../services/learningMaterialsSource");
const {
    generatePDFThumbnailWithPdfJs,
    generatePDFThumbnailWithPoppler,
    generatePDFThumbnailWithImageMagick,
    generatePDFThumbnailWithPuppeteer,
    isLikelyInvalidThumbnail
} = require("../scripts/generate-pdf-thumbnails");

const router = express.Router();
const THUMBNAILS_DIR = path.join(__dirname, "../public/thumbnails/pdf");

function writeJsonSafe(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizePageCount(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isActiveMaterial(material) {
    return material && (material.status === "active" || material.status === undefined || material.status === null);
}

function matchesMaterialId(material, requestedId) {
    return material && (
        material.id == requestedId ||
        material.id === Number.parseInt(requestedId, 10) ||
        String(material.id) === String(requestedId)
    );
}

function normalizeResponseMaterial(material) {
    return {
        ...material,
        id: material && material.id != null ? String(material.id) : "",
        pageCount: material.pageCount || material.pages || null,
        filePath: material.filePath || material.file_path || null
    };
}

async function getMaterialsData() {
    return loadLearningMaterialsData();
}

router.get("/", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const activeMaterials = (materialsData.materials || [])
            .filter(isActiveMaterial)
            .map(normalizeResponseMaterial);

        console.log(`Learning materials API: Found ${activeMaterials.length} active materials`);

        res.json({
            success: true,
            data: activeMaterials,
            count: activeMaterials.length,
            source: materialsData.metadata?.source || "unknown"
        });
    } catch (error) {
        console.error("Error reading learning materials for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load learning materials"
        });
    }
});

router.get("/categories/:category", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const category = String(req.params.category || "").toLowerCase();

        const filteredMaterials = (materialsData.materials || [])
            .filter((material) => isActiveMaterial(material) && String(material.category || "").toLowerCase() === category)
            .map(normalizeResponseMaterial);

        res.json({
            success: true,
            category,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by category for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load materials by category"
        });
    }
});

router.get("/courses/:courseId", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const courseId = String(req.params.courseId || "");

        const filteredMaterials = (materialsData.materials || [])
            .filter((material) => isActiveMaterial(material) && String(material.courseId || "") === courseId)
            .map(normalizeResponseMaterial);

        res.json({
            success: true,
            courseId,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by course for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load materials by course"
        });
    }
});

router.get("/levels/:level", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const level = String(req.params.level || "").toLowerCase();

        const filteredMaterials = (materialsData.materials || [])
            .filter((material) => isActiveMaterial(material) && String(material.level || "").toLowerCase() === level)
            .map(normalizeResponseMaterial);

        res.json({
            success: true,
            level,
            count: filteredMaterials.length,
            data: filteredMaterials
        });
    } catch (error) {
        console.error("Error getting materials by level for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load materials by level"
        });
    }
});

router.get("/search", async (req, res) => {
    try {
        const { q, category, level, type } = req.query;
        const materialsData = await getMaterialsData();

        let filteredMaterials = (materialsData.materials || []).filter(isActiveMaterial);

        if (q) {
            const searchTerm = String(q).toLowerCase();
            filteredMaterials = filteredMaterials.filter((material) =>
                String(material.title || "").toLowerCase().includes(searchTerm) ||
                String(material.description || "").toLowerCase().includes(searchTerm) ||
                (Array.isArray(material.tags) ? material.tags : []).some((tag) =>
                    String(tag || "").toLowerCase().includes(searchTerm)
                )
            );
        }

        if (category) {
            const normalizedCategory = String(category).toLowerCase();
            filteredMaterials = filteredMaterials.filter((material) =>
                String(material.category || "").toLowerCase() === normalizedCategory
            );
        }

        if (level) {
            const normalizedLevel = String(level).toLowerCase();
            filteredMaterials = filteredMaterials.filter((material) =>
                String(material.level || "").toLowerCase() === normalizedLevel
            );
        }

        if (type) {
            const normalizedType = String(type).toLowerCase();
            filteredMaterials = filteredMaterials.filter((material) =>
                String(material.type || "").toLowerCase() === normalizedType
            );
        }

        res.json({
            success: true,
            query: q,
            filters: { category, level, type },
            count: filteredMaterials.length,
            data: filteredMaterials.map(normalizeResponseMaterial)
        });
    } catch (error) {
        console.error("Error searching materials for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to search materials"
        });
    }
});

router.get("/toc/:materialId", async (req, res) => {
    try {
        const { materialId } = req.params;
        const PdfTocExtractor = require("../utils/pdfTocExtractor");
        const extractor = new PdfTocExtractor();
        const materialsData = await getMaterialsData();

        const material = (materialsData.materials || []).find((item) => matchesMaterialId(item, materialId));

        if (!material) {
            return res.status(404).json({
                success: false,
                error: "Material not found"
            });
        }

        const fileSystemPath = resolveMaterialFileSystemPath(material);
        const fallbackPageCount = normalizePageCount(material.pageCount || material.pages);

        if (!fileSystemPath || !fs.existsSync(fileSystemPath)) {
            return res.json({
                success: true,
                materialId,
                toc: {
                    materialId,
                    chapters: [],
                    totalPages: fallbackPageCount || 1,
                    method: fallbackPageCount ? "file-not-found+metadata" : "file-not-found",
                    lastAnalyzed: new Date().toISOString(),
                    confidence: 0,
                    error: "PDF file not found"
                }
            });
        }

        const tocData = await extractor.getTOC(materialId, fileSystemPath);
        if ((!tocData.totalPages || tocData.totalPages <= 1) && fallbackPageCount) {
            tocData.totalPages = fallbackPageCount;
            tocData.method = tocData.method ? `${tocData.method}+metadata` : "metadata";
        }

        const resolvedPageCount = normalizePageCount(tocData.totalPages);
        if (!fallbackPageCount && resolvedPageCount) {
            material.pageCount = resolvedPageCount;
            material.pages = resolvedPageCount;

            if (materialsData.metadata?.source === "json" && fs.existsSync(LEARNING_MATERIALS_FILE)) {
                materialsData.materials = (materialsData.materials || []).map((item) =>
                    matchesMaterialId(item, materialId) ? material : item
                );
                writeJsonSafe(LEARNING_MATERIALS_FILE, materialsData);
            }
        }

        res.json({
            success: true,
            materialId,
            toc: tocData
        });
    } catch (error) {
        console.error("Error getting TOC for material:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get TOC data",
            details: error.message
        });
    }
});

router.get("/toc-stats", (req, res) => {
    try {
        const PdfTocExtractor = require("../utils/pdfTocExtractor");
        const extractor = new PdfTocExtractor();
        const stats = extractor.getCacheStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error("Error getting TOC stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get TOC statistics"
        });
    }
});

router.get("/thumbnail/:materialId", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const requestedId = req.params.materialId;

        const material = (materialsData.materials || []).find((item) => matchesMaterialId(item, requestedId));
        if (!material || !isActiveMaterial(material)) {
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

        const thumbnailFilename = `${String(material.id)}.jpg`;
        const cachedThumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

        if (fs.existsSync(cachedThumbnailPath)) {
            const invalidCachedThumbnail = await isLikelyInvalidThumbnail(cachedThumbnailPath);
            if (!invalidCachedThumbnail) {
                return res.sendFile(cachedThumbnailPath);
            }

            fs.rmSync(cachedThumbnailPath, { force: true });
        }

        if (material.thumbnailPath) {
            const localThumbnailPath = path.join(__dirname, "../public", String(material.thumbnailPath).replace(/^\/+/, ""));
            if (fs.existsSync(localThumbnailPath) && !(await isLikelyInvalidThumbnail(localThumbnailPath))) {
                return res.sendFile(localThumbnailPath);
            }
        }

        const fileSystemPath = resolveMaterialFileSystemPath(material);
        if (!fileSystemPath || !fs.existsSync(fileSystemPath)) {
            return res.status(404).json({
                success: false,
                error: "PDF file not found"
            });
        }

        let success = await generatePDFThumbnailWithPdfJs(fileSystemPath, cachedThumbnailPath);
        if (!success) {
            success = await generatePDFThumbnailWithPoppler(fileSystemPath, cachedThumbnailPath);
        }
        if (!success) {
            success = await generatePDFThumbnailWithImageMagick(fileSystemPath, cachedThumbnailPath);
        }
        if (success && await isLikelyInvalidThumbnail(cachedThumbnailPath)) {
            success = false;
            fs.rmSync(cachedThumbnailPath, { force: true });
        }
        if (!success) {
            const readerUrl = `${req.protocol}://${req.get("host")}/public/reader.html?material=${encodeURIComponent(String(material.id))}`;
            success = await generatePDFThumbnailWithPuppeteer(String(material.id), readerUrl, cachedThumbnailPath);
        }

        if (!success || !fs.existsSync(cachedThumbnailPath)) {
            return res.status(404).json({
                success: false,
                error: "Thumbnail generation failed"
            });
        }

        return res.sendFile(cachedThumbnailPath);
    } catch (error) {
        console.error("Error generating material thumbnail:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to generate learning material thumbnail"
        });
    }
});

router.get("/file/:materialId", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const requestedId = req.params.materialId;

        const material = (materialsData.materials || []).find((item) => matchesMaterialId(item, requestedId));

        if (!material || !isActiveMaterial(material)) {
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        const fileSystemPath = resolveMaterialFileSystemPath(material);
        if (!fileSystemPath || !fs.existsSync(fileSystemPath)) {
            return res.status(404).json({
                success: false,
                error: "PDF file not found"
            });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${path.basename(fileSystemPath)}"`);
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.sendFile(fileSystemPath);
    } catch (error) {
        console.error("Error serving learning material PDF:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to serve learning material PDF"
        });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const materialsData = await getMaterialsData();
        const requestedId = req.params.id;

        const material = (materialsData.materials || []).find((item) => matchesMaterialId(item, requestedId));

        if (!material || !isActiveMaterial(material)) {
            return res.status(404).json({
                success: false,
                error: "Learning material not found"
            });
        }

        res.json({
            success: true,
            data: normalizeResponseMaterial(material)
        });
    } catch (error) {
        console.error("Error reading learning material for students:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load learning material"
        });
    }
});

module.exports = router;
