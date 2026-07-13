// loadComponents.js - Sinkronisasi Global User + Navbar

// loadComponents.js
const BCL_SMOOTH_NAV_PATHS = new Set([
    '/pages/help.html',
    '/pages/manual-books.html',
    '/pages/lesson-learn.html',
    '/pages/audit-2026.html',
    '/pages/bim-mindset.html'
]);

const BCL_PROTECTED_PAGE_ACCESS = {
    '/pages/manual-books.html': {
        key: 'dokumenAccess',
        label: 'Dokumen'
    },
    '/pages/audit-2026.html': {
        key: 'audit2026Access',
        label: 'Audit 2026'
    }
};

let bclPageTransitionInitialized = false;

document.documentElement.classList.add('bcl-page-transition-ready');

function normalizeInternalPath(href) {
    try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) {
            return null;
        }

        return url.pathname.replace(/\/+/g, '/');
    } catch (error) {
        return null;
    }
}

function shouldUseSmoothNavigation(event, link) {
    if (!link || event.defaultPrevented) {
        return false;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return false;
    }

    if (link.target && link.target !== '_self') {
        return false;
    }

    if (link.hasAttribute('download')) {
        return false;
    }

    const targetPath = normalizeInternalPath(link.href);
    if (!targetPath || !BCL_SMOOTH_NAV_PATHS.has(targetPath)) {
        return false;
    }

    const currentPath = window.location.pathname.replace(/\/+/g, '/');
    return targetPath !== currentPath;
}

function navigateWithPageTransition(link) {
    const targetUrl = new URL(link.href, window.location.href);
    document.body.classList.add('bcl-page-is-leaving');

    window.setTimeout(() => {
        window.location.href = targetUrl.href;
    }, 140);
}

function initPageTransitions() {
    if (bclPageTransitionInitialized) {
        return;
    }

    bclPageTransitionInitialized = true;
    window.requestAnimationFrame(() => {
        document.body.classList.add('bcl-page-is-ready');
    });

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!shouldUseSmoothNavigation(event, link)) {
            return;
        }

        event.preventDefault();
        navigateWithPageTransition(link);
    });

    document.addEventListener('mouseover', (event) => {
        const link = event.target.closest('a[href]');
        const targetPath = link ? normalizeInternalPath(link.href) : null;
        if (!targetPath || !BCL_SMOOTH_NAV_PATHS.has(targetPath) || link.dataset.bclPrefetched === '1') {
            return;
        }

        link.dataset.bclPrefetched = '1';
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = link.href;
        document.head.appendChild(prefetchLink);
    }, { passive: true });
}

function safeReadStoredJson(key) {
    try {
        const rawValue = localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : {};
    } catch (error) {
        return {};
    }
}

function isStoredTokenExpired(token) {
    if (!token) {
        return false;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp < Date.now() / 1000;
    } catch (error) {
        return false;
    }
}

function readStoredNavbarAuthState() {
    const token = localStorage.getItem('token');

    if (isStoredTokenExpired(token)) {
        [
            'user',
            'userData',
            'username',
            'email',
            'role',
            'userimg',
            'token'
        ].forEach((key) => localStorage.removeItem(key));

        return { isLoggedIn: false, displayName: '', token: '', role: '' };
    }

    const storedUser = safeReadStoredJson('user');
    const storedUserData = safeReadStoredJson('userData');
    const role = (
        localStorage.getItem('role') ||
        storedUser.role ||
        storedUser.jobRole ||
        storedUserData.role ||
        ''
    ).trim();
    const displayName = (
        localStorage.getItem('username') ||
        storedUser.name ||
        storedUser.username ||
        storedUserData.name ||
        ''
    ).trim();

    return {
        isLoggedIn: displayName.length > 0,
        displayName,
        token,
        role
    };
}

function isNavbarAdminRole(roleValue) {
    return String(roleValue || '').toLowerCase().includes('admin');
}

function getStoredMessageToken() {
    const storedUser = safeReadStoredJson('user');
    return localStorage.getItem('token') || storedUser.token || '';
}

function getStoredAccessToken() {
    const storedUser = safeReadStoredJson('user');
    const storedUserData = safeReadStoredJson('userData');
    return localStorage.getItem('token') || storedUser.token || storedUserData.token || '';
}

