// Gamification System
// Phase 3 - Achievement badges, learning streaks, leaderboards, and rewards

class GamificationSystem {
    constructor() {
        this.userProgress = this.loadUserProgress();
        this.achievements = this.loadAchievements();
        this.badges = this.loadBadges();
        this.leaderboards = this.loadLeaderboards();
        this.rewards = this.loadRewards();
        this.streaks = this.loadStreaks();
        this.points = this.loadPoints();
        this.levels = this.loadLevels();
        this.challenges = this.loadChallenges();

        // Initialize gamification systems
        this.initializeGamification();
        this.setupEventListeners();
    }

    // Core gamification mechanics
    initializeGamification() {
        // Initialize user profile if not exists
        this.initializeUserProfile();

        // Check for new achievements
        this.checkAchievements();

        // Update streaks
        this.updateStreaks();

        // Process pending rewards
        this.processPendingRewards();

        // Update leaderboards
        this.updateLeaderboards();

        // Generate daily challenges
        this.generateDailyChallenges();
    }

    // Points and scoring system
    awardPoints(activity) {
        const pointsAwarded = this.calculatePoints(activity);
        const userId = this.getCurrentUserId();

        if (!this.points[userId]) {
            this.points[userId] = {
                total: 0,
                byCategory: {},
                history: [],
                multipliers: [],
                bonuses: []
            };
        }

        const pointRecord = {
            id: 'points_' + Date.now(),
            activity: activity.type,
            activityId: activity.id,
            points: pointsAwarded,
            multiplier: activity.multiplier || 1,
            bonus: activity.bonus || 0,
            timestamp: Date.now(),
            reason: activity.reason || 'Activity completion'
        };

        // Add to user's points
        this.points[userId].total += pointsAwarded;
        this.points[userId].history.push(pointRecord);

        // Update category points
        const category = activity.category || 'general';
        if (!this.points[userId].byCategory[category]) {
            this.points[userId].byCategory[category] = 0;
        }
        this.points[userId].byCategory[category] += pointsAwarded;

        // Check for level up
        this.checkLevelUp(userId);

        // Check for point-based achievements
        this.checkPointAchievements(userId);

        // Save points
        this.savePoints();

        // Trigger point award event
        this.triggerPointAwardEvent(pointRecord);

        return pointRecord;
    }

    // Calculate points based on activity
    calculatePoints(activity) {
        const basePoints = {
            'course_complete': 100,
            'lesson_complete': 25,
            'practice_complete': 50,
            'exam_pass': 200,
            'quiz_complete': 30,
            'video_watch': 10,
            'reading_complete': 15,
            'project_submit': 150,
            'forum_post': 5,
            'help_others': 20,
            'streak_day': 10,
            'first_attempt_success': 25,
            'perfect_score': 50,
            'fast_completion': 15
        };

        let points = basePoints[activity.type] || 10;

        // Apply difficulty multiplier
        if (activity.difficulty) {
            const difficultyMultiplier = {
                'easy': 1.0,
                'medium': 1.5,
                'hard': 2.0,
                'expert': 2.5
            };
            points *= difficultyMultiplier[activity.difficulty.toLowerCase()] || 1.0;
        }

        // Apply performance multiplier
        if (activity.score) {
            const performanceMultiplier = Math.max(0.5, activity.score / 100);
            points *= performanceMultiplier;
        }

        // Apply streak bonus
        if (activity.streakBonus) {
            points *= (1 + activity.streakBonus * 0.1);
        }

        // Apply time bonus (for quick completion)
        if (activity.timeBonus) {
            points += activity.timeBonus;
        }

        return Math.round(points);
    }

