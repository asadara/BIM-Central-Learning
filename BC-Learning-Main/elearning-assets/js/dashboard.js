// Dashboard functionality
const dashboardState = {
    progress: null,
    quizStats: null,
    certificates: [],
    history: [],
    weeklyChart: null,
    categoriesChart: null
};

document.addEventListener('DOMContentLoaded', async function () {
    await loadEnhancedSystems();
    loadUserData();
    await loadProgressStats();
    loadEnhancedCourses();
});

function getAuthToken() {
    return localStorage.getItem('token') || '';
}

function getUserData() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

function saveUserData(userData) {
    if (!userData || typeof userData !== 'object') return;
    localStorage.setItem('user', JSON.stringify(userData));
}

function getUserIdentity(userData) {
    if (!userData) return '';
    return String(
        userData.id ||
        userData.userId ||
        userData.email ||
        userData.username ||
        userData.name ||
        ''
    ).trim();
}

function authFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
        ...options,
        headers
    });
}

// Load enhanced learning systems
function loadEnhancedSystems() {
    return new Promise((resolve) => {
        const scripts = [
            'enhanced-learning-paths.js',
            'enhanced-practice-questions.js',
            'enhanced-exam-database.js'
        ];

        let loadedCount = 0;

        scripts.forEach((script) => {
            const scriptElement = document.createElement('script');
            scriptElement.src = script;
            scriptElement.onload = () => {
                loadedCount += 1;
                if (loadedCount === scripts.length) {
                    resolve();
                }
            };
            scriptElement.onerror = () => {
                console.warn(`Could not load ${script}, using fallback data`);
                loadedCount += 1;
                if (loadedCount === scripts.length) {
                    resolve();
                }
            };
            document.head.appendChild(scriptElement);
        });
    });
}

function loadUserData() {
    const userData = getUserData();
    if (!userData) return;

    const level = userData.level || userData.bimLevel || 'BIM Modeller';
    const levelElement = document.getElementById('dashboard-user-level');
    if (levelElement) {
        levelElement.textContent = level;
    }

    updateLevelProgress(userData, null);
}

function updateLevelProgress(userData, progressData) {
    const level =
        (progressData && progressData.currentLevel) ||
        userData?.level ||
        userData?.bimLevel ||
        'BIM Modeller';

    const progressFill = document.getElementById('level-progress-fill');
    const progressText = document.getElementById('level-progress-text');

    if (!progressFill || !progressText) return;

    let percent = Number(progressData?.toNextLevel ?? NaN);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        switch (level) {
            case 'BIM Modeller':
                percent = 35;
                break;
            case 'BIM Coordinator':
                percent = 60;
                break;
            case 'BIM Manager':
            case 'Expert':
                percent = 100;
                break;
            default:
                percent = 0;
                break;
        }
    }

    let nextLevel = 'BIM Coordinator';
    if (level === 'BIM Coordinator') nextLevel = 'BIM Manager';
    if (level === 'BIM Manager' || level === 'Expert') nextLevel = 'Mastery Level';

    progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressText.textContent = percent >= 100 ? 'Maximum level achieved' : `${percent}% to ${nextLevel}`;
}

async function fetchProgressFromApi() {
    const token = getAuthToken();
    if (!token) return null;

    try {
        const response = await authFetch('/api/elearning/progress/me');
        if (!response.ok) return null;
        const data = await response.json();
        return data && data.success ? data.progress : null;
    } catch (error) {
        console.warn('Progress API unavailable:', error.message);
        return null;
    }
}

async function fetchQuizStatsFromApi(userIdentity) {
    if (!userIdentity) return null;

    try {
        const response = await fetch(`/api/elearning/quiz/user/${encodeURIComponent(userIdentity)}/stats`);
        if (!response.ok) return null;
        return response.json();
    } catch (error) {
        console.warn('Quiz stats API unavailable:', error.message);
        return null;
    }
}

async function fetchCertificatesFromApi(userIdentity) {
    if (!userIdentity) return [];

    try {
        const response = await fetch(`/api/elearning/certificate/${encodeURIComponent(userIdentity)}`);
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Certificate API unavailable:', error.message);
        return [];
    }
}

