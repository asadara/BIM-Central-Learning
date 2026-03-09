// Advanced Learning Analytics System
// Phase 3 - Comprehensive learning data tracking and analysis

class AdvancedAnalytics {
    constructor() {
        this.sessionStart = Date.now();
        this.currentSession = this.initializeSession();
        this.performanceMetrics = this.loadPerformanceMetrics();
        this.learningPatterns = this.loadLearningPatterns();
        this.competencyTracking = this.loadCompetencyTracking();
        this.engagementMetrics = this.loadEngagementMetrics();

        // Initialize real-time tracking
        this.initializeRealTimeTracking();
        this.setupEventListeners();
    }

    // Initialize current learning session
    initializeSession() {
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const session = {
            id: sessionId,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            activities: [],
            pageViews: [],
            interactions: [],
            focusTime: 0,
            idleTime: 0,
            lastActivity: Date.now(),
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            referrer: document.referrer
        };

        this.saveSessionData(session);
        return session;
    }

    // Track detailed performance metrics across all learning activities
    trackPerformanceMetrics(activity) {
        const metrics = {
            timestamp: Date.now(),
            sessionId: this.currentSession.id,
            activityType: activity.type, // 'course', 'practice', 'exam', 'video', 'reading'
            activityId: activity.id,
            activityTitle: activity.title,

            // Performance data
            score: activity.score || null,
            accuracy: activity.accuracy || null,
            completionRate: activity.completionRate || null,
            timeSpent: activity.timeSpent || 0,
            attemptsCount: activity.attempts || 1,

            // Behavioral metrics
            pauseCount: activity.pauseCount || 0,
            replayCount: activity.replayCount || 0,
            helpRequests: activity.helpRequests || 0,
            hintUsage: activity.hintUsage || 0,

            // Difficulty analysis
            perceivedDifficulty: activity.perceivedDifficulty || null,
            actualDifficulty: activity.actualDifficulty || null,
            strugglingIndicators: activity.strugglingIndicators || [],

            // Context data
            deviceType: this.getDeviceType(),
            connectionSpeed: this.getConnectionSpeed(),
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),

            // Competency mapping
            competenciesTargeted: activity.competencies || [],
            competenciesAchieved: activity.achievedCompetencies || [],
            skillsImproved: activity.skillsImproved || [],

            // Engagement indicators
            focusScore: this.calculateFocusScore(),
            interactionDepth: this.calculateInteractionDepth(),
            persistenceLevel: this.calculatePersistenceLevel()
        };

        this.performanceMetrics.push(metrics);
        this.savePerformanceMetrics();
        this.updateRealTimeAnalytics(metrics);

