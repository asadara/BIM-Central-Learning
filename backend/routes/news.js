const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const multer = require('multer');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { requireAdmin } = require('../utils/auth');

const router = express.Router();
const LOCAL_NEWS_FILE = path.join(__dirname, '../uploads/localNews.json');
const NEWS_MEDIA_DIR = path.join(__dirname, '../uploads/news-media');
const MAX_NEWS_MEDIA_ITEMS = 12;
const MAX_NEWS_MEDIA_FILES = 10;
const MAX_NEWS_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_NEWS_VIDEO_BYTES = 80 * 1024 * 1024;
const NEWS_API_KEY = String(process.env.NEWS_API_KEY || '').trim();
const SCRAPE_TIMEOUT_MS = 7000;
const SCRAPER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BCL-News/1.0';
const EXTERNAL_NEWS_QUERY = [
    '"building information modeling"',
    '"building information modelling"',
    '"konstruksi digital"',
    '"digital construction"',
    '"ISO 19650"',
    'openBIM',
    '"common data environment"',
    '"digital twin construction"',
    '"teknologi konstruksi"'
].join(' OR ');

const dbConfig = createPgConfig({
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in news routes:', err.message);
});

let dbReadyPromise = null;

fs.mkdirSync(NEWS_MEDIA_DIR, { recursive: true });

const newsMediaStorage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, NEWS_MEDIA_DIR),
    filename: (_req, file, callback) => {
        const extensionByMime = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/ogg': '.ogv'
        };
        callback(null, `${Date.now()}-${crypto.randomUUID()}${extensionByMime[file.mimetype] || ''}`);
    }
});

const uploadNewsMedia = multer({
    storage: newsMediaStorage,
    limits: {
        files: MAX_NEWS_MEDIA_FILES,
        fileSize: MAX_NEWS_VIDEO_BYTES
    },
    fileFilter: (_req, file, callback) => {
        const allowedTypes = new Set([
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/webm', 'video/ogg'
        ]);
        callback(allowedTypes.has(file.mimetype) ? null : new Error('Format media tidak didukung.'), allowedTypes.has(file.mimetype));
    }
});

function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

function summarizeText(text, maxLength = 140) {
    const cleaned = normalizeText(text).replace(/\s+/g, ' ');
    if (!cleaned) return '';
    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
}

function normalizeSourceName(source) {
    if (source && typeof source === 'object' && normalizeText(source.name)) {
        return normalizeText(source.name);
    }
    const value = normalizeText(source);
    return value || 'BCL Admin';
}

function normalizeImageUrl(value, fallback = '') {
    const raw = normalizeText(value);
    if (!raw) return fallback;

    if (/^data:image\//i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
    if (raw.startsWith('/')) return raw;

    const cleaned = raw.replace(/\\/g, '/').replace(/^[./]+/, '');
    if (cleaned.toLowerCase().startsWith('img/')) {
        return `/${cleaned}`;
    }

    return raw;
}

function normalizeMediaUrl(value, type) {
    const raw = normalizeText(value).replace(/\\/g, '/');
    if (!raw) return '';
    if (type === 'image' && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('//') || raw.startsWith('/')) return raw;
    if (type === 'image') {
        const cleaned = raw.replace(/^[./]+/, '');
        if (cleaned.toLowerCase().startsWith('img/')) return `/${cleaned}`;
    }
    return '';
}

function normalizeMediaItems(value) {
    if (!Array.isArray(value)) return [];

    const seen = new Set();
    const normalized = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const type = normalizeText(item.type).toLowerCase() === 'video' ? 'video' : 'image';
        const url = normalizeMediaUrl(item.url || item.src, type);
        if (!url || seen.has(`${type}:${url}`)) continue;
        seen.add(`${type}:${url}`);
        normalized.push({
            type,
            url,
            caption: normalizeText(item.caption).slice(0, 240)
        });
        if (normalized.length >= MAX_NEWS_MEDIA_ITEMS) break;
    }
    return normalized;
}

