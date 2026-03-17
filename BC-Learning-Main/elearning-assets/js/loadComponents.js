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
    fetch('/components/navbar.html')
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

                // Coba update user UI setelah load
                if (typeof updateUserUI === 'function') {
                    updateUserUI();
                } else {
                    setTimeout(() => {
                        if (typeof updateUserUI === 'function') {
                            updateUserUI();
                        }
                    }, 100);
                }
            }
        })
        .catch(err => console.error('❌ Gagal load navbar:', err));
}


function loadFooter() {
    fetch('/elearning-assets/components/footer.html')
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById('footer-container');
            if (container) {
                container.innerHTML = html;
            }
        })
        .catch(err => console.error('❌ Gagal load footer:', err));
}

window.addEventListener("DOMContentLoaded", () => {
    console.log("🧩 Memuat komponen navbar & footer...");
    loadNavbar();
    loadFooter();
});

