/**
 * Video Information Display System
 * Replaces owl carousel with dynamic video carousel + news overlays + stats sidebar
 * @version 1.0.0
 * @author BCL Development Team
 */

class VideoInfoDisplay {
    constructor(options = {}) {
        this.options = {
            containerId: 'video-info-display',
            videoContainerId: 'video-carousel',
            newsContainerId: 'news-overlays',
            sidebarContainerId: 'display-sidebar',
            statsContainerId: 'display-stats',
            autoRotate: false,
            rotationInterval: 30, // seconds
            newsUpdateInterval: 300, // seconds
            maxVideos: 10,
            showNews: true,
            fallbackImages: [
                './img/carousel-1.jpg',
                './img/carousel-2.jpg',
                './img/carousel-3.jpg'
            ],
            ...options
        };

        this.videos = [];
        this.news = [];
        this.currentVideoIndex = 0;
        this.currentNewsIndex = 0;
        this.isPlaying = true; // Default to autoplay
        this.rotationTimer = null;
        this.newsTimer = null;
        this.isInitialized = false;

        // DOM elements
        this.container = null;
        this.videoContainer = null;
        this.newsContainer = null;
        this.sidebarContainer = null;
        this.statsContainer = null;

    }

    /**
     * Initialize the display system
     */
    async init() {
        try {

            // Find containers
            this.container = document.getElementById(this.options.containerId);
            if (!this.container) {
                throw new Error(`Container element '${this.options.containerId}' not found`);
            }

            // Create sub-containers if they don't exist
            this.createContainers();

            // Load initial data
            await this.loadData();

            // Setup event listeners
            this.setupEventListeners();

            // Start display
            this.startDisplay();

            this.isInitialized = true;

        } catch (error) {
            this.showFallbackDisplay(error.message);
        }
    }

