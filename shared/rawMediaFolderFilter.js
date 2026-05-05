function normalizeFolderLabel(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/^[\s._-]*\d+[\s._-]*/g, '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const INCOMING_DATA_FOLDER_PATTERNS = [
    /\bincoming\s*data\b/,
    /\bincomingdata\b/
];

function sanitizeExcludedFolderRules(rules = []) {
    return rules.filter((rule) => {
        const normalizedRule = normalizeFolderLabel(rule);
        return normalizedRule !== 'data' && normalizedRule !== 'incoming';
    });
}

function matchesExcludedFolderRule(folderName, rule) {
    const normalizedFolderName = normalizeFolderLabel(folderName);
    if (!normalizedFolderName) {
        return false;
    }

    if (rule instanceof RegExp) {
        return rule.test(normalizedFolderName);
    }

    const normalizedRule = normalizeFolderLabel(rule);
    if (!normalizedRule) {
        return false;
    }

    return normalizedFolderName.includes(normalizedRule);
}

function shouldExcludeMediaFolder(folderName, additionalRules = []) {
    const normalizedFolderName = normalizeFolderLabel(folderName);
    if (!normalizedFolderName) {
        return false;
    }

    if (INCOMING_DATA_FOLDER_PATTERNS.some((pattern) => pattern.test(normalizedFolderName))) {
        return true;
    }

    return sanitizeExcludedFolderRules(additionalRules).some((rule) =>
        matchesExcludedFolderRule(normalizedFolderName, rule)
    );
}

module.exports = {
    INCOMING_DATA_FOLDER_PATTERNS,
    matchesExcludedFolderRule,
    normalizeFolderLabel,
    sanitizeExcludedFolderRules,
    shouldExcludeMediaFolder
};
