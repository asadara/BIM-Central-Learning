// courses.js - Script untuk halaman courses yang terintegrasi dengan tutorial API
const courseIndex = new Map();
const categoryVideoIndex = new Map();
let tutorialCache = null;
const COURSE_DISPLAY_PRIORITY = new Map([
    ['revit', 10],
    ['navisworks', 20],
    ['civil-3d', 30]
]);

function normalizeCategorySlug(value) {
    return (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function getCourseCategoryMeta(course, courseIdOverride = '') {
    const rawCategory = course && course.category && typeof course.category === 'object'
        ? (course.category.id || course.category.key || course.category.name || '')
        : (course ? (course.categoryKey || course.category || courseIdOverride || course.id || course.title || '') : '');

    const slug = normalizeCategorySlug(rawCategory) || normalizeCategorySlug(courseIdOverride) || 'general';
    const label = (course && (course.title || course.categoryKey || course.category)) || courseIdOverride || 'General';
    const icon = (course && course.icon) || detectVideoCategory(label).icon;

    return {
        slug,
        label: label.toString().trim() || 'General',
        icon
    };
}

function parseLearningJsonSafe(value, fallback) {
    try {
        if (!value) return fallback;
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function rememberLearningMarker(prefix, id, payload = {}) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return;

    const key = `${prefix}${normalizedId}`;
    const existing = parseLearningJsonSafe(localStorage.getItem(key), {});
    localStorage.setItem(key, JSON.stringify({
        ...existing,
        ...payload,
        id: normalizedId,
        updatedAt: new Date().toISOString()
    }));
}

function toNonNegativeInt(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return Math.floor(number);
}

function getLearningActivityAuthToken() {
    const directToken = localStorage.getItem('token');
    if (directToken) return directToken;

    try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.token) return user.token;
    } catch (error) {
        // ignore
    }

    return '';
}

function countCompletedLearningModules() {
    let count = 0;

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key) continue;

        if (key.startsWith('bcl_completed_') || key.startsWith('bcl_video_completed_')) {
            count += 1;
        }
    }

    return count;
}

function buildLearningProgressSnapshot() {
    const storedUser = parseLearningJsonSafe(localStorage.getItem('user'), {});
    const userData = parseLearningJsonSafe(localStorage.getItem('userData'), {});
    const userProgress = userData && typeof userData.progress === 'object' ? userData.progress : {};
    const practiceHistory = Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
    const gamificationProgress = parseLearningJsonSafe(localStorage.getItem('gamification_userProgress'), {});
    const completedModules = countCompletedLearningModules();

    return {
        coursesCompleted: Math.max(
            completedModules,
            toNonNegativeInt(userProgress.coursesCompleted, 0),
            toNonNegativeInt(userData.coursesCompleted, 0),
            toNonNegativeInt(gamificationProgress.coursesCompleted, 0),
            toNonNegativeInt(storedUser?.progress?.coursesCompleted, 0)
        ),
        practiceAttempts: Math.max(
            toNonNegativeInt(userProgress.practiceAttempts, 0),
            toNonNegativeInt(userData.practiceAttempts, 0),
            practiceHistory.length
        ),
        examsPassed: Math.max(
            toNonNegativeInt(userProgress.examsPassed, 0),
            toNonNegativeInt(userData.examsPassed, 0),
            toNonNegativeInt(gamificationProgress.examsPassed, 0),
            toNonNegativeInt(storedUser?.progress?.examsPassed, 0)
        ),
        certificatesEarned: Math.max(
            toNonNegativeInt(userProgress.certificatesEarned, 0),
            toNonNegativeInt(userData.certificatesEarned, 0),
            toNonNegativeInt(gamificationProgress.certificatesEarned, 0),
            toNonNegativeInt(storedUser?.progress?.certificatesEarned, 0)
        ),
        currentLevel: String(
            userProgress.currentLevel ||
            storedUser.level ||
            storedUser.bimLevel ||
            localStorage.getItem('level') ||
            'BIM Modeller'
        ).trim(),
        toNextLevel: toNonNegativeInt(
            userProgress.toNextLevel ?? storedUser?.progress?.toNextLevel ?? userData.toNextLevel ?? 0,
            0
        )
    };
}

function persistLearningProgressSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    const storedUser = parseLearningJsonSafe(localStorage.getItem('user'), {});
    storedUser.progress = {
        ...(storedUser.progress || {}),
        ...snapshot
    };
    storedUser.coursesCompleted = snapshot.coursesCompleted;
    localStorage.setItem('user', JSON.stringify(storedUser));

    const userData = parseLearningJsonSafe(localStorage.getItem('userData'), {});
    userData.progress = {
        ...(userData.progress || {}),
        ...snapshot
    };
    userData.coursesCompleted = snapshot.coursesCompleted;
    localStorage.setItem('userData', JSON.stringify(userData));

    const gamificationProgress = parseLearningJsonSafe(localStorage.getItem('gamification_userProgress'), {});
    gamificationProgress.coursesCompleted = snapshot.coursesCompleted;
    localStorage.setItem('gamification_userProgress', JSON.stringify(gamificationProgress));
}