        return metrics;
    }

    // Analyze learning patterns and behavior
    analyzeLearningPatterns() {
        const patterns = {
            preferredLearningTimes: this.analyzeTimePreferences(),
            learningVelocity: this.calculateLearningVelocity(),
            difficultyProgression: this.analyzeDifficultyProgression(),
            topicAffinities: this.analyzeTopicAffinities(),
            learningStyle: this.identifyLearningStyle(),
            retentionPatterns: this.analyzeRetentionPatterns(),
            strugglingAreas: this.identifyStrugglingAreas(),
            strengths: this.identifyStrengths(),
            optimalSessionLength: this.calculateOptimalSessionLength(),
            breakPatterns: this.analyzeBreakPatterns()
        };

        this.learningPatterns = { ...this.learningPatterns, ...patterns };
        this.saveLearningPatterns();

        return patterns;
    }

    // Advanced competency tracking with detailed progression
    trackCompetencyProgress(competencyData) {
        const competencyId = competencyData.competencyId;
        const currentLevel = competencyData.currentLevel;
        const targetLevel = competencyData.targetLevel;

        if (!this.competencyTracking[competencyId]) {
            this.competencyTracking[competencyId] = {
                id: competencyId,
                name: competencyData.name,
                category: competencyData.category,
                progression: [],
                currentLevel: 'Novice',
                targetLevel: targetLevel || 'Expert',
                milestones: [],
                assessments: [],
                learningResources: [],
                timeInvested: 0,
                masteryScore: 0,
                confidenceLevel: 0,
                practicalApplications: []
            };
        }

        const competency = this.competencyTracking[competencyId];

        // Record progression point
        const progressPoint = {
            timestamp: Date.now(),
            previousLevel: competency.currentLevel,
            newLevel: currentLevel,
            evidenceType: competencyData.evidenceType, // 'assessment', 'project', 'practice'
            evidenceScore: competencyData.score,
            assessorFeedback: competencyData.feedback || null,
            confidenceRating: competencyData.confidenceRating || null,
            practicalDemo: competencyData.practicalDemo || null
        };

        competency.progression.push(progressPoint);
        competency.currentLevel = currentLevel;
        competency.timeInvested += competencyData.timeSpent || 0;
        competency.masteryScore = this.calculateMasteryScore(competency);
        competency.confidenceLevel = this.calculateConfidenceLevel(competency);

        // Check for milestone achievements
        this.checkCompetencyMilestones(competency, competencyData);

        this.saveCompetencyTracking();
        this.triggerCompetencyEvents(competency, progressPoint);

        return competency;
    }

    // Track engagement metrics for optimization
    trackEngagementMetrics() {
        const engagement = {
            timestamp: Date.now(),
            sessionId: this.currentSession.id,

            // Attention metrics
            focusTime: this.calculateFocusTime(),
            tabSwitches: this.currentSession.tabSwitches || 0,
            scrollDepth: this.calculateScrollDepth(),
            clickHeatmap: this.generateClickHeatmap(),

            // Interaction quality
            meaningfulInteractions: this.countMeaningfulInteractions(),
            exploratoryBehavior: this.measureExploratoryBehavior(),
            helpSeekingBehavior: this.analyzeHelpSeekingBehavior(),

            // Emotional engagement
            frustrationIndicators: this.detectFrustrationIndicators(),
            flowStateIndicators: this.detectFlowStateIndicators(),
            motivationLevel: this.estimateMotivationLevel(),

            // Social engagement
            collaborationLevel: this.measureCollaborationLevel(),
            peerInteractionQuality: this.analyzePeerInteraction(),
            communityParticipation: this.measureCommunityParticipation()
        };

        this.engagementMetrics.push(engagement);
        this.saveEngagementMetrics();

        return engagement;
    }

    // Generate predictive insights
    generatePredictiveInsights() {
        const insights = {
            performancePrediction: this.predictFuturePerformance(),
            completionPrediction: this.predictCompletionLikelihood(),
            riskAssessment: this.assessLearningRisks(),
            recommendedInterventions: this.suggestInterventions(),
            optimalLearningPath: this.predictOptimalPath(),
            timeToCompetency: this.estimateTimeToCompetency(),
            difficultyRecommendations: this.recommendDifficultyAdjustments(),
            engagementForecast: this.forecastEngagementTrends()
        };

        return insights;
    }

    // Real-time analytics dashboard data
    getRealTimeDashboardData() {
        const currentSession = this.getCurrentSessionMetrics();
        const todayMetrics = this.getTodayMetrics();
        const weeklyTrends = this.getWeeklyTrends();
        const competencyProgress = this.getCompetencyProgressSummary();

        return {
            session: currentSession,
            today: todayMetrics,
            weekly: weeklyTrends,
            competencies: competencyProgress,
            alerts: this.getActiveAlerts(),
            recommendations: this.getCurrentRecommendations(),
            achievements: this.getRecentAchievements(),
            insights: this.generatePredictiveInsights()
        };
    }

    // Helper methods for calculations
    calculateFocusScore() {
        const totalTime = Date.now() - this.currentSession.startTime;
        const focusTime = this.currentSession.focusTime || totalTime * 0.8; // Default assumption
        return Math.round((focusTime / totalTime) * 100);
    }

    calculateInteractionDepth() {
        const interactions = this.currentSession.interactions || [];
        const meaningfulInteractions = interactions.filter(i => i.type !== 'click' && i.duration > 1000);
        return meaningfulInteractions.length;
    }

    calculatePersistenceLevel() {
        const activities = this.currentSession.activities || [];
        const completedActivities = activities.filter(a => a.completed);
        const attemptedActivities = activities.filter(a => a.attempts > 1);

        if (activities.length === 0) return 0;

        const completionRate = completedActivities.length / activities.length;
        const retryRate = attemptedActivities.length / activities.length;

        return Math.round((completionRate * 0.7 + retryRate * 0.3) * 100);
    }

    analyzeTimePreferences() {
        const hourlyActivity = new Array(24).fill(0);
        this.performanceMetrics.forEach(metric => {
            const hour = new Date(metric.timestamp).getHours();
            hourlyActivity[hour] += metric.timeSpent || 0;
        });

        const peakHours = hourlyActivity
            .map((activity, hour) => ({ hour, activity }))
            .sort((a, b) => b.activity - a.activity)
            .slice(0, 3)
            .map(item => item.hour);

        return {
            peakHours,
            totalHourlyActivity: hourlyActivity,
            preferredTimeSlot: this.categorizeTimeSlot(peakHours[0])
        };
    }

    calculateLearningVelocity() {
        const recentMetrics = this.performanceMetrics
            .filter(m => Date.now() - m.timestamp < 7 * 24 * 60 * 60 * 1000) // Last 7 days
            .sort((a, b) => a.timestamp - b.timestamp);

        if (recentMetrics.length < 2) return { velocity: 0, trend: 'insufficient_data' };

        const timeSpan = recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp;
        const totalProgress = recentMetrics.reduce((sum, m) => sum + (m.completionRate || 0), 0);

        const velocity = (totalProgress / (timeSpan / (24 * 60 * 60 * 1000))); // Progress per day

        // Calculate trend
        const firstHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
        const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum, m) => sum + (m.score || 0), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, m) => sum + (m.score || 0), 0) / secondHalf.length;

        let trend = 'stable';
        if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'improving';
        else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'declining';

        return { velocity, trend, improvement: secondHalfAvg - firstHalfAvg };
    }

    // Setup event listeners for real-time tracking
    setupEventListeners() {
        // Page visibility tracking
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.currentSession.lastFocusLost = Date.now();
            } else {
                if (this.currentSession.lastFocusLost) {
                    const idleTime = Date.now() - this.currentSession.lastFocusLost;
                    this.currentSession.idleTime += idleTime;
                }
                this.currentSession.lastActivity = Date.now();
            }
        });

        // Mouse and keyboard activity tracking
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, this.trackUserActivity.bind(this), { passive: true });
        });

        // Before page unload - save session data
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });

        // Periodic data saving
        setInterval(() => {
            this.saveSessionData(this.currentSession);
            this.trackEngagementMetrics();
        }, 30000); // Every 30 seconds
    }

    trackUserActivity(event) {
        const activity = {
            type: event.type,
            timestamp: Date.now(),
            target: event.target.tagName,
            className: event.target.className,
            x: event.clientX || null,
            y: event.clientY || null
        };

        this.currentSession.interactions.push(activity);
        this.currentSession.lastActivity = Date.now();

        // Limit interaction history to prevent memory issues
        if (this.currentSession.interactions.length > 1000) {
            this.currentSession.interactions = this.currentSession.interactions.slice(-500);
        }
    }

    // Data persistence methods
    saveSessionData(session) {
        try {
            const sessions = JSON.parse(localStorage.getItem('learningAnalytics_sessions') || '[]');
            const existingIndex = sessions.findIndex(s => s.id === session.id);

            if (existingIndex >= 0) {
                sessions[existingIndex] = session;
            } else {
                sessions.push(session);
            }

            // Keep only last 50 sessions
            if (sessions.length > 50) {
                sessions.splice(0, sessions.length - 50);
            }

            localStorage.setItem('learningAnalytics_sessions', JSON.stringify(sessions));
        } catch (error) {
            console.error('Error saving session data:', error);
        }
    }

    savePerformanceMetrics() {
        try {
            localStorage.setItem('learningAnalytics_performance', JSON.stringify(this.performanceMetrics));
        } catch (error) {
            console.error('Error saving performance metrics:', error);
        }
    }

    saveLearningPatterns() {
        try {
            localStorage.setItem('learningAnalytics_patterns', JSON.stringify(this.learningPatterns));
        } catch (error) {
            console.error('Error saving learning patterns:', error);
        }
    }

    saveCompetencyTracking() {
        try {
            localStorage.setItem('learningAnalytics_competencies', JSON.stringify(this.competencyTracking));
        } catch (error) {
            console.error('Error saving competency tracking:', error);
        }
    }

    saveEngagementMetrics() {
        try {
            localStorage.setItem('learningAnalytics_engagement', JSON.stringify(this.engagementMetrics));
        } catch (error) {
            console.error('Error saving engagement metrics:', error);
        }
    }

    // Data loading methods
    loadPerformanceMetrics() {
        try {
            return JSON.parse(localStorage.getItem('learningAnalytics_performance') || '[]');
        } catch (error) {
            console.error('Error loading performance metrics:', error);
            return [];
        }
    }

    loadLearningPatterns() {
        try {
            return JSON.parse(localStorage.getItem('learningAnalytics_patterns') || '{}');
        } catch (error) {
            console.error('Error loading learning patterns:', error);
            return {};
        }
    }

    loadCompetencyTracking() {
        try {
            return JSON.parse(localStorage.getItem('learningAnalytics_competencies') || '{}');
        } catch (error) {
            console.error('Error loading competency tracking:', error);
            return {};
        }
    }

    loadEngagementMetrics() {
        try {
            return JSON.parse(localStorage.getItem('learningAnalytics_engagement') || '[]');
        } catch (error) {
            console.error('Error loading engagement metrics:', error);
            return [];
        }
    }

    // Utility methods
    getDeviceType() {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }

    getConnectionSpeed() {
        if (navigator.connection) {
            return navigator.connection.effectiveType || 'unknown';
        }
        return 'unknown';
    }

    categorizeTimeSlot(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    }

    endSession() {
        this.currentSession.endTime = Date.now();
        this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
        this.saveSessionData(this.currentSession);

        // Generate session summary
        const summary = this.generateSessionSummary();
        console.log('Session ended:', summary);

        return summary;
    }

    generateSessionSummary() {
        return {
            sessionId: this.currentSession.id,
            duration: this.currentSession.duration,
            activitiesCompleted: this.currentSession.activities.length,
            totalInteractions: this.currentSession.interactions.length,
            focusScore: this.calculateFocusScore(),
            productivityScore: this.calculateProductivityScore()
        };
    }

    calculateProductivityScore() {
        const activities = this.currentSession.activities || [];
        const completedActivities = activities.filter(a => a.completed);
        const totalTime = this.currentSession.duration || 1;
        const activeTime = totalTime - (this.currentSession.idleTime || 0);

        const completionRate = activities.length > 0 ? completedActivities.length / activities.length : 0;
        const activeTimeRatio = activeTime / totalTime;

        return Math.round((completionRate * 0.6 + activeTimeRatio * 0.4) * 100);
    }

    // Initialize real-time tracking
    initializeRealTimeTracking() {
        // Start performance monitoring
        if ('performance' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                        this.currentSession.pageLoadTime = entry.loadEventEnd - entry.loadEventStart;
                    }
                }
            });

            try {
                this.performanceObserver.observe({ entryTypes: ['navigation', 'measure'] });
            } catch (error) {
                console.warn('Performance Observer not supported:', error);
            }
        }
    }

    // Public API methods
    static getInstance() {
        if (!window.advancedAnalyticsInstance) {
            window.advancedAnalyticsInstance = new AdvancedAnalytics();
        }
        return window.advancedAnalyticsInstance;
    }

    // Export data for external analysis
    exportAnalyticsData() {
        return {
            performanceMetrics: this.performanceMetrics,
            learningPatterns: this.learningPatterns,
            competencyTracking: this.competencyTracking,
            engagementMetrics: this.engagementMetrics,
            sessions: JSON.parse(localStorage.getItem('learningAnalytics_sessions') || '[]')
        };
    }
}

// Global Analytics Instance
window.AdvancedAnalytics = AdvancedAnalytics;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.learningAnalytics = AdvancedAnalytics.getInstance();
    console.log('Advanced Learning Analytics initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedAnalytics;
}