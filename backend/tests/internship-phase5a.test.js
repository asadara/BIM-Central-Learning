'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
    digestManifest,
    validateManifest,
    toPolicyPayload
} = require('../services/internshipPilotManifestValidator');
const { createInternshipProgramProgressService } = require('../services/internshipProgramProgressService');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'backend', 'elearning', 'data', 'internship-pilot-manifest-v1.json');

function read(relative) {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function frozenManifest() {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function refresh(manifest) {
    manifest.integrity.digest = digestManifest(manifest);
    return manifest;
}

function executableManifest() {
    const manifest = frozenManifest();
    manifest.program.startDate = '2026-10-01';
    manifest.program.endDate = '2026-12-31';
    manifest.roles.participant.canonicalUserId = 101;
    manifest.roles.mentor.canonicalUserId = 102;
    manifest.assignments = [{
        assignmentId: 'pilot-task-1',
        title: 'Pilot improvement brief',
        requirement: 'required',
        required: true,
        instructionsReady: true,
        assignmentValid: true,
        requiredDeliverable: 'PDF improvement report',
        rubricReadiness: 'rubric_ready',
        evidenceFormats: ['pdf'],
        definitionDigest: 'md5:pilot-task-1'
    }];
    return refresh(manifest);
}

function validSnapshot(manifest = executableManifest()) {
    return {
        batch: { id: manifest.program.batchId, programType: 'internship' },
        learningPath: { versionId: manifest.learningPath.versionId, status: 'published' },
        policy: {
            id: manifest.policy.policyVersionId,
            status: 'frozen',
            manifestVersion: manifest.manifestVersion,
            manifestDigest: manifest.integrity.digest
        },
        contents: [{ contentId: 'page:bim-mindset', contentStatus: 'active', mappingStatus: 'approved', resolved: true }],
        assignments: [{ assignmentId: 'pilot-task-1', batchId: manifest.program.batchId }]
    };
}

function evaluatorFixture() {
    const assignmentRows = [
        { assignmentId: 'required-task', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible', definitionDigest: 'md5:req', submissionId: 's1', revisionCount: 3, submissionState: 'submitted', reviewState: 'accepted', reviewDecision: 'accepted' },
        { assignmentId: 'optional-task', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible', definitionDigest: 'md5:opt', submissionId: null, revisionCount: 0 },
        { assignmentId: 'generic-visible-task', assignmentExists: true, assignmentStatus: 'published', participantVisibility: 'visible', definitionDigest: 'md5:generic', submissionId: null, revisionCount: 0 }
    ];
    const repository = {
        async getProgramProgressContext() {
            return {
                id: 'int-bim-2026-pilot', code: 'INT-BIM-2026-PILOT', title: 'Pilot', programType: 'internship',
                participantRole: 'participant', participantEnrollmentStatus: 'active', participantDisplayName: 'Participant',
                actorRole: 'participant', actorEnrollmentStatus: 'active', learningPathVersionId: 'path-v1',
                learningPathDefinition: { assessments: [] }, policyVersionId: 'policy-v1', policyStatus: 'frozen',
                policyChecksumValid: true, policyPayload: {
                    contractVersion: 'internship-completion-v1', learningPathVersionId: 'path-v1',
                    assignments: [
                        { assignmentId: 'required-task', requirementType: 'required', label: 'Required', definitionDigest: 'md5:req' },
                        { assignmentId: 'optional-task', requirementType: 'optional', label: 'Optional', definitionDigest: 'md5:opt' }
                    ]
                }
            };
        },
        async getPathModules() {
            return [{ moduleKey: 'foundation', status: 'active', items: [
                { contentId: 'required-learning', requirementType: 'required', mappingStatus: 'approved', contentStatus: 'active', sourceType: 'page', sourceId: 'required', completionRule: { activity: { moduleType: 'page', moduleId: 'required' } } },
                { contentId: 'optional-learning', requirementType: 'optional', mappingStatus: 'approved', contentStatus: 'active', sourceType: 'page', sourceId: 'optional', completionRule: {} }
            ] }];
        },
        async getCompletedActivityEvidence() { return [{ moduleType: 'page', moduleId: 'required' }]; },
        async getVerifiedQuizEvidence() { return []; },
        async listProgramAssignmentStates(_batchId, _userId, requestedIds) {
            return assignmentRows.filter((item) => requestedIds.includes(item.assignmentId));
        }
    };
    return createInternshipProgramProgressService({ repository });
}

test('visible published practice_task is not automatically required', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.assignments.push({ assignmentId: 'visible-generic', batchId: manifest.program.batchId, status: 'published' });
    const result = validateManifest(manifest, snapshot);
    assert.equal(result.summary.requiredAssignments, 1);
    assert.ok(result.warnings.some((item) => item.code === 'unclassified_assignments_ignored'));
});

test('closed practice_task is not automatically required', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.assignments.push({ assignmentId: 'closed-generic', batchId: manifest.program.batchId, status: 'closed' });
    assert.equal(validateManifest(manifest, snapshot).summary.requiredAssignments, 1);
});

test('explicitly required assignment enters the policy denominator', () => {
    const policy = toPolicyPayload(executableManifest());
    assert.deepEqual(policy.assignments.map((item) => item.assignmentId), ['pilot-task-1']);
    assert.equal(policy.assignments[0].requirementType, 'required');
});

test('optional assignment does not enter required summary', () => {
    const manifest = executableManifest();
    manifest.assignments.push({ assignmentId: 'optional-task', title: 'Optional', requirement: 'optional', definitionDigest: 'md5:optional' });
    refresh(manifest);
    const result = validateManifest(manifest, { ...validSnapshot(manifest), assignments: [
        { assignmentId: 'pilot-task-1', batchId: manifest.program.batchId },
        { assignmentId: 'optional-task', batchId: manifest.program.batchId }
    ] });
    assert.equal(result.summary.requiredAssignments, 1);
    assert.equal(result.summary.optionalAssignments, 1);
});

test('excluded assignment is omitted from evaluator policy payload', () => {
    const manifest = executableManifest();
    manifest.assignments.push({ assignmentId: 'excluded-task', title: 'Excluded', requirement: 'exclude' });
    refresh(manifest);
    assert.deepEqual(toPolicyPayload(manifest).assignments.map((item) => item.assignmentId), ['pilot-task-1']);
});

test('optional learning does not enter required summary', () => {
    const manifest = executableManifest();
    manifest.learning.push({ contentId: 'optional-content', requirement: 'optional' });
    refresh(manifest);
    const result = validateManifest(manifest, validSnapshot(manifest));
    assert.equal(result.summary.requiredLearning, 1);
    assert.equal(result.summary.optionalLearning, 1);
});

test('required learning enters required summary', () => {
    assert.equal(validateManifest(executableManifest(), validSnapshot()).summary.requiredLearning, 1);
});

test('invalid required content produces an integrity blocker', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.contents = [];
    const result = validateManifest(manifest, snapshot);
    assert.equal(result.readiness, 'BLOCKED');
    assert.ok(result.errors.some((item) => item.code === 'required_content_unresolved'));
});

test('invalid required assignment produces an integrity blocker', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.assignments = [];
    assert.ok(validateManifest(manifest, snapshot).errors.some((item) => item.code === 'required_assignment_unresolved'));
});

