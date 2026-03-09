/**
 * Main AdminPanel Class - Orchestrates all admin panel functionality
 * Refactored for better organization and maintainability
 */
class AdminPanel {
    constructor() {
        this.isAdminLoggedIn = false;
        this.adminUser = null;
        this.modules = new Map();
        this.initialized = false;
    }

    /**
     * Initialize the admin panel
     */
    async initialize() {
        if (this.initialized) return;

        console.log('ðŸš€ Initializing AdminPanel...');

        try {
            // Ensure default UI state
            this.ensureDefaultUIState();

            // Load saved data
            this.loadPersistentData();

            // Check admin session
            await this.checkAdminSession();

            // Initialize modules
            await this.initializeModules();

            // Setup event listeners
            this.setupEventListeners();

            // Handle hash-based navigation
            this.handleInitialNavigation();

            this.initialized = true;
            console.log('âœ… AdminPanel initialized successfully');

        } catch (error) {
            console.error('âŒ Failed to initialize AdminPanel:', error);
            this.showError('Failed to initialize admin panel: ' + error.message);
        }
    }

    /**
     * Ensure proper default UI state
     */
    ensureDefaultUIState() {
        const authSection = document.getElementById('auth-section');
        const adminInterface = document.getElementById('admin-interface');

        if (authSection) authSection.classList.remove('d-none');
        if (adminInterface) adminInterface.classList.add('d-none');
    }

    /**
     * Load persistent data from localStorage
     */
    loadPersistentData() {
        // Load data that persists across sessions
        this.loadSavedTags();
        this.loadCustomCategories();
        this.loadPDFCustomCategories();
        this.loadSavedBIMTags();
        this.loadBIMCustomCategories();
    }

    getStoredAdminToken() {
        try {
            const storedUser = localStorage.getItem('user');
            const parsedUser = storedUser ? JSON.parse(storedUser) : null;
            const token = parsedUser?.token || localStorage.getItem('token');
            const role = (parsedUser?.role || localStorage.getItem('role') || '').toLowerCase();
            const isAdminRole = role.includes('admin') || role.includes('administrator');
            if (!token || !isAdminRole) {
                return null;
            }
            return token;
        } catch (error) {
            console.warn('Failed to read stored admin token:', error);
            return null;
        }
    }

