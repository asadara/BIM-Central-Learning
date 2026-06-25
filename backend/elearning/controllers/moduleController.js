const fs = require('fs');
const path = require('path');
const {
    readLearningPaths,
    flattenLearningPathModules
} = require('../services/learningPathService');

const modulesPath = path.join(__dirname, '../data/modules.json');

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

exports.getModules = (req, res) => {
    const legacyModules = readJsonFile(modulesPath, null);
    if (Array.isArray(legacyModules) && legacyModules.length > 0) {
        return res.json(sortByOrder(legacyModules));
    }

    return res.json(flattenLearningPathModules(readLearningPaths()));
};

exports.getModuleById = (req, res) => {
    const legacyModules = readJsonFile(modulesPath, null);
    const modules = Array.isArray(legacyModules) && legacyModules.length > 0
        ? legacyModules
        : flattenLearningPathModules(readLearningPaths());
    const module = modules.find(m => m.id === req.params.id);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json(module);
};

exports.getLearningPaths = (req, res) => {
    res.json({
        success: true,
        data: readLearningPaths()
    });
};

exports.getLearningPathById = (req, res) => {
    const learningPath = readLearningPaths().find(item => item.id === req.params.id);
    if (!learningPath) return res.status(404).json({ error: 'Learning path not found' });
    res.json({
        success: true,
        data: learningPath
    });
};
