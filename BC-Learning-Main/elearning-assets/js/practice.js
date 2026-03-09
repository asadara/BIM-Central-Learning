// Practice Questions functionality
document.addEventListener('DOMContentLoaded', function () {
    // Load enhanced practice system first
    loadEnhancedPracticeSystem().then(() => {
        loadPracticeSets();
        setupEventListeners();
    });
});

// Load enhanced practice system
function loadEnhancedPracticeSystem() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/elearning-assets/js/enhanced-practice-questions.js';
        script.onload = () => {
            console.log('Enhanced Practice Questions loaded successfully');
            resolve();
        };
        script.onerror = () => {
            console.warn('Could not load enhanced practice questions, using fallback data');
            resolve();
        };
        document.head.appendChild(script);
    });
}

// Fisher-Yates shuffle algorithm for random selection
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Generate random quiz with 20 questions from BIM Modeller level
function generateRandomQuiz() {
    console.log('🔄 Generating random quiz...');
    console.log('Enhanced questions loaded:', typeof window.enhancedPracticeQuestions);

    let allQuestions = [];

    if (typeof window.enhancedPracticeQuestions !== 'undefined') {
        const userLevel = 'BIM Modeller'; // Focus on BIM Modeller level
        const levelQuestions = window.enhancedPracticeQuestions[userLevel] || {};

        console.log('Level questions keys:', Object.keys(levelQuestions));

        // Collect all questions from BIM Modeller level
        if (levelQuestions.categories) {
            console.log('Categories object:', levelQuestions.categories);
            console.log('Categories keys:', Object.keys(levelQuestions.categories));
            Object.keys(levelQuestions.categories).forEach(categoryKey => {
                const categoryData = levelQuestions.categories[categoryKey];
                const categoryQuestions = categoryData.questions || [];
                console.log(`Category ${categoryKey}: ${categoryQuestions.length} questions from ${categoryData.title}`);
                categoryQuestions.forEach(q => {
                    allQuestions.push({
                        ...q,
                        category: categoryKey,
                        sourceCategory: categoryData.title
                    });
                });
            });
        }

        console.log(`Total questions collected: ${allQuestions.length}`);
    }

    // If no questions from enhanced system, use fallback
    if (allQuestions.length === 0) {
        console.log('⚠️ No questions from enhanced system, using fallback');
        const fallbackData = getFallbackPracticeData();
        allQuestions = fallbackData[0].questions_data.map(q => ({
            ...q,
            category: 'fallback',
            sourceCategory: 'Fallback Questions'
        }));
    }

    // Shuffle and select 20 questions (or all if less than 20)
    const shuffledQuestions = shuffleArray(allQuestions);
    const selectedQuestions = shuffledQuestions.slice(0, Math.min(20, shuffledQuestions.length));

    // Create random quiz set
    const randomQuizSet = {
        id: 'random-quiz-' + Date.now(),
        title: '🎲 Random Practice Quiz (20 Questions)',
        category: 'mixed',
        level: 'bim_modeller',
        difficulty: 'Mixed',
        questions: selectedQuestions.length,
        timeLimit: selectedQuestions.length * 60, // 1 minute per question
        description: `Random quiz with ${selectedQuestions.length} questions from BIM Modeller topics`,
        isRandomQuiz: true,
        questions_data: selectedQuestions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correct: typeof q.correct === 'number' ? q.correct : (typeof q.correctAnswer === 'number' ? q.correctAnswer : q.options.indexOf(q.correctAnswer)),
            explanation: q.explanation,
            learningObjective: q.learningObjective || 'Practice BIM concepts',
            category: q.category,
            sourceCategory: q.sourceCategory,
            practicalScenario: q.practicalScenario,
            imageUrl: q.imageUrl // Preserve image URL
        }))
    };

    console.log(`✅ Generated random quiz with ${selectedQuestions.length} questions from ${allQuestions.length} available questions`);
    return [randomQuizSet];
}

