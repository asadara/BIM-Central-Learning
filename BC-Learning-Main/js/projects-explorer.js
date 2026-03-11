class ProjectsExplorer {
    constructor() {
        this.years = [];
        this.yearsBySource = {};
        this.sources = [];
        this.projects = [];
        this.hiddenProjects = [];
        this.mediaData = [];
        this.filteredData = [];
        this.selectedYear = null;
        this.selectedYearKey = null;
        this.selectedProject = null;
        this.selectedProjectKey = null;
        this.selectedSourceId = null;
        this.searchQuery = '';
        this.filterType = 'all';
        this.filterSize = 'all';
        this.sortBy = 'name-asc';
        this.itemsPerPage = 24;
        this.currentPage = 1;
        this.currentPreviewIndex = -1;
        this.boundPreviewViewportHandler = () => this.updatePreviewViewportConstraints();
        this.apiBaseCandidates = this.getApiBaseCandidates();
        this.apiBase = this.apiBaseCandidates[0] || '';
        this.previewLoadTimeoutMs = 12000;
        this.previewRenderToken = 0;

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }

        this.loadYears();
    }

    getApiBaseCandidates() {
        const bases = [];
        const protocol = window.location.protocol;
        const isHttp = protocol === 'http:' || protocol === 'https:';

        if (isHttp) {
            bases.push(window.location.origin);
        }

        if (window.location.hostname) {
            const hostname = window.location.hostname;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

            if (isLocalhost) {
                bases.push(`${protocol}//${hostname}:5052`);
                bases.push(`${protocol}//localhost:5052`);
            } else {
                bases.push(`${protocol}//${hostname}:5052`);
            }
        }

        return [...new Set(bases)];
    }

    async fetchJsonWithFallback(path) {
        const candidates = this.getApiBaseCandidates();
        let lastError = null;

        for (const base of candidates) {
            const url = `${base}${path}`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                this.apiBase = base;
                return data;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Network request failed');
    }

    isTokenExpired(token) {
        if (!token) return true;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            return payload.exp < currentTime;
        } catch (error) {
            return true;
        }
    }

    isUserLoggedIn() {
        const currentUser = window.currentUser;
        if (currentUser && (currentUser.token || currentUser.isAdmin)) {
            return true;
        }

        const token = localStorage.getItem('token');
        if (!token) return false;

        if (this.isTokenExpired(token)) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('username');
            localStorage.removeItem('email');
            localStorage.removeItem('role');
            localStorage.removeItem('userimg');
            return false;
        }

        return true;
    }

    handleDownloadWithoutLogin() {
        const message = 'Untuk download media, silakan login terlebih dahulu.';
        const goLogin = window.confirm(`${message}\n\nKlik "OK" untuk menuju halaman login.`);
        if (goLogin) {
            const fullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            localStorage.setItem('lastPage', fullPath);
            window.location.href = '/pages/login.html';
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }

        const filterType = document.getElementById('filter-type');
        if (filterType) {
            filterType.addEventListener('change', (e) => {
                this.filterType = e.target.value;
                this.applyFilters();
            });
        }

        const filterSize = document.getElementById('filter-size');
        if (filterSize) {
            filterSize.addEventListener('change', (e) => {
                this.filterSize = e.target.value;
                this.applyFilters();
            });
        }

        const sortBy = document.getElementById('sort-by');
        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
            });
        }

        const prevBtn = document.getElementById('preview-prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigatePreview(-1));
        }

        const nextBtn = document.getElementById('preview-next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigatePreview(1));
        }

        const modal = document.getElementById('mediaModal');
        if (modal) {
            modal.addEventListener('shown.bs.modal', () => {
                this.boundPreviewViewportHandler();
                requestAnimationFrame(this.boundPreviewViewportHandler);
            });
            modal.addEventListener('hidden.bs.modal', () => {
                this.currentPreviewIndex = -1;
                this.previewRenderToken += 1;
                const counter = document.getElementById('mediaModalCounter');
                if (counter) {
                    counter.textContent = '';
                }
            });
        }
        window.addEventListener('resize', this.boundPreviewViewportHandler);

        document.addEventListener('keydown', (e) => this.handlePreviewKeyboard(e));

        document.addEventListener('click', (e) => {
            const downloadButton = e.target.closest('.btn-download, #download-btn');
            if (downloadButton) {
                if (!this.isUserLoggedIn()) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleDownloadWithoutLogin();
                    return;
                }
            }

            const yearItem = e.target.closest('[data-year]');
            if (yearItem && yearItem.dataset.year) {
                e.preventDefault();
                this.selectYear(yearItem.dataset.year, yearItem.dataset.sourceId || null);
                return;
            }

            const projectItem = e.target.closest('[data-project]');
            if (projectItem && projectItem.dataset.project) {
                e.preventDefault();
                this.selectProject(projectItem.dataset.project, projectItem.dataset.sourceId || null);
                return;
            }

            const viewButton = e.target.closest('.btn-view');
            if (viewButton && viewButton.dataset.mediaIndex) {
                e.preventDefault();
                const index = parseInt(viewButton.dataset.mediaIndex, 10);
                if (!Number.isNaN(index)) {
                    this.openPreview(index);
                }
            }
        });
    }

    async loadYears() {
        const yearList = document.getElementById('year-list');
        if (yearList) {
            yearList.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <small class="text-muted d-block mt-2">Memuat tahun...</small>
                </div>
            `;
        }

        try {
            const data = await this.fetchJsonWithFallback('/api/years');
            this.years = Array.isArray(data.years) ? data.years : [];
            this.yearsBySource = data.yearsBySource && typeof data.yearsBySource === 'object' ? data.yearsBySource : {};
            this.sources = Array.isArray(data.sources) ? data.sources : [];
            this.renderYearList();

            if (this.sources.length > 0) {
                const sortedSources = [...this.sources].sort((a, b) => (a.priority || 0) - (b.priority || 0));
                const firstSource = sortedSources.find(source => this.getUniqueSortedYearsForSource(source.id).length > 0) || sortedSources[0];
                const firstYear = this.getUniqueSortedYearsForSource(firstSource.id)[0];
                if (firstYear) {
                    this.selectYear(firstYear, firstSource.id);
                }
            } else if (this.years.length > 0) {
                this.selectYear(this.years[0]);
            }
        } catch (error) {
            if (yearList) {
                yearList.innerHTML = `
                    <div class="text-muted small">Gagal memuat tahun: ${error.message}</div>
                `;
            }
        }
    }

    getUniqueSortedYearsForSource(sourceId) {
        const years = this.yearsBySource[sourceId] || [];
        return [...new Set(
            years
                .map((year) => String(year || '').trim())
                .filter((year) => /^(19|20)\d{2}$/.test(year))
        )].sort((a, b) => b.localeCompare(a));
    }

    renderYearList() {
        const yearList = document.getElementById('year-list');
        if (!yearList) return;

        const hasSources = this.sources && this.sources.length > 0 && Object.keys(this.yearsBySource).length > 0;

        if (!hasSources) {
            if (this.years.length === 0) {
                yearList.innerHTML = '<div class="text-muted small">Tidak ada data tahun.</div>';
                return;
            }

            yearList.innerHTML = this.years.map((year) => `
                <a href="#" class="category-item" data-year="${year}">
                    <span class="category-name">${year}</span>
                    <span class="category-count">Tahun</span>
                </a>
            `).join('');

            this.highlightActive('[data-year]', this.selectedYear);
            return;
        }

        const sortedSources = [...this.sources].sort((a, b) => (a.priority || 0) - (b.priority || 0));
        const groupedSources = new Map();

        sortedSources.forEach((source) => {
            const groupId = source.groupId || source.id;
            if (!groupedSources.has(groupId)) {
                groupedSources.set(groupId, {
                    groupId,
                    groupName: source.groupName || source.name || source.id,
                    priority: source.priority || 0,
                    sources: []
                });
            }
            const group = groupedSources.get(groupId);
            group.sources.push(source);
            if ((source.priority || 0) < group.priority) {
                group.priority = source.priority || 0;
            }
        });

        const groupedList = Array.from(groupedSources.values())
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));

        yearList.innerHTML = groupedList.map((group) => {
            const sourceClass = group.groupId.includes('bim02') ? 'source-bim02' : group.groupId.includes('bim1') ? 'source-bim1' : '';

            const yearItems = group.sources.map((source) => {
                const years = this.getUniqueSortedYearsForSource(source.id);
                if (years.length === 0) {
                    return '';
                }
                return years.map((year) => {
                    const yearKey = `${year}::${source.id}`;
                    return `
                        <a href="#" class="category-item" data-year="${year}" data-source-id="${source.id}" data-year-key="${yearKey}">
                            <span class="category-name">${year}</span>
                            <span class="category-count">Tahun</span>
                        </a>
                    `;
                }).join('');
            }).join('');

            const content = yearItems.trim().length > 0
                ? yearItems
                : `<div class="text-muted small">Tidak ada data tahun.</div>`;

            return `
                <div class="year-source-section">
                    <div class="year-source-title">
                        <span class="source-tag ${sourceClass}">${group.groupName}</span>
                    </div>
                    ${content}
                </div>
            `;
        }).join('');

        this.highlightActive('[data-year-key]', this.selectedYearKey, 'data-year-key');
    }

    async selectYear(year, sourceId) {
        const yearKey = `${year}::${sourceId || 'unknown'}`;
        if (!year || yearKey === this.selectedYearKey) return;

        this.selectedYear = year;
        this.selectedYearKey = yearKey;
        this.selectedProject = null;
        this.selectedProjectKey = null;
        this.selectedSourceId = sourceId || null;
        this.hiddenProjects = [];
        this.mediaData = [];
        this.filteredData = [];

        const hasSources = this.sources && this.sources.length > 0 && Object.keys(this.yearsBySource).length > 0;
        if (hasSources) {
            this.highlightActive('[data-year-key]', yearKey, 'data-year-key');
        } else {
            this.highlightActive('[data-year]', year);
        }
        this.renderProjectListLoading();
        this.renderEmptyState('Pilih proyek di sidebar untuk melihat media.');

        await this.loadProjects(year, sourceId || null);
    }

    renderProjectListLoading() {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        projectList.innerHTML = `
            <div class="text-center">
                <div class="spinner-border spinner-border-sm" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <small class="text-muted d-block mt-2">Memuat proyek...</small>
            </div>
        `;
    }

    async loadProjects(year, sourceId) {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        try {
            const query = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
            const data = await this.fetchJsonWithFallback(`/api/projects/${year}${query}`);
            this.projects = Array.isArray(data.projects) ? data.projects : [];
            this.hiddenProjects = Array.isArray(data.hiddenProjects) ? data.hiddenProjects : [];
            this.renderProjectList();

            if (this.projects.length > 0) {
                const firstProject = this.projects.find((project) => (project.mediaCount || 0) > 0) || this.projects[0];
                this.selectProject(firstProject.name, firstProject.sourceId || null);
            } else {
                this.renderEmptyState('Tidak ada proyek untuk tahun ini.');
            }
        } catch (error) {
            this.hiddenProjects = [];
            projectList.innerHTML = `
                <div class="text-muted small">Gagal memuat proyek: ${error.message}</div>
            `;
        }
    }

    renderProjectList() {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        const hiddenNotice = this.renderHiddenProjectsNotice();

        if (this.projects.length === 0) {
            projectList.innerHTML = `
                ${hiddenNotice}
                <div class="text-muted small">Tidak ada proyek.</div>
            `;
            return;
        }

        const projectItems = this.projects.map((project) => {
            const sourceId = project.sourceId || '';
            const projectKey = `${project.name}::${sourceId || 'unknown'}`;
            const sourceLabel = project.source || sourceId || 'Unknown';
            const sourceClass = sourceId.includes('bim02') ? 'source-bim02' : sourceId.includes('bim1') ? 'source-bim1' : '';
            const mediaCount = typeof project.mediaCount === 'number' ? project.mediaCount : 0;
            return `
                <a href="#" class="category-item" data-project="${project.name}" data-source-id="${sourceId}" data-project-key="${projectKey}">
                    <div>
                        <div class="category-name">${project.name}</div>
                        <div class="category-meta">
                            <span class="source-tag ${sourceClass}">${sourceLabel}</span>
                            <span>${mediaCount} media</span>
                        </div>
                    </div>
                    <span class="category-count"><i class="fas fa-folder"></i></span>
                </a>
            `;
        }).join('');

        projectList.innerHTML = `${hiddenNotice}${projectItems}`;

        this.highlightActive('[data-project-key]', this.selectedProjectKey, 'data-project-key');
    }

    renderHiddenProjectsNotice() {
        if (!Array.isArray(this.hiddenProjects) || this.hiddenProjects.length === 0) {
            return '';
        }

        const names = this.hiddenProjects
            .map((item) => item && item.name ? item.name : '')
            .filter(Boolean);
        const uniqueNames = [...new Set(names)];
        const preview = uniqueNames.slice(0, 3).join(', ');
        const suffix = uniqueNames.length > 3 ? `, +${uniqueNames.length - 3} lainnya` : '';
        const namesText = preview ? `<br><span class="text-muted">Contoh: ${preview}${suffix}</span>` : '';

        return `
            <div class="alert alert-warning py-2 px-3 small mb-2">
                <strong>${this.hiddenProjects.length}</strong> folder proyek disembunyikan karena belum ada media visual (gambar/video).${namesText}
            </div>
        `;
    }

    async selectProject(projectName, sourceId) {
        if (!projectName) return;

        this.selectedProject = projectName;
        this.selectedSourceId = sourceId || null;
        this.selectedProjectKey = `${projectName}::${sourceId || 'unknown'}`;
        this.highlightActive('[data-project-key]', this.selectedProjectKey, 'data-project-key');

        await this.loadMedia(projectName, sourceId);
    }

    async loadMedia(projectName, sourceId) {
        this.renderLoadingState('Memuat media proyek...');

        try {
            const query = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
            const data = await this.fetchJsonWithFallback(`/api/project-media/${encodeURIComponent(this.selectedYear)}/${encodeURIComponent(projectName)}${query}`);
            const mediaList = Array.isArray(data.media) ? data.media : [];
            const detailsList = Array.isArray(data.mediaDetails) ? data.mediaDetails : [];
            const detailMap = new Map(
                detailsList
                    .filter(detail => detail && detail.url)
                    .map(detail => [detail.url, detail])
            );

            this.mediaData = mediaList
                .map((url) => this.buildMediaItem(url, detailMap.get(url)))
                .filter(item => item.type === 'image' || item.type === 'video');

            this.currentPage = 1;
            this.applyFilters();
        } catch (error) {
            this.renderEmptyState(`Gagal memuat media: ${error.message}`);
        }
    }

    buildMediaItem(url, details = null) {
        const cleanUrl = url || '';
        const displayUrl = details && typeof details.displayUrl === 'string'
            ? details.displayUrl
            : cleanUrl;
        const filenameRaw = cleanUrl.split('/').pop() || 'media';
        let filename = filenameRaw;
        try {
            filename = decodeURIComponent(filenameRaw);
        } catch (err) {
            filename = filenameRaw;
        }
        const ext = filename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
        const videoExts = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'wmv'];
        let type = 'other';
        if (imageExts.includes(ext)) type = 'image';
        if (videoExts.includes(ext)) type = 'video';

        const sizeBytes = details && typeof details.sizeBytes === 'number' ? details.sizeBytes : null;
        const durationSeconds = details && typeof details.durationSeconds === 'number' ? details.durationSeconds : null;

        return {
            url: displayUrl,
            sourceUrl: cleanUrl,
            filename,
            type,
            sizeBytes,
            durationSeconds
        };
    }

    getVideoMimeType(url) {
        const cleanUrl = (url || '').split('?')[0].split('#')[0];
        const ext = cleanUrl.split('.').pop().toLowerCase();
        const mimeTypes = {
            mp4: 'video/mp4',
            mov: 'video/quicktime',
            webm: 'video/webm',
            avi: 'video/x-msvideo',
            mkv: 'video/x-matroska',
            wmv: 'video/x-ms-wmv'
        };
        return mimeTypes[ext] || 'video/mp4';
    }

    getWatermarkUrl(item) {
        let base = this.apiBase || window.location.origin || '';
        if (base === 'null') {
            base = '';
        }
        base = base.replace(/\/$/, '');
        const mediaUrl = item && (item.sourceUrl || item.url) ? (item.sourceUrl || item.url) : '';
        return `${base}/api/watermark?url=${encodeURIComponent(mediaUrl)}`;
    }

    getWatermarkFilename(item) {
        const name = item && item.filename ? item.filename : 'media';
        const lastDot = name.lastIndexOf('.');
        const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;

        if (item && item.type === 'video') {
            return `${baseName}-wm.mp4`;
        }

        const ext = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : '';
        const outputExt = ext === 'png' ? 'png' : 'jpg';
        return `${baseName}-wm.${outputExt}`;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getThumbMeta(type) {
        if (type === 'video') {
            return {
                theme: 'video',
                icon: 'fas fa-video',
                iconImage: '/img/icons/video-icon2.png',
                badge: 'VID',
                caption: 'Video'
            };
        }

        return {
            theme: 'image',
            icon: 'fas fa-image',
            iconImage: '/img/icons/image-icon.png',
            badge: 'IMG',
            caption: 'Image'
        };
    }

    buildFileThumb(type, options = {}) {
        const { hidden = false } = options;
        const meta = this.getThumbMeta(type);
        const hiddenClass = hidden ? ' is-hidden' : '';
        const visual = meta.iconImage
            ? `
                <img src="${meta.iconImage}" alt="${meta.badge}" class="file-thumb-image"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                <i class="${meta.icon} file-thumb-icon file-thumb-icon-fallback" aria-hidden="true" style="display:none;"></i>
            `
            : `<i class="${meta.icon} file-thumb-icon" aria-hidden="true"></i>`;

        return `
            <div class="file-thumb file-thumb--${meta.theme}${hiddenClass}">
                <span class="file-thumb-badge">${meta.badge}</span>
                <div class="file-thumb-visual">
                    ${visual}
                </div>
                <span class="file-thumb-caption">${meta.caption}</span>
            </div>
        `;
    }

    buildMediaThumbnail(item) {
        if (item.type === 'image') {
            const safeName = this.escapeHtml(item.filename);
            return `
                <img src="${item.url}" alt="${safeName}" loading="lazy" decoding="async"
                    onerror="this.style.display='none'; this.nextElementSibling.classList.remove('is-hidden');">
                ${this.buildFileThumb('image', { hidden: true })}
            `;
        }

        return this.buildFileThumb('video');
    }

    renderPreviewUnavailable(viewer, reason) {
        if (!viewer) return;
        const safeReason = this.escapeHtml(reason || 'Sumber media tidak tersedia.');
        viewer.innerHTML = `
            <div class="text-center file-preview-placeholder">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                <p>Media tidak dapat dimuat dari sumber jaringan.</p>
                <small class="text-muted d-block mt-1">${safeReason}</small>
            </div>
        `;
    }

    formatFileSize(bytes) {
        if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '-';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
        return `${size.toFixed(decimals)} ${units[unitIndex]}`;
    }

    formatDuration(seconds) {
        if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '';
        const total = Math.max(0, Math.round(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        const pad = (value) => String(value).padStart(2, '0');
        if (hours > 0) {
            return `${hours}:${pad(minutes)}:${pad(secs)}`;
        }
        return `${minutes}:${pad(secs)}`;
    }

    matchesSizeFilter(bytes) {
        if (this.filterSize === 'all') return true;
        if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return false;
        const sizeMb = bytes / (1024 * 1024);

        if (this.filterSize === 'lt-10') return sizeMb < 10;
        if (this.filterSize === '10-50') return sizeMb >= 10 && sizeMb <= 50;
        if (this.filterSize === '50-200') return sizeMb > 50 && sizeMb <= 200;
        if (this.filterSize === 'gt-200') return sizeMb > 200;

        return true;
    }

    applyFilters() {
        const query = this.searchQuery.trim();

        this.filteredData = this.mediaData.filter(item => {
            if (this.filterType !== 'all' && item.type !== this.filterType) {
                return false;
            }
            if (!this.matchesSizeFilter(item.sizeBytes)) {
                return false;
            }
            if (query && !item.filename.toLowerCase().includes(query)) {
                return false;
            }
            return true;
        });

        this.currentPage = 1;
        this.sortData();
        this.renderMediaGrid();
        this.renderPagination();
    }

    sortData() {
        if (this.sortBy === 'name-desc') {
            this.filteredData.sort((a, b) => b.filename.localeCompare(a.filename));
        } else {
            this.filteredData.sort((a, b) => a.filename.localeCompare(b.filename));
        }
    }

    renderMediaGrid() {
        const grid = document.getElementById('media-grid');
        if (!grid) return;

        if (this.filteredData.length === 0) {
            this.renderEmptyState('Tidak ada media yang sesuai filter.');
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredData.slice(startIndex, endIndex);

        grid.innerHTML = pageItems.map((item, index) => {
            const globalIndex = startIndex + index;
            const mediaThumb = this.buildMediaThumbnail(item);

            const typeLabel = item.type === 'video' ? 'VIDEO' : 'IMAGE';
            const downloadUrl = this.getWatermarkUrl(item);
            const downloadName = this.getWatermarkFilename(item);
            const sizeLabel = this.formatFileSize(item.sizeBytes);
            const durationLabel = item.type === 'video' ? this.formatDuration(item.durationSeconds) : '';
            const metaPrimary = [this.selectedYear || '', this.selectedProject || ''].filter(Boolean).join(' • ');
            const durationMeta = item.type === 'video'
                ? ` • Durasi: ${durationLabel || '-'}`
                : '';

            return `
                <div class="col-lg-4 col-md-6">
                    <div class="media-card">
                        <div class="media-thumbnail">
                            ${mediaThumb}
                            <span class="media-type-icon">${typeLabel}</span>
                        </div>
                        <div class="media-info">
                            <div class="media-title">${item.filename}</div>
                            <div class="media-meta">
                                <div class="media-meta-row">${metaPrimary || '-'}</div>
                                <div class="media-meta-row">Ukuran: ${sizeLabel}${durationMeta}</div>
                            </div>
                            <div class="media-actions">
                                <button class="btn-media-action btn-view" data-media-index="${globalIndex}">
                                    <i class="fas fa-eye"></i> Preview
                                </button>
                                <a class="btn-media-action btn-download" href="${downloadUrl}" download="${downloadName}">
                                    <i class="fas fa-download"></i> Download
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPagination() {
        const paginationContainer = document.getElementById('pagination-container');
        const paginationList = document.getElementById('pagination');
        if (!paginationContainer || !paginationList) return;

        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);

        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            paginationList.innerHTML = '';
            return;
        }

        paginationContainer.style.display = 'flex';
        paginationList.innerHTML = '';

        for (let page = 1; page <= totalPages; page++) {
            const active = page === this.currentPage ? 'active' : '';
            const li = document.createElement('li');
            li.className = `page-item ${active}`;
            const link = document.createElement('a');
            link.className = 'page-link';
            link.href = '#';
            link.textContent = page;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.currentPage = page;
                this.renderMediaGrid();
                this.renderPagination();
            });
            li.appendChild(link);
            paginationList.appendChild(li);
        }
    }

    renderLoadingState(message) {
        const grid = document.getElementById('media-grid');
        if (!grid) return;

        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }

        grid.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-3 text-muted">${message}</p>
            </div>
        `;
    }

    renderEmptyState(message) {
        const grid = document.getElementById('media-grid');
        if (!grid) return;

        const paginationContainer = document.getElementById('pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }

        grid.innerHTML = `
            <div class="col-12">
                <div class="media-empty">
                    <i class="fas fa-layer-group"></i>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }

    openPreview(index) {
        const modal = document.getElementById('mediaModal');
        if (!modal) return;
        if (!this.renderPreview(index)) return;

        const modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
        if (!modal.classList.contains('show')) {
            modalInstance.show();
        }
    }

    renderPreview(index) {
        const item = this.filteredData[index];
        const modal = document.getElementById('mediaModal');
        const viewer = document.getElementById('media-viewer');
        const downloadBtn = document.getElementById('download-btn');
        const modalTitle = document.getElementById('mediaModalLabel');
        const counter = document.getElementById('mediaModalCounter');

        if (!item || !modal || !viewer || !downloadBtn || !modalTitle) return false;

        this.currentPreviewIndex = index;
        const previewToken = ++this.previewRenderToken;
        this.updatePreviewViewportConstraints();
        modalTitle.textContent = item.filename;
        if (counter) {
            counter.textContent = `${index + 1} / ${this.filteredData.length}`;
        }
        viewer.innerHTML = '';

        const isActivePreview = () => previewToken === this.previewRenderToken && this.currentPreviewIndex === index;

        if (item.type === 'video') {
            const videoElement = document.createElement('video');
            videoElement.className = 'media-full-view';
            videoElement.controls = true;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.preload = 'metadata';
            const sourceElement = document.createElement('source');
            sourceElement.src = item.url;
            sourceElement.type = this.getVideoMimeType(item.url);
            videoElement.appendChild(sourceElement);

            let settled = false;
            const settleSuccess = () => {
                if (settled || !isActivePreview()) return;
                settled = true;
                clearTimeout(loadTimeoutHandle);
            };
            const settleFailure = (reason) => {
                if (settled || !isActivePreview()) return;
                settled = true;
                clearTimeout(loadTimeoutHandle);
                this.renderPreviewUnavailable(viewer, reason);
            };

            const loadTimeoutHandle = setTimeout(() => {
                settleFailure('Timeout saat mengambil video dari server media.');
            }, this.previewLoadTimeoutMs);

            videoElement.addEventListener('loadeddata', settleSuccess, { once: true });
            videoElement.addEventListener('canplay', settleSuccess, { once: true });
            videoElement.addEventListener('error', () => {
                settleFailure('Video gagal dimuat. Koneksi ke PC-BIM02 mungkin tidak stabil.');
            }, { once: true });
            sourceElement.addEventListener('error', () => {
                settleFailure('Sumber video tidak tersedia.');
            }, { once: true });

            viewer.appendChild(videoElement);
        } else {
            const imgElement = document.createElement('img');
            imgElement.src = item.url;
            imgElement.alt = item.filename;
            imgElement.className = 'media-full-view img-fluid';
            let settled = false;
            const settleSuccess = () => {
                if (settled || !isActivePreview()) return;
                settled = true;
                clearTimeout(loadTimeoutHandle);
            };
            const settleFailure = (reason) => {
                if (settled || !isActivePreview()) return;
                settled = true;
                clearTimeout(loadTimeoutHandle);
                this.renderPreviewUnavailable(viewer, reason);
            };

            const loadTimeoutHandle = setTimeout(() => {
                settleFailure('Timeout saat mengambil gambar dari server media.');
            }, this.previewLoadTimeoutMs);

            imgElement.addEventListener('load', settleSuccess, { once: true });
            imgElement.addEventListener('error', () => {
                settleFailure('Gambar gagal dimuat. Koneksi ke PC-BIM02 mungkin tidak stabil.');
            }, { once: true });
            viewer.appendChild(imgElement);
        }

        downloadBtn.href = this.getWatermarkUrl(item);
        downloadBtn.setAttribute('download', this.getWatermarkFilename(item));
        this.updatePreviewNavigationState();
        return true;
    }

    navigatePreview(step) {
        if (!Array.isArray(this.filteredData) || this.filteredData.length === 0) return;
        const nextIndex = this.currentPreviewIndex + step;
        if (nextIndex < 0 || nextIndex >= this.filteredData.length) return;
        this.renderPreview(nextIndex);
    }

    updatePreviewNavigationState() {
        const prevBtn = document.getElementById('preview-prev-btn');
        const nextBtn = document.getElementById('preview-next-btn');
        const total = this.filteredData.length;

        if (prevBtn) {
            prevBtn.disabled = this.currentPreviewIndex <= 0 || total === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPreviewIndex >= total - 1 || total === 0;
        }
    }

    handlePreviewKeyboard(event) {
        const modal = document.getElementById('mediaModal');
        if (!modal || !modal.classList.contains('show')) return;

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.navigatePreview(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.navigatePreview(1);
        }
    }

    updatePreviewViewportConstraints() {
        const modal = document.getElementById('mediaModal');
        if (!modal) return;
        if (!modal.classList.contains('show')) return;

        const header = modal.querySelector('.modal-header');
        const footer = modal.querySelector('.modal-footer');
        const body = modal.querySelector('.modal-body');

        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const headerHeight = header ? header.offsetHeight : 0;
        const footerHeight = footer ? footer.offsetHeight : 0;
        const bodyStyle = body ? window.getComputedStyle(body) : null;
        const bodyPaddingY = bodyStyle
            ? (parseFloat(bodyStyle.paddingTop || '0') + parseFloat(bodyStyle.paddingBottom || '0'))
            : 0;
        const bodyPaddingX = bodyStyle
            ? (parseFloat(bodyStyle.paddingLeft || '0') + parseFloat(bodyStyle.paddingRight || '0'))
            : 0;

        const maxHeight = Math.max(180, Math.floor(viewportHeight - headerHeight - footerHeight - bodyPaddingY - 8));
        const maxWidth = Math.max(240, Math.floor(viewportWidth - bodyPaddingX - 8));

        modal.style.setProperty('--preview-area-height', `${maxHeight}px`);
        modal.style.setProperty('--preview-area-width', `${maxWidth}px`);
    }

    highlightActive(selector, value, dataAttr = 'data-year') {
        document.querySelectorAll(selector).forEach(item => {
            const currentValue = item.getAttribute(dataAttr) || item.dataset.year;
            if (currentValue === value) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

new ProjectsExplorer();
