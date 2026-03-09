// Persistent Sidebar Loader - prevents reloading on page navigation
let sidebarLoaded = false;
let sidebarElement = null;

async function loadSidebar() {
    try {
        // CRITICAL: Check for ANY persistent sidebar in the entire document
        const existingPersistentSidebar = document.querySelector('.side-bar[data-persistent="true"]');

        // If ANY persistent sidebar exists, completely skip all loading
        if (existingPersistentSidebar) {
            console.log('🚫 Persistent sidebar detected - completely skipping sidebar loading');
            return;
        }

        // Double-check: Also check our global flags
        if (sidebarLoaded && sidebarElement && document.contains(sidebarElement)) {
            console.log('🚫 Sidebar already loaded via global flags - skipping');
            return;
        }

        console.log('📦 Loading sidebar component (first time only)...');

        const response = await fetch('/elearning-assets/components/sidebar.html');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const sidebarHTML = await response.text();

        // Insert sidebar HTML
        const sidebarContainer = document.querySelector('.sidebar-container') || document.body;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sidebarHTML;
        sidebarElement = tempDiv.firstElementChild;

        // CRITICAL: Mark as persistent BEFORE inserting
        sidebarElement.setAttribute('data-persistent', 'true');
        sidebarElement.setAttribute('data-loaded-at', Date.now().toString());

        // ONLY insert if absolutely no sidebar exists
        const anySidebar = document.querySelector('.side-bar');
        if (anySidebar) {
            console.log('⚠️ Sidebar element exists but will be replaced with persistent version');
        }

        // Insert the sidebar
        if (anySidebar) {
            anySidebar.replaceWith(sidebarElement);
        } else {
            sidebarContainer.insertBefore(sidebarElement, sidebarContainer.firstChild);
        }

        // Mark as loaded AFTER successful insertion
        sidebarLoaded = true;

        // Setup event handlers untuk sidebar
        setupSidebarEventHandlers();

        // Sync user info only after sidebar is fully loaded
        setTimeout(() => {
            syncSidebarUserInfo();
        }, 100);

        console.log('✅ Sidebar loaded with true persistence - no future reloading');

    } catch (error) {
        console.error('❌ Failed to load sidebar component:', error);
    }
}

// Setup event handlers untuk sidebar component
function setupSidebarEventHandlers() {
    const closeBtn = document.querySelector('#close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const sideBar = document.querySelector('.side-bar');
            if (sideBar) {
                sideBar.classList.remove('active');
                document.body.classList.remove('active');
            }
        }
    }
}

// Sinkronisasi user info di sidebar
function syncSidebarUserInfo() {
    const username = localStorage.getItem('username') || 'Account';
    const role = localStorage.getItem('role') || 'student';
    const level = localStorage.getItem('level') || '';
    const img = localStorage.getItem('userimg') || 'images/pic-1.jpg';
    const profile = 'profile.html';

    // Update sidebar user info - pastikan semua element ada sebelum update
    const sidebarImg = document.getElementById('sidebar-user-img');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarRoleLevel = document.getElementById('sidebar-user-role-level');
    const sidebarProfile = document.getElementById('sidebar-user-profile');

    // Cek apakah semua element sudah ada di DOM
    if (!sidebarImg || !sidebarName || !sidebarRoleLevel) {
        console.log('Sidebar elements not ready yet, retrying in 100ms...');
        setTimeout(syncSidebarUserInfo, 100);
        return;
    }

    // Update dengan nilai yang stabil, hindari flashing
    if (sidebarImg) {
        sidebarImg.src = img;
        sidebarImg.style.opacity = '1'; // Pastikan visible
        sidebarImg.style.display = 'block'; // Pastikan tampil
    }

    if (sidebarName) {
        sidebarName.textContent = username;
        sidebarName.style.opacity = '1'; // Pastikan visible
        sidebarName.style.display = 'block'; // Pastikan tampil
    }

    // Gabungkan role dan level dalam satu element
    if (sidebarRoleLevel) {
        const roleText = level ? `${role} - ${level}` : role;
        sidebarRoleLevel.textContent = roleText;
        sidebarRoleLevel.style.opacity = '1'; // Pastikan visible
        sidebarRoleLevel.style.display = 'block'; // Pastikan tampil
    }

    if (sidebarProfile) {
        sidebarProfile.href = profile;
    }

    console.log('Sidebar user info synced successfully:', { username, role, level, img });
}

// Auto-load sidebar ketika DOM ready (with persistence check)
document.addEventListener('DOMContentLoaded', function () {
    // Check if component loader has already loaded a persistent sidebar
    const existingPersistentSidebar = document.querySelector('.side-bar[data-persistent="true"]');
    if (existingPersistentSidebar) {
        console.log('📋 Persistent sidebar already loaded by component loader, skipping standalone load');
        return;
    }

    // Only load if no persistent sidebar exists
    loadSidebar();
});
