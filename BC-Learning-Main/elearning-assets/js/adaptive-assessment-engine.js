// Adaptive Assessment Engine
// Phase 3 - Dynamic difficulty adjustment and personalized assessment experience

class AdaptiveAssessmentEngine {
    constructor() {
        this.assessmentData = this.loadAssessmentData();
        this.userProfile = this.loadUserProfile();
        this.difficultyModel = this.initializeDifficultyModel();
        this.itemResponseTheory = this.initializeIRT();
        this.adaptationRules = this.loadAdaptationRules();
        this.performanceHistory = this.loadPerformanceHistory();

        // Initialize assessment tracking
        this.initializeTracking();
        this.setupEventListeners();
    }

    // Core adaptive assessment functionality
    adaptiveAssessment(assessmentConfig) {
        const assessment = {
            id: 'adaptive_' + Date.now(),
            type: assessmentConfig.type, // 'practice', 'quiz', 'exam', 'placement'
            subject: assessmentConfig.subject,
            startTime: Date.now(),
            questions: [],
            responses: [],
            currentDifficulty: this.getInitialDifficulty(assessmentConfig),
            abilityEstimate: this.getInitialAbilityEstimate(),
            standardError: 1.0,
            adaptationHistory: [],
            metadata: {
                totalTime: 0,
                questionCount: 0,
                correctAnswers: 0,
                averageResponseTime: 0,
                confidenceLevel: 0.95,
                terminationCriteria: assessmentConfig.terminationCriteria || 'fixedLength'
            }
        };

        this.initializeAssessment(assessment, assessmentConfig);
        return assessment;
    }

    // Generate next question based on current ability estimate
    generateNextQuestion(assessment) {
        const targetDifficulty = this.calculateTargetDifficulty(assessment);
        const availableQuestions = this.getAvailableQuestions(assessment, targetDifficulty);

        if (availableQuestions.length === 0) {
            return this.handleNoQuestionsAvailable(assessment, targetDifficulty);
        }

        // Select optimal question using Item Response Theory
        const selectedQuestion = this.selectOptimalQuestion(availableQuestions, assessment);

        // Enhance question with adaptive features
        const adaptiveQuestion = this.enhanceQuestionForAdaptation(selectedQuestion, assessment);

        // Record question selection
        this.recordQuestionSelection(assessment, adaptiveQuestion, targetDifficulty);

        return adaptiveQuestion;
    }

    // Process answer and update ability estimate
    processAnswer(assessment, questionId, answer, responseTime, confidence = null) {
        const question = assessment.questions.find(q => q.id === questionId);
        if (!question) {
            throw new Error('Question not found in assessment');
        }

        const response = {
            questionId: questionId,
            answer: answer,
            correctAnswer: question.correctAnswer,
            isCorrect: this.evaluateAnswer(answer, question.correctAnswer, question.type),
            responseTime: responseTime,
            confidence: confidence,
            timestamp: Date.now(),
            difficulty: question.difficulty,
            discrimination: question.discrimination || 1.0,
            guessing: question.guessing || 0.0
        };

        // Add to responses
        assessment.responses.push(response);

        // Update ability estimate using IRT
        this.updateAbilityEstimate(assessment, response);

        // Update difficulty model
        this.updateDifficultyModel(assessment, response);

        // Check for adaptation triggers
        this.checkAdaptationTriggers(assessment, response);

        // Update assessment metadata
        this.updateAssessmentMetadata(assessment, response);

        // Generate immediate feedback if enabled
        const feedback = this.generateAdaptiveFeedback(assessment, response);

        return {
            response: response,
            feedback: feedback,
            nextQuestion: this.shouldContinueAssessment(assessment) ?
                this.generateNextQuestion(assessment) : null,
            assessmentStatus: this.getAssessmentStatus(assessment)
        };
    }

