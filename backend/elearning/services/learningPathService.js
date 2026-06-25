const fs = require('fs');
const path = require('path');

const learningPathsPath = path.join(__dirname, '../learning-paths.json');

function readJsonFile(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) {
            return fallback;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        if (!content.trim()) {
            return fallback;
        }

        return JSON.parse(content);
    } catch (error) {
        console.error(`Failed to read ${path.basename(filePath)}:`, error.message);
        return fallback;
    }
}

function sortByOrder(items) {
    return [...items].sort((left, right) => {
        const leftOrder = Number(left.order || 0);
        const rightOrder = Number(right.order || 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left.title || '').localeCompare(String(right.title || ''));
    });
}

function readLearningPaths() {
    const paths = readJsonFile(learningPathsPath, []);
    return sortByOrder(Array.isArray(paths) ? paths : []).map((learningPath) => ({
        ...learningPath,
        modules: sortByOrder(Array.isArray(learningPath.modules) ? learningPath.modules : [])
    }));
}

function flattenLearningPathModules(paths = readLearningPaths()) {
    return paths.flatMap((learningPath) => (learningPath.modules || []).map((module) => ({
        ...module,
        learningPathId: learningPath.id,
        learningPathTitle: learningPath.title,
        level: learningPath.level,
        exam: learningPath.exam,
        certificate: learningPath.certificate
    })));
}

function getPracticeRequirements(learningPath) {
    return (Array.isArray(learningPath.modules) ? learningPath.modules : [])
        .map((module) => module.practice || {})
        .filter((practice) => practice.category)
        .map((practice) => ({
            category: practice.category,
            minimumAttempts: Number(practice.minimumAttempts || 0),
            minimumAverageScore: Number(practice.minimumAverageScore || 0)
        }));
}

function buildFallbackReadiness(learningPath) {
    const requirements = getPracticeRequirements(learningPath);
    const targetCategories = [...new Set(requirements.map((item) => item.category).filter(Boolean))];
    const minAttempts = requirements.reduce((sum, item) => sum + Math.max(0, item.minimumAttempts), 0);
    const minAccuracy = requirements.length
        ? Math.round(requirements.reduce((sum, item) => sum + Math.max(0, item.minimumAverageScore), 0) / requirements.length)
        : 0;

    return {
        requiredLevel: learningPath.level || 'BIM Modeller',
        targetCategories,
        minAccuracy,
        minAttempts,
        coverageTarget: targetCategories.length > 0 ? 1 : 0
    };
}

function getExamCertificateRequirements() {
    return readLearningPaths().reduce((requirements, learningPath) => {
        const examId = learningPath.exam && learningPath.exam.id;
        if (!examId) return requirements;

        requirements[examId] = {
            ...buildFallbackReadiness(learningPath),
            ...(learningPath.readiness || {})
        };

        return requirements;
    }, {});
}

module.exports = {
    readLearningPaths,
    flattenLearningPathModules,
    getExamCertificateRequirements
};
