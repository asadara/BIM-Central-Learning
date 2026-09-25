'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const { createCanonicalLearningContentResolver } = require('../services/canonicalLearningContentResolver');
const { createInternshipProgramService } = require('../services/internshipProgramService');
const {
    EvidenceValidationError,
    createInternshipEvidenceService,
    normalizeFileName,
    validateUpload
} = require('../services/internshipEvidenceService');
const { createInternshipRoutes } = require('../routes/internshipRoutes');

function fixtureRepository() {
    const submissions = new Map();
    const evidence = new Map();
    const progressWrites = [];
    let sequence = 0;
    const repository = {
        allowWithdrawal: false,
        submissions,
        evidence,
        progressWrites,
        async listEnrollments() { return []; },
        async getBatchContext(batchId, userId) {
            if (batchId !== 'internship-pilot') return null;
            const role = [1, 2].includes(Number(userId)) ? 'participant' : null;
            return {
                id: batchId, code: 'INT-001', title: 'Internship', status: 'active', programType: 'internship',
                participantDisplayName: `Participant ${userId}`, role, enrollmentStatus: role ? 'active' : null,
                learningPathId: 'path', learningPathTitle: 'Path', learningPathLevel: 'BIM Modeller',
                learningPathVersionId: 'version', versionNumber: 1, versionStatus: 'published',
                versionDefinition: { assessments: [] },
                policy: {
                    assignments: { closeAtDueDate: false },
                    submissions: { allowWithdrawal: repository.allowWithdrawal, minimumEvidenceCount: 1 }
                }
            };
        },
        async listMentors() { return []; },
        async getPathModules() {
            return [{
                id: 'module', moduleKey: 'foundation', title: 'Foundation', outcome: '',
                sequenceNumber: 1, status: 'active', items: [{
                    contentId: 'page:foundation', sourceType: 'page', sourceId: 'foundation',
                    sourceLocator: '/pages/foundation.html', titleOverride: 'Foundation', contentStatus: 'active',
                    sequenceNumber: 1, requirementType: 'required', mappingStatus: 'approved', completionRule: {}
                }]
            }];
        },
        async getCompletedActivityEvidence() { return []; },
        async getVerifiedQuizEvidence() { return []; },
        async listParticipantAssignments(batchId, assignmentId) {
            const rows = [{
                id: 'task-available', batchId, title: 'Available', status: 'published', sortOrder: 1
            }, {
                id: 'task-locked', batchId, title: 'Locked', status: 'published', sortOrder: 2
            }, {
                id: 'task-upcoming', batchId, title: 'Upcoming', status: 'published',
                availableAt: '2099-01-01T00:00:00.000Z', sortOrder: 3
            }, {
                id: 'task-closed', batchId, title: 'Closed', status: 'closed', sortOrder: 4
            }];
            return rows.filter((row) => !assignmentId || row.id === assignmentId);
        },
        async listAssignmentLearningLinks(ids) {
            return ids.includes('task-locked') ? [{
                classworkId: 'task-locked', contentId: 'page:foundation', relationship: 'prerequisite', contentStatus: 'active'
            }] : [];
        },
        async getParticipantSubmission(batchId, assignmentId, userId) {
            return submissions.get(`${batchId}:${assignmentId}:${userId}`) || null;
        },
        async listSubmissionEvidence(batchId, assignmentId, submissionId, userId) {
            const submission = submissions.get(`${batchId}:${assignmentId}:${userId}`);
            if (!submission || submission.id !== submissionId) return [];
            return [...evidence.values()].filter((item) => item.submissionId === submissionId && !item.removed);
        },
        async createOrResumeDraft(batchId, assignmentId, userId, allowResume) {
            const key = `${batchId}:${assignmentId}:${userId}`;
            let submission = submissions.get(key);
            if (!submission) {
                submission = {
                    id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
                    assignmentId, participantUserId: userId, status: 'draft', metadata: {},
                    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                };
                submissions.set(key, submission);
                return { submission, outcome: 'created' };
            }
            if (submission.status === 'draft') return { submission, outcome: 'existing' };
            if (submission.status === 'withdrawn' && allowResume) {
                submission.status = 'draft';
                return { submission, outcome: 'resumed' };
            }
            return { submission, outcome: 'conflict' };
        },
        async updateDraftMetadata(batchId, assignmentId, userId, metadata) {
            const submission = submissions.get(`${batchId}:${assignmentId}:${userId}`);
            if (!submission || submission.status !== 'draft') return null;
            submission.metadata = metadata;
            return submission;
        },
        async addEvidenceToDraft(batchId, assignmentId, submissionId, userId, record, maxFiles) {
            const submission = submissions.get(`${batchId}:${assignmentId}:${userId}`);
            if (!submission || submission.id !== submissionId || submission.status !== 'draft') {
                return { outcome: 'state_conflict', evidence: null };
            }
            const count = [...evidence.values()].filter((item) => item.submissionId === submissionId && !item.removed).length;
            if (count >= maxFiles) return { outcome: 'limit', evidence: null };
            const row = { ...record, submissionId };
            evidence.set(record.evidenceId, row);
            return { outcome: 'inserted', evidence: row };
        },
        async softRemoveDraftEvidence(batchId, assignmentId, submissionId, evidenceId, userId) {
            const submission = submissions.get(`${batchId}:${assignmentId}:${userId}`);
            const item = evidence.get(evidenceId);
            if (!submission || submission.id !== submissionId || submission.status !== 'draft'
                || !item || item.submissionId !== submissionId || item.removed) return false;
            item.removed = true;
            item.storageStatus = 'deleted';
            return true;
        },
        async submitDraft(batchId, assignmentId, userId, minimumEvidenceCount) {
            const submission = submissions.get(`${batchId}:${assignmentId}:${userId}`);
            if (!submission) return { outcome: 'missing', submission: null };
            if (submission.status !== 'draft') return { outcome: 'conflict', submission };
            const count = [...evidence.values()].filter((item) => item.submissionId === submission.id && !item.removed).length;
            if (count < minimumEvidenceCount) return { outcome: 'evidence_required', submission };
            submission.status = 'submitted';
            submission.submittedAt = new Date().toISOString();
            return { outcome: 'submitted', submission };
        },
        async withdrawSubmission(batchId, assignmentId, userId) {
            const submission = submissions.get(`${batchId}:${assignmentId}:${userId}`);
            if (!submission) return { outcome: 'missing', submission: null };
            if (submission.status !== 'submitted') return { outcome: 'conflict', submission };
            submission.status = 'withdrawn';
            submission.withdrawnAt = new Date().toISOString();
            return { outcome: 'withdrawn', submission };
        }
    };
    return repository;
}

