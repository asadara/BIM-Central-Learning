'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const { createInternshipReviewService } = require('../services/internshipReviewService');
const { createInternshipEvidenceService } = require('../services/internshipEvidenceService');
const { createInternshipRepository } = require('../repositories/internshipRepository');
const { createInternshipRoutes } = require('../routes/internshipRoutes');

const EVIDENCE_ID = '11111111-1111-4111-8111-111111111111';
const CLEAN_EVIDENCE_ID = '22222222-2222-4222-8222-222222222222';

function fixtureRepository() {
    const reviews = new Map();
    const scores = new Map();
    const comments = new Map();
    const submissions = new Map([
        ['sub-one', { submissionId: 'sub-one', assignmentId: 'task-one', submissionStatus: 'submitted', submissionRevision: 1,
            submittedAt: '2026-09-25T03:00:00.000Z', participantUserId: 1, participantDisplayName: 'Participant One',
            assignmentTitle: 'Federated Model Review' }],
        ['sub-draft', { submissionId: 'sub-draft', assignmentId: 'task-one', submissionStatus: 'draft', submissionRevision: 1,
            participantUserId: 1, participantDisplayName: 'Participant One', assignmentTitle: 'Federated Model Review' }],
        ['sub-revision', { submissionId: 'sub-revision', assignmentId: 'task-one', submissionStatus: 'submitted', submissionRevision: 1,
            participantUserId: 1, participantDisplayName: 'Participant One', assignmentTitle: 'Federated Model Review' }]
    ]);
    const criteria = [
        { criterionId: 'criterion-quality', title: 'Model Quality', maxScore: 5, weight: 1, required: true, displayOrder: 1 },
        { criterionId: 'criterion-docs', title: 'Documentation', maxScore: 5, weight: 1, required: false, displayOrder: 2 }
    ];
    let sequence = 0;

    function context(batchId, userId) {
        if (batchId !== 'batch-a') return null;
        const roles = { 1: 'participant', 2: 'mentor', 4: 'reviewer', 5: 'hc_observer', 6: 'admin', 8: 'mentor' };
        return {
            id: batchId,
            programType: 'internship',
            role: roles[userId] || null,
            enrollmentStatus: roles[userId] ? 'active' : null,
            policy: { review: { allowReviewerRole: true, allowObserverRead: false, requireAllCriteria: true } }
        };
    }

    function key(submissionId, revision = 1) { return `${submissionId}:${revision}`; }

    const repository = {
        reviews,
        scores,
        comments,
        criteria,
        submissions,
        async getBatchContext(batchId, userId) { return context(batchId, userId); },
        async listReviewQueue(batchId) {
            if (batchId !== 'batch-a') return [];
            return [...submissions.values()].filter((row) => row.submissionStatus === 'submitted').map((row) => ({
                ...row,
                reviewState: reviews.get(key(row.submissionId))?.state || 'not_started'
            }));
        },
        async getReviewSubmission(batchId, submissionId) {
            if (batchId !== 'batch-a') return null;
            const target = submissions.get(submissionId);
            if (!target) return null;
            return { ...target, review: reviews.get(key(submissionId, target.submissionRevision)) || null };
        },
        async listReviewCriteria(batchId, assignmentId) {
            return batchId === 'batch-a' && assignmentId === 'task-one' ? criteria.map((item) => ({ ...item })) : [];
        },
        async listReviewEvidence(batchId, submissionId, revision) {
            if (batchId !== 'batch-a' || !submissions.has(submissionId) || revision !== 1) return [];
            return [
                { evidenceId: EVIDENCE_ID, submissionId, safeDisplayName: 'pending.pdf', mimeType: 'application/pdf',
                    sizeBytes: 10, scanStatus: 'pending', storageStatus: 'quarantined' },
                { evidenceId: CLEAN_EVIDENCE_ID, submissionId, safeDisplayName: 'clean.pdf', mimeType: 'application/pdf',
                    sizeBytes: 5, scanStatus: 'clean', storageStatus: 'stored' }
            ];
        },
        async getReviewEvidenceRecord(batchId, submissionId, revision, evidenceId) {
            if (batchId !== 'batch-a' || submissionId !== 'sub-one' || revision !== 1) return null;
            if (evidenceId === EVIDENCE_ID) return {
                evidenceId, submissionId, safeDisplayName: 'pending.pdf', mimeType: 'application/pdf',
                scanStatus: 'pending', storageStatus: 'quarantined', storageKey: 'pending-key'
            };
            if (evidenceId === CLEAN_EVIDENCE_ID) return {
                evidenceId, submissionId, safeDisplayName: 'clean.pdf', mimeType: 'application/pdf',
                scanStatus: 'clean', storageStatus: 'stored', storageKey: 'clean-key'
            };
            return null;
        },
        async getParticipantReviewSubmission(batchId, assignmentId, userId) {
            if (batchId !== 'batch-a' || assignmentId !== 'task-one' || userId !== 1) return null;
            return { id: 'sub-one', submissionRevision: 1, status: 'submitted' };
        },
        async getSubmissionReview(submissionId, revision) { return reviews.get(key(submissionId, revision)) || null; },
        async listReviewScores(submissionId, revision) { return [...(scores.get(key(submissionId, revision)) || new Map()).values()]; },
        async listReviewComments(submissionId, revision, includeInternal) {
            return (comments.get(key(submissionId, revision)) || []).filter((item) => includeInternal || item.visibility === 'participant');
        },
        async startSubmissionReview(input) {
            const reviewKey = key(input.submissionId, input.submissionRevision);
            const existing = reviews.get(reviewKey);
            if (existing) {
                if (existing.state !== 'under_review') return { outcome: 'terminal', review: existing };
                return { outcome: existing.reviewerUserId === input.reviewerUserId ? 'existing' : 'claimed', review: existing };
            }
            const review = {
                reviewId: `review-${++sequence}`, state: 'under_review', decision: null,
                reviewerUserId: input.reviewerUserId, submissionRevision: input.submissionRevision,
                reviewVersion: 1, participantFeedback: '', internalNote: '', startedAt: new Date().toISOString()
            };
            reviews.set(reviewKey, review);
            return { outcome: 'started', review };
        },
        async saveSubmissionReview(input) {
            const reviewKey = key(input.submissionId, input.submissionRevision);
            const review = reviews.get(reviewKey);
            if (!review || review.reviewVersion !== input.expectedVersion) return { outcome: 'stale', review };
            if (review.state !== 'under_review') return { outcome: 'terminal', review };
            if (review.reviewerUserId !== input.reviewerUserId) return { outcome: 'not_owner', review };
            const scoreMap = scores.get(reviewKey) || new Map();
            input.scores.forEach((item) => scoreMap.set(item.criterionId, { ...item, updatedAt: new Date().toISOString() }));
            scores.set(reviewKey, scoreMap);
            const feedbackRows = comments.get(reviewKey) || [];
            if (input.participantFeedbackPresent) {
                review.participantFeedback = input.participantFeedback;
                feedbackRows.push({ visibility: 'participant', body: input.participantFeedback, createdAt: new Date().toISOString() });
            }
            if (input.internalNotePresent) {
                review.internalNote = input.internalNote;
                feedbackRows.push({ visibility: 'internal', body: input.internalNote, createdAt: new Date().toISOString() });
            }
            comments.set(reviewKey, feedbackRows);
            review.reviewVersion += 1;
            return { outcome: 'updated', review };
        },
        async decideSubmissionReview(input) {
            const review = reviews.get(key(input.submissionId, input.submissionRevision));
            if (!review || review.reviewVersion !== input.expectedVersion) return { outcome: 'stale', review };
            if (review.state !== 'under_review') return { outcome: 'terminal', review };
            if (review.reviewerUserId !== input.reviewerUserId) return { outcome: 'not_owner', review };
            review.state = input.decision;
            review.decision = input.decision;
            review.decidedAt = new Date().toISOString();
            review.reviewVersion += 1;
            return { outcome: 'decided', review };
        }
    };
    return repository;
}

