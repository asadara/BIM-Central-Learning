const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    MAX_SEARCH_DIRECTORY_DEPTH,
    canAccessSearchContent,
    classifySearchContentPath,
    createSearchFileTicket,
    verifySearchFileTicket
} = require('../backend/utils/searchContentPolicy');

function expectPolicy(relativePath, expected, options = {}) {
    const actual = classifySearchContentPath(relativePath, options);
    Object.entries(expected).forEach(([key, value]) => {
        assert.strictEqual(actual[key], value, `${relativePath}: expected ${key}=${value}, got ${actual[key]}`);
    });
    return actual;
}

expectPolicy('2. BIM Planning/Standar/model.pdf', {
    accessRule: 'authenticated', searchable: true, openable: true
});
expectPolicy('1. ISO 19650/Panduan.pdf', {
    accessRule: 'dokumenAccess', searchable: true, openable: true
});
expectPolicy('1. ISO 19650/01. AUDIT BIM ISO 19650/Evidence.pdf', {
    accessRule: 'audit2026Access', searchable: true, openable: true
});
expectPolicy('BIM IMPLEMENTATION DOCUMENTS/Project A/BEP.xlsx', {
    accessRule: 'projectDocumentAccess', searchable: true, openable: true
});
expectPolicy('BAHAN PEMBELAJARAN/MANUAL BOOK/Panduan.pdf', {
    accessRule: 'dokumenAccess', searchable: true, openable: true
});

[
    '10. Assessment/answer-key.pdf',
    '12. Others/archive.pdf',
    '14. BIM INTERNSHIP/report.pdf',
    'data/users.json',
    'Unknown Root/document.pdf',
    '2. BIM Planning/.private/document.pdf',
    '2. BIM Planning/~$draft.xlsx',
    '2. BIM Planning/archive.bak',
    '2. BIM Planning/ARCHIVE.BACKUP',
    '2. BIM Planning/Backups/document.pdf',
    '2. BIM Planning/script.exe'
].forEach((relativePath) => {
    const policy = classifySearchContentPath(relativePath);
    assert.strictEqual(policy.searchable, false, `${relativePath} must not be indexed`);
    assert.strictEqual(policy.openable, false, `${relativePath} must not be opened`);
});

const tooDeep = `2. BIM Planning/${Array.from({ length: MAX_SEARCH_DIRECTORY_DEPTH }, (_, i) => `L${i + 1}`).join('/')}/document.pdf`;
expectPolicy(tooDeep, { searchable: false, openable: true, reason: 'max_depth_exceeded' });

const guest = null;
const user = { id: 'user-1' };
assert.strictEqual(canAccessSearchContent('authenticated', guest, {}), false);
assert.strictEqual(canAccessSearchContent('authenticated', user, {}), true);
assert.strictEqual(canAccessSearchContent('dokumenAccess', user, {}), false);
assert.strictEqual(canAccessSearchContent('dokumenAccess', user, { dokumenAccess: true }), true);
assert.strictEqual(canAccessSearchContent('audit2026Access', user, { dokumenAccess: true }), false);
assert.strictEqual(canAccessSearchContent('audit2026Access', user, { audit2026Access: true }), true);
assert.strictEqual(canAccessSearchContent('projectDocumentAccess', user, { projectDocumentAccess: true }), true);
assert.strictEqual(canAccessSearchContent('projectDocumentAccess', { id: 'admin', isAdmin: true }, {}), true);
assert.strictEqual(canAccessSearchContent('deny', { id: 'admin', isAdmin: true }, {}), false);
expectPolicy('BIM IMPLEMENTATION DOCUMENTS/Manual Books/Project BEP.pdf', {
    accessRule: 'projectDocumentAccess', searchable: true, openable: true
});

const ticketPath = 'BIM IMPLEMENTATION DOCUMENTS/Project A/BEP.xlsx';
const ticket = createSearchFileTicket(ticketPath, user);
assert(ticket, 'authorized search result must receive a signed file ticket');
assert(verifySearchFileTicket(ticket, ticketPath), 'ticket must validate for its exact path');
assert.strictEqual(verifySearchFileTicket(ticket, '2. BIM Planning/other.pdf'), null, 'ticket must be path-bound');

const root = path.resolve(__dirname, '..');
const requiredSourceMarkers = [
    ['backend/routes/search.js', 'buildSearchFileUrl(relativePath, authUser)'],
    ['backend/server.js', "app.use('/api/file', requireSearchFileAccess)"],
    ['backend/server.js', 'app.use(protectDirectBaseFile)'],
    ['backend/server.js', 'app.use(protectLegacyBaseMediaFile)'],
    ['backend/routes/users.js', 'projectDocumentAccess'],
    ['BC-Learning-Main/js/admin/modules/users.js', 'toggleProjectDocumentAccess'],
    ['BC-Learning-Main/js/manual-books.js', 'file.accessUrl']
];
requiredSourceMarkers.forEach(([file, marker]) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert(source.includes(marker), `${file} must contain ${marker}`);
});

console.log('Search content perimeter smoke test passed.');
