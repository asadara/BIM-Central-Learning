// Personalized Recommendation Engine
// Phase 3 - Intelligent learning path recommendations based on user data

class PersonalizedRecommendations {
    constructor() {
        this.userProfile = this.loadUserProfile();
        this.learningHistory = this.loadLearningHistory();
        this.preferences = this.loadUserPreferences();
        this.competencyGaps = this.analyzeCompetencyGaps();
        this.recommendationCache = new Map();
        this.mlModel = this.initializeMLModel();

        // Initialize recommendation engine
        this.updateRecommendations();
    }

    // Generate personalized learning recommendations
    generatePersonalizedRecommendations() {
        const recommendations = {
            immediateActions: this.getImmediateActionRecommendations(),
            courseRecommendations: this.generateCourseRecommendations(),
            practiceRecommendations: this.generatePracticeRecommendations(),
            skillDevelopment: this.generateSkillDevelopmentRecommendations(),
            learningPathOptimization: this.optimizeLearningPath(),
            resourceRecommendations: this.generateResourceRecommendations(),
            studySchedule: this.generateOptimalStudySchedule(),
            difficultyAdjustments: this.recommendDifficultyAdjustments(),
            collaborationOpportunities: this.identifyCollaborationOpportunities(),
            careerGuidance: this.generateCareerGuidance()
        };

        this.cacheRecommendations(recommendations);
        return recommendations;
    }

