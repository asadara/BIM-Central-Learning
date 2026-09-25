'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
    digestManifest,
    validateCandidatePackage
} = require('../services/internshipPilotManifestValidator');
const { createInternshipProgramProgressService } = require('../services/internshipProgramProgressService');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'backend', 'elearning', 'data');

function readJson(name) {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function packages() {
    return {
        manifest: readJson('internship-pilot-manifest-v2.json'),
        assignmentsPackage: readJson('internship-pilot-assignments-v1.json'),
        rubricsPackage: readJson('internship-pilot-rubrics-v1.json')
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function refresh(artifact) {
    artifact.integrity.digest = digestManifest(artifact);
    return artifact;
}

function snapshot(input = packages()) {
    return {
        contents: input.manifest.learning.filter((item) => item.requirement !== 'exclude')
            .map((item) => ({ contentId: item.contentId, status: 'active', resolved: true })),
        quizzes: [],
        learningPath: { versionId: input.manifest.learningPath.versionId },
        policyContract: 'internship-completion-v1',
        trainingAssignments: [{ assignmentId: 'generic-training-task', batchId: 'other-batch', status: 'published' }]
    };
}

function validate(input = packages(), customSnapshot = snapshot(input)) {
    return validateCandidatePackage({ ...input, snapshot: customSnapshot });
}

function evaluatorFixture({ reviewDecision = 'accepted', score = 0 } = {}) {
    const input = packages();
    const configured = input.manifest.assignments.filter((item) => ['required', 'optional'].includes(item.requirement));
    const policyAssignments = configured.map((item) => ({
        assignmentId: `db-${item.assignmentKey}`,
        requirementType: item.requirement,
        label: item.title,
        definitionDigest: `md5:${item.assignmentKey}`
    }));
    const assignmentRows = policyAssignments.map((item, index) => ({
        assignmentId: item.assignmentId,
        assignmentExists: true,
        assignmentStatus: 'published',
        participantVisibility: 'visible',
        definitionDigest: item.definitionDigest,
        submissionId: item.requirementType === 'required' ? `submission-${index}` : null,
        revisionCount: index === 0 ? 3 : (item.requirementType === 'required' ? 1 : 0),
        submissionState: item.requirementType === 'required' ? 'submitted' : null,
        reviewState: item.requirementType === 'required' ? reviewDecision : null,
        reviewDecision: item.requirementType === 'required' ? reviewDecision : null,
        score
    }));
    assignmentRows.push({
        assignmentId: 'generic-training-task', assignmentExists: true, assignmentStatus: 'published',
        participantVisibility: 'visible', definitionDigest: 'md5:generic', submissionId: null, revisionCount: 0
    });
    const repository = {
        async getProgramProgressContext() {
            return {
                id: 'int-bim-2026-pilot', code: 'INT-BIM-2026-PILOT', title: 'Pilot', programType: 'internship',
                participantRole: 'participant', participantEnrollmentStatus: 'active', participantDisplayName: 'Participant',
                actorRole: 'participant', actorEnrollmentStatus: 'active', learningPathVersionId: input.manifest.learningPath.versionId,
                learningPathDefinition: { assessments: [] }, policyVersionId: input.manifest.policy.policyVersionId,
                policyStatus: 'frozen', policyChecksumValid: true, policyPayload: {
                    contractVersion: 'internship-completion-v1', learningPathVersionId: input.manifest.learningPath.versionId,
                    assignments: policyAssignments
                }
            };
        },
        async getPathModules() {
            return [{ moduleKey: 'foundation', status: 'active', items: [
                { contentId: 'page:bim-mindset', requirementType: 'required', mappingStatus: 'approved', contentStatus: 'active', sourceType: 'page', sourceId: 'bim-mindset', completionRule: { activity: { moduleType: 'page', moduleId: 'bim-mindset' } } },
                { contentId: 'reference-content', requirementType: 'optional', mappingStatus: 'approved', contentStatus: 'active', sourceType: 'page', sourceId: 'reference', completionRule: {} }
            ] }];
        },
        async getCompletedActivityEvidence() { return [{ moduleType: 'page', moduleId: 'bim-mindset' }]; },
        async getVerifiedQuizEvidence() { return []; },
        async listProgramAssignmentStates(_batchId, _userId, requestedIds) {
            return assignmentRows.filter((item) => requestedIds.includes(item.assignmentId));
        }
    };
    return createInternshipProgramProgressService({ repository });
}

test('manifest v1 remains byte-for-byte unchanged from the Phase 5A baseline', () => {
    const bytes = fs.readFileSync(path.join(DATA, 'internship-pilot-manifest-v1.json'));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), 'db9d53ddf5f78420d1e39637f19fad96e9af16dfb76f98e9732636bf01652c90');
});

test('manifest v2 is a distinct proposed version', () => {
    const { manifest } = packages();
    assert.equal(manifest.manifestVersion, 'INT-BIM-PILOT-MANIFEST-v2');
    assert.equal(manifest.status, 'proposed');
    assert.notEqual(manifest.manifestVersion, readJson('internship-pilot-manifest-v1.json').manifestVersion);
});

test('required learning canonical reference resolves', () => {
    const result = validate();
    assert.equal(result.valid, true);
    assert.equal(result.summary.requiredLearning, 1);
});

test('optional and reference learning stay outside the required denominator', () => {
    const result = validate();
    assert.equal(result.summary.requiredLearning, 1);
    assert.equal(result.summary.optionalLearning, 10);
});

test('assignment configuration keys are unique', () => {
    const input = packages();
    const keys = input.assignmentsPackage.assignments.map((item) => item.assignmentKey);
    assert.equal(new Set(keys).size, keys.length);
});

test('every required assignment exists in the assignment package', () => {
    const input = packages();
    const available = new Set(input.assignmentsPackage.assignments.map((item) => item.assignmentKey));
    assert.ok(input.manifest.assignments.filter((item) => item.requirement === 'required').every((item) => available.has(item.assignmentKey)));
});

test('every required assignment has a matching rubric', () => {
    const result = validate();
    assert.equal(result.summary.requiredAssignments, 5);
    assert.equal(result.summary.rubricReady, 5);
});

test('every required assignment has allowed evidence configuration', () => {
    const result = validate();
    assert.equal(result.summary.evidenceReady, result.summary.requiredAssignments);
});

test('missing rubric makes cross-package validation fail', () => {
    const input = packages();
    input.rubricsPackage.rubrics = input.rubricsPackage.rubrics.filter((item) => item.assignmentKey !== 'model-quality-information-review');
    refresh(input.rubricsPackage);
    assert.ok(validate(input).errors.some((item) => item.code === 'assignment_rubric_missing'));
});

test('missing required deliverable makes validation fail', () => {
    const input = packages();
    input.assignmentsPackage.assignments[0].requiredDeliverable = '';
    refresh(input.assignmentsPackage);
    assert.ok(validate(input).errors.some((item) => item.code === 'assignment_brief_incomplete'));
});

test('unresolved prerequisite makes validation fail', () => {
    const input = packages();
    const customSnapshot = snapshot(input);
    customSnapshot.contents = customSnapshot.contents.filter((item) => item.contentId !== 'page:bim-mindset');
    assert.ok(validate(input, customSnapshot).errors.some((item) => item.code === 'assignment_content_reference_unresolved'));
});

test('excluded smoke task remains excluded', () => {
    const smoke = packages().manifest.assignments.find((item) => item.assignmentKey === 'legacy-smoke-practice-task');
    assert.equal(smoke.requirement, 'exclude');
    assert.equal(smoke.readiness, 'excluded_wrong_batch');
});

test('unknown Training task remains non-required with a warning', () => {
    const result = validate();
    assert.equal(result.summary.requiredAssignments, 5);
    assert.ok(result.warnings.some((item) => item.code === 'unknown_training_task_not_required'));
});

test('required assignments alone enter the evaluator denominator', async () => {
    const result = await evaluatorFixture().getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.deepEqual(result.dimensions.accepted.required, { total: 5, completed: 5, remaining: 0 });
    assert.equal(result.requirementsMet, true);
});

test('optional assignment and generic Training task do not enter required denominator', async () => {
    const result = await evaluatorFixture().getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.equal(result.dimensions.accepted.optional.total, 1);
    assert.equal(result.dimensions.accepted.optional.completed, 0);
    assert.equal(result.assignments.required, 5);
});

test('historical revisions do not inflate assignment denominator', async () => {
    const result = await evaluatorFixture().getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.equal(result.revisionCount, 2);
    assert.equal(result.assignments.required, 5);
});

test('rubric package keeps explicit reviewer decision as acceptance authority', () => {
    const { rubricsPackage } = packages();
    assert.ok(rubricsPackage.rubrics.every((item) => item.acceptanceAuthority === 'explicit_reviewer_decision'));
    assert.ok(rubricsPackage.rubrics.every((item) => item.automaticScoreThreshold === null));
});

test('high descriptive score does not auto-accept revision requested work', async () => {
    const result = await evaluatorFixture({ reviewDecision: 'revision_requested', score: 5 })
        .getOwnStatus('int-bim-2026-pilot', { id: 101 });
    assert.equal(result.requirementsMet, false);
    assert.equal(result.assignments.accepted, 0);
});

test('manifest v2 policy contract resolves to approved Phase 4 behavior', () => {
    const result = validate();
    assert.equal(result.valid, true);
    assert.equal(packages().manifest.policy.contractVersion, 'internship-completion-v1');
});

test('manifest v2 learning-path version resolves', () => {
    const result = validate();
    assert.equal(result.valid, true);
    assert.equal(packages().manifest.learningPath.versionId, snapshot().learningPath.versionId);
});

test('cross-package validation passes with conditional operational warnings', () => {
    const result = validate();
    assert.equal(result.valid, true);
    assert.equal(result.readiness, 'CONDITIONAL');
    assert.equal(result.errors.length, 0);
});

test('packages contain no UNC or native filesystem path', () => {
    const serialized = JSON.stringify(packages());
    assert.doesNotMatch(serialized, /\\\\|[A-Za-z]:[\\/]/);
});

test('planned assignment cannot claim a fake database ID', () => {
    const input = packages();
    input.manifest.assignments[0].assignmentId = 'fake-db-id';
    refresh(input.manifest);
    assert.ok(validate(input).errors.some((item) => item.code === 'planned_assignment_has_fake_database_id'));
});

test('package validation performs read-only inspection and no production mutation', () => {
    const source = fs.readFileSync(path.join(ROOT, 'backend', 'scripts', 'validate-internship-pilot-package.js'), 'utf8');
    assert.match(source, /BEGIN READ ONLY/);
    assert.match(source, /mutationPerformed:\s*false/);
    assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/);
});