// Get practice questions from enhanced system or fallback
function getPracticeQuestions() {
    if (typeof window.enhancedPracticeQuestions !== 'undefined') {
        const userData = getUserData();
        const userLevel = userData?.level || 'BIM Modeller';

        // Get questions for user's level
        const levelQuestions = window.enhancedPracticeQuestions[userLevel] || {};

        // Convert to practice sets format
        const practiceSets = [];
        Object.keys(levelQuestions.categories).forEach(categoryKey => {
            const categoryData = levelQuestions.categories[categoryKey];
            const questions = categoryData.questions || [];
            const questionSets = {};

            // Group by difficulty
            questions.forEach(q => {
                const difficulty = q.difficulty || 'Beginner';
                if (!questionSets[difficulty]) {
                    questionSets[difficulty] = [];
                }
                questionSets[difficulty].push(q);
            });

            // Create practice sets for each difficulty
            Object.keys(questionSets).forEach(difficulty => {
                const setQuestions = questionSets[difficulty];
                if (setQuestions.length >= 3) { // Minimum 3 questions for a set (reduced for testing)
                    practiceSets.push({
                        id: practiceSets.length + 1,
                        title: `${categoryData.title} - ${difficulty}`,
                        category: categoryKey,
                        level: userLevel.toLowerCase().replace(' ', '_'),
                        difficulty: difficulty,
                        questions: Math.min(setQuestions.length, 15), // Max 15 per set
                        timeLimit: Math.min(setQuestions.length, 15) * 60, // 1 minute per question
                        description: `${difficulty} level ${categoryData.title} questions for ${userLevel}`,
                        questions_data: setQuestions.slice(0, 15).map(q => ({
                            question: q.question,
                            options: q.options,
                            correct: typeof q.correctAnswer === 'number' ? q.correctAnswer : q.options.indexOf(q.correctAnswer),
                            explanation: q.explanation,
                            learningObjective: q.learningObjective || 'Practice BIM concepts',
                            practicalScenario: q.practicalScenario
                        }))
                    });
                }
            });
        });

        // Add random quiz option at the beginning
        const randomQuiz = generateRandomQuiz();
        if (randomQuiz && randomQuiz.length > 0) {
            practiceSets.unshift(randomQuiz[0]);
            console.log(`✅ Added random quiz at the beginning. Total practice sets: ${practiceSets.length}`);
        } else {
            console.warn('⚠️ Random quiz not generated');
        }

        console.log(`Generated ${practiceSets.length} practice sets from enhanced questions (including random quiz)`);
        return practiceSets;
    } else {
        console.log('Using fallback practice questions');
        return getFallbackPracticeData();
    }
}

// Fallback practice data
function getFallbackPracticeData() {
    return [
        {
            id: 1,
            title: "AutoCAD 2D Basics",
            category: "autocad",
            level: "beginner",
            difficulty: "Easy",
            questions: 10,
            timeLimit: 300,
            description: "Test your knowledge of AutoCAD 2D drawing basics",
            questions_data: [
                {
                    question: "What is the keyboard shortcut for the LINE command in AutoCAD?",
                    options: ["L", "LI", "LINE", "LN"],
                    correct: 0,
                    explanation: "The keyboard shortcut for the LINE command is 'L'."
                },
                {
                    question: "Which command is used to create a circle in AutoCAD?",
                    options: ["CIRC", "C", "CIRCLE", "CR"],
                    correct: 1,
                    explanation: "The keyboard shortcut for the CIRCLE command is 'C'."
                },
                {
                    question: "What does the OFFSET command do?",
                    options: ["Moves objects", "Copies objects at a distance", "Rotates objects", "Scales objects"],
                    correct: 1,
                    explanation: "OFFSET creates parallel copies of objects at a specified distance."
                }
            ]
        },
        {
            id: 2,
            title: "Revit Architecture Fundamentals",
            category: "revit",
            level: "beginner",
            difficulty: "Easy",
            questions: 12,
            timeLimit: 360,
            description: "Basic concepts of Revit Architecture modeling",
            questions_data: [
                {
                    question: "What is a family in Revit?",
                    options: ["A collection of elements", "A parametric object", "A project file", "A view type"],
                    correct: 1,
                    explanation: "A family in Revit is a parametric object that can contain geometry and data."
                },
                {
                    question: "Which view type shows the building in 3D?",
                    options: ["Plan view", "Section view", "Elevation view", "3D view"],
                    correct: 3,
                    explanation: "The 3D view shows the building model in three dimensions."
                }
            ]
        },
        {
            id: 3,
            title: "BIM Coordination Principles",
            category: "general",
            level: "intermediate",
            difficulty: "Medium",
            questions: 15,
            timeLimit: 450,
            description: "Understanding BIM coordination workflows and clash detection",
            questions_data: [
                {
                    question: "What is the primary purpose of clash detection in BIM?",
                    options: ["Design validation", "Cost estimation", "Schedule optimization", "Material takeoff"],
                    correct: 0,
                    explanation: "Clash detection identifies conflicts between different building systems in the model."
                }
            ]
        }
    ];
}

