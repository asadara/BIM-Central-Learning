const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const LEARNING_MATERIALS_FILE = path.join(__dirname, '../learning-materials.json');
const MATERIALS_DIRECTORY = path.join(__dirname, '../../BC-Learning-Main/elearning-assets/materials');
const MANUAL_BOOK_ROOT = 'G:\\BIM CENTRAL LEARNING\\BAHAN PEMBELAJARAN\\MANUAL BOOK';
const MANUAL_BOOK_ROLE_TRACKS = [
    {
        folderName: 'MANUAL BOOK - BIM MODELLER',
        category: 'bim-modeller',
        categoryLabel: 'BIM Modeller',
        level: 'beginner',
        order: 10
    },
    {
        folderName: 'MANUAL BOOK - BIM COORDINATOR',
        category: 'bim-coordinator',
        categoryLabel: 'BIM Coordinator',
        level: 'intermediate',
        order: 20
    },
    {
        folderName: 'MANUAL BOOK - BIM MANAGER',
        category: 'bim-manager',
        categoryLabel: 'BIM Manager',
        level: 'advanced',
        order: 30
    }
];
const MANUAL_BOOK_PER_CHAPTER_FOLDER = '2. MATERI PER-BAB';
const MANUAL_BOOK_TOPIC_ORDER = {
    'pemodelan-produksi-data-bim': 10,
    'quantity-takeoff': 20,
    'manajemen-data-kolaboratif': 30,
    'penyesuaian-data-teknik': 40,
    'solusi-bim': 50
};

