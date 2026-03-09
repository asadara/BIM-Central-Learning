// Exam functionality
document.addEventListener('DOMContentLoaded', function () {
    // Load enhanced exam system first
    loadEnhancedExamSystem().then(() => {
        loadAvailableExams();
        setupEventListeners();
        loadExamHistory();
    });
});

// Load enhanced exam system
function loadEnhancedExamSystem() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'enhanced-exam-database.js';
        script.onload = () => {
            console.log('Enhanced Exam Database loaded successfully');
            resolve();
        };
        script.onerror = () => {
            console.warn('Could not load enhanced exam database, using fallback data');
            resolve();
        };
        document.head.appendChild(script);
    });
}

// Get exam data from enhanced system or fallback
function getExamData() {
    if (typeof window.EnhancedExamDatabase !== 'undefined') {
        const userData = getUserData();
        const userLevel = userData?.level || 'BIM Modeller';

        // Get exams for user's level
        const levelExams = window.EnhancedExamDatabase.getExamsByLevel(userLevel);

        // Convert to exam format
        const exams = levelExams.map(exam => ({
            id: exam.id,
            title: exam.title,
            description: exam.description,
            level: userLevel,
            category: exam.category,
            duration: exam.duration,
            questions: exam.questions.length,
            passingScore: exam.passingScore,
            difficulty: exam.difficulty,
            attempts: exam.maxAttempts,
            prerequisite: exam.prerequisite,
            certification: exam.certification,
            questions_data: exam.questions.map(q => ({
                question: q.question,
                options: q.options,
                correct: q.options.indexOf(q.correctAnswer),
                explanation: q.explanation,
                competencyArea: q.competencyArea,
                bloomsLevel: q.bloomsLevel,
                difficulty: q.difficulty
            }))
        }));

        console.log(`Loaded ${exams.length} enhanced exams for ${userLevel}`);
        return exams;
    } else {
        console.log('Using fallback exam data');
        return getFallbackExamData();
    }
}

// Fallback exam data
function getFallbackExamData() {
    return [
        {
            id: 1,
            title: "BIM Modeller Certification",
            description: "Comprehensive certification exam for BIM Modeller level",
            level: "BIM Modeller",
            category: "certification",
            duration: 120, // 2 hours
            questions: 50,
            passingScore: 70,
            difficulty: "Intermediate",
            attempts: 3,
            prerequisite: null,
            certification: "BIM Modeller Certified",
            questions_data: [
                {
                    question: "What is the primary purpose of Building Information Modeling (BIM)?",
                    options: [
                        "Creating 2D drawings only",
                        "Managing building data and processes",
                        "Rendering 3D images",
                        "Cost estimation only"
                    ],
                    correct: 1,
                    explanation: "BIM is primarily used for managing building data and processes throughout the project lifecycle."
                },
                {
                    question: "Which software is commonly used for architectural BIM modeling?",
                    options: ["AutoCAD", "Revit", "3ds Max", "Photoshop"],
                    correct: 1,
                    explanation: "Revit is the industry standard for architectural BIM modeling."
                }
            ]
        },
        {
            id: 2,
            title: "AutoCAD Fundamentals Exam",
            description: "Test your knowledge of AutoCAD basics and 2D drafting",
            level: "BIM Modeller",
            category: "software",
            duration: 90,
            questions: 30,
            passingScore: 75,
            difficulty: "Beginner",
            attempts: 5,
            prerequisite: null,
            certification: "AutoCAD Basics Certificate",
            questions_data: [
                {
                    question: "What is the keyboard shortcut for the LINE command?",
                    options: ["L", "LI", "LINE", "LN"],
                    correct: 0,
                    explanation: "The keyboard shortcut for the LINE command is 'L'."
                }
            ]
        }
    ];
}

// Initialize exam data
let examData = [];

// Load available exams
function loadAvailableExams() {
    examData = getExamData();
    displayExams(examData);
}