// Initialize practice data
let practiceData = [];

// Load practice sets with enhanced data
function loadPracticeSets() {
    practiceData = getPracticeQuestions();
    displayPracticeSets(practiceData);
}

// Display practice sets
function displayPracticeSets(sets) {
    const container = document.getElementById('practice-container');
    if (!container) {
        console.error('Practice container not found!');
        return;
    }

    console.log('🎯 Displaying practice sets:', sets.length, 'sets');
    sets.forEach((set, index) => {
        console.log(`  ${index + 1}. ${set.title} (${set.questions} questions)`);
    });

    container.innerHTML = sets.map(set => `
        <div class="practice-set-card" data-id="${set.id}">
            <div class="set-header">
                <h3>${set.title}</h3>
                <div class="set-badges">
                    <span class="difficulty-badge ${set.difficulty.toLowerCase()}">${set.difficulty}</span>
                    <span class="category-badge">${set.category}</span>
                </div>
            </div>
            <div class="set-info">
                <p class="set-description">${set.description}</p>
                <div class="set-stats">
                    <div class="stat">
                        <i class="fas fa-question-circle"></i>
                        <span>${set.questions} Questions</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${Math.floor(set.timeLimit / 60)} minutes</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-chart-line"></i>
                        <span>${set.level}</span>
                    </div>
                </div>
            </div>
            <div class="set-actions">
                <button class="btn btn-primary start-practice" onclick="startPractice('${set.id}')">
                    Start Practice
                </button>
                <button class="btn btn-outline review-questions" onclick="reviewQuestions('${set.id}')">
                    Review Questions
                </button>
            </div>
        </div>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('practice-search');
    if (searchInput) {
        searchInput.addEventListener('input', searchPracticeSets);
    }
}



// Search practice sets
function searchPracticeSets(event) {
    const searchTerm = event.target.value.toLowerCase();

    let filteredSets = practiceData.filter(set => {
        return set.title.toLowerCase().includes(searchTerm) ||
            set.description.toLowerCase().includes(searchTerm) ||
            set.category.toLowerCase().includes(searchTerm);
    });

    displayPracticeSets(filteredSets);
}

// Global variables for quiz functionality
let currentPracticeSet = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizStartTime = 0;
let timerInterval = null;
let isReviewMode = false;

// Start practice session in modal
function startPractice(setId) {
    console.log('🎯 Starting practice with setId:', setId);
    console.log('Available practice sets:', practiceData.map(set => ({ id: set.id, title: set.title })));

    const practiceSet = practiceData.find(set => set.id.toString() == setId.toString());
    if (!practiceSet) {
        console.error('❌ Practice set not found for id:', setId);
        return;
    }

    console.log('✅ Found practice set:', practiceSet.title);

    // Initialize quiz
    currentPracticeSet = practiceSet;
    currentQuestionIndex = 0;
    userAnswers = new Array(practiceSet.questions_data.length).fill(null);
    quizStartTime = Date.now();
    isReviewMode = false;

    // Show quiz modal
    showQuizModal();
    loadCurrentQuestion();
    startTimer();
}

// Review questions without timer in modal
function reviewQuestions(setId) {
    const practiceSet = practiceData.find(set => set.id === setId);
    if (!practiceSet) return;

    // Initialize review
    currentPracticeSet = practiceSet;
    currentQuestionIndex = 0;
    userAnswers = new Array(practiceSet.questions_data.length).fill(null);
    isReviewMode = true;

    // Show quiz modal in review mode
    showQuizModal();
    loadCurrentQuestion();
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

function getAuthenticatedUser() {
    try {
        return JSON.parse(localStorage.getItem('user')) || null;
    } catch (error) {
        return null;
    }
}

function getAuthToken() {
    return localStorage.getItem('token') || '';
}

// Save user data to localStorage
function saveUserData(userData) {
    try {
        localStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

async function submitPracticeResultToServer(setData, resultData) {
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
            quizId: `practice-${setData.id}`,
            quizName: setData.title || 'Practice Quiz',
            quizCategory: setData.category || 'practice',
            sourceType: 'practice',
            score: resultData.correctCount,
            totalQuestions: resultData.totalQuestions,
            percentage: resultData.score,
            passed: resultData.score >= 70,
            answers: Array.isArray(resultData.answers) ? resultData.answers : [],
            timeTaken: resultData.timeSpent,
            userId: authUser.id || authUser.userId || authUser.email || authUser.username || authUser.name || null,
            userName: authUser.name || authUser.username || null,
            userEmail: authUser.email || null,
            metadata: {
                difficulty: setData.difficulty || null,
                level: setData.level || null,
                randomQuiz: !!setData.isRandomQuiz
            }
        };

        const response = await fetch('/api/elearning/quiz/submit', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            console.warn('Practice result sync failed:', response.status, text);
        }
    } catch (error) {
        console.warn('Practice result sync skipped:', error.message);
    }
}

// Update practice history
function updatePracticeHistory(setId, score, timeSpent) {
    const userData = getUserData();
    if (!userData.practiceHistory) {
        userData.practiceHistory = [];
    }

    userData.practiceHistory.push({
        setId: setId,
        score: score,
        timeSpent: timeSpent,
        date: new Date().toISOString(),
        questions: practiceData.find(set => set.id === setId)?.questions || 0
    });

    // Keep only last 50 attempts
    if (userData.practiceHistory.length > 50) {
        userData.practiceHistory = userData.practiceHistory.slice(-50);
    }

    saveUserData(userData);
}

// Get practice statistics
function getPracticeStats() {
    const userData = getUserData();
    const history = userData.practiceHistory || [];

    if (history.length === 0) {
        return {
            totalAttempts: 0,
            averageScore: 0,
            totalTimeSpent: 0,
            improvementTrend: 0
        };
    }

    const totalAttempts = history.length;
    const averageScore = history.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts;
    const totalTimeSpent = history.reduce((sum, attempt) => sum + attempt.timeSpent, 0);

    // Calculate improvement trend (last 10 vs previous)
    let improvementTrend = 0;
    if (history.length >= 10) {
        const recent = history.slice(-5);
        const previous = history.slice(-10, -5);
        const recentAvg = recent.reduce((sum, attempt) => sum + attempt.score, 0) / recent.length;
        const previousAvg = previous.reduce((sum, attempt) => sum + attempt.score, 0) / previous.length;
        improvementTrend = recentAvg - previousAvg;
    }

    return {
        totalAttempts,
        averageScore: Math.round(averageScore),
        totalTimeSpent: Math.round(totalTimeSpent / 60), // Convert to minutes
        improvementTrend: Math.round(improvementTrend)
    };
}

// Display practice statistics
function displayPracticeStats() {
    const stats = getPracticeStats();
    const statsContainer = document.getElementById('practice-stats');

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${stats.totalAttempts}</div>
                <div class="stat-label">Total Attempts</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.averageScore}%</div>
                <div class="stat-label">Average Score</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.totalTimeSpent}m</div>
                <div class="stat-label">Time Spent</div>
            </div>
            <div class="stat-item">
                <div class="stat-number ${stats.improvementTrend >= 0 ? 'positive' : 'negative'}">
                    ${stats.improvementTrend >= 0 ? '+' : ''}${stats.improvementTrend}%
                </div>
                <div class="stat-label">Improvement</div>
            </div>
        `;
    }
}

