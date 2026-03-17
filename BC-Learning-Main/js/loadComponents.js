// loadComponents.js - Sinkronisasi Global User + Navbar

// loadComponents.js
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

        return { isLoggedIn: false, displayName: '' };
    }

    const storedUser = safeReadStoredJson('user');
    const storedUserData = safeReadStoredJson('userData');
    const displayName = (
        localStorage.getItem('username') ||
        storedUser.name ||
        storedUser.username ||
        storedUserData.name ||
        ''
    ).trim();

    return {
        isLoggedIn: displayName.length > 0,
        displayName
    };
}

function hydrateNavbarAuthState(rootElement) {
    if (!rootElement) {
        return;
    }

    const { isLoggedIn, displayName } = readStoredNavbarAuthState();
    const accountName = rootElement.querySelector('#account-name');
    const loginLink = rootElement.querySelector('#login-link');
    const logoutLink = rootElement.querySelector('#logout-link');
    const registerLink = rootElement.querySelector('#register-link');

    if (accountName) {
        accountName.textContent = isLoggedIn ? displayName : 'Account';
    }

    if (loginLink) {
        loginLink.style.display = isLoggedIn ? 'none' : 'block';
    }

    if (logoutLink) {
        logoutLink.style.display = isLoggedIn ? 'block' : 'none';
    }

    if (registerLink) {
        registerLink.style.display = isLoggedIn ? 'none' : 'block';
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
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(updateUIWithRetry, 200);
                    }
                };

                // Initial update without delay so the account label does not flash as guest first
                updateUIWithRetry();

                // Additional update after longer delay to handle cross-section navigation
                setTimeout(() => {
                    if (typeof updateUserUI === 'function') {
                        updateUserUI();
                    }
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
    const faviconHref = '/img/icons/icon_bcl.ico?v=20260313c';
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
    ensureFavicon();
    loadNavbar();
    loadFooter();
});
