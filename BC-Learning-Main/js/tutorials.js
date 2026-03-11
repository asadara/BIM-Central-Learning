document.addEventListener("DOMContentLoaded", () => {
    // Check for category parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFilter = urlParams.get('category');
    const videoId = urlParams.get('video');

    if (categoryFilter) {
        // Update page title to show category
        const categoryNames = {
            // Course levels
            'beginner': 'Pemula',
            'intermediate': 'Menengah',
            'advanced': 'Lanjutan',
            // Software categories
            'autocad': 'AutoCAD',
            'revit': 'Revit BIM',
            'sketchup': 'SketchUp',
            '3dsmax': '3ds Max',
            'lumion': 'Lumion',
            'enscape': 'Enscape',
            'dynamo': 'Dynamo',
            'navisworks': 'Navisworks',
            'civil-3d': 'Civil 3D',
            'archicad': 'ArchiCAD',
            'other': 'Other Tutorials'
        };

        // Try to get course category first, fallback to direct mapping
        const courseCategory = getCourseCategoryFromURL(categoryFilter);
        const displayCategory = courseCategory || categoryFilter;
        const categoryName = categoryNames[displayCategory] || categoryNames[categoryFilter] || categoryFilter;
        document.querySelector('h1').textContent = `Video Tutorial ${categoryName}`;

        // Add back button - determine destination based on referrer
        const backBtn = document.getElementById('backButton');
        if (backBtn) {
            backBtn.style.display = 'inline-block';

            // Determine where to go back to
            const referrer = document.referrer;
            let backDestination = '../elearning-assets/courses.html'; // default

            // If user came from elearning.html page, go back there
            if (referrer && referrer.includes('/pages/elearning.html')) {
                backDestination = '../pages/elearning.html';
            }

            backBtn.onclick = () => window.location.href = backDestination;
        }
    }

    checkAdminAccess();
    fetchVideos(categoryFilter, videoId);

    // Re-check admin access after user context loaders complete
    setTimeout(checkAdminAccess, 1000);
});

// Global protocol variable for HTTP/HTTPS detection
const protocol = window.location.protocol;
let hasTutorialAdminAccess = false;
let currentEditingVideo = null;
const tutorialVideoMap = new Map();

function getStoredAuthToken() {
    try {
        const localToken = localStorage.getItem('token');
        if (localToken) return localToken;

        const storedUser = localStorage.getItem('user');
        if (!storedUser) return null;

        const parsedUser = JSON.parse(storedUser);
        return parsedUser?.token || null;
    } catch (error) {
        console.warn('Failed to read auth token from localStorage:', error);
        return null;
    }
}

function getAuthHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = getStoredAuthToken();
    if (token && !headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function isAdminFromTokenPayload() {
    const token = getStoredAuthToken();
    if (!token || !token.includes('.')) return false;

    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const decoded = JSON.parse(atob(padded));
        const role = String(decoded?.role || decoded?.jobRole || '').toLowerCase();
        return decoded?.isAdmin === true || role.includes('admin') || role.includes('administrator');
    } catch (error) {
        return false;
    }
}

function normalizeTagList(tags) {
    if (!Array.isArray(tags)) return [];

    const normalized = [];
    const seen = new Set();
    tags.forEach((tag) => {
        const cleanTag = String(tag || '').trim().replace(/^#/, '');
        if (!cleanTag) return;

        const dedupeKey = cleanTag.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        normalized.push(cleanTag);
    });

    return normalized;
}

function parseSizeToMB(sizeValue) {
    const raw = String(sizeValue || '').trim().toLowerCase();
    if (!raw) return 0;

    const numeric = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(numeric)) return 0;

    if (raw.includes('gb') || raw.includes('gib')) return numeric * 1024;
    if (raw.includes('kb') || raw.includes('kib')) return numeric / 1024;
    return numeric;
}

function buildEditTagButton(videoId) {
    const hiddenStyle = hasTutorialAdminAccess ? '' : 'display:none;';
    return `<button class="edit-tag-btn" onclick="openTagEditor('${videoId}')" style="
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        padding: 2px 8px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 11px;
        color: #007bff;
        transition: all 0.2s;
        ${hiddenStyle}
    " onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'" title="Edit tags">
        <i class="fas fa-edit"></i>
    </button>`;
}

function buildTagBadges(tags) {
    const normalizedTags = normalizeTagList(tags);
    if (normalizedTags.length === 0) {
        return '<span style="color: #adb5bd; font-size: 11px;">No tags yet</span>';
    }

    return normalizedTags
        .map((tag) => `<span style="background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #495057;">#${tag}</span>`)
        .join('');
}

function updateTagEditorButtonsVisibility() {
    const displayValue = hasTutorialAdminAccess ? 'inline-flex' : 'none';
    document.querySelectorAll('.edit-tag-btn').forEach((button) => {
        button.style.display = displayValue;
    });
}




