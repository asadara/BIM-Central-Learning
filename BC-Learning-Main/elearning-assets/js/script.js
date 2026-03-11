// Wait for components to be loaded
document.addEventListener('componentsLoaded', function () {
    initializeButtons();
});

// Also wait for DOM to be fully loaded as fallback
document.addEventListener('DOMContentLoaded', function () {
    // Initialize after a short delay to ensure components are loaded
    setTimeout(initializeButtons, 200);
});

const SIDEBAR_DESKTOP_STATE_KEY = 'elearnSidebarDesktopState';

function persistDesktopSidebarState(isCollapsed) {
    try {
        localStorage.setItem(SIDEBAR_DESKTOP_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
    } catch (error) {
        console.warn('Failed to persist desktop sidebar state:', error);
    }
}

function getPersistedDesktopSidebarState() {
    try {
        return localStorage.getItem(SIDEBAR_DESKTOP_STATE_KEY) || 'expanded';
    } catch (error) {
        console.warn('Failed to read desktop sidebar state:', error);
        return 'expanded';
    }
}

function applyPersistedDesktopSidebarState() {
    if (window.innerWidth < 1200) return;

    const sideBar = document.querySelector('.side-bar');
    if (!sideBar) return;

    const persistedState = getPersistedDesktopSidebarState();
    const shouldCollapse = persistedState === 'collapsed';

    document.body.classList.toggle('sidebar-collapsed', shouldCollapse);
    sideBar.classList.remove('active');
    document.body.classList.remove('active');
}

function syncSidebarToggleHandle() {
    const sideBar = document.querySelector('.side-bar');
    const handle = document.querySelector('.sidebar-toggle-handle');
    if (!sideBar || !handle) return;

    const isDesktop = window.innerWidth >= 1200;
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    const icon = handle.querySelector('i');

    handle.hidden = !isDesktop;
    handle.setAttribute('aria-expanded', String(!isCollapsed));
    handle.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    handle.setAttribute('title', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');

    if (icon) {
        icon.className = `fas fa-chevron-${isCollapsed ? 'right' : 'left'}`;
    }
}

function toggleElearningSidebar() {
    const sideBar = document.querySelector('.side-bar');
    if (!sideBar) return;

    if (window.innerWidth < 1200) {
        sideBar.classList.toggle('active');
        document.body.classList.toggle('active', sideBar.classList.contains('active'));
        document.body.classList.remove('sidebar-collapsed');
        syncSidebarToggleHandle();
        return;
    }

    document.body.classList.toggle('sidebar-collapsed');
    sideBar.classList.remove('active');
    document.body.classList.remove('active');
    persistDesktopSidebarState(document.body.classList.contains('sidebar-collapsed'));
    syncSidebarToggleHandle();
}

window.toggleElearningSidebar = toggleElearningSidebar;

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
    let sidebarHandle = document.querySelector('.sidebar-toggle-handle');

    if (menuBtn) {
        menuBtn.onclick = () => {
            // Wait for sidebar to be loaded by component system
            setTimeout(toggleElearningSidebar, 50);
        }
    }

    if (sidebarHandle) {
        sidebarHandle.onclick = () => {
            toggleElearningSidebar();
        }
    }

    applyPersistedDesktopSidebarState();
    syncSidebarToggleHandle();

    initializeMobilePageNav();
}

function initializeMobilePageNav() {
    const currentPath = window.location.pathname.replace(/\/+$/, '');
    const navLinks = document.querySelectorAll('.mobile-page-nav a[data-nav-match]');

    navLinks.forEach((link) => {
        try {
            const targetPath = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, '');
            link.classList.toggle('active', targetPath === currentPath);
        } catch (error) {
            link.classList.remove('active');
        }
    });
}

// Handle close button for component-based sidebar
document.addEventListener('click', (e) => {
    if (e.target.id === 'close-btn' || e.target.closest('#close-btn')) {
        let sideBar = document.querySelector('.side-bar');
        if (sideBar) {
            sideBar.classList.remove('active');
            document.body.classList.remove('active');
            document.body.classList.remove('sidebar-collapsed');
            syncSidebarToggleHandle();
        }
    }
});

document.addEventListener('componentsLoaded', () => {
    setTimeout(initializeMobilePageNav, 50);
    setTimeout(applyPersistedDesktopSidebarState, 70);
    setTimeout(syncSidebarToggleHandle, 80);
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
            syncSidebarToggleHandle();
        }
    }
}

window.addEventListener('resize', () => {
    if (window.innerWidth >= 1200) {
        document.querySelector('.side-bar')?.classList.remove('active');
        document.body.classList.remove('active');
        applyPersistedDesktopSidebarState();
    } else {
        document.body.classList.remove('sidebar-collapsed');
    }

    syncSidebarToggleHandle();
});
