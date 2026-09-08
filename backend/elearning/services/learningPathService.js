const fs = require('fs');
const path = require('path');

const learningPathsPath = path.join(__dirname, '../learning-paths.json');

const LEARNING_STAGE_DEFINITIONS = Object.freeze([
    { id: 'concept', order: 1, label: 'Pahami konsep' },
    { id: 'demonstration', order: 2, label: 'Lihat penerapan' },
    { id: 'practice', order: 3, label: 'Coba sendiri' },
    { id: 'exam', order: 4, label: 'Buktikan kompetensi' }
]);

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

function normalizeMaterialStage(material) {
    const configuredStage = String(material?.stage || '').trim().toLowerCase();
    if (configuredStage === 'concept' || configuredStage === 'demonstration') {
        return configuredStage;
    }

    const type = String(material?.type || '').trim().toLowerCase();
    return type === 'video' || type === 'youtube' ? 'demonstration' : 'concept';
}

function normalizeMaterial(material) {
    const completionRequired = material?.completionRequired === true;
    return {
        ...material,
        stage: normalizeMaterialStage(material),
        requirementType: String(material?.requirementType || (completionRequired ? 'required' : 'reference')).trim().toLowerCase(),
        availability: String(material?.availability || 'available').trim().toLowerCase(),
        completionRequired
    };
}

function buildLearningStages(module, learningPath) {
    const materials = Array.isArray(module.materials) ? module.materials : [];

    return LEARNING_STAGE_DEFINITIONS.map((stage) => {
        if (stage.id === 'concept' || stage.id === 'demonstration') {
            const stageMaterials = materials.filter((material) => material.stage === stage.id);
            return {
                ...stage,
                availability: stageMaterials.some((material) => material.availability === 'available') ? 'available' : 'planned',
                materialIds: stageMaterials.map((material) => material.id).filter(Boolean),
                requiredMaterialIds: stageMaterials
                    .filter((material) => material.completionRequired && material.availability === 'available')
                    .map((material) => material.id)
                    .filter(Boolean)
            };
        }

        if (stage.id === 'practice') {
            return {
                ...stage,
                availability: module.practice?.category ? 'available' : 'planned',
                activity: module.practice || null
            };
        }

        return {
            ...stage,
            availability: learningPath.exam?.id ? 'available' : 'planned',
            activity: learningPath.exam?.id ? {
                examId: learningPath.exam.id,
                title: learningPath.exam.title || 'Exam akhir jalur',
                passingScore: Number(learningPath.exam.passingScore || 0)
            } : null
        };
    });
}

function normalizeLearningModule(module, learningPath) {
    const normalizedModule = {
        ...module,
        materials: (Array.isArray(module.materials) ? module.materials : []).map(normalizeMaterial)
    };

    return {
        ...normalizedModule,
        learningStages: buildLearningStages(normalizedModule, learningPath)
    };
}

function readLearningPaths() {
    const paths = readJsonFile(learningPathsPath, []);
    return sortByOrder(Array.isArray(paths) ? paths : []).map((learningPath) => {
        const modules = sortByOrder(Array.isArray(learningPath.modules) ? learningPath.modules : [])
            .map((module) => normalizeLearningModule(module, learningPath));

        return {
            ...learningPath,
            learningModelVersion: 2,
            learningSequence: LEARNING_STAGE_DEFINITIONS,
            modules
        };
    });
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

        const configuredRequiredMaterialIds = Array.isArray(learningPath.readiness?.requiredMaterialIds)
            ? learningPath.readiness.requiredMaterialIds
            : [];
        const mappedRequiredMaterialIds = (learningPath.modules || []).flatMap((module) =>
            (module.materials || [])
                .filter((material) => material.completionRequired && material.availability === 'available')
                .map((material) => material.id)
        );

        requirements[examId] = {
            ...buildFallbackReadiness(learningPath),
            ...(learningPath.readiness || {}),
            requiredMaterialIds: [...new Set([...configuredRequiredMaterialIds, ...mappedRequiredMaterialIds]
                .map((value) => String(value || '').trim())
                .filter(Boolean))]
        };

        return requirements;
    }, {});
}

module.exports = {
    readLearningPaths,
    flattenLearningPathModules,
    getExamCertificateRequirements
};