function fixture() {
    const repository = fixtureRepository();
    const stored = new Map();
    const evidenceService = createInternshipEvidenceService({
        storage: {
            async putQuarantined(id, buffer) { stored.set(id, Buffer.from(buffer)); return `quarantine/${id}.bin`; },
            async discard(key) { stored.delete(path.basename(key, '.bin')); }
        }
    });
    const catalog = [{
        contentId: 'page:foundation', sourceType: 'page', sourceId: 'foundation',
        title: 'Foundation', sourceUrl: '/pages/foundation.html'
    }];
    const service = createInternshipProgramService({
        repository,
        evidenceService,
        contentResolver: createCanonicalLearningContentResolver({
            catalogService: {
                async loadCatalog() { return catalog; },
                async getById(id) { return catalog.find((item) => item.contentId === id) || null; }
            }
        })
    });
    return { repository, service, stored };
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

function appFor(service, submissionsEnabled = true) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const id = Number(req.headers['x-test-user'] || 1);
        req.authChecked = true;
        req.authPrincipal = req.headers.authorization ? { id, sub: String(id), isAdmin: false } : null;
        next();
    });
    app.use('/api/training/internships', createInternshipRoutes({
        internshipService: service,
        assignmentsEnabled: true,
        submissionsEnabled
    }));
    return app;
}

