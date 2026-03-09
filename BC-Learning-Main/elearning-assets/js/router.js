// SPA-lite Router for sidebar navigation
class SPARouter {
    constructor() {
        this.mainContainer = 'main';
        this.currentPath = window.location.pathname;
        this.init();
    }

    init() {
        console.log('🎯 SPA-lite Router initialized');
        this.setupNavigationInterception();
        this.setupHistoryHandlers();
    }

    setupNavigationInterception() {
        // Intercept all sidebar navigation clicks - use capture phase to ensure we get the event first
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            console.log('🔗 [ROUTER] Click intercepted on:', link?.href, 'target:', e.target.tagName, 'link element:', link);

            if (link && this.shouldInterceptLink(link)) {
                console.log('🚀 [ROUTER] SPA-lite navigation triggered for:', link.href);
                e.preventDefault();
                e.stopImmediatePropagation(); // Stop ALL other handlers
                this.navigateTo(link.href, link).catch(err => {
                    console.error('❌ Navigation failed:', err);
                });
                return false; // Extra prevention
            }
        }, true); // Use capture phase

        console.log('🎯 [ROUTER] Navigation interception setup complete');
    }

    shouldInterceptLink(link) {
        const href = link.getAttribute('href');

        // Don't intercept external links
        if (href.startsWith('http') && !href.includes(window.location.hostname)) return false;

        // Don't intercept anchors or special protocols
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;

        // Don't intercept admin modal links
        if (href.includes('javascript:') || link.onclick) return false;

        // Only intercept internal e-learning routes
        if (href.includes('/elearning-assets/') || href.includes('/pages/') || href === '/' || href.startsWith('./') || href.startsWith('../')) {
            return true;
        }

        return false;
    }

    async navigateTo(url, linkElement = null) {
        try {
            console.log('🧭 SPA-lite navigating to:', url);

            // Show loading state
            this.showLoadingState();

            // Update URL without full reload
            const urlObj = new URL(url, window.location.origin);
            window.history.pushState({ path: urlObj.pathname }, '', urlObj.pathname);

            // Update current path
            this.currentPath = urlObj.pathname;

            // Load page content
            await this.loadPageContent(urlObj.pathname);

            // Update active navigation state
            this.updateActiveNavigation(urlObj.pathname);

            // Hide loading state
            this.hideLoadingState();

            console.log('✅ SPA-lite navigation completed');

        } catch (error) {
            console.error('❌ SPA-lite navigation failed:', error);
            // Fallback to normal navigation
            if (linkElement) {
                window.location.href = url;
            }
        }
    }

    async loadPageContent(path) {
        try {
            // Determine content URL
            const contentUrl = this.getContentUrl(path);

            console.log('📄 Loading content from:', contentUrl);

            const response = await fetch(contentUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();

            // Extract and inject content
            await this.injectPageContent(html, path);

            // Update page title
            this.updatePageTitle(html);

        } catch (error) {
            console.error('❌ Failed to load page content:', error);
            throw error;
        }
    }

    getContentUrl(path) {
        // Map path to content URL
        if (path.includes('/elearning-assets/')) {
            return path;
        }

        // Handle root path
        if (path === '/' || path === '') {
            return '/elearning-assets/home.html';
        }

        // Handle pages directory
        if (path.includes('/pages/')) {
            return path;
        }

        // Default to elearning assets
        return `/elearning-assets${path.replace('.html', '') + '.html'}`;
    }

    async injectPageContent(html, path) {
        console.log('🔄 Injecting page content for:', path);

        // Create temporary element to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Extract main content - look for the primary content sections
        let content = '';

        // Try to find main content sections (dashboard, courses, exams, etc.)
        const mainSections = tempDiv.querySelectorAll('section[class]');
        if (mainSections.length > 0) {
            // Extract all main content sections
            content = Array.from(mainSections).map(section => section.outerHTML).join('\n');
            console.log('📋 Found main sections:', mainSections.length);
        } else {
            // Fallback: extract from body, excluding sidebar and header
            const bodyContent = tempDiv.querySelector('body');
            if (bodyContent) {
                // Remove sidebar, header, and footer elements
                const elementsToRemove = bodyContent.querySelectorAll('.side-bar, .header, .footer, #close-btn, .header-container, .footer-container, script, style, link[rel="stylesheet"]');
                elementsToRemove.forEach(el => el.remove());

                content = bodyContent.innerHTML;
                console.log('📄 Using body content fallback');
            }
        }

        console.log('📦 Extracted content length:', content.length);

        // COMPLETE CONTAINER REPLACEMENT APPROACH - most reliable way to prevent stacking
        console.log('🔄 Replacing entire SPA container...');

        // Always create a fresh container - this ensures no residual content or event listeners
        const newContainer = document.createElement('div');
        newContainer.className = 'spa-main-container';
        newContainer.id = 'spa-main-container-' + Date.now(); // Unique ID to prevent conflicts

        // Inject content into new container first
        if (content.trim()) {
            console.log('📝 Injecting content into new container:', content.substring(0, 100) + '...');
            newContainer.innerHTML = content;

            // Log what was actually injected
            const injectedSections = newContainer.querySelectorAll('section');
            console.log('📋 Injected sections:', injectedSections.length, Array.from(injectedSections).map(s => s.className));
        } else {
            console.warn('⚠️ No content to inject');
            newContainer.innerHTML = '<div class="spa-error"><p>Failed to load page content</p></div>';
        }

        // Replace existing container completely
        const existingContainer = document.querySelector('.spa-main-container');
        if (existingContainer) {
            console.log('🔄 Replacing existing container...');
            existingContainer.replaceWith(newContainer);
        } else {
            console.log('🆕 Inserting new container after sidebar...');

            // For first navigation, hide existing sections and insert new container
            const existingSections = document.querySelectorAll('section[class]');
            existingSections.forEach(section => {
                section.style.display = 'none';
                console.log('📦 Hidden existing section:', section.className);
            });

            // Insert after sidebar
            const sidebar = document.querySelector('.side-bar');
            if (sidebar) {
                sidebar.insertAdjacentElement('afterend', newContainer);
                console.log('✅ New SPA container inserted after sidebar');
            } else {
                document.body.appendChild(newContainer);
                console.log('⚠️ New SPA container appended to body (no sidebar found)');
            }
        }

        console.log('✅ Container replacement completed - fresh container with', newContainer.children.length, 'children');

        // Execute page-specific scripts
        this.executePageScripts(tempDiv, path);

        console.log('🎯 Page content injection completed');
    }

    executePageScripts(tempDiv, path) {
        // Find and execute scripts
        const scripts = tempDiv.querySelectorAll('script');
        scripts.forEach(script => {
            if (script.src) {
                // Load external scripts if not already loaded
                this.loadScript(script.src);
            } else {
                // Execute inline scripts safely
                try {
                    // Only execute scripts that are page-specific
                    if (!script.textContent.includes('component-loader') &&
                        !script.textContent.includes('sidebar-loader')) {
                        eval(script.textContent);
                    }
                } catch (error) {
                    console.warn('⚠️ Error executing page script:', error);
                }
            }
        });
    }

    loadScript(src) {
        // Check if script already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            return;
        }

        // Skip component-loader and sidebar-loader as they're already loaded
        if (src.includes('component-loader.js') || src.includes('sidebar-loader.js')) {
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.onload = () => console.log('📜 Script loaded:', src);
        script.onerror = () => console.warn('⚠️ Failed to load script:', src);
        document.head.appendChild(script);
    }

    updatePageTitle(html) {
        // Extract title from HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const titleElement = tempDiv.querySelector('title');

        if (titleElement) {
            document.title = titleElement.textContent;
        }
    }

    updateActiveNavigation(currentPath) {
        // Remove active class from all nav links
        document.querySelectorAll('.navbar a').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current page link
        const currentLink = document.querySelector(`.navbar a[href*="${currentPath}"]`);
        if (currentLink) {
            currentLink.classList.add('active');
        }

        console.log('🎯 Active navigation updated for:', currentPath);
    }

    setupHistoryHandlers() {
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.path) {
                console.log('🔄 Browser navigation to:', e.state.path);
                this.navigateTo(e.state.path);
            }
        });
    }

    showLoadingState() {
        // For loading state, we need to handle the case where there might not be a container yet
        let targetContainer = document.querySelector('.spa-main-container');
        if (!targetContainer) {
            console.log('⏳ Creating temporary loading container...');
            // Create temporary container for loading state
            targetContainer = document.createElement('div');
            targetContainer.className = 'spa-main-container';
            targetContainer.id = 'spa-loading-container';

            const sidebar = document.querySelector('.side-bar');
            if (sidebar) {
                sidebar.insertAdjacentElement('afterend', targetContainer);
            }
        }

        if (targetContainer) {
            targetContainer.innerHTML = `
                <div class="spa-loading-state">
                    <div class="spa-spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
            console.log('⏳ Loading state displayed');
        }
    }

    hideLoadingState() {
        // Loading state will be replaced by actual content
    }

    // Wrap initial page content into SPA container
    wrapInitialContent() {
        console.log('🔄 Wrapping initial page content...');

        // Check if we already have an SPA container
        let spaContainer = document.querySelector('.spa-main-container');
        if (spaContainer) {
            console.log('📦 SPA container already exists');
            return;
        }

        // Find existing content sections that should be wrapped
        const existingSections = document.querySelectorAll('section[class]');
        if (existingSections.length === 0) {
            console.log('⚠️ No sections found to wrap');
            return;
        }

        // Create SPA container
        spaContainer = document.createElement('div');
        spaContainer.className = 'spa-main-container';

        // Insert after sidebar
        const sidebar = document.querySelector('.side-bar');
        if (sidebar) {
            sidebar.insertAdjacentElement('afterend', spaContainer);
        } else {
            console.log('⚠️ No sidebar found for insertion');
            return;
        }

        // Move existing sections into SPA container
        existingSections.forEach(section => {
            spaContainer.appendChild(section);
            console.log('📦 Moved section:', section.className);
        });

        console.log('✅ Initial content wrapped successfully -', existingSections.length, 'sections moved');
    }

    // Public API
    navigate(path) {
        return this.navigateTo(path);
    }

    // Debug function to test router functionality
    testNavigation(path) {
        console.log('🧪 Testing navigation to:', path);
        return this.navigateTo(path);
    }

    // Get current router status
    getStatus() {
        return {
            initialized: !!window.__spaRouterInitialized,
            currentPath: this.currentPath,
            containerExists: !!document.querySelector('.spa-main-container'),
            sidebarExists: !!document.querySelector('.side-bar')
        };
    }
}

// Initialize SPA-lite router when DOM is ready - with delay to ensure it runs after component loaders
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not already initialized
    if (!window.__spaRouterInitialized) {
        window.__spaRouterInitialized = true;

        // Delay initialization to ensure component loaders have finished
        setTimeout(() => {
            window.spaRouter = new SPARouter();
            console.log('🚀 SPA-lite Router ready - initialized after component loaders');
        }, 500); // 500ms delay
    }
});
