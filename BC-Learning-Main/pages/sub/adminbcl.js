// Admin Panel JavaScript - Refactored for better organization
// adminbcl.js - Contains all admin panel functionality

// Admin Session Management
let isAdminLoggedIn = false;
let adminUser = null;

// Video Tags Management
let allVideos = [];
let currentSelectedVideo = null;
let savedTags = {};
let customCategories = [];

// Questions Management
let allQuestions = [];

// Users Management
let allUsers = [];

// PDF Management
let allPDFManagementData = [];
let selectedPDFManagementIds = new Set();
let filteredPDFManagementData = [];
let currentPDFManagementPage = 1;
let pdfManagementItemsPerPage = 20;

// PDF Custom Categories
let pdfCustomCategories = [];

// Video Display Management
let allDisplayVideos = [];
let displaySettings = {};
let selectedVideoIds = new Set();
let currentVideoDisplayPage = 1;
let videoDisplayItemsPerPage = 20;
let filteredVideoDisplayData = [];

// BIM Media Management
let currentSelectedFile = null;
let allMediaFiles = [];
let savedBIMTags = {};
let bimCustomCategories = {};
let allBIMTags = [];
let isScanningMedia = false;

// PDF Materials Management
let allPDFMaterials = [];
let currentPDFMaterialsPage = 1;
let pdfMaterialsItemsPerPage = 20;
let filteredPDFMaterialsData = [];

// DOM Content Loaded - Initialize the admin panel
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure default state: auth section visible, admin interface hidden
    ensureDefaultUIState();

    // Load saved data
    loadSavedTags();
    loadCustomCategories();

    // Check admin session
    await checkAdminSession();

    // Handle hash-based navigation
    const hash = window.location.hash.substring(1);
    if (hash && hash !== 'dashboard' && isAdminLoggedIn) {
        setTimeout(() => {
            if (hash === 'bim-media') {
                showSection(hash);
                setTimeout(() => {
                    loadBIMMedia();
                }, 50);
            } else {
                showSection(hash);
            }
        }, 100);
    }
});

function getStoredAdminToken() {
    try {
        const storedUser = localStorage.getItem('user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const token = parsedUser?.token || localStorage.getItem('token');
        const role = (parsedUser?.role || localStorage.getItem('role') || '').toLowerCase();
        const isAdminRole = role.includes('admin') || role.includes('administrator');
        if (!token || !isAdminRole) {
            return null;
        }
        return token;
    } catch (error) {
        console.warn('Failed to read stored admin token:', error);
        return null;
    }
}

async function bridgeAdminSession() {
    const token = getStoredAdminToken();
    if (!token) {
        return false;
    }

    try {
        const response = await fetch('/api/admin/session/bridge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return !!(data && data.authenticated);
    } catch (error) {
        console.warn('Bridge admin session failed:', error);
        return false;
    }
}

// Ensure proper default UI state
function ensureDefaultUIState() {
    document.getElementById('auth-section').classList.remove('d-none');
    document.getElementById('admin-interface').classList.add('d-none');
}

// Admin login form handler
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    console.log('ðŸ” Attempting admin login:', { email: email ? 'present' : 'empty' });

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        console.log('ðŸ“¡ Admin login response:', response.status, response.statusText);

        if (response.ok) {
            const data = await response.json();
            console.log('âœ… Admin login successful:', data);
            adminUser = data.user;
            isAdminLoggedIn = true;

            document.getElementById('auth-section').classList.add('d-none');
            document.getElementById('admin-interface').classList.remove('d-none');

            if (typeof updateUserUI === 'function') {
                updateUserUI();
            }

            // Show dashboard section by default after login
            showSection('dashboard');
            loadDashboardStats();
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('âŒ Admin login failed:', errorData);
            alert('Login failed: ' + (errorData.error || 'Invalid credentials'));
        }
    } catch (error) {
        console.error('âŒ Admin login error:', error);
        alert('Login error: ' + error.message);
    }
});

// Check if admin is already logged in
async function checkAdminSession() {
    try {
        console.log('ðŸ” Checking admin session...');
        const response = await fetch('/api/admin/session', { credentials: 'include' });

        if (response.ok) {
            const data = await response.json();
            console.log('ðŸ“¡ Session check response:', data);

            if (data.authenticated && data.user) {
                console.log('âœ… Admin session valid for:', data.user.username);
                adminUser = data.user;
                isAdminLoggedIn = true;
                document.getElementById('auth-section').classList.add('d-none');
                document.getElementById('admin-interface').classList.remove('d-none');
                if (typeof updateUserUI === 'function') {
                    updateUserUI();
                }
                loadDashboardStats();
                return true;
            } else {
                console.log('âŒ Admin session not authenticated');
            }
        } else {
            // Handle 401 Unauthorized gracefully - this is normal when not logged in
            if (response.status === 401) {
                console.log('ðŸ”’ No active admin session (401) - this is normal');
            } else {
                console.error('âŒ Session check failed with status:', response.status);
            }
        }
    } catch (error) {
        console.error('âŒ Error checking admin session:', error);
    }
    const bridged = await bridgeAdminSession();
    if (bridged) {
        return checkAdminSession();
    }
    // If we reach here, authentication failed - ensure auth section is visible
    console.log('ðŸ”’ No valid admin session - showing auth section');
    ensureDefaultUIState();
    return false;
}

// Admin logout
function adminLogout() {
    if (confirm('Are you sure you want to logout from admin panel?')) {
        fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
            .then(() => {
                adminUser = null;
                isAdminLoggedIn = false;
                document.getElementById('auth-section').classList.remove('d-none');
                document.getElementById('admin-interface').classList.add('d-none');
                document.getElementById('admin-login-form').reset();
            })
            .catch(error => console.error('Logout error:', error));
    }
}

// Toggle sidebar visibility
function toggleSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const content = document.getElementById('admin-content');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar.classList.contains('d-none') || sidebar.classList.contains('d-md-block')) {
        // Show sidebar
        sidebar.classList.remove('d-none');
        sidebar.classList.add('d-md-block');
        content.classList.remove('col-md-12');
        content.classList.add('col-md-9');
        toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    } else {
        // Hide sidebar
        sidebar.classList.add('d-none');
        sidebar.classList.remove('d-md-block');
        content.classList.remove('col-md-9');
        content.classList.add('col-md-12');
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
}

// Simple section navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.add('d-none');
    });

    // Remove active class from nav links
    document.querySelectorAll('.nav-link-modern').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionName + '-section').classList.remove('d-none');

    // Add active class to clicked nav link
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Load dashboard statistics with better error handling
async function loadDashboardStats() {
    console.log('ðŸ”„ Loading dashboard statistics...');
    try {
        // Use Promise.allSettled to handle partial failures gracefully
        const [usersRes, questionsRes, videosRes, mediaRes] = await Promise.allSettled([
            fetch('/api/users/get-all').then(res => res.ok ? res.json() : Promise.reject(res.status)),
            fetch('/api/questions').then(res => res.ok ? res.json() : Promise.reject(res.status)),
            fetch('/api/tutorials').then(res => res.ok ? res.json() : Promise.reject(res.status)),
            fetch('/api/admin/bim-media/stats').then(res => res.ok ? res.json() : Promise.reject(res.status))
        ]);

        console.log('ðŸ“Š API responses:', {
            users: usersRes.status === 'fulfilled' ? 'success' : 'failed',
            questions: questionsRes.status === 'fulfilled' ? 'success' : 'failed',
            videos: videosRes.status === 'fulfilled' ? 'success' : 'failed',
            media: mediaRes.status === 'fulfilled' ? 'success' : 'failed'
        });

        // Update user count
        if (usersRes.status === 'fulfilled') {
            const users = usersRes.value;
            console.log('âœ… Users loaded:', users.length);
            document.getElementById('user-count').textContent = users.length;
        } else {
            console.error('âŒ Users API failed:', usersRes.reason);
            document.getElementById('user-count').textContent = 'N/A';
        }

        // Update question count
        if (questionsRes.status === 'fulfilled') {
            const questions = questionsRes.value;
            console.log('âœ… Questions loaded:', questions.length);
            document.getElementById('question-count').textContent = questions.length;
        } else {
            console.error('âŒ Questions API failed:', questionsRes.reason);
            document.getElementById('question-count').textContent = 'N/A';
        }

        // Update video count
        if (videosRes.status === 'fulfilled') {
            const videos = videosRes.value;
            console.log('âœ… Videos loaded:', videos.length);
            document.getElementById('video-count').textContent = videos.length;
        } else {
            console.error('âŒ Videos API failed:', videosRes.reason);
            document.getElementById('video-count').textContent = 'N/A';
        }

        // Update media count
        if (mediaRes.status === 'fulfilled') {
            const mediaStats = mediaRes.value;
            console.log('âœ… Media stats loaded:', mediaStats);
            document.getElementById('media-count').textContent = mediaStats.totalTagged || 0;
        } else {
            console.error('âŒ Media API failed:', mediaRes.reason);
            document.getElementById('media-count').textContent = 'N/A';
        }

        console.log('âœ… Dashboard statistics loaded (with error handling)');
    } catch (error) {
        console.error('âŒ Critical error loading dashboard stats:', error);
        // Set all counts to N/A on critical error
        document.getElementById('user-count').textContent = 'N/A';
        document.getElementById('question-count').textContent = 'N/A';
        document.getElementById('video-count').textContent = 'N/A';
        document.getElementById('media-count').textContent = 'N/A';
    }
}

