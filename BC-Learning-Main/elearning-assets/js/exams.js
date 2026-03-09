// Exam System functionality
document.addEventListener('DOMContentLoaded', function () {
    loadAvailableExams();
    setupEventListeners();
    initializeProctoring();
});

// Exam data structure
const examData = [
    {
        id: 'autocad-certification',
        title: 'AutoCAD Certified User Exam',
        category: 'autocad',
        level: 'beginner',
        requiredLevel: 'BIM Modeller',
        duration: 90, // minutes
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
        retakePeriod: 7, // days
        lastAttempt: null,
        certification: {
            title: 'AutoCAD Certified User',
            issuer: 'BC Learning Academy',
            validFor: 24 // months
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

// Sample exam questions (in real system, these would be loaded from secure backend)
const examQuestions = {
    'autocad-certification': [
        {
            id: 1,
            question: "What is the primary purpose of layers in AutoCAD?",
            type: "multiple-choice",
            options: [
                "To organize drawing objects by function or appearance",
                "To create 3D objects",
                "To add text annotations",
                "To set printing parameters"
            ],
            correct: 0,
            category: "layers",
            difficulty: "easy",
            explanation: "Layers help organize drawing objects by grouping them logically based on function, appearance, or other criteria."
        },
        {
            id: 2,
            question: "Which command creates a parallel copy of an object at a specified distance?",
            type: "multiple-choice",
            options: ["COPY", "MOVE", "OFFSET", "MIRROR"],
            correct: 2,
            category: "editing",
            difficulty: "easy",
            explanation: "The OFFSET command creates parallel copies of objects at a specified distance from the original."
        },
        {
            id: 3,
            question: "What is the keyboard shortcut for the CIRCLE command?",
            type: "multiple-choice",
            options: ["CI", "C", "CIR", "CIRCLE"],
            correct: 1,
            category: "commands",
            difficulty: "easy",
            explanation: "The keyboard shortcut for the CIRCLE command is 'C'."
        }
        // Add more questions...
    ]
};

let currentExam = null;
let currentQuestionIndex = 0;
let examAnswers = [];
let examStartTime = null;
let examTimer = null;
let proctoring = {
    cameraActive: false,
    microphoneActive: false,
    violations: []
};

function getAuthToken() {
    return localStorage.getItem('token') || '';
}

function getAuthenticatedUser() {
    try {
        return JSON.parse(localStorage.getItem('user')) || null;
    } catch (error) {
        return null;
    }
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
                difficulty: currentExam.difficulty || null,
                requiredLevel: currentExam.requiredLevel || null
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

        const data = await response.json();
        console.log('Exam result synced:', data);
        return data;
    } catch (error) {
        console.warn('Exam result sync skipped:', error.message);
        return null;
    }
}

function loadAvailableExams() {
    const userData = getUserData();
    const userLevel = userData?.level || 'BIM Modeller';

    const container = document.getElementById('exams-container');
    container.innerHTML = '';

    examData.forEach(exam => {
        const canTakeExam = checkExamEligibility(exam, userData);
        const examCard = createExamCard(exam, canTakeExam);
        container.appendChild(examCard);
    });
}

function checkExamEligibility(exam, userData) {
    const userLevel = userData?.level || 'BIM Modeller';
    const levelOrder = ['BIM Modeller', 'BIM Coordinator', 'BIM Manager'];
    const requiredLevelIndex = levelOrder.indexOf(exam.requiredLevel);
    const userLevelIndex = levelOrder.indexOf(userLevel);

    // Check level requirement
    if (userLevelIndex < requiredLevelIndex) {
        return { eligible: false, reason: 'level', required: exam.requiredLevel };
    }

    // Check attempt limits
    if (exam.attempts >= exam.maxAttempts) {
        return { eligible: false, reason: 'attempts', maxAttempts: exam.maxAttempts };
    }

    // Check retake period
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

    // Check prerequisites (simplified - in real system would check actual completion)
    const missingPrerequisites = exam.prerequisites.filter(prereq => !checkPrerequisiteCompleted(prereq, userData));
    if (missingPrerequisites.length > 0) {
        return {
            eligible: false,
            reason: 'prerequisites',
            missing: missingPrerequisites
        };
    }

    return { eligible: true };
}

function checkPrerequisiteCompleted(prerequisite, userData) {
    const completed = Array.isArray(userData?.completedPrerequisites)
        ? userData.completedPrerequisites
        : [];
    if (completed.length > 0) {
        return completed.includes(prerequisite);
    }
    // Default true to avoid random locking behavior.
    return true;
}

function createExamCard(exam, eligibility) {
    const card = document.createElement('div');
    card.className = 'box';

    const statusClass = eligibility.eligible ? 'available' : 'locked';
    const statusIcon = eligibility.eligible ? 'fas fa-play-circle' : 'fas fa-lock';

    card.innerHTML = `
        <div class="exam-card ${statusClass}">
            <div class="exam-header">
                <h3>${exam.title}</h3>
                <div class="exam-badges">
                    <span class="level-badge">${exam.requiredLevel}</span>
                    <span class="duration-badge">${exam.duration} min</span>
                    <span class="questions-badge">${exam.questionCount} questions</span>
                </div>
            </div>

            <div class="exam-info">
                <p>${exam.description}</p>

                <div class="exam-details">
                    <div class="detail-row">
                        <span><i class="fas fa-target"></i> Passing Score:</span>
                        <span>${exam.passingScore}%</span>
                    </div>
                    <div class="detail-row">
                        <span><i class="fas fa-redo"></i> Attempts:</span>
                        <span>${exam.attempts}/${exam.maxAttempts}</span>
                    </div>
                    <div class="detail-row">
                        <span><i class="fas fa-certificate"></i> Certification:</span>
                        <span>${exam.certification.title}</span>
                    </div>
                </div>

                <div class="exam-syllabus">
                    <h4>Exam Topics:</h4>
                    <ul>
                        ${exam.syllabus.map(topic => `<li>${topic}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="exam-actions">
                ${eligibility.eligible ?
            `<button class="btn take-exam" onclick="prepareExam('${exam.id}')" style="background-color: #8e44ad !important; color: #000 !important; border: none !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important;">
                        <i class="${statusIcon}"></i> Take Exam
                    </button>` :
            `<button class="btn locked-exam" onclick="showPrerequisites('${exam.id}', '${eligibility.reason}')" style="background-color: #9ca3af !important; color: #fff !important; cursor: not-allowed !important;">
                        <i class="${statusIcon}"></i> ${getIneligibilityMessage(eligibility)}
                    </button>`
        }
            </div>
        </div>
    `;

    return card;
}

function getIneligibilityMessage(eligibility) {
    switch (eligibility.reason) {
        case 'level':
            return `Requires ${eligibility.required}`;
        case 'attempts':
            return `Max attempts reached`;
        case 'retake':
            return `Available in ${eligibility.daysRemaining} days`;
        case 'prerequisites':
            return `Prerequisites required`;
        default:
            return 'Not available';
    }
}

function showPrerequisites(examId, reason) {
    const exam = examData.find(e => e.id === examId);
    if (!exam) return;

    const modal = document.getElementById('prerequisites-modal');
    const list = document.getElementById('prerequisites-list');

    if (reason === 'prerequisites') {
        const userData = getUserData();
        const missingPrereqs = exam.prerequisites.filter(prereq => !checkPrerequisiteCompleted(prereq, userData));

        list.innerHTML = missingPrereqs.map(prereq =>
            `<li><i class="fas fa-times text-danger"></i> ${formatPrerequisite(prereq)}</li>`
        ).join('');
    } else {
        list.innerHTML = `<li>Current restriction: ${getIneligibilityMessage({ reason })}</li>`;
    }

    modal.style.display = 'flex';
}

function formatPrerequisite(prereq) {
    // Convert prerequisite codes to readable names
    const formatMap = {
        'autocad-basics-course': 'AutoCAD Basics Course',
        'autocad-practice-80': 'AutoCAD Practice (80% score)',
        'revit-basics-course': 'Revit Basics Course',
        'revit-advanced-course': 'Revit Advanced Course',
        'bim-coordination-course': 'BIM Coordination Course',
        'bim-strategy-course': 'BIM Strategy Course',
        'project-management-course': 'Project Management Course',
        'leadership-training': 'Leadership Training'
    };

    return formatMap[prereq] || prereq;
}

function prepareExam(examId) {
    currentExam = examData.find(e => e.id === examId);
    if (!currentExam) return;

    // Show preparation modal
    const modal = document.getElementById('exam-prep-modal');
    const details = document.getElementById('exam-details');

    details.innerHTML = `
        <div class="exam-overview">
            <h4>${currentExam.title}</h4>
            <div class="exam-specs">
                <div class="spec">
                    <i class="fas fa-clock"></i>
                    <span>Duration: ${currentExam.duration} minutes</span>
                </div>
                <div class="spec">
                    <i class="fas fa-question-circle"></i>
                    <span>Questions: ${currentExam.questionCount}</span>
                </div>
                <div class="spec">
                    <i class="fas fa-target"></i>
                    <span>Passing Score: ${currentExam.passingScore}%</span>
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
        </div>
    `;

    modal.style.display = 'flex';
}

function startExam() {
    if (!currentExam) return;

    // Hide prep modal and show exam interface
    document.getElementById('exam-prep-modal').style.display = 'none';
    document.getElementById('exam-interface').style.display = 'block';

    // Initialize exam
    examStartTime = Date.now();
    currentQuestionIndex = 0;
    examAnswers = new Array(currentExam.questionCount).fill(null);

    // Start timer
    startExamTimer();

    // Enable full-screen mode
    requestFullscreen();

    // Start proctoring
    startProctoring();

    // Load questions
    loadExamQuestions();

    // Load first question
    displayQuestion();
}

function startExamTimer() {
    const timerElement = document.getElementById('time-remaining');
    let timeLeft = currentExam.duration * 60; // Convert to seconds

    examTimer = setInterval(() => {
        timeLeft--;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Warning colors
        if (timeLeft <= 300) { // 5 minutes
            timerElement.style.color = '#EF4444';
        } else if (timeLeft <= 600) { // 10 minutes
            timerElement.style.color = '#F59E0B';
        }

        if (timeLeft <= 0) {
            clearInterval(examTimer);
            submitExam(true); // Auto-submit when time expires
        }
    }, 1000);
}

function loadExamQuestions() {
    const questions = examQuestions[currentExam.id] || [];

    // Generate question navigation grid
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';

    for (let i = 0; i < currentExam.questionCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'question-nav-btn';
        btn.textContent = i + 1;
        btn.onclick = () => navigateToQuestion(i);
        btn.id = `nav-btn-${i}`;
        grid.appendChild(btn);
    }
}

function displayQuestion() {
    const questions = examQuestions[currentExam.id] || [];
    const question = questions[currentQuestionIndex % questions.length]; // Cycle if not enough questions

    if (!question) return;

    document.getElementById('question-number').textContent = `Question ${currentQuestionIndex + 1}`;
    document.getElementById('question-text').textContent = question.question;
    document.getElementById('question-progress').textContent = `${currentQuestionIndex + 1} / ${currentExam.questionCount}`;

    // Load options
    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <input type="radio" id="option-${index}" name="exam-option" value="${index}">
            <label for="option-${index}">${option}</label>
        `;

        // Check if previously answered
        if (examAnswers[currentQuestionIndex] === index) {
            optionDiv.querySelector('input').checked = true;
        }

        optionDiv.addEventListener('click', () => {
            optionDiv.querySelector('input').checked = true;
            examAnswers[currentQuestionIndex] = index;
            updateQuestionNavigation();
        });

        optionsContainer.appendChild(optionDiv);
    });

    // Update navigation buttons
    document.getElementById('prev-question').disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === currentExam.questionCount - 1) {
        document.getElementById('next-question').style.display = 'none';
        document.getElementById('submit-exam').style.display = 'inline-block';
    } else {
        document.getElementById('next-question').style.display = 'inline-block';
        document.getElementById('submit-exam').style.display = 'none';
    }

    updateQuestionNavigation();
}