    async bridgeAdminSession() {
        const token = this.getStoredAdminToken();
        if (!token) {
            return false;
        }

        try {
            const response = await fetch('/api/admin/session/bridge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return !!(data && data.authenticated);
        } catch (error) {
            console.warn('Bridge admin session failed:', error);
            return false;
        }
    }

    /**
     * Initialize all admin modules
     */
    async initializeModules() {
        const modules = [
            { name: 'dashboard', path: 'modules/dashboard.js' },
            { name: 'auth', path: 'modules/auth.js' },
            { name: 'users', path: 'modules/users.js' },
            { name: 'questions', path: 'modules/questions.js' },
            { name: 'videos', path: 'modules/videos.js' },
            { name: 'videoDisplay', path: 'modules/video-display.js' },
            { name: 'contentManagement', path: 'modules/content-management.js' }
        ];

        for (const module of modules) {
            try {
                await this.loadModule(module.name, module.path);
            } catch (error) {
                console.error(`Failed to load module ${module.name}:`, error);
            }
        }
    }

    /**
     * Load a specific module
     */
    async loadModule(name, path) {
        try {
            console.log(`ðŸ“¦ Loading module: ${name}`);

            // Dynamic import would be ideal here, but for compatibility we'll use a different approach
            // For now, modules will register themselves when loaded

            this.modules.set(name, {
                loaded: true,
                path: path,
                instance: null // Will be set by the module itself
            });

            console.log(`âœ… Module ${name} loaded`);
        } catch (error) {
            console.error(`âŒ Failed to load module ${name}:`, error);
            throw error;
        }
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Admin login form
        const loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Navigation links
        document.querySelectorAll('.nav-link-modern').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });
    }

    /**
     * Handle admin login
     */
    async handleLogin(event) {
        event.preventDefault();

        const authModule = this.modules.get('auth');
        if (authModule && authModule.instance) {
            await authModule.instance.handleLogin(event);
        } else {
            // Fallback login handling
            await this.fallbackLogin(event);
        }
    }

    /**
     * Fallback login implementation
     */
    async fallbackLogin(event) {
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;

        console.log('ðŸ” Attempting admin login:', { email: email ? 'present' : 'empty' });

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('âœ… Admin login successful:', data);

                this.adminUser = data.user;
                this.isAdminLoggedIn = true;

                document.getElementById('auth-section').classList.add('d-none');
                document.getElementById('admin-interface').classList.remove('d-none');

                this.showSection('dashboard');
                this.loadDashboardStats();
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('âŒ Admin login failed:', errorData);
                alert('Login failed: ' + (errorData.error || 'Invalid credentials'));
            }
        } catch (error) {
            console.error('âŒ Admin login error:', error);
            alert('Login error: ' + error.message);
        }
    }

    /**
     * Check admin session
     */
    async checkAdminSession() {
        try {
            console.log('ðŸ” Checking admin session...');
            const response = await fetch('/api/admin/session', { credentials: 'include' });

            if (response.ok) {
                const data = await response.json();
                console.log('ðŸ“¡ Session check response:', data);

                if (data.authenticated && data.user) {
                    console.log('âœ… Admin session valid for:', data.user.username);
                    this.adminUser = data.user;
                    this.isAdminLoggedIn = true;
                    document.getElementById('auth-section').classList.add('d-none');
                    document.getElementById('admin-interface').classList.remove('d-none');
                    this.loadDashboardStats();
                    return true;
                } else {
                    console.log('âŒ Admin session not authenticated');
                }
            } else {
                console.error('âŒ Session check failed with status:', response.status);
            }
        } catch (error) {
            console.error('âŒ Error checking admin session:', error);
        }

        const bridged = await this.bridgeAdminSession();
        if (bridged) {
            return this.checkAdminSession();
        }

        console.log('ðŸ”’ No valid admin session - showing auth section');
        this.ensureDefaultUIState();
        return false;
    }

    /**
     * Handle navigation between sections
     */
    handleNavigation(event) {
        event.preventDefault();
        const target = event.target.closest('.nav-link-modern');
        if (!target) return;

        const section = target.getAttribute('href')?.substring(1); // Remove #
        if (section) {
            this.showSection(section);
        }
    }

    /**
     * Show a specific admin section
     */
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.add('d-none');
        });

        // Remove active class from nav links
        document.querySelectorAll('.nav-link-modern').forEach(link => {
            link.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(sectionName + '-section');
        if (targetSection) {
            targetSection.classList.remove('d-none');
        }

        // Add active class to clicked nav link
        if (event && event.target) {
            event.target.classList.add('active');
        }

        // Load section-specific data if module exists
        const module = this.modules.get(sectionName);
        if (module && module.instance && typeof module.instance.load === 'function') {
            module.instance.load();
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        const content = document.getElementById('admin-content');
        const toggleBtn = document.getElementById('sidebar-toggle');

        if (sidebar.classList.contains('d-none') || sidebar.classList.contains('d-md-block')) {
            // Show sidebar
            sidebar.classList.remove('d-none');
            sidebar.classList.add('d-md-block');
            content.classList.remove('col-md-12');
            content.classList.add('col-md-9');
            toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
        } else {
            // Hide sidebar
            sidebar.classList.add('d-none');
            sidebar.classList.remove('d-md-block');
            content.classList.remove('col-md-9');
            content.classList.add('col-md-12');
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    }

    /**
     * Handle initial navigation based on URL hash
     */
    handleInitialNavigation() {
        const hash = window.location.hash.substring(1);
        if (hash && hash !== 'dashboard' && this.isAdminLoggedIn) {
            setTimeout(() => {
                if (hash === 'bim-media') {
                    this.showSection(hash);
                    // Load BIM media if module exists
                    const bimModule = this.modules.get('bimMedia');
                    if (bimModule && bimModule.instance) {
                        bimModule.instance.load();
                    }
                } else {
                    this.showSection(hash);
                }
            }, 100);
        }
    }

    /**
     * Load dashboard statistics
     */
    async loadDashboardStats() {
        const dashboardModule = this.modules.get('dashboard');
        if (dashboardModule && dashboardModule.instance) {
            await dashboardModule.instance.loadStats();
        } else {
            await this.fallbackLoadDashboardStats();
        }
    }

    /**
     * Fallback dashboard stats loading
     */
    async fallbackLoadDashboardStats() {
        console.log('ðŸ”„ Loading dashboard statistics...');

        try {
            const [usersRes, questionsRes, videosRes, mediaRes] = await Promise.allSettled([
                fetch('/api/users/stats').then(res => res.ok ? res.json() : Promise.reject(res.status)),
                fetch('/api/questions').then(res => res.ok ? res.json() : Promise.reject(res.status)),
                fetch('/api/tutorials').then(res => res.ok ? res.json() : Promise.reject(res.status)),
                fetch('/api/admin/videos/stats').then(res => res.ok ? res.json() : Promise.reject(res.status))
            ]);

            // Update UI elements
            this.updateDashboardStat('user-count', usersRes, 'total');
            this.updateDashboardStat('question-count', questionsRes);
            this.updateDashboardStat('video-count', videosRes);
            this.updateDashboardStat('media-count', mediaRes, 'stats.totalTagged');

            console.log('âœ… Dashboard statistics loaded (fallback)');
        } catch (error) {
            console.error('âŒ Critical error loading dashboard stats:', error);
            ['user-count', 'question-count', 'video-count', 'media-count'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = 'N/A';
            });
        }
    }

    /**
     * Update dashboard statistic element
     */
    updateDashboardStat(elementId, response, dataKey = 'length') {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (response.status === 'fulfilled') {
            const data = response.value;
            let value;

            if (dataKey === 'length') {
                value = Array.isArray(data) ? data.length : 0;
            } else {
                // Support dot notation for nested properties (e.g., 'stats.totalTagged')
                value = dataKey.split('.').reduce((obj, key) => obj && obj[key], data) || 0;
            }

            element.textContent = value;
            console.log(`âœ… ${elementId}: ${value}`);
        } else {
            console.error(`âŒ ${elementId} API failed:`, response.reason);
            element.textContent = 'N/A';
        }
    }

    /**
     * Admin logout
     */
    logout() {
        if (confirm('Are you sure you want to logout from admin panel?')) {
            fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
                .then(() => {
                    this.adminUser = null;
                    this.isAdminLoggedIn = false;
                    document.getElementById('auth-section').classList.remove('d-none');
                    document.getElementById('admin-interface').classList.add('d-none');
                    document.getElementById('admin-login-form').reset();
                })
                .catch(error => console.error('Logout error:', error));
        }
    }

    /**
     * Show error message to user
     */
    showError(message) {
        alert('Error: ' + message);
    }

    // Data persistence methods (extracted from original code)
    loadSavedTags() {
        try {
            const saved = localStorage.getItem('bcl_video_tags');
            if (saved) {
                this.savedTags = JSON.parse(saved);
                console.log('ðŸ“‚ Loaded saved tags from localStorage:', Object.keys(this.savedTags || {}).length, 'videos');
            } else {
                this.savedTags = {};
            }
        } catch (error) {
            console.error('âŒ Error loading saved tags:', error);
            this.savedTags = {};
        }
    }

    loadCustomCategories() {
        try {
            const saved = localStorage.getItem('bcl_custom_categories');
            if (saved) {
                this.customCategories = JSON.parse(saved);
                console.log('ðŸ“‚ Loaded custom categories from localStorage:', this.customCategories.length, 'categories');
            } else {
                this.customCategories = [];
            }
        } catch (error) {
            console.error('âŒ Error loading custom categories:', error);
            this.customCategories = [];
        }
    }

    loadPDFCustomCategories() {
        try {
            const saved = localStorage.getItem('bcl_pdf_custom_categories');
            if (saved) {
                this.pdfCustomCategories = JSON.parse(saved);
                console.log('ðŸ“‚ Loaded PDF custom categories from localStorage:', this.pdfCustomCategories.length, 'categories');
            } else {
                this.pdfCustomCategories = [];
            }
        } catch (error) {
            console.error('âŒ Error loading PDF custom categories:', error);
            this.pdfCustomCategories = [];
        }
    }

    loadSavedBIMTags() {
        try {
            const saved = localStorage.getItem('bcl_bim_media_tags');
            if (saved) {
                this.savedBIMTags = JSON.parse(saved);
                console.log('ðŸ“‚ Loaded saved BIM tags from localStorage:', Object.keys(this.savedBIMTags || {}).length, 'files');
            } else {
                this.savedBIMTags = {};
            }
        } catch (error) {
            console.error('âŒ Error loading saved BIM tags:', error);
            this.savedBIMTags = {};
        }
    }

    loadBIMCustomCategories() {
        try {
            const saved = localStorage.getItem('bcl_bim_custom_categories');
            if (saved) {
                this.bimCustomCategories = JSON.parse(saved);
                console.log('ðŸ“‚ Loaded BIM custom categories from localStorage');
            } else {
                this.bimCustomCategories = {};
            }
        } catch (error) {
            console.error('âŒ Error loading BIM custom categories:', error);
            this.bimCustomCategories = {};
        }
    }
}

// Create global adminPanel object immediately
window.adminPanel = {
    modules: new Map(),
    isAdminLoggedIn: false,
    adminUser: null,
    initialized: false
};

// Create AdminPanel class instance
const adminPanel = new AdminPanel();

// Copy initial structure to window object
window.adminPanel.modules = new Map();
window.adminPanel.isAdminLoggedIn = false;
window.adminPanel.adminUser = null;
window.adminPanel.initialized = false;

// Add methods to window object
window.adminPanel.logout = () => adminPanel.logout();
window.adminPanel.showSection = (sectionName) => adminPanel.showSection(sectionName);
window.adminPanel.toggleSidebar = () => adminPanel.toggleSidebar();
window.adminPanel.loadDashboardStats = () => adminPanel.loadDashboardStats();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    adminPanel.initialize();
});

// Global functions for backward compatibility (will be removed in future versions)
function adminLogout() {
    adminPanel.logout();
}

function showSection(sectionName) {
    adminPanel.showSection(sectionName);
}

function toggleSidebar() {
    adminPanel.toggleSidebar();
}

function loadDashboardStats() {
    adminPanel.loadDashboardStats();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminPanel;
}