    /**
     * Create necessary container elements
     */
    createContainers() {
        const container = this.container;

        // Clear existing content
        container.innerHTML = '';

        // Create main layout structure
        const layoutHtml = `
            <div class="video-info-layout">
                <!-- Video Section (70%) -->
                <div class="video-section" id="${this.options.videoContainerId}">
                    <div class="video-wrapper">
                        <video class="display-video" autoplay muted playsinline preload="metadata">
                            <source src="" type="video/mp4">
                            Your browser does not support video playback.
                        </video>
                        <iframe id="youtube-player" class="display-video" style="display:none; border:none;" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                        <div class="video-overlay">
                            <div class="play-pause-btn" id="playPauseBtn">
                                <i class="fas fa-play"></i>
                            </div>
                        </div>
                        <div class="video-loading" id="videoLoading">
                            <div class="spinner-border text-light" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p class="mt-2">Loading video...</p>
                        </div>
                    </div>

                    <!-- Video Controls -->
                    <div class="video-controls" id="videoControls">
                        <button class="control-btn" id="prevBtn" title="Previous Video">
                            <i class="fas fa-chevron-left"></i>
                        </button>

                        <div class="control-info">
                            <span class="video-title" id="currentVideoTitle">Loading...</span>
                            <div class="progress-bar">
                                <div class="progress-fill" id="progressFill"></div>
                            </div>
                        </div>

                        <button class="control-btn" id="nextBtn" title="Next Video">
                            <i class="fas fa-chevron-right"></i>
                        </button>

                        <button class="control-btn" id="muteBtn" title="Toggle Mute">
                            <i class="fas fa-volume-up"></i>
                        </button>

                        <button class="control-btn" id="fullscreenBtn" title="Fullscreen">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </div>

                <!-- News Overlays (Top & Bottom) -->
                <div class="news-overlays" id="${this.options.newsContainerId}">
                    <!-- Top News Bar -->
                    <div class="news-bar top-news" id="topNewsBar">
                        <div class="news-scroll">
                            <div class="news-items" id="topNewsItems">
                                <!-- News items will be populated here -->
                            </div>
                        </div>
                    </div>

                    <!-- Bottom News Bar -->
                    <div class="news-bar bottom-news" id="bottomNewsBar">
                        <div class="news-scroll">
                            <div class="news-items" id="bottomNewsItems">
                                <!-- News items will be populated here -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sidebar (15-25%) -->
                <div class="sidebar-section" id="${this.options.sidebarContainerId}">
                    <!-- Stats Cards -->
                    <div class="stats-cards" id="${this.options.statsContainerId}">
                        <!-- Stats will be populated here -->
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = layoutHtml;

        // Get references to created elements
        this.videoContainer = document.getElementById(this.options.videoContainerId);
        this.newsContainer = document.getElementById(this.options.newsContainerId);
        this.sidebarContainer = document.getElementById(this.options.sidebarContainerId);
        this.statsContainer = document.getElementById(this.options.statsContainerId);

    }

    /**
     * Load videos and news data
     */
    async loadData() {

        try {
            // Load videos and news in parallel
            const [videosResponse, newsResponse] = await Promise.allSettled([
                this.loadVideos(),
                this.loadNews()
            ]);

            // Process videos
            if (videosResponse.status === 'fulfilled') {
                this.videos = videosResponse.value;
            } else {
                this.videos = [];
            }

            // Process news
            if (newsResponse.status === 'fulfilled') {
                this.news = newsResponse.value;
            } else {
                this.news = this.getFallbackNews();
            }

            // Load stats
            await this.loadStats();

        } catch (error) {
            throw error;
        }
    }

    /**
     * Load selected videos for display
     */
    async loadVideos() {
        const response = await fetch('/api/video-display/selected');

        if (!response.ok) {
            throw new Error(`Videos API failed: ${response.status}`);
        }

        const data = await response.json();

        // Update settings from server
        if (data.settings) {
            this.options = { ...this.options, ...data.settings };
        }

        const videos = data.videos || [];

        if (videos.length === 0) {

            // Try to load all available videos as fallback
            try {
                const fallbackResponse = await fetch('/api/tutorials');
                if (fallbackResponse.ok) {
                    const allVideos = await fallbackResponse.json();
                    const fallbackVideos = allVideos.slice(0, 10); // Take first 10 videos
                    return fallbackVideos;
                }
            } catch (fallbackError) {
            }
        }

        return videos;
    }

    /**
     * Load BIM news for overlays
     */
    async loadNews() {
        try {
            const stamp = Date.now();
            const [allNewsResult, localNewsResult] = await Promise.allSettled([
                this.fetchNewsArray(`/api/news/all-news?_ts=${stamp}`),
                this.fetchNewsArray(`/api/news/local-news?_ts=${stamp}`)
            ]);

            if (allNewsResult.status === 'rejected') {
            }
            if (localNewsResult.status === 'rejected') {
            }

            const allNews = allNewsResult.status === 'fulfilled' ? allNewsResult.value : [];
            const localNews = localNewsResult.status === 'fulfilled' ? localNewsResult.value : [];
            const mergedNews = this.mergeNewsSources(allNews, localNews);

            if (mergedNews.length === 0) {
                throw new Error('No news items available from API');
            }

            mergedNews.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
            return mergedNews.slice(0, 10);
        } catch (error) {
            return this.getFallbackNews();
        }
    }

    async fetchNewsArray(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`News API failed: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid news payload');
        }

