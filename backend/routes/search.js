const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { getRequestUser } = require('../utils/auth');
const { resolveAccessProfile } = require('../utils/userAccess');

const router = express.Router();
const CONTENT_ROOT = path.join(__dirname, '..', '..', 'BC-Learning-Main');
const BASE_DIR = process.env.BASE_DIR || 'G:/BIM CENTRAL LEARNING/';
const MAX_RESULTS = 60;
const MAX_FILE_RESULTS = 120;
const MAX_DEPTH = 5;
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

const pool = new Pool(createPgConfig({
    max: 2,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2500
}));

pool.on('error', (error) => {
    console.warn('WARN: Search news pool error:', error.message);
});

const VALID_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.txt', '.rtf', '.rvt', '.rfa', '.dwg', '.dxf',
    '.ifc', '.skp', '.pln', '.tm', '.mp4', '.mov', '.avi', '.webm', '.mkv',
    '.wmv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.xls', '.xlsx',
    '.ppt', '.pptx', '.zip'
]);

const FILTER_MAP = {
    all: null,
    pdf: new Set(['.pdf']),
    video: new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv']),
    text: new Set(['.txt', '.doc', '.docx', '.rtf']),
    rvt: new Set(['.rvt']),
    dwg: new Set(['.dwg']),
    rfa: new Set(['.rfa']),
    pln: new Set(['.pln']),
    skp: new Set(['.skp']),
    tm: new Set(['.tm'])
};

const EXCLUDED_FOLDERS = new Set([
    'node_modules', '.git', '__pycache__', 'temp', 'tmp', 'incoming data',
    'incoming', 'data', 'tender', 'clash', 'clash detection',
    'texture image marbel'
]);

const EXCLUDED_PAGE_PARTS = [
    '/components/', '/pages/login.html', '/pages/signup.html',
    '/pages/sub/admin-password-reset.html', '/elearning-assets/login.html',
    '/elearning-assets/register.html', '/check.html', '/phase3-testing.html'
];

let pageCache = { builtAt: 0, pages: [] };

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function decodeHtml(value) {
    const entities = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
        ndash: '–', mdash: '—', hellip: '…', middot: '·'
    };
    return String(value || '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? ' ');
}

function htmlToText(html) {
    return decodeHtml(String(html || '')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function matchTag(html, pattern) {
    const match = String(html || '').match(pattern);
    return match ? htmlToText(match[1]) : '';
}

function routeFromFile(filePath) {
    const relative = path.relative(CONTENT_ROOT, filePath).replace(/\\/g, '/');
    return `/${relative}`.replace('/index.html', '/index.html');
}

function accessRuleForPath(routePath) {
    const normalized = String(routePath || '').toLowerCase();
    if (
        normalized === '/admin.html' ||
        normalized.includes('/pages/sub/adminbcl') ||
        normalized.includes('phase4-dashboard')
    ) return 'admin';
    if (normalized.includes('mapping-kompetensi')) return 'mappingKompetensiAccess';
    if (normalized.includes('manual-books')) return 'dokumenAccess';
    if (normalized.includes('audit-2026')) return 'audit2026Access';
    if (normalized.includes('divisi-bim-workspace')) return 'bimWorkspaceAccess';
    if (
        normalized.includes('/pages/messages.html') ||
        normalized.includes('/pages/profiles.html') ||
        normalized.includes('/elearning-assets/profile.html') ||
        normalized.includes('/elearning-assets/my-training.html') ||
        normalized.includes('/elearning-assets/favorites.html') ||
        normalized.includes('/elearning-assets/certification.html') ||
        normalized.includes('/elearning-assets/badges.html')
    ) return 'authenticated';
    return 'public';
}

function canAccess(rule, authUser, profile) {
    if (authUser?.isAdmin) return true;
    if (rule === 'public') return true;
    if (rule === 'authenticated') return Boolean(authUser);
    if (rule === 'admin') return false;
    return Boolean(authUser && profile?.[rule]);
}

function shouldIndexPage(routePath) {
    const normalized = routePath.toLowerCase();
    return !EXCLUDED_PAGE_PARTS.some((part) => normalized.includes(part));
}

function readHtmlFiles(directory, results = []) {
    if (!fs.existsSync(directory)) return results;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        if (item.name.startsWith('.')) continue;
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) {
            readHtmlFiles(fullPath, results);
        } else if (item.isFile() && item.name.toLowerCase().endsWith('.html')) {
            results.push(fullPath);
        }
    }
    return results;
}

