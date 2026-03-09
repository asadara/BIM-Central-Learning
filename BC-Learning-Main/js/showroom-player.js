// BIM Showroom Player JavaScript
class BIMShowroomPlayer {
    constructor() {
        this.metadata = null;
        this.currentProject = null;
        this.currentMediaIndex = 0;
        this.currentCategory = 'featured';
        this.currentMediaList = [];
        this.isVideoMode = false;
        this.isViewerOpen = false;
        this.projectNameMap = {}; // slug -> backend exact name mapping

        // DOM elements - with null checks
        this.viewerContainer = document.getElementById('mediaViewerContainer');
        this.sidebar = document.getElementById('showroomSidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarContent = document.getElementById('sidebarContent');
        this.viewerSidebarContent = document.getElementById('viewerSidebarContent');
        this.viewerClose = document.getElementById('viewerClose');
        this.viewerTitle = document.getElementById('viewerTitle');
        this.mediaTitleFooter = document.getElementById('mediaTitleFooter');
        this.viewerVideo = document.getElementById('viewerVideo');
        this.viewerImage = document.getElementById('viewerImage');
        this.viewerMediaLoading = document.getElementById('viewerMediaLoading');
        this.viewerPrevBtn = document.getElementById('viewerPrevBtn');
        this.viewerNextBtn = document.getElementById('viewerNextBtn');

        // Use viewer container as modal for Knowledgehub page
        this.modal = this.viewerContainer;
        this.modalTitle = this.viewerTitle;
        this.projectVideo = this.viewerVideo;
        this.projectImage = this.viewerImage;
        this.mediaLoading = this.viewerMediaLoading;
        this.prevBtn = this.viewerPrevBtn;
        this.nextBtn = this.viewerNextBtn;
        this.modalClose = this.viewerClose;

        this.init();
    }

    async init() {
        try {


            // Load metadata

            await this.loadMetadata();


            // Setup event listeners

            this.setupEventListeners();


            // Build sidebar

            this.buildSidebar();


            // Show modal immediately

            this.showModal();




        } catch (error) {


            this.showError('Failed to load showroom data');
        }
    }

    async loadMetadata() {
        try {


            // Fetch real tagged media data from API
            const response = await fetch('/api/bim-media/tags');
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const apiData = await response.json();


            if (!apiData.media || !Array.isArray(apiData.media)) {
                throw new Error('Invalid API response format');
            }

            // Analyze available categories from tagged media
            const availableCategories = {
                years: new Set(),
                locations: new Set(),
                types: new Set(),
                dimensions: new Set()
            };

            // Collect all unique values from media
            apiData.media.forEach(media => {
                if (media.year) availableCategories.years.add(media.year);
                if (media.location) availableCategories.locations.add(media.location);
                if (media.type) availableCategories.types.add(media.type);
                if (media.bimDimension) availableCategories.dimensions.add(media.bimDimension);
            });

            // Create hierarchical categories structure based on actual data
            const categoriesData = {
                success: true,
                categories: {}
            };

            // Years category
            if (availableCategories.years.size > 0) {
                categoriesData.categories.tahun = {
                    name: "Tahun",
                    description: "Filter berdasarkan tahun proyek",
                    color: "#2196F3",
                    icon: "fas fa-calendar-alt",
                    type: "group",
                    subcategories: {}
                };

                Array.from(availableCategories.years).sort().forEach(year => {
                    categoriesData.categories.tahun.subcategories[year] = { name: year };
                });
            }

            // Locations category
            if (availableCategories.locations.size > 0) {
                categoriesData.categories.lokasi = {
                    name: "Lokasi",
                    description: "Filter berdasarkan lokasi proyek",
                    color: "#FF9800",
                    icon: "fas fa-map-marker-alt",
                    type: "group",
                    subcategories: {}
                };

                Array.from(availableCategories.locations).sort().forEach(location => {
                    categoriesData.categories.lokasi.subcategories[location] = { name: location };
                });
            }

            // Types category
            if (availableCategories.types.size > 0) {
                categoriesData.categories.tipe = {
                    name: "Tipe Proyek",
                    description: "Filter berdasarkan tipe proyek",
                    color: "#4CAF50",
                    icon: "fas fa-building",
                    type: "group",
                    subcategories: {}
                };

                Array.from(availableCategories.types).sort().forEach(type => {
                    categoriesData.categories.tipe.subcategories[type] = { name: type };
                });
            }

            // BIM Dimensions category
            if (availableCategories.dimensions.size > 0) {
                categoriesData.categories.dimensi = {
                    name: "Dimensi BIM",
                    description: "Filter berdasarkan dimensi BIM",
                    color: "#9C27B0",
                    icon: "fas fa-cubes",
                    type: "group",
                    subcategories: {}
                };

                Array.from(availableCategories.dimensions).sort().forEach(dimension => {
                    categoriesData.categories.dimensi.subcategories[dimension] = { name: dimension };
                });
            }



            // Structure metadata for compatibility with existing code
            this.metadata = {
                categories: {
                    byType: {},
                    byYear: {},
                    byBimDimension: {},
                    byLocation: {}
                },
                projects: {},
                featured: [],
                taggedMedia: apiData.media || []
            };

            // Convert categories to sidebar sections
            const categoryKeys = Object.keys(categoriesData.categories || {});


            categoryKeys.forEach(categoryId => {
                const category = categoriesData.categories[categoryId];


                // Create a dummy project entry for each category
                this.metadata.projects[categoryId] = {
                    id: categoryId,
                    name: category.name,
                    city: category.description || category.name,
                    year: new Date().getFullYear().toString(),
                    bimDimension: 'Media',
                    type: 'media'
                };

                // Add to featured for main display
                this.metadata.featured.push(categoryId);

                // Group by type (we'll put all in 'media' type)
                if (!this.metadata.categories.byType['Media']) {
                    this.metadata.categories.byType['Media'] = [];
                }
                this.metadata.categories.byType['Media'].push(categoryId);
            });

            // Store categories for later use
            this.categories = categoriesData.categories || {};


        } catch (error) {





            // Fallback to basic categories if everything fails
            this.categories = this.getFallbackCategories();
            this.metadata = this.createFallbackMetadata();


        }
    }

    getFallbackCategories() {
        return {
            'beginner': {
                name: 'Pemula',
                description: 'Materi untuk pemula dalam BIM',
                color: '#4CAF50',
                icon: 'fas fa-seedling'
            },
            'intermediate': {
                name: 'Menengah',
                description: 'Materi tingkat menengah',
                color: '#FF9800',
                icon: 'fas fa-cogs'
            },
            'advanced': {
                name: 'Lanjutan',
                description: 'Materi tingkat lanjutan',
                color: '#F44336',
                icon: 'fas fa-rocket'
            }
        };
    }

    createFallbackMetadata() {
        return {
            categories: {
                byType: { 'Media': ['beginner', 'intermediate', 'advanced'] },
                byYear: {},
                byBimDimension: {},
                byLocation: {}
            },
            projects: {
                'beginner': {
                    id: 'beginner',
                    name: 'Pemula',
                    city: 'Materi untuk pemula dalam BIM',
                    year: new Date().getFullYear().toString(),
                    bimDimension: 'Media',
                    type: 'media'
                },
                'intermediate': {
                    id: 'intermediate',
                    name: 'Menengah',
                    city: 'Materi tingkat menengah',
                    year: new Date().getFullYear().toString(),
                    bimDimension: 'Media',
                    type: 'media'
                },
                'advanced': {
                    id: 'advanced',
                    name: 'Lanjutan',
                    city: 'Materi tingkat lanjutan',
                    year: new Date().getFullYear().toString(),
                    bimDimension: 'Media',
                    type: 'media'
                }
            },
            featured: ['beginner', 'intermediate', 'advanced'],
            taggedMedia: []
        };
    }

    async buildProjectNameMapping() {
        try {
            // Get unique years from metadata
            const years = new Set();
            Object.values(this.metadata.projects).forEach(project => {
                if (project.year) years.add(project.year);
            });

            // Fetch projects from backend for each year
            for (const year of years) {
                const response = await fetch(`/api/projects/${year}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.projects) {
                        // Build mapping: normalized_slug -> backend_exact_name
                        data.projects.forEach(project => {
                            const normalizedSlug = this.normalizeProjectName(project.name);
                            this.projectNameMap[normalizedSlug] = project.name;

                        });
                    }
                } else {

                }
            }


        } catch (error) {

        }
    }

    normalizeProjectName(name) {
        if (!name) return '';

        // Remove leading numeric prefix like "11. "
        let normalized = name.replace(/^\d+\.\s*/, '');

        // Lower-case
        normalized = normalized.toLowerCase();

        // Replace non-alphanum with hyphen
        normalized = normalized.replace(/[^a-z0-9]+/g, '-');

        // Collapse multiple hyphens
        normalized = normalized.replace(/-+/g, '-');

        // Remove leading/trailing hyphens
        normalized = normalized.replace(/^-+|-+$/g, '');

        return normalized;
    }

    // RULE 2: Alias overrides for known mismatches
    getProjectAlias(baseSlug) {
        const PROJECT_ALIASES = {
            'gedung-kuliah-ft-unp': 'gedung-kuliah-ft-b-c-d-unp'
            // Add more aliases only when needed for specific mapping failures
        };

        return PROJECT_ALIASES[baseSlug] || null;
    }

    // RULE 1: Strip year suffix from dataset project slugs
    getBaseSlug(datasetSlug) {
        if (!datasetSlug) return '';

        // Remove trailing "-YYYY" where YYYY is 4 digits
        return datasetSlug.replace(/-(\d{4})$/, '');
    }

    updateStats() {
        // Safely update stats elements if they exist (they may not in minimal header mode)
        const totalProjects = Object.keys(this.metadata.projects).length;
        const totalProjectsEl = document.getElementById('totalProjects');
        if (totalProjectsEl) {
            totalProjectsEl.textContent = totalProjects + '+';
        }

        // Count BIM dimensions
        const dimensions = new Set();
        Object.values(this.metadata.projects).forEach(project => {
            dimensions.add(project.bimDimension);
        });

        const bimDimensionsEl = document.getElementById('bimDimensions');
        if (bimDimensionsEl) {
            bimDimensionsEl.textContent = Math.max(...Array.from(dimensions).map(d => parseInt(d))) + 'D';
        }

        // Update other stats elements if they exist
        const totalVideosEl = document.getElementById('totalVideos');
        if (totalVideosEl) {
            // Count total tagged videos
            const taggedData = this.metadata.taggedMedia || [];
            const videoCount = taggedData.filter(media => media.type === 'video').length;
            totalVideosEl.textContent = videoCount + '+';
        }

        const totalImagesEl = document.getElementById('totalImages');
        if (totalImagesEl) {
            // Count total tagged images
            const taggedData = this.metadata.taggedMedia || [];
            const imageCount = taggedData.filter(media => media.type === 'image').length;
            totalImagesEl.textContent = imageCount + '+';
        }


    }

    setupEventListeners() {
        // Sidebar toggle
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.sidebar.classList.toggle('show');
            });
        }

        // Sidebar menu items - delegate events properly
        const sidebarContent = document.getElementById('sidebarContent');
        if (sidebarContent) {
            sidebarContent.addEventListener('click', (e) => {
                // Handle group header clicks (expand/collapse)
                const groupHeader = e.target.closest('.sidebar-group-header');
                if (groupHeader) {
                    e.preventDefault();
                    const groupId = groupHeader.dataset.group;
                    this.toggleGroup(groupId);
                    return;
                }

                // Handle regular sidebar item clicks
                const sidebarItem = e.target.closest('.sidebar-item');
                if (sidebarItem) {
                    e.preventDefault();
                    const type = sidebarItem.dataset.type;
                    const category = sidebarItem.dataset.category;

                    // Skip if this is viewer sidebar content (not main sidebar)
                    if (sidebarItem.closest('#viewerSidebarContent')) {
                        return; // Don't handle viewer sidebar clicks here
                    }

                    // Skip informational sidebar items that don't have data attributes
                    if (!type || !category) {

                        return;
                    }



                    // For Knowledgehub: Load category and update sidebar with current info
                    this.loadCategory(type, category);

                    // Show viewer if not already open
                    if (!this.isViewerOpen) {
                        this.showViewer();
                    }

                    // Update sidebar to show categories + current selection info
                    this.updateSidebarWithCurrentInfo();

                    // Keep sidebar open for easy category switching
                    // Don't auto-close for Knowledgehub UX
                }
            });
        }

        // Modal close - Click outside modal content to close
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                // Only close if clicking on the modal container itself (not on content)
                if (e.target === this.modal) {
                    this.hideViewer();
                }
            });
        }

        // Viewer navigation buttons
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

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isViewerOpen) return;

            switch (e.key) {
                case 'Escape':
                    this.hideViewer();
                    break;
                case 'ArrowLeft':
                    this.showPreviousMedia();
                    break;
                case 'ArrowRight':
                    this.showNextMedia();
                    break;
            }
        });

        // Video ended event
        if (this.viewerVideo) {
            this.viewerVideo.addEventListener('ended', () => {
                // Auto-advance to next media after video ends
                setTimeout(() => {
                    this.showNextMedia();
                }, 2000);
            });
        };


    }

    buildSidebar() {




        let html = '';

        // Media Categories Section - from tagging system
        html += this.buildMediaCategoriesSection();




        this.sidebarContent.innerHTML = html;

    }

    buildMediaCategoriesSection() {
        let html = `<div class="sidebar-section">`;
        html += `<div class="sidebar-section-title">📁 Media Categories</div>`;

        // Build hierarchical categories
        Object.keys(this.categories).forEach(categoryId => {
            const category = this.categories[categoryId];

            if (category.type === 'group' && category.subcategories) {
                // Main category with subcategories
                const iconHtml = category.icon ? `<i class="${category.icon}" style="color: ${category.color}; margin-right: 8px;"></i>` : '';

                html += `
                    <div class="sidebar-group" data-group="${categoryId}">
                        <div class="sidebar-group-header" data-group="${categoryId}">
                            <div class="sidebar-item-name">${iconHtml}${category.name}</div>
                            <div class="sidebar-item-meta">${category.description || 'Click to expand'}</div>
                            <i class="fas fa-chevron-down group-toggle-icon" style="margin-left: auto; transition: transform 0.3s;"></i>
                        </div>
                        <div class="sidebar-group-content" data-group="${categoryId}" style="display: none;">`;

                // Add subcategories
                Object.keys(category.subcategories).forEach(subCategoryId => {
                    const subCategory = category.subcategories[subCategoryId];
                    html += `
                        <div class="sidebar-item subcategory-item" data-type="category" data-category="${subCategoryId}" data-parent="${categoryId}" style="padding-left: 30px;">
                            <div class="sidebar-item-name">• ${subCategory.name}</div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>`;
            } else {
                // Regular category (fallback)
                const iconHtml = category.icon ? `<i class="${category.icon}" style="color: ${category.color}; margin-right: 8px;"></i>` : '';
                html += `
                    <div class="sidebar-item" data-type="category" data-category="${categoryId}">
                        <div class="sidebar-item-name">${iconHtml}${category.name}</div>
                        <div class="sidebar-item-meta">${category.description || 'Media category'}</div>
                    </div>
                `;
            }
        });

        // Add "All Media" option
        html += `
            <div class="sidebar-item" data-type="category" data-category="all">
                <div class="sidebar-item-name"><i class="fas fa-th-large" style="margin-right: 8px;"></i>All Media</div>
                <div class="sidebar-item-meta">All tagged media files</div>
            </div>
        `;

        html += `</div>`;
        return html;
    }

    buildSidebarSection(title, categories, type) {
        let html = `<div class="sidebar-section">`;
        html += `<div class="sidebar-section-title">${title}</div>`;

        Object.keys(categories).forEach(category => {
            const count = categories[category].length;
            if (count === 0) return;

            html += `
                <div class="sidebar-item" data-type="${type}" data-category="${category}">
                    <div class="sidebar-item-name">${this.formatCategoryName(category)}</div>
                    <div class="sidebar-item-meta">${count} project${count > 1 ? 's' : ''}</div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    formatCategoryName(category) {
        // Format category names for display
        const formats = {
            'Commercial': '🏪 Commercial',
            'Healthcare': '🏥 Healthcare',
            'Residential': '🏠 Residential',
            'Education': '🎓 Education',
            'Infrastructure': '🌉 Infrastructure'
        };
        return formats[category] || category;
    }

    showModal() {
        // Check if modal elements exist before accessing them
        if (!this.modal) {

            return;
        }

        try {
            // Just show the modal container without loading any content
            // Content will be loaded only when user selects a category from sidebar
            this.modal.style.display = 'flex';

        } catch (error) {


        }
    }

    hideModal() {
        this.modal.style.display = 'none';

        // Pause video if playing
        if (this.viewerVideo && !this.viewerVideo.paused) {
            this.viewerVideo.pause();
        }
    }

    showViewer() {

        if (this.viewerContainer) {

            this.viewerContainer.classList.add('show');
            this.isViewerOpen = true;

            // Switch main sidebar to show viewer info
            this.switchSidebarToViewerMode();


        } else {

        }
    }

    hideViewer() {
        if (this.viewerContainer) {
            this.viewerContainer.classList.remove('show');
            this.isViewerOpen = false;

            // Switch main sidebar back to navigation mode
            this.switchSidebarToNavigationMode();

            // Pause video if playing
            if (this.viewerVideo && !this.viewerVideo.paused) {
                this.viewerVideo.pause();
            }
        }
    }

    switchSidebarToViewerMode() {
        if (!this.sidebarContent) return;

        // Store current sidebar content
        this.navigationSidebarContent = this.sidebarContent.innerHTML;

        // Replace with viewer sidebar content
        this.updateViewerSidebar();

        // Update sidebar header
        const sidebarHeader = this.sidebar.querySelector('.sidebar-header h3');
        if (sidebarHeader) {
            sidebarHeader.innerHTML = '<i class="fas fa-info-circle me-2"></i>Viewer Info';
        }

        // Keep sidebar compact - don't change its width
        // This ensures proportions stay consistent
    }

    switchSidebarToNavigationMode() {
        if (!this.sidebarContent) return;

        // Restore navigation sidebar content
        if (this.navigationSidebarContent) {
            this.sidebarContent.innerHTML = this.navigationSidebarContent;
        }

        // Update sidebar header back to navigation
        const sidebarHeader = this.sidebar.querySelector('.sidebar-header h3');
        if (sidebarHeader) {
            sidebarHeader.innerHTML = '<i class="fas fa-cube me-2"></i>BIM Showroom';
        }
    }

    async loadCategory(type, category) {

        this.currentCategory = { type, category };
        this.currentMediaList = [];

        if (type === 'category') {
            // Load media from BIM tagging system

            await this.loadTaggedMedia(category);
        } else {
            // Fallback to old project-based method for compatibility

            let projectIds = [];

            switch (type) {
                case 'featured':
                    projectIds = this.metadata.featured;
                    break;
                case 'video':
                case 'photo':
                    projectIds = this.metadata.categories.byType[category] || [];
                    break;
                case 'year':
                    projectIds = this.metadata.categories.byYear[category] || [];
                    break;
                case 'dimension':
                    projectIds = this.metadata.categories.byBimDimension[category] || [];
                    break;
                case 'location':
                    projectIds = this.metadata.categories.byLocation[category] || [];
                    break;
            }



            // Load media for each project
            for (const projectId of projectIds) {
                await this.loadProjectMedia(projectId);
            }
        }




        // Always show viewer for category selections


        // Start with first media
        if (this.currentMediaList.length > 0) {
            this.currentMediaIndex = 0;
            this.showCurrentMedia();

            // Ensure viewer is shown
            if (!this.isViewerOpen) {

                this.showViewer();
            }
        } else {

            // Show a message that no media is available
            if (this.viewerTitle) {
                this.viewerTitle.textContent = 'No Media Available';
                if (this.viewerMediaLoading) {
                    this.viewerMediaLoading.innerHTML = '<p>No media found for this category</p><small>Try selecting a different category</small>';
                    this.viewerMediaLoading.style.display = 'flex';
                }
            }

            // Still show viewer even if no media found
            if (!this.isViewerOpen) {

                this.showViewer();
            }
        }

        // Update sidebar active state and populate viewer sidebar
        this.updateSidebarActiveState();
        this.updateViewerSidebar();
    }

    async loadTaggedMedia(categoryId) {
        try {


            // Try to fetch from BIM media API (use public API for showroom)
            const response = await fetch(`/api/bim-media/tags`);
            if (!response.ok) {

                this.currentMediaList = [];
                return;
            }

            const data = await response.json();



            let mediaArray = [];

            // Handle response format - both admin and public APIs return media as array
            if (Array.isArray(data.media)) {
                // API returns media as array of objects
                mediaArray = data.media;
            } else {

                this.currentMediaList = [];
                return;
            }

            if (mediaArray.length === 0) {

                this.currentMediaList = [];
                return;
            }



            // Filter media based on category and exclude excluded media
            let filteredMedia = [];

            if (categoryId === 'all') {
                // Show all tagged media (exclude excluded ones)
                filteredMedia = mediaArray.filter(media => !media.excluded);

            } else {
                // Filter by the specific category (exclude excluded ones)
                filteredMedia = mediaArray.filter(media => {
                    const matches = {
                        year: media.year === categoryId,
                        location: media.location === categoryId,
                        bimDimension: media.bimDimension === categoryId,
                        type: media.type === categoryId
                    };

                    const isMatch = matches.year || matches.location || matches.bimDimension || matches.type;

                    // Only include if it matches category AND is not excluded
                    return isMatch && !media.excluded;
                });
            }

            if (filteredMedia.length === 0) {

                this.currentMediaList = [];
                return;
            }

            // Convert to media list format
            this.currentMediaList = filteredMedia.map(media => {
                // media is already the media object, not an array
                const fullPath = media.filePath; // Get fullPath from media object if available

                return {
                    filename: media.fileName,
                    tagline: `${media.fileName} (${media.year || 'N/A'}, ${media.location || 'N/A'}, ${media.bimDimension || 'N/A'}, ${media.type || 'N/A'})`,
                    type: media.fileType,
                    category: categoryId,
                    url: this.constructTaggedMediaUrl(media.fileName, media.fileType, fullPath),
                    project: {
                        id: categoryId,
                        name: media.fileName,
                        city: `${media.location || 'Unknown'} - ${media.type || 'Unknown'}`,
                        year: media.year || 'Unknown',
                        bimDimension: media.bimDimension || 'Unknown',
                        type: 'tagged'
                    }
                };
            });




        } catch (error) {


            // Fallback to empty list
            this.currentMediaList = [];
        }
    }

    addTaggedMediaToList(mediaItems) {
        mediaItems.forEach(media => {
            // Construct media URL based on file type and location
            let mediaUrl = this.constructTaggedMediaUrl(media.filename, media.type);

            this.currentMediaList.push({
                filename: media.filename,
                tagline: media.tagline,
                type: media.type,
                category: media.category,
                url: mediaUrl,
                project: {
                    id: media.category,
                    name: media.tagline || media.filename,
                    city: `Category: ${this.categories[media.category]?.name || media.category}`,
                    year: new Date().getFullYear().toString(),
                    bimDimension: 'Tagged Media',
                    type: 'tagged'
                }
            });
        });
    }

    constructTaggedMediaUrl(filename, type, fullPath) {
        // For BIM tagged media, construct URLs based on the full file path
        // The backend serves files from PC-BIM02 directory via /media route




        let mediaUrl;

        if (fullPath) {
            // Revert to original working URL construction
            mediaUrl = `/media/${encodeURIComponent(fullPath)}`;

        } else {
            // Fallback when no full path is available

            mediaUrl = `/media/${encodeURIComponent(filename)}`;
        }


        return mediaUrl;
    }

    async loadProjectMedia(projectId) {
        const project = this.metadata.projects[projectId];
        if (!project) return;

        try {
            // RULE 1: Strip year suffix from dataset project slug
            const baseSlug = this.getBaseSlug(projectId);


            let backendExactName = null;

            // Try direct mapping first
            if (this.projectNameMap[baseSlug]) {
                backendExactName = this.projectNameMap[baseSlug];

            } else {
                // RULE 2: Check alias overrides for known mismatches
                const aliasKey = this.getProjectAlias(baseSlug);
                if (aliasKey && this.projectNameMap[aliasKey]) {
                    backendExactName = this.projectNameMap[aliasKey];

                }
            }

            if (!backendExactName) {
                // RULE 3: Fallback behavior - show clean message, no API call



                // Add fallback media with clear message
                this.currentMediaList.push({
                    project: project,
                    url: `/img/undercon.gif`,
                    type: 'image',
                    fallback: true,
                    noMapping: true, // Special flag for unmapped projects
                    message: 'Project belum terhubung ke folder server'
                });
                return;
            }

            // Extract year from project or slug
            let year = project.year;
            if (!year && projectId.includes('-')) {
                // Try to extract year from slug (e.g., "mall-grand-indonesia-2024" -> "2024")
                const yearMatch = projectId.match(/-(\d{4})$/);
                if (yearMatch) {
                    year = yearMatch[1];
                }
            }
            year = year || '2024'; // Default fallback



            // Try project media API with exact backend folder name
            const response = await fetch(`/api/project-media/${year}/${encodeURIComponent(backendExactName)}`);
            if (response.ok) {
                const data = await response.json();
                const mediaUrls = data.media || [];

                mediaUrls.forEach(url => {
                    this.currentMediaList.push({
                        project: project,
                        url: url,
                        type: this.getMediaType(url)
                    });
                });


            } else {

                this.addFallbackMedia(project);
            }

        } catch (error) {

            this.addFallbackMedia(project);
        }
    }

    addFallbackMedia(project) {
        // Add placeholder media - GIF should be treated as image, not video
        this.currentMediaList.push({
            project: project,
            url: `/img/undercon.gif`, // GIF placeholder
            type: 'image', // GIF is an image format
            fallback: true
        });
    }

    getMediaType(url) {
        const extension = url.split('.').pop().toLowerCase();
        const videoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
        const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];

        if (videoExts.includes(extension)) {
            return 'video';
        } else if (imageExts.includes(extension)) {
            return 'image';
        } else {
            return 'unknown';
        }
    }

    constructMediaUrl(filePath) {
        // Handle different file path formats and construct proper URLs
        if (!filePath) return '';

        // Normalize path separators
        let normalizedPath = filePath.replace(/\\/g, '/');

        // Handle different source patterns
        if (normalizedPath.startsWith('G:/')) {
            // Local G drive paths - remove G:/ prefix and add /media/ prefix
            const relativePath = normalizedPath.substring(3); // Remove 'G:/'
            return `/media/${encodeURIComponent(relativePath)}`;
        } else if (normalizedPath.startsWith('G:PROJECT ')) {
            // PC-BIM02 style paths - use /media/PROJECT BIM 2025/ prefix
            // Remove the G: prefix and construct relative path
            const relativePath = normalizedPath.substring(2); // Remove 'G:'
            return `/media/PROJECT%20BIM%202025/${encodeURIComponent(relativePath)}`;
        } else if (normalizedPath.startsWith('\\\\pc-bim02\\')) {
            // Network path format - convert to /media/PROJECT BIM 2025/
            const relativePath = normalizedPath.substring(11); // Remove '\\pc-bim02\'''
            return `/media/PROJECT%20BIM%202025/${encodeURIComponent(relativePath)}`;
        } else if (normalizedPath.startsWith('X:/')) {
            // X drive paths (PC-BIM02 mounted) - use /media/PROJECT BIM 2025/
            const relativePath = normalizedPath.substring(3); // Remove 'X:/'
            return `/media/PROJECT%20BIM%202025/${encodeURIComponent(relativePath)}`;
        } else if (normalizedPath.includes('PC-BIM02') || normalizedPath.includes('PROJECT BIM 2025')) {
            // Handle PC-BIM02 local paths - use /media/PROJECT BIM 2025/
            // Extract relative path from PC-BIM02 directory
            const pcBim02Index = normalizedPath.indexOf('PC-BIM02');
            if (pcBim02Index !== -1) {
                const relativePath = normalizedPath.substring(pcBim02Index + 9); // Remove 'PC-BIM02'
                return `/media/PROJECT%20BIM%202025/${encodeURIComponent(relativePath.replace(/^\/+/, ''))}`;
            }
            // If contains PROJECT BIM 2025, extract the project part
            const projectIndex = normalizedPath.indexOf('PROJECT BIM 2025');
            if (projectIndex !== -1) {
                const relativePath = normalizedPath.substring(projectIndex + 16); // Remove 'PROJECT BIM 2025'
                return `/media/PROJECT%20BIM%202025/${encodeURIComponent(relativePath.replace(/^\/+/, ''))}`;
            }
        }

        // Fallback - if path already looks like a URL, return as-is
        if (normalizedPath.startsWith('/media')) {
            return normalizedPath;
        }

        // Last resort - assume it's a relative path from G drive

        return `/media/${encodeURIComponent(normalizedPath)}`;
    }

    showCurrentMedia() {
        if (this.currentMediaList.length === 0) return;

        const media = this.currentMediaList[this.currentMediaIndex];
        this.currentProject = media.project;

        // Update title footer based on media type
        let titleText;
        if (media.tagline) {
            // Tagged media
            titleText = `${media.tagline}`;
        } else {
            // Legacy project media
            titleText = `${media.project.name} - ${media.project.city} (${media.project.year})`;
        }

        // Set title in footer instead of header
        if (this.mediaTitleFooter) {
            this.mediaTitleFooter.textContent = titleText;
        }

        // Show loading
        this.viewerMediaLoading.style.display = 'flex';
        this.viewerVideo.style.display = 'none';
        this.viewerImage.style.display = 'none';

        if (media.type === 'video') {
            this.showVideo(media);
        } else {
            this.showImage(media);
        }

        this.updateNavigationButtons();
    }

    setupVideoOverlay() {
        if (!this.viewerVideo || !this.videoOverlay || !this.centerPlayPauseBtn) {

            return;
        }

        // Get the viewer content container (parent of overlay and video)
        const viewerContent = this.videoOverlay.parentElement;
        if (!viewerContent) {

            return;
        }

        // Show overlay on viewer content hover
        viewerContent.addEventListener('mouseenter', () => {
            if (this.isVideoMode) {
                this.videoOverlay.classList.add('visible');
            }
        });

        // Hide overlay when mouse leaves viewer content area
        viewerContent.addEventListener('mouseleave', () => {
            // Only hide if video is playing (keep visible when paused)
            if (this.isVideoMode && !this.viewerVideo.paused) {
                this.videoOverlay.classList.remove('visible');
            }
        });

        // Hide overlay when clicking anywhere on viewer content
        viewerContent.addEventListener('click', (e) => {
            // Don't hide if clicking on the center button itself
            if (!e.target.closest('.play-pause-center')) {
                this.videoOverlay.classList.remove('visible');
            }
        });

        // Center play/pause button functionality
        this.centerPlayPauseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Prevent any default video controls from interfering
            e.stopImmediatePropagation();

            try {
                if (this.viewerVideo.paused) {
                    const playPromise = this.viewerVideo.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            this.centerPlayIcon.className = 'fas fa-pause';
                        }).catch(error => {

                        });
                    } else {
                        this.centerPlayIcon.className = 'fas fa-pause';
                    }
                } else {
                    this.viewerVideo.pause();
                    this.centerPlayIcon.className = 'fas fa-play';
                }

                // Hide overlay after interaction (keep visible when paused)
                if (!this.viewerVideo.paused) {
                    setTimeout(() => {
                        if (this.videoOverlay) {
                            this.videoOverlay.classList.remove('visible');
                        }
                    }, 500);
                }
            } catch (error) {

            }

            return false;
        });