// Load saved tags from localStorage on page load
function loadSavedTags() {
    try {
        const saved = localStorage.getItem('bcl_video_tags');
        if (saved) {
            savedTags = JSON.parse(saved);
            console.log('ðŸ“‚ Loaded saved tags from localStorage:', Object.keys(savedTags).length, 'videos');
        } else {
            savedTags = {};
            console.log('ðŸ“‚ No saved tags found in localStorage');
        }
    } catch (error) {
        console.error('âŒ Error loading saved tags:', error);
        savedTags = {};
    }
}

// Get all previously used tags
function getPreviouslyUsedTags() {
    const allTags = new Set();

    // Collect tags from all saved videos
    Object.values(savedTags).forEach(videoTags => {
        if (videoTags.tags && Array.isArray(videoTags.tags)) {
            videoTags.tags.forEach(tag => {
                if (tag && tag.trim()) {
                    allTags.add(tag.trim().toLowerCase());
                }
            });
        }
    });

    // Convert to sorted array
    return Array.from(allTags).sort();
}

// Display previously used tags in modal
function displayPreviouslyUsedTags() {
    const previousTags = getPreviouslyUsedTags();
    const container = document.getElementById('previousTagsContainer');
    const section = document.getElementById('previousTagsSection');

    if (previousTags.length === 0) {
        section.classList.add('d-none');
        return;
    }

    let html = '';
    previousTags.forEach(tag => {
        html += `<button type="button" class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="addTagToInput('${tag}')">${tag}</button>`;
    });

    container.innerHTML = html;
    section.classList.remove('d-none');
}

// Add tag to input field
function addTagToInput(tag) {
    const input = document.getElementById('videoTags');
    const currentValue = input.value.trim();

    // Check if tag is already in the input
    const currentTags = currentValue ? currentValue.split(',').map(t => t.trim().toLowerCase()) : [];
    if (currentTags.includes(tag.toLowerCase())) {
        return; // Tag already exists
    }

    // Add tag to input
    const newValue = currentValue ? currentValue + ', ' + tag : tag;
    input.value = newValue;

    // Focus input
    input.focus();
}

// Load custom categories from localStorage
function loadCustomCategories() {
    try {
        const saved = localStorage.getItem('bcl_custom_categories');
        if (saved) {
            customCategories = JSON.parse(saved);
            console.log('ðŸ“‚ Loaded custom categories from localStorage:', customCategories.length, 'categories');
            // Apply custom categories to the dropdown
            applyCustomCategoriesToDropdown();
        } else {
            customCategories = [];
            console.log('ðŸ“‚ No custom categories found in localStorage');
        }
    } catch (error) {
        console.error('âŒ Error loading custom categories:', error);
        customCategories = [];
    }
}

// Save custom categories to localStorage
function saveCustomCategoriesToStorage() {
    try {
        localStorage.setItem('bcl_custom_categories', JSON.stringify(customCategories));
        console.log('ðŸ’¾ Saved custom categories to localStorage:', customCategories.length, 'categories');
    } catch (error) {
        console.error('âŒ Error saving custom categories to localStorage:', error);
    }
}

// Apply custom categories to dropdown
function applyCustomCategoriesToDropdown() {
    const select = document.getElementById('videoCategory');
    if (select) {
        // Remove existing custom categories first
        const existingCustomOptions = select.querySelectorAll('option[data-custom="true"]');
        existingCustomOptions.forEach(option => option.remove());

        // Add custom categories
        customCategories.forEach(category => {
            const newOption = document.createElement('option');
            newOption.value = category.value;
            newOption.textContent = category.displayName;
            newOption.setAttribute('data-custom', 'true');
            select.appendChild(newOption);
        });
    }

    // Also update the video category filter dropdown
    updateVideoCategoryFilter();

    console.log('âœ… Applied', customCategories.length, 'custom categories to dropdowns');
}

// Update video category filter dropdown with custom categories
function updateVideoCategoryFilter() {
    const filterSelect = document.getElementById('videoCategoryFilter');
    if (!filterSelect) return;

    // Remove existing custom categories from filter
    const existingCustomOptions = filterSelect.querySelectorAll('option[data-custom="true"]');
    existingCustomOptions.forEach(option => option.remove());

    // Add custom categories to filter
    customCategories.forEach(category => {
        const newOption = document.createElement('option');
        newOption.value = category.value;
        newOption.textContent = category.displayName;
        newOption.setAttribute('data-custom', 'true');
        filterSelect.appendChild(newOption);
    });

    console.log('âœ… Updated video category filter with', customCategories.length, 'custom categories');
}

// Save tags to localStorage
function saveTagsToStorage() {
    try {
        localStorage.setItem('bcl_video_tags', JSON.stringify(savedTags));
        console.log('ðŸ’¾ Saved tags to localStorage:', Object.keys(savedTags).length, 'videos');
    } catch (error) {
        console.error('âŒ Error saving tags to localStorage:', error);
    }
}

// Apply saved tags to videos
function applySavedTagsToVideos(videos) {
    console.log('ðŸ”„ Applying saved tags to videos...');
    let taggedCount = 0;

    videos.forEach(video => {
        const videoTags = savedTags[video.id];
        if (videoTags) {
            // Apply saved tags to video object
            Object.assign(video, videoTags);
            video.tagged = true;
            video.localSave = true; // Mark as locally saved
            taggedCount++;
            console.log('âœ… Applied tags to video:', video.id, video.name);
        } else {
            // Ensure video has default values if no tags saved
            video.category = video.category || 'general';
            video.bimLevel = video.bimLevel || 'beginner';
            video.tagged = false;
        }
    });

    console.log('ðŸ“Š Applied saved tags to', taggedCount, 'videos');
    return videos;
}

