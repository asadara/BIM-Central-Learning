// Wait for components to be loaded
document.addEventListener('componentsLoaded', function () {
    initializeButtons();
});

// Also wait for DOM to be fully loaded as fallback
document.addEventListener('DOMContentLoaded', function () {
    // Initialize after a short delay to ensure components are loaded
    setTimeout(initializeButtons, 200);
});

function initializeButtons() {
    // Dark mode functionality
    let toggleBtn = document.getElementById('toggle-btn');
    let body = document.body;
    let darkMode = localStorage.getItem('dark-mode');

    const enableDarkMode = () => {
        if (toggleBtn) {
            toggleBtn.classList.replace('fa-sun', 'fa-moon');
            body.classList.add('dark');
            localStorage.setItem('dark-mode', 'enabled');
        }
    }

    const disableDarkMode = () => {
        if (toggleBtn) {
            toggleBtn.classList.replace('fa-moon', 'fa-sun');
            body.classList.remove('dark');
            localStorage.setItem('dark-mode', 'disabled');
        }
    }

    if (darkMode === 'enabled') {
        enableDarkMode();
    }

    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            darkMode = localStorage.getItem('dark-mode');
            if (darkMode === 'disabled') {
                enableDarkMode();
            } else {
                disableDarkMode();
            }
        }
    }

    // User profile dropdown functionality
    let profile = document.querySelector('.header .flex .profile');
    let userBtn = document.querySelector('#user-btn');

    if (userBtn && profile) {
        userBtn.onclick = () => {
            profile.classList.toggle('active');
            let search = document.querySelector('.header .flex .search-form');
            if (search) search.classList.remove('active');
        }
    }

    // Search functionality (for mobile)
    let search = document.querySelector('.header .flex .search-form');
    let searchBtn = document.querySelector('#search-btn');

    if (searchBtn && search) {
        searchBtn.onclick = () => {
            search.classList.toggle('active');
            if (profile) profile.classList.remove('active');
        }
    }

    // Menu button functionality
    let menuBtn = document.querySelector('#menu-btn');

    if (menuBtn) {
        menuBtn.onclick = () => {
            // Wait for sidebar to be loaded by component system
            setTimeout(() => {
                let sideBar = document.querySelector('.side-bar');
                if (sideBar) {
                    sideBar.classList.toggle('active');
                    document.body.classList.toggle('active');
                }
            }, 50);
        }
    }
}

// Handle close button for component-based sidebar
document.addEventListener('click', (e) => {
    if (e.target.id === 'close-btn' || e.target.closest('#close-btn')) {
        let sideBar = document.querySelector('.side-bar');
        if (sideBar) {
            sideBar.classList.remove('active');
            document.body.classList.remove('active');
        }
    }
});

// Handle clicks outside of profile and search to close them
document.addEventListener('click', (e) => {
    let profile = document.querySelector('.header .flex .profile');
    let search = document.querySelector('.header .flex .search-form');
    let userBtn = document.querySelector('#user-btn');
    let searchBtn = document.querySelector('#search-btn');

    // Close profile if clicking outside
    if (profile && !profile.contains(e.target) && e.target !== userBtn) {
        profile.classList.remove('active');
    }

    // Close search if clicking outside
    if (search && !search.contains(e.target) && e.target !== searchBtn) {
        search.classList.remove('active');
    }
});

window.onscroll = () => {
    let profile = document.querySelector('.header .flex .profile');
    let search = document.querySelector('.header .flex .search-form');

    if (profile) profile.classList.remove('active');
    if (search) search.classList.remove('active');

    if (window.innerWidth < 1200) {
        let sideBar = document.querySelector('.side-bar');
        if (sideBar) {
            sideBar.classList.remove('active');
            document.body.classList.remove('active');
        }
    }
}