// Quiz Modal Functions
function showQuizModal() {
    const modal = document.getElementById('quiz-modal');
    const title = document.getElementById('quiz-title');

    if (modal && title) {
        title.textContent = isReviewMode ? 'Review Questions' : currentPracticeSet.title;
        modal.style.display = 'flex';
    }
}

function hideQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function loadCurrentQuestion() {
    if (!currentPracticeSet || !currentPracticeSet.questions_data) return;

    const question = currentPracticeSet.questions_data[currentQuestionIndex];
    if (!question) return;

    const questionText = document.getElementById('question-text');
    const questionImageContainer = document.getElementById('question-image-container');
    const questionImage = document.getElementById('question-image');
    const optionsContainer = document.getElementById('options-container');
    const questionCounter = document.getElementById('question-counter');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    // Handle question text
    if (questionText) {
        questionText.textContent = question.question;
    }

    // Handle question image
    if (questionImageContainer && questionImage) {
        if (question.imageUrl || question.image) {
            const imageUrl = question.imageUrl || question.image;
            console.log('🖼️ Question has image:', {
                questionId: question.id,
                imageUrl: imageUrl,
                questionIndex: currentQuestionIndex
            });

            // Test if image loads
            questionImage.onload = function () {
                console.log('✅ Image loaded successfully:', imageUrl);
            };
            questionImage.onerror = function () {
                console.error('❌ Image failed to load:', imageUrl);
                console.error('❌ Image src set to:', questionImage.src);
            };

            questionImage.src = imageUrl;
            questionImage.alt = `Question ${currentQuestionIndex + 1} Image`;
            questionImageContainer.style.display = 'block';
            console.log('🖼️ Displaying question image:', imageUrl);
        } else {
            console.log('📝 Question has no image:', {
                questionId: question.id,
                questionIndex: currentQuestionIndex
            });
            questionImageContainer.style.display = 'none';
            questionImage.src = '';
        }
    }

    if (optionsContainer) {
        optionsContainer.innerHTML = question.options.map((option, index) => {
            const isSelected = userAnswers[currentQuestionIndex] === index;
            const isCorrect = !isReviewMode && index === question.correct;
            const isWrong = !isReviewMode && userAnswers[currentQuestionIndex] !== null &&
                userAnswers[currentQuestionIndex] === index && index !== question.correct;

            let className = 'option';
            if (isReviewMode) {
                if (index === question.correct) {
                    className += ' correct';
                } else if (isSelected && index !== question.correct) {
                    className += ' wrong';
                }
            } else if (isSelected) {
                className += ' selected';
            }

            return `
                <div class="${className}" onclick="selectOption(${index})">
                    <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                    ${isReviewMode && index === question.correct ? '<i class="fas fa-check correct-icon"></i>' : ''}
                    ${isReviewMode && isSelected && index !== question.correct ? '<i class="fas fa-times wrong-icon"></i>' : ''}
                </div>
            `;
        }).join('');
    }

    if (questionCounter) {
        questionCounter.textContent = `${currentQuestionIndex + 1} / ${currentPracticeSet.questions_data.length}`;
    }

    if (prevBtn) {
        prevBtn.disabled = currentQuestionIndex === 0;
    }

    if (nextBtn) {
        nextBtn.style.display = currentQuestionIndex === currentPracticeSet.questions_data.length - 1 ? 'none' : 'inline-block';
    }

    if (submitBtn) {
        submitBtn.style.display = currentQuestionIndex === currentPracticeSet.questions_data.length - 1 ? 'inline-block' : 'none';
    }
}

