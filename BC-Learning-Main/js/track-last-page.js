// track-last-page.js
document.addEventListener('DOMContentLoaded', () => {
    // Jangan simpan halaman login/register sebagai lastPage
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
        localStorage.setItem('lastPage', window.location.pathname);
    }
});