    // Achievement system
    checkAchievements() {
        const userId = this.getCurrentUserId();
        const userAchievements = this.achievements[userId] || [];
        const availableAchievements = this.getAvailableAchievements();

        const newAchievements = [];

        availableAchievements.forEach(achievement => {
            if (!userAchievements.find(ua => ua.id === achievement.id)) {
                if (this.isAchievementEarned(achievement, userId)) {
                    const earnedAchievement = {
                        ...achievement,
                        earnedAt: Date.now(),
                        progress: 100
                    };

                    userAchievements.push(earnedAchievement);
                    newAchievements.push(earnedAchievement);

                    // Award achievement points
                    this.awardPoints({
                        type: 'achievement',
                        id: achievement.id,
                        points: achievement.points || 100,
                        reason: `Achievement: ${achievement.name}`
                    });

                    // Award badge if applicable
                    if (achievement.badge) {
                        this.awardBadge(userId, achievement.badge);
                    }
                }
            }
        });

        // Update achievements
        this.achievements[userId] = userAchievements;
        this.saveAchievements();

        // Celebrate new achievements
        newAchievements.forEach(achievement => {
            this.celebrateAchievement(achievement);
        });

        return newAchievements;
    }

    // Badge system
    awardBadge(userId, badgeId) {
        if (!this.badges[userId]) {
            this.badges[userId] = [];
        }

        const badge = this.getBadgeDefinition(badgeId);
        if (!badge) return null;

        const userBadge = {
            ...badge,
            awardedAt: Date.now(),
            progress: 100
        };

        this.badges[userId].push(userBadge);
        this.saveBadges();

        // Trigger badge award event
        this.triggerBadgeAwardEvent(userBadge);

        return userBadge;
    }

    // Streak system
    updateStreaks() {
        const userId = this.getCurrentUserId();
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (!this.streaks[userId]) {
            this.streaks[userId] = {
                current: 0,
                longest: 0,
                lastActivity: null,
                history: [],
                type: 'daily' // daily, weekly, monthly
            };
        }

        const streak = this.streaks[userId];
        const lastActivityDate = streak.lastActivity ? new Date(streak.lastActivity).toDateString() : null;

        // Check if user has activity today
        const hasActivityToday = this.hasActivityToday(userId);

        if (hasActivityToday && lastActivityDate !== today) {
            if (lastActivityDate === yesterday) {
                // Continue streak
                streak.current++;
            } else if (lastActivityDate !== today) {
                // Start new streak
                streak.current = 1;
            }

            streak.lastActivity = Date.now();

            // Update longest streak
            if (streak.current > streak.longest) {
                streak.longest = streak.current;
            }

            // Award streak points
            this.awardPoints({
                type: 'streak_day',
                streakBonus: Math.min(streak.current / 10, 1.0),
                reason: `${streak.current} day learning streak`
            });

            // Check for streak achievements
            this.checkStreakAchievements(userId, streak.current);

        } else if (!hasActivityToday && lastActivityDate === yesterday) {
            // Streak at risk - send notification
            this.notifyStreakAtRisk(userId, streak.current);
        } else if (!hasActivityToday && lastActivityDate && lastActivityDate !== yesterday && lastActivityDate !== today) {
            // Streak broken
            this.handleStreakBroken(userId, streak.current);
            streak.current = 0;
        }

        this.saveStreaks();
        return streak;
    }

    // Leaderboard system
    updateLeaderboards() {
        const timeframes = ['daily', 'weekly', 'monthly', 'allTime'];
        const categories = ['points', 'courses', 'streaks', 'achievements'];

        timeframes.forEach(timeframe => {
            categories.forEach(category => {
                this.updateLeaderboard(timeframe, category);
            });
        });

        this.saveLeaderboards();
    }

    updateLeaderboard(timeframe, category) {
        const leaderboardKey = `${timeframe}_${category}`;
        const users = this.getAllUsers();

        const leaderboardData = users.map(userId => {
            const score = this.calculateLeaderboardScore(userId, timeframe, category);
            return {
                userId: userId,
                score: score,
                rank: 0, // Will be calculated after sorting
                change: this.calculateRankChange(userId, leaderboardKey)
            };
        }).filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

        if (!this.leaderboards[leaderboardKey]) {
            this.leaderboards[leaderboardKey] = {
                timeframe: timeframe,
                category: category,
                lastUpdated: Date.now(),
                entries: []
            };
        }

        this.leaderboards[leaderboardKey].entries = leaderboardData;
        this.leaderboards[leaderboardKey].lastUpdated = Date.now();
    }