async function syncLearningProgressSnapshot() {
    const token = getLearningActivityAuthToken();
    if (!token) return null;

    const snapshot = buildLearningProgressSnapshot();
    persistLearningProgressSnapshot(snapshot);

    try {
        const response = await fetch('/api/elearning/progress/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(snapshot)
        });

        if (!response.ok) {
            throw new Error(`Progress sync failed (${response.status})`);
        }

        return snapshot;
    } catch (error) {
        console.warn('Failed to sync learning progress:', error.message);
        return null;
    }
}

async function trackLearningActivity(payload) {
    const token = getLearningActivityAuthToken();
    if (!token) return null;

    try {
        const response = await fetch('/api/elearning/activity/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Activity track failed (${response.status})`);
        }

        return response.json().catch(() => null);
    } catch (error) {
        console.warn('Failed to track learning activity:', error.message);
        return null;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    fetchCourses();
});

function fetchCourses() {
    const container = document.querySelector('.courses .box-container') ||
        document.querySelector('.box-container') ||
        document.getElementById('courses-container');

    if (!container) {
        console.error('âŒ Container untuk courses tidak ditemukan');
        return;
    }

    console.log('ðŸ” Fetching courses from:', `/api/courses`);

    fetch(`/api/courses`)
        .then(response => {
            console.log('ðŸ“¡ Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(courses => {
            console.log('ðŸ“š Received courses:', courses.length, 'categories');

            if (!courses || courses.length === 0) {
                container.innerHTML = `
                    <div class="no-courses" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-graduation-cap fa-3x" style="color: #ccc; margin-bottom: 1rem;"></i>
                        <p>Tidak ada courses tersedia saat ini.</p>
                    </div>
                `;
                return;
            }

            // Bersihkan container dan generate course cards
            container.innerHTML = "";

            const sortedCourses = [...courses].sort((left, right) => {
                const leftMeta = getCourseCategoryMeta(left, normalizeCourseId(left));
                const rightMeta = getCourseCategoryMeta(right, normalizeCourseId(right));
                const leftPriority = COURSE_DISPLAY_PRIORITY.get(leftMeta.slug) ?? 1000;
                const rightPriority = COURSE_DISPLAY_PRIORITY.get(rightMeta.slug) ?? 1000;

                if (leftPriority !== rightPriority) {
                    return leftPriority - rightPriority;
                }

                return (leftMeta.label || '').localeCompare(rightMeta.label || '');
            });

            sortedCourses.forEach(course => {
                const courseId = normalizeCourseId(course);
                if (courseId) {
                    courseIndex.set(courseId, course);
                }
                const courseCard = createCourseCard(course, courseId);
                container.appendChild(courseCard);
            });

            const normalizedCourses = sortedCourses.map(course => {
                const courseId = normalizeCourseId(course);
                const categoryMeta = getCourseCategoryMeta(course, courseId);
                return {
                    id: courseId,
                    title: course.title || categoryMeta.label,
                    categorySlug: categoryMeta.slug,
                    categoryLabel: categoryMeta.label,
                    icon: categoryMeta.icon,
                    videoCount: Number(course.videoCount || 0)
                };
            });

            window.bclCourseCatalog = normalizedCourses;
            document.dispatchEvent(new CustomEvent('bcl:courses-loaded', {
                detail: {
                    courses: normalizedCourses
                }
            }));

            console.log('âœ… Courses loaded successfully');
        })
        .catch(error => {
            console.error("âŒ Gagal mengambil courses:", error);
            container.innerHTML = `
                <div class="error-courses" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="color: #e74c3c; margin-bottom: 1rem;"></i>
                    <h3>Gagal memuat courses</h3>
                    <p>Terjadi kesalahan saat mengambil daftar courses.</p>
                    <p><small>Error: ${error.message}</small></p>
                    <button class="btn" onclick="fetchCourses()" style="margin-top: 1rem;">
                        <i class="fas fa-redo"></i> Coba Lagi
                    </button>
                </div>
            `;
        });
}

// âœ… SECURITY: Sanitize HTML input to prevent XSS
function sanitizeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createCourseCard(course, courseIdOverride = '') {
    const card = document.createElement('div');
    card.className = 'box';

    const courseId = courseIdOverride || normalizeCourseId(course);
    const categoryMeta = getCourseCategoryMeta(course, courseId);
    card.setAttribute('data-category', categoryMeta.slug);

    const courseThumbMap = {
        'bim-fundamentals-101': '/img/course-1.jpg',
        'autocad-bim-201': '/img/course-2.jpg',
        'revit-modeling-301': '/img/course-3.jpg',
        'bim-collaboration-401': '/img/course-4.jpg',
        'bim-standards-501': '/img/course-5.jpg',
        'dynamo-automation-601': '/img/course-6.jpg'
    };

    const fallbackVideo = Array.isArray(course.videos) && course.videos.length > 0
        ? normalizeVideoItem(course.videos[0])
        : null;
    const rawThumbnail = course.thumbnail || (fallbackVideo ? fallbackVideo.thumbnail : '') || '';
    let normalizedThumbnail = courseThumbMap[courseId] || '/img/course-default.jpg';
    if (rawThumbnail) {
        if (rawThumbnail.startsWith('/img/')) {
            normalizedThumbnail = rawThumbnail;
        } else if (
            rawThumbnail.startsWith('images/') ||
            rawThumbnail.startsWith('/images/') ||
            rawThumbnail.startsWith('elearning-assets/images/') ||
            rawThumbnail.startsWith('/elearning-assets/images/')
        ) {
            normalizedThumbnail = courseThumbMap[courseId] || '/img/course-default.jpg';
        } else {
            normalizedThumbnail = rawThumbnail;
        }
    }


    // âœ… SECURITY: Use DOM manipulation instead of innerHTML to prevent XSS
    const tutorDiv = document.createElement('div');
    tutorDiv.className = 'tutor';

    const img1 = document.createElement('img');
    img1.src = normalizedThumbnail;
    img1.alt = sanitizeHTML(course.title);
    img1.onerror = () => {
        tryGenerateThumbnail(img1, fallbackVideo ? fallbackVideo.rawPath : '');
    };
    tutorDiv.appendChild(img1);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info';

    const titleH3 = document.createElement('h3');
    titleH3.textContent = sanitizeHTML(course.title);
    infoDiv.appendChild(titleH3);

    const span1 = document.createElement('span');
    span1.textContent = `${course.videoCount || 0} Videos`;
    infoDiv.appendChild(span1);

    tutorDiv.appendChild(infoDiv);

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';

    const img2 = document.createElement('img');
    img2.src = normalizedThumbnail;
    img2.alt = sanitizeHTML(course.title);
    img2.onerror = () => {
        tryGenerateThumbnail(img2, fallbackVideo ? fallbackVideo.rawPath : '');
    };
    thumbDiv.appendChild(img2);

    const span2 = document.createElement('span');
    span2.textContent = `${course.videoCount || 0} videos`;
    thumbDiv.appendChild(span2);

    const titleH3_2 = document.createElement('h3');
    titleH3_2.className = 'title';
    titleH3_2.textContent = sanitizeHTML(course.title);

    const descP = document.createElement('p');
    descP.className = 'description';
    descP.textContent = sanitizeHTML(course.description || 'Learn comprehensive tutorials for this category');

    const statsDiv = document.createElement('div');
    statsDiv.className = 'course-stats';

    const statSpan1 = document.createElement('span');
    const icon1 = document.createElement('i');
    icon1.className = 'fas fa-play-circle';
    statSpan1.appendChild(icon1);
    statSpan1.appendChild(document.createTextNode(` ${course.videoCount || 0} Videos`));

    const statSpan2 = document.createElement('span');
    const icon2 = document.createElement('i');
    icon2.className = 'fas fa-eye';
    statSpan2.appendChild(icon2);
    statSpan2.appendChild(document.createTextNode(` ${course.representativeVideo?.viewCount || 0} Views`));

    statsDiv.appendChild(statSpan1);
    statsDiv.appendChild(statSpan2);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'course-actions';

    const previewBtn = document.createElement('a');
    previewBtn.href = '#';
    previewBtn.className = 'preview-btn';
    previewBtn.onclick = () => previewCourse(courseId);

    const icon3 = document.createElement('i');
    icon3.className = 'fas fa-eye';
    previewBtn.appendChild(icon3);
    previewBtn.appendChild(document.createTextNode(' Preview'));

    const startBtn = document.createElement('a');
    startBtn.href = '#';
    startBtn.className = 'preview-btn';
    startBtn.onclick = () => startLearning(courseId, course.title);

    const icon4 = document.createElement('i');
    icon4.className = 'fas fa-play';
    startBtn.appendChild(icon4);
    startBtn.appendChild(document.createTextNode(' Start Learning'));

    actionsDiv.appendChild(previewBtn);
    actionsDiv.appendChild(startBtn);

    card.appendChild(tutorDiv);
    card.appendChild(thumbDiv);
    card.appendChild(titleH3_2);
    card.appendChild(descP);
    card.appendChild(statsDiv);
    card.appendChild(actionsDiv);

    return card;
}

function startLearning(categoryId, categoryTitle) {
    const course = getCourseFromCache(categoryId);
    const resolvedTitle = categoryTitle || (course ? course.title : '') || 'Video Tutorials';
    console.log('ðŸŽ“ Starting learning for category:', categoryId, categoryTitle);

    // Sembunyikan section PDF courses
    const pdfSection = document.querySelector('.pdf-courses');
    if (pdfSection) {
        pdfSection.style.display = 'none';
    }

    // Ubah judul halaman
    const pageTitle = document.querySelector('h1.heading');
    if (pageTitle) {
        pageTitle.innerHTML = `<i class="fas fa-play-circle"></i> ${resolvedTitle} - Video Tutorials`;
    }

    const introInfo = ensureCourseIntro();
    if (introInfo && introInfo.desc) {
        introInfo.desc.textContent = `Learn ${resolvedTitle} with comprehensive video tutorials. Watch and master the skills you need.`;
    }

    ensureBackToCoursesButton(introInfo ? introInfo.intro : null);

    // Fetch dan tampilkan video untuk kategori ini
    fetchFilteredVideos(categoryId, resolvedTitle, course);
}

function fetchFilteredVideos(categoryId, categoryTitle, course = null) {
    const container = document.querySelector('.courses .box-container');
    if (!container) {
        console.error('âŒ Container untuk videos tidak ditemukan');
        return;
    }

    // Tampilkan loading
    container.innerHTML = `
        <div class="loading-videos" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>Memuat video ${categoryTitle}...</p>
        </div>
    `;

    console.log('ðŸ” Fetching filtered videos for category:', categoryId);

    if (course && Array.isArray(course.videos) && course.videos.length > 0) {
        const normalizedVideos = course.videos
            .map(normalizeVideoItem)
            .filter(video => video.path);
        if (normalizedVideos.length > 0) {
            displayFilteredVideos(normalizedVideos, categoryTitle);
            return;
        }
    }

    // Gunakan data dari cache tutorials yang berisi semua video
    fetch(`/api/tutorials`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(videos => {
            console.log('ðŸ“š Received all videos for filtering:', videos.length, 'total videos');

            // Filter video berdasarkan kategori
            const filteredVideos = videos.filter(video => {
                // Bandingkan dengan category ID yang dideteksi dari nama file
                const videoCategory = detectVideoCategory(video.name || video.title || '');
                return videoCategory.id === categoryId;
            }).map(normalizeVideoItem);

            console.log('ðŸ·ï¸ Filtered videos:', filteredVideos.length, 'videos for category', categoryId);

            if (filteredVideos.length === 0) {
                container.innerHTML = `
                    <div class="no-videos" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
                        <i class="fas fa-video-slash fa-3x" style="color: #ccc; margin-bottom: 1rem;"></i>
                        <h3>No Videos Found</h3>
                        <p>Tidak ada video tutorial untuk kategori ${categoryTitle} saat ini.</p>
                        <button class="btn" onclick="location.reload()" style="margin-top: 1rem;">
                            <i class="fas fa-arrow-left"></i> Kembali ke Materi
                        </button>
                    </div>
                `;
                return;
            }

            // Tampilkan video yang sudah difilter
            displayFilteredVideos(filteredVideos, categoryTitle);
        })
        .catch(error => {
            console.error("âŒ Gagal mengambil videos:", error);
            container.innerHTML = `
                <div class="error-videos" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
                    <i class="fas fa-exclamation-triangle fa-3x" style="color: #e74c3c; margin-bottom: 1rem;"></i>
                    <h3>Gagal memuat videos</h3>
                    <p>Terjadi kesalahan saat mengambil daftar videos.</p>
                    <p><small>Error: ${error.message}</small></p>
                    <button class="btn" onclick="location.reload()" style="margin-top: 1rem;">
                        <i class="fas fa-arrow-left"></i> Kembali ke Materi
                    </button>
                </div>
            `;
        });
}

function displayFilteredVideos(videos, categoryTitle) {
    const container = document.querySelector('.courses .box-container');
    if (!container) return;

    container.innerHTML = `
        <div class="videos-header" style="grid-column: 1 / -1; margin-bottom: 1rem; text-align: center;">
            <h3><i class="fas fa-play-circle"></i> ${categoryTitle} Video Tutorials</h3>
            <p>Ditemukan ${videos.length} video tutorial</p>
        </div>
    `;

    videos.forEach(video => {
        const videoCard = createVideoCard(video);
        container.appendChild(videoCard);
    });
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'box video-card';

    const resolvedPath = resolveVideoPath(video.path);
    const rawVideoPath = video.rawPath || '';
    const sizeLabel = getVideoSizeLabel(video.size);

    // âœ… SECURITY: Use DOM manipulation instead of innerHTML to prevent XSS
    const tutorDiv = document.createElement('div');
    tutorDiv.className = 'tutor';

    const img1 = document.createElement('img');
    img1.src = video.thumbnail || '/img/default.jpg';
    img1.alt = sanitizeHTML(video.name);
    img1.onclick = () => playVideo(resolvedPath, video.name, video.id);
    img1.onerror = () => {
        tryGenerateThumbnail(img1, rawVideoPath, '/img/default.jpg');
    };
    tutorDiv.appendChild(img1);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'info';

    const titleH3 = document.createElement('h3');
    titleH3.textContent = sanitizeHTML(video.name);
    titleH3.onclick = () => playVideo(resolvedPath, video.name, video.id);
    infoDiv.appendChild(titleH3);

    const span1 = document.createElement('span');
    span1.textContent = sizeLabel;
    infoDiv.appendChild(span1);

    tutorDiv.appendChild(infoDiv);

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';

    const img2 = document.createElement('img');
    img2.src = video.thumbnail || '/img/default.jpg';
    img2.alt = sanitizeHTML(video.name);
    img2.onclick = () => playVideo(resolvedPath, video.name, video.id);
    img2.onerror = () => {
        tryGenerateThumbnail(img2, rawVideoPath, '/img/default.jpg');
    };
    thumbDiv.appendChild(img2);

    const span2 = document.createElement('span');
    span2.textContent = sizeLabel;
    thumbDiv.appendChild(span2);

    const titleH3_2 = document.createElement('h3');
    titleH3_2.className = 'title';
    titleH3_2.textContent = sanitizeHTML(video.name);
    titleH3_2.onclick = () => playVideo(resolvedPath, video.name, video.id);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'video-actions';
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '10px';
    actionsDiv.style.marginTop = '15px';

    const playBtn = document.createElement('a');
    playBtn.href = '#';
    playBtn.className = 'preview-btn';
    playBtn.onclick = () => playVideo(resolvedPath, video.name, video.id);

    const icon1 = document.createElement('i');
    icon1.className = 'fas fa-play';
    playBtn.appendChild(icon1);
    playBtn.appendChild(document.createTextNode(' Play Video'));

    const openBtn = document.createElement('a');
    openBtn.href = resolvedPath || '#';
    openBtn.className = 'preview-btn';
    openBtn.target = '_blank';
    openBtn.onclick = () => incrementVideoViewCount(video.id);

    const icon2 = document.createElement('i');
    icon2.className = 'fas fa-external-link-alt';
    openBtn.appendChild(icon2);
    openBtn.appendChild(document.createTextNode(' Open in New Tab'));

    actionsDiv.appendChild(playBtn);
    actionsDiv.appendChild(openBtn);

    card.appendChild(tutorDiv);
    card.appendChild(thumbDiv);
    card.appendChild(titleH3_2);
    card.appendChild(actionsDiv);

    return card;
}

async function incrementVideoViewCount(videoId) {
    const normalizedId = String(videoId || '').trim();
    if (!normalizedId) return;

    try {
        await fetch(`/api/tutorials/${encodeURIComponent(normalizedId)}/view`, {
            method: 'PUT'
        });
    } catch (error) {
        console.warn('Failed to increment video view count:', error.message);
    }
}

function markVideoModuleCompleted(videoId, videoName, categoryLabel) {
    const normalizedId = String(videoId || '').trim();
    if (!normalizedId) return;

    const completionKey = `bcl_video_completed_${normalizedId}`;
    const alreadyCompleted = !!localStorage.getItem(completionKey);

    if (!alreadyCompleted) {
        const completionData = {
            videoId: normalizedId,
            title: videoName || 'Video Learning',
            category: categoryLabel || '',
            completedAt: new Date().toISOString()
        };
        localStorage.setItem(completionKey, JSON.stringify(completionData));
    }

    rememberLearningMarker('bcl_video_completed_', normalizedId, {
        title: videoName || 'Video Learning',
        category: categoryLabel || '',
        completedAt: new Date().toISOString()
    });

    trackLearningActivity({
        moduleId: normalizedId,
        moduleType: 'video',
        eventType: 'completed',
        title: videoName || 'Video Learning',
        category: categoryLabel || '',
        source: 'courses',
        progressPercent: 100
    });

    syncLearningProgressSnapshot();
}

function playVideo(videoPath, videoName, videoId = '') {
    if (!videoPath) {
        alert('Video path tidak tersedia untuk video ini.');
        return;
    }
    console.log('ðŸŽ¬ Playing video:', videoName, videoPath);
    incrementVideoViewCount(videoId);
    rememberLearningMarker('bcl_video_opened_', videoId || videoPath || videoName, {
        title: videoName || 'Video Learning',
        category: detectVideoCategory(videoName || '').name || ''
    });
    trackLearningActivity({
        moduleId: String(videoId || videoPath || videoName || '').trim(),
        moduleType: 'video',
        eventType: 'opened',
        title: videoName || 'Video Learning',
        category: detectVideoCategory(videoName || '').name || '',
        source: 'courses',
        progressPercent: 0
    });

    // Buat modal untuk memutar video
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 90%;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3 style="margin-bottom: 1rem;">${videoName}</h3>
            <video controls style="width: 100%; max-height: 70vh;" preload="metadata">
                <source src="${videoPath}" type="video/mp4">
                Browser Anda tidak mendukung pemutaran video.
            </video>
            <div id="video-error" style="color: red; margin-top: 10px; display: none;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    // Tambahkan error handling untuk video
    const videoElement = modal.querySelector('video');
    const errorDiv = modal.querySelector('#video-error');
    const normalizedVideoId = String(videoId || videoPath || videoName || '').trim();
    const categoryLabel = detectVideoCategory(videoName || '').name || '';
    let completionTracked = false;

    function evaluateVideoCompletion(forceComplete = false) {
        if (completionTracked || !normalizedVideoId) return;

        const duration = Number(videoElement.duration || 0);
        if (!forceComplete && (!Number.isFinite(duration) || duration <= 0)) {
            return;
        }

        const progressPercent = forceComplete
            ? 100
            : Math.round((Number(videoElement.currentTime || 0) / duration) * 100);

        if (forceComplete || progressPercent >= 90) {
            completionTracked = true;
            markVideoModuleCompleted(normalizedVideoId, videoName, categoryLabel);
        }
    }

    videoElement.addEventListener('error', function (e) {
        console.error('âŒ Video error:', e);
        errorDiv.style.display = 'block';
        errorDiv.textContent = `Gagal memuat video: ${e.target.error ? e.target.error.message : 'Kesalahan tidak diketahui'}. Path: ${videoPath}`;
    });

    videoElement.addEventListener('loadstart', function () {
        console.log('ðŸ“¹ Video load started');
    });

    videoElement.addEventListener('loadeddata', function () {
        console.log('ðŸ“¹ Video loaded successfully');
    });

    videoElement.addEventListener('timeupdate', function () {
        evaluateVideoCompletion(false);
    });

    videoElement.addEventListener('ended', function () {
        evaluateVideoCompletion(true);
    });

    // Tutup modal saat klik di luar
    modal.onclick = function (event) {
        if (event.target === modal) {
            modal.remove();
        }
    };
}


function previewCourse(courseId) {
    const course = getCourseFromCache(courseId);
    console.log('Previewing course:', courseId);

    if (course && Array.isArray(course.videos) && course.videos.length > 0) {
        const previewVideo = normalizeVideoItem(course.videos[0]);
        if (previewVideo.path) {
            playVideo(previewVideo.path, previewVideo.name, previewVideo.id);
            return;
        }
    }

    startLearning(courseId, course ? course.title : '');
}

async function trackPdfReadOpen(materialId, materialTitle = '') {
    const token = getLearningActivityAuthToken();
    rememberLearningMarker('bcl_pdf_opened_', materialId, {
        title: materialTitle || 'Materi PDF',
        openedAt: new Date().toISOString()
    });
    if (!token) return;

    try {
        await fetch(`/api/pdf-display/read/${encodeURIComponent(materialId)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ source: 'courses' })
        });
    } catch (error) {
        console.warn('Failed to track PDF read from courses.js:', error.message);
    }

    trackLearningActivity({
        moduleId: String(materialId || '').trim(),
        moduleType: 'pdf',
        eventType: 'opened',
        title: materialTitle || 'Materi PDF',
        category: '',
        source: 'courses',
        progressPercent: 0
    });
}

function openPDFReader(materialId, materialTitle) {
    console.log('ðŸ“– Opening PDF reader for material:', materialId, materialTitle);
    trackPdfReadOpen(materialId, materialTitle);

    // Create modal for PDF reader
    const modal = document.createElement('div');
    modal.className = 'modal pdf-reader-modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content pdf-modal-content" style="width: 95%; height: 90%; max-width: none;">
            <span class="close" onclick="this.parentElement.parentElement.remove()" style="z-index: 10001;">&times;</span>
            <h3 style="margin-bottom: 1rem; color: var(--black);"><i class="fas fa-book"></i> ${materialTitle} - Materi PDF</h3>
            <iframe src="${window.location.origin}/public/reader.html?material=${encodeURIComponent(materialId)}"
                    style="width: 100%; height: calc(100% - 60px); border: none; border-radius: 8px;"
                    title="Pembaca Materi PDF">
                <p>Your browser does not support iframes.
                    <a href="${window.location.origin}/public/reader.html?material=${encodeURIComponent(materialId)}" target="_blank">Klik di sini untuk membuka pembaca PDF</a>
                </p>
            </iframe>
            <div id="pdf-error" style="color: red; margin-top: 10px; display: none;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle iframe load errors
    const iframe = modal.querySelector('iframe');
    const errorDiv = modal.querySelector('#pdf-error');

    iframe.addEventListener('error', function (e) {
        console.error('âŒ PDF iframe error:', e);
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = `
            Gagal memuat pembaca PDF.
            <a href="${window.location.origin}/public/reader.html?material=${encodeURIComponent(materialId)}" target="_blank" style="color: var(--main-color);">
                Klik di sini untuk membuka di tab baru
            </a>
        `;
    });

    iframe.addEventListener('load', function () {
        console.log('ðŸ“– PDF reader loaded successfully');
    });

    // Close modal when clicking outside
    modal.onclick = function (event) {
        if (event.target === modal) {
            modal.remove();
        }
    };
}

function backToCourses() {
    console.log('ðŸ”™ Returning to courses overview');

    // Tampilkan kembali section PDF courses
    const pdfSection = document.querySelector('.pdf-courses');
    if (pdfSection) {
        pdfSection.style.display = 'block';
    }

    // Reset judul halaman ke original
    const pageTitle = document.querySelector('h1.heading');
    if (pageTitle) {
        pageTitle.innerHTML = '<i class="fas fa-play-circle"></i> Materi Video';
    }

    // Reset deskripsi ke original
    const introInfo = ensureCourseIntro();
    if (introInfo && introInfo.desc) {
        introInfo.desc.textContent = 'Explore our comprehensive BIM software training courses. Each course category contains multiple video tutorials to help you master the software.';
    }

    // Hapus tombol back
    const backButton = document.getElementById('video-back-to-courses');
    if (backButton) {
        backButton.remove();
    }

    // Reload courses untuk menampilkan semua kategori lagi
    fetchCourses();
}

function closeCoursePreview() {
    const modal = document.getElementById('coursePreviewModal');
    if (modal) {
        const video = modal.querySelector('video');
        if (video) {
            video.pause();
            video.src = "";
        }
        modal.remove();
    }
}

// Tutup modal jika diklik di luar area konten
document.addEventListener('click', function (event) {
    const modal = document.getElementById('coursePreviewModal');
    if (modal && event.target === modal) {
        closeCoursePreview();
    }
});

// Handle ESC key untuk tutup modal
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeCoursePreview();
    }
});

// Fungsi untuk mendeteksi kategori video (sama dengan backend)
function detectVideoCategory(filename) {
    if (!filename) {
        return { id: 'general', name: 'General BIM', icon: 'fas fa-play-circle' };
    }
    const name = filename.toLowerCase();

    if (name.includes('autocad') || name.includes('acad') || name.includes('dwg')) {
        return { id: 'autocad', name: 'AutoCAD', icon: 'fas fa-drafting-compass' };
    }
    if (name.includes('revit') || name.includes('rvt') || name.includes('bim')) {
        return { id: 'revit', name: 'Revit BIM', icon: 'fas fa-building' };
    }
    if (name.includes('sketchup') || name.includes('su') || name.includes('sketch')) {
        return { id: 'sketchup', name: 'SketchUp', icon: 'fas fa-cube' };
    }
    if (name.includes('3dsmax') || name.includes('3ds max') || name.includes('max')) {
        return { id: '3dsmax', name: '3ds Max', icon: 'fas fa-shapes' };
    }
    if (name.includes('blender') || name.includes('blend')) {
        return { id: 'blender', name: 'Blender', icon: 'fas fa-palette' };
    }
    if (name.includes('lumion') || name.includes('rendering')) {
        return { id: 'lumion', name: 'Lumion', icon: 'fas fa-lightbulb' };
    }
    if (name.includes('enscape')) {
        return { id: 'enscape', name: 'Enscape', icon: 'fas fa-eye' };
    }
    if (name.includes('dynamo') || name.includes('parametric')) {
        return { id: 'dynamo', name: 'Dynamo', icon: 'fas fa-code-branch' };
    }
    if (name.includes('navisworks') || name.includes('nwd')) {
        return { id: 'navisworks', name: 'Navisworks', icon: 'fas fa-project-diagram' };
    }
    if (name.includes('civil') || name.includes('infraworks') || name.includes('civil-3d')) {
        return { id: 'civil', name: 'Civil 3D', icon: 'fas fa-road' };
    }
    if (name.includes('archicad') || name.includes('archi-cad')) {
        return { id: 'archicad', name: 'ArchiCAD', icon: 'fas fa-home' };
    }

    return { id: 'general', name: 'General BIM', icon: 'fas fa-play-circle' };
}

function normalizeCourseId(course) {
    if (!course) return '';
    if (course.id != null && course.id !== '') return course.id.toString();
    if (course.category && typeof course.category === 'object' && course.category.id) {
        return course.category.id.toString();
    }
    const title = (course.title || '').toString().trim().toLowerCase();
    return title.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getCourseFromCache(courseId) {
    if (!courseId) return null;
    return courseIndex.get(courseId.toString()) || null;
}

function resolveVideoPath(rawPath) {
    if (!rawPath) return '';
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;
    if (rawPath.startsWith('/api/video-stream/')) return rawPath;
    if (rawPath.startsWith('/videos/')) return rawPath;

    const trimmed = rawPath.replace(/^\/+/, '');
    if (trimmed.startsWith('videos/')) {
        return `/${trimmed}`;
    }

    return `/api/video-stream/${encodeURIComponent(trimmed)}`;
}

function getVideoSizeLabel(sizeValue) {
    if (sizeValue == null || sizeValue === '') return '';
    if (typeof sizeValue === 'string') return sizeValue;
    if (Number.isFinite(sizeValue)) return `${sizeValue} MB`;
    return String(sizeValue);
}

function normalizeVideoItem(video) {
    const name = video.name || video.title || 'Untitled Video';
    const thumbnail = video.thumbnail || '/img/default.jpg';
    const rawPath = video.path || video.url || video.filePath || '';
    const path = resolveVideoPath(rawPath);
    return {
        ...video,
        name,
        thumbnail,
        path,
        rawPath
    };
}

function ensureCourseIntro() {
    const videoSection = document.getElementById('video-section') || document.querySelector('.courses');
    if (!videoSection) return null;

    const content = videoSection.querySelector('.collapsible-content') || videoSection;
    let intro = content.querySelector('.course-intro');

    if (!intro) {
        intro = document.createElement('div');
        intro.className = 'course-intro';

        const desc = document.createElement('p');
        desc.textContent = 'Explore our comprehensive BIM software training courses. Each course category contains multiple video tutorials to help you master the software.';
        intro.appendChild(desc);

        const boxContainer = content.querySelector('.box-container');
        if (boxContainer) {
            content.insertBefore(intro, boxContainer);
        } else {
            content.insertBefore(intro, content.firstChild);
        }
    }

    let desc = intro.querySelector('p');
    if (!desc) {
        desc = document.createElement('p');
        desc.textContent = 'Explore our comprehensive BIM software training courses. Each course category contains multiple video tutorials to help you master the software.';
        intro.appendChild(desc);
    }

    return { intro, desc };
}

function ensureBackToCoursesButton(introElement = null) {
    const introInfo = introElement
        ? { intro: introElement, desc: introElement.querySelector('p') }
        : ensureCourseIntro();
    if (!introInfo || !introInfo.intro) return;

    if (document.getElementById('video-back-to-courses')) return;

    const backBtn = document.createElement('button');
    backBtn.id = 'video-back-to-courses';
    backBtn.type = 'button';
    backBtn.className = 'back-to-courses-btn';

    const icon = document.createElement('i');
    icon.className = 'fas fa-arrow-left';
    backBtn.appendChild(icon);
    backBtn.appendChild(document.createTextNode(' Kembali ke Materi'));

    backBtn.addEventListener('click', backToCourses);
    introInfo.intro.appendChild(backBtn);
}

function tryGenerateThumbnail(imgEl, rawPath, fallbackSrc = '/img/course-default.jpg') {
    if (!imgEl) return;

    if (imgEl.dataset.thumbTried === '1') {
        imgEl.onerror = null;
        imgEl.src = fallbackSrc;
        return;
    }

    imgEl.dataset.thumbTried = '1';

    if (!rawPath || /^https?:\/\//i.test(rawPath)) {
        imgEl.onerror = null;
        imgEl.src = fallbackSrc;
        return;
    }

    let cleanPath = rawPath;
    if (cleanPath.startsWith('/api/video-stream/')) {
        cleanPath = cleanPath.slice('/api/video-stream/'.length);
    } else if (cleanPath.startsWith('api/video-stream/')) {
        cleanPath = cleanPath.slice('api/video-stream/'.length);
    }
    cleanPath = cleanPath.replace(/^\/+/, '').replace(/\\/g, '/');

    if (!cleanPath) {
        imgEl.onerror = null;
        imgEl.src = fallbackSrc;
        return;
    }

    fetch(`/api/tutorials/thumbnail?path=${encodeURIComponent(cleanPath)}`)
        .then(response => (response.ok ? response.json() : null))
        .then(data => {
            if (data && data.thumbnail) {
                imgEl.src = data.thumbnail;
            } else {
                imgEl.src = fallbackSrc;
            }
        })
        .catch(() => {
            imgEl.src = fallbackSrc;
        });
}




