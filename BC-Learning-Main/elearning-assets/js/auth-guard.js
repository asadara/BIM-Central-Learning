// Authentication Guard for E-Learning Pages
// This script ensures users are authenticated before accessing e-learning content

class AuthGuard {
    constructor() {
        this.isAuthenticated = false;
        this.modal = null;
        this.currentTab = 'login';
        this.init();
    }

    async init() {
        // Check authentication status on page load
        await this.checkAuthentication();

        // If not authenticated, show modal immediately
        if (!this.isAuthenticated) {
            this.showAuthModal();
        }

        // Listen for authentication changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'user' || e.key === 'token') {
                this.checkAuthentication().then(() => {
                    if (this.isAuthenticated && this.modal) {
                        this.hideAuthModal();
                    }
                });
            }
        });
    }

    async checkAuthentication() {
        try {
            // Check multiple authentication sources for compatibility across sections
            let token = localStorage.getItem('token');
            let user = localStorage.getItem('user');
            let username = localStorage.getItem('username');

            console.log('🔍 Checking authentication across all sections');

            // Method 1: Check consolidated user object (e-learning & main site)
            if (user) {
                try {
                    const userData = JSON.parse(user);
                    if (userData && userData.token) {
                        token = userData.token; // Use token from user object
                        console.log('✅ Found user data with token');
                    }
                } catch (e) {
                    console.warn('Could not parse user data:', e);
                }
            }

            // Method 2: Check individual localStorage keys (pages section)
            if (!token) {
                token = localStorage.getItem('token');
            }
            if (!username) {
                username = localStorage.getItem('username');
            }

            console.log('🔍 Auth status - Token:', !!token, 'Username:', !!username);

            if (!token || (!user && !username)) {
                const adminSessionAuthenticated = await this.checkAdminSession();
                if (!adminSessionAuthenticated) {
                    console.log('❌ No valid authentication found - not authenticated');
                    this.isAuthenticated = false;
                }
                return;
            }

            // Validate token expiration if JWT
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const currentTime = Date.now() / 1000;

                if (payload.exp && payload.exp < currentTime) {
                    console.warn('Token expired, clearing authentication');
                    this.clearAuthentication();
                    this.isAuthenticated = false;
                    return;
                }
            } catch (e) {
                // Token might not be JWT, continue
                console.log('Token format not JWT, continuing...');
            }

            // If we have valid authentication data
            this.isAuthenticated = true;

            // Set currentUser for compatibility
            if (user) {
                window.currentUser = JSON.parse(user);
            } else if (username) {
                // Create user object from individual keys for compatibility
                window.currentUser = {
                    name: username,
                    email: localStorage.getItem('email') || '',
                    role: localStorage.getItem('role') || 'Student',
                    photo: localStorage.getItem('userimg') || '/img/user-default.png',
                    token: token
                };
            }

            console.log('✅ User authenticated:', window.currentUser?.name || 'Unknown');
            this.syncAuthUI();

        } catch (error) {
            console.error('Error checking authentication:', error);
            this.clearAuthentication();
            this.isAuthenticated = false;
        }
    }

    async checkAdminSession() {
        try {
            const response = await fetch('/api/admin/session', { credentials: 'include' });
            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            if (!data.authenticated || !data.user) {
                return false;
            }

            const adminUser = {
                name: data.user.username || data.user.email || 'Administrator',
                email: data.user.email || '',
                role: data.user.role || 'System Administrator',
                photo: '/img/user-default.png',
                isAdmin: true
            };

            window.currentUser = adminUser;
            this.isAuthenticated = true;

            // Store minimal user info for UI compatibility (no token/session data)
            localStorage.setItem('user', JSON.stringify(adminUser));
            localStorage.setItem('username', adminUser.name || '');
            localStorage.setItem('email', adminUser.email || '');
            localStorage.setItem('role', adminUser.role || 'System Administrator');
            localStorage.setItem('userimg', adminUser.photo || '/img/user-default.png');

            console.log('✅ Admin session authenticated:', adminUser.name);
            this.syncAuthUI();
            return true;
        } catch (error) {
            console.warn('Admin session check failed:', error);
            return false;
        }
    }

    syncAuthUI() {
        if (window.componentLoader) {
            if (typeof window.componentLoader.syncHeaderUserInfo === 'function') {
                window.componentLoader.syncHeaderUserInfo();
            }
            if (typeof window.componentLoader.syncSidebarUserInfo === 'function') {
                window.componentLoader.syncSidebarUserInfo();
            }
        }

        if (typeof window.updateUserUI === 'function') {
            window.updateUserUI();
        }
    }

    clearAuthentication() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('role');
        localStorage.removeItem('userimg');
        window.currentUser = null;
    }

    showAuthModal() {
        // Store current page for redirection after login
        localStorage.setItem('authRedirectPage', window.location.href);
        console.log('📍 Stored redirect page:', window.location.href);

        // Prevent interaction with page content
        document.body.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';

        // Create and show modal
        this.createAuthModal();
        this.modal.show();

        // Allow interaction with modal
        const modalElement = document.getElementById('auth-modal');
        if (modalElement) {
            modalElement.style.pointerEvents = 'auto';
            modalElement.style.userSelect = 'auto';
        }
    }

    hideAuthModal() {
        if (this.modal) {
            this.modal.hide();
            // Restore page interaction
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
        }
    }

    createAuthModal() {
        // Check if modal already exists
        if (document.getElementById('auth-modal')) {
            this.modal = new bootstrap.Modal(document.getElementById('auth-modal'));
            return;
        }

        const modalHTML = `
            <div id="auth-modal" class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-lock me-2"></i>
                                Authentication Required
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <p class="text-muted">You need to sign in to access BC Learning e-learning content.</p>
                            </div>

                            <!-- Action Buttons -->
                            <div class="d-grid gap-3 mt-4">
                                <a href="/elearning-assets/login.html" class="btn btn-primary btn-lg">
                                    <i class="fas fa-sign-in-alt me-2"></i>Sign In to Existing Account
                                </a>
                                <a href="/elearning-assets/register.html" class="btn btn-success btn-lg">
                                    <i class="fas fa-user-plus me-2"></i>Create New Account
                                </a>
                            </div>

                            <div class="text-center mt-3">
                                <small class="text-muted">
                                    After signing in, you'll be redirected back to access the learning content.
                                </small>
                            </div>

                            <!-- Loading Spinner -->
                            <div id="auth-loading" class="text-center mt-3" style="display: none;">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2">Processing...</p>
                            </div>

                            <!-- Error Message -->
                            <div id="auth-error" class="alert alert-danger mt-3" style="display: none;">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <span id="auth-error-text"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = new bootstrap.Modal(document.getElementById('auth-modal'));

        // Initialize form handlers
        this.initFormHandlers();
    }

    initFormHandlers() {
        // Login form handler
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Signup form handler
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignup();
            });
        }

        // Tab switching
        const tabs = document.querySelectorAll('#auth-tabs .nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentTab = e.target.id.replace('-tab', '');
                this.clearErrors();
            });
        });
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Save user data
                const userData = {
                    name: result.name || result.username,
                    email: result.email,
                    role: result.role || 'Student',
                    photo: result.photo || '/img/user-default.png',
                    token: result.token
                };

                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('token', result.token);
                localStorage.setItem('username', userData.name);
                localStorage.setItem('email', userData.email);
                localStorage.setItem('role', userData.role);
                localStorage.setItem('userimg', userData.photo);

                window.currentUser = userData;
                this.isAuthenticated = true;

                // Update navbar if it exists
                if (window.updateUserUI) {
                    window.updateUserUI();
                }

                this.showSuccess('Login successful! Welcome back.');
                setTimeout(() => {
                    this.hideAuthModal();
                }, 1500);

            } else {
                this.showError(result.error || result.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async handleSignup() {
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const bimLevel = document.getElementById('signup-bim-level').value;
        const jobRole = document.getElementById('signup-job-role').value.trim();
        const organization = document.getElementById('signup-organization').value.trim();

        if (!username || !email || !password || !bimLevel) {
            this.showError('Please fill in all required fields');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    bimLevel,
                    jobRole,
                    organization,
                    registrationDate: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess('Account created successfully! Please sign in with your credentials.');
                // Switch to login tab
                document.getElementById('login-tab').click();
                // Pre-fill email
                document.getElementById('login-email').value = email;

            } else {
                this.showError(result.error || result.message || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const loading = document.getElementById('auth-loading');
        const forms = document.querySelectorAll('#login-form, #signup-form');

        if (show) {
            loading.style.display = 'block';
            forms.forEach(form => {
                form.style.opacity = '0.5';
                form.style.pointerEvents = 'none';
            });
        } else {
            loading.style.display = 'none';
            forms.forEach(form => {
                form.style.opacity = '';
                form.style.pointerEvents = '';
            });
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('auth-error');
        const errorText = document.getElementById('auth-error-text');

        errorText.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.clearErrors();
        }, 5000);
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('auth-error');
        errorDiv.className = 'alert alert-success mt-3';
        document.getElementById('auth-error-text').textContent = message;
        errorDiv.style.display = 'block';
    }

    clearErrors() {
        const errorDiv = document.getElementById('auth-error');
        errorDiv.className = 'alert alert-danger mt-3';
        errorDiv.style.display = 'none';
    }
}

// Initialize auth guard immediately if on e-learning pages (but not on login/register pages)
if (window.location.pathname.startsWith('/elearning-assets/') &&
    !window.location.pathname.includes('/login.html') &&
    !window.location.pathname.includes('/register.html')) {
    window.authGuard = new AuthGuard();
    console.log('🔐 Auth guard initialized for e-learning pages');
}

// Also initialize when DOM is ready (fallback)
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on e-learning pages if not already done (exclude login/register)
    if (window.location.pathname.startsWith('/elearning-assets/') &&
        !window.location.pathname.includes('/login.html') &&
        !window.location.pathname.includes('/register.html') &&
        !window.authGuard) {
        window.authGuard = new AuthGuard();
        console.log('🔐 Auth guard initialized for e-learning pages (fallback)');
    }
});

// Global function to check auth status (for other scripts)
window.isAuthenticated = function () {
    return window.authGuard ? window.authGuard.isAuthenticated : false;
};

// Global function to force auth check
window.checkAuth = function () {
    if (window.authGuard) {
        window.authGuard.checkAuthentication();
        return window.authGuard.isAuthenticated;
    }
    return false;
};