    // Calculate target difficulty based on ability estimate
    calculateTargetDifficulty(assessment) {
        const abilityEstimate = assessment.abilityEstimate;
        const standardError = assessment.standardError;
        const adaptationStrategy = this.getAdaptationStrategy(assessment);

        let targetDifficulty = abilityEstimate;

        switch (adaptationStrategy) {
            case 'maximumInformation':
                // Target difficulty that provides maximum information
                targetDifficulty = abilityEstimate;
                break;

            case 'gradualIncrease':
                // Gradually increase difficulty
                const recentPerformance = this.getRecentPerformance(assessment, 3);
                if (recentPerformance >= 0.7) {
                    targetDifficulty = abilityEstimate + 0.5;
                } else if (recentPerformance <= 0.3) {
                    targetDifficulty = abilityEstimate - 0.5;
                }
                break;

            case 'confidenceBasedVarriage':
                // Adjust based on confidence in ability estimate
                if (standardError > 0.5) {
                    targetDifficulty = abilityEstimate + (Math.random() - 0.5) * standardError;
                }
                break;

            case 'zoneOfProximalDevelopment':
                // Target slightly above current ability
                targetDifficulty = abilityEstimate + 0.3;
                break;
        }

        // Apply constraints
        targetDifficulty = Math.max(-3, Math.min(3, targetDifficulty));

        return targetDifficulty;
    }

    // Update ability estimate using Item Response Theory
    updateAbilityEstimate(assessment, response) {
        const responses = assessment.responses;
        const currentEstimate = assessment.abilityEstimate;

        // Use Maximum Likelihood Estimation or Bayesian methods
        const newEstimate = this.calculateMLEAbility(responses, currentEstimate);
        const newStandardError = this.calculateStandardError(responses, newEstimate);

        // Record adaptation history
        assessment.adaptationHistory.push({
            timestamp: Date.now(),
            previousAbility: assessment.abilityEstimate,
            newAbility: newEstimate,
            previousError: assessment.standardError,
            newError: newStandardError,
            triggerResponse: response,
            adaptationReason: this.determineAdaptationReason(assessment, response)
        });

        // Update assessment
        assessment.abilityEstimate = newEstimate;
        assessment.standardError = newStandardError;

        // Update difficulty if significant change
        if (Math.abs(newEstimate - currentEstimate) > 0.5) {
            this.adaptDifficulty(assessment, newEstimate);
        }

        return { ability: newEstimate, standardError: newStandardError };
    }

    // Select optimal question using information theory
    selectOptimalQuestion(availableQuestions, assessment) {
        const abilityEstimate = assessment.abilityEstimate;

        // Calculate information value for each question
        const questionScores = availableQuestions.map(question => {
            const information = this.calculateInformationValue(question, abilityEstimate);
            const exposure = this.getQuestionExposureRate(question.id);
            const contentBalance = this.getContentBalanceScore(question, assessment);
            const novelty = this.getQuestionNoveltyScore(question, assessment);

            // Composite score
            const score = information * 0.4 +
                (1 - exposure) * 0.2 +
                contentBalance * 0.2 +
                novelty * 0.2;

            return { question, score, information, exposure, contentBalance, novelty };
        });

        // Sort by score and select top question
        questionScores.sort((a, b) => b.score - a.score);

        return questionScores[0].question;
    }

    // Calculate information value using IRT
    calculateInformationValue(question, abilityEstimate) {
        const difficulty = question.difficulty || 0;
        const discrimination = question.discrimination || 1.0;
        const guessing = question.guessing || 0.0;

        // 3-parameter logistic model
        const probability = this.calculateProbability(abilityEstimate, difficulty, discrimination, guessing);

        // Information function
        const information = Math.pow(discrimination, 2) *
            Math.pow(probability - guessing, 2) *
            (1 - probability) /
            Math.pow(1 - guessing, 2);

        return information;
    }

    // Calculate probability using 3PL model
    calculateProbability(ability, difficulty, discrimination, guessing) {
        const exponent = discrimination * (ability - difficulty);
        const probability = guessing + (1 - guessing) / (1 + Math.exp(-exponent));
        return Math.max(0.001, Math.min(0.999, probability));
    }