async function fetchCurrentUserAccessProfile() {
    const token = getStoredAccessToken();
    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch('/api/users/me/access', {
        headers,
        credentials: 'include',
        cache: 'no-store'
    });

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            accessProfile: null
        };
    }

    return {
        ok: true,
        status: response.status,
        accessProfile: await response.json()
    };
}

function setAccessLinksVisibility(rootElement, selector, isVisible) {
    const root = rootElement || document;
    root.querySelectorAll(selector).forEach((element) => {
        element.hidden = !isVisible;
    });
}

function applyNavbarAccessProfile(rootElement, accessProfile) {
    const profile = accessProfile || {};
    const root = rootElement || document;
    setAccessLinksVisibility(rootElement, '.dokumen-access-link', !!profile.dokumenAccess);
    setAccessLinksVisibility(rootElement, '.audit-2026-access-link', !!profile.audit2026Access);
    setAccessLinksVisibility(rootElement, '.bim-workspace-access-link', !!profile.bimWorkspaceAccess);
    const competencyLink = root.querySelector('#competency-link');
    if (competencyLink) {
        competencyLink.hidden = !profile.mappingKompetensiAccess;
    }
}

async function refreshNavbarAccessControls(rootElement = document) {
    applyNavbarAccessProfile(rootElement, null);

    try {
        const result = await fetchCurrentUserAccessProfile();
        if (!result.ok) {
            return;
        }

        applyNavbarAccessProfile(rootElement, result.accessProfile);
    } catch (error) {
        applyNavbarAccessProfile(rootElement, null);
    }
}

function renderProtectedAccessDenied(label) {
    document.body.innerHTML = `
        <main style="min-height: 100vh; display: grid; place-items: center; padding: 24px; font-family: Heebo, Arial, sans-serif; background: #f7f9fc; color: #16213d;">
            <section style="max-width: 520px; width: 100%; background: #fff; border: 1px solid rgba(22,33,61,.12); border-radius: 8px; padding: 28px; box-shadow: 0 18px 40px rgba(21,32,62,.08);">
                <h1 style="margin: 0 0 10px; font-size: 1.6rem;">Akses ${label} ditolak</h1>
                <p style="margin: 0 0 20px; color: #617083;">Halaman ini hanya bisa dibuka oleh admin atau user yang sudah diberi akses lewat Panel Admin.</p>
                <a href="/index.html" style="display: inline-block; padding: 10px 16px; background: #fb873f; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 700;">Kembali ke Beranda</a>
            </section>
        </main>
    `;
}

