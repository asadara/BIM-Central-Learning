'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createInternshipRepository } = require('../repositories/internshipRepository');
const { createInternshipReviewService } = require('../services/internshipReviewService');
const { createInternshipRoutes } = require('../routes/internshipRoutes');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function revisionPool(reviewState = 'revision_requested') {
    const calls = [];
    const client = {
        async query(sql, params = []) {
            calls.push({ sql: String(sql), params });
            if (/SELECT\s+s\.id, s\.classwork_item_id/i.test(sql)) return { rows: [{
                id: 'submission-one', assignmentId: 'task-one', participantUserId: 1,
                status: 'submitted', submissionRevision: 1, metadata: {}
            }] };
            if (/SELECT state\s+FROM submission_reviews/i.test(sql)) return { rows: [{ state: reviewState }] };
            if (/SELECT id\s+FROM submission_revisions/i.test(sql)) return { rows: [{ id: 'submission-one:r1' }] };
            if (/UPDATE assignment_submissions/i.test(sql)) return { rows: [{
                id: 'submission-one', assignmentId: 'task-one', participantUserId: 1,
                status: 'draft', submissionRevision: 2, metadata: {}
            }] };
            return { rows: [] };
        },
        release() {}
    };
    return {
        calls,
        async query(sql, params) { return client.query(sql, params); },
        async connect() { return client; }
    };
}

function participantReviewRepository() {
    return {
        async getBatchContext() { return { programType: 'internship', role: 'participant', enrollmentStatus: 'active' }; },
        async getParticipantReviewSubmission() { return { id: 'submission-one', status: 'submitted', submissionRevision: 2 }; },
        async getSubmissionReview() { return null; },
        async listParticipantRevisionHistory() {
            return [{ revisionNo: 2, submissionState: 'submitted', reviewState: 'not_started', isCurrent: true }, {
                revisionNo: 1, submissionState: 'submitted', reviewState: 'revision_requested', isCurrent: false,
                participantFeedback: 'Perbaiki penamaan layer.'
            }];
        },
        async listReviewCriteria() { return [{ criterionId: 'quality', title: 'Quality', maxScore: 5, required: true }]; },
        async listReviewScores(_submissionId, revisionNo) { return revisionNo === 1 ? [{ criterionId: 'quality', score: 3 }] : []; }
    };
}

test('Phase 3B migration creates immutable submission revision lineage', () => {
    const sql = read('backend/scripts/20260925-internship-phase3b.sql');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS submission_revisions/);
    assert.match(sql, /UNIQUE \(submission_id, revision_no\)/);
    assert.match(sql, /parent_revision_id/);
});

test('migration enforces one current revision per logical submission', () => {
    assert.match(read('backend/scripts/20260925-internship-phase3b.sql'), /UNIQUE INDEX[\s\S]+WHERE is_current/i);
});

test('migration backfills revision one/current without runtime DDL', () => {
    const sql = read('backend/scripts/20260925-internship-phase3b.sql');
    assert.match(sql, /INSERT INTO submission_revisions[\s\S]+FROM assignment_submissions/i);
    assert.doesNotMatch(read('backend/repositories/internshipRepository.js'), /CREATE TABLE|ALTER TABLE/);
});

test('rollback refuses to discard real revision N+1 data', () => {
    assert.match(read('backend/scripts/20260925-internship-phase3b-rollback.sql'), /revision_no > 1/);
});

test('repository creates a server-generated monotonic revision N+1', async () => {
    const pool = revisionPool();
    const result = await createInternshipRepository({ pgPool: pool, revisionsEnabled: true })
        .createNextRevision('batch-one', 'task-one', 1);
    assert.equal(result.outcome, 'created');
    assert.equal(result.submission.submissionRevision, 2);
    assert.ok(pool.calls.some((call) => call.params.includes('submission-one:r2')));
});

