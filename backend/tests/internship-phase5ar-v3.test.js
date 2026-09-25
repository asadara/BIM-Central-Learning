'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
    digestManifest,
    validateCandidatePackage,
    validateMentorProgramCoverage
} = require('../services/internshipPilotManifestValidator');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'backend', 'elearning', 'data');

function readJson(name) {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function fileDigest(name) {
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(DATA, name))).digest('hex');
}

function packages() {
    return {
        manifest: readJson('internship-pilot-manifest-v3.json'),
        assignmentsPackage: readJson('internship-pilot-assignments-v2.json'),
        rubricsPackage: readJson('internship-pilot-rubrics-v2.json'),
        programSource: readJson('internship-mentor-program-37-v1.json')
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
        learningPath: { versionKey: input.manifest.learningPath.versionKey, entityState: 'planned_configuration' },
        policyContract: 'internship-completion-v1',
        trainingAssignments: [{ assignmentId: 'generic-training-task', batchId: 'other-batch', status: 'published' }],
        deploymentChecked: true,
        batchExists: false,
        policyExists: false
    };
}

function validate(input = packages()) {
    return {
        packageResult: validateCandidatePackage({
            manifest: input.manifest,
            assignmentsPackage: input.assignmentsPackage,
            rubricsPackage: input.rubricsPackage,
            snapshot: snapshot(input)
        }),
        coverageResult: validateMentorProgramCoverage({
            programSource: input.programSource,
            manifest: input.manifest,
            assignmentsPackage: input.assignmentsPackage
        })
    };
}

test('manifest v1 and v2 remain byte-for-byte unchanged', () => {
    assert.equal(fileDigest('internship-pilot-manifest-v1.json'), 'db9d53ddf5f78420d1e39637f19fad96e9af16dfb76f98e9732636bf01652c90');
    assert.equal(fileDigest('internship-pilot-manifest-v2.json'), 'b31b4cf8b4e504acb6375ec581c048a20f916df508efdf9368b988bd908f0f6f');
});

test('manifest v3 is a distinct proposed successor to v2', () => {
    const { manifest } = packages();
    assert.equal(manifest.manifestVersion, 'INT-BIM-PILOT-MANIFEST-v3');
    assert.equal(manifest.basedOnManifestVersion, 'INT-BIM-PILOT-MANIFEST-v2');
    assert.equal(manifest.status, 'proposed');
});

test('all v3 artifacts have valid immutable digests', () => {
    const input = packages();
    for (const artifact of [input.manifest, input.assignmentsPackage, input.rubricsPackage, input.programSource]) {
        assert.equal(artifact.integrity.digest, digestManifest(artifact));
    }
});

test('mentor-approved v3 denominator has ten learning items and six assignments', () => {
    const { packageResult } = validate();
    assert.equal(packageResult.valid, true);
    assert.equal(packageResult.summary.requiredLearning, 10);
    assert.equal(packageResult.summary.optionalLearning, 1);
    assert.equal(packageResult.summary.requiredAssignments, 6);
    assert.equal(packageResult.summary.optionalAssignments, 0);
    assert.equal(packageResult.summary.requiredQuizzes, 0);
});

test('source taxonomy uses mentor document emphasis without progress weighting', () => {
    const { manifest, programSource } = packages();
    assert.deepEqual(manifest.program.taxonomyAllocation, {
        bim_fundamental: 25,
        bim_coordination: 25,
        automation_digital_engineering: 40,
        documentation_delivery: 10
    });
    assert.deepEqual(manifest.program.taxonomyAllocation, programSource.taxonomyAllocation);
    assert.equal(programSource.taxonomySemantics, 'program_emphasis_only');
    assert.equal(programSource.approvedDecisions.combinedProgramProgressPercentage, false);
});

test('planned v3 learning path uses a configuration key rather than a fake database ID', () => {
    const { learningPath } = packages().manifest;
    assert.equal(learningPath.entityState, 'planned');
    assert.equal(learningPath.versionKey, 'internship-bim-path-v3');
    assert.equal(Object.hasOwn(learningPath, 'versionId'), false);
});

test('automation is required with explicit operational gates and safe derived evidence', () => {
    const input = packages();
    const manifestAssignment = input.manifest.assignments.find((item) => item.assignmentKey === 'automation-digital-workflow-improvement');
    const configured = input.assignmentsPackage.assignments.find((item) => item.assignmentKey === manifestAssignment.assignmentKey);
    assert.equal(manifestAssignment.requirement, 'required');
    assert.equal(configured.recommendation, 'required');
    assert.equal(configured.readiness, 'conditional_required');
    assert.equal(configured.evidence.classification, 'evidence_ready');
    assert.equal(configured.evidence.sourceCodeRequired, false);
    assert.equal(configured.evidence.executableRequired, false);
});

test('documentation assignment and rubric include governance handover and closeout', () => {
    const input = packages();
    const assignment = input.assignmentsPackage.assignments.find((item) => item.assignmentKey === 'bim-documentation-delivery-package');
    const rubric = input.rubricsPackage.rubrics.find((item) => item.rubricKey === 'rubric-documentation-delivery-v2');
    assert.match(assignment.instructions, /SOP/i);
    assert.match(assignment.instructions, /handover/i);
    assert.match(assignment.instructions, /presentation/i);
    assert.ok(rubric.criteria.some((item) => item.criterionKey === 'presentation-closeout'));
    assert.ok(rubric.criteria.some((item) => item.criterionKey === 'handover-knowledge-transfer'));
});

