document.addEventListener('DOMContentLoaded', function () {
    hydrateExamStateFromHistory();
    loadAvailableExams();
    setupEventListeners();
    initializeProctoring();
});

const examData = [
    {
        id: 'autocad-certification',
        title: 'AutoCAD Certified User Exam',
        category: 'autocad',
        level: 'beginner',
        requiredLevel: 'BIM Modeller',
        duration: 90,
        questionCount: 30,
        passingScore: 75,
        prerequisites: ['autocad-basics-course', 'autocad-practice-80'],
        description: 'Official AutoCAD certification exam covering 2D drafting, editing, and basic 3D modeling.',
        syllabus: [
            'Drawing and editing commands',
            'Layers and object properties',
            'Dimensioning and annotation',
            'Plotting and layouts',
            'Basic 3D modeling'
        ],
        attempts: 0,
        maxAttempts: 3,
        retakePeriod: 7,
        lastAttempt: null,
        certification: {
            title: 'AutoCAD Certified User',
            issuer: 'BC Learning Academy',
            validFor: 24
        }
    },
    {
        id: 'revit-architecture-exam',
        title: 'Revit Architecture Professional Exam',
        category: 'revit',
        level: 'intermediate',
        requiredLevel: 'BIM Coordinator',
        duration: 120,
        questionCount: 40,
        passingScore: 80,
        prerequisites: ['revit-basics-course', 'revit-advanced-course', 'bim-coordination-course'],
        description: 'Advanced Revit Architecture exam for BIM coordination professionals.',
        syllabus: [
            'Advanced family creation',
            'Project coordination workflows',
            'Clash detection and resolution',
            'Construction documentation',
            'BIM standards and protocols'
        ],
        attempts: 0,
        maxAttempts: 2,
        retakePeriod: 14,
        lastAttempt: null,
        certification: {
            title: 'Revit Architecture Professional',
            issuer: 'BC Learning Academy',
            validFor: 36
        }
    },
    {
        id: 'bim-manager-certification',
        title: 'BIM Manager Certification Exam',
        category: 'general',
        level: 'advanced',
        requiredLevel: 'BIM Manager',
        duration: 180,
        questionCount: 50,
        passingScore: 85,
        prerequisites: ['bim-strategy-course', 'project-management-course', 'leadership-training'],
        description: 'Comprehensive BIM management certification for senior professionals.',
        syllabus: [
            'BIM implementation strategy',
            'Team leadership and training',
            'Quality assurance processes',
            'Technology evaluation',
            'Client relationship management',
            'ROI analysis and reporting'
        ],
        attempts: 0,
        maxAttempts: 2,
        retakePeriod: 30,
        lastAttempt: null,
        certification: {
            title: 'Certified BIM Manager',
            issuer: 'BC Learning Academy',
            validFor: 60
        }
    }
];

const examQuestions = {
    'autocad-certification': [
        {
            id: 1,
            question: 'What is the primary purpose of layers in AutoCAD?',
            type: 'multiple-choice',
            options: [
                'To organize drawing objects by function or appearance',
                'To create 3D objects',
                'To add text annotations',
                'To set printing parameters'
            ],
            correct: 0,
            category: 'layers',
            difficulty: 'easy',
            explanation: 'Layers organize drawing objects logically by function, discipline, visibility, or appearance.'
        },
        {
            id: 2,
            question: 'Which command creates a parallel copy of an object at a specified distance?',
            type: 'multiple-choice',
            options: ['COPY', 'MOVE', 'OFFSET', 'MIRROR'],
            correct: 2,
            category: 'editing',
            difficulty: 'easy',
            explanation: 'OFFSET creates a parallel copy at a defined distance from the source object.'
        },
        {
            id: 3,
            question: 'What is the keyboard shortcut for the CIRCLE command?',
            type: 'multiple-choice',
            options: ['CI', 'C', 'CIR', 'CIRCLE'],
            correct: 1,
            category: 'commands',
            difficulty: 'easy',
            explanation: 'The standard shortcut for the CIRCLE command is C.'
        }
    ]
};

let currentExam = null;
let currentExamQuestions = [];
let currentQuestionIndex = 0;
let examAnswers = [];
let examStartTime = null;
let examTimer = null;
let currentModalExamId = null;
let bypassReadinessGate = false;
let isExamReviewMode = false;
let proctoringListenersAttached = false;
let markedForReview = new Set();
let proctoring = {
    cameraActive: false,
    microphoneActive: false,
    violations: []
};