    // Challenge system
    generateDailyChallenges() {
        const userId = this.getCurrentUserId();
        const today = new Date().toDateString();

        if (!this.challenges[userId]) {
            this.challenges[userId] = {};
        }

        if (!this.challenges[userId][today]) {
            const challenges = this.createDailyChallenges(userId);
            this.challenges[userId][today] = challenges;
            this.saveChallenges();
        }

        return this.challenges[userId][today];
    }

    createDailyChallenges(userId) {
        const userProfile = this.getUserProfile(userId);
        const challengeTemplates = this.getChallengeTemplates();

        // Select 3 challenges based on user's level and preferences
        const selectedChallenges = this.selectChallengesForUser(challengeTemplates, userProfile);

        return selectedChallenges.map(template => ({
            id: 'challenge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            template: template.id,
            title: template.title,
            description: template.description,
            type: template.type,
            target: template.target,
            reward: template.reward,
            difficulty: template.difficulty,
            progress: 0,
            completed: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        }));
    }

    // Level system
    checkLevelUp(userId) {
        const currentLevel = this.getUserLevel(userId);
        const totalPoints = this.points[userId]?.total || 0;
        const newLevel = this.calculateLevelFromPoints(totalPoints);

        if (newLevel > currentLevel) {
            this.processLevelUp(userId, currentLevel, newLevel);
        }
    }

    processLevelUp(userId, oldLevel, newLevel) {
        // Update user level
        this.updateUserLevel(userId, newLevel);

        // Award level up rewards
        const rewards = this.getLevelUpRewards(newLevel);
        rewards.forEach(reward => {
            this.awardReward(userId, reward);
        });

        // Unlock new features/content
        this.unlockLevelContent(userId, newLevel);

        // Celebrate level up
        this.celebrateLevelUp(userId, oldLevel, newLevel);

        // Award level up points
        this.awardPoints({
            type: 'level_up',
            level: newLevel,
            bonus: newLevel * 50,
            reason: `Level up to ${newLevel}`
        });
    }

    // Reward system
    awardReward(userId, reward) {
        if (!this.rewards[userId]) {
            this.rewards[userId] = [];
        }

        const userReward = {
            id: 'reward_' + Date.now(),
            type: reward.type,
            name: reward.name,
            description: reward.description,
            value: reward.value,
            awardedAt: Date.now(),
            claimed: false,
            expiresAt: reward.expiresAt || null
        };

        this.rewards[userId].push(userReward);
        this.saveRewards();

        // Notify user of new reward
        this.notifyNewReward(userId, userReward);

        return userReward;
    }

    // Social features
    getLeaderboard(timeframe = 'weekly', category = 'points', limit = 10) {
        const leaderboardKey = `${timeframe}_${category}`;
        const leaderboard = this.leaderboards[leaderboardKey];

        if (!leaderboard) return [];

        return leaderboard.entries.slice(0, limit).map(entry => ({
            ...entry,
            username: this.getUserDisplayName(entry.userId),
            avatar: this.getUserAvatar(entry.userId),
            level: this.getUserLevel(entry.userId),
            badges: this.getUserTopBadges(entry.userId, 3)
        }));
    }

    // Progress visualization
    getGamificationDashboard(userId) {
        return {
            profile: {
                level: this.getUserLevel(userId),
                points: this.points[userId]?.total || 0,
                nextLevelPoints: this.getNextLevelPoints(userId),
                progressToNextLevel: this.getProgressToNextLevel(userId)
            },
            streaks: this.streaks[userId] || { current: 0, longest: 0 },
            achievements: {
                earned: this.achievements[userId]?.length || 0,
                total: this.getAvailableAchievements().length,
                recent: this.getRecentAchievements(userId, 5)
            },
            badges: {
                earned: this.badges[userId]?.length || 0,
                recent: this.getRecentBadges(userId, 5)
            },
            challenges: {
                daily: this.getDailyChallenges(userId),
                weekly: this.getWeeklyChallenges(userId),
                completed: this.getCompletedChallenges(userId).length
            },
            leaderboard: {
                position: this.getUserLeaderboardPosition(userId),
                percentile: this.getUserPercentile(userId)
            },
            rewards: {
                unclaimed: this.getUnclaimedRewards(userId),
                total: this.rewards[userId]?.length || 0
            }
        };
    }