function fixture() {
    const repository = fixtureRepository();
    const evidenceService = createInternshipEvidenceService({
        storage: {
            async putQuarantined() { return 'pending-key'; },
            async discard() {},
            async read(storageKey) {
                assert.equal(storageKey, 'clean-key');
                return Buffer.from('clean');
            }
        }
    });
    return { repository, service: createInternshipReviewService({ repository, evidenceService }) };
}

const actor = (id, isAdmin = false) => ({ id, sub: String(id), isAdmin });

test('review queue is minimal, submitted-only, and authorized by batch role', async () => {
    const { service } = fixture();
    const result = await service.listReviewQueue('batch-a', actor(2));
    assert.equal(result.data.length, 2);
    assert.deepEqual(Object.keys(result.data[0]), ['submissionId', 'participant', 'assignment', 'submittedAt', 'reviewState', 'revisionNo']);
    assert.equal(result.data.some((row) => row.submissionId === 'sub-draft'), false);
    await assert.rejects(service.listReviewQueue('batch-a', actor(1)), (error) => error.code === 'REVIEW_ACCESS_DENIED');
    await assert.rejects(service.listReviewQueue('batch-a', actor(3)), (error) => error.code === 'REVIEW_SCOPE_NOT_FOUND');
    await assert.rejects(service.listReviewQueue('batch-a', actor(5)), (error) => error.code === 'REVIEW_ACCESS_DENIED');
});