    // Generate adaptive feedback
    generateAdaptiveFeedback(assessment, response) {
        const feedbackLevel = this.determineFeedbackLevel(assessment, response);
        const learningStyle = this.getUserLearningStyle();
        const confidenceLevel = response.confidence || 0.5;

        const feedback = {
            immediate: this.generateImmediateFeedback(response, feedbackLevel),
            explanatory: this.generateExplanatoryFeedback(response, learningStyle),
            adaptive: this.generateAdaptiveSupport(assessment, response),
            metacognitive: this.generateMetacognitiveFeedback(assessment, response),
            motivational: this.generateMotivationalFeedback(assessment, response)
        };

        // Personalize feedback based on user profile
        feedback.personalized = this.personalizeFeedback(feedback, assessment, response);

        return feedback;
    }

    // Determine if assessment should continue
    shouldContinueAssessment(assessment) {
        const criteria = assessment.metadata.terminationCriteria;
        const questionCount = assessment.responses.length;
        const standardError = assessment.standardError;
        const timeElapsed = Date.now() - assessment.startTime;

        switch (criteria) {
            case 'fixedLength':
                return questionCount < (assessment.metadata.targetQuestions || 20);

            case 'standardErrorThreshold':
                return standardError > (assessment.metadata.errorThreshold || 0.3);

            case 'timeLimit':
                return timeElapsed < (assessment.metadata.timeLimit || 60 * 60 * 1000); // 1 hour

            case 'confidenceInterval':
                return this.calculateConfidenceInterval(assessment).width >
                    (assessment.metadata.confidenceThreshold || 0.5);

            case 'informationCriterion':
                return this.calculateTotalInformation(assessment) <
                    (assessment.metadata.informationTarget || 10);

            case 'hybrid':
                // Multiple criteria must be met
                const minQuestions = assessment.metadata.minQuestions || 10;
                const maxQuestions = assessment.metadata.maxQuestions || 50;

                if (questionCount < minQuestions) return true;
                if (questionCount >= maxQuestions) return false;
                return standardError > (assessment.metadata.errorThreshold || 0.3);

            default:
                return questionCount < 20;
        }
    }

    // Enhanced question with adaptive features
    enhanceQuestionForAdaptation(question, assessment) {
        const enhanced = { ...question };

        // Add adaptive scaffolding if needed
        if (this.needsScaffolding(assessment)) {
            enhanced.scaffolding = this.generateScaffolding(question, assessment);
        }

        // Add hints system
        enhanced.hints = this.generateAdaptiveHints(question, assessment);

        // Add confidence collection
        enhanced.collectConfidence = this.shouldCollectConfidence(assessment);

        // Add time limits based on difficulty
        enhanced.suggestedTime = this.calculateSuggestedTime(question, assessment);

        // Add multimedia enhancements for learning style
        enhanced.multimedia = this.getMultimediaEnhancements(question, assessment);

        return enhanced;
    }

    // Performance analysis and recommendations
    analyzePerformance(assessment) {
        const analysis = {
            overallAbility: assessment.abilityEstimate,
            standardError: assessment.standardError,
            confidenceInterval: this.calculateConfidenceInterval(assessment),

            // Performance patterns
            patterns: {
                accuracyTrend: this.analyzeAccuracyTrend(assessment),
                speedAccuracyTradeoff: this.analyzeSpeedAccuracy(assessment),
                difficultyProgression: this.analyzeDifficultyProgression(assessment),
                contentAreaPerformance: this.analyzeContentAreas(assessment)
            },

            // Diagnostic information
            diagnostics: {
                strengths: this.identifyStrengths(assessment),
                weaknesses: this.identifyWeaknesses(assessment),
                misconceptions: this.identifyMisconceptions(assessment),
                guessing: this.analyzeGuessingBehavior(assessment)
            },

            // Recommendations
            recommendations: {
                nextSteps: this.generateNextSteps(assessment),
                practiceAreas: this.identifyPracticeAreas(assessment),
                difficultyAdjustments: this.suggestDifficultyAdjustments(assessment),
                learningStrategies: this.suggestLearningStrategies(assessment)
            },

            // Prediction
            predictions: {
                futurePerformance: this.predictFuturePerformance(assessment),
                masteryProbability: this.calculateMasteryProbability(assessment),
                timeToMastery: this.estimateTimeToMastery(assessment)
            }
        };

        return analysis;
    }