function updateQuestionNavigation() {
    // Update navigation button states
    for (let i = 0; i < currentExam.questionCount; i++) {
        const btn = document.getElementById(`nav-btn-${i}`);
        if (btn) {
            btn.className = 'question-nav-btn';

            if (i === currentQuestionIndex) {
                btn.classList.add('current');
            }

            if (examAnswers[i] !== null) {
                btn.classList.add('answered');
            }
        }
    }
}

function navigateToQuestion(index) {
    if (index >= 0 && index < currentExam.questionCount) {
        currentQuestionIndex = index;
        displayQuestion();
    }
}

function submitExam(autoSubmit = false) {
    if (!autoSubmit) {
        const unanswered = examAnswers.filter(answer => answer === null).length;
        if (unanswered > 0) {
            const confirm = window.confirm(`You have ${unanswered} unanswered questions. Are you sure you want to submit?`);
            if (!confirm) return;
        }
    }

    // Stop timer and proctoring
    if (examTimer) clearInterval(examTimer);
    stopProctoring();
    exitFullscreen();

    // Calculate results
    const results = calculateExamResults();

    // Hide exam interface
    document.getElementById('exam-interface').style.display = 'none';

    // Show results
    showExamResults(results);

    // Update exam data
    updateExamAttempt(results);

    // Sync attempt to backend so dashboard and mapping data are consistent.
    syncExamAttemptToServer(results);
}

