const { readLearningPaths } = require('../elearning/services/learningPathService');
const rubricConfig = require('../elearning/competency-rubric.json');

const RUBRIC = Object.freeze(rubricConfig);

function validateRubric(rubric) {
    const weightTotal = Object.values(rubric.weights || {})
        .reduce((sum, value) => sum + Number(value || 0), 0);
    if (!rubric.id || Number(rubric.scaleMax) <= 0 || Math.abs(weightTotal - 1) > 0.0001) {
        throw new Error('Invalid competency rubric configuration');
    }
    if (!Array.isArray(rubric.levels) || rubric.levels.length === 0) {
        throw new Error('Competency rubric levels are required');
    }
}

validateRubric(RUBRIC);

const CATEGORY_ALIASES = Object.freeze({
    mindset: 'bim-mindset',
    governance: 'bim-governance',
    workflow: 'delivery-workflow'
});

function clampPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(100, Math.max(0, numeric));
}

function normalizeCategory(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return CATEGORY_ALIASES[normalized] || normalized;
}

function getRubricContext() {
    const learningPaths = readLearningPaths();
    const officialCategories = [...new Set(
        learningPaths.flatMap((learningPath) => (learningPath.modules || [])
            .map((module) => normalizeCategory(module.practice && module.practice.category))
            .filter(Boolean))
    )];
    const officialExamIds = [...new Set(
        learningPaths
            .map((learningPath) => String(learningPath.exam && learningPath.exam.id || '').trim())
            .filter(Boolean)
    )];

    return {
        rubric: RUBRIC,
        officialCategories,
        officialExamIds
    };
}

function getCompetencyLevel(score, assessed = true) {
    if (!assessed) return 'Unassessed';
    const normalizedScore = Math.min(RUBRIC.scaleMax, Math.max(0, Number(score) || 0));
    return RUBRIC.levels.find((level) => normalizedScore >= level.minimum)?.name || 'Novice';
}

function calculateCompetencyProfile(evidence = {}, context = getRubricContext()) {
    const verifiedAttempts = Math.max(0, Number(evidence.verifiedAttempts) || 0);
    const verifiedPassedAttempts = Math.max(0, Number(evidence.verifiedPassedAttempts) || 0);
    const assessmentAccuracy = verifiedAttempts > 0
        ? clampPercent(evidence.verifiedAverageScore)
        : 0;

    const attemptedCategories = [...new Set(
        (Array.isArray(evidence.verifiedCategories) ? evidence.verifiedCategories : [])
            .map(normalizeCategory)
            .filter((category) => context.officialCategories.includes(category))
    )];
    const assessmentCoverage = context.officialCategories.length > 0
        ? (attemptedCategories.length / context.officialCategories.length) * 100
        : 0;

    const certificateExamIds = [...new Set(
        (Array.isArray(evidence.verifiedCertificateExamIds) ? evidence.verifiedCertificateExamIds : [])
            .map((value) => String(value || '').trim())
            .filter((examId) => context.officialExamIds.includes(examId))
    )];
    const credentialCoverage = context.officialExamIds.length > 0
        ? (certificateExamIds.length / context.officialExamIds.length) * 100
        : 0;

    const assessed = verifiedAttempts > 0 || certificateExamIds.length > 0;
    const coverageRatio = assessmentCoverage / 100;
    const effectiveAccuracy = RUBRIC.rules.adjustAccuracyByCoverage
        ? assessmentAccuracy * coverageRatio
        : assessmentAccuracy;
    const pointsPerPercent = RUBRIC.scaleMax / 100;
    const accuracyPoints = effectiveAccuracy * RUBRIC.weights.assessmentAccuracy * pointsPerPercent;
    const coveragePoints = assessmentCoverage * RUBRIC.weights.assessmentCoverage * pointsPerPercent;
    const credentialPoints = credentialCoverage * RUBRIC.weights.verifiedCredentials * pointsPerPercent;
    const normalizedCompetency = assessed
        ? (effectiveAccuracy * RUBRIC.weights.assessmentAccuracy)
            + (assessmentCoverage * RUBRIC.weights.assessmentCoverage)
            + (credentialCoverage * RUBRIC.weights.verifiedCredentials)
        : 0;
    const competencyScore = Math.round(clampPercent(normalizedCompetency) * pointsPerPercent);

    return {
        rubricVersion: RUBRIC.id,
        competencyStatus: assessed ? 'assessed' : 'unassessed',
        competencyScore,
        competencyLevel: getCompetencyLevel(competencyScore, assessed),
        components: {
            assessmentAccuracy: Math.round(accuracyPoints),
            assessmentCoverage: Math.round(coveragePoints),
            verifiedCredentials: Math.round(credentialPoints)
        },
        dimensions: {
            assessment: {
                verifiedAttempts,
                verifiedPassedAttempts,
                averageScore: Math.round(assessmentAccuracy),
                passRate: verifiedAttempts > 0
                    ? Math.round((verifiedPassedAttempts / verifiedAttempts) * 100)
                    : 0
            },
            coverage: {
                attemptedCategories,
                covered: attemptedCategories.length,
                required: context.officialCategories.length,
                percentage: Math.round(assessmentCoverage)
            },
            credentials: {
                verifiedCertificates: certificateExamIds.length,
                officialExamIds: certificateExamIds,
                required: context.officialExamIds.length,
                percentage: Math.round(credentialCoverage)
            }
        }
    };
}

module.exports = {
    RUBRIC,
    normalizeCategory,
    getRubricContext,
    getCompetencyLevel,
    calculateCompetencyProfile
};