function buildPageIndex() {
    const now = Date.now();
    if (pageCache.pages.length && now - pageCache.builtAt < PAGE_CACHE_TTL_MS) {
        return pageCache.pages;
    }

    const pages = [];
    for (const filePath of readHtmlFiles(CONTENT_ROOT)) {
        const routePath = routeFromFile(filePath);
        if (!shouldIndexPage(routePath)) continue;
        try {
            const html = fs.readFileSync(filePath, 'utf8');
            const title = matchTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
                matchTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                path.basename(filePath, '.html').replace(/[-_]+/g, ' ');
            const descriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
                html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
            const description = descriptionMatch ? decodeHtml(descriptionMatch[1]).trim() : '';
            const content = htmlToText(html).slice(0, 50000);
            pages.push({
                id: `page:${routePath}`,
                type: 'page',
                category: 'Halaman',
                title,
                description,
                content,
                path: routePath,
                accessRule: accessRuleForPath(routePath)
            });
        } catch (error) {
            console.warn(`WARN: Unable to index ${filePath}:`, error.message);
        }
    }

    pageCache = { builtAt: now, pages };
    return pages;
}

function createSnippet(content, rawQuery, fallback = '') {
    const source = String(content || fallback || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';
    const lower = normalizeText(source);
    const query = normalizeText(rawQuery);
    const firstToken = query.split(' ').filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';
    let start = firstToken ? lower.indexOf(firstToken) : -1;
    start = start < 0 ? 0 : Math.max(0, start - 90);
    const snippet = source.slice(start, start + 240).trim();
    return `${start > 0 ? '…' : ''}${snippet}${start + 240 < source.length ? '…' : ''}`;
}

function scoreDocument(document, rawQuery) {
    const query = normalizeText(rawQuery);
    const tokens = query.split(' ').filter(Boolean);
    const title = normalizeText(document.title);
    const description = normalizeText(document.description);
    const content = normalizeText(document.content);
    if (!query || !tokens.every((token) => title.includes(token) || description.includes(token) || content.includes(token))) {
        return 0;
    }
    let score = 10;
    if (title === query) score += 120;
    else if (title.startsWith(query)) score += 85;
    else if (title.includes(query)) score += 65;
    if (description.includes(query)) score += 30;
    if (content.includes(query)) score += 15;
    score += tokens.reduce((total, token) => total + (title.includes(token) ? 12 : 0), 0);
    return score;
}

async function searchLocalNews(rawQuery) {
    try {
        const likeQuery = `%${String(rawQuery || '').trim()}%`;
        const result = await pool.query(`
            SELECT id, title, sticker_text, full_content, description, url,
                   source_name, category, published_at
            FROM news_articles
            WHERE LOWER(COALESCE(status, 'published')) = 'published'
              AND CONCAT_WS(' ', title, sticker_text, full_content, description,
                            source_name, category) ILIKE $1
            ORDER BY published_at DESC
            LIMIT 30
        `, [likeQuery]);
        return result.rows.map((row) => ({
            id: `news:${row.id}`,
            type: 'news',
            category: 'Berita',
            title: row.title,
            description: row.sticker_text || row.description || '',
            content: row.full_content || row.description || '',
            path: row.url && row.url !== '#'
                ? row.url
                : `/pages/updates.html?search=${encodeURIComponent(row.title)}`,
            source: row.source_name || 'BCL',
            publishedAt: row.published_at,
            accessRule: 'public'
        }));
    } catch (error) {
        // Search remains useful when PostgreSQL is temporarily unavailable.
        return [];
    }
}

function isExcludedDirectory(name) {
    return EXCLUDED_FOLDERS.has(String(name || '').toLowerCase());
}

function fileAccessRule(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (normalized.includes('manual book')) return 'dokumenAccess';
    if (normalized.includes('audit 2026') || normalized.includes('audit-2026')) return 'audit2026Access';
    if (normalized.includes('mapping kompetensi')) return 'mappingKompetensiAccess';
    if (normalized.includes('divisi bim workspace')) return 'bimWorkspaceAccess';
    return 'public';
}

function searchFiles(directory, rawQuery, extensions, authUser, profile, currentDepth = 0, results = []) {
    if (currentDepth >= MAX_DEPTH || results.length >= MAX_FILE_RESULTS || !fs.existsSync(directory)) return results;
    let items;
    try {
        items = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
        return results;
    }

    const query = normalizeText(rawQuery);
    for (const item of items) {
        if (results.length >= MAX_FILE_RESULTS) break;
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) {
            if (!isExcludedDirectory(item.name)) {
                searchFiles(fullPath, rawQuery, extensions, authUser, profile, currentDepth + 1, results);
            }
            continue;
        }
        const extension = path.extname(item.name).toLowerCase();
        if (!VALID_EXTENSIONS.has(extension) || (extensions && !extensions.has(extension))) continue;
        if (!normalizeText(item.name).includes(query)) continue;
        const relativePath = path.relative(BASE_DIR, fullPath).replace(/\\/g, '/');
        if (!canAccess(fileAccessRule(relativePath), authUser, profile)) continue;
        try {
            const stats = fs.statSync(fullPath);
            results.push({
                id: `file:${relativePath}`,
                type: 'file',
                category: 'File',
                title: item.name,
                name: item.name,
                description: `File ${extension.slice(1).toUpperCase()} · ${path.basename(path.dirname(fullPath))}`,
                content: relativePath,
                path: `/files/${relativePath.split('/').map(encodeURIComponent).join('/')}`,
                location: path.basename(path.dirname(fullPath)) || 'BCL',
                extension: extension.slice(1),
                size: stats.size,
                sizeFormatted: formatFileSize(stats.size),
                modified: stats.mtime.toISOString(),
                accessRule: fileAccessRule(relativePath)
            });
        } catch (error) {
            continue;
        }
    }
    return results;
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${Number((bytes / (1024 ** index)).toFixed(2))} ${units[index]}`;
}

router.get('/', async (req, res) => {
    const rawQuery = String(req.query.q || '').trim();
    const scope = String(req.query.scope || req.query.type || 'global').toLowerCase();
    const filter = String(req.query.filter || 'all').toLowerCase();

    if (rawQuery.length < 2 || rawQuery.length > 120) {
        return res.status(400).json({ error: 'Kata kunci harus terdiri dari 2–120 karakter.' });
    }

    try {
        const authUser = getRequestUser(req);
        const profile = await resolveAccessProfile(authUser);
        const extensions = FILTER_MAP[filter] ?? null;
        const fileResults = fs.existsSync(BASE_DIR)
            ? searchFiles(BASE_DIR, rawQuery, extensions, authUser, profile)
            : [];

        if (scope === 'files') {
            return res.json({
                query: rawQuery,
                filter,
                type: 'files',
                totalResults: fileResults.length,
                files: fileResults.slice(0, MAX_FILE_RESULTS),
                truncated: fileResults.length >= MAX_FILE_RESULTS
            });
        }

        const [newsResults] = await Promise.all([searchLocalNews(rawQuery)]);
        const pageResults = buildPageIndex().filter((page) => canAccess(page.accessRule, authUser, profile));
        const candidates = [...pageResults, ...newsResults, ...fileResults];
        const results = candidates
            .map((item) => ({ ...item, score: scoreDocument(item, rawQuery) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title), 'id'))
            .slice(0, MAX_RESULTS)
            .map(({ accessRule, content, score, ...item }) => ({
                ...item,
                snippet: createSnippet(content, rawQuery, item.description)
            }));

        const categories = results.reduce((summary, item) => {
            summary[item.category] = (summary[item.category] || 0) + 1;
            return summary;
        }, {});

        return res.json({
            query: rawQuery,
            totalResults: results.length,
            results,
            categories,
            indexedAt: new Date(pageCache.builtAt || Date.now()).toISOString()
        });
    } catch (error) {
        console.error('ERROR: Global search failed:', error);
        return res.status(500).json({ error: 'Pencarian sedang tidak tersedia.' });
    }
});

router.get('/ping', (req, res) => {
    res.json({
        status: 'ok',
        pageIndexSize: buildPageIndex().length,
        fileSourceAvailable: fs.existsSync(BASE_DIR),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