function parseIndonesianPublishedDate(value) {
    const raw = normalizeText(value).toLowerCase();
    if (!raw) return new Date().toISOString();

    const monthMap = {
        januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
        juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
        jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agu: 7, sep: 8,
        okt: 9, nov: 10, des: 11
    };
    const match = raw.match(/(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|september|sep|oktober|okt|november|nov|desember|des)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i);
    if (!match) return new Date().toISOString();

    const parsed = new Date(Date.UTC(
        Number(match[3]),
        monthMap[match[2]],
        Number(match[1]),
        Number(match[4] || 0) - 7,
        Number(match[5] || 0)
    ));
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function classifyExternalArticle(article) {
    const text = [
        article?.title,
        article?.description,
        article?.stickerText,
        article?.fullContent
    ].map(normalizeText).join(' ').toLowerCase();

    if (!text) return '';

    const hasBimPhrase = /building information model(?:ing|ling)|pemodelan informasi bangunan|openbim|scan[ -]to[ -]bim/i.test(text);
    const hasBimAcronym = /\bbim\b/i.test(text);
    const hasConstructionContext = /konstruksi|construction|arsitek|architecture|engineering|proyek|project|bangunan|infrastruktur|revit|navisworks|autodesk|model|digital/i.test(text);
    const hasInformationStandard = /iso\s*19650|common data environment|\bcde\b|industry foundation classes|\bifc\b/i.test(text);
    const hasDigitalConstruction = /konstruksi digital|digital construction|construction 4\.0|smart construction|teknologi konstruksi|3d (?:concrete )?print|cetak (?:beton|bangunan) 3d/i.test(text);
    const hasConstructionTwin = /digital twin/i.test(text) && hasConstructionContext;

    if (!(hasBimPhrase || (hasBimAcronym && hasConstructionContext) || hasInformationStandard || hasDigitalConstruction || hasConstructionTwin)) {
        return '';
    }

    if (/iso\s*19650|regulasi|peraturan|standard|standar|mandat|kebijakan/i.test(text)) return 'Regulation';
    if (/pelatihan|training|kursus|sertifikasi|pendidikan|universitas/i.test(text)) return 'Education';
    if (/infrastruktur|jalan|jembatan|bendungan|kereta|mrt|ikn/i.test(text)) return 'Infrastructure';
    if (/digital twin|openbim|\bifc\b|\bcde\b|software|revit|navisworks|autodesk|otomasi|automation|3d print|cetak .*3d/i.test(text)) return 'Technology';
    return 'BIM';
}

function filterAndNormalizeExternalArticles(articles, sourceName) {
    if (!Array.isArray(articles)) return [];

    return articles.reduce((accepted, article) => {
        const category = classifyExternalArticle(article);
        if (!category) return accepted;

        accepted.push({
            ...article,
            stickerText: summarizeText(article.stickerText || article.description || article.title, 160),
            fullContent: normalizeText(article.fullContent || article.content || article.description || ''),
            source: { name: normalizeSourceName(article.source || sourceName) },
            category,
            origin: 'external'
        });
        return accepted;
    }, []);
}

function normalizeNewsPayload(input, fallback = {}) {
    const merged = { ...fallback, ...input };
    const nowIso = new Date().toISOString();
    const fullContent = normalizeText(merged.fullContent || merged.content || fallback.fullContent || '');
    const stickerText = normalizeText(
        merged.stickerText ||
        merged.mainSentence ||
        merged.summary ||
        merged.description ||
        fallback.stickerText ||
        summarizeText(fullContent, 140)
    );
    const title = normalizeText(merged.title || fallback.title) || summarizeText(stickerText, 90) || 'Untitled News';
    const description = normalizeText(merged.description || fallback.description) || stickerText || summarizeText(fullContent, 180);

    const publishedAtInput = merged.publishedAt || merged.published_at || fallback.publishedAt || fallback.published_at || nowIso;
    const publishedAtDate = new Date(publishedAtInput);
    const publishedAt = Number.isNaN(publishedAtDate.getTime()) ? nowIso : publishedAtDate.toISOString();

    const updatedAtInput = merged.updatedAt || merged.updated_at || nowIso;
    const updatedAtDate = new Date(updatedAtInput);
    const updatedAt = Number.isNaN(updatedAtDate.getTime()) ? nowIso : updatedAtDate.toISOString();

    const numericViews = Number(merged.views);

    const hasPrimaryImage = Object.prototype.hasOwnProperty.call(input || {}, 'urlToImage') ||
        Object.prototype.hasOwnProperty.call(input || {}, 'image');
    const primaryImageInput = hasPrimaryImage
        ? input.urlToImage || input.image
        : fallback.urlToImage || fallback.image;
    let urlToImage = normalizeImageUrl(primaryImageInput, '');
    const hasMedia = Object.prototype.hasOwnProperty.call(input || {}, 'media');
    let media = normalizeMediaItems(hasMedia ? input.media : fallback.media);

    if (!urlToImage) {
        urlToImage = media.find((item) => item.type === 'image')?.url || '';
    }
    if (urlToImage && !media.some((item) => item.type === 'image' && item.url === urlToImage)) {
        media.unshift({ type: 'image', url: urlToImage, caption: '' });
        media = media.slice(0, MAX_NEWS_MEDIA_ITEMS);
    }

    return {
        id: normalizeText(merged.id) || fallback.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        stickerText,
        fullContent,
        description,
        url: normalizeText(merged.url || fallback.url) || '#',
        urlToImage,
        media,
        sourceName: normalizeSourceName(merged.sourceName || merged.source || fallback.sourceName || fallback.source),
        publishedAt,
        category: normalizeText(merged.category || fallback.category) || 'BIM',
        author: normalizeText(merged.author || fallback.author) || 'AdminBCL',
        status: normalizeText(merged.status || fallback.status) || 'published',
        origin: normalizeText(merged.origin || merged.sourceType || fallback.origin) || 'local',
        views: Number.isFinite(numericViews) ? numericViews : Number(fallback.views || 0),
        updatedAt
    };
}

function mapDbRowToArticle(row) {
    const urlToImage = normalizeImageUrl(row.url_to_image, '');
    let media = normalizeMediaItems(row.media_json);
    if (urlToImage && !media.some((item) => item.type === 'image' && item.url === urlToImage)) {
        media.unshift({ type: 'image', url: urlToImage, caption: '' });
    }
    return {
        id: row.id,
        title: row.title,
        stickerText: row.sticker_text,
        fullContent: row.full_content,
        description: row.description,
        url: row.url || '#',
        urlToImage,
        media,
        source: { name: row.source_name || 'BCL Admin' },
        publishedAt: row.published_at,
        category: row.category || 'BIM',
        author: row.author || 'AdminBCL',
        status: row.status || 'published',
        origin: 'local',
        views: Number(row.views || 0),
        updatedAt: row.updated_at
    };
}

function readLegacyJsonNews() {
    if (!fs.existsSync(LOCAL_NEWS_FILE)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(LOCAL_NEWS_FILE, 'utf-8'));
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch (error) {
        console.warn('[NEWS] Failed to parse localNews.json for migration:', error.message);
        return [];
    }
}

function getArticleKey(article) {
    const url = normalizeText(article?.url).toLowerCase();
    if (url && url !== '#') {
        return `url:${url}`;
    }

    const articleId = normalizeText(article?.id);
    if (articleId && !articleId.startsWith('news-')) {
        return `id:${articleId}`;
    }

    const title = normalizeText(article?.title).toLowerCase();
    const sourceName = normalizeText(article?.source?.name || article?.source || article?.sourceName).toLowerCase();
    const publishedAt = normalizeText(article?.publishedAt || article?.published_at).toLowerCase();
    return `fallback:${title}|${sourceName}|${publishedAt}`;
}

function deduplicateArticles(articles) {
    const seen = new Set();
    const result = [];

    for (const article of articles) {
        const key = getArticleKey(article);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(article);
    }

    return result;
}

async function ensureNewsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS news_articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            sticker_text TEXT NOT NULL,
            full_content TEXT NOT NULL,
            description TEXT,
            url TEXT DEFAULT '#',
            url_to_image TEXT,
            media_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            source_name TEXT,
            category TEXT,
            author TEXT,
            status TEXT DEFAULT 'published',
            views INTEGER DEFAULT 0,
            published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query("ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS media_json JSONB NOT NULL DEFAULT '[]'::jsonb");
    await pool.query(`
        UPDATE news_articles
        SET media_json = jsonb_build_array(jsonb_build_object('type', 'image', 'url', url_to_image, 'caption', ''))
        WHERE COALESCE(url_to_image, '') <> ''
          AND jsonb_array_length(COALESCE(media_json, '[]'::jsonb)) = 0
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_articles_status ON news_articles(status)');
}

async function migrateLegacyJsonIfNeeded() {
    const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM news_articles');
    if (countResult.rows[0].count > 0) {
        return;
    }

    const legacy = readLegacyJsonNews();
    if (legacy.length === 0) {
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const rawArticle of legacy) {
            const normalized = normalizeNewsPayload(rawArticle);
            await client.query(
                `
                    INSERT INTO news_articles (
                        id, title, sticker_text, full_content, description, url, url_to_image,
                        source_name, category, author, status, views, published_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz)
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        sticker_text = EXCLUDED.sticker_text,
                        full_content = EXCLUDED.full_content,
                        description = EXCLUDED.description,
                        url = EXCLUDED.url,
                        url_to_image = EXCLUDED.url_to_image,
                        source_name = EXCLUDED.source_name,
                        category = EXCLUDED.category,
                        author = EXCLUDED.author,
                        status = EXCLUDED.status,
                        views = EXCLUDED.views,
                        published_at = EXCLUDED.published_at,
                        updated_at = EXCLUDED.updated_at
                `,
                [
                    normalized.id,
                    normalized.title,
                    normalized.stickerText,
                    normalized.fullContent,
                    normalized.description,
                    normalized.url,
                    normalized.urlToImage,
                    normalized.sourceName,
                    normalized.category,
                    normalized.author,
                    normalized.status,
                    normalized.views,
                    normalized.publishedAt,
                    normalized.updatedAt
                ]
            );
        }
        await client.query('COMMIT');
        console.log(`[NEWS] Migrated ${legacy.length} local news entries from JSON to PostgreSQL.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.warn('[NEWS] Failed migrating localNews.json to PostgreSQL:', error.message);
    } finally {
        client.release();
    }
}