async function enforceProtectedPageAccess() {
    const currentPath = window.location.pathname.replace(/\/+/g, '/');
    const accessRule = BCL_PROTECTED_PAGE_ACCESS[currentPath];
    if (!accessRule) {
        return;
    }

    try {
        const result = await fetchCurrentUserAccessProfile();
        if (result.status === 401) {
            window.location.href = `/pages/login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }

        if (!result.ok || !result.accessProfile || !result.accessProfile[accessRule.key]) {
            renderProtectedAccessDenied(accessRule.label);
        }
    } catch (error) {
        renderProtectedAccessDenied(accessRule.label);
    }
}

window.BCLRefreshNavbarAccessControls = refreshNavbarAccessControls;

function setNavbarMessageIndicator(unreadCount, isVisible = true) {
    const messagesLink = document.getElementById('messages-link');
    const badge = document.getElementById('message-unread-badge');
    const dot = document.getElementById('account-message-indicator');
    const count = Number(unreadCount || 0);

    if (messagesLink) {
        messagesLink.hidden = !isVisible;
    }

    if (badge) {
        badge.hidden = !isVisible || count <= 0;
        badge.textContent = count > 99 ? '99+' : String(count);
    }

    if (dot) {
        dot.hidden = !isVisible || count <= 0;
    }
}

async function refreshNavbarMessageIndicator() {
    const authState = readStoredNavbarAuthState();
    const token = getStoredMessageToken();
    const shouldShowMessages = authState.isLoggedIn && token && !isNavbarAdminRole(authState.role);

    if (!shouldShowMessages) {
        setNavbarMessageIndicator(0, false);
        return;
    }

    setNavbarMessageIndicator(0, true);

    try {
        const response = await fetch('/api/messages', {
            headers: {
                Authorization: `Bearer ${token}`
            },
            credentials: 'include',
            cache: 'no-store'
        });

        if (!response.ok) {
            setNavbarMessageIndicator(0, true);
            return;
        }

        const data = await response.json();
        setNavbarMessageIndicator(Number(data.unread || 0), true);
    } catch (error) {
        setNavbarMessageIndicator(0, true);
    }
}

function startNavbarMessagePolling() {
    if (window.bclMessageIndicatorTimer) {
        clearInterval(window.bclMessageIndicatorTimer);
    }

    refreshNavbarMessageIndicator();
    window.bclMessageIndicatorTimer = setInterval(refreshNavbarMessageIndicator, 60000);
}

window.BCLRefreshMessageIndicator = refreshNavbarMessageIndicator;

function hydrateNavbarAuthState(rootElement) {
    if (!rootElement) {
        return;
    }

    const { isLoggedIn, displayName, role } = readStoredNavbarAuthState();
    const accountName = rootElement.querySelector('#account-name');
    const loginLink = rootElement.querySelector('#login-link');
    const logoutLink = rootElement.querySelector('#logout-link');
    const registerLink = rootElement.querySelector('#register-link');
    const dashboardLink = rootElement.querySelector('#dashboard-link');
    const messagesLink = rootElement.querySelector('#messages-link');
    const messageUnreadBadge = rootElement.querySelector('#message-unread-badge');
    const accountMessageIndicator = rootElement.querySelector('#account-message-indicator');
    const profileLink = rootElement.querySelector('#profile-link');
    const adminToolsDivider = rootElement.querySelector('#admin-tools-divider');
    const competencyLink = rootElement.querySelector('#competency-link');
    const adminLink = rootElement.querySelector('#admin-link');

    if (accountName) {
        accountName.textContent = isLoggedIn ? displayName : 'Akun';
    }

    if (loginLink) {
        loginLink.hidden = isLoggedIn;
    }

    if (logoutLink) {
        logoutLink.hidden = !isLoggedIn;
    }

    if (registerLink) {
        registerLink.hidden = isLoggedIn;
    }

    if (dashboardLink) {
        dashboardLink.hidden = !isLoggedIn;
    }

    if (messagesLink) {
        messagesLink.hidden = !isLoggedIn || isNavbarAdminRole(role);
    }

    if (messageUnreadBadge) {
        messageUnreadBadge.hidden = true;
    }

    if (accountMessageIndicator) {
        accountMessageIndicator.hidden = true;
    }

    if (profileLink) {
        profileLink.hidden = !isLoggedIn;
    }

    if (adminToolsDivider) {
        adminToolsDivider.hidden = true;
    }

    if (competencyLink) {
        competencyLink.hidden = true;
    }

    if (adminLink) {
        adminLink.hidden = true;
    }
}

function loadNavbar() {
    // Adjust path based on current location
    const currentPath = window.location.pathname;
    const navbarPath = currentPath.startsWith('/elearning-assets/') ?
        '../components/navbar.html' : '/components/navbar.html';

    fetch(navbarPath)
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById('navbar-container');
            if (container) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                hydrateNavbarAuthState(tempDiv);
                container.innerHTML = tempDiv.innerHTML;

                // Eksekusi ulang semua <script> di dalam navbar (jika ada)
                const scripts = container.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    newScript.text = oldScript.textContent;
                    document.body.appendChild(newScript);
                });

                // Coba update user UI setelah load dengan retry untuk memastikan konsistensi
                let retryCount = 0;
                const maxRetries = 5;
                const updateUIWithRetry = () => {
                    if (typeof updateUserUI === 'function') {
                        updateUserUI();
                        refreshNavbarAccessControls(container);
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(updateUIWithRetry, 200);
                    }
                };

                // Initial update without delay so the account label does not flash as guest first
                updateUIWithRetry();
                startNavbarMessagePolling();

                // Additional update after longer delay to handle cross-section navigation
                setTimeout(() => {
                    if (typeof updateUserUI === 'function') {
                        updateUserUI();
                    }
                    refreshNavbarAccessControls(container);
                    refreshNavbarMessageIndicator();
                }, 300);

                // Setup event listener for dropdown to adjust links on click
                setupDropdownListener();
            }
        })
        .catch(err => console.error('❌ Gagal load navbar:', err));
}


function loadFooter() {
    // Adjust path based on current location
    const currentPath = window.location.pathname;
    const footerPath = currentPath.startsWith('/elearning-assets/') ?
        '../components/footer.html' : '/components/footer.html';

    fetch(footerPath)
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById('footer-container');
            if (container) {
                container.innerHTML = html;
            }
        })
        .catch(err => console.error('❌ Gagal load footer:', err));
}

function ensureFavicon() {
    const faviconHref = '/logos/fav_logo_BCL.ico?v=20260424b';
    const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon'];

    document
        .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
        .forEach((link) => link.remove());

    iconRels.forEach((rel) => {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = faviconHref;
        link.type = 'image/x-icon';
        document.head.appendChild(link);
    });
}

function normalizePageTitleText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\bBIM NKE\s*:\s*/gi, '')
        .replace(/\bBCL\s*-\s*BIM Central Learning\b/gi, '')
        .replace(/\bBIM Central Learning\b/gi, '')
        .replace(/\bBC Learning\b/gi, '')
        .replace(/\|\s*BCL\b/gi, '')
        .replace(/-\s*BCL\b/gi, '')
        .replace(/\bBCL\b\s*-\s*/gi, '')
        .replace(/\bBCL\b/gi, '')
        .replace(/\s*[-|:]\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function toTitleCase(value) {
    return String(value || '').replace(/\w\S*/g, (word) => {
        if (word === word.toUpperCase() && word.length > 1) {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

function isGenericPageTitle(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '' || normalized === 'redirecting...' || normalized === 'redirecting' || normalized === 'loading...';
}

function deriveTitleFromPath() {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const routeName = pathname.split('/').pop() || '';

    if (pathname === '/' || routeName === 'index.html' || routeName === 'home.html') {
        return 'Home';
    }

    return toTitleCase(
        routeName
            .replace(/\.html?$/i, '')
            .replace(/[-_]+/g, ' ')
            .trim()
    );
}

function resolvePreferredPageTitle() {
    const cleanedDocumentTitle = toTitleCase(normalizePageTitleText(document.title));
    if (!isGenericPageTitle(cleanedDocumentTitle)) {
        return cleanedDocumentTitle;
    }

    const headingSelectors = [
        '.page-title-header h1',
        '.page-header h1',
        'main h1',
        '.heading',
        'h1'
    ];

    for (const selector of headingSelectors) {
        const element = document.querySelector(selector);
        const text = normalizePageTitleText(element && element.textContent);
        if (text) {
            return toTitleCase(text);
        }
    }

    return deriveTitleFromPath() || 'BCL';
}

function applyPageTitle() {
    const preferredTitle = resolvePreferredPageTitle();
    document.title = preferredTitle === 'BCL' ? 'BCL' : `${preferredTitle} | BCL`;
}

// Function to adjust account submenu links based on current page path
function adjustAccountSubmenuLinks() {
    const currentPath = window.location.pathname;

    // If current path starts with '/pages/', adjust account submenu links to point to '/elearning-assets/'
    if (currentPath.startsWith('/pages/')) {
        // Find links by text content instead of href to be more reliable
        const dropdownItems = document.querySelectorAll('.dropdown-menu a.dropdown-item');

        dropdownItems.forEach(link => {
            const text = link.textContent.trim();

            if (text === 'My Profiles') {
                link.href = '/elearning-assets/profile.html';
            } else if (text === 'My Progress') {
                link.href = '/elearning-assets/dashboard.html';
            } else if (text === 'My Badges') {
                link.href = '/elearning-assets/badges.html';
            }
        });
    }
}

// Function to setup listener for account dropdown to adjust links when clicked
function setupDropdownListener() {
    // Wait a bit for navbar to be fully ready, then add event listener
    setTimeout(() => {
        const accountDropdownToggle = document.querySelector('.navbar-nav .dropdown-toggle[aria-expanded]');
        if (accountDropdownToggle) {
            accountDropdownToggle.addEventListener('click', () => {
                setTimeout(() => {
                    adjustAccountSubmenuLinks();
                }, 10);
            });
        }
    }, 500);
}

window.addEventListener("DOMContentLoaded", () => {
    initPageTransitions();
    enforceProtectedPageAccess();
    ensureFavicon();
    applyPageTitle();
    loadNavbar();
    loadFooter();
    setTimeout(applyPageTitle, 300);
});
