const assert = require('assert');
const tutorialRoutes = require('../backend/routes/tutorialRoutes');
const { loadLearningMaterialsData } = require('../backend/services/learningMaterialsSource');
const { readLearningPaths } = require('../backend/elearning/services/learningPathService');
const createUnifiedLearningCatalogService = require('../backend/services/unifiedLearningCatalogService');

function idSet(items, prefix = '') {
    return new Set(items.map((item) => `${prefix}${item.id || item.sourceId}`));
}

function sameSet(left, right, label) {
    assert.strictEqual(left.size, right.size, `${label}: size mismatch`);
    for (const value of left) assert(right.has(value), `${label}: missing ${value}`);
}

async function main() {
    const service = createUnifiedLearningCatalogService({
        loadVideos: tutorialRoutes.loadTutorialCatalog,
        loadMaterials: loadLearningMaterialsData,
        readLearningPaths
    });
    const [sourceVideos, materialData, firstCatalog] = await Promise.all([
        tutorialRoutes.loadTutorialCatalog(),
        loadLearningMaterialsData(),
        service.loadCatalog()
    ]);
    const secondCatalog = await service.loadCatalog();
    const sourcePdfs = materialData.materials || [];
    const videos = firstCatalog.filter((item) => item.sourceType === 'video');
    const pdfs = firstCatalog.filter((item) => item.sourceType === 'pdf');
    const pages = firstCatalog.filter((item) => item.sourceType === 'page');

    sameSet(idSet(sourceVideos, 'video:'), new Set(videos.map((item) => item.contentId)), 'video parity');
    sameSet(idSet(sourcePdfs, 'pdf:'), new Set(pdfs.map((item) => item.contentId)), 'PDF parity');
    assert.strictEqual(firstCatalog.length, new Set(firstCatalog.map((item) => item.contentId)).size, 'canonical IDs must be unique');
    assert.deepStrictEqual(firstCatalog.map((item) => item.contentId), secondCatalog.map((item) => item.contentId), 'canonical IDs must be deterministic');
    assert(pages.length >= 3, 'expected canonical internal reading pages');

    for (const item of firstCatalog) {
        assert(/^(video|pdf|page):[a-z0-9][a-z0-9_:-]*$/i.test(item.contentId), `invalid canonical ID ${item.contentId}`);
        assert(!/[A-Z]:\\|\\\\/.test(JSON.stringify(item)), `absolute filesystem path leaked for ${item.contentId}`);
    }

    for (const type of ['video', 'pdf', 'page']) {
        const result = await service.getCatalog({ type, limit: 500 });
        assert(result.items.every((item) => item.sourceType === type), `type filter leaked for ${type}`);
        assert.strictEqual(result.total, firstCatalog.filter((item) => item.sourceType === type).length, `type count mismatch for ${type}`);
    }

    const page = pages[0];
    assert.deepStrictEqual(await service.getById(page.contentId), page, 'detail resolution mismatch');
    const limited = await service.getCatalog({ limit: 7, offset: 2 });
    assert.strictEqual(limited.items.length, 7, 'pagination limit mismatch');
    assert.strictEqual(limited.offset, 2, 'pagination offset mismatch');

    const candidates = require('../backend/elearning/learning-mapping-candidates.json');
    assert.strictEqual(candidates.decisions.length, firstCatalog.length, 'each canonical content must have one SME decision');
    assert.strictEqual(new Set(candidates.decisions.map((item) => item.contentId)).size, firstCatalog.length, 'SME decisions must be unique');
    assert(candidates.decisions.every((item) => item.publishable === false), 'Phase 0 candidates must never auto-publish');
    assert(candidates.equivalenceCandidates.length >= 5, 'expected at least five equivalence review groups');

    console.log(JSON.stringify({
        success: true,
        catalog: { total: firstCatalog.length, video: videos.length, pdf: pdfs.length, page: pages.length },
        candidateDecisions: candidates.inventory.decisionCounts,
        equivalenceCandidates: candidates.equivalenceCandidates.length
    }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
