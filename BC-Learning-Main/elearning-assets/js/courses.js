// courses.js - Script untuk halaman courses yang terintegrasi dengan tutorial API
const courseIndex = new Map();
const categoryVideoIndex = new Map();
let tutorialCache = null;
let officialLearningPathsCache = [];
let officialCertificatesCache = [];
let officialCompletedMaterialIds = new Set();
let officialYouTubePlayer = null;
const COURSE_DISPLAY_PRIORITY = new Map([
    ['revit', 10],
    ['navisworks', 20],
    ['civil-3d', 30]
]);

window.BCL_OFFICIAL_COURSE_GUIDE = true;

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
            ''
        ).trim() || null,
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

async function fetchOfficialMaterialCompletions() {
    const token = getLearningActivityAuthToken();
    if (!token) return new Set();

    try {
        const response = await fetch('/api/elearning/activity/summary', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Completion summary failed (${response.status})`);
        const data = await response.json();
        return new Set(
            (Array.isArray(data.completedModuleIds) ? data.completedModuleIds : [])
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        );
    } catch (error) {
        console.warn('Failed to load material completions:', error.message);
        return new Set();
    }
}

function getOfficialRequiredMaterials(learningPath) {
    return getOfficialPathMaterials(learningPath)
        .filter((material) => material.completionRequired === true && material.id);
}

function isOfficialMaterialComplete(material) {
    return Boolean(material?.id && officialCompletedMaterialIds.has(String(material.id)));
}

function getOfficialMaterialProgress(learningPath) {
    const required = getOfficialRequiredMaterials(learningPath);
    const completed = required.filter(isOfficialMaterialComplete);
    const buildStage = (stage) => {
        const stageRequired = required.filter((material) => getOfficialMaterialStage(material) === stage);
        const stageCompleted = stageRequired.filter(isOfficialMaterialComplete);
        return {
            required: stageRequired,
            completed: stageCompleted,
            total: stageRequired.length,
            completedCount: stageCompleted.length,
            remaining: stageRequired.filter((material) => !isOfficialMaterialComplete(material)),
            complete: stageRequired.length === 0 || stageCompleted.length === stageRequired.length
        };
    };

    return {
        required,
        completed,
        total: required.length,
        completedCount: completed.length,
        remaining: required.filter((material) => !isOfficialMaterialComplete(material)),
        complete: required.length === 0 || completed.length === required.length,
        concept: buildStage('concept'),
        demonstration: buildStage('demonstration')
    };
}

document.addEventListener("DOMContentLoaded", function () {
    setupCoursePageLearningHierarchy();
    loadOfficialLearningPaths();
    fetchCourses();
});

function setupCoursePageLearningHierarchy() {
    document.body.classList.add('course-learning-hub');
    ensureCourseHubStylesheet();
    ensureOfficialLearningPathStyles();
    ensureCoursePageOverview();
    ensureLearningGuideSection();
    ensureOfficialLearningPathSection();
    ensureResourceLibrarySection();
    applyDefaultCourseSectionState();
}

function ensureCourseHubStylesheet() {
    if (document.getElementById('courses-learning-hub-styles')) return;

    const link = document.createElement('link');
    link.id = 'courses-learning-hub-styles';
    link.rel = 'stylesheet';
    link.href = 'css/courses-learning-hub.css?v=20260908c';
    document.head.appendChild(link);
}

function ensureOfficialLearningPathStyles() {
    if (document.getElementById('official-learning-path-styles')) return;

    const style = document.createElement('style');
    style.id = 'official-learning-path-styles';
    style.textContent = `
        .official-learning-paths {
            margin-bottom: 2rem;
        }
        .learning-guide-section {
            margin-bottom: 2rem;
        }
        #pdf-section.collapsed .filter-buttons,
        #video-section.collapsed .filter-buttons {
            display: none !important;
        }
        body:has(#learning-guide-section) #bcl-training-user-guide,
        body:has(#learning-guide-section) .learning-sections-guide,
        body:has(#learning-guide-section) .pdf-role-entry {
            display: none !important;
        }
        .section-label {
            align-items: center;
            background: rgba(142, 68, 173, 0.12);
            border-radius: 999px;
            color: var(--main-color);
            display: inline-flex;
            font-size: 1.1rem;
            font-weight: 800;
            letter-spacing: .02em;
            padding: .45rem .8rem;
            text-transform: uppercase;
        }
        .section-help {
            color: #666;
            display: block;
            font-size: 1.2rem;
            font-weight: 500;
            margin-top: .25rem;
        }
        .learning-guide-panel {
            background: #fff;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 1.8rem;
        }
        .learning-guide-steps {
            display: grid;
            gap: 1rem;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .learning-guide-step {
            display: grid;
            gap: .7rem;
            grid-template-columns: 3rem 1fr;
            align-items: start;
        }
        .learning-guide-step i {
            align-items: center;
            background: rgba(13, 110, 253, 0.08);
            border-radius: 999px;
            color: #0d6efd;
            display: inline-flex;
            height: 3rem;
            justify-content: center;
            width: 3rem;
        }
        .learning-guide-step h3 {
            color: var(--black);
            font-size: 1.6rem;
            margin: 0 0 .35rem;
        }
        .learning-guide-step p {
            color: #666;
            font-size: 1.3rem;
            line-height: 1.5;
            margin: 0;
        }
        .official-paths-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.4rem;
        }
        .official-path-card {
            background: #fff;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 1.6rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .official-path-card h3 {
            color: var(--black);
            font-size: 1.8rem;
            margin: 0;
        }
        .official-path-card p,
        .official-path-step,
        .official-path-meta,
        .official-path-requirement,
        .official-path-progress-note {
            color: #666;
            font-size: 1.3rem;
            line-height: 1.5;
        }
        .official-path-meta-row,
        .official-path-actions {
            display: flex;
            flex-wrap: wrap;
            gap: .8rem;
        }
        .official-path-meta {
            border-radius: 999px;
            background: rgba(13, 110, 253, 0.08);
            color: #0d6efd;
            font-weight: 700;
            padding: .6rem 1rem;
        }
        .official-path-meta.required {
            background: #fff1f2;
            color: #be123c;
        }
        .official-path-card.is-required {
            border-color: rgba(190, 18, 60, .35);
            box-shadow: 0 8px 24px rgba(190, 18, 60, .08);
        }
        .official-path-flow {
            display: grid;
            gap: .7rem;
        }
        .official-path-modules {
            border-top: 1px solid #e0e0e0;
            display: grid;
            gap: 1.2rem;
            padding-top: 1rem;
        }
        .official-path-module {
            display: grid;
            gap: .7rem;
        }
        .official-path-module + .official-path-module {
            border-top: 1px solid #edf0f2;
            padding-top: 1.2rem;
        }
        .official-path-module-heading {
            align-items: flex-start;
            color: var(--black);
            display: grid;
            font-size: 1.35rem;
            gap: .8rem;
            grid-template-columns: 2.6rem 1fr;
            line-height: 1.45;
        }
        .official-path-module-heading > span:first-child {
            align-items: center;
            background: rgba(13, 110, 253, 0.08);
            border-radius: 999px;
            color: #0d6efd;
            display: inline-flex;
            font-size: 1.15rem;
            font-weight: 800;
            height: 2.6rem;
            justify-content: center;
            width: 2.6rem;
        }
        .official-path-module-outcome {
            color: #666;
            font-size: 1.2rem;
            line-height: 1.5;
            margin: 0 0 0 3.4rem;
        }
        .official-path-materials {
            display: grid;
            gap: .65rem;
            margin-left: 3.4rem;
        }
        .official-path-material-link {
            align-items: center;
            background: #f8f9fa;
            border: 1px solid #dfe3e7;
            border-radius: 9px;
            color: var(--black);
            display: grid;
            gap: .8rem;
            grid-template-columns: 2.5rem minmax(0, 1fr) auto;
            padding: .85rem 1rem;
            text-decoration: none;
            transition: border-color .2s ease, background-color .2s ease, transform .2s ease;
            width: 100%;
            text-align: left;
        }
        .official-path-material-link:hover,
        .official-path-material-link:focus-visible {
            background: #fff;
            border-color: var(--main-color);
            color: var(--main-color);
            transform: translateY(-1px);
        }
        .official-path-material-link > i:first-child {
            align-items: center;
            background: rgba(142, 68, 173, 0.12);
            border-radius: 999px;
            color: var(--main-color);
            display: inline-flex;
            height: 2.5rem;
            justify-content: center;
            width: 2.5rem;
        }
        .official-path-material-copy {
            display: grid;
            gap: .15rem;
            min-width: 0;
        }
        .official-path-material-type {
            color: #6b7280;
            font-size: 1.05rem;
            font-weight: 800;
            letter-spacing: .03em;
            text-transform: uppercase;
        }
        .official-path-material-title {
            font-size: 1.3rem;
            font-weight: 700;
            overflow-wrap: anywhere;
        }
        .official-path-material-link > i:last-child {
            color: #6b7280;
            font-size: 1.1rem;
        }
        .official-path-material-link.completed {
            background: #f0fdf4;
            border-color: #86efac;
        }
        .official-path-material-link.completed > i:first-child,
        .official-path-material-link.completed > i:last-child {
            color: #15803d;
        }
        .official-path-material-detail {
            color: #64748b;
            font-size: 1.05rem;
            font-weight: 600;
        }
        .official-path-material-empty {
            color: #777;
            font-size: 1.2rem;
            margin-left: 3.4rem;
        }
        .official-path-progress {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            display: grid;
            gap: .8rem;
            padding: 1rem;
        }
        .official-path-progress-header,
        .official-path-progress-metrics {
            align-items: center;
            display: flex;
            flex-wrap: wrap;
            gap: .7rem;
            justify-content: space-between;
        }
        .official-path-status {
            border-radius: 999px;
            display: inline-flex;
            font-size: 1.15rem;
            font-weight: 800;
            padding: .5rem .85rem;
            text-transform: uppercase;
        }
        .official-path-status.not-started {
            background: #eef2f7;
            color: #475569;
        }
        .official-path-status.materials-required {
            background: #fff1f2;
            color: #be123c;
        }
        .official-path-status.needs-practice {
            background: #fff4de;
            color: #9a5b00;
        }
        .official-path-status.ready {
            background: #e5f7ed;
            color: #137a3b;
        }
        .official-path-status.certified {
            background: rgba(142, 68, 173, 0.12);
            color: var(--main-color);
        }
        .official-path-progress-bar {
            background: #e9ecef;
            border-radius: 999px;
            height: .8rem;
            overflow: hidden;
        }
        .official-path-progress-fill {
            background: linear-gradient(90deg, #0d6efd, var(--main-color));
            border-radius: inherit;
            height: 100%;
            min-width: .8rem;
        }
        .official-path-progress-metric {
            color: #666;
            font-size: 1.2rem;
        }
        .official-path-progress-metric strong {
            color: var(--black);
        }
        .official-path-step {
            display: grid;
            grid-template-columns: 2.6rem 1fr;
            gap: .8rem;
            align-items: start;
        }
        .official-path-step i {
            align-items: center;
            background: rgba(142, 68, 173, 0.12);
            border-radius: 999px;
            color: var(--main-color);
            display: inline-flex;
            height: 2.6rem;
            justify-content: center;
            width: 2.6rem;
        }
        .official-path-actions .preview-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: .6rem;
        }
        .official-path-actions .preview-btn[disabled],
        .official-path-actions .preview-btn.is-locked {
            background: #e5e7eb;
            border-color: #d1d5db;
            color: #64748b;
            cursor: not-allowed;
            opacity: .85;
            transform: none;
        }
        .official-youtube-modal {
            align-items: center;
            background: rgba(15, 23, 42, .88);
            display: none;
            inset: 0;
            justify-content: center;
            padding: 2rem;
            position: fixed;
            z-index: 10050;
        }
        .official-youtube-modal.open { display: flex; }
        .official-youtube-dialog {
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 24px 70px rgba(0, 0, 0, .35);
            max-width: 1040px;
            overflow: hidden;
            width: min(100%, 1040px);
        }
        .official-youtube-header {
            align-items: flex-start;
            display: flex;
            gap: 1rem;
            justify-content: space-between;
            padding: 1.4rem 1.6rem;
        }
        .official-youtube-header h2 {
            color: var(--black);
            font-size: 1.6rem;
            margin: 0;
        }
        .official-youtube-close {
            align-items: center;
            background: #f1f5f9;
            border: 0;
            border-radius: 999px;
            color: #334155;
            display: inline-flex;
            flex: 0 0 auto;
            height: 3.6rem;
            justify-content: center;
            width: 3.6rem;
        }
        .official-youtube-frame {
            aspect-ratio: 16 / 9;
            background: #020617;
            width: 100%;
        }
        .official-youtube-frame > div,
        .official-youtube-frame iframe { height: 100%; width: 100%; }
        .official-youtube-note {
            color: #475569;
            font-size: 1.2rem;
            margin: 0;
            padding: 1.2rem 1.6rem 1.5rem;
        }
        @media (max-width: 575px) {
            .official-path-materials,
            .official-path-module-outcome,
            .official-path-material-empty {
                margin-left: 0;
            }
            .official-path-material-link {
                grid-template-columns: 2.5rem minmax(0, 1fr);
            }
            .official-path-material-link > i:last-child {
                display: none;
            }
            .official-youtube-modal { padding: .8rem; }
        }
    `;
    document.head.appendChild(style);
}

function setCourseSectionExpanded(section, expanded) {
    if (!section) return;

    const content = section.querySelector('.collapsible-content');
    section.classList.toggle('expanded', expanded);
    section.classList.toggle('collapsed', !expanded);

    if (content) {
        content.classList.toggle('expanded', expanded);
        content.style.display = expanded ? 'block' : 'none';
        content.style.padding = expanded ? '2rem' : '0';
    }
}

function getCourseDisplayName() {
    const user = getCourseCurrentUser();
    const rawName = user.fullName || user.name || user.username || user.email || 'Learner';
    return String(rawName).trim().split('@')[0] || 'Learner';
}

function ensureCoursePageOverview() {
    let section = document.getElementById('course-learning-overview');
    if (section) return section;

    const anchor = document.querySelector('.pdf-courses') || document.querySelector('.courses');
    if (!anchor || !anchor.parentNode) return null;

    section = document.createElement('section');
    section.id = 'course-learning-overview';
    section.className = 'learning-hub-overview';
    section.innerHTML = `
        <div class="learning-hub-hero">
            <div class="learning-hub-hero-copy">
                <span class="learning-hub-eyebrow">Learning Center</span>
                <h1>Jalur belajar Anda</h1>
                <p>Fokus pada course yang ditugaskan, selesaikan materi, lalu lanjutkan ke practice dan exam.</p>
                <span class="learning-hub-level"><i class="fas fa-user-graduate"></i> Memuat level...</span>
            </div>
            <div class="learning-hub-hero-action">
                <button class="learning-hub-continue" type="button" disabled>
                    <i class="fas fa-spinner fa-spin"></i> Memuat aktivitas
                </button>
            </div>
        </div>
        <div class="learning-hub-status" aria-live="polite">
            <div class="learning-hub-next">
                <span class="learning-hub-next-label">Course aktif</span>
                <strong>Menyiapkan jalur belajar...</strong>
            </div>
            <div>
                <div class="learning-hub-progress-copy"><span>Progress jalur</span><strong>0%</strong></div>
                <div class="learning-hub-progress-track" aria-hidden="true"><span style="width:0%"></span></div>
            </div>
            <button class="learning-hub-help-button" type="button" data-scroll-target="learning-guide-section">
                <i class="far fa-circle-question"></i> Cara belajar
            </button>
        </div>
    `;

    anchor.parentNode.insertBefore(section, anchor);
    section.querySelector('[data-scroll-target]')?.addEventListener('click', () => {
        document.getElementById('learning-guide-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return section;
}

function ensureLearningGuideSection() {
    let section = document.getElementById('learning-guide-section');
    if (section) return section;

    const overview = ensureCoursePageOverview();
    const anchor = overview?.nextSibling || document.querySelector('.pdf-courses') || document.querySelector('.courses');
    if (!anchor || !anchor.parentNode) return null;

    section = document.createElement('section');
    section.className = 'learning-guide-section';
    section.id = 'learning-guide-section';
    section.innerHTML = `
        <div class="learning-guide-compact">
            <i class="fas fa-compass" aria-hidden="true"></i>
            <div>
                <strong>Mulai dari course yang ditugaskan</strong>
                <p>Materi pada setiap modul sudah disusun dalam urutan yang perlu dikerjakan.</p>
            </div>
            <div class="learning-guide-steps-inline" aria-label="Urutan belajar">
                <span>Pahami konsep</span><i class="fas fa-chevron-right"></i>
                <span>Lihat penerapan</span><i class="fas fa-chevron-right"></i>
                <span>Coba sendiri</span><i class="fas fa-chevron-right"></i>
                <span>Buktikan kompetensi</span>
            </div>
        </div>
    `;

    anchor.parentNode.insertBefore(section, anchor);
    return section;
}

function ensureOfficialLearningPathSection() {
    let section = document.getElementById('official-paths-section');
    if (section) return section;

    const pdfSection = document.querySelector('.pdf-courses') || document.querySelector('.courses');
    if (!pdfSection || !pdfSection.parentNode) return null;

    section = document.createElement('section');
    section.className = 'official-learning-paths';
    section.id = 'official-paths-section';
    section.innerHTML = `
        <div class="learning-hub-section-head">
            <div>
                <span class="learning-hub-section-kicker">Prioritas Anda</span>
                <h2>Jalur belajar saya</h2>
                <p>Course wajib ditampilkan terlebih dahulu berdasarkan level akun.</p>
            </div>
        </div>
        <div id="official-paths-container">
            <div class="loading-courses" style="text-align:center; padding:2rem;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p>Memuat jalur belajar resmi...</p>
            </div>
        </div>
    `;

    pdfSection.parentNode.insertBefore(section, pdfSection);
    return section;
}

function ensureResourceLibrarySection() {
    const pdfSection = document.getElementById('pdf-section');
    const videoSection = document.getElementById('video-section');
    if (!pdfSection || !videoSection) return null;

    let section = document.getElementById('learning-resource-library');
    if (!section) {
        section = document.createElement('section');
        section.id = 'learning-resource-library';
        section.className = 'learning-resource-library';
        section.innerHTML = `
            <div class="learning-hub-section-head">
                <div>
                    <span class="learning-hub-section-kicker">Referensi pendukung</span>
                    <h2>Resource Library</h2>
                    <p>Cari PDF atau video tambahan saat modul meminta referensi pendukung.</p>
                </div>
                <div class="resource-library-tabs" aria-label="Jenis resource">
                    <button class="resource-library-tab" type="button" aria-expanded="false" aria-controls="pdf-section" data-resource-tab="pdf">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button class="resource-library-tab" type="button" aria-expanded="false" aria-controls="video-section" data-resource-tab="video">
                        <i class="fas fa-circle-play"></i> Video
                    </button>
                </div>
            </div>
            <div class="resource-library-panels"></div>
        `;
        pdfSection.parentNode.insertBefore(section, pdfSection);
    }

    const panels = section.querySelector('.resource-library-panels');
    pdfSection.classList.add('resource-panel');
    videoSection.classList.add('resource-panel');
    panels.append(pdfSection, videoSection);

    const pdfFilters = pdfSection.querySelector('.pdf-filter');
    const pdfContent = pdfSection.querySelector('.collapsible-content');
    if (pdfFilters && pdfContent && pdfFilters.parentNode !== pdfContent) pdfContent.prepend(pdfFilters);

    const videoFilters = videoSection.querySelector('.video-filter');
    const videoContent = videoSection.querySelector('.collapsible-content');
    if (videoFilters && videoContent && videoFilters.parentNode !== videoContent) videoContent.prepend(videoFilters);

    section.querySelectorAll('[data-resource-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            const nextTab = section.dataset.activeTab === button.dataset.resourceTab ? '' : button.dataset.resourceTab;
            setResourceLibraryTab(nextTab);
        });
    });
    setResourceLibraryTab('');
    return section;
}

function setResourceLibraryTab(tabName) {
    const section = document.getElementById('learning-resource-library');
    if (!section) return;

    const activeTab = tabName === 'video' || tabName === 'pdf' ? tabName : '';
    section.dataset.activeTab = activeTab;
    section.querySelectorAll('[data-resource-tab]').forEach((button) => {
        const selected = button.dataset.resourceTab === activeTab;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-expanded', String(selected));
        button.tabIndex = 0;
    });

    const pdfSection = document.getElementById('pdf-section');
    const videoSection = document.getElementById('video-section');
    if (pdfSection) pdfSection.hidden = activeTab !== 'pdf';
    if (videoSection) videoSection.hidden = activeTab !== 'video';
}

function applyDefaultCourseSectionState() {
    hideLegacyCourseGuides();
    setCourseSectionExpanded(document.getElementById('pdf-section'), true);
    setCourseSectionExpanded(document.getElementById('video-section'), true);
}

function hideLegacyCourseGuides() {
    [
        document.getElementById('bcl-training-user-guide'),
        document.querySelector('.learning-sections-guide'),
        document.querySelector('.pdf-role-entry')
    ].forEach((element) => {
        if (element) {
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
        }
    });
}

function ensureCourseReadinessScript() {
    if (window.LearningReadiness) return Promise.resolve();
    if (window.__courseReadinessScriptPromise) return window.__courseReadinessScriptPromise;

    window.__courseReadinessScriptPromise = new Promise((resolve) => {
        const existing = document.getElementById('course-learning-readiness-loader');
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => resolve(), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = 'course-learning-readiness-loader';
        script.src = 'js/learning-readiness.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.body.appendChild(script);
    });

    return window.__courseReadinessScriptPromise;
}

function getCourseCurrentUser() {
    const authUser = parseLearningJsonSafe(localStorage.getItem('user'), null);
    const localUser = parseLearningJsonSafe(localStorage.getItem('userData'), {});
    return authUser || localUser || {};
}

const COURSE_BIM_COMPETENCY_LEVELS = new Set([
    'BIM Modeller',
    'BIM Coordinator',
    'BIM Specialist',
    'BIM Manager'
]);

function normalizeCourseCompetencyLevel(value) {
    const raw = String(value || '').trim();
    return [...COURSE_BIM_COMPETENCY_LEVELS].find((level) => level.toLowerCase() === raw.toLowerCase()) || null;
}

function getCourseLearnerContext() {
    const user = getCourseCurrentUser();
    const identity = String(user.id || user.userId || user.email || user.username || user.name || '').trim();
    const token = getLearningActivityAuthToken();
    const competencyLevel = normalizeCourseCompetencyLevel(user.bimLevel || user.level || user.bim_level);
    const targetCompetencyLevel = normalizeCourseCompetencyLevel(user.targetBimLevel || user.target_bim_level);
    return {
        user,
        authenticated: Boolean(identity && token),
        isGuest: !identity || !token,
        competencyLevel,
        competencyStatus: String(user.competencyStatus || user.competency_status || (competencyLevel ? 'self_declared' : 'not_assessed')),
        targetCompetencyLevel,
        routingLevel: targetCompetencyLevel || competencyLevel
    };
}

async function refreshCourseUserProfile() {
    const token = getLearningActivityAuthToken();
    if (!token) return null;
    try {
        const response = await fetch('/api/profile', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
            cache: 'no-store'
        });
        if (!response.ok) return null;
        const profile = await response.json();
        const existing = parseLearningJsonSafe(localStorage.getItem('user'), {});
        const merged = {
            ...existing,
            ...profile,
            level: profile.bimLevel || null,
            token: existing.token || token
        };
        localStorage.setItem('user', JSON.stringify(merged));
        if (profile.bimLevel) localStorage.setItem('level', profile.bimLevel);
        else localStorage.removeItem('level');
        return merged;
    } catch (error) {
        console.warn('Failed to refresh learner profile:', error.message);
        return null;
    }
}

function getCourseUserIdentity() {
    const user = getCourseCurrentUser();
    return String(user.id || user.userId || user.email || user.username || user.name || '').trim();
}

function getCoursePracticeHistory() {
    const userData = parseLearningJsonSafe(localStorage.getItem('userData'), {});
    return Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
}

function getCourseExamHistory() {
    const history = parseLearningJsonSafe(localStorage.getItem('examHistory'), []);
    return Array.isArray(history) ? history : [];
}

async function fetchCourseCertificates() {
    const identity = getCourseUserIdentity();
    if (!identity) return [];

    try {
        const token = localStorage.getItem('token') || '';
        const response = await fetch(`/api/elearning/certificate/${encodeURIComponent(identity)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Course certificates unavailable:', error.message);
        return [];
    }
}

function normalizeCoursePracticeCategories(entry) {
    if (Array.isArray(entry.categories) && entry.categories.length) return entry.categories;
    if (entry.category) return [entry.category];
    if (entry.sourceCategory) return [entry.sourceCategory];
    return [];
}

function summarizeCoursePracticeHistory(history) {
    if (window.LearningReadiness?.summarizePracticeHistory) {
        return window.LearningReadiness.summarizePracticeHistory(history);
    }

    const summary = {};
    history.forEach((entry) => {
        normalizeCoursePracticeCategories(entry).forEach((category) => {
            if (!summary[category]) {
                summary[category] = {
                    attempts: 0,
                    totalScore: 0,
                    averageScore: 0,
                    bestScore: 0,
                    latestScore: 0
                };
            }

            const score = Number(entry.score || 0);
            summary[category].attempts += 1;
            summary[category].totalScore += score;
            summary[category].bestScore = Math.max(summary[category].bestScore, score);
            summary[category].latestScore = score;
        });
    });

    Object.values(summary).forEach((item) => {
        item.averageScore = item.attempts ? Math.round(item.totalScore / item.attempts) : 0;
    });

    return summary;
}

function getPathPracticeRequirements(learningPath) {
    return (Array.isArray(learningPath.modules) ? learningPath.modules : [])
        .map((module) => ({
            moduleId: module.id,
            moduleTitle: module.title,
            category: module.practice?.category || '',
            minimumAttempts: toNonNegativeInt(module.practice?.minimumAttempts, 0),
            minimumAverageScore: toNonNegativeInt(module.practice?.minimumAverageScore, 0)
        }))
        .filter((item) => item.category);
}

function getReadinessForPath(learningPath) {
    const dashboard = window.LearningReadiness?.getReadinessDashboard?.();
    if (!dashboard || !Array.isArray(dashboard.exams)) return null;
    return dashboard.exams.find((item) => item.examId === learningPath.exam?.id) || null;
}

function findCertificateForPath(learningPath, certificates) {
    const examId = String(learningPath.exam?.id || '').toLowerCase();
    const certificateTitle = String(learningPath.certificate?.title || '').toLowerCase();
    const examTitle = String(learningPath.exam?.title || '').toLowerCase();

    return certificates.find((certificate) => {
        const quizId = String(certificate.quizId || certificate.quiz_id || '').toLowerCase();
        const title = String(certificate.title || '').toLowerCase();
        return (examId && quizId === examId) ||
            (certificateTitle && title === certificateTitle) ||
            (examTitle && title === examTitle);
    }) || null;
}

function translateCourseReadinessRecommendation(message) {
    const text = String(message || '').trim();
    if (!text) return '';

    let match = text.match(/^Reach level (.+) to unlock this exam path\.$/i);
    if (match) return `Naik ke level ${match[1]} untuk membuka exam path ini.`;

    match = text.match(/^Complete practice in (.+)\.$/i);
    if (match) return `Selesaikan practice pada ${match[1]}.`;

    match = text.match(/^Raise average score to (\d+)% for exam readiness\.$/i);
    if (match) return `Naikkan rata-rata skor ke ${match[1]}% agar siap exam.`;

    match = text.match(/^Finish (\d+) more measured attempts\.$/i);
    if (match) return `Selesaikan ${match[1]} attempt terukur lagi.`;

    match = text.match(/^Build more attempts in (.+)\.$/i);
    if (match) return `Tambahkan attempt practice pada ${match[1]}.`;

    return text;
}

function hasExamPassedForPath(learningPath) {
    const examId = String(learningPath.exam?.id || '');
    if (!examId) return false;

    return getCourseExamHistory().some((attempt) => {
        const attemptId = String(attempt.examId || attempt.quizId || '');
        return attemptId === examId && (attempt.passed === true || Number(attempt.score || attempt.percentage || 0) >= Number(learningPath.exam?.passingScore || 0));
    });
}

function buildPathPracticeSummary(learningPath) {
    const requirements = getPathPracticeRequirements(learningPath);
    const practiceSummary = summarizeCoursePracticeHistory(getCoursePracticeHistory());

    const rows = requirements.map((requirement) => {
        const stats = practiceSummary[requirement.category] || {};
        const attempts = toNonNegativeInt(stats.attempts, 0);
        const averageScore = toNonNegativeInt(stats.averageScore, 0);

        return {
            ...requirement,
            attempts,
            averageScore,
            completed: attempts >= requirement.minimumAttempts && averageScore >= requirement.minimumAverageScore
        };
    });

    const totalRequiredAttempts = rows.reduce((sum, row) => sum + row.minimumAttempts, 0);
    const totalAttempts = rows.reduce((sum, row) => sum + row.attempts, 0);
    const averageScore = rows.length
        ? Math.round(rows.reduce((sum, row) => sum + row.averageScore, 0) / rows.length)
        : 0;
    const completedRequirements = rows.filter((row) => row.completed).length;
    const coverage = rows.length ? Math.round((completedRequirements / rows.length) * 100) : 0;

    return {
        rows,
        totalAttempts,
        totalRequiredAttempts,
        averageScore,
        completedRequirements,
        totalRequirements: rows.length,
        coverage
    };
}

function calculateOfficialPathProgress(materials, practice, examPassed) {
    const completionRatio = (stage) => stage.total > 0 ? stage.completedCount / stage.total : 1;
    const conceptRatio = completionRatio({
        total: materials.concept?.total || 0,
        completedCount: materials.concept?.completedCount || 0
    });
    const demonstrationRatio = completionRatio({
        total: materials.demonstration?.total || 0,
        completedCount: materials.demonstration?.completedCount || 0
    });
    const practiceRatio = practice.totalRequirements > 0 ? Math.min(1, practice.coverage / 100) : 1;
    const examRatio = examPassed ? 1 : 0;

    return Math.round(((conceptRatio + demonstrationRatio + practiceRatio + examRatio) / 4) * 100);
}

function buildOfficialPathProgress(learningPath, certificates) {
    const certificate = findCertificateForPath(learningPath, certificates);
    const readiness = getReadinessForPath(learningPath);
    const practice = buildPathPracticeSummary(learningPath);
    const materials = getOfficialMaterialProgress(learningPath);
    const examPassed = hasExamPassedForPath(learningPath);
    const started = materials.completedCount > 0 || practice.totalAttempts > 0 || examPassed;
    const pathProgress = calculateOfficialPathProgress(materials, practice, examPassed);

    if (certificate) {
        return {
            status: 'certified',
            label: 'Certificate earned',
            progress: 100,
            note: `Sertifikat sudah terbit: ${certificate.title || learningPath.certificate?.title || 'Sertifikat'}.`,
            readiness,
            practice,
            materials,
            certificate
        };
    }

    if (!materials.complete) {
        const remainingConcept = materials.concept?.remaining?.length || 0;
        const remainingDemonstration = materials.demonstration?.remaining?.length || 0;
        const remainingText = [
            remainingConcept ? `${remainingConcept} PDF` : '',
            remainingDemonstration ? `${remainingDemonstration} video` : ''
        ].filter(Boolean).join(' dan ');
        return {
            status: 'materials-required',
            label: `Materi ${materials.completedCount}/${materials.total}`,
            progress: pathProgress,
            note: `Selesaikan ${remainingText || `${materials.total - materials.completedCount} materi`} wajib untuk membuka practice dan exam.`,
            readiness,
            practice,
            materials,
            certificate: null
        };
    }

    if (examPassed) {
        return {
            status: 'exam-passed',
            label: 'Exam lulus',
            progress: pathProgress,
            note: 'Kompetensi sudah terbukti. Sertifikat akan ditampilkan setelah proses penerbitan selesai.',
            readiness,
            practice,
            materials,
            certificate: null
        };
    }

    if (readiness?.status === 'ready') {
        return {
            status: 'ready',
            label: 'Ready for exam',
            progress: pathProgress,
            note: 'Syarat readiness sudah cukup. Lanjutkan ke exam formal untuk membuka sertifikat.',
            readiness,
            practice,
            materials,
            certificate: null
        };
    }

    if (started || readiness?.status === 'almost-ready') {
        const missingAttempts = Math.max(0, practice.totalRequiredAttempts - practice.totalAttempts);
        return {
            status: 'needs-practice',
            label: 'Practice kurang',
            progress: pathProgress,
            note: translateCourseReadinessRecommendation(readiness?.recommendation) || `Tambahkan ${missingAttempts} attempt terukur dan capai skor minimum practice.`,
            readiness,
            practice,
            materials,
            certificate: null
        };
    }

    return {
        status: 'not-started',
        label: 'Belum mulai',
        progress: 0,
        note: 'Buka materi pertama, lalu lanjutkan ke practice agar readiness Anda dapat diukur.',
        readiness,
        practice,
        materials,
        certificate: null
    };
}

async function loadOfficialLearningPaths() {
    const section = ensureOfficialLearningPathSection();
    if (!section) return;

    const container = section.querySelector('#official-paths-container');
    if (!container) return;

    try {
        await refreshCourseUserProfile();
        const learner = getCourseLearnerContext();
        if (!learner.authenticated) {
            renderCourseAccessState(container, 'guest');
            return;
        }
        if (!learner.competencyLevel) {
            renderCourseAccessState(container, 'unassessed');
            return;
        }
        await ensureCourseReadinessScript();
        const response = await fetch('/api/elearning/modules/learning-paths');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const paths = Array.isArray(data.data) ? data.data : [];
        const [certificates, completedMaterialIds] = await Promise.all([
            fetchCourseCertificates(),
            fetchOfficialMaterialCompletions()
        ]);
        officialLearningPathsCache = paths;
        officialCertificatesCache = certificates;
        officialCompletedMaterialIds = completedMaterialIds;
        renderOfficialLearningPaths(paths, container, certificates);
    } catch (error) {
        console.warn('Failed to load official learning paths:', error.message);
        container.innerHTML = `
            <div class="error-courses">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Gagal memuat jalur belajar resmi.</p>
            </div>
        `;
    }
}

function renderCourseAccessState(container, state) {
    const overview = ensureCoursePageOverview();
    const isGuest = state === 'guest';
    const title = isGuest ? 'Masuk untuk memulai jalur belajar' : 'Mulai dari orientasi dan assessment awal';
    const detail = isGuest
        ? 'Anda tetap dapat menjelajahi katalog. Progress, assessment, dan sertifikat memerlukan akun.'
        : 'Kompetensi BIM belum dinilai. Materi umum tetap dapat dipelajari tanpa menetapkan level BIM Modeller.';
    const actionHref = isGuest
        ? `/pages/login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`
        : '/elearning-assets/profile.html';
    const actionLabel = isGuest ? 'Masuk untuk mulai belajar' : 'Lengkapi profil';

    container.innerHTML = `
        <div class="no-courses learning-access-state">
            <i class="fas ${isGuest ? 'fa-lock' : 'fa-compass'}"></i>
            <div><strong>${title}</strong><p>${detail}</p></div>
            <a class="preview-btn" href="${actionHref}">${actionLabel}</a>
        </div>
    `;

    if (!overview) return;
    overview.querySelector('.learning-hub-eyebrow').textContent = isGuest ? 'BCL · Learning Center' : `${getCourseDisplayName()} · Learning Center`;
    overview.querySelector('.learning-hub-level').innerHTML = `<i class="fas ${isGuest ? 'fa-user' : 'fa-user-graduate'}"></i> ${isGuest ? 'Mode tamu' : 'Kompetensi: Belum dinilai'}`;
    overview.querySelector('.learning-hub-hero-action').innerHTML = `<a class="preview-btn learning-hub-continue" href="${actionHref}">${actionLabel}</a>`;
    overview.querySelector('.learning-hub-next-label').textContent = isGuest ? 'Akses belajar' : 'Jalur awal';
    overview.querySelector('.learning-hub-next strong').textContent = title;
    overview.querySelector('.learning-hub-progress-copy strong').textContent = '—';
    overview.querySelector('.learning-hub-progress-track span').style.width = '0%';
}

const OFFICIAL_MATERIAL_TYPE_META = Object.freeze({
    reading: { label: 'Materi teori', action: 'Buka Materi', icon: 'fas fa-book-open' },
    theory: { label: 'Materi teori', action: 'Buka Materi', icon: 'fas fa-book-open' },
    article: { label: 'Artikel', action: 'Baca Materi', icon: 'fas fa-newspaper' },
    page: { label: 'Halaman materi', action: 'Buka Materi', icon: 'fas fa-file-lines' },
    html: { label: 'Halaman materi', action: 'Buka Materi', icon: 'fas fa-file-lines' },
    pdf: { label: 'PDF', action: 'Baca PDF', icon: 'fas fa-file-pdf' },
    video: { label: 'Video', action: 'Tonton Video', icon: 'fas fa-circle-play' },
    youtube: { label: 'Video YouTube', action: 'Tonton Video', icon: 'fab fa-youtube' },
    quiz: { label: 'Quiz', action: 'Mulai Quiz', icon: 'fas fa-clipboard-question' },
    exam: { label: 'Exam', action: 'Mulai Exam', icon: 'fas fa-clipboard-check' },
    link: { label: 'Tautan materi', action: 'Buka Materi', icon: 'fas fa-link' },
    url: { label: 'Tautan materi', action: 'Buka Materi', icon: 'fas fa-link' }
});

const OFFICIAL_LEARNING_STAGE_META = Object.freeze({
    concept: { label: 'Pahami konsep', eyebrow: '01 · PDF / Modul resmi', icon: 'fas fa-book-open' },
    demonstration: { label: 'Lihat penerapan', eyebrow: '02 · Video / YouTube', icon: 'fas fa-circle-play' },
    practice: { label: 'Coba sendiri', eyebrow: '03 · Practice', icon: 'fas fa-dumbbell' },
    exam: { label: 'Buktikan kompetensi', eyebrow: '04 · Exam', icon: 'fas fa-clipboard-check' }
});

function getOfficialMaterialStage(material) {
    const configuredStage = String(material?.stage || '').trim().toLowerCase();
    if (configuredStage === 'concept' || configuredStage === 'demonstration') return configuredStage;

    const type = String(material?.type || '').trim().toLowerCase();
    return type === 'video' || type === 'youtube' ? 'demonstration' : 'concept';
}

function getOfficialMaterialRequirement(material) {
    const configured = String(material?.requirementType || '').trim().toLowerCase();
    if (configured === 'required' || configured === 'elective' || configured === 'reference') return configured;
    return material?.completionRequired === true ? 'required' : 'reference';
}

function isOfficialMaterialAvailable(material) {
    const availability = String(material?.availability || 'available').trim().toLowerCase();
    return availability !== 'planned' && availability !== 'under-review' && availability !== 'unavailable';
}

function getOfficialMaterialRequirementLabel(material) {
    if (!isOfficialMaterialAvailable(material)) return material?.note || 'Sedang ditinjau sebelum dipublikasikan.';
    if (isOfficialMaterialComplete(material)) return 'Selesai';

    const requirementType = getOfficialMaterialRequirement(material);
    if (requirementType === 'elective') return 'Pilihan sesuai disiplin';
    if (requirementType === 'reference') return 'Referensi pendukung';
    return String(material?.type || '').toLowerCase() === 'pdf'
        ? 'Wajib · selesai setelah membaca 95% halaman'
        : 'Wajib · selesaikan sampai akhir';
}

function getOfficialMaterialTypeMeta(material) {
    const type = String(material?.type || 'material').trim().toLowerCase();
    return {
        type,
        ...(OFFICIAL_MATERIAL_TYPE_META[type] || {
            label: type && type !== 'material' ? type : 'Materi',
            action: 'Buka Materi',
            icon: 'fas fa-arrow-up-right-from-square'
        })
    };
}

function resolveOfficialMaterialSource(material) {
    const source = String(material?.source || material?.url || material?.href || '').trim();
    if (!source || /^(?:javascript|data|vbscript):/i.test(source)) return '';

    if (/^https?:\/\//i.test(source) || source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) {
        return source;
    }

    return `/${source.replace(/^\/+/, '')}`;
}

function getOfficialPathMaterials(learningPath) {
    return (Array.isArray(learningPath?.modules) ? learningPath.modules : []).flatMap((module) =>
        (Array.isArray(module.materials) ? module.materials : [])
            .map((material) => ({
                ...material,
                moduleId: module.id || '',
                moduleTitle: module.title || ''
            }))
            .filter((material) => isOfficialMaterialAvailable(material) && resolveOfficialMaterialSource(material))
    );
}

function renderOfficialMaterialLink(material, learningPath, compact = false) {
    const source = resolveOfficialMaterialSource(material);
    if (!source) return '';

    const meta = getOfficialMaterialTypeMeta(material);
    const title = String(material.title || meta.label || 'Materi pembelajaran').trim();
    const materialId = String(material.id || material.moduleId || source || title).trim();
    const completed = isOfficialMaterialComplete(material);
    const available = isOfficialMaterialAvailable(material) && Boolean(source);
    const isYouTube = meta.type === 'youtube';
    const videoId = isYouTube ? extractYouTubeVideoId(source) : '';
    const isExternal = /^https?:\/\//i.test(source) && !source.startsWith(window.location.origin);
    const externalAttributes = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    const sharedAttributes = `data-official-material-source="${sanitizeHTML(source)}"
               data-official-material-id="${sanitizeHTML(materialId)}"
               data-official-material-type="${sanitizeHTML(meta.type)}"
               data-official-material-title="${sanitizeHTML(title)}"
               data-official-module-id="${sanitizeHTML(material.moduleId || '')}"
               data-official-path-id="${sanitizeHTML(learningPath.id || '')}"`;

    if (!available) {
        return `
            <div class="official-path-material-link unavailable" aria-disabled="true">
                <i class="fas fa-hourglass-half" aria-hidden="true"></i>
                <span class="official-path-material-copy">
                    <span class="official-path-material-type">${sanitizeHTML(meta.label)} · Ditinjau</span>
                    <span class="official-path-material-title">${sanitizeHTML(title)}</span>
                    <span class="official-path-material-detail">${sanitizeHTML(getOfficialMaterialRequirementLabel(material))}</span>
                </span>
                <i class="fas fa-lock" aria-hidden="true"></i>
            </div>
        `;
    }

    if (compact) {
        if (isYouTube && videoId) {
            return `
                <button class="preview-btn official-path-primary-material${completed ? ' completed' : ''}"
                   type="button" ${sharedAttributes} data-youtube-video-id="${sanitizeHTML(videoId)}">
                    <i class="${completed ? 'fas fa-circle-check' : meta.icon}"></i> ${completed ? 'Tonton Ulang' : meta.action}
                </button>
            `;
        }
        return `
            <a class="preview-btn official-path-primary-material${completed ? ' completed' : ''}"
               href="${sanitizeHTML(source)}" ${sharedAttributes}${externalAttributes}>
                <i class="${meta.icon}"></i> ${sanitizeHTML(meta.action)}
            </a>
        `;
    }

    const inner = `
        <i class="${completed ? 'fas fa-circle-check' : meta.icon}" aria-hidden="true"></i>
        <span class="official-path-material-copy">
            <span class="official-path-material-type">${sanitizeHTML(meta.label)}</span>
            <span class="official-path-material-title">${sanitizeHTML(title)}</span>
            <span class="official-path-material-detail">${sanitizeHTML(material.duration || '')}${material.duration ? ' · ' : ''}${sanitizeHTML(getOfficialMaterialRequirementLabel(material))}</span>
        </span>
        <i class="${completed ? 'fas fa-check' : 'fas fa-arrow-up-right-from-square'}" aria-hidden="true"></i>
    `;

    if (isYouTube && videoId) {
        return `
            <button class="official-path-material-link${completed ? ' completed' : ''}"
               type="button" ${sharedAttributes} data-youtube-video-id="${sanitizeHTML(videoId)}">
                ${inner}
            </button>
        `;
    }

    return `
        <a class="official-path-material-link${completed ? ' completed' : ''}"
           href="${sanitizeHTML(source)}" ${sharedAttributes}${externalAttributes}>
            ${inner}
        </a>
    `;
}

function extractYouTubeVideoId(source) {
    const match = String(source || '').match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))([A-Za-z0-9_-]{11})/i);
    return match ? match[1] : '';
}

function ensureYouTubePlayerApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (window.__bclYouTubeApiPromise) return window.__bclYouTubeApiPromise;

    window.__bclYouTubeApiPromise = new Promise((resolve, reject) => {
        if (!document.querySelector('script[data-bcl-youtube-api]')) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.dataset.bclYoutubeApi = 'true';
            script.onerror = () => reject(new Error('YouTube Player API gagal dimuat'));
            document.head.appendChild(script);
        }

        const startedAt = Date.now();
        const waitForApi = window.setInterval(() => {
            if (window.YT?.Player) {
                window.clearInterval(waitForApi);
                resolve(window.YT);
            } else if (Date.now() - startedAt > 15000) {
                window.clearInterval(waitForApi);
                reject(new Error('YouTube Player API timeout'));
            }
        }, 100);
    });

    return window.__bclYouTubeApiPromise;
}

function ensureOfficialYouTubeModal() {
    let modal = document.getElementById('official-youtube-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'official-youtube-modal';
    modal.className = 'official-youtube-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'official-youtube-title');
    modal.innerHTML = `
        <div class="official-youtube-dialog">
            <div class="official-youtube-header">
                <h2 id="official-youtube-title">Video pembelajaran</h2>
                <button class="official-youtube-close" type="button" aria-label="Tutup video"><i class="fas fa-times"></i></button>
            </div>
            <div class="official-youtube-frame"><div id="official-youtube-player"></div></div>
            <p class="official-youtube-note" id="official-youtube-note">Video akan dicatat selesai setelah pemutaran mencapai akhir.</p>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.official-youtube-close').addEventListener('click', closeOfficialYouTubeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeOfficialYouTubeModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('open')) closeOfficialYouTubeModal();
    });
    return modal;
}

function closeOfficialYouTubeModal() {
    const modal = document.getElementById('official-youtube-modal');
    modal?.classList.remove('open');
    if (officialYouTubePlayer?.destroy) officialYouTubePlayer.destroy();
    officialYouTubePlayer = null;
    const frame = document.querySelector('.official-youtube-frame');
    if (frame) frame.innerHTML = '<div id="official-youtube-player"></div>';
}

async function completeOfficialYouTubeMaterial(material) {
    const result = await trackLearningActivity({
        moduleId: material.id,
        moduleType: 'video',
        eventType: 'completed',
        title: material.title,
        category: material.pathId,
        source: 'youtube',
        progressPercent: 100
    });
    if (!result?.success) return false;

    officialCompletedMaterialIds.add(material.id);
    rememberLearningMarker('bcl_video_completed_', material.id, {
        pathId: material.pathId,
        title: material.title,
        source: material.source,
        completedAt: new Date().toISOString()
    });
    const note = document.getElementById('official-youtube-note');
    if (note) note.textContent = 'Selesai — progres video sudah tersimpan. Anda dapat menutup pemutar atau menonton ulang.';
    const container = document.getElementById('official-paths-container');
    if (container) renderOfficialLearningPaths(officialLearningPathsCache, container, officialCertificatesCache);
    return true;
}

async function openOfficialYouTubeMaterial(trigger) {
    if (!getLearningActivityAuthToken()) {
        alert('Silakan login agar progres video wajib dapat disimpan.');
        return;
    }

    const material = {
        id: trigger.dataset.officialMaterialId,
        title: trigger.dataset.officialMaterialTitle,
        source: trigger.dataset.officialMaterialSource,
        pathId: trigger.dataset.officialPathId,
        videoId: trigger.dataset.youtubeVideoId
    };
    const modal = ensureOfficialYouTubeModal();
    modal.querySelector('#official-youtube-title').textContent = material.title;
    modal.querySelector('#official-youtube-note').textContent = isOfficialMaterialComplete(material)
        ? 'Video ini sudah selesai dan tercatat. Anda dapat menontonnya kembali.'
        : 'Video akan dicatat selesai setelah pemutaran mencapai akhir.';
    modal.classList.add('open');

    await trackLearningActivity({
        moduleId: material.id,
        moduleType: 'video',
        eventType: 'opened',
        title: material.title,
        category: material.pathId,
        source: 'youtube',
        progressPercent: 0
    });

    try {
        await ensureYouTubePlayerApi();
        officialYouTubePlayer = new window.YT.Player('official-youtube-player', {
            videoId: material.videoId,
            playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
            events: {
                onStateChange: (event) => {
                    if (event.data === window.YT.PlayerState.ENDED) {
                        completeOfficialYouTubeMaterial(material);
                    }
                }
            }
        });
    } catch (error) {
        modal.querySelector('#official-youtube-note').innerHTML = `Pemutar gagal dimuat. <a href="${sanitizeHTML(material.source)}" target="_blank" rel="noopener noreferrer">Buka video di YouTube</a>.`;
    }
}

function getOfficialModuleStageState(module, learningPath, pathProgress) {
    const materials = Array.isArray(module.materials) ? module.materials : [];
    const materialState = (stageId) => {
        const stageMaterials = materials.filter((material) => getOfficialMaterialStage(material) === stageId);
        const required = stageMaterials.filter((material) => material.completionRequired === true && isOfficialMaterialAvailable(material));
        const completed = required.filter(isOfficialMaterialComplete);
        return {
            materials: stageMaterials,
            required,
            completed,
            complete: required.length > 0 && completed.length === required.length,
            gateComplete: required.length === 0 || completed.length === required.length
        };
    };

    const concept = materialState('concept');
    const demonstration = materialState('demonstration');
    const practiceRow = pathProgress?.practice?.rows?.find((row) => row.moduleId === module.id) || null;
    const practiceAvailable = Boolean(module.practice?.category);
    const practiceComplete = practiceAvailable && Boolean(practiceRow?.completed);
    const examAvailable = Boolean(learningPath.exam?.id);
    const examComplete = examAvailable && hasExamPassedForPath(learningPath);

    return {
        concept,
        demonstration,
        practiceRow,
        practiceAvailable,
        practiceComplete,
        practiceUnlocked: concept.gateComplete && demonstration.gateComplete,
        examAvailable,
        examComplete,
        examUnlocked: pathProgress?.status === 'ready' || examComplete,
        completedStages: [concept.complete, demonstration.complete, practiceComplete, examComplete].filter(Boolean).length,
        workComplete: concept.gateComplete && demonstration.gateComplete && (!practiceAvailable || practiceComplete)
    };
}

function renderOfficialMaterialStage(stageId, stageState, module, learningPath) {
    const stageMeta = OFFICIAL_LEARNING_STAGE_META[stageId];
    const availableCount = stageState.materials.filter(isOfficialMaterialAvailable).length;
    const unavailableCount = stageState.materials.length - availableCount;
    let statusLabel = 'Belum tersedia';
    let statusClass = 'planned';

    if (stageState.required.length) {
        statusLabel = stageState.complete ? 'Selesai' : `${stageState.completed.length}/${stageState.required.length} wajib`;
        statusClass = stageState.complete ? 'complete' : 'current';
    } else if (availableCount) {
        statusLabel = 'Pilihan / referensi';
        statusClass = 'optional';
    } else if (unavailableCount) {
        statusLabel = 'Sedang ditinjau';
        statusClass = 'review';
    }

    return `
        <section class="module-learning-stage ${statusClass}" data-stage="${stageId}">
            <div class="module-learning-stage-head">
                <span class="module-learning-stage-icon"><i class="${stageMeta.icon}"></i></span>
                <div><small>${stageMeta.eyebrow}</small><h4>${stageMeta.label}</h4></div>
                <span class="module-learning-stage-status ${statusClass}">${sanitizeHTML(statusLabel)}</span>
            </div>
            <div class="module-learning-stage-content">
                ${stageState.materials.length
                    ? stageState.materials.map((material) => renderOfficialMaterialLink({ ...material, moduleId: module.id || '' }, learningPath)).join('')
                    : '<p class="module-learning-stage-empty">Konten belum tersedia dan tidak menghambat tahap berikutnya.</p>'}
            </div>
        </section>
    `;
}

function renderOfficialPracticeStage(module, learningPath, stageState) {
    const stageMeta = OFFICIAL_LEARNING_STAGE_META.practice;
    const practiceHref = `practice.html?targetExam=${encodeURIComponent(learningPath.exam?.id || '')}&view=skill-drills&category=${encodeURIComponent(module.practice?.category || '')}`;
    const row = stageState.practiceRow;
    const statusLabel = !stageState.practiceAvailable
        ? 'Belum tersedia'
        : stageState.practiceComplete ? 'Selesai' : stageState.practiceUnlocked ? 'Siap dikerjakan' : 'Terkunci';
    const statusClass = stageState.practiceComplete
        ? 'complete'
        : stageState.practiceUnlocked && stageState.practiceAvailable ? 'current' : 'planned';

    let content = '<p class="module-learning-stage-empty">Practice belum tersedia dan tidak menghambat progres materi.</p>';
    if (stageState.practiceAvailable) {
        content = `
            <div class="module-stage-action-copy">
                <strong>${sanitizeHTML(module.practice.category)}</strong>
                <span>${Number(row?.attempts || 0)}/${Number(module.practice.minimumAttempts || 0)} attempt · rata-rata ${Number(row?.averageScore || 0)}% · target ${Number(module.practice.minimumAverageScore || 0)}%</span>
            </div>
            ${stageState.practiceUnlocked
                ? `<a class="module-stage-action" href="${practiceHref}"><i class="fas fa-dumbbell"></i> ${stageState.practiceComplete ? 'Latihan ulang' : 'Mulai practice'}</a>`
                : '<button class="module-stage-action locked" type="button" disabled><i class="fas fa-lock"></i> Selesaikan PDF dan video wajib</button>'}
        `;
    }

    return `
        <section class="module-learning-stage ${statusClass}" data-stage="practice">
            <div class="module-learning-stage-head">
                <span class="module-learning-stage-icon"><i class="${stageMeta.icon}"></i></span>
                <div><small>${stageMeta.eyebrow}</small><h4>${stageMeta.label}</h4></div>
                <span class="module-learning-stage-status ${statusClass}">${sanitizeHTML(statusLabel)}</span>
            </div>
            <div class="module-learning-stage-content module-stage-action-row">${content}</div>
        </section>
    `;
}

function renderOfficialExamStage(module, learningPath, stageState) {
    const stageMeta = OFFICIAL_LEARNING_STAGE_META.exam;
    const examHref = `exams.html?targetExam=${encodeURIComponent(learningPath.exam?.id || '')}`;
    const statusLabel = !stageState.examAvailable
        ? 'Belum tersedia'
        : stageState.examComplete ? 'Lulus' : stageState.examUnlocked ? 'Siap diambil' : 'Terkunci';
    const statusClass = stageState.examComplete ? 'complete' : stageState.examUnlocked ? 'current' : 'planned';

    return `
        <section class="module-learning-stage ${statusClass}" data-stage="exam">
            <div class="module-learning-stage-head">
                <span class="module-learning-stage-icon"><i class="${stageMeta.icon}"></i></span>
                <div><small>${stageMeta.eyebrow}</small><h4>${stageMeta.label}</h4></div>
                <span class="module-learning-stage-status ${statusClass}">${sanitizeHTML(statusLabel)}</span>
            </div>
            <div class="module-learning-stage-content module-stage-action-row">
                ${stageState.examAvailable ? `
                    <div class="module-stage-action-copy">
                        <strong>${sanitizeHTML(learningPath.exam.title || 'Exam akhir jalur')}</strong>
                        <span>Kompetensi modul “${sanitizeHTML(module.title || '')}” dinilai dalam exam akhir jalur · nilai lulus ${Number(learningPath.exam.passingScore || 0)}%.</span>
                    </div>
                    ${stageState.examUnlocked
                        ? `<a class="module-stage-action" href="${examHref}"><i class="fas fa-clipboard-check"></i> ${stageState.examComplete ? 'Lihat hasil exam' : 'Ambil exam'}</a>`
                        : '<button class="module-stage-action locked" type="button" disabled><i class="fas fa-lock"></i> Selesaikan seluruh practice</button>'}
                ` : '<p class="module-learning-stage-empty">Assessment belum tersedia dan tidak menghambat progres materi.</p>'}
            </div>
        </section>
    `;
}

function renderOfficialPathModules(learningPath, options = {}) {
    const modules = Array.isArray(learningPath.modules) ? learningPath.modules : [];
    if (!modules.length) return '';

    const pathProgress = options.progress || buildOfficialPathProgress(learningPath, officialCertificatesCache);
    let firstIncompleteOpened = false;

    return `
        <div class="official-path-modules">
            ${modules.map((module, index) => {
                const stageState = getOfficialModuleStageState(module, learningPath, pathProgress);
                const shouldOpen = Boolean(options.openFirstIncomplete && !stageState.workComplete && !firstIncompleteOpened);
                if (shouldOpen) firstIncompleteOpened = true;
                return `
                    <details class="official-path-module"${shouldOpen ? ' open' : ''}>
                        <summary>
                            <span class="official-path-module-number">${stageState.completedStages === 4 ? '<i class="fas fa-check"></i>' : index + 1}</span>
                            <span class="official-path-module-title">
                                <strong>${sanitizeHTML(module.title || `Modul ${index + 1}`)}</strong>
                                <small>${stageState.workComplete ? 'Materi dan practice selesai' : 'Ikuti empat tahap secara berurutan'}</small>
                            </span>
                            <span class="official-path-module-count">${stageState.completedStages}/4 tahap</span>
                            <i class="fas fa-chevron-down official-path-module-chevron" aria-hidden="true"></i>
                        </summary>
                        <div class="official-path-module-body">
                            ${module.outcome ? `<p class="official-path-module-outcome"><strong>Target:</strong> ${sanitizeHTML(module.outcome)}</p>` : ''}
                            <div class="module-learning-sequence">
                                ${renderOfficialMaterialStage('concept', stageState.concept, module, learningPath)}
                                ${renderOfficialMaterialStage('demonstration', stageState.demonstration, module, learningPath)}
                                ${renderOfficialPracticeStage(module, learningPath, stageState)}
                                ${renderOfficialExamStage(module, learningPath, stageState)}
                            </div>
                        </div>
                    </details>
                `;
            }).join('')}
        </div>
    `;
}

function bindOfficialMaterialTracking(container) {
    container.querySelectorAll('[data-official-material-source]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const source = link.dataset.officialMaterialSource || '';
            const title = link.dataset.officialMaterialTitle || 'Materi pembelajaran';
            const type = link.dataset.officialMaterialType || 'material';
            const moduleId = link.dataset.officialMaterialId || link.dataset.officialModuleId || source || title;

            if (link.dataset.youtubeVideoId) {
                event.preventDefault();
                openOfficialYouTubeMaterial(link);
                return;
            }

            rememberLearningMarker('bcl_path_material_opened_', `${link.dataset.officialPathId || 'path'}:${moduleId}`, {
                pathId: link.dataset.officialPathId || '',
                moduleId,
                title,
                type,
                source,
                openedAt: new Date().toISOString()
            });

            trackLearningActivity({
                moduleId,
                moduleType: type,
                eventType: 'opened',
                title,
                category: link.dataset.officialPathId || '',
                source: 'official-learning-path',
                progressPercent: 0
            });
        });
    });
}

function buildOfficialPathActions(learningPath, progress) {
    const practiceHref = `practice.html?targetExam=${encodeURIComponent(learningPath.exam?.id || '')}&view=skill-drills`;
    const examHref = `exams.html?targetExam=${encodeURIComponent(learningPath.exam?.id || '')}`;
    const pathMaterials = getOfficialPathMaterials(learningPath);
    const nextMaterial = progress.materials?.remaining?.[0] || pathMaterials[0];
    const materialAction = nextMaterial ? renderOfficialMaterialLink(nextMaterial, learningPath, true) : '';
    const certificateHref = progress.certificate
        ? `certification.html?cert=${encodeURIComponent(progress.certificate.id || '')}`
        : 'certification.html';

    if (progress.status === 'certified') {
        return {
            nextTitle: 'Sertifikat sudah tersedia',
            primary: `<a class="preview-btn" href="${certificateHref}"><i class="fas fa-certificate"></i> Lihat Sertifikat</a>`,
            secondary: ''
        };
    }

    if (progress.status === 'materials-required' && materialAction) {
        return {
            nextTitle: nextMaterial?.title || 'Lanjutkan materi wajib',
            primary: materialAction,
            secondary: `<button class="preview-btn is-locked" type="button" disabled><i class="fas fa-lock"></i> Practice terkunci</button>`
        };
    }

    if (progress.status === 'ready') {
        return {
            nextTitle: learningPath.exam?.title || 'Exam akhir',
            primary: `<a class="preview-btn" href="${examHref}"><i class="fas fa-clipboard-check"></i> Ambil Exam</a>`,
            secondary: ''
        };
    }

    if (progress.status === 'exam-passed') {
        return {
            nextTitle: 'Exam sudah lulus',
            primary: `<a class="preview-btn" href="${examHref}"><i class="fas fa-circle-check"></i> Lihat Hasil Exam</a>`,
            secondary: ''
        };
    }

    return {
        nextTitle: 'Practice untuk mengukur kesiapan',
        primary: `<a class="preview-btn" href="${practiceHref}"><i class="fas fa-dumbbell"></i> Mulai Practice</a>`,
        secondary: materialAction
    };
}

function renderLearningStageFlow(learningPath, progress) {
    const conceptComplete = Boolean(progress.materials?.concept?.complete);
    const demonstrationComplete = Boolean(progress.materials?.demonstration?.complete);
    const practiceComplete = Number(progress.practice?.coverage || 0) >= 100 || ['ready', 'certified'].includes(progress.status);
    const examComplete = Boolean(progress.certificate) || hasExamPassedForPath(learningPath);
    const completed = [conceptComplete, demonstrationComplete, practiceComplete, examComplete];
    const currentIndex = completed.findIndex((value) => !value);
    const stages = [
        { label: 'Pahami konsep', detail: progress.materials?.concept?.total ? `${progress.materials.concept.completedCount}/${progress.materials.concept.total} PDF wajib` : 'Tidak ada prasyarat', icon: 'fas fa-book-open' },
        { label: 'Lihat penerapan', detail: progress.materials?.demonstration?.total ? `${progress.materials.demonstration.completedCount}/${progress.materials.demonstration.total} video wajib` : 'Tidak ada prasyarat', icon: 'fas fa-circle-play' },
        { label: 'Coba sendiri', detail: `${progress.practice?.coverage || 0}% terpenuhi`, icon: 'fas fa-dumbbell' },
        { label: 'Buktikan kompetensi', detail: examComplete ? (progress.certificate ? 'Lulus · sertifikat terbit' : 'Lulus') : 'Exam akhir', icon: 'fas fa-clipboard-check' }
    ];

    return `
        <div class="learning-stage-flow" aria-label="Tahapan jalur belajar">
            ${stages.map((stage, index) => {
                const state = completed[index] ? 'complete' : index === currentIndex ? 'current' : 'locked';
                const stateIcon = completed[index] ? 'fas fa-check' : stage.icon;
                return `
                    <div class="learning-stage ${state}"${state === 'current' ? ' aria-current="step"' : ''}>
                        <span class="learning-stage-icon"><i class="${stateIcon}"></i></span>
                        <span>${stage.label}</span>
                        <small>${sanitizeHTML(stage.detail)}</small>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderAssignedLearningPath(learningPath, certificates) {
    const progress = buildOfficialPathProgress(learningPath, certificates);
    const actions = buildOfficialPathActions(learningPath, progress);
    const isRequired = String(learningPath.requirementType || '').toLowerCase() === 'required';

    return `
        <article class="official-path-card assigned-path-card${isRequired ? ' is-required' : ''}" data-learning-path-id="${sanitizeHTML(learningPath.id)}">
            <div class="assigned-path-header">
                <div>
                    <div class="official-path-meta-row">
                        <span class="official-path-meta">${sanitizeHTML(learningPath.level || 'BIM')}</span>
                        ${isRequired ? '<span class="official-path-meta required"><i class="fas fa-asterisk"></i> Wajib</span>' : '<span class="official-path-meta">Direkomendasikan</span>'}
                        <span class="official-path-meta">${Number(learningPath.modules?.length || 0)} modul</span>
                    </div>
                    <h3>${sanitizeHTML(learningPath.title)}</h3>
                    <p>${sanitizeHTML(learningPath.description || '')}</p>
                </div>
                <div class="assigned-path-actions">
                    ${actions.primary}
                    ${actions.secondary}
                </div>
            </div>
            ${renderLearningStageFlow(learningPath, progress)}
            <div class="assigned-path-progress">
                <div class="official-path-progress">
                    <div class="official-path-progress-header">
                        <span class="official-path-status ${progress.status}">${sanitizeHTML(progress.label)}</span>
                        <span class="official-path-progress-metric"><strong>${Number(progress.progress || 0)}%</strong> siap</span>
                    </div>
                    <div class="official-path-progress-bar" aria-label="Progress ${Number(progress.progress || 0)} persen">
                        <div class="official-path-progress-fill" style="width:${Number(progress.progress || 0)}%;"></div>
                    </div>
                    <div class="official-path-progress-note">${sanitizeHTML(progress.note)}</div>
                </div>
                <div class="path-metric"><strong>${Number(progress.materials?.completedCount || 0)}/${Number(progress.materials?.total || 0)}</strong><span>materi wajib</span></div>
                <div class="path-metric"><strong>${Number(progress.practice?.totalAttempts || 0)}/${Number(progress.practice?.totalRequiredAttempts || 0)}</strong><span>practice attempt</span></div>
                <div class="path-metric"><strong>${Number(progress.practice?.averageScore || 0)}%</strong><span>rata-rata practice</span></div>
            </div>
            ${renderOfficialPathModules(learningPath, { openFirstIncomplete: true, progress })}
        </article>
    `;
}

function renderOptionalLearningPath(learningPath, certificates) {
    const progress = buildOfficialPathProgress(learningPath, certificates);
    const actions = buildOfficialPathActions(learningPath, progress);

    return `
        <details class="official-path-card optional-path-card" data-learning-path-id="${sanitizeHTML(learningPath.id)}">
            <summary class="optional-path-summary">
                <div>
                    <div class="official-path-meta-row">
                        <span class="official-path-meta">${sanitizeHTML(learningPath.level || 'BIM')}</span>
                        <span class="official-path-meta">${Number(learningPath.modules?.length || 0)} modul</span>
                    </div>
                    <h4>${sanitizeHTML(learningPath.title)}</h4>
                    <p>${sanitizeHTML(learningPath.description || '')}</p>
                </div>
                <i class="fas fa-chevron-down" aria-hidden="true"></i>
            </summary>
            <div class="optional-path-details">
                <div class="official-path-progress">
                    <div class="official-path-progress-header">
                        <span class="official-path-status ${progress.status}">${sanitizeHTML(progress.label)}</span>
                        <span class="official-path-progress-metric"><strong>${Number(progress.progress || 0)}%</strong> siap</span>
                    </div>
                    <div class="official-path-progress-bar" aria-hidden="true">
                        <div class="official-path-progress-fill" style="width:${Number(progress.progress || 0)}%;"></div>
                    </div>
                    <div class="official-path-progress-note">${sanitizeHTML(progress.note)}</div>
                </div>
                ${renderOfficialPathModules(learningPath, { progress })}
                <div class="optional-path-actions">${actions.primary}${actions.secondary}</div>
            </div>
        </details>
    `;
}

function updateCoursePageOverview(learningPath, progress) {
    const overview = ensureCoursePageOverview();
    if (!overview || !learningPath || !progress) return;

    const learner = getCourseLearnerContext();
    const level = learner.competencyLevel || 'Belum dinilai';
    const actions = buildOfficialPathActions(learningPath, progress);
    const name = getCourseDisplayName();

    overview.querySelector('.learning-hub-eyebrow').textContent = `${name} · Learning Center`;
    const target = learner.targetCompetencyLevel && learner.targetCompetencyLevel !== learner.competencyLevel
        ? ` · Target: ${learner.targetCompetencyLevel}`
        : '';
    const verified = learner.competencyStatus === 'verified'
        ? ' <i class="fas fa-circle-check" title="Verified" aria-label="Verified"></i>'
        : '';
    overview.querySelector('.learning-hub-level').innerHTML = `<i class="fas fa-user-graduate"></i> Kompetensi: ${sanitizeHTML(level)}${verified}${sanitizeHTML(target)}`;
    overview.querySelector('.learning-hub-hero-action').innerHTML = actions.primary.replace('preview-btn', 'learning-hub-continue');
    overview.querySelector('.learning-hub-next strong').textContent = learningPath.title || 'Course aktif';
    overview.querySelector('.learning-hub-progress-copy strong').textContent = `${Number(progress.progress || 0)}%`;
    overview.querySelector('.learning-hub-progress-track span').style.width = `${Number(progress.progress || 0)}%`;
    bindOfficialMaterialTracking(overview);
}

function renderOfficialLearningPaths(paths, container, certificates = []) {
    if (!paths.length) {
        container.innerHTML = `
            <div class="no-courses">
                <i class="fas fa-route"></i>
                <p>Belum ada jalur belajar resmi.</p>
            </div>
        `;
        return;
    }

    const learner = getCourseLearnerContext();
    const routingLevel = learner.routingLevel;
    if (!routingLevel) {
        renderCourseAccessState(container, learner.authenticated ? 'unassessed' : 'guest');
        return;
    }
    const normalizedCurrentLevel = routingLevel.toLowerCase();
    const sortedPaths = [...paths].sort((left, right) => {
        const priority = (item) => {
            const requiredForCurrentLevel = String(item.requirementType || '').toLowerCase() === 'required' && String(item.level || '').toLowerCase() === normalizedCurrentLevel;
            if (requiredForCurrentLevel) return 0;
            if (String(item.level || '').toLowerCase() === normalizedCurrentLevel) return 1;
            return 2;
        };
        return priority(left) - priority(right) || Number(left.order || 0) - Number(right.order || 0);
    });

    const assignedPaths = sortedPaths.filter((item) =>
        String(item.requirementType || '').toLowerCase() === 'required' &&
        String(item.level || '').toLowerCase() === normalizedCurrentLevel
    );

    const assignedIds = new Set(assignedPaths.map((item) => String(item.id || '')));
    const optionalPaths = sortedPaths.filter((item) => !assignedIds.has(String(item.id || '')));

    container.innerHTML = `
        <div class="assigned-path-list">
            ${assignedPaths.length
                ? assignedPaths.map((learningPath) => renderAssignedLearningPath(learningPath, certificates)).join('')
                : `<div class="no-courses"><i class="fas fa-route"></i><p>Belum ada jalur wajib untuk ${sanitizeHTML(routingLevel)}. Course lain tetap tersedia sebagai pilihan mandiri.</p></div>`}
        </div>
        ${optionalPaths.length ? `
            <div class="optional-paths-block">
                <div class="optional-paths-title-row">
                    <div>
                        <h3>Course lainnya</h3>
                        <p>Course rekomendasi dan jalur untuk level berikutnya.</p>
                    </div>
                    <span class="official-path-meta">${optionalPaths.length} course</span>
                </div>
                <div class="optional-paths-grid">
                    ${optionalPaths.map((learningPath) => renderOptionalLearningPath(learningPath, certificates)).join('')}
                </div>
            </div>
        ` : ''}
    `;

    bindOfficialMaterialTracking(container);
    const primaryPath = assignedPaths[0];
    if (primaryPath) updateCoursePageOverview(primaryPath, buildOfficialPathProgress(primaryPath, certificates));
    else renderCourseNoAssignmentOverview(learner);
}

function renderCourseNoAssignmentOverview(learner) {
    const overview = ensureCoursePageOverview();
    if (!overview) return;
    const level = learner.competencyLevel || 'Belum dinilai';
    const target = learner.targetCompetencyLevel ? ` · Target: ${learner.targetCompetencyLevel}` : '';
    overview.querySelector('.learning-hub-level').innerHTML = `<i class="fas fa-user-graduate"></i> Kompetensi: ${sanitizeHTML(level + target)}`;
    overview.querySelector('.learning-hub-hero-action').innerHTML = '<a class="preview-btn learning-hub-continue" href="#official-paths-section">Lihat course tersedia</a>';
    overview.querySelector('.learning-hub-next-label').textContent = 'Jalur resmi';
    overview.querySelector('.learning-hub-next strong').textContent = 'Belum ada assignment aktif';
    overview.querySelector('.learning-hub-progress-copy strong').textContent = '—';
    overview.querySelector('.learning-hub-progress-track span').style.width = '0%';
}

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
    let normalizedThumbnail = courseThumbMap[courseId] || '/img/media-thumbnail.svg';
    if (rawThumbnail) {
        if (rawThumbnail.startsWith('/img/')) {
            normalizedThumbnail = rawThumbnail;
        } else if (
            rawThumbnail.startsWith('images/') ||
            rawThumbnail.startsWith('/images/') ||
            rawThumbnail.startsWith('elearning-assets/images/') ||
            rawThumbnail.startsWith('/elearning-assets/images/')
        ) {
            normalizedThumbnail = courseThumbMap[courseId] || '/img/media-thumbnail.svg';
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
    const learner = getCourseLearnerContext();
    if (learner.isGuest) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/pages/login.html?redirect=${encodeURIComponent(returnTo)}`;
        return;
    }

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
    img1.src = video.thumbnail || '/img/media-thumbnail.svg';
    img1.alt = sanitizeHTML(video.name);
    img1.onclick = () => playVideo(resolvedPath, video.name, video.id);
    img1.onerror = () => {
        tryGenerateThumbnail(img1, rawVideoPath, '/img/media-thumbnail.svg');
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
    img2.src = video.thumbnail || '/img/media-thumbnail.svg';
    img2.alt = sanitizeHTML(video.name);
    img2.onclick = () => playVideo(resolvedPath, video.name, video.id);
    img2.onerror = () => {
        tryGenerateThumbnail(img2, rawVideoPath, '/img/media-thumbnail.svg');
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
    const thumbnail = video.thumbnail || '/img/media-thumbnail.svg';
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

function tryGenerateThumbnail(imgEl, rawPath, fallbackSrc = '/img/media-thumbnail.svg') {
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