async function normalizeStoredImagePaths() {
    const result = await pool.query('SELECT id, url_to_image FROM news_articles');
    for (const row of result.rows) {
        const normalized = normalizeImageUrl(row.url_to_image, '');
        if ((row.url_to_image || '') !== normalized) {
            await pool.query(
                'UPDATE news_articles SET url_to_image = $2, updated_at = NOW() WHERE id = $1',
                [row.id, normalized]
            );
        }
    }
}

async function initializeNewsStorage() {
    if (!dbReadyPromise) {
        dbReadyPromise = (async () => {
            await ensureNewsTable();
            await migrateLegacyJsonIfNeeded();
            await normalizeStoredImagePaths();
        })().catch((error) => {
            dbReadyPromise = null;
            throw error;
        });
    }

    return dbReadyPromise;
}

async function fetchLocalNewsFromDb({ publishedOnly = false } = {}) {
    await initializeNewsStorage();
    const publishedCondition = publishedOnly ? "WHERE LOWER(COALESCE(status, 'published')) = 'published'" : '';
    const result = await pool.query(`
        SELECT
            id, title, sticker_text, full_content, description, url, url_to_image, media_json,
            source_name, category, author, status, views, published_at, updated_at
        FROM news_articles
        ${publishedCondition}
        ORDER BY published_at DESC, created_at DESC
    `);
    return result.rows.map(mapDbRowToArticle);
}

