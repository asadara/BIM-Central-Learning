document.addEventListener('DOMContentLoaded', function () {
    const defaultImage = '/img/ready.jpg';
    const defaultFallbackImage = '/img/ready.jpg';
    const fullReadLabel = 'Baca Berita Lengkap';

    let allNews = [];
    let featuredNews = [];
    let currentFilters = {
        topic: '',
        source: '',
        category: 'all'
    };
    let currentPage = 0;
    let isApiAvailable = true;
    let searchTimeout = null;

    const articlesPerPage = 12;

    const newsContainer = document.getElementById('news-container');
    const featuredContainer = document.getElementById('featured-articles');
    const searchInput = document.getElementById('searchInput');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const resetBtn = document.getElementById('reset-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');

    const debouncedSearch = () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch();
        }, 500);
    };

    window.debouncedSearch = debouncedSearch;
    window.performSearch = performSearch;

    showLoadingState();
    attachEventListeners();
    loadNews();

    async function loadNews() {
        const stamp = Date.now();
        const [allNewsResult, localNewsResult] = await Promise.allSettled([
            fetchNewsArray(`/api/news/all-news?_ts=${stamp}`),
            fetchNewsArray(`/api/news/local-news?_ts=${stamp}`)
        ]);

        if (allNewsResult.status === 'rejected') {
            console.warn('all-news endpoint failed:', allNewsResult.reason?.message || allNewsResult.reason);
        }
        if (localNewsResult.status === 'rejected') {
            console.warn('local-news endpoint failed:', localNewsResult.reason?.message || localNewsResult.reason);
        }

        const allNewsList = allNewsResult.status === 'fulfilled' ? allNewsResult.value : [];
        const localNewsList = localNewsResult.status === 'fulfilled' ? localNewsResult.value : [];
        const mergedNews = mergeNewsSources(allNewsList, localNewsList);

        if (mergedNews.length > 0) {
            allNews = normalizeNewsArray(mergedNews);
            isApiAvailable = true;
        } else {
            console.warn('News endpoints returned empty data, fallback to static');
            allNews = normalizeNewsArray(getStaticFallbackNews());
            isApiAvailable = false;
        }

        initializeNewsDisplay();
        checkApiStatus();
    }

    async function fetchNewsArray(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid news format');
        }
        return data;
    }

    function mergeNewsSources(primaryNews, secondaryNews) {
        const combined = [...primaryNews, ...secondaryNews];
        const deduped = [];
        const seen = new Set();

        for (const article of combined) {
            const key = buildNewsKey(article);
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(article);
        }

        return deduped;
    }

    function buildNewsKey(article) {
        const id = safeText(article?.id);
        if (id) return `id:${id}`;

        const url = safeText(article?.url).toLowerCase();
        if (url && url !== '#') return `url:${url}`;

        const title = safeText(article?.title).toLowerCase();
        const sourceName = safeText(article?.source?.name || article?.source).toLowerCase();
        const publishedAt = safeText(article?.publishedAt || article?.published_date).toLowerCase();
        return `fallback:${title}|${sourceName}|${publishedAt}`;
    }

    function initializeNewsDisplay() {
        featuredNews = extractFeaturedNews(allNews);
        displayFeaturedNews();
        displayNewsPaginated(0);

        if (!isApiAvailable) {
            showFallbackContent();
        }

        hideLoadingState();
    }

    function normalizeNewsArray(newsArray) {
        return newsArray
            .map((article, index) => normalizeSingleArticle(article, index))
            .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    }

    function normalizeSingleArticle(article, index) {
        const fullContent = safeText(article.fullContent || article.content || '');
        const stickerText = safeText(
            article.stickerText ||
            article.mainSentence ||
            article.description ||
            summarizeText(fullContent, 160)
        );
        const title = safeText(article.title) || summarizeText(stickerText, 90) || 'Judul Tidak Tersedia';
        const description = safeText(article.description) || stickerText || summarizeText(fullContent, 180) || 'Deskripsi tidak tersedia';
        const sourceName = safeText(article.source?.name || article.source) || 'Sumber Tidak Diketahui';
        const url = safeText(article.url) || '#';
        const id = buildStableArticleId(article, index);
        const publishedAt = article.publishedAt || article.published_date || new Date().toISOString();

        return {
            ...article,
            id,
            title,
            stickerText,
            description,
            fullContent,
            source: { name: sourceName },
            url,
            urlToImage: resolveImageUrl(article.urlToImage || article.image),
            category: article.category || detectNewsCategory(article),
            publishedAt,
            displayDate: formatDisplayDate(publishedAt)
        };
    }

    function safeText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function buildStableArticleId(article, index) {
        const explicitId = safeText(article?.id);
        if (explicitId) return explicitId;

        const url = safeText(article?.url);
        if (url && url !== '#') return url;

        const titleBase = safeText(article?.title || article?.stickerText || article?.description)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);
        const dateBase = safeText(article?.publishedAt || article?.published_date)
            .replace(/[^0-9]/g, '')
            .slice(0, 14);

        return `news-${dateBase || 'nodate'}-${titleBase || 'untitled'}-${index}`;
    }

    function resolveImageUrl(value) {
        const raw = safeText(value);
        if (!raw) return defaultImage;
        if (/^data:image\//i.test(raw)) return raw;
        if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
        if (raw.startsWith('/')) return raw;

        const cleaned = raw.replace(/\\/g, '/').replace(/^[./]+/, '');
        if (cleaned.toLowerCase().startsWith('img/')) {
            return `/${cleaned}`;
        }

        return raw;
    }

    function summarizeText(text, maxLength = 160) {
        const cleaned = safeText(text).replace(/\s+/g, ' ');
        if (!cleaned) return '';
        if (cleaned.length <= maxLength) return cleaned;
        return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
    }

    function extractFeaturedNews(news) {
        return news.slice(0, 3);
    }

    function buildPrimaryAction(article) {
        const hasFullContent = !!safeText(article.fullContent);
        const hasExternalLink = !!(article.url && article.url !== '#');
        const encodedId = encodeURIComponent(article.id);

        if (hasFullContent) {
            return `
                <button class="news-btn news-btn-primary border-0" onclick="openFullNews('${encodedId}')">
                    <i class="fas fa-book-open"></i> ${fullReadLabel}
                </button>
            `;
        }

        if (hasExternalLink) {
            return `
                <a href="${article.url}" target="_blank" class="news-btn news-btn-primary">
                    <i class="fas fa-external-link"></i> ${fullReadLabel}
                </a>
            `;
        }

        return `
            <span class="news-btn news-btn-secondary">
                <i class="fas fa-info-circle"></i> ${fullReadLabel}
            </span>
        `;
    }

    function renderNewsCard(article) {
        const title = article.title;
        const description = article.stickerText || article.description || 'Deskripsi tidak tersedia';
        const imageUrl = resolveImageUrl(article.urlToImage);
        const source = article.source?.name || 'Sumber Tidak Diketahui';
        const category = article.category || 'General';
        const shareUrl = article.url && article.url !== '#' ? article.url : `${window.location.origin}${window.location.pathname}`;

        return `
            <div class="col-lg-4 col-md-6">
                <div class="news-card">
                    <img src="${imageUrl}" alt="${title}" class="news-image" onerror="this.src='${defaultImage}'">
                    <div class="news-badge">${category}</div>
                    <h5 class="news-title">${title.length > 70 ? `${title.substring(0, 70)}...` : title}</h5>
                    <p class="news-description">${description.length > 160 ? `${description.substring(0, 160)}...` : description}</p>
                    <div class="news-meta">
                        <i class="fas fa-calendar me-1"></i>${article.displayDate} |
                        <i class="fas fa-user me-1"></i>${source}
                    </div>
                    <div class="news-actions">
                        ${buildPrimaryAction(article)}
                        <span class="news-btn news-btn-secondary" onclick="shareArticle('${encodeURIComponent(title)}', '${encodeURIComponent(shareUrl)}')">
                            <i class="fas fa-share"></i> Share
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    function displayFeaturedNews() {
        if (!featuredContainer || featuredNews.length === 0) return;

        const lead = featuredNews[0];
        const leadDescription = lead.stickerText || lead.description || 'No description available';

        featuredContainer.innerHTML = `
            <div class="featured-article">
                <div class="row">
                    <div class="col-md-6">
                        <img src="${resolveImageUrl(lead.urlToImage)}" alt="${lead.title}" class="w-100 h-100 object-cover" onerror="this.src='${defaultImage}'">
                    </div>
                    <div class="col-md-6 d-flex align-items-center">
                        <div class="p-4">
                            <div class="news-badge mb-3">${lead.category || 'BIM'}</div>
                            <h3 class="news-title">${lead.title}</h3>
                            <p class="news-description">${leadDescription.length > 220 ? `${leadDescription.substring(0, 220)}...` : leadDescription}</p>
                            <div class="news-meta mb-3">
                                <i class="fas fa-calendar me-2"></i>${lead.displayDate} |
                                <i class="fas fa-user me-2"></i>${lead.source?.name || 'Unknown Source'}
                            </div>
                            ${buildPrimaryAction(lead)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function displayNewsPaginated(page = 0, customNewsArray = null) {
        if (!newsContainer) {
            console.error('News container not found');
            return;
        }

        const filteredNews = customNewsArray || applyCategoryFilter(allNews);
        const paginatedNews = paginateNews(filteredNews, page);

        if (paginatedNews.length === 0) {
            displayEmptyState();
            return;
        }

        newsContainer.innerHTML = paginatedNews.map((article) => renderNewsCard(article)).join('');

        const totalPages = Math.ceil(filteredNews.length / articlesPerPage);
        if (page + 1 < totalPages && loadMoreBtn) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.onclick = () => loadMoreArticles(page + 1);
        } else if (loadMoreBtn) {
            loadMoreBtn.style.display = 'none';
        }

        currentPage = page;
    }

    function paginateNews(newsArray, page) {
        const start = page * articlesPerPage;
        const end = start + articlesPerPage;
        return newsArray.slice(start, end);
    }

    function loadMoreArticles(page) {
        const currentNews = newsContainer.querySelectorAll('.news-card');
        if (!currentNews.length) return;

        const newArticles = document.createElement('div');
        newArticles.className = 'row g-4';
        newArticles.innerHTML = displayNewsPaginatedContent(page);

        currentNews[currentNews.length - 1].parentNode.insertAdjacentHTML('afterend', newArticles.innerHTML);
        currentPage = page;

        const filteredCount = applyCategoryFilter(allNews).length;
        const totalPages = Math.ceil(filteredCount / articlesPerPage);
        if (page + 1 >= totalPages && loadMoreBtn) {
            loadMoreBtn.style.display = 'none';
        }
    }

    function displayNewsPaginatedContent(page) {
        const filteredNews = applyCategoryFilter(allNews);
        const paginatedNews = paginateNews(filteredNews, page);
        return paginatedNews.map((article) => renderNewsCard(article)).join('');
    }

    function attachEventListeners() {
        if (searchInput) {
            searchInput.addEventListener('input', debouncedSearch);
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                resetFilters();
            });
        }

        if (filterButtons) {
            filterButtons.forEach((btn) => {
                btn.addEventListener('click', function () {
                    filterButtons.forEach((item) => item.classList.remove('active'));
                    this.classList.add('active');
                    currentFilters.category = this.dataset.filter;
                    displayNewsPaginated(0);

                    const resultsDiv = document.getElementById('searchResults');
                    if (resultsDiv) resultsDiv.innerHTML = '';
                });
            });
        }
    }

    function createSearchResultsDiv() {
        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'searchResults';
        resultsDiv.className = 'container mt-2';

        const filterSection = document.querySelector('.filter-section');
        if (filterSection) {
            filterSection.insertAdjacentElement('afterend', resultsDiv);
        }

        return resultsDiv;
    }

    function performSearch() {
        const searchTerm = (searchInput?.value || '').toLowerCase().trim();
        const resultsDiv = document.getElementById('searchResults') || createSearchResultsDiv();

        if (!searchTerm) {
            displayNewsPaginated(0);
            resultsDiv.innerHTML = '';
            return;
        }

        const filteredNews = allNews.filter((article) => {
            const fullText = [
                article.title,
                article.stickerText,
                article.description,
                article.fullContent,
                article.source?.name,
                article.category
            ]
                .join(' ')
                .toLowerCase();

            return fullText.includes(searchTerm);
        });

        displayNewsPaginated(0, filteredNews);
        resultsDiv.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-search me-2"></i>
                Found <strong>${filteredNews.length}</strong> articles from <strong>${allNews.length}</strong> total articles for "<strong>${searchTerm}</strong>"
            </div>
        `;
    }

    function applyCategoryFilter(newsArray) {
        if (currentFilters.category === 'all' || !currentFilters.category) {
            return newsArray;
        }

        return newsArray.filter((article) => {
            const category = (article.category || 'general').toLowerCase();
            const filter = currentFilters.category.toLowerCase();

            if (filter === 'bim') return category.includes('bim') || category === 'general';
            if (filter === 'construction') return category.includes('construction') || category.includes('infrastructure');
            if (filter === 'technology') return category.includes('technology') || category.includes('automation');
            if (filter === 'regulation') return category.includes('regulation') || category.includes('standard');
            if (filter === 'education') return category.includes('education') || category.includes('training');
            if (filter === 'international') return category.includes('international');

            return category === filter;
        });
    }

    function detectNewsCategory(article) {
        const text = `${article.title || ''} ${article.description || ''} ${article.content || ''} ${article.fullContent || ''}`.toLowerCase();

        if (text.includes('regulasi') || text.includes('permen') || text.includes('menteri') || text.includes('undang-undang')) return 'Regulation';
        if (text.includes('teknologi') || text.includes('ai') || text.includes('software') || text.includes('digital')) return 'Technology';
        if (text.includes('pendidikan') || text.includes('training') || text.includes('kursus') || text.includes('universitas')) return 'Education';
        if (text.includes('infrastruktur') || text.includes('jembatan') || text.includes('jalan') || text.includes('konstruksi')) return 'Infrastructure';
        if (text.includes('arsitektur') || text.includes('desain') || text.includes('bangunan')) return 'Architecture';
        if (text.includes('standar') || text.includes('iso') || text.includes('sn')) return 'Standards';
        if (text.includes('internasional') || text.includes('global')) return 'International';
        if (text.includes('konstruksi') || text.includes('proyek')) return 'Construction';

        return 'BIM';
    }

    function formatDisplayDate(dateString) {
        if (!dateString) return 'No date';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    function getStaticFallbackNews() {
        const nowIso = new Date().toISOString();
        return [
            {
                id: 'fallback-1',
                title: 'Peraturan BIM Terbaru dari Kementerian PUPR',
                stickerText: 'Kementerian PUPR merilis pembaruan regulasi implementasi BIM nasional.',
                description: 'Kementerian PUPR merilis pembaruan regulasi implementasi BIM nasional.',
                fullContent: 'Kementerian PUPR merilis regulasi baru yang memperkuat adopsi BIM pada proyek infrastruktur prioritas, termasuk pedoman interoperabilitas data dan kolaborasi lintas disiplin.',
                url: '#',
                urlToImage: defaultFallbackImage,
                source: { name: 'Kementerian PUPR' },
                publishedAt: nowIso,
                category: 'Regulation'
            },
            {
                id: 'fallback-2',
                title: 'Teknologi BIM 2025: Inovasi Terbaru',
                stickerText: 'AI, VR/AR, dan automasi menjadi fokus inovasi BIM tahun 2025.',
                description: 'AI, VR/AR, dan automasi menjadi fokus inovasi BIM tahun 2025.',
                fullContent: 'Industri konstruksi mengadopsi AI, VR/AR, dan automasi workflow BIM untuk meningkatkan akurasi desain, mempercepat koordinasi, serta mengurangi rework di lapangan.',
                url: '#',
                urlToImage: defaultFallbackImage,
                source: { name: 'Teknologi Indonesia' },
                publishedAt: nowIso,
                category: 'Technology'
            },
            {
                id: 'fallback-3',
                title: 'Program BIM untuk Universitas Indonesia',
                stickerText: 'Universitas Indonesia meluncurkan program magister BIM terintegrasi.',
                description: 'Universitas Indonesia meluncurkan program magister BIM terintegrasi.',
                fullContent: 'Program magister BIM terintegrasi diluncurkan untuk memperkuat kompetensi generasi profesional konstruksi digital, mencakup manajemen data, koordinasi model, dan standar global.',
                url: 'https://ui.ac.id',
                urlToImage: defaultFallbackImage,
                source: { name: 'Universitas Indonesia' },
                publishedAt: nowIso,
                category: 'Education'
            }
        ];
    }

    function showFallbackContent() {
        const fallbackDiv = document.getElementById('fallback-content');
        if (fallbackDiv) {
            fallbackDiv.style.display = 'block';
        }
    }

    function checkApiStatus() {
        const statusDiv = document.getElementById('api-status');
        if (!statusDiv) return;

        if (isApiAvailable) {
            statusDiv.className = 'alert alert-success';
            statusDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>API connected successfully - ${allNews.length} articles loaded`;
        } else {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Using fallback content - API unavailable';
        }
    }

    function displayEmptyState() {
        if (!newsContainer) return;

        newsContainer.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>No Articles Found</h4>
                    <p>No news articles match your current filters. Try adjusting your search terms or category filters.</p>
                    <button class="btn btn-outline-primary" onclick="resetFilters()">
                        <i class="fas fa-redo me-1"></i>Reset Filters
                    </button>
                </div>
            </div>
        `;
    }

    function resetFilters() {
        currentFilters = { topic: '', source: '', category: 'all' };
        if (searchInput) searchInput.value = '';

        document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'all') btn.classList.add('active');
        });

        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) resultsDiv.innerHTML = '';

        displayNewsPaginated(0);
    }

    function showLoadingState() {
        if (!newsContainer) return;

        newsContainer.innerHTML = `
            <div class="col-12">
                <div class="loading-spinner text-center py-5">
                    <i class="fas fa-spinner fa-spin fa-3x text-primary mb-3"></i>
                    <h4>Memuat Berita Terkini...</h4>
                    <p class="text-muted">Mengambil berita BIM dari sumber terpercaya</p>
                </div>
            </div>
        `;
    }

    function hideLoadingState() {
        // no-op
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.openFullNews = function (encodedId) {
        const id = decodeURIComponent(encodedId);
        const article = allNews.find((item) => String(item.id) === id);
        if (!article) return;

        const existing = document.getElementById('fullNewsModal');
        if (existing) {
            const existingInstance = bootstrap.Modal.getInstance(existing);
            if (existingInstance) {
                existingInstance.hide();
                existingInstance.dispose();
            }
            existing.remove();
        }

        document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
        document.body.style.removeProperty('overflow');

        const modalHtml = `
            <div class="modal fade" id="fullNewsModal" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fas fa-newspaper me-2"></i>${escapeHtml(article.title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <img src="${resolveImageUrl(article.urlToImage)}" alt="${escapeHtml(article.title)}" class="img-fluid rounded mb-3" onerror="this.src='${defaultImage}'">
                            <div class="mb-3 text-muted">
                                <i class="fas fa-calendar me-1"></i>${article.displayDate}
                                <span class="mx-2">|</span>
                                <i class="fas fa-user me-1"></i>${escapeHtml(article.source?.name || 'Unknown')}
                            </div>
                            <div class="p-3 border rounded bg-light mb-3">
                                <strong>Kalimat Utama:</strong><br>
                                ${escapeHtml(article.stickerText || article.description || '-')}
                            </div>
                            <div style="white-space: pre-wrap; line-height: 1.7;">
                                ${escapeHtml(article.fullContent || article.description || '-')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${article.url && article.url !== '#'
                                ? `<a href="${article.url}" target="_blank" class="btn btn-outline-primary"><i class="fas fa-external-link me-1"></i>Buka Sumber</a>`
                                : ''
                            }
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalEl = document.getElementById('fullNewsModal');
        const modal = new bootstrap.Modal(modalEl, {
            backdrop: false,
            focus: true,
            keyboard: true
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            modal.dispose();
            modalEl.remove();
            document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('padding-right');
            document.body.style.removeProperty('overflow');
        }, { once: true });

        modal.show();
    };

    window.shareArticle = function (title, url) {
        const decodedTitle = decodeURIComponent(title);
        const decodedUrl = decodeURIComponent(url);

        if (navigator.share) {
            navigator.share({ title: decodedTitle, url: decodedUrl });
            return;
        }

        if (navigator.clipboard) {
            navigator.clipboard.writeText(decodedUrl);
            alert('Link copied to clipboard!');
            return;
        }

        prompt('Copy this link:', decodedUrl);
    };

    window.resetFilters = resetFilters;
});