function shuffleArray(array) {
    const shuffled = [...array];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function safeParse(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function getAuthToken() {
    return localStorage.getItem('token') || '';
}

function getAuthenticatedUser() {
    return safeParse(localStorage.getItem('user'), null);
}

function getUserData() {
    return getAuthenticatedUser() || safeParse(localStorage.getItem('userData'), null);
}

function getRequestedExamId() {
    return new URLSearchParams(window.location.search).get('targetExam');
}

function getReadinessDashboard() {
    if (window.LearningReadiness && typeof window.LearningReadiness.getReadinessDashboard === 'function') {
        return window.LearningReadiness.getReadinessDashboard();
    }

    return {
        userLevel: getUserData()?.level || 'BIM Modeller',
        exams: [],
        practiceHistory: [],
        overallReadiness: 0,
        readyCount: 0,
        almostReadyCount: 0,
        nextExam: null
    };
}

function getExamHistory() {
    if (window.LearningReadiness && typeof window.LearningReadiness.getExamHistory === 'function') {
        return window.LearningReadiness.getExamHistory();
    }

    const history = safeParse(localStorage.getItem('examHistory'), []);
    return Array.isArray(history) ? history : [];
}

function getExamBlueprint(examId) {
    return window.LearningReadiness?.EXAM_BLUEPRINTS?.[examId] || null;
}

function hydrateExamStateFromHistory() {
    const history = getExamHistory();

    examData.forEach(exam => {
        const attempts = history.filter(entry => entry.examId === exam.id);
        const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

        exam.attempts = attempts.length;
        exam.lastAttempt = lastAttempt ? (lastAttempt.attemptedAt || lastAttempt.savedAt || null) : null;
        exam.lastScore = lastAttempt ? Number(lastAttempt.percentage || 0) : null;
        exam.passCount = attempts.filter(entry => entry.passed).length;
    });
}

function getExamAttemptStats(examId) {
    const attempts = getExamHistory().filter(entry => entry.examId === examId);
    if (!attempts.length) {
        return {
            attempts: 0,
            passRate: 0,
            averageScore: 0,
            lastScore: null,
            lastAttemptAt: null
        };
    }

    const averageScore = Math.round(
        attempts.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / attempts.length
    );

    return {
        attempts: attempts.length,
        passRate: Math.round((attempts.filter(entry => entry.passed).length / attempts.length) * 100),
        averageScore,
        lastScore: Number(attempts[attempts.length - 1].percentage || 0),
        lastAttemptAt: attempts[attempts.length - 1].attemptedAt || attempts[attempts.length - 1].savedAt || null
    };
}

function normalizeEnhancedQuestion(question, index, exam) {
    if (Array.isArray(question.options) && question.options.length >= 2) {
        return {
            id: question.id || `${exam.id}-sample-${index + 1}`,
            question: question.question || question.scenario || `Sample question ${index + 1}`,
            type: 'multiple-choice',
            options: question.options,
            correct: typeof question.correctAnswer === 'number'
                ? question.correctAnswer
                : typeof question.correct === 'number'
                    ? question.correct
                    : 0,
            category: question.category || exam.category || 'general',
            difficulty: question.difficulty || 'intermediate',
            explanation: question.explanation || 'This item is aligned to the exam blueprint sample content.'
        };
    }

    return null;
}

function buildSyllabusFallbackQuestions(exam) {
    const syllabus = Array.isArray(exam.syllabus) && exam.syllabus.length
        ? exam.syllabus
        : ['Core concepts', 'Workflow fundamentals', 'Quality assurance', 'Documentation'];

    return syllabus.map((topic, index) => {
        const distractors = syllabus.filter(item => item !== topic).slice(0, 3);
        while (distractors.length < 3) {
            distractors.push(`Unrelated topic ${distractors.length + 1}`);
        }

        const options = shuffleArray([topic, ...distractors]);
        return {
            id: `${exam.id}-syllabus-${index + 1}`,
            question: `Which topic is explicitly included in the ${exam.title} syllabus?`,
            type: 'multiple-choice',
            options,
            correct: options.findIndex(option => option === topic),
            category: exam.category || 'general',
            difficulty: 'intermediate',
            explanation: `${topic} is listed directly in the published syllabus for this exam.`
        };
    });
}

function getExamQuestionPool(exam) {
    const directQuestions = examQuestions[exam.id];
    if (Array.isArray(directQuestions) && directQuestions.length) {
        return directQuestions;
    }

    const sampleQuestions = (window.enhancedExamDatabase?.[exam.requiredLevel]?.certificationExams || [])
        .flatMap(item => item.sampleQuestions || [])
        .map((question, index) => normalizeEnhancedQuestion(question, index, exam))
        .filter(Boolean);

    if (sampleQuestions.length) {
        return sampleQuestions;
    }

    return buildSyllabusFallbackQuestions(exam);
}

function buildRuntimeQuestionSet(exam) {
    const pool = getExamQuestionPool(exam);
    if (!pool.length) {
        return [];
    }

    const runtimeQuestions = [];
    while (runtimeQuestions.length < exam.questionCount) {
        const chunk = shuffleArray(pool).map((question, index) => ({
            ...question,
            runtimeId: `${question.id}-${runtimeQuestions.length + index + 1}`
        }));
        runtimeQuestions.push(...chunk);
    }

    return runtimeQuestions.slice(0, exam.questionCount);
}

function formatCategoryLabel(category) {
    return String(category || 'general')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDate(value) {
    if (!value) {
        return 'No attempts yet';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'No attempts yet';
    }

    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function checkPrerequisiteCompleted(prerequisite, userData) {
    const completed = Array.isArray(userData?.completedPrerequisites)
        ? userData.completedPrerequisites
        : [];

    if (completed.length > 0) {
        return completed.includes(prerequisite);
    }

    return true;
}

function checkExamEligibility(exam, userData) {
    const userLevel = userData?.level || 'BIM Modeller';
    const levelOrder = ['BIM Modeller', 'BIM Coordinator', 'BIM Manager'];
    const requiredLevelIndex = levelOrder.indexOf(exam.requiredLevel);
    const userLevelIndex = levelOrder.indexOf(userLevel);

    if (userLevelIndex < requiredLevelIndex) {
        return { eligible: false, reason: 'level', required: exam.requiredLevel };
    }

    if (exam.attempts >= exam.maxAttempts) {
        return { eligible: false, reason: 'attempts', maxAttempts: exam.maxAttempts };
    }

    if (exam.lastAttempt) {
        const daysSinceAttempt = Math.floor((Date.now() - new Date(exam.lastAttempt)) / (1000 * 60 * 60 * 24));
        if (daysSinceAttempt < exam.retakePeriod) {
            return {
                eligible: false,
                reason: 'retake',
                daysRemaining: exam.retakePeriod - daysSinceAttempt
            };
        }
    }

    const missingPrerequisites = exam.prerequisites.filter(prerequisite => !checkPrerequisiteCompleted(prerequisite, userData));
    if (missingPrerequisites.length > 0) {
        return {
            eligible: false,
            reason: 'prerequisites',
            missing: missingPrerequisites
        };
    }

    return { eligible: true };
}

function buildExamViewModel(exam, userData, dashboard, requestedExamId) {
    const readiness = dashboard.exams.find(item => item.examId === exam.id) || {
        examId: exam.id,
        shortTitle: exam.title,
        status: 'locked',
        readinessScore: 0,
        accuracy: 0,
        attempts: 0,
        coverage: 0,
        recommendation: 'Complete more practice to generate readiness data.',
        recommendedPracticeMode: 'skill-drills',
        targetCategories: []
    };
    const baseEligibility = checkExamEligibility(exam, userData);
    const attemptStats = getExamAttemptStats(exam.id);

    let section = 'locked';
    if (baseEligibility.eligible && readiness.status === 'ready') {
        section = 'ready';
    } else if (baseEligibility.eligible) {
        section = 'almost-ready';
    }

    return {
        exam,
        readiness,
        baseEligibility,
        attemptStats,
        section,
        spotlight: exam.id === requestedExamId,
        practiceHref: `practice.html?targetExam=${exam.id}&view=${readiness.recommendedPracticeMode || 'skill-drills'}`
    };
}

function createExamCardMarkup(model) {
    const { exam, readiness, baseEligibility, attemptStats, section, spotlight, practiceHref } = model;
    const readinessLabel = section === 'almost-ready' ? 'Almost Ready' : section === 'ready' ? 'Ready' : 'Locked';
    let actionsMarkup = '';

    if (section === 'ready') {
        actionsMarkup = `
            <button class="exam-primary-btn" type="button" onclick="prepareExam('${exam.id}')">
                <i class="fas fa-play-circle"></i> Take Exam
            </button>
            <a class="exam-link-btn" href="${practiceHref}">
                <i class="fas fa-route"></i> Open Practice Path
            </a>
        `;
    } else if (baseEligibility.eligible) {
        actionsMarkup = `
            <a class="exam-primary-btn" href="${practiceHref}">
                <i class="fas fa-chart-line"></i> Continue Preparation
            </a>
            <button class="exam-secondary-btn" type="button" onclick="prepareExam('${exam.id}', true)">
                <i class="fas fa-forward"></i> Take Exam Anyway
            </button>
        `;
    } else {
        actionsMarkup = `
            <button class="exam-secondary-btn" type="button" onclick="showPrerequisites('${exam.id}', '${baseEligibility.reason || 'readiness'}')">
                <i class="fas fa-lock"></i> View Blockers
            </button>
            <a class="exam-link-btn" href="${practiceHref}">
                <i class="fas fa-wrench"></i> Open Preparation Path
            </a>
        `;
    }

    return `
        <div class="exam-path-card ${spotlight ? 'spotlight' : ''}">
            <div class="exam-panel-title">
                <h4>${exam.title}</h4>
                <span class="exam-status-pill ${section}">${readinessLabel}</span>
            </div>
            <p>${exam.description}</p>
            <div class="exam-detail-row">
                <span>Readiness Score</span>
                <strong>${readiness.readinessScore}%</strong>
            </div>
            <div class="exam-detail-row">
                <span>Measured Accuracy</span>
                <strong>${readiness.accuracy}%</strong>
            </div>
            <div class="exam-detail-row">
                <span>Coverage</span>
                <strong>${readiness.coverage}%</strong>
            </div>
            <div class="exam-detail-row">
                <span>Exam Attempts</span>
                <strong>${attemptStats.attempts}/${exam.maxAttempts}</strong>
            </div>
            <div class="exam-detail-row">
                <span>Last Exam Score</span>
                <strong>${attemptStats.lastScore === null ? '-' : `${attemptStats.lastScore}%`}</strong>
            </div>
            <div class="exam-detail-row">
                <span>Last Attempt</span>
                <strong>${formatDate(attemptStats.lastAttemptAt)}</strong>
            </div>
            <p>${baseEligibility.eligible ? readiness.recommendation : getIneligibilityMessage(baseEligibility)}</p>
            <ul class="exam-topic-list">
                ${exam.syllabus.slice(0, 4).map(topic => `<li>${topic}</li>`).join('')}
            </ul>
            <div class="exam-card-actions">
                ${actionsMarkup}
            </div>
        </div>
    `;
}

function renderExamHero(dashboard, models, requestedExamId) {
    const heroTitle = document.getElementById('exam-hero-title');
    const heroCopy = document.getElementById('exam-hero-copy');
    const heroActions = document.getElementById('exam-hero-actions');
    const heroSummary = document.getElementById('exam-hero-summary');
    const focusedModel = models.find(model => model.exam.id === requestedExamId) || null;

    if (heroTitle && heroCopy) {
        if (focusedModel) {
            heroTitle.textContent = `Exam path for ${focusedModel.exam.title}`;
            heroCopy.textContent = `${focusedModel.readiness.recommendation} Use the preparation path if you still need more coverage, consistency, or accuracy before attempting the formal exam.`;
        } else {
            heroTitle.textContent = 'Move into certification only when the path is measurable';
            heroCopy.textContent = 'Use your drill accuracy, coverage, and consistency to decide which exam is ready now, which one needs more preparation, and what to do next.';
        }
    }

    if (heroActions) {
        const linkedExam = focusedModel || models.find(model => model.section === 'ready') || models[0];
        heroActions.innerHTML = linkedExam ? `
            <a class="exam-link-btn" href="${linkedExam.practiceHref}">
                <i class="fas fa-route"></i> Open Practice Path
            </a>
            <button class="exam-primary-btn" type="button" onclick="showExamPath('${linkedExam.exam.id}')">
                <i class="fas fa-bullseye"></i> Focus This Exam
            </button>
        ` : '';
    }

    if (heroSummary) {
        const examHistory = getExamHistory();
        heroSummary.innerHTML = `
            <span class="exam-mini-label">Overall Readiness</span>
            <div class="exam-score">${dashboard.overallReadiness}%</div>
            <h3>${dashboard.nextExam ? dashboard.nextExam.shortTitle : 'No exam target yet'}</h3>
            <p>${dashboard.nextExam ? dashboard.nextExam.recommendation : 'Complete practice attempts to generate a readiness baseline.'}</p>
            <div class="exam-summary-grid">
                <div>
                    <div class="exam-mini-label">Ready Now</div>
                    <div class="exam-score" style="font-size:2.4rem;">${dashboard.readyCount}</div>
                </div>
                <div>
                    <div class="exam-mini-label">Stored Attempts</div>
                    <div class="exam-score" style="font-size:2.4rem;">${examHistory.length}</div>
                </div>
            </div>
        `;
    }
}

function renderExamOverview(dashboard) {
    const history = getExamHistory();
    const averageExamScore = history.length
        ? Math.round(history.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / history.length)
        : 0;
    const metrics = [
        {
            label: 'Ready Exams',
            value: dashboard.readyCount,
            caption: 'Exam paths meeting readiness and operational gates.'
        },
        {
            label: 'Almost Ready',
            value: dashboard.almostReadyCount,
            caption: 'Strong progress, but still missing measured thresholds.'
        },
        {
            label: 'Practice Attempts',
            value: dashboard.practiceHistory.length,
            caption: 'Practice attempts contributing to readiness calculations.'
        },
        {
            label: 'Average Exam Score',
            value: `${averageExamScore}%`,
            caption: 'Stored from local exam history on this device.'
        }
    ];

    const container = document.getElementById('exam-overview-metrics');
    if (!container) {
        return;
    }

    container.innerHTML = metrics.map(metric => `
        <div class="exam-metric-card">
            <div class="exam-mini-label">${metric.label}</div>
            <div class="exam-score" style="font-size:2.8rem;">${metric.value}</div>
            <div class="exam-metric-caption">${metric.caption}</div>
        </div>
    `).join('');
}

function renderExamSections(models) {
    const readyContainer = document.getElementById('exam-ready-container');
    const almostReadyContainer = document.getElementById('exam-almost-ready-container');
    const lockedContainer = document.getElementById('exam-locked-container');

    if (!readyContainer || !almostReadyContainer || !lockedContainer) {
        return;
    }

    const renderGroup = (container, items, emptyTitle, emptyCopy) => {
        container.innerHTML = items.length
            ? items.map(createExamCardMarkup).join('')
            : `
                <div class="exam-empty-card">
                    <h4>${emptyTitle}</h4>
                    <p>${emptyCopy}</p>
                </div>
            `;
    };

    renderGroup(
        readyContainer,
        models.filter(model => model.section === 'ready'),
        'No exam is fully ready yet',
        'Keep building performance in practice until one path clears readiness and operational rules.'
    );
    renderGroup(
        almostReadyContainer,
        models.filter(model => model.section === 'almost-ready'),
        'No exam is in the preparation band',
        'When an exam is eligible but not yet ready, it will appear here with a direct practice path.'
    );
    renderGroup(
        lockedContainer,
        models.filter(model => model.section === 'locked'),
        'No locked paths',
        'If a level gate, retake window, or prerequisite blocks an exam, it will be shown here.'
    );
}

function renderExamHistory() {
    const history = [...getExamHistory()].slice(-6).reverse();
    const container = document.getElementById('exam-history-container');

    if (!container) {
        return;
    }

    container.innerHTML = history.length
        ? history.map(entry => `
            <div class="exam-history-card">
                <h4>${entry.title || entry.examId}</h4>
                <p>${entry.passed ? 'Passed exam attempt' : 'Exam attempt needs improvement'}</p>
                <div class="exam-history-row">
                    <span>Score</span>
                    <strong>${entry.percentage}%</strong>
                </div>
                <div class="exam-history-row">
                    <span>Time</span>
                    <strong>${Math.round(Number(entry.timeTaken || 0) / 60)} min</strong>
                </div>
                <div class="exam-history-row">
                    <span>Result</span>
                    <strong>${entry.passed ? 'Passed' : 'Failed'}</strong>
                </div>
                <div class="exam-history-row">
                    <span>Attempted At</span>
                    <strong>${formatDate(entry.attemptedAt || entry.savedAt)}</strong>
                </div>
            </div>
        `).join('')
        : `
            <div class="exam-empty-card">
                <h4>No exam attempts yet</h4>
                <p>Exam history will appear here after the first formal attempt is completed.</p>
            </div>
        `;
}

function loadAvailableExams() {
    const userData = getUserData();
    const dashboard = getReadinessDashboard();
    const requestedExamId = getRequestedExamId();
    const models = examData
        .map(exam => buildExamViewModel(exam, userData, dashboard, requestedExamId))
        .sort((left, right) => {
            if (left.spotlight) return -1;
            if (right.spotlight) return 1;
            return right.readiness.readinessScore - left.readiness.readinessScore;
        });

    renderExamHero(dashboard, models, requestedExamId);
    renderExamOverview(dashboard);
    renderExamSections(models);
    renderExamHistory();
}

function getIneligibilityMessage(eligibility) {
    switch (eligibility.reason) {
        case 'level':
            return `Requires level ${eligibility.required}.`;
        case 'attempts':
            return 'Maximum attempt limit has been reached.';
        case 'retake':
            return `Retake available in ${eligibility.daysRemaining} day(s).`;
        case 'prerequisites':
            return 'Required preparation items are incomplete.';
        default:
            return 'This exam path is not available yet.';
    }
}

function formatPrerequisite(prerequisite) {
    const formatMap = {
        'autocad-basics-course': 'AutoCAD Basics Course',
        'autocad-practice-80': 'AutoCAD Practice with 80% minimum',
        'revit-basics-course': 'Revit Basics Course',
        'revit-advanced-course': 'Revit Advanced Course',
        'bim-coordination-course': 'BIM Coordination Course',
        'bim-strategy-course': 'BIM Strategy Course',
        'project-management-course': 'Project Management Course',
        'leadership-training': 'Leadership Training'
    };

    return formatMap[prerequisite] || prerequisite;
}

function openPracticePath(examId, view) {
    window.location.href = `practice.html?targetExam=${examId}&view=${view || 'skill-drills'}`;
}

function showExamPath(examId) {
    const url = new URL(window.location.href);
    url.searchParams.set('targetExam', examId);
    window.location.href = url.toString();
}

function showPrerequisites(examId, reason) {
    currentModalExamId = examId;
    const exam = examData.find(item => item.id === examId);
    const modal = document.getElementById('prerequisites-modal');
    const list = document.getElementById('prerequisites-list');
    const dashboard = getReadinessDashboard();
    const readiness = dashboard.exams.find(item => item.examId === examId);
    const eligibility = exam ? checkExamEligibility(exam, getUserData()) : { eligible: false, reason };
    const blockers = [];

    if (!exam || !modal || !list) {
        return;
    }

    if (eligibility.reason === 'prerequisites' && Array.isArray(eligibility.missing)) {
        blockers.push(...eligibility.missing.map(item => `Complete ${formatPrerequisite(item)}.`));
    } else if (eligibility.reason === 'level') {
        blockers.push(`Current level is below ${eligibility.required}.`);
    } else if (eligibility.reason === 'attempts') {
        blockers.push(`You have reached the maximum of ${eligibility.maxAttempts} attempts.`);
    } else if (eligibility.reason === 'retake') {
        blockers.push(`Wait ${eligibility.daysRemaining} more day(s) before retaking this exam.`);
    }

    if (readiness) {
        if (readiness.coverage < 100 && Array.isArray(readiness.missingCategories) && readiness.missingCategories.length) {
            blockers.push(`Complete practice coverage in ${readiness.missingCategories.join(', ')}.`);
        }
        if (readiness.accuracy < readiness.minAccuracy) {
            blockers.push(`Raise measured accuracy to at least ${readiness.minAccuracy}%.`);
        }
        if (readiness.attempts < readiness.minAttempts) {
            blockers.push(`Finish ${readiness.minAttempts - readiness.attempts} more measured attempt(s).`);
        }
        if (!blockers.length) {
            blockers.push(readiness.recommendation);
        }
    }

    list.innerHTML = blockers.map(item => `<li><i class="fas fa-angle-right"></i> ${item}</li>`).join('');
    modal.style.display = 'flex';
}

function prepareExam(examId, bypassReadiness = false) {
    const exam = examData.find(item => item.id === examId);
    const dashboard = getReadinessDashboard();
    const readiness = dashboard.exams.find(item => item.examId === examId);
    const eligibility = exam ? checkExamEligibility(exam, getUserData()) : { eligible: false, reason: 'readiness' };

    if (!exam) {
        return;
    }

    if (!eligibility.eligible) {
        showPrerequisites(examId, eligibility.reason);
        return;
    }

    if (!bypassReadiness && readiness && readiness.status !== 'ready') {
        showPrerequisites(examId, 'readiness');
        return;
    }

    currentExam = exam;
    bypassReadinessGate = bypassReadiness;
    isExamReviewMode = false;
    markedForReview = new Set();

    const modal = document.getElementById('exam-prep-modal');
    const details = document.getElementById('exam-details');
    const questionPool = getExamQuestionPool(exam);

    document.getElementById('exam-title-header').textContent = exam.title;
    details.innerHTML = `
        <div class="exam-overview">
            <h4>${exam.title}</h4>
            <div class="exam-specs">
                <div class="spec">
                    <i class="fas fa-clock"></i>
                    <span>Duration: ${exam.duration} minutes</span>
                </div>
                <div class="spec">
                    <i class="fas fa-question-circle"></i>
                    <span>Questions: ${exam.questionCount}</span>
                </div>
                <div class="spec">
                    <i class="fas fa-target"></i>
                    <span>Passing Score: ${exam.passingScore}%</span>
                </div>
                <div class="spec">
                    <i class="fas fa-database"></i>
                    <span>Question Pool: ${questionPool.length} item(s)</span>
                </div>
            </div>
            <div class="exam-rules">
                <h5>Exam Rules:</h5>
                <ul>
                    <li>Camera and microphone monitoring required</li>
                    <li>Full-screen mode mandatory</li>
                    <li>No external resources allowed</li>
                    <li>Browser tab switching detected</li>
                    <li>Time limit strictly enforced</li>
                </ul>
            </div>
            ${readiness ? `<p><strong>Readiness:</strong> ${readiness.recommendation}</p>` : ''}
            ${bypassReadiness ? '<p><strong>Warning:</strong> You are entering before this path is fully ready.</p>' : ''}
        </div>
    `;

    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('start-exam').disabled = true;
    modal.style.display = 'flex';
}

function startExam() {
    if (!currentExam) {
        return;
    }

    currentExamQuestions = buildRuntimeQuestionSet(currentExam);
    if (!currentExamQuestions.length) {
        alert('No exam question pool is available yet for this exam.');
        return;
    }

    document.getElementById('exam-prep-modal').style.display = 'none';
    document.getElementById('exam-interface').style.display = 'block';

    examStartTime = Date.now();
    currentQuestionIndex = 0;
    examAnswers = new Array(currentExamQuestions.length).fill(null);
    isExamReviewMode = false;
    markedForReview = new Set();

    startExamTimer();
    requestFullscreen();
    startProctoring();
    loadExamQuestions();
    displayQuestion();
}

function startExamTimer() {
    const timerElement = document.getElementById('time-remaining');
    let timeLeft = currentExam.duration * 60;

    examTimer = setInterval(() => {
        timeLeft -= 1;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 300) {
            timerElement.style.color = '#EF4444';
        } else if (timeLeft <= 600) {
            timerElement.style.color = '#F59E0B';
        }

        if (timeLeft <= 0) {
            clearInterval(examTimer);
            submitExam(true);
        }
    }, 1000);
}

function loadExamQuestions() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';

    for (let index = 0; index < currentExamQuestions.length; index += 1) {
        const button = document.createElement('button');
        button.className = 'question-nav-btn';
        button.textContent = index + 1;
        button.onclick = () => navigateToQuestion(index);
        button.id = `nav-btn-${index}`;
        grid.appendChild(button);
    }
}

function displayQuestion() {
    const question = currentExamQuestions[currentQuestionIndex];
    if (!question) {
        return;
    }

    document.getElementById('question-number').textContent = `Question ${currentQuestionIndex + 1}`;
    document.getElementById('question-text').textContent = question.question;
    document.getElementById('question-progress').textContent = `${currentQuestionIndex + 1} / ${currentExamQuestions.length}`;

    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        const isSelected = examAnswers[currentQuestionIndex] === index;
        const isCorrect = index === question.correct;
        const isWrongSelection = isExamReviewMode && isSelected && !isCorrect;

        optionDiv.className = 'option';
        if (isExamReviewMode && isCorrect) {
            optionDiv.classList.add('correct');
        } else if (isWrongSelection) {
            optionDiv.classList.add('wrong');
        } else if (isSelected) {
            optionDiv.classList.add('selected');
        }

        optionDiv.innerHTML = `
            <input type="radio" id="option-${index}" name="exam-option" value="${index}" ${isSelected ? 'checked' : ''} ${isExamReviewMode ? 'disabled' : ''}>
            <label for="option-${index}">${option}</label>
        `;

        if (!isExamReviewMode) {
            optionDiv.addEventListener('click', () => {
                optionDiv.querySelector('input').checked = true;
                examAnswers[currentQuestionIndex] = index;
                updateQuestionNavigation();
            });
        }

        optionsContainer.appendChild(optionDiv);
    });

    document.getElementById('prev-question').disabled = currentQuestionIndex === 0;
    document.getElementById('mark-review').style.display = isExamReviewMode ? 'none' : 'inline-block';

    if (currentQuestionIndex === currentExamQuestions.length - 1 || isExamReviewMode) {
        document.getElementById('next-question').style.display = isExamReviewMode && currentQuestionIndex < currentExamQuestions.length - 1
            ? 'inline-block'
            : currentQuestionIndex === currentExamQuestions.length - 1 ? 'none' : 'inline-block';
        document.getElementById('submit-exam').style.display = isExamReviewMode ? 'none' : (currentQuestionIndex === currentExamQuestions.length - 1 ? 'inline-block' : 'none');
    } else {
        document.getElementById('next-question').style.display = 'inline-block';
        document.getElementById('submit-exam').style.display = 'none';
    }

    updateQuestionNavigation();
}

