document.addEventListener('DOMContentLoaded', () => {
    const defaultImage = '/img/ready.jpg';
    const articlesPerPage = 9;

    const newsContainer = document.getElementById('news-container');
    const featuredContainer = document.getElementById('featured-articles');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const newsCount = document.getElementById('news-count');
    const feedStatus = document.getElementById('feed-status');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const resetBtn = document.getElementById('reset-btn');
    const filterButtons = Array.from(document.querySelectorAll('.filter-btn[data-filter]'));

    if (!newsContainer || !featuredContainer) return;

    let allNews = [];
    let activeNews = [];
    let currentCategory = 'all';
    let currentPage = 0;
    let searchTerm = '';
    let searchTimer = null;

    attachEventListeners();
    showLoadingState();
    loadNews();

    async function loadNews() {
        const stamp = Date.now();
        const localRequest = settle(fetchNewsArray(`/api/news/local-news?_ts=${stamp}`));
        const aggregateRequest = settle(fetchNewsArray(`/api/news/all-news?_ts=${stamp}`));

        const localResult = await localRequest;
        let localNews = [];

        if (localResult.ok) {
            localNews = normalizeNewsArray(localResult.value);
            if (localNews.length) {
                setNews(localNews);
            }
        } else {
            console.warn('[NEWS] Local feed unavailable:', localResult.error?.message || localResult.error);
        }

        const aggregateResult = await aggregateRequest;
        if (!aggregateResult.ok) {
            console.warn('[NEWS] Aggregate feed unavailable:', aggregateResult.error?.message || aggregateResult.error);
        }

        if (aggregateResult.ok) {
            setNews(normalizeNewsArray(mergeNewsSources(aggregateResult.value, localNews)));
            return;
        }

        if (localResult.ok) {
            setNews(localNews);
            return;
        }

        showErrorState();
    }

    function settle(promise) {
        return promise
            .then((value) => ({ ok: true, value }))
            .catch((error) => ({ ok: false, error }));
    }

    async function fetchNewsArray(url) {
        const response = await fetch(url, {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
            throw new Error('Format feed berita tidak valid');
        }
        return payload;
    }

    function setNews(news) {
        allNews = news;
        updateFeedStatus();
        displayFeaturedNews();
        applyFilters();
    }

    function normalizeNewsArray(newsArray) {
        return newsArray
            .filter((article) => article && typeof article === 'object')
            .map((article, index) => normalizeSingleArticle(article, index))
            .sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
    }

    function normalizeSingleArticle(article, index) {
        const fullContent = safeText(article.fullContent || article.content);
        const stickerText = safeText(
            article.stickerText ||
            article.mainSentence ||
            article.summary ||
            article.description ||
            summarizeText(fullContent, 160)
        );
        const title = safeText(article.title) || summarizeText(stickerText, 90) || 'Berita tanpa judul';
        const description = safeText(article.description) || stickerText || summarizeText(fullContent, 180);
        const publishedAt = safeText(article.publishedAt || article.published_date);
        const media = normalizeMediaItems(article.media, article.urlToImage || article.image);
        const primaryImage = media.find((item) => item.type === 'image')?.url || defaultImage;

        return {
            id: buildStableArticleId(article, index),
            title,
            stickerText,
            description,
            fullContent,
            source: { name: safeText(article.source?.name || article.source || article.sourceName) || 'Sumber tidak diketahui' },
            url: normalizeExternalUrl(article.url),
            urlToImage: primaryImage,
            media,
            category: safeText(article.category) || detectNewsCategory(article),
            origin: safeText(article.origin || article.sourceType).toLowerCase() === 'external' ? 'external' : 'local',
            publishedAt,
            displayDate: formatDisplayDate(publishedAt)
        };
    }

    function mergeNewsSources(primary, secondary) {
        const unique = [];
        const seen = new Set();

        [...primary, ...secondary].forEach((article) => {
            const key = buildNewsKey(article);
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(article);
        });

        return unique;
    }

    function buildNewsKey(article) {
        const explicitId = safeText(article?.id);
        if (explicitId) return `id:${explicitId}`;

        const url = normalizeExternalUrl(article?.url);
        if (url) return `url:${url.toLowerCase()}`;

        const title = safeText(article?.title).toLowerCase();
        const source = safeText(article?.source?.name || article?.source).toLowerCase();
        const date = safeText(article?.publishedAt || article?.published_date).toLowerCase();
        return title ? `content:${title}|${source}|${date}` : '';
    }

    function buildStableArticleId(article, index) {
        const explicitId = safeText(article?.id);
        if (explicitId) return explicitId;

        const url = normalizeExternalUrl(article?.url);
        if (url) return url;

        const titlePart = safeText(article?.title || article?.description)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 70);
        const datePart = safeText(article?.publishedAt || article?.published_date)
            .replace(/[^0-9]/g, '')
            .slice(0, 14);
        return `news-${datePart || 'undated'}-${titlePart || 'article'}-${index}`;
    }

    function displayFeaturedNews() {
        const lead = allNews[0];
        if (!lead) {
            featuredContainer.replaceChildren();
            return;
        }

        const railItems = allNews.slice(1, 4).map((article, index) => `
            <button class="news-rail-item" type="button" data-news-action="open" data-news-id="${escapeAttribute(article.id)}">
                <span class="news-rail-item__number">0${index + 1}</span>
                <span class="news-rail-item__content">
                    ${buildOriginTag(article)}
                    <strong>${escapeHtml(summarizeText(article.title, 95))}</strong>
                    <span class="news-meta"><span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(article.displayDate)}</span></span>
                </span>
            </button>`).join('');

        featuredContainer.innerHTML = `
            <div class="newsroom-lead-grid">
                <article class="newsroom-lead">
                    <div class="newsroom-lead__image-wrap">
                        <img class="newsroom-lead__image news-image" src="${escapeAttribute(lead.urlToImage)}" alt="${escapeAttribute(lead.title)}">
                        ${buildMediaIndicator(lead)}
                    </div>
                    <div class="newsroom-lead__body">
                        <div class="news-list-item__topline">
                            <span class="news-kicker">${escapeHtml(localizeNewsCategory(lead.category))}</span>
                            ${buildOriginTag(lead)}
                        </div>
                        <h2>${escapeHtml(lead.title)}</h2>
                        <p class="news-description">${escapeHtml(summarizeText(lead.stickerText || lead.description, 260) || 'Ringkasan belum tersedia.')}</p>
                        ${buildMeta(lead)}
                        <div class="news-actions">
                            ${buildPrimaryAction(lead)}
                            <button class="news-action news-action--secondary" type="button" data-news-action="share" data-news-id="${escapeAttribute(lead.id)}">
                                <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Bagikan
                            </button>
                        </div>
                    </div>
                </article>
                <aside class="newsroom-rail" aria-label="Berita terbaru lainnya">
                    <h2 class="newsroom-rail__heading">Terbaru lainnya</h2>
                    ${railItems || '<p class="news-description py-3">Belum ada berita tambahan.</p>'}
                </aside>
            </div>`;
    }

    function applyFilters() {
        const normalizedTerm = searchTerm.toLocaleLowerCase('id-ID');
        activeNews = allNews.filter((article) => {
            const matchesCategory = categoryMatches(article, currentCategory);
            if (!matchesCategory) return false;
            if (!normalizedTerm) return true;

            const searchableText = [
                article.title,
                article.stickerText,
                article.description,
                article.fullContent,
                article.source.name,
                article.category
            ].join(' ').toLocaleLowerCase('id-ID');
            return searchableText.includes(normalizedTerm);
        });

        currentPage = 0;
        renderActiveNews();
        updateSearchSummary();
    }

    function renderActiveNews() {
        if (!activeNews.length) {
            displayEmptyState();
            return;
        }

        const visibleCount = Math.min((currentPage + 1) * articlesPerPage, activeNews.length);
        newsContainer.innerHTML = activeNews
            .slice(0, visibleCount)
            .map(renderNewsCard)
            .join('');

        if (newsCount) {
            newsCount.textContent = `${activeNews.length} berita ditemukan`;
        }
        if (loadMoreBtn) {
            loadMoreBtn.hidden = visibleCount >= activeNews.length;
        }
    }

    function renderNewsCard(article) {
        const description = summarizeText(article.stickerText || article.description, 190) || 'Ringkasan belum tersedia.';
        return `
            <article class="news-list-item">
                <div class="news-list-item__image-wrap">
                    <img class="news-list-item__image news-image" src="${escapeAttribute(article.urlToImage)}" alt="${escapeAttribute(article.title)}" loading="lazy">
                    ${buildMediaIndicator(article)}
                </div>
                <div class="news-list-item__body">
                    <div class="news-list-item__topline">
                        <span class="news-kicker">${escapeHtml(localizeNewsCategory(article.category))}</span>
                        ${buildOriginTag(article)}
                    </div>
                    <h3>${escapeHtml(summarizeText(article.title, 115))}</h3>
                    <p class="news-description">${escapeHtml(description)}</p>
                    ${buildMeta(article)}
                    <div class="news-actions">
                        ${buildPrimaryAction(article)}
                        <button class="news-action news-action--secondary" type="button" data-news-action="share" data-news-id="${escapeAttribute(article.id)}">
                            <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Bagikan
                        </button>
                    </div>
                </div>
            </article>`;
    }

    function buildOriginTag(article) {
        const isExternal = article.origin === 'external';
        const icon = isExternal ? 'fa-arrow-up-right-from-square' : 'fa-building';
        const label = isExternal ? 'Portal eksternal' : 'BCL internal';
        return `<span class="news-origin ${isExternal ? 'news-origin--external' : ''}"><i class="fa-solid ${icon}" aria-hidden="true"></i>${label}</span>`;
    }

    function buildMediaIndicator(article) {
        const media = Array.isArray(article.media) ? article.media : [];
        if (media.length <= 1 && !media.some((item) => item.type === 'video')) return '';
        const photoCount = media.filter((item) => item.type === 'image').length;
        const hasVideo = media.some((item) => item.type === 'video');
        const label = [photoCount ? `${photoCount} foto` : '', hasVideo ? 'video' : ''].filter(Boolean).join(' + ');
        return `<span class="news-media-indicator"><i class="fa-solid fa-photo-film" aria-hidden="true"></i>${escapeHtml(label)}</span>`;
    }

    function buildMeta(article) {
        return `
            <div class="news-meta">
                <span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(article.displayDate)}</span>
                <span><i class="fa-regular fa-building" aria-hidden="true"></i>${escapeHtml(article.source.name)}</span>
            </div>`;
    }

    function buildPrimaryAction(article) {
        if (article.fullContent || article.description) {
            return `
                <button class="news-action news-action--primary" type="button" data-news-action="open" data-news-id="${escapeAttribute(article.id)}">
                    <i class="fa-regular fa-newspaper" aria-hidden="true"></i> Baca lengkap
                </button>`;
        }

        if (article.url) {
            return `
                <a class="news-action news-action--primary" href="${escapeAttribute(article.url)}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Buka sumber
                </a>`;
        }

        return '<span class="news-action news-action--secondary" aria-disabled="true">Detail belum tersedia</span>';
    }

    function attachEventListeners() {
        searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchTerm = searchInput.value.trim();
                applyFilters();
            }, 250);
        });

        resetBtn?.addEventListener('click', resetFilters);

        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                currentCategory = button.dataset.filter || 'all';
                filterButtons.forEach((item) => {
                    const isActive = item === button;
                    item.classList.toggle('active', isActive);
                    item.setAttribute('aria-pressed', String(isActive));
                });
                applyFilters();
            });
        });

        loadMoreBtn?.addEventListener('click', () => {
            currentPage += 1;
            renderActiveNews();
        });

        [newsContainer, featuredContainer].forEach((container) => {
            container.addEventListener('click', handleNewsAction);
            container.addEventListener('error', handleImageError, true);
        });
    }

    function handleNewsAction(event) {
        const control = event.target.closest('[data-news-action]');
        if (!control) return;

        const action = control.dataset.newsAction;
        if (action === 'reset') {
            resetFilters();
            return;
        }
        if (action === 'retry') {
            showLoadingState();
            loadNews();
            return;
        }

        const article = findArticle(control.dataset.newsId);
        if (!article) return;
        if (action === 'open') openFullNews(article);
        if (action === 'share') shareArticle(article);
    }

    function handleImageError(event) {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.classList.contains('news-image')) return;
        if (image.dataset.fallbackApplied === 'true') return;
        image.dataset.fallbackApplied = 'true';
        image.src = defaultImage;
    }

    function findArticle(id) {
        return allNews.find((article) => String(article.id) === String(id || ''));
    }

    function openFullNews(article) {
        document.getElementById('fullNewsModal')?.remove();

        const sourceLink = article.url
            ? `<a class="btn btn-outline-primary" href="${escapeAttribute(article.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square me-1" aria-hidden="true"></i>Buka sumber asli</a>`
            : '';

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="fullNewsModal" tabindex="-1" aria-labelledby="fullNewsModalTitle" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="modal-title fs-5" id="fullNewsModalTitle">${escapeHtml(article.title)}</h2>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
                        </div>
                        <div class="modal-body">
                            ${buildArticleMedia(article)}
                            ${buildMeta(article)}
                            <div class="news-modal-summary p-3 mb-4">${escapeHtml(article.stickerText || article.description || 'Ringkasan belum tersedia.')}</div>
                            <div class="news-modal-content lh-lg">${escapeHtml(article.fullContent || article.description || 'Isi lengkap belum tersedia.')}</div>
                        </div>
                        <div class="modal-footer">
                            ${sourceLink}
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                        </div>
                    </div>
                </div>
            </div>`);

        const modalElement = document.getElementById('fullNewsModal');
        modalElement.addEventListener('error', handleImageError, true);
        modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove(), { once: true });
        bootstrap.Modal.getOrCreateInstance(modalElement, {
            backdrop: true,
            focus: true,
            keyboard: true
        }).show();
    }

    function buildArticleMedia(article) {
        const media = Array.isArray(article.media) && article.media.length
            ? article.media
            : [{ type: 'image', url: article.urlToImage, caption: '' }];

        return `<div class="news-modal-gallery ${media.length === 1 ? 'news-modal-gallery--single' : ''}">${media.map((item, index) => {
            if (item.type === 'image') {
                return `
                    <figure class="news-modal-media ${index === 0 ? 'news-modal-media--lead' : ''}">
                        <img class="news-image" src="${escapeAttribute(item.url)}" alt="${escapeAttribute(item.caption || `${article.title} — foto ${index + 1}`)}" loading="${index === 0 ? 'eager' : 'lazy'}">
                        ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
                    </figure>`;
            }

            const youtubeId = getYoutubeId(item.url);
            if (youtubeId) {
                return `
                    <figure class="news-modal-media news-modal-media--video ${index === 0 ? 'news-modal-media--lead' : ''}">
                        <div class="ratio ratio-16x9">
                            <iframe src="https://www.youtube-nocookie.com/embed/${youtubeId}" title="${escapeAttribute(item.caption || `Video ${article.title}`)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
                        </div>
                        ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
                    </figure>`;
            }

            return `
                <figure class="news-modal-media news-modal-media--video ${index === 0 ? 'news-modal-media--lead' : ''}">
                    <video controls preload="metadata" playsinline>
                        <source src="${escapeAttribute(item.url)}">
                        Browser Anda tidak mendukung pemutar video.
                    </video>
                    ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
                </figure>`;
        }).join('')}</div>`;
    }

    async function shareArticle(article) {
        const shareUrl = article.url || window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: article.title, url: shareUrl });
                return;
            }
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                window.alert('Tautan berita berhasil disalin.');
                return;
            }
            window.prompt('Salin tautan berita:', shareUrl);
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.warn('[NEWS] Share failed:', error);
            }
        }
    }

    function updateSearchSummary() {
        if (!searchResults) return;
        const parts = [];
        if (searchTerm) parts.push(`kata kunci “${searchTerm}”`);
        if (currentCategory !== 'all') parts.push(`kategori ${localizeNewsCategory(currentCategory)}`);

        searchResults.textContent = parts.length
            ? `${activeNews.length} dari ${allNews.length} berita cocok dengan ${parts.join(' dan ')}.`
            : '';
    }

    function updateFeedStatus() {
        if (!feedStatus) return;
        const externalCount = allNews.filter((article) => article.origin === 'external').length;
        const localCount = allNews.length - externalCount;

        if (externalCount > 0) {
            feedStatus.textContent = `${localCount} berita BCL + ${externalCount} berita portal eksternal sesuai topik.`;
        } else if (localCount > 0) {
            feedStatus.textContent = `${localCount} berita BCL aktif. Portal eksternal belum mengirim artikel sesuai topik.`;
        } else {
            feedStatus.textContent = 'Belum ada berita dari sumber yang terhubung.';
        }
    }

    function displayEmptyState() {
        const isFiltered = Boolean(searchTerm || currentCategory !== 'all');
        newsContainer.innerHTML = `
                <div class="news-empty-state">
                    <span class="news-state-icon"><i class="fa-regular fa-newspaper" aria-hidden="true"></i></span>
                    <h3>${isFiltered ? 'Berita tidak ditemukan' : 'Belum ada berita yang diterbitkan'}</h3>
                    <p>${isFiltered ? 'Coba gunakan kata kunci atau kategori lain.' : 'Berita akan muncul di halaman ini setelah diterbitkan oleh admin atau tersedia dari sumber terhubung.'}</p>
                    ${isFiltered ? '<button class="news-reset-btn mt-3" type="button" data-news-action="reset"><i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>Reset filter</button>' : ''}
                </div>`;
        if (newsCount) newsCount.textContent = '0 berita ditemukan';
        if (loadMoreBtn) loadMoreBtn.hidden = true;
    }

    function showLoadingState() {
        featuredContainer.replaceChildren();
        newsContainer.innerHTML = `
                <div class="news-loading-state" role="status">
                    <span class="news-state-icon"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></span>
                    <h3>Memuat berita terkini</h3>
                    <p>Menghubungkan halaman dengan sumber berita BCL.</p>
                </div>`;
        if (feedStatus) feedStatus.textContent = 'Menghubungkan sumber berita...';
        if (newsCount) newsCount.textContent = '';
        if (loadMoreBtn) loadMoreBtn.hidden = true;
    }

    function showErrorState() {
        allNews = [];
        activeNews = [];
        featuredContainer.replaceChildren();
        newsContainer.innerHTML = `
                <div class="news-error-state" role="alert">
                    <span class="news-state-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>
                    <h3>Berita belum dapat dimuat</h3>
                    <p>Koneksi ke sumber berita sedang bermasalah. Tidak ada konten contoh yang ditampilkan sebagai pengganti.</p>
                    <button class="news-reset-btn mt-3" type="button" data-news-action="retry"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i>Coba lagi</button>
                </div>`;
        if (feedStatus) feedStatus.textContent = 'Sumber berita tidak dapat dihubungi.';
        if (newsCount) newsCount.textContent = 'Sumber berita tidak tersedia';
        if (loadMoreBtn) loadMoreBtn.hidden = true;
    }

    function resetFilters() {
        currentCategory = 'all';
        searchTerm = '';
        if (searchInput) searchInput.value = '';
        filterButtons.forEach((button) => {
            const isActive = button.dataset.filter === 'all';
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
        applyFilters();
        searchInput?.focus();
    }

    function categoryMatches(article, filter) {
        if (!filter || filter === 'all') return true;
        const value = [article.category, article.title, article.stickerText]
            .map(safeText)
            .join(' ')
            .toLowerCase();
        const aliases = {
            bim: ['bim', 'general', 'umum'],
            construction: ['construction', 'konstruksi'],
            technology: ['technology', 'teknologi', 'automation'],
            regulation: ['regulation', 'regulasi', 'standard', 'standar'],
            infrastructure: ['infrastructure', 'infrastruktur'],
            education: ['education', 'edukasi', 'training', 'pelatihan'],
            international: ['international', 'internasional', 'global']
        };
        return (aliases[filter] || [filter]).some((alias) => value.includes(alias));
    }

    function detectNewsCategory(article) {
        const text = safeText(`${article.title || ''} ${article.description || ''} ${article.content || ''}`).toLowerCase();
        if (/regulasi|permen|undang-undang|standard|standar/.test(text)) return 'Regulation';
        if (/teknologi|software|digital|otomasi|automation|\bai\b/.test(text)) return 'Technology';
        if (/pendidikan|training|kursus|universitas|pelatihan/.test(text)) return 'Education';
        if (/infrastruktur|jembatan|jalan/.test(text)) return 'Infrastructure';
        if (/internasional|global/.test(text)) return 'International';
        if (/konstruksi|proyek/.test(text)) return 'Construction';
        return 'BIM';
    }

    function localizeNewsCategory(category) {
        const labels = {
            regulation: 'Regulasi',
            technology: 'Teknologi',
            education: 'Edukasi',
            infrastructure: 'Infrastruktur',
            international: 'Internasional',
            construction: 'Konstruksi',
            standards: 'Standar',
            standard: 'Standar',
            general: 'Umum',
            bim: 'BIM'
        };
        const value = safeText(category);
        return labels[value.toLowerCase()] || value || 'Umum';
    }

    function normalizeExternalUrl(value) {
        const raw = safeText(value);
        if (!raw || raw === '#') return '';
        try {
            const url = new URL(raw, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function normalizeMediaItems(items, legacyImage = '') {
        const result = [];
        const seen = new Set();
        const source = Array.isArray(items) ? items : [];

        source.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const type = safeText(item.type).toLowerCase() === 'video' ? 'video' : 'image';
            const url = normalizeMediaUrl(item.url || item.src, type);
            if (!url || seen.has(`${type}:${url}`)) return;
            seen.add(`${type}:${url}`);
            result.push({
                type,
                url,
                caption: safeText(item.caption).slice(0, 240)
            });
        });

        const legacyUrl = normalizeMediaUrl(legacyImage, 'image');
        if (legacyUrl && !result.some((item) => item.type === 'image' && item.url === legacyUrl)) {
            result.unshift({ type: 'image', url: legacyUrl, caption: '' });
        }
        if (!result.length) {
            result.push({ type: 'image', url: defaultImage, caption: '' });
        }
        return result.slice(0, 12);
    }

    function normalizeMediaUrl(value, type = 'image') {
        const raw = safeText(value).replace(/\\/g, '/');
        if (!raw) return '';
        if (type === 'image' && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) return raw;
        try {
            const url = new URL(raw, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function getYoutubeId(value) {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            const host = url.hostname.replace(/^www\./, '').toLowerCase();
            if (host === 'youtu.be') {
                const candidate = url.pathname.slice(1);
                return /^[\w-]{6,15}$/.test(candidate) ? candidate : '';
            }
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
                const candidate = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([\w-]{6,15})/)?.[1] || '';
                return /^[\w-]{6,15}$/.test(candidate) ? candidate : '';
            }
        } catch {
            return '';
        }
        return '';
    }

    function formatDisplayDate(value) {
        const timestamp = dateValue(value);
        if (!timestamp) return 'Tanpa tanggal';
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(new Date(timestamp));
    }

    function dateValue(value) {
        const timestamp = Date.parse(value || '');
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    function summarizeText(value, maxLength) {
        const cleaned = safeText(value).replace(/\s+/g, ' ');
        if (cleaned.length <= maxLength) return cleaned;
        return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
    }

    function safeText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }
});
