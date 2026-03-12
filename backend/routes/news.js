const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const router = express.Router();
const LOCAL_NEWS_FILE = path.join(__dirname, '../uploads/localNews.json');
const DEFAULT_NEWS_IMAGE = '/img/ready.jpg';

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

function normalizeImageUrl(value, fallback = DEFAULT_NEWS_IMAGE) {
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

    return {
        id: normalizeText(merged.id) || fallback.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        stickerText,
        fullContent,
        description,
        url: normalizeText(merged.url || fallback.url) || '#',
        urlToImage: normalizeImageUrl(merged.urlToImage || merged.image || fallback.urlToImage || fallback.image),
        sourceName: normalizeSourceName(merged.sourceName || merged.source || fallback.sourceName || fallback.source),
        publishedAt,
        category: normalizeText(merged.category || fallback.category) || 'BIM',
        author: normalizeText(merged.author || fallback.author) || 'AdminBCL',
        status: normalizeText(merged.status || fallback.status) || 'published',
        views: Number.isFinite(numericViews) ? numericViews : Number(fallback.views || 0),
        updatedAt
    };
}

function mapDbRowToArticle(row) {
    return {
        id: row.id,
        title: row.title,
        stickerText: row.sticker_text,
        fullContent: row.full_content,
        description: row.description,
        url: row.url || '#',
        urlToImage: normalizeImageUrl(row.url_to_image),
        source: { name: row.source_name || 'BCL Admin' },
        publishedAt: row.published_at,
        category: row.category || 'BIM',
        author: row.author || 'AdminBCL',
        status: row.status || 'published',
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
        const normalized = normalizeImageUrl(row.url_to_image);
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

async function fetchLocalNewsFromDb() {
    await initializeNewsStorage();
    const result = await pool.query(`
        SELECT
            id, title, sticker_text, full_content, description, url, url_to_image,
            source_name, category, author, status, views, published_at, updated_at
        FROM news_articles
        ORDER BY published_at DESC, created_at DESC
    `);
    return result.rows.map(mapDbRowToArticle);
}

// Scraping berita dari Kompas.com
router.get('/scrape-kompas', async (req, res) => {
    try {
        const url = 'https://www.kompas.com/tag/building-information-modelling-bim';
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const articles = [];

        $('.latest--indeks .article__list').each((index, element) => {
            const title = $(element).find('.article__title a').text().trim();
            const articleUrl = $(element).find('.article__title a').attr('href');
            const description = $(element).find('.article__lead').text().trim();
            const imgSrc =
                $(element).find('.article__asset img').attr('data-src') ||
                $(element).find('.article__asset img').attr('src');

            if (title && articleUrl) {
                articles.push({
                    title,
                    stickerText: summarizeText(description || title, 140),
                    description,
                    fullContent: description,
                    url: articleUrl,
                    urlToImage: normalizeImageUrl(imgSrc),
                    source: { name: 'Kompas.com' },
                    publishedAt: new Date().toISOString(),
                    category: 'BIM'
                });
            }
        });

        res.json(articles);
    } catch (error) {
        console.error('Error scraping Kompas:', error);
        res.status(500).json({ error: 'Gagal mengambil berita dari Kompas' });
    }
});

// Fetch external news API
router.get('/external-news', async (req, res) => {
    try {
        const response = await axios.get('https://newsapi.org/v2/everything?q=BIM&apiKey=b2b458b5656947f9986209076616e740');
        const normalized = (response.data.articles || []).map((article) => ({
            ...article,
            stickerText: summarizeText(article.description || article.title, 140),
            fullContent: normalizeText(article.content || article.description || article.title),
            source: { name: normalizeSourceName(article.source) }
        }));
        res.json(normalized);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch external news' });
    }
});

// Get local news (PostgreSQL)
router.get('/local-news', async (req, res) => {
    try {
        const news = await fetchLocalNewsFromDb();
        res.json(news);
    } catch (error) {
        console.error('[NEWS] Failed to get local news from PostgreSQL:', error);
        res.status(500).json({ error: 'Failed to get local news from PostgreSQL' });
    }
});

// Add local news (PostgreSQL)
router.post('/local-news', async (req, res) => {
    try {
        await initializeNewsStorage();
        const payload = normalizeNewsPayload(req.body);
        const result = await pool.query(
            `
                INSERT INTO news_articles (
                    id, title, sticker_text, full_content, description, url, url_to_image,
                    source_name, category, author, status, views, published_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz)
                RETURNING id, title, sticker_text, full_content, description, url, url_to_image,
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
router.put('/local-news/:id', async (req, res) => {
    try {
        await initializeNewsStorage();
        const targetId = normalizeText(req.params.id);
        const existingResult = await pool.query(
            `
                SELECT id, title, sticker_text, full_content, description, url, url_to_image,
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
                    source_name = $8,
                    category = $9,
                    author = $10,
                    status = $11,
                    views = $12,
                    published_at = $13::timestamptz,
                    updated_at = $14::timestamptz
                WHERE id = $1
                RETURNING id, title, sticker_text, full_content, description, url, url_to_image,
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
router.delete('/local-news/:id', async (req, res) => {
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
        const url = 'https://www.detik.com/tag/konstruksi/';
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const articles = [];

        $('.list-content__item').each((index, element) => {
            if (articles.length >= 10) return false;

            const title = $(element).find('h3 a').text().trim();
            const articleUrl = $(element).find('h3 a').attr('href');
            const description = $(element).find('.media__desc').text().trim();
            const imgSrc = $(element).find('.media__image img').attr('src');

            if (title && articleUrl) {
                articles.push({
                    title,
                    stickerText: summarizeText(description || title, 140),
                    description,
                    fullContent: description,
                    url: articleUrl.startsWith('http') ? articleUrl : `https://www.detik.com${articleUrl}`,
                    urlToImage: normalizeImageUrl(imgSrc),
                    source: { name: 'Detik.com' },
                    publishedAt: new Date().toISOString(),
                    category: 'Construction'
                });
            }
        });

        res.json(articles);
    } catch (error) {
        console.error('Error scraping Detik:', error);
        res.status(500).json({ error: 'Gagal mengambil berita dari Detik' });
    }
});

// Get all news (scraped + local PostgreSQL)
router.get('/all-news', async (req, res) => {
    try {
        console.log('[NEWS] Starting news aggregation...');

        const baseUrl = process.env.BCL_BASE_URL || `${req.protocol}://${req.get('host')}`;
        let scrapedArticles = [];

        try {
            const kompasResponse = await axios.get(`${baseUrl}/api/news/scrape-kompas`);
            if (Array.isArray(kompasResponse.data)) {
                scrapedArticles.push(...kompasResponse.data);
                console.log(`[NEWS] Kompas: ${kompasResponse.data.length} articles`);
            }
        } catch (kompasError) {
            console.warn('[NEWS] Kompas scraping failed:', kompasError.message);
        }

        try {
            const detikResponse = await axios.get(`${baseUrl}/api/news/scrape-detik`);
            if (Array.isArray(detikResponse.data)) {
                scrapedArticles.push(...detikResponse.data);
                console.log(`[NEWS] Detik: ${detikResponse.data.length} articles`);
            }
        } catch (detikError) {
            console.warn('[NEWS] Detik scraping failed:', detikError.message);
        }

        const localNews = await fetchLocalNewsFromDb();
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
                source: { name: normalized.sourceName },
                publishedAt: normalized.publishedAt,
                category: normalized.category,
                author: normalized.author,
                status: normalized.status,
                views: normalized.views
            };
        });

        const uniqueNews = deduplicateArticles(mergedArticles).sort(
            (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
        );

        if (uniqueNews.length === 0) {
            return res.json(getStaticFallbackNews());
        }

        return res.json(uniqueNews);
    } catch (error) {
        console.error('[NEWS] Error in all-news:', error);
        return res.json(getStaticFallbackNews());
    }
});

function getStaticFallbackNews() {
    const nowIso = new Date().toISOString();
    return [
        {
            id: 'fallback-1',
            title: 'Peraturan BIM Terbaru dari Kementerian PUPR',
            stickerText: 'Kementerian PUPR mengeluarkan regulasi terbaru implementasi BIM di proyek nasional.',
            description: 'Kementerian PUPR mengeluarkan regulasi terbaru implementasi BIM di proyek nasional.',
            fullContent: 'Kementerian PUPR mengeluarkan regulasi terbaru mengenai implementasi BIM di Indonesia, termasuk pedoman standar data, kolaborasi lintas disiplin, dan target adopsi pada proyek strategis.',
            url: '#',
            urlToImage: DEFAULT_NEWS_IMAGE,
            source: { name: 'Kementerian PUPR' },
            publishedAt: nowIso,
            category: 'Regulation'
        },
        {
            id: 'fallback-2',
            title: 'Teknologi BIM 2025: Inovasi Terbaru',
            stickerText: 'Inovasi BIM 2025 menyoroti AI, VR/AR, dan otomatisasi kolaborasi proyek.',
            description: 'Inovasi BIM 2025 menyoroti AI, VR/AR, dan otomatisasi kolaborasi proyek.',
            fullContent: 'Eksplorasi teknologi BIM terbaru termasuk AI, VR/AR, dan otomasi alur kerja untuk mempercepat koordinasi desain dan konstruksi serta meningkatkan kualitas keputusan proyek.',
            url: '#',
            urlToImage: DEFAULT_NEWS_IMAGE,
            source: { name: 'Teknologi Indonesia' },
            publishedAt: nowIso,
            category: 'Technology'
        },
        {
            id: 'fallback-3',
            title: 'Program BIM untuk Universitas Indonesia',
            stickerText: 'Universitas Indonesia meluncurkan program magister BIM terintegrasi.',
            description: 'Universitas Indonesia meluncurkan program magister BIM terintegrasi.',
            fullContent: 'Universitas Indonesia meluncurkan program magister BIM terintegrasi untuk mempersiapkan ahli konstruksi digital dengan fokus pada manajemen informasi, koordinasi model, dan standar internasional.',
            url: 'https://ui.ac.id',
            urlToImage: DEFAULT_NEWS_IMAGE,
            source: { name: 'Universitas Indonesia' },
            publishedAt: nowIso,
            category: 'Education'
        }
    ];
}

module.exports = router;
