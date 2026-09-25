'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const { createCanonicalLearningContentResolver } = require('../services/canonicalLearningContentResolver');
const {
    createInternshipProgramService,
    deriveAssignmentAvailability
} = require('../services/internshipProgramService');
const { createInternshipRepository } = require('../repositories/internshipRepository');
const { createInternshipRoutes } = require('../routes/internshipRoutes');
const ui = require('../../BC-Learning-Main/elearning-assets/js/internship.js');

const fixedNow = new Date('2026-09-25T00:00:00.000Z');

function catalog() {
    const items = [{
        contentId: 'page:bim-mindset',
        sourceType: 'page',
        sourceId: 'bim-mindset',
        title: 'BIM Mindset',
        sourceUrl: '/pages/bim-mindset.html'
    }];
    return {
        async loadCatalog() { return items; },
        async getById(contentId) { return items.find((item) => item.contentId === contentId) || null; }
    };
}

function assignmentFixtureRepository() {
    const state = { pageComplete: false, quizComplete: false };
    const context = {
        id: 'internship-pilot', code: 'INT-001', title: 'Internship Pilot', status: 'active',
        programType: 'internship', participantDisplayName: 'Participant BCL', enrollmentStatus: 'active',
        learningPathId: 'path-one', learningPathTitle: 'Path One', learningPathLevel: 'BIM Modeller',
        learningPathVersionId: 'version-one', versionNumber: 1, versionStatus: 'published',
        versionDefinition: { assessments: [{
            quizId: 'mindset-quiz', moduleKey: 'mindset', title: 'Mindset Quiz', required: true,
            status: 'published', href: '/pages/bim-mindset.html#quiz'
        }] },
        policy: { assignments: { closeAtDueDate: true } }
    };
    const assignments = [{
        id: 'task-prerequisite', batchId: 'internship-pilot', topicId: 'topic-foundation',
        topicTitle: 'Foundation', topicDescription: 'Apply the foundation',
        title: 'Mindset Reflection', brief: 'Apply the learning.', requiredDeliverable: 'Reflection note',
        availableAt: '2026-09-01T00:00:00.000Z', dueAt: '2026-10-01T00:00:00.000Z',
        status: 'published', sortOrder: 1
    }, {
        id: 'task-upcoming', batchId: 'internship-pilot', topicId: 'topic-foundation',
        topicTitle: 'Foundation', title: 'Future Task', brief: '', requiredDeliverable: 'Future output',
        availableAt: '2026-10-10T00:00:00.000Z', dueAt: null, status: 'published', sortOrder: 2
    }, {
        id: 'task-closed', batchId: 'internship-pilot', topicId: null,
        title: 'Closed Task', brief: '', requiredDeliverable: '', availableAt: null,
        dueAt: '2026-09-20T00:00:00.000Z', status: 'published', sortOrder: 3
    }];
    const links = [{
        classworkId: 'task-prerequisite', contentId: 'page:bim-mindset', quizId: null,
        relationship: 'prerequisite'
    }, {
        classworkId: 'task-prerequisite', contentId: null, quizId: 'mindset-quiz',
        relationship: 'reference'
    }];

    return {
        state,
        calls: [],
        async listEnrollments(userId) { return userId === 1 ? [{ ...context, role: 'participant' }] : []; },
        async getBatchContext(batchId, userId) {
            if (batchId !== 'internship-pilot') return null;
            const role = userId === 1 ? 'participant' : userId === 3 ? 'mentor' : null;
            return { ...context, role, enrollmentStatus: role ? 'active' : null };
        },
        async listMentors() { return []; },
        async getPathModules() {
            return [{
                id: 'module-one', moduleKey: 'mindset', title: 'BIM Mindset', outcome: 'Learn first',
                sequenceNumber: 1, status: 'active', items: [{
                    contentId: 'page:bim-mindset', sourceType: 'page', sourceId: 'bim-mindset',
                    sourceLocator: '/pages/bim-mindset.html', titleOverride: 'BIM Mindset',
                    contentStatus: 'active', sequenceNumber: 1, requirementType: 'required',
                    mappingStatus: 'approved',
                    completionRule: { activity: { moduleType: 'page', moduleIds: ['bim-mindset'] } }
                }]
            }];
        },
        async getCompletedActivityEvidence() {
            return state.pageComplete ? [{ moduleType: 'page', moduleId: 'bim-mindset' }] : [];
        },
        async getVerifiedQuizEvidence() {
            return state.quizComplete ? [{ quizId: 'mindset-quiz', bestPercentage: 90 }] : [];
        },
        async listParticipantAssignments(batchId, assignmentId = null) {
            this.calls.push(['listParticipantAssignments', batchId, assignmentId]);
            return assignments.filter((assignment) => !assignmentId || assignment.id === assignmentId);
        },
        async listAssignmentLearningLinks(ids) {
            return links.filter((link) => ids.includes(link.classworkId));
        }
    };
}

