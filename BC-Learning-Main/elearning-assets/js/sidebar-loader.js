// Persistent sidebar loader and UI sync helpers.
let sidebarLoaded = false;
let sidebarElement = null;

const SIDEBAR_SCROLL_KEY = 'elearnSidebarScrollTop';
const ACTIVE_SIDEBAR_CHECK_DELAYS = [120, 260, 520];

let ensureActiveSidebarVisibilityFrame = null;
let ensureActiveSidebarVisibilityTimers = [];

function persistSidebarScrollPosition() {
    const sideBar = document.querySelector('.side-bar');
    if (!sideBar) return;

    try {
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sideBar.scrollTop || 0));
    } catch (error) {
        console.warn('Failed to persist sidebar scroll position:', error);
    }
}

function restoreSidebarScrollPosition() {
    const sideBar = document.querySelector('.side-bar');
    if (!sideBar) return;

    let savedScrollTop = 0;

    try {
        savedScrollTop = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
    } catch (error) {
        console.warn('Failed to read sidebar scroll position:', error);
    }

    const applyScroll = () => {
        sideBar.scrollTop = savedScrollTop;
    };

    requestAnimationFrame(() => {
        applyScroll();
        requestAnimationFrame(applyScroll);
    });
}

function ensureActiveSidebarItemVisible() {
    const sideBar = document.querySelector('.side-bar');
    const activeLink = document.querySelector('.side-bar .navbar a.is-active');
    if (!sideBar || !activeLink) return;

    const topBuffer = 12;
    const bottomBuffer = 16;
    const sideBarRect = sideBar.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();
    const activeTop = activeRect.top - sideBarRect.top + sideBar.scrollTop;
    const activeBottom = activeTop + activeRect.height;
    const visibleTop = sideBar.scrollTop + topBuffer;
    const visibleBottom = sideBar.scrollTop + sideBar.clientHeight - bottomBuffer;

    let targetScrollTop = null;

    if (activeTop < visibleTop) {
        targetScrollTop = Math.max(activeTop - topBuffer, 0);
    } else if (activeBottom > visibleBottom) {
        targetScrollTop = Math.max(activeBottom - sideBar.clientHeight + bottomBuffer, 0);
    }

    if (targetScrollTop !== null) {
        sideBar.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }
}

function scheduleEnsureActiveSidebarItemVisible() {
    ensureActiveSidebarVisibilityTimers.forEach((timerId) => clearTimeout(timerId));
    ensureActiveSidebarVisibilityTimers = [];

    if (ensureActiveSidebarVisibilityFrame !== null) {
        cancelAnimationFrame(ensureActiveSidebarVisibilityFrame);
        ensureActiveSidebarVisibilityFrame = null;
    }

    ensureActiveSidebarVisibilityFrame = requestAnimationFrame(() => {
        ensureActiveSidebarVisibilityFrame = requestAnimationFrame(() => {
            ensureActiveSidebarItemVisible();
            ensureActiveSidebarVisibilityFrame = null;
        });
    });

    ACTIVE_SIDEBAR_CHECK_DELAYS.forEach((delay) => {
        const timerId = setTimeout(ensureActiveSidebarItemVisible, delay);
        ensureActiveSidebarVisibilityTimers.push(timerId);
    });
}

function setupSidebarEventHandlers() {
    const sideBar = document.querySelector('.side-bar');

    if (sideBar && sideBar.dataset.scrollPersistenceReady !== 'true') {
        sideBar.addEventListener('scroll', persistSidebarScrollPosition, { passive: true });

        sideBar.querySelectorAll('a[href]').forEach((link) => {
            link.addEventListener('click', persistSidebarScrollPosition);
        });

        sideBar.dataset.scrollPersistenceReady = 'true';
    }

    const closeBtn = document.querySelector('#close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const activeSidebar = document.querySelector('.side-bar');
            if (activeSidebar) {
                activeSidebar.classList.remove('active');
                document.body.classList.remove('active');
            }
        };
    }
}

function updateSidebarActiveState() {
    const currentPath = window.location.pathname.replace(/\/+$/, '');
    const sidebarLinks = document.querySelectorAll('.side-bar .navbar a[data-sidebar-match]');

    sidebarLinks.forEach((link) => {
        try {
            const matchPath = (link.getAttribute('data-sidebar-match') || '').replace(/\/+$/, '');
            const hrefPath = new URL(link.href, window.location.origin).pathname.replace(/\/+$/, '');
            const isActive = matchPath === currentPath || hrefPath === currentPath;

            link.classList.toggle('is-active', isActive);

            if (isActive) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        } catch (error) {
            link.classList.remove('is-active');
            link.removeAttribute('aria-current');
        }
    });
}