test('mentor, scoped reviewer, batch admin, and system admin follow explicit authorization', async () => {
    for (const principal of [actor(2), actor(4), actor(6), actor(9, true)]) {
        const { service } = fixture();
        const result = await service.startReview('batch-a', 'sub-one', principal);
        assert.equal(result.review.state, 'under_review');
    }
});

test('participant and observer cannot create, score, or decide a review', async () => {
    for (const principal of [actor(1), actor(5)]) {
        const { service } = fixture();
        await assert.rejects(service.startReview('batch-a', 'sub-one', principal), (error) => error.code === 'REVIEW_ACCESS_DENIED');
        await assert.rejects(service.saveReview('batch-a', 'sub-one', principal, { reviewVersion: 1, scores: [] }),
            (error) => error.code === 'REVIEW_ACCESS_DENIED');
        await assert.rejects(service.makeDecision('batch-a', 'sub-one', principal, { reviewVersion: 1, decision: 'accepted' }),
            (error) => error.code === 'REVIEW_ACCESS_DENIED');
    }
});

test('only submitted revisions may enter review and wrong IDs fail closed', async () => {
    const { service } = fixture();
    await assert.rejects(service.startReview('batch-a', 'sub-draft', actor(2)),
        (error) => error.code === 'REVIEW_SUBMISSION_NOT_SUBMITTED');
    await assert.rejects(service.startReview('batch-a', 'missing', actor(2)),
        (error) => error.code === 'REVIEW_SUBMISSION_NOT_FOUND');
    await assert.rejects(service.startReview('batch-b', 'sub-one', actor(2)),
        (error) => error.code === 'REVIEW_SCOPE_NOT_FOUND');
});

test('first reviewer claim wins and a second mentor cannot overwrite it', async () => {
    const { service } = fixture();
    await service.startReview('batch-a', 'sub-one', actor(2));
    await assert.rejects(service.startReview('batch-a', 'sub-one', actor(8)),
        (error) => error.code === 'REVIEW_ALREADY_CLAIMED');
    await assert.rejects(service.saveReview('batch-a', 'sub-one', actor(8), { reviewVersion: 1, scores: [] }),
        (error) => error.code === 'REVIEW_ALREADY_CLAIMED');
});

test('rubric scores validate assignment scope, range, and duplicates', async () => {
    const { service } = fixture();
    await service.startReview('batch-a', 'sub-one', actor(2));
    await assert.rejects(service.saveReview('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1, scores: [{ criterionId: 'other-assignment', score: 4 }]
    }), (error) => error.code === 'REVIEW_CRITERION_INVALID');
    await assert.rejects(service.saveReview('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1, scores: [{ criterionId: 'criterion-quality', score: 6 }]
    }), (error) => error.code === 'REVIEW_SCORE_OUT_OF_RANGE');
    await assert.rejects(service.saveReview('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1,
        scores: [{ criterionId: 'criterion-quality', score: 4 }, { criterionId: 'criterion-quality', score: 5 }]
    }), (error) => error.code === 'REVIEW_SCORE_DUPLICATE');
});

test('optimistic reviewVersion prevents stale score and feedback updates', async () => {
    const { service } = fixture();
    await service.startReview('batch-a', 'sub-one', actor(2));
    const updated = await service.saveReview('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1,
        scores: [{ criterionId: 'criterion-quality', score: 4, comment: 'Good' }],
        participantFeedback: 'Periksa dokumentasi.',
        internalNote: 'Calibration note.'
    });
    assert.equal(updated.review.reviewVersion, 2);
    await assert.rejects(service.saveReview('batch-a', 'sub-one', actor(2), { reviewVersion: 1, scores: [] }),
        (error) => error.code === 'REVIEW_VERSION_CONFLICT');
});

