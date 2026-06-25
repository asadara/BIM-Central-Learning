(function () {
    const SEARCH_RENDER_DELAY = 180;
    const TITLE_FIXES = new Map([
        ['HARDWARE TEST & ASSESMENT', 'HARDWARE TEST & ASSESSMENT'],
        ['MANAJEMEN & ORGANISASI MODEL - SHEET & TITTLE BLOCK', 'MANAJEMEN & ORGANISASI MODEL - SHEET & TITLE BLOCK'],
        ['QUIZIONER FORM', 'QUESTIONNAIRE FORM'],
        ['UNIT MEASEUREMENT STANDARD', 'UNIT MEASUREMENT STANDARD'],
        ['LESSON LEARN', 'Lesson Learned']
    ]);
    const TAG_STOP_WORDS = new Set([
        'manual', 'book', 'books', 'pdf', 'dan', 'the', 'with', 'for', 'bim', 'nke', 'guidance'
    ]);

    const state = {
        payload: null,
        searchLabel: '',
        searchTerm: '',
        activeType: 'all',
        activeSource: 'all',
        activeFilter: 'all'
    };

    document.addEventListener('DOMContentLoaded', initializeManualBooksPage);

    function getManualBooksAuthToken() {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            const storedUserData = JSON.parse(localStorage.getItem('userData') || '{}');
            return localStorage.getItem('token') || storedUser.token || storedUserData.token || '';
        } catch (error) {
            return localStorage.getItem('token') || '';
        }
    }

    function getManualBooksFetchOptions() {
        const token = getManualBooksAuthToken();
        const headers = {};

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return {
            headers,
            credentials: 'include',
            cache: 'no-store'
        };
    }

    function initializeManualBooksPage() {
        const searchInput = document.getElementById('manual-search-input');
        const topicSelect = document.getElementById('manual-topic-select');
        const typeSelect = document.getElementById('manual-type-select');
        const sourceSelect = document.getElementById('manual-source-select');
        const debouncedRender = debounce(() => {
            renderManualBooks();
            syncCurrentStateToUrl();
        }, SEARCH_RENDER_DELAY);

        applyInitialStateFromUrl();

        if (searchInput) {
            searchInput.value = state.searchLabel;
            searchInput.addEventListener('input', (event) => {
                setSearchTerm(event.target.value);
                debouncedRender();
            });
        }

        if (topicSelect) {
            topicSelect.addEventListener('change', (event) => {
                state.activeFilter = event.target.value;
                renderManualBooks();
                syncCurrentStateToUrl();
            });
        }

        if (typeSelect) {
            typeSelect.addEventListener('change', (event) => {
                state.activeType = event.target.value;
                renderManualBooks();
                syncCurrentStateToUrl();
            });
        }

        if (sourceSelect) {
            sourceSelect.addEventListener('change', (event) => {
                state.activeSource = event.target.value;
                renderManualBooks();
                syncCurrentStateToUrl();
            });
        }

        fetchManualBooks();
    }

    async function fetchManualBooks() {
        const dataSources = [
            '/api/manual-books'
        ];

        try {
            let lastError = null;

            for (const url of dataSources) {
                try {
                    const response = await fetch(url, getManualBooksFetchOptions());
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    state.payload = normalizeManualBooksPayload(await response.json());
                    normalizeActiveFilters();
                    renderFilterOptions();
                    renderLibraryStats();
                    renderManualBooks();
                    return;
                } catch (error) {
                    lastError = new Error(`${url}: ${error.message}`);
                }
            }

            throw lastError || new Error('No data source available');
        } catch (error) {
            console.error('Failed to load manual books:', error);
            renderErrorState(error.message);
        }
    }

    function renderFilterOptions() {
        const topicSelect = document.getElementById('manual-topic-select');
        const typeSelect = document.getElementById('manual-type-select');
        const sourceSelect = document.getElementById('manual-source-select');
        if (!topicSelect || !state.payload) {
            return;
        }

        topicSelect.innerHTML = ['all', ...state.payload.quickFilters].map((filter) => {
            const label = filter === 'all' ? 'Semua Topik' : filter;
            const selected = state.activeFilter === filter ? ' selected' : '';

            return `<option value="${escapeAttribute(filter)}"${selected}>${escapeHtml(label)}</option>`;
        }).join('');

        if (typeSelect) {
            typeSelect.innerHTML = ['all', ...state.payload.documentTypes].map((type) => {
                const label = type === 'all' ? 'Semua Tipe Dokumen' : type;
                const selected = state.activeType === type ? ' selected' : '';

                return `<option value="${escapeAttribute(type)}"${selected}>${escapeHtml(label)}</option>`;
            }).join('');
        }

        if (sourceSelect) {
            sourceSelect.innerHTML = ['all', ...state.payload.sourceLabels].map((source) => {
                const label = source === 'all' ? 'Semua Area Sumber' : source;
                const selected = state.activeSource === source ? ' selected' : '';

                return `<option value="${escapeAttribute(source)}"${selected}>${escapeHtml(label)}</option>`;
            }).join('');
        }
    }

    function renderManualBooks() {
        const content = document.getElementById('manual-books-content');
        const resultsCopy = document.getElementById('manual-results-copy');

        if (!content || !resultsCopy) {
            return;
        }

        if (!state.payload) {
            content.innerHTML = '';
            resultsCopy.textContent = 'Memuat indeks dokumen BCL...';
            return;
        }

        const groups = state.payload.groups.filter(matchesCurrentQuery);

        const filterLabel = state.activeFilter === 'all' ? 'semua topik' : state.activeFilter;
        const typeCopy = state.activeType === 'all' ? '' : ` tipe ${state.activeType}`;
        const sourceCopy = state.activeSource === 'all' ? '' : ` dari ${state.activeSource}`;
        const searchCopy = state.searchLabel ? ` dengan kata kunci "${state.searchLabel}"` : '';
        const fileCount = groups.reduce((total, group) => total + Number(group.fileCount || 0), 0);
        resultsCopy.textContent = `${groups.length} topik / ${fileCount} PDF cocok untuk ${filterLabel}${typeCopy}${sourceCopy}${searchCopy}.`;

        if (groups.length === 0) {
            content.innerHTML = `
                <div class="manual-empty">
                    <i class="fas fa-search text-primary" aria-hidden="true"></i>
                    <h3 class="h5">Dokumen tidak ditemukan</h3>
                    <p class="mb-0">Coba kata kunci lain, ubah tipe dokumen, atau pilih area sumber berbeda.</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="manual-grid">
                ${groups.map((group, index) => renderTopicCard(group, index)).join('')}
            </div>
        `;
    }

    function matchesCurrentQuery(group) {
        const matchesFilter =
            state.activeFilter === 'all' ||
            group.displayTitle === state.activeFilter ||
            (group.keywords || []).some((keyword) => keyword.toLowerCase() === state.activeFilter.toLowerCase());
        if (!matchesFilter) {
            return false;
        }

        if (state.activeType !== 'all' && group.documentType !== state.activeType) {
            return false;
        }

        if (state.activeSource !== 'all' && !(group.sourceLabels || [group.sourceLabel]).includes(state.activeSource)) {
            return false;
        }

        if (!state.searchTerm) {
            return true;
        }

        const haystacks = [
            group.displayTitle,
            group.folderName,
            group.description,
            ...(group.keywords || []),
            ...group.files.flatMap(getFileSearchFields)
        ].join(' ');

        return matchesSearchText(haystacks, state.searchTerm);
    }

    function renderTopicCard(group, index) {
        const fileLabel = `${group.fileCount} PDF`;
        const tags = getDisplayTags(group);
        const groupNumber = index + 1;
        const displayFiles = getDisplayFiles(group);
        const previewFiles = displayFiles.slice(0, 2);
        const remainingFiles = displayFiles.slice(2);
        const topicSummary = buildTopicSummary(group);

        return `
            <article class="manual-topic-card">
                <div class="manual-topic-top">
                    <div class="d-flex gap-3">
                        <div class="manual-topic-index">${escapeHtml(groupNumber)}</div>
                        <div class="manual-topic-heading">
                            <span class="manual-topic-type"><i class="fas fa-layer-group" aria-hidden="true"></i>${escapeHtml(group.documentType)}</span>
                            <h3 class="manual-topic-title">${escapeHtml(group.displayTitle)}</h3>
                            <p class="manual-topic-subtitle">${escapeHtml(fileLabel)} tersedia di tema ini</p>
                            ${topicSummary ? `<p class="manual-topic-summary">${escapeHtml(topicSummary)}</p>` : ''}
                        </div>
                    </div>
                </div>

                ${tags.length ? `
                    <div class="manual-topic-tags" aria-label="Keyword manual book">
                        ${tags.map((tag) => `<span class="manual-tag"><i class="fas fa-tag" aria-hidden="true"></i>${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}

                <div class="manual-file-list manual-file-list-preview">
                    ${previewFiles.map(renderFileLink).join('')}
                </div>

                <div class="manual-topic-footer">
                    <span class="manual-file-count-pill">
                        <i class="fas fa-file-pdf" aria-hidden="true"></i>
                        ${escapeHtml(fileLabel)} total
                    </span>

                    ${remainingFiles.length ? `
                        <details class="manual-file-more">
                            <summary class="manual-more-toggle">
                                <i class="fas fa-layer-group" aria-hidden="true"></i>
                                Lihat ${escapeHtml(remainingFiles.length)} file lainnya
                            </summary>
                            <div class="manual-file-list">
                                ${remainingFiles.map(renderFileLink).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>
            </article>
        `;
    }

    function renderFileLink(file) {
        const dateLabel = formatDate(file.modifiedAt);
        const matchNote = state.searchTerm && fileMatchesSearch(file, state.searchTerm)
            ? '<span class="manual-match-note">Cocok dengan pencarian</span>'
            : '';
        const metaParts = [file.sizeLabel, dateLabel].filter(Boolean).map(escapeHtml).join(' | ');

        return `
            <a class="manual-file-link" href="${escapeAttribute(buildReaderUrl(file))}">
                <span class="manual-file-meta">
                    <span class="manual-file-icon">
                        <i class="fas fa-file-pdf" aria-hidden="true"></i>
                    </span>
                    <span class="manual-file-text">
                        <strong>${escapeHtml(file.name)}</strong>
                        <span>${metaParts}${matchNote ? ` - ${matchNote}` : ''}</span>
                    </span>
                </span>
                <span class="manual-open-label">Buka</span>
            </a>
        `;
    }

    function normalizeManualBooksPayload(payload) {
        const rawGroups = Array.isArray(payload && payload.groups) ? payload.groups : [];
        const groupMap = new Map();

        rawGroups.forEach((rawGroup) => {
            const displayTitle = normalizeTitle(rawGroup.displayTitle || rawGroup.folderName || 'Manual Book');
            const files = Array.isArray(rawGroup.files) ? rawGroup.files : [];
            const cleanGroup = {
                ...rawGroup,
                displayTitle,
                folderName: rawGroup.folderName || displayTitle,
                documentType: inferDocumentType(rawGroup, displayTitle),
                sourceLabel: getSourceLabel(rawGroup),
                sourceLabels: [getSourceLabel(rawGroup)],
                files: sortManualBookFiles(files),
                keywords: buildDisplayKeywords(rawGroup, displayTitle),
                fileCount: files.length
            };
            const key = displayTitle.toLowerCase();
            const existing = groupMap.get(key);

            if (!existing) {
                groupMap.set(key, cleanGroup);
                return;
            }

            existing.folderName = [existing.folderName, cleanGroup.folderName]
                .filter(Boolean)
                .filter((value, index, list) => list.indexOf(value) === index)
                .join(' / ');
            existing.keywords = Array.from(new Set([...existing.keywords, ...cleanGroup.keywords])).slice(0, 8);
            existing.files = sortManualBookFiles([...existing.files, ...cleanGroup.files]);
            existing.fileCount = existing.files.length;
            existing.description = `${existing.fileCount} PDF tersedia di ${existing.displayTitle}.`;
            existing.documentType = mergeDocumentType(existing.documentType, cleanGroup.documentType);
            existing.sourceLabels = Array.from(new Set([...(existing.sourceLabels || [existing.sourceLabel]), ...cleanGroup.sourceLabels]));
            existing.sourceLabel = existing.sourceLabels.filter(Boolean).join(' / ');
        });

        const groups = Array.from(groupMap.values())
            .sort((left, right) => left.displayTitle.localeCompare(right.displayTitle, undefined, { sensitivity: 'base' }));

        return {
            ...(payload || {}),
            quickFilters: groups.map((group) => group.displayTitle),
            documentTypes: Array.from(new Set(groups.map((group) => group.documentType))).sort(),
            sourceLabels: Array.from(new Set(groups.flatMap((group) => group.sourceLabels || [group.sourceLabel]))).sort(),
            groups
        };
    }

    function renderLibraryStats() {
        if (!state.payload) {
            return;
        }

        const totalDocuments = state.payload.groups.reduce((total, group) => total + Number(group.fileCount || 0), 0);
        const statMap = {
            'manual-total-documents': totalDocuments,
            'manual-total-topics': state.payload.groups.length,
            'manual-total-sources': state.payload.sourceLabels.length,
            'manual-total-types': state.payload.documentTypes.length
        };

        Object.entries(statMap).forEach(([id, value]) => {
            const node = document.getElementById(id);
            if (node) {
                node.textContent = String(value);
            }
        });
    }

    function inferDocumentType(group, displayTitle) {
        const sourceRoot = String(group.sourceRoot || '').toLowerCase();
        const folderName = String(group.folderName || '').toLowerCase();
        const title = String(displayTitle || '').toLowerCase();
        const combined = `${sourceRoot} ${folderName} ${title}`;

        if (sourceRoot.includes('bahan pembelajaran') || folderName.includes('bim modeller') || title.includes('modeller') || title.includes('fundamental')) {
            return 'Materi Belajar';
        }

        if (/(template|form|questionnaire|quizioner|raci)/i.test(combined)) {
            return 'Template & Form';
        }

        if (/(iso|standard|standar|eir|oir|bep|loa|risk|qa qc|prosedur|permission|coordinate|koordinat)/i.test(combined)) {
            return 'Standar & Governance';
        }

        if (/(catalog|katalog|referensi|project|closeout|asset|delft|drone)/i.test(combined)) {
            return 'Referensi Proyek';
        }

        return 'Manual Book';
    }

    function mergeDocumentType(currentType, nextType) {
        if (!currentType) return nextType;
        if (!nextType || currentType === nextType) return currentType;
        if (currentType === 'Materi Belajar' || nextType === 'Materi Belajar') return 'Materi Belajar';
        return currentType;
    }

    function getSourceLabel(group) {
        const sourceRoot = String(group.sourceRoot || '').trim();
        const folderName = String(group.folderName || '').trim();

        if (/bahan pembelajaran/i.test(sourceRoot) || (/^manual book$/i.test(sourceRoot) && /bim modeller/i.test(folderName))) {
            return 'Materi Pembelajaran';
        }
        if (/6\. manual books/i.test(sourceRoot)) return 'Manual Books';
        if (/bim guidance/i.test(sourceRoot)) return 'BIM Guidance';

        return sourceRoot || 'Dokumen BCL';
    }

    function normalizeTitle(title) {
        const cleanedTitle = String(title || '')
            .replace(/\s+/g, ' ')
            .trim();

        return TITLE_FIXES.get(cleanedTitle.toUpperCase()) || cleanedTitle || 'Manual Book';
    }

    function buildDisplayKeywords(group, displayTitle) {
        const tokenSet = new Set();
        const addToken = (token) => {
            const cleaned = normalizeKeyword(token);
            if (!cleaned) return;
            tokenSet.add(cleaned);
        };

        displayTitle.split(/[\s&/-]+/).forEach(addToken);

        if (tokenSet.size === 0) {
            (group.keywords || []).forEach(addToken);
        }

        return Array.from(tokenSet).slice(0, 8);
    }

    function normalizeKeyword(token) {
        const cleaned = String(token || '')
            .replace(/\.[a-z0-9]+$/i, '')
            .replace(/[()&/_.,-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const comparable = cleaned.toLowerCase();

        const isDimensionToken = /^[3-7]d$/i.test(cleaned);
        if (!cleaned || comparable.length < 2 || comparable.length > 24 || TAG_STOP_WORDS.has(comparable)) {
            return '';
        }

        if (!isDimensionToken && (/\d/.test(cleaned) || /\s/.test(cleaned))) {
            return '';
        }

        return cleaned;
    }

    function sortManualBookFiles(files) {
        return [...files].sort((left, right) => {
            const priorityDiff = getFilePriority(left) - getFilePriority(right);
            if (priorityDiff !== 0) return priorityDiff;

            return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' });
        });
    }

    function getFilePriority(file) {
        const name = String(file && file.name ? file.name : '').toLowerCase();
        if (/^manual\s*-/.test(name) || name.includes('manual book')) return 0;
        if (name.includes('cover')) return 2;
        return 1;
    }

    function getDisplayFiles(group) {
        const files = Array.isArray(group.files) ? group.files : [];
        if (!state.searchTerm) {
            return files;
        }

        return [...files].sort((left, right) => {
            const leftMatch = fileMatchesSearch(left, state.searchTerm) ? 0 : 1;
            const rightMatch = fileMatchesSearch(right, state.searchTerm) ? 0 : 1;
            if (leftMatch !== rightMatch) return leftMatch - rightMatch;
            return getFilePriority(left) - getFilePriority(right);
        });
    }

    function getDisplayTags(group) {
        return (group.keywords || []).slice(0, 6);
    }

    function buildTopicSummary(group) {
        const latestUpdate = getLatestUpdate(group.files || []);
        if (!latestUpdate) {
            return '';
        }
        return `Update terakhir ${latestUpdate}.`;
    }

    function getLatestUpdate(files) {
        const latestTimestamp = files
            .map((file) => Date.parse(file.modifiedAt))
            .filter((timestamp) => Number.isFinite(timestamp))
            .sort((left, right) => right - left)[0];

        return latestTimestamp ? formatDate(new Date(latestTimestamp).toISOString()) : '';
    }

    function fileMatchesSearch(file, searchTerm) {
        return matchesSearchText(getFileSearchFields(file).join(' '), searchTerm);
    }

    function getFileSearchFields(file) {
        const fileName = String(file && file.name ? file.name : '');

        return [
            fileName,
            file.relativePath,
            file.sourceRelativePath,
            getReadableFileName(fileName)
        ];
    }

    function getReadableFileName(fileName) {
        return String(fileName || '')
            .replace(/\.[a-z0-9]+$/i, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function setSearchTerm(value) {
        state.searchLabel = String(value || '').trim();
        state.searchTerm = normalizeSearchText(state.searchLabel);
    }

    function normalizeSearchText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function compactSearchText(value) {
        return normalizeSearchText(value).replace(/\s+/g, '');
    }

    function matchesSearchText(haystack, normalizedNeedle) {
        if (!normalizedNeedle) {
            return true;
        }

        const normalizedHaystack = normalizeSearchText(haystack);
        if (normalizedHaystack.includes(normalizedNeedle)) {
            return true;
        }

        const compactNeedle = normalizedNeedle.replace(/\s+/g, '');
        return compactNeedle.length >= 3 && compactSearchText(haystack).includes(compactNeedle);
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    function debounce(callback, delay) {
        let timeoutId;

        return (...args) => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => callback(...args), delay);
        };
    }

    function applyInitialStateFromUrl() {
        const params = new URLSearchParams(window.location.search);
        setSearchTerm(params.get('q') || '');
        state.activeFilter = String(params.get('topic') || 'all').trim() || 'all';
        state.activeType = String(params.get('type') || 'all').trim() || 'all';
        state.activeSource = String(params.get('source') || 'all').trim() || 'all';
    }

    function normalizeActiveFilters() {
        if (!state.payload) return;

        if (state.activeFilter !== 'all') {
            const matchingFilter = state.payload.quickFilters.find((filter) => filter.toLowerCase() === state.activeFilter.toLowerCase());
            state.activeFilter = matchingFilter || 'all';
        }

        if (state.activeType !== 'all') {
            const matchingType = state.payload.documentTypes.find((type) => type.toLowerCase() === state.activeType.toLowerCase());
            state.activeType = matchingType || 'all';
        }

        if (state.activeSource !== 'all') {
            const matchingSource = state.payload.sourceLabels.find((source) => source.toLowerCase() === state.activeSource.toLowerCase());
            state.activeSource = matchingSource || 'all';
        }
    }

    function syncCurrentStateToUrl() {
        const params = new URLSearchParams(window.location.search);

        if (state.searchLabel) {
            params.set('q', state.searchLabel);
        } else {
            params.delete('q');
        }

        if (state.activeFilter && state.activeFilter !== 'all') {
            params.set('topic', state.activeFilter);
        } else {
            params.delete('topic');
        }

        if (state.activeType && state.activeType !== 'all') {
            params.set('type', state.activeType);
        } else {
            params.delete('type');
        }

        if (state.activeSource && state.activeSource !== 'all') {
            params.set('source', state.activeSource);
        } else {
            params.delete('source');
        }

        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
        window.history.replaceState(null, '', nextUrl);
    }

    function buildReaderUrl(file) {
        const pdfUrl = buildManualBookFileUrl(file);

        return `/public/reader.html?file=${encodeURIComponent(pdfUrl)}&return=/pages/manual-books.html`;
    }

    function buildManualBookFileUrl(file) {
        const relativePath = safeDecodePath(String(file && file.relativePath ? file.relativePath : ''))
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');

        if (relativePath) {
            return `${window.location.origin}/api/file?path=${encodeURIComponent(relativePath)}`;
        }

        const mediaUrl = resolveManualBookMediaUrl(file);
        return `${window.location.origin}/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
    }

    function resolveManualBookMediaUrl(file) {
        if (file && typeof file.mediaUrl === 'string' && file.mediaUrl.trim()) {
            return file.mediaUrl.trim();
        }

        let relativePath = safeDecodePath(String(file && file.relativePath ? file.relativePath : ''))
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');

        if (!relativePath) {
            return '/media/BIM%20CENTRAL%20LEARNING';
        }

        if (!/^BIM CENTRAL LEARNING\//i.test(relativePath)) {
            if (!/^6\. Manual Books\//i.test(relativePath)) {
                relativePath = `6. Manual Books/${relativePath}`;
            }
            relativePath = `BIM CENTRAL LEARNING/${relativePath}`;
        }

        const encodedSegments = relativePath
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');

        return `/media/${encodedSegments}`;
    }

    function safeDecodePath(value, rounds = 3) {
        let output = String(value || '');
        for (let index = 0; index < rounds; index += 1) {
            try {
                const decoded = decodeURIComponent(output);
                if (decoded === output) {
                    break;
                }
                output = decoded;
            } catch (error) {
                break;
            }
        }
        return output;
    }

    function renderErrorState(detail) {
        const content = document.getElementById('manual-books-content');
        const resultsCopy = document.getElementById('manual-results-copy');

        if (resultsCopy) {
            resultsCopy.textContent = 'Data manual book gagal dimuat.';
        }

        if (content) {
            content.innerHTML = `
                <div class="manual-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3 class="h5">Manual book belum bisa ditampilkan</h3>
                    <p class="mb-2">Periksa koneksi backend atau akses ke direktori sumber manual book.</p>
                    <small>${escapeHtml(detail || 'Unknown error')}</small>
                </div>
            `;
        }
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
        return escapeHtml(value);
    }
})();
