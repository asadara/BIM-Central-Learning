// Enhanced Projects Gallery JavaScript
// Version 2.0 - Improved with better error handling, performance, and UX

let historyStack = [];
let selectedYear = null;
let currentSourceFilter = null; // Track current source filter for breadcrumb navigation
let currentLevel = 'year';
let currentSwiper = null; // Track current swiper instance

// Configuration
const CONFIG = {
    defaultThumbnail: '/img/fallback-thumb.png',
    videoThumbnailSuffix: '#t=1', // For video poster frames
    swiperOptions: {
        year: {
            slidesPerView: 'auto',
            spaceBetween: 50, // Diperbesar dari 40 untuk card yang lebih besar
            centeredSlides: true,
            // ✅ ENHANCED: Better navigation settings
            navigation: {
                enabled: true,
                disabledClass: 'swiper-button-disabled'
            },
            pagination: {
                enabled: true,
                clickable: true,
                dynamicBullets: true,
                hideOnClick: false
            },
            grabCursor: true,
            touchRatio: 1.2, // Increased touch sensitivity
            resistance: true,
            resistanceRatio: 0.85,
            breakpoints: {
                320: { slidesPerView: 1, spaceBetween: 30 },
                768: { slidesPerView: 2, spaceBetween: 40 },
                1024: { slidesPerView: 2, spaceBetween: 50 }, // Diperbesar untuk card yang lebih besar
                1400: { slidesPerView: 2.5, spaceBetween: 50 } // Diperbesar untuk layar besar
            }
        },
        project: {
            slidesPerView: 'auto',
            spaceBetween: 45, // Diperbesar dari 35 untuk card yang lebih besar
            // ✅ ENHANCED: Better navigation settings
            navigation: {
                enabled: true,
                disabledClass: 'swiper-button-disabled'
            },
            pagination: {
                enabled: true,
                clickable: true,
                dynamicBullets: true,
                hideOnClick: false
            },
            grabCursor: true,
            touchRatio: 1.2, // Increased touch sensitivity
            resistance: true,
            resistanceRatio: 0.85,
            allowTouchMove: true, // Ensure touch is enabled
            breakpoints: {
                320: { slidesPerView: 1, spaceBetween: 25 },
                768: { slidesPerView: 2, spaceBetween: 35 },
                1024: { slidesPerView: 2, spaceBetween: 45 }, // Diperbesar untuk card yang lebih besar
                1400: { slidesPerView: 2.5, spaceBetween: 45 } // Diperbesar untuk layar besar
            }
        },
        media: {
            slidesPerView: 1,
            spaceBetween: 15, // Diperbesar dari 10
            keyboard: { enabled: true },
            mousewheel: { forceToAxis: true },
            // ✅ ENHANCED: Media navigation
            navigation: {
                enabled: true,
                disabledClass: 'swiper-button-disabled'
            },
            pagination: {
                enabled: true,
                type: 'fraction' // Better for media viewing
            },
            grabCursor: true
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Projects page DOM loaded, initializing...');
    initializeProjects();
    setupEventListeners();

    // Defensive guard: If page stays in loading state too long, show error
    setTimeout(() => {
        const container = document.getElementById('projectsContainer');
        if (container && container.innerHTML.includes('loading-container')) {
            console.warn('⚠️ Loading timeout - showing error UI');
            showError('Timeout memuat data', 'Halaman mengalami kesulitan memuat. Silakan refresh halaman atau coba lagi nanti.');
        }
    }, 15000); // 15 second timeout
});

// Simple swiper initialization for empty folder
function initProjectSwiper() {
    if (document.querySelectorAll('.project-card').length === 1) {
        return; // Skip if already initialized or no need for swiper
    }

    // Basic swiper for single card
    const projectCards = document.querySelectorAll('.project-card');
    if (projectCards.length === 1) {
        currentSwiper = null; // No swiper needed for single card
    }
}

// Make functions globally available
window.handleImageError = handleImageError;
window.handleImageLoad = handleImageLoad;
window.handleProjectVideoError = handleProjectVideoError;
window.handleProjectVideoLoad = handleProjectVideoLoad;
window.showProjectPreview = showProjectPreview;
window.openProjectFromPreview = openProjectFromPreview;

// ============================
// INITIALIZATION
// ============================
function initializeProjects() {
    renderYearSelection();
    updateBreadcrumb();
    updateBackButton();
}

function setupEventListeners() {
    const backButton = document.getElementById("backButton");
    if (backButton) {
        backButton.addEventListener("click", goBack);
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') goBack();
        if (e.key === 'ArrowLeft' && currentSwiper) currentSwiper.slidePrev();
        if (e.key === 'ArrowRight' && currentSwiper) currentSwiper.slideNext();
    });
}

