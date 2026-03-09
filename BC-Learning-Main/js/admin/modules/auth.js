/**
 * Auth Module - Handles authentication and session management
 */
class AuthModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.loginAttempts = 0;
        this.maxLoginAttempts = 3;
        this.lockoutTime = 5 * 60 * 1000; // 5 minutes
        this.lastFailedAttempt = null;
    }

    /**
     * Initialize the auth module
     */
    initialize() {
        console.log('ðŸ” Initializing Auth Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for auth-related elements
     */
    setupEventListeners() {
        const loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    /**
     * Handle admin login
     */
    async handleLogin(event) {
        event.preventDefault();

        // Check if account is locked
        if (this.isAccountLocked()) {
            const remainingTime = this.getLockoutRemainingTime();
            alert(`Account is temporarily locked due to too many failed attempts. Try again in ${Math.ceil(remainingTime / 1000 / 60)} minutes.`);
            return;
        }

        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;

        // Basic validation
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }

        console.log('ðŸ” Attempting admin login:', { email: email ? 'present' : 'empty' });

        try {
            // Show loading state
            this.setLoginFormState(true);

            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            console.log('ðŸ“¡ Admin login response:', response.status, response.statusText);

            if (response.ok) {
                const data = await response.json();
                console.log('âœ… Admin login successful:', data);

                // Reset login attempts on success
                this.resetLoginAttempts();

                // Update admin panel state
                this.adminPanel.adminUser = data.user;
                this.adminPanel.isAdminLoggedIn = true;

                // Update UI
                document.getElementById('auth-section').classList.add('d-none');
                document.getElementById('admin-interface').classList.remove('d-none');

                // Clear form
                document.getElementById('admin-login-form').reset();

                // Navigate to dashboard
                this.adminPanel.showSection('dashboard');
                this.adminPanel.loadDashboardStats();

                // Log successful login
                this.logAuthEvent('login_success', { email, userId: data.user.id });

            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('âŒ Admin login failed:', errorData);

                // Handle different error types
                this.handleLoginError(response.status, errorData);

                // Track failed attempts
                this.recordFailedAttempt();
            }
        } catch (error) {
            console.error('âŒ Admin login error:', error);
            alert('Login error: Network connection failed. Please check your internet connection and try again.');

            // Track failed attempts for network errors too
            this.recordFailedAttempt();
        } finally {
            // Reset loading state
            this.setLoginFormState(false);
        }
    }

    /**
     * Handle different types of login errors
     */
    handleLoginError(status, errorData) {
        let message = 'Login failed: ';

        switch (status) {
            case 401:
                message += 'Invalid email or password';
                break;
            case 403:
                message += 'Account is disabled or access denied';
                break;
            case 429:
                message += 'Too many login attempts. Please try again later';
                break;
            case 500:
                message += 'Server error. Please try again later';
                break;
            default:
                message += errorData.error || 'Unknown error occurred';
        }

        alert(message);
    }

    /**
     * Set login form loading state
     */
    setLoginFormState(loading) {
        const form = document.getElementById('admin-login-form');
        const submitBtn = form.querySelector('button[type="submit"]');
        const inputs = form.querySelectorAll('input');

        if (loading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Authenticating...';
            inputs.forEach(input => input.disabled = true);
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Access Admin Panel';
            inputs.forEach(input => input.disabled = false);
        }
    }

    /**
     * Check if admin session is still valid
     */
    async checkSession() {
        try {
            console.log('ðŸ” Checking admin session...');
            const response = await fetch('/api/admin/session', { credentials: 'include' });

            if (response.ok) {
                const data = await response.json();
                console.log('ðŸ“¡ Session check response:', data);

                if (data.authenticated && data.user) {
                    console.log('âœ… Admin session valid for:', data.user.username);
                    this.adminPanel.adminUser = data.user;
                    this.adminPanel.isAdminLoggedIn = true;
                    document.getElementById('auth-section').classList.add('d-none');
                    document.getElementById('admin-interface').classList.remove('d-none');
                    this.adminPanel.loadDashboardStats();
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

        const bridged = await this.adminPanel.bridgeAdminSession?.();
        if (bridged) {
            return this.checkSession();
        }

        console.log('ðŸ”’ No valid admin session - showing auth section');
        this.ensureAuthSectionVisible();
        return false;
    }

    /**
     * Ensure auth section is visible
     */
    ensureAuthSectionVisible() {
        document.getElementById('auth-section').classList.remove('d-none');
        document.getElementById('admin-interface').classList.add('d-none');
    }

    /**
     * Logout admin user
     */
    async logout() {
        if (!confirm('Are you sure you want to logout from admin panel?')) {
            return;
        }

        try {
            console.log('ðŸšª Admin logout initiated');

            const response = await fetch('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                console.log('âœ… Admin logout successful');

                // Log logout event
                this.logAuthEvent('logout', {
                    userId: this.adminPanel.adminUser?.id,
                    username: this.adminPanel.adminUser?.username
                });

                // Clear admin state
                this.adminPanel.adminUser = null;
                this.adminPanel.isAdminLoggedIn = false;

                // Update UI
                this.ensureAuthSectionVisible();
                document.getElementById('admin-login-form').reset();

                // Clear any cached data if needed
                this.clearSessionData();

            } else {
                console.error('âŒ Logout API failed, but clearing local state anyway');
                // Even if the server call fails, clear local state
                this.forceLocalLogout();
            }

        } catch (error) {
            console.error('âŒ Logout error:', error);
            // Force local logout on network error
            this.forceLocalLogout();
        }
    }

    /**
     * Force local logout when server is unreachable
     */
    forceLocalLogout() {
        console.log('ðŸ”’ Forcing local logout due to server unavailability');

        this.adminPanel.adminUser = null;
        this.adminPanel.isAdminLoggedIn = false;

        this.ensureAuthSectionVisible();
        document.getElementById('admin-login-form').reset();

        alert('You have been logged out locally. Some server-side session data may still exist.');
    }

    /**
     * Clear session-related data
     */
    clearSessionData() {
        // Clear any session-specific data if needed
        // For now, this is a placeholder for future enhancements
        console.log('ðŸ§¹ Session data cleared');
    }

    /**
     * Check if account is currently locked due to failed attempts
     */
    isAccountLocked() {
        if (!this.lastFailedAttempt || this.loginAttempts < this.maxLoginAttempts) {
            return false;
        }

        const timeSinceLastAttempt = Date.now() - this.lastFailedAttempt;
        return timeSinceLastAttempt < this.lockoutTime;
    }

    /**
     * Get remaining lockout time in milliseconds
     */
    getLockoutRemainingTime() {
        if (!this.lastFailedAttempt) return 0;

        const timeSinceLastAttempt = Date.now() - this.lastFailedAttempt;
        return Math.max(0, this.lockoutTime - timeSinceLastAttempt);
    }

    /**
     * Record a failed login attempt
     */
    recordFailedAttempt() {
        this.loginAttempts++;
        this.lastFailedAttempt = Date.now();

        console.log(`âŒ Failed login attempt #${this.loginAttempts}`);

        if (this.loginAttempts >= this.maxLoginAttempts) {
            console.log(`ðŸš« Account locked for ${this.lockoutTime / 1000 / 60} minutes due to too many failed attempts`);
        }
    }

    /**
     * Reset login attempts counter
     */
    resetLoginAttempts() {
        this.loginAttempts = 0;
        this.lastFailedAttempt = null;
        console.log('ðŸ”„ Login attempts reset');
    }

    /**
     * Log authentication events
     */
    logAuthEvent(eventType, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: eventType,
            details: details,
            userAgent: navigator.userAgent,
            ip: 'client-side' // Would be logged server-side
        };

        console.log('ðŸ“ Auth event logged:', logEntry);

        // In a production system, this would be sent to a logging service
        // For now, we just log to console
    }

    /**
     * Validate session periodically
     */
    startSessionValidation(interval = 5 * 60 * 1000) { // 5 minutes default
        setInterval(async () => {
            if (this.adminPanel.isAdminLoggedIn) {
                const isValid = await this.checkSession();
                if (!isValid) {
                    alert('Your session has expired. Please login again.');
                }
            }
        }, interval);
    }

    /**
     * Get current user information
     */
    getCurrentUser() {
        return this.adminPanel.adminUser;
    }

    /**
     * Check if user has specific permission
     */
    hasPermission(permission) {
        if (!this.adminPanel.adminUser) return false;

        // Simple permission check - can be expanded based on user roles
        const userPermissions = this.adminPanel.adminUser.permissions || [];
        return userPermissions.includes(permission) || userPermissions.includes('admin');
    }
}

// Initialize and register the auth module immediately when script loads
(function() {
    console.log('ðŸ” Initializing Auth Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('âŒ window.adminPanel not found - auth module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('âŒ window.adminPanel.modules not found - auth module cannot initialize');
        return;
    }

    try {
        // Create auth module instance
        const authModule = new AuthModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('auth', {
            loaded: true,
            path: 'modules/auth.js',
            instance: authModule
        });

        // Initialize the module
        authModule.initialize();

        // Start session validation
        authModule.startSessionValidation();

        console.log('âœ… Auth module initialized and registered successfully');
    } catch (error) {
        console.error('âŒ Failed to initialize auth module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthModule;
}