function updateQuestionNavigation() {
    for (let index = 0; index < currentExamQuestions.length; index += 1) {
        const button = document.getElementById(`nav-btn-${index}`);
        if (!button) {
            continue;
        }

        button.className = 'question-nav-btn';

        if (index === currentQuestionIndex) {
            button.classList.add('current');
        }

        if (examAnswers[index] !== null) {
            button.classList.add('answered');
        }

        if (markedForReview.has(index)) {
            button.classList.add('marked');
        }
    }
}

function navigateToQuestion(index) {
    if (index >= 0 && index < currentExamQuestions.length) {
        currentQuestionIndex = index;
        displayQuestion();
    }
}

function toggleMarkForReview() {
    if (markedForReview.has(currentQuestionIndex)) {
        markedForReview.delete(currentQuestionIndex);
    } else {
        markedForReview.add(currentQuestionIndex);
    }

    updateQuestionNavigation();
}

function calculateExamResults() {
    let correctCount = 0;
    const categoryPerformance = {};

    examAnswers.forEach((answer, index) => {
        const question = currentExamQuestions[index];
        if (!question) {
            return;
        }

        const category = question.category || 'general';
        if (!categoryPerformance[category]) {
            categoryPerformance[category] = { correct: 0, total: 0 };
        }

        categoryPerformance[category].total += 1;
        if (answer === question.correct) {
            correctCount += 1;
            categoryPerformance[category].correct += 1;
        }
    });

    const percentage = Math.round((correctCount / currentExamQuestions.length) * 100);
    const passed = percentage >= currentExam.passingScore;
    const timeTaken = Date.now() - examStartTime;

    return {
        correct: correctCount,
        total: currentExamQuestions.length,
        percentage,
        passed,
        timeTaken,
        categoryPerformance,
        violations: proctoring.violations
    };
}

