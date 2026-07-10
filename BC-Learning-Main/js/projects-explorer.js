class ProjectsExplorer {
    constructor() {
        this.years = [];
        this.yearsBySource = {};
        this.sources = [];
        this.projects = [];
        this.hiddenProjects = [];
        this.allProjectsIndex = [];
        this.allProjectsIndexLoaded = false;
        this.projectSearchLoadPromise = null;
        this.projectSearchRenderToken = 0;
        this.mediaData = [];
        this.filteredData = [];
        this.selectedYear = null;
        this.selectedYearKey = null;
        this.selectedProject = null;
        this.selectedProjectKey = null;
        this.selectedSourceId = null;
        this.searchQuery = '';
        this.projectSearchQuery = '';
        this.filterType = 'all';
        this.filterSize = 'all';
        this.sortBy = 'name-asc';
        this.itemsPerPage = 24;
        this.currentPage = 1;
        this.currentPreviewIndex = -1;
        this.boundPreviewViewportHandler = () => this.updatePreviewViewportConstraints();
        this.apiBaseCandidates = this.getApiBaseCandidates();
        this.apiBase = this.apiBaseCandidates[0] || '';
        this.cacheBasePath = '/data/projects-explorer-cache';
        this.mediaCacheBasePath = `${this.cacheBasePath}/media`;
        this.previewLoadTimeoutMs = 12000;
        this.previewRenderToken = 0;
        this.isRefreshingProjects = false;
        this.emptyMediaMessage = 'Tidak ada media yang sesuai filter.';

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
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) {
                    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    error.status = response.status;
                    error.url = url;
                    error.isHttpError = true;
                    throw error;
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

    shouldUseStaticCacheFallback(error, options = {}) {
        if (options.allowHttpErrors) {
            return true;
        }
        return !(error && error.isHttpError);
    }

    async fetchStaticCacheJson(fileName) {
        const response = await fetch(`${this.cacheBasePath}/${fileName}?v=20260313a`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    async fetchStaticMediaCacheJson(year, projectName, sourceId) {
        const fileName = this.buildProjectMediaCacheFileName(year, projectName, sourceId);
        const response = await fetch(`${this.mediaCacheBasePath}/${fileName}?v=20260313a`, { cache: 'no-store' });
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.isHttpError = true;
            throw error;
        }

        return response.json();
    }

    mergeProjectMediaPayload(primaryPayload, fallbackPayload) {
        const merged = {
            ...(primaryPayload && typeof primaryPayload === 'object' ? primaryPayload : {})
        };
        const primaryDetails = Array.isArray(primaryPayload && primaryPayload.mediaDetails)
            ? primaryPayload.mediaDetails
            : [];
        const fallbackDetails = Array.isArray(fallbackPayload && fallbackPayload.mediaDetails)
            ? fallbackPayload.mediaDetails
            : [];
        const detailsByUrl = new Map();

        [...primaryDetails, ...fallbackDetails].forEach((detail) => {
            if (!detail || !detail.url || this.hasIncomingDataFolder(detail.url || detail.displayUrl || '')) {
                return;
            }
            if (!detailsByUrl.has(detail.url)) {
                detailsByUrl.set(detail.url, detail);
            }
        });

        const mediaUrls = [
            ...(Array.isArray(primaryPayload && primaryPayload.media) ? primaryPayload.media : []),
            ...(Array.isArray(fallbackPayload && fallbackPayload.media) ? fallbackPayload.media : []),
            ...Array.from(detailsByUrl.keys())
        ].filter((url) => url && !this.hasIncomingDataFolder(url));

        merged.media = [...new Set(mediaUrls)];
        merged.mediaDetails = merged.media
            .map((url) => detailsByUrl.get(url))
            .filter(Boolean);
        merged.totalMedia = merged.media.length;

        return merged;
    }

    normalizeFolderLabel(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/^[\s._-]*\d+[\s._-]*/g, '')
            .replace(/[._-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    hasIncomingDataFolder(value) {
        const safeDecode = (input) => {
            let output = String(input || '');
            for (let index = 0; index < 3; index += 1) {
                try {
                    const decoded = decodeURIComponent(output);
                    if (decoded === output) break;
                    output = decoded;
                } catch (error) {
                    break;
                }
            }
            return output;
        };

        const cleanPath = safeDecode(value).replace(/\\/g, '/').split(/[?#]/)[0];
        return cleanPath
            .split('/')
            .filter(Boolean)
            .some((segment) => {
                const normalized = this.normalizeFolderLabel(segment);
                return /\bincoming\s*data\b/.test(normalized)
                    || /\bincomingdata\b/.test(normalized)
                    || /\bdata\s*incoming\b/.test(normalized)
                    || /\bdataincoming\b/.test(normalized);
            });
    }

    hasProjectNumberPrefix(value) {
        return /^\s*\d+[\s._-]+/.test(String(value || ''));
    }

    shouldDisplayProjectFolder(project) {
        const projectName = project && project.name ? project.name : '';
        return this.hasProjectNumberPrefix(projectName) && !this.hasIncomingDataFolder(projectName);
    }

    buildProjectMediaCacheFileName(year, projectName, sourceId) {
        const safe = (value) => encodeURIComponent(String(value || '').trim()).replace(/%/g, '_');
        return `${safe(year)}__${safe(sourceId || 'unknown')}__${safe(projectName)}.json`;
    }

    buildMediaProxyUrl(mediaUrl) {
        const cleanUrl = String(mediaUrl || '').trim();
        if (!cleanUrl) return '';

        let base = this.apiBase || window.location.origin || '';
        if (base === 'null') {
            base = '';
        }
        base = base.replace(/\/$/, '');
        return `${base}/api/media-proxy?url=${encodeURIComponent(cleanUrl)}`;
    }

    buildProjectVideoThumbnailUrl(mediaUrl) {
        const cleanUrl = String(mediaUrl || '').trim();
        if (!cleanUrl) return '';

        let base = this.apiBase || window.location.origin || '';
        if (base === 'null') {
            base = '';
        }
        base = base.replace(/\/$/, '');
        return `${base}/api/project-media-thumbnail?url=${encodeURIComponent(cleanUrl)}`;
    }

    getBestDisplayUrl(displayUrl, sourceUrl) {
        const preferredUrl = String(displayUrl || '').trim();
        const rawUrl = String(sourceUrl || '').trim();
        const candidateUrl = preferredUrl || rawUrl;

        if (!candidateUrl) {
            return '';
        }

        if (/\/api\/media-proxy\?/i.test(candidateUrl)) {
            return candidateUrl;
        }

        if (/^\/data\/pc-bim02-cache\//i.test(candidateUrl)) {
            return this.buildMediaProxyUrl(rawUrl);
        }

        if (/^\/media(?:-bim02(?:-2026)?|-bim1-\d{4})?\//i.test(candidateUrl)) {
            return this.buildMediaProxyUrl(rawUrl || candidateUrl);
        }

        return candidateUrl;
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

    getAuthToken() {
        const currentUser = window.currentUser;
        if (currentUser && typeof currentUser.token === 'string' && currentUser.token.trim()) {
            return currentUser.token.trim();
        }

        const storedUserRaw = localStorage.getItem('user');
        if (storedUserRaw) {
            try {
                const storedUser = JSON.parse(storedUserRaw);
                if (storedUser && typeof storedUser.token === 'string' && storedUser.token.trim()) {
                    return storedUser.token.trim();
                }
            } catch (error) {
                // Ignore malformed local user data.
            }
        }

        const token = localStorage.getItem('token');
        return typeof token === 'string' ? token.trim() : '';
    }

    setRefreshStatus(message, tone = 'muted') {
        const statusEl = document.getElementById('refresh-projects-status');
        if (!statusEl) return;

        const toneClassMap = {
            muted: 'text-muted',
            info: 'text-info',
            success: 'text-success',
            danger: 'text-danger',
            warning: 'text-warning'
        };

        statusEl.className = `small mt-2 ${toneClassMap[tone] || toneClassMap.muted}`;
        statusEl.textContent = message || '';
    }

    setRefreshButtonState(isBusy) {
        const button = document.getElementById('refresh-projects-btn');
        if (!button) return;

        button.disabled = !!isBusy;
        button.innerHTML = isBusy
            ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Menyinkronkan...'
            : '<i class="fas fa-rotate-right me-2"></i>Sinkronkan';
    }

    async reloadProjectsView() {
        const previousYear = this.selectedYear;
        const previousSourceId = this.selectedSourceId;
        const previousProject = this.selectedProject;

        await this.loadYears();

        if (!previousYear) {
            return;
        }

        const yearsForSource = previousSourceId ? this.getUniqueSortedYearsForSource(previousSourceId) : this.years;
        const yearStillExists = Array.isArray(yearsForSource) && yearsForSource.includes(previousYear);
        if (!yearStillExists) {
            return;
        }

        await this.selectYear(previousYear, previousSourceId || null);

        if (!previousProject) {
            return;
        }

        const matchingProject = this.projects.find((project) =>
            project.name === previousProject && (project.sourceId || null) === (previousSourceId || null)
        );
        if (matchingProject) {
            await this.selectProject(matchingProject.name, matchingProject.sourceId || null);
        }
    }

    async refreshProjectsCache() {
        if (this.isRefreshingProjects) {
            return;
        }

        const token = this.getAuthToken();
        const hasValidToken = !!token && !this.isTokenExpired(token);

        this.isRefreshingProjects = true;
        this.setRefreshButtonState(true);
        this.setRefreshStatus('Sinkronisasi manual konten PC-BIM02 sedang berjalan...', 'info');

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (hasValidToken) {
                headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch('/api/projects/refresh-cache', {
                method: 'POST',
                headers,
                credentials: 'include'
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result.detail || result.error || `HTTP ${response.status}`);
            }

            this.setRefreshStatus('Sinkronisasi selesai. Memuat ulang data project...', 'success');
            await this.reloadProjectsView();

            this.setRefreshStatus('Sinkronisasi manual selesai.', 'success');
        } catch (error) {
            const endpointMissing = /404/.test(String(error.message || ''));
            if (endpointMissing) {
                try {
                    await this.reloadProjectsView();
                    this.setRefreshStatus('Endpoint sinkronisasi server belum aktif. Data halaman dimuat ulang dari cache terbaru.', 'warning');
                    return;
                } catch (reloadError) {
                    this.setRefreshStatus(`Refresh gagal: ${reloadError.message}`, 'danger');
                    return;
                }
            }
            this.setRefreshStatus(`Sinkronisasi gagal: ${error.message}`, 'danger');
        } finally {
            this.isRefreshingProjects = false;
            this.setRefreshButtonState(false);
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

        const projectSearchInput = document.getElementById('project-search-input');
        if (projectSearchInput) {
            projectSearchInput.addEventListener('input', (e) => this.handleProjectSearchInput(e.target.value));
        }

        const projectSearchClear = document.getElementById('project-search-clear');
        if (projectSearchClear) {
            projectSearchClear.addEventListener('click', () => {
                this.projectSearchQuery = '';
                const input = document.getElementById('project-search-input');
                if (input) {
                    input.value = '';
                    input.focus();
                }
                this.renderProjectList();
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

        const refreshButton = document.getElementById('refresh-projects-btn');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refreshProjectsCache());
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
                this.openProjectFromList(projectItem);
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
            let data;
            try {
                data = await this.fetchJsonWithFallback('/api/years');
            } catch (apiError) {
                if (!this.shouldUseStaticCacheFallback(apiError)) {
                    throw apiError;
                }
                data = await this.fetchStaticCacheJson('years.json');
            }

            this.years = Array.isArray(data.years) ? data.years : [];
            this.yearsBySource = data.yearsBySource && typeof data.yearsBySource === 'object' ? data.yearsBySource : {};
            this.sources = Array.isArray(data.sources) ? data.sources : [];
            this.allProjectsIndex = [];
            this.allProjectsIndexLoaded = false;
            this.projectSearchLoadPromise = null;
            this.renderYearList();

            const initialProjectContext = this.getInitialProjectContext();
            if (initialProjectContext.year) {
                await this.openProjectContext(initialProjectContext);
            } else if (this.sources.length > 0) {
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

    getInitialProjectContext() {
        const params = new URLSearchParams(window.location.search || '');
        return {
            year: (params.get('year') || '').trim(),
            sourceId: (params.get('sourceId') || params.get('source') || '').trim(),
            project: (params.get('project') || '').trim()
        };
    }

    async openProjectContext({ year, sourceId, project }) {
        const normalizedYear = String(year || '').trim();
        const normalizedSourceId = String(sourceId || '').trim();
        const normalizedProject = String(project || '').trim();

        if (!normalizedYear) return;

        await this.selectYear(normalizedYear, normalizedSourceId || null);

        if (!normalizedProject) return;

        const matchingProject = this.projects.find((item) =>
            item.name === normalizedProject && (!normalizedSourceId || item.sourceId === normalizedSourceId)
        );

        if (matchingProject) {
            await this.selectProject(matchingProject.name, matchingProject.sourceId || normalizedSourceId || null);
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

        this.updateProjectSearchStatus(0, 0);

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
            let data;
            try {
                data = await this.fetchJsonWithFallback(`/api/projects/${year}${query}`);
            } catch (apiError) {
                if (!this.shouldUseStaticCacheFallback(apiError)) {
                    throw apiError;
                }
                data = await this.fetchStaticCacheJson(`projects-${year}.json`);
            }

            this.projects = Array.isArray(data.projects)
                ? data.projects.filter(project => this.shouldDisplayProjectFolder(project))
                : [];
            this.hiddenProjects = Array.isArray(data.hiddenProjects) ? data.hiddenProjects : [];
            if (sourceId) {
                this.projects = this.projects.filter(project => project.sourceId === sourceId);
                this.hiddenProjects = this.hiddenProjects.filter(project => project.sourceId === sourceId);
            }
            this.renderProjectList();

            if (this.projects.length === 0) {
                this.renderEmptyState('Tidak ada proyek untuk tahun ini.');
            } else {
                this.renderEmptyState('Pilih proyek dari daftar untuk melihat media.');
            }
        } catch (error) {
            this.hiddenProjects = [];
            this.updateProjectSearchStatus(0, 0);
            projectList.innerHTML = `
                <div class="text-muted small">Gagal memuat proyek: ${error.message}</div>
            `;
        }
    }

    async fetchProjectsForSearchScope(year, sourceId) {
        const query = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
        let data;
        try {
            data = await this.fetchJsonWithFallback(`/api/projects/${year}${query}`);
        } catch (apiError) {
            if (!this.shouldUseStaticCacheFallback(apiError)) {
                throw apiError;
            }
            data = await this.fetchStaticCacheJson(`projects-${year}.json`);
        }

        let projects = Array.isArray(data.projects)
            ? data.projects.filter(project => this.shouldDisplayProjectFolder(project))
            : [];

        if (sourceId) {
            projects = projects.filter(project => project.sourceId === sourceId);
        }

        return projects.map((project) => ({
            ...project,
            year: String(year || project.year || '').trim(),
            sourceId: project.sourceId || sourceId || '',
            source: project.source || this.getSourceLabel(sourceId) || project.source || ''
        }));
    }

    getSourceLabel(sourceId) {
        const source = this.sources.find((item) => item && item.id === sourceId);
        return source ? (source.name || source.groupName || source.id || '') : '';
    }

    getProjectSearchScopes() {
        const scopes = [];
        const hasSources = this.sources && this.sources.length > 0 && Object.keys(this.yearsBySource).length > 0;

        if (hasSources) {
            const sortedSources = [...this.sources].sort((a, b) => (a.priority || 0) - (b.priority || 0));
            sortedSources.forEach((source) => {
                this.getUniqueSortedYearsForSource(source.id).forEach((year) => {
                    scopes.push({ year, sourceId: source.id });
                });
            });
        } else {
            this.years.forEach((year) => {
                scopes.push({ year, sourceId: null });
            });
        }

        const seen = new Set();
        return scopes.filter((scope) => {
            const key = `${scope.year}::${scope.sourceId || 'unknown'}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return !!scope.year;
        });
    }

    async ensureProjectSearchIndex() {
        if (this.allProjectsIndexLoaded) {
            return this.allProjectsIndex;
        }

        if (this.projectSearchLoadPromise) {
            return this.projectSearchLoadPromise;
        }

        const scopes = this.getProjectSearchScopes();
        this.projectSearchLoadPromise = Promise.all(
            scopes.map((scope) => this.fetchProjectsForSearchScope(scope.year, scope.sourceId).catch(() => []))
        ).then((projectGroups) => {
            const uniqueProjects = new Map();
            projectGroups.flat().forEach((project) => {
                const key = `${project.year || ''}::${project.sourceId || ''}::${project.name || ''}`;
                if (!uniqueProjects.has(key)) {
                    uniqueProjects.set(key, project);
                }
            });

            this.allProjectsIndex = Array.from(uniqueProjects.values()).sort((a, b) => {
                const yearCompare = String(b.year || '').localeCompare(String(a.year || ''));
                if (yearCompare !== 0) return yearCompare;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
            this.allProjectsIndexLoaded = true;
            return this.allProjectsIndex;
        }).finally(() => {
            this.projectSearchLoadPromise = null;
        });

        return this.projectSearchLoadPromise;
    }

    async handleProjectSearchInput(value) {
        this.projectSearchQuery = this.normalizeSearchText(value);
        const renderToken = this.projectSearchRenderToken + 1;
        this.projectSearchRenderToken = renderToken;

        if (!this.projectSearchQuery) {
            this.renderProjectList();
            return;
        }

        if (!this.allProjectsIndexLoaded) {
            this.renderProjectSearchLoading();
            await this.ensureProjectSearchIndex();
            if (renderToken !== this.projectSearchRenderToken) return;
        }

        this.renderProjectList();
    }

    renderProjectSearchLoading() {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        this.updateProjectSearchStatus(0, 0, 'Mencari di semua tahun dan sumber...');
        projectList.innerHTML = `
            <div class="text-center">
                <div class="spinner-border spinner-border-sm" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <small class="text-muted d-block mt-2">Membangun indeks proyek...</small>
            </div>
        `;
    }

    normalizeSearchText(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[._-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    getVisibleProjects() {
        const query = this.projectSearchQuery.trim();
        if (!query) {
            return this.projects;
        }

        return this.allProjectsIndex.filter((project) => {
            const projectName = project && project.name ? project.name : '';
            return this.normalizeSearchText(projectName).includes(query);
        });
    }

    updateProjectSearchStatus(visibleCount, totalCount, message = '') {
        const status = document.getElementById('project-search-status');
        if (!status) return;

        const clearButton = document.getElementById('project-search-clear');
        if (clearButton) {
            clearButton.disabled = !this.projectSearchQuery;
        }

        if (!totalCount) {
            status.textContent = message;
            return;
        }

        status.textContent = this.projectSearchQuery
            ? `${visibleCount} dari ${totalCount} proyek ditemukan di semua tahun`
            : `${totalCount} proyek tersedia`;
    }

    renderProjectList() {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        const isGlobalSearch = !!this.projectSearchQuery;
        const sourceProjects = isGlobalSearch ? this.allProjectsIndex : this.projects;

        if (sourceProjects.length === 0) {
            this.updateProjectSearchStatus(0, 0);
            projectList.innerHTML = `
                <div class="text-muted small">${isGlobalSearch ? 'Tidak ada indeks proyek untuk dicari.' : 'Tidak ada proyek.'}</div>
            `;
            return;
        }

        const visibleProjects = this.getVisibleProjects();
        this.updateProjectSearchStatus(visibleProjects.length, sourceProjects.length);

        if (visibleProjects.length === 0) {
            projectList.innerHTML = `
                <div class="text-muted small">Tidak ada proyek yang sesuai.</div>
            `;
            return;
        }

        const projectItems = visibleProjects.map((project) => {
            const sourceId = project.sourceId || '';
            const projectKey = `${project.name}::${sourceId || 'unknown'}`;
            const sourceLabel = project.source || sourceId || 'Unknown';
            const sourceClass = sourceId.includes('bim02') ? 'source-bim02' : sourceId.includes('bim1') ? 'source-bim1' : '';
            const mediaCount = typeof project.mediaCount === 'number' ? project.mediaCount : 0;
            const projectYear = project.year || this.selectedYear || '';
            const safeName = this.escapeHtml(project.name);
            const safeSourceId = this.escapeHtml(sourceId);
            const safeProjectKey = this.escapeHtml(projectKey);
            const safeSourceLabel = this.escapeHtml(sourceLabel);
            const safeYear = this.escapeHtml(projectYear);
            const yearMeta = isGlobalSearch && projectYear ? `<span>${safeYear}</span>` : '';
            return `
                <a href="#" class="category-item" data-project="${safeName}" data-project-year="${safeYear}" data-source-id="${safeSourceId}" data-project-key="${safeProjectKey}">
                    <div>
                        <div class="category-name">${safeName}</div>
                        <div class="category-meta">
                            <span class="source-tag ${sourceClass}">${safeSourceLabel}</span>
                            ${yearMeta}
                            <span>${mediaCount} media</span>
                        </div>
                    </div>
                    <span class="category-count"><i class="fas fa-folder"></i></span>
                </a>
            `;
        }).join('');

        projectList.innerHTML = projectItems;

        this.highlightActive('[data-project-key]', this.selectedProjectKey, 'data-project-key');
    }

    async openProjectFromList(projectItem) {
        const projectName = projectItem.dataset.project || '';
        const sourceId = projectItem.dataset.sourceId || null;
        const projectYear = projectItem.dataset.projectYear || this.selectedYear;

        if (!projectName) return;

        const needsContextSwitch = projectYear
            && (String(projectYear) !== String(this.selectedYear || '') || (sourceId || null) !== (this.selectedSourceId || null));

        if (needsContextSwitch) {
            await this.selectYear(projectYear, sourceId);
        }

        await this.selectProject(projectName, sourceId);
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
            let data;
            try {
                data = await this.fetchJsonWithFallback(`/api/project-media/${encodeURIComponent(this.selectedYear)}/${encodeURIComponent(projectName)}${query}`);
                try {
                    const cachedData = await this.fetchStaticMediaCacheJson(this.selectedYear, projectName, sourceId || 'unknown');
                    data = this.mergeProjectMediaPayload(data, cachedData);
                } catch (cacheMergeError) {
                    // Live API remains authoritative when static cache is not available.
                }
            } catch (apiError) {
                if (!this.shouldUseStaticCacheFallback(apiError, { allowHttpErrors: true })) {
                    throw apiError;
                }
                data = await this.fetchStaticMediaCacheJson(this.selectedYear, projectName, sourceId || 'unknown');
            }
            const mediaList = Array.isArray(data.media)
                ? data.media.filter(url => !this.hasIncomingDataFolder(url))
                : [];
            const detailsList = Array.isArray(data.mediaDetails)
                ? data.mediaDetails.filter(detail => !this.hasIncomingDataFolder((detail && (detail.url || detail.displayUrl)) || ''))
                : [];
            const detailMap = new Map(
                detailsList
                    .filter(detail => detail && detail.url)
                    .map(detail => [detail.url, detail])
            );

            this.mediaData = mediaList
                .map((url) => this.buildMediaItem(url, detailMap.get(url)))
                .filter(item => item.type === 'image' || item.type === 'video' || item.type === 'model');
            this.emptyMediaMessage = this.mediaData.length === 0
                ? 'Belum ada media publik yang tersedia untuk proyek ini. Folder sumber mungkin hanya berisi data yang dikecualikan atau source belum dapat diakses.'
                : 'Tidak ada media yang sesuai filter.';

            this.currentPage = 1;
            this.applyFilters();
        } catch (error) {
            const message = error && (error.status === 404 || /HTTP 404/i.test(String(error.message || '')))
                ? 'Belum ada cache media untuk proyek ini atau source media belum dapat diakses. Jalankan sinkronisasi saat PC-BIM02 aktif lalu pilih proyek kembali.'
                : `Gagal memuat media: ${error.message}`;
            this.renderEmptyState(message);
        }
    }

    buildMediaItem(url, details = null) {
        const cleanUrl = url || '';
        const displayUrlRaw = details && typeof details.displayUrl === 'string'
            ? details.displayUrl
            : cleanUrl;
        const displayUrl = this.getBestDisplayUrl(displayUrlRaw, cleanUrl);
        const filenameRaw = cleanUrl.split('/').pop() || 'media';
        let filename = filenameRaw;
        try {
            filename = decodeURIComponent(filenameRaw);
        } catch (err) {
            filename = filenameRaw;
        }
        const ext = filename.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
        const videoExts = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'wmv', 'm4v'];
        const modelExts = ['ifc'];
        let type = 'other';
        if (imageExts.includes(ext)) type = 'image';
        if (videoExts.includes(ext)) type = 'video';
        if (modelExts.includes(ext) || (details && details.mediaKind === 'model')) type = 'model';

        const sizeBytes = details && typeof details.sizeBytes === 'number' ? details.sizeBytes : null;
        const durationSeconds = details && typeof details.durationSeconds === 'number' ? details.durationSeconds : null;
        const availability = details && details.availability ? String(details.availability) : 'unknown';
        const sourceStatus = details && details.sourceStatus ? String(details.sourceStatus) : '';
        const sourceLabel = details && details.sourceLabel ? String(details.sourceLabel) : '';
        const isUnavailable = ['unavailable', 'invalid', 'missing'].includes(availability.toLowerCase());

        return {
            url: displayUrl,
            sourceUrl: cleanUrl,
            filename,
            type,
            sizeBytes,
            durationSeconds,
            availability,
            sourceStatus,
            sourceLabel,
            isUnavailable
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
            wmv: 'video/x-ms-wmv',
            m4v: 'video/mp4'
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

    getDownloadUrl(item) {
        if (item && item.type === 'model') {
            return item.url || item.sourceUrl || '#';
        }

        return this.getWatermarkUrl(item);
    }

    getDownloadFilename(item) {
        if (item && item.type === 'model') {
            return item.filename || 'model.ifc';
        }

        return this.getWatermarkFilename(item);
    }

    buildIfcViewerUrl(item) {
        const fileUrl = item && (item.sourceUrl || item.url) ? (item.sourceUrl || item.url) : '';
        const params = new URLSearchParams({
            file: fileUrl,
            name: item && item.filename ? item.filename : 'IFC Model',
            source: this.selectedSourceId || '',
            year: this.selectedYear || '',
            project: this.selectedProject || ''
        });
        return `/pages/ifc-viewer.html?${params.toString()}`;
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

        if (type === 'model') {
            return {
                theme: 'model',
                icon: 'fas fa-cube',
                iconImage: '',
                badge: 'IFC',
                caption: 'IFC Model'
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
        if (item && item.isUnavailable) {
            return this.buildFileThumb(item.type || 'image');
        }

        if (item.type === 'model') {
            return this.buildFileThumb('model');
        }

        if (item.type === 'image') {
            const safeName = this.escapeHtml(item.filename);
            return `
                <img src="${item.url}" alt="${safeName}" loading="lazy" decoding="async"
                    onerror="this.style.display='none'; this.nextElementSibling.classList.remove('is-hidden');">
                ${this.buildFileThumb('image', { hidden: true })}
            `;
        }

        const thumbnailUrl = this.buildProjectVideoThumbnailUrl(item.sourceUrl || item.url);
        if (!thumbnailUrl) {
            return this.buildFileThumb('video');
        }

        const safeName = this.escapeHtml(item.filename);
        return `
            <img src="${thumbnailUrl}" alt="${safeName}" loading="lazy" decoding="async" class="video-thumb-image"
                onerror="this.style.display='none'; const play=this.parentElement.querySelector('.video-thumb-play'); if (play) play.style.display='none'; const fallback=this.parentElement.querySelector('.file-thumb'); if (fallback) fallback.classList.remove('is-hidden');">
            <span class="video-thumb-play" aria-hidden="true"><i class="fas fa-play"></i></span>
            ${this.buildFileThumb('video', { hidden: true })}
        `;
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

    getMediaAvailabilityLabel(item) {
        if (!item || !item.isUnavailable) return '';
        const status = (item.sourceStatus || item.availability || '').toLowerCase();
        if (status.includes('timeout')) return 'Source media timeout';
        if (status.includes('excluded')) return 'Folder dikecualikan';
        if (status.includes('invalid')) return 'URL media tidak valid';
        if (status.includes('not-found') || status.includes('enoent') || status.includes('missing')) {
            return 'File tidak ditemukan di source';
        }
        return 'Source media tidak tersedia';
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
            this.renderEmptyState(this.emptyMediaMessage || 'Tidak ada media yang sesuai filter.');
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredData.slice(startIndex, endIndex);

        grid.innerHTML = pageItems.map((item, index) => {
            const globalIndex = startIndex + index;
            const mediaThumb = this.buildMediaThumbnail(item);

            const typeLabel = item.type === 'video' ? 'VIDEO' : (item.type === 'model' ? 'IFC' : 'IMAGE');
            const downloadUrl = this.getDownloadUrl(item);
            const downloadName = this.getDownloadFilename(item);
            const sizeLabel = this.formatFileSize(item.sizeBytes);
            const durationLabel = item.type === 'video' ? this.formatDuration(item.durationSeconds) : '';
            const metaPrimary = [this.selectedYear || '', this.selectedProject || ''].filter(Boolean).join(' • ');
            const durationMeta = item.type === 'video'
                ? ` • Durasi: ${durationLabel || '-'}`
                : '';
            const availabilityLabel = this.getMediaAvailabilityLabel(item);
            const availabilityMeta = item.isUnavailable
                ? `<div class="media-meta-row media-source-warning"><i class="fas fa-triangle-exclamation"></i>${this.escapeHtml(availabilityLabel)}</div>`
                : '';
            const unavailableTitle = this.escapeHtml(availabilityLabel || 'Source media tidak tersedia');
            const actions = item.isUnavailable
                ? `
                    <button class="btn-media-action btn-view" type="button" disabled title="${unavailableTitle}">
                        <i class="fas fa-eye-slash"></i> Preview
                    </button>
                    <button class="btn-media-action btn-download" type="button" disabled title="${unavailableTitle}">
                        <i class="fas fa-download"></i> Download
                    </button>
                `
                : item.type === 'model'
                ? `
                    <a class="btn-media-action btn-viewer" href="${this.buildIfcViewerUrl(item)}">
                        <i class="fas fa-cube"></i> Open IFC
                    </a>
                    <a class="btn-media-action btn-download" href="${downloadUrl}" download="${downloadName}">
                        <i class="fas fa-download"></i> Download
                    </a>
                `
                : `
                    <button class="btn-media-action btn-view" data-media-index="${globalIndex}">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                    <a class="btn-media-action btn-download" href="${downloadUrl}" download="${downloadName}">
                        <i class="fas fa-download"></i> Download
                    </a>
                `;

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
                                ${availabilityMeta}
                            </div>
                            <div class="media-actions">
                                ${actions}
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
