const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const {
    ContentReferenceError,
    createCanonicalLearningContentResolver
} = require('../services/canonicalLearningContentResolver');
const { createInternshipProgramService } = require('../services/internshipProgramService');
const { createInternshipRepository } = require('../repositories/internshipRepository');
const { createInternshipRoutes } = require('../routes/internshipRoutes');
const { registerInternshipFeature } = require('../features/internshipFeature');

function fixtureCatalog(extra = []) {
    const items = [
        {
            contentId: 'page:bim-mindset',
            sourceType: 'page',
            sourceId: 'bim-mindset',
            title: 'Konsep BIM Mindset',
            sourceUrl: '/pages/bim-mindset.html'
        },
        {
            contentId: 'pdf:manual-one',
            sourceType: 'pdf',
            sourceId: 'manual-one',
            title: 'Manual One',
            sourceUrl: '/api/learning-materials/file/manual-one'
        },
        ...extra
    ];
    return {
        async loadCatalog() { return items; },
        async getById(contentId) { return items.find((item) => item.contentId === contentId) || null; }
    };
}

function createFixtureRepository() {
    const calls = [];
    const attempts = [
        { quizId: 'bim-mindset-quiz', passed: true, isVerified: false, percentage: 100 },
        { quizId: 'bim-mindset-quiz', passed: true, isVerified: true, percentage: 80 }
    ];
    const contextBase = {
        id: 'internship-pilot',
        code: 'INT-001',
        title: 'BCL Internship Pilot',
        description: 'Server-derived learning program',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        status: 'active',
        programType: 'internship',
        participantDisplayName: 'Participant BCL',
        enrollmentStatus: 'active',
        learningPathId: 'bim-mindset-foundation',
        learningPathTitle: 'BIM Mindset Foundation',
        learningPathLevel: 'BIM Modeller',
        learningPathVersionId: '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01',
        versionNumber: 1,
        versionStatus: 'published',
        publishedAt: '2026-09-24T00:00:00.000Z',
        versionDefinition: {
            assessments: [{
                quizId: 'bim-mindset-quiz',
                moduleKey: 'bim-mindset-information-management',
                title: 'BIM Mindset Quiz',
                required: true,
                passingScore: 70,
                status: 'published',
                href: '/pages/bim-mindset.html#quiz'
            }, {
                quizId: 'draft-quiz',
                moduleKey: 'bim-mindset-information-management',
                required: true,
                status: 'draft'
            }]
        }
    };
    const activeModule = {
        id: 'module-1',
        moduleKey: 'bim-mindset-information-management',
        title: 'BIM sebagai Manajemen Informasi',
        outcome: 'Understand information management',
        sequenceNumber: 1,
        status: 'active',
        items: [{
            contentId: 'page:bim-mindset',
            sourceType: 'page',
            sourceId: 'bim-mindset',
            sourceLocator: '/pages/bim-mindset.html',
            titleOverride: 'Konsep BIM Mindset',
            contentStatus: 'active',
            sequenceNumber: 1,
            requirementType: 'required',
            mappingStatus: 'approved',
            completionRule: { activity: { moduleType: 'page', moduleIds: ['bim-mindset__bim-mindset'] } }
        }, {
            contentId: 'pdf:manual-one',
            sourceType: 'pdf',
            sourceId: 'manual-one',
            sourceLocator: '\\\\internal-server\\manual-one.pdf',
            titleOverride: 'Draft manual',
            contentStatus: 'active',
            sequenceNumber: 2,
            requirementType: 'required',
            mappingStatus: 'candidate',
            completionRule: {}
        }, {
            contentId: 'pdf:retired-one',
            sourceType: 'pdf',
            sourceId: 'retired-one',
            sourceLocator: 'G:\\retired-one.pdf',
            titleOverride: 'Retired manual',
            contentStatus: 'retired',
            sequenceNumber: 3,
            requirementType: 'required',
            mappingStatus: 'approved',
            completionRule: {}
        }]
    };
    const repository = {
        attempts,
        calls,
        async listEnrollments(userId) {
            calls.push(['listEnrollments', userId]);
            if (userId !== 1) return [];
            return [{ ...contextBase, role: 'participant' }];
        },
        async getBatchContext(batchId, userId) {
            calls.push(['getBatchContext', batchId, userId]);
            if (batchId !== 'internship-pilot') return null;
            const role = userId === 1 ? 'participant' : userId === 3 ? 'mentor' : null;
            return { ...contextBase, role, enrollmentStatus: role ? 'active' : null };
        },
        async listMentors(batchId) {
            calls.push(['listMentors', batchId]);
            return [
                { displayName: 'Mentor BCL', role: 'mentor' },
                { displayName: '\\\\internal-server\\mentor.txt', role: 'reviewer' }
            ];
        },
        async getPathModules(versionId) {
            calls.push(['getPathModules', versionId]);
            return [activeModule, {
                id: 'module-draft',
                moduleKey: 'draft-module',
                title: 'Draft module',
                status: 'inactive',
                sequenceNumber: 2,
                items: []
            }];
        },
        async getCompletedActivityEvidence(userId) {
            calls.push(['getCompletedActivityEvidence', userId]);
            return userId === 1 ? [{ moduleType: 'page', moduleId: 'bim-mindset__bim-mindset' }] : [];
        },
        async getVerifiedQuizEvidence(userId, quizIds) {
            calls.push(['getVerifiedQuizEvidence', userId, quizIds]);
            return attempts
                .filter((item) => item.isVerified && item.passed && quizIds.includes(item.quizId))
                .map((item) => ({ quizId: item.quizId, bestPercentage: item.percentage }));
        }
    };
    return repository;
}