async function scrapeKompasArticles() {
    const url = 'https://www.kompas.com/tag/building-information-modelling-bim';
    const { data } = await axios.get(url, {
        timeout: SCRAPE_TIMEOUT_MS,
        headers: { 'User-Agent': SCRAPER_USER_AGENT }
    });
    const $ = cheerio.load(data);
    const articles = [];

    $('.articleItem').each((index, element) => {
        if (articles.length >= 15) return false;

        const title = $(element).find('.articleTitle').text().trim();
        const articleUrl = $(element).find('a.article-link').attr('href');
        const description = $(element).find('.articleItem-box p').first().text().trim();
        const dateText = $(element).find('.articlePost-date').text().trim();
        const imgSrc = $(element).find('.articleItem-img img').attr('src');

        if (title && articleUrl) {
            articles.push({
                title,
                stickerText: summarizeText(description || title, 140),
                description,
                fullContent: description,
                url: articleUrl,
                urlToImage: normalizeImageUrl(imgSrc),
                source: { name: 'Kompas.com' },
                    publishedAt: parseIndonesianPublishedDate(dateText),
                    category: 'BIM',
                    origin: 'external'
                });
        }
    });

    return filterAndNormalizeExternalArticles(articles, 'Kompas.com');
}

async function scrapeDetikArticles() {
    const url = 'https://www.detik.com/tag/teknologi-konstruksi/';
    const { data } = await axios.get(url, {
        timeout: SCRAPE_TIMEOUT_MS,
        headers: { 'User-Agent': SCRAPER_USER_AGENT }
    });
    const $ = cheerio.load(data);
    const articles = [];

    $('.list.media_rows.list-berita article').each((index, element) => {
        if (articles.length >= 10) return false;

        const title = $(element).find('h2.title').text().trim();
        const articleUrl = $(element).find('a').first().attr('href');
        const description = $(element).find('.box_text p').text().trim();
        const dateNode = $(element).find('.date').first().clone();
        dateNode.find('.category').remove();
        const dateText = dateNode.text().trim();
        const image = $(element).find('.box_thumb img');
        const imgSrc = image.attr('data-src') || image.attr('src');

        if (title && articleUrl) {
            articles.push({
                title,
                stickerText: summarizeText(description || title, 140),
                description,
                fullContent: description,
                url: articleUrl.startsWith('http') ? articleUrl : `https://www.detik.com${articleUrl}`,
                urlToImage: normalizeImageUrl(imgSrc),
                source: { name: 'Detik.com' },
                    publishedAt: parseIndonesianPublishedDate(dateText),
                    category: 'Technology',
                    origin: 'external'
                });
        }
    });

    return filterAndNormalizeExternalArticles(articles, 'Detik.com');
}

