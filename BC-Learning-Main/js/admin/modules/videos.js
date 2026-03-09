/**
 * Videos Module - Handles video tagging and management system
 * CRUD operations for video organization and categorization
 */
class VideosModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.allVideos = [];
        this.currentSelectedVideo = null;
        this.savedTags = {};
        this.customCategories = [];
    }

    getAuthHeaders(extraHeaders = {}) {
        const headers = { ...extraHeaders };
        const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
        if (token && !headers.Authorization && !headers.authorization) {
            headers.Authorization = `Bearer ${token}`;
        }
        return headers;
    }

    authFetch(url, options = {}) {
        return fetch(url, {
            ...options,
            headers: this.getAuthHeaders(options.headers || {}),
            credentials: 'include'
        });
    }

    /**
     * Initialize the videos module
     */
    initialize() {
        console.log('🎥 Initializing Videos Module');
        this.setupEventListeners();
        this.loadPersistentData();
    }

    /**
     * Setup event listeners for video-related elements
     */
    setupEventListeners() {
        // Video search and filter inputs
        const searchInput = document.getElementById('videoSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', () => this.filterVideoTags());
        }

        const categoryFilter = document.getElementById('videoCategoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.filterVideoTags());
        }

        const tagStatusFilter = document.getElementById('videoTagStatusFilter');
        if (tagStatusFilter) {
            tagStatusFilter.addEventListener('change', () => this.filterVideoTags());
        }

        const sortFilter = document.getElementById('videoSortFilter');
        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.filterVideoTags());
        }

        // Scan sources button
        const scanBtn = document.querySelector('button[onclick*="scanVideoSources"]');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanVideoSources());
        }

        // Refresh videos button
        const refreshBtn = document.querySelector('button[onclick*="refreshVideos"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshVideos());
        }
    }

    /**
     * Load persistent data from server/localStorage
     */
    async loadPersistentData() {
        await this.loadSavedTags();
        await this.loadCustomCategories();

        // Check if migration is needed (localStorage data exists but server is empty)
        await this.checkAndMigrateLocalStorageData();

        this.applyCustomCategoriesToDropdown();
        this.updateVideoCategoryFilter();
    }

    /**
     * Check and migrate localStorage data to persistent storage
     */
    async checkAndMigrateLocalStorageData() {
        try {
            // Check if we have localStorage data but server returned empty
            const localTags = localStorage.getItem('bcl_video_tags');
            const localCategories = localStorage.getItem('bcl_custom_categories');

            if ((localTags || localCategories) && Object.keys(this.savedTags).length === 0 && this.customCategories.length === 0) {
                console.log('🔄 Found localStorage data that needs migration...');

                const migrationData = {
                    videoTags: localTags ? JSON.parse(localTags) : {},
                    customCategories: localCategories ? JSON.parse(localCategories) : []
                };

                // Try to migrate to server
                const response = await this.authFetch('/api/admin/videos/migrate-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(migrationData)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Migration successful:', result);

                    // Reload data from server
                    await this.loadSavedTags();
                    await this.loadCustomCategories();

                    // Show success message
                    this.showMigrationSuccessMessage(result.migrated);

                } else {
                    console.warn('⚠️ Migration failed, keeping localStorage data');
                }
            }
        } catch (error) {
            console.error('❌ Error during migration check:', error);
        }
    }

    /**
     * Show migration success message
     */
    showMigrationSuccessMessage(migrated) {
        const message = `✅ Video tagging data migrated successfully!\n\n` +
            `📹 Videos: ${migrated.videoTags}\n` +
            `🏷️ Categories: ${migrated.customCategories}\n\n` +
            `Your tagging data is now safely stored persistently.`;

        // Show as alert for now (could be improved with a better notification system)
        setTimeout(() => {
            alert(message);
        }, 1000);
    }

    /**
     * Load saved tags from server (with localStorage fallback)
     */
    async loadSavedTags() {
        try {
            // Try to load from server first
            console.log('📡 Loading video tags from server...');
            const response = await this.authFetch('/api/admin/videos/tags');

            if (response.ok) {
                const data = await response.json();

                // Handle different response formats
                if (data.videoTags) {
                    // Server response format
                    this.savedTags = data.videoTags;
                    console.log('✅ Loaded video tags from server:', Object.keys(this.savedTags).length, 'videos');
                } else if (Array.isArray(data)) {
                    // Alternative format
                    this.savedTags = {};
                    data.forEach(item => {
                        if (item.video_id) {
                            this.savedTags[item.video_id] = {
                                videoId: item.video_id,
                                category: item.category,
                                bimLevel: item.bim_level,
                                duration: item.duration,
                                language: item.language,
                                description: item.description,
                                tags: item.tags || [],
                                updated_at: item.updated_at
                            };
                        }
                    });
                    console.log('✅ Loaded video tags from database:', Object.keys(this.savedTags).length, 'videos');
                }
            } else {
                console.warn('⚠️ Server not available for video tags, falling back to localStorage');
                // Fallback to localStorage
                const saved = localStorage.getItem('bcl_video_tags');
                if (saved) {
                    this.savedTags = JSON.parse(saved);
                    console.log('📂 Loaded saved tags from localStorage:', Object.keys(this.savedTags).length, 'videos');
                } else {
                    this.savedTags = {};
                }
            }
        } catch (error) {
            console.error('❌ Error loading saved tags from server:', error);
            // Final fallback to localStorage
            try {
                const saved = localStorage.getItem('bcl_video_tags');
                if (saved) {
                    this.savedTags = JSON.parse(saved);
                    console.log('📂 Loaded saved tags from localStorage (fallback):', Object.keys(this.savedTags).length, 'videos');
                } else {
                    this.savedTags = {};
                }
            } catch (localError) {
                console.error('❌ Error loading from localStorage:', localError);
                this.savedTags = {};
            }
        }
    }

    /**
     * Load custom categories from server (with localStorage fallback)
     */
    async loadCustomCategories() {
        try {
            // Try to load from server first
            console.log('📡 Loading custom categories from server...');
            const response = await this.authFetch('/api/admin/videos/categories');

            if (response.ok) {
                const categories = await response.json();

                // Handle different response formats
                if (Array.isArray(categories)) {
                    this.customCategories = categories.map(cat => ({
                        name: cat.name || cat.displayName,
                        value: cat.value,
                        created_at: cat.created_at
                    }));
                    console.log('✅ Loaded custom categories from server:', this.customCategories.length, 'categories');
                }
            } else {
                console.warn('⚠️ Server not available for categories, falling back to localStorage');
                // Fallback to localStorage
                const saved = localStorage.getItem('bcl_custom_categories');
                if (saved) {
                    this.customCategories = JSON.parse(saved);
                    console.log('📂 Loaded custom categories from localStorage:', this.customCategories.length, 'categories');
                } else {
                    this.customCategories = [];
                }
            }
        } catch (error) {
            console.error('❌ Error loading custom categories from server:', error);
            // Final fallback to localStorage
            try {
                const saved = localStorage.getItem('bcl_custom_categories');
                if (saved) {
                    this.customCategories = JSON.parse(saved);
                    console.log('📂 Loaded custom categories from localStorage (fallback):', this.customCategories.length, 'categories');
                } else {
                    this.customCategories = [];
                }
            } catch (localError) {
                console.error('❌ Error loading from localStorage:', localError);
                this.customCategories = [];
            }
        }
    }

    /**
     * Apply custom categories to dropdown
     */
    applyCustomCategoriesToDropdown() {
        const select = document.getElementById('videoCategory');
        if (select) {
            // Remove existing custom categories first
            const existingCustomOptions = select.querySelectorAll('option[data-custom="true"]');
            existingCustomOptions.forEach(option => option.remove());

            // Add custom categories
            this.customCategories.forEach(category => {
                const newOption = document.createElement('option');
                newOption.value = category.value;
                newOption.textContent = category.displayName;
                newOption.setAttribute('data-custom', 'true');
                select.appendChild(newOption);
            });
        }

        console.log('✅ Applied', this.customCategories.length, 'custom categories to dropdowns');
    }

    /**
     * Update video category filter dropdown with custom categories
     */
    updateVideoCategoryFilter() {
        const filterSelect = document.getElementById('videoCategoryFilter');
        if (!filterSelect) return;

        // Remove existing custom categories from filter
        const existingCustomOptions = filterSelect.querySelectorAll('option[data-custom="true"]');
        existingCustomOptions.forEach(option => option.remove());

        // Add custom categories to filter
        this.customCategories.forEach(category => {
            const newOption = document.createElement('option');
            newOption.value = category.value;
            newOption.textContent = category.displayName;
            newOption.setAttribute('data-custom', 'true');
            filterSelect.appendChild(newOption);
        });

        console.log('✅ Updated video category filter with', this.customCategories.length, 'custom categories');
    }

    /**
     * Save tags to localStorage
     */
    saveTagsToStorage() {
        try {
            localStorage.setItem('bcl_video_tags', JSON.stringify(this.savedTags));
            console.log('💾 Saved tags to localStorage:', Object.keys(this.savedTags).length, 'videos');
        } catch (error) {
            console.error('❌ Error saving tags to localStorage:', error);
        }
    }

    /**
     * Apply saved tags to videos
     */
    applySavedTagsToVideos(videos) {
        console.log('🔄 Applying saved tags to videos...');
        let taggedCount = 0;

        videos.forEach(video => {
            const videoTags = this.savedTags[video.id];
            if (videoTags) {
                // Apply saved tags to video object
                Object.assign(video, videoTags);
                video.tagged = true;
                video.localSave = true; // Mark as locally saved
                taggedCount++;
                console.log('✅ Applied tags to video:', video.id, video.name);
            } else {
                // Ensure video has default values if no tags saved
                video.category = video.category || 'general';
                video.bimLevel = video.bimLevel || 'beginner';
                video.tagged = false;
            }
        });

        console.log('📊 Applied saved tags to', taggedCount, 'videos');
        return videos;
    }

    /**
     * Scan video sources
     */
    async scanVideoSources() {
        console.log('🔄 Scanning video sources...');

        const gridContainer = document.getElementById('videosGrid');
        gridContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted">Scanning video sources...</p>
                </div>
            </div>`;

        try {
            // Try to get videos from the tutorials API
            const response = await fetch('/api/tutorials');
            console.log('📡 Video scan API response:', response.status, response.statusText);

            if (response.ok) {
                const videos = await response.json();
                console.log('✅ Videos scanned successfully:', videos.length, 'videos');

                // Transform video data for tagging
                const transformedVideos = videos.map(video => ({
                    id: video.id || Math.random().toString(36).substr(2, 9),
                    name: video.name || video.title || 'Unknown Video',
                    path: video.path || video.url || '',
                    size: video.size || 'Unknown',
                    category: video.category || 'general',
                    tags: video.tags || [],
                    bimLevel: video.bimLevel || 'beginner',
                    duration: video.duration || 0,
                    language: video.language || 'id',
                    description: video.description || '',
                    views: video.viewCount || video.views || 0,
                    tagged: video.tags && video.tags.length > 0,
                    thumbnail: video.thumbnail || '',
                    created_at: video.created_at, // Don't fallback to current date
                    date: video.date // Keep original date field
                }));

                this.allVideos = transformedVideos;

                // Apply saved tags to videos
                const videosWithSavedTags = this.applySavedTagsToVideos(transformedVideos);

                this.displayVideos(videosWithSavedTags);

                // Update total videos count badge
                this.updateTotalVideosCount(transformedVideos.length);

                console.log('✅ Video sources scanned and displayed');
            } else {
                const errorText = await response.text();
                console.error('❌ Video scan API failed:', response.status, errorText);
                gridContainer.innerHTML = `
                    <div class="col-12">
                        <div class="text-center py-5">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Failed to scan video sources: ${response.status} ${response.statusText}
                            </div>
                        </div>
                    </div>`;
            }
        } catch (error) {
            console.error('❌ Error scanning video sources:', error);
            gridContainer.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error scanning video sources: ${error.message}
                        </div>
                    </div>`;
        }
    }

    /**
     * Refresh videos
     */
    async refreshVideos() {
        if (this.allVideos.length === 0) {
            await this.scanVideoSources();
        } else {
            this.displayVideos(this.allVideos);
        }
    }

    /**
     * Display videos
     */
    displayVideos(videos) {
        const gridContainer = document.getElementById('videosGrid');

        if (videos.length === 0) {
            gridContainer.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <i class="fas fa-video fa-3x text-muted mb-3"></i>
                        <p class="text-muted">No videos found</p>
                        <button class="btn btn-primary" onclick="window.adminPanel.modules.get('videos').instance.scanVideoSources()">
                            <i class="fas fa-search me-2"></i>Scan Video Sources
                        </button>
                    </div>
                </div>`;
            return;
        }

        let html = '';

        videos.forEach((video, index) => {
            const videoId = video.id;
            const videoName = video.name;
            const videoCategory = video.category;
            const videoTags = video.tags || [];
            const videoViews = video.views || 0;
            const isTagged = video.tagged || videoTags.length > 0;

            // Category badge color
            const categoryColors = {
                'autocad': 'primary',
                'revit': 'info',
                'sketchup': 'success',
                '3dsmax': 'warning',
                'lumion': 'danger',
                'general': 'secondary',
                'tutorial': 'dark',
                'advanced': 'light'
            };
            const categoryColor = categoryColors[videoCategory.toLowerCase()] || 'secondary';

            // BIM level badge
            const bimLevelColors = {
                'beginner': 'success',
                'intermediate': 'warning',
                'advanced': 'danger',
                'expert': 'dark'
            };
            const bimLevelColor = bimLevelColors[video.bimLevel.toLowerCase()] || 'secondary';

            html += `
                <div class="col-md-6 col-lg-6 mb-4">
                    <div class="card video-card ${isTagged ? 'border-success' : ''}" style="height: 100%;">
                        <div class="card-body p-3">
                            <div class="row align-items-center">
                                <!-- Left Column: Video Information -->
                                <div class="col-md-8">
                                    <div class="d-flex align-items-start mb-3">
                                        <i class="fas fa-video text-warning me-3 fa-lg"></i>
                                        <div class="flex-grow-1">
                                            <h6 class="card-title mb-2" title="${videoName}">${videoName}</h6>
                                            <div class="mb-2">
                                                <span class="badge bg-${categoryColor} me-2">${videoCategory}</span>
                                                <span class="badge bg-${bimLevelColor}">${video.bimLevel}</span>
                                                ${isTagged ? '<span class="badge bg-success ms-2"><i class="fas fa-check me-1"></i>Tagged</span>' : '<span class="badge bg-secondary ms-2">Untagged</span>'}
                                            </div>
                                            <small class="text-muted d-block mb-2">
                                                <i class="fas fa-eye me-1"></i>${videoViews} views
                                            </small>

                                            ${videoTags.length > 0 ? `
                                                <div class="mb-2">
                                                    <small class="text-muted d-block mb-1">Tags:</small>
                                                    <div>
                                                        ${videoTags.slice(0, 4).map(tag => `<span class="badge bg-light text-dark me-1 mb-1">${tag}</span>`).join('')}
                                                        ${videoTags.length > 4 ? `<span class="badge bg-light text-dark">+${videoTags.length - 4}</span>` : ''}
                                                    </div>
                                                </div>
                                            ` : '<small class="text-muted d-block">No tags assigned</small>'}
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Column: Thumbnail Preview -->
                                <div class="col-md-4 text-center">
                                    <div class="video-preview-container mx-auto" onclick="window.adminPanel.modules.get('videos').instance.openVideoPreviewModal('${videoId}', '${videoName.replace(/'/g, "\\'")}', '${JSON.stringify(video).replace(/'/g, "\\'")}')" style="cursor: pointer;">
                                        ${video.thumbnail ? `<img src="${video.thumbnail}" class="video-thumbnail" alt="${videoName}" onerror="this.style.display='none'">` : ''}
                                        <div class="video-overlay">
                                            <i class="fas fa-play-circle fa-2x text-white"></i>
                                        </div>
                                    </div>
                                    <small class="text-muted d-block mt-2">Click to preview</small>
                                </div>
                            </div>

                            <!-- Bottom: Action Buttons -->
                            <div class="row mt-3">
                                <div class="col-12">
                                    <hr class="my-2">
                                    <div class="d-flex justify-content-center gap-2">
                                        <button class="btn btn-sm btn-outline-primary" onclick="window.adminPanel.modules.get('videos').instance.openVideoTagModal('${videoId}')" title="Tag Video">
                                            <i class="fas fa-tag me-1"></i> Tag Video
                                        </button>
                                        <button class="btn btn-sm btn-outline-info" onclick="window.adminPanel.modules.get('videos').instance.viewVideoDetails('${videoId}')" title="View Details">
                                            <i class="fas fa-eye me-1"></i> Details
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="window.adminPanel.modules.get('videos').instance.removeVideoTags('${videoId}')" title="Remove Tags">
                                            <i class="fas fa-times me-1"></i> Remove Tags
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        gridContainer.innerHTML = html;
    }

    /**
     * Open video preview modal
     */
    openVideoPreviewModal(videoId, videoName, videoDataStr) {
        console.log('Opening video preview modal for:', videoName);
        try {
            const videoData = JSON.parse(videoDataStr);
            console.log('Video data:', videoData);

            // Create video preview modal HTML
            let modalHtml = '<div class="modal fade" id="videoPreviewModal" tabindex="-1">';
            modalHtml += '<div class="modal-dialog modal-xl">';
            modalHtml += '<div class="modal-content">';
            modalHtml += '<div class="modal-header">';
            modalHtml += '<h5 class="modal-title">';
            modalHtml += '<i class="fas fa-video me-2"></i>Video Preview: ' + videoName;
            modalHtml += '</h5>';
            modalHtml += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>';
            modalHtml += '</div>';
            modalHtml += '<div class="modal-body">';
            modalHtml += '<div class="text-center">';

            // Add thumbnail if available
            if (videoData.thumbnail) {
                modalHtml += '<img src="' + videoData.thumbnail + '" class="img-fluid mb-3" alt="' + videoName + '" style="max-height: 300px;">';
            }

            // Add video player
            modalHtml += '<div class="video-player-container bg-dark rounded p-2">';
            modalHtml += '<video id="videoPlayer" controls class="w-100" style="max-height: 500px;"';
            if (videoData.thumbnail) {
                modalHtml += ' poster="' + videoData.thumbnail + '"';
            }
            modalHtml += '>';

            // Use constructTaggedMediaUrl for consistent URL construction
            const videoUrl = this.constructTaggedMediaUrl(videoData.name || 'video', 'video', videoData.path || videoData.url);
            // Add debug info
            modalHtml += '<div class="mt-2 small text-muted">';
            modalHtml += '<strong>Debug URL:</strong> ' + videoUrl;
            modalHtml += '</div>';
            modalHtml += '<source src="' + videoUrl + '" type="video/mp4">';
            modalHtml += '<source src="' + videoUrl + '" type="video/webm">';
            modalHtml += '<source src="' + videoUrl + '" type="video/ogg">';
            modalHtml += 'Your browser does not support the video tag.';
            modalHtml += '</video>';
            modalHtml += '</div>';

            // Add debug info
            modalHtml += '<div class="mt-2 small text-muted">';
            modalHtml += '<strong>Debug:</strong> URL: ' + videoUrl;
            modalHtml += '</div>';

            // Add metadata
            modalHtml += '<div class="mt-3">';
            modalHtml += '<p class="text-muted mb-2">' + (videoData.description || 'No description available') + '</p>';
            modalHtml += '<div class="row text-center">';
            modalHtml += '<div class="col-md-3">';
            modalHtml += '<small class="text-muted">Category</small><br>';
            modalHtml += '<strong>' + (videoData.category || 'N/A') + '</strong>';
            modalHtml += '</div>';
            modalHtml += '<div class="col-md-3">';
            modalHtml += '<small class="text-muted">BIM Level</small><br>';
            modalHtml += '<strong>' + (videoData.bimLevel || 'N/A') + '</strong>';
            modalHtml += '</div>';
            modalHtml += '<div class="col-md-3">';
            modalHtml += '<small class="text-muted">Views</small><br>';
            modalHtml += '<strong>' + (videoData.views || 0) + '</strong>';
            modalHtml += '</div>';
            modalHtml += '<div class="col-md-3">';
            modalHtml += '<small class="text-muted">Tags</small><br>';
            modalHtml += '<strong>' + ((videoData.tags || []).length) + ' tags</strong>';
            modalHtml += '</div>';
            modalHtml += '</div>';
            modalHtml += '</div>';
            modalHtml += '</div>';
            modalHtml += '</div>';

            // Add footer with buttons
            modalHtml += '<div class="modal-footer">';
            modalHtml += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">';
            modalHtml += '<i class="fas fa-times me-1"></i>Close';
            modalHtml += '</button>';
            modalHtml += '<button type="button" class="btn btn-primary" onclick="window.adminPanel.modules.get(\'videos\').instance.openVideoTagModal(\'' + videoId + '\', \'' + videoName.replace(/'/g, '\\\'') + '\', \'' + videoDataStr.replace(/'/g, '\\\'') + '\')">';
            modalHtml += '<i class="fas fa-tag me-1"></i>Tag This Video';
            modalHtml += '</button>';
            modalHtml += '</div>';
            modalHtml += '</div>';
            modalHtml += '</div>';
            modalHtml += '</div>';

            // Remove existing modal if any
            const existingModal = document.getElementById('videoPreviewModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            console.log('Modal HTML added to body');

            // Show modal
            const modalElement = document.getElementById('videoPreviewModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
                console.log('Modal shown successfully');

                // Auto-load video when modal opens
                modal._element.addEventListener('shown.bs.modal', function () {
                    const video = document.getElementById('videoPlayer');
                    if (video) {
                        console.log('Loading video:', video.src);
                        video.load();
                    } else {
                        console.error('Video player element not found');
                    }
                });

                // Stop video when modal closes
                modal._element.addEventListener('hidden.bs.modal', function () {
                    const video = document.getElementById('videoPlayer');
                    if (video) {
                        video.pause();
                        video.currentTime = 0;
                    }
                });
            } else {
                console.error('Modal element not found after creation');
            }

        } catch (error) {
            console.error('Error opening video preview modal:', error);
            alert('Error loading video preview: ' + error.message);
        }
    }

    /**
     * Category Management Functions
     */
    toggleCustomCategory() {
        const customDiv = document.getElementById('customCategoryDiv');
        const input = document.getElementById('customCategoryInput');

        if (customDiv.classList.contains('d-none')) {
            // Show custom category input
            customDiv.classList.remove('d-none');
            input.focus();
            input.value = '';
        } else {
            // Hide custom category input
            customDiv.classList.add('d-none');
            input.value = '';
        }
    }

    addCustomCategory() {
        const input = document.getElementById('customCategoryInput');
        const categoryName = input.value.trim();

        if (!categoryName) {
            alert('Please enter a category name');
            input.focus();
            return;
        }

        // Check if category already exists
        const select = document.getElementById('videoCategory');
        const existingOptions = Array.from(select.options).map(opt => opt.value.toLowerCase());

        if (existingOptions.includes(categoryName.toLowerCase())) {
            alert('This category already exists');
            input.focus();
            return;
        }

        // Validate category name (no special characters, reasonable length)
        if (categoryName.length < 2 || categoryName.length > 50) {
            alert('Category name must be between 2 and 50 characters');
            input.focus();
            return;
        }

        if (!/^[a-zA-Z0-9\s\-&()]+$/.test(categoryName)) {
            alert('Category name can only contain letters, numbers, spaces, hyphens, ampersands, and parentheses');
            input.focus();
            return;
        }

        // Create category object
        const newCategory = {
            value: categoryName.toLowerCase().replace(/\s+/g, '-'),
            displayName: categoryName
        };

        // Add to custom categories array
        this.customCategories.push(newCategory);

        // Save to localStorage
        this.saveCustomCategoriesToStorage();

        // Add new category to dropdown
        const newOption = document.createElement('option');
        newOption.value = newCategory.value;
        newOption.textContent = newCategory.displayName;
        newOption.setAttribute('data-custom', 'true');
        select.appendChild(newOption);

        // Select the new category
        select.value = newCategory.value;

        // Hide custom category input and show success
        document.getElementById('customCategoryDiv').classList.add('d-none');
        input.value = '';

        // Show success message
        alert('✅ New category "' + categoryName + '" added successfully and saved!');

        console.log('New category added and saved:', newCategory);
    }

    cancelCustomCategory() {
        const customDiv = document.getElementById('customCategoryDiv');
        const input = document.getElementById('customCategoryInput');

        customDiv.classList.add('d-none');
        input.value = '';
    }

    saveCustomCategoriesToStorage() {
        try {
            localStorage.setItem('bcl_custom_categories', JSON.stringify(this.customCategories));
            console.log('💾 Saved custom categories to localStorage:', this.customCategories.length, 'categories');
        } catch (error) {
            console.error('❌ Error saving custom categories to localStorage:', error);
        }
    }

    /**
     * Open video tag modal
     */
    openVideoTagModal(videoId) {
        console.log('Opening video tag modal for ID:', videoId);
        console.log('Available videos in allVideos:', this.allVideos.length);

        try {
            // Find video data from global array
            const videoData = this.allVideos.find(v => v.id == videoId);
            console.log('Found video data:', videoData);

            if (!videoData) {
                console.error('Video not found in allVideos array');
                console.log('Available video IDs:', this.allVideos.map(v => v.id));
                alert('Video not found. Please refresh the page and try again.');
                return;
            }

            this.currentSelectedVideo = videoData;

            // Populate the tagging modal
            document.getElementById('selectedVideoName').textContent = videoData.name || 'Unknown Video';
            document.getElementById('selectedVideoPath').textContent = videoData.path || videoData.url || 'N/A';

            // Pre-fill form with existing data
            document.getElementById('videoCategory').value = videoData.category || '';
            document.getElementById('videoBimLevel').value = videoData.bimLevel || '';
            document.getElementById('videoDuration').value = videoData.duration || '';
            document.getElementById('videoLanguage').value = videoData.language || 'id';
            document.getElementById('videoDescription').value = videoData.description || '';
            document.getElementById('videoTags').value = (videoData.tags || []).join(', ');

            // Display previously used tags
            this.displayPreviouslyUsedTags();

            // Hide custom category input when opening modal
            document.getElementById('customCategoryDiv').classList.add('d-none');
            document.getElementById('customCategoryInput').value = '';

            // Close video details modal if it's open
            const detailsModal = document.getElementById('videoDetailsModal');
            if (detailsModal && detailsModal.classList.contains('show')) {
                const bsDetailsModal = bootstrap.Modal.getInstance(detailsModal);
                if (bsDetailsModal) {
                    bsDetailsModal.hide();
                }
            }

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('videoTagModal'));
            modal.show();
            console.log('Video tag modal opened successfully');

            // Highlight selected card (only if event context exists)
            if (event && event.currentTarget) {
                const selectedCard = event.currentTarget.closest('.video-card');
                if (selectedCard) {
                    document.querySelectorAll('.video-card').forEach(card => {
                        card.classList.remove('border-primary', 'bg-light');
                    });
                    selectedCard.classList.add('border-primary', 'bg-light');
                }
            }

        } catch (error) {
            console.error('Error opening video tag modal:', error);
            alert('Error loading video data for tagging: ' + error.message);
        }
    }

    /**
     * Display previously used tags in modal
     */
    displayPreviouslyUsedTags() {
        const previousTags = this.getPreviouslyUsedTags();
        const container = document.getElementById('previousTagsContainer');
        const section = document.getElementById('previousTagsSection');

        if (previousTags.length === 0) {
            section.classList.add('d-none');
            return;
        }

        let html = '';
        previousTags.forEach(tag => {
            html += `<button type="button" class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="window.adminPanel.modules.get('videos').instance.addTagToInput('${tag}')">${tag}</button>`;
        });

        container.innerHTML = html;
        section.classList.remove('d-none');
    }

    /**
     * Get all previously used tags
     */
    getPreviouslyUsedTags() {
        const allTags = new Set();

        // Collect tags from all saved videos
        Object.values(this.savedTags).forEach(videoTags => {
            if (videoTags.tags && Array.isArray(videoTags.tags)) {
                videoTags.tags.forEach(tag => {
                    if (tag && tag.trim()) {
                        allTags.add(tag.trim().toLowerCase());
                    }
                });
            }
        });

        // Convert to sorted array
        return Array.from(allTags).sort();
    }

    /**
     * Add tag to input field
     */
    addTagToInput(tag) {
        const input = document.getElementById('videoTags');
        const currentValue = input.value.trim();

        // Check if tag is already in the input
        const currentTags = currentValue ? currentValue.split(',').map(t => t.trim().toLowerCase()) : [];
        if (currentTags.includes(tag.toLowerCase())) {
            return; // Tag already exists
        }

        // Add tag to input
        const newValue = currentValue ? currentValue + ', ' + tag : tag;
        input.value = newValue;

        // Focus input
        input.focus();
    }

    /**
     * Save video tags
     */
    async saveVideoTags() {
        if (!this.currentSelectedVideo) {
            alert('No video selected');
            return;
        }

        const tagData = {
            videoId: this.currentSelectedVideo.id,
            category: document.getElementById('videoCategory').value,
            bimLevel: document.getElementById('videoBimLevel').value,
            duration: document.getElementById('videoDuration').value,
            language: document.getElementById('videoLanguage').value,
            description: document.getElementById('videoDescription').value.trim(),
            tags: document.getElementById('videoTags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
        };

        // Validation
        if (!tagData.category || !tagData.bimLevel) {
            alert('Please fill in at least Category and BIM Level');
            return;
        }

        try {
            console.log('💾 Saving video tags:', tagData);

            // Try to save to server API
            const response = await this.authFetch('/api/admin/videos/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tagData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Server save successful:', result);
                alert('✅ Video tags saved successfully to persistent storage!');

                // Update local video data
                const videoIndex = this.allVideos.findIndex(v => v.id === this.currentSelectedVideo.id);
                if (videoIndex !== -1) {
                    this.allVideos[videoIndex] = {
                        ...this.allVideos[videoIndex],
                        ...tagData,
                        tagged: true,
                        serverSave: true // Mark as server saved
                    };
                }

                // Update saved tags cache
                this.savedTags[this.currentSelectedVideo.id] = tagData;
                this.saveTagsToStorage(); // Also save to localStorage as backup

                // Close modal and refresh display
                const modal = bootstrap.Modal.getInstance(document.getElementById('videoTagModal'));
                if (modal) modal.hide();

                this.displayVideos(this.allVideos);

                // Clear selection
                this.currentSelectedVideo = null;

            } else {
                const responseText = await response.text();
                console.error('❌ Server response error:', response.status, responseText);

                // Check if API endpoint exists but returned error
                if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>')) {
                    console.log('📝 API endpoint not available, saving to localStorage only...');
                    alert('⚠️ Server not available. Tags saved locally.\n\nNote: Tags will persist in browser but may be lost if you clear browser data.');

                    // Save to localStorage only
                    const videoIndex = this.allVideos.findIndex(v => v.id === this.currentSelectedVideo.id);
                    if (videoIndex !== -1) {
                        this.allVideos[videoIndex] = {
                            ...this.allVideos[videoIndex],
                            ...tagData,
                            tagged: true,
                            localSave: true
                        };
                    }

                    this.savedTags[this.currentSelectedVideo.id] = tagData;
                    this.saveTagsToStorage();

                    const modal = bootstrap.Modal.getInstance(document.getElementById('videoTagModal'));
                    if (modal) modal.hide();

                    this.displayVideos(this.allVideos);
                    this.currentSelectedVideo = null;

                    return;
                }

                // Try to parse as JSON error
                try {
                    const error = JSON.parse(responseText);
                    alert('❌ Failed to save video tags: ' + (error.error || 'Unknown error'));
                } catch (jsonError) {
                    alert('❌ Server error. Tags saved locally.');
                    console.log('📝 Saving locally due to server error...');

                    // Save locally as fallback
                    const videoIndex = this.allVideos.findIndex(v => v.id === this.currentSelectedVideo.id);
                    if (videoIndex !== -1) {
                        this.allVideos[videoIndex] = {
                            ...this.allVideos[videoIndex],
                            ...tagData,
                            tagged: true,
                            localSave: true
                        };
                    }

                    this.savedTags[this.currentSelectedVideo.id] = tagData;
                    this.saveTagsToStorage();

                    const modal = bootstrap.Modal.getInstance(document.getElementById('videoTagModal'));
                    if (modal) modal.hide();

                    this.displayVideos(this.allVideos);
                    this.currentSelectedVideo = null;
                }
            }

        } catch (error) {
            console.error('❌ Network error saving video tags:', error);

            // Fallback: save to localStorage only
            console.log('📝 Network error, saving to localStorage...');
            alert('⚠️ Network error. Tags saved locally.\n\nNote: Tags will persist in browser but may be lost if you clear browser data.');

            // Update local video data
            const videoIndex = this.allVideos.findIndex(v => v.id === this.currentSelectedVideo.id);
            if (videoIndex !== -1) {
                this.allVideos[videoIndex] = {
                    ...this.allVideos[videoIndex],
                    ...tagData,
                    tagged: true,
                    localSave: true
                };
            }

            // Save to localStorage
            this.savedTags[this.currentSelectedVideo.id] = tagData;
            this.saveTagsToStorage();

            // Close modal and refresh display
            const modal = bootstrap.Modal.getInstance(document.getElementById('videoTagModal'));
            if (modal) modal.hide();

            this.displayVideos(this.allVideos);
            this.currentSelectedVideo = null;

            console.log('✅ Tags saved to localStorage due to network error');
        }
    }

    /**
     * Filter videos
     */
    filterVideoTags() {
        const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase().trim();
        const categoryFilter = document.getElementById('videoCategoryFilter').value;
        const tagStatusFilter = document.getElementById('videoTagStatusFilter').value;
        const sortFilter = document.getElementById('videoSortFilter').value;

        let filteredVideos = this.allVideos.filter(video => {
            const videoName = (video.name || '').toLowerCase();
            const videoCategory = video.category || '';
            const videoTags = video.tags || [];
            const isTagged = video.tagged || videoTags.length > 0;

            // Search filter
            const matchesSearch = !searchTerm ||
                videoName.includes(searchTerm) ||
                videoTags.some(tag => tag.toLowerCase().includes(searchTerm));

            // Category filter
            const matchesCategory = !categoryFilter || videoCategory === categoryFilter;

            // Tag status filter
            let matchesTagStatus = true;
            if (tagStatusFilter === 'tagged') {
                matchesTagStatus = isTagged;
            } else if (tagStatusFilter === 'untagged') {
                matchesTagStatus = !isTagged;
            }

            return matchesSearch && matchesCategory && matchesTagStatus;
        });

        // Sort videos
        filteredVideos.sort((a, b) => {
            switch (sortFilter) {
                case 'name':
                    return (a.name || '').localeCompare(b.name || '');
                case 'category':
                    return (a.category || '').localeCompare(b.category || '');
                case 'views':
                    return (b.views || 0) - (a.views || 0);
                case 'newest':
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                default:
                    return 0;
            }
        });

        this.displayVideos(filteredVideos);

        // Update filter results count
        this.updateVideoFilterResults(filteredVideos.length, this.allVideos.length);
    }

    /**
     * Clear video filters
     */
    clearVideoFilters() {
        document.getElementById('videoSearchInput').value = '';
        document.getElementById('videoCategoryFilter').value = '';
        document.getElementById('videoTagStatusFilter').value = '';
        document.getElementById('videoSortFilter').value = 'name';

        this.displayVideos(this.allVideos);
    }

    /**
     * Update video filter results information
     */
    updateVideoFilterResults(filteredCount, totalCount) {
        let resultsInfo = '';
        if (filteredCount !== totalCount) {
            resultsInfo = `<div class="alert alert-info py-2 mt-3">
                <i class="fas fa-filter me-2"></i>
                Showing ${filteredCount} of ${totalCount} videos
            </div>`;
        }

        // Insert results info before the videos grid
        const container = document.getElementById('videosGrid');
        const existingAlert = container.querySelector('.alert');

        if (existingAlert) {
            existingAlert.remove();
        }

        if (resultsInfo) {
            container.insertAdjacentHTML('afterbegin', resultsInfo);
        }
    }

    /**
     * Update total videos count
     */
    updateTotalVideosCount(count) {
        const badge = document.getElementById('totalVideosCount');
        if (badge) {
            badge.innerHTML = `<i class="fas fa-video me-1"></i>Total: ${count} videos`;
        }
    }

    /**
     * View video details
     */
    viewVideoDetails(videoId) {
        const video = this.allVideos.find(v => v.id === videoId);
        if (!video) {
            alert('Video not found');
            return;
        }

        // Create details modal
        const modalHtml = `
            <div class="modal fade" id="videoDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-video me-2"></i>Video Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <h6>Video Information</h6>
                                    <table class="table table-sm">
                                        <tr><td><strong>ID:</strong></td><td style="word-wrap: break-word; max-width: 200px;">${video.id}</td></tr>
                                        <tr><td><strong>Name:</strong></td><td style="word-wrap: break-word; max-width: 200px;">${video.name}</td></tr>
                                        <tr><td><strong>Category:</strong></td><td><span class="badge bg-primary">${video.category}</span></td></tr>
                                        <tr><td><strong>BIM Level:</strong></td><td><span class="badge bg-info">${video.bimLevel}</span></td></tr>
                                        <tr><td><strong>Views:</strong></td><td>${video.views || 0}</td></tr>
                                        <tr><td><strong>Duration:</strong></td><td>${video.duration || 'N/A'} min</td></tr>
                                        <tr><td><strong>Language:</strong></td><td>${video.language || 'N/A'}</td></tr>
                                    </table>
                                </div>
                                <div class="col-md-6">
                                    <h6>Tags & Description</h6>
                                    ${video.tags && video.tags.length > 0 ? `
                                        <div class="mb-3">
                                            <strong>Tags:</strong>
                                            <div class="mt-1">
                                                ${video.tags.map(tag => `<span class="badge bg-light text-dark me-1">${tag}</span>`).join('')}
                                            </div>
                                        </div>
                                    ` : '<p class="text-muted">No tags assigned</p>'}

                                    ${video.description ? `
                                        <div>
                                            <strong>Description:</strong>
                                            <p class="mt-1">${video.description}</p>
                                        </div>
                                    ` : '<p class="text-muted">No description available</p>'}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="window.adminPanel.modules.get('videos').instance.openVideoTagModal('${videoId}')">Edit Tags</button>
                        </div>
                    </div>
                </div>`;

        // Remove existing modal if any
        const existingModal = document.getElementById('videoDetailsModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('videoDetailsModal'));
        modal.show();
    }

    /**
     * Remove video tags
     */
    async removeVideoTags(videoId) {
        if (!confirm('Are you sure you want to remove all tags from this video?')) {
            return;
        }

        try {
            const response = await this.authFetch(`/api/admin/videos/tags/${videoId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('✅ Video tags removed successfully!');

                // Update local video data
                const videoIndex = this.allVideos.findIndex(v => v.id === videoId);
                if (videoIndex !== -1) {
                    this.allVideos[videoIndex].tags = [];
                    this.allVideos[videoIndex].tagged = false;
                    this.allVideos[videoIndex].category = 'general';
                    this.allVideos[videoIndex].bimLevel = 'beginner';
                }

                this.displayVideos(this.allVideos);

            } else {
                const error = await response.json();
                alert('❌ Failed to remove video tags: ' + (error.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error removing video tags:', error);
            alert('❌ Error removing video tags: ' + error.message);
        }
    }

    /**
     * Export tagged videos
     */
    exportTaggedVideos() {
        const taggedVideos = this.allVideos.filter(video => video.tagged || (video.tags && video.tags.length > 0));

        if (taggedVideos.length === 0) {
            alert('No tagged videos to export');
            return;
        }

        // Create CSV content
        const headers = ['ID', 'Name', 'Category', 'BIM Level', 'Duration', 'Language', 'Views', 'Tags', 'Description'];
        const csvContent = [
            headers.join(','),
            ...taggedVideos.map(video => [
                video.id,
                `"${video.name.replace(/"/g, '""')}"`,
                video.category,
                video.bimLevel,
                video.duration || '',
                video.language || '',
                video.views || 0,
                `"${(video.tags || []).join('; ')}"`,
                `"${(video.description || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tagged-videos-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert(`✅ Exported ${taggedVideos.length} tagged videos successfully!`);
    }

    /**
     * Construct tagged media URL
     */
    constructTaggedMediaUrl(filename, type, fullPath) {
        // Handle different file path formats and construct proper URLs
        if (!fullPath) return `/media/${encodeURIComponent(filename)}`;

        // Decode URL-encoded path first (e.g., G%3A -> G:) - multiple times if needed
        let normalizedPath = fullPath;
        try {
            // Keep decoding until no more changes (handles double/triple encoding)
            let decoded;
            do {
                decoded = decodeURIComponent(normalizedPath);
                if (decoded === normalizedPath) break;
                normalizedPath = decoded;
            } while (true);
        } catch (e) {
            // If decoding fails, use original path
            normalizedPath = fullPath;
        }

        normalizedPath = normalizedPath.replace(/\\/g, '/');

        // Extract year from path (e.g., "PROJECT BIM 2020" -> "2020")
        let year = '2025'; // Default fallback
        const yearMatch = normalizedPath.match(/PROJECT\s+BIM\s+(\d{4})/i);
        if (yearMatch) {
            year = yearMatch[1];
        }

        // Handle different source patterns
        if (normalizedPath.startsWith('G:/')) {
            // Local G drive paths - remove G:/ prefix and add /media/ prefix
            const relativePath = normalizedPath.substring(3); // Remove 'G:/'
            return `/media/${encodeURIComponent(relativePath)}`;
        } else if (normalizedPath.startsWith('G:PROJECT BIM ')) {
            // PC-BIM02 style paths - extract year and relative path correctly
            // Format: G:PROJECT BIM 2020 02. Project Name.mp4
            const projectMatch = normalizedPath.match(/G:PROJECT\s+BIM\s+(\d{4})\s+(.+)/i);
            if (projectMatch) {
                const extractedYear = projectMatch[1];
                const relativePath = projectMatch[2]; // Get everything after the year
                console.log('Parsed path:', { extractedYear, relativePath });
                return `/media/PROJECT%20BIM%20${extractedYear}/${encodeURIComponent(relativePath)}`;
            }
            // If regex doesn't match, try simpler approach
            console.log('Regex failed for path:', normalizedPath);
            const relativePath = normalizedPath.substring(2); // Remove 'G:'
            return `/media/PROJECT%20BIM%20${year}/${encodeURIComponent(relativePath)}`;
        } else if (normalizedPath.startsWith('\\\\pc-bim02\\')) {
            // Network path format - convert to /media/PROJECT BIM YYYY/
            const relativePath = normalizedPath.substring(11); // Remove '\\pc-bim02\''
            return `/media/PROJECT%20BIM%20${year}/${encodeURIComponent(relativePath.replace(/^\/+/, ''))}`;
        } else if (normalizedPath.startsWith('X:/')) {
            // X drive paths (PC-BIM02 mounted) - use /media/PROJECT BIM YYYY/
            const relativePath = normalizedPath.substring(3); // Remove 'X:/'
            return `/media/PROJECT%20BIM%20${year}/${encodeURIComponent(relativePath.replace(/^\/+/, ''))}`;
        } else if (normalizedPath.includes('PC-BIM02')) {
            // Handle PC-BIM02 local paths - extract relative path after PC-BIM02
            const pcBim02Index = normalizedPath.indexOf('PC-BIM02');
            if (pcBim02Index !== -1) {
                const relativePath = normalizedPath.substring(pcBim02Index + 9); // Remove 'PC-BIM02'
                return `/media/PROJECT%20BIM%20${year}/${encodeURIComponent(relativePath.replace(/^\/+/, ''))}`;
            }
        } else if (normalizedPath.includes('PROJECT BIM')) {
            // Handle paths that contain "PROJECT BIM" - extract year and relative path
            const projectMatch = normalizedPath.match(/PROJECT\s+BIM\s+(\d{4})(.*)/i);
            if (projectMatch) {
                const extractedYear = projectMatch[1];
                const relativePath = projectMatch[2].replace(/^[\s\/]+/, ''); // Remove leading spaces/slashes
                return `/media/PROJECT%20BIM%20${extractedYear}/${encodeURIComponent(relativePath)}`;
            }
        }

        // Fallback - if path already looks like a URL, return as-is
        if (normalizedPath.startsWith('/media')) {
            return normalizedPath;
        }

        // Last resort - assume it's a relative path
        return `/media/${encodeURIComponent(normalizedPath)}`;
    }
}

// Initialize and register the videos module immediately when script loads
(function() {
    console.log('🎥 Initializing Videos Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - videos module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - videos module cannot initialize');
        return;
    }

    try {
        // Create videos module instance
        const videosModule = new VideosModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('videos', {
            loaded: true,
            path: 'modules/videos.js',
            instance: videosModule
        });

        // Initialize the module
        videosModule.initialize();

        console.log('✅ Videos module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize videos module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideosModule;
}