test('required rubric scores block decision and decision remains explicit', async () => {
    const { service } = fixture();
    await service.startReview('batch-a', 'sub-one', actor(2));
    await assert.rejects(service.makeDecision('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1, decision: 'accepted'
    }), (error) => error.code === 'REVIEW_REQUIRED_SCORES_MISSING');
    const saved = await service.saveReview('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1, scores: [{ criterionId: 'criterion-quality', score: 5 }]
    });
    const decided = await service.makeDecision('batch-a', 'sub-one', actor(2), {
        reviewVersion: saved.review.reviewVersion, decision: 'accepted'
    });
    assert.equal(decided.review.state, 'accepted');
    assert.equal(decided.review.decision, 'accepted');
});

test('accepted and revision_requested decisions are terminal in Phase 3A', async () => {
    for (const [submissionId, decision] of [['sub-one', 'accepted'], ['sub-revision', 'revision_requested']]) {
        const { service } = fixture();
        await service.startReview('batch-a', submissionId, actor(2));
        const saved = await service.saveReview('batch-a', submissionId, actor(2), {
            reviewVersion: 1, scores: [{ criterionId: 'criterion-quality', score: 4 }]
        });
        const decided = await service.makeDecision('batch-a', submissionId, actor(2), {
            reviewVersion: saved.review.reviewVersion, decision
        });
        await assert.rejects(service.startReview('batch-a', submissionId, actor(2)),
            (error) => error.code === 'REVIEW_STATE_CONFLICT');
        await assert.rejects(service.makeDecision('batch-a', submissionId, actor(2), {
            reviewVersion: decided.review.reviewVersion,
            decision: decision === 'accepted' ? 'revision_requested' : 'accepted'
        }), (error) => error.code === 'REVIEW_STATE_CONFLICT');
    }
});

test('participant DTO exposes decided feedback but never internal note or internal history', async () => {
    const { service } = fixture();
    await service.startReview('batch-a', 'sub-one', actor(2));
    const saved = await service.saveReview('batch-a', 'sub-one', actor(2), {
        reviewVersion: 1,
        scores: [{ criterionId: 'criterion-quality', score: 4, comment: 'mentor-only criterion note' }],
        participantFeedback: 'Please revise the issue summary.',
        internalNote: 'Do not disclose this note.'
    });
    await service.makeDecision('batch-a', 'sub-one', actor(2), {
        reviewVersion: saved.review.reviewVersion, decision: 'revision_requested'
    });
    const result = await service.getParticipantReview('batch-a', 'task-one', actor(1));
    const serialized = JSON.stringify(result);
    assert.equal(result.review.participantFeedback, 'Please revise the issue summary.');
    assert.doesNotMatch(serialized, /Do not disclose|internalNote|mentor-only criterion note/);
});

test('review detail exposes safe metadata only and keeps learning progress independent', async () => {
    const { service } = fixture();
    const result = await service.getReviewDetail('batch-a', 'sub-one', actor(2));
    const serialized = JSON.stringify(result);
    assert.equal(result.learningProgressUnchanged, true);
    assert.equal(result.submission.revisionNo, 1);
    assert.doesNotMatch(serialized, /storageKey|filePath|externalUrl|sha256|\\\\|[A-Z]:\\/);
});

test('reviewer evidence access is scoped and pending quarantine is never bypassed', async () => {
    const { service } = fixture();
    await assert.rejects(service.getReviewerEvidence('batch-a', 'sub-one', EVIDENCE_ID, actor(2)),
        (error) => error.code === 'EVIDENCE_NOT_RELEASED' && error.status === 423);
    const clean = await service.getReviewerEvidence('batch-a', 'sub-one', CLEAN_EVIDENCE_ID, actor(2));
    assert.equal(clean.content.toString(), 'clean');
    assert.equal(clean.safeDisplayName, 'clean.pdf');
    assert.equal(Object.hasOwn(clean, 'storageKey'), false);
    await assert.rejects(service.getReviewerEvidence('batch-a', 'sub-one', '33333333-3333-4333-8333-333333333333', actor(2)),
        (error) => error.code === 'REVIEW_EVIDENCE_NOT_FOUND');
    await assert.rejects(service.getReviewerEvidence('batch-a', 'sub-revision', CLEAN_EVIDENCE_ID, actor(2)),
        (error) => error.code === 'REVIEW_EVIDENCE_NOT_FOUND');
    await assert.rejects(service.getReviewerEvidence('batch-b', 'sub-one', CLEAN_EVIDENCE_ID, actor(2)),
        (error) => error.code === 'REVIEW_SCOPE_NOT_FOUND');
});

