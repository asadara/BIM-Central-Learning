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
    const summary = document.getElementById('search-summary');
    const title = document.getElementById('results-title');

    if (!form || !input || !list) return;

    let requestController = null;
    let allResults = [];
    let activeCategory = 'Semua';

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

    function createResult(result) {
        const link = document.createElement('a');
        link.className = 'global-search-result';
        link.href = result.path || '#';

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
        const visible = activeCategory === 'Semua'
            ? allResults
            : allResults.filter((result) => result.category === activeCategory);

        list.replaceChildren(...visible.map(createResult));
        list.hidden = visible.length === 0;
        empty.hidden = visible.length !== 0;
        summary.textContent = `${visible.length} hasil${activeCategory === 'Semua' ? '' : ` · ${activeCategory}`}`;
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
                filters.querySelectorAll('button').forEach((item) => {
                    const selected = item === button;
                    item.classList.toggle('is-active', selected);
                    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
                });
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