function calculateExamResults() {
    const questions = examQuestions[currentExam.id] || [];
    let correctCount = 0;
    const categoryPerformance = {};

    examAnswers.forEach((answer, index) => {
        const question = questions[index % questions.length];
        if (question) {
            const category = question.category;
            if (!categoryPerformance[category]) {
                categoryPerformance[category] = { correct: 0, total: 0 };
            }

            categoryPerformance[category].total++;

            if (answer === question.correct) {
                correctCount++;
                categoryPerformance[category].correct++;
            }
        }
    });

    const percentage = Math.round((correctCount / currentExam.questionCount) * 100);
    const passed = percentage >= currentExam.passingScore;
    const timeTaken = Date.now() - examStartTime;

    return {
        correct: correctCount,
        total: currentExam.questionCount,
        percentage,
        passed,
        timeTaken,
        categoryPerformance,
        violations: proctoring.violations
    };
}

function showExamResults(results) {
    const modal = document.getElementById('exam-results-modal');

    // Update score display
    document.getElementById('final-score-percentage').textContent = `${results.percentage}%`;
    document.getElementById('total-questions').textContent = results.total;
    document.getElementById('correct-answers').textContent = results.correct;
    document.getElementById('wrong-answers').textContent = results.total - results.correct;

    const minutes = Math.floor(results.timeTaken / 60000);
    const seconds = Math.floor((results.timeTaken % 60000) / 1000);
    document.getElementById('time-taken').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update status
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

    // Show category breakdown
    const breakdownContainer = document.getElementById('category-breakdown');
    breakdownContainer.innerHTML = '<h4>Performance by Category:</h4>';

    Object.entries(results.categoryPerformance).forEach(([category, performance]) => {
        const percentage = Math.round((performance.correct / performance.total) * 100);
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-result';
        categoryDiv.innerHTML = `
            <span class="category-name">${category.toUpperCase()}:</span>
            <span class="category-score">${performance.correct}/${performance.total} (${percentage}%)</span>
            <div class="category-bar">
                <div class="category-progress" style="width: ${percentage}%"></div>
            </div>
        `;
        breakdownContainer.appendChild(categoryDiv);
    });

    modal.style.display = 'flex';
}