        // Update center button icon when video state changes
        this.viewerVideo.addEventListener('play', () => {
            this.centerPlayIcon.className = 'fas fa-pause';
            // Auto-collapse sidebar when video starts playing
            this.autoCollapseSidebar();
            // Hide overlay when video starts playing
            this.videoOverlay.classList.remove('visible');
        });

        this.viewerVideo.addEventListener('pause', () => {
            this.centerPlayIcon.className = 'fas fa-play';
            // Show overlay when video is paused
            this.videoOverlay.classList.add('visible');
        });

        this.viewerVideo.addEventListener('ended', () => {
            this.centerPlayIcon.className = 'fas fa-play';
            // Show overlay when video ends
            this.videoOverlay.classList.add('visible');
        });


    }

    autoCollapseSidebar() {
        // Auto-collapse sidebar when media starts playing to avoid interference
        if (this.sidebar && this.sidebar.classList.contains('show')) {

            this.sidebar.classList.remove('show');
        }
    }

    showVideo(media) {
        this.isVideoMode = true;
        this.viewerVideo.style.display = 'block';
        this.viewerVideo.src = media.url;

        // Reset center button to play icon
        if (this.centerPlayIcon) {
            this.centerPlayIcon.className = 'fas fa-play';
        }

        // Show overlay initially for paused video
        if (this.videoOverlay) {
            this.videoOverlay.classList.add('visible');
        }

        this.viewerVideo.onloadeddata = () => {
            this.viewerMediaLoading.style.display = 'none';

            // Keep overlay visible for a moment after loading
            setTimeout(() => {
                if (!this.viewerVideo.paused && this.videoOverlay) {
                    this.videoOverlay.classList.remove('visible');
                }
            }, 1500);
        };

        this.viewerVideo.onerror = (e) => {
            // Make video visible even on error
            this.viewerVideo.style.opacity = '1';
            this.viewerMediaLoading.innerHTML = `<p>Video tidak dapat dimuat</p><small>URL: ${media.url}</small>`;

            // Hide overlay on error
            if (this.videoOverlay) {
                this.videoOverlay.classList.remove('visible');
            }
        };

        this.viewerVideo.onabort = () => {
            this.viewerVideo.style.opacity = '1';
        };

        this.viewerVideo.onstalled = () => {
            this.viewerVideo.style.opacity = '1';
        };
    }

    showImage(media) {

        this.isVideoMode = false;
        this.viewerImage.style.display = 'block';
        this.viewerImage.src = media.url;



        this.viewerImage.onload = () => {

            this.viewerMediaLoading.style.display = 'none';
        };

        this.viewerImage.onerror = (e) => {


        };
        // Make image visible even on error
        this.viewerImage.style.opacity = '1';
        this.viewerMediaLoading.innerHTML = `<p>Gambar tidak dapat dimuat</p><small>URL: ${media.url}</small>`;

    };

    showNextMedia() {
        if (this.currentMediaList.length === 0) return;

        this.currentMediaIndex = (this.currentMediaIndex + 1) % this.currentMediaList.length;
        this.showCurrentMedia();
    }

    showPreviousMedia() {
        if (this.currentMediaList.length === 0) return;

        this.currentMediaIndex = this.currentMediaIndex === 0 ?
            this.currentMediaList.length - 1 : this.currentMediaIndex - 1;
        this.showCurrentMedia();
    }

    updateNavigationButtons() {
        const hasMultiple = this.currentMediaList.length > 1;
        if (this.viewerPrevBtn) {
            this.viewerPrevBtn.style.display = hasMultiple ? 'block' : 'none';
        }
        if (this.viewerNextBtn) {
            this.viewerNextBtn.style.display = hasMultiple ? 'block' : 'none';
        }
    }

    updateSidebarActiveState() {
        // Remove active class from all items
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current category
        const activeItem = document.querySelector(
            `.sidebar-item[data-type="${this.currentCategory.type}"][data-category="${this.currentCategory.category}"]`
        );
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    updateSidebarWithCurrentInfo() {
        if (!this.sidebarContent) return;

        // Get current media count for the active category
        const currentCount = this.currentMediaList.length;
        const categoryName = this.currentCategory.category;

        // Update the sidebar item to show the count
        const activeItem = document.querySelector(`.sidebar-item[data-category="${categoryName}"]`);
        if (activeItem) {
            const metaElement = activeItem.querySelector('.sidebar-item-meta');
            if (metaElement) {
                // Show count for current category
                metaElement.textContent = `${currentCount} media item${currentCount !== 1 ? 's' : ''}`;
            }
        }

        // Update active state
        this.updateSidebarActiveState();
    }

    toggleGroup(groupId) {


        const groupContent = document.querySelector(`.sidebar-group-content[data-group="${groupId}"]`);
        const toggleIcon = document.querySelector(`.sidebar-group-header[data-group="${groupId}"] .group-toggle-icon`);

        if (groupContent && toggleIcon) {
            const isExpanded = groupContent.style.display !== 'none';

            if (isExpanded) {
                // Collapse
                groupContent.style.display = 'none';
                toggleIcon.style.transform = 'rotate(0deg)';

            } else {
                // Expand
                groupContent.style.display = 'block';
                toggleIcon.style.transform = 'rotate(180deg)';

            }
        } else {

        }
    }

    updateViewerSidebar() {
        // For Knowledgehub, use the combined sidebar instead of switching modes
        this.updateSidebarWithCurrentInfo();
    }

    showError(message) {

        // Could show error modal or toast here
    }
}

// Initialize showroom when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if required elements exist
    const sidebar = document.getElementById('showroomSidebar');
    const sidebarContent = document.getElementById('sidebarContent');
    const viewerContainer = document.getElementById('mediaViewerContainer');

    if (!sidebar) {
        return;
    }

    if (!sidebarContent) {
        return;
    }

    // Initialize the showroom player
    window.showroomPlayer = new BIMShowroomPlayer();
});
        return;
