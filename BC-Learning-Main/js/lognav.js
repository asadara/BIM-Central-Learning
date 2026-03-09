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

function updateUserUI() {
    const username = localStorage.getItem("username");
    const token = localStorage.getItem("token");

    // Check if token is expired
    if (token && isTokenExpired(token)) {
        console.log("🔴 Token expired, clearing auth data");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("user");
        localStorage.removeItem("email");
        localStorage.removeItem("role");
        localStorage.removeItem("userimg");
    }

    const accountName = document.getElementById("account-name");
    const loginLink = document.getElementById("login-link");
    const logoutLink = document.getElementById("logout-link");

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


// Fixed: Initialize lognav with retry for async navbar loading
function initializeLognav() {
    let username = localStorage.getItem("username");
    let token = localStorage.getItem("token");

    let accountName = document.getElementById("account-name");
    let loginLink = document.getElementById("login-link");
    let logoutLink = document.getElementById("logout-link");

    // Jika elemen navbar belum ada (karena async loading), retry setelah delay
    if (!accountName || !loginLink || !logoutLink) {
        console.log("⏳ Lognav: Elemen navbar belum siap, retry dalam 200ms...");
        setTimeout(initializeLognav, 200);
        return;
    }

    console.log("✅ Lognav: Elemen navbar ditemukan, mengatur auth UI");

    if (token && username) {
        accountName.innerText = username; // Menampilkan nama user
        loginLink.style.display = "none"; // Sembunyikan tombol login
        logoutLink.style.display = "block"; // Tampilkan tombol logout
    } else {
        accountName.innerText = "Account"; // Jika tidak login, tetap "Account"
        loginLink.style.display = "block";
        logoutLink.style.display = "none";
    }

    // Tambahkan event untuk logout
    logoutLink.addEventListener("click", function () {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "../index.html"; // Redirect setelah logout
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // Delay sedikit untuk memastikan navbar sudah mulai dimuat
    setTimeout(initializeLognav, 100);
});