function updateExamAttempt(results) {
    // Update exam attempt data
    const exam = examData.find(e => e.id === currentExam.id);
    if (exam) {
        exam.attempts++;
        exam.lastAttempt = new Date().toISOString();

        // In real system, this would be saved to backend
        console.log('Exam attempt recorded:', {
            examId: exam.id,
            results,
            attempt: exam.attempts
        });
    }
}

// Proctoring functions
function initializeProctoring() {
    // Initialize camera and microphone monitoring
    // In real system, this would integrate with actual proctoring service
}

function startProctoring() {
    proctoring.cameraActive = true;
    proctoring.microphoneActive = true;
    proctoring.violations = [];

    document.getElementById('camera-status').style.color = '#22C55E';

    // Monitor for violations
    monitorForViolations();
}

function stopProctoring() {
    proctoring.cameraActive = false;
    proctoring.microphoneActive = false;

    document.getElementById('camera-status').style.color = '#9CA3AF';
}

function monitorForViolations() {
    // Monitor for tab switching
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && proctoring.cameraActive) {
            proctoring.violations.push({
                type: 'tab_switch',
                timestamp: Date.now(),
                description: 'User switched browser tab'
            });
        }
    });

    // Monitor for fullscreen exit
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && proctoring.cameraActive) {
            proctoring.violations.push({
                type: 'fullscreen_exit',
                timestamp: Date.now(),
                description: 'User exited fullscreen mode'
            });
        }
    });
}

function requestFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function setupEventListeners() {
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Preparation checklist
    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    const startBtn = document.getElementById('start-exam');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            startBtn.disabled = !allChecked;
        });
    });

    // Exam navigation
    document.getElementById('prev-question')?.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    });

    document.getElementById('next-question')?.addEventListener('click', () => {
        if (currentQuestionIndex < currentExam.questionCount - 1) {
            currentQuestionIndex++;
            displayQuestion();
        }
    });

    // Other event listeners
    document.getElementById('start-exam')?.addEventListener('click', startExam);
    document.getElementById('submit-exam')?.addEventListener('click', () => submitExam(false));
    document.getElementById('cancel-exam')?.addEventListener('click', () => {
        document.getElementById('exam-prep-modal').style.display = 'none';
    });
    document.getElementById('back-to-exams')?.addEventListener('click', () => {
        document.getElementById('exam-results-modal').style.display = 'none';
        loadAvailableExams();
    });
}

// Helper function to get user data
function getUserData() {
    const authUser = localStorage.getItem('user');
    if (authUser) {
        try {
            return JSON.parse(authUser);
        } catch (e) {
            console.error('Error parsing auth user data:', e);
        }
    }

    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    return null;
}