async function fetchNewsApiArticles() {
    if (!NEWS_API_KEY) return [];

    const response = await axios.get('https://newsapi.org/v2/everything', {
        timeout: SCRAPE_TIMEOUT_MS,
        headers: { 'X-Api-Key': NEWS_API_KEY },
        params: {
            q: EXTERNAL_NEWS_QUERY,
            searchIn: 'title,description',
            sortBy: 'publishedAt',
            pageSize: 30
        }
    });

    return filterAndNormalizeExternalArticles(response.data.articles || [], 'NewsAPI');
}

// Scraping berita dari Kompas.com
router.get('/scrape-kompas', async (req, res) => {
    try {
        res.json(await scrapeKompasArticles());
    } catch (error) {
        console.warn('[NEWS] Kompas scraping failed:', error.message);
        res.status(502).json({ error: 'Gagal mengambil berita dari Kompas' });
    }
});

// Fetch external news API
router.get('/external-news', async (req, res) => {
    if (!NEWS_API_KEY) {
        return res.status(503).json({ error: 'External news provider is not configured' });
    }

    try {
        res.json(await fetchNewsApiArticles());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch external news' });
    }
});

// Get local news (PostgreSQL)
router.get('/local-news', async (req, res) => {
    try {
        const news = await fetchLocalNewsFromDb({ publishedOnly: true });
        res.json(news);
    } catch (error) {
        console.error('[NEWS] Failed to get local news from PostgreSQL:', error);
        res.status(500).json({ error: 'Failed to get local news from PostgreSQL' });
    }
});