function selectOption(optionIndex) {
    console.log('🎯 Selecting option:', optionIndex, 'for question:', currentQuestionIndex);
    if (isReviewMode) {
        console.log('📖 Review mode - option selection disabled');
        return; // Can't change answers in review mode
    }

    userAnswers[currentQuestionIndex] = optionIndex;
    console.log('💾 Answer saved:', userAnswers);
    loadCurrentQuestion();
}

function nextQuestion() {
    if (currentQuestionIndex < currentPracticeSet.questions_data.length - 1) {
        currentQuestionIndex++;
        loadCurrentQuestion();
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadCurrentQuestion();
    }
}

function startTimer() {
    if (isReviewMode) return; // No timer in review mode

    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    let timeLeft = currentPracticeSet.timeLimit;

    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitQuiz();
        }
        timeLeft--;
    }, 1000);
}

function submitQuiz() {
    console.log('🎯 Submitting quiz...');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Calculate score
    let correctCount = 0;
    currentPracticeSet.questions_data.forEach((question, index) => {
        if (userAnswers[index] === question.correct) {
            correctCount++;
        }
    });

    const score = Math.round((correctCount / currentPracticeSet.questions_data.length) * 100);
    const timeSpent = Math.round((Date.now() - quizStartTime) / 1000);

    console.log('📊 Quiz results:', { correctCount, score, timeSpent, totalQuestions: currentPracticeSet.questions_data.length });

    // Update practice history
    updatePracticeHistory(currentPracticeSet.id, score, timeSpent);

    // Sync to backend (PostgreSQL-backed API)
    submitPracticeResultToServer(currentPracticeSet, {
        correctCount,
        totalQuestions: currentPracticeSet.questions_data.length,
        score,
        timeSpent,
        answers: userAnswers
    });

    // Hide quiz modal first
    hideQuizModal();

    // Show results modal after a small delay to ensure smooth transition
    setTimeout(() => {
        showResultsModal(correctCount, score, timeSpent);
    }, 100);
}

