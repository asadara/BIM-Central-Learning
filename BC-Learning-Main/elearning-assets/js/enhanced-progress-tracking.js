// Enhanced Progress Tracking System
// Phase 3 - Visual dashboards, milestone achievements, and predictive analytics

class EnhancedProgressTracking {
    constructor() {
        this.progressData = this.loadProgressData();
        this.milestones = this.loadMilestones();
        this.achievements = this.loadAchievements();
        this.visualizations = new Map();
        this.predictionModels = this.initializePredictionModels();

        // Initialize tracking systems
        this.initializeTracking();
        this.setupEventListeners();
    }

    // Comprehensive progress tracking across all learning dimensions
    trackComprehensiveProgress() {
        const progressMetrics = {
            // Overall learning progress
            overallProgress: this.calculateOverallProgress(),

            // Competency-based progress
            competencyProgress: this.trackCompetencyProgress(),

            // Course completion progress
            courseProgress: this.trackCourseProgress(),

            // Skill development progress
            skillProgress: this.trackSkillProgress(),

            // Knowledge retention progress
            retentionProgress: this.trackKnowledgeRetention(),

            // Engagement and motivation progress
            engagementProgress: this.trackEngagementProgress(),

            // Time and efficiency progress
            efficiencyProgress: this.trackLearningEfficiency(),

            // Goal achievement progress
            goalProgress: this.trackGoalAchievement(),

            // Certification progress
            certificationProgress: this.trackCertificationProgress(),

            // Collaborative learning progress
            collaborationProgress: this.trackCollaborationProgress()
        };

        this.updateProgressHistory(progressMetrics);
        this.checkMilestoneAchievements(progressMetrics);
        this.generateProgressPredictions(progressMetrics);

        return progressMetrics;
    }

    // Visual dashboard creation
    createVisualDashboard(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return null;
        }

        const dashboard = this.generateDashboardHTML(options);
        container.innerHTML = dashboard;

        // Initialize interactive visualizations
        this.initializeCharts(containerId, options);
        this.initializeInteractiveElements(containerId);