function syncSidebarUserInfo() {
    const username = localStorage.getItem('username') || '';
    const role = localStorage.getItem('role') || 'student';
    const level = localStorage.getItem('level') || '';
    const img = localStorage.getItem('userimg') || '/elearning-assets/images/pic-1.jpg';
    const isGuest = !username || username === 'Account' || username === 'Guest User';
    const profileHref = isGuest ? '/elearning-assets/login.html' : '/elearning-assets/profile.html';

    const sidebarImg = document.getElementById('sidebar-user-img');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarRoleLevel = document.getElementById('sidebar-user-role-level');
    const sidebarProfile = document.getElementById('sidebar-user-profile');

    if (!sidebarImg || !sidebarName || !sidebarRoleLevel) {
        setTimeout(syncSidebarUserInfo, 100);
        return;
    }

    sidebarImg.src = img;
    sidebarImg.style.opacity = '1';
    sidebarImg.style.display = 'block';

    sidebarName.textContent = isGuest ? 'Guest User' : username;
    sidebarName.style.opacity = '1';
    sidebarName.style.display = 'block';

    sidebarRoleLevel.textContent = isGuest
        ? 'Silakan login untuk membuka seluruh fitur belajar'
        : (level ? `${role} - ${level}` : role);
    sidebarRoleLevel.style.opacity = '1';
    sidebarRoleLevel.style.display = 'block';

    if (sidebarProfile) {
        sidebarProfile.href = profileHref;
        sidebarProfile.textContent = isGuest ? 'Login to Start Learning' : 'View Profile';
    }

    updateSidebarActiveState();
    restoreSidebarScrollPosition();
    scheduleEnsureActiveSidebarItemVisible();
}

function initializeExistingSidebar() {
    const existingSidebar = document.querySelector('.side-bar');
    if (!existingSidebar) return;

    sidebarElement = existingSidebar;
    sidebarLoaded = true;
    setupSidebarEventHandlers();
    restoreSidebarScrollPosition();

    setTimeout(() => {
        syncSidebarUserInfo();
        restoreSidebarScrollPosition();
    }, 80);
}

async function loadSidebar() {
    try {
        const existingPersistentSidebar = document.querySelector('.side-bar[data-persistent="true"]');

        if (existingPersistentSidebar) {
            initializeExistingSidebar();
            return;
        }

        if (sidebarLoaded && sidebarElement && document.contains(sidebarElement)) {
            initializeExistingSidebar();
            return;
        }

        const response = await fetch('/elearning-assets/components/sidebar.html');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const sidebarHTML = await response.text();
        const sidebarContainer = document.querySelector('.sidebar-container') || document.body;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sidebarHTML;
        sidebarElement = tempDiv.firstElementChild;

        sidebarElement.setAttribute('data-persistent', 'true');
        sidebarElement.setAttribute('data-loaded-at', Date.now().toString());

        const anySidebar = document.querySelector('.side-bar');
        if (anySidebar) {
            anySidebar.replaceWith(sidebarElement);
        } else {
            sidebarContainer.insertBefore(sidebarElement, sidebarContainer.firstChild);
        }

        sidebarLoaded = true;
        setupSidebarEventHandlers();
        restoreSidebarScrollPosition();

        setTimeout(() => {
            syncSidebarUserInfo();
            restoreSidebarScrollPosition();
        }, 100);
    } catch (error) {
        console.error('Failed to load sidebar component:', error);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const existingPersistentSidebar = document.querySelector('.side-bar[data-persistent="true"]');
    if (existingPersistentSidebar) {
        initializeExistingSidebar();
        return;
    }

    loadSidebar();
});

document.addEventListener('componentsLoaded', () => {
    setTimeout(() => {
        updateSidebarActiveState();
        restoreSidebarScrollPosition();
        scheduleEnsureActiveSidebarItemVisible();
    }, 80);
});

window.syncElearningSidebarUserInfo = syncSidebarUserInfo;
window.addEventListener('pagehide', persistSidebarScrollPosition);