function showResultsModal(correctCount, score, timeSpent) {
    const modal = document.getElementById('results-modal');
    const scoreElement = document.getElementById('final-score');
    const messageElement = document.getElementById('score-message');
    const correctElement = document.getElementById('correct-count');
    const wrongElement = document.getElementById('wrong-count');
    const timeElement = document.getElementById('time-taken');

    if (modal && scoreElement && messageElement && correctElement && wrongElement && timeElement) {
        scoreElement.textContent = `${score}%`;
        messageElement.textContent = score >= 80 ? 'Excellent!' : score >= 60 ? 'Good job!' : 'Keep practicing!';

        correctElement.textContent = correctCount;
        wrongElement.textContent = currentPracticeSet.questions_data.length - correctCount;

        const minutes = Math.floor(timeSpent / 60);
        const seconds = timeSpent % 60;
        timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        modal.style.display = 'flex';
    }
}

function hideResultsModal() {
    const modal = document.getElementById('results-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function retryQuiz() {
    hideResultsModal();
    startPractice(currentPracticeSet.id);
}

// Add event listeners for modal controls
document.addEventListener('DOMContentLoaded', function () {
    // Quiz modal controls
    const closeQuizBtn = document.getElementById('close-quiz');
    const closeResultsBtn = document.getElementById('close-results');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const reviewBtn = document.getElementById('review-btn');
    const retryBtn = document.getElementById('retry-btn');

    if (closeQuizBtn) closeQuizBtn.addEventListener('click', hideQuizModal);
    if (closeResultsBtn) closeResultsBtn.addEventListener('click', hideResultsModal);
    if (prevBtn) prevBtn.addEventListener('click', prevQuestion);
    if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
    if (submitBtn) submitBtn.addEventListener('click', submitQuiz);
    if (reviewBtn) reviewBtn.addEventListener('click', () => {
        hideResultsModal();
        reviewQuestions(currentPracticeSet.id);
    });
    if (retryBtn) retryBtn.addEventListener('click', retryQuiz);

    // Close modals when clicking outside
    const quizModal = document.getElementById('quiz-modal');
    const resultsModal = document.getElementById('results-modal');

    if (quizModal) {
        quizModal.addEventListener('click', function (e) {
            if (e.target === quizModal) {
                hideQuizModal();
            }
        });
    }

    if (resultsModal) {
        resultsModal.addEventListener('click', function (e) {
            if (e.target === resultsModal) {
                hideResultsModal();
            }
        });
    }

    displayPracticeStats();
});