// Video scanning and management functions
async function scanVideoSources() {
    console.log('ðŸ”„ Scanning video sources...');

    const gridContainer = document.getElementById('videosGrid');
    gridContainer.innerHTML = `
        <div class="col-12">
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-muted">Scanning video sources...</p>
            </div>
        </div>`;

    try {
        // Try to get videos from the tutorials API
        const response = await fetch('/api/tutorials');
        console.log('ðŸ“¡ Video scan API response:', response.status, response.statusText);

        if (response.ok) {
            const videos = await response.json();
            console.log('âœ… Videos scanned successfully:', videos.length, 'videos');

            // Transform video data for tagging
            const transformedVideos = videos.map(video => ({
                id: video.id || Math.random().toString(36).substr(2, 9),
                name: video.name || video.title || 'Unknown Video',
                path: video.path || video.url || '',
                size: video.size || 'Unknown',
                category: video.category || 'general',
                tags: video.tags || [],
                bimLevel: video.bimLevel || 'beginner',
                duration: video.duration || 0,
                language: video.language || 'id',
                description: video.description || '',
                views: video.viewCount || video.views || 0,
                tagged: video.tags && video.tags.length > 0,
                thumbnail: video.thumbnail || '',
                created_at: video.created_at,
                date: video.date
            }));

            allVideos = transformedVideos;

            // Apply saved tags to videos
            const videosWithSavedTags = applySavedTagsToVideos(transformedVideos);

            displayVideos(videosWithSavedTags);

            // Update total videos count badge
            updateTotalVideosCount(transformedVideos.length);

            console.log('âœ… Video sources scanned and displayed');
        } else {
            const errorText = await response.text();
            console.error('âŒ Video scan API failed:', response.status, errorText);
            gridContainer.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Failed to scan video sources: ${response.status} ${response.statusText}
                        </div>
                    </div>
                </div>`;
        }
    } catch (error) {
        console.error('âŒ Error scanning video sources:', error);
        gridContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error scanning video sources: ${error.message}
                    </div>
                </div>`;
    }
}

async function refreshVideos() {
    if (allVideos.length === 0) {
        await scanVideoSources();
    } else {
        displayVideos(allVideos);
    }
}

function displayVideos(videos) {
    const gridContainer = document.getElementById('videosGrid');

    if (videos.length === 0) {
        gridContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <i class="fas fa-video fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No videos found</p>
                    <button class="btn btn-primary" onclick="scanVideoSources()">
                        <i class="fas fa-search me-2"></i>Scan Video Sources
                    </button>
                </div>
            </div>`;
        return;
    }

    let html = '';

    videos.forEach((video, index) => {
        const videoId = video.id;
        const videoName = video.name;
        const videoCategory = video.category;
        const videoTags = video.tags || [];
        const videoViews = video.views || 0;
        const isTagged = video.tagged || videoTags.length > 0;

        // Category badge color
        const categoryColors = {
            'autocad': 'primary',
            'revit': 'info',
            'sketchup': 'success',
            '3dsmax': 'warning',
            'lumion': 'danger',
            'general': 'secondary',
            'tutorial': 'dark',
            'advanced': 'light'
        };
        const categoryColor = categoryColors[videoCategory.toLowerCase()] || 'secondary';

        // BIM level badge
        const bimLevelColors = {
            'beginner': 'success',
            'intermediate': 'warning',
            'advanced': 'danger',
            'expert': 'dark'
        };
        const bimLevelColor = bimLevelColors[video.bimLevel.toLowerCase()] || 'secondary';

        html += `
            <div class="col-md-6 col-lg-6 mb-4">
                <div class="card video-card ${isTagged ? 'border-success' : ''}" style="height: 100%;">
                    <div class="card-body p-3">
                        <div class="row align-items-center">
                            <!-- Left Column: Video Information -->
                            <div class="col-md-8">
                                <div class="d-flex align-items-start mb-3">
                                    <i class="fas fa-video text-warning me-3 fa-lg"></i>
                                    <div class="flex-grow-1">
                                        <h6 class="card-title mb-2" title="${videoName}">${videoName}</h6>
                                        <div class="mb-2">
                                            <span class="badge bg-${categoryColor} me-2">${videoCategory}</span>
                                            <span class="badge bg-${bimLevelColor}">${video.bimLevel}</span>
                                            ${isTagged ? '<span class="badge bg-success ms-2"><i class="fas fa-check me-1"></i>Tagged</span>' : '<span class="badge bg-secondary ms-2">Untagged</span>'}
                                        </div>
                                        <small class="text-muted d-block mb-2">
                                            <i class="fas fa-eye me-1"></i>${videoViews} views
                                        </small>

                                        ${videoTags.length > 0 ? `
                                            <div class="mb-2">
                                                <small class="text-muted d-block mb-1">Tags:</small>
                                                <div>
                                                    ${videoTags.slice(0, 4).map(tag => `<span class="badge bg-light text-dark me-1 mb-1">${tag}</span>`).join('')}
                                                    ${videoTags.length > 4 ? `<span class="badge bg-light text-dark">+${videoTags.length - 4}</span>` : ''}
                                                </div>
                                            </div>
                                        ` : '<small class="text-muted d-block">No tags assigned</small>'}
                                    </div>
                                </div>
                            </div>

                            <!-- Right Column: Thumbnail Preview -->
                            <div class="col-md-4 text-center">
                                <div class="video-preview-container mx-auto" onclick="openVideoPreviewModal('${videoId}', '${videoName.replace(/'/g, "\\'")}', '${JSON.stringify(video).replace(/'/g, "\\'")}')" style="cursor: pointer;">
                                    ${video.thumbnail ? `<img src="${video.thumbnail}" class="video-thumbnail" alt="${videoName}" onerror="this.style.display='none'">` : ''}
                                    <div class="video-overlay">
                                        <i class="fas fa-play-circle fa-2x text-white"></i>
                                    </div>
                                </div>
                                <small class="text-muted d-block mt-2">Click to preview</small>
                            </div>
                        </div>

                        <!-- Bottom: Action Buttons -->
                        <div class="row mt-3">
                            <div class="col-12">
                                <hr class="my-2">
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="openVideoTagModal('${videoId}')" title="Tag Video">
                                        <i class="fas fa-tag me-1"></i> Tag Video
                                    </button>
                                    <button class="btn btn-sm btn-outline-info" onclick="viewVideoDetails('${videoId}')" title="View Details">
                                        <i class="fas fa-eye me-1"></i> Details
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="removeVideoTags('${videoId}')" title="Remove Tags">
                                        <i class="fas fa-times me-1"></i> Remove Tags
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    gridContainer.innerHTML = html;
}

