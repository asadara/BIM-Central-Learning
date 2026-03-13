/**
 * BIM Mindset Quiz Logic
 * Lightweight, interactive quiz for BIM mindset understanding
 * Features: randomization, scoring, review mode, localStorage persistence
 */

class BIMMindsetQuiz {
    constructor() {
        this.questions = [];
        this.selectedQuestions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.maxQuestions = 10;

        // DOM elements
        this.elements = {
            startBtn: document.getElementById('start-quiz-btn'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn'),
            retryBtn: document.getElementById('retry-quiz-btn'),
            questionCounter: document.getElementById('question-counter'),
            questionLevel: document.getElementById('question-level'),
            questionText: document.getElementById('question-text'),
            choicesContainer: document.getElementById('choices-container'),
            finalScore: document.getElementById('final-score'),
            scorePercentage: document.getElementById('score-percentage'),
            resultsReview: document.getElementById('results-review'),
            quizIntro: document.getElementById('quiz-intro'),
            quizContent: document.getElementById('quiz-content'),
            quizResults: document.getElementById('quiz-results')
        };

        this.init();
    }

    async init() {
        try {
            await this.loadQuestions();
            this.bindEvents();
            this.checkPreviousAttempt();
        } catch (error) {
            console.error('Failed to initialize quiz:', error);
            this.showError('Gagal memuat quiz. Silakan refresh halaman.');
        }
    }

    async loadQuestions() {
        try {
            const response = await fetch('/js/bim-mindset-question-bank-60.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.questions = await response.json();

            if (!Array.isArray(this.questions) || this.questions.length === 0) {
                throw new Error('Invalid question bank format');
            }

        } catch (error) {
            console.error('Error loading questions:', error);
            throw error;
        }
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startQuiz());
        this.elements.prevBtn.addEventListener('click', () => this.previousQuestion());
        this.elements.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.elements.retryBtn.addEventListener('click', () => this.restartQuiz());
    }

    checkPreviousAttempt() {
        const lastAttempt = localStorage.getItem('bim-mindset-quiz-last-attempt');
        if (lastAttempt) {
            const attempt = JSON.parse(lastAttempt);
            const timeDiff = Date.now() - attempt.timestamp;
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            // Show previous score if less than 24 hours ago
            if (hoursDiff < 24) {
                this.showPreviousAttempt(attempt);
            }
        }
    }

    showPreviousAttempt(attempt) {
        const scoreText = `Skor Terakhir: ${attempt.score}/${attempt.totalQuestions} (${Math.round((attempt.score / attempt.totalQuestions) * 100)}%)`;
        const timeAgo = this.getTimeAgo(attempt.timestamp);

        // Add previous attempt info to intro
        const prevAttemptDiv = document.createElement('div');
        prevAttemptDiv.className = 'alert alert-info mt-3';
        prevAttemptDiv.innerHTML = `
            <small>
                <i class="fas fa-history me-1"></i>
                ${scoreText} • ${timeAgo}
            </small>
        `;
        this.elements.quizIntro.appendChild(prevAttemptDiv);
    }

    startQuiz() {
        this.prepareQuestions();
        this.resetQuiz();
        this.showQuestion();
    }

    prepareQuestions() {
        const pool = this.dedupeQuestions(
            this.questions.filter(q => q.level === 'basic' || q.level === 'intermediate')
        );

        const basicPool = this.shuffleArray(pool.filter(q => q.level === 'basic'));
        const intermediatePool = this.shuffleArray(pool.filter(q => q.level === 'intermediate'));

        const targetBasic = Math.ceil(this.maxQuestions * 0.6);
        const targetIntermediate = this.maxQuestions - targetBasic;

        const selected = [
            ...basicPool.splice(0, targetBasic),
            ...intermediatePool.splice(0, targetIntermediate)
        ];

        if (selected.length < this.maxQuestions) {
            const remainderPool = this.shuffleArray([...basicPool, ...intermediatePool]);
            selected.push(...remainderPool.slice(0, this.maxQuestions - selected.length));
        }

        selected.forEach((question) => {
            delete question.shuffledChoices;
            delete question.shuffledCorrectIndex;
        });

        this.selectedQuestions = this.shuffleArray(selected).slice(0, this.maxQuestions);
    }

    resetQuiz() {
        this.currentQuestionIndex = 0;
        this.userAnswers = new Array(this.selectedQuestions.length).fill(null);
        this.score = 0;

        // Reset UI
        this.elements.quizIntro.style.display = 'none';
        this.elements.quizContent.style.display = 'block';
        this.elements.quizResults.style.display = 'none';
    }

    showQuestion() {
        const question = this.selectedQuestions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];

        // Update header
        this.elements.questionCounter.textContent = `Pertanyaan ${this.currentQuestionIndex + 1} dari ${this.selectedQuestions.length}`;
        this.elements.questionLevel.textContent = question.level === 'basic' ? 'Dasar' : 'Menengah';

        // Update question text
        this.elements.questionText.textContent = question.prompt;

        // Create shuffled choices once per question (stable order on revisit)
        if (!question.shuffledChoices) {
            this.createShuffledChoices(question);
        }
        const shuffledChoices = question.shuffledChoices;

        // Render choices
        this.elements.choicesContainer.innerHTML = '';
        shuffledChoices.forEach((choice, index) => {
            const choiceDiv = document.createElement('div');
            choiceDiv.className = 'form-check mb-2';

            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'radio';
            input.name = 'quiz-choice';
            input.id = `choice-${index}`;
            input.value = index;

            const label = document.createElement('label');
            label.className = 'form-check-label quiz-choice-label';
            label.htmlFor = `choice-${index}`;
            label.textContent = choice;

            choiceDiv.appendChild(input);
            choiceDiv.appendChild(label);
            this.elements.choicesContainer.appendChild(choiceDiv);
        });

        // Restore previous selection if exists
        if (userAnswer !== null) {
            const selectedInput = document.querySelector(`input[value="${userAnswer}"]`);
            if (selectedInput) {
                selectedInput.checked = true;
            }
        }

        // Bind choice change event (ensure single handler)
        if (!this.onChoiceChange) {
            this.onChoiceChange = (e) => {
                if (e.target.type === 'radio') {
                    this.userAnswers[this.currentQuestionIndex] = parseInt(e.target.value);
                    this.updateNavigationButtons();
                }
            };
        }
        this.elements.choicesContainer.removeEventListener('change', this.onChoiceChange);
        this.elements.choicesContainer.addEventListener('change', this.onChoiceChange);

        this.updateNavigationButtons();
    }