function fixtureService(repository = createFixtureRepository()) {
    const contentResolver = createCanonicalLearningContentResolver({ catalogService: fixtureCatalog() });
    return { repository, service: createInternshipProgramService({ repository, contentResolver }) };
}

async function withServer(app, callback) {
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    try {
        await callback(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

function authenticatedApp(service) {
    const app = express();
    app.use((req, res, next) => {
        const selected = String(req.headers['x-test-principal'] || 'participant');
        const principals = {
            participant: { id: 1, userId: '1', sub: '1', isAdmin: false },
            participant_google: { id: '1', sub: '1', isAdmin: false },
            other: { id: 2, userId: 2, sub: '2', isAdmin: false },
            mentor: { id: 3, userId: '3', sub: '3', isAdmin: false },
            admin: { id: 9, userId: '9', sub: '9', isAdmin: true }
        };
        req.authChecked = true;
        req.authPrincipal = req.headers.authorization ? principals[selected] || null : null;
        next();
    });
    app.use('/api/training/internships', createInternshipRoutes({ internshipService: service }));
    return app;
}

async function api(base, route, principal = 'participant') {
    const response = await fetch(base + route, {
        headers: { Authorization: 'Bearer fixture', 'X-Test-Principal': principal }
    });
    return { status: response.status, body: await response.json() };
}

test('canonical resolver is deterministic and fails closed for unknown or ambiguous legacy references', async () => {
    const resolver = createCanonicalLearningContentResolver({
        catalogService: fixtureCatalog([
            { contentId: 'page:shared', sourceType: 'page', sourceId: 'shared', title: 'Page', sourceUrl: '/pages/shared.html' },
            { contentId: 'pdf:shared', sourceType: 'pdf', sourceId: 'shared', title: 'PDF', sourceUrl: '/api/file/shared' }
        ])
    });
    assert.deepEqual(await resolver.resolveLegacy({ type: 'reading', source: '/pages/bim-mindset.html' }), {
        contentId: 'page:bim-mindset',
        type: 'page',
        title: 'Konsep BIM Mindset',
        href: '/pages/bim-mindset.html'
    });
    await assert.rejects(resolver.resolveLegacy({ type: 'pdf', id: 'missing' }), (error) =>
        error instanceof ContentReferenceError && error.code === 'UNKNOWN_CONTENT_REFERENCE'
    );
    await assert.rejects(resolver.resolveLegacy({ id: 'shared' }), (error) =>
        error instanceof ContentReferenceError && error.code === 'AMBIGUOUS_CONTENT_REFERENCE'
    );
});

test('safe canonical references never expose native or UNC paths', () => {
    const resolver = createCanonicalLearningContentResolver({ catalogService: fixtureCatalog() });
    const pdf = resolver.toClientReference({
        contentId: 'pdf:manual-one', sourceType: 'pdf', sourceId: 'manual-one',
        titleOverride: 'Manual', sourceLocator: '\\\\pc-bim02\\secret\\manual.pdf'
    });
    const video = resolver.toClientReference({
        contentId: 'video:training-one', sourceType: 'video', sourceId: 'training-one',
        titleOverride: 'Video', sourceLocator: 'G:\\BIM CENTRAL LEARNING\\video.mp4'
    });
    const serialized = JSON.stringify([pdf, video]);
    assert.equal(serialized.includes('\\\\pc-bim02'), false);
    assert.equal(serialized.includes('G:\\'), false);
    assert.equal(pdf.href, '/public/reader.html?material=manual-one');
    assert.match(video.href, /^\/elearning-assets\/courses\.html\?contentId=/);
});

test('authoritative projection reuses legacy activity evidence and verified quiz attempts only', async () => {
    const { repository, service } = fixtureService();
    const result = await service.getLearningPath('internship-pilot', { id: 1, userId: 1, sub: '1' });
    assert.equal(result.progress.percent, 100);
    assert.equal(result.progress.authority, 'server-evidence');
    assert.equal(result.progress.readOnly, true);
    assert.equal(result.path.modules[0].items[0].status, 'completed');
    assert.equal(result.path.modules[0].items[0].provenance, 'learning_activity_events');
    assert.equal(result.path.modules[0].assessments[0].provenance, 'verified_learning_attempts');

    repository.attempts.splice(1, 1);
    const withoutVerifiedAttempt = await service.getProgress('internship-pilot', { id: 1, sub: '1' });
    assert.equal(withoutVerifiedAttempt.percent, 50);
});

test('page, video, and PDF completion all derive from existing activity evidence', async () => {
    const repository = createFixtureRepository();
    repository.getPathModules = async () => [{
        id: 'module-all-types',
        moduleKey: 'bim-mindset-information-management',
        title: 'Existing BCL learning content',
        outcome: '',
        sequenceNumber: 1,
        status: 'active',
        items: [
            {
                contentId: 'page:bim-mindset', sourceType: 'page', sourceId: 'bim-mindset',
                sourceLocator: '/pages/bim-mindset.html', titleOverride: 'Page', contentStatus: 'active',
                sequenceNumber: 1, requirementType: 'required', mappingStatus: 'approved',
                completionRule: { activity: { moduleType: 'page', moduleIds: ['bim-mindset__bim-mindset'] } }
            },
            {
                contentId: 'video:training-one', sourceType: 'video', sourceId: 'training-one',
                sourceLocator: 'G:\\hidden\\training-one.mp4', titleOverride: 'Video', contentStatus: 'active',
                sequenceNumber: 2, requirementType: 'required', mappingStatus: 'approved', completionRule: {}
            },
            {
                contentId: 'pdf:manual-one', sourceType: 'pdf', sourceId: 'manual-one',
                sourceLocator: '\\\\hidden\\manual-one.pdf', titleOverride: 'PDF', contentStatus: 'active',
                sequenceNumber: 3, requirementType: 'required', mappingStatus: 'approved', completionRule: {}
            }
        ]
    }];
    repository.getCompletedActivityEvidence = async () => [
        { moduleType: 'page', moduleId: 'bim-mindset__bim-mindset' },
        { moduleType: 'video', moduleId: 'training-one' },
        { moduleType: 'pdf', moduleId: 'manual-one' }
    ];
    const { service } = fixtureService(repository);
    const result = await service.getLearningPath('internship-pilot', { id: 1, sub: '1' });
    assert.deepEqual(result.path.modules[0].items.map((item) => item.status), ['completed', 'completed', 'completed']);
    assert.equal(result.progress.percent, 100);
    assert.equal(JSON.stringify(result).includes('G:\\'), false);
    assert.equal(JSON.stringify(result).includes('\\\\hidden'), false);
});

test('projection excludes inactive modules, candidate/retired mappings, and draft assessments', async () => {
    const { service } = fixtureService();
    const result = await service.getLearningPath('internship-pilot', { id: 1, sub: '1' });
    assert.equal(result.path.modules.length, 1);
    assert.deepEqual(result.path.modules[0].items.map((item) => item.contentId), ['page:bim-mindset']);
    assert.deepEqual(result.path.modules[0].assessments.map((item) => item.quizId), ['bim-mindset-quiz']);
    assert.equal(JSON.stringify(result).includes('internal-server'), false);
    assert.equal(JSON.stringify(result).includes('Draft manual'), false);
});

test('projection is read-only and independent from client/localStorage state', async () => {
    const { repository, service } = fixtureService();
    const first = await service.getProgress('internship-pilot', {
        id: 1, sub: '1', localStorage: { completed: false }, examHistory: [{ passed: false }]
    });
    const second = await service.getProgress('internship-pilot', {
        id: 1, sub: '1', localStorage: { completed: true }, examHistory: [{ passed: true }]
    });
    assert.deepEqual(first, second);
    assert.equal(repository.calls.some(([name]) => /write|insert|update|progress/i.test(name)), false);
});

test('canonical user identity yields the same enrollment for local and linked-provider principals', async () => {
    const { repository, service } = fixtureService();
    const local = await service.listForPrincipal({ id: 1, userId: '1', sub: '1' });
    const provider = await service.listForPrincipal({ id: '1', sub: '1' });
    assert.deepEqual(local, provider);
    assert.deepEqual(repository.calls.filter(([name]) => name === 'listEnrollments').map((call) => call[1]), [1, 1]);
});

test('batch authorization allows enrolled roles and system admin but hides cohorts from non-members', async () => {
    const { service } = fixtureService();
    assert.equal((await service.getProgram('internship-pilot', { id: 1, sub: '1' })).participantRole, 'participant');
    assert.equal((await service.getProgram('internship-pilot', { id: 3, sub: '3' })).participantRole, 'mentor');
    assert.equal((await service.getProgram('internship-pilot', { id: 9, sub: '9', isAdmin: true })).participantRole, 'system_admin');
    await assert.rejects(service.getProgram('internship-pilot', { id: 2, sub: '2' }), (error) =>
        error.code === 'INTERNSHIP_NOT_FOUND' && error.status === 404
    );
});

test('GET API contract derives identity from principal and enforces object-level authorization', async () => {
    const { service } = fixtureService();
    await withServer(authenticatedApp(service), async (base) => {
        assert.equal((await api(base, '/api/training/internships/me')).status, 200);
        assert.equal((await api(base, '/api/training/internships/me', 'participant_google')).status, 200);
        assert.equal((await api(base, '/api/training/internships/internship-pilot')).status, 200);
        assert.equal((await api(base, '/api/training/internships/internship-pilot', 'mentor')).status, 200);
        assert.equal((await api(base, '/api/training/internships/internship-pilot', 'admin')).status, 200);
        assert.equal((await api(base, '/api/training/internships/internship-pilot', 'other')).status, 404);
        assert.equal((await api(base, '/api/training/internships/invalid%20batch')).status, 400);

        const unauthenticated = await fetch(base + '/api/training/internships/me');
        assert.equal(unauthenticated.status, 401);
    });
});

test('program response allowlist removes path-sensitive mentor display data', async () => {
    const { service } = fixtureService();
    const program = await service.getProgram('internship-pilot', { id: 1, sub: '1' });
    assert.deepEqual(program.mentors, [
        { displayName: 'Mentor BCL', role: 'mentor' },
        { displayName: 'BCL mentor', role: 'reviewer' }
    ]);
    assert.equal(JSON.stringify(program).includes('internal-server'), false);
});

test('repository quiz query requires both verified and passed evidence', async () => {
    let capturedSql = '';
    const repository = createInternshipRepository({
        pgPool: {
            async query(sql) {
                capturedSql = sql;
                return { rows: [] };
            }
        }
    });
    await repository.getVerifiedQuizEvidence(1, ['bim-mindset-quiz']);
    assert.match(capturedSql, /is_verified\s*=\s*true/i);
    assert.match(capturedSql, /passed\s*=\s*true/i);
    assert.doesNotMatch(capturedSql, /user_content_progress/i);
});

test('disabled feature flag mounts nothing and leaves representative existing routes available', async () => {
    const app = express();
    app.get('/api/elearning/modules/learning-paths', (req, res) => res.json({ existing: 'courses' }));
    app.get('/api/elearning/progress/me', (req, res) => res.json({ existing: 'progress' }));
    app.get('/api/training/my-batches', (req, res) => res.json({ existing: 'training' }));
    app.get('/api/elearning/certificate/:id', (req, res) => res.json({ existing: 'certificate' }));
    assert.deepEqual(registerInternshipFeature({ app, enabled: false }), { enabled: false, mounted: false });

    await withServer(app, async (base) => {
        for (const route of [
            '/api/elearning/modules/learning-paths',
            '/api/elearning/progress/me',
            '/api/training/my-batches',
            '/api/elearning/certificate/1'
        ]) assert.equal((await fetch(base + route)).status, 200);
        assert.equal((await fetch(base + '/api/training/internships/me')).status, 404);
    });
});

test('migration contract is versioned, preserves existing defaults, and creates no completion writer', () => {
    const migration = fs.readFileSync(path.join(__dirname, '../scripts/20260924-internship-phase1a.sql'), 'utf8');
    assert.match(migration, /ADD COLUMN IF NOT EXISTS program_type TEXT NOT NULL DEFAULT 'training'/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS internship_batch_config/);
    assert.match(migration, /learning_path_version_id UUID NOT NULL REFERENCES learning_path_versions\(id\) ON DELETE RESTRICT/);
    assert.match(migration, /learning path version is immutable/i);
    assert.match(migration, /'page:bim-mindset'/);
    assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE)\s+user_content_progress/i);
});