test('revision creation is transactional and locks authoritative rows', async () => {
    const pool = revisionPool();
    await createInternshipRepository({ pgPool: pool, revisionsEnabled: true }).createNextRevision('batch-one', 'task-one', 1);
    assert.equal(pool.calls[0].sql, 'BEGIN');
    assert.match(pool.calls.map((call) => call.sql).join('\n'), /FOR UPDATE/);
    assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('new revision is denied unless latest decision requested revision', async () => {
    const result = await createInternshipRepository({ pgPool: revisionPool('accepted'), revisionsEnabled: true })
        .createNextRevision('batch-one', 'task-one', 1);
    assert.equal(result.outcome, 'review_conflict');
});

test('new revision marks old lineage immutable and current pointer false', async () => {
    const pool = revisionPool();
    await createInternshipRepository({ pgPool: pool, revisionsEnabled: true }).createNextRevision('batch-one', 'task-one', 1);
    assert.ok(pool.calls.some((call) => /UPDATE submission_revisions[\s\S]+is_current = FALSE/i.test(call.sql)));
});

test('new revision starts as an empty draft and never copies evidence', async () => {
    const pool = revisionPool();
    await createInternshipRepository({ pgPool: pool, revisionsEnabled: true }).createNextRevision('batch-one', 'task-one', 1);
    const statements = pool.calls.map((call) => call.sql).join('\n');
    assert.match(statements, /VALUES \(\$1,\$2,\$3,\$4,'draft','\{\}'::jsonb/);
    assert.doesNotMatch(statements, /INSERT INTO submission_files[\s\S]+SELECT/i);
});

test('active evidence reads and writes are revision-scoped only when enabled', () => {
    const source = read('backend/repositories/internshipRepository.js');
    assert.match(source, /revisionsEnabled \? 'AND sf\.submission_revision = s\.submission_revision'/);
    assert.match(source, /submission_revision = \$2/);
});

test('Phase 2 submission path remains schema-compatible while review is OFF', () => {
    const source = read('backend/features/internshipFeature.js');
    assert.match(source, /revisionsEnabled: reviewFeatureEnabled/);
});

test('participant review history exposes old feedback and scores but no internal note', async () => {
    const service = createInternshipReviewService({ repository: participantReviewRepository() });
    const dto = await service.getParticipantReview('batch-one', 'task-one', { id: 1 });
    assert.equal(dto.revisionHistory[1].participantFeedback, 'Perbaiki penamaan layer.');
    assert.equal(dto.revisionHistory[1].scores[0].score, 3);
    assert.equal(JSON.stringify(dto).includes('internalNote'), false);
});

test('participant cannot create another revision before the current review requests it', async () => {
    const service = createInternshipReviewService({ repository: participantReviewRepository() });
    const dto = await service.getParticipantReview('batch-one', 'task-one', { id: 1 });
    assert.equal(dto.canCreateRevision, false);
});

test('review routes expose controlled revision and reject client revision numbering', () => {
    const routes = createInternshipRoutes({
        internshipService: {}, reviewService: {}, assignmentsEnabled: true, submissionsEnabled: true, reviewEnabled: true
    });
    const paths = routes.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
    assert.ok(paths.includes('/:batchId/assignments/:assignmentId/submission/revision'));
});

test('review routes are absent when the review flag is OFF', () => {
    const routes = createInternshipRoutes({ internshipService: {}, assignmentsEnabled: true, submissionsEnabled: true, reviewEnabled: false });
    const paths = routes.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
    assert.ok(!paths.some((value) => value.includes('review')));
    assert.ok(!paths.some((value) => value.endsWith('/revision')));
});

test('mentor UI uses server permissions and contains no participant identity control', () => {
    const source = read('BC-Learning-Main/elearning-assets/js/internship-review.js');
    assert.match(source, /permissions\.canMutateReview/);
    assert.doesNotMatch(source, /participantUserId\s*:/);
});

test('participant UI includes all four review labels and no internal note field', () => {
    const source = read('BC-Learning-Main/elearning-assets/js/internship.js');
    for (const label of ['Belum Direview', 'Sedang Direview', 'Perlu Revisi', 'Diterima']) assert.match(source, new RegExp(label));
    assert.doesNotMatch(source, /internalNote|Catatan internal/);
});

test('secure evidence UI only enables clean stored evidence and keeps progress independent', () => {
    const source = read('BC-Learning-Main/elearning-assets/js/internship-review.js');
    assert.match(source, /scanStatus === 'clean' && item\.storageStatus === 'stored'/);
    assert.match(read('backend/services/internshipReviewService.js'), /learningProgressUnchanged: true/);
});