// Helper function to sanitize filename (same as backend server.js - browser-compatible version)
function sanitizeFilenameForThumbnail(filename) {
    // Get base name without extension (browser-compatible equivalent of path.parse)
    const lastDotIndex = filename.lastIndexOf('.');
    const baseName = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;

    return baseName
        .replace(/[^a-zA-Z0-9_\-]/g, '_')  // Replace non-alphanumeric dengan underscore
        .replace(/_+/g, '_')                 // Collapse multiple underscores
        .toLowerCase();                      // Lowercase untuk consistency
}

// Function to detect video category (same as backend)
function detectVideoCategory(filename) {
    const name = filename.toLowerCase();

    // Check for course-level categories first (from URL parameters)
    if (name.includes('beginner') || name.includes('dasar') || name.includes('pemula') || name.includes('fundamentals')) {
        return 'beginner';
    }
    if (name.includes('intermediate') || name.includes('menengah') || name.includes('modeling') || name.includes('3d')) {
        return 'intermediate';
    }
    if (name.includes('advanced') || name.includes('lanjut') || name.includes('collaboration') || name.includes('automation')) {
        return 'advanced';
    }

    // Software-specific categories
    if (name.includes('autocad') || name.includes('acad') || name.includes('dwg')) {
        return 'autocad';
    }
    if (name.includes('revit') || name.includes('rvt') || name.includes('bim')) {
        return 'revit';
    }
    if (name.includes('lumion') || name.includes('rendering')) {
        return 'lumion';
    }
    if (name.includes('enscape')) {
        return 'enscape';
    }
    if (name.includes('dynamo') || name.includes('parametric')) {
        return 'dynamo';
    }
    if (name.includes('navisworks') || name.includes('nwd')) {
        return 'navisworks';
    }
    if (name.includes('civil') || name.includes('infraworks') || name.includes('civil-3d')) {
        return 'civil-3d';
    }
    if (name.includes('archicad') || name.includes('archi-cad')) {
        return 'archicad';
    }

    // Default fallback
    return 'other';
}

// Enhanced function to get course category from URL parameter
function getCourseCategoryFromURL(urlCategory) {
    if (!urlCategory) return null;

    const category = urlCategory.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');

    // Map URL categories to course levels and software categories
    const categoryMappings = {
        // Course level mappings (from index.html cards)
        'dasardasarbim': 'beginner',
        'beginner': 'beginner',
        'pemula': 'beginner',
        'fundamentals': 'beginner',
        'dasarbim': 'beginner',
        'bimfundamentals101': 'beginner',

        'autocaduntukbim': 'autocad',
        'autocadbim201': 'autocad',
        'softwaretools': 'autocad',
        'autocad': 'autocad',

        '3dmodelingdenganrevit': 'revit',
        'revitmodeling301': 'revit',
        '3dmodeling': 'revit',
        'modeling': 'revit',
        'revit': 'revit',

        'kolaborasiproyekbim': 'advanced',
        'bimcollaboration401': 'advanced',
        'collaboration': 'advanced',
        'advanced': 'advanced',
        'lanjut': 'advanced',

        'standarsertifikasibim': 'advanced',
        'bimstandards501': 'advanced',
        'certification': 'advanced',

        'automationdengandynamo': 'dynamo',
        'dynamoautomation601': 'dynamo',
        'automation': 'dynamo',

        // Direct category mappings (URL parameters)
        'civil3d': 'civil-3d',
        'civil-3d': 'civil-3d',
        'intermediate': 'intermediate',
        'menengah': 'intermediate',

        // Software category mappings
        'lumion': 'lumion',
        'enscape': 'enscape',
        'navisworks': 'navisworks',
        'archicad': 'archicad',
        'sketchup': 'sketchup',
        '3dsmax': '3dsmax',

        // Additional mappings for better coverage
        'bimtools': 'autocad',
        'bimtoolsplugins': 'autocad',
        'plugins': 'autocad',
        'standards': 'advanced',
        'bimstandards': 'advanced',
        'projects': 'advanced',
        'bimprojects': 'advanced'
    };

    return categoryMappings[category] || null;
}

function searchAndFilter() {
    const inputEl = document.getElementById('searchInput');
    const sizeFilterEl = document.getElementById('sizeFilter');
    const tagSearchEl = document.getElementById('tagSearchInput');
    const resultEl = document.getElementById('searchResults');

    const input = String(inputEl?.value || '').toLowerCase().trim();
    const filter = String(sizeFilterEl?.value || 'all');
    const tagSearch = String(tagSearchEl?.value || '').toLowerCase().trim();
    const searchTags = tagSearch
        ? tagSearch.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean)
        : [];

    const videoCards = document.querySelectorAll('.video-card');
    let resultCount = 0;

    videoCards.forEach((card) => {
        const title = String(card.querySelector('.video-title')?.innerText || '').toLowerCase().trim();
        const sizeMB = parseFloat(card.dataset.sizeMb || '0') || 0;
        const cardTags = String(card.dataset.tags || '')
            .split(',')
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean);

        const matchTitle = !input || title.includes(input);
        const matchSize = filter === 'all' ||
            (filter === 'small' && sizeMB <= 50) ||
            (filter === 'medium' && sizeMB > 50 && sizeMB <= 200) ||
            (filter === 'large' && sizeMB > 200 && sizeMB <= 750) ||
            (filter === 'extra' && sizeMB > 1000);

        const matchTags = searchTags.length === 0
            ? true
            : searchTags.some((searchTag) =>
                cardTags.some((videoTag) => videoTag.includes(searchTag))
            );

        const isMatch = matchTitle && matchSize && matchTags;
        card.style.setProperty('display', isMatch ? 'block' : 'none', 'important');
        if (isMatch) resultCount += 1;
    });

    if (resultEl) {
        resultEl.innerText = resultCount > 0
            ? `Hasil Pencarian ditemukan: ${resultCount} file(s)`
            : 'Tidak ada video yang cocok.';
    }
}