async function loadProgressStats() {
    const userData = getUserData();
    const userIdentity = getUserIdentity(userData);

    if (!userData || !userIdentity) {
        showDefaultStats();
        loadRecentActivity([]);
        loadBadges({ totalAttempts: 0, highestScore: 0, examsPassed: 0 }, 0);
        initializeCharts([]);
        return;
    }

    const [progress, quizStats, certificates] = await Promise.all([
        fetchProgressFromApi(),
        fetchQuizStatsFromApi(userIdentity),
        fetchCertificatesFromApi(userIdentity)
    ]);

    dashboardState.progress = progress;
    dashboardState.quizStats = quizStats;
    dashboardState.certificates = certificates;

    const coursesCompleted = toInt(progress?.coursesCompleted, toInt(userData?.progress?.coursesCompleted, 0));
    const practiceAttempts = Math.max(
        toInt(progress?.practiceAttempts, 0),
        toInt(quizStats?.practiceAttempts, 0)
    );
    const examsPassed = Math.max(
        toInt(progress?.examsPassed, 0),
        toInt(quizStats?.examsPassed, 0)
    );
    const certificatesEarned = Math.max(
        toInt(progress?.certificatesEarned, 0),
        toInt(quizStats?.certificatesEarned, 0),
        certificates.length
    );

    setText('courses-completed', coursesCompleted);
    setText('practice-attempts', practiceAttempts);
    setText('exams-passed', examsPassed);
    setText('certificates-earned', certificatesEarned);

    setText('total-quiz-attempts', toInt(quizStats?.totalAttempts, 0));
    setText('highest-score', `${toInt(quizStats?.highestScore, 0)}%`);
    setText('average-score', `${toInt(quizStats?.averageScore, 0)}%`);
    setText('last-quiz-date', formatRelativeDate(quizStats?.lastQuizDate));

    updateLevelProgress(userData, progress);

    const recentResults = Array.isArray(quizStats?.recentResults) ? quizStats.recentResults : [];
    if (recentResults.length > 0) {
        dashboardState.history = recentResults;
        renderQuizHistory(recentResults);
    } else {
        await loadQuizHistory(userIdentity);
    }

    loadRecentActivity(dashboardState.history);
    loadBadges(quizStats || {}, certificatesEarned);
    initializeCharts(dashboardState.history, quizStats?.categoriesAttempted || []);
}

