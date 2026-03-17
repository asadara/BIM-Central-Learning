// Navbar component loader untuk halaman utama
function safeReadStoredJson(key) {
    try {
        const rawValue = localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : {};
    } catch (error) {
        return {};
    }
}

function readStoredNavbarAuthState() {
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

async function loadNavbar() {
    try {
        const response = await fetch('../components/navbar.html');
        const navbarHTML = await response.text();

        // Insert navbar HTML
        const navbarContainer = document.querySelector('.navbar-container') ||
            document.body;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = navbarHTML;
        hydrateNavbarAuthState(tempDiv);
        const fragment = document.createDocumentFragment();

        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }

        // Replace existing navbar atau insert sebagai first child
        const existingNavbar = document.querySelector('.navbar');
        if (existingNavbar) {
            existingNavbar.replaceWith(fragment);
        } else {
            navbarContainer.insertBefore(fragment, navbarContainer.firstChild);
        }

        // Trigger custom event untuk notify bahwa navbar sudah loaded
        document.dispatchEvent(new CustomEvent('navbarLoaded'));

        // Sync user data setelah navbar dimuat
        syncNavbarUserInfo();

        // Setup dropdown listener to adjust links on click
        setTimeout(() => {
            setupDropdownListener();
        }, 300);

    } catch (error) {
        console.warn('Failed to load navbar component:', error);
    }
}

// ✅ Fixed: JWT Token expiration check
function isTokenExpired(token) {
    if (!token) return true;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        return payload.exp < currentTime;
    } catch (error) {
        console.warn('❌ Error checking token expiration:', error);
        return true;
    }
}

// Fungsi untuk sinkronisasi user info di navbar
function syncNavbarUserInfo() {
    // Ambil data user dari localStorage (support both formats)
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role') || 'student';
    const userimg = localStorage.getItem('userimg');
    const token = localStorage.getItem('token');

    // Check if token is expired
    if (token && isTokenExpired(token)) {
        console.log("🔴 Token expired in navbar-loader, clearing auth data");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        localStorage.removeItem("userimg");
        localStorage.removeItem("userData");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("email");
    }

    // Juga cek format userData JSON
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    // Prioritas data: individual keys > userData object
    const finalUsername = username || userData.name;
    const finalRole = role || userData.role || 'student';
    const finalImage = userimg || userData.image;

    console.log('Syncing navbar user info:', { finalUsername, finalRole, finalImage });

    // Update navbar account name
    const accountName = document.getElementById("account-name");
    const loginLink = document.getElementById("login-link");
    const logoutLink = document.getElementById("logout-link");

    if (accountName && finalUsername) {
        accountName.textContent = finalUsername;
    }

    // Handle login/logout buttons visibility
    if (finalUsername && loginLink && logoutLink) {
        loginLink.style.display = "none";
        logoutLink.style.display = "block";

        // Setup logout handler
        logoutLink.addEventListener("click", function (e) {
            e.preventDefault();
            // Clear all possible user data formats
            localStorage.removeItem("username");
            localStorage.removeItem("role");
            localStorage.removeItem("userimg");
            localStorage.removeItem("userData");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("email");
            window.location.href = "../index.html";
        });
    } else if (loginLink && logoutLink) {
        loginLink.style.display = "block";
        logoutLink.style.display = "none";
    }
}

// Function to adjust account submenu links based on current page path
function adjustAccountSubmenuLinks() {
    const currentPath = window.location.pathname;
    console.log('🔄 Adjusting account submenu links, current path:', currentPath);

    // If current path starts with '/pages/', adjust account submenu links to point to '/elearning-assets/'
    if (currentPath.startsWith('/pages/')) {
        console.log('📝 Path starts with /pages/, updating links...');

        // Find links by text content instead of href to be more reliable
        const dropdownItems = document.querySelectorAll('.dropdown-menu a.dropdown-item');
        console.log('Found dropdown items:', dropdownItems.length);

        dropdownItems.forEach(link => {
            const text = link.textContent.trim();
            console.log('Link text:', text, 'href:', link.href);

            if (text === 'My Profiles') {
                link.href = '/elearning-assets/profile.html';
                console.log('✅ Updated My Profiles to:', link.href);
            } else if (text === 'My Progress') {
                link.href = '/elearning-assets/dashboard.html';
                console.log('✅ Updated My Progress to:', link.href);
            } else if (text === 'My Badges') {
                link.href = '/elearning-assets/badges.html';
                console.log('✅ Updated My Badges to:', link.href);
            }
        });
    } else {
        console.log('⏭️ Path does not start with /pages/, no changes needed');
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

// Auto-load navbar ketika DOM ready
document.addEventListener('DOMContentLoaded', loadNavbar);

// Juga load jika sudah ready (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNavbar);
} else {
    loadNavbar();
}