if (document.getElementById("videoContainer")) {
    // Only add event listeners if we're on the tutorials page
    if (document.getElementById("searchInput")) {
        document.getElementById("searchInput").addEventListener("input", searchAndFilter);
    }
    if (document.getElementById("sizeFilter")) {
        document.getElementById("sizeFilter").addEventListener("change", searchAndFilter);
    }
    if (document.getElementById("tagSearchInput")) {
        document.getElementById("tagSearchInput").addEventListener("input", searchAndFilter);
    }
    if (document.getElementById("sortFilter")) {
        document.getElementById("sortFilter").addEventListener("change", sortVideos);
    }
}

function clearAllFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("sizeFilter").value = "all";
    document.getElementById("tagSearchInput").value = "";
    document.getElementById("sortFilter").value = "name-asc";

    searchAndFilter();
    sortVideos();

    console.log("✅ All filters cleared");
}

function fetchVideos(categoryFilter = null, autoPlayVideoId = null) {
    const container = document.getElementById("videoContainer");
    if (!container) return console.error("❌ Elemen #videoContainer tidak ditemukan!");

    showSpinner(); // 🔁 Tampilkan loading sebelum mulai

    // ✅ FIXED: Use relative URL for Nginx proxy compatibility
    // Nginx will forward /api/* requests to the active backend target
    const apiBaseUrl = '/api/tutorials';

    console.log('🔍 Fetching videos from:', apiBaseUrl);
    if (categoryFilter) console.log('🏷️ Filtering by category:', categoryFilter);

    fetch(apiBaseUrl)
        .then(response => {
            console.log('📡 Response status:', response.status);
            return response.json();
        })
        .then(videos => {
            console.log('📹 Received videos:', videos.length, 'videos');
            if (!videos || videos.length === 0) {
                container.innerHTML = "<p>Tidak ada video tersedia.</p>";
                return;
            }

            // Store original video count for fallback logic
            const originalVideoCount = videos.length;

            // Filter by category if specified
            if (categoryFilter) {
                // First try to map URL category to course level
                const courseCategory = getCourseCategoryFromURL(categoryFilter);
                const targetCategory = courseCategory || categoryFilter;

                const filteredVideos = videos.filter(video => {
                    const videoCategory = detectVideoCategory(video.name);
                    // Check both direct match and course-level match
                    return videoCategory === targetCategory || videoCategory === categoryFilter;
                });

                // If no videos match the category, show a helpful message instead of empty results
                if (filteredVideos.length === 0) {
                    console.log('⚠️ No videos found for category:', targetCategory, '- showing fallback message');
                    container.innerHTML = `
                        <div class="alert alert-info" role="alert">
                            <h5 class="alert-heading">
                                <i class="fas fa-info-circle me-2"></i>
                                Tidak ada video dalam kategori "${categoryFilter}"
                            </h5>
                            <p>Kategori ini sedang dalam pengembangan atau belum memiliki video tutorial.</p>
                            <hr>
                            <p class="mb-0">
                                <strong>Solusi:</strong> Coba jelajahi kategori lain atau kembali ke halaman kursus untuk melihat semua materi yang tersedia.
                            </p>
                            <div class="mt-3">
                                <button class="btn btn-primary me-2" onclick="window.location.href='../pages/elearning.html'">
                                    <i class="fas fa-arrow-left me-1"></i>Lihat Semua Kursus
                                </button>
                                <button class="btn btn-secondary" onclick="window.location.href='../pages/tutorial.html'">
                                    <i class="fas fa-list me-1"></i>Lihat Semua Video
                                </button>
                            </div>
                        </div>
                    `;
                    document.getElementById("searchResults").innerText = `Kategori "${categoryFilter}": 0 file(s)`;
                    hideSpinner();
                    return;
                }

                videos = filteredVideos;
                console.log('🏷️ Filtered videos:', videos.length, 'videos in category', targetCategory, '(from URL:', categoryFilter + ')');
            }
            const videosWithTags = videos.map((video) => {
                video.tags = normalizeTagList(video.tags);
                return video;
            });

            tutorialVideoMap.clear();
            videosWithTags.forEach((video) => {
                tutorialVideoMap.set(String(video.id), video);
            });

            const videoSet = new Set();
            container.innerHTML = ""; // Bersihkan sebelum menambahkan video baru

            videosWithTags.forEach(video => {
                if (!videoSet.has(video.path)) {
                    videoSet.add(video.path);

                    // ✅ FIXED: Use relative URL for Nginx proxy compatibility
                    // Nginx will serve static files directly or proxy to backend if needed
                    const thumbnailUrl = video.thumbnail.startsWith('http')
                        ? video.thumbnail  // Keep full URL if already absolute
                        : video.thumbnail; // Use relative URL for Nginx proxy

                    let card = document.createElement("div");
                    card.className = "video-card";
                    const normalizedTags = normalizeTagList(video.tags);
                    const sizeMBValue = parseSizeToMB(video.size);
                    card.dataset.tags = normalizedTags.map((tag) => tag.toLowerCase()).join(',');
                    card.dataset.sizeMb = String(sizeMBValue);
                    card.innerHTML = `
            <div class="card">
                <div style="position: relative;">
                    <img src="${thumbnailUrl}" alt="Thumbnail" class="video-thumbnail"
                         onerror="handleThumbnailError(this, '${encodeURIComponent(video.path)}')">
                    <!-- Play button overlay -->
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.3s;
                        cursor: pointer;
                    " onmouseover="this.style.background='rgba(0, 0, 0, 0.5)'" 
                       onmouseout="this.style.background='rgba(0, 0, 0, 0)'"
                       onclick="playVideoFullscreen('${video.id}', '${video.path}')">
                        <i class="fas fa-play-circle" style="font-size: 48px; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.8);"></i>
                    </div>
                </div>
                <div class="video-info">
                    <p class="video-title">${video.name}</p>
                    <p class="video-size">Size: ${video.size}</p>
                    <p class="view-count">
                        <i class="fas fa-eye"></i> 
                        ${video.viewCount || 0} views
                    </p>
                    <!-- Tags/Hashtags Section -->
                    <div style="margin: 8px 0; min-height: 30px;">
                        <div id="tags-${video.id}" class="video-tags" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                            ${buildTagBadges(normalizedTags)}
                            ${buildEditTagButton(video.id)}
                        </div>
                    </div>
                    <!-- Action buttons -->
                    <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                        <button onclick="playVideoFullscreen('${video.id}', '${video.path}')" style="
                            flex: 1;
                            min-width: 60px;
                            padding: 6px 8px;
                            background: #007bff;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: background 0.3s;
                        " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'" title="Fullscreen">
                            <i class="fas fa-expand"></i> Full
                        </button>
                        <button onclick="playVideoInline('${video.id}', '${video.path}')" style="
                            flex: 1;
                            min-width: 60px;
                            padding: 6px 8px;
                            background: #17a2b8;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: background 0.3s;
                        " onmouseover="this.style.background='#117a8b'" onmouseout="this.style.background='#17a2b8'" title="Float Window">
                            <i class="fas fa-window-restore"></i> Float
                        </button>
                        <button onclick="playVideoModal('${video.id}', '${video.path}')" style="
                            flex: 1;
                            min-width: 60px;
                            padding: 6px 8px;
                            background: #ffc107;
                            color: black;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: background 0.3s;
                        " onmouseover="this.style.background='#ffb300'" onmouseout="this.style.background='#ffc107'" title="Modal">
                            <i class="fas fa-window-maximize"></i> Modal
                        </button>
                        <button onclick="playVideoNewTab('${video.path}')" style="
                            flex: 1;
                            min-width: 60px;
                            padding: 6px 8px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                            transition: background 0.3s;
                        " onmouseover="this.style.background='#1e7e34'" onmouseout="this.style.background='#28a745'" title="Open in New Tab">
                            <i class="fas fa-external-link-alt"></i> Tab
                        </button>
                    </div>
                </div>
            </div>
        `;
                    container.appendChild(card);
                }
            });

            const resultText = categoryFilter
                ? `Hasil Pencarian kategori "${categoryFilter}": ${videoSet.size} file(s)`
                : `Hasil Pencarian ditemukan: ${videoSet.size} file(s)`;

            document.getElementById("searchResults").innerText = resultText;

            // Auto-play specific video if requested
            if (autoPlayVideoId) {
                setTimeout(() => {
                    const targetVideo = videosWithTags.find(v => v.id === autoPlayVideoId);
                    if (targetVideo) {
                        previewVideo(targetVideo.id, targetVideo.path);
                    }
                }, 500);
            }

            // Set default sort to "Most Viewed" and apply sorting
            document.getElementById("sortFilter").value = "views-desc";
            sortVideos();
            updateTagEditorButtonsVisibility();

            hideSpinner(); // ✅ Sembunyikan loading
        })
        .catch(error => {
            console.error("❌ Gagal mengambil video:", error);
            console.error("❌ Error details:", error.message);
            container.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading">Gagal memuat video!</h4>
                    <p>Terjadi kesalahan saat mengambil daftar video.</p>
                    <hr>
                    <p class="mb-0">Error: ${error.message}</p>
                    <small class="text-muted">Silakan periksa koneksi server dan coba lagi.</small>
                </div>
            `;
            hideSpinner(); // ✅ Sembunyikan loading
        });
}

function previewVideo(videoId, videoPath) {
    console.log("🎬 Preview video:", videoId, videoPath);

    const modal = document.getElementById("videoModal");
    const videoElement = document.getElementById("previewVideo");

    if (!modal || !videoElement || !videoPath) {
        console.error("❌ Kesalahan saat menampilkan video!");
        return;
    }

    // ✅ FIXED: Use API stream endpoint for proper video serving with long filenames
    const videoUrl = videoPath.startsWith('http')
        ? videoPath.replace(/^https?:\/\//, `${protocol}//`)
        : `${protocol}//${window.location.hostname}/api/video-stream/${encodeURIComponent(videoPath.replace(/^\/videos\//, ''))}`;

    console.log("🎥 Loading video from:", videoUrl);

    // ✅ FIXED: Detect video type from URL
    function getVideoType(url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.mp4')) return 'video/mp4';
        if (urlLower.includes('.webm')) return 'video/webm';
        if (urlLower.includes('.avi')) return 'video/avi';
        if (urlLower.includes('.mov')) return 'video/quicktime';
        if (urlLower.includes('.wmv')) return 'video/x-ms-wmv';
        if (urlLower.includes('.flv')) return 'video/x-flv';
        if (urlLower.includes('.mkv')) return 'video/x-matroska';
        return 'video/mp4'; // Default fallback
    }

    // ✅ FIXED: Clear existing sources and properly set video source
    videoElement.innerHTML = '';
    const sourceElement = document.createElement('source');
    sourceElement.src = videoUrl;
    sourceElement.type = getVideoType(videoUrl);
    videoElement.appendChild(sourceElement);

    // Add fallback text for older browsers
    const fallbackText = document.createTextNode('Your browser does not support the video tag.');
    videoElement.appendChild(fallbackText);

    // ✅ FIXED: Add error handlers
    videoElement.addEventListener('error', function (e) {
        console.error("❌ Video error:", e);
        console.error("❌ Network state:", videoElement.networkState);
        console.error("❌ Ready state:", videoElement.readyState);
        alert(`❌ Gagal memuat video:\n${videoUrl}\n\nKemungkinan:\n- File tidak ditemukan\n- Format tidak didukung\n- Koneksi terputus`);
    }, { once: true });

    videoElement.addEventListener('canplay', function () {
        console.log("✅ Video siap diputar");
    }, { once: true });

    // ✅ FIXED: Load and play video
    videoElement.load();
    videoElement.play().catch(err => {
        console.warn("⚠️ Autoplay failed (may be blocked by browser):", err);
    });

    modal.style.display = "block";

    // Update view count if videoId is provided
    if (videoId) {
        fetch(`/api/tutorials/${videoId}/view`, {
            method: 'PUT'
        })
            .then(response => {
                if (response.ok) {
                    console.log("✅ Berhasil memperbarui view count");
                    // Update view count in UI without page reload
                    updateVideoViewCountInUI(videoId);
                }
            })
            .catch(error => {
                console.error("❌ Gagal update view count:", error);
            });
    }
}

// ✅ ALTERNATIF 1: Fullscreen Player (recommended)
function playVideoFullscreen(videoId, videoPath) {
    console.log("🎬 Opening fullscreen player:", videoId, videoPath);

    // ✅ FIXED: Use API stream endpoint for proper video serving with long filenames
    const videoUrl = videoPath.startsWith('http')
        ? videoPath.replace(/^https?:\/\//, `${protocol}//`)
        : `${protocol}//${window.location.hostname}/api/video-stream/${encodeURIComponent(videoPath.replace(/^\/videos\//, ''))}`;

    console.log("🎥 Video URL:", videoUrl);

    // Create fullscreen player overlay
    const overlay = document.createElement('div');
    overlay.id = 'fullscreenVideoOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        width: 90%;
        height: 90%;
        max-width: 1400px;
        max-height: 800px;
    `;

    const video = document.createElement('video');
    video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
    `;
    video.controls = true;
    video.autoplay = true;

    const source = document.createElement('source');
    source.src = videoUrl;
    source.type = getVideoType(videoUrl);
    video.appendChild(source);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕ Close';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255, 255, 255, 0.3);
        color: white;
        border: none;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        border-radius: 4px;
        z-index: 10001;
        transition: background 0.3s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.5)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onclick = () => overlay.remove();

    container.appendChild(video);
    container.appendChild(closeBtn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Close on ESC key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Update view count
    if (videoId) {
        fetch(`/api/tutorials/${videoId}/view`, {
            method: 'PUT'
        })
            .then(response => {
                if (response.ok) {
                    console.log("✅ View count updated for fullscreen player");
                    updateVideoViewCountInUI(videoId);
                }
            })
            .catch(err => console.error("❌ View count update failed:", err));
    }
}

// ✅ ALTERNATIF 2: Modal Player (centered dialog)
function playVideoModal(videoId, videoPath) {
    console.log("🎬 Opening modal player:", videoId, videoPath);

    // ✅ FIXED: Use API stream endpoint for proper video serving
    const videoUrl = videoPath.startsWith('http')
        ? videoPath
        : `${protocol}//${window.location.hostname}/api/video-stream/${encodeURIComponent(videoPath.replace(/^\/videos\//, ''))}`;

    console.log("🎥 Modal video URL:", videoUrl);

    const modal = document.getElementById("videoModal");
    const videoElement = document.getElementById("previewVideo");

    if (!modal || !videoElement) {
        console.error("❌ Modal elements not found!");
        return;
    }

    // Clear existing source
    videoElement.innerHTML = '';

    // Create and add new source
    const source = document.createElement('source');
    source.src = videoUrl;
    source.type = getVideoType(videoUrl);
    videoElement.appendChild(source);

    // Load and play
    videoElement.load();
    videoElement.play().catch(err => {
        console.warn("⚠️ Autoplay failed (may be blocked by browser):", err);
    });

    modal.style.display = "block";

    // Update view count if videoId is provided
    if (videoId) {
        fetch(`/api/tutorials/${videoId}/view`, {
            method: 'PUT'
        })
            .then(response => {
                if (response.ok) {
                    console.log("✅ View count updated for modal player");
                    updateVideoViewCountInUI(videoId);
                }
            })
            .catch(error => {
                console.error("❌ Gagal update view count:", error);
            });
    }
}

// ✅ ALTERNATIF 3: Open in New Tab
function playVideoNewTab(videoPath) {
    console.log("📖 Opening video in new tab:", videoPath);

    // ✅ FIXED: Use API stream endpoint for proper video serving
    const videoUrl = videoPath.startsWith('http')
        ? videoPath
        : `${protocol}//${window.location.hostname}/api/video-stream/${encodeURIComponent(videoPath.replace(/^\/videos\//, ''))}`;

    console.log("🎥 Opening URL:", videoUrl);
    window.open(videoUrl, '_blank');
}

// ✅ ALTERNATIF 3: Inline Panel Player
function playVideoInline(videoId, videoPath) {
    console.log("📺 Opening inline player:", videoId, videoPath);

    // ✅ FIXED: Use API stream endpoint for proper video serving
    const videoUrl = videoPath.startsWith('http')
        ? videoPath
        : `${protocol}//${window.location.hostname}/api/video-stream/${encodeURIComponent(videoPath.replace(/^\/videos\//, ''))}`;

    console.log("🎥 Video URL:", videoUrl);

    // Check if panel already exists
    let panel = document.getElementById('inlinePlayerPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'inlinePlayerPanel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 450px;
            height: 300px;
            background: white;
            border: 2px solid #007bff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            overflow: hidden;
            font-family: Arial, sans-serif;
        `;
        document.body.appendChild(panel);
    }

    // Create video element
    panel.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%;">
            <video style="width: 100%; height: 100%; object-fit: contain; background: black;" controls autoplay>
                <source src="${videoUrl}" type="${getVideoType(videoUrl)}">
            </video>
            <button onclick="document.getElementById('inlinePlayerPanel').style.display='none'" style="
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(255, 0, 0, 0.7);
                color: white;
                border: none;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                font-weight: bold;
            ">✕</button>
        </div>
    `;

    // Update view count
    if (videoId) {
        fetch(`/api/tutorials/${videoId}/view`, {
            method: 'PUT'
        })
            .then(response => {
                if (response.ok) {
                    console.log("✅ View count updated for inline player");
                    updateVideoViewCountInUI(videoId);
                }
            })
            .catch(err => console.error("❌ View count update failed:", err));
    }
}

// Helper function for MIME type detection
function getVideoType(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.mp4')) return 'video/mp4';
    if (urlLower.includes('.webm')) return 'video/webm';
    if (urlLower.includes('.avi')) return 'video/avi';
    if (urlLower.includes('.mov')) return 'video/quicktime';
    if (urlLower.includes('.wmv')) return 'video/x-ms-wmv';
    if (urlLower.includes('.flv')) return 'video/x-flv';
    if (urlLower.includes('.mkv')) return 'video/x-matroska';
    return 'video/mp4';
}

function closeModal() {
    const modal = document.getElementById("videoModal");
    const videoElement = document.getElementById("previewVideo");

    if (modal && videoElement) {
        videoElement.pause();
        videoElement.src = "";
        modal.style.display = "none";
    }
}

// Fungsi untuk memperbarui view count (contoh sederhana)
function updateViewCount() {
    console.log('View count updated');
}

document.addEventListener("click", function (event) {
    const modal = document.getElementById("videoModal");
    if (event.target === modal) {
        closeModal();
    }
});

function sortVideos() {
    let sortBy = document.getElementById("sortFilter").value;
    let videoCards = Array.from(document.querySelectorAll(".video-card"));

    let sortedVideos = videoCards.sort((a, b) => {
        let titleA = a.querySelector(".video-title").innerText.toLowerCase();
        let titleB = b.querySelector(".video-title").innerText.toLowerCase();
        let sizeA = parseFloat(a.dataset.sizeMb || '0') || 0;
        let sizeB = parseFloat(b.dataset.sizeMb || '0') || 0;

        // Extract view count from view count element
        let viewCountTextA = a.querySelector(".view-count")?.innerText || "0 views";
        let viewCountTextB = b.querySelector(".view-count")?.innerText || "0 views";
        let viewsA = parseInt(viewCountTextA.replace(/\D/g, '')) || 0;
        let viewsB = parseInt(viewCountTextB.replace(/\D/g, '')) || 0;

        if (sortBy === "name-asc") return titleA.localeCompare(titleB);
        if (sortBy === "name-desc") return titleB.localeCompare(titleA);
        if (sortBy === "size-asc") return sizeA - sizeB;
        if (sortBy === "size-desc") return sizeB - sizeA;
        if (sortBy === "views-asc") return viewsA - viewsB;
        if (sortBy === "views-desc") return viewsB - viewsA;
    });

    let container = document.getElementById("videoContainer");
    container.innerHTML = "";
    sortedVideos.forEach(video => container.appendChild(video));
}

function showSpinner() {
    document.getElementById('loadingSpinner').style.display = 'block';
}

// ✅ Tag Editor Functions
function openTagEditor(videoId) {
    if (!hasTutorialAdminAccess) {
        alert('Fitur edit tag hanya untuk admin.');
        return;
    }

    const videoData = tutorialVideoMap.get(String(videoId));
    if (!videoData) {
        alert('Data video tidak ditemukan. Silakan refresh halaman.');
        return;
    }

    currentEditingVideo = videoData;
    const currentTags = normalizeTagList(videoData.tags);

    document.getElementById('tagEditorModal').style.display = 'flex';
    document.getElementById('tagEditorTitle').textContent = videoData.name || 'Unknown Video';
    document.getElementById('tagEditorInput').value = currentTags.join(', ');
    document.getElementById('currentTagsDisplay').textContent = currentTags.join(', ') || 'None';
}

function closeTagEditor() {
    console.log("❌ Closing tag editor");
    document.getElementById('tagEditorModal').style.display = 'none';
    currentEditingVideo = null;
}

// Close tag editor when clicking outside modal
document.addEventListener('click', function (event) {
    const modal = document.getElementById('tagEditorModal');
    if (modal && event.target === modal) {
        closeTagEditor();
    }
});

async function saveVideoTags() {
    if (!currentEditingVideo || !currentEditingVideo.id) {
        alert('Video belum dipilih.');
        return;
    }
    if (!hasTutorialAdminAccess) {
        alert('Fitur edit tag hanya untuk admin.');
        return;
    }

    const tagsInput = document.getElementById('tagEditorInput').value.trim();
    const tags = normalizeTagList(tagsInput.split(','));
    const saveBtn = document.querySelector("#tagEditorModal button[onclick='saveVideoTags()']");
    const originalButtonHtml = saveBtn ? saveBtn.innerHTML : '';

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        const payload = {
            videoId: currentEditingVideo.id,
            category: currentEditingVideo.category || 'general',
            bimLevel: currentEditingVideo.bimLevel || 'beginner',
            duration: currentEditingVideo.duration || null,
            language: currentEditingVideo.language || 'id',
            description: currentEditingVideo.description || '',
            tags
        };

        const response = await fetch('/api/admin/videos/tags', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Sesi admin tidak valid. Silakan login admin terlebih dahulu.');
        }

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
        }

        currentEditingVideo.tags = tags;
        tutorialVideoMap.set(String(currentEditingVideo.id), currentEditingVideo);
        updateVideoCardTags(currentEditingVideo.id, tags);

        closeTagEditor();
        alert(`✅ Tags berhasil disimpan ke sistem Admin.\nTags: ${tags.join(', ')}`);
    } catch (error) {
        console.error('❌ Error saving tags:', error);
        alert(`❌ Gagal menyimpan tags: ${error.message}`);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalButtonHtml || '<i class="fas fa-save"></i> Save Tags';
        }
    }
}

function updateVideoCardTags(videoId, tags) {
    const normalizedTags = normalizeTagList(tags);
    const tagsContainer = document.getElementById(`tags-${videoId}`);
    if (!tagsContainer) return;

    const card = tagsContainer.closest('.video-card');
    if (card) {
        card.dataset.tags = normalizedTags.map((tag) => tag.toLowerCase()).join(',');
    }

    tagsContainer.innerHTML = `${buildTagBadges(normalizedTags)}${buildEditTagButton(videoId)}`;
    updateTagEditorButtonsVisibility();
    searchAndFilter();
}

function hideSpinner() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

const thumbnailQueue = [];
const thumbnailQueuePending = new Set();
let thumbnailQueueActive = false;

function processThumbnailQueue() {
    if (thumbnailQueueActive) return;
    const item = thumbnailQueue.shift();
    if (!item) return;

    thumbnailQueueActive = true;
    const { imgElement, encodedPath } = item;
    const pathParam = encodedPath || '';
    let requeued = false;

    fetch(`/api/tutorials/thumbnail?path=${pathParam}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.thumbnail) {
                imgElement.src = data.thumbnail;
            } else {
                imgElement.src = '../img/fallback-thumb.png';
                imgElement.onerror = null;
            }
        })
        .catch(error => {
            const isBusy = error.message && error.message.includes('HTTP 503');
            if (isBusy && item.attempts < 2) {
                item.attempts += 1;
                thumbnailQueue.push(item);
                requeued = true;
            } else {
                imgElement.src = '../img/fallback-thumb.png';
                imgElement.onerror = null;
            }
        })
        .finally(() => {
            if (!requeued) {
                thumbnailQueuePending.delete(encodedPath);
            }
            thumbnailQueueActive = false;
            setTimeout(processThumbnailQueue, 300);
        });
}

function enqueueThumbnailRequest(imgElement, encodedPath) {
    if (!encodedPath || thumbnailQueuePending.has(encodedPath)) return;
    thumbnailQueuePending.add(encodedPath);
    thumbnailQueue.push({ imgElement, encodedPath, attempts: 0 });
    processThumbnailQueue();
}

function handleThumbnailError(imgElement, encodedPath) {
    if (!imgElement || imgElement.dataset.thumbRetry === '1') {
        if (imgElement) {
            imgElement.src = '../img/fallback-thumb.png';
            imgElement.onerror = null;
        }
        return;
    }

    imgElement.dataset.thumbRetry = '1';
    enqueueThumbnailRequest(imgElement, encodedPath);
}

function goBack() {
    // Check if there's a referrer from courses page
    if (document.referrer.includes('courses.html')) {
        window.history.back();
    } else {
        window.location.href = '/elearning-assets/courses.html';
    }
}

// Function to update view count in UI after successful API call
function updateVideoViewCountInUI(videoId) {
    if (!videoId) return;

    console.log(`🔄 Updating UI view count for video: ${videoId}`);

    // Find the video card that matches this video ID
    const videoCards = document.querySelectorAll('.video-card');
    for (const card of videoCards) {
        // Check if this card contains the video with the matching ID
        // We can identify it by checking if the card contains buttons that call functions with this videoId
        const buttons = card.querySelectorAll('button');
        let found = false;
        for (const button of buttons) {
            const onclickAttr = button.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes(`'${videoId}'`)) {
                found = true;
                break;
            }
        }

        if (found) {
            // Found the card, now update the view count element
            const viewCountElement = card.querySelector('.view-count');
            if (viewCountElement) {
                const currentText = viewCountElement.textContent.trim();
                const currentCount = parseInt(currentText.replace(/\D/g, '')) || 0;
                const newCount = currentCount + 1;

                // Update the text (preserve the icon)
                const iconHTML = viewCountElement.querySelector('i') ? viewCountElement.querySelector('i').outerHTML : '<i class="fas fa-eye"></i>';
                viewCountElement.innerHTML = `${iconHTML} ${newCount} views`;

                console.log(`✅ Updated view count in UI: ${currentCount} → ${newCount}`);
                break;
            }
        }
    }
}

// ✅ Admin: Thumbnail Regeneration
function checkAdminAccess() {
    let parsedUser = null;
    try {
        parsedUser = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
        parsedUser = window.currentUser || null;
    }

    const role = String(parsedUser?.role || '').toLowerCase();
    hasTutorialAdminAccess =
        role.includes('admin') ||
        role.includes('administrator') ||
        role.includes('super') ||
        isAdminFromTokenPayload();

    const btn = document.getElementById('refreshThumbsBtn');
    if (btn) {
        btn.style.display = hasTutorialAdminAccess ? 'inline-block' : 'none';
    }

    updateTagEditorButtonsVisibility();
}

function regenerateThumbnails() {
    if (!confirm('Proses ini akan memakan waktu beberapa menit karena akan men-scan dan generate thumbnail untuk semua video. Lanjutkan?')) return;

    const btn = document.getElementById('refreshThumbsBtn');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Generating...';
    
    showSpinner();

    // Add auth token
    const token = localStorage.getItem('token');
    
    fetch('/api/admin/thumbnails/regenerate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
    })
    .then(async response => {
        if (response.status === 401) {
            throw new Error('Sesi admin tidak valid atau kadaluarsa. Silakan login ulang.');
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Gagal generate thumbnails');
        }
        return response.json();
    })
    .then(data => {
        alert('✅ Thumbnails berhasil digenerate!\nHalaman akan dimuat ulang untuk menampilkan perubahan.');
        window.location.reload();
    })
    .catch(err => {
        console.error('Thumbnail generation error:', err);
        alert('❌ Gagal: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = originalContent;
        hideSpinner();
    });
}