function openVideoPreviewModal(videoId, videoName, videoDataStr) {
    console.log('Opening video preview modal for:', videoName);
    try {
        const videoData = JSON.parse(videoDataStr);
        console.log('Video data:', videoData);

        // Create video preview modal HTML
        let modalHtml = '<div class="modal fade" id="videoPreviewModal" tabindex="-1">';
        modalHtml += '<div class="modal-dialog modal-xl">';
        modalHtml += '<div class="modal-content">';
        modalHtml += '<div class="modal-header">';
        modalHtml += '<h5 class="modal-title">';
        modalHtml += '<i class="fas fa-video me-2"></i>Video Preview: ' + videoName;
        modalHtml += '</h5>';
        modalHtml += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>';
        modalHtml += '</div>';
        modalHtml += '<div class="modal-body">';
        modalHtml += '<div class="text-center">';

        // Add thumbnail if available
        if (videoData.thumbnail) {
            modalHtml += '<img src="' + videoData.thumbnail + '" class="img-fluid mb-3" alt="' + videoName + '" style="max-height: 300px;">';
        }

        // Add video player
        modalHtml += '<div class="video-player-container bg-dark rounded p-2">';
        modalHtml += '<video id="videoPlayer" controls class="w-100" style="max-height: 500px;"';
        if (videoData.thumbnail) {
            modalHtml += ' poster="' + videoData.thumbnail + '"';
        }
        modalHtml += '>';

        // Use constructTaggedMediaUrl for consistent URL construction
        const videoUrl = constructTaggedMediaUrl(videoData.name || 'video', 'video', videoData.path || videoData.url);
        // Add debug info
        modalHtml += '<div class="mt-2 small text-muted">';
        modalHtml += '<strong>Debug URL:</strong> ' + videoUrl;
        modalHtml += '</div>';
        modalHtml += '<source src="' + videoUrl + '" type="video/mp4">';
        modalHtml += '<source src="' + videoUrl + '" type="video/webm">';
        modalHtml += '<source src="' + videoUrl + '" type="video/ogg">';
        modalHtml += 'Your browser does not support the video tag.';
        modalHtml += '</video>';
        modalHtml += '</div>';

        // Add debug info
        modalHtml += '<div class="mt-2 small text-muted">';
        modalHtml += '<strong>Debug:</strong> URL: ' + videoUrl;
        modalHtml += '</div>';

        // Add metadata
        modalHtml += '<div class="mt-3">';
        modalHtml += '<p class="text-muted mb-2">' + (videoData.description || 'No description available') + '</p>';
        modalHtml += '<div class="row text-center">';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">Category</small><br>';
        modalHtml += '<strong>' + (videoData.category || 'N/A') + '</strong>';
        modalHtml += '</div>';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">BIM Level</small><br>';
        modalHtml += '<strong>' + (videoData.bimLevel || 'N/A') + '</strong>';
        modalHtml += '</div>';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">Views</small><br>';
        modalHtml += '<strong>' + (videoData.views || 0) + '</strong>';
        modalHtml += '</div>';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">Tags</small><br>';
        modalHtml += '<strong>' + ((videoData.tags || []).length) + ' tags</strong>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';

        // Add footer with buttons
        modalHtml += '<div class="modal-footer">';
        modalHtml += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">';
        modalHtml += '<i class="fas fa-times me-1"></i>Close';
        modalHtml += '</button>';
        modalHtml += '<button type="button" class="btn btn-primary" onclick="openVideoTagModal(\'' + videoId + '\', \'' + videoName.replace(/'/g, '\\\'') + '\', \'' + videoDataStr.replace(/'/g, '\\\'') + '\')">';
        modalHtml += '<i class="fas fa-tag me-1"></i>Tag This Video';
        modalHtml += '</button>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';

        // Remove existing modal if any
        const existingModal = document.getElementById('videoPreviewModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('Modal HTML added to body');

        // Show modal
        const modalElement = document.getElementById('videoPreviewModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            console.log('Modal shown successfully');

            // Auto-load video when modal opens
            modal._element.addEventListener('shown.bs.modal', function () {
                const video = document.getElementById('videoPlayer');
                if (video) {
                    console.log('Loading video:', video.src);
                    video.load();
                } else {
                    console.error('Video player element not found');
                }
            });

            // Stop video when modal closes
            modal._element.addEventListener('hidden.bs.modal', function () {
                const video = document.getElementById('videoPlayer');
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        } else {
            console.error('Modal element not found after creation');
        }

    } catch (error) {
        console.error('Error opening video preview modal:', error);
        alert('Error loading video preview: ' + error.message);
    }
}

// Category Management Functions
function toggleCustomCategory() {
    const customDiv = document.getElementById('customCategoryDiv');
    const input = document.getElementById('customCategoryInput');

    if (customDiv.classList.contains('d-none')) {
        // Show custom category input
        customDiv.classList.remove('d-none');
        input.focus();
        input.value = '';
    } else {
        // Hide custom category input
        customDiv.classList.add('d-none');
        input.value = '';
    }
}

function addCustomCategory() {
    const input = document.getElementById('customCategoryInput');
    const categoryName = input.value.trim();

    if (!categoryName) {
        alert('Please enter a category name');
        input.focus();
        return;
    }

    // Check if category already exists
    const select = document.getElementById('videoCategory');
    const existingOptions = Array.from(select.options).map(opt => opt.value.toLowerCase());

    if (existingOptions.includes(categoryName.toLowerCase())) {
        alert('This category already exists');
        input.focus();
        return;
    }

    // Validate category name (no special characters, reasonable length)
    if (categoryName.length < 2 || categoryName.length > 50) {
        alert('Category name must be between 2 and 50 characters');
        input.focus();
        return;
    }

    if (!/^[a-zA-Z0-9\s\-&()]+$/.test(categoryName)) {
        alert('Category name can only contain letters, numbers, spaces, hyphens, ampersands, and parentheses');
        input.focus();
        return;
    }

    // Create category object
    const newCategory = {
        value: categoryName.toLowerCase().replace(/\s+/g, '-'),
        displayName: categoryName
    };

    // Add to custom categories array
    customCategories.push(newCategory);

    // Save to localStorage
    saveCustomCategoriesToStorage();

    // Add new category to dropdown
    const newOption = document.createElement('option');
    newOption.value = newCategory.value;
    newOption.textContent = newCategory.displayName;
    newOption.setAttribute('data-custom', 'true');
    select.appendChild(newOption);

    // Select the new category
    select.value = newCategory.value;

    // Hide custom category input and show success
    document.getElementById('customCategoryDiv').classList.add('d-none');
    input.value = '';

    // Show success message
    alert('âœ… New category "' + categoryName + '" added successfully and saved!');

    console.log('New category added and saved:', newCategory);
}

function cancelCustomCategory() {
    const customDiv = document.getElementById('customCategoryDiv');
    const input = document.getElementById('customCategoryInput');

    customDiv.classList.add('d-none');
    input.value = '';
}

function openVideoTagModal(videoId) {
    console.log('Opening video tag modal for ID:', videoId);
    console.log('Available videos in allVideos:', allVideos.length);

    try {
        // Find video data from global array
        const videoData = allVideos.find(v => v.id == videoId);
        console.log('Found video data:', videoData);

        if (!videoData) {
            console.error('Video not found in allVideos array');
            console.log('Available video IDs:', allVideos.map(v => v.id));
            alert('Video not found. Please refresh the page and try again.');
            return;
        }

        currentSelectedVideo = videoData;

        // Populate the tagging modal
        document.getElementById('selectedVideoName').textContent = videoData.name || 'Unknown Video';
        document.getElementById('selectedVideoPath').textContent = videoData.path || videoData.url || 'N/A';

        // Pre-fill form with existing data
        document.getElementById('videoCategory').value = videoData.category || '';
        document.getElementById('videoBimLevel').value = videoData.bimLevel || '';
        document.getElementById('videoDuration').value = videoData.duration || '';
        document.getElementById('videoLanguage').value = videoData.language || 'id';
        document.getElementById('videoDescription').value = videoData.description || '';
        document.getElementById('videoTags').value = (videoData.tags || []).join(', ');

        // Display previously used tags
        displayPreviouslyUsedTags();

        // Hide custom category input when opening modal
        document.getElementById('customCategoryDiv').classList.add('d-none');
        document.getElementById('customCategoryInput').value = '';

        // Close video details modal if it's open
        const detailsModal = document.getElementById('videoDetailsModal');
        if (detailsModal && detailsModal.classList.contains('show')) {
            const bsDetailsModal = bootstrap.Modal.getInstance(detailsModal);
            if (bsDetailsModal) {
                bsDetailsModal.hide();
            }
        }

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('videoTagModal'));
        modal.show();
        console.log('Video tag modal opened successfully');

        // Highlight selected card (only if event context exists)
        if (event && event.currentTarget) {
            const selectedCard = event.currentTarget.closest('.video-card');
            if (selectedCard) {
                document.querySelectorAll('.video-card').forEach(card => {
                    card.classList.remove('border-primary', 'bg-light');
                });
                selectedCard.classList.add('border-primary', 'bg-light');
            }
        }

    } catch (error) {
        console.error('Error opening video tag modal:', error);
        alert('Error loading video data for tagging: ' + error.message);
    }
}

async function saveVideoTags() {
    if (!currentSelectedVideo) {
        alert('No video selected');
        return;
    }

    const tagData = {
        videoId: currentSelectedVideo.id,
        category: document.getElementById('videoCategory').value,
        bimLevel: document.getElementById('videoBimLevel').value,
        duration: document.getElementById('videoDuration').value,
        language: document.getElementById('videoLanguage').value,
        description: document.getElementById('videoDescription').value.trim(),
        tags: document.getElementById('videoTags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
    };

    // Validation
    if (!tagData.category || !tagData.bimLevel) {
        alert('Please fill in at least Category and BIM Level');
        return;
    }

    try {
        console.log('ðŸ’¾ Saving video tags:', tagData);

        // Try to save to server API
        const response = await fetch('/api/admin/videos/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tagData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('âœ… Server save successful:', result);
            alert('âœ… Video tags saved successfully to server!');

            // Update local video data
            const videoIndex = allVideos.findIndex(v => v.id === currentSelectedVideo.id);
            if (videoIndex !== -1) {
                allVideos[videoIndex] = {
                    ...allVideos[videoIndex],
                    ...tagData,
                    tagged: true
                };
            }

            // Close modal and refresh display
            bootstrap.Modal.getInstance(document.getElementById('videoTagModal')).hide();
            displayVideos(allVideos);

            // Clear selection
            currentSelectedVideo = null;

        } else {
            // Check if it's an HTML error response (API not found)
            const responseText = await response.text();
            console.error('âŒ Server response error:', response.status, responseText);

            if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>')) {
                console.log('ðŸ“ API endpoint not available, saving locally...');

                // Save locally since server endpoint doesn't exist
                console.log('Server endpoint not available - saving locally');

                // Update local video data and save to localStorage
                const videoIndex = allVideos.findIndex(v => v.id === currentSelectedVideo.id);
                if (videoIndex !== -1) {
                    allVideos[videoIndex] = {
                        ...allVideos[videoIndex],
                        ...tagData,
                        tagged: true,
                        localSave: true // Mark as locally saved
                    };

                    // Save tags to localStorage
                    savedTags[currentSelectedVideo.id] = tagData;
                    saveTagsToStorage();

                    console.log('âœ… Tags saved to localStorage for video:', currentSelectedVideo.id);
                }

                // Close modal and refresh display
                bootstrap.Modal.getInstance(document.getElementById('videoTagModal')).hide();
                displayVideos(allVideos);

                // Clear selection
                currentSelectedVideo = null;

                console.log('âœ… Tags saved locally');
                return;
            }

            // Try to parse as JSON error
            try {
                const error = JSON.parse(responseText);
                alert('âŒ Failed to save video tags: ' + (error.error || 'Unknown error'));
            } catch (jsonError) {
                alert('âŒ Server returned invalid response. Tags saved locally.');
            }
        }

    } catch (error) {
        console.error('âŒ Network error saving video tags:', error);

        // Fallback: save locally
        console.log('ðŸ“ Network error, saving locally...');
        alert('âš ï¸ Network error. Tags saved locally for now.\n\nNote: Tags will be lost on page refresh until connection is restored.');

        // Update local video data
        const videoIndex = allVideos.findIndex(v => v.id === currentSelectedVideo.id);
        if (videoIndex !== -1) {
            allVideos[videoIndex] = {
                ...allVideos[videoIndex],
                ...tagData,
                tagged: true,
                localSave: true // Mark as locally saved
            };
        }

        // Close modal and refresh display
        bootstrap.Modal.getInstance(document.getElementById('videoTagModal')).hide();
        displayVideos(allVideos);

        // Clear selection
        currentSelectedVideo = null;

        console.log('âœ… Tags saved locally due to network error');
    }
}

function filterVideos() {
    const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('videoCategoryFilter').value;
    const tagStatusFilter = document.getElementById('videoTagStatusFilter').value;
    const sortFilter = document.getElementById('videoSortFilter').value;

    let filteredVideos = allVideos.filter(video => {
        const videoName = video.name.toLowerCase();
        const videoCategory = video.category.toLowerCase();
        const videoTags = video.tags || [];
        const isTagged = video.tagged || videoTags.length > 0;

        // Search filter
        const matchesSearch = !searchTerm ||
            videoName.includes(searchTerm) ||
            videoTags.some(tag => tag.toLowerCase().includes(searchTerm));

        // Category filter
        const matchesCategory = !categoryFilter || videoCategory === categoryFilter;

        // Tag status filter
        let matchesTagStatus = true;
        if (tagStatusFilter === 'tagged') {
            matchesTagStatus = isTagged;
        } else if (tagStatusFilter === 'untagged') {
            matchesTagStatus = !isTagged;
        }

        return matchesSearch && matchesCategory && matchesTagStatus;
    });

    // Sort videos
    filteredVideos.sort((a, b) => {
        switch (sortFilter) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'category':
                return a.category.localeCompare(b.category);
            case 'views':
                return (b.views || 0) - (a.views || 0);
            case 'newest':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            default:
                return 0;
        }
    });

    displayVideos(filteredVideos);
}

function clearVideoFilters() {
    document.getElementById('videoSearchInput').value = '';
    document.getElementById('videoCategoryFilter').value = '';
    document.getElementById('videoTagStatusFilter').value = '';
    document.getElementById('videoSortFilter').value = 'name';

    displayVideos(allVideos);
}

// Filter videos in the video tags section
function filterVideoTags() {
    const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('videoCategoryFilter').value;
    const tagStatusFilter = document.getElementById('videoTagStatusFilter').value;
    const sortFilter = document.getElementById('videoSortFilter').value;

    let filteredVideos = allVideos.filter(video => {
        const videoName = (video.name || '').toLowerCase();
        const videoCategory = video.category || '';
        const videoTags = video.tags || [];
        const isTagged = video.tagged || videoTags.length > 0;

        // Search filter
        const matchesSearch = !searchTerm ||
            videoName.includes(searchTerm) ||
            videoTags.some(tag => tag.toLowerCase().includes(searchTerm));

        // Category filter
        const matchesCategory = !categoryFilter || videoCategory === categoryFilter;

        // Tag status filter
        let matchesTagStatus = true;
        if (tagStatusFilter === 'tagged') {
            matchesTagStatus = isTagged;
        } else if (tagStatusFilter === 'untagged') {
            matchesTagStatus = !isTagged;
        }

        return matchesSearch && matchesCategory && matchesTagStatus;
    });

    // Sort videos
    filteredVideos.sort((a, b) => {
        switch (sortFilter) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'category':
                return (a.category || '').localeCompare(b.category || '');
            case 'views':
                return (b.views || 0) - (a.views || 0);
            case 'newest':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            default:
                return 0;
        }
    });

    displayVideos(filteredVideos);

    // Update filter results count
    updateVideoFilterResults(filteredVideos.length, allVideos.length);
}