        return { containerId, dashboard };
    }

    // Generate comprehensive dashboard HTML
    generateDashboardHTML(options) {
        const progress = this.trackComprehensiveProgress();
        const recommendations = this.getProgressRecommendations();
        const milestones = this.getUpcomingMilestones();

        return `
            <div class="enhanced-progress-dashboard" data-theme="${options.theme || 'default'}">
                <!-- Progress Overview Section -->
                <div class="progress-overview-section">
                    <h2 class="section-title">
                        <i class="fas fa-chart-line"></i>
                        Learning Progress Overview
                    </h2>
                    
                    <!-- Key Metrics Cards -->
                    <div class="metrics-grid">
                        ${this.generateMetricsCards(progress)}
                    </div>
                    
                    <!-- Progress Visualization -->
                    <div class="progress-visualization">
                        <div class="chart-container">
                            <canvas id="overallProgressChart"></canvas>
                        </div>
                        <div class="progress-insights">
                            ${this.generateProgressInsights(progress)}
                        </div>
                    </div>
                </div>

                <!-- Competency Progress Section -->
                <div class="competency-progress-section">
                    <h3 class="section-title">
                        <i class="fas fa-brain"></i>
                        Competency Development
                    </h3>
                    
                    <div class="competency-grid">
                        ${this.generateCompetencyProgress(progress.competencyProgress)}
                    </div>
                    
                    <div class="competency-chart-container">
                        <canvas id="competencyRadarChart"></canvas>
                    </div>
                </div>

                <!-- Learning Path Progress -->
                <div class="learning-path-section">
                    <h3 class="section-title">
                        <i class="fas fa-route"></i>
                        Learning Path Progress
                    </h3>
                    
                    <div class="path-visualization">
                        <div class="path-timeline" id="learningPathTimeline">
                            ${this.generateLearningPathTimeline()}
                        </div>
                    </div>
                </div>

                <!-- Milestone Achievements -->
                <div class="milestones-section">
                    <h3 class="section-title">
                        <i class="fas fa-flag-checkered"></i>
                        Milestones & Achievements
                    </h3>
                    
                    <div class="milestones-container">
                        <div class="achieved-milestones">
                            <h4>Recently Achieved</h4>
                            ${this.generateAchievedMilestones()}
                        </div>
                        
                        <div class="upcoming-milestones">
                            <h4>Upcoming Milestones</h4>
                            ${this.generateUpcomingMilestones(milestones)}
                        </div>
                    </div>
                </div>

                <!-- Performance Trends -->
                <div class="performance-trends-section">
                    <h3 class="section-title">
                        <i class="fas fa-trending-up"></i>
                        Performance Trends
                    </h3>
                    
                    <div class="trends-container">
                        <div class="trend-chart">
                            <canvas id="performanceTrendChart"></canvas>
                        </div>
                        
                        <div class="trend-analysis">
                            ${this.generateTrendAnalysis()}
                        </div>
                    </div>
                </div>

                <!-- Predictive Analytics -->
                <div class="predictions-section">
                    <h3 class="section-title">
                        <i class="fas fa-crystal-ball"></i>
                        Predictive Insights
                    </h3>
                    
                    <div class="predictions-container">
                        ${this.generatePredictiveInsights()}
                    </div>
                </div>

                <!-- Progress Recommendations -->
                <div class="recommendations-section">
                    <h3 class="section-title">
                        <i class="fas fa-lightbulb"></i>
                        Progress Recommendations
                    </h3>
                    
                    <div class="recommendations-container">
                        ${this.generateProgressRecommendations(recommendations)}
                    </div>
                </div>

                <!-- Detailed Analytics Modal -->
                <div class="analytics-modal" id="detailedAnalyticsModal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Detailed Analytics</h3>
                            <button class="close-modal" onclick="this.closest('.analytics-modal').style.display='none'">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body" id="detailedAnalyticsContent">
                            <!-- Content loaded dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Generate metrics cards
    generateMetricsCards(progress) {
        const metrics = [
            {
                title: 'Overall Progress',
                value: `${Math.round(progress.overallProgress.percentage)}%`,
                change: progress.overallProgress.weeklyChange,
                icon: 'fas fa-chart-pie',
                color: 'primary'
            },
            {
                title: 'Competencies Mastered',
                value: `${progress.competencyProgress.mastered}/${progress.competencyProgress.total}`,
                change: progress.competencyProgress.recentlyMastered,
                icon: 'fas fa-brain',
                color: 'success'
            },
            {
                title: 'Learning Velocity',
                value: `${Math.round(progress.efficiencyProgress.velocity)}%/week`,
                change: progress.efficiencyProgress.velocityTrend,
                icon: 'fas fa-tachometer-alt',
                color: 'info'
            },
            {
                title: 'Knowledge Retention',
                value: `${Math.round(progress.retentionProgress.overallRetention)}%`,
                change: progress.retentionProgress.retentionTrend,
                icon: 'fas fa-memory',
                color: 'warning'
            },
            {
                title: 'Study Streak',
                value: `${progress.engagementProgress.currentStreak} days`,
                change: progress.engagementProgress.streakTrend,
                icon: 'fas fa-fire',
                color: 'danger'
            },
            {
                title: 'Goal Achievement',
                value: `${Math.round(progress.goalProgress.completionRate)}%`,
                change: progress.goalProgress.recentAchievements,
                icon: 'fas fa-target',
                color: 'secondary'
            }
        ];

        return metrics.map(metric => `
            <div class="metric-card ${metric.color}">
                <div class="metric-icon">
                    <i class="${metric.icon}"></i>
                </div>
                <div class="metric-content">
                    <div class="metric-value">${metric.value}</div>
                    <div class="metric-title">${metric.title}</div>
                    <div class="metric-change ${metric.change >= 0 ? 'positive' : 'negative'}">
                        <i class="fas fa-${metric.change >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                        ${Math.abs(metric.change)}${typeof metric.change === 'number' ? '%' : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Generate competency progress visualization
    generateCompetencyProgress(competencyProgress) {
        const competencies = competencyProgress.details || [];

        return competencies.map(comp => `
            <div class="competency-item">
                <div class="competency-header">
                    <h4>${comp.name}</h4>
                    <span class="competency-level level-${comp.currentLevel.toLowerCase()}">${comp.currentLevel}</span>
                </div>
                
                <div class="competency-progress-bar">
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${comp.progress}%"></div>
                    </div>
                    <span class="progress-text">${comp.progress}%</span>
                </div>
                
                <div class="competency-details">
                    <div class="time-invested">
                        <i class="fas fa-clock"></i>
                        ${comp.timeInvested} hours
                    </div>
                    <div class="mastery-score">
                        <i class="fas fa-star"></i>
                        ${comp.masteryScore}/100
                    </div>
                    <div class="next-milestone">
                        <i class="fas fa-flag"></i>
                        ${comp.nextMilestone}
                    </div>
                </div>
                
                <div class="competency-actions">
                    <button class="btn-sm btn-outline" onclick="showCompetencyDetails('${comp.id}')">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Generate learning path timeline
    generateLearningPathTimeline() {
        const pathData = this.getLearningPathData();

        return `
            <div class="timeline">
                ${pathData.map((item, index) => `
                    <div class="timeline-item ${item.status}">
                        <div class="timeline-marker">
                            <i class="fas fa-${this.getTimelineIcon(item.type, item.status)}"></i>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <h4>${item.title}</h4>
                                <span class="timeline-date">${this.formatDate(item.date)}</span>
                            </div>
                            <div class="timeline-body">
                                <p>${item.description}</p>
                                ${item.progress ? `
                                    <div class="timeline-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${item.progress}%"></div>
                                        </div>
                                        <span>${item.progress}% complete</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Initialize interactive charts
    initializeCharts(containerId, options) {
        // Overall Progress Chart
        this.createOverallProgressChart();

        // Competency Radar Chart
        this.createCompetencyRadarChart();

        // Performance Trend Chart
        this.createPerformanceTrendChart();

        // Efficiency Chart
        this.createEfficiencyChart();

        // Retention Analysis Chart
        this.createRetentionChart();
    }

    // Create overall progress chart
    createOverallProgressChart() {
        const ctx = document.getElementById('overallProgressChart');
        if (!ctx) return;

        const progressData = this.getProgressChartData();

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: progressData.labels,
                datasets: [{
                    data: progressData.values,
                    backgroundColor: [
                        '#06BBCC',
                        '#FD7E14',
                        '#198754',
                        '#DC3545',
                        '#6F42C1',
                        '#FFC107'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const percentage = Math.round((context.parsed / context.dataset.data.reduce((a, b) => a + b)) * 100);
                                return `${context.label}: ${percentage}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Create competency radar chart
    createCompetencyRadarChart() {
        const ctx = document.getElementById('competencyRadarChart');
        if (!ctx) return;

        const competencyData = this.getCompetencyChartData();

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: competencyData.labels,
                datasets: [{
                    label: 'Current Level',
                    data: competencyData.current,
                    borderColor: '#06BBCC',
                    backgroundColor: 'rgba(6, 187, 204, 0.2)',
                    pointBackgroundColor: '#06BBCC',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#06BBCC'
                }, {
                    label: 'Target Level',
                    data: competencyData.target,
                    borderColor: '#FD7E14',
                    backgroundColor: 'rgba(253, 126, 20, 0.2)',
                    pointBackgroundColor: '#FD7E14',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#FD7E14'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Create performance trend chart
    createPerformanceTrendChart() {
        const ctx = document.getElementById('performanceTrendChart');
        if (!ctx) return;

        const trendData = this.getPerformanceTrendData();

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: 'Performance Score',
                    data: trendData.performance,
                    borderColor: '#06BBCC',
                    backgroundColor: 'rgba(6, 187, 204, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Learning Velocity',
                    data: trendData.velocity,
                    borderColor: '#FD7E14',
                    backgroundColor: 'rgba(253, 126, 20, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        max: 100
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                }
            }
        });
    }

    // Milestone and achievement tracking
    checkMilestoneAchievements(progressMetrics) {
        const achievements = [];

        // Check for new milestone achievements
        this.milestones.forEach(milestone => {
            if (!milestone.achieved && this.isMilestoneReached(milestone, progressMetrics)) {
                milestone.achieved = true;
                milestone.achievedDate = Date.now();
                achievements.push(milestone);

                // Trigger achievement celebration
                this.celebrateAchievement(milestone);
            }
        });

        if (achievements.length > 0) {
            this.saveMilestones();
            this.updateAchievementHistory(achievements);
        }

        return achievements;
    }

    // Predictive analytics
    generateProgressPredictions(currentProgress) {
        const predictions = {
            courseCompletion: this.predictCourseCompletion(currentProgress),
            competencyMastery: this.predictCompetencyMastery(currentProgress),
            certificationReadiness: this.predictCertificationReadiness(currentProgress),
            learningPathCompletion: this.predictLearningPathCompletion(currentProgress),
            skillDevelopment: this.predictSkillDevelopment(currentProgress),
            performanceTrajectory: this.predictPerformanceTrajectory(currentProgress)
        };

        this.savePredictions(predictions);
        return predictions;
    }

    // Calculate overall progress
    calculateOverallProgress() {
        const components = [
            { weight: 0.25, progress: this.calculateCourseProgress() },
            { weight: 0.25, progress: this.calculateCompetencyProgress() },
            { weight: 0.20, progress: this.calculateSkillProgress() },
            { weight: 0.15, progress: this.calculateRetentionProgress() },
            { weight: 0.10, progress: this.calculateEngagementProgress() },
            { weight: 0.05, progress: this.calculateGoalProgress() }
        ];

        const weightedProgress = components.reduce((sum, comp) =>
            sum + (comp.progress * comp.weight), 0
        );

        const weeklyChange = this.calculateWeeklyProgressChange();

        return {
            percentage: Math.round(weightedProgress),
            weeklyChange: weeklyChange,
            components: components,
            trend: this.calculateProgressTrend(),
            velocity: this.calculateProgressVelocity()
        };
    }

    // Data persistence methods
    saveProgressData() {
        try {
            localStorage.setItem('enhancedProgress_data', JSON.stringify(this.progressData));
        } catch (error) {
            console.error('Error saving progress data:', error);
        }
    }

    saveMilestones() {
        try {
            localStorage.setItem('enhancedProgress_milestones', JSON.stringify(this.milestones));
        } catch (error) {
            console.error('Error saving milestones:', error);
        }
    }

    saveAchievements() {
        try {
            localStorage.setItem('enhancedProgress_achievements', JSON.stringify(this.achievements));
        } catch (error) {
            console.error('Error saving achievements:', error);
        }
    }

    // Data loading methods
    loadProgressData() {
        try {
            return JSON.parse(localStorage.getItem('enhancedProgress_data') || '{}');
        } catch (error) {
            console.error('Error loading progress data:', error);
            return {};
        }
    }

    loadMilestones() {
        try {
            const defaultMilestones = this.createDefaultMilestones();
            const saved = localStorage.getItem('enhancedProgress_milestones');
            return saved ? JSON.parse(saved) : defaultMilestones;
        } catch (error) {
            console.error('Error loading milestones:', error);
            return this.createDefaultMilestones();
        }
    }

    loadAchievements() {
        try {
            return JSON.parse(localStorage.getItem('enhancedProgress_achievements') || '[]');
        } catch (error) {
            console.error('Error loading achievements:', error);
            return [];
        }
    }

    // Initialize tracking
    initializeTracking() {
        // Set up periodic progress updates
        setInterval(() => {
            this.updateProgressTracking();
        }, 300000); // Every 5 minutes

        // Initialize milestone checking
        this.checkMilestoneAchievements(this.trackComprehensiveProgress());

        // Set up progress analytics
        this.initializeProgressAnalytics();
    }

    // Event listeners
    setupEventListeners() {
        // Progress update events
        document.addEventListener('courseCompleted', (event) => {
            this.handleCourseCompletion(event.detail);
        });

        document.addEventListener('practiceCompleted', (event) => {
            this.handlePracticeCompletion(event.detail);
        });

        document.addEventListener('examPassed', (event) => {
            this.handleExamCompletion(event.detail);
        });

        // Achievement celebration events
        document.addEventListener('achievementUnlocked', (event) => {
            this.handleAchievementUnlocked(event.detail);
        });
    }

    // Public API methods
    refreshDashboard(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            this.createVisualDashboard(containerId, { refresh: true });
        }
    }

    exportProgressReport() {
        const comprehensiveProgress = this.trackComprehensiveProgress();
        const report = {
            generatedAt: new Date().toISOString(),
            userId: this.getUserId(),
            progress: comprehensiveProgress,
            milestones: this.milestones,
            achievements: this.achievements,
            predictions: this.generateProgressPredictions(comprehensiveProgress),
            recommendations: this.getProgressRecommendations()
        };

        return report;
    }

    // Static instance method
    static getInstance() {
        if (!window.enhancedProgressTrackingInstance) {
            window.enhancedProgressTrackingInstance = new EnhancedProgressTracking();
        }
        return window.enhancedProgressTrackingInstance;
    }
}

// Global instance and event handling
window.EnhancedProgressTracking = EnhancedProgressTracking;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.enhancedProgressTracking = EnhancedProgressTracking.getInstance();
    console.log('Enhanced Progress Tracking initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedProgressTracking;
}