(function () {
    const state = {
        payload: null,
        searchTerm: '',
        activeFilter: 'all'
    };

    document.addEventListener('DOMContentLoaded', initializeManualBooksPage);

    function initializeManualBooksPage() {
        const searchInput = document.getElementById('manual-search-input');
        const topicSelect = document.getElementById('manual-topic-select');

        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                state.searchTerm = event.target.value.trim().toLowerCase();
                renderManualBooks();
            });
        }

        if (topicSelect) {
            topicSelect.addEventListener('change', (event) => {
                state.activeFilter = event.target.value;
                renderManualBooks();
            });
        }

        fetchManualBooks();
    }

    async function fetchManualBooks() {
        const dataSources = [
            '/data/manual-books.json',
            '/api/manual-books'
        ];

        try {
            let lastError = null;

            for (const url of dataSources) {
                try {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    state.payload = await response.json();
                    renderTopicOptions();
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

    function renderTopicOptions() {
        const topicSelect = document.getElementById('manual-topic-select');
        if (!topicSelect || !state.payload) {
            return;
        }

        const filters = ['all', ...state.payload.quickFilters];
        topicSelect.innerHTML = filters.map((filter) => {
            const label = filter === 'all' ? 'Semua Topik' : filter;
            const selected = state.activeFilter === filter ? ' selected' : '';

            return `<option value="${escapeAttribute(filter)}"${selected}>${escapeHtml(label)}</option>`;
        }).join('');
    }

    function renderManualBooks() {
        const content = document.getElementById('manual-books-content');
        const resultsCopy = document.getElementById('manual-results-copy');

        if (!content || !resultsCopy) {
            return;
        }

        if (!state.payload) {
            content.innerHTML = '';
            resultsCopy.textContent = 'Memuat tema manual book...';
            return;
        }

        const groups = state.payload.groups.filter(matchesCurrentQuery);

        const filterLabel = state.activeFilter === 'all' ? 'semua topik' : state.activeFilter;
        resultsCopy.textContent = `${groups.length} tema cocok untuk ${filterLabel}.`;

        if (groups.length === 0) {
            content.innerHTML = `
                <div class="manual-empty">
                    <i class="fas fa-search text-primary"></i>
                    <h3 class="h5">Tema tidak ditemukan</h3>
                    <p class="mb-0">Coba kata kunci lain atau pilih topik berbeda dari dropdown.</p>
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
            group.keywords.includes(state.activeFilter);
        if (!matchesFilter) {
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
            ...group.files.map((file) => file.name)
        ].join(' ').toLowerCase();

        return haystacks.includes(state.searchTerm);
    }

    function renderTopicCard(group, index) {
        const fileLabel = `${group.fileCount} PDF`;
        const tags = (group.keywords || []).slice(0, 6);
        const groupNumber = index + 1;
        const previewFiles = group.files.slice(0, 2);
        const remainingFiles = group.files.slice(2);

        return `
            <article class="manual-topic-card">
                <div class="manual-topic-top">
                    <div class="d-flex gap-3">
                        <div class="manual-topic-index">${escapeHtml(groupNumber)}</div>
                        <div class="manual-topic-heading">
                            <h3 class="manual-topic-title">${escapeHtml(group.displayTitle)}</h3>
                            <p class="manual-topic-subtitle">${escapeHtml(fileLabel)} tersedia di tema ini</p>
                        </div>
                    </div>
                </div>

                <div class="manual-topic-tags">
                    ${tags.map((tag) => `<span class="manual-tag"><i class="fas fa-tag"></i>${escapeHtml(tag)}</span>`).join('')}
                </div>

                <div class="manual-file-list manual-file-list-preview">
                    ${previewFiles.map((file) => `
                        <a class="manual-file-link" href="${escapeAttribute(buildReaderUrl(file))}" target="_blank" rel="noopener noreferrer">
                            <span class="manual-file-meta">
                                <span class="manual-file-icon">
                                    <i class="fas fa-file-pdf"></i>
                                </span>
                                <span class="manual-file-text">
                                    <strong>${escapeHtml(file.name)}</strong>
                                    <span>${escapeHtml(file.sizeLabel)}</span>
                                </span>
                            </span>
                            <span class="manual-open-label">Buka</span>
                        </a>
                    `).join('')}
                </div>

                <div class="manual-topic-footer">
                    <span class="manual-file-count-pill">
                        <i class="fas fa-file-pdf"></i>
                        ${escapeHtml(fileLabel)} total
                    </span>

                    ${remainingFiles.length ? `
                        <details class="manual-file-more">
                            <summary class="manual-more-toggle">
                                <i class="fas fa-layer-group"></i>
                                Lihat ${escapeHtml(remainingFiles.length)} file lainnya
                            </summary>
                            <div class="manual-file-list">
                                ${remainingFiles.map((file) => `
                                    <a class="manual-file-link" href="${escapeAttribute(buildReaderUrl(file))}" target="_blank" rel="noopener noreferrer">
                                        <span class="manual-file-meta">
                                            <span class="manual-file-icon">
                                                <i class="fas fa-file-pdf"></i>
                                            </span>
                                            <span class="manual-file-text">
                                                <strong>${escapeHtml(file.name)}</strong>
                                                <span>${escapeHtml(file.sizeLabel)}</span>
                                            </span>
                                        </span>
                                        <span class="manual-open-label">Buka</span>
                                    </a>
                                `).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>
            </article>
        `;
    }

    function buildReaderUrl(file) {
        const mediaUrl = resolveManualBookMediaUrl(file);
        const pdfUrl = `${window.location.origin}/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;

        return `/public/reader.html?file=${encodeURIComponent(pdfUrl)}&return=/pages/manual-books.html`;
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
