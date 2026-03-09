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

// Fixed: Update user UI with retry for async navbar loading
function updateUserUI() {
    const username = localStorage.getItem("username");
    const token = localStorage.getItem("token");

    // Check if token is expired
    if (token && isTokenExpired(token)) {
        console.log("🔴 Token expired, clearing auth data");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        // Clear any other auth-related storage
        localStorage.removeItem("user");
        localStorage.removeItem("email");
        localStorage.removeItem("role");
        localStorage.removeItem("userimg");
    }

    const accountName = document.getElementById("account-name");
    const loginLink = document.getElementById("login-link");
    const logoutLink = document.getElementById("logout-link");

    // Jika elemen navbar belum ada (karena async loading), retry setelah delay
    if (!accountName || !loginLink || !logoutLink) {
        console.log("⏳ Auth: Elemen navbar belum siap, retry dalam 200ms...");
        setTimeout(updateUserUI, 200);
        return;
    }

    console.log("✅ Auth: Elemen navbar ditemukan, mengatur auth UI");

    if (token && username) {
        console.log("✅ User terdeteksi login sebagai:", username);
        if (accountName) accountName.innerText = username;
        if (loginLink) loginLink.style.display = "none";
        if (logoutLink) logoutLink.style.display = "block";
    } else {
        if (accountName) accountName.innerText = "Account";
        if (loginLink) loginLink.style.display = "block";
        if (logoutLink) logoutLink.style.display = "none";
    }

    if (logoutLink) {
        logoutLink.addEventListener("click", function (event) {
            event.preventDefault();
            console.log("🔴 User logout...");
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            localStorage.removeItem("user");
            localStorage.removeItem("email");
            localStorage.removeItem("role");
            localStorage.removeItem("userimg");

            window.location.href = "/index.html";
        });
    }
}


// Periksa apakah user sudah login atau belum
function checkAuth() {
    const token = localStorage.getItem("token");

    if (!token) {
        // Simpan halaman terakhir sebelum login
        sessionStorage.setItem("lastPage", window.location.href);

        // Redirect ke halaman login
        window.location.href = "../login.html";
    }
}

// Jalankan `checkAuth()` di semua halaman yang memerlukan login
document.addEventListener("DOMContentLoaded", checkAuth);