// ============================
// UTILITY FUNCTIONS
// ============================
function showLoading(message = 'Memuat data...') {
    const container = document.getElementById('projectsContainer');
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showError(message, details = '') {
    const container = document.getElementById('projectsContainer');
    // Keterangan default
    let infoText = message;
    if (currentLevel === 'media' && historyStack.length >= 2) {
        // Ambil nama proyek dari historyStack
        const projectName = historyStack[1] || '';
        infoText = `Tidak ada media yang ditemukan untuk proyek ${projectName}`;
    }
    container.innerHTML = `
        <div class="error-container">
            <i class="fas fa-exclamation-triangle"></i>
            <h3 style="color:#888;font-weight:600;margin-top:24px;">${infoText}</h3>
            ${details ? `<small class="text-muted d-block mt-2">${details}</small>` : ''}
            ${infoText.startsWith('Tidak ada media yang ditemukan') ? '' : `<div class="mt-3"><button class="btn btn-primary" onclick="retryLastAction()"><i class="fas fa-redo me-2"></i>Coba Lagi</button></div>`}
        </div>
    `;
}

function destroyCurrentSwiper() {
    if (currentSwiper) {
        currentSwiper.destroy(true, true);
        currentSwiper = null;
    }
}

function retryLastAction() {
    if (currentLevel === 'year') {
        renderYearSelection();
    } else if (currentLevel === 'project' && selectedYear) {
        openYear(selectedYear);
    } else if (currentLevel === 'media' && historyStack.length >= 2) {
        openProject(historyStack[1]);
    }
}

function retrySourceConnect(sourceFilter) {
    console.log('🔄 Retrying connection for source:', sourceFilter);

    // Jika PC-BIM02, tampilkan pesan dan Sarankan coba manual mapping
    if (sourceFilter && sourceFilter.includes('pc-bim02')) {
        alert('🔄 Mengulang koneksi PC-BIM02...\n\n📋 Instruksi:\n1. Buka Command Prompt sebagai Administrator\n2. Jalankan: net use X: \\10.0.0.122\\PROJECT BIM 2025 /user:user nke86\n3. Jika berhasil, refresh halaman ini\n\n⚠️ Jika masih gagal, ada masalah authenticasi dengan LAN mount manager.');
    } else {
        // Untuk source lain, reload halaman project
        openYear(selectedYear, sourceFilter);
    }
}

function getVideoMimeTypeFromUrl(url = '') {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const ext = cleanUrl.split('.').pop().toLowerCase();
    const mimeTypes = {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        avi: 'video/avi',
        mkv: 'video/x-matroska'
    };
    return mimeTypes[ext] || 'video/mp4';
}

// ============================
// YEAR SELECTION
// ============================
function renderYearSelection() {
    currentLevel = 'year';
    historyStack = [];
    selectedYear = null;

    showLoading('Memuat daftar tahun...');
    destroyCurrentSwiper();

    fetch('/api/years')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.years || data.years.length === 0) {
                throw new Error('Tidak ada data tahun yang ditemukan');
            }
            // Instead of rendering years directly, render all year sections from all sources
            renderAllYearSections(data.years);
        })
        .catch(error => {
            console.error('Error fetching years:', error);
            showError('Gagal memuat daftar tahun', error.message);
        })
        .finally(() => {
            updateBreadcrumb();
            updateBackButton();
        });
}

