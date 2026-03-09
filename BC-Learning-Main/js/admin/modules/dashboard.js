/**
 * Dashboard Module - Handles dashboard statistics and quick actions
 */
class DashboardModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.statsCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.loading = false;
    }

    /**
     * Initialize the dashboard module
     */
    initialize() {
        console.log('📊 Initializing Dashboard Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for dashboard elements
     */
    setupEventListeners() {
        // Quick action buttons
        const quickActionButtons = document.querySelectorAll('[data-quick-action]');
        quickActionButtons.forEach(button => {
            button.addEventListener('click', (e) => this.handleQuickAction(e));
        });
    }

    /**
     * Load dashboard data
     */
    async load() {
        console.log('📊 Loading dashboard data');
        await this.loadStats();
        this.loadRecentActivity();
        this.updateSystemStatus();
    }

    /**
     * Load dashboard statistics with improved error handling and caching
     */
    async loadStats() {
        if (this.loading) {
            console.log('📊 Stats loading already in progress, skipping');
            return;
        }

        // Check cache first
        if (this.isCacheValid('stats')) {
            console.log('📊 Using cached statistics');
            this.updateStatsUI(this.statsCache.get('stats'));
            return;
        }

        this.loading = true;
        console.log('🔄 Loading dashboard statistics...');

        try {
            // Use Promise.allSettled to handle partial failures gracefully
            const [
                usersPromise,
                questionsPromise,
                videosPromise,
                taggedVideosPromise,
                pdfMaterialsPromise
            ] = await Promise.allSettled([
                this.fetchWithTimeout('/api/users/get-all', 10000),
                this.fetchWithTimeout('/api/questions', 10000),
                this.fetchWithTimeout('/api/tutorials', 10000),
                this.fetchWithTimeout('/api/admin/videos/stats', 10000),
                this.fetchWithTimeout('/api/admin/learning-materials/stats', 10000)
            ]);

            const stats = {
                users: this.processApiResponse(usersPromise, 'users'),
                questions: this.processApiResponse(questionsPromise, 'questions'),
                videos: this.processApiResponse(videosPromise, 'videos'),
                media: this.processApiResponse(taggedVideosPromise, 'media', 'totalTagged'),
                pdfMaterials: this.processApiResponse(pdfMaterialsPromise, 'pdfMaterials', 'totalMaterials'),
                lastUpdated: new Date().toISOString(),
                loadTime: Date.now()
            };

            // Cache the results
            this.statsCache.set('stats', stats);

            // Update UI
            this.updateStatsUI(stats);

            console.log('✅ Dashboard statistics loaded successfully');
            this.logStatsLoad('success', stats);

        } catch (error) {
            console.error('❌ Critical error loading dashboard stats:', error);
            this.handleStatsLoadError(error);
            this.logStatsLoad('error', null, error);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Process API response
     */
    processApiResponse(promiseResult, name, dataKey = 'length') {
        if (promiseResult.status === 'fulfilled') {
            const response = promiseResult.value;

            if (response.ok) {
                const data = response.json ? response.json() : response;
                const value = dataKey === 'length' ? (Array.isArray(data) ? data.length : 0) :
                           (typeof data === 'object' && data[dataKey] !== undefined ? data[dataKey] : 0);

                console.log(`✅ ${name}: ${value}`);
                return {
                    success: true,
                    value: value,
                    data: data,
                    timestamp: Date.now()
                };
            } else {
                console.error(`❌ ${name} API failed with status:`, response.status);
                return {
                    success: false,
                    error: `HTTP ${response.status}`,
                    timestamp: Date.now()
                };
            }
        } else {
            console.error(`❌ ${name} API rejected:`, promiseResult.reason);
            return {
                success: false,
                error: promiseResult.reason.message || 'Request failed',
                timestamp: Date.now()
            };
        }
    }

    /**
     * Update statistics UI elements
     */
    updateStatsUI(stats) {
        const statElements = {
            'user-count': stats.users,
            'question-count': stats.questions,
            'video-count': stats.videos,
            'media-count': stats.media,
            'pdf-count': stats.pdfMaterials
        };

        Object.entries(statElements).forEach(([elementId, stat]) => {
            const element = document.getElementById(elementId);
            if (element) {
                if (stat.success) {
                    element.textContent = stat.value;
                    element.classList.remove('text-muted', 'text-danger');
                    element.classList.add('text-success');
                } else {
                    element.textContent = 'N/A';
                    element.classList.remove('text-success');
                    element.classList.add('text-muted');
                    element.title = `Error: ${stat.error}`;
                }
            }
        });

        // Update last updated timestamp
        const lastUpdatedElement = document.getElementById('stats-last-updated');
        if (lastUpdatedElement) {
            const timeString = new Date(stats.lastUpdated).toLocaleTimeString('id-ID');
            lastUpdatedElement.textContent = `Last updated: ${timeString}`;
        }

        // Update refresh button state
        const refreshBtn = document.getElementById('refresh-stats-btn');
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Refresh Stats';
        }
    }

    /**
     * Handle statistics loading error
     */
    handleStatsLoadError(error) {
        // Set all stats to N/A
        const statElements = ['user-count', 'question-count', 'video-count', 'media-count', 'pdf-count'];
        statElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'N/A';
                element.classList.remove('text-success');
                element.classList.add('text-danger');
                element.title = 'Failed to load statistics';
            }
        });

        // Show error notification
        this.showErrorNotification('Failed to load dashboard statistics. Please try refreshing the page.');
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(key) {
        const cached = this.statsCache.get(key);
        if (!cached) return false;

        const age = Date.now() - cached.loadTime;
        return age < this.cacheTimeout;
    }

    /**
     * Clear statistics cache
     */
    clearStatsCache() {
        this.statsCache.clear();
        console.log('🧹 Statistics cache cleared');
    }

    /**
     * Refresh statistics (force reload)
     */
    async refreshStats() {
        console.log('🔄 Force refreshing statistics...');
        this.clearStatsCache();
        await this.loadStats();

        // Show success feedback
        const refreshBtn = document.getElementById('refresh-stats-btn');
        if (refreshBtn) {
            const originalHtml = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-check me-2"></i>Refreshed!';
            refreshBtn.disabled = true;

            setTimeout(() => {
                refreshBtn.innerHTML = originalHtml;
                refreshBtn.disabled = false;
            }, 2000);
        }
    }

    /**
     * Load recent activity data
     */
    async loadRecentActivity() {
        try {
            // This would typically fetch recent admin actions, user registrations, etc.
            // For now, we'll simulate with some placeholder data
            const activityContainer = document.getElementById('recent-activity');
            if (!activityContainer) return;

            const activities = [
                { type: 'login', message: 'Admin logged in', time: '2 minutes ago' },
                { type: 'user', message: 'New user registered', time: '15 minutes ago' },
                { type: 'video', message: 'Video tagged', time: '1 hour ago' }
            ];

            let html = '';
            activities.forEach(activity => {
                const iconClass = {
                    'login': 'fas fa-sign-in-alt text-success',
                    'user': 'fas fa-user-plus text-primary',
                    'video': 'fas fa-video text-warning'
                }[activity.type] || 'fas fa-info-circle text-info';

                html += `
                    <div class="d-flex align-items-center mb-2">
                        <i class="${iconClass} me-3"></i>
                        <div class="flex-grow-1">
                            <small class="text-muted">${activity.message}</small>
                        </div>
                        <small class="text-muted">${activity.time}</small>
                    </div>
                `;
            });

            activityContainer.innerHTML = html;

        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    /**
     * Update system status indicators
     */
    updateSystemStatus() {
        const statusIndicator = document.getElementById('system-status-indicator');
        const statusText = document.getElementById('system-status-text');

        if (statusIndicator && statusText) {
            // Simple system status check
            const isOnline = navigator.onLine;
            const hasValidSession = this.adminPanel.isAdminLoggedIn;

            if (isOnline && hasValidSession) {
                statusIndicator.className = 'status-indicator status-online';
                statusText.textContent = 'System Online';
            } else if (isOnline) {
                statusIndicator.className = 'status-indicator status-warning';
                statusText.textContent = 'Session Expired';
            } else {
                statusIndicator.className = 'status-indicator status-offline';
                statusText.textContent = 'Offline';
            }
        }
    }

    /**
     * Handle quick action button clicks
     */
    handleQuickAction(event) {
        const action = event.currentTarget.dataset.quickAction;
        console.log('🚀 Quick action triggered:', action);

        switch (action) {
            case 'users':
                this.adminPanel.showSection('users');
                break;
            case 'questions':
                this.adminPanel.showSection('questions');
                break;
            case 'videos':
                this.adminPanel.showSection('videos');
                break;
            case 'bim-media':
                this.adminPanel.showSection('bim-media');
                break;
            case 'refresh-stats':
                this.refreshStats();
                break;
            default:
                console.warn('Unknown quick action:', action);
        }
    }

    /**
     * Show error notification
     */
    showErrorNotification(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger alert-dismissible fade show position-fixed';
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Log statistics loading events
     */
    logStatsLoad(status, stats = null, error = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: 'stats_load',
            status: status,
            stats: stats ? {
                users: stats.users.success ? stats.users.value : 'failed',
                questions: stats.questions.success ? stats.questions.value : 'failed',
                videos: stats.videos.success ? stats.videos.value : 'failed',
                media: stats.media.success ? stats.media.value : 'failed'
            } : null,
            error: error ? error.message : null,
            loadTime: stats ? Date.now() - stats.loadTime : null
        };

        console.log('📊 Stats load logged:', logEntry);
    }

    /**
     * Get statistics summary for export
     */
    getStatsSummary() {
        const cached = this.statsCache.get('stats');
        if (!cached) return null;

        return {
            timestamp: cached.lastUpdated,
            summary: {
                users: cached.users.success ? cached.users.value : 'N/A',
                questions: cached.questions.success ? cached.questions.value : 'failed',
                videos: cached.videos.success ? cached.videos.value : 'failed',
                media: cached.media.success ? cached.media.value : 'failed',
                pdfMaterials: cached.pdfMaterials.success ? cached.pdfMaterials.value : 'failed'
            },
            loadTime: cached.loadTime
        };
    }
}

// Initialize and register the dashboard module immediately when script loads
(function() {
    console.log('📊 Initializing Dashboard Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - dashboard module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - dashboard module cannot initialize');
        return;
    }

    try {
        // Create dashboard module instance
        const dashboardModule = new DashboardModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('dashboard', {
            loaded: true,
            path: 'modules/dashboard.js',
            instance: dashboardModule
        });

        // Initialize the module
        dashboardModule.initialize();

        console.log('✅ Dashboard module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize dashboard module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardModule;
}
