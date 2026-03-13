/**
 * BIM Governance Quiz Logic
 * All-at-once quiz format for BIM Governance understanding
 * Features: randomization, scoring, review mode, localStorage persistence
 */

class BIMGovernanceQuiz {
    constructor() {
        this.questions = [];
        this.selectedQuestions = [];
        this.userAnswers = [];
        this.score = 0;
        this.maxQuestions = 10;

        // DOM elements
        this.elements = {
            startBtn: document.getElementById('start-quiz-btn'),
            submitBtn: document.getElementById('submit-quiz-btn'),
            retryBtn: document.getElementById('retry-quiz-btn'),
            questionsContainer: document.getElementById('quiz-questions'),
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
            const response = await fetch('/js/bim-governance-quiz-bank.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.questions = this.normalizeQuestionBank(await response.json());

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
        this.elements.submitBtn.addEventListener('click', () => this.submitQuiz());
        this.elements.retryBtn.addEventListener('click', () => this.restartQuiz());
    }

    normalizeQuestionBank(questions) {
        if (!Array.isArray(questions)) {
            return questions;
        }

        return questions.map((question) => ({
            ...question,
            prompt: this.normalizeText(question.prompt),
            explanation: this.normalizeText(question.explanation),
            choices: Array.isArray(question.choices)
                ? question.choices.map((choice) => this.normalizeText(choice))
                : question.choices
        }));
    }

    normalizeText(value) {
        if (typeof value !== 'string' || value.indexOf('\u00E2') === -1) {
            return value;
        }

        return value
            .replace(/\u00E2\u20AC\u02DC|\u00E2\u20AC\u2122/g, "'")
            .replace(/\u00E2\u20AC\u0153|\u00E2\u20AC\u009D/g, '"')
            .replace(/\u00E2\u20AC\u00A6/g, '...')
            .replace(/\u00E2\u2030\u00A0/g, '!=')
            .replace(/\u00E2\u20AC\u00A2/g, '-')
            .replace(/\u00E2\u2020\u2019/g, '->')
            .replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u20AC\u00A0\u00E2\u20AC\u2122/g, '->');
    }

    checkPreviousAttempt() {
        const lastAttempt = localStorage.getItem('bim-governance-quiz-last-attempt');
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
                ${scoreText} - ${timeAgo}
            </small>
        `;
        this.elements.quizIntro.appendChild(prevAttemptDiv);
    }

    startQuiz() {
        this.prepareQuestions();
        this.resetQuiz();
        this.renderAllQuestions();
    }

    prepareQuestions() {
        const pool = this.dedupeQuestions(this.questions);
        const selected = this.shuffleArray(pool).slice(0, this.maxQuestions);

        selected.forEach((question) => {
            delete question.shuffledChoices;
            delete question.shuffledCorrectIndex;
        });

        this.selectedQuestions = selected;
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

    renderAllQuestions() {
        this.elements.questionsContainer.innerHTML = '';

        this.selectedQuestions.forEach((question, index) => {
            // Create question card
            const questionCard = document.createElement('div');
            questionCard.className = 'question-card';

            // Shuffle choices for this question
            if (!question.shuffledChoices) {
                this.createShuffledChoices(question);
            }
            const shuffledChoices = question.shuffledChoices;

            questionCard.innerHTML = `
                <div class="question-header">
                    <h5 class="mb-0">Pertanyaan ${index + 1}</h5>
                    <small class="text-muted">${question.level === 'basic' ? 'Dasar' : 'Menengah'}</small>
                </div>
                <div class="question-content">
                    <p class="mb-3">${question.prompt}</p>
                    <div class="choices-container" id="choices-${index}"></div>
                </div>
            `;

            // Render choices
            const choicesContainer = questionCard.querySelector(`#choices-${index}`);
            shuffledChoices.forEach((choice, choiceIndex) => {
                const choiceDiv = document.createElement('div');
                choiceDiv.className = 'form-check mb-2';

                const input = document.createElement('input');
                input.className = 'form-check-input';
                input.type = 'radio';
                input.name = `question-${index}`;
                input.id = `choice-${index}-${choiceIndex}`;
                input.value = choiceIndex;

                const label = document.createElement('label');
                label.className = 'form-check-label quiz-choice-label';
                label.htmlFor = `choice-${index}-${choiceIndex}`;
                label.textContent = choice;

                choiceDiv.appendChild(input);
                choiceDiv.appendChild(label);
                choicesContainer.appendChild(choiceDiv);
            });

            // Bind change event for this question
            questionCard.addEventListener('change', (e) => {
                if (e.target.type === 'radio') {
                    this.userAnswers[index] = parseInt(e.target.value);
                }
            });

            this.elements.questionsContainer.appendChild(questionCard);
        });
    }

    createShuffledChoices(question) {
        // Create array with original indices
        const choiceObjects = question.choices.map((choice, index) => ({
            text: choice,
            originalIndex: index
        }));

        this.shuffleArray(choiceObjects);

        // Find new position of correct answer after shuffle
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

    submitQuiz() {
        // Check if all questions are answered
        const unansweredCount = this.userAnswers.filter(answer => answer === null).length;
        if (unansweredCount > 0) {
            alert(`Anda belum menjawab ${unansweredCount} pertanyaan. Silakan lengkapi semua jawaban sebelum submit.`);
            return;
        }

        this.calculateScore();
        this.showResults();
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
            questionDiv.className = `question-review mb-4 p-3 border rounded ${isCorrect ? 'correct-answer' : 'wrong-answer'}`;

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
        const passed = percentage >= 70;

        const attempt = {
            score: this.score,
            totalQuestions: this.selectedQuestions.length,
            percentage,
            timestamp: Date.now(),
            questionsAnswered: this.selectedQuestions.length
        };

        localStorage.setItem('bim-governance-quiz-last-attempt', JSON.stringify(attempt));

        const userData = this.getCurrentUser();
        if (!userData) {
            return;
        }

        try {
            const token = localStorage.getItem('token') || '';
            const quizResult = {
                quizId: 'bim-governance-quiz',
                quizName: 'BIM Governance Quiz',
                quizCategory: 'governance',
                sourceType: 'quiz',
                answers: this.userAnswers,
                score: this.score,
                totalQuestions: this.selectedQuestions.length,
                percentage,
                passed,
                userId: userData.id || userData.userId || userData.email || userData.username || userData.name || null,
                userName: userData.name || userData.username || 'Anonymous User',
                userEmail: userData.email || null
            };

            await fetch('/api/elearning/quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(quizResult)
            });
        } catch (error) {
            console.warn('Governance quiz sync skipped:', error.message);
        }
    }

    getCurrentUser() {
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
    new BIMGovernanceQuiz();
});
