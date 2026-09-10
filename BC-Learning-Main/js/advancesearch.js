(function () {
    'use strict';

    const form = document.getElementById('global-search-form');
    const input = document.getElementById('searchInput');
    const submit = document.getElementById('searchButton');
    const clear = document.getElementById('search-clear');
    const list = document.getElementById('searchResults');
    const loading = document.getElementById('search-loading');
    const empty = document.getElementById('search-empty');
    const filters = document.getElementById('search-filters');
    const documentFilter = document.getElementById('search-document-filter');
    const documentFilters = document.getElementById('search-document-filters');
    const summary = document.getElementById('search-summary');
    const title = document.getElementById('results-title');

    if (!form || !input || !list || !documentFilter || !documentFilters) return;

    let requestController = null;
    let allResults = [];
    let activeCategory = 'Semua';
    let activeDocumentType = 'Semua dokumen';

    const DOCUMENT_TYPE_GROUPS = [
        { label: 'PDF', extensions: ['pdf'] },
        { label: 'Word', extensions: ['doc', 'docx', 'rtf', 'txt'] },
        { label: 'Excel', extensions: ['xls', 'xlsx'] },
        { label: 'PowerPoint', extensions: ['ppt', 'pptx'] },
        { label: 'Video', extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv'] },
        { label: 'Gambar', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        { label: 'Model BIM', extensions: ['rvt', 'rfa', 'dwg', 'dxf', 'ifc', 'skp', 'pln', 'tm'] },
        { label: 'Arsip', extensions: ['zip'] }
    ];

    function readToken() {
        try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            return localStorage.getItem('token') || stored.token || '';
        } catch (error) {
            return localStorage.getItem('token') || '';
        }
    }

    function setLoading(isLoading) {
        loading.hidden = !isLoading;
        submit.disabled = isLoading;
        if (isLoading) {
            list.hidden = true;
            empty.hidden = true;
            filters.hidden = true;
            documentFilter.hidden = true;
        }
    }

    function setQueryInUrl(query) {
        const url = new URL(window.location.href);
        if (query) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        url.searchParams.delete('search');
        window.history.replaceState({}, '', url);
    }

    function resultMeta(result) {
        const parts = [];
        if (result.source) parts.push(result.source);
        if (result.location) parts.push(result.location);
        if (result.extension) parts.push(result.extension.toUpperCase());
        if (result.sizeFormatted) parts.push(result.sizeFormatted);
        if (result.publishedAt) {
            const date = new Date(result.publishedAt);
            if (!Number.isNaN(date.getTime())) {
                parts.push(new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric'
                }).format(date));
            }
        }
        return parts.join(' · ');
    }

    function resolveResultHref(result) {
        const rawPath = String((result && result.path) || '').trim();
        if (!rawPath) return '#';

        const isFileResult = result.type === 'file' || result.category === 'File';
        if (!isFileResult || !/^\/?files\//i.test(rawPath)) return rawPath;

        const encodedFilePath = rawPath.replace(/^\/?files\//i, '');
        let filePath = encodedFilePath;
        try {
            filePath = decodeURIComponent(encodedFilePath);
        } catch (error) {
            // Keep the original value when a legacy result has malformed encoding.
        }
        return `/api/file?path=${encodeURIComponent(filePath)}`;
    }

    function getDocumentType(result) {
        if (!result || (result.type !== 'file' && result.category !== 'File')) return '';
        const extension = String(result.extension || '').trim().toLowerCase().replace(/^\./, '');
        const group = DOCUMENT_TYPE_GROUPS.find((entry) => entry.extensions.includes(extension));
        return group ? group.label : (extension ? extension.toUpperCase() : 'Lainnya');
    }

    function createResult(result) {
        const link = document.createElement('a');
        link.className = 'global-search-result';
        link.href = resolveResultHref(result);

        try {
            const target = new URL(link.href, window.location.origin);
            if (target.origin !== window.location.origin) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
        } catch (error) {
            link.href = '#';
        }

        const type = document.createElement('span');
        type.className = 'global-search-result__type';
        type.textContent = result.category || 'Konten';

        const body = document.createElement('div');
        const heading = document.createElement('h3');
        heading.textContent = result.title || 'Tanpa judul';
        const snippet = document.createElement('p');
        snippet.textContent = result.snippet || result.description || 'Buka hasil untuk melihat detail.';
        body.append(heading, snippet);

        const metaText = resultMeta(result);
        if (metaText) {
            const meta = document.createElement('span');
            meta.className = 'global-search-result__meta';
            meta.textContent = metaText;
            body.append(meta);
        }

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-arrow-up-right-from-square';
        icon.setAttribute('aria-hidden', 'true');
        link.append(type, body, icon);
        return link;
    }

    function renderResults() {
        const visible = allResults.filter((result) => {
            const categoryMatches = activeCategory === 'Semua' || result.category === activeCategory;
            const documentMatches = activeDocumentType === 'Semua dokumen' ||
                getDocumentType(result) === activeDocumentType;
            return categoryMatches && documentMatches;
        });

        list.replaceChildren(...visible.map(createResult));
        list.hidden = visible.length === 0;
        empty.hidden = visible.length !== 0;
        const summaryParts = [activeCategory, activeDocumentType]
            .filter((value) => value !== 'Semua' && value !== 'Semua dokumen');
        summary.textContent = `${visible.length} hasil${summaryParts.length ? ` · ${summaryParts.join(' · ')}` : ''}`;
    }

    function renderDocumentFilters() {
        const counts = allResults.reduce((resultCounts, result) => {
            const type = getDocumentType(result);
            if (type) resultCounts[type] = (resultCounts[type] || 0) + 1;
            return resultCounts;
        }, {});
        const entries = Object.entries(counts);
        const categoryAllowsDocuments = activeCategory === 'Semua' || activeCategory === 'File';

        documentFilters.replaceChildren();
        if (!entries.length || !categoryAllowsDocuments) {
            documentFilter.hidden = true;
            return;
        }

        const total = entries.reduce((count, [, amount]) => count + amount, 0);
        [['Semua dokumen', total], ...entries].forEach(([type, count]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `global-search-filter${type === activeDocumentType ? ' is-active' : ''}`;
            button.textContent = `${type} ${count}`;
            button.setAttribute('aria-pressed', type === activeDocumentType ? 'true' : 'false');
            button.addEventListener('click', () => {
                activeDocumentType = type;
                renderDocumentFilters();
                renderResults();
            });
            documentFilters.append(button);
        });
        documentFilter.hidden = false;
    }

    function renderFilters(categories) {
        const entries = Object.entries(categories || {}).filter(([, count]) => Number(count) > 0);
        filters.replaceChildren();
        if (!entries.length) {
            filters.hidden = true;
            return;
        }

        const allCount = entries.reduce((total, [, count]) => total + Number(count), 0);
        [['Semua', allCount], ...entries].forEach(([category, count]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `global-search-filter${category === activeCategory ? ' is-active' : ''}`;
            button.textContent = `${category} ${count}`;
            button.setAttribute('aria-pressed', category === activeCategory ? 'true' : 'false');
            button.addEventListener('click', () => {
                activeCategory = category;
                if (category !== 'Semua' && category !== 'File') {
                    activeDocumentType = 'Semua dokumen';
                }
                filters.querySelectorAll('button').forEach((item) => {
                    const selected = item === button;
                    item.classList.toggle('is-active', selected);
                    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
                });
                renderDocumentFilters();
                renderResults();
            });
            filters.append(button);
        });
        filters.hidden = false;
    }

    function showError(message) {
        allResults = [];
        list.replaceChildren();
        list.hidden = true;
        filters.hidden = true;
        documentFilter.hidden = true;
        empty.hidden = false;
        const emptyTitle = empty.querySelector('h3');
        const emptyCopy = empty.querySelector('p');
        if (emptyTitle) emptyTitle.textContent = 'Pencarian belum dapat diselesaikan';
        if (emptyCopy) emptyCopy.textContent = message;
        summary.textContent = 'Terjadi kendala';
    }

    async function search(rawQuery) {
        const query = String(rawQuery || '').trim();
        clear.hidden = query.length === 0;
        if (query.length < 2) {
            input.setCustomValidity('Masukkan minimal dua karakter.');
            input.reportValidity();
            return;
        }
        input.setCustomValidity('');

        if (requestController) requestController.abort();
        requestController = new AbortController();
        activeCategory = 'Semua';
        activeDocumentType = 'Semua dokumen';
        setLoading(true);
        title.textContent = `Hasil untuk “${query}”`;
        summary.textContent = 'Mencari…';
        setQueryInUrl(query);

        try {
            const token = readToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&scope=global`, {
                headers,
                credentials: 'include',
                cache: 'no-store',
                signal: requestController.signal
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

            allResults = Array.isArray(payload.results) ? payload.results : [];
            renderFilters(payload.categories);
            renderDocumentFilters();
            renderResults();
        } catch (error) {
            if (error.name !== 'AbortError') {
                showError(error.message || 'Silakan coba beberapa saat lagi.');
            }
        } finally {
            setLoading(false);
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        search(input.value);
    });

    input.addEventListener('input', () => {
        clear.hidden = input.value.length === 0;
        input.setCustomValidity('');
    });

    clear.addEventListener('click', () => {
        input.value = '';
        clear.hidden = true;
        input.focus();
        setQueryInUrl('');
    });

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q') || params.get('search') || '';
    if (initialQuery) {
        input.value = initialQuery;
        search(initialQuery);
    }
})();