function appFor(reviewService, reviewEnabled = true) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.authChecked = true;
        req.authPrincipal = req.headers.authorization
            ? actor(Number(req.headers['x-test-user'] || 2)) : null;
        next();
    });
    app.use('/api/training/internships', createInternshipRoutes({
        internshipService: {}, reviewService, assignmentsEnabled: true,
        submissionsEnabled: true, reviewEnabled
    }));
    return app;
}

async function request(base, route, { method = 'GET', user = 2, body } = {}) {
    const options = { method, headers: { Authorization: 'Bearer fixture', 'X-Test-User': String(user) } };
    if (body !== undefined) {
        options.body = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${base}${route}`, options);
    const text = await response.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (_) { payload = text; }
    return { response, payload };
}

test('review routes are flag-gated and reject client-supplied reviewer identity', async () => {
    const { service } = fixture();
    const disabled = appFor(service, false).listen(0);
    const enabled = appFor(service, true).listen(0);
    try {
        const disabledBase = `http://127.0.0.1:${disabled.address().port}`;
        const enabledBase = `http://127.0.0.1:${enabled.address().port}`;
        const off = await request(disabledBase, '/api/training/internships/batch-a/review-queue');
        assert.equal(off.response.status, 404);
        const injected = await request(enabledBase, '/api/training/internships/batch-a/submissions/sub-one/review/start', {
            method: 'POST', body: { reviewer_user_id: 8 }
        });
        assert.equal(injected.response.status, 400);
        assert.equal(injected.payload.code, 'REVIEWER_ID_NOT_ALLOWED');
        const participantInjected = await request(enabledBase, '/api/training/internships/batch-a/submissions/sub-one/review/start', {
            method: 'POST', body: { participant_user_id: 99 }
        });
        assert.equal(participantInjected.response.status, 400);
        assert.equal(participantInjected.payload.code, 'AUTHORITATIVE_ID_NOT_ALLOWED');
    } finally {
        await new Promise((resolve) => disabled.close(resolve));
        await new Promise((resolve) => enabled.close(resolve));
    }
});

test('Phase 3A migration reuses generic review tables and adds revision, lifecycle, audit, and rollback', () => {
    const migration = fs.readFileSync(path.join(__dirname, '../scripts/20260925-internship-phase3a.sql'), 'utf8');
    const rollback = fs.readFileSync(path.join(__dirname, '../scripts/20260925-internship-phase3a-rollback.sql'), 'utf8');
    assert.match(migration, /ALTER TABLE review_criteria/);
    assert.match(migration, /ALTER TABLE review_scores/);
    assert.match(migration, /ALTER TABLE submission_comments/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS submission_reviews/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS submission_review_history/);
    assert.match(migration, /submission_revision/);
    assert.match(migration, /review_version/);
    assert.doesNotMatch(migration, /internship_reviews|CREATE TABLE[^;]*internship_/i);
    assert.match(rollback, /DROP TABLE IF EXISTS submission_review_history/);
    assert.match(rollback, /DROP TABLE IF EXISTS submission_reviews/);
});

test('feature flag defaults OFF and no mentor or participant Phase 3 UI is added', () => {
    const envExample = fs.readFileSync(path.join(__dirname, '../../.env.example'), 'utf8');
    const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    const participantHtml = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/internship.html'), 'utf8');
    assert.match(envExample, /INTERNSHIP_REVIEW_ENABLED=false/);
    assert.match(server, /INTERNSHIP_REVIEW_ENABLED/);
    assert.doesNotMatch(participantHtml, /Sedang Direview|Perlu Revisi|Diterima|internalNote/);
});

test('Phase 2B participant submission reads do not require Phase 3A revision columns while review is OFF', async () => {
    const queries = [];
    const repository = createInternshipRepository({
        pgPool: {
            async query(sql) {
                queries.push(String(sql));
                return { rows: [] };
            }
        }
    });
    await repository.getParticipantSubmission('batch-a', 'task-one', 1);
    await repository.listSubmissionEvidence('batch-a', 'task-one', 'sub-one', 1);
    assert.equal(queries.length, 2);
    assert.doesNotMatch(queries.join('\n'), /submission_revision/);
});