function showDefaultStats() {
    setText('courses-completed', '0');
    setText('practice-attempts', '0');
    setText('exams-passed', '0');
    setText('certificates-earned', '0');
    setText('total-quiz-attempts', '0');
    setText('highest-score', '0%');
    setText('average-score', '0%');
    setText('last-quiz-date', 'Never');

    const tbody = document.getElementById('quiz-history-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <i class="fas fa-info-circle me-2"></i>No quiz attempts yet
                </td>
            </tr>
        `;
    }
}

async function loadQuizHistory(userIdentity) {
    try {
        const response = await fetch(`/api/elearning/quiz/user/${encodeURIComponent(userIdentity)}/history?page=1&limit=5`);
        if (!response.ok) {
            renderQuizHistory([]);
            return;
        }

        const data = await response.json();
        dashboardState.history = Array.isArray(data.results) ? data.results : [];
        renderQuizHistory(dashboardState.history);
    } catch (error) {
        console.error('Error loading quiz history:', error);
        renderQuizHistory([]);
    }
}

function renderQuizHistory(results) {
    const tbody = document.getElementById('quiz-history-body');
    if (!tbody) return;

    if (!Array.isArray(results) || results.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <i class="fas fa-info-circle me-2"></i>No quiz attempts yet
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = results.slice(0, 5).map((result) => {
        const percentage = toInt(result.percentage, 0);
        const passed = !!result.passed;
        const statusClass = passed ? 'success' : 'danger';
        const statusIcon = passed ? 'check-circle' : 'times-circle';
        const statusText = passed ? 'Passed' : 'Failed';

        return `
            <tr>
                <td>${escapeHtml(result.quizName || 'Quiz')}</td>
                <td><span class="badge bg-secondary">${escapeHtml(result.quizCategory || result.sourceType || 'General')}</span></td>
                <td><strong>${percentage}%</strong></td>
                <td><span class="badge bg-${statusClass}"><i class="fas fa-${statusIcon} me-1"></i>${statusText}</span></td>
                <td>${formatDateTime(result.submittedAt)}</td>
            </tr>
        `;
    }).join('');
}

function loadRecentActivity(history) {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    const activities = [];

    (Array.isArray(history) ? history : []).slice(0, 4).forEach((attempt) => {
        const type = String(attempt.sourceType || 'quiz').toLowerCase();
        const icon = type === 'exam' ? 'fa-clipboard-check' : type === 'practice' ? 'fa-edit' : 'fa-brain';
        const color = type === 'exam' ? 'purple' : type === 'practice' ? 'blue' : 'green';
        activities.push({
            title: `${attempt.passed ? 'Passed' : 'Completed'} ${attempt.quizName || 'Quiz'} (${toInt(attempt.percentage, 0)}%)`,
            time: formatRelativeDate(attempt.submittedAt),
            icon,
            color
        });
    });

    dashboardState.certificates.slice(0, 2).forEach((cert) => {
        activities.push({
            title: `Earned certificate: ${cert.title || 'Certificate'}`,
            time: formatRelativeDate(cert.issuedAt),
            icon: 'fa-certificate',
            color: 'gold'
        });
    });

    if (activities.length === 0) {
        activityList.innerHTML = '<div class="text-muted">No activity yet.</div>';
        return;
    }

    activityList.innerHTML = activities.slice(0, 5).map((activity) => `
        <div class="activity-item">
            <div class="activity-icon" style="background-color: var(--${activity.color});">
                <i class="fas ${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <h4>${escapeHtml(activity.title)}</h4>
                <span class="activity-time">${escapeHtml(activity.time)}</span>
            </div>
        </div>
    `).join('');
}

function loadBadges(quizStats, certificatesEarned) {
    const badges = [];
    const totalAttempts = toInt(quizStats.totalAttempts, 0);
    const highestScore = toInt(quizStats.highestScore, 0);
    const examsPassed = toInt(quizStats.examsPassed, 0);

    if (totalAttempts >= 1) {
        badges.push({
            name: 'Quiz Starter',
            description: 'Completed your first quiz',
            icon: 'fas fa-rocket',
            color: 'blue'
        });
    }

    if (totalAttempts >= 5) {
        badges.push({
            name: 'Practice Runner',
            description: 'Finished 5+ quiz attempts',
            icon: 'fas fa-edit',
            color: 'green'
        });
    }

    if (highestScore >= 90) {
        badges.push({
            name: 'High Scorer',
            description: 'Reached 90%+ on a quiz',
            icon: 'fas fa-star',
            color: 'gold'
        });
    }

    if (examsPassed >= 1) {
        badges.push({
            name: 'Exam Passer',
            description: 'Passed at least one exam',
            icon: 'fas fa-clipboard-check',
            color: 'purple'
        });
    }

    if (certificatesEarned >= 1) {
        badges.push({
            name: 'Certified Learner',
            description: 'Earned your first certificate',
            icon: 'fas fa-certificate',
            color: 'gold'
        });
    }

    const badgesContainer = document.getElementById('badges-container');
    if (!badgesContainer) return;

    if (badges.length === 0) {
        badgesContainer.innerHTML = '<div class="text-muted">No badges yet. Complete quizzes to unlock.</div>';
        return;
    }

    badgesContainer.innerHTML = badges.slice(0, 5).map((badge) => `
        <div class="badge-item">
            <div class="badge-icon" style="background-color: var(--${badge.color});">
                <i class="${badge.icon}"></i>
            </div>
            <div class="badge-info">
                <h4>${escapeHtml(badge.name)}</h4>
                <p>${escapeHtml(badge.description)}</p>
            </div>
        </div>
    `).join('');
}

function initializeCharts(history, categoriesFallback = []) {
    const weeklyCtx = document.getElementById('weeklyProgressChart')?.getContext('2d');
    const categoriesCtx = document.getElementById('categoriesChart')?.getContext('2d');

    if (dashboardState.weeklyChart) {
        dashboardState.weeklyChart.destroy();
        dashboardState.weeklyChart = null;
    }

    if (dashboardState.categoriesChart) {
        dashboardState.categoriesChart.destroy();
        dashboardState.categoriesChart = null;
    }

    const weeklyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];

    (Array.isArray(history) ? history : []).forEach((item) => {
        const date = item?.submittedAt ? new Date(item.submittedAt) : null;
        if (!date || Number.isNaN(date.getTime())) return;

        const day = date.getDay();
        const index = day === 0 ? 6 : day - 1;
        weeklyData[index] += 1;
    });

    if (weeklyCtx) {
        dashboardState.weeklyChart = new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: weeklyLabels,
                datasets: [{
                    label: 'Quiz Attempts',
                    data: weeklyData,
                    borderColor: 'var(--main-color)',
                    backgroundColor: 'rgba(6, 187, 204, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    const categoryMap = {};
    (Array.isArray(history) ? history : []).forEach((item) => {
        const key = String(item.quizCategory || item.sourceType || 'general').toLowerCase();
        categoryMap[key] = (categoryMap[key] || 0) + 1;
    });

    if (Object.keys(categoryMap).length === 0 && Array.isArray(categoriesFallback)) {
        categoriesFallback.forEach((category) => {
            const key = String(category || '').toLowerCase();
            if (key) categoryMap[key] = (categoryMap[key] || 0) + 1;
        });
    }

    const categoryLabels = Object.keys(categoryMap);
    const categoryValues = Object.values(categoryMap);

    if (categoriesCtx) {
        dashboardState.categoriesChart = new Chart(categoriesCtx, {
            type: 'doughnut',
            data: {
                labels: categoryLabels.length > 0 ? categoryLabels.map((v) => v.toUpperCase()) : ['No Data'],
                datasets: [{
                    data: categoryValues.length > 0 ? categoryValues : [1],
                    backgroundColor: [
                        '#06BBCC',
                        '#FD7E14',
                        '#198754',
                        '#DC3545',
                        '#6F42C1',
                        '#0EA5E9',
                        '#F59E0B'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

// Load enhanced courses from learning paths
function loadEnhancedCourses() {
    const courses = [];

    if (typeof window.EnhancedLearningPaths !== 'undefined') {
        const learningPaths = window.EnhancedLearningPaths.getAllLearningPaths();

        learningPaths.forEach((level) => {
            level.courses.forEach((course) => {
                courses.push({
                    id: course.id,
                    title: course.title,
                    description: course.description,
                    duration: course.duration,
                    level: level.name,
                    progress: course.progress || 0,
                    thumbnail: course.thumbnail || '../img/default.jpg',
                    modules: course.modules.length,
                    enrolled: course.enrolled || false,
                    skills: course.skills,
                    objectives: course.objectives,
                    phase: course.phase
                });
            });
        });

        updateCourseRecommendations(courses);
    } else {
        loadDefaultCourseRecommendations();
    }
}

function updateCourseRecommendations(courses) {
    const userData = getUserData();
    const userLevel = userData?.level || userData?.bimLevel || 'BIM Modeller';

    const recommendedCourses = courses.filter((course) =>
        course.level === userLevel && !course.enrolled
    ).slice(0, 4);

    const courseContainer = document.querySelector('.course-recommendations');
    if (!courseContainer) return;

    courseContainer.innerHTML = recommendedCourses.map((course) => `
        <div class="course-card">
            <img src="${course.thumbnail}" alt="${escapeHtml(course.title)}" class="course-thumbnail">
            <div class="course-info">
                <h4>${escapeHtml(course.title)}</h4>
                <p class="course-description">${escapeHtml(course.description)}</p>
                <div class="course-meta">
                    <span class="course-duration"><i class="fas fa-clock"></i> ${escapeHtml(course.duration)}</span>
                    <span class="course-modules"><i class="fas fa-list"></i> ${course.modules} modules</span>
                    <span class="course-level level-${course.level.toLowerCase().replace(' ', '-')}">${escapeHtml(course.level)}</span>
                </div>
                <button class="btn btn-primary enroll-btn" onclick="enrollCourse(${Number(course.id)})">
                    Enroll Now
                </button>
            </div>
        </div>
    `).join('');
}

function loadDefaultCourseRecommendations() {
    const defaultCourses = [
        {
            id: 1,
            title: 'Introduction to BIM',
            description: 'Basic concepts and fundamentals of Building Information Modeling',
            duration: '2 hours',
            level: 'BIM Modeller',
            thumbnail: '../img/course-1.jpg',
            modules: 8
        },
        {
            id: 2,
            title: 'Revit Architecture Basics',
            description: 'Learn the fundamentals of Autodesk Revit for architectural design',
            duration: '6 hours',
            level: 'BIM Modeller',
            thumbnail: '../img/course-2.jpg',
            modules: 12
        }
    ];

    updateCourseRecommendations(defaultCourses);
}

function enrollCourse(courseId) {
    const userData = getUserData() || {};
    if (!Array.isArray(userData.enrolledCourses)) {
        userData.enrolledCourses = [];
    }

    if (!userData.enrolledCourses.includes(courseId)) {
        userData.enrolledCourses.push(courseId);
        saveUserData(userData);
        showToast('Successfully enrolled in course!', 'success');

        setTimeout(() => {
            loadEnhancedCourses();
        }, 500);
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = String(value ?? '');
}

function toInt(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return Math.floor(number);
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatRelativeDate(value) {
    if (!value) return 'Never';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';

    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
