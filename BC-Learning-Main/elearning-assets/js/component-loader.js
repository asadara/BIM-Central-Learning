// Enhanced Component Loader with Persistent Sidebar System
class ComponentLoader {

    constructor() {
        this.persistentComponents = new Map();
        this.isInitialized = false;
        this.sidebarLoaded = false;
        this.headerLoaded = false;
    }

    // Load all components
    async loadAllComponents() {
        // Load authentication guard first for e-learning pages
        await this.loadAuthGuard();

        await Promise.all([
            this.loadHeader(),
            this.loadSidebar(),
            this.loadFooter()
        ]);

        // Setup event handlers setelah semua components dimuat
        this.setupHeaderEventHandlers();
        this.setupSidebarEventHandlers();

        // Debug localStorage setelah components dimuat
        console.log('🔍 Component Loader Debug - localStorage data:');
        console.log('username:', localStorage.getItem('username'));
        console.log('role:', localStorage.getItem('role'));
        console.log('userimg:', localStorage.getItem('userimg'));
        console.log('userData:', localStorage.getItem('userData'));
        console.log('user:', localStorage.getItem('user'));

        // Sync user info setelah semua components loaded
        this.syncHeaderUserInfo();
        this.syncSidebarUserInfo();

        // Trigger custom event untuk notify bahwa components sudah loaded
        document.dispatchEvent(new CustomEvent('componentsLoaded'));

        // Initialize global content management functions after components are loaded
        this.initializeContentManagementFunctions();
    }

    // Initialize global content management functions for sidebar access
    initializeContentManagementFunctions() {
        console.log('Initializing global content management functions...');

        // Content Management Functions (global scope for sidebar access)
        window.openContentManager = function () {
            console.log('openContentManager called globally');

            // Create modal if it doesn't exist
            if (!document.getElementById('admin-modal')) {
                const modalHTML = `
                    <div id="admin-modal" class="modal fade" tabindex="-1">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="modal-title">Learning Materials Manager</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body" id="modal-body">
                                    <div class="content-manager">
                                        <h4><i class="fas fa-book"></i> Learning Materials Manager</h4>
                                        <p>Loading content manager...</p>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                    <button type="button" class="btn btn-primary" id="save-btn">Upload Material</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                console.log('Global modal created');
            }

            // Load Bootstrap if not loaded
            if (typeof bootstrap === 'undefined') {
                console.log('Loading Bootstrap globally...');
                const bootstrapCSS = document.createElement('link');
                bootstrapCSS.rel = 'stylesheet';
                bootstrapCSS.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css';
                document.head.appendChild(bootstrapCSS);

                const bootstrapJS = document.createElement('script');
                bootstrapJS.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
                document.head.appendChild(bootstrapJS);
            }

            // Show modal after a short delay to ensure Bootstrap is loaded
            setTimeout(() => {
                const modal = new bootstrap.Modal(document.getElementById('admin-modal'));
                modal.show();
                console.log('Global modal shown');
            }, 200);

            alert('Content Manager opened! (Global function working)');
        };

        window.openExamManager = function () {
            console.log('openExamManager called globally');

            if (!document.getElementById('admin-modal')) {
                const modalHTML = `
                    <div id="admin-modal" class="modal fade" tabindex="-1">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="modal-title">Exam Materials Manager</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body" id="modal-body">
                                    <div class="exam-manager">
                                        <h4><i class="fas fa-clipboard-check"></i> Exam Materials Manager</h4>
                                        <p>Loading exam manager...</p>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                    <button type="button" class="btn btn-primary" id="save-btn">Upload Exam</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                console.log('Global exam modal created');
            }

            if (typeof bootstrap === 'undefined') {
                console.log('Loading Bootstrap for exam modal...');
                const bootstrapCSS = document.createElement('link');
                bootstrapCSS.rel = 'stylesheet';
                bootstrapCSS.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css';
                document.head.appendChild(bootstrapCSS);

                const bootstrapJS = document.createElement('script');
                bootstrapJS.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
                document.head.appendChild(bootstrapJS);
            }

            setTimeout(() => {
                const modal = new bootstrap.Modal(document.getElementById('admin-modal'));
                modal.show();
                console.log('Global exam modal shown');
            }, 200);

            alert('Exam Manager opened! (Global function working)');
        };

        console.log('Global content management functions initialized');
        console.log('openContentManager available:', typeof window.openContentManager);
        console.log('openExamManager available:', typeof window.openExamManager);
    }