// Display exams
function displayExams(exams) {
    const container = document.getElementById('exams-container');
    if (!container) return;

    container.innerHTML = exams.map(exam => {
        const userAttempts = getExamAttempts(exam.id);
        const attemptsRemaining = exam.attempts - userAttempts.length;
        const lastAttempt = userAttempts.length > 0 ? userAttempts[userAttempts.length - 1] : null;
        const hasPassed = lastAttempt && lastAttempt.score >= exam.passingScore;

        return `
            <div class="exam-card ${hasPassed ? 'passed' : ''}" data-id="${exam.id}">
                <div class="exam-header">
                    <h3>${exam.title}</h3>
                    <div class="exam-badges">
                        <span class="difficulty-badge ${exam.difficulty.toLowerCase()}">${exam.difficulty}</span>
                        <span class="category-badge">${exam.category}</span>
                        ${hasPassed ? '<span class="status-badge passed">PASSED</span>' : ''}
                    </div>
                </div>
                <div class="exam-info">
                    <p class="exam-description">${exam.description}</p>
                    <div class="exam-stats">
                        <div class="stat">
                            <i class="fas fa-question-circle"></i>
                            <span>${exam.questions} Questions</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span>${exam.duration} minutes</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-target"></i>
                            <span>${exam.passingScore}% Pass</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-redo"></i>
                            <span>${attemptsRemaining} Attempts Left</span>
                        </div>
                    </div>
                    ${exam.prerequisite ? `
                        <div class="prerequisite">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Prerequisite: ${exam.prerequisite}</span>
                        </div>
                    ` : ''}
                    ${lastAttempt ? `
                        <div class="last-attempt">
                            <strong>Last Attempt:</strong>
                            <span class="${lastAttempt.score >= exam.passingScore ? 'pass' : 'fail'}">
                                ${lastAttempt.score}% on ${new Date(lastAttempt.date).toLocaleDateString()}
                            </span>
                        </div>
                    ` : ''}
                </div>
                <div class="exam-actions">
                    ${attemptsRemaining > 0 && !hasPassed ? `
                        <button class="btn btn-primary start-exam" onclick="startExam(${exam.id})">
                            ${userAttempts.length > 0 ? 'Retake Exam' : 'Start Exam'}
                        </button>
                    ` : ''}
                    ${userAttempts.length > 0 ? `
                        <button class="btn btn-outline view-results" onclick="viewExamResults(${exam.id})">
                            View Results
                        </button>
                    ` : ''}
                    <button class="btn btn-outline preview-exam" onclick="previewExam(${exam.id})">
                        Preview Questions
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Filter controls
    const levelFilter = document.getElementById('level-filter');
    const categoryFilter = document.getElementById('category-filter');
    const difficultyFilter = document.getElementById('difficulty-filter');

    if (levelFilter) {
        levelFilter.addEventListener('change', filterExams);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterExams);
    }
    if (difficultyFilter) {
        difficultyFilter.addEventListener('change', filterExams);
    }

    // Search functionality
    const searchInput = document.getElementById('exam-search');
    if (searchInput) {
        searchInput.addEventListener('input', searchExams);
    }
}

// Filter exams
function filterExams() {
    const levelFilter = document.getElementById('level-filter')?.value || 'all';
    const categoryFilter = document.getElementById('category-filter')?.value || 'all';
    const difficultyFilter = document.getElementById('difficulty-filter')?.value || 'all';

    let filteredExams = examData.filter(exam => {
        return (levelFilter === 'all' || exam.level === levelFilter) &&
            (categoryFilter === 'all' || exam.category === categoryFilter) &&
            (difficultyFilter === 'all' || exam.difficulty.toLowerCase() === difficultyFilter);
    });

    displayExams(filteredExams);
}

// Search exams
function searchExams(event) {
    const searchTerm = event.target.value.toLowerCase();

    let filteredExams = examData.filter(exam => {
        return exam.title.toLowerCase().includes(searchTerm) ||
            exam.description.toLowerCase().includes(searchTerm) ||
            exam.category.toLowerCase().includes(searchTerm);
    });

    displayExams(filteredExams);
}

// Start exam
function startExam(examId) {
    const exam = examData.find(e => e.id === examId);
    if (!exam) return;

    // Check attempts remaining
    const userAttempts = getExamAttempts(examId);
    if (userAttempts.length >= exam.attempts) {
        alert('You have exhausted all attempts for this exam.');
        return;
    }

    // Check prerequisites
    if (exam.prerequisite && !checkPrerequisite(exam.prerequisite)) {
        alert(`You must complete the prerequisite: ${exam.prerequisite}`);
        return;
    }

    // Confirm exam start
    const confirmMessage = `
        You are about to start: ${exam.title}
        
        Duration: ${exam.duration} minutes
        Questions: ${exam.questions}
        Passing Score: ${exam.passingScore}%
        Attempts Remaining: ${exam.attempts - userAttempts.length}
        
        Are you ready to begin?
    `;

    if (confirm(confirmMessage)) {
        // Store exam session data
        sessionStorage.setItem('currentExam', JSON.stringify(exam));
        sessionStorage.setItem('examStartTime', Date.now());

        // Navigate to exam session page
        window.location.href = 'exam-session.html';
    }
}

// Preview exam questions
function previewExam(examId) {
    const exam = examData.find(e => e.id === examId);
    if (!exam) return;

    // Show preview modal or navigate to preview page
    sessionStorage.setItem('previewExam', JSON.stringify(exam));
    window.location.href = 'exam-preview.html';
}

// View exam results
function viewExamResults(examId) {
    const attempts = getExamAttempts(examId);
    if (attempts.length === 0) return;

    // Navigate to results page
    sessionStorage.setItem('examResultsId', examId);
    window.location.href = 'exam-results.html';
}

// Check prerequisite completion
function checkPrerequisite(prerequisite) {
    const userData = getUserData();
    const examHistory = userData.examHistory || [];

    // Check if prerequisite exam was passed
    return examHistory.some(attempt =>
        attempt.examTitle === prerequisite &&
        attempt.passed
    );
}

// Get exam attempts for a specific exam
function getExamAttempts(examId) {
    const userData = getUserData();
    const examHistory = userData.examHistory || [];

    return examHistory.filter(attempt => attempt.examId === examId);
}

// Update exam history
function updateExamHistory(examId, score, timeSpent, answers) {
    const exam = examData.find(e => e.id === examId);
    if (!exam) return;

    const userData = getUserData();
    if (!userData.examHistory) {
        userData.examHistory = [];
    }

    const attempt = {
        examId: examId,
        examTitle: exam.title,
        score: score,
        passed: score >= exam.passingScore,
        timeSpent: timeSpent,
        answers: answers,
        date: new Date().toISOString(),
        certification: exam.certification
    };

    userData.examHistory.push(attempt);

    // Update certifications if passed
    if (attempt.passed) {
        if (!userData.certifications) {
            userData.certifications = [];
        }

        if (!userData.certifications.some(cert => cert.examId === examId)) {
            userData.certifications.push({
                examId: examId,
                title: exam.certification,
                dateEarned: attempt.date,
                score: score
            });
        }
    }

    saveUserData(userData);
}

// Load and display exam history
function loadExamHistory() {
    const userData = getUserData();
    const history = userData.examHistory || [];

    const historyContainer = document.getElementById('exam-history');
    if (!historyContainer) return;

    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="no-history">No exam attempts yet.</p>';
        return;
    }

    // Group by exam
    const groupedHistory = {};
    history.forEach(attempt => {
        if (!groupedHistory[attempt.examId]) {
            groupedHistory[attempt.examId] = [];
        }
        groupedHistory[attempt.examId].push(attempt);
    });

    historyContainer.innerHTML = Object.entries(groupedHistory).map(([examId, attempts]) => {
        const latestAttempt = attempts[attempts.length - 1];
        const bestScore = Math.max(...attempts.map(a => a.score));

        return `
            <div class="history-item ${latestAttempt.passed ? 'passed' : 'failed'}">
                <div class="history-header">
                    <h4>${latestAttempt.examTitle}</h4>
                    <span class="status ${latestAttempt.passed ? 'pass' : 'fail'}">
                        ${latestAttempt.passed ? 'PASSED' : 'FAILED'}
                    </span>
                </div>
                <div class="history-stats">
                    <div class="stat">
                        <label>Latest Score:</label>
                        <span>${latestAttempt.score}%</span>
                    </div>
                    <div class="stat">
                        <label>Best Score:</label>
                        <span>${bestScore}%</span>
                    </div>
                    <div class="stat">
                        <label>Attempts:</label>
                        <span>${attempts.length}</span>
                    </div>
                    <div class="stat">
                        <label>Last Taken:</label>
                        <span>${new Date(latestAttempt.date).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="btn btn-sm btn-outline" onclick="viewDetailedResults(${examId})">
                    View Details
                </button>
            </div>
        `;
    }).join('');
}

// View detailed results for an exam
function viewDetailedResults(examId) {
    sessionStorage.setItem('examResultsId', examId);
    window.location.href = 'exam-results.html';
}

// Get exam statistics
function getExamStats() {
    const userData = getUserData();
    const history = userData.examHistory || [];
    const certifications = userData.certifications || [];

    if (history.length === 0) {
        return {
            totalAttempts: 0,
            examsPassed: 0,
            averageScore: 0,
            certificationsEarned: 0,
            passRate: 0
        };
    }

    const totalAttempts = history.length;
    const examsPassed = history.filter(attempt => attempt.passed).length;
    const averageScore = history.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts;
    const certificationsEarned = certifications.length;
    const passRate = (examsPassed / totalAttempts) * 100;

    return {
        totalAttempts,
        examsPassed,
        averageScore: Math.round(averageScore),
        certificationsEarned,
        passRate: Math.round(passRate)
    };
}

// Display exam statistics
function displayExamStats() {
    const stats = getExamStats();
    const statsContainer = document.getElementById('exam-stats');

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${stats.totalAttempts}</div>
                <div class="stat-label">Total Attempts</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.examsPassed}</div>
                <div class="stat-label">Exams Passed</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.averageScore}%</div>
                <div class="stat-label">Average Score</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.certificationsEarned}</div>
                <div class="stat-label">Certifications</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.passRate}%</div>
                <div class="stat-label">Pass Rate</div>
            </div>
        `;
    }
}

// Get user data from localStorage
function getUserData() {
    try {
        return JSON.parse(localStorage.getItem('userData')) || {};
    } catch (error) {
        console.error('Error parsing user data:', error);
        return {};
    }
}

// Save user data to localStorage
function saveUserData(userData) {
    try {
        localStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

// Initialize stats on page load
document.addEventListener('DOMContentLoaded', function () {
    displayExamStats();
});