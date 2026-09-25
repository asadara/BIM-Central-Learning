'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createInternshipProgramProgressService } = require('../services/internshipProgramProgressService');
const { createInternshipRoutes } = require('../routes/internshipRoutes');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function fixture(overrides = {}) {
    const context = {
        id: 'batch-a', code: 'INT-A', title: 'Internship A', programType: 'internship', status: 'active',
        actorRole: 'participant', actorEnrollmentStatus: 'active', participantRole: 'participant',
        participantEnrollmentStatus: 'active', participantDisplayName: 'Ayu', learningPathVersionId: 'path-v1',
        learningPathDefinition: { assessments: [{ quizId: 'quiz-a', moduleKey: 'module-a', required: true, status: 'published' }] },
        policyVersionId: 'policy-a-v1', policyStatus: 'frozen', policyChecksumValid: true,
        policyPayload: {
            contractVersion: 'internship-completion-v1', learningPathVersionId: 'path-v1',
            review: { allowReviewerRole: true, allowObserverRead: true },
            assignments: [{ assignmentId: 'task-a', requirementType: 'required', label: 'Task A', definitionDigest: 'md5:task-a' }]
        },
        closeoutId: null, endDate: '2099-12-31'
    };
    const state = {
        context: { ...context, ...(overrides.context || {}) },
        modules: overrides.modules || [{
            moduleKey: 'module-a', status: 'active', items: [{
                contentId: 'content-a', sourceType: 'page', sourceId: 'page-a', requirementType: 'required',
                mappingStatus: 'approved', contentStatus: 'active', completionRule: { activity: { moduleType: 'page', moduleId: 'page-a' } }
            }]
        }],
        activities: overrides.activities === undefined ? [{ moduleType: 'page', moduleId: 'page-a' }] : overrides.activities,
        quizzes: overrides.quizzes === undefined ? [{ quizId: 'quiz-a' }] : overrides.quizzes,
        assignments: overrides.assignments || [{
            assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published',
            participantVisibility: 'visible', definitionDigest: 'md5:task-a', submissionId: 'sub-a',
            revisionNo: 1, revisionCount: 1, submissionState: 'submitted', reviewState: 'accepted', reviewDecision: 'accepted'
        }]
    };
    const repository = {
        async getProgramProgressContext(_batch, actorId) {
            return {
                ...state.context,
                actorRole: actorId === 1 ? state.context.actorRole
                    : (Object.hasOwn(overrides, 'staffRole') ? overrides.staffRole : 'mentor')
            };
        },
        async getPathModules() { return state.modules; },
        async getCompletedActivityEvidence() { return state.activities; },
        async getVerifiedQuizEvidence() { return state.quizzes; },
        async listProgramAssignmentStates() { return state.assignments; },
        async listProgramParticipants() { return [{ userId: 1, displayName: 'Ayu' }]; },
        async withTransaction(operation) { return operation({ query() {} }); },
        async createProgramCloseout(_client, input) {
            if (state.context.closeoutId) return { created: false, closeout: { id: state.context.closeoutId } };
            state.context.closeoutId = 'closeout-a';
            state.context.completedAt = '2026-09-25T10:00:00.000Z';
            state.context.completedByDisplayName = 'Mentor';
            state.context.closeoutNote = input.closeoutNote;
            return { created: true, closeout: { id: 'closeout-a' } };
        }
    };
    return { repository, service: createInternshipProgramProgressService({ repository }), state };
}

test('evaluator derives requirements_met from required learning, quiz, and accepted current assignment', async () => {
    const result = await fixture().service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.status, 'requirements_met');
    assert.equal(result.requirementsMet, true);
    assert.deepEqual(result.dimensions.learning.required, { total: 2, completed: 2, remaining: 0 });
    assert.deepEqual(result.dimensions.submitted.required, { total: 1, completed: 1, remaining: 0 });
    assert.deepEqual(result.dimensions.accepted.required, { total: 1, completed: 1, remaining: 0 });
});