function submitExam(autoSubmit = false) {
    if (!autoSubmit) {
        const unanswered = examAnswers.filter(answer => answer === null).length;
        if (unanswered > 0) {
            const confirmSubmit = window.confirm(`You have ${unanswered} unanswered questions. Are you sure you want to submit?`);
            if (!confirmSubmit) {
                return;
            }
        }
    }

    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }

    stopProctoring();
    exitFullscreen();

    const results = calculateExamResults();
    document.getElementById('exam-interface').style.display = 'none';

    showExamResults(results);
    updateExamAttempt(results);
    syncExamAttemptToServer(results);
}

function showExamResults(results) {
    const modal = document.getElementById('exam-results-modal');

    document.getElementById('final-score-percentage').textContent = `${results.percentage}%`;
    document.getElementById('total-questions').textContent = results.total;
    document.getElementById('correct-answers').textContent = results.correct;
    document.getElementById('wrong-answers').textContent = results.total - results.correct;

    const minutes = Math.floor(results.timeTaken / 60000);
    const seconds = Math.floor((results.timeTaken % 60000) / 1000);
    document.getElementById('time-taken').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const statusElement = document.getElementById('pass-fail-status');
    const messageElement = document.getElementById('score-message');
    const scoreCircle = document.getElementById('final-score-circle');
    const downloadBtn = document.getElementById('download-certificate');

    if (results.passed) {
        statusElement.textContent = 'PASSED';
        statusElement.className = 'pass';
        messageElement.textContent = 'Congratulations! You have successfully passed the exam.';
        scoreCircle.className = 'score-circle pass';
        downloadBtn.style.display = 'inline-block';
    } else {
        statusElement.textContent = 'FAILED';
        statusElement.className = 'fail';
        messageElement.textContent = `You need ${currentExam.passingScore}% to pass. Keep studying and try again.`;
        scoreCircle.className = 'score-circle fail';
        downloadBtn.style.display = 'none';
    }

    const breakdownContainer = document.getElementById('category-breakdown');
    breakdownContainer.innerHTML = '<h4>Performance by Category:</h4>';

    Object.entries(results.categoryPerformance).forEach(([category, performance]) => {
        const percentage = Math.round((performance.correct / performance.total) * 100);
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-result';
        categoryDiv.innerHTML = `
            <span class="category-name">${formatCategoryLabel(category)}:</span>
            <span class="category-score">${performance.correct}/${performance.total} (${percentage}%)</span>
            <div class="category-bar">
                <div class="category-progress" style="width: ${percentage}%"></div>
            </div>
        `;
        breakdownContainer.appendChild(categoryDiv);
    });

    modal.style.display = 'flex';
}