// Get all local news for administration, including non-published entries.
router.get('/local-news/admin', requireAdmin, async (req, res) => {
    try {
        const news = await fetchLocalNewsFromDb();
        res.set('Cache-Control', 'no-store');
        res.json(news);
    } catch (error) {
        console.error('[NEWS] Failed to get admin news list from PostgreSQL:', error);
        res.status(500).json({ error: 'Failed to get admin news list from PostgreSQL' });
    }
});

// Upload supporting photos/videos before saving the news JSON payload.
router.post('/media-upload', requireAdmin, (req, res) => {
    uploadNewsMedia.array('media', MAX_NEWS_MEDIA_FILES)(req, res, (error) => {
        if (error) {
            (Array.isArray(req.files) ? req.files : []).forEach((file) => fs.unlink(file.path, () => {}));
            const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({
                error: error.code === 'LIMIT_FILE_COUNT'
                    ? `Maksimal ${MAX_NEWS_MEDIA_FILES} file per upload.`
                    : error.message || 'Upload media gagal.'
            });
        }

        const files = Array.isArray(req.files) ? req.files : [];
        const oversizedImage = files.find((file) => file.mimetype.startsWith('image/') && file.size > MAX_NEWS_IMAGE_BYTES);
        if (oversizedImage) {
            files.forEach((file) => fs.unlink(file.path, () => {}));
            return res.status(413).json({ error: 'Ukuran setiap gambar maksimal 12MB.' });
        }

        return res.status(201).json({
            media: files.map((file) => ({
                type: file.mimetype.startsWith('video/') ? 'video' : 'image',
                url: `/uploads/news-media/${file.filename}`,
                caption: '',
                name: path.basename(file.originalname || file.filename)
            }))
        });
    });
});

// Add local news (PostgreSQL)
router.post('/local-news', requireAdmin, async (req, res) => {
    try {
        await initializeNewsStorage();
        const payload = normalizeNewsPayload(req.body);
        const result = await pool.query(
            `
                INSERT INTO news_articles (
                    id, title, sticker_text, full_content, description, url, url_to_image, media_json,
                    source_name, category, author, status, views, published_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14::timestamptz, $15::timestamptz)
                RETURNING id, title, sticker_text, full_content, description, url, url_to_image, media_json,
                          source_name, category, author, status, views, published_at, updated_at
            `,
            [
                payload.id,
                payload.title,
                payload.stickerText,
                payload.fullContent,
                payload.description,
                payload.url,
                payload.urlToImage,
                JSON.stringify(payload.media),
                payload.sourceName,
                payload.category,
                payload.author,
                payload.status,
                payload.views,
                payload.publishedAt,
                payload.updatedAt
            ]
        );

        res.json({
            message: 'News added successfully',
            data: mapDbRowToArticle(result.rows[0])
        });
    } catch (error) {
        console.error('[NEWS] Failed to add local news:', error);
        res.status(500).json({ error: 'Failed to add local news to PostgreSQL' });
    }
});