    // Event celebrations
    celebrateAchievement(achievement) {
        this.showCelebration({
            type: 'achievement',
            title: `Achievement Unlocked!`,
            subtitle: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            points: achievement.points,
            animation: 'achievement'
        });
    }

    celebrateLevelUp(userId, oldLevel, newLevel) {
        this.showCelebration({
            type: 'levelUp',
            title: `Level Up!`,
            subtitle: `Welcome to Level ${newLevel}`,
            description: `You've advanced from Level ${oldLevel} to Level ${newLevel}!`,
            icon: 'fas fa-trophy',
            animation: 'levelUp'
        });
    }

    celebrateStreak(streakCount) {
        this.showCelebration({
            type: 'streak',
            title: `${streakCount} Day Streak!`,
            subtitle: 'Keep the momentum going!',
            description: `You've maintained your learning streak for ${streakCount} consecutive days.`,
            icon: 'fas fa-fire',
            animation: 'streak'
        });
    }

    showCelebration(celebration) {
        // Create celebration modal/notification
        const modal = document.createElement('div');
        modal.className = 'gamification-celebration-modal';
        modal.innerHTML = `
            <div class="celebration-content ${celebration.animation}">
                <div class="celebration-icon">
                    <i class="${celebration.icon}"></i>
                </div>
                <h2 class="celebration-title">${celebration.title}</h2>
                <h3 class="celebration-subtitle">${celebration.subtitle}</h3>
                <p class="celebration-description">${celebration.description}</p>
                ${celebration.points ? `<div class="celebration-points">+${celebration.points} Points!</div>` : ''}
                <button class="celebration-close" onclick="this.closest('.gamification-celebration-modal').remove()">
                    Continue Learning
                </button>
            </div>
            <div class="celebration-overlay"></div>
        `;

        document.body.appendChild(modal);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 5000);

