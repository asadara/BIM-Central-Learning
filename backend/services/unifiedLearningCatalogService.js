const path = require('path');

const ALLOWED_TYPES = new Set(['video', 'pdf', 'page']);

function cleanText(value, fallback = '') {
    const text = String(value == null ? '' : value).trim();
    return text || fallback;
}

function makePageSlug(source) {
    return path.posix.basename(cleanText(source).replace(/\\/g, '/')).replace(/\.html?$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function mapVideo(video) {
    const sourceId = cleanText(video.id);
    return {
        contentId: `video:${sourceId}`,
        sourceType: 'video',
        sourceId,
        title: cleanText(video.name, 'Untitled video').replace(/\.[a-z0-9]{2,5}$/i, ''),
        description: cleanText(video.description),
        category: cleanText(video.categoryKey || video.category, 'other'),
        level: cleanText(video.bimLevel),
        discipline: cleanText(video.categoryKey || video.category, 'other'),
        language: cleanText(video.language, 'id'),
        status: 'active',
        sourceUrl: `/api/video-stream/${encodeURIComponent(cleanText(video.path))}`,
        thumbnailUrl: cleanText(video.thumbnail),
        tags: Array.isArray(video.tags) ? video.tags.map(String) : [],
        metadata: {
            duration: video.duration || null,
            size: video.size || null,
            categoryLabel: video.category || null,
            categorySource: video.categorySource || null
        }
    };
}

function mapPdf(material) {
    const sourceId = cleanText(material.id);
    return {
        contentId: `pdf:${sourceId}`,
        sourceType: 'pdf',
        sourceId,
        title: cleanText(material.title, 'Untitled PDF'),
        description: cleanText(material.description),
        category: cleanText(material.category, 'general'),
        level: cleanText(material.level, 'beginner'),
        discipline: cleanText(material.discipline || material.category, 'general'),
        language: cleanText(material.language, 'id'),
        status: cleanText(material.status, 'active'),
        sourceUrl: `/api/learning-materials/file/${encodeURIComponent(sourceId)}`,
        thumbnailUrl: cleanText(material.thumbnail),
        tags: Array.isArray(material.tags) ? material.tags.map(String) : [],
        metadata: {
            pageCount: material.pageCount || material.pages || null,
            size: material.size || null,
            sourceType: material.sourceType || null,
            roleTrack: material.roleTrack || null,
            moduleTopic: material.moduleTopic || null
        }
    };
}

function collectPages(learningPaths) {
    const pages = new Map();

    for (const learningPath of learningPaths || []) {
        for (const module of learningPath.modules || []) {
            for (const material of module.materials || []) {
                const source = cleanText(material.source);
                if (material.type !== 'reading' || !/\.html?(?:$|\?)/i.test(source)) continue;
                if (/\/elearning-assets\/courses\.html(?:$|\?)/i.test(source)) continue;

                const slug = makePageSlug(source);
                if (!slug || pages.has(slug)) continue;

                pages.set(slug, {
                    contentId: `page:${slug}`,
                    sourceType: 'page',
                    sourceId: slug,
                    title: cleanText(material.title, module.title || slug),
                    description: cleanText(module.outcome),
                    category: cleanText(learningPath.courseCategory, 'general'),
                    level: cleanText(learningPath.level),
                    discipline: cleanText(learningPath.courseCategory, 'general'),
                    language: 'id',
                    status: 'active',
                    sourceUrl: source,
                    thumbnailUrl: '',
                    tags: [],
                    metadata: {
                        legacyPathId: learningPath.id,
                        legacyModuleId: module.id
                    }
                });
            }
        }
    }

    return [...pages.values()];
}

function applyRegistryOverride(item, row) {
    if (!row) return item;
    return {
        ...item,
        title: cleanText(row.title_override, item.title),
        description: cleanText(row.description_override, item.description),
        category: cleanText(row.category_override, item.category),
        level: cleanText(row.level_override, item.level),
        discipline: cleanText(row.discipline_override, item.discipline),
        language: cleanText(row.language_override, item.language),
        status: cleanText(row.status, item.status),
        metadata: {
            ...item.metadata,
            reviewDisposition: row.review_disposition || 'needs_review'
        }
    };
}

async function loadRegistryOverrides(pgPool) {
    if (!pgPool) return new Map();

    try {
        const result = await pgPool.query(`
            SELECT content_id, title_override, description_override, category_override,
                   level_override, discipline_override, language_override, status,
                   review_disposition
            FROM learning_content_registry
        `);
        return new Map(result.rows.map((row) => [row.content_id, row]));
    } catch (error) {
        if (error && error.code === '42P01') return new Map();
        throw error;
    }
}

function createUnifiedLearningCatalogService({
    loadVideos,
    loadMaterials,
    readLearningPaths,
    pgPool = null,
    cacheTtlMs = 30000
}) {
    if (typeof loadVideos !== 'function' || typeof loadMaterials !== 'function' || typeof readLearningPaths !== 'function') {
        throw new Error('Unified learning catalog dependencies are incomplete');
    }

    let cachedCatalog = null;
    let cachedAt = 0;
    let pendingLoad = null;

    async function buildCatalog() {
        const [videos, materialData, overrides] = await Promise.all([
            loadVideos(),
            loadMaterials(),
            loadRegistryOverrides(pgPool)
        ]);
        const learningPaths = readLearningPaths();
        const pdfs = Array.isArray(materialData) ? materialData : (materialData.materials || []);
        const items = [
            ...(videos || []).map(mapVideo),
            ...pdfs.map(mapPdf),
            ...collectPages(learningPaths)
        ].filter((item) => item.sourceId);

        const unique = new Map();
        for (const item of items) {
            if (unique.has(item.contentId)) {
                throw new Error(`Duplicate canonical learning content ID: ${item.contentId}`);
            }
            unique.set(item.contentId, applyRegistryOverride(item, overrides.get(item.contentId)));
        }
        return [...unique.values()];
    }

    async function loadCatalog(options = {}) {
        const forceRefresh = options.forceRefresh === true;
        const cacheIsFresh = cachedCatalog && (Date.now() - cachedAt) < cacheTtlMs;
        if (!forceRefresh && cacheIsFresh) return cachedCatalog;
        if (!forceRefresh && pendingLoad) return pendingLoad;

        pendingLoad = buildCatalog()
            .then((items) => {
                cachedCatalog = items;
                cachedAt = Date.now();
                return items;
            })
            .finally(() => {
                pendingLoad = null;
            });
        return pendingLoad;
    }

    async function getCatalog(filters = {}) {
        let items = await loadCatalog();
        const type = cleanText(filters.type).toLowerCase();
        const query = cleanText(filters.query || filters.q).toLowerCase();
        const exactFilters = ['category', 'level', 'discipline', 'status'];

        if (type) {
            if (!ALLOWED_TYPES.has(type)) throw new Error(`Unsupported content type: ${type}`);
            items = items.filter((item) => item.sourceType === type);
        }
        for (const field of exactFilters) {
            const value = cleanText(filters[field]).toLowerCase();
            if (value) items = items.filter((item) => cleanText(item[field]).toLowerCase() === value);
        }
        if (query) {
            items = items.filter((item) => [item.title, item.description, item.category, item.discipline, ...item.tags]
                .some((value) => cleanText(value).toLowerCase().includes(query)));
        }

        const total = items.length;
        const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 50, 1), 500);
        const offset = Math.max(Number.parseInt(filters.offset, 10) || 0, 0);
        return { items: items.slice(offset, offset + limit), total, limit, offset };
    }

    async function getById(contentId) {
        return (await loadCatalog()).find((item) => item.contentId === contentId) || null;
    }

    async function getSummary() {
        const items = await loadCatalog();
        return {
            total: items.length,
            byType: items.reduce((counts, item) => {
                counts[item.sourceType] = (counts[item.sourceType] || 0) + 1;
                return counts;
            }, {})
        };
    }

    return { getById, getCatalog, getSummary, loadCatalog };
}

module.exports = createUnifiedLearningCatalogService;
