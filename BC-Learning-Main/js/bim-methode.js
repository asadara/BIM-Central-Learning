/**
 * BIM Methode Gallery JavaScript
 * Handles media gallery functionality for PC-BIM02 folder access
 */

class BIMGallery {
    constructor() {
        this.categoryStorageKey = 'bim_methode_selected_category';
        this.currentCategory = this.getInitialCategoryPreference();
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.searchQuery = '';
        this.filterType = 'image';
        this.sortBy = 'date-desc';
        this.categories = [];
        this.mediaData = [];
        this.filteredData = [];
        this.isAdmin = false; // Status admin untuk UI
        this.retryTimer = null;
        this.retryDelayMs = 5000;
        this.apiBaseCandidates = this.getApiBaseCandidates();
        this.apiBase = this.apiBaseCandidates[0] || '';
        this.loadingTimers = { media: [], category: [] };
        this.loadingStartTimes = { media: 0, category: 0 };
        this.statusClearTimers = { media: null, category: null };
        this.currentPreviewIndex = -1;
        this.boundPreviewViewportHandler = () => this.updatePreviewViewportConstraints();
        this.slowLoadHintMs = 4000;
        this.longLoadHintMs = 12000;
        this.previewLoadTimeoutMs = 12000;
        this.previewRenderToken = 0;
        this.thumbStoragePrefix = 'bim_methode_thumb_';
        this.thumbStorageIndexKey = 'bim_methode_thumb_index';
        this.thumbStorageMaxItems = 80;
        this.thumbStorageMaxChars = 180000;

        this.init();
    }

    init() {
        console.log('🎬 Initializing BIM Methode Gallery...');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }

        // Load initial data
        this.loadCategories({ preloadSelectedOnly: true });
    }

    getInitialCategoryPreference() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const fromUrl = (params.get('category') || '').trim();
            if (fromUrl) return fromUrl;
        } catch (error) {
            // Ignore malformed URL params
        }

        try {
            const saved = (localStorage.getItem(this.categoryStorageKey) || '').trim();
            if (saved) return saved;
        } catch (error) {
            // Ignore localStorage access issues
        }

        return '';
    }

    resolveInitialCategory() {
        const categoryIds = new Set((this.categories || []).map(category => category.id));

        if (this.currentCategory === 'all') {
            return 'all';
        }

        if (this.currentCategory && categoryIds.has(this.currentCategory)) {
            return this.currentCategory;
        }

        this.currentCategory = this.categories.length > 0 ? this.categories[0].id : 'all';
        return this.currentCategory;
    }

    persistCategoryPreference(categoryId) {
        try {
            if (!categoryId || categoryId === 'all') {
                localStorage.removeItem(this.categoryStorageKey);
                return;
            }
            localStorage.setItem(this.categoryStorageKey, categoryId);
        } catch (error) {
            // Ignore localStorage write issues
        }
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
                bases.push(`${protocol}//${hostname}:5051`);
                bases.push('http://localhost:5051');
            } else if (protocol === 'http:') {
                bases.push(`${protocol}//${hostname}:5051`);
            }
        }

        return [...new Set(bases)];
    }

    getApiUrl(path, baseOverride) {
        const base = typeof baseOverride === 'string' ? baseOverride : this.apiBase;
        return base ? `${base}${path}` : path;
    }

    isTokenUsable(token) {
        if (!token || typeof token !== 'string') {
            return false;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            return false;
        }

        try {
            const payload = JSON.parse(atob(parts[1]));
            if (!payload || typeof payload.exp !== 'number') {
                return true;
            }
            return payload.exp * 1000 > Date.now();
        } catch (error) {
            return false;
        }
    }

    async fetchJsonWithFallback(path, options = {}) {
        const candidates = this.getApiBaseCandidates();
        let lastError = null;

        for (const base of candidates) {
            const url = `${base}${path}`;
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    if (response.status === 401 && path === '/api/admin/session') {
                        return { authenticated: false };
                    }
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

    updateStatus(targetId, { message = '', tone = 'muted', spinner = false } = {}) {
        const el = document.getElementById(targetId);
        if (!el) return;

        if (!message) {
            el.innerHTML = '';
            return;
        }

        const spinnerHtml = spinner ? '<span class="status-spinner" aria-hidden="true"></span>' : '';
        const toneClass = tone && tone !== 'muted' ? ` status-${tone}` : '';
        el.innerHTML = `<div class="status-pill${toneClass}">${spinnerHtml}<span>${message}</span></div>`;
    }

    startSlowLoadingTimers(type, baseMessage) {
        this.clearLoadingTimers(type);

        const timers = [];
        timers.push(setTimeout(() => {
            this.updateStatus(`${type}-status`, {
                message: baseMessage || 'Memuat data... mohon tunggu.',
                tone: 'warning',
                spinner: true
            });
        }, this.slowLoadHintMs));

        timers.push(setTimeout(() => {
            this.updateStatus(`${type}-status`, {
                message: 'Proses pemindaian folder masih berjalan. Data besar biasanya butuh waktu lebih lama.',
                tone: 'warning',
                spinner: true
            });
        }, this.longLoadHintMs));

        this.loadingTimers[type] = timers;
        this.loadingStartTimes[type] = Date.now();
    }

    clearLoadingTimers(type) {
        const timers = this.loadingTimers[type] || [];
        timers.forEach(timer => clearTimeout(timer));
        this.loadingTimers[type] = [];
    }

    scheduleStatusClear(type, delayMs = 4000) {
        const timer = this.statusClearTimers[type];
        if (timer) {
            clearTimeout(timer);
        }
        this.statusClearTimers[type] = setTimeout(() => {
            this.statusClearTimers[type] = null;
            this.updateStatus(`${type}-status`, { message: '' });
        }, delayMs);
    }

    showCategoryLoading() {
        const categoryList = document.getElementById('category-list');
        if (!categoryList) return;

        categoryList.setAttribute('aria-busy', 'true');

        const skeletonItems = Array.from({ length: 6 }).map(() => `
            <div class="category-item skeleton-item">
                <div class="category-content w-100">
                    <div class="skeleton-line w-75"></div>
                    <div class="skeleton-line w-25"></div>
                </div>
            </div>
        `).join('');

        categoryList.innerHTML = skeletonItems;
    }
    setupEventListeners() {
        // Category selection - use event delegation to handle clicks on child elements
        document.addEventListener('click', (e) => {
            const categoryItem = e.target.closest('.category-item');
            if (categoryItem) {
                e.preventDefault();
                const categoryId = categoryItem.dataset.category;
                console.log('🎯 Category clicked:', categoryId, 'Element:', categoryItem);
                this.selectCategory(categoryId);
            }
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.applyFilters();
            });
        }

        // Filter dropdown
        const filterType = document.getElementById('filter-type');
        if (filterType) {
            if (filterType.querySelector(`option[value="${this.filterType}"]`)) {
                filterType.value = this.filterType;
            }

            filterType.addEventListener('change', async (e) => {
                await this.handleFilterTypeChange(e.target.value);
            });
        }

        // Sort dropdown
        const sortBy = document.getElementById('sort-by');
        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
            });
        }

        // Upload form
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUpload();
            });
        }

        // File input validation
        const fileInput = document.getElementById('upload-files');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.validateFiles(e.target.files);
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

        // Media modal events
        const mediaModal = document.getElementById('mediaModal');
        if (mediaModal) {
            document.addEventListener('click', (e) => {
                const viewButton = e.target.closest('.btn-view');
                if (!viewButton) {
                    return;
                }

                e.preventDefault();
                const indexRaw = viewButton.dataset.mediaIndex;
                const previewIndex = Number.parseInt(indexRaw, 10);
                if (!Number.isNaN(previewIndex)) {
                    this.openPreview(previewIndex);
                } else {
                    const mediaId = viewButton.dataset.mediaId;
                    if (!mediaId) {
                        return;
                    }
                    this.loadMediaViewer(mediaId);
                }
            });

            mediaModal.addEventListener('shown.bs.modal', () => {
                this.boundPreviewViewportHandler();
                requestAnimationFrame(this.boundPreviewViewportHandler);
            });

            mediaModal.addEventListener('hidden.bs.modal', () => {
                const viewer = document.getElementById('media-viewer');
                const downloadBtn = document.getElementById('download-btn');
                const modalTitle = document.getElementById('mediaModalLabel');
                const modalCounter = document.getElementById('mediaModalCounter');
                // Reset delete button
                const deleteBtn = document.getElementById('delete-btn');
                if(deleteBtn) deleteBtn.style.display = 'none';
                this.currentPreviewIndex = -1;
                this.previewRenderToken += 1;

                if (viewer) viewer.innerHTML = '';
                if (downloadBtn) {
                    downloadBtn.href = '#';
                    downloadBtn.removeAttribute('download');
                    downloadBtn.removeAttribute('target');
                }
                if (modalTitle) modalTitle.textContent = 'Preview Media';
                if (modalCounter) modalCounter.textContent = '';
                this.updatePreviewNavigationState();
                mediaModal.style.removeProperty('--preview-area-height');
                mediaModal.style.removeProperty('--preview-area-width');
            });
        }

        window.addEventListener('resize', this.boundPreviewViewportHandler);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.boundPreviewViewportHandler);
        }

        document.addEventListener('keydown', (e) => this.handlePreviewKeyboard(e));

        this.updatePreviewNavigationState();
        this.updateUploadAccess();
    }

    async updateUploadAccess() {
        const uploadForm = document.getElementById('upload-form');
        if (!uploadForm) return;

        const controls = uploadForm.querySelectorAll('input, select, button');
        const noteId = 'upload-access-note';
        let note = document.getElementById(noteId);

        try {
            // Cek status admin (prioritas: lokal JWT -> server session)
            let isAdmin = false;

            // 1. Cek local user (JWT) - Robust check
            let localUser = null;
            if (typeof window.getUserData === 'function') {
                localUser = window.getUserData();
            }
            if (!localUser && window.currentUser) {
                localUser = window.currentUser;
            }
            if (!localUser) {
                try {
                    const stored = localStorage.getItem('user');
                    if (stored) localUser = JSON.parse(stored);
                } catch (e) {}
            }

            if (localUser && localUser.role) {
                const role = String(localUser.role).toLowerCase();
                if (role.includes('admin') || role.includes('super')) {
                    isAdmin = true;
                    console.log('✅ Admin access detected (Local JWT):', role);
                }
            }

            const token = localStorage.getItem('token');
            const hasUsableToken = this.isTokenUsable(token);

            // Update class property and UI if admin status changed
            if (isAdmin && !this.isAdmin) {
                this.isAdmin = true;
                if (this.mediaData.length > 0) {
                    this.renderMediaGrid(); // Re-render to show admin controls
                }
            }

            // 2. Jika admin lokal terdeteksi, pastikan sesi server aktif (Bridge JWT -> Session)
            if (isAdmin && hasUsableToken) {
                try {
                    // Cek apakah sesi server sudah aktif
                    const sessionData = await this.fetchJsonWithFallback('/api/admin/session', { credentials: 'include' });
                    
                    if (!sessionData || !sessionData.authenticated) {
                        console.log('🔄 Local admin found but server session missing. Attempting bridge...');
                        if (token) {
                            // Panggil endpoint bridge untuk menukar JWT dengan Session Cookie
                            const bridgeResponse = await fetch(this.getApiUrl('/api/admin/session/bridge'), {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                credentials: 'include' // Penting: agar cookie connect.sid tersimpan
                            });
                            
                            if (bridgeResponse.ok) {
                                console.log('✅ Server session established via bridge');
                            } else {
                                console.warn('⚠️ Failed to bridge session:', bridgeResponse.status);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Session check/bridge failed (non-fatal):', e);
                }
            }

            // 3. Cek server session (Cookie) jika belum terdeteksi sebagai admin lokal
            // Hindari request yang tidak perlu saat guest (mengurangi 401 di console).
            if (!isAdmin && hasUsableToken) {
                try {
                    const data = await this.fetchJsonWithFallback('/api/admin/session', { credentials: 'include' });
                    if (data && data.authenticated) {
                        isAdmin = true;
                        console.log('✅ Admin access detected (Server Session)');
                    }
                } catch (sessionErr) {
                    console.warn('⚠️ Server session check failed (non-fatal if local admin exists):', sessionErr);
                }
            }

            controls.forEach(control => {
                control.disabled = !isAdmin;
            });

            if (!isAdmin) {
                if (!note) {
                    note = document.createElement('div');
                    note.id = noteId;
                    note.className = 'alert alert-warning mt-3';
                    note.textContent = 'Upload hanya tersedia untuk admin. Silakan login sebagai admin.';
                    uploadForm.appendChild(note);
                }
            } else if (note) {
                note.remove();
            }
        } catch (error) {
            controls.forEach(control => {
                control.disabled = true;
            });

            if (!note) {
                note = document.createElement('div');
                note.id = noteId;
                note.className = 'alert alert-warning mt-3';
                note.textContent = 'Status admin tidak bisa dicek. Silakan refresh atau login kembali.';
                uploadForm.appendChild(note);
            }
        }
    }

    async loadCategories(options = {}) {
        const preloadSelectedOnly = options && options.preloadSelectedOnly === true;

        if (!this.categories || this.categories.length === 0) {
            this.showCategoryLoading();
        }
        this.updateStatus('category-status', {
            message: 'Memuat kategori...',
            tone: 'info',
            spinner: true
        });
        this.startSlowLoadingTimers('category', 'Memuat kategori... mohon tunggu.');

        try {
            console.log('📂 Loading categories...');
            const data = await this.fetchJsonWithFallback('/api/bim-methode/categories');

            if (data.success) {
                this.categories = data.categories || [];
                const selectedCategory = this.resolveInitialCategory();
                this.renderCategories();
                this.updateUploadCategories();

                if (preloadSelectedOnly) {
                    await this.loadMedia(selectedCategory, 1, { forceClear: true });
                }

                if (data.refreshing) {
                    if (this.categories.length > 0) {
                        this.updateStatus('category-status', {
                            message: 'Menampilkan data cache kategori. Sinkronisasi berjalan di latar belakang.',
                            tone: 'info',
                            spinner: false
                        });
                        this.scheduleStatusClear('category', 5000);
                    } else {
                        this.updateStatus('category-status', {
                            message: 'Server sedang memperbarui cache kategori...',
                            tone: 'warning',
                            spinner: true
                        });
                    }
                } else {
                    this.updateStatus('category-status', { message: '' });
                }

                if (data.refreshing && this.categories.length === 0) {
                    this.scheduleRetry(() => this.loadCategories(options), 'categories');
                }
            } else {
                throw new Error(data.message || 'Failed to load categories');
            }
        } catch (error) {
            console.error('❌ Error loading categories:', error);
            this.showError('Gagal memuat kategori: ' + error.message);
            this.updateStatus('category-status', {
                message: 'Gagal memuat kategori. Silakan refresh halaman.',
                tone: 'error'
            });
        } finally {
            this.clearLoadingTimers('category');
            const categoryList = document.getElementById('category-list');
            if (categoryList) {
                categoryList.setAttribute('aria-busy', 'false');
            }
        }
    }

    async loadMedia(category = 'all', page = 1, options = {}) {
        const forceClear = options && options.forceClear;
        const shouldClearGrid = forceClear || this.mediaData.length === 0;

        this.updateStatus('media-status', {
            message: 'Memuat media...',
            tone: 'info',
            spinner: true
        });
        this.startSlowLoadingTimers('media', 'Memuat media... mohon tunggu.');

        try {
            console.log(`📄 Loading media for category: ${category}, page: ${page}`);
            if (shouldClearGrid) {
                this.showLoading();
            }

            const params = new URLSearchParams();
            if (category !== 'all') {
                params.set('category', category);
            }
            const serverType = this.getServerTypeFilter();
            if (serverType !== 'all') {
                params.set('type', serverType);
            }

            const queryString = params.toString();
            let url = '/api/bim-methode/media';
            if (queryString) {
                url += `?${queryString}`;
            }
            console.log(`🔍 Fetching URL: ${url}`);

            const data = await this.fetchJsonWithFallback(url);
            console.log(`📊 Media API response for category "${category}":`, {
                success: data.success,
                totalCount: data.totalCount,
                mediaCount: data.media ? data.media.length : 0
            });

            if (data.success) {
                this.mediaData = data.media || [];
                console.log(`✅ Loaded ${this.mediaData.length} media items for category "${category}"`);
                this.applyFilters();

                if (data.refreshing) {
                    if (this.mediaData.length > 0) {
                        this.updateStatus('media-status', {
                            message: 'Menampilkan data cache media. Sinkronisasi berjalan di latar belakang.',
                            tone: 'info',
                            spinner: false
                        });
                        this.scheduleStatusClear('media', 5000);
                    } else {
                        this.updateStatus('media-status', {
                            message: 'Server sedang memperbarui cache media...',
                            tone: 'warning',
                            spinner: true
                        });
                    }
                } else {
                    this.updateStatus('media-status', { message: '' });
                }

                if (data.refreshing && this.mediaData.length === 0) {
                    this.scheduleRetry(() => this.loadMedia(category, page), 'media');
                }
            } else {
                throw new Error(data.message || 'Failed to load media');
            }
        } catch (error) {
            console.error('❌ Error loading media:', error);
            this.showError('Gagal memuat media: ' + error.message);
            this.updateStatus('media-status', {
                message: 'Gagal memuat media. Silakan refresh halaman.',
                tone: 'error'
            });
        } finally {
            this.clearLoadingTimers('media');
            this.hideLoading();
        }
    }

    scheduleRetry(action, label) {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
        console.warn(`⏳ Cache refresh in progress, retrying ${label} in ${this.retryDelayMs}ms...`);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            action();
        }, this.retryDelayMs);
    }

    normalizeFilterType(value) {
        const allowedTypes = new Set(['all', 'image', 'video', 'document', 'model']);
        const normalized = String(value || '').toLowerCase();
        return allowedTypes.has(normalized) ? normalized : 'image';
    }

    getServerTypeFilter() {
        return this.normalizeFilterType(this.filterType);
    }

    async handleFilterTypeChange(nextType) {
        const normalizedType = this.normalizeFilterType(nextType);
        if (normalizedType === this.filterType) {
            return;
        }

        this.filterType = normalizedType;
        this.currentPage = 1;
        await this.loadMedia(this.currentCategory || 'all', 1, { forceClear: true });
    }

    renderCategories() {
        const categoryList = document.getElementById('category-list');
        if (!categoryList) return;

        let html = `
            <a href="#" class="category-item ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all">
                <div class="category-content">
                    <span class="category-name">Semua Kategori</span>
                    <span class="category-count">Total: ${this.categories.reduce((sum, cat) => sum + (cat.mediaCount || 0), 0)}</span>
                </div>
            </a>
        `;

        this.categories.forEach(category => {
            const categoryNumber = category.number || 0;
            const categoryText = category.name || category.id.replace(/^\d+\.\s*/, '');

            html += `
                <a href="#" class="category-item ${this.currentCategory === category.id ? 'active' : ''}" data-category="${category.id}">
                    <div class="category-content">
                        <span class="category-name">${categoryNumber}. ${categoryText}</span>
                        <span class="category-count">${category.mediaCount || 0} file</span>
                    </div>
                </a>
            `;
        });

        categoryList.innerHTML = html;
        categoryList.setAttribute('aria-busy', 'false');
    }

    selectCategory(categoryId) {
        console.log(`🎯 Selecting category: ${categoryId}`);
        if (!categoryId) return;
        this.currentCategory = categoryId;
        this.currentPage = 1;
        this.persistCategoryPreference(categoryId);
        this.renderCategories();
        this.loadMedia(categoryId, 1, { forceClear: true });
    }

    applyFilters() {
        let filtered = [...this.mediaData];

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(item =>
                (item.name || '').toLowerCase().includes(this.searchQuery) ||
                (item.category || '').toLowerCase().includes(this.searchQuery)
            );
        }

        // Apply type filter (support grouped types)
        if (this.filterType !== 'all') {
            const documentTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
            const modelTypes = ['dwg', 'dxf', 'rvt', 'rfa', 'skp', 'fbx', 'tm'];

            filtered = filtered.filter(item => {
                if (this.filterType === 'document') {
                    return documentTypes.includes(item.type);
                }
                if (this.filterType === 'model') {
                    return modelTypes.includes(item.type);
                }
                return item.type === this.filterType;
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'date-desc':
                    return new Date(b.modified) - new Date(a.modified);
                case 'date-asc':
                    return new Date(a.modified) - new Date(b.modified);
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'size-desc':
                    return b.size - a.size;
                case 'size-asc':
                    return a.size - b.size;
                default:
                    return 0;
            }
        });

        this.filteredData = filtered;
        this.renderMediaGrid();
        this.renderPagination();
    }

    renderMediaGrid() {
        const mediaGrid = document.getElementById('media-grid');
        if (!mediaGrid) return;

        console.log(`🎨 Rendering media grid: ${this.filteredData.length} items from ${this.mediaData.length} total media`);

        if (this.filteredData.length === 0) {
            const hasMediaData = this.mediaData.length > 0;
            const currentCategory = this.currentCategory;
            const searchActive = this.searchQuery.length > 0;
            const filterActive = this.filterType !== 'all';

            let emptyMessage = 'Tidak ada media ditemukan';
            let emptyDescription = 'Coba ubah kriteria pencarian atau filter';

            if (!hasMediaData && currentCategory !== 'all') {
                emptyMessage = `Tidak ada media dalam kategori "${currentCategory}"`;
                emptyDescription = 'Pilih kategori lain atau pilih "Semua Kategori"';
            } else if (!hasMediaData) {
                emptyMessage = 'Belum ada media yang dimuat';
                emptyDescription = 'Sedang memuat data media...';
            } else if (searchActive) {
                emptyDescription = `Tidak ada media yang cocok dengan pencarian "${this.searchQuery}"`;
            } else if (filterActive) {
                emptyDescription = `Tidak ada media dengan tipe "${this.filterType}"`;
            }

            mediaGrid.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <h5>${emptyMessage}</h5>
                        <p>${emptyDescription}</p>
                        <div class="mt-3">
                            <small class="text-muted">
                                Kategori: ${currentCategory} |
                                Total media: ${this.mediaData.length} |
                                Difilter: ${this.filteredData.length}
                            </small>
                        </div>
                    </div>
                </div>
            `;
            mediaGrid.setAttribute('aria-busy', 'false');
            return;
        }

        // Pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        let html = '';
        pageData.forEach((item, pageOffset) => {
            html += this.createMediaCard(item, startIndex + pageOffset);
        });

        mediaGrid.innerHTML = html;
        mediaGrid.setAttribute('aria-busy', 'false');
        this.bindThumbnailCacheHandlers();
    }

    createMediaCard(item, mediaIndex = -1) {
        const thumbnail = this.getThumbnail(item);
        const fileIcon = this.getFileIcon(item.type);
        const sizeText = this.formatFileSize(item.size);
        const dateText = new Date(item.modified).toLocaleDateString('id-ID');
        const downloadInfo = this.getDownloadInfo(item);
        const downloadUrl = downloadInfo.url;
        const downloadAttr = downloadInfo.filename
            ? `download="${downloadInfo.filename}"`
            : 'download';

        return `
            <div class="col-lg-4 col-md-6 col-sm-12 col-xl-3 col-xxl-2">
                <div class="media-card">
                    <div class="media-thumbnail">
                        ${thumbnail}
                        <div class="media-type-icon">${fileIcon}</div>
                    </div>
                    <div class="media-info">
                        <div class="media-title">${item.name}</div>
                        <div class="media-meta">
                            <small>${sizeText} • ${dateText}</small>
                        </div>
                        <div class="media-actions">
                            <a href="#" class="btn-media-action btn-view" data-media-id="${item.id}" data-media-index="${mediaIndex}">
                                <i class="fas fa-eye"></i> Preview
                            </a>
                            <a href="${downloadUrl}" class="btn-media-action btn-download" target="_blank" ${downloadAttr}>
                                <i class="fas fa-download"></i> Download
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getThumbnail(item) {
        if (item.type === 'image') {
            const remoteThumbUrl = this.getApiUrl(`/api/bim-methode/thumbnail/${item.id}?w=480&q=65`);
            const cachedThumbUrl = this.getCachedThumbnail(item.id);
            const initialThumbUrl = cachedThumbUrl || remoteThumbUrl;
            return `
                <img class="bim-thumb" src="${initialThumbUrl}" alt="${item.name}" loading="lazy"
                    data-thumb-id="${item.id}" data-thumb-remote="${remoteThumbUrl}"
                    onerror="if(this.dataset.thumbRemote && this.src !== this.dataset.thumbRemote){ this.src = this.dataset.thumbRemote; return; } this.style.display='none'; this.nextElementSibling.classList.remove('is-hidden');">
                ${this.buildFileThumb(item, { hidden: true })}
            `;
        }

        return this.buildFileThumb(item);
    }

    getFileTypeMeta(type) {
        const normalizedType = String(type || '').toLowerCase();
        const map = {
            image: { theme: 'image', icon: 'fas fa-image', iconImage: '/img/icons/image-icon.png', badge: 'IMG', caption: 'Image' },
            video: { theme: 'video', icon: 'fas fa-video', iconImage: '/img/icons/video-icon2.png', badge: 'VID', caption: 'Video' },
            pdf: { theme: 'pdf', icon: 'fas fa-file-pdf', iconImage: '/img/icons/pdf-icon.png', badge: 'PDF', caption: 'PDF Document' },
            doc: { theme: 'doc', icon: 'fas fa-file-word', iconImage: '/img/icons/doc-icon.png', badge: 'DOC', caption: 'Word Document' },
            docx: { theme: 'doc', icon: 'fas fa-file-word', iconImage: '/img/icons/doc-icon.png', badge: 'DOCX', caption: 'Word Document' },
            ppt: { theme: 'ppt', icon: 'fas fa-file-powerpoint', iconImage: '/img/icons/ppt-icon.png', badge: 'PPT', caption: 'Presentation' },
            pptx: { theme: 'ppt', icon: 'fas fa-file-powerpoint', iconImage: '/img/icons/ppt-icon.png', badge: 'PPTX', caption: 'Presentation' },
            xls: { theme: 'xls', icon: 'fas fa-file-excel', iconImage: '/img/icons/excel-icon.png', badge: 'XLS', caption: 'Spreadsheet' },
            xlsx: { theme: 'xls', icon: 'fas fa-file-excel', iconImage: '/img/icons/excel-icon.png', badge: 'XLSX', caption: 'Spreadsheet' },
            dwg: { theme: 'cad', icon: 'fas fa-drafting-compass', iconImage: '/img/icons/dwg-icon.png', badge: 'DWG', caption: 'AutoCAD Drawing' },
            dxf: { theme: 'cad', icon: 'fas fa-vector-square', iconImage: '/img/icons/dwg-icon.png', badge: 'DXF', caption: 'CAD Drawing' },
            rvt: { theme: 'bim', icon: 'fas fa-cubes', iconImage: '/img/icons/revit-icon.png', badge: 'RVT', caption: 'Revit Model' },
            rfa: { theme: 'bim', icon: 'fas fa-cube', iconImage: '/img/icons/revit-icon.png', badge: 'RFA', caption: 'Revit Family' },
            skp: { theme: 'model', icon: 'fas fa-shapes', iconImage: '/img/icons/project-icon.png', badge: 'SKP', caption: 'SketchUp Model' },
            fbx: { theme: 'model', icon: 'fas fa-cube', iconImage: '/img/icons/fbx_icon.png', badge: 'FBX', caption: '3D Model' },
            tm: { theme: 'model', icon: 'fas fa-layer-group', iconImage: '/img/icons/twinmotion_icon_logo.png', badge: 'TM', caption: 'Twinmotion File' },
            txt: { theme: 'default', icon: 'fas fa-file-alt', iconImage: '/img/icons/txt-icon.png', badge: 'TXT', caption: 'Text Document' },
            zip: { theme: 'default', icon: 'fas fa-file-archive', iconImage: '/img/icons/zip-icon.png', badge: 'ZIP', caption: 'Archive File' }
        };

        return map[normalizedType] || {
            theme: 'default',
            icon: 'fas fa-file-alt',
            iconImage: '/img/icons/folder-icon.png',
            badge: normalizedType ? normalizedType.toUpperCase() : 'FILE',
            caption: 'Document'
        };
    }

    buildFileThumb(item, options = {}) {
        const { hidden = false } = options;
        const meta = this.getFileTypeMeta(item ? item.type : '');
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

    getMediaUrl(item, options = {}) {
        const base = this.getApiUrl(`/api/bim-methode/file?id=${encodeURIComponent(item.id)}`);
        if (options.download) {
            return `${base}&download=1`;
        }
        return base;
    }

    isWatermarkSupported(item) {
        return item && (item.type === 'image' || item.type === 'video');
    }

    getWatermarkUrl(item) {
        let base = this.apiBase || window.location.origin || '';
        if (base === 'null') {
            base = '';
        }
        base = base.replace(/\/$/, '');
        const id = item && item.id ? item.id : '';
        return `${base}/api/watermark?id=${encodeURIComponent(id)}`;
    }

    getWatermarkFilename(item) {
        const name = item && item.name ? item.name : 'media';
        const lastDot = name.lastIndexOf('.');
        const baseName = lastDot > 0 ? name.slice(0, lastDot) : name;

        if (item && item.type === 'video') {
            return `${baseName}-wm.mp4`;
        }

        const ext = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : '';
        const outputExt = ext === 'png' ? 'png' : 'jpg';
        return `${baseName}-wm.${outputExt}`;
    }

    getDownloadInfo(item) {
        if (this.isWatermarkSupported(item)) {
            return {
                url: this.getWatermarkUrl(item),
                filename: this.getWatermarkFilename(item)
            };
        }
        return {
            url: this.getMediaUrl(item, { download: true }),
            filename: item && item.name ? item.name : null
        };
    }

    getFileIcon(type) {
        return this.getFileTypeMeta(type).badge;
    }

    getFileIconClass(type) {
        return this.getFileTypeMeta(type).icon;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    renderPagination() {
        const paginationContainer = document.getElementById('pagination-container');
        const pagination = document.getElementById('pagination');

        if (!paginationContainer || !pagination) return;

        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);

        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'block';

        let html = '';

        // Previous button
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage - 1}">‹</a>
        </li>`;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        }

        // Next button
        html += `<li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage + 1}">›</a>
        </li>`;

        pagination.innerHTML = html;

        // Add pagination click handlers
        pagination.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.classList.contains('page-link')) {
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage && page >= 1 && page <= totalPages) {
                    this.currentPage = page;
                    this.renderMediaGrid();
                    this.renderPagination();
                }
            }
        });
    }

    updateUploadCategories() {
        const uploadCategory = document.getElementById('upload-category');
        if (!uploadCategory) return;

        console.log('📋 Updating upload categories with data:', this.categories);

        let html = '<option value="">Pilih kategori...</option>';
        
        // Sort categories for better UX
        const sortedCategories = [...this.categories].sort((a, b) => {
            if (a.number && b.number) return a.number - b.number;
            const nameA = a.name || a.id || '';
            const nameB = b.name || b.id || '';
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });

        sortedCategories.forEach(category => {
            // Use category.id (which includes number like "1. PAGAR PROYEK") as value
            // Display as "1. PAGAR PROYEK" in dropdown for consistency
            const displayText = category.name ? `${category.number || ''}${category.number ? '. ' : ''}${category.name}`.trim() : category.id;
            const value = category.id; // This should be like "1. PAGAR PROYEK"

            console.log(`📍 Category option: "${displayText}" -> value: "${value}"`);

            html += `<option value="${value}">${displayText}</option>`;
        });

        uploadCategory.innerHTML = html;
        console.log('✅ Upload categories updated');
    }

    validateFiles(files) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        
        // Daftar ekstensi yang diperbolehkan
        const allowedExtensions = [
            // Images
            '.jpg', '.jpeg', '.png', '.gif',
            // Video
            '.mp4',
            // Documents
            '.pdf', '.docx', '.pptx',
            // CAD/BIM/3D
            '.rfa', '.rvt', '.dwg', '.skp', '.fbx', '.tm'
        ];

        let validFiles = [];
        let errors = [];

        Array.from(files).forEach(file => {
            if (file.size > maxSize) {
                errors.push(`${file.name}: Ukuran file terlalu besar (maksimal 50MB)`);
            } else {
                const fileName = file.name.toLowerCase();
                
                // Validasi berdasarkan ekstensi (lebih akurat untuk file CAD/BIM)
                const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

                if (!hasAllowedExtension) {
                    // Cek MIME type sebagai fallback untuk tipe umum
                    const allowedMimes = [
                        'image/jpeg', 'image/png', 'image/gif', 
                        'video/mp4', 'application/pdf',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                    ];
                    
                    if (file.type && allowedMimes.includes(file.type)) {
                        validFiles.push(file);
                    } else {
                        errors.push(`${file.name}: Tipe file tidak didukung`);
                    }
                } else {
                    validFiles.push(file);
                }
            }
        });

        if (errors.length > 0) {
            this.showError('Error validasi file:\n' + errors.join('\n'));
        }

        return validFiles;
    }

    async handleDelete(mediaId) {
        if (!confirm('Apakah Anda yakin ingin menghapus file ini? Tindakan ini tidak dapat dibatalkan.')) {
            return;
        }

        try {
            // Prepare Authorization header
            const headers = {};
            const token = localStorage.getItem('token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Construct Delete URL (using ID)
            const deleteUrl = this.getApiUrl(`/api/bim-methode/file?id=${encodeURIComponent(mediaId)}`);

            console.log('🗑️ Deleting media:', deleteUrl);

            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: headers,
                credentials: 'include'
            });

            if (!response.ok) {
                // Handle specific errors
                if (response.status === 404) throw new Error('File tidak ditemukan di server (404)');
                if (response.status === 403) throw new Error('Akses ditolak (403)');
                if (response.status === 401) throw new Error('Sesi admin tidak valid (401)');
                if (response.status === 405) throw new Error('Fitur hapus belum didukung oleh server (405)');
                
                throw new Error(`Gagal menghapus file (HTTP ${response.status})`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Close preview modal if open
                const modalId = 'mediaModal';
                const modalEl = document.getElementById(modalId);
                if (modalEl) {
                    const bsModal = bootstrap.Modal.getInstance(modalEl);
                    if (bsModal) bsModal.hide();
                }
                
                this.showSuccess('File berhasil dihapus!');
                // Refresh list
                this.loadMedia(this.currentCategory);
                this.loadCategories(); // Update counts
            } else {
                throw new Error(data.message || 'Gagal menghapus file');
            }

        } catch (error) {
            console.error('❌ Delete error:', error);
            this.showError(`Gagal menghapus file: ${error.message}`);
        }
    }

    async handleUpload() {
        const formData = new FormData(document.getElementById('upload-form'));
        const files = formData.getAll('files');
        const category = formData.get('category');

        console.log('🚀 BIM Methode Upload Debug:');
        console.log('  - Category from form:', category);
        console.log('  - Files count:', files.length);
        console.log('  - Files details:', files.map(f => `${f.name} (${f.size} bytes)`));

        // Check admin session first
        try {
            console.log('🔍 Checking admin session...');
            let isAdmin = false;

            // 1. Cek local user (JWT) - Robust check
            let localUser = null;
            if (typeof window.getUserData === 'function') {
                localUser = window.getUserData();
            }
            if (!localUser && window.currentUser) {
                localUser = window.currentUser;
            }
            if (!localUser) {
                try {
                    const stored = localStorage.getItem('user');
                    if (stored) localUser = JSON.parse(stored);
                } catch (e) {}
            }

            if (localUser && localUser.role) {
                const role = String(localUser.role).toLowerCase();
                if (role.includes('admin') || role.includes('super')) {
                    isAdmin = true;
                    console.log('✅ Admin access validated (Local JWT):', role);
                }
            }

            const token = localStorage.getItem('token');
            const hasUsableToken = this.isTokenUsable(token);

            // 2. Pastikan sesi server aktif jika admin lokal (Bridge JWT -> Session)
            if (isAdmin && hasUsableToken) {
                try {
                    const sessionData = await this.fetchJsonWithFallback('/api/admin/session', { credentials: 'include' });
                    if (!sessionData || !sessionData.authenticated) {
                        console.log('🔄 Bridging session for upload...');
                        if (token) {
                            await fetch(this.getApiUrl('/api/admin/session/bridge'), {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` },
                                credentials: 'include'
                            });
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Session bridge warning:', e);
                }
            }

            // 3. Cek server session (fallback jika lokal gagal)
            // Hindari request yang tidak perlu saat guest (mengurangi 401 di console).
            if (!isAdmin && hasUsableToken) {
                try {
                    const sessionData = await this.fetchJsonWithFallback('/api/admin/session', { credentials: 'include' });
                    if (sessionData && sessionData.authenticated) {
                        isAdmin = true;
                        console.log('✅ Admin access validated (Server Session)');
                    }
                } catch (e) {
                    console.warn('⚠️ Server session check failed:', e);
                }
            }

            if (!isAdmin) {
                this.showError('❌ ERROR: Anda harus login sebagai admin untuk upload!\n\nSilakan login ke admin dashboard terlebih dahulu.');
                return;
            }
        } catch (error) {
            console.error('❌ Session validation error:', error);
            this.showError('❌ ERROR: Gagal memvalidasi sesi admin.\n\nSilakan coba lagi atau login ulang.');
            return;
        }

        if (!category) {
            this.showError('❌ ERROR: Pilih kategori terlebih dahulu!');
            return;
        }

        if (files.length === 0) {
            this.showError('❌ ERROR: Pilih file untuk diupload!');
            return;
        }

        const validFiles = this.validateFiles(files);
        if (validFiles.length === 0) {
            console.error('❌ No valid files after validation');
            return;
        }

        console.log('✅ Pre-upload validation passed, starting upload...');

        try {
            this.showUploadProgress();

            const uploadFormData = new FormData();
            validFiles.forEach(file => uploadFormData.append('files', file));
            uploadFormData.append('category', category.trim());

            console.log('📤 Sending upload request to /api/bim-methode/upload');
            console.log('📋 Upload FormData contents:');
            for (let [key, value] of uploadFormData.entries()) {
                if (key === 'files') {
                    console.log(`  - ${key}: ${value.name} (${value.size} bytes, ${value.type})`);
                } else {
                    console.log(`  - ${key}: "${value}"`);
                }
            }

            console.log('🚀 SENDING REQUEST TO: /api/bim-methode/upload');
            console.log('📡 Request method: POST');
            console.log('🔑 Credentials: include');

            // Tambahkan Authorization header jika ada token (untuk support JWT auth)
            const headers = {};
            const token = localStorage.getItem('token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔐 Adding Authorization header');
            }

            // Tambahkan category ke header dan URL sebagai fallback (agar terbaca sebelum multer)
            headers['x-category'] = category.trim();
            const uploadUrl = this.getApiUrl(`/api/bim-methode/upload?category=${encodeURIComponent(category.trim())}`);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: headers,
                body: uploadFormData,
                credentials: 'include' // Gunakan include agar cookie terkirim cross-port/origin jika perlu
            });

            console.log('📨 RESPONSE RECEIVED:');
            console.log('  Status:', response.status);
            console.log('  StatusText:', response.statusText);
            console.log('  OK:', response.ok);
            console.log('  URL:', response.url);

            if (!response.ok) {
                // Try to get detailed error message
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('❌ Server error details:', errorData);
                    errorMessage += ` - ${errorData.error || errorData.message || 'Unknown error'}`;
                    if (errorData.details) {
                        errorMessage += ` (${errorData.details})`;
                    }
                } catch (parseError) {
                    console.error('❌ Could not parse error response');
                    // Try to get text response
                    try {
                        const textResponse = await response.text();
                        console.error('❌ Raw error response:', textResponse);
                        if (textResponse) {
                            errorMessage += ` - ${textResponse.substring(0, 200)}`;
                        }
                    } catch (textError) {
                        console.error('❌ Could not get text error response either');
                    }
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('✅ Upload response data:', data);

            if (data.success) {
                const successMessage = data.message || `Upload berhasil! ${data.totalFiles || validFiles.length} file telah ditambahkan ke kategori ${data.categoryName || category}.`;
                this.showSuccess(successMessage);
                document.getElementById('upload-form').reset();
                this.loadMedia(this.currentCategory); // Reload current category
                this.loadCategories(); // Update category counts
            } else {
                throw new Error(data.message || data.error || 'Upload gagal - response tidak valid');
            }
        } catch (error) {
            console.error('❌ Upload error:', error);
            this.showError('❌ UPLOAD GAGAL:\n\n' + error.message + '\n\nPeriksa log browser untuk detail lebih lanjut.');
        } finally {
            this.hideUploadProgress();
        }
    }

    getPreviewDataList() {
        if (Array.isArray(this.filteredData) && this.filteredData.length > 0) {
            return this.filteredData;
        }
        return Array.isArray(this.mediaData) ? this.mediaData : [];
    }

    loadMediaViewer(mediaId) {
        const previewList = this.getPreviewDataList();
        const previewIndex = previewList.findIndex(item => item.id === mediaId);
        if (previewIndex < 0) {
            return false;
        }
        return this.openPreview(previewIndex);
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

    getThumbStorageKey(mediaId) {
        return `${this.thumbStoragePrefix}${mediaId}`;
    }

    getThumbStorageIndex() {
        try {
            const raw = localStorage.getItem(this.thumbStorageIndexKey);
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .filter(entry => entry && typeof entry.id === 'string')
                .map(entry => ({
                    id: entry.id,
                    ts: Number(entry.ts) || 0
                }))
                .sort((a, b) => b.ts - a.ts);
        } catch (error) {
            return [];
        }
    }

    saveThumbStorageIndex(index) {
        try {
            localStorage.setItem(this.thumbStorageIndexKey, JSON.stringify(index));
        } catch (error) {
            // Ignore localStorage write errors
        }
    }

    trimThumbStorage(index, maxItems) {
        const keep = Math.max(0, maxItems);
        const sorted = [...index].sort((a, b) => b.ts - a.ts);
        const kept = sorted.slice(0, keep);
        const removed = sorted.slice(keep);

        removed.forEach(entry => {
            try {
                localStorage.removeItem(this.getThumbStorageKey(entry.id));
            } catch (error) {
                // Ignore localStorage remove errors
            }
        });

        return kept;
    }

    getCachedThumbnail(mediaId) {
        if (!mediaId) return null;

        const key = this.getThumbStorageKey(mediaId);
        let value = null;
        try {
            value = localStorage.getItem(key);
        } catch (error) {
            return null;
        }

        if (!value || !value.startsWith('data:image/')) {
            return null;
        }

        const now = Date.now();
        const index = this.getThumbStorageIndex().filter(entry => entry.id !== mediaId);
        index.unshift({ id: mediaId, ts: now });
        const trimmed = this.trimThumbStorage(index, this.thumbStorageMaxItems);
        this.saveThumbStorageIndex(trimmed);
        return value;
    }

    storeThumbnailInLocalCache(mediaId, dataUrl) {
        if (!mediaId || !dataUrl || !dataUrl.startsWith('data:image/')) return;
        if (dataUrl.length > this.thumbStorageMaxChars) return;

        const key = this.getThumbStorageKey(mediaId);
        let index = this.getThumbStorageIndex();

        const saveData = () => {
            localStorage.setItem(key, dataUrl);
        };

        try {
            saveData();
        } catch (error) {
            // Likely quota exceeded: trim aggressively and retry once.
            index = this.trimThumbStorage(index, Math.max(10, this.thumbStorageMaxItems - 20));
            this.saveThumbStorageIndex(index);
            try {
                saveData();
            } catch (retryError) {
                return;
            }
        }

        const now = Date.now();
        index = index.filter(entry => entry.id !== mediaId);
        index.unshift({ id: mediaId, ts: now });
        const trimmed = this.trimThumbStorage(index, this.thumbStorageMaxItems);
        this.saveThumbStorageIndex(trimmed);
    }

    bindThumbnailCacheHandlers() {
        const thumbs = document.querySelectorAll('#media-grid img.bim-thumb[data-thumb-id]');
        thumbs.forEach(img => {
            if (img.dataset.thumbBound === '1') {
                return;
            }

            img.dataset.thumbBound = '1';
            img.addEventListener('load', () => this.handleThumbnailLoaded(img));
        });
    }

    handleThumbnailLoaded(imgElement) {
        if (!imgElement) return;
        const mediaId = imgElement.dataset.thumbId;
        if (!mediaId) return;

        const currentSrc = imgElement.currentSrc || imgElement.src || '';
        if (!currentSrc || currentSrc.startsWith('data:image/')) {
            return;
        }

        this.persistThumbnailFromImage(imgElement, mediaId);
    }

    persistThumbnailFromImage(imgElement, mediaId) {
        try {
            if (!imgElement.complete || !imgElement.naturalWidth || !imgElement.naturalHeight) {
                return;
            }

            const maxEdge = 240;
            const maxSide = Math.max(imgElement.naturalWidth, imgElement.naturalHeight);
            const scale = maxSide > maxEdge ? (maxEdge / maxSide) : 1;
            const width = Math.max(1, Math.round(imgElement.naturalWidth * scale));
            const height = Math.max(1, Math.round(imgElement.naturalHeight * scale));

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(imgElement, 0, 0, width, height);

            let dataUrl = '';
            try {
                dataUrl = canvas.toDataURL('image/webp', 0.62);
            } catch (error) {
                dataUrl = canvas.toDataURL('image/jpeg', 0.68);
            }

            this.storeThumbnailInLocalCache(mediaId, dataUrl);
        } catch (error) {
            // Ignore canvas/security/localStorage issues.
        }
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    renderPreview(index) {
        try {
            const previewList = this.getPreviewDataList();
            const media = previewList[index];

            if (!media) {
                return false;
            }

            const viewer = document.getElementById('media-viewer');
            const downloadBtn = document.getElementById('download-btn');
            const deleteBtn = document.getElementById('delete-btn'); // Admin delete button
            const modalTitle = document.getElementById('mediaModalLabel');
            const modalCounter = document.getElementById('mediaModalCounter');
            const mediaUrl = this.getMediaUrl(media);
            const downloadInfo = this.getDownloadInfo(media);

            if (!viewer || !downloadBtn || !modalTitle) {
                return false;
            }
            this.currentPreviewIndex = index;
            const previewToken = ++this.previewRenderToken;
            this.updatePreviewViewportConstraints();
            const isActivePreview = () => previewToken === this.previewRenderToken && this.currentPreviewIndex === index;

            // Update modal title
            modalTitle.textContent = media.name;
            if (modalCounter) {
                modalCounter.textContent = `${index + 1} / ${previewList.length}`;
            }

            // Update download link
            downloadBtn.href = downloadInfo.url;
            downloadBtn.removeAttribute('target');
            if (downloadInfo.filename) {
                downloadBtn.setAttribute('download', downloadInfo.filename);
            } else {
                downloadBtn.removeAttribute('download');
            }

            // Show/Hide Delete Button
            if (deleteBtn) {
                if (this.isAdmin) {
                    deleteBtn.style.display = 'block';
                    // Reset listener using clone
                    const newDeleteBtn = deleteBtn.cloneNode(true);
                    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                    
                    newDeleteBtn.addEventListener('click', () => {
                        this.handleDelete(media.id);
                    });
                } else {
                    deleteBtn.style.display = 'none';
                }
            }

            // Render media content
            if (media.type === 'image') {
                const imgElement = document.createElement('img');
                imgElement.src = mediaUrl;
                imgElement.alt = media.name || 'image';
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

                viewer.innerHTML = '';
                viewer.appendChild(imgElement);
            } else if (media.type === 'video') {
                const videoElement = document.createElement('video');
                videoElement.className = 'media-full-view';
                videoElement.controls = true;
                videoElement.autoplay = true;
                videoElement.preload = 'metadata';
                videoElement.playsInline = true;
                const sourceElement = document.createElement('source');
                sourceElement.src = mediaUrl;
                sourceElement.type = media.mimeType || 'video/mp4';
                videoElement.appendChild(sourceElement);
                videoElement.appendChild(document.createTextNode('Browser tidak mendukung pemutaran video.'));

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

                viewer.innerHTML = '';
                viewer.appendChild(videoElement);
            } else if (media.type === 'pdf') {
                viewer.innerHTML = `<iframe src="${mediaUrl}" class="pdf-viewer" title="${media.name}"></iframe>`;
            } else {
                viewer.innerHTML = `
                    <div class="text-center file-preview-placeholder">
                        <i class="${this.getFileIconClass(media.type)} fa-3x mb-3"></i>
                        <p>File ${media.type.toUpperCase()} - Gunakan tombol download untuk melihat</p>
                    </div>
                `;
            }
            this.updatePreviewNavigationState();
            return true;
        } catch (error) {
            console.error('❌ Error loading media viewer:', error);
            document.getElementById('media-viewer').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Gagal memuat media: ${error.message}
                </div>
            `;
            return false;
        }
    }

    navigatePreview(step) {
        const previewList = this.getPreviewDataList();
        if (previewList.length === 0) return;

        const nextIndex = this.currentPreviewIndex + step;
        if (nextIndex < 0 || nextIndex >= previewList.length) return;
        this.renderPreview(nextIndex);
    }

    updatePreviewNavigationState() {
        const prevBtn = document.getElementById('preview-prev-btn');
        const nextBtn = document.getElementById('preview-next-btn');
        const total = this.getPreviewDataList().length;
        const hasActivePreview = this.currentPreviewIndex >= 0 && this.currentPreviewIndex < total;

        if (prevBtn) {
            prevBtn.disabled = !hasActivePreview || this.currentPreviewIndex <= 0 || total === 0;
        }

        if (nextBtn) {
            nextBtn.disabled = !hasActivePreview || this.currentPreviewIndex >= total - 1 || total === 0;
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

    handlePreviewKeyboard(event) {
        const modal = document.getElementById('mediaModal');
        if (!modal || !modal.classList.contains('show')) return;

        const targetTag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
        const isTypingContext = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || (event.target && event.target.isContentEditable);
        if (isTypingContext) return;

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.navigatePreview(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.navigatePreview(1);
        }
    }

    showLoading() {
        const mediaGrid = document.getElementById('media-grid');
        if (!mediaGrid) return;

        mediaGrid.setAttribute('aria-busy', 'true');

        const skeletonCount = this.itemsPerPage || 12;
        const skeletonCards = Array.from({ length: skeletonCount }).map(() => `
            <div class="col-lg-4 col-md-6 col-sm-12 col-xl-3 col-xxl-2">
                <div class="media-card skeleton-card">
                    <div class="media-thumbnail skeleton-block"></div>
                    <div class="media-info">
                        <div class="skeleton-line w-75"></div>
                        <div class="skeleton-line w-50"></div>
                        <div class="skeleton-line w-100"></div>
                    </div>
                </div>
            </div>
        `).join('');

        mediaGrid.innerHTML = skeletonCards;
    }

    hideLoading() {
        const mediaGrid = document.getElementById('media-grid');
        if (mediaGrid) {
            mediaGrid.setAttribute('aria-busy', 'false');
        }
    }

    showUploadProgress() {
        const progress = document.getElementById('upload-progress');
        const btn = document.getElementById('upload-btn');

        if (progress) progress.style.display = 'block';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
        }
    }

    hideUploadProgress() {
        const progress = document.getElementById('upload-progress');
        const btn = document.getElementById('upload-btn');

        if (progress) progress.style.display = 'none';
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload';
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        // Destroy existing modal first to ensure fresh state
        const modalId = 'uploadNotificationModal';
        let existingModal = document.getElementById(modalId);
        
        if (existingModal) {
            const existingInstance = bootstrap.Modal.getInstance(existingModal);
            if (existingInstance) existingInstance.dispose();
            existingModal.remove();
            
            // Clean up any stuck backdrops
            document.querySelectorAll('.modal-backdrop').forEach(bd => bd.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }

        // Create new modal structure
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = modalId;
        modal.setAttribute('tabindex', '-1');
        // High Z-Index to ensure it's on top of everything
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered" style="z-index: 10001">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <span id="modal-icon"></span>
                            <span id="modal-title-text"></span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p id="modal-message"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Update content based on type
        const isSuccess = type === 'success';
        const iconClass = isSuccess ? 'fas fa-check-circle text-success me-2' : 'fas fa-exclamation-triangle text-danger me-2';
        const titleText = isSuccess ? 'Upload Berhasil' : 'Upload Gagal';
        const headerClass = isSuccess ? 'bg-success text-white' : 'bg-danger text-white';

        modal.querySelector('#modal-icon').className = iconClass;
        modal.querySelector('#modal-title-text').textContent = titleText;
        modal.querySelector('#modal-message').innerHTML = message.replace(/\n/g, '<br>');
        modal.querySelector('.modal-header').className = `modal-header ${headerClass}`;

        // Initialize Bootstrap Modal
        const bsModal = new bootstrap.Modal(modal, {
            backdrop: true, // Allow clicking outside to close
            keyboard: true, // Allow ESC key
            focus: true
        });

        // Add cleanup listener
        modal.addEventListener('hidden.bs.modal', () => {
            if (bsModal) bsModal.dispose();
            if (modal.parentNode) modal.parentNode.removeChild(modal);
            
            // Double check cleanup (safe mode)
            setTimeout(() => {
                try {
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(bd => {
                        if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
                    });
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                } catch (e) {
                    console.warn('Modal cleanup warning:', e);
                }
            }, 100); // Small delay to let Bootstrap finish
        });

        // Force manual close logic as backup for buttons
        const closeBtns = modal.querySelectorAll('[data-bs-dismiss="modal"]');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                bsModal.hide();
            });
        });

        bsModal.show();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.bimGallery = new BIMGallery();
});

// Export for global access if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BIMGallery;
}
