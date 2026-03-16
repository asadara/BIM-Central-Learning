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
        script.src = 'enhanced-practice-questions.js';
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

// Get practice questions from enhanced system or fallback
function getPracticeQuestions() {
    if (typeof window.EnhancedPracticeQuestions !== 'undefined') {
        const userData = getUserData();
        const userLevel = userData?.level || 'BIM Modeller';

        // Get questions for user's level
        const levelQuestions = window.EnhancedPracticeQuestions.getQuestionsByLevel(userLevel);

        // Convert to practice sets format
        const practiceSets = [];
        Object.keys(levelQuestions).forEach(category => {
            const questions = levelQuestions[category];
            const questionSets = {};

            // Group by difficulty
            questions.forEach(q => {
                if (!questionSets[q.difficulty]) {
                    questionSets[q.difficulty] = [];
                }
                questionSets[q.difficulty].push(q);
            });

            // Create practice sets for each difficulty
            Object.keys(questionSets).forEach(difficulty => {
                const setQuestions = questionSets[difficulty];
                if (setQuestions.length >= 5) { // Minimum 5 questions for a set
                    practiceSets.push({
                        id: practiceSets.length + 1,
                        title: `${category.charAt(0).toUpperCase() + category.slice(1)} - ${difficulty}`,
                        category: category,
                        level: userLevel.toLowerCase().replace(' ', '_'),
                        difficulty: difficulty,
                        questions: Math.min(setQuestions.length, 15), // Max 15 per set
                        timeLimit: Math.min(setQuestions.length, 15) * 60, // 1 minute per question
                        description: `${difficulty} level ${category} questions for ${userLevel}`,
                        questions_data: setQuestions.slice(0, 15).map(q => ({
                            question: q.question,
                            options: q.options,
                            correct: q.options.indexOf(q.correctAnswer),
                            explanation: q.explanation,
                            learningObjective: q.learningObjective,
                            practicalScenario: q.practicalScenario
                        }))
                    });
                }
            });
        });

        console.log(`Generated ${practiceSets.length} practice sets from enhanced questions`);
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
                }
            ]
        }
    ];
}

// Initialize practice data
let practiceData = [
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
            },
            {
                question: "Which LOD (Level of Development) is suitable for construction documentation?",
                options: ["LOD 100", "LOD 200", "LOD 300", "LOD 400"],
                correct: 3,
                explanation: "LOD 400 provides sufficient detail for construction documentation and fabrication."
            }
        ]
    },
    {
        id: 4,
        title: "Advanced BIM Management",
        category: "general",
        level: "advanced",
        difficulty: "Hard",
        questions: 20,
        timeLimit: 600,
        description: "Strategic BIM implementation and project management",
        questions_data: [
            {
                question: "What is the main goal of a BIM Execution Plan (BEP)?",
                options: ["Software training", "Model coordination", "Project workflow definition", "Quality control"],
                correct: 2,
                explanation: "A BEP defines how BIM will be implemented and managed throughout the project lifecycle."
            }
        ]
    },
    {
        id: 5,
        title: "SketchUp Modeling Basics",
        category: "sketchup",
        level: "beginner",
        difficulty: "Easy",
        questions: 8,
        timeLimit: 240,
        description: "Introduction to SketchUp 3D modeling tools",
        questions_data: [
            {
                question: "What tool is used to create a rectangle in SketchUp?",
                options: ["Line tool", "Rectangle tool", "Push/Pull tool", "Move tool"],
                correct: 1,
                explanation: "The Rectangle tool (R) is used to create rectangular shapes in SketchUp."
            }
        ]
    }
];

let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let quizTimer = null;
let timeRemaining = 0;

function loadPracticeSets() {
    const userData = getUserData();
    const userLevel = userData?.level || 'BIM Modeller';

    // Filter practice sets based on user level and preferences
    const container = document.getElementById('practice-container');
    container.innerHTML = '';

    let filteredSets = practiceData;

    // Apply current filters
    const activeLevel = document.querySelector('.filter-btn.active')?.dataset.level || 'all';
    const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';

    if (activeLevel !== 'all') {
        filteredSets = filteredSets.filter(set => set.level === activeLevel);
    }

    if (activeCategory !== 'all') {
        filteredSets = filteredSets.filter(set => set.category === activeCategory);
    }

    if (filteredSets.length === 0) {
        container.innerHTML = '<div class="no-results">No practice sets found for the selected filters.</div>';
        return;
    }

    filteredSets.forEach(set => {
        const setElement = createPracticeSetElement(set);
        container.appendChild(setElement);
    });
}

function createPracticeSetElement(set) {
    const setDiv = document.createElement('div');
    setDiv.className = 'box';

    // Determine if user can access this level
    const userData = getUserData();
    const userLevel = userData?.level || 'BIM Modeller';
    const canAccess = checkLevelAccess(userLevel, set.level);

    setDiv.innerHTML = `
        <div class="practice-set ${!canAccess ? 'locked' : ''}">
            <div class="set-header">
                <h3>${set.title}</h3>
                <div class="set-badges">
                    <span class="difficulty ${set.difficulty.toLowerCase()}">${set.difficulty}</span>
                    <span class="level">${formatLevel(set.level)}</span>
                    <span class="category">${set.category.toUpperCase()}</span>
                </div>
            </div>
            
            <div class="set-info">
                <p>${set.description}</p>
                <div class="set-stats">
                    <div class="stat">
                        <i class="fas fa-question-circle"></i>
                        <span>${set.questions} Questions</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>${Math.floor(set.timeLimit / 60)} min</span>
                    </div>
                </div>
            </div>
            
            <div class="set-actions">
                ${canAccess ?
            `<button class="btn start-practice" onclick="startPractice(${set.id})">
                        <i class="fas fa-play"></i> Start Practice
                    </button>` :
            `<button class="btn locked-btn" disabled>
                        <i class="fas fa-lock"></i> Requires ${formatLevel(set.level)}
                    </button>`
        }
            </div>
        </div>
    `;

    return setDiv;
}