function fixtureService(repository = assignmentFixtureRepository()) {
    return {
        repository,
        service: createInternshipProgramService({
            repository,
            contentResolver: createCanonicalLearningContentResolver({ catalogService: catalog() })
        })
    };
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

function appFor(service, assignmentsEnabled) {
    const app = express();
    app.use((req, _res, next) => {
        const principals = {
            participant: { id: 1, sub: '1', isAdmin: false },
            other: { id: 2, sub: '2', isAdmin: false }
        };
        req.authChecked = true;
        req.authPrincipal = req.headers.authorization
            ? principals[String(req.headers['x-test-principal'] || 'participant')]
            : null;
        next();
    });
    app.use('/api/training/internships', createInternshipRoutes({ internshipService: service, assignmentsEnabled }));
    return app;
}

async function api(base, route, principal = 'participant') {
    const response = await fetch(base + route, {
        headers: { Authorization: 'Bearer fixture', 'X-Test-Principal': principal }
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
}

test('Assignment feature flag OFF leaves Phase 1 endpoints active and Assignment endpoint unavailable', async () => {
    const { service } = fixtureService();
    await withServer(appFor(service, false), async (base) => {
        assert.equal((await api(base, '/api/training/internships/internship-pilot/learning-path')).status, 200);
        assert.equal((await api(base, '/api/training/internships/internship-pilot/assignments')).status, 404);
    });
});

test('Assignment API requires canonical membership and rejects modified batch URLs', async () => {
    const { service } = fixtureService();
    await withServer(appFor(service, true), async (base) => {
        assert.equal((await api(base, '/api/training/internships/internship-pilot/assignments')).status, 200);
        assert.equal((await api(base, '/api/training/internships/internship-pilot/assignments', 'other')).status, 404);
        assert.equal((await api(base, '/api/training/internships/other-batch/assignments')).status, 404);
        assert.equal((await api(base, '/api/training/internships/internship-pilot/assignments/task-from-other-batch')).status, 404);
        assert.equal((await api(base, '/api/training/internships/internship-pilot/assignments/invalid%20id')).status, 400);
    });
});

test('published assignment returns topic, deliverable, canonical learning links, and no submission payload', async () => {
    const { service } = fixtureService();
    const result = await service.getAssignment('internship-pilot', 'task-prerequisite', { id: 1, sub: '1' }, { now: fixedNow });
    const assignment = result.assignment;
    assert.equal(assignment.topic.title, 'Foundation');
    assert.equal(assignment.requiredDeliverable, 'Reflection note');
    assert.deepEqual(assignment.learningReferences.map((reference) => reference.type), ['page', 'quiz']);
    assert.equal(assignment.learningReferences[0].href, '/pages/bim-mindset.html');
    assert.doesNotMatch(JSON.stringify(result), /submission|review|score|filePath|internalNote/i);
});

test('incomplete prerequisite locks Assignment and authoritative completion unlocks it without a write', async () => {
    const { repository, service } = fixtureService();
    const locked = await service.getAssignments('internship-pilot', { id: 1, sub: '1' }, { now: fixedNow });
    assert.equal(locked.assignments.find((item) => item.assignmentId === 'task-prerequisite').state, 'locked');

    repository.state.pageComplete = true;
    const available = await service.getAssignments('internship-pilot', { id: 1, sub: '1' }, { now: fixedNow });
    assert.equal(available.assignments.find((item) => item.assignmentId === 'task-prerequisite').state, 'available');
    assert.equal(repository.calls.some(([name]) => /write|insert|update/i.test(name)), false);
});

test('future release is Upcoming and close-at-due policy derives Closed', async () => {
    const { service } = fixtureService();
    const result = await service.getAssignments('internship-pilot', { id: 1, sub: '1' }, { now: fixedNow });
    assert.equal(result.assignments.find((item) => item.assignmentId === 'task-upcoming').state, 'upcoming');
    assert.equal(result.assignments.find((item) => item.assignmentId === 'task-closed').state, 'closed');
    assert.deepEqual(result.summary, { total: 3, available: 0, upcoming: 1, locked: 1, closed: 1 });
});

test('availability precedence is closed, upcoming, prerequisite lock, then available', () => {
    const prerequisite = [{ relationship: 'prerequisite', completed: false }];
    const policy = { assignments: { closeAtDueDate: true } };
    assert.equal(deriveAssignmentAvailability({ status: 'closed' }, [], policy, fixedNow), 'closed');
    assert.equal(deriveAssignmentAvailability({ status: 'published', availableAt: '2026-10-01' }, prerequisite, policy, fixedNow), 'upcoming');
    assert.equal(deriveAssignmentAvailability({ status: 'published' }, prerequisite, policy, fixedNow), 'locked');
    assert.equal(deriveAssignmentAvailability({ status: 'published' }, [], policy, fixedNow), 'available');
});

test('invalid canonical prerequisite safely excludes the assignment', async () => {
    const repository = assignmentFixtureRepository();
    repository.listAssignmentLearningLinks = async () => [{
        classworkId: 'task-prerequisite', contentId: 'page:unknown', relationship: 'prerequisite'
    }];
    const { service } = fixtureService(repository);
    const result = await service.getAssignments('internship-pilot', { id: 1, sub: '1' }, { now: fixedNow });
    assert.equal(result.assignments.some((item) => item.assignmentId === 'task-prerequisite'), false);
    await assert.rejects(
        service.getAssignment('internship-pilot', 'task-prerequisite', { id: 1, sub: '1' }, { now: fixedNow }),
        (error) => error.code === 'ASSIGNMENT_NOT_FOUND' && error.status === 404
    );
});

test('Assignment projection cannot alter Phase 1 learning progress or trust browser state', async () => {
    const { repository, service } = fixtureService();
    const before = await service.getProgress('internship-pilot', { id: 1, sub: '1' });
    await service.getAssignments('internship-pilot', {
        id: 1, sub: '1', localStorage: { assignmentComplete: true }, assignmentState: 'completed'
    }, { now: fixedNow });
    const after = await service.getProgress('internship-pilot', { id: 1, sub: '1' });
    assert.deepEqual(after, before);
    assert.equal(after.authority, 'server-evidence');
    assert.equal(repository.calls.some(([name]) => /write|insert|update/i.test(name)), false);
});

test('repository query enforces batch ownership, practice_task type, published visibility, and stable ordering', async () => {
    let sql = '';
    let params = null;
    const repository = createInternshipRepository({
        pgPool: { async query(statement, values) { sql = statement; params = values; return { rows: [] }; } }
    });
    await repository.listParticipantAssignments('batch-a', 'assignment-a');
    assert.match(sql, /ci\.batch_id\s*=\s*\$1/i);
    assert.match(sql, /ci\.type\s*=\s*'practice_task'/i);
    assert.match(sql, /ci\.status\s+IN\s*\('published',\s*'closed'\)/i);
    assert.match(sql, /participant_visibility\s*=\s*'visible'/i);
    assert.match(sql, /ci\.id\s*=\s*\$2/i);
    assert.deepEqual(params, ['batch-a', 'assignment-a']);
});

test('draft and archived visibility are excluded by the participant repository contract', async () => {
    let sql = '';
    const repository = createInternshipRepository({
        pgPool: { async query(statement) { sql = statement; return { rows: [] }; } }
    });
    await repository.listParticipantAssignments('batch-a');
    assert.doesNotMatch(sql, /status\s*<>\s*'archived'/i);
    assert.match(sql, /status\s+IN\s*\('published',\s*'closed'\)/i);
});

test('native paths are removed from Assignment display data and safe hrefs remain canonical', async () => {
    const repository = assignmentFixtureRepository();
    const baseList = repository.listParticipantAssignments.bind(repository);
    repository.listParticipantAssignments = async (...args) => (await baseList(...args)).map((assignment) => ({
        ...assignment,
        brief: '\\\\internal-server\\mentor-note.txt',
        requiredDeliverable: 'G:\\private\\deliverable.rvt'
    }));
    const { service } = fixtureService(repository);
    const result = await service.getAssignments('internship-pilot', { id: 1, sub: '1' }, { now: fixedNow });
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /internal-server|G:\\/i);
    assert.match(serialized, /\/pages\/bim-mindset\.html/);
});

test('Phase 2A migration is versioned, normalized, constrained, indexed, and has rollback', () => {
    const migration = fs.readFileSync(path.join(__dirname, '../scripts/20260925-internship-phase2a.sql'), 'utf8');
    const rollback = fs.readFileSync(path.join(__dirname, '../scripts/20260925-internship-phase2a-rollback.sql'), 'utf8');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS classwork_content_links/);
    assert.match(migration, /classwork_id TEXT NOT NULL REFERENCES classwork_items\(id\) ON DELETE CASCADE/);
    assert.match(migration, /content_id TEXT REFERENCES learning_content_registry\(content_id\) ON DELETE RESTRICT/);
    assert.match(migration, /relationship_type IN \('prerequisite', 'reference'\)/);
    assert.match(migration, /participant_visibility IN \('visible', 'hidden'\)/);
    assert.match(migration, /UNIQUE \(classwork_id, content_id, relationship_type\)/);
    assert.doesNotMatch(migration, /prerequisite_completed|assignment_completed|INSERT INTO learning_activity_events/i);
    assert.match(rollback, /DROP TABLE IF EXISTS classwork_content_links/);
    assert.match(rollback, /DROP COLUMN IF EXISTS required_deliverable/);
});

test('participant Assignment UI stays separate from learning progress and Phase 2A rendering has no submission control', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/internship.html'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/js/internship.js'), 'utf8');
    const phase2aMarkup = ui.renderAssignmentsMarkup([{
        assignmentId: 'phase2a-assignment', title: 'Phase 2A Assignment', state: 'available'
    }]);
    assert.match(html, /id="internship-assignments"/);
    assert.match(source, /\/assignments/);
    assert.match(source, /Tugas praktik belum tersedia untuk tahap ini/);
    assert.match(source, /Selesaikan materi prasyarat terlebih dahulu/);
    assert.doesNotMatch(phase2aMarkup, /type="file"|Mulai Tugas|Kirim Tugas|Evidence/i);
    assert.doesNotMatch(`${html}\n${source}`, /mentor score|rubric/i);
    assert.doesNotMatch(source, /localStorage\.(?:getItem|setItem)\([^)]*assignment/i);
    assert.doesNotMatch(source, /progress\.percent\s*[+*/-]=|assignment.*progress\.percent/i);
});