// Render year cards in swiper slides (normal swiper for year selection)
function renderAllYearSections(years) {
    const container = document.getElementById('projectsContainer');

    // Define available sources
    const sources = [
        { id: 'local-g-drive', name: 'Local G Drive', shortName: 'Local', icon: '🏠' },
        { id: 'pc-bim02', name: 'PC-BIM02', shortName: 'PC-BIM02', icon: '🏗️' }
    ];

    // Array image local untuk konstruksi dan BIM
    const constructionImages = [
        '/img/course-1.jpg',
        '/img/course-2.jpg',
        '/img/course-3.jpg',
        '/img/course-4.jpg',
        '/img/course-5.jpg',
        '/img/course-6.jpg'
    ];

    let allCards = [];

    // Create cards for each source and year combination
    sources.forEach((source, sourceIndex) => {
        // Determine which years are available for this source
        let availableYears = [...years];

        // For PC-BIM02, only show years that have BIM prefix
        if (source.id === 'pc-bim02') {
            availableYears = ['2025', '2026']; // PC-BIM02 has PROJECT BIM 2025, PROJECT BIM 2026
        }

        availableYears.forEach((year, yearIndex) => {
            const imageIndex = (sourceIndex * years.length + yearIndex) % constructionImages.length;
            const backgroundImage = constructionImages[imageIndex];

            // Determine styling based on source
            let backgroundGradient, sourceBadge, titleText;

            if (source.id === 'local-g-drive') {
                backgroundGradient = 'linear-gradient(135deg, rgba(75, 85, 99, 0.9), rgba(55, 65, 81, 0.9))';
                sourceBadge = `<div class="source-badge local-badge">${source.icon} Local</div>`;
                titleText = `PROJECT ${year}`;
            } else if (source.id === 'pc-bim02') {
                backgroundGradient = 'linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(118, 75, 162, 0.9))';
                sourceBadge = `<div class="source-badge pcbim02-badge">${source.icon} PC-BIM02</div>`;
                titleText = `PROJECT BIM ${year}`;
            }

            allCards.push({
                year,
                sourceId: source.id,
                titleText,
                backgroundGradient,
                backgroundImage,
                sourceBadge
            });
        });
    });

    // Create swiper slides for all cards
    const swiperWrapper = allCards.map(card => `
        <div class="swiper-slide">
            <div class="year-card"
                 data-year="${card.year}"
                 data-source-id="${card.sourceId}"
                 style="background: ${card.backgroundGradient}, url('${card.backgroundImage}') center/cover; position: relative;">
                ${card.sourceBadge}
                <h3><i class="fas fa-calendar-alt me-2"></i>${card.titleText}</h3>
                <p>Click to explore projects</p>
                <div class="mt-3">
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="swiper-container year-swiper">
            <div class="swiper-wrapper">
                ${swiperWrapper}
            </div>
            <div class="swiper-button-prev"></div>
            <div class="swiper-button-next"></div>
            <div class="swiper-pagination"></div>
        </div>
        <div class="text-center mt-4">
            <p class="text-muted">
                <i class="fas fa-info-circle me-2"></i>
                Pilih tahun project untuk melihat daftar proyek yang tersedia
            </p>
        </div>
    `;

    // Initialize Swiper for year selection
    currentSwiper = new Swiper('.year-swiper', {
        ...CONFIG.swiperOptions.year,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
            dynamicBullets: true
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev'
        },
        effect: 'slide',
        grabCursor: true,
        loop: allCards.length > 3,
        on: {
            init: function () {
                console.log('✅ Year swiper initialized successfully');
            },
            slideChange: function () {
                console.log('🔄 Year swiper slide changed to:', this.activeIndex);
            }
        }
    });

    // Add click events for all year cards
    container.querySelectorAll('.year-card').forEach(card => {
        card.addEventListener('click', () => {
            const year = card.dataset.year;
            const sourceId = card.dataset.sourceId;

            console.log(`🎯 Opening year ${year} from source ${sourceId}`);

            // Open year with specific source filter
            if (sourceId === 'local-g-drive') {
                openYear(year, null); // No filter for local G drive
            } else if (sourceId === 'pc-bim02') {
                openYear(year, 'pc-bim02'); // Filter for PC-BIM02
            }
        });
    });

    console.log('✅ Year cards swiper rendered successfully');
}

