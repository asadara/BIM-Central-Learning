'use strict';

const crypto = require('node:crypto');
const { authenticatedUserId } = require('../utils/canonicalIdentity');

const CALCULATION_VERSION = 'internship-completion-v1';
const STAFF_READ_ROLES = new Set(['mentor', 'admin']);
const CLOSEOUT_ROLES = new Set(['mentor', 'admin']);

class InternshipProgramProgressError extends Error {
    constructor(code, message, status = 500) {
        super(message);
        this.name = 'InternshipProgramProgressError';
        this.code = code;
        this.status = status;
    }
}

function normalizeActivityType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (type === 'reading' || type === 'article') return 'page';
    if (type === 'youtube') return 'video';
    return type;
}

function activityKeysForItem(item) {
    const rule = item.completionRule && typeof item.completionRule === 'object' ? item.completionRule : {};
    const activity = rule.activity && typeof rule.activity === 'object' ? rule.activity : {};
    const types = new Set([
        item.sourceType,
        ...(Array.isArray(activity.moduleTypes) ? activity.moduleTypes : []),
        activity.moduleType
    ].map(normalizeActivityType).filter(Boolean));
    const ids = new Set([
        item.sourceId,
        item.contentId,
        ...(Array.isArray(activity.moduleIds) ? activity.moduleIds : []),
        activity.moduleId
    ].map((value) => String(value || '').trim()).filter(Boolean));
    return new Set([...types].flatMap((type) => [...ids].map((id) => `${type}:${id}`)));
}

function publishedAssessments(definition) {
    const assessments = definition && Array.isArray(definition.assessments) ? definition.assessments : [];
    return assessments.filter((item) => item && item.quizId && (!item.status || item.status === 'published'));
}

function metric(total, completed) {
    return { total, completed, remaining: Math.max(0, total - completed) };
}

function safeNote(value) {
    const note = String(value == null ? '' : value).trim();
    if (note.length > 2000) {
        throw new InternshipProgramProgressError('CLOSEOUT_NOTE_TOO_LONG', 'Closeout note is too long', 400);
    }
    return note;
}

function createInternshipProgramProgressService({ repository, now = () => new Date() }) {
    if (!repository) throw new Error('repository is required');

    function principal(reqUser) {
        const id = authenticatedUserId(reqUser);
        if (!id) throw new InternshipProgramProgressError('INVALID_PRINCIPAL', 'Authenticated principal is required', 401);
        return { id: Number(id), isAdmin: reqUser && reqUser.isAdmin === true };
    }

    function policyPermissions(context, actor, own) {
        const review = context.policyPayload && typeof context.policyPayload.review === 'object'
            ? context.policyPayload.review : {};
        const role = actor.isAdmin ? 'system_admin' : context.actorRole;
        const activeActor = actor.isAdmin || (role && context.actorEnrollmentStatus !== 'dropped');
        if (!activeActor) {
            throw new InternshipProgramProgressError('PROGRAM_STATUS_NOT_FOUND', 'Program status not found', 404);
        }
        if (own) {
            if (context.participantRole !== 'participant' || Number(actor.id) !== Number(context.participantUserId)) {
                throw new InternshipProgramProgressError('PROGRAM_STATUS_ACCESS_DENIED', 'Program status access denied', 403);
            }
        } else {
            const staffReader = actor.isAdmin || STAFF_READ_ROLES.has(role)
                || (role === 'reviewer' && review.allowReviewerRole !== false)
                || (role === 'hc_observer' && review.allowObserverRead === true);
            if (!staffReader) {
                throw new InternshipProgramProgressError('PROGRAM_STATUS_ACCESS_DENIED', 'Program status access denied', 403);
            }
        }
        return {
            role,
            canCloseProgram: !own && (actor.isAdmin || CLOSEOUT_ROLES.has(role)),
            canReadProgramStatus: true
        };
    }

    function integrityIssue(code, label) {
        return { code, scope: 'system', label };
    }

    function participantBlocker(code, label) {
        return { code, scope: 'participant', label };
    }

    async function evaluate(batchId, participantUserId, reqUser, options = {}) {
        const actor = principal(reqUser);
        const targetId = Number(participantUserId);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            throw new InternshipProgramProgressError('INVALID_PARTICIPANT_ID', 'Invalid participant ID', 400);
        }
        const queryable = options.queryable;
        const context = await repository.getProgramProgressContext(
            batchId, actor.id, targetId, queryable, options.lock === true
        );
        if (!context || context.programType !== 'internship'
            || context.participantRole !== 'participant'
            || context.participantEnrollmentStatus === 'dropped') {
            throw new InternshipProgramProgressError('PROGRAM_STATUS_NOT_FOUND', 'Program status not found', 404);
        }
        context.participantUserId = targetId;
        const own = actor.id === targetId;
        const permissions = policyPermissions(context, actor, own);
        const policy = context.policyPayload && typeof context.policyPayload === 'object'
            ? context.policyPayload : {};
        const manifest = Array.isArray(policy.assignments) ? policy.assignments : [];
        const assignmentIds = manifest.map((item) => String(item && item.assignmentId || '')).filter(Boolean);
        const [modules, activityRows, quizRows, assignmentRows] = await Promise.all([
            repository.getPathModules(context.learningPathVersionId, queryable),
            repository.getCompletedActivityEvidence(targetId, queryable),
            repository.getVerifiedQuizEvidence(
                targetId,
                publishedAssessments(context.learningPathDefinition).map((item) => String(item.quizId)),
                queryable
            ),
            repository.listProgramAssignmentStates(batchId, targetId, assignmentIds, queryable)
        ]);

        const integrityIssues = [];
        if (context.policyStatus !== 'frozen') {
            integrityIssues.push(integrityIssue('policy_not_frozen', 'Program policy is not frozen.'));
        }
        if (context.policyChecksumValid !== true) {
            integrityIssues.push(integrityIssue('policy_checksum_invalid', 'Program policy integrity check failed.'));
        }
        if (policy.contractVersion !== CALCULATION_VERSION) {
            integrityIssues.push(integrityIssue('policy_contract_unsupported', 'Program policy contract is unsupported.'));
        }
        if (String(policy.learningPathVersionId || '') !== String(context.learningPathVersionId)) {
            integrityIssues.push(integrityIssue('learning_manifest_mismatch', 'Frozen learning requirement does not match the batch.'));
        }

        const activityEvidence = new Set(activityRows.map((row) =>
            `${normalizeActivityType(row.moduleType)}:${String(row.moduleId)}`));
        const verifiedQuizzes = new Set(quizRows.map((row) => String(row.quizId)));
        let learningRequired = 0;
        let learningCompleted = 0;
        let learningOptional = 0;
        let learningOptionalCompleted = 0;
        const moduleKeys = new Set();

        for (const module of modules) {
            moduleKeys.add(String(module.moduleKey));
            for (const item of Array.isArray(module.items) ? module.items : []) {
                const required = item.requirementType === 'required';
                if (required) learningRequired += 1;
                else learningOptional += 1;
                const available = module.status === 'active'
                    && item.mappingStatus === 'approved' && item.contentStatus === 'active';
                if (required && !available) {
                    integrityIssues.push(integrityIssue(
                        'required_learning_unavailable',
                        'A frozen required learning item is unavailable.'
                    ));
                }
                const completed = available
                    && [...activityKeysForItem(item)].some((key) => activityEvidence.has(key));
                if (completed && required) learningCompleted += 1;
                if (completed && !required) learningOptionalCompleted += 1;
            }
        }

        for (const assessment of publishedAssessments(context.learningPathDefinition)) {
            const required = assessment.required !== false;
            if (required) learningRequired += 1;
            else learningOptional += 1;
            if (assessment.moduleKey && !moduleKeys.has(String(assessment.moduleKey)) && required) {
                integrityIssues.push(integrityIssue(
                    'required_quiz_unavailable',
                    'A frozen required quiz is not attached to an active learning module.'
                ));
            }
            const completed = verifiedQuizzes.has(String(assessment.quizId));
            if (completed && required) learningCompleted += 1;
            if (completed && !required) learningOptionalCompleted += 1;
        }
        if (learningRequired === 0) {
            integrityIssues.push(integrityIssue(
                'required_learning_manifest_empty', 'No required learning item is frozen for this program.'
            ));
        }

        if (!Array.isArray(policy.assignments)) {
            integrityIssues.push(integrityIssue('assignment_manifest_invalid', 'Required assignment manifest is invalid.'));
        }
        const requiredManifest = manifest.filter((item) => item && item.requirementType === 'required');
        const optionalManifest = manifest.filter((item) => item && item.requirementType === 'optional');
        if (requiredManifest.length === 0) {
            integrityIssues.push(integrityIssue('required_assignment_manifest_empty', 'No required assignment is frozen for this program.'));
        }
        const rowsById = new Map(assignmentRows.map((row) => [String(row.assignmentId), row]));
        let submitted = 0;
        let accepted = 0;
        let optionalSubmitted = 0;
        let optionalAccepted = 0;
        let revisionRequired = 0;
        let notSubmitted = 0;
        let revisionCount = 0;
        let hasAssignmentActivity = false;
        const blockers = [];

        for (const item of manifest) {
            if (!item || !item.assignmentId || !['required', 'optional'].includes(item.requirementType)) {
                integrityIssues.push(integrityIssue('assignment_manifest_invalid', 'An assignment manifest entry is invalid.'));
                continue;
            }
            const row = rowsById.get(String(item.assignmentId));
            const required = item.requirementType === 'required';
            if (!row || row.assignmentExists !== true) {
                integrityIssues.push(integrityIssue('required_assignment_missing', 'A frozen assignment no longer exists.'));
                continue;
            }
            if (!['published', 'closed'].includes(row.assignmentStatus) || row.participantVisibility !== 'visible') {
                integrityIssues.push(integrityIssue('required_assignment_unavailable', 'A frozen assignment is unavailable.'));
            }
            if (String(row.definitionDigest || '') !== String(item.definitionDigest || '')) {
                integrityIssues.push(integrityIssue('assignment_definition_changed', 'A frozen assignment definition has changed.'));
            }
            const isSubmitted = row.submissionState === 'submitted';
            const isAccepted = isSubmitted && row.reviewState === 'accepted' && row.reviewDecision === 'accepted';
            hasAssignmentActivity ||= Boolean(row.submissionId || row.submissionState);
            revisionCount += Math.max(0, Number(row.revisionCount || 0) - 1);
            if (required) {
                if (isSubmitted) submitted += 1;
                if (isAccepted) accepted += 1;
                if (!isSubmitted) {
                    notSubmitted += 1;
                    blockers.push(participantBlocker(
                        'required_assignment_not_submitted', `${item.label || 'Required assignment'} has not been submitted.`
                    ));
                }
                else if (!isAccepted) blockers.push(participantBlocker(
                    row.reviewState === 'revision_requested' ? 'required_assignment_revision_requested' : 'required_assignment_not_accepted',
                    row.reviewState === 'revision_requested'
                        ? `${item.label || 'Required assignment'} needs revision.`
                        : `${item.label || 'Required assignment'} is awaiting acceptance.`
                ));
                if (row.reviewState === 'revision_requested') revisionRequired += 1;
            } else {
                if (isSubmitted) optionalSubmitted += 1;
                if (isAccepted) optionalAccepted += 1;
            }
        }

        if (learningCompleted < learningRequired) {
            blockers.unshift(participantBlocker(
                'required_learning_incomplete',
                `${learningRequired - learningCompleted} required learning item(s) remain.`
            ));
        }
        const endDate = context.endDate ? new Date(context.endDate) : null;
        const periodElapsed = endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() < now().getTime();
        const requirementsMet = integrityIssues.length === 0
            && learningRequired > 0
            && learningCompleted === learningRequired
            && accepted === requiredManifest.length;
        if (periodElapsed && !requirementsMet && !context.closeoutId) {
            blockers.push({ code: 'program_period_elapsed', scope: 'operational', label: 'Program period has ended; requirements remain open.' });
        }

        let status = 'in_progress';
        if (context.closeoutId) status = 'completed';
        else if (requirementsMet) status = 'requirements_met';
        else if (learningCompleted === 0 && !hasAssignmentActivity) status = 'not_started';

        return {
            program: {
                id: context.id,
                code: String(context.code || ''),
                title: String(context.title || 'Internship Program'),
                startDate: context.startDate || null,
                endDate: context.endDate || null
            },
            participant: {
                userId: String(targetId),
                displayName: String(context.participantDisplayName || 'BCL participant')
            },
            status,
            requirementsMet: status === 'completed' ? true : requirementsMet,
            dimensions: {
                learning: { required: metric(learningRequired, learningCompleted), optional: metric(learningOptional, learningOptionalCompleted) },
                submitted: { required: metric(requiredManifest.length, submitted), optional: metric(optionalManifest.length, optionalSubmitted) },
                accepted: { required: metric(requiredManifest.length, accepted), optional: metric(optionalManifest.length, optionalAccepted) }
            },
            assignments: {
                required: requiredManifest.length,
                submitted,
                accepted,
                revisionRequired,
                notSubmitted
            },
            revisionCount,
            blockers: status === 'completed' ? [] : blockers,
            integrityIssues,
            periodElapsed: Boolean(periodElapsed),
            policy: {
                versionId: context.policyVersionId,
                calculationVersion: CALCULATION_VERSION,
                immutable: context.policyStatus === 'frozen'
            },
            closeout: context.closeoutId ? {
                closeoutId: String(context.closeoutId),
                completedAt: context.completedAt,
                completedBy: { displayName: String(context.completedByDisplayName || 'BCL administrator') },
                note: String(context.closeoutNote || '')
            } : null,
            certificateEligible: Boolean(context.closeoutId),
            permissions: {
                ...permissions,
                canCloseProgram: permissions.canCloseProgram && status === 'requirements_met'
            },
            authority: 'server-derived',
            readOnly: true
        };
    }

    async function getOwnStatus(batchId, reqUser) {
        const actor = principal(reqUser);
        return evaluate(batchId, actor.id, reqUser);
    }

    async function getParticipantStatus(batchId, participantUserId, reqUser) {
        return evaluate(batchId, participantUserId, reqUser);
    }

    async function listParticipantStatuses(batchId, reqUser) {
        const participants = await repository.listProgramParticipants(batchId);
        if (participants.length === 0) {
            throw new InternshipProgramProgressError('PROGRAM_STATUS_NOT_FOUND', 'Program status not found', 404);
        }
        const statuses = [];
        for (const participant of participants) {
            statuses.push(await evaluate(batchId, participant.userId, reqUser));
        }
        return { batchId, participants: statuses, authority: 'server-derived' };
    }

    async function completeProgram(batchId, participantUserId, reqUser, payload = {}) {
        const actor = principal(reqUser);
        const closeoutNote = safeNote(payload.closeoutNote);
        return repository.withTransaction(async (client) => {
            const authorization = await repository.getProgramProgressContext(
                batchId, actor.id, Number(participantUserId), client, true
            );
            const closeoutRole = actor.isAdmin ? 'system_admin' : authorization && authorization.actorRole;
            const closeoutAuthorized = Boolean(authorization)
                && (actor.isAdmin || (authorization.actorEnrollmentStatus !== 'dropped' && CLOSEOUT_ROLES.has(closeoutRole)));
            if (!closeoutAuthorized) {
                throw new InternshipProgramProgressError('PROGRAM_CLOSEOUT_ACCESS_DENIED', 'Program closeout access denied', 403);
            }
            const current = await evaluate(batchId, participantUserId, reqUser, { queryable: client, lock: true });
            if (current.status === 'completed') return { ...current, idempotent: true };
            if (current.status !== 'requirements_met' || current.integrityIssues.length > 0) {
                throw new InternshipProgramProgressError(
                    'PROGRAM_REQUIREMENTS_NOT_MET', 'Program requirements are not met', 409
                );
            }
            const snapshot = {
                status: current.status,
                dimensions: current.dimensions,
                policyVersionId: current.policy.versionId,
                calculationVersion: current.policy.calculationVersion
            };
            const requirementsDigest = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
            const result = await repository.createProgramCloseout(client, {
                batchId,
                participantUserId: Number(participantUserId),
                policyVersionId: current.policy.versionId,
                actorUserId: actor.id,
                closeoutNote,
                requirementsDigest,
                requirementsSnapshot: snapshot
            });
            const completed = await evaluate(batchId, participantUserId, reqUser, { queryable: client, lock: true });
            return { ...completed, idempotent: result.created !== true };
        });
    }

    return {
        completeProgram,
        evaluate,
        getOwnStatus,
        getParticipantStatus,
        listParticipantStatuses
    };
}

module.exports = {
    CALCULATION_VERSION,
    InternshipProgramProgressError,
    activityKeysForItem,
    createInternshipProgramProgressService,
    publishedAssessments
};