const pgPool = new Pool(createPgConfig({
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pgPool.on('error', (error) => {
    console.warn('Learning materials PostgreSQL pool error:', error.message);
});

function readJsonSafe(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function normalizeMaterialId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function normalizeTitleFromFilename(filename) {
    return String(filename || '')
        .replace(/\.pdf$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripNumericPrefix(value) {
    return String(value || '')
        .replace(/^\d+\.\s*/, '')
        .trim();
}

function parseLeadingNumber(value) {
    const match = String(value || '').trim().match(/^(\d+)/);
    if (!match) return null;

    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseLessonOrder(value) {
    const match = String(value || '').trim().match(/^(\d+)([A-Za-z]?)/);
    if (!match) {
        return {
            major: 999,
            minor: 0
        };
    }

    const major = Number.parseInt(match[1], 10);
    const suffix = String(match[2] || '').toUpperCase();
    const minor = suffix ? suffix.charCodeAt(0) - 64 : 0;

    return {
        major: Number.isFinite(major) ? major : 999,
        minor: minor > 0 ? minor : 0
    };
}

function humanizeSlug(value) {
    return String(value || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function inferPdfCategory(candidate) {
    const normalized = String(candidate || '').toLowerCase();

    if (normalized.includes('revit') || normalized.includes('rvt')) return 'revit';
    if (
        normalized.includes('autocad') ||
        normalized.includes('acad') ||
        normalized.includes('dwg') ||
        normalized.includes('civil 3d') ||
        normalized.includes('civil3d')
    ) return 'autocad';
    if (normalized.includes('sketchup') || normalized.includes('sketch up') || normalized.includes('skp')) return 'sketchup';
    if (normalized.includes('3ds max') || normalized.includes('3dsmax') || normalized.includes('3d max')) return '3dsmax';

    return 'general';
}

function inferLevel(candidate) {
    const normalized = String(candidate || '').toLowerCase();
    if (normalized.includes('advanced') || normalized.includes('expert')) return 'advanced';
    if (normalized.includes('intermediate')) return 'intermediate';
    return 'beginner';
}

function getManualBookTopicMeta(folderName) {
    const cleanLabel = stripNumericPrefix(folderName);
    const normalized = cleanLabel.toLowerCase();

    if (normalized.includes('pemodelan') && normalized.includes('produksi')) {
        return {
            slug: 'pemodelan-produksi-data-bim',
            label: 'Pemodelan dan Produksi Data BIM'
        };
    }

    if (normalized.includes('quantity')) {
        return {
            slug: 'quantity-takeoff',
            label: 'Quantity Takeoff'
        };
    }

    if (normalized.includes('manajemen') && normalized.includes('kolaboratif')) {
        return {
            slug: 'manajemen-data-kolaboratif',
            label: 'Manajemen Data Kolaboratif'
        };
    }

    if (normalized.includes('penyesuaian') && normalized.includes('teknik')) {
        return {
            slug: 'penyesuaian-data-teknik',
            label: 'Penyesuaian Data Teknik'
        };
    }

    if (normalized.includes('solusi') && normalized.includes('bim')) {
        return {
            slug: 'solusi-bim',
            label: 'Solusi BIM'
        };
    }

    const slug = normalizeMaterialId(cleanLabel);
    return {
        slug,
        label: cleanLabel || humanizeSlug(slug)
    };
}

function normalizeManualBookTitle(filename) {
    return stripNumericPrefix(normalizeTitleFromFilename(filename));
}

function mapDbMaterial(row) {
    return {
        id: row.id != null ? String(row.id) : '',
        title: row.title || 'Untitled',
        description: row.description || '',
        category: row.category || 'general',
        level: row.level || 'beginner',
        pageCount: row.page_count || null,
        pages: row.page_count || null,
        language: row.language || 'id',
        filePath: row.file_path || null,
        file_path: row.file_path || null,
        size: row.size || 0,
        displayOnCourses: !!row.display_on_courses,
        type: 'pdf',
        status: row.is_active === false ? 'inactive' : 'active'
    };
}

async function loadMaterialsFromPostgres() {
    try {
        const result = await pgPool.query(`
            SELECT id, title, category, level, description, page_count, language,
                   file_path, size, display_on_courses, is_active, created_at, updated_at
            FROM learning_materials
            WHERE COALESCE(is_active, true) = true
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        `);

        return result.rows.map(mapDbMaterial);
    } catch (error) {
        console.warn('Failed to load learning materials from PostgreSQL:', error.message);
        return [];
    }
}

function collectPdfFiles(directory) {
    if (!fs.existsSync(directory)) return [];

    const collected = [];
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            if (entry.name.toLowerCase() === 'covers') {
                continue;
            }
            collected.push(...collectPdfFiles(absolutePath));
            continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
            collected.push(absolutePath);
        }
    }

    return collected;
}

function loadMaterialsFromFileSystem() {
    const pdfFiles = collectPdfFiles(MATERIALS_DIRECTORY);

    return pdfFiles.map((absolutePath) => {
        const relativePath = path.relative(MATERIALS_DIRECTORY, absolutePath).replace(/\\/g, '/');
        const title = normalizeTitleFromFilename(path.basename(relativePath));
        const category = inferPdfCategory(`${relativePath} ${title}`);
        const stats = fs.statSync(absolutePath);

        return {
            id: `fs-${normalizeMaterialId(relativePath)}`,
            title,
            description: '',
            category,
            level: 'beginner',
            pageCount: null,
            pages: null,
            language: 'id',
            filePath: `/elearning-assets/materials/${relativePath}`,
            file_path: `/elearning-assets/materials/${relativePath}`,
            size: stats.size,
            displayOnCourses: true,
            type: 'pdf',
            status: 'active'
        };
    });
}

function loadMaterialsFromManualBook() {
    const materials = [];

    MANUAL_BOOK_ROLE_TRACKS.forEach((roleTrack) => {
        const roleRoot = path.join(MANUAL_BOOK_ROOT, roleTrack.folderName, MANUAL_BOOK_PER_CHAPTER_FOLDER);
        if (!fs.existsSync(roleRoot)) {
            return;
        }

        const pdfFiles = collectPdfFiles(roleRoot);
        pdfFiles.forEach((absolutePath) => {
            const relativePath = path.relative(roleRoot, absolutePath).replace(/\\/g, '/');
            const pathParts = relativePath.split('/').filter(Boolean);
            const topicFolder = pathParts[0] || '';
            const topicMeta = getManualBookTopicMeta(topicFolder);
            const title = normalizeManualBookTitle(path.basename(relativePath));
            const sectionOrder = parseLeadingNumber(topicFolder) ?? 999;
            const lessonOrder = parseLessonOrder(path.basename(relativePath));
            const stats = fs.statSync(absolutePath);

            materials.push({
                id: `manual-book-${normalizeMaterialId(`${roleTrack.category}/${relativePath}`)}`,
                title,
                description: `${roleTrack.categoryLabel} / ${topicMeta.label}`,
                category: roleTrack.category,
                categoryLabel: roleTrack.categoryLabel,
                roleTrack: roleTrack.category,
                roleTrackLabel: roleTrack.categoryLabel,
                moduleTopic: topicMeta.slug,
                moduleTopicLabel: topicMeta.label,
                level: roleTrack.level,
                pageCount: null,
                pages: null,
                language: 'id',
                filePath: absolutePath,
                file_path: absolutePath,
                size: stats.size,
                displayOnCourses: true,
                type: 'pdf',
                status: 'active',
                sourcePriority: roleTrack.order,
                topicPriority: MANUAL_BOOK_TOPIC_ORDER[topicMeta.slug] || 999,
                sectionOrder,
                lessonOrderMajor: lessonOrder.major,
                lessonOrderMinor: lessonOrder.minor,
                sourceType: 'manual-book'
            });
        });
    });

    return materials.sort((left, right) => {
        const priorityDiff = Number(left.sourcePriority || 9999) - Number(right.sourcePriority || 9999);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }

        const topicDiff = Number(left.topicPriority || 9999) - Number(right.topicPriority || 9999);
        if (topicDiff !== 0) {
            return topicDiff;
        }

        const sectionDiff = Number(left.sectionOrder || 999) - Number(right.sectionOrder || 999);
        if (sectionDiff !== 0) {
            return sectionDiff;
        }

        const lessonMajorDiff = Number(left.lessonOrderMajor || 999) - Number(right.lessonOrderMajor || 999);
        if (lessonMajorDiff !== 0) {
            return lessonMajorDiff;
        }

        const lessonMinorDiff = Number(left.lessonOrderMinor || 0) - Number(right.lessonOrderMinor || 0);
        if (lessonMinorDiff !== 0) {
            return lessonMinorDiff;
        }

        return String(left.title || '').localeCompare(String(right.title || ''));
    });
}

function isGeneratedExternalSnapshotMaterial(material) {
    const filePath = String(material?.filePath || material?.file_path || '');
    const sourceType = String(material?.sourceType || '').toLowerCase();

    if (sourceType === 'manual-book') {
        return false;
    }

    if (material && Object.prototype.hasOwnProperty.call(material, 'sourcePriority')) {
        return true;
    }

    return /^ext-/.test(String(material?.id || '')) && filePath.startsWith('G:\\');
}

function dedupeMaterials(materials) {
    const deduped = [];
    const seenIds = new Set();

    materials.forEach((material) => {
        const id = String(material?.id || '').trim();
        if (!id || seenIds.has(id)) {
            return;
        }

        seenIds.add(id);
        deduped.push(material);
    });

    return deduped;
}

async function loadLearningMaterialsData() {
    const jsonData = readJsonSafe(LEARNING_MATERIALS_FILE, { materials: [], metadata: {} });
    const curatedJsonMaterials = Array.isArray(jsonData.materials)
        ? jsonData.materials.filter((material) => !isGeneratedExternalSnapshotMaterial(material))
        : [];
    const postgresMaterials = await loadMaterialsFromPostgres();
    const discoveredMaterials = loadMaterialsFromFileSystem();
    const manualBookMaterials = loadMaterialsFromManualBook();
    const mergedMaterials = dedupeMaterials([
        ...curatedJsonMaterials,
        ...postgresMaterials,
        ...discoveredMaterials,
        ...manualBookMaterials
    ]);

    if (mergedMaterials.length > 0) {
        const activeSources = [];
        if (curatedJsonMaterials.length > 0) activeSources.push('json');
        if (postgresMaterials.length > 0) activeSources.push('postgres');
        if (discoveredMaterials.length > 0) activeSources.push('filesystem');
        if (manualBookMaterials.length > 0) activeSources.push('manual-book');

        return {
            materials: mergedMaterials,
            metadata: {
                ...(jsonData.metadata || {}),
                source: activeSources.length === 1 ? activeSources[0] : 'hybrid',
                sources: activeSources
            }
        };
    }

    return {
        materials: [],
        metadata: {
            source: 'empty'
        }
    };
}

function resolveMaterialFileSystemPath(material) {
    const materialFilePath = material.filePath || material.file_path || '';
    if (!materialFilePath) return null;

    if (materialFilePath.startsWith('/elearning-assets/materials/')) {
        const relativePath = materialFilePath.replace('/elearning-assets/materials/', '');
        return path.join(MATERIALS_DIRECTORY, relativePath);
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

module.exports = {
    LEARNING_MATERIALS_FILE,
    loadLearningMaterialsData,
    resolveMaterialFileSystemPath
};