    // Real-time adaptation during assessment
    realTimeAdaptation(assessment, currentQuestion, userBehavior) {
        const adaptations = [];

        // Response time adaptation
        if (userBehavior.responseTime > currentQuestion.suggestedTime * 2) {
            adaptations.push({
                type: 'timeSupport',
                action: 'offerHint',
                reason: 'Extended response time detected'
            });
        }

        // Confidence adaptation
        if (userBehavior.confidence < 0.3) {
            adaptations.push({
                type: 'confidenceSupport',
                action: 'providencouragement',
                reason: 'Low confidence detected'
            });
        }

        // Engagement adaptation
        if (userBehavior.engagementLevel < 0.5) {
            adaptations.push({
                type: 'engagementBoost',
                action: 'addGameification',
                reason: 'Low engagement detected'
            });
        }

        // Apply adaptations
        adaptations.forEach(adaptation => {
            this.applyRealTimeAdaptation(assessment, currentQuestion, adaptation);
        });

        return adaptations;
    }

    // Data persistence methods
    saveAssessmentData() {
        try {
            localStorage.setItem('adaptiveAssessment_data', JSON.stringify(this.assessmentData));
        } catch (error) {
            console.error('Error saving assessment data:', error);
        }
    }

    savePerformanceHistory() {
        try {
            localStorage.setItem('adaptiveAssessment_performance', JSON.stringify(this.performanceHistory));
        } catch (error) {
            console.error('Error saving performance history:', error);
        }
    }

    // Data loading methods
    loadAssessmentData() {
        try {
            return JSON.parse(localStorage.getItem('adaptiveAssessment_data') || '{}');
        } catch (error) {
            console.error('Error loading assessment data:', error);
            return {};
        }
    }

    loadPerformanceHistory() {
        try {
            return JSON.parse(localStorage.getItem('adaptiveAssessment_performance') || '[]');
        } catch (error) {
            console.error('Error loading performance history:', error);
            return [];
        }
    }

    // Initialize models
    initializeDifficultyModel() {
        return {
            currentLevel: 0,
            adaptationRate: 0.1,
            stabilityThreshold: 0.05,
            history: []
        };
    }

    initializeIRT() {
        return {
            model: '3PL', // 3-Parameter Logistic
            priorMean: 0,
            priorVariance: 1,
            estimationMethod: 'MLE' // Maximum Likelihood Estimation
        };
    }

    // Event handlers
    setupEventListeners() {
        document.addEventListener('assessmentStarted', (event) => {
            this.handleAssessmentStarted(event.detail);
        });

        document.addEventListener('questionAnswered', (event) => {
            this.handleQuestionAnswered(event.detail);
        });

        document.addEventListener('assessmentCompleted', (event) => {
            this.handleAssessmentCompleted(event.detail);
        });
    }

    // Public API methods
    createAdaptiveAssessment(config) {
        return this.adaptiveAssessment(config);
    }

    getNextQuestion(assessmentId) {
        const assessment = this.getAssessment(assessmentId);
        return this.generateNextQuestion(assessment);
    }

    submitAnswer(assessmentId, questionId, answer, responseTime, confidence) {
        const assessment = this.getAssessment(assessmentId);
        return this.processAnswer(assessment, questionId, answer, responseTime, confidence);
    }

    getAssessmentAnalysis(assessmentId) {
        const assessment = this.getAssessment(assessmentId);
        return this.analyzePerformance(assessment);
    }

    // Static instance method
    static getInstance() {
        if (!window.adaptiveAssessmentEngineInstance) {
            window.adaptiveAssessmentEngineInstance = new AdaptiveAssessmentEngine();
        }
        return window.adaptiveAssessmentEngineInstance;
    }
}

// Global instance
window.AdaptiveAssessmentEngine = AdaptiveAssessmentEngine;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.adaptiveAssessmentEngine = AdaptiveAssessmentEngine.getInstance();
    console.log('Adaptive Assessment Engine initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdaptiveAssessmentEngine;
}