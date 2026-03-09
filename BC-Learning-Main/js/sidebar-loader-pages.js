// Sidebar loader untuk halaman di bawah /pages/ directory
// Menggunakan sidebar yang sama dengan elearning-assets tapi dengan navigation berbeda

async function loadSidebarForPages() {
    try {
        // Load sidebar component dari elearning-assets
        const response = await fetch('/elearning-assets/components/sidebar.html');
        const sidebarHTML = await response.text();

        // Insert sidebar HTML
        const sidebarContainer = document.querySelector('#sidebar-container');
        if (!sidebarContainer) {
            console.warn('Sidebar container not found for pages');
            return;
        }

        // Replace existing content
        sidebarContainer.innerHTML = sidebarHTML;

        // Sync user info setelah sidebar dimuat
        syncSidebarUserInfoForPages();

        // Setup event handlers untuk sidebar
        setupSidebarEventHandlersForPages();

    } catch (error) {
        console.warn('Failed to load sidebar component for pages:', error);
    }
}

// Sync user info untuk sidebar di pages (mirip dengan elearning-assets)
function syncSidebarUserInfoForPages() {
    // Ambil data user dari localStorage
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role') || 'student';
    const userimg = localStorage.getItem('userimg');

    // Juga cek format userData JSON
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Prioritas data: individual keys > user object > userData object
    const finalUsername = username || user.username || userData.name;
    const finalRole = role || user.role || userData.role || 'student';
    const finalImage = userimg || user.userimg || userData.image || '/elearning-assets/images/pic-1.jpg';

    console.log('Syncing pages sidebar user info:', { finalUsername, finalRole, finalImage });

    // Update sidebar elements
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserRole = document.getElementById('sidebar-user-role');
    const sidebarUserImg = document.getElementById('sidebar-user-img');
    const sidebarUserProfile = document.getElementById('sidebar-user-profile');

    if (sidebarUserName) {
        sidebarUserName.textContent = finalUsername || 'Guest';
    }
    if (sidebarUserRole) {
        sidebarUserRole.textContent = finalRole || 'visitor';
    }
    if (sidebarUserImg) {
        sidebarUserImg.src = finalImage;
    }

    // Update profile link berdasarkan status login
    if (sidebarUserProfile) {
        if (finalUsername) {
            // User sudah login, arahkan ke update profile (elearning-assets)
            sidebarUserProfile.href = '/elearning-assets/update.html';
            sidebarUserProfile.textContent = 'update profile';
        } else {
            // User belum login, arahkan ke login page di pages
            sidebarUserProfile.href = '/pages/login.html';
            sidebarUserProfile.textContent = 'please login';
        }
    }
}

// Setup event handlers untuk sidebar di pages
function setupSidebarEventHandlersForPages() {
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

    // Setup main page button handler - simplified direct navigation to home
    const mainPageBtn = document.querySelector('#main-page-btn');
    if (mainPageBtn) {
        mainPageBtn.onclick = null; // Remove any onclick handlers
        // The href should already be set to /pages/courses.html from the component
        console.log('Main page button configured for pages sidebar');
    }
}

// Auto-load sidebar ketika DOM ready
document.addEventListener('DOMContentLoaded', loadSidebarForPages);

// Juga load jika sudah ready (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSidebarForPages);
} else {
    loadSidebarForPages();
}