function reviewExamAttempt() {
    if (!currentExamQuestions.length) {
        return;
    }

    document.getElementById('exam-results-modal').style.display = 'none';
    document.getElementById('exam-interface').style.display = 'block';
    isExamReviewMode = true;
    currentQuestionIndex = 0;
    displayQuestion();
}

function updateExamAttempt(results) {
    const exam = examData.find(item => item.id === currentExam.id);
    const attemptedAt = new Date().toISOString();

    if (exam) {
        exam.attempts += 1;
        exam.lastAttempt = attemptedAt;
        exam.lastScore = results.percentage;
    }

    if (window.LearningReadiness && typeof window.LearningReadiness.saveExamAttempt === 'function') {
        window.LearningReadiness.saveExamAttempt({
            examId: currentExam.id,
            title: currentExam.title,
            category: currentExam.category,
            percentage: results.percentage,
            passed: results.passed,
            timeTaken: Math.round(results.timeTaken / 1000),
            attemptedAt,
            bypassReadinessGate
        });
    }

    hydrateExamStateFromHistory();
    loadAvailableExams();
}

async function syncExamAttemptToServer(results) {
    try {
        const authUser = getAuthenticatedUser() || {};
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const payload = {
            quizId: currentExam.id,
            quizName: currentExam.title,
            quizCategory: currentExam.category || 'exam',
            sourceType: 'exam',
            score: results.correct,
            totalQuestions: results.total,
            percentage: results.percentage,
            passed: results.passed,
            answers: examAnswers,
            timeTaken: Math.round(results.timeTaken / 1000),
            issueCertificate: results.passed,
            certificateTitle: currentExam?.certification?.title || `${currentExam.title} Certificate`,
            userId: authUser.id || authUser.userId || authUser.email || authUser.username || authUser.name || null,
            userName: authUser.name || authUser.username || null,
            userEmail: authUser.email || null,
            metadata: {
                violations: Array.isArray(results.violations) ? results.violations.length : 0,
                requiredLevel: currentExam.requiredLevel || null,
                bypassReadinessGate
            }
        };

        const response = await fetch('/api/elearning/quiz/submit', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            console.warn('Exam result sync failed:', response.status, text);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.warn('Exam result sync skipped:', error.message);
        return null;
    }
}

function initializeProctoring() {
    monitorForViolations();
}

function startProctoring() {
    proctoring.cameraActive = true;
    proctoring.microphoneActive = true;
    proctoring.violations = [];
    document.getElementById('camera-status').style.color = '#22C55E';
}

function stopProctoring() {
    proctoring.cameraActive = false;
    proctoring.microphoneActive = false;
    document.getElementById('camera-status').style.color = '#9CA3AF';
}

function monitorForViolations() {
    if (proctoringListenersAttached) {
        return;
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && proctoring.cameraActive) {
            proctoring.violations.push({
                type: 'tab_switch',
                timestamp: Date.now(),
                description: 'User switched browser tab'
            });
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && proctoring.cameraActive) {
            proctoring.violations.push({
                type: 'fullscreen_exit',
                timestamp: Date.now(),
                description: 'User exited fullscreen mode'
            });
        }
    });

    proctoringListenersAttached = true;
}