    // Immediate action recommendations based on current context
    getImmediateActionRecommendations() {
        const analytics = window.learningAnalytics || null;
        const currentContext = this.getCurrentLearningContext();
        const timeOfDay = new Date().getHours();
        const dayOfWeek = new Date().getDay();

        const recommendations = [];

        // Time-based recommendations
        if (this.isOptimalLearningTime(timeOfDay)) {
            recommendations.push({
                type: 'timing',
                priority: 'high',
                title: 'Perfect Time to Learn!',
                description: 'Based on your learning patterns, this is your most productive time.',
                action: 'Start a challenging course or practice session',
                reasoning: 'Your focus and retention are typically highest during this time',
                estimatedBenefit: 'Up to 25% better performance'
            });
        }

        // Performance-based recommendations
        const recentPerformance = this.getRecentPerformance();
        if (recentPerformance.trend === 'declining') {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Performance Recovery Suggested',
                description: 'Your recent scores suggest you might benefit from review and reinforcement.',
                action: 'Review fundamental concepts before advancing',
                reasoning: 'Strengthening foundations will improve advanced learning',
                estimatedBenefit: 'Prevent knowledge gaps and improve retention'
            });
        }

        // Engagement-based recommendations
        if (analytics && analytics.calculateFocusScore() < 60) {
            recommendations.push({
                type: 'engagement',
                priority: 'medium',
                title: 'Try Interactive Content',
                description: 'Your focus seems lower today. Interactive content might help.',
                action: 'Switch to hands-on practice or gamified learning',
                reasoning: 'Interactive elements can boost engagement and focus',
                estimatedBenefit: 'Improved focus and better retention'
            });
        }

        // Competency gap recommendations
        const criticalGaps = this.identifyCriticalCompetencyGaps();
        if (criticalGaps.length > 0) {
            recommendations.push({
                type: 'competency',
                priority: 'high',
                title: 'Address Critical Knowledge Gap',
                description: `Focus on ${criticalGaps[0].name} to unlock advanced topics.`,
                action: `Complete ${criticalGaps[0].recommendedCourse}`,
                reasoning: 'This competency is prerequisite for your learning goals',
                estimatedBenefit: 'Unlock 3+ advanced courses in your learning path'
            });
        }

        // Streak and momentum recommendations
        const learningStreak = this.calculateLearningStreak();
        if (learningStreak.current > 0 && learningStreak.risksBreaking) {
            recommendations.push({
                type: 'momentum',
                priority: 'medium',
                title: 'Maintain Your Learning Streak!',
                description: `You're on a ${learningStreak.current}-day streak. Keep it going!`,
                action: 'Complete a quick 15-minute lesson today',
                reasoning: 'Maintaining consistency improves long-term retention',
                estimatedBenefit: 'Sustained motivation and habit formation'
            });
        }

        return recommendations.sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority));
    }

    // Generate course recommendations based on user profile and goals
    generateCourseRecommendations() {
        const userLevel = this.userProfile.level || 'BIM Modeller';
        const interests = this.preferences.topicInterests || [];
        const completedCourses = this.getCompletedCourses();
        const learningGoals = this.userProfile.learningGoals || [];

        // Get available courses from enhanced learning paths
        let availableCourses = [];
        if (typeof window.EnhancedLearningPaths !== 'undefined') {
            const learningPaths = window.EnhancedLearningPaths.getAllLearningPaths();
            learningPaths.forEach(level => {
                if (level.name === userLevel || this.isAccessibleLevel(level.name)) {
                    availableCourses = availableCourses.concat(level.courses);
                }
            });
        }

        // Filter out completed courses
        availableCourses = availableCourses.filter(course =>
            !completedCourses.includes(course.id)
        );

        // Score and rank courses
        const scoredCourses = availableCourses.map(course => {
            const score = this.calculateCourseRecommendationScore(course);
            return { ...course, recommendationScore: score };
        });

        // Sort by recommendation score
        scoredCourses.sort((a, b) => b.recommendationScore - a.recommendationScore);

        // Return top recommendations with reasoning
        return scoredCourses.slice(0, 6).map(course => ({
            course: course,
            score: course.recommendationScore,
            reasoning: this.generateCourseReasoning(course),
            estimatedTimeToComplete: this.estimateCompletionTime(course),
            prerequisitesMet: this.checkPrerequisites(course),
            alignmentWithGoals: this.calculateGoalAlignment(course, learningGoals),
            difficultyMatch: this.assessDifficultyMatch(course),
            careerRelevance: this.assessCareerRelevance(course)
        }));
    }

    // Generate practice recommendations to strengthen weak areas
    generatePracticeRecommendations() {
        const weakAreas = this.identifyWeakAreas();
        const practiceHistory = this.getPracticeHistory();
        const optimalDifficulty = this.calculateOptimalDifficulty();

        const recommendations = [];

        // Address weak areas
        weakAreas.forEach(area => {
            recommendations.push({
                type: 'weakness_reinforcement',
                title: `Strengthen ${area.topic}`,
                description: `Your ${area.topic} skills need reinforcement (${area.confidenceLevel}% confidence)`,
                suggestedPractice: this.findTargetedPractice(area.topic, 'review'),
                estimatedImprovement: this.estimatePracticeImprovement(area),
                timeRecommendation: this.calculateOptimalPracticeTime(area),
                difficultyLevel: 'adaptive',
                priority: area.impactScore
            });
        });

        // Skill maintenance for strong areas
        const strongAreas = this.identifyStrongAreas();
        strongAreas.forEach(area => {
            if (this.needsMaintenance(area)) {
                recommendations.push({
                    type: 'skill_maintenance',
                    title: `Maintain ${area.topic} Expertise`,
                    description: `Keep your strong ${area.topic} skills sharp`,
                    suggestedPractice: this.findTargetedPractice(area.topic, 'maintenance'),
                    estimatedImprovement: 'Skill retention and refinement',
                    timeRecommendation: '15-20 minutes weekly',
                    difficultyLevel: 'challenging',
                    priority: 'medium'
                });
            }
        });

        // Challenge recommendations for high performers
        if (this.isHighPerformer()) {
            recommendations.push({
                type: 'challenge',
                title: 'Take on Advanced Challenges',
                description: 'You\'re ready for more complex problems',
                suggestedPractice: this.findAdvancedChallenges(),
                estimatedImprovement: 'Skill advancement and confidence',
                timeRecommendation: '30-45 minutes',
                difficultyLevel: 'advanced',
                priority: 'high'
            });
        }

        // Exam preparation recommendations
        const upcomingExams = this.getUpcomingExams();
        upcomingExams.forEach(exam => {
            recommendations.push({
                type: 'exam_preparation',
                title: `Prepare for ${exam.title}`,
                description: `Targeted practice for your upcoming ${exam.title} exam`,
                suggestedPractice: this.generateExamPractice(exam),
                estimatedImprovement: `${this.estimateExamScoreImprovement(exam)}% score improvement`,
                timeRecommendation: this.calculateExamPrepTime(exam),
                difficultyLevel: exam.difficulty,
                priority: this.calculateExamPriority(exam)
            });
        });

        return recommendations.sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority));
    }

    // Generate skill development recommendations
    generateSkillDevelopmentRecommendations() {
        const currentSkills = this.assessCurrentSkills();
        const industryDemand = this.getIndustrySkillDemand();
        const careerGoals = this.userProfile.careerGoals || [];

        const recommendations = [];

        // High-demand skills the user doesn't have
        const skillGaps = industryDemand.filter(skill =>
            !currentSkills.find(current => current.name === skill.name) ||
            currentSkills.find(current => current.name === skill.name)?.level < skill.recommendedLevel
        );

        skillGaps.forEach(skill => {
            const currentLevel = currentSkills.find(s => s.name === skill.name)?.level || 0;
            const learningPath = this.generateSkillLearningPath(skill, currentLevel);

            recommendations.push({
                skill: skill.name,
                currentLevel: this.levelToString(currentLevel),
                targetLevel: this.levelToString(skill.recommendedLevel),
                marketDemand: skill.demand,
                careerImpact: skill.careerImpact,
                learningPath: learningPath,
                estimatedTimeInvestment: this.calculateSkillTimeInvestment(skill, currentLevel),
                priorityScore: this.calculateSkillPriority(skill, careerGoals),
                prerequisites: skill.prerequisites || [],
                certificationAvailable: skill.hasCertification,
                salaryImpact: skill.salaryImpact || null
            });
        });

        // Skill advancement opportunities
        const advancementOpportunities = currentSkills.filter(skill =>
            skill.level >= 3 && skill.level < 5 && // Intermediate to advanced progression
            this.hasAdvancementOpportunity(skill)
        );

        advancementOpportunities.forEach(skill => {
            recommendations.push({
                type: 'skill_advancement',
                skill: skill.name,
                currentLevel: this.levelToString(skill.level),
                targetLevel: this.levelToString(Math.min(skill.level + 1, 5)),
                opportunity: this.getAdvancementOpportunity(skill),
                estimatedBenefit: this.calculateAdvancementBenefit(skill),
                recommendedActions: this.getAdvancementActions(skill),
                timeframe: this.estimateAdvancementTimeframe(skill)
            });
        });

        return recommendations.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    }

    // Optimize learning path based on goals and constraints
    optimizeLearningPath() {
        const currentPath = this.userProfile.currentLearningPath || [];
        const learningGoals = this.userProfile.learningGoals || [];
        const timeConstraints = this.preferences.timeConstraints || {};
        const difficultyPreference = this.preferences.difficultyPreference || 'adaptive';

        // Analyze current path efficiency
        const pathAnalysis = this.analyzeLearningPathEfficiency(currentPath);

        // Generate optimized path
        const optimizedPath = this.generateOptimizedPath({
            goals: learningGoals,
            constraints: timeConstraints,
            preferences: this.preferences,
            currentProgress: this.getUserProgress(),
            competencies: this.competencyGaps
        });

        // Compare paths and provide recommendations
        const comparison = this.comparePathEfficiency(currentPath, optimizedPath);

        return {
            currentPath: {
                courses: currentPath,
                efficiency: pathAnalysis.efficiency,
                estimatedTime: pathAnalysis.totalTime,
                goalAlignment: pathAnalysis.goalAlignment
            },
            optimizedPath: {
                courses: optimizedPath.courses,
                efficiency: optimizedPath.efficiency,
                estimatedTime: optimizedPath.totalTime,
                goalAlignment: optimizedPath.goalAlignment,
                improvements: optimizedPath.improvements
            },
            recommendations: this.generatePathOptimizationRecommendations(comparison),
            alternativePaths: this.generateAlternativePaths(learningGoals, timeConstraints)
        };
    }

    // Generate optimal study schedule
    generateOptimalStudySchedule() {
        const availability = this.preferences.studyAvailability || {};
        const learningPatterns = this.analyzeLearningPatterns();
        const currentCommitments = this.userProfile.commitments || [];
        const energyLevels = this.analyzeEnergyPatterns();

        // Generate weekly schedule
        const weeklySchedule = this.generateWeeklySchedule({
            availability,
            patterns: learningPatterns,
            commitments: currentCommitments,
            energy: energyLevels
        });

        // Optimize for different learning activities
        const optimizedSchedule = this.optimizeScheduleForActivities(weeklySchedule);

        return {
            weeklySchedule: optimizedSchedule,
            dailyRecommendations: this.generateDailyRecommendations(),
            flexibilityOptions: this.generateFlexibilityOptions(),
            productivityTips: this.generateProductivityTips(),
            scheduleEfficiency: this.calculateScheduleEfficiency(optimizedSchedule)
        };
    }

    // Machine learning model for recommendations
    initializeMLModel() {
        // Simple collaborative filtering and content-based recommendation model
        return {
            userSimilarity: this.calculateUserSimilarity(),
            itemSimilarity: this.calculateItemSimilarity(),
            preferences: this.extractUserPreferences(),
            performancePredictor: this.buildPerformancePredictor()
        };
    }

    // Calculate course recommendation score
    calculateCourseRecommendationScore(course) {
        let score = 0;

        // Interest alignment (25%)
        const interestScore = this.calculateInterestAlignment(course);
        score += interestScore * 0.25;

        // Difficulty appropriateness (20%)
        const difficultyScore = this.calculateDifficultyAppropriate(course);
        score += difficultyScore * 0.20;

        // Prerequisite satisfaction (20%)
        const prerequisiteScore = this.checkPrerequisites(course) ? 100 : 0;
        score += prerequisiteScore * 0.20;

        // Learning goal alignment (15%)
        const goalScore = this.calculateGoalAlignment(course, this.userProfile.learningGoals);
        score += goalScore * 0.15;

        // Time availability match (10%)
        const timeScore = this.calculateTimeMatch(course);
        score += timeScore * 0.10;

        // Peer recommendation (5%)
        const peerScore = this.calculatePeerRecommendation(course);
        score += peerScore * 0.05;

        // Career relevance (5%)
        const careerScore = this.assessCareerRelevance(course);
        score += careerScore * 0.05;

        return Math.round(score);
    }

    // Analyze competency gaps
    analyzeCompetencyGaps() {
        const currentCompetencies = this.assessCurrentCompetencies();
        const targetCompetencies = this.getTargetCompetencies();

        const gaps = [];

        targetCompetencies.forEach(target => {
            const current = currentCompetencies.find(c => c.id === target.id);
            const currentLevel = current ? current.level : 0;

            if (currentLevel < target.requiredLevel) {
                gaps.push({
                    competencyId: target.id,
                    name: target.name,
                    category: target.category,
                    currentLevel: currentLevel,
                    requiredLevel: target.requiredLevel,
                    gap: target.requiredLevel - currentLevel,
                    priority: target.priority || 'medium',
                    impact: this.calculateGapImpact(target, currentLevel),
                    recommendations: this.generateGapRecommendations(target, currentLevel)
                });
            }
        });

        return gaps.sort((a, b) => b.impact - a.impact);
    }

    // Helper methods
    isOptimalLearningTime(hour) {
        const patterns = this.learningHistory.timePreferences || {};
        const peakHours = patterns.peakHours || [9, 10, 14, 15, 19, 20];
        return peakHours.includes(hour);
    }

    priorityScore(priority) {
        const scores = { high: 3, medium: 2, low: 1 };
        return scores[priority] || 1;
    }

    calculateLearningStreak() {
        const history = this.learningHistory.dailyActivity || [];
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        let current = 0;
        let risksBreaking = false;

        // Calculate current streak
        for (let i = history.length - 1; i >= 0; i--) {
            const activityDate = new Date(history[i].date).toDateString();
            if (activityDate === today || (current === 0 && activityDate === yesterday)) {
                current++;
            } else {
                break;
            }
        }

        // Check if streak risks breaking
        const todayActivity = history.find(h => new Date(h.date).toDateString() === today);
        risksBreaking = !todayActivity && current > 0;

        return { current, risksBreaking, longestStreak: this.calculateLongestStreak(history) };
    }

    // Cache management
    cacheRecommendations(recommendations) {
        const cacheKey = `recommendations_${this.userProfile.userId}_${Date.now()}`;
        this.recommendationCache.set(cacheKey, {
            recommendations,
            timestamp: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        });

        // Clean old cache entries
        this.cleanCache();
    }

    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.recommendationCache.entries()) {
            if (value.expiresAt < now) {
                this.recommendationCache.delete(key);
            }
        }
    }

    // Data persistence
    saveUserProfile() {
        try {
            localStorage.setItem('recommendations_userProfile', JSON.stringify(this.userProfile));
        } catch (error) {
            console.error('Error saving user profile:', error);
        }
    }

    saveUserPreferences() {
        try {
            localStorage.setItem('recommendations_preferences', JSON.stringify(this.preferences));
        } catch (error) {
            console.error('Error saving user preferences:', error);
        }
    }

    // Data loading
    loadUserProfile() {
        try {
            const saved = localStorage.getItem('recommendations_userProfile');
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return saved ? JSON.parse(saved) : this.createDefaultProfile(userData);
        } catch (error) {
            console.error('Error loading user profile:', error);
            return this.createDefaultProfile({});
        }
    }

    loadUserPreferences() {
        try {
            const saved = localStorage.getItem('recommendations_preferences');
            return saved ? JSON.parse(saved) : this.createDefaultPreferences();
        } catch (error) {
            console.error('Error loading user preferences:', error);
            return this.createDefaultPreferences();
        }
    }

    loadLearningHistory() {
        try {
            const performanceMetrics = JSON.parse(localStorage.getItem('learningAnalytics_performance') || '[]');
            const sessions = JSON.parse(localStorage.getItem('learningAnalytics_sessions') || '[]');
            return this.processLearningHistory(performanceMetrics, sessions);
        } catch (error) {
            console.error('Error loading learning history:', error);
            return {};
        }
    }

    // Default data creators
    createDefaultProfile(userData) {
        return {
            userId: userData.userId || 'user_' + Date.now(),
            level: userData.level || 'BIM Modeller',
            learningGoals: userData.learningGoals || ['Improve BIM skills', 'Get certified'],
            careerGoals: userData.careerGoals || ['Advance to BIM Coordinator'],
            currentLearningPath: userData.currentLearningPath || [],
            commitments: userData.commitments || [],
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };
    }

    createDefaultPreferences() {
        return {
            topicInterests: ['Revit', 'AutoCAD', 'BIM Coordination'],
            difficultyPreference: 'adaptive',
            learningStyle: 'mixed',
            timeConstraints: {
                dailyAvailable: 60, // minutes
                weeklyAvailable: 420, // minutes
                preferredSessionLength: 30 // minutes
            },
            studyAvailability: {
                weekdays: [9, 14, 19], // preferred hours
                weekends: [10, 14, 16]
            },
            notificationPreferences: {
                reminders: true,
                achievements: true,
                recommendations: true
            }
        };
    }

    // Public API
    updateRecommendations() {
        const recommendations = this.generatePersonalizedRecommendations();
        this.saveRecommendations(recommendations);
        return recommendations;
    }

    getRecommendations(category = 'all') {
        const cached = this.getCachedRecommendations();
        if (cached && cached.timestamp > Date.now() - (30 * 60 * 1000)) { // 30 minutes
            return category === 'all' ? cached.recommendations : cached.recommendations[category];
        }

        return this.updateRecommendations();
    }

    // Static instance method
    static getInstance() {
        if (!window.personalizedRecommendationsInstance) {
            window.personalizedRecommendationsInstance = new PersonalizedRecommendations();
        }
        return window.personalizedRecommendationsInstance;
    }
}

// Global instance
window.PersonalizedRecommendations = PersonalizedRecommendations;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.personalizedRecommendations = PersonalizedRecommendations.getInstance();
    console.log('Personalized Recommendations Engine initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonalizedRecommendations;
}