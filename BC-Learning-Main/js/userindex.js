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

// ✅ Consolidated user data management functions for consistency
function getUserData() {
    try {
        const userData = localStorage.getItem("user");
        if (!userData) return null;

        const parsed = JSON.parse(userData);
        // Validate essential fields
        if (!parsed || typeof parsed !== 'object') return null;

        return parsed;
    } catch (e) {
        console.warn('❌ Error parsing user data from localStorage:', e);
        localStorage.removeItem("user"); // Clean up corrupted data
        return null;
    }
}

function setUserData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid user data provided');
        }

        // Normalize data structure
        const normalizedData = {
            name: data.name || data.username || '',
            email: data.email || '',
            role: data.role || 'Student',
            photo: data.photo || data.image || data.img || '/img/user-default.png',
            token: data.token || ""
        };

        localStorage.setItem("user", JSON.stringify(normalizedData));
        localStorage.setItem("username", normalizedData.name);
        localStorage.setItem("email", normalizedData.email);
        localStorage.setItem("role", normalizedData.role);
        localStorage.setItem("userimg", normalizedData.photo);
        localStorage.setItem("token", normalizedData.token);
        window.currentUser = normalizedData;

        console.log('✅ User data saved successfully:', {
            name: normalizedData.name,
            email: normalizedData.email,
            role: normalizedData.role,
            photo: normalizedData.photo
        });
    } catch (error) {
        console.error('❌ Error saving user data:', error);
    }
}

function updateUserUI() {
    const user = getUserData();
    const accountName = document.getElementById("account-name");
    const loginLink = document.getElementById("login-link");
    const logoutLink = document.getElementById("logout-link");
    // Optionally add registerLink if present in navbar
    const registerLink = document.getElementById("register-link");

    if (!user) {
        // Not logged in
        if (accountName) accountName.textContent = "Account";
        if (loginLink) loginLink.style.display = "block";
        if (logoutLink) logoutLink.style.display = "none";
        if (registerLink) registerLink.style.display = "block";
        return;
    }

    try {
        // Update navbar
        if (accountName) accountName.textContent = user.name || "Account";
        if (loginLink) loginLink.style.display = "none";
        if (logoutLink) logoutLink.style.display = "block";
        if (registerLink) registerLink.style.display = "none";
        setupLogoutHandler(user);
        window.currentUser = user;
    } catch (error) {
        console.error('❌ Error updating user UI:', error);
    }
}

function setupLogoutHandler(user) {
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink && !logoutLink.dataset.bound) {
        logoutLink.addEventListener("click", function (e) {
            e.preventDefault();
            handleLogout();
        });
        logoutLink.dataset.bound = "true";
    }
}

function handleLogout() {
    try {
        console.log("🔴 Logging out...");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("user");
        localStorage.removeItem("email");
        localStorage.removeItem("role");
        localStorage.removeItem("userimg");
        window.currentUser = null;

        // Redirect to main page
        window.location.href = "/index.html";
    } catch (error) {
        console.error('❌ Error during logout:', error);
        // Force redirect even if there's an error
        window.location.href = "/index.html";
    }
}

//Mengatur user login dan logout - dengan retry untuk navbar async loading
async function initializeUserAuth() {
    let username = localStorage.getItem("username");
    let token = localStorage.getItem("token"); // Pastikan token juga dicek

    // Check if token is expired
    if (token && isTokenExpired(token)) {
        console.log("🔴 Token expired in userindex, clearing auth data");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("user");
        localStorage.removeItem("email");
        localStorage.removeItem("role");
        localStorage.removeItem("userimg");
        token = null;
        username = null;
    }

    let accountName = document.getElementById("account-name");
    let loginLink = document.getElementById("login-link");
    let logoutLink = document.getElementById("logout-link");

    // Jika elemen navbar belum ada (karena async loading), retry setelah delay
    if (!accountName || !loginLink || !logoutLink) {
        console.log("⏳ Elemen navbar belum siap, retry dalam 200ms...");
        setTimeout(initializeUserAuth, 200);
        return;
    }

    console.log("✅ Elemen navbar ditemukan, mengatur auth UI");

    // Check for admin session first
    try {
        const adminResponse = await fetch('/api/admin/session');
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            if (adminData.authenticated && adminData.user) {
                console.log("👑 Admin session found:", adminData.user.email);
                accountName.textContent = adminData.user.email + " (Admin)"; // Show admin indicator
                loginLink.style.display = "none"; // Sembunyikan tombol login
                logoutLink.style.display = "block"; // Tampilkan tombol logout

                // Setup admin logout handler
                logoutLink.addEventListener("click", function (e) {
                    e.preventDefault();
                    handleAdminLogout();
                });

                return; // Exit early if admin session found
            }
        }
    } catch (adminError) {
        console.log("ℹ️ No admin session found, checking regular user auth");
    }

    // Check for regular user session
    if (token && username) {
        accountName.textContent = username; // Ubah teks akun jadi username
        loginLink.style.display = "none"; // Sembunyikan tombol login
        logoutLink.style.display = "block"; // Tampilkan tombol logout
    } else {
        accountName.textContent = "Account";
        loginLink.style.display = "block"; // Pastikan tombol login muncul
        logoutLink.style.display = "none"; // Sembunyikan tombol logout
    }

    // Fungsi Logout untuk regular user
    logoutLink.addEventListener("click", function (e) {
        e.preventDefault();
        handleRegularLogout();
    });
}

// Admin logout function
function handleAdminLogout() {
    try {
        console.log("🔴 Logging out admin...");
        fetch('/api/admin/logout', { method: 'POST' })
            .then(() => {
                // Redirect to main page after logout
                window.location.href = "/index.html";
            })
            .catch(error => {
                console.error('Admin logout error:', error);
                // Force redirect even if logout fails
                window.location.href = "/index.html";
            });
    } catch (error) {
        console.error('❌ Error during admin logout:', error);
        // Force redirect even if there's an error
        window.location.href = "/index.html";
    }
}

// Regular user logout function
function handleRegularLogout() {
    try {
        console.log("🔴 Logging out regular user...");
        localStorage.removeItem("token"); // Pastikan token juga dihapus
        localStorage.removeItem("username");
        localStorage.removeItem("user");
        localStorage.removeItem("email");
        localStorage.removeItem("role");
        localStorage.removeItem("userimg");
        window.location.href = "/index.html";
    } catch (error) {
        console.error('❌ Error during regular logout:', error);
        // Force redirect even if there's an error
        window.location.href = "/index.html";
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Delay sedikit untuk memastikan navbar sudah mulai dimuat
    setTimeout(initializeUserAuth, 100);
});

//Memastikan user login atau belum - REMOVED duplicate listener
// This functionality is now handled by initializeUserAuth()

//Mengelola tombol user login - REMOVED duplicate listener
// This functionality is now handled by initializeUserAuth()
