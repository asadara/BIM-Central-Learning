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
    /\bincomingdata\b/,
    /\bdata\s*incoming\b/,
    /\bdataincoming\b/
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

function safeDecodePathSegment(value) {
    let output = String(value || '');
    for (let index = 0; index < 3; index += 1) {
        try {
            const decoded = decodeURIComponent(output);
            if (decoded === output) {
                break;
            }
            output = decoded;
        } catch (error) {
            break;
        }
    }
    return output;
}

function mediaPathHasExcludedFolder(value, additionalRules = []) {
    const normalizedPath = safeDecodePathSegment(value)
        .replace(/\\/g, '/')
        .split(/[?#]/)[0];

    return normalizedPath
        .split('/')
        .filter(Boolean)
        .some((segment) => shouldExcludeMediaFolder(segment, additionalRules));
}

module.exports = {
    INCOMING_DATA_FOLDER_PATTERNS,
    matchesExcludedFolderRule,
    mediaPathHasExcludedFolder,
    normalizeFolderLabel,
    sanitizeExcludedFolderRules,
    shouldExcludeMediaFolder
};