// Update local news (PostgreSQL)
router.put('/local-news/:id', requireAdmin, async (req, res) => {
    try {
        await initializeNewsStorage();
        const targetId = normalizeText(req.params.id);
        const existingResult = await pool.query(
            `
                SELECT id, title, sticker_text, full_content, description, url, url_to_image, media_json,
                       source_name, category, author, status, views, published_at, updated_at
                FROM news_articles
                WHERE id = $1
                LIMIT 1
            `,
            [targetId]
        );

        if (existingResult.rowCount === 0) {
            return res.status(404).json({ error: 'News not found' });
        }

        const existingMapped = mapDbRowToArticle(existingResult.rows[0]);
        const merged = normalizeNewsPayload(req.body, existingMapped);

        const updatedResult = await pool.query(
            `
                UPDATE news_articles
                SET
                    title = $2,
                    sticker_text = $3,
                    full_content = $4,
                    description = $5,
                    url = $6,
                    url_to_image = $7,
                    media_json = $8::jsonb,
                    source_name = $9,
                    category = $10,
                    author = $11,
                    status = $12,
                    views = $13,
                    published_at = $14::timestamptz,
                    updated_at = $15::timestamptz
                WHERE id = $1
                RETURNING id, title, sticker_text, full_content, description, url, url_to_image, media_json,
                          source_name, category, author, status, views, published_at, updated_at
            `,
            [
                targetId,
                merged.title,
                merged.stickerText,
                merged.fullContent,
                merged.description,
                merged.url,
                merged.urlToImage,
                JSON.stringify(merged.media),
                merged.sourceName,
                merged.category,
                merged.author,
                merged.status,
                merged.views,
                merged.publishedAt,
                new Date().toISOString()
            ]
        );

        return res.json({
            message: 'News updated successfully',
            data: mapDbRowToArticle(updatedResult.rows[0])
        });
    } catch (error) {
        console.error('[NEWS] Failed to update local news:', error);
        return res.status(500).json({ error: 'Failed to update local news in PostgreSQL' });
    }
});

// Delete local news (PostgreSQL)
router.delete('/local-news/:id', requireAdmin, async (req, res) => {
    try {
        await initializeNewsStorage();
        const targetId = normalizeText(req.params.id);
        const deleteResult = await pool.query('DELETE FROM news_articles WHERE id = $1', [targetId]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'News not found' });
        }

        return res.json({ message: 'News deleted successfully' });
    } catch (error) {
        console.error('[NEWS] Failed to delete local news:', error);
        return res.status(500).json({ error: 'Failed to delete local news from PostgreSQL' });
    }
});

// Scraping berita dari Detik.com
router.get('/scrape-detik', async (req, res) => {
    try {
        res.json(await scrapeDetikArticles());
    } catch (error) {
        console.warn('[NEWS] Detik scraping failed:', error.message);
        res.status(502).json({ error: 'Gagal mengambil berita dari Detik' });
    }
});

// Get all news (scraped + local PostgreSQL)
router.get('/all-news', async (req, res) => {
    try {
        console.log('[NEWS] Starting news aggregation...');

        let scrapedArticles = [];
        const scrapeResults = await Promise.allSettled([
            scrapeKompasArticles(),
            scrapeDetikArticles(),
            fetchNewsApiArticles()
        ]);

        scrapeResults.forEach((result, index) => {
            const sourceName = ['Kompas', 'Detik', 'NewsAPI'][index];
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                scrapedArticles.push(...result.value);
                console.log(`[NEWS] ${sourceName}: ${result.value.length} articles`);
            } else if (result.status === 'rejected') {
                console.warn(`[NEWS] ${sourceName} scraping failed:`, result.reason?.message || result.reason);
            }
        });

        const localNews = await fetchLocalNewsFromDb({ publishedOnly: true });
        console.log(`[NEWS] Local PostgreSQL news: ${localNews.length} articles`);

        const mergedArticles = [...scrapedArticles, ...localNews].map((article) => {
            const normalized = normalizeNewsPayload(article, article);
            return {
                id: normalized.id,
                title: normalized.title,
                stickerText: normalized.stickerText,
                fullContent: normalized.fullContent,
                description: normalized.description,
                url: normalized.url,
                urlToImage: normalized.urlToImage,
                media: normalized.media,
                source: { name: normalized.sourceName },
                publishedAt: normalized.publishedAt,
                category: normalized.category,
                author: normalized.author,
                status: normalized.status,
                origin: normalized.origin,
                views: normalized.views
            };
        });

        const uniqueNews = deduplicateArticles(mergedArticles).sort(
            (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
        );

        return res.json(uniqueNews);
    } catch (error) {
        console.error('[NEWS] Error in all-news:', error);
        return res.status(500).json({ error: 'Failed to aggregate news' });
    }
});

module.exports = router;
