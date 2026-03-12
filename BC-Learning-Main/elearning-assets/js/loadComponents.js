// loadComponents.js - Sinkronisasi Global User + Navbar

// loadComponents.js
function loadNavbar() {
    fetch('/elearning-assets/components/navbar.html')
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById('navbar-container');
            if (container) {
                container.innerHTML = html;

                // Eksekusi ulang semua <script> di dalam navbar (jika ada)
                const scripts = container.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    newScript.text = oldScript.textContent;
                    document.body.appendChild(newScript);
                });

                // Coba update user UI setelah load
                setTimeout(() => {
                    if (typeof updateUserUI === 'function') {
                        updateUserUI();
                    }
                }, 100); // beri delay kecil
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