test('duplicate manifest entry is rejected', () => {
    const manifest = executableManifest();
    manifest.learning.push({ ...manifest.learning[0] });
    refresh(manifest);
    assert.ok(validateManifest(manifest, validSnapshot(manifest)).errors.some((item) => item.code === 'duplicate_learning_requirement'));
});

test('unresolved canonical content is rejected', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.contents[0].resolved = false;
    assert.ok(validateManifest(manifest, snapshot).errors.some((item) => item.code === 'required_content_unresolved'));
});

test('wrong-batch assignment is rejected', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.assignments[0].batchId = 'other-batch';
    assert.ok(validateManifest(manifest, snapshot).errors.some((item) => item.code === 'required_assignment_wrong_batch'));
});

test('policy version mismatch is rejected', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.policy.id = 'other-policy';
    assert.ok(validateManifest(manifest, snapshot).errors.some((item) => item.code === 'policy_version_mismatch'));
});

test('learning-path version mismatch is rejected', () => {
    const manifest = executableManifest();
    const snapshot = validSnapshot(manifest);
    snapshot.learningPath.versionId = 'other-path';
    assert.ok(validateManifest(manifest, snapshot).errors.some((item) => item.code === 'learning_path_version_mismatch'));
});

test('frozen manifest detects accidental mutation through digest', () => {
    const manifest = frozenManifest();
    assert.equal(digestManifest(manifest), manifest.integrity.digest);
    manifest.program.programTitle = 'Silently changed';
    assert.ok(validateManifest(manifest).errors.some((item) => item.code === 'manifest_digest_invalid'));
});

test('Phase 4B evaluator counts only required manifest items', async () => {
    const result = await evaluatorFixture().getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.deepEqual(result.dimensions.learning.required, { total: 1, completed: 1, remaining: 0 });
    assert.deepEqual(result.dimensions.submitted.required, { total: 1, completed: 1, remaining: 0 });
    assert.deepEqual(result.dimensions.accepted.required, { total: 1, completed: 1, remaining: 0 });
    assert.equal(result.requirementsMet, true);
});

test('optional and extra generic classwork do not affect requirements_met', async () => {
    const result = await evaluatorFixture().getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.equal(result.dimensions.submitted.optional.total, 1);
    assert.equal(result.dimensions.submitted.optional.completed, 0);
    assert.equal(result.assignments.required, 1);
    assert.equal(result.requirementsMet, true);
});

test('historical revisions remain outside denominator while latest accepted revision controls', async () => {
    const result = await evaluatorFixture().getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.equal(result.assignments.required, 1);
    assert.equal(result.revisionCount, 2);
    assert.equal(result.assignments.accepted, 1);
});

test('bootstrap migration never infers required assignments from classwork state', () => {
    const migration = read('backend/scripts/20260925-internship-phase4b.sql');
    const configure = read('backend/scripts/configure-internship-batch.js');
    assert.doesNotMatch(migration, /FROM classwork_items ci/);
    assert.match(migration, /explicit_assignment_manifest_required/);
    assert.match(configure, /assignmentAuthority: 'frozen-manifest-only'/);
    assert.doesNotMatch(configure, /requirementType:\s*'required'[\s\S]*assignmentRows\.map/);
});

test('audited v1 output is structurally frozen but blocked by the real missing assignment decision', () => {
    const manifest = frozenManifest();
    const snapshot = {
        learningPath: { versionId: manifest.learningPath.versionId, status: 'published' },
        contents: [{ contentId: 'page:bim-mindset', contentStatus: 'active', mappingStatus: 'approved', resolved: true }],
        assignments: []
    };
    const result = validateManifest(manifest, snapshot);
    assert.equal(result.valid, false);
    assert.equal(result.readiness, 'BLOCKED');
    assert.deepEqual(result.summary, {
        requiredLearning: 1, optionalLearning: 0, excludedLearning: 0,
        requiredQuizzes: 0, optionalQuizzes: 0, excludedQuizzes: 0,
        requiredAssignments: 0, optionalAssignments: 0, excludedAssignments: 1
    });
});