        return data;
    }

    mergeNewsSources(primaryNews, secondaryNews) {
        const combined = [...primaryNews, ...secondaryNews];
        const deduped = [];
        const seen = new Set();

        for (const article of combined) {
            const key = this.buildNewsKey(article);
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(article);
        }

        return deduped;
    }

    buildNewsKey(article) {
        const id = String(article?.id || '').trim();
        if (id) return `id:${id}`;

        const url = String(article?.url || '').trim().toLowerCase();
        if (url && url !== '#') return `url:${url}`;

        const title = String(article?.title || '').trim().toLowerCase();
        const sourceName = String(article?.source?.name || article?.source || '').trim().toLowerCase();
        const publishedAt = String(article?.publishedAt || article?.published_date || '').trim().toLowerCase();
        return `fallback:${title}|${sourceName}|${publishedAt}`;
    }

    /**
     * Get fallback news when API fails
     */
    getFallbackNews() {
        return [
            {
                title: "BIM Central Learning Update",
                description: "Platform pembelajaran BIM terdepan di Indonesia",
                source: { name: "BCL" },
                publishedAt: new Date().toISOString(),
                category: "Update"
            },
            {
                title: "Teknologi BIM 2025",
                description: "Inovasi terbaru dalam dunia Building Information Modeling",
                source: { name: "Industry" },
                publishedAt: new Date().toISOString(),
                category: "Technology"
            },
            {
                title: "Pelatihan BIM Gratis",
                description: "Akses kursus BIM berkualitas tanpa biaya",
                source: { name: "Education" },
                publishedAt: new Date().toISOString(),
                category: "Education"
            }
        ];
    }

    /**
     * Load statistics for sidebar
     */
    async loadStats() {
        try {
            // Homepage must stay on public endpoints only.
            const statsPromises = await Promise.allSettled([
                fetch('/api/tutorials').then(r => r.ok ? r.json() : null),
                fetch('/api/courses').then(r => r.ok ? r.json() : null),
                fetch('/api/user-activity/public').then(r => r.ok ? r.json() : null)
            ]);

            const videos = (statsPromises[0].status === 'fulfilled' && Array.isArray(statsPromises[0].value))
                ? statsPromises[0].value
                : null;
            const courses = (statsPromises[1].status === 'fulfilled' && Array.isArray(statsPromises[1].value))
                ? statsPromises[1].value
                : null;
            const userActivity = (statsPromises[2].status === 'fulfilled' && statsPromises[2].value)
                ? statsPromises[2].value
                : null;

            const totalUsers = this.parseNumeric(
                userActivity?.totalUsers ??
                userActivity?.registeredUsers ??
                userActivity?.totalRegisteredUsers
            );
            const totalVideos = videos ? videos.length : null;
            const totalCourses = courses ? courses.length : null;

            // Active users from public activity endpoint.
            let activeUsers = this.parseNumeric(userActivity?.totalActiveUsers);

            const completionRate = this.computeAverageFromKeys(courses, ['completionRate', 'completion_rate']);
            const avgRating = this.computeAverageFromKeys(
                (videos || []).concat(courses || []),
                ['avgRating', 'averageRating', 'rating', 'rate']
            );

            this.stats = {
                totalUsers,
                totalVideos,
                totalCourses,
                activeUsers,
                completionRate,
                avgRating
            };


        } catch (error) {
            this.stats = {
                totalUsers: null,
                totalVideos: null,
                totalCourses: null,
                activeUsers: null,
                completionRate: null,
                avgRating: null
            };
        }
    }

    parseNumeric(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.replace(',', '.').replace(/[^0-9.\-]/g, '');
            const parsed = Number.parseFloat(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    computeAverageFromKeys(items, keys) {
        if (!Array.isArray(items) || items.length === 0 || !Array.isArray(keys) || keys.length === 0) {
            return null;
        }

        const values = [];
        for (const item of items) {
            for (const key of keys) {
                const value = this.parseNumeric(item?.[key]);
                if (value !== null) {
                    values.push(value);
                    break;
                }
            }
        }

        if (values.length === 0) return null;
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        return Math.round(avg * 10) / 10;
    }

    formatCount(value) {
        return Number.isFinite(value) ? Math.round(value) : 'N/A';
    }

    formatPercent(value) {
        return Number.isFinite(value) ? `${value}%` : 'N/A';
    }

    formatRating(value) {
        return Number.isFinite(value) ? `${value.toFixed(1)}/5` : 'N/A';
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Video controls
        const playPauseBtn = document.getElementById('playPauseBtn');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const muteBtn = document.getElementById('muteBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousVideo());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextVideo());
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleMute());
        }

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Video element events
        const videoElement = this.videoContainer.querySelector('.display-video');
        if (videoElement) {
            videoElement.addEventListener('loadeddata', () => this.onVideoLoaded());
            videoElement.addEventListener('canplay', () => this.onVideoLoaded());
            videoElement.addEventListener('ended', () => this.onVideoEnded());
            videoElement.addEventListener('error', (e) => this.onVideoError(e));
            videoElement.addEventListener('timeupdate', () => this.updateProgress());
        }

    }

    /**
     * Start the display system
     */
    startDisplay() {
        if (this.videos.length > 0) {
            this.showVideo(0);
        } else {
            this.showFallbackDisplay('No videos available');
        }

        if (this.options.showNews && this.news.length > 0) {
            this.startNewsRotation();
        }

        this.updateStatsDisplay();

        if (this.options.autoRotate && this.videos.length > 1) {
            this.startVideoRotation();
        }

    }

    /**
     * Show video at specific index
     */
    showVideo(index) {
        if (!this.videos || this.videos.length === 0) {
            this.showFallbackDisplay('No videos available');
            return;
        }

        if (index < 0) index = this.videos.length - 1;
        if (index >= this.videos.length) index = 0;

        this.currentVideoIndex = index;
        const video = this.videos[index];


        const videoElement = this.videoContainer.querySelector('video.display-video');
        const iframeElement = document.getElementById('youtube-player');
        const titleElement = document.getElementById('currentVideoTitle');
        const loadingElement = document.getElementById('videoLoading');

        // Show loading
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }

        // Update title
        if (titleElement) {
            titleElement.textContent = video.name || 'Untitled Video';
        }

        // Check if YouTube
        const isYouTube = video.path.includes('youtube.com') || video.path.includes('youtu.be');

        if (isYouTube) {
            // Handle YouTube
            if (videoElement) {
                videoElement.pause();
                videoElement.style.display = 'none';
            }
            
            if (iframeElement) {
                iframeElement.style.display = 'block';
                
                // Extract ID
                let videoId = '';
                if (video.path.includes('v=')) {
                    videoId = video.path.split('v=')[1].split('&')[0];
                } else if (video.path.includes('youtu.be/')) {
                    videoId = video.path.split('youtu.be/')[1].split('?')[0];
                }
                
                if (videoId) {
                    // Autoplay, Mute, No Controls, Loop
                    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&rel=0&showinfo=0&loop=1&playlist=${videoId}&enablejsapi=1`;
                    iframeElement.src = embedUrl;
                    
                    // Simulate loaded event for YouTube (iframe onload)
                    iframeElement.onload = () => {
                        this.onVideoLoaded();
                    };
                } else {
                    this.handleVideoLoadFailure(video, 'Invalid YouTube URL');
                }
            }
        } else {
            // Handle Local Video
            if (iframeElement) {
                iframeElement.style.display = 'none';
                iframeElement.src = '';
            }
            
            if (videoElement) {
                videoElement.style.display = 'block';
                
                // Clear previous source first
                videoElement.pause();
                videoElement.removeAttribute('src');
                videoElement.load();

                // Direct src assignment is more reliable for dynamic switching
                videoElement.src = video.path;

                // Set video attributes for better playback
                videoElement.muted = true; // Start muted for autoplay policy
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.preload = 'auto';

                videoElement.load();

                // Add timeout for slow loading videos
                this.loadTimeout = setTimeout(() => {
                    if (loadingElement && loadingElement.style.display !== 'none') {
                        this.handleVideoLoadFailure(video, 'Loading timeout');
                    }
                }, 60000); // 60 second timeout
            }
        }

        // Update active video indicator
        this.updateVideoIndicators();
    }

    /**
     * Handle video loaded event
     */
    onVideoLoaded() {
        // Clear loading timeout
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        const loadingElement = document.getElementById('videoLoading');
        const videoElement = this.videoContainer.querySelector('.display-video');

        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        if (videoElement && this.isPlaying) {
            videoElement.play().catch(e => {
                // Ignore aborts caused by rapid pause/switch
                if (e && e.name === 'AbortError') return;
                // If autoplay fails, show play button overlay
                const overlay = document.querySelector('.video-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    overlay.style.opacity = '1';
                }
            });
        }

    }

    /**
     * Handle video load failure with retry logic
     */
    handleVideoLoadFailure(video, reason) {

        // Clear loading timeout
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        const loadingElement = document.getElementById('videoLoading');

        if (loadingElement) {
            loadingElement.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                <p>Video tidak dapat dimuat</p>
                <small class="text-muted">${reason}</small>
                <small class="text-muted d-block mt-1">Beralih ke video berikutnya...</small>
            `;
            loadingElement.style.display = 'flex';
        }

        // Mark video as failed
        if (video) {
            video.failed = true;
            video.failReason = reason;
        }

        // Remove failed video from rotation
        const failedIndex = this.videos.findIndex(v => v === video || v.id === video?.id);
        if (failedIndex !== -1) {
            this.videos.splice(failedIndex, 1);

            // Adjust current index if needed
            if (this.currentVideoIndex >= failedIndex && this.currentVideoIndex > 0) {
                this.currentVideoIndex--;
            }
        }

        // Check if any videos remaining
        if (this.videos.length === 0) {
            this.showFallbackDisplay('Semua video gagal dimuat. Silakan cek koneksi atau format video.');
            return;
        }

        // Auto-advance to next video after delay
        setTimeout(() => {
            if (this.videos.length > 0) {
                this.nextVideo();
            }
        }, 2000);
    }

    /**
     * Handle video ended event
     */
    onVideoEnded() {
        if (this.options.autoRotate) {
            this.nextVideo();
        }
    }

    /**
     * Handle video error
     */
    onVideoError(error) {
        const currentVideo = this.videos[this.currentVideoIndex];

        // Log additional debugging info
        if (currentVideo) {
        }

        this.showFallbackForVideo();
    }

    /**
     * Show fallback for failed video
     */
    showFallbackForVideo() {
        const videoElement = this.videoContainer.querySelector('.display-video');
        const loadingElement = document.getElementById('videoLoading');

        if (loadingElement) {
            loadingElement.innerHTML = `
                <i class="fas fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                <p>Video unavailable</p>
                <small class="text-muted">Skipping to next video...</small>
            `;
            loadingElement.style.display = 'flex';
        }

        // Mark this video as failed and remove it from rotation
        const failedVideo = this.videos[this.currentVideoIndex];
        if (failedVideo) {
            this.videos.splice(this.currentVideoIndex, 1);

            // If no videos left, show fallback display
            if (this.videos.length === 0) {
                this.showFallbackDisplay('All videos failed to load');
                return;
            }

            // Adjust current index if needed
            if (this.currentVideoIndex >= this.videos.length) {
                this.currentVideoIndex = 0;
            }
        }

        // Auto-advance after 2 seconds (faster than before)
        setTimeout(() => {
            if (this.options.autoRotate && this.videos.length > 0) {
                this.nextVideo();
            }
        }, 2000);
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        const videoElement = this.videoContainer.querySelector('.display-video');
        const playPauseIcon = document.querySelector('#playPauseBtn i');

        if (!videoElement) return;

        if (videoElement.paused) {
            const playPromise = videoElement.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch((e) => {
                    // Ignore aborts caused by rapid pause/switch
                    if (e && e.name !== 'AbortError') {
                    }
                });
            }
            this.isPlaying = true;
            if (playPauseIcon) playPauseIcon.className = 'fas fa-pause';
        } else {
            videoElement.pause();
            this.isPlaying = false;
            if (playPauseIcon) playPauseIcon.className = 'fas fa-play';
        }
    }

    /**
     * Go to previous video
     */
    previousVideo() {
        this.showVideo(this.currentVideoIndex - 1);
    }

    /**
     * Go to next video
     */
    nextVideo() {
        this.showVideo(this.currentVideoIndex + 1);
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        const videoElement = this.videoContainer.querySelector('.display-video');
        const muteIcon = document.querySelector('#muteBtn i');

        if (!videoElement) return;

        videoElement.muted = !videoElement.muted;

        if (muteIcon) {
            muteIcon.className = videoElement.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
        }
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        const container = this.container;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Update progress bar
     */
    updateProgress() {
        const videoElement = this.videoContainer.querySelector('.display-video');
        const progressFill = document.getElementById('progressFill');

        if (videoElement && progressFill && videoElement.duration) {
            const progress = (videoElement.currentTime / videoElement.duration) * 100;
            progressFill.style.width = progress + '%';
        }
    }

    /**
     * Update video indicators
     */
    updateVideoIndicators() {
        // Could add video indicator dots here if needed
    }

    /**
     * Start news rotation
     */
    startNewsRotation() {
        this.updateNewsDisplay();

        if (this.options.newsUpdateInterval > 0) {
            this.newsTimer = setInterval(() => {
                this.rotateNews();
            }, this.options.newsUpdateInterval * 1000);
        }
    }

    /**
     * Update news display
     */
    updateNewsDisplay() {
        const topNewsItems = document.getElementById('topNewsItems');
        const bottomNewsItems = document.getElementById('bottomNewsItems');

        if (!topNewsItems || !bottomNewsItems) return;

        // Clear existing news
        topNewsItems.innerHTML = '';
        bottomNewsItems.innerHTML = '';

        // Add top news (first 3 items)
        const topNews = this.news.slice(0, 3);
        topNews.forEach((newsItem, index) => {
            const newsElement = this.createNewsElement(newsItem, index);
            topNewsItems.appendChild(newsElement);
        });

        // Add bottom news (stats/metrics)
        this.updateBottomNews();

    }

    /**
     * Create news element
     */
    createNewsElement(newsItem, index) {
        const newsDiv = document.createElement('div');
        newsDiv.className = 'news-item';
        const tickerText =
            newsItem.stickerText ||
            newsItem.mainSentence ||
            newsItem.description ||
            newsItem.title ||
            'No News';
        newsDiv.innerHTML = `
            <div class="news-content">
                <span class="news-title">${tickerText}</span>
                <span class="news-source">${newsItem.source?.name || 'Unknown'}</span>
            </div>
        `;

        // Add click handler to open news
        newsDiv.addEventListener('click', () => {
            if (newsItem.url && newsItem.url !== '#') {
                window.open(newsItem.url, '_blank');
            }
        });

        return newsDiv;
    }

    /**
     * Update bottom news (stats)
     */
    updateBottomNews() {
        const bottomNewsItems = document.getElementById('bottomNewsItems');
        if (!bottomNewsItems) return;

        const stats = this.stats || {};
        const totalUsersLabel = this.formatCount(stats.totalUsers);
        const activeUsersLabel = this.formatCount(stats.activeUsers);
        const totalCoursesLabel = this.formatCount(stats.totalCourses);
        const completionRateLabel = this.formatPercent(stats.completionRate);
        const totalVideosLabel = this.formatCount(stats.totalVideos);
        const ratingLabel = this.formatRating(stats.avgRating);

        bottomNewsItems.innerHTML = `
            <div class="news-item stats-item">
                <div class="news-content">
                    <span class="news-title">${totalUsersLabel} Users</span>
                    <span class="news-source">Active: ${activeUsersLabel}</span>
                </div>
            </div>
            <div class="news-item stats-item">
                <div class="news-content">
                    <span class="news-title">${totalCoursesLabel} Courses</span>
                    <span class="news-source">Completion: ${completionRateLabel}</span>
                </div>
            </div>
            <div class="news-item stats-item">
                <div class="news-content">
                    <span class="news-title">${totalVideosLabel} Videos</span>
                    <span class="news-source">Rating: ${ratingLabel}</span>
                </div>
            </div>
        `;
    }

    /**
     * Rotate news items
     */
    rotateNews() {
        // Rotate top news
        if (this.news.length > 3) {
            this.news.push(this.news.shift());
            this.updateNewsDisplay();
        }
    }

    /**
     * Start video rotation timer
     */
    startVideoRotation() {
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
        }

        this.rotationTimer = setInterval(() => {
            this.nextVideo();
        }, this.options.rotationInterval * 1000);

    }

    /**
     * Stop video rotation
     */
    stopVideoRotation() {
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
            this.rotationTimer = null;
        }
    }

    /**
     * Update stats display in sidebar
     */
    updateStatsDisplay() {
        if (!this.statsContainer) return;

        const stats = this.stats || {};
        const totalUsersLabel = this.formatCount(stats.totalUsers);
        const activeUsersLabel = this.formatCount(stats.activeUsers);
        const totalCoursesLabel = this.formatCount(stats.totalCourses);
        const totalVideosLabel = this.formatCount(stats.totalVideos);
        const completionRateLabel = this.formatPercent(stats.completionRate);
        const avgRatingLabel = Number.isFinite(stats.avgRating) ? stats.avgRating.toFixed(1) : 'N/A';

        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-users text-primary"></i>
                </div>
                <div class="stat-value">${totalUsersLabel}</div>
                <div class="stat-label">Total Users</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-user-check text-success"></i>
                </div>
                <div class="stat-value">${activeUsersLabel}</div>
                <div class="stat-label">Active Today</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-book text-info"></i>
                </div>
                <div class="stat-value">${totalCoursesLabel}</div>
                <div class="stat-label">Courses</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-video text-warning"></i>
                </div>
                <div class="stat-value">${totalVideosLabel}</div>
                <div class="stat-label">Videos</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-chart-line text-danger"></i>
                </div>
                <div class="stat-value">${completionRateLabel}</div>
                <div class="stat-label">Completion Rate</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-star text-warning"></i>
                </div>
                <div class="stat-value">${avgRatingLabel}</div>
                <div class="stat-label">Avg Rating</div>
            </div>
        `;

    }

    /**
     * Show fallback display when system fails
     */
    showFallbackDisplay(reason) {

        if (!this.container) return;

        this.container.innerHTML = `
            <div class="fallback-display">
                <div class="fallback-content">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <h4>Display System Unavailable</h4>
                    <p class="text-muted">${reason}</p>
                    <p class="text-muted">Showing static content instead</p>
                </div>
            </div>
        `;

        // Apply basic styling for fallback
        const fallbackStyle = document.createElement('style');
        fallbackStyle.textContent = `
            .fallback-display {
                height: 70vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 16px;
                margin: 2rem 0;
            }
            .fallback-content {
                text-align: center;
                padding: 2rem;
            }
        `;
        document.head.appendChild(fallbackStyle);
    }

    /**
     * Destroy the display system
     */
    destroy() {

        // Stop timers
        this.stopVideoRotation();
        if (this.newsTimer) {
            clearInterval(this.newsTimer);
            this.newsTimer = null;
        }

        // Stop video
        const videoElement = this.videoContainer?.querySelector('.display-video');
        if (videoElement) {
            videoElement.pause();
            videoElement.src = '';
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        this.isInitialized = false;
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentVideoIndex: this.currentVideoIndex,
            totalVideos: this.videos.length,
            totalNews: this.news.length,
            isPlaying: this.isPlaying,
            autoRotate: this.options.autoRotate,
            rotationInterval: this.options.rotationInterval,
            showNews: this.options.showNews
        };
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoInfoDisplay;
}

// Auto-initialize when DOM is ready (for direct script inclusion)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Look for container with data attribute
        const container = document.querySelector('[data-video-info-display]');
        if (container) {
            const options = {
                containerId: container.id,
                ...container.dataset
            };

            const display = new VideoInfoDisplay(options);
            display.init().catch(error => {
            });

            // Make instance available globally
            window.videoInfoDisplay = display;
        }
    });
}