async function request(base, route, { method = 'GET', user = 1, body, headers = {} } = {}) {
    const options = {
        method,
        headers: { Authorization: 'Bearer fixture', 'X-Test-User': String(user), ...headers }
    };
    if (body !== undefined) {
        options.body = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(base + route, options);
    return { status: response.status, body: await response.json().catch(() => ({})) };
}

function pdfFile(name = 'report.pdf') {
    return { originalname: name, mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nevidence') };
}

test('submission feature OFF preserves Phase 2A and exposes no mutation endpoints', async () => {
    const { service } = fixture();
    await withServer(appFor(service, false), async (base) => {
        assert.equal((await request(base, '/api/training/internships/internship-pilot/assignments')).status, 200);
        assert.equal((await request(base, '/api/training/internships/internship-pilot/assignments/task-available/submission')).status, 404);
        assert.equal((await request(base, '/api/training/internships/internship-pilot/assignments/task-available/submission', { method: 'POST' })).status, 404);
    });
});

test('membership, batch, assignment visibility, and availability are enforced on mutations', async () => {
    const { service } = fixture();
    await withServer(appFor(service), async (base) => {
        const root = '/api/training/internships';
        assert.equal((await request(base, `${root}/internship-pilot/assignments/task-available/submission`, { method: 'POST', user: 3 })).status, 404);
        assert.equal((await request(base, `${root}/wrong-batch/assignments/task-available/submission`, { method: 'POST' })).status, 404);
        assert.equal((await request(base, `${root}/internship-pilot/assignments/wrong-task/submission`, { method: 'POST' })).status, 404);
        assert.equal((await request(base, `${root}/internship-pilot/assignments/task-locked/submission`, { method: 'POST' })).status, 409);
        assert.equal((await request(base, `${root}/internship-pilot/assignments/task-upcoming/submission`, { method: 'POST' })).status, 409);
        assert.equal((await request(base, `${root}/internship-pilot/assignments/task-closed/submission`, { method: 'POST' })).status, 409);
    });
});

test('one participant/assignment submission is idempotent and client identity is rejected', async () => {
    const { service } = fixture();
    await withServer(appFor(service), async (base) => {
        const route = '/api/training/internships/internship-pilot/assignments/task-available/submission';
        const first = await request(base, route, { method: 'POST' });
        const second = await request(base, route, { method: 'POST' });
        assert.equal(first.status, 201);
        assert.equal(second.status, 200);
        assert.equal(first.body.data.submission.submissionId, second.body.data.submission.submissionId);
        assert.equal((await request(base, route, { method: 'POST', body: { participant_user_id: 2 } })).status, 400);
        assert.equal((await request(base, route, { method: 'PATCH', body: { userId: 2, comment: 'tamper' } })).status, 400);
    });
});

test('participant reads only own submission and responses never disclose storage paths', async () => {
    const { service } = fixture();
    await service.createDraftSubmission('internship-pilot', 'task-available', { id: 1, sub: '1' });
    const item = await service.attachEvidence('internship-pilot', 'task-available', { id: 1, sub: '1' }, pdfFile());
    const own = await service.getSubmission('internship-pilot', 'task-available', { id: 1, sub: '1' });
    const other = await service.getSubmission('internship-pilot', 'task-available', { id: 2, sub: '2' });
    assert.equal(own.submission.evidence[0].evidenceId, item.evidenceId);
    assert.equal(other.submission, null);
    assert.doesNotMatch(JSON.stringify(own), /storageKey|filePath|externalUrl|quarantine\/|[a-z]:[\\/]|\\\\/i);
});

test('multipart evidence endpoint authorizes before storage and returns safe quarantine metadata', async () => {
    const { service, stored } = fixture();
    await withServer(appFor(service), async (base) => {
        const route = '/api/training/internships/internship-pilot/assignments/task-available/submission';
        assert.equal((await request(base, route, { method: 'POST' })).status, 201);
        const form = new FormData();
        form.append('evidence', new Blob([Buffer.from('%PDF-1.4\nroute evidence')], { type: 'application/pdf' }), 'report.pdf');
        const response = await fetch(`${base}${route}/evidence`, {
            method: 'POST',
            headers: { Authorization: 'Bearer fixture', 'X-Test-User': '1' },
            body: form
        });
        const payload = await response.json();
        assert.equal(response.status, 201);
        assert.equal(payload.data.scanStatus, 'pending');
        assert.equal(payload.data.storageStatus, 'quarantined');
        assert.equal(stored.size, 1);
        assert.doesNotMatch(JSON.stringify(payload), /storageKey|filePath|externalUrl|quarantine\//i);
    });
});

test('Draft to Submitted freezes evidence and withdrawal requires explicit policy', async () => {
    const { repository, service } = fixture();
    const actor = { id: 1, sub: '1' };
    await service.createDraftSubmission('internship-pilot', 'task-available', actor);
    const item = await service.attachEvidence('internship-pilot', 'task-available', actor, pdfFile());
    const beforeProgress = await service.getProgress('internship-pilot', actor);
    const submitted = await service.submitDraftSubmission('internship-pilot', 'task-available', actor);
    assert.equal(submitted.state, 'submitted');
    await assert.rejects(
        service.removeDraftEvidence('internship-pilot', 'task-available', item.evidenceId, actor),
        (error) => error.code === 'SUBMISSION_NOT_EDITABLE'
    );
    await assert.rejects(
        service.attachEvidence('internship-pilot', 'task-available', actor, pdfFile('second.pdf')),
        (error) => error.code === 'SUBMISSION_NOT_EDITABLE'
    );
    await assert.rejects(
        service.withdrawParticipantSubmission('internship-pilot', 'task-available', actor),
        (error) => error.code === 'SUBMISSION_WITHDRAWAL_NOT_ALLOWED'
    );
    repository.allowWithdrawal = true;
    assert.equal((await service.withdrawParticipantSubmission('internship-pilot', 'task-available', actor)).state, 'withdrawn');
    assert.equal((await service.createDraftSubmission('internship-pilot', 'task-available', actor)).resumed, true);
    assert.deepEqual(await service.getProgress('internship-pilot', actor), beforeProgress);
    assert.deepEqual(repository.progressWrites, []);
});

test('draft evidence is soft-removed and cannot be removed by another participant', async () => {
    const { service } = fixture();
    const owner = { id: 1, sub: '1' };
    await service.createDraftSubmission('internship-pilot', 'task-available', owner);
    const item = await service.attachEvidence('internship-pilot', 'task-available', owner, pdfFile());
    await assert.rejects(
        service.removeDraftEvidence('internship-pilot', 'task-available', item.evidenceId, { id: 2, sub: '2' }),
        (error) => error.code === 'SUBMISSION_NOT_EDITABLE'
    );
    const removed = await service.removeDraftEvidence('internship-pilot', 'task-available', item.evidenceId, owner);
    assert.deepEqual(removed, { evidenceId: item.evidenceId, removed: true, retention: 'metadata-retained' });
});

test('file policy rejects traversal, executables, MIME mismatch, zero bytes, and oversized content', () => {
    for (const unsafe of ['../../secret.txt', '..\\..\\secret.txt', 'report.pdf.exe', 'CON.pdf']) {
        assert.throws(
            () => validateUpload({ originalname: unsafe, mimetype: 'application/pdf', buffer: Buffer.from('%PDF-x') }),
            EvidenceValidationError
        );
    }
    assert.throws(
        () => validateUpload({ originalname: 'report.pdf', mimetype: 'image/png', buffer: Buffer.from('%PDF-x') }),
        (error) => error.code === 'EVIDENCE_MIME_MISMATCH'
    );
    assert.throws(
        () => validateUpload({ originalname: 'report.pdf', mimetype: 'application/pdf', buffer: Buffer.alloc(0) }),
        (error) => error.code === 'EMPTY_EVIDENCE_FILE'
    );
    assert.throws(
        () => validateUpload({ originalname: 'report.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-too-big') }, 4),
        (error) => error.code === 'EVIDENCE_FILE_TOO_LARGE' && error.status === 413
    );
    assert.throws(() => normalizeFileName('G:\\private\\report.pdf'), EvidenceValidationError);
});

test('evidence hash is generated, classification is controlled, and unscanned uploads stay quarantined', async () => {
    const { service } = fixture();
    const actor = { id: 1, sub: '1' };
    await service.createDraftSubmission('internship-pilot', 'task-available', actor);
    const file = pdfFile();
    const item = await service.attachEvidence('internship-pilot', 'task-available', actor, file);
    assert.equal(item.sha256, crypto.createHash('sha256').update(file.buffer).digest('hex'));
    assert.equal(item.classification, 'internal');
    assert.equal(item.scanStatus, 'pending');
    assert.equal(item.storageStatus, 'quarantined');
    await assert.rejects(
        service.attachEvidence('internship-pilot', 'task-available', actor, pdfFile('restricted.pdf'), {
            classification: 'project_restricted'
        }),
        (error) => error.code === 'INVALID_EVIDENCE_CLASSIFICATION'
    );
    for (let index = 2; index <= 5; index += 1) {
        await service.attachEvidence('internship-pilot', 'task-available', actor, pdfFile(`report-${index}.pdf`));
    }
    await assert.rejects(
        service.attachEvidence('internship-pilot', 'task-available', actor, pdfFile('report-6.pdf')),
        (error) => error.code === 'EVIDENCE_FILE_LIMIT'
    );
});

test('Phase 2B-1 migration extends generic tables additively and has a rollback', () => {
    const migration = fs.readFileSync(path.join(__dirname, '../scripts/20260925-internship-phase2b1.sql'), 'utf8');
    const rollback = fs.readFileSync(path.join(__dirname, '../scripts/20260925-internship-phase2b1-rollback.sql'), 'utf8');
    assert.match(migration, /ALTER TABLE assignment_submissions/);
    assert.match(migration, /ALTER TABLE submission_files/);
    assert.match(migration, /submission_status_history/);
    assert.match(migration, /sha256/);
    assert.match(migration, /storage_key/);
    assert.match(migration, /uploaded_by_user_id INTEGER REFERENCES users/);
    assert.match(migration, /classification IN \('training', 'internal', 'project_restricted'\)/);
    assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS internship_submissions/i);
    assert.match(rollback, /DROP TABLE IF EXISTS submission_status_history/);
    assert.match(rollback, /DROP COLUMN IF EXISTS storage_key/);
});

test('Phase 2B-1 contract has no browser authority, mentor review, direct download, or Projects integration', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/internship.html'), 'utf8');
    const client = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/js/internship.js'), 'utf8');
    const routes = fs.readFileSync(path.join(__dirname, '../routes/internshipRoutes.js'), 'utf8');
    const feature = fs.readFileSync(path.join(__dirname, '../features/internshipFeature.js'), 'utf8');
    assert.doesNotMatch(`${html}\n${client}`, /drag-and-drop|localStorage.*submission/i);
    assert.doesNotMatch(routes, /mentor score|rubric|revision_requested|Projects Explorer|UNC path/i);
    assert.doesNotMatch(routes, /submission\/:submissionId|evidence\/:evidenceId[^']*\/download/i);
    assert.match(feature, /'private', 'internship-evidence'/);
    assert.doesNotMatch(feature, /'uploads', 'internship-evidence'/);
});
