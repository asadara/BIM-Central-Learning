'use strict';

const { authenticatedUserId } = require('../utils/canonicalIdentity');

const REVIEW_STATES = Object.freeze(['not_started', 'under_review', 'revision_requested', 'accepted']);
const REVIEW_DECISIONS = new Set(['revision_requested', 'accepted']);
const REVIEW_WRITER_ROLES = new Set(['mentor', 'admin']);

class InternshipReviewError extends Error {
    constructor(code, message, status = 500) {
        super(message);
        this.name = 'InternshipReviewError';
        this.code = code;
        this.status = status;
    }
}

function safeText(value, maxLength = 5000) {
    const text = String(value == null ? '' : value).trim();
    if (text.length > maxLength) {
        throw new InternshipReviewError('REVIEW_TEXT_TOO_LONG', 'Review text exceeds the allowed length', 400);
    }
    return text;
}

function safeEvidence(row) {
    return {
        evidenceId: String(row.evidenceId || row.id),
        submissionId: String(row.submissionId || row.submission_id),
        safeDisplayName: String(row.safeDisplayName || row.safe_display_name || row.file_name || ''),
        mimeType: String(row.mimeType || row.mime_type || row.file_type || ''),
        sizeBytes: Number(row.sizeBytes ?? row.file_size ?? 0),
        uploadedAt: row.uploadedAt || row.uploaded_at || null,
        classification: row.classification || 'internal',
        scanStatus: row.scanStatus || row.scan_status || 'pending',
        storageStatus: row.storageStatus || row.storage_status || 'quarantined'
    };
}

function rubricCriterion(row) {
    return {
        criterionId: String(row.criterionId || row.id),
        title: String(row.title || ''),
        description: String(row.description || ''),
        maxScore: Number(row.maxScore ?? row.max_score ?? 0),
        weight: Number(row.weight ?? 1),
        required: row.required !== false,
        displayOrder: Number(row.displayOrder ?? row.sortOrder ?? row.sort_order ?? 0)
    };
}

function reviewScore(row, includeComment = true) {
    const result = {
        criterionId: String(row.criterionId || row.criterion_id),
        score: Number(row.score),
        updatedAt: row.updatedAt || row.updated_at || null
    };
    if (includeComment) result.comment = String(row.comment || '');
    return result;
}

function reviewState(row) {
    if (!row) return { state: 'not_started', decision: null, reviewVersion: 0 };
    return {
        reviewId: String(row.reviewId || row.id),
        state: row.state,
        decision: row.decision || null,
        submissionRevision: Number(row.submissionRevision ?? row.submission_revision ?? 1),
        reviewVersion: Number(row.reviewVersion ?? row.review_version ?? 1),
        startedAt: row.startedAt || row.started_at || null,
        decidedAt: row.decidedAt || row.decided_at || null,
        updatedAt: row.updatedAt || row.updated_at || null
    };
}

function createInternshipReviewService({ repository, evidenceService = null }) {
    if (!repository) throw new Error('repository is required');

    function principal(reqUser) {
        const id = authenticatedUserId(reqUser);
        if (!id) throw new InternshipReviewError('INVALID_PRINCIPAL', 'Authenticated principal is required', 401);
        return { id: Number(id), isAdmin: reqUser && reqUser.isAdmin === true };
    }

    function policy(context) {
        const configured = context && context.policy && typeof context.policy.review === 'object'
            ? context.policy.review : {};
        return {
            allowReviewerRole: configured.allowReviewerRole !== false,
            allowObserverRead: configured.allowObserverRead === true,
            requireAllCriteria: configured.requireAllCriteria !== false
        };
    }

    async function authorizedContext(batchId, reqUser, { write = false } = {}) {
        const actor = principal(reqUser);
        const context = await repository.getBatchContext(batchId, actor.id);
        if (!context || context.programType !== 'internship') {
            throw new InternshipReviewError('REVIEW_SCOPE_NOT_FOUND', 'Review scope not found', 404);
        }
        const reviewPolicy = policy(context);
        let role = context.role;
        if (actor.isAdmin) role = 'system_admin';
        if (role !== 'system_admin' && (!role || context.enrollmentStatus === 'dropped')) {
            throw new InternshipReviewError('REVIEW_SCOPE_NOT_FOUND', 'Review scope not found', 404);
        }
        const writer = role === 'system_admin' || REVIEW_WRITER_ROLES.has(role)
            || (role === 'reviewer' && reviewPolicy.allowReviewerRole);
        const reader = writer || (role === 'hc_observer' && reviewPolicy.allowObserverRead);
        if ((write && !writer) || (!write && !reader)) {
            throw new InternshipReviewError('REVIEW_ACCESS_DENIED', 'Review access denied', 403);
        }
        return { actor, context, policy: reviewPolicy, role };
    }

    async function reviewTarget(batchId, submissionId, reqUser, options = {}) {
        const authorized = await authorizedContext(batchId, reqUser, options);
        const requestedRevision = options.write ? null : options.revisionNo || null;
        const target = await repository.getReviewSubmission(batchId, submissionId, requestedRevision);
        if (!target) throw new InternshipReviewError('REVIEW_SUBMISSION_NOT_FOUND', 'Submission not found', 404);
        if (target.submissionStatus !== 'submitted') {
            throw new InternshipReviewError('REVIEW_SUBMISSION_NOT_SUBMITTED', 'Only a submitted revision can be reviewed', 409);
        }
        return { ...authorized, target };
    }

    function queueItem(row) {
        return {
            submissionId: String(row.submissionId),
            participant: { displayName: String(row.participantDisplayName || 'BCL participant') },
            assignment: { title: String(row.assignmentTitle || '') },
            submittedAt: row.submittedAt || null,
            reviewState: row.reviewState || 'not_started',
            revisionNo: Number(row.submissionRevision || 1)
        };
    }

    async function listReviewQueue(batchId, reqUser) {
        await authorizedContext(batchId, reqUser);
        const rows = await repository.listReviewQueue(batchId);
        return { batchId, data: rows.map(queueItem), authority: 'server' };
    }

    async function reviewerDetail(batchId, submissionId, reqUser, options = {}) {
        const { actor, target } = await reviewTarget(batchId, submissionId, reqUser, options);
        const revisionNo = Number(target.submissionRevision || 1);
        const [criteriaRows, evidenceRows, scoreRows, commentRows, learningRows] = await Promise.all([
            repository.listReviewCriteria(batchId, target.assignmentId),
            repository.listReviewEvidence(batchId, submissionId, revisionNo),
            repository.listReviewScores(submissionId, revisionNo),
            repository.listReviewComments(submissionId, revisionNo, true),
            typeof repository.listReviewLearningContext === 'function'
                ? repository.listReviewLearningContext(target.assignmentId) : Promise.resolve([])
        ]);
        const state = reviewState(target.review);
        return {
            submission: {
                submissionId: String(target.submissionId),
                state: target.submissionStatus,
                revisionNo,
                submittedAt: target.submittedAt || null,
                participant: {
                    userId: String(target.participantUserId),
                    displayName: String(target.participantDisplayName || 'BCL participant')
                },
                assignment: {
                    assignmentId: String(target.assignmentId),
                    title: String(target.assignmentTitle || ''),
                    topic: String(target.topicTitle || ''),
                    brief: String(target.assignmentBrief || ''),
                    requiredDeliverable: String(target.requiredDeliverable || ''),
                    relatedLearning: learningRows.map((row) => ({
                        relationship: row.relationship,
                        title: String(row.title || '')
                    }))
                },
                program: {
                    code: String(target.programCode || ''),
                    title: String(target.programTitle || '')
                },
                evidence: evidenceRows.map(safeEvidence)
            },
            rubric: criteriaRows.map(rubricCriterion),
            review: {
                ...state,
                reviewer: target.review ? {
                    userId: String(target.review.reviewerUserId || target.review.reviewer_user_id),
                    displayName: String(target.review.reviewerDisplayName || target.review.reviewer_display_name || 'BCL reviewer')
                } : null,
                participantFeedback: String(target.review && (target.review.participantFeedback || target.review.participant_feedback) || ''),
                internalNote: String(target.review && (target.review.internalNote || target.review.internal_note) || ''),
                scores: scoreRows.map((row) => reviewScore(row, true)),
                feedbackHistory: commentRows.map((row) => ({
                    visibility: row.visibility,
                    body: String(row.body || ''),
                    createdAt: row.createdAt || row.created_at || null
                }))
            },
            permissions: {
                canStartReview: state.state === 'not_started',
                canMutateReview: state.state === 'under_review'
                    && Number(target.review && (target.review.reviewerUserId || target.review.reviewer_user_id)) === actor.id
            },
            authority: 'server',
            learningProgressUnchanged: true
        };
    }

    async function startReview(batchId, submissionId, reqUser) {
        const { actor, target } = await reviewTarget(batchId, submissionId, reqUser, { write: true });
        const result = await repository.startSubmissionReview({
            batchId,
            submissionId,
            submissionRevision: Number(target.submissionRevision || 1),
            reviewerUserId: actor.id
        });
        if (result.outcome === 'claimed') {
            throw new InternshipReviewError('REVIEW_ALREADY_CLAIMED', 'This review is active with another reviewer', 409);
        }
        if (result.outcome === 'terminal') {
            throw new InternshipReviewError('REVIEW_STATE_CONFLICT', 'A decided review cannot be restarted', 409);
        }
        return { review: reviewState(result.review), created: result.outcome === 'started' };
    }

    function expectedVersion(payload) {
        const value = Number(payload && payload.reviewVersion);
        if (!Number.isInteger(value) || value <= 0) {
            throw new InternshipReviewError('REVIEW_VERSION_REQUIRED', 'A valid reviewVersion is required', 400);
        }
        return value;
    }

    function normalizeScores(payload, criteriaRows) {
        const items = Array.isArray(payload && payload.scores) ? payload.scores : [];
        const criteria = new Map(criteriaRows.map((row) => {
            const item = rubricCriterion(row);
            return [item.criterionId, item];
        }));
        const seen = new Set();
        return items.map((item) => {
            const criterionId = String(item && (item.criterionId || item.criterion_id) || '');
            const criterion = criteria.get(criterionId);
            if (!criterion) throw new InternshipReviewError('REVIEW_CRITERION_INVALID', 'Review criterion is outside this assignment rubric', 400);
            if (seen.has(criterionId)) throw new InternshipReviewError('REVIEW_SCORE_DUPLICATE', 'Duplicate criterion score', 400);
            seen.add(criterionId);
            const score = Number(item.score);
            if (!Number.isFinite(score) || score < 0 || score > criterion.maxScore) {
                throw new InternshipReviewError('REVIEW_SCORE_OUT_OF_RANGE', 'Review score is outside the criterion range', 400);
            }
            return { criterionId, score, comment: safeText(item.comment, 5000) };
        });
    }

    async function saveReview(batchId, submissionId, reqUser, payload = {}) {
        const { actor, target } = await reviewTarget(batchId, submissionId, reqUser, { write: true });
        const criteriaRows = await repository.listReviewCriteria(batchId, target.assignmentId);
        const scores = normalizeScores(payload, criteriaRows);
        const fields = {
            participantFeedbackPresent: Object.hasOwn(payload, 'participantFeedback'),
            internalNotePresent: Object.hasOwn(payload, 'internalNote'),
            participantFeedback: safeText(payload.participantFeedback, 5000),
            internalNote: safeText(payload.internalNote, 5000)
        };
        const result = await repository.saveSubmissionReview({
            submissionId,
            submissionRevision: Number(target.submissionRevision || 1),
            reviewerUserId: actor.id,
            expectedVersion: expectedVersion(payload),
            scores,
            ...fields
        });
        if (result.outcome === 'not_owner') throw new InternshipReviewError('REVIEW_ALREADY_CLAIMED', 'This review belongs to another reviewer', 409);
        if (result.outcome === 'terminal') throw new InternshipReviewError('REVIEW_STATE_CONFLICT', 'A decided review cannot be edited', 409);
        if (result.outcome !== 'updated') throw new InternshipReviewError('REVIEW_VERSION_CONFLICT', 'Review data is stale', 409);
        return { review: reviewState(result.review) };
    }

    async function makeDecision(batchId, submissionId, reqUser, payload = {}) {
        const decision = String(payload.decision || '');
        if (!REVIEW_DECISIONS.has(decision)) {
            throw new InternshipReviewError('REVIEW_DECISION_INVALID', 'Decision must be accepted or revision_requested', 400);
        }
        const { actor, target, policy: reviewPolicy } = await reviewTarget(batchId, submissionId, reqUser, { write: true });
        const revisionNo = Number(target.submissionRevision || 1);
        const [criteriaRows, scoreRows] = await Promise.all([
            repository.listReviewCriteria(batchId, target.assignmentId),
            repository.listReviewScores(submissionId, revisionNo)
        ]);
        if (reviewPolicy.requireAllCriteria) {
            const required = criteriaRows.map(rubricCriterion).filter((item) => item.required);
            if (required.length === 0) {
                throw new InternshipReviewError('REVIEW_RUBRIC_REQUIRED', 'An assignment rubric is required before decision', 409);
            }
            const scored = new Set(scoreRows.map((row) => String(row.criterionId || row.criterion_id)));
            if (required.some((criterion) => !scored.has(criterion.criterionId))) {
                throw new InternshipReviewError('REVIEW_REQUIRED_SCORES_MISSING', 'Required rubric scores are incomplete', 409);
            }
        }
        const result = await repository.decideSubmissionReview({
            submissionId,
            submissionRevision: revisionNo,
            reviewerUserId: actor.id,
            expectedVersion: expectedVersion(payload),
            decision
        });
        if (result.outcome === 'not_owner') throw new InternshipReviewError('REVIEW_ALREADY_CLAIMED', 'This review belongs to another reviewer', 409);
        if (result.outcome === 'terminal') throw new InternshipReviewError('REVIEW_STATE_CONFLICT', 'The review already has a decision', 409);
        if (result.outcome !== 'decided') throw new InternshipReviewError('REVIEW_VERSION_CONFLICT', 'Review data is stale', 409);
        return { review: reviewState(result.review) };
    }

    async function getParticipantReview(batchId, assignmentId, reqUser) {
        const actor = principal(reqUser);
        const context = await repository.getBatchContext(batchId, actor.id);
        if (!context || context.programType !== 'internship' || context.role !== 'participant'
            || context.enrollmentStatus === 'dropped') {
            throw new InternshipReviewError('REVIEW_SCOPE_NOT_FOUND', 'Review scope not found', 404);
        }
        const submission = await repository.getParticipantReviewSubmission(batchId, assignmentId, actor.id);
        if (!submission) return { submissionId: null, review: reviewState(null), revisionHistory: [] };
        const revisionNo = Number(submission.submissionRevision || 1);
        const [review, historyRows] = await Promise.all([
            repository.getSubmissionReview(submission.id, revisionNo),
            typeof repository.listParticipantRevisionHistory === 'function'
                ? repository.listParticipantRevisionHistory(batchId, assignmentId, actor.id)
                : Promise.resolve([])
        ]);
        const terminal = REVIEW_DECISIONS.has(review && review.state);
        const terminalHistory = historyRows.filter((row) => REVIEW_DECISIONS.has(row.reviewState));
        const needRubric = terminal || terminalHistory.length > 0;
        const criteriaRows = needRubric ? await repository.listReviewCriteria(batchId, assignmentId) : [];
        const scoreRows = terminal ? await repository.listReviewScores(submission.id, revisionNo) : [];
        const historyScores = await Promise.all(terminalHistory.map(async (row) => [
            Number(row.revisionNo),
            await repository.listReviewScores(submission.id, Number(row.revisionNo))
        ]));
        const scoresByRevision = new Map(historyScores);
        return {
            submissionId: String(submission.id),
            submissionState: submission.status,
            revisionNo,
            canCreateRevision: Boolean(review && review.state === 'revision_requested' && submission.status === 'submitted'),
            review: {
                ...reviewState(review),
                participantFeedback: terminal ? String(review.participantFeedback || review.participant_feedback || '') : '',
                rubric: terminal ? criteriaRows.map(rubricCriterion) : [],
                scores: terminal ? scoreRows.map((row) => reviewScore(row, false)) : []
            },
            revisionHistory: historyRows.map((row) => {
                const rowTerminal = REVIEW_DECISIONS.has(row.reviewState);
                return {
                    revisionNo: Number(row.revisionNo),
                    submissionState: row.submissionState,
                    reviewState: row.reviewState,
                    submittedAt: row.submittedAt || null,
                    decidedAt: row.decidedAt || null,
                    isCurrent: row.isCurrent === true,
                    participantFeedback: rowTerminal ? String(row.participantFeedback || '') : '',
                    rubric: rowTerminal ? criteriaRows.map(rubricCriterion) : [],
                    scores: rowTerminal
                        ? (scoresByRevision.get(Number(row.revisionNo)) || []).map((item) => reviewScore(item, false))
                        : []
                };
            })
        };
    }

    async function getReviewerEvidence(batchId, submissionId, evidenceId, reqUser, options = {}) {
        const { target } = await reviewTarget(batchId, submissionId, reqUser, options);
        const record = await repository.getReviewEvidenceRecord(
            batchId,
            submissionId,
            Number(target.submissionRevision || 1),
            evidenceId
        );
        if (!record) throw new InternshipReviewError('REVIEW_EVIDENCE_NOT_FOUND', 'Evidence not found', 404);
        if (!evidenceService || typeof evidenceService.readReleasedEvidence !== 'function') {
            throw new InternshipReviewError('REVIEW_EVIDENCE_UNAVAILABLE', 'Evidence access is unavailable', 503);
        }
        return evidenceService.readReleasedEvidence(record);
    }

    return {
        getParticipantReview,
        getReviewerEvidence,
        getReviewDetail: reviewerDetail,
        listReviewQueue,
        makeDecision,
        saveReview,
        startReview
    };
}

module.exports = {
    InternshipReviewError,
    REVIEW_DECISIONS,
    REVIEW_STATES,
    createInternshipReviewService,
    safeEvidence
};