// Update video filter results information
function updateVideoFilterResults(filteredCount, totalCount) {
    let resultsInfo = '';
    if (filteredCount !== totalCount) {
        resultsInfo = `<div class="alert alert-info py-2 mt-3">
            <i class="fas fa-filter me-2"></i>
            Showing ${filteredCount} of ${totalCount} videos
        </div>`;
    }

    // Insert results info before the videos grid
    const container = document.getElementById('videosGrid');
    const existingAlert = container.querySelector('.alert');

    if (existingAlert) {
        existingAlert.remove();
    }

    if (resultsInfo) {
        container.insertAdjacentHTML('afterbegin', resultsInfo);
    }
}

function updateTotalVideosCount(count) {
    const badge = document.getElementById('totalVideosCount');
    if (badge) {
        badge.innerHTML = `<i class="fas fa-video me-1"></i>Total: ${count} videos`;
    }
}

function viewVideoDetails(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) {
        alert('Video not found');
        return;
    }

    // Create details modal
    const modalHtml = `
        <div class="modal fade" id="videoDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-video me-2"></i>Video Details
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <h6>Video Information</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>ID:</strong></td><td style="word-wrap: break-word; max-width: 200px;">${video.id}</td></tr>
                                    <tr><td><strong>Name:</strong></td><td style="word-wrap: break-word; max-width: 200px;">${video.name}</td></tr>
                                    <tr><td><strong>Category:</strong></td><td><span class="badge bg-primary">${video.category}</span></td></tr>
                                    <tr><td><strong>BIM Level:</strong></td><td><span class="badge bg-info">${video.bimLevel}</span></td></tr>
                                    <tr><td><strong>Views:</strong></td><td>${video.views || 0}</td></tr>
                                    <tr><td><strong>Duration:</strong></td><td>${video.duration || 'N/A'} min</td></tr>
                                    <tr><td><strong>Language:</strong></td><td>${video.language || 'N/A'}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Tags & Description</h6>
                                ${video.tags && video.tags.length > 0 ? `
                                    <div class="mb-3">
                                        <strong>Tags:</strong>
                                        <div class="mt-1">
                                            ${video.tags.map(tag => `<span class="badge bg-light text-dark me-1">${tag}</span>`).join('')}
                                        </div>
                                    </div>
                                ` : '<p class="text-muted">No tags assigned</p>'}

                                ${video.description ? `
                                    <div>
                                        <strong>Description:</strong>
                                        <p class="mt-1">${video.description}</p>
                                    </div>
                                ` : '<p class="text-muted">No description available</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="openVideoTagModal('${videoId}')">Edit Tags</button>
                    </div>
                </div>
            </div>
        </div>`;

    // Remove existing modal if any
    const existingModal = document.getElementById('videoDetailsModal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('videoDetailsModal'));
    modal.show();
}

async function removeVideoTags(videoId) {
    if (!confirm('Are you sure you want to remove all tags from this video?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/videos/tags/${videoId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('âœ… Video tags removed successfully!');

            // Update local video data
            const videoIndex = allVideos.findIndex(v => v.id === videoId);
            if (videoIndex !== -1) {
                allVideos[videoIndex].tags = [];
                allVideos[videoIndex].tagged = false;
                allVideos[videoIndex].category = 'general';
                allVideos[videoIndex].bimLevel = 'beginner';
            }

            displayVideos(allVideos);

        } else {
            const error = await response.json();
            alert('âŒ Failed to remove video tags: ' + (error.error || 'Unknown error'));
        }

    } catch (error) {
        console.error('Error removing video tags:', error);
        alert('âŒ Error removing video tags: ' + error.message);
    }
}

