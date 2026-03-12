(function () {
    const LEVEL_ORDER = ['BIM Modeller', 'BIM Coordinator', 'BIM Manager'];

    const EXAM_BLUEPRINTS = {
        'autocad-certification': {
            examId: 'autocad-certification',
            title: 'AutoCAD Certified User Exam',
            shortTitle: 'AutoCAD Exam',
            requiredLevel: 'BIM Modeller',
            targetCategories: ['autocad'],
            minAccuracy: 80,
            minAttempts: 3,
            coverageTarget: 1,
            recommendedPracticeMode: 'skill-drills'
        },
        'revit-architecture-exam': {
            examId: 'revit-architecture-exam',
            title: 'Revit Architecture Professional Exam',
            shortTitle: 'Revit Architecture Exam',
            requiredLevel: 'BIM Coordinator',
            targetCategories: ['revit-fundamentals', 'revit-modeling', 'intermediate-modeling', 'quality-control'],
            minAccuracy: 78,
            minAttempts: 4,
            coverageTarget: 0.75,
            recommendedPracticeMode: 'mock-tests'
        },
        'bim-manager-certification': {
            examId: 'bim-manager-certification',
            title: 'BIM Manager Certification Exam',
            shortTitle: 'BIM Manager Exam',
            requiredLevel: 'BIM Manager',
            targetCategories: ['bim-fundamentals', 'clash-detection', 'project-coordination', 'federated-models', 'advanced-modeling'],
            minAccuracy: 82,
            minAttempts: 5,
            coverageTarget: 0.7,
            recommendedPracticeMode: 'mock-tests'
        }
    };

    function safeParse(value, fallback) {
        if (value === null || typeof value === 'undefined' || value === '') {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getCurrentUser() {
        const authUser = safeParse(localStorage.getItem('user'), null);
        const localUser = safeParse(localStorage.getItem('userData'), {});
        return authUser || localUser || {};
    }

    function getUserLevel() {
        return getCurrentUser().level || 'BIM Modeller';
    }

    function getLevelIndex(level) {
        const index = LEVEL_ORDER.indexOf(level);
        return index === -1 ? 0 : index;
    }

    function getPracticeHistory() {
        const userData = safeParse(localStorage.getItem('userData'), {});
        return Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
    }

    function getExamHistory() {
        const history = safeParse(localStorage.getItem('examHistory'), []);
        return Array.isArray(history) ? history : [];
    }

    function saveExamAttempt(attempt) {
        const history = getExamHistory();
        history.push({
            ...attempt,
            savedAt: new Date().toISOString()
        });
        localStorage.setItem('examHistory', JSON.stringify(history));
    }

    function normalizeCategories(entry) {
        if (Array.isArray(entry.categories) && entry.categories.length) {
            return entry.categories;
        }

        if (typeof entry.category === 'string' && entry.category) {
            return [entry.category];
        }

        if (typeof entry.sourceCategory === 'string' && entry.sourceCategory) {
            return [entry.sourceCategory];
        }

        return [];
    }

    function summarizePracticeHistory(history) {
        const categories = {};

        history.forEach(entry => {
            const bucketCategories = normalizeCategories(entry);
            bucketCategories.forEach(category => {
                if (!categories[category]) {
                    categories[category] = {
                        attempts: 0,
                        totalScore: 0,
                        totalTime: 0,
                        bestScore: 0,
                        latestScore: 0,
                        lastAttemptAt: null,
                        modes: {}
                    };
                }

                const bucket = categories[category];
                bucket.attempts += 1;
                bucket.totalScore += Number(entry.score || 0);
                bucket.totalTime += Number(entry.timeSpent || 0);
                bucket.bestScore = Math.max(bucket.bestScore, Number(entry.score || 0));
                bucket.latestScore = Number(entry.score || 0);
                bucket.lastAttemptAt = entry.date || bucket.lastAttemptAt;

                const mode = entry.mode || 'skill-drills';
                bucket.modes[mode] = (bucket.modes[mode] || 0) + 1;
            });
        });

        Object.values(categories).forEach(bucket => {
            bucket.averageScore = bucket.attempts ? Math.round(bucket.totalScore / bucket.attempts) : 0;
            bucket.averageTime = bucket.attempts ? Math.round(bucket.totalTime / bucket.attempts) : 0;
        });

        return categories;
    }

    function calculateReadinessForBlueprint(blueprint, context) {
        const userLevelIndex = getLevelIndex(context.userLevel);
        const requiredLevelIndex = getLevelIndex(blueprint.requiredLevel);
        const levelEligible = userLevelIndex >= requiredLevelIndex;

        const categoryStats = blueprint.targetCategories
            .map(category => context.practiceSummary[category])
            .filter(Boolean);

        const attempts = categoryStats.reduce((sum, item) => sum + item.attempts, 0);
        const accuracy = categoryStats.length
            ? Math.round(categoryStats.reduce((sum, item) => sum + item.averageScore, 0) / categoryStats.length)
            : 0;
        const coverage = blueprint.targetCategories.length
            ? categoryStats.length / blueprint.targetCategories.length
            : 0;
        const consistency = categoryStats.length
            ? Math.round(categoryStats.reduce((sum, item) => sum + Math.min(item.bestScore, item.latestScore), 0) / categoryStats.length)
            : 0;

        const accuracyRatio = blueprint.minAccuracy ? accuracy / blueprint.minAccuracy : 0;
        const attemptsRatio = blueprint.minAttempts ? attempts / blueprint.minAttempts : 0;
        const coverageRatio = blueprint.coverageTarget ? coverage / blueprint.coverageTarget : 0;

        let readinessScore = Math.round(
            (clamp(accuracyRatio, 0, 1.2) * 45) +
            (clamp(attemptsRatio, 0, 1.2) * 25) +
            (clamp(coverageRatio, 0, 1.2) * 20) +
            ((consistency / 100) * 10)
        );

        if (!levelEligible) {
            readinessScore = Math.min(readinessScore, 59);
        }

        let status = 'locked';
        if (levelEligible && accuracy >= blueprint.minAccuracy && attempts >= blueprint.minAttempts && coverage >= blueprint.coverageTarget) {
            status = 'ready';
        } else if (levelEligible && readinessScore >= 55) {
            status = 'almost-ready';
        }

        const missingCategories = blueprint.targetCategories.filter(category => !context.practiceSummary[category]);
        let recommendation = `Build more attempts in ${blueprint.targetCategories[0] || 'core topics'}.`;

        if (!levelEligible) {
            recommendation = `Reach level ${blueprint.requiredLevel} to unlock this exam path.`;
        } else if (missingCategories.length) {
            recommendation = `Complete practice in ${missingCategories.slice(0, 2).join(', ')}.`;
        } else if (accuracy < blueprint.minAccuracy) {
            recommendation = `Raise average score to ${blueprint.minAccuracy}% for exam readiness.`;
        } else if (attempts < blueprint.minAttempts) {
            recommendation = `Finish ${blueprint.minAttempts - attempts} more measured attempts.`;
        }

        return {
            ...blueprint,
            status,
            readinessScore: clamp(readinessScore, 0, 100),
            accuracy,
            attempts,
            coverage: Math.round(coverage * 100),
            consistency,
            missingCategories,
            recommendation,
            levelEligible
        };
    }

    function getReadinessDashboard() {
        const practiceHistory = getPracticeHistory();
        const practiceSummary = summarizePracticeHistory(practiceHistory);
        const userLevel = getUserLevel();
        const exams = Object.values(EXAM_BLUEPRINTS).map(blueprint =>
            calculateReadinessForBlueprint(blueprint, {
                userLevel,
                practiceSummary
            })
        );

        const weakCategories = Object.entries(practiceSummary)
            .sort((left, right) => left[1].averageScore - right[1].averageScore)
            .slice(0, 3)
            .map(([category, stats]) => ({
                category,
                averageScore: stats.averageScore,
                attempts: stats.attempts
            }));

        const readyCount = exams.filter(item => item.status === 'ready').length;
        const almostReadyCount = exams.filter(item => item.status === 'almost-ready').length;
        const overallReadiness = exams.length
            ? Math.round(exams.reduce((sum, item) => sum + item.readinessScore, 0) / exams.length)
            : 0;

        return {
            userLevel,
            practiceHistory,
            practiceSummary,
            exams,
            weakCategories,
            readyCount,
            almostReadyCount,
            overallReadiness,
            nextExam: exams.slice().sort((left, right) => right.readinessScore - left.readinessScore)[0] || null
        };
    }

    function getPracticeRecommendations() {
        const dashboard = getReadinessDashboard();
        const nextExam = dashboard.nextExam;
        const weakCategories = dashboard.weakCategories;

        const recommendations = [];

        if (nextExam) {
            recommendations.push({
                type: 'exam',
                title: `Target ${nextExam.shortTitle}`,
                description: nextExam.recommendation,
                targetExamId: nextExam.examId,
                targetView: nextExam.recommendedPracticeMode
            });
        }

        weakCategories.forEach(item => {
            recommendations.push({
                type: 'category',
                title: `Improve ${item.category}`,
                description: `Current average ${item.averageScore}% across ${item.attempts} attempts.`,
                category: item.category,
                targetView: 'skill-drills'
            });
        });

        return recommendations;
    }

    window.LearningReadiness = {
        EXAM_BLUEPRINTS,
        LEVEL_ORDER,
        getCurrentUser,
        getUserLevel,
        getPracticeHistory,
        getExamHistory,
        saveExamAttempt,
        summarizePracticeHistory,
        getReadinessDashboard,
        getPracticeRecommendations
    };
})();
