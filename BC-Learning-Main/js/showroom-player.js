class BIMShowroomPlayer {
    constructor() {
        this.taggedMedia = [];
        this.categories = {};
        this.currentCategory = null;
        this.currentMediaList = [];
        this.currentMediaIndex = 0;
        this.isViewerOpen = false;

        this.sidebar = document.getElementById('showroomSidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
        this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
        this.sidebarContent = document.getElementById('sidebarContent');
        this.sidebarStatus = document.getElementById('sidebarStatus');
        this.workspaceHint = document.getElementById('workspaceHint');

        this.viewerEmptyState = document.getElementById('mediaViewerEmpty');
        this.viewerContainer = document.getElementById('mediaViewerContainer');
        this.viewerHeading = document.getElementById('mediaViewerHeading');
        this.viewerCloseBtn = document.getElementById('viewerCloseBtn');
        this.viewerMediaLoading = document.getElementById('viewerMediaLoading');
        this.viewerVideo = document.getElementById('viewerVideo');
        this.viewerImage = document.getElementById('viewerImage');
        this.viewerPrevBtn = document.getElementById('viewerPrevBtn');
        this.viewerNextBtn = document.getElementById('viewerNextBtn');
        this.mediaTitleFooter = document.getElementById('mediaTitleFooter');

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setViewerVisibility(false);
        this.updateSidebarStatus('Pilih kategori untuk menampilkan preview media.');

        await this.loadMetadata();
        this.buildSidebar();
        this.updateStats();
    }

    setupEventListeners() {
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', (event) => {
                event.preventDefault();
                this.toggleSidebar();
            });
        }

        if (this.sidebarCloseBtn) {
            this.sidebarCloseBtn.addEventListener('click', () => {
                this.toggleSidebar(false);
            });
        }

        if (this.sidebarBackdrop) {
            this.sidebarBackdrop.addEventListener('click', () => {
                this.toggleSidebar(false);
            });
        }

        if (this.sidebarContent) {
            this.sidebarContent.addEventListener('click', (event) => {
                const groupHeader = event.target.closest('.sidebar-group-header');
                if (groupHeader) {
                    event.preventDefault();
                    this.toggleGroup(groupHeader.dataset.group);
                    return;
                }

                const sidebarItem = event.target.closest('.sidebar-item');
                if (!sidebarItem) {
                    return;
                }

                event.preventDefault();

                const type = sidebarItem.dataset.type;
                const category = sidebarItem.dataset.category;
                if (!type || !category) {
                    return;
                }

                this.loadCategory(type, category);
            });
        }

        if (this.viewerCloseBtn) {
            this.viewerCloseBtn.addEventListener('click', () => {
                this.hideViewer();
            });
        }

        if (this.viewerPrevBtn) {
            this.viewerPrevBtn.addEventListener('click', () => {
                this.showPreviousMedia();
            });
        }

        if (this.viewerNextBtn) {
            this.viewerNextBtn.addEventListener('click', () => {
                this.showNextMedia();
            });
        }

        if (this.viewerVideo) {
            this.viewerVideo.addEventListener('ended', () => {
                if (this.currentMediaList.length > 1) {
                    setTimeout(() => {
                        this.showNextMedia();
                    }, 1200);
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (!this.isViewerOpen) {
                return;
            }

            if (event.key === 'Escape') {
                this.hideViewer();
            } else if (event.key === 'ArrowLeft') {
                this.showPreviousMedia();
            } else if (event.key === 'ArrowRight') {
                this.showNextMedia();
            }
        });

        document.addEventListener('click', (event) => {
            if (!this.isMobileViewport() || !this.sidebar || !this.sidebar.classList.contains('show')) {
                return;
            }

            if (this.sidebar.contains(event.target) || this.sidebarToggle?.contains(event.target)) {
                return;
            }

            this.toggleSidebar(false);
        });

        window.addEventListener('resize', () => {
            if (!this.isMobileViewport()) {
                this.toggleSidebar(false);
            }
        });
    }

    isMobileViewport() {
        return window.matchMedia('(max-width: 991.98px)').matches;
    }

    toggleSidebar(forceOpen) {
        if (!this.sidebar) {
            return;
        }

        if (!this.isMobileViewport()) {
            this.sidebar.classList.remove('show');
            if (this.sidebarBackdrop) {
                this.sidebarBackdrop.classList.remove('show');
            }
            return;
        }

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : !this.sidebar.classList.contains('show');

        this.sidebar.classList.toggle('show', shouldOpen);
        if (this.sidebarBackdrop) {
            this.sidebarBackdrop.classList.toggle('show', shouldOpen);
        }
    }

    setViewerVisibility(isVisible) {
        if (this.viewerContainer) {
            this.viewerContainer.style.display = isVisible ? 'flex' : 'none';
            this.viewerContainer.classList.toggle('show', isVisible);
        }

        if (this.viewerEmptyState) {
            this.viewerEmptyState.style.display = isVisible ? 'none' : 'flex';
        }
    }

    updateSidebarStatus(message) {
        if (this.sidebarStatus) {
            this.sidebarStatus.textContent = message;
        }

        if (this.workspaceHint) {
            this.workspaceHint.textContent = message;
        }
    }

    async loadMetadata() {
        try {
            const response = await fetch('/api/bim-media/tags');
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            this.taggedMedia = Array.isArray(data.media) ? data.media : [];
            this.categories = this.buildCategoryMap(this.taggedMedia);
        } catch (error) {
            this.taggedMedia = [];
            this.categories = {};
            this.showError('Data media BIM belum dapat dimuat.');
        }
    }

    buildCategoryMap(mediaItems) {
        const groups = {
            tahun: {
                name: 'Tahun',
                icon: 'fas fa-calendar-alt',
                description: 'Filter berdasarkan tahun proyek',
                subcategories: new Set()
            },
            lokasi: {
                name: 'Lokasi',
                icon: 'fas fa-map-marker-alt',
                description: 'Filter berdasarkan lokasi proyek',
                subcategories: new Set()
            },
            tipe: {
                name: 'Tipe Proyek',
                icon: 'fas fa-building',
                description: 'Filter berdasarkan tipe proyek',
                subcategories: new Set()
            },
            dimensi: {
                name: 'Dimensi BIM',
                icon: 'fas fa-cubes',
                description: 'Filter berdasarkan dimensi BIM',
                subcategories: new Set()
            }
        };

        mediaItems.forEach((media) => {
            if (media.year) {
                groups.tahun.subcategories.add(media.year);
            }
            if (media.location) {
                groups.lokasi.subcategories.add(media.location);
            }
            if (media.type) {
                groups.tipe.subcategories.add(media.type);
            }
            if (media.bimDimension) {
                groups.dimensi.subcategories.add(media.bimDimension);
            }
        });

        return Object.fromEntries(
            Object.entries(groups)
                .filter(([, group]) => group.subcategories.size > 0)
                .map(([key, group]) => [
                    key,
                    {
                        ...group,
                        subcategories: Array.from(group.subcategories).sort((a, b) => String(a).localeCompare(String(b)))
                    }
                ])
        );
    }

    updateStats() {
        const totalCategoryFilters = Object.values(this.categories).reduce((count, group) => count + group.subcategories.length, 0);
        const totalVideos = this.taggedMedia.filter((media) => String(media.fileType || '').toLowerCase() === 'video').length;
        const totalImages = this.taggedMedia.filter((media) => String(media.fileType || '').toLowerCase() === 'image').length;

        const totalProjectsEl = document.getElementById('totalProjects');
        const totalVideosEl = document.getElementById('totalVideos');
        const totalImagesEl = document.getElementById('totalImages');

        if (totalProjectsEl) {
            totalProjectsEl.textContent = `${totalCategoryFilters || 0}+`;
        }
        if (totalVideosEl) {
            totalVideosEl.textContent = `${totalVideos || 0}+`;
        }
        if (totalImagesEl) {
            totalImagesEl.textContent = `${totalImages || 0}+`;
        }
    }

    buildSidebar() {
        if (!this.sidebarContent) {
            return;
        }

        if (!Object.keys(this.categories).length) {
            this.sidebarContent.innerHTML = `
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Media Categories</div>
                    <div class="sidebar-item" data-type="category" data-category="all">
                        <div class="sidebar-item-name">All Media</div>
                        <div class="sidebar-item-meta">Tampilkan seluruh media BIM yang tersedia</div>
                    </div>
                </div>
            `;
            return;
        }

        const groupsHtml = Object.entries(this.categories).map(([groupId, group]) => {
            const subcategoriesHtml = group.subcategories.map((subcategory) => `
                <div class="sidebar-item subcategory-item" data-type="category" data-category="${this.escapeAttribute(subcategory)}" style="padding-left: 28px;">
                    <div class="sidebar-item-name">${this.escapeHtml(subcategory)}</div>
                    <div class="sidebar-item-meta">Lihat media untuk ${this.escapeHtml(subcategory)}</div>
                </div>
            `).join('');

            return `
                <div class="sidebar-section">
                    <div class="sidebar-group-header" data-group="${groupId}">
                        <div>
                            <div class="sidebar-item-name"><i class="${group.icon}" style="margin-right: 8px;"></i>${this.escapeHtml(group.name)}</div>
                            <div class="sidebar-item-meta">${this.escapeHtml(group.description)}</div>
                        </div>
                        <i class="fas fa-chevron-down group-toggle-icon"></i>
                    </div>
                    <div class="sidebar-group-content" data-group="${groupId}" style="display: none;">
                        ${subcategoriesHtml}
                    </div>
                </div>
            `;
        }).join('');

        this.sidebarContent.innerHTML = `
            <div class="sidebar-section">
                <div class="sidebar-section-title">Media Categories</div>
                <div class="sidebar-item" data-type="category" data-category="all">
                    <div class="sidebar-item-name"><i class="fas fa-th-large" style="margin-right: 8px;"></i>All Media</div>
                    <div class="sidebar-item-meta">Tampilkan seluruh media BIM yang tersedia</div>
                </div>
            </div>
            ${groupsHtml}
        `;
    }

    toggleGroup(groupId) {
        const groupContent = this.sidebarContent?.querySelector(`.sidebar-group-content[data-group="${CSS.escape(groupId)}"]`);
        const toggleIcon = this.sidebarContent?.querySelector(`.sidebar-group-header[data-group="${CSS.escape(groupId)}"] .group-toggle-icon`);
        if (!groupContent || !toggleIcon) {
            return;
        }

        const shouldOpen = groupContent.style.display === 'none';
        groupContent.style.display = shouldOpen ? 'block' : 'none';
        toggleIcon.style.transform = shouldOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    async loadCategory(type, category) {
        if (type !== 'category') {
            return;
        }

        this.currentCategory = { type, category };
        await this.loadTaggedMedia(category);

        if (this.currentMediaList.length > 0) {
            this.currentMediaIndex = 0;
            this.showViewer();
            this.showCurrentMedia();
        } else {
            this.showViewer();
            this.showEmptyResult(category);
        }

        this.updateSidebarWithCurrentInfo();

        if (this.isMobileViewport()) {
            this.toggleSidebar(false);
        }
    }

    async loadTaggedMedia(categoryId) {
        const availableMedia = this.taggedMedia.filter((media) => !media.excluded);

        const filteredMedia = categoryId === 'all'
            ? availableMedia
            : availableMedia.filter((media) => (
                media.year === categoryId ||
                media.location === categoryId ||
                media.type === categoryId ||
                media.bimDimension === categoryId
            ));

        this.currentMediaList = filteredMedia.map((media) => ({
            filename: media.fileName,
            type: String(media.fileType || 'image').toLowerCase(),
            url: this.constructTaggedMediaUrl(media.fileName, media.filePath) || media.mediaUrl || '',
            tagline: `${media.fileName} • ${media.location || 'Unknown'} • ${media.year || 'Unknown'} • ${media.bimDimension || 'N/A'}`,
            project: {
                name: media.fileName,
                city: media.location || 'Unknown',
                year: media.year || 'Unknown'
            }
        }));
    }

    constructTaggedMediaUrl(fileName, fullPath) {
        const sourcePath = String(fullPath || fileName || '').trim();
        if (!sourcePath) {
            return '';
        }

        let normalizedPath = sourcePath.replace(/\//g, '\\');
        if (/^PC-BIM02[\\/]/i.test(normalizedPath)) {
            normalizedPath = `\\\\pc-bim02\\PROJECT BIM 2025\\${normalizedPath.replace(/^PC-BIM02[\\/]+/i, '')}`;
        }

        if (/^\\\\pc-bim02\\/i.test(normalizedPath)) {
            const publicRelativePath = normalizedPath
                .replace(/^\\\\pc-bim02\\+/i, '')
                .replace(/\\/g, '/')
                .split('/')
                .filter(Boolean)
                .map((segment) => encodeURIComponent(segment))
                .join('/');

            return `/data/bim-media-public/pc-bim02/${publicRelativePath}`;
        }

        if (/^G:[\\/]/i.test(normalizedPath)) {
            return `/api/admin/preview-media?path=${encodeURIComponent(normalizedPath.replace(/\\/g, '/'))}`;
        }

        return '';
    }

    showViewer() {
        this.isViewerOpen = true;
        this.setViewerVisibility(true);
    }

    hideViewer() {
        this.isViewerOpen = false;
        this.clearViewerMedia();
        this.setViewerVisibility(false);
        this.updateSidebarStatus('Preview disembunyikan. Pilih kategori lain untuk membuka media.');
    }

    clearViewerMedia() {
        if (this.viewerVideo) {
            this.viewerVideo.pause();
            this.viewerVideo.removeAttribute('src');
            this.viewerVideo.load();
            this.viewerVideo.style.display = 'none';
        }

        if (this.viewerImage) {
            this.viewerImage.removeAttribute('src');
            this.viewerImage.style.display = 'none';
        }

        if (this.viewerMediaLoading) {
            this.viewerMediaLoading.style.display = 'none';
            this.viewerMediaLoading.innerHTML = `
                <div class="spinner"></div>
                <p>Loading media...</p>
            `;
        }

        if (this.viewerHeading) {
            this.viewerHeading.textContent = 'Media Preview';
        }

        if (this.mediaTitleFooter) {
            this.mediaTitleFooter.style.display = 'none';
            this.mediaTitleFooter.textContent = 'Media Preview';
        }

        this.updateNavigationButtons();
    }

    showEmptyResult(category) {
        this.clearViewerMedia();

        const label = this.getCategoryLabel(category);
        if (this.viewerHeading) {
            this.viewerHeading.textContent = 'Tidak ada media';
        }

        if (this.mediaTitleFooter) {
            this.mediaTitleFooter.style.display = 'block';
            this.mediaTitleFooter.textContent = 'Tidak ada media untuk filter yang dipilih';
        }

        if (this.viewerMediaLoading) {
            this.viewerMediaLoading.style.display = 'block';
            this.viewerMediaLoading.innerHTML = `
                <p>Tidak ada media untuk ${this.escapeHtml(label)}</p>
                <small>Coba pilih kategori lain atau buka All Media.</small>
            `;
        }

        this.updateSidebarStatus(`${label} belum memiliki media yang bisa ditampilkan.`);
    }

    showCurrentMedia() {
        if (!this.currentMediaList.length) {
            return;
        }

        const media = this.currentMediaList[this.currentMediaIndex];
        const footerText = media.tagline || `${media.project.name} • ${media.project.city} • ${media.project.year}`;

        this.clearViewerMedia();

        if (this.viewerHeading) {
            this.viewerHeading.textContent = media.project.name || 'Media Preview';
        }

        if (this.mediaTitleFooter) {
            this.mediaTitleFooter.style.display = 'block';
            this.mediaTitleFooter.textContent = footerText;
        }

        if (this.viewerMediaLoading) {
            this.viewerMediaLoading.style.display = 'block';
        }

        if (media.type === 'video') {
            this.showVideo(media);
        } else {
            this.showImage(media);
        }

        this.updateNavigationButtons();
        this.updateSidebarStatus(`${this.getCategoryLabel(this.currentCategory?.category)} • ${this.currentMediaList.length} media tersedia`);
    }

    showVideo(media) {
        if (!this.viewerVideo) {
            return;
        }

        this.viewerVideo.style.display = 'block';
        this.viewerVideo.style.opacity = '1';
        this.viewerVideo.src = media.url;
        this.viewerVideo.load();

        this.viewerVideo.onloadeddata = () => {
            if (this.viewerMediaLoading) {
                this.viewerMediaLoading.style.display = 'none';
            }
        };

        this.viewerVideo.onerror = () => {
            if (this.viewerMediaLoading) {
                this.viewerMediaLoading.style.display = 'block';
                this.viewerMediaLoading.innerHTML = `
                    <p>Video tidak dapat dimuat.</p>
                    <small>${this.escapeHtml(media.url)}</small>
                `;
            }
        };
    }

    showImage(media) {
        if (!this.viewerImage) {
            return;
        }

        this.viewerImage.style.display = 'block';
        this.viewerImage.style.opacity = '1';
        this.viewerImage.src = media.url;

        this.viewerImage.onload = () => {
            if (this.viewerMediaLoading) {
                this.viewerMediaLoading.style.display = 'none';
            }
        };

        this.viewerImage.onerror = () => {
            if (this.viewerMediaLoading) {
                this.viewerMediaLoading.style.display = 'block';
                this.viewerMediaLoading.innerHTML = `
                    <p>Gambar tidak dapat dimuat.</p>
                    <small>${this.escapeHtml(media.url)}</small>
                `;
            }
        };
    }

    showNextMedia() {
        if (this.currentMediaList.length <= 1) {
            return;
        }

        this.currentMediaIndex = (this.currentMediaIndex + 1) % this.currentMediaList.length;
        this.showCurrentMedia();
    }

    showPreviousMedia() {
        if (this.currentMediaList.length <= 1) {
            return;
        }

        this.currentMediaIndex = this.currentMediaIndex === 0
            ? this.currentMediaList.length - 1
            : this.currentMediaIndex - 1;

        this.showCurrentMedia();
    }

    updateNavigationButtons() {
        const shouldShow = this.currentMediaList.length > 1;

        if (this.viewerPrevBtn) {
            this.viewerPrevBtn.style.display = shouldShow ? 'block' : 'none';
        }

        if (this.viewerNextBtn) {
            this.viewerNextBtn.style.display = shouldShow ? 'block' : 'none';
        }
    }

    updateSidebarActiveState() {
        if (!this.sidebarContent || !this.currentCategory) {
            return;
        }

        this.sidebarContent.querySelectorAll('.sidebar-item').forEach((item) => {
            item.classList.remove('active');
        });

        const selector = `.sidebar-item[data-type="${this.currentCategory.type}"][data-category="${this.escapeSelectorValue(this.currentCategory.category)}"]`;
        const activeItem = this.sidebarContent.querySelector(selector);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    updateSidebarWithCurrentInfo() {
        this.updateSidebarActiveState();
    }

    getCategoryLabel(category) {
        if (!category) {
            return 'Media BIM';
        }

        const itemName = this.sidebarContent?.querySelector(`.sidebar-item[data-category="${this.escapeSelectorValue(category)}"] .sidebar-item-name`);
        return itemName ? itemName.textContent.trim() : category;
    }

    showError(message) {
        this.updateSidebarStatus(message);
        if (this.sidebarContent) {
            this.sidebarContent.innerHTML = `
                <div class="sidebar-section">
                    <div class="sidebar-section-title">Media Categories</div>
                    <div class="sidebar-item">
                        <div class="sidebar-item-name">Data tidak tersedia</div>
                        <div class="sidebar-item-meta">${this.escapeHtml(message)}</div>
                    </div>
                </div>
            `;
        }
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeAttribute(value) {
        return this.escapeHtml(value);
    }

    escapeSelectorValue(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('showroomSidebar');
    const sidebarContent = document.getElementById('sidebarContent');
    const viewerContainer = document.getElementById('mediaViewerContainer');

    if (!sidebar || !sidebarContent || !viewerContainer) {
        return;
    }

    window.showroomPlayer = new BIMShowroomPlayer();
});