function checkLevelAccess(userLevel, requiredLevel) {
    const levels = {
        'beginner': 1,
        'intermediate': 2,
        'advanced': 3
    };

    const userLevelMap = {
        'BIM Modeller': 1,
        'BIM Coordinator': 2,
        'BIM Manager': 3
    };

    return userLevelMap[userLevel] >= levels[requiredLevel];
}

function formatLevel(level) {
    const levelMap = {
        'beginner': 'BIM Modeller',
        'intermediate': 'BIM Coordinator',
        'advanced': 'BIM Manager'
    };
    return levelMap[level] || level;
}

function startPractice(setId) {
    currentQuiz = practiceData.find(set => set.id === setId);
    if (!currentQuiz) return;

    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuiz.questions_data.length).fill(null);
    timeRemaining = currentQuiz.timeLimit;

    // Show quiz modal
    document.getElementById('quiz-modal').style.display = 'flex';
    document.getElementById('quiz-title').textContent = currentQuiz.title;

    // Start timer
    startTimer();

    // Load first question
    loadQuestion();
}

function loadQuestion() {
    const question = currentQuiz.questions_data[currentQuestionIndex];
    if (!question) return;

    // Update question counter
    document.getElementById('question-counter').textContent =
        `${currentQuestionIndex + 1} / ${currentQuiz.questions_data.length}`;

    // Load question text
    document.getElementById('question-text').textContent = question.question;

    // Load options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <input type="radio" id="option-${index}" name="question-option" value="${index}">
            <label for="option-${index}">${option}</label>
        `;

        // Check if this option was previously selected
        if (userAnswers[currentQuestionIndex] === index) {
            optionDiv.querySelector('input').checked = true;
        }

        optionDiv.addEventListener('click', () => {
            optionDiv.querySelector('input').checked = true;
            userAnswers[currentQuestionIndex] = index;
        });

        optionsContainer.appendChild(optionDiv);
    });

    // Update navigation buttons
    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === currentQuiz.questions_data.length - 1) {
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('submit-btn').style.display = 'inline-block';
    } else {
        document.getElementById('next-btn').style.display = 'inline-block';
        document.getElementById('submit-btn').style.display = 'none';
    }
}

function startTimer() {
    const timerElement = document.getElementById('timer');

    quizTimer = setInterval(() => {
        timeRemaining--;

        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeRemaining <= 0) {
            clearInterval(quizTimer);
            submitQuiz();
        }
    }, 1000);
}

function submitQuiz() {
    clearInterval(quizTimer);

    // Calculate results
    let correctAnswers = 0;
    currentQuiz.questions_data.forEach((question, index) => {
        if (userAnswers[index] === question.correct) {
            correctAnswers++;
        }
    });

    const totalQuestions = currentQuiz.questions_data.length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    // Show results
    showResults(correctAnswers, totalQuestions, percentage);

    // Hide quiz modal
    document.getElementById('quiz-modal').style.display = 'none';
}

function showResults(correct, total, percentage) {
    document.getElementById('results-modal').style.display = 'flex';
    document.getElementById('final-score').textContent = `${percentage}%`;
    document.getElementById('correct-count').textContent = correct;
    document.getElementById('wrong-count').textContent = total - correct;

    const timeTaken = currentQuiz.timeLimit - timeRemaining;
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    document.getElementById('time-taken').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Set score message
    const scoreMessage = document.getElementById('score-message');
    if (percentage >= 80) {
        scoreMessage.textContent = 'Excellent work!';
        scoreMessage.style.color = '#22C55E';
    } else if (percentage >= 60) {
        scoreMessage.textContent = 'Good job!';
        scoreMessage.style.color = '#06BBCC';
    } else {
        scoreMessage.textContent = 'Keep practicing!';
        scoreMessage.style.color = '#F59E0B';
    }

    // Update score circle color
    const scoreCircle = document.getElementById('final-score').parentElement;
    if (percentage >= 80) {
        scoreCircle.style.borderColor = '#22C55E';
    } else if (percentage >= 60) {
        scoreCircle.style.borderColor = '#06BBCC';
    } else {
        scoreCircle.style.borderColor = '#F59E0B';
    }
}

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadPracticeSets();
        });
    });

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadPracticeSets();
        });
    });

    // Quiz navigation
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            loadQuestion();
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentQuestionIndex < currentQuiz.questions_data.length - 1) {
            currentQuestionIndex++;
            loadQuestion();
        }
    });

    document.getElementById('submit-btn').addEventListener('click', submitQuiz);

    // Modal close buttons
    document.getElementById('close-quiz').addEventListener('click', () => {
        if (quizTimer) clearInterval(quizTimer);
        document.getElementById('quiz-modal').style.display = 'none';
    });

    document.getElementById('close-results').addEventListener('click', () => {
        document.getElementById('results-modal').style.display = 'none';
    });

    // Results actions
    document.getElementById('retry-btn').addEventListener('click', () => {
        document.getElementById('results-modal').style.display = 'none';
        startPractice(currentQuiz.id);
    });
}

// Helper function to get user data (uses main user system)
function getUserData() {
    const userData = localStorage.getItem('user');
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    return null; // Return null instead of dummy user
}
