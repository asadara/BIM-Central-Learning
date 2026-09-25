const path = require('path');

const CANONICAL_ID_PATTERN = /^(video|pdf|page):[a-z0-9][a-z0-9_:-]*$/i;
const TYPE_ALIASES = Object.freeze({
    article: 'page',
    reading: 'page',
    youtube: 'video'
});

class ContentReferenceError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'ContentReferenceError';
        this.code = code;
        this.status = code === 'AMBIGUOUS_CONTENT_REFERENCE'
            ? 409
            : code === 'INVALID_CONTENT_REFERENCE' ? 400 : 404;
        this.details = details;
    }
}

function cleanText(value) {
    return String(value == null ? '' : value).trim();
}

function safeDisplayText(value, fallback) {
    const text = cleanText(value);
    return text && !/(?:\\\\|file:\/\/|[a-z]:[\\/])/i.test(text) ? text : fallback;
}

function normalizeType(value) {
    const type = cleanText(value).toLowerCase();
    return TYPE_ALIASES[type] || type;
}

function pageSlug(value) {
    const source = cleanText(value).replace(/\\/g, '/').split(/[?#]/, 1)[0];
    return path.posix.basename(source).replace(/\.html?$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function pdfSourceId(value) {
    const source = cleanText(value);
    if (!source) return '';
    try {
        const parsed = new URL(source, 'https://bcl.invalid');
        return cleanText(parsed.searchParams.get('material'));
    } catch (_) {
        return '';
    }
}

function safePageHref(sourceLocator, sourceId) {
    const locator = cleanText(sourceLocator);
    const isSafeRoute = /^\/(?:pages|elearning-assets)\/[a-z0-9/_-]+\.html(?:#[a-z0-9_-]+)?$/i.test(locator)
        && !locator.includes('..')
        && !locator.includes('\\');
    if (isSafeRoute) return locator;
    return `/pages/${encodeURIComponent(sourceId)}.html`;
}

function safeHref(item) {
    const sourceType = normalizeType(item.sourceType || item.type);
    const sourceId = cleanText(item.sourceId);
    const contentId = cleanText(item.contentId);

    if (sourceType === 'page') return safePageHref(item.sourceLocator || item.sourceUrl, sourceId);
    if (sourceType === 'pdf') {
        return `/public/reader.html?material=${encodeURIComponent(sourceId)}`;
    }
    return `/elearning-assets/courses.html?contentId=${encodeURIComponent(contentId)}`;
}

function toClientReference(item) {
    if (!item) throw new ContentReferenceError('UNKNOWN_CONTENT_REFERENCE', 'Learning content was not found');

    const contentId = cleanText(item.contentId);
    const sourceType = normalizeType(item.sourceType || item.type);
    const sourceId = cleanText(item.sourceId);
    if (!CANONICAL_ID_PATTERN.test(contentId) || !['page', 'video', 'pdf'].includes(sourceType) || !sourceId) {
        throw new ContentReferenceError('INVALID_CONTENT_REFERENCE', 'Learning content has an invalid canonical identity');
    }
    if (contentId !== `${sourceType}:${sourceId}`) {
        throw new ContentReferenceError('AMBIGUOUS_CONTENT_REFERENCE', 'Canonical content identity does not match its source identity', {
            contentId
        });
    }

    return {
        contentId,
        type: sourceType,
        title: safeDisplayText(item.title || item.titleOverride, sourceId),
        href: safeHref({ ...item, contentId, sourceType, sourceId })
    };
}

function candidateKeys(reference) {
    const type = normalizeType(reference.type || reference.sourceType);
    const directId = cleanText(reference.id || reference.sourceId || reference.legacyId);
    const source = cleanText(reference.source || reference.href || reference.sourceUrl);
    const ids = new Set([directId].filter(Boolean));

    if (type === 'page' || (!type && /\.html?(?:$|[?#])/i.test(source))) ids.add(pageSlug(source));
    if (type === 'pdf' || (!type && /[?&]material=/i.test(source))) ids.add(pdfSourceId(source));

    return { type, ids };
}

function createCanonicalLearningContentResolver({ catalogService }) {
    if (!catalogService || typeof catalogService.loadCatalog !== 'function') {
        throw new Error('catalogService with loadCatalog() is required');
    }

    async function resolveCanonical(contentId) {
        const normalized = cleanText(contentId);
        if (!CANONICAL_ID_PATTERN.test(normalized)) {
            throw new ContentReferenceError('INVALID_CONTENT_REFERENCE', 'Invalid canonical content ID');
        }
        const item = typeof catalogService.getById === 'function'
            ? await catalogService.getById(normalized)
            : (await catalogService.loadCatalog()).find((entry) => entry.contentId === normalized);
        if (!item) {
            throw new ContentReferenceError('UNKNOWN_CONTENT_REFERENCE', `Unknown canonical content ID: ${normalized}`);
        }
        return toClientReference(item);
    }

    async function resolveLegacy(reference) {
        if (typeof reference === 'string' && CANONICAL_ID_PATTERN.test(reference)) {
            return resolveCanonical(reference);
        }

        const normalizedReference = typeof reference === 'object' && reference !== null
            ? reference
            : { id: reference };
        if (normalizedReference.contentId) return resolveCanonical(normalizedReference.contentId);

        const { type, ids } = candidateKeys(normalizedReference);
        const catalog = await catalogService.loadCatalog();
        const candidates = catalog.filter((item) => {
            const itemType = normalizeType(item.sourceType);
            return (!type || itemType === type) && ids.has(cleanText(item.sourceId));
        });
        const unique = [...new Map(candidates.map((item) => [item.contentId, item])).values()];

        if (unique.length === 0) {
            throw new ContentReferenceError('UNKNOWN_CONTENT_REFERENCE', 'Legacy learning content reference is not mapped');
        }
        if (unique.length > 1) {
            throw new ContentReferenceError('AMBIGUOUS_CONTENT_REFERENCE', 'Legacy learning content reference maps to multiple canonical items', {
                candidateContentIds: unique.map((item) => item.contentId).sort()
            });
        }
        return toClientReference(unique[0]);
    }

    return { resolveCanonical, resolveLegacy, toClientReference };
}

module.exports = {
    CANONICAL_ID_PATTERN,
    ContentReferenceError,
    createCanonicalLearningContentResolver,
    pageSlug,
    toClientReference
};