function exportTaggedVideos() {
    const taggedVideos = allVideos.filter(video => video.tagged || (video.tags && video.tags.length > 0));

    if (taggedVideos.length === 0) {
        alert('No tagged videos to export');
        return;
    }

    // Create CSV content
    const headers = ['ID', 'Name', 'Category', 'BIM Level', 'Duration', 'Language', 'Views', 'Tags', 'Description'];
    const csvContent = [
        headers.join(','),
        ...taggedVideos.map(video => [
            video.id,
            `"${video.name.replace(/"/g, '""')}"`,
            video.category,
            video.bimLevel,
            video.duration || '',
            video.language || '',
            video.views || 0,
            `"${(video.tags || []).join('; ')}"`,
            `"${(video.description || '').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tagged-videos-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    alert(`âœ… Exported ${taggedVideos.length} tagged videos successfully!`);
}

// Missing functions called in HTML - BIM Media, PDF Management, Video Display Management

async function loadBIMMedia() {
    try {
        console.log('Starting BIM Media load...');

        // Create content step by step to avoid template literal issues
        let content = '';

        // Add search controls
        content += `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="content-card">
                        <div class="card-body-modern">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-4">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-search me-2"></i>Search Videos
                                    </label>
                                    <input type="text" class="form-control" id="videoSearchInput"
                                           placeholder="Search by name, year, or location..."
                                           onkeyup="filterVideos()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-filter me-2"></i>Filter by Year
                                    </label>
                                    <select class="form-select" id="yearFilter" onchange="filterVideos()">
                                        <option value="">All Years</option>
                                        <option value="2023">2023</option>
                                        <option value="2024">2024</option>
                                        <option value="2025">2025</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-map-marker-alt me-2"></i>Location
                                    </label>
                                    <select class="form-select" id="locationFilter" onchange="filterVideos()">
                                        <option value="">All Locations</option>
                                        <option value="Jawa">Jawa</option>
                                        <option value="Sumatra">Sumatra</option>
                                        <option value="Kalimantan">Kalimantan</option>
                                        <option value="Nusa Tenggara">Nusa Tenggara</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-file me-2"></i>Media Type
                                    </label>
                                    <select class="form-select" id="mediaTypeFilter" onchange="filterVideos()">
                                        <option value="">All Media</option>
                                        <option value="video">Videos Only</option>
                                        <option value="image">Images Only</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-modern-primary" onclick="scanMediaSources()">
                                            <i class="fas fa-sync-alt me-2"></i>Scan Sources
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        // Add main content area
        content += `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Media Files</h6>
                        </div>
                        <div class="card-body">
                            <div id="media-files-list">
                                <div class="text-center text-muted">
                                    <i class="fas fa-images fa-3x mb-3"></i>
                                    <p>Click "Scan Media Sources" to load available media files</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        console.log('Setting BIM media content...');
        document.getElementById('bim-media-content').innerHTML = content;
        console.log('BIM Media interface loaded successfully');

    } catch (error) {
        console.error('Error loading BIM media:', error);
        document.getElementById('bim-media-content').innerHTML = '<div class="alert alert-danger">Error loading BIM media management interface</div>';
    }
}

async function scanMediaSources() {
    try {
        console.log('Scanning media sources...');
        // Placeholder implementation
        alert('Media scanning functionality will be implemented here');
    } catch (error) {
        console.error('Error scanning media sources:', error);
    }
}

async function loadPDFManagement() {
    try {
        console.log('ðŸ”„ Loading PDF management...');

        // Check if content management module is available
        if (window.adminPanel && window.adminPanel.modules &&
            window.adminPanel.modules.get('contentManagement') &&
            window.adminPanel.modules.get('contentManagement').instance) {

            // Delegate to the content management module
            console.log('ðŸ“„ Delegating to ContentManagementModule...');
            await window.adminPanel.modules.get('contentManagement').instance.loadPDFManagement();
            return;
        }

        // Fallback implementation if module not available yet
        console.log('ðŸ“„ ContentManagementModule not available, using fallback...');

        const tableBody = document.getElementById('pdfManagementTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0">Loading PDF materials...</p>
                    </div>
                </td>
            </tr>`;

        // Fetch PDF materials from API
        const response = await fetch('/api/admin/learning-materials');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('âœ… PDF materials loaded:', data.data.length, 'materials');

        allPDFManagementData = data.data || [];

        // Update badges - check if functions are available
        if (typeof updateTotalPDFManagementCount === 'function') {
            updateTotalPDFManagementCount(allPDFManagementData.length);
        } else {
            console.warn('âš ï¸ updateTotalPDFManagementCount function not available');
            // Fallback: update badge directly
            const badge = document.getElementById('totalPDFManagementCount');
            if (badge) {
                badge.innerHTML = `<i class="fas fa-file-pdf me-1"></i>Total: ${allPDFManagementData.length} PDFs`;
            }
        }

        if (typeof updateSelectedPDFManagementCount === 'function') {
            updateSelectedPDFManagementCount(selectedPDFManagementIds.size);
        } else {
            console.warn('âš ï¸ updateSelectedPDFManagementCount function not available');
            // Fallback: update badge directly
            const badge = document.getElementById('selectedPDFManagementCount');
            if (badge) {
                badge.innerHTML = `<i class="fas fa-check me-1"></i>Displayed: ${selectedPDFManagementIds.size} PDFs`;
            }
        }

        // Render table - check if function is available
        if (typeof displayPDFManagementTable === 'function') {
            displayPDFManagementTable(allPDFManagementData);
        } else {
            console.warn('âš ï¸ displayPDFManagementTable function not available');
            // Basic fallback table
            let html = '';
            allPDFManagementData.slice(0, 10).forEach((pdf, index) => {
                html += `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td class="text-center">-</td>
                        <td>${pdf.title || pdf.name || 'Unknown'}</td>
                        <td><span class="badge bg-info">${pdf.category || 'general'}</span></td>
                        <td><span class="badge bg-warning">${pdf.level || 'beginner'}</span></td>
                        <td class="text-center">${pdf.pageCount || 'N/A'}</td>
                        <td class="text-center">${pdf.fileSize ? formatFileSize(pdf.fileSize) : 'N/A'}</td>
                        <td>${pdf.description || 'No description'}</td>
                        <td>-</td>
                    </tr>`;
            });
            tableBody.innerHTML = html;
        }

        // Initialize filters - check if function is available
        if (typeof initializePDFFilters === 'function') {
            initializePDFFilters();
        }

        console.log('âœ… PDF management loaded successfully (fallback mode)');

    } catch (error) {
        console.error('âŒ Error loading PDF management:', error);
        document.getElementById('pdfManagementTableBody').innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Failed to load PDF materials: ${error.message}
                    </div>
                </td>
            </tr>`;
    }
}

async function loadVideoDisplayManagement() {
    try {
        console.log('Loading video display management...');
        // Placeholder implementation
        document.getElementById('videoDisplayTableBody').innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0">Loading video display management...</p>
                    </div>
                </td>
            </tr>`;

        // Simulate loading
        setTimeout(() => {
            document.getElementById('videoDisplayTableBody').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-tv fa-3x mb-3"></i>
                            <p>Video display management functionality is under development</p>
                        </div>
                    </td>
                </tr>`;
        }, 1000);

    } catch (error) {
        console.error('Error loading video display management:', error);
    }
}

// Additional placeholder functions for sections that haven't been fully implemented yet
function loadNews() {
    document.getElementById('news-content').innerHTML = '<div class="text-center"><div class="spinner-border text-info" role="status"><span class="visually-hidden">Loading...</span></div><p>Loading news management...</p></div>';
    setTimeout(() => {
        document.getElementById('news-content').innerHTML = '<div class="alert alert-info">News management functionality will be implemented here.</div>';
    }, 1000);
}

function loadPlugins() {
    document.getElementById('plugins-content').innerHTML = '<div class="text-center"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Loading...</span></div><p>Loading plugins...</p></div>';
    setTimeout(() => {
        document.getElementById('plugins-content').innerHTML = '<div class="alert alert-info">Plugins management functionality will be implemented here.</div>';
    }, 1000);
}

function loadLibrary() {
    document.getElementById('library-content').innerHTML = '<div class="text-center"><div class="spinner-border text-dark" role="status"><span class="visually-hidden">Loading...</span></div><p>Loading library files...</p></div>';
    setTimeout(() => {
        document.getElementById('library-content').innerHTML = '<div class="alert alert-info">Library management functionality will be implemented here.</div>';
    }, 1000);
}

function loadSystem() {
    document.getElementById('system-content').innerHTML = '<div class="text-center"><div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div><p>Loading system information...</p></div>';
    setTimeout(() => {
        document.getElementById('system-content').innerHTML = '<div class="alert alert-info">System information functionality will be implemented here.</div>';
    }, 1000);
}

// Global utility functions
function constructTaggedMediaUrl(filename, type, fullPath) {
    // Basic implementation - can be enhanced later
    if (!fullPath) return `/media/${encodeURIComponent(filename)}`;
    return `/media/${encodeURIComponent(fullPath)}`;
}

// PDF Management Functions

function displayPDFManagementTable(pdfs) {
    const tableBody = document.getElementById('pdfManagementTableBody');

    if (pdfs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <i class="fas fa-file-pdf fa-3x text-muted mb-3"></i>
                        <p class="text-muted mb-2">No PDF materials found</p>
                        <button class="btn btn-primary" onclick="showPDFUploadModal()">
                            <i class="fas fa-plus me-2"></i>Add First PDF
                        </button>
                    </div>
                </td>
            </tr>`;
        return;
    }

    let html = '';
    pdfs.forEach((pdf, index) => {
        const pdfId = pdf.id;
        const title = pdf.title || pdf.name || 'Unknown';
        const category = pdf.category || 'general';
        const level = pdf.level || 'beginner';
        const pages = pdf.pageCount || 'Unknown';
        const size = pdf.fileSize ? formatFileSize(pdf.fileSize) : 'Unknown';
        const description = pdf.description || '';
        const isSelected = selectedPDFManagementIds.has(pdfId.toString());
        const actualIndex = index + 1;

        html += `
            <tr>
                <td class="text-center fw-bold">${actualIndex}</td>
                <td class="text-center">
                    <div class="form-check">
                        <input class="form-check-input pdf-display-checkbox"
                               type="checkbox"
                               id="pdf_display_${pdfId}"
                               value="${pdfId}"
                               ${isSelected ? 'checked' : ''}
                               onchange="updatePDFManagementSelection()">
                        <label class="form-check-label" for="pdf_display_${pdfId}"></label>
                    </div>
                </td>
                <td>
                    <div class="fw-bold text-truncate" style="max-width: 250px;" title="${title}">${title}</div>
                </td>
                <td><span class="badge bg-info">${category}</span></td>
                <td><span class="badge bg-warning">${level}</span></td>
                <td class="text-center">${pages}</td>
                <td class="text-center">${size}</td>
                <td>
                    <div class="text-truncate" style="max-width: 200px;" title="${description}">
                        ${description || '<em>No description</em>'}
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-info" onclick="previewPDFManagement('${pdfId}')" title="Preview PDF">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-primary" onclick="editPDFManagement('${pdfId}')" title="Edit PDF">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deletePDFManagement('${pdfId}', '${title.replace(/'/g, "\\'")}')" title="Delete PDF">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tableBody.innerHTML = html;
}

function initializePDFFilters() {
    // Add event listeners for filters
    const searchInput = document.getElementById('pdfManagementSearchInput');
    const categoryFilter = document.getElementById('pdfManagementCategoryFilter');
    const levelFilter = document.getElementById('pdfManagementLevelFilter');
    const sortFilter = document.getElementById('pdfManagementSortFilter');

    if (searchInput) searchInput.addEventListener('keyup', filterPDFManagement);
    if (categoryFilter) categoryFilter.addEventListener('change', filterPDFManagement);
    if (levelFilter) levelFilter.addEventListener('change', filterPDFManagement);
    if (sortFilter) sortFilter.addEventListener('change', filterPDFManagement);
}

function filterPDFManagement() {
    const searchTerm = document.getElementById('pdfManagementSearchInput')?.value.toLowerCase().trim() || '';
    const categoryFilter = document.getElementById('pdfManagementCategoryFilter')?.value || '';
    const levelFilter = document.getElementById('pdfManagementLevelFilter')?.value || '';
    const sortFilter = document.getElementById('pdfManagementSortFilter')?.value || 'title';

    let filteredPDFs = allPDFManagementData.filter(pdf => {
        const title = (pdf.title || pdf.name || '').toLowerCase();
        const description = (pdf.description || '').toLowerCase();
        const category = pdf.category || '';
        const level = pdf.level || '';

        const matchesSearch = !searchTerm ||
            title.includes(searchTerm) ||
            description.includes(searchTerm) ||
            category.includes(searchTerm);

        const matchesCategory = !categoryFilter || category === categoryFilter;
        const matchesLevel = !levelFilter || level === levelFilter;

        return matchesSearch && matchesCategory && matchesLevel;
    });

    // Sort PDFs
    filteredPDFs.sort((a, b) => {
        switch (sortFilter) {
            case 'title':
                return (a.title || a.name || '').localeCompare(b.title || b.name || '');
            case 'category':
                return (a.category || '').localeCompare(b.category || '');
            case 'level':
                const levelOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
                return levelOrder[a.level] - levelOrder[b.level];
            case 'pages':
                return (b.pageCount || 0) - (a.pageCount || 0);
            case 'newest':
                return new Date(b.createdAt || b.uploadedAt || 0) - new Date(a.createdAt || a.uploadedAt || 0);
            default:
                return 0;
        }
    });

    filteredPDFManagementData = filteredPDFs;
    displayPDFManagementTable(filteredPDFs);
}

function updatePDFManagementSelection() {
    try {
        const checkboxes = document.querySelectorAll('.pdf-display-checkbox');
        const previousCount = selectedPDFManagementIds.size;
        selectedPDFManagementIds.clear();

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedPDFManagementIds.add(checkbox.value.toString());
            }
        });

        const newCount = selectedPDFManagementIds.size;
        console.log(`ðŸ”„ Updated PDF selection: ${previousCount} â†’ ${newCount} PDFs selected`);

        updateSelectedPDFManagementCount(newCount);

    } catch (error) {
        console.error('âŒ Error updating PDF selection:', error);
    }
}

function previewPDFManagement(pdfId) {
    const pdf = allPDFManagementData.find(p => p.id == pdfId);
    if (!pdf) {
        alert('PDF not found');
        return;
    }

    // Open PDF in the reader (same as courses page)
    window.open(`/public/reader.html?material=${encodeURIComponent(pdfId)}`, '_blank');
}

function editPDFManagement(pdfId) {
    const pdf = allPDFManagementData.find(p => p.id == pdfId);
    if (!pdf) {
        alert('PDF not found');
        return;
    }

    // Create edit modal
    const modalHtml = `
        <div class="modal fade" id="pdfEditModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-edit me-2"></i>Edit PDF Material
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="pdfEditForm">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label">Title *</label>
                                    <input type="text" class="form-control" id="editPdfTitle" value="${pdf.title || pdf.name || ''}" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Category *</label>
                                    <select class="form-select" id="editPdfCategory" required>
                                        <option value="autocad" ${pdf.category === 'autocad' ? 'selected' : ''}>AutoCAD</option>
                                        <option value="revit" ${pdf.category === 'revit' ? 'selected' : ''}>Revit BIM</option>
                                        <option value="sketchup" ${pdf.category === 'sketchup' ? 'selected' : ''}>SketchUp</option>
                                        <option value="3dsmax" ${pdf.category === '3dsmax' ? 'selected' : ''}>3ds Max</option>
                                        <option value="general" ${pdf.category === 'general' ? 'selected' : ''}>General BIM</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">BIM Level *</label>
                                    <select class="form-select" id="editPdfLevel" required>
                                        <option value="beginner" ${pdf.level === 'beginner' ? 'selected' : ''}>Beginner</option>
                                        <option value="intermediate" ${pdf.level === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                                        <option value="advanced" ${pdf.level === 'advanced' ? 'selected' : ''}>Advanced</option>
                                        <option value="expert" ${pdf.level === 'expert' ? 'selected' : ''}>Expert</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Language</label>
                                    <select class="form-select" id="editPdfLanguage">
                                        <option value="id" ${pdf.language === 'id' ? 'selected' : ''}>Bahasa Indonesia</option>
                                        <option value="en" ${pdf.language === 'en' ? 'selected' : ''}>English</option>
                                        <option value="mixed" ${pdf.language === 'mixed' ? 'selected' : ''}>Mixed</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" id="editPdfDescription" rows="3">${pdf.description || ''}</textarea>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Cover Image (optional)</label>
                                    ${pdf.thumbnailPath ? `
                                        <div class="mb-2">
                                            <img src="${pdf.thumbnailPath}" alt="Current cover" style="max-width: 180px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                        </div>
                                    ` : '<small class="text-muted d-block mb-2">No cover image uploaded</small>'}
                                    <input type="file" class="form-control" id="editPdfCoverImage" accept="image/png,image/jpeg,image/webp">
                                    <small class="text-muted">Upload to replace the current cover (JPG/PNG/WEBP, max 10MB)</small>
                                </div>
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="editPdfDisplayOnCourses" ${pdf.displayOnCourses ? 'checked' : ''}>
                                        <label class="form-check-label" for="editPdfDisplayOnCourses">
                                            Display on Courses page
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Update PDF
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;

    // Remove existing modal
    const existingModal = document.getElementById('pdfEditModal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup form submission
    document.getElementById('pdfEditForm').addEventListener('submit', (e) => handlePDFUpdate(e, pdfId));

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('pdfEditModal'));
    modal.show();
}

async function handlePDFUpdate(e, pdfId) {
    e.preventDefault();

    const updateData = {
        title: document.getElementById('editPdfTitle').value.trim(),
        category: document.getElementById('editPdfCategory').value,
        level: document.getElementById('editPdfLevel').value,
        language: document.getElementById('editPdfLanguage').value,
        description: document.getElementById('editPdfDescription').value.trim(),
        displayOnCourses: document.getElementById('editPdfDisplayOnCourses').checked
    };

    try {
        const coverFile = document.getElementById('editPdfCoverImage')?.files?.[0];
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
        submitBtn.disabled = true;

        const response = await fetch(`/api/admin/learning-materials/${pdfId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            if (coverFile) {
                const coverResult = await uploadPDFCoverImage(pdfId, coverFile);
                if (!coverResult) {
                    alert('âš ï¸ PDF updated, but cover image upload failed.');
                }
            }
            alert('âœ… PDF updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('pdfEditModal')).hide();
            loadPDFManagement();
        } else {
            const error = await response.json();
            alert('âŒ Failed to update PDF: ' + (error.error || 'Unknown error'));
        }

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error updating PDF:', error);
        alert('âŒ Error updating PDF: ' + error.message);
        e.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Update PDF';
        e.target.querySelector('button[type="submit"]').disabled = false;
    }
}

function deletePDFManagement(pdfId, title) {
    const confirmMsg = `Are you sure you want to permanently delete "${title}"?\n\nThis action cannot be undone!`;

    if (confirm(confirmMsg)) {
        const doubleConfirm = `FINAL CONFIRMATION: Delete "${title}"?\n\nThe PDF file and all associated data will be permanently lost!`;

        if (confirm(doubleConfirm)) {
            handlePDFDelete(pdfId, title);
        }
    }
}

async function handlePDFDelete(pdfId, title) {
    try {
        const response = await fetch(`/api/admin/learning-materials/${pdfId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert(`âœ… PDF "${title}" deleted successfully!`);
            loadPDFManagement();
        } else {
            const error = await response.json();
            alert('âŒ Failed to delete PDF: ' + (error.error || 'Unknown error'));
        }

    } catch (error) {
        console.error('Error deleting PDF:', error);
        alert('âŒ Error deleting PDF: ' + error.message);
    }
}

function showPDFUploadModal() {
    const modalHtml = `
        <div class="modal fade" id="pdfUploadModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-plus me-2"></i>Add New PDF Material
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="pdfUploadForm" enctype="multipart/form-data">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-12">
                                    <label class="form-label">PDF File *</label>
                                    <input type="file" class="form-control" id="pdfFile" accept=".pdf" required>
                                    <small class="text-muted">Select a PDF file to upload (max 100MB)</small>
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label">Title *</label>
                                    <input type="text" class="form-control" id="pdfTitle" required placeholder="Enter PDF title">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Category *</label>
                                    <select class="form-select" id="pdfCategory" required>
                                        <option value="">Select Category</option>
                                        <option value="autocad">AutoCAD</option>
                                        <option value="revit">Revit BIM</option>
                                        <option value="sketchup">SketchUp</option>
                                        <option value="3dsmax">3ds Max</option>
                                        <option value="general">General BIM</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">BIM Level *</label>
                                    <select class="form-select" id="pdfLevel" required>
                                        <option value="">Select Level</option>
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Language</label>
                                    <select class="form-select" id="pdfLanguage">
                                        <option value="id">Bahasa Indonesia</option>
                                        <option value="en">English</option>
                                        <option value="mixed">Mixed</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" id="pdfDescription" rows="3" placeholder="Brief description of the PDF content..."></textarea>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Cover Image (optional)</label>
                                    <input type="file" class="form-control" id="pdfCoverImage" accept="image/png,image/jpeg,image/webp">
                                    <small class="text-muted">JPG/PNG/WEBP, max 10MB</small>
                                </div>
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="pdfDisplayOnCourses" checked>
                                        <label class="form-check-label" for="pdfDisplayOnCourses">
                                            Display on Courses page
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-upload me-2"></i>Upload PDF
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;

    // Remove existing modal
    const existingModal = document.getElementById('pdfUploadModal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup form submission
    document.getElementById('pdfUploadForm').addEventListener('submit', handlePDFUpload);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('pdfUploadModal'));
    modal.show();
}

async function handlePDFUpload(e) {
    e.preventDefault();

    const fileInput = document.getElementById('pdfFile');
    const file = fileInput.files[0];
    const coverFile = document.getElementById('pdfCoverImage')?.files?.[0];

    if (!file) {
        alert('Please select a PDF file');
        return;
    }

    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file');
        return;
    }

    if (file.size > 100 * 1024 * 1024) {
        alert('File size must be less than 100MB');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', document.getElementById('pdfTitle').value.trim());
    formData.append('category', document.getElementById('pdfCategory').value);
    formData.append('level', document.getElementById('pdfLevel').value);
    formData.append('language', document.getElementById('pdfLanguage').value);
    formData.append('description', document.getElementById('pdfDescription').value.trim());
    formData.append('displayOnCourses', document.getElementById('pdfDisplayOnCourses').checked);

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
        submitBtn.disabled = true;

        const response = await fetch('/api/admin/learning-materials/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const materialId = result.data?.id;
            let coverUploaded = true;

            if (coverFile && materialId) {
                coverUploaded = await uploadPDFCoverImage(materialId, coverFile);
            }

            if (coverFile && materialId && !coverUploaded) {
                alert('âš ï¸ PDF uploaded, but cover image upload failed.');
            } else {
                alert('âœ… PDF uploaded and material created successfully!');
            }

            bootstrap.Modal.getInstance(document.getElementById('pdfUploadModal')).hide();
            loadPDFManagement();
        } else {
            const errorMessage = result.error || result.message || 'Unknown error';
            console.error('Upload failed:', result);
            alert('âŒ Failed to upload PDF: ' + errorMessage);
        }

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error uploading PDF:', error);
        alert('âŒ Error uploading PDF: ' + error.message);
        e.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-upload me-2"></i>Upload PDF';
        e.target.querySelector('button[type="submit"]').disabled = false;
    }
}

async function uploadPDFCoverImage(pdfId, coverFile) {
    try {
        if (!pdfId || !coverFile) return true;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(coverFile.type)) {
            alert('âŒ Cover image must be JPG, PNG, or WEBP.');
            return false;
        }

        if (coverFile.size > 10 * 1024 * 1024) {
            alert('âŒ Cover image must be less than 10MB.');
            return false;
        }

        const formData = new FormData();
        formData.append('cover', coverFile);

        const response = await fetch(`/api/admin/learning-materials/${pdfId}/cover`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            return false;
        }

        const result = await response.json();
        return !!result.success;
    } catch (error) {
        console.error('Error uploading cover image:', error);
        return false;
    }
}



function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