test('participant rendering uses availability labels and canonical BCL links only', () => {
    const markup = ui.renderAssignmentsMarkup([{
        title: 'Federated Review', state: 'locked', requiredDeliverable: 'Clash report',
        topic: { title: 'Coordination' },
        learningReferences: [{
            relationship: 'prerequisite', title: 'Coordination Workflow',
            href: '/pages/coordination.html', completed: false
        }, {
            relationship: 'reference', title: 'Unsafe', href: '\\\\server\\file.pdf', completed: false
        }]
    }]);
    assert.match(markup, /Belum Terbuka/);
    assert.match(markup, /Selesaikan materi prasyarat/);
    assert.match(markup, /href="\/pages\/coordination\.html"/);
    assert.doesNotMatch(markup, /href="[^"]*(?:server|file\.pdf)/i);
    assert.doesNotMatch(markup, /Selesai.*Tugas|Completed Assignment/i);
});

test('Training integration disables Internship submission/review only when Phase 2A is enabled', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '../routes/trainingBatchRoutes.js'), 'utf8');
    const myTrainingSource = fs.readFileSync(path.join(
        __dirname,
        '../../BC-Learning-Main/elearning-assets/js/my-training.js'
    ), 'utf8');
    const adminSource = fs.readFileSync(path.join(
        __dirname,
        '../../BC-Learning-Main/pages/sub/adminbcl.js'
    ), 'utf8');
    assert.match(routeSource, /INTERNSHIP_ASSIGNMENTS_ENABLED/);
    assert.match(routeSource, /INTERNSHIP_SUBMISSION_NOT_AVAILABLE/);
    assert.match(routeSource, /participantSubmission: !\(internshipAssignmentsEnabled/);
    assert.match(myTrainingSource, /participantSubmissionEnabled/);
    assert.match(myTrainingSource, /participantSubmissionEnabled && isPracticeTask/);
    assert.match(adminSource, /currentTrainingPlanCapabilities\.participantSubmission !== false/);
    assert.match(adminSource, /isPracticeTask && submissionsEnabled/);
});

test('existing BCL learning surfaces and Phase 1 Internship page remain present', () => {
    const root = path.join(__dirname, '../../BC-Learning-Main');
    for (const relative of [
        'pages/elearning.html',
        'elearning-assets/dashboard.html',
        'elearning-assets/my-training.html',
        'elearning-assets/courses.html',
        'elearning-assets/internship.html'
    ]) assert.equal(fs.existsSync(path.join(root, relative)), true, relative);
});