// ============================
// PROJECT SELECTION
// ============================
function openYear(year, sourceFilter = null) {
    selectedYear = year;
    currentSourceFilter = sourceFilter; // Track current source filter for breadcrumb navigation
    currentLevel = 'project';
    historyStack = [year];

    showLoading(`Memuat proyek tahun ${year}...`);
    destroyCurrentSwiper();

    fetch(`/api/projects/${year}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.projects || data.projects.length === 0) {
                // Jangan tampilkan error, tapi render placeholder untuk folder kosong
                renderEmptyFolder(year, sourceFilter);
            } else {
                // Filter projects by source jika sourceFilter dikirim
                let filteredProjects = data.projects;
                if (sourceFilter) {
                    filteredProjects = data.projects.filter(project =>
                        project.sourceId === sourceFilter
                    );

                    // Jika filter tidak ada hasil dan source PC-BIM02, tampilkan informasi khusus
                    if (filteredProjects.length === 0 && sourceFilter && sourceFilter.includes('pc-bim02')) {
                        renderEmptyFolder(year, sourceFilter, filteredProjects);
                        return;
                    }
                }
                renderProjects(filteredProjects, sourceFilter);
            }
        })
        .catch(error => {
            console.error('Error fetching projects:', error);
            showError(`Gagal memuat proyek tahun ${year}`, error.message);
        })
        .finally(() => {
            updateBreadcrumb();
            updateBackButton();
        });
}

function renderEmptyFolder(year, sourceFilter, filteredProjects = []) {
    const container = document.getElementById('projectsContainer');

    // Berbeda pesan berdasarkan source filter
    let title, subtitle, description, actionText;
    let extraInfo = '';

    if (sourceFilter && sourceFilter.includes('pc-bim02')) {
        // Khusus untuk PC-BIM02 yang kosong - use neutral messages
        title = `Tahun ${year} - PC-BIM02`;
        subtitle = 'Tidak ada media untuk proyek ini';
        description = 'Proyek terdeteksi, namun belum memiliki media yang dapat ditampilkan.';
        actionText = 'Refresh';

        // No extra info needed
        extraInfo = '';
    } else {
        // Untuk kondisi normal
        title = `Tahun ${year}`;
        subtitle = 'Tidak ditemukan project';
        description = 'Belum ada project yang terdaftar untuk tahun ini';
        actionText = null;
    }

    container.innerHTML = `
        <div class="projects-sections-container">
            <div class="project-section mb-5">
                <h3 class="section-title text-center mb-4">
                    <i class="fas fa-folder-open me-2"></i>
                    ${title}
                </h3>
                <div class="project-rows-container">
                    <div class="project-card-simple empty-folder">
                        <div class="project-thumb placeholder-thumb">
                            <i class="fas fa-folder-open"></i>
                            <span>${subtitle}</span>
                        </div>
                        <div class="project-info">
                            <div class="project-name">${title}</div>
                            <div class="project-meta">
                                <i class="fas fa-info-circle me-1"></i>
                                <span>${subtitle}</span>
                            </div>
                            ${description ? `<div class="placeholder-notice">${description}</div>` : ''}
                            ${extraInfo}
                            ${actionText ? `<div class="mt-3"><button class="btn btn-primary btn-sm" onclick="retrySourceConnect('${sourceFilter}')" style="padding: 5px 15px; font-size: 0.8rem;"><i class="fas fa-sync me-1"></i>${actionText}</button></div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProjects(projects) {
    const container = document.getElementById('projectsContainer');

    console.log(`📋 Rendering ${projects.length} projects for year ${selectedYear}`);

    // Group projects by source for better organization
    const projectsBySource = projects.reduce((acc, project) => {
        const sourceKey = project.sourceId || 'unknown';
        if (!acc[sourceKey]) acc[sourceKey] = [];
        acc[sourceKey].push(project);
        return acc;
    }, {});

    let sectionsHTML = '';

    // Create sections for each source
    Object.entries(projectsBySource).forEach(([sourceId, sourceProjects]) => {
        const sourceName = sourceId === 'local-g-drive' ? 'Local G Drive' :
            sourceId === 'pc-bim02' ? 'PC-BIM02' : 'Unknown Source';
        const sourceIcon = sourceId === 'local-g-drive' ? 'fas fa-home' : 'fas fa-building';

        console.log(`📁 Rendering ${sourceProjects.length} projects from ${sourceName}`);

        // Create section header
        sectionsHTML += `
            <div class="project-section mb-5">
                <h3 class="section-title text-center mb-4">
                    <i class="${sourceIcon} me-2"></i>
                    ${sourceName} Projects - ${selectedYear}
                    <small class="text-muted">(${sourceProjects.length} projects)</small>
                </h3>
                <div class="project-rows-container">
        `;

        // Create project cards for this source
        const projectCards = sourceProjects.map(project => {
            const thumbnail = getSafeThumbnail(project);
            const isVideoThumbnail = project.thumbnailType === 'video';
            const hasPreview = Boolean(thumbnail);
            const isPlaceholder = !hasPreview;
            const placeholderText = isPlaceholder ? "Media visual belum tersedia untuk proyek ini" : "";
            const videoMimeType = isVideoThumbnail ? getVideoMimeTypeFromUrl(thumbnail) : '';
            const thumbnailMarkup = isVideoThumbnail ? `
                    <video class="project-thumb"
                           muted
                           playsinline
                           preload="metadata"
                           poster="${CONFIG.defaultThumbnail}"
                           onloadeddata="handleProjectVideoLoad(this)"
                           onerror="handleProjectVideoError(this, '${project.name}')">
                        <source src="${thumbnail}" type="${videoMimeType}">
                    </video>
                ` : `
                    <img src="${thumbnail}"
                         alt="${project.name}"
                         class="project-thumb"
                         loading="lazy"
                         onerror="handleImageError(this, '${project.name}')"
                         onload="handleImageLoad(this)" />
                `;

            return `
                <div class="project-card-simple" data-project="${project.name}" data-source="${sourceId}">
                    ${thumbnailMarkup}
                    <div class="project-info">
                        <div class="project-name">${project.name}</div>
                        ${placeholderText ? `<div class="placeholder-notice" style="font-size: 0.85rem; color: #999; font-style: italic; margin-top: 8px;">${placeholderText}</div>` : ''}
                        <div class="project-meta">
                            <i class="fas fa-images me-1"></i>
                            <span>${project.mediaCount || 0} media</span>
                        </div>
                    </div>
                    <div class="loading-overlay" style="display: flex;">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            `;
        }).join('');

        sectionsHTML += projectCards + `
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="projects-sections-container">
            ${sectionsHTML}
        </div>
        <div class="text-center mt-4">
            <p class="text-muted">
                <i class="fas fa-info-circle me-2"></i>
                Klik pada proyek untuk masuk ke folder dan melihat media yang tersedia
            </p>
        </div>
    `;

    console.log('✅ Project cards rendered by source sections - NO SWIPER');

    // Add click events for project cards (opens project folder directly)
    container.querySelectorAll('.project-card-simple').forEach(card => {
        const projectName = card.dataset.project;
        const sourceId = card.dataset.source;
        const projectData = projects.find(p => p.name === projectName);

        card.addEventListener('click', (e) => {
            console.log(`🎯 Project card clicked: ${projectName} (Source: ${sourceId})`);

            // Open project folder directly - modal preview will appear after entering folder
            openProject(projectName);
        });
    });
}

// ✅ FIXED: Enhanced thumbnail logic with better debugging and error handling
function getSafeThumbnail(project) {
    console.log(`🖼️ Getting thumbnail for project:`, {
        name: project.name,
        sourceId: project.sourceId,
        firstImage: project.firstImage ? 'YES' : 'NO',
        thumbnail: project.thumbnail ? 'YES' : 'NO'
    });

    // Priority 1: firstImage atau thumbnail dari API backend (sudah include source path)
    if (project.firstImage && project.firstImage.trim() !== '') {
        let imageUrl = project.firstImage;
        console.log(`✅ Using API-provided firstImage: ${imageUrl}`);
        return imageUrl;
    }

    if (project.thumbnail && project.thumbnail.trim() !== '') {
        let thumbUrl = project.thumbnail;
        console.log(`✅ Using API-provided thumbnail: ${thumbUrl}`);
        return thumbUrl;
    }
    // Priority 3: Use a single local placeholder to avoid wrong thumbnails
    console.warn('No thumbnail available, using default placeholder for:', project.name);
    return CONFIG.defaultThumbnail;
}

// ============================
// UTILITY FUNCTIONS FOR IMAGE HANDLING
// ============================
// Fixed image error handling - NO INFINITE LOOPS
function handleImageError(img, projectName = '') {
    console.log(`Image error for ${projectName}, current src: ${img.src}`);

    const card = img.closest('.project-card-simple');
    if (!card) {
        console.warn('No card found for failed image');
        return;
    }

    const fallbackSrc = CONFIG.defaultThumbnail;
    img.src = fallbackSrc;
    img.alt = `Thumbnail untuk ${projectName}`;
    img.onerror = null;

    const projectInfo = card.querySelector('.project-info');
    if (projectInfo && !projectInfo.querySelector('.placeholder-notice')) {
        const notice = document.createElement('div');
        notice.className = 'placeholder-notice';
        notice.style.cssText = 'font-size: 0.85rem; color: #999; font-style: italic; margin-top: 8px;';
        notice.textContent = 'Media visual belum tersedia untuk proyek ini';
        projectInfo.appendChild(notice);
    }

    const loadingOverlay = card.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function handleProjectVideoLoad(videoElement) {
    const card = videoElement.closest('.project-card-simple');
    if (!card) return;

    const loadingOverlay = card.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }

    videoElement.style.opacity = '0';
    videoElement.style.display = 'block';
    setTimeout(() => {
        videoElement.style.transition = 'opacity 0.3s ease';
        videoElement.style.opacity = '1';
    }, 50);
}

function handleProjectVideoError(videoElement, projectName = '') {
    console.log(`Video thumbnail error for ${projectName}, src: ${videoElement.currentSrc || videoElement.src}`);

    const card = videoElement.closest('.project-card-simple');
    if (!card) return;

    const fallbackImg = document.createElement('img');
    fallbackImg.src = CONFIG.defaultThumbnail;
    fallbackImg.alt = `Thumbnail untuk ${projectName}`;
    fallbackImg.className = 'project-thumb';
    fallbackImg.loading = 'lazy';
    fallbackImg.onerror = null;
    fallbackImg.onload = () => handleImageLoad(fallbackImg);

    videoElement.replaceWith(fallbackImg);

    const projectInfo = card.querySelector('.project-info');
    if (projectInfo && !projectInfo.querySelector('.placeholder-notice')) {
        const notice = document.createElement('div');
        notice.className = 'placeholder-notice';
        notice.style.cssText = 'font-size: 0.85rem; color: #999; font-style: italic; margin-top: 8px;';
        notice.textContent = 'Media visual belum tersedia untuk proyek ini';
        projectInfo.appendChild(notice);
    }

    const loadingOverlay = card.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function handleImageLoad(imgElement) {
    const card = imgElement.closest('.project-card-simple');
    if (card) {
        const loadingOverlay = card.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    imgElement.style.opacity = '0';
    setTimeout(() => {
        imgElement.style.transition = 'opacity 0.3s ease';
        imgElement.style.opacity = '1';
    }, 50);
}

function handleMediaError(mediaElement, mediaUrl, filename) {
    const card = mediaElement.closest('.media-card-simple');
    if (!card) return;

    const loadingOverlay = card.querySelector('.media-loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'media-error-state';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle fa-2x mb-2 text-warning"></i>
        <small class="text-muted">Gagal memuat</small>
    `;

    mediaElement.style.display = 'none';
    mediaElement.parentNode.insertBefore(errorDiv, mediaElement);
}

function handleMediaLoad(mediaElement) {
    const card = mediaElement.closest('.media-card-simple');
    if (!card) return;

    const loadingOverlay = card.querySelector('.media-loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }

    mediaElement.style.opacity = '0';
    mediaElement.style.display = 'block';
    setTimeout(() => {
        mediaElement.style.transition = 'opacity 0.3s ease';
        mediaElement.style.opacity = '1';
    }, 50);

    const placeholder = mediaElement.previousElementSibling;
    if (placeholder && placeholder.classList.contains('media-placeholder')) {
        placeholder.style.display = 'none';
    }
}

function normalizeMediaUrl(mediaUrl) {
    if (!mediaUrl) return '';

    if (mediaUrl.startsWith('/media/') || mediaUrl.startsWith('/files/')) {
        return mediaUrl;
    }

    if (mediaUrl.startsWith('http')) {
        try {
            const url = new URL(mediaUrl);
            if (url.host === window.location.host) {
                return url.pathname + url.search;
            }
        } catch (e) {
            return mediaUrl;
        }
        return mediaUrl;
    }

    const sourceId = currentSourceFilter && currentSourceFilter.includes('pc-bim02') ? 'pc-bim02' : 'local-g-drive';
    const basePath = sourceId === 'pc-bim02'
        ? `/files/PROJECT BIM ${selectedYear}`
        : `/files/PROJECT ${selectedYear}`;
    return `${basePath}/${mediaUrl}`.replace(/\/{2,}/g, '/');
}

function openProject(projectName) {
    currentLevel = 'media';
    historyStack[1] = projectName;

    showLoading(`Memuat media proyek ${projectName}...`);
    destroyCurrentSwiper();

    fetch(`/api/project-media/${selectedYear}/${encodeURIComponent(projectName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.media || data.media.length === 0) {
                throw new Error(`Tidak ada media yang ditemukan untuk proyek ${projectName}`);
            }
            renderMedia(data.media, projectName);
        })
        .catch(error => {
            console.error('Error fetching project media:', error);
            showError(`Gagal memuat media proyek ${projectName}`, error.message);
        })
        .finally(() => {
            updateBreadcrumb();
            updateBackButton();
        });
}

function renderMedia(mediaList, projectName) {
    const container = document.getElementById('projectsContainer');

    const mediaCards = mediaList.map((item, index) => {
        const normalizedUrl = normalizeMediaUrl(item);
        const filename = normalizedUrl.split('/').pop() || `Media ${index + 1}`;
        const ext = filename.split('.').pop().toLowerCase();
        const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);

        let mediaElement = '';
        let cardClass = 'media-card-simple';

        if (isImage) {
            mediaElement = `
                <div class="media-placeholder">
                    <i class="fas fa-image fa-2x"></i>
                    <small>Image</small>
                </div>
                <img src="${normalizedUrl}"
                     alt="Media ${index + 1} - ${projectName}"
                     class="media-thumbnail"
                     loading="lazy"
                     onerror="handleMediaError(this, '${normalizedUrl}', '${filename}')"
                     onload="handleMediaLoad(this)"
                     style="display: none; opacity: 0; transition: opacity 0.3s ease;" />
            `;
        } else if (isVideo) {
            const videoMimeType = getVideoMimeTypeFromUrl(normalizedUrl);
            mediaElement = `
                <video class="media-thumbnail"
                       muted
                       playsinline
                       preload="metadata"
                       onloadeddata="handleMediaLoad(this)"
                       onerror="handleMediaError(this, '${normalizedUrl}', '${filename}')"
                       style="opacity: 0; transition: opacity 0.3s ease;">
                    <source src="${normalizedUrl}" type="${videoMimeType}">
                </video>
            `;
        } else {
            cardClass += ' unsupported-file';
            mediaElement = `
                <div class="unsupported-file-display">
                    <i class="fas fa-file-alt fa-2x mb-2"></i>
                    <small class="filename">${filename}</small>
                    <div class="file-type-badge">.${ext}</div>
                </div>
            `;
        }

        const mediaType = isVideo ? 'video' : isImage ? 'image' : 'file';

        return `
            <div class="${cardClass}" data-media-url="${normalizedUrl}" data-media-type="${mediaType}" data-filename="${filename}" data-index="${index + 1}">
                <div class="media-loading-overlay">
                    <div class="loading-spinner"></div>
                </div>
                ${mediaElement}
                <div class="media-info">
                    <div class="media-filename">${filename}</div>
                    <div class="media-meta">
                        <span class="media-index">#${index + 1}</span>
                        <span class="media-type">${isVideo ? 'Video' : isImage ? 'Image' : 'File'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="media-section">
            <h3 class="section-title text-center mb-4">
                <i class="fas fa-images me-2"></i>
                Media Proyek: ${projectName}
                <small class="text-muted">(${mediaList.length} files)</small>
            </h3>
            <div class="media-rows-container">
                ${mediaCards}
            </div>
        </div>
        <div class="text-center mt-4">
            <p class="text-muted">
                <i class="fas fa-info-circle me-2"></i>
                Klik pada media untuk melihat dalam ukuran penuh
            </p>
        </div>
    `;

    container.querySelectorAll('.media-card-simple').forEach(card => {
        card.addEventListener('click', () => {
            const mediaUrl = card.dataset.mediaUrl;
            const mediaType = card.dataset.mediaType;
            const filename = card.dataset.filename;
            const index = card.dataset.index;
            showMediaFullView(mediaUrl, mediaType, filename, projectName, index);
        });
    });
}

function showMediaFullView(mediaUrl, mediaType, filename, projectName, index) {
    let modal = document.getElementById('mediaFullViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mediaFullViewModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"></h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div id="mediaFullViewContent" class="position-relative"></div>
                        <div class="media-info mt-3">
                            <small class="text-muted">
                                <i class="fas fa-folder me-1"></i>${projectName} •
                                <i class="fas fa-${mediaType === 'video' ? 'video' : 'image'} me-1"></i>${mediaType} •
                                <i class="fas fa-hashtag me-1"></i>${index || 'N/A'}
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times me-2"></i>Tutup
                        </button>
                        <button type="button" class="btn btn-outline-primary" id="downloadMediaBtn">
                            <i class="fas fa-download me-2"></i>Download
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const contentDiv = modal.querySelector('#mediaFullViewContent');
    const downloadBtn = modal.querySelector('#downloadMediaBtn');
    modal.querySelector('.modal-title').textContent = filename;

    contentDiv.innerHTML = '';

    if (mediaType === 'video') {
        const videoElement = document.createElement('video');
        videoElement.className = 'media-full-view';
        videoElement.controls = true;
        videoElement.preload = 'metadata';
        videoElement.style.maxHeight = '70vh';
        videoElement.style.width = 'auto';
        const sourceElement = document.createElement('source');
        sourceElement.src = mediaUrl;
        sourceElement.type = getVideoMimeTypeFromUrl(mediaUrl);
        videoElement.appendChild(sourceElement);
        videoElement.innerHTML += 'Browser tidak mendukung pemutaran video.';
        contentDiv.appendChild(videoElement);
    } else if (mediaType === 'image') {
        const imgElement = document.createElement('img');
        imgElement.src = mediaUrl;
        imgElement.alt = filename;
        imgElement.className = 'media-full-view img-fluid';
        imgElement.style.maxHeight = '70vh';
        contentDiv.appendChild(imgElement);
    } else {
        contentDiv.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-file-alt me-2"></i>
                Tipe file tidak didukung: ${filename}
            </div>
        `;
    }

    if (downloadBtn) {
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = mediaUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }

    const bsModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: true,
        focus: true
    });
    bsModal.show();
}

function goBack() {
    if (historyStack.length === 0) return;

    destroyCurrentSwiper();

    if (currentLevel === 'media') {
        currentLevel = 'project';
        historyStack.pop();
        openYear(historyStack[0], currentSourceFilter);
    } else if (currentLevel === 'project') {
        currentLevel = 'year';
        historyStack = [];
        selectedYear = null;
        renderYearSelection();
    }

    updateBreadcrumb();
    updateBackButton();
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    breadcrumb.innerHTML = '';

    const homeItem = createBreadcrumbItem('Portfolio Proyek', () => {
        renderYearSelection();
        currentSourceFilter = null;
    });
    breadcrumb.appendChild(homeItem);

    if (historyStack.length > 0) {
        breadcrumb.appendChild(createBreadcrumbSeparator());
        const yearItem = createBreadcrumbItem(`Tahun ${historyStack[0]}`, () => openYear(historyStack[0], currentSourceFilter));
        breadcrumb.appendChild(yearItem);
    }

    if (historyStack.length > 1) {
        breadcrumb.appendChild(createBreadcrumbSeparator());
        const projectItem = createBreadcrumbItem(historyStack[1], null, true);
        breadcrumb.appendChild(projectItem);
    }
}

function createBreadcrumbItem(text, clickHandler = null, isCurrent = false) {
    const item = document.createElement(clickHandler ? 'a' : 'span');
    item.textContent = text;
    item.className = `breadcrumb-item ${isCurrent ? 'current' : ''}`;

    if (clickHandler) {
        item.href = '#';
        item.addEventListener('click', (e) => {
            e.preventDefault();
            clickHandler();
        });
    }

    return item;
}

function createBreadcrumbSeparator() {
    const separator = document.createElement('span');
    separator.innerHTML = ' <i class="fas fa-chevron-right mx-2"></i> ';
    separator.className = 'breadcrumb-separator text-muted';
    return separator;
}

function updateBackButton() {
    const backButton = document.getElementById('backButton');
    if (!backButton) return;

    const shouldShow = historyStack.length > 0;
    backButton.style.display = shouldShow ? 'inline-block' : 'none';

    if (shouldShow) {
        let backText = '<i class="fas fa-arrow-left me-2"></i>';
        if (currentLevel === 'media') {
            backText += 'Kembali ke Daftar Proyek';
        } else if (currentLevel === 'project') {
            backText += 'Kembali ke Daftar Tahun';
        } else {
            backText += 'Kembali';
        }
        backButton.innerHTML = backText;
    }
}

function showProjectPreview(projectName, thumbnailUrl) {
    openProject(projectName);
}

function openProjectFromPreview(projectName) {
    openProject(projectName);
}

