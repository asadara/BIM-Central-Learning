// Page tracker untuk menyimpan halaman terakhir user
(function () {
    'use strict';

    function saveCurrentPage() {
        // Simpan current page sebagai lastPage (kecuali untuk halaman login/register)
        const currentPath = window.location.pathname;
        const excludedPages = [
            '/pages/login.html',
            '/pages/register.html',
            '/login.html',
            '/register.html',
            '/elearning-assets/login.html',
            '/elearning-assets/register.html'
        ];

        // Jangan simpan jika ini adalah halaman login/register
        if (!excludedPages.includes(currentPath)) {
            localStorage.setItem('lastPage', currentPath);
        }
    }

    // Save current page when page loads
    document.addEventListener('DOMContentLoaded', saveCurrentPage);

    // Also save immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', saveCurrentPage);
    } else {
        saveCurrentPage();
    }

    // Save page on beforeunload (when user leaves page)
    window.addEventListener('beforeunload', saveCurrentPage);

})();