        // Trigger confetti or other visual effects
        this.triggerVisualEffects(celebration.type);
    }

    // Data persistence methods
    saveUserProgress() {
        try {
            localStorage.setItem('gamification_userProgress', JSON.stringify(this.userProgress));
        } catch (error) {
            console.error('Error saving user progress:', error);
        }
    }

    saveAchievements() {
        try {
            localStorage.setItem('gamification_achievements', JSON.stringify(this.achievements));
        } catch (error) {
            console.error('Error saving achievements:', error);
        }
    }

    saveBadges() {
        try {
            localStorage.setItem('gamification_badges', JSON.stringify(this.badges));
        } catch (error) {
            console.error('Error saving badges:', error);
        }
    }

    saveLeaderboards() {
        try {
            localStorage.setItem('gamification_leaderboards', JSON.stringify(this.leaderboards));
        } catch (error) {
            console.error('Error saving leaderboards:', error);
        }
    }

    saveRewards() {
        try {
            localStorage.setItem('gamification_rewards', JSON.stringify(this.rewards));
        } catch (error) {
            console.error('Error saving rewards:', error);
        }
    }

    saveStreaks() {
        try {
            localStorage.setItem('gamification_streaks', JSON.stringify(this.streaks));
        } catch (error) {
            console.error('Error saving streaks:', error);
        }
    }

    savePoints() {
        try {
            localStorage.setItem('gamification_points', JSON.stringify(this.points));
        } catch (error) {
            console.error('Error saving points:', error);
        }
    }

    saveChallenges() {
        try {
            localStorage.setItem('gamification_challenges', JSON.stringify(this.challenges));
        } catch (error) {
            console.error('Error saving challenges:', error);
        }
    }

    // Data loading methods
    loadUserProgress() {
        try {
            return JSON.parse(localStorage.getItem('gamification_userProgress') || '{}');
        } catch (error) {
            console.error('Error loading user progress:', error);
            return {};
        }
    }

    loadAchievements() {
        try {
            return JSON.parse(localStorage.getItem('gamification_achievements') || '{}');
        } catch (error) {
            console.error('Error loading achievements:', error);
            return {};
        }
    }

    loadBadges() {
        try {
            return JSON.parse(localStorage.getItem('gamification_badges') || '{}');
        } catch (error) {
            console.error('Error loading badges:', error);
            return {};
        }
    }

    loadLeaderboards() {
        try {
            return JSON.parse(localStorage.getItem('gamification_leaderboards') || '{}');
        } catch (error) {
            console.error('Error loading leaderboards:', error);
            return {};
        }
    }

    loadRewards() {
        try {
            return JSON.parse(localStorage.getItem('gamification_rewards') || '{}');
        } catch (error) {
            console.error('Error loading rewards:', error);
            return {};
        }
    }

    loadStreaks() {
        try {
            return JSON.parse(localStorage.getItem('gamification_streaks') || '{}');
        } catch (error) {
            console.error('Error loading streaks:', error);
            return {};
        }
    }

    loadPoints() {
        try {
            return JSON.parse(localStorage.getItem('gamification_points') || '{}');
        } catch (error) {
            console.error('Error loading points:', error);
            return {};
        }
    }

    loadLevels() {
        // Define level thresholds
        return {
            1: { points: 0, title: 'Novice Learner' },
            2: { points: 500, title: 'Curious Student' },
            3: { points: 1500, title: 'Dedicated Learner' },
            4: { points: 3000, title: 'Skilled Practitioner' },
            5: { points: 5000, title: 'Expert Student' },
            6: { points: 8000, title: 'Master Learner' },
            7: { points: 12000, title: 'BIM Specialist' },
            8: { points: 18000, title: 'BIM Expert' },
            9: { points: 25000, title: 'BIM Master' },
            10: { points: 35000, title: 'Learning Champion' }
        };
    }

    loadChallenges() {
        try {
            return JSON.parse(localStorage.getItem('gamification_challenges') || '{}');
        } catch (error) {
            console.error('Error loading challenges:', error);
            return {};
        }
    }

    // Event listeners
    setupEventListeners() {
        // Listen for learning activities
        document.addEventListener('courseCompleted', (event) => {
            this.handleCourseCompletion(event.detail);
        });

        document.addEventListener('practiceCompleted', (event) => {
            this.handlePracticeCompletion(event.detail);
        });

        document.addEventListener('examPassed', (event) => {
            this.handleExamCompletion(event.detail);
        });

        document.addEventListener('lessonCompleted', (event) => {
            this.handleLessonCompletion(event.detail);
        });

        // Listen for social interactions
        document.addEventListener('forumPost', (event) => {
            this.handleForumPost(event.detail);
        });

        document.addEventListener('helpProvided', (event) => {
            this.handleHelpProvided(event.detail);
        });
    }

    // Event handlers
    handleCourseCompletion(data) {
        this.awardPoints({
            type: 'course_complete',
            id: data.courseId,
            difficulty: data.difficulty,
            score: data.score,
            category: 'courses'
        });

        this.checkAchievements();
        this.updateStreaks();
    }

    handlePracticeCompletion(data) {
        this.awardPoints({
            type: 'practice_complete',
            id: data.practiceId,
            score: data.score,
            category: 'practice'
        });
    }

    handleExamCompletion(data) {
        if (data.passed) {
            this.awardPoints({
                type: 'exam_pass',
                id: data.examId,
                score: data.score,
                difficulty: data.difficulty,
                category: 'exams'
            });
        }
    }

    // Public API methods
    getUserDashboard() {
        const userId = this.getCurrentUserId();
        return this.getGamificationDashboard(userId);
    }

    getLeaderboardData(timeframe, category, limit) {
        return this.getLeaderboard(timeframe, category, limit);
    }

    claimReward(rewardId) {
        const userId = this.getCurrentUserId();
        const reward = this.rewards[userId]?.find(r => r.id === rewardId);

        if (reward && !reward.claimed) {
            reward.claimed = true;
            reward.claimedAt = Date.now();
            this.saveRewards();
            return reward;
        }

        return null;
    }

    // Utility methods
    getCurrentUserId() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return userData.userId || 'user_' + Date.now();
        } catch (error) {
            return 'user_' + Date.now();
        }
    }

    // Static instance method
    static getInstance() {
        if (!window.gamificationSystemInstance) {
            window.gamificationSystemInstance = new GamificationSystem();
        }
        return window.gamificationSystemInstance;
    }
}

// Global instance
window.GamificationSystem = GamificationSystem;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.gamificationSystem = GamificationSystem.getInstance();
    console.log('Gamification System initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GamificationSystem;
}