test('capstone and external smoke task remain excluded', () => {
    const assignments = packages().manifest.assignments;
    assert.equal(assignments.find((item) => item.assignmentKey === 'capstone-improvement-project').requirement, 'exclude');
    assert.equal(assignments.find((item) => item.assignmentKey === 'legacy-smoke-practice-task').requirement, 'exclude');
});

test('Phase 4 policy semantics remain unchanged', () => {
    const { manifest } = packages();
    assert.equal(manifest.policy.contractVersion, 'internship-completion-v1');
    assert.equal(manifest.policy.attendanceGate, false);
    assert.equal(manifest.policy.finalEvaluationGate, false);
    assert.equal(manifest.policy.acceptanceRule, 'explicit_reviewer_acceptance');
});

test('all required assignments have rubric and evidence readiness', () => {
    const { packageResult } = validate();
    assert.equal(packageResult.summary.rubricReady, 6);
    assert.equal(packageResult.summary.evidenceReady, 6);
});

test('rubric scores never replace explicit reviewer decisions', () => {
    const { rubricsPackage } = packages();
    assert.ok(rubricsPackage.rubrics.every((item) => item.acceptanceAuthority === 'explicit_reviewer_decision'));
    assert.ok(rubricsPackage.rubrics.every((item) => item.automaticScoreThreshold === null));
});

test('37-item mentor source is complete and reconciles without structural errors', () => {
    const { coverageResult } = validate();
    assert.equal(coverageResult.valid, true);
    assert.equal(coverageResult.summary.total, 37);
    assert.equal(coverageResult.summary.covered, 13);
    assert.equal(coverageResult.summary.partiallyCovered, 18);
    assert.equal(coverageResult.summary.notCovered, 6);
});

test('coverage category totals match the source document', () => {
    const byCategory = validate().coverageResult.summary.byCategory;
    assert.deepEqual(byCategory.bim_fundamental, { total: 9, covered: 4, partiallyCovered: 4, notCovered: 1 });
    assert.deepEqual(byCategory.bim_coordination, { total: 7, covered: 2, partiallyCovered: 3, notCovered: 2 });
    assert.deepEqual(byCategory.automation_digital_engineering, { total: 15, covered: 5, partiallyCovered: 7, notCovered: 3 });
    assert.deepEqual(byCategory.documentation_delivery, { total: 6, covered: 2, partiallyCovered: 4, notCovered: 0 });
});

test('remaining uncovered items are explicit gaps and keep readiness conditional', () => {
    const { coverageResult } = validate();
    assert.equal(coverageResult.readiness, 'CONDITIONAL');
    assert.ok(coverageResult.warnings.some((item) => item.code === 'mentor_program_gaps_remain'));
});

test('removing a source row fails the 37-item coverage contract', () => {
    const input = packages();
    input.programSource.tasks.pop();
    refresh(input.programSource);
    const result = validateMentorProgramCoverage(input);
    assert.ok(result.errors.some((item) => item.code === 'mentor_program_task_count_invalid'));
});

test('an uncovered task without an explicit gap fails coverage validation', () => {
    const input = packages();
    const task = input.programSource.tasks.find((item) => item.coverage === 'not_covered');
    task.gapKeys = [];
    refresh(input.programSource);
    const result = validateMentorProgramCoverage(input);
    assert.ok(result.errors.some((item) => item.code === 'mentor_program_uncovered_without_gap'));
});

test('mentor-approved denominator mismatch is rejected', () => {
    const input = packages();
    input.manifest.learning[1].requirement = 'optional';
    refresh(input.manifest);
    const result = validateMentorProgramCoverage(input);
    assert.ok(result.errors.some((item) => item.code === 'mentor_decision_learning_mismatch'));
});

test('unknown source learning or assignment references are rejected', () => {
    const input = packages();
    input.programSource.tasks[0].learningContentIds.push('page:not-real');
    input.programSource.tasks[0].assignmentKeys.push('assignment-not-real');
    refresh(input.programSource);
    const result = validateMentorProgramCoverage(input);
    assert.ok(result.errors.some((item) => item.code === 'mentor_program_learning_reference_missing'));
    assert.ok(result.errors.some((item) => item.code === 'mentor_program_assignment_reference_missing'));
});

test('v3 package is valid but remains operationally conditional', () => {
    const { packageResult, coverageResult } = validate();
    assert.equal(packageResult.valid, true);
    assert.equal(packageResult.readiness, 'CONDITIONAL');
    assert.equal(coverageResult.valid, true);
    assert.equal(coverageResult.readiness, 'CONDITIONAL');
});

test('v3 artifacts contain no native or UNC paths', () => {
    const serialized = JSON.stringify(packages());
    assert.doesNotMatch(serialized, /\\|[A-Za-z]:[\/]/);
});

test('v3 validator remains read-only and exposes the mentor source profile', () => {
    const source = fs.readFileSync(path.join(ROOT, 'backend', 'scripts', 'validate-internship-pilot-package.js'), 'utf8');
    assert.match(source, /BEGIN READ ONLY/);
    assert.match(source, /process\.argv\.includes\('--v3'\)/);
    assert.match(source, /mutationPerformed:\s*false/);
    assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/);
});