test('learning, submitted, and accepted remain separate dimensions with no combined percentage', async () => {
    const result = await fixture({ assignments: [{
        assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible',
        definitionDigest: 'md5:task-a', submissionId: 'sub-a', revisionCount: 1,
        submissionState: 'submitted', reviewState: 'under_review', reviewDecision: null
    }] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.dimensions.submitted.required.completed, 1);
    assert.equal(result.dimensions.accepted.required.completed, 0);
    assert.equal(result.status, 'in_progress');
    assert.equal(JSON.stringify(result).includes('percent'), false);
});

test('not_started requires zero completed learning and no assignment activity', async () => {
    const result = await fixture({ activities: [], quizzes: [], assignments: [{
        assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible',
        definitionDigest: 'md5:task-a', submissionId: null, revisionCount: 0, submissionState: null, reviewState: null
    }] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.status, 'not_started');
});

test('revision_requested current revision blocks acceptance and reports revision count', async () => {
    const result = await fixture({ assignments: [{
        assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible',
        definitionDigest: 'md5:task-a', submissionId: 'sub-a', revisionCount: 3,
        submissionState: 'submitted', reviewState: 'revision_requested', reviewDecision: 'revision_requested'
    }] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.revisionCount, 2);
    assert.ok(result.blockers.some((item) => item.code === 'required_assignment_revision_requested'));
});

test('unverified or failed quiz evidence never completes a required quiz', async () => {
    const result = await fixture({ quizzes: [] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.dimensions.learning.required.completed, 1);
    assert.equal(result.requirementsMet, false);
});

test('required learning incomplete keeps requirements unmet', async () => {
    const result = await fixture({ activities: [] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.requirementsMet, false);
    assert.ok(result.blockers.some((item) => item.code === 'required_learning_incomplete'));
});

test('learning complete with required assignment unsubmitted remains unmet', async () => {
    const result = await fixture({ assignments: [{
        assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible',
        definitionDigest: 'md5:task-a', submissionId: null, revisionCount: 0, submissionState: null, reviewState: null
    }] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.requirementsMet, false);
    assert.equal(result.assignments.notSubmitted, 1);
});

test('optional learning and optional assignment incompletion do not block requirements', async () => {
    const base = fixture();
    base.state.context.policyPayload.assignments.push({
        assignmentId: 'task-optional', requirementType: 'optional', label: 'Optional Task', definitionDigest: 'md5:optional'
    });
    base.state.modules[0].items.push({
        contentId: 'content-optional', sourceType: 'page', sourceId: 'optional', requirementType: 'optional',
        mappingStatus: 'approved', contentStatus: 'active', completionRule: {}
    });
    base.state.assignments.push({
        assignmentId: 'task-optional', assignmentExists: true, assignmentStatus: 'published',
        participantVisibility: 'visible', definitionDigest: 'md5:optional', submissionId: null,
        revisionCount: 0, submissionState: null, reviewState: null
    });
    const result = await base.service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.requirementsMet, true);
    assert.deepEqual(result.dimensions.learning.optional, { total: 1, completed: 0, remaining: 1 });
    assert.deepEqual(result.dimensions.submitted.optional, { total: 1, completed: 0, remaining: 1 });
});

test('multiple historical revisions do not inflate denominator or block latest accepted revision', async () => {
    const result = await fixture({ assignments: [{
        assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible',
        definitionDigest: 'md5:task-a', submissionId: 'sub-a', revisionNo: 2, revisionCount: 2,
        submissionState: 'submitted', reviewState: 'accepted', reviewDecision: 'accepted'
    }] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.assignments.required, 1);
    assert.equal(result.assignments.accepted, 1);
    assert.equal(result.revisionCount, 1);
    assert.equal(result.requirementsMet, true);
});

test('rubric magnitude, attendance, final evaluation, and certificate presence are ignored', async () => {
    const { service, state } = fixture();
    state.context.rubricScore = 0;
    state.context.attendancePercentage = 0;
    state.context.finalEvaluation = null;
    state.context.certificateId = 'certificate-does-not-control-status';
    const result = await service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.requirementsMet, true);
    assert.equal(result.status, 'requirements_met');
    assert.equal(result.certificateEligible, false);
});

test('high descriptive score cannot override revision_requested decision', async () => {
    const { service, state } = fixture({ assignments: [{
        assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible',
        definitionDigest: 'md5:task-a', submissionId: 'sub-a', revisionCount: 1,
        submissionState: 'submitted', reviewState: 'revision_requested', reviewDecision: 'revision_requested', score: 100
    }] });
    state.context.rubricScore = 100;
    const result = await service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.assignments.accepted, 0);
    assert.equal(result.requirementsMet, false);
});

test('required learning that becomes unavailable stays in denominator and raises integrity issue', async () => {
    const { service, state } = fixture();
    state.modules[0].items[0].contentStatus = 'retired';
    const result = await service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.dimensions.learning.required.total, 2);
    assert.equal(result.dimensions.learning.required.completed, 1);
    assert.ok(result.integrityIssues.some((item) => item.code === 'required_learning_unavailable'));
});

test('assignment deletion or definition drift is a system integrity blocker', async () => {
    for (const assignment of [
        { assignmentId: 'task-a', assignmentExists: false },
        { assignmentId: 'task-a', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible', definitionDigest: 'md5:changed' }
    ]) {
        const result = await fixture({ assignments: [assignment] }).service.getOwnStatus('batch-a', { id: 1 });
        assert.equal(result.requirementsMet, false);
        assert.ok(result.integrityIssues.length > 0);
    }
});

test('empty required assignment manifest cannot complete vacuously', async () => {
    const result = await fixture({ context: { policyPayload: {
        contractVersion: 'internship-completion-v1', learningPathVersionId: 'path-v1', assignments: []
    } } }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.requirementsMet, false);
    assert.ok(result.integrityIssues.some((item) => item.code === 'required_assignment_manifest_empty'));
});

test('elapsed program period is attention only and does not force completion or failure', async () => {
    const result = await fixture({ context: { endDate: '2020-01-01' }, quizzes: [] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.status, 'in_progress');
    assert.ok(result.blockers.some((item) => item.code === 'program_period_elapsed'));
});

test('stored closeout makes completed stable and certificate eligible', async () => {
    const result = await fixture({ context: {
        closeoutId: 'closeout-a', completedAt: '2026-09-25T10:00:00Z', completedByDisplayName: 'Mentor'
    }, activities: [], quizzes: [] }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.status, 'completed');
    assert.equal(result.certificateEligible, true);
    assert.equal(result.closeout.closeoutId, 'closeout-a');
});

test('participant can read only own status and cannot close out', async () => {
    const { service } = fixture();
    await assert.rejects(service.getParticipantStatus('batch-a', 2, { id: 1 }), (error) => error.code === 'PROGRAM_STATUS_ACCESS_DENIED');
    await assert.rejects(service.completeProgram('batch-a', 1, { id: 1 }, {}), (error) => error.code === 'PROGRAM_CLOSEOUT_ACCESS_DENIED');
});

test('non-member and wrong-batch staff fail closed', async () => {
    const nonMember = fixture({ staffRole: null });
    await assert.rejects(nonMember.service.getParticipantStatus('batch-a', 1, { id: 5 }),
        (error) => error.code === 'PROGRAM_STATUS_NOT_FOUND');
    const wrongBatch = fixture({ staffRole: 'mentor', context: { actorEnrollmentStatus: 'dropped' } });
    await assert.rejects(wrongBatch.service.getParticipantStatus('batch-a', 1, { id: 5 }),
        (error) => error.code === 'PROGRAM_STATUS_NOT_FOUND');
    await assert.rejects(wrongBatch.service.completeProgram('batch-a', 1, { id: 5 }, {}),
        (error) => error.code === 'PROGRAM_CLOSEOUT_ACCESS_DENIED');
});

test('mentor closes requirements_met in a transaction and repeated closeout is idempotent', async () => {
    const { service } = fixture();
    const first = await service.completeProgram('batch-a', 1, { id: 2 }, { closeoutNote: 'Verified.' });
    const second = await service.completeProgram('batch-a', 1, { id: 2 }, { closeoutNote: 'Ignored.' });
    assert.equal(first.status, 'completed');
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
});

test('reviewer can read when policy allows but cannot close out', async () => {
    const { service } = fixture({ staffRole: 'reviewer' });
    const result = await service.getParticipantStatus('batch-a', 1, { id: 3 });
    assert.equal(result.permissions.canCloseProgram, false);
    await assert.rejects(service.completeProgram('batch-a', 1, { id: 3 }, {}), (error) => error.code === 'PROGRAM_CLOSEOUT_ACCESS_DENIED');
});

test('reviewer read access is denied when frozen policy disables reviewer role', async () => {
    const configured = fixture({ staffRole: 'reviewer' });
    configured.state.context.policyPayload.review.allowReviewerRole = false;
    await assert.rejects(configured.service.getParticipantStatus('batch-a', 1, { id: 3 }),
        (error) => error.code === 'PROGRAM_STATUS_ACCESS_DENIED');
});

test('observer access follows frozen policy and remains read-only', async () => {
    const { service } = fixture({ staffRole: 'hc_observer' });
    const result = await service.getParticipantStatus('batch-a', 1, { id: 4 });
    assert.equal(result.permissions.canReadProgramStatus, true);
    assert.equal(result.permissions.canCloseProgram, false);
});

test('system admin can perform explicit closeout according to policy', async () => {
    const result = await fixture().service.completeProgram('batch-a', 1, { id: 99, isAdmin: true }, {});
    assert.equal(result.status, 'completed');
});

test('closeout recalculates current evidence and rejects stale requirements_met UI state', async () => {
    const configured = fixture();
    const visible = await configured.service.getParticipantStatus('batch-a', 1, { id: 2 });
    assert.equal(visible.requirementsMet, true);
    configured.state.quizzes = [];
    await assert.rejects(configured.service.completeProgram('batch-a', 1, { id: 2 }, {}),
        (error) => error.code === 'PROGRAM_REQUIREMENTS_NOT_MET');
});

test('invalid frozen policy checksum blocks completion safely', async () => {
    const result = await fixture({ context: { policyChecksumValid: false } }).service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(result.requirementsMet, false);
    assert.ok(result.integrityIssues.some((item) => item.code === 'policy_checksum_invalid'));
});

test('completion service never consumes rubric score, attendance, final evaluation, or generic batch completion', () => {
    const source = read('backend/services/internshipProgramProgressService.js');
    assert.doesNotMatch(source, /review_scores|attendance|final.?evaluation|batch_evaluations|enrollment_status\s*=\s*['"]completed/i);
});

test('Phase 4B migration freezes policy, stores append-only closeout, and provides guarded rollback', () => {
    const migration = read('backend/scripts/20260925-internship-phase4b.sql');
    const rollback = read('backend/scripts/20260925-internship-phase4b-rollback.sql');
    assert.match(migration, /internship_program_policy_versions/);
    assert.match(migration, /policy_version_id/);
    assert.match(migration, /internship_program_closeouts/);
    assert.match(migration, /internship_program_completion_audit/);
    assert.match(migration, /append-only/);
    assert.match(rollback, /rollback refused/i);
});

test('migration freezes assignment identities, requirement type, label, and definition digest', () => {
    const migration = read('backend/scripts/20260925-internship-phase4b.sql');
    for (const field of ['assignmentId', 'requirementType', 'label', 'definitionDigest']) assert.match(migration, new RegExp(field));
});

test('Phase 4B does not add a mutable progress table or certificate issuance coupling', () => {
    const migration = read('backend/scripts/20260925-internship-phase4b.sql');
    assert.doesNotMatch(migration, /CREATE TABLE[^;]*program_progress/i);
    assert.doesNotMatch(migration, /certificate_id|INSERT INTO certificates/i);
});

test('completion routes are flag-gated and include own, scoped staff, list, and closeout endpoints', () => {
    const off = createInternshipRoutes({ internshipService: {} });
    const on = createInternshipRoutes({ internshipService: {}, completionEnabled: true, progressService: {} });
    const offPaths = off.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
    const onPaths = on.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
    assert.ok(!offPaths.some((item) => item.includes('program-status')));
    for (const route of ['/:batchId/program-status', '/:batchId/participant-statuses', '/:batchId/participants/:userId/program-status', '/:batchId/participants/:userId/complete']) {
        assert.ok(onPaths.includes(route));
    }
});

test('closeout body accepts note only and rejects client-authored authority fields', () => {
    const source = read('backend/routes/internshipRoutes.js');
    assert.match(source, /CLOSEOUT_SERVER_FIELDS/);
    assert.match(source, /key !== 'closeoutNote'/);
    assert.match(source, /CLOSEOUT_AUTHORITY_NOT_ALLOWED/);
});

test('completion feature is off by default and depends on review lineage', () => {
    assert.match(read('.env.example'), /INTERNSHIP_COMPLETION_ENABLED=false/);
    assert.match(read('backend/features/internshipFeature.js'), /completionFeatureEnabled = reviewFeatureEnabled && completionEnabled === true/);
});

test('participant UI presents three independent metrics and no combined program percentage', () => {
    const source = read('BC-Learning-Main/elearning-assets/js/internship.js');
    for (const label of ['Learning', 'Submitted', 'Accepted']) assert.match(source, new RegExp(`\\['${label}'`));
    assert.doesNotMatch(source, /programStatus[^\n]*percent|combined.?percent/i);
    assert.match(read('BC-Learning-Main/elearning-assets/internship.html'), /Learning progress/);
});

test('mentor UI gates closeout on server permission and disclaims certificate issuance', () => {
    const source = read('BC-Learning-Main/elearning-assets/js/internship-review.js');
    assert.match(source, /permissions\.canCloseProgram === true/);
    assert.match(source, /Sertifikat tidak diterbitkan otomatis/);
    assert.match(source, /data-program-closeout/);
});

test('status DTO exposes eligibility only after closeout and contains no internal review notes', async () => {
    const before = await fixture().service.getOwnStatus('batch-a', { id: 1 });
    assert.equal(before.certificateEligible, false);
    assert.doesNotMatch(JSON.stringify(before), /internalNote|reviewScore|attendance/);
});