    // Load header component
    async loadHeader() {
        try {
            const response = await fetch('/elearning-assets/components/header.html');
            const headerHTML = await response.text();

            const headerContainer = document.querySelector('.header-container');
            if (headerContainer) {
                headerContainer.innerHTML = headerHTML;
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = headerHTML;
                const fragment = document.createDocumentFragment();

                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }

                document.body.insertBefore(fragment, document.body.firstChild);
            }

            // Load navbar into the header component
            await this.loadNavbarForElearning();

            // Sinkronisasi user info di header
            this.syncHeaderUserInfo();

        } catch (error) {
            console.warn('Failed to load header component:', error);
        }
    }

    // Load sidebar component with ABSOLUTE persistence - never touch DOM if already exists
    async loadSidebar() {
        try {
            // TRIPLE CHECK: Look for any persistent sidebar anywhere in the document
            const existingPersistentSidebar = document.querySelector('.side-bar[data-persistent="true"]');

            // If ANY persistent sidebar exists, do NOTHING - not even sync
            if (existingPersistentSidebar) {
                console.log('🚫 Component Loader: Persistent sidebar detected - absolutely no action taken');
                // Only sync user info if needed, but don't touch DOM
                this.syncSidebarUserInfo();
                return;
            }

            // Also check global sidebar loader flags
            if (window.sidebarLoaded && window.sidebarElement && document.contains(window.sidebarElement)) {
                console.log('🚫 Component Loader: Global sidebar flags indicate already loaded');
                // Only sync user info if needed
                this.syncSidebarUserInfo();
                return;
            }

            // Only proceed if we've confirmed no sidebar exists anywhere
            console.log('📦 Component Loader: Loading sidebar component (absolute first time)...');

            const response = await fetch('/elearning-assets/components/sidebar.html');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const sidebarHTML = await response.text();

            // Create sidebar element
            const sidebarContainer = document.querySelector('.sidebar-container') || document.body;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sidebarHTML;
            const sidebarElement = tempDiv.firstElementChild;

            // Mark as persistent with timestamp
            sidebarElement.setAttribute('data-persistent', 'true');
            sidebarElement.setAttribute('data-loaded-by', 'component-loader');
            sidebarElement.setAttribute('data-loaded-at', Date.now().toString());

            // ONLY insert if no sidebar exists anywhere
            const anySidebar = document.querySelector('.side-bar');
            if (anySidebar) {
                console.log('⚠️ Replacing existing non-persistent sidebar');
                anySidebar.replaceWith(sidebarElement);
            } else {
                sidebarContainer.insertBefore(sidebarElement, sidebarContainer.firstChild);
            }

            // Mark as loaded
            this.sidebarLoaded = true;

            // Setup event handlers
            this.setupSidebarEventHandlers();

            // Sync user info after a delay to ensure DOM is stable
            setTimeout(() => {
                this.syncSidebarUserInfo();
            }, 200);

            console.log('✅ Component Loader: Sidebar loaded with absolute persistence');

        } catch (error) {
            console.warn('Component Loader: Failed to load sidebar:', error);
        }
    }

    // Load footer component
    async loadFooter() {
        try {
            const response = await fetch('/elearning-assets/components/footer.html');
            const footerHTML = await response.text();

            // Insert footer HTML
            const footerContainer = document.querySelector('.footer-container') ||
                document.body;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = footerHTML;
            const footerElement = tempDiv.firstElementChild;

            // Replace existing footer atau append to body
            const existingFooter = document.querySelector('.footer');
            if (existingFooter) {
                existingFooter.replaceWith(footerElement);
            } else {
                footerContainer.appendChild(footerElement);
            }

        } catch (error) {
            console.warn('Failed to load footer component:', error);
        }
    }



    // Load navbar for e-learning pages
    async loadNavbarForElearning() {
        try {
            console.log('🧭 Loading navbar for e-learning page...');

            // Import the navbar loading function from loadComponents.js
            if (typeof loadNavbar === 'function') {
                await loadNavbar();
                console.log('✅ Navbar loaded successfully for e-learning page');
            } else {
                // Fallback: load navbar directly
                const navbarPath = '../components/navbar.html';
                console.log('📂 Using navbar path:', navbarPath);

                const response = await fetch(navbarPath);
                if (!response.ok) {
                    throw new Error(`Failed to load navbar: ${response.status}`);
                }

                const navbarHTML = await response.text();
                const navbarContainer = document.getElementById('navbar-container');

                if (navbarContainer) {
                    navbarContainer.innerHTML = navbarHTML;

                    // Execute navbar scripts
                    const scripts = navbarContainer.querySelectorAll('script');
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement('script');
                        newScript.text = oldScript.textContent;
                        document.body.appendChild(newScript);
                    });

                    console.log('✅ Navbar loaded and scripts executed for e-learning page');
                } else {
                    console.warn('❌ Navbar container not found in header component');
                }
            }
        } catch (error) {
            console.warn('❌ Failed to load navbar for e-learning page:', error);
        }
    }

    // Load authentication guard for e-learning pages
    async loadAuthGuard() {
        try {
            console.log('🔍 Checking if auth guard is needed for path:', window.location.pathname);

            // Only load auth guard on e-learning pages
            if (!window.location.pathname.startsWith('/elearning-assets/')) {
                console.log('🔓 Auth guard not needed for non-e-learning pages');
                return;
            }

            // Check if auth guard script already exists
            if (document.querySelector('script[src*="auth-guard.js"]')) {
                console.log('🔐 Auth guard script already loaded');
                return;
            }

            console.log('🔐 Loading authentication guard for e-learning page...');

            // Load the auth guard script
            const script = document.createElement('script');
            script.src = '/elearning-assets/js/auth-guard.js';
            script.async = false; // Load synchronously to ensure auth check happens first

            // Create a promise to wait for the script to load
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('✅ Auth guard script loaded successfully');
                    resolve();
                };
                script.onerror = () => {
                    console.error('❌ Failed to load auth guard script');
                    reject(new Error('Auth guard script failed to load'));
                };
                document.head.appendChild(script);
            });

            // Wait a bit for the auth guard to initialize
            await new Promise(resolve => setTimeout(resolve, 200));

            console.log('🔐 Auth guard initialization completed');

        } catch (error) {
            console.warn('Failed to load auth guard:', error);
            // Don't fail the entire component loading if auth guard fails
        }
    }

    // Sinkronisasi user info di header
    syncHeaderUserInfo() {
        // Ambil data user dari localStorage (support both formats)
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('role') || 'student';
        const userimg = localStorage.getItem('userimg');

        // Juga cek format userData JSON
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Prioritas data: individual keys > user object > userData object
        const finalUsername = username || user.username || userData.name;
        const finalRole = role || user.role || userData.role || 'student';
        const finalImage = userimg || user.userimg || userData.image || '/elearning-assets/images/pic-1.jpg';

        console.log('Syncing header user info:', { finalUsername, finalRole, finalImage });

        // Update header elements
        const headerUserName = document.getElementById('header-user-name');
        const headerUserRole = document.getElementById('header-user-role');
        const headerUserImg = document.getElementById('header-user-img');
        const loggedInOptions = document.getElementById('logged-in-options');
        const guestOptions = document.getElementById('guest-options');
        const logoutBtn = document.getElementById('logout-btn');
        const accountName = document.getElementById('account-name');
        const loginLink = document.getElementById('login-link');
        const logoutLink = document.getElementById('logout-link');
        const registerLink = document.getElementById('register-link');

        // Update user info
        if (headerUserName) {
            headerUserName.textContent = finalUsername || 'Guest';
        }
        if (headerUserRole) {
            headerUserRole.textContent = finalRole || 'visitor';
        }
        if (headerUserImg) {
            headerUserImg.src = finalImage;
        }

        // Handle visibility berdasarkan status login
        if (finalUsername) {
            // User sudah login
            if (loggedInOptions) loggedInOptions.style.display = 'block';
            if (guestOptions) guestOptions.style.display = 'none';

            // Setup logout handler
            if (logoutBtn) {
                logoutBtn.onclick = (e) => {
                    e.preventDefault();
                    this.handleLogout();
                };
            }
            if (accountName) accountName.textContent = finalUsername;
            if (loginLink) loginLink.style.display = 'none';
            if (registerLink) registerLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'block';
        } else {
            // User belum login
            if (loggedInOptions) loggedInOptions.style.display = 'none';
            if (guestOptions) guestOptions.style.display = 'block';
            if (accountName) accountName.textContent = 'Account';
            if (loginLink) loginLink.style.display = 'block';
            if (registerLink) registerLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'none';
        }
    }

    // Handle logout functionality
    handleLogout() {
        console.log('🚪 Logging out user...');

        // Clear all possible user data formats
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        localStorage.removeItem('userimg');
        localStorage.removeItem('userData');
        localStorage.removeItem('user');
        localStorage.removeItem('email');
        localStorage.removeItem('token');

        console.log('✅ User data cleared from localStorage');

        // Redirect to main page or login page
        window.location.href = '../index.html';
    }

    // Setup event handlers untuk header component
    setupHeaderEventHandlers() {
        // Setup user button toggle
        const userBtn = document.querySelector('#user-btn');
        const profile = document.querySelector('.profile');

        if (userBtn && profile) {
            userBtn.onclick = () => {
                profile.classList.toggle('active');
            };
        }

        // Setup search button toggle (mobile)
        const searchBtn = document.querySelector('#search-btn');
        const searchForm = document.querySelector('.search-form');

        if (searchBtn && searchForm) {
            searchBtn.onclick = () => {
                searchForm.classList.toggle('active');
            };
        }

        // Setup dark mode toggle
        const toggleBtn = document.querySelector('#toggle-btn');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                document.body.classList.toggle('dark');

                if (document.body.classList.contains('dark')) {
                    toggleBtn.classList.replace('fa-sun', 'fa-moon');
                } else {
                    toggleBtn.classList.replace('fa-moon', 'fa-sun');
                }
            };
        }

        // Setup menu button (mobile)
        const menuBtn = document.querySelector('#menu-btn');
        const sideBar = document.querySelector('.side-bar');

        if (menuBtn && sideBar) {
            menuBtn.onclick = () => {
                sideBar.classList.toggle('active');
                document.body.classList.toggle('active');
            };
        }

        // Close profile dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profile') && !e.target.closest('#user-btn')) {
                const profile = document.querySelector('.profile');
                if (profile) {
                    profile.classList.remove('active');
                }
            }
        });
    }

    // Sinkronisasi user info di sidebar dengan struktur baru
    syncSidebarUserInfo() {
        // Ambil data user dari localStorage (support both formats)
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('role') || 'student';
        const userimg = localStorage.getItem('userimg');

        // Juga cek format userData JSON
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Prioritas data: individual keys > user object > userData object
        const finalUsername = username || user.username || userData.name;
        const finalRole = role || user.role || userData.role || 'student';
        const finalImage = userimg || user.userimg || userData.image || '/elearning-assets/images/pic-1.jpg';

        console.log('Syncing sidebar user info:', { finalUsername, finalRole, finalImage });

        // Update sidebar elements dengan struktur baru
        const sidebarUserName = document.getElementById('sidebar-user-name');
        const sidebarUserRoleLevel = document.getElementById('sidebar-user-role-level');
        const sidebarUserImg = document.getElementById('sidebar-user-img');
        const sidebarUserProfile = document.getElementById('sidebar-user-profile');

        // Handle logged-in vs guest user display
        if (finalUsername) {
            // User sudah login
            if (sidebarUserName) {
                sidebarUserName.textContent = finalUsername;
            }
            if (sidebarUserImg) {
                sidebarUserImg.src = finalImage;
            }

            // Update combined role and level
            if (sidebarUserRoleLevel) {
                let userLevel = 'BIM Learner'; // Default

                // Map roles to levels
                const roleLevelMap = {
                    'System Administrator': 'System Admin',
                    'Administrator': 'Administrator',
                    'Instructor': 'BIM Instructor',
                    'Coordinator': 'BIM Coordinator',
                    'Manager': 'BIM Manager',
                    'Expert': 'BIM Expert',
                    'Advanced': 'BIM Advanced',
                    'Intermediate': 'BIM Intermediate',
                    'Beginner': 'BIM Beginner',
                    'Student': 'BIM Student',
                    'Learner': 'BIM Learner'
                };

                // Check if role maps to a specific level
                if (finalRole && roleLevelMap[finalRole]) {
                    userLevel = roleLevelMap[finalRole];
                } else if (finalRole) {
                    // If role doesn't map exactly, format it
                    userLevel = finalRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                }

                // Also check userData for specific level field
                if (userData.level) {
                    userLevel = userData.level;
                } else if (user.level) {
                    userLevel = user.level;
                }

                // Combine role and level in single element
                const roleDisplay = finalRole || 'visitor';
                sidebarUserRoleLevel.textContent = `${roleDisplay} • ${userLevel}`;
                console.log('Updated sidebar user role-level to:', `${roleDisplay} • ${userLevel}`);
            }

            // Update profile button for logged-in user
            if (sidebarUserProfile) {
                sidebarUserProfile.href = '/elearning-assets/profile.html';
                sidebarUserProfile.textContent = 'View Profile';
            }

        } else {
            // Guest user (belum login)
            if (sidebarUserName) {
                sidebarUserName.textContent = 'Guest User';
            }
            if (sidebarUserImg) {
                sidebarUserImg.src = '/elearning-assets/images/pic-1.jpg';
            }
            if (sidebarUserRoleLevel) {
                sidebarUserRoleLevel.textContent = 'Please login to access courses';
            }
            if (sidebarUserProfile) {
                sidebarUserProfile.href = '/pages/login.html';
                sidebarUserProfile.textContent = 'Login to Start Learning';
            }
        }

        // Show/hide admin content management section
        const adminContentSection = document.querySelector('.admin-content-section');
        if (adminContentSection) {
            // Check if user is adminBCL
            const isAdmin = finalUsername === 'adminBCL' ||
                localStorage.getItem('admin_token') === 'AdminBCL2025!' ||
                finalRole === 'System Administrator';

            // Use CSS class instead of inline style for smoother transitions
            if (isAdmin) {
                adminContentSection.classList.add('show');
                console.log('🔧 Admin content management section enabled for:', finalUsername);
            } else {
                adminContentSection.classList.remove('show');
            }
        }

        console.log('✅ Sidebar user info synced successfully');
    }

    // Setup event handlers untuk sidebar component
    setupSidebarEventHandlers() {
        const closeBtn = document.querySelector('#close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                const sideBar = document.querySelector('.side-bar');
                if (sideBar) {
                    sideBar.classList.remove('active');
                    document.body.classList.remove('active');
                }
            }
        }

        // Setup main page button handler
        const mainPageBtn = document.querySelector('#main-page-btn');
        if (mainPageBtn) {
            mainPageBtn.onclick = (e) => {
                e.preventDefault();
                this.handleMainPageNavigation();
            }
        }
    }

    // Handle navigation ke main page dengan menyimpan user data
    handleMainPageNavigation() {
        console.log('🏠 Navigating to main page...');

        // Pastikan user data tersimpan dengan format yang benar
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('role');
        const userimg = localStorage.getItem('userimg');
        const user = localStorage.getItem('user');

        console.log('User data before navigation:', { username, role, userimg, user });

        // Jika ada user data, pastikan tersimpan dalam format yang kompatible dengan halaman utama
        if (username) {
            // Format untuk user.js di halaman utama
            const userData = {
                name: username,
                role: role || 'student',
                image: userimg || '',
                token: localStorage.getItem('token') || ''
            };

            // Simpan dalam format JSON juga untuk backup
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('✅ User data synchronized for main page');
        }

        // Navigate to main page - gunakan path absolut agar lebih reliable
        const currentPath = window.location.pathname;
        let targetPath;

        if (currentPath.includes('/elearning-assets/')) {
            // Jika di folder elearning-assets, naik satu level
            targetPath = '../index.html';
        } else if (currentPath.includes('/pages/')) {
            // Jika di folder pages, naik satu level 
            targetPath = '../index.html';
        } else {
            // Default fallback ke root
            targetPath = '/index.html';
        }

        console.log('Navigating from:', currentPath, 'to:', targetPath);
        window.location.href = targetPath;
    }
}

// Initialize component loader
const componentLoader = new ComponentLoader();

// Expose ke window object agar bisa diakses dari sidebar fallback
window.componentLoader = componentLoader;

// Auto-load components when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await componentLoader.loadAllComponents();
});

// Juga load jika sudah ready (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await componentLoader.loadAllComponents();
    });
} else {
    componentLoader.loadAllComponents();
}