function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function setupEventListeners() {
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', event => {
            event.target.closest('.modal').style.display = 'none';
        });
    });

    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    const startButton = document.getElementById('start-exam');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(checkboxes).every(item => item.checked);
            startButton.disabled = !allChecked;
        });
    });

    document.getElementById('prev-question')?.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex -= 1;
            displayQuestion();
        }
    });

    document.getElementById('next-question')?.addEventListener('click', () => {
        if (currentQuestionIndex < currentExamQuestions.length - 1) {
            currentQuestionIndex += 1;
            displayQuestion();
        }
    });

    document.getElementById('mark-review')?.addEventListener('click', toggleMarkForReview);
    document.getElementById('start-exam')?.addEventListener('click', startExam);
    document.getElementById('submit-exam')?.addEventListener('click', () => submitExam(false));
    document.getElementById('cancel-exam')?.addEventListener('click', () => {
        document.getElementById('exam-prep-modal').style.display = 'none';
    });
    document.getElementById('back-to-exams')?.addEventListener('click', () => {
        document.getElementById('exam-results-modal').style.display = 'none';
        document.getElementById('exam-interface').style.display = 'none';
        isExamReviewMode = false;
        loadAvailableExams();
    });
    document.getElementById('view-review')?.addEventListener('click', reviewExamAttempt);
    document.getElementById('view-requirements')?.addEventListener('click', () => {
        const examId = currentModalExamId;
        if (!examId) {
            return;
        }

        const readiness = getReadinessDashboard().exams.find(item => item.examId === examId);
        openPracticePath(examId, readiness?.recommendedPracticeMode || 'skill-drills');
    });
}