    createShuffledChoices(question) {
        // Create array with original indices
        const choiceObjects = question.choices.map((choice, index) => ({
            text: choice,
            originalIndex: index
        }));

        this.shuffleArray(choiceObjects);

        // Update correct index to match shuffled position
        const newCorrectIndex = choiceObjects.findIndex(choice => choice.originalIndex === question.answer_index);
        question.shuffledCorrectIndex = newCorrectIndex;
        question.shuffledChoices = choiceObjects.map(choice => choice.text);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    dedupeQuestions(questions) {
        const seen = new Set();
        const unique = [];
        for (const question of questions) {
            const key = question.id || question.prompt;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            unique.push(question);
        }
        return unique;
    }

    updateNavigationButtons() {
        const hasAnswer = this.userAnswers[this.currentQuestionIndex] !== null;
        const isFirst = this.currentQuestionIndex === 0;
        const isLast = this.currentQuestionIndex === this.selectedQuestions.length - 1;

        this.elements.prevBtn.disabled = isFirst;
        this.elements.nextBtn.disabled = !hasAnswer;

        if (isLast) {
            this.elements.nextBtn.textContent = 'Selesai';
        } else {
            this.elements.nextBtn.textContent = 'Selanjutnya';
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.showQuestion();
        }
    }

    nextQuestion() {
        if (this.userAnswers[this.currentQuestionIndex] === null) {
            return; // Should not happen due to button disable
        }

        if (this.currentQuestionIndex === this.selectedQuestions.length - 1) {
            // Last question - calculate score and show results
            this.calculateScore();
            this.showResults();
        } else {
            // Next question
            this.currentQuestionIndex++;
            this.showQuestion();
        }
    }

    calculateScore() {
        this.score = 0;
        this.selectedQuestions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            if (userAnswer === question.shuffledCorrectIndex) {
                this.score++;
            }
        });
    }

    showResults() {
        // Update score display
        this.elements.finalScore.textContent = `Skor: ${this.score}/${this.selectedQuestions.length}`;
        const percentage = Math.round((this.score / this.selectedQuestions.length) * 100);
        this.elements.scorePercentage.textContent = `${percentage}%`;

        // Show review of all questions
        this.elements.resultsReview.innerHTML = '';
        this.selectedQuestions.forEach((question, index) => {
            const userAnswerIndex = this.userAnswers[index];
            const isCorrect = userAnswerIndex === question.shuffledCorrectIndex;

            const questionDiv = document.createElement('div');
            questionDiv.className = `question-review mb-4 p-3 border rounded ${isCorrect ? 'border-success bg-light' : 'border-danger bg-light'}`;

            // Question text
            const questionText = document.createElement('h5');
            questionText.className = 'mb-3';
            questionText.textContent = `${index + 1}. ${question.prompt}`;
            questionDiv.appendChild(questionText);

            // User's answer
            const userAnswerDiv = document.createElement('div');
            userAnswerDiv.className = 'mb-2';
            userAnswerDiv.innerHTML = `
                <strong>Jawaban Anda:</strong>
                <span class="${isCorrect ? 'text-success' : 'text-danger'}">
                    ${question.choices[userAnswerIndex] || 'Tidak dijawab'}
                </span>
            `;
            questionDiv.appendChild(userAnswerDiv);

            // Correct answer
            const correctAnswerDiv = document.createElement('div');
            correctAnswerDiv.className = 'mb-2';
            correctAnswerDiv.innerHTML = `
                <strong>Jawaban Benar:</strong>
                <span class="text-success">${question.choices[question.answer_index]}</span>
            `;
            questionDiv.appendChild(correctAnswerDiv);

            // Explanation
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'text-muted';
            explanationDiv.innerHTML = `<strong>Penjelasan:</strong> ${question.explanation}`;
            questionDiv.appendChild(explanationDiv);

            this.elements.resultsReview.appendChild(questionDiv);
        });

        // Save attempt to localStorage
        this.saveAttempt();

        // Update UI
        this.elements.quizContent.style.display = 'none';
        this.elements.quizResults.style.display = 'block';
    }

    async saveAttempt() {
        const percentage = Math.round((this.score / this.selectedQuestions.length) * 100);
        const passed = percentage >= 70; // 70% passing grade

        // Get current user data
        const userData = this.getCurrentUser();

        const attempt = {
            score: this.score,
            totalQuestions: this.selectedQuestions.length,
            percentage: percentage,
            timestamp: Date.now(),
            questionsAnswered: this.selectedQuestions.length
        };

        // Save to localStorage for backward compatibility
        localStorage.setItem('bim-mindset-quiz-last-attempt', JSON.stringify(attempt));

        // Send to backend API for dashboard tracking
        if (userData) {
            try {
                const token = localStorage.getItem('token') || '';
                const quizResult = {
                    quizId: 'bim-mindset-quiz',
                    quizName: 'BIM Mindset Quiz',
                    quizCategory: 'mindset',
                    sourceType: 'quiz',
                    answers: this.userAnswers, // Array of selected choice indices
                    score: this.score,
                    totalQuestions: this.selectedQuestions.length,
                    percentage,
                    passed,
                    timeTaken: 0,
                    userId: userData.id || userData.userId || userData.email || userData.username || userData.name || null,
                    userName: userData.name || userData.username || 'Anonymous User',
                    userEmail: userData.email || null
                };

                const response = await fetch('/api/elearning/quiz/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(quizResult)
                });

                if (response.ok) {
                    await response.json();

                    // Show success message
                    this.showNotification('Quiz result saved successfully!', 'success');
                } else {
                    console.error('❌ Failed to save quiz result:', response.status);
                    this.showNotification('Failed to save quiz result to dashboard', 'warning');
                }
            } catch (error) {
                console.error('❌ Error submitting quiz result:', error);
                this.showNotification('Network error - quiz result not saved to dashboard', 'warning');
            }
        } else {
            this.showNotification('Please log in to save quiz results to your dashboard', 'info');
        }
    }

    getCurrentUser() {
        // Try to get user data from localStorage (compatible with main user system)
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                return JSON.parse(userData);
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
        return null;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    restartQuiz() {
        this.startQuiz();
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger mt-3';
        errorDiv.textContent = message;
        this.elements.quizIntro.appendChild(errorDiv);
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours < 1) {
            return 'Baru saja';
        } else if (hours < 24) {
            return `${hours} jam yang lalu`;
        } else {
            const days = Math.floor(hours / 24);
            return `${days} hari yang lalu`;
        }
    }
}

// Initialize quiz when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BIMMindsetQuiz();
});
