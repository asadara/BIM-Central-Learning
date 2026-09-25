'use strict';

const crypto = require('node:crypto');

const LEARNING_REQUIREMENTS = new Set(['required', 'optional', 'reference_only', 'exclude']);
const QUIZ_REQUIREMENTS = new Set(['required_pass', 'optional', 'exclude']);
const ASSIGNMENT_REQUIREMENTS = new Set(['required', 'optional', 'exclude']);
const EVIDENCE_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'jpg', 'jpeg', 'png']);
const COVERAGE_STATUSES = new Set(['covered', 'partially_covered', 'not_covered']);
const PROGRAM_ACTIVITY_TYPES = new Set([
    'learning', 'guided_practice', 'practical_activity', 'formal_assignment_support',
    'documentation', 'mentoring_activity', 'reference', 'future_gap'
]);

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function digestManifest(manifest) {
    const payload = { ...manifest };
    delete payload.integrity;
    return crypto.createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

function issue(code, message, path = null) {
    return { code, message, ...(path ? { path } : {}) };
}

function findDuplicates(items, key) {
    const seen = new Set();
    const duplicates = new Set();
    for (const item of items) {
        const value = String(item && item[key] || '').trim();
        if (!value) continue;
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    }
    return [...duplicates];
}

function summarize(manifest) {
    const learning = Array.isArray(manifest.learning) ? manifest.learning : [];
    const quizzes = Array.isArray(manifest.quizzes) ? manifest.quizzes : [];
    const assignments = Array.isArray(manifest.assignments) ? manifest.assignments : [];
    return {
        requiredLearning: learning.filter((item) => item.requirement === 'required').length,
        optionalLearning: learning.filter((item) => ['optional', 'reference_only'].includes(item.requirement)).length,
        excludedLearning: learning.filter((item) => item.requirement === 'exclude').length,
        requiredQuizzes: quizzes.filter((item) => item.requirement === 'required_pass').length,
        optionalQuizzes: quizzes.filter((item) => item.requirement === 'optional').length,
        excludedQuizzes: quizzes.filter((item) => item.requirement === 'exclude').length,
        requiredAssignments: assignments.filter((item) => item.requirement === 'required').length,
        optionalAssignments: assignments.filter((item) => item.requirement === 'optional').length,
        excludedAssignments: assignments.filter((item) => item.requirement === 'exclude').length
    };
}

function validateManifest(manifest, snapshot = {}) {
    const errors = [];
    const warnings = [];
    const learning = Array.isArray(manifest && manifest.learning) ? manifest.learning : [];
    const quizzes = Array.isArray(manifest && manifest.quizzes) ? manifest.quizzes : [];
    const assignments = Array.isArray(manifest && manifest.assignments) ? manifest.assignments : [];
    const summary = summarize(manifest || {});

    if (!manifest || typeof manifest !== 'object') {
        return { valid: false, readiness: 'BLOCKED', errors: [issue('manifest_invalid', 'Manifest must be an object.')], warnings, summary };
    }
    if (!/^INT-BIM-PILOT-MANIFEST-v[1-9][0-9]*$/.test(String(manifest.manifestVersion || ''))) {
        errors.push(issue('manifest_version_invalid', 'A stable pilot manifest version is required.', 'manifestVersion'));
    }
    if (manifest.freezeStatus !== 'frozen') {
        errors.push(issue('manifest_not_frozen', 'Pilot manifest must be explicitly frozen.', 'freezeStatus'));
    }
    const expectedDigest = digestManifest(manifest);
    if (!manifest.integrity || manifest.integrity.algorithm !== 'sha256' || manifest.integrity.digest !== expectedDigest) {
        errors.push(issue('manifest_digest_invalid', 'Manifest content does not match its immutable SHA-256 digest.', 'integrity.digest'));
    }
    if (!manifest.program || manifest.program.programType !== 'internship') {
        errors.push(issue('program_type_invalid', 'Pilot programType must be internship.', 'program.programType'));
    }
    if (!manifest.program || !manifest.program.batchId || !manifest.program.programCode) {
        errors.push(issue('cohort_identity_incomplete', 'Program code and batch ID must be defined.', 'program'));
    }
    if (!manifest.policy || !manifest.policy.policyVersionId) {
        errors.push(issue('policy_version_unset', 'A policy version reference is required.', 'policy.policyVersionId'));
    }
    if (!manifest.learningPath || !manifest.learningPath.versionId) {
        errors.push(issue('learning_path_version_unset', 'A learning path version reference is required.', 'learningPath.versionId'));
    }

    for (const duplicate of findDuplicates(learning, 'contentId')) {
        errors.push(issue('duplicate_learning_requirement', `Duplicate learning requirement: ${duplicate}.`, 'learning'));
    }
    for (const duplicate of findDuplicates(quizzes, 'quizId')) {
        errors.push(issue('duplicate_quiz_requirement', `Duplicate quiz requirement: ${duplicate}.`, 'quizzes'));
    }
    for (const duplicate of findDuplicates(assignments, 'assignmentId')) {
        errors.push(issue('duplicate_assignment_requirement', `Duplicate assignment requirement: ${duplicate}.`, 'assignments'));
    }

    learning.forEach((item, index) => {
        if (!item.contentId || !LEARNING_REQUIREMENTS.has(item.requirement)) {
            errors.push(issue('learning_requirement_invalid', 'Learning entry needs a canonical contentId and explicit classification.', `learning[${index}]`));
        }
        if (item.requirement === 'required' && (!item.route || item.availability !== 'available' || item.validationStatus !== 'validated')) {
            errors.push(issue('required_content_invalid', `Required learning is not executable: ${item.contentId || index}.`, `learning[${index}]`));
        }
    });
    quizzes.forEach((item, index) => {
        if (!item.quizId || !QUIZ_REQUIREMENTS.has(item.requirement)) {
            errors.push(issue('quiz_requirement_invalid', 'Quiz entry needs a quizId and explicit classification.', `quizzes[${index}]`));
        }
        if (item.requirement === 'required_pass' && (!item.verifiedServerSource || !item.passRule)) {
            errors.push(issue('required_quiz_invalid', `Required quiz is missing a verified source or pass rule: ${item.quizId || index}.`, `quizzes[${index}]`));
        }
    });
    assignments.forEach((item, index) => {
        if (!item.assignmentId || !ASSIGNMENT_REQUIREMENTS.has(item.requirement)) {
            errors.push(issue('assignment_requirement_invalid', 'Assignment entry needs an assignmentId and explicit classification.', `assignments[${index}]`));
        }
        if (item.requirement === 'required') {
            if (!item.requiredDeliverable || !item.instructionsReady || !item.assignmentValid) {
                errors.push(issue('required_assignment_not_executable', `Required assignment is not executable: ${item.assignmentId || index}.`, `assignments[${index}]`));
            }
            if (!['rubric_ready', 'rubric_partial'].includes(item.rubricReadiness)) {
                errors.push(issue('required_assignment_rubric_missing', `Required assignment has no usable review criteria: ${item.assignmentId || index}.`, `assignments[${index}]`));
            }
            const formats = Array.isArray(item.evidenceFormats) ? item.evidenceFormats.map((value) => String(value).toLowerCase()) : [];
            if (formats.length === 0 || formats.some((value) => !EVIDENCE_EXTENSIONS.has(value))) {
                errors.push(issue('required_assignment_evidence_incompatible', `Required assignment evidence is incompatible: ${item.assignmentId || index}.`, `assignments[${index}]`));
            }
        }
    });

    if (summary.requiredLearning === 0) {
        errors.push(issue('required_learning_manifest_empty', 'At least one explicitly approved required learning item is needed.'));
    }
    if (summary.requiredAssignments === 0) {
        errors.push(issue('required_assignment_manifest_empty', 'No explicitly approved required assignment exists for the pilot.'));
    }

    const contentById = new Map((snapshot.contents || []).map((item) => [String(item.contentId), item]));
    for (const item of learning.filter((entry) => entry.requirement === 'required')) {
        const actual = contentById.get(String(item.contentId));
        if (snapshot.contents && (!actual || actual.resolved !== true)) {
            errors.push(issue('required_content_unresolved', `Required canonical content does not resolve: ${item.contentId}.`));
        } else if (actual && (actual.contentStatus !== 'active' || actual.mappingStatus !== 'approved')) {
            errors.push(issue('required_content_unavailable', `Required canonical content is not active and approved: ${item.contentId}.`));
        }
    }
    if (snapshot.learningContractChecked === true) {
        const requiredPathIds = new Set((snapshot.contents || [])
            .filter((item) => item.requirementType === 'required')
            .map((item) => String(item.contentId)));
        const requiredManifestIds = new Set(learning
            .filter((item) => item.requirement === 'required')
            .map((item) => String(item.contentId)));
        if ([...requiredPathIds].some((id) => !requiredManifestIds.has(id))
            || [...requiredManifestIds].some((id) => !requiredPathIds.has(id))) {
            errors.push(issue('learning_requirement_authority_mismatch', 'Required learning classifications do not match the published path version.'));
        }
        const availableQuizIds = new Set((snapshot.quizzes || []).map((item) => String(item.quizId)));
        for (const item of quizzes.filter((entry) => entry.requirement === 'required_pass')) {
            if (!availableQuizIds.has(String(item.quizId))) {
                errors.push(issue('required_quiz_unresolved', `Required quiz is not present in the published path definition: ${item.quizId}.`));
            }
        }
        const requiredPathQuizzes = new Set((snapshot.quizzes || [])
            .filter((item) => item.required !== false)
            .map((item) => String(item.quizId)));
        const requiredManifestQuizzes = new Set(quizzes
            .filter((item) => item.requirement === 'required_pass')
            .map((item) => String(item.quizId)));
        if ([...requiredPathQuizzes].some((id) => !requiredManifestQuizzes.has(id))) {
            errors.push(issue('quiz_requirement_authority_mismatch', 'Published required assessments are not classified in the frozen quiz manifest.'));
        }
    }

    const assignmentById = new Map((snapshot.assignments || []).map((item) => [String(item.assignmentId), item]));
    for (const item of assignments.filter((entry) => entry.requirement === 'required')) {
        const actual = assignmentById.get(String(item.assignmentId));
        if (snapshot.assignments && !actual) {
            errors.push(issue('required_assignment_unresolved', `Required assignment does not exist: ${item.assignmentId}.`));
        } else if (actual && String(actual.batchId) !== String(manifest.program.batchId)) {
            errors.push(issue('required_assignment_wrong_batch', `Required assignment belongs to another batch: ${item.assignmentId}.`));
        }
    }

    const classifiedAssignments = new Set(assignments.map((item) => String(item.assignmentId)));
    const unknownCandidates = (snapshot.assignments || []).filter((item) => !classifiedAssignments.has(String(item.assignmentId)));
    if (unknownCandidates.length > 0) {
        warnings.push(issue('unclassified_assignments_ignored', `${unknownCandidates.length} assignment candidate(s) are not classified and therefore are not required.`));
    }

    if (snapshot.batch) {
        if (String(snapshot.batch.id) !== String(manifest.program.batchId) || snapshot.batch.programType !== 'internship') {
            errors.push(issue('pilot_batch_mismatch', 'Configured pilot batch identity/type does not match the manifest.'));
        }
    } else if (snapshot.databaseChecked === true) {
        errors.push(issue('pilot_batch_unresolved', `Pilot batch does not exist: ${manifest.program.batchId}.`));
    }
    if (snapshot.learningPath) {
        if (String(snapshot.learningPath.versionId) !== String(manifest.learningPath.versionId)) {
            errors.push(issue('learning_path_version_mismatch', 'Configured learning path version does not match the manifest.'));
        } else if (snapshot.learningPath.status !== 'published') {
            errors.push(issue('learning_path_version_unpublished', 'Pilot learning path version is not published.'));
        }
    } else if (snapshot.databaseChecked === true) {
        errors.push(issue('learning_path_version_unresolved', 'Pilot learning path version is not deployed in the checked database.'));
    }
    if (snapshot.policy) {
        if (String(snapshot.policy.id) !== String(manifest.policy.policyVersionId)) {
            errors.push(issue('policy_version_mismatch', 'Configured policy version does not match the manifest.'));
        } else if (snapshot.policy.status !== 'frozen') {
            errors.push(issue('policy_version_not_frozen', 'Configured policy version is not frozen.'));
        } else if (snapshot.policy.manifestVersion !== manifest.manifestVersion
            || snapshot.policy.manifestDigest !== manifest.integrity.digest) {
            errors.push(issue('policy_manifest_mismatch', 'Frozen policy does not bind this exact manifest version and digest.'));
        }
    } else if (snapshot.databaseChecked === true) {
        errors.push(issue('policy_version_unresolved', 'Pilot policy version is not deployed in the checked database.'));
    }

    const requiredRoles = ['participant', 'mentor'];
    for (const role of requiredRoles) {
        const configured = manifest.roles && manifest.roles[role];
        if (!configured || !Number.isInteger(configured.canonicalUserId)) {
            warnings.push(issue(`${role}_identity_pending`, `Canonical ${role} user ID is a required Phase 5B operational input.`));
        }
    }
    if (!manifest.program.startDate || !manifest.program.endDate) {
        warnings.push(issue('program_dates_pending', 'Start and end dates are required Phase 5B operational inputs.'));
    }

    for (const schema of snapshot.missingSchemas || []) {
        errors.push(issue('database_schema_unavailable', `Required database structure is unavailable: ${schema}.`));
    }

    const criticalCodes = new Set([
        'required_assignment_manifest_empty', 'required_content_unresolved', 'required_assignment_unresolved',
        'required_assignment_wrong_batch', 'required_assignment_not_executable', 'pilot_batch_unresolved',
        'policy_version_unresolved', 'policy_version_mismatch', 'learning_path_version_unresolved',
        'learning_path_version_mismatch', 'database_schema_unavailable'
    ]);
    const readiness = errors.some((item) => criticalCodes.has(item.code))
        ? 'BLOCKED'
        : (errors.length > 0 ? 'BLOCKED' : (warnings.length > 0 ? 'CONDITIONAL' : 'READY'));
    return { valid: errors.length === 0, readiness, errors, warnings, summary };
}

function toPolicyPayload(manifest) {
    return {
        calculationVersion: 'internship-progress-v1',
        contractVersion: 'internship-completion-v1',
        manifestVersion: manifest.manifestVersion,
        manifestDigest: manifest.integrity.digest,
        learningPathVersionId: manifest.learningPath.versionId,
        attendanceGate: false,
        finalEvaluationGate: false,
        closeoutRequired: true,
        acceptanceRule: 'explicit_reviewer_acceptance',
        revisionPolicy: 'latest_revision_controls',
        certificateEligibility: 'after_explicit_closeout',
        assignments: (manifest.assignments || [])
            .filter((item) => item.requirement !== 'exclude')
            .map((item) => ({
                assignmentId: item.assignmentId,
                requirementType: item.requirement,
                label: item.title,
                definitionDigest: item.definitionDigest
            }))
    };
}

function validateCandidatePackage({ manifest, assignmentsPackage, rubricsPackage, snapshot = {} }) {
    const errors = [];
    const warnings = [];
    const learning = Array.isArray(manifest && manifest.learning) ? manifest.learning : [];
    const quizzes = Array.isArray(manifest && manifest.quizzes) ? manifest.quizzes : [];
    const manifestAssignments = Array.isArray(manifest && manifest.assignments) ? manifest.assignments : [];
    const assignmentItems = Array.isArray(assignmentsPackage && assignmentsPackage.assignments)
        ? assignmentsPackage.assignments : [];
    const rubrics = Array.isArray(rubricsPackage && rubricsPackage.rubrics) ? rubricsPackage.rubrics : [];
    const contentById = new Map((snapshot.contents || []).map((item) => [String(item.contentId), item]));
    const quizById = new Map((snapshot.quizzes || []).map((item) => [String(item.quizId), item]));
    const assignmentByKey = new Map(assignmentItems.map((item) => [String(item.assignmentKey), item]));
    const rubricByKey = new Map(rubrics.map((item) => [String(item.rubricKey), item]));

    for (const [artifact, label] of [[manifest, 'manifest'], [assignmentsPackage, 'assignments'], [rubricsPackage, 'rubrics']]) {
        if (!artifact || typeof artifact !== 'object') {
            errors.push(issue(`${label}_package_invalid`, `${label} package must be an object.`));
            continue;
        }
        if (!artifact.integrity || artifact.integrity.algorithm !== 'sha256'
            || artifact.integrity.digest !== digestManifest(artifact)) {
            errors.push(issue(`${label}_digest_invalid`, `${label} package content does not match its SHA-256 digest.`));
        }
    }
    if (!/^INT-BIM-PILOT-MANIFEST-v[2-9][0-9]*$/.test(String(manifest && manifest.manifestVersion || ''))
        || manifest.status !== 'proposed') {
        errors.push(issue('candidate_manifest_version_invalid', 'Candidate manifest must be a distinct proposed v2+ artifact.'));
    }
    if (manifest && manifest.policy && manifest.policy.contractVersion !== 'internship-completion-v1') {
        errors.push(issue('policy_contract_unsupported', 'Phase 4 completion policy contract must remain unchanged.'));
    }
    if (!manifest || !manifest.policy || !manifest.policy.policyVersionId) {
        errors.push(issue('policy_version_unset', 'Candidate policy version reference is required.'));
    }
    const learningPath = manifest && manifest.learningPath;
    if (!learningPath || (!learningPath.versionId && !learningPath.versionKey)) {
        errors.push(issue('learning_path_version_unset', 'Candidate learning path version ID or planned version key is required.'));
    } else if (learningPath.entityState === 'planned' && learningPath.versionId) {
        errors.push(issue('planned_learning_path_has_fake_database_id', 'A planned learning path version must use versionKey, not claim a database version ID.'));
    } else if (learningPath.entityState === 'planned') {
        warnings.push(issue('learning_path_version_not_deployed', `Planned learning path remains undeployed: ${learningPath.versionKey}.`));
    }
    if (manifest && assignmentsPackage && manifest.assignmentPackage !== assignmentsPackage.packageVersion) {
        errors.push(issue('assignment_package_version_mismatch', 'Manifest assignment package reference does not match the supplied package.'));
    }
    if (manifest && rubricsPackage && manifest.rubricPackage !== rubricsPackage.packageVersion) {
        errors.push(issue('rubric_package_version_mismatch', 'Manifest rubric package reference does not match the supplied package.'));
    }

    for (const [items, key, code] of [
        [learning, 'contentId', 'duplicate_learning_requirement'],
        [quizzes, 'quizId', 'duplicate_quiz_requirement'],
        [manifestAssignments, 'assignmentKey', 'duplicate_assignment_requirement'],
        [assignmentItems, 'assignmentKey', 'duplicate_assignment_config_key'],
        [rubrics, 'rubricKey', 'duplicate_rubric_key']
    ]) {
        for (const duplicate of findDuplicates(items, key)) {
            errors.push(issue(code, `Duplicate ${key}: ${duplicate}.`));
        }
    }

    learning.forEach((item, index) => {
        if (!item.contentId || !LEARNING_REQUIREMENTS.has(item.requirement)) {
            errors.push(issue('learning_requirement_invalid', 'Every learning item needs a canonical ID and explicit classification.', `learning[${index}]`));
            return;
        }
        if (item.requirement !== 'exclude') {
            const actual = contentById.get(String(item.contentId));
            if (!actual || actual.resolved !== true || actual.status !== 'active') {
                errors.push(issue('learning_reference_unresolved', `Learning reference is not active/resolvable: ${item.contentId}.`));
            }
        }
    });
    quizzes.forEach((item, index) => {
        if (!item.quizId || !QUIZ_REQUIREMENTS.has(item.requirement)) {
            errors.push(issue('quiz_requirement_invalid', 'Every quiz needs a registered ID and explicit classification.', `quizzes[${index}]`));
            return;
        }
        if (item.requirement !== 'exclude' && !quizById.has(String(item.quizId))) {
            errors.push(issue('quiz_reference_unresolved', `Quiz is not registered: ${item.quizId}.`));
        }
    });

    manifestAssignments.forEach((item, index) => {
        if (!item.assignmentKey || !ASSIGNMENT_REQUIREMENTS.has(item.requirement)) {
            errors.push(issue('assignment_requirement_invalid', 'Every assignment needs a configuration key and explicit classification.', `assignments[${index}]`));
            return;
        }
        if (item.entityState === 'planned' && item.assignmentId) {
            errors.push(issue('planned_assignment_has_fake_database_id', `Planned assignment must not claim a database ID: ${item.assignmentKey}.`));
        }
        if (item.requirement === 'exclude') return;
        const configured = assignmentByKey.get(String(item.assignmentKey));
        if (!configured) {
            errors.push(issue('assignment_package_entry_missing', `Assignment package entry is missing: ${item.assignmentKey}.`));
            return;
        }
        if (configured.recommendation !== item.requirement) {
            errors.push(issue('assignment_classification_mismatch', `Assignment classification differs across packages: ${item.assignmentKey}.`));
        }
        if (!String(item.requiredDeliverable || '').trim()
            || !Array.isArray(item.prerequisiteContentIds)
            || item.rubricKey !== configured.rubricKey
            || item.evidenceCompatibility !== configured.evidence.classification) {
            errors.push(issue('assignment_manifest_contract_mismatch', `Assignment manifest fields differ from the configuration package: ${item.assignmentKey}.`));
        }
        if (item.requirement === 'required' && !['ready_required', 'conditional_required'].includes(configured.readiness)) {
            errors.push(issue('required_assignment_not_ready', `Required assignment is not ready: ${item.assignmentKey}.`));
        } else if (item.requirement === 'required' && configured.readiness === 'conditional_required') {
            warnings.push(issue('required_assignment_operational_gate_pending', `Required assignment still has explicit operational gates: ${item.assignmentKey}.`));
        }
        if (!String(configured.requiredDeliverable || '').trim()
            || !String(configured.instructions || '').trim()
            || !Array.isArray(configured.expectedWorkflow) || configured.expectedWorkflow.length === 0) {
            errors.push(issue('assignment_brief_incomplete', `Assignment brief is incomplete: ${item.assignmentKey}.`));
        }
        const evidence = configured.evidence || {};
        const formats = Array.isArray(evidence.allowedFormats) ? evidence.allowedFormats.map((value) => String(value).toLowerCase()) : [];
        if (formats.length === 0 || formats.some((value) => !EVIDENCE_EXTENSIONS.has(value))
            || Number(evidence.maxFiles) > 5 || Number(evidence.maxBytesPerFile) > 10 * 1024 * 1024) {
            errors.push(issue('assignment_evidence_incompatible', `Assignment evidence policy is incompatible: ${item.assignmentKey}.`));
        }
        for (const contentId of [...(configured.prerequisiteContentIds || []), ...(configured.referenceContentIds || [])]) {
            const actual = contentById.get(String(contentId));
            if (!actual || actual.resolved !== true || actual.status !== 'active') {
                errors.push(issue('assignment_content_reference_unresolved', `Assignment content reference is unresolved: ${item.assignmentKey} -> ${contentId}.`));
            }
        }
        const rubric = rubricByKey.get(String(configured.rubricKey || item.rubricKey || ''));
        if (!rubric || rubric.assignmentKey !== item.assignmentKey) {
            errors.push(issue('assignment_rubric_missing', `Rubric is missing or mismatched: ${item.assignmentKey}.`));
        } else {
            const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
            if (criteria.length < 3 || criteria.length > 6
                || criteria.some((criterion) => !criterion.criterionKey || !criterion.title
                    || Number(criterion.maxScore) <= 0 || Number(criterion.maxScore) > 5)) {
                errors.push(issue('assignment_rubric_invalid', `Rubric criteria are not usable: ${item.assignmentKey}.`));
            }
            if (rubric.acceptanceAuthority !== 'explicit_reviewer_decision' || rubric.automaticScoreThreshold != null) {
                errors.push(issue('rubric_acceptance_policy_invalid', `Rubric attempts to replace explicit reviewer acceptance: ${item.assignmentKey}.`));
            }
        }
        const caseData = configured.caseData || {};
        if (!['ready', 'phase5b_operational_input'].includes(caseData.status)
            || !String(caseData.executionContract || '').trim()) {
            errors.push(issue('assignment_case_data_not_executable', `Assignment has no executable case-data contract: ${item.assignmentKey}.`));
        } else if (caseData.status === 'phase5b_operational_input') {
            warnings.push(issue('assignment_case_data_pending', `Approved sanitized/synthetic case selection remains a Phase 5B input: ${item.assignmentKey}.`));
        }
    });

    for (const configured of assignmentItems) {
        if (!manifestAssignments.some((item) => item.assignmentKey === configured.assignmentKey)) {
            warnings.push(issue('unclassified_assignments_ignored', `Unclassified assignment config is not required: ${configured.assignmentKey}.`));
        }
    }
    for (const candidate of snapshot.trainingAssignments || []) {
        if (!manifestAssignments.some((item) => item.existingAssignmentId === candidate.assignmentId)) {
            warnings.push(issue('unknown_training_task_not_required', `Existing Training task is outside the manifest and remains non-required: ${candidate.assignmentId}.`));
        }
    }

    if (snapshot.learningPath) {
        const expectedPathReference = manifest.learningPath.versionId || manifest.learningPath.versionKey;
        const actualPathReference = snapshot.learningPath.versionId || snapshot.learningPath.versionKey;
        if (String(actualPathReference) !== String(expectedPathReference)) {
            errors.push(issue('learning_path_version_mismatch', 'Candidate learning path reference does not resolve.'));
        }
    }
    if (snapshot.policyContract && snapshot.policyContract !== manifest.policy.contractVersion) {
        errors.push(issue('policy_version_mismatch', 'Candidate policy contract does not resolve to the approved Phase 4 contract.'));
    }
    for (const role of ['participant', 'mentor']) {
        if (!manifest.roles || !manifest.roles[role] || !Number.isInteger(manifest.roles[role].canonicalUserId)) {
            warnings.push(issue(`${role}_identity_pending`, `Canonical ${role} user ID remains a Phase 5B operational input.`));
        }
    }
    if (!manifest.program || !manifest.program.startDate || !manifest.program.endDate) {
        warnings.push(issue('program_dates_pending', 'Exact program dates remain a Phase 5B operational input.'));
    }
    if (snapshot.deploymentChecked === true && snapshot.batchExists !== true) {
        warnings.push(issue('pilot_batch_not_deployed', 'Candidate pilot batch is not deployed; Phase 5A-R performs no production mutation.'));
    }
    if (snapshot.deploymentChecked === true && snapshot.policyExists !== true) {
        warnings.push(issue('pilot_policy_not_deployed', 'Candidate policy version is not deployed; it remains a proposed Phase 5B input.'));
    }

    const requiredAssignments = manifestAssignments.filter((item) => item.requirement === 'required');
    const optionalAssignments = manifestAssignments.filter((item) => item.requirement === 'optional');
    const requiredLearning = learning.filter((item) => item.requirement === 'required');
    const optionalLearning = learning.filter((item) => ['optional', 'reference_only'].includes(item.requirement));
    const requiredQuizzes = quizzes.filter((item) => item.requirement === 'required_pass');
    const rubricReady = requiredAssignments.filter((item) => {
        const configured = assignmentByKey.get(String(item.assignmentKey));
        return configured && rubricByKey.has(String(configured.rubricKey));
    }).length;
    const evidenceReady = requiredAssignments.filter((item) => {
        const configured = assignmentByKey.get(String(item.assignmentKey));
        const formats = configured && configured.evidence && configured.evidence.allowedFormats;
        return Array.isArray(formats) && formats.length > 0 && formats.every((value) => EVIDENCE_EXTENSIONS.has(String(value).toLowerCase()));
    }).length;
    const summary = {
        requiredLearning: requiredLearning.length,
        optionalLearning: optionalLearning.length,
        requiredQuizzes: requiredQuizzes.length,
        requiredAssignments: requiredAssignments.length,
        optionalAssignments: optionalAssignments.length,
        rubricReady,
        evidenceReady,
        contentGaps: Array.isArray(manifest.contentGaps) ? manifest.contentGaps.length : 0
    };
    if (requiredLearning.length === 0) errors.push(issue('required_learning_manifest_empty', 'Candidate has no required learning.'));
    if (requiredAssignments.length === 0) errors.push(issue('required_assignment_manifest_empty', 'Candidate has no meaningful required assignment.'));

    const serializedPackages = JSON.stringify({ manifest, assignmentsPackage, rubricsPackage });
    if (/\\\\|[A-Za-z]:[\\/]/.test(serializedPackages)) {
        errors.push(issue('unsafe_native_path', 'Packages must not contain UNC or native filesystem paths.'));
    }
    const readiness = errors.length > 0 ? 'BLOCKED' : (warnings.length > 0 ? 'CONDITIONAL' : 'READY');
    return { valid: errors.length === 0, readiness, errors, warnings, summary };
}

function validateMentorProgramCoverage({ programSource, manifest, assignmentsPackage }) {
    const errors = [];
    const warnings = [];
    const tasks = Array.isArray(programSource && programSource.tasks) ? programSource.tasks : [];
    const learningIds = new Set((manifest && manifest.learning || []).map((item) => String(item.contentId)));
    const manifestAssignments = new Map((manifest && manifest.assignments || [])
        .map((item) => [String(item.assignmentKey), item]));
    const packageAssignments = new Set((assignmentsPackage && assignmentsPackage.assignments || [])
        .map((item) => String(item.assignmentKey)));
    const gapKeys = new Set((manifest && manifest.contentGaps || []).map((item) => String(item.gapKey)));

    if (!programSource || typeof programSource !== 'object') {
        return {
            valid: false,
            readiness: 'BLOCKED',
            errors: [issue('mentor_program_source_invalid', 'Mentor program source must be an object.')],
            warnings,
            summary: { total: 0, covered: 0, partiallyCovered: 0, notCovered: 0, byCategory: {} }
        };
    }
    if (!programSource.integrity || programSource.integrity.algorithm !== 'sha256'
        || programSource.integrity.digest !== digestManifest(programSource)) {
        errors.push(issue('mentor_program_digest_invalid', 'Mentor program source content does not match its SHA-256 digest.'));
    }
    if (tasks.length !== 37) {
        errors.push(issue('mentor_program_task_count_invalid', `Mentor program must contain exactly 37 classified items; received ${tasks.length}.`));
    }
    for (const duplicate of findDuplicates(tasks, 'taskId')) {
        errors.push(issue('mentor_program_task_duplicate', `Duplicate mentor program task: ${duplicate}.`));
    }

    const allocation = programSource.taxonomyAllocation || {};
    const allocationTotal = Object.values(allocation).reduce((total, value) => total + Number(value || 0), 0);
    if (allocationTotal !== 100 || programSource.taxonomySemantics !== 'program_emphasis_only') {
        errors.push(issue('mentor_program_taxonomy_invalid', 'Taxonomy allocation must total 100 and remain program-emphasis metadata only.'));
    }
    if (!programSource.sourceDocument || !/^[a-f0-9]{64}$/.test(String(programSource.sourceDocument.sha256 || ''))) {
        errors.push(issue('mentor_program_source_digest_missing', 'The external mentor source must be identified by a SHA-256 digest.'));
    }

    tasks.forEach((task, index) => {
        if (!task.taskId || !task.category || !task.title || !task.competency
            || !PROGRAM_ACTIVITY_TYPES.has(task.activityType)
            || !COVERAGE_STATUSES.has(task.coverage)) {
            errors.push(issue('mentor_program_task_invalid', `Mentor task classification is incomplete: ${task.taskId || index}.`, `tasks[${index}]`));
            return;
        }
        if (!Object.hasOwn(allocation, task.category)) {
            errors.push(issue('mentor_program_category_invalid', `Task ${task.taskId} uses an unknown program category: ${task.category}.`));
        }
        for (const contentId of task.learningContentIds || []) {
            if (!learningIds.has(String(contentId))) {
                errors.push(issue('mentor_program_learning_reference_missing', `Task ${task.taskId} references learning outside manifest v3: ${contentId}.`));
            }
        }
        for (const assignmentKey of task.assignmentKeys || []) {
            if (!manifestAssignments.has(String(assignmentKey)) || !packageAssignments.has(String(assignmentKey))) {
                errors.push(issue('mentor_program_assignment_reference_missing', `Task ${task.taskId} references an unavailable assignment: ${assignmentKey}.`));
            }
        }
        for (const gapKey of task.gapKeys || []) {
            if (!gapKeys.has(String(gapKey))) {
                errors.push(issue('mentor_program_gap_reference_missing', `Task ${task.taskId} references an undeclared gap: ${gapKey}.`));
            }
        }
        if (task.coverage === 'not_covered' && (!Array.isArray(task.gapKeys) || task.gapKeys.length === 0)) {
            errors.push(issue('mentor_program_uncovered_without_gap', `Uncovered task ${task.taskId} must name an explicit content/program gap.`));
        }
    });

    const decisions = programSource.approvedDecisions || {};
    if (decisions.manifestVersion !== (manifest && manifest.manifestVersion)) {
        errors.push(issue('mentor_decision_manifest_version_mismatch', 'Mentor decision does not target the supplied manifest version.'));
    }
    if (!manifest || !manifest.mentorProgramSource
        || manifest.mentorProgramSource.packageVersion !== programSource.packageVersion
        || manifest.mentorProgramSource.sourceDocumentSha256 !== programSource.sourceDocument.sha256) {
        errors.push(issue('mentor_program_source_binding_mismatch', 'Manifest does not bind the exact approved mentor-program source package and document digest.'));
    }
    if (JSON.stringify(manifest && manifest.program && manifest.program.taxonomyAllocation) !== JSON.stringify(allocation)) {
        errors.push(issue('mentor_program_taxonomy_mismatch', 'Manifest taxonomy allocation differs from the mentor-approved source.'));
    }
    const requiredLearning = (manifest && manifest.learning || [])
        .filter((item) => item.requirement === 'required').map((item) => String(item.contentId)).sort();
    const requiredAssignments = (manifest && manifest.assignments || [])
        .filter((item) => item.requirement === 'required').map((item) => String(item.assignmentKey)).sort();
    const expectedLearning = [...(decisions.requiredLearningContentIds || [])].map(String).sort();
    const expectedAssignments = [...(decisions.requiredAssignmentKeys || [])].map(String).sort();
    if (JSON.stringify(requiredLearning) !== JSON.stringify(expectedLearning)) {
        errors.push(issue('mentor_decision_learning_mismatch', 'Manifest required-learning denominator differs from the mentor-approved decision.'));
    }
    if (JSON.stringify(requiredAssignments) !== JSON.stringify(expectedAssignments)) {
        errors.push(issue('mentor_decision_assignment_mismatch', 'Manifest required-assignment denominator differs from the mentor-approved decision.'));
    }
    if (Number(decisions.requiredQuizCount) !== (manifest && manifest.quizzes || []).filter((item) => item.requirement === 'required_pass').length) {
        errors.push(issue('mentor_decision_quiz_mismatch', 'Manifest quiz denominator differs from the mentor-approved decision.'));
    }
    if (decisions.phase4PolicyContract !== (manifest && manifest.policy && manifest.policy.contractVersion)) {
        errors.push(issue('mentor_decision_policy_mismatch', 'Manifest changes the mentor-approved Phase 4 policy contract.'));
    }
    const capstone = manifestAssignments.get('capstone-improvement-project');
    if (!capstone || capstone.requirement !== decisions.capstoneRequirement) {
        errors.push(issue('mentor_decision_capstone_mismatch', 'Manifest capstone classification differs from the mentor-approved decision.'));
    }
    if (decisions.combinedProgramProgressPercentage !== false) {
        errors.push(issue('mentor_decision_progress_policy_invalid', 'Mentor program source must not introduce a combined Program Progress percentage.'));
    }

    const byCategory = {};
    for (const task of tasks) {
        const bucket = byCategory[task.category] || { total: 0, covered: 0, partiallyCovered: 0, notCovered: 0 };
        bucket.total += 1;
        if (task.coverage === 'covered') bucket.covered += 1;
        if (task.coverage === 'partially_covered') bucket.partiallyCovered += 1;
        if (task.coverage === 'not_covered') bucket.notCovered += 1;
        byCategory[task.category] = bucket;
    }
    const summary = {
        total: tasks.length,
        covered: tasks.filter((task) => task.coverage === 'covered').length,
        partiallyCovered: tasks.filter((task) => task.coverage === 'partially_covered').length,
        notCovered: tasks.filter((task) => task.coverage === 'not_covered').length,
        byCategory
    };
    if (summary.notCovered > 0) {
        warnings.push(issue('mentor_program_gaps_remain', `${summary.notCovered} mentor-program item(s) remain explicitly uncovered/future.`));
    }
    if (summary.partiallyCovered > 0) {
        warnings.push(issue('mentor_program_partial_coverage', `${summary.partiallyCovered} mentor-program item(s) remain partially covered.`));
    }
    const readiness = errors.length > 0 ? 'BLOCKED' : (warnings.length > 0 ? 'CONDITIONAL' : 'READY');
    return { valid: errors.length === 0, readiness, errors, warnings, summary };
}

module.exports = {
    digestManifest,
    summarize,
    validateManifest,
    validateCandidatePackage,
    validateMentorProgramCoverage,
    toPolicyPayload,
    EVIDENCE_EXTENSIONS
};
