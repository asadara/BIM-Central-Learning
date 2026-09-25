const { authenticatedUserId } = require('../utils/canonicalIdentity');
const { ContentReferenceError } = require('./canonicalLearningContentResolver');
const { toSafeEvidenceMetadata } = require('./internshipEvidenceService');

const CALCULATION_VERSION = 'internship-progress-v1';
const STAFF_ROLES = new Set(['mentor', 'reviewer', 'admin', 'hc_observer']);
const PARTICIPANT_VISIBLE_BATCH_STATUSES = new Set(['active', 'completed']);

class InternshipServiceError extends Error {
    constructor(code, message, status = 500) {
        super(message);
        this.name = 'InternshipServiceError';
        this.code = code;
        this.status = status;
    }
}

function safeText(value, fallback = '') {
    const text = String(value == null ? '' : value).trim();
    if (!text || /(?:\\\\|file:\/\/|[a-z]:[\\/])/i.test(text)) return fallback;
    return text;
}

function safeLearningHref(value) {
    const href = safeText(value);
    if (!href || !href.startsWith('/') || href.startsWith('//') || href.includes('\\') || href.includes('..')) return null;
    try {
        const parsed = new URL(href, 'https://bcl.invalid');
        const allowed = parsed.origin === 'https://bcl.invalid' && [
            '/pages/', '/elearning-assets/', '/public/reader.html'
        ].some((prefix) => parsed.pathname.startsWith(prefix));
        return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
    } catch (_) {
        return null;
    }
}

function numericPercent(completed, total) {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function normalizeActivityType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (type === 'reading' || type === 'article') return 'page';
    if (type === 'youtube') return 'video';
    return type;
}

function activityKeysForItem(item, reference) {
    const rule = item.completionRule && typeof item.completionRule === 'object' ? item.completionRule : {};
    const activity = rule.activity && typeof rule.activity === 'object' ? rule.activity : {};
    const types = new Set([
        reference.type,
        ...(Array.isArray(activity.moduleTypes) ? activity.moduleTypes : []),
        activity.moduleType
    ].map(normalizeActivityType).filter(Boolean));
    const ids = new Set([
        item.sourceId,
        item.contentId,
        ...(Array.isArray(activity.moduleIds) ? activity.moduleIds : []),
        activity.moduleId
    ].map((value) => String(value || '').trim()).filter(Boolean));
    const keys = new Set();
    for (const type of types) for (const id of ids) keys.add(`${type}:${id}`);
    return keys;
}

function publishedAssessments(definition) {
    const assessments = definition && Array.isArray(definition.assessments) ? definition.assessments : [];
    return assessments.filter((item) => item && item.quizId && (!item.status || item.status === 'published'));
}

function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function deriveAssignmentAvailability(assignment, learningReferences, policy = {}, now = new Date()) {
    const timestamp = validDate(now) || new Date();
    const dueAt = validDate(assignment && assignment.dueAt);
    const availableAt = validDate(assignment && assignment.availableAt);
    const closeAtDueDate = policy && policy.assignments && policy.assignments.closeAtDueDate === true;

    if (assignment && assignment.status === 'closed'
        || (closeAtDueDate && dueAt && dueAt.getTime() <= timestamp.getTime())) return 'closed';
    if (availableAt && availableAt.getTime() > timestamp.getTime()) return 'upcoming';

    const prerequisites = (Array.isArray(learningReferences) ? learningReferences : [])
        .filter((reference) => reference.relationship === 'prerequisite');
    if (prerequisites.some((reference) => reference.completed !== true)) return 'locked';
    return 'available';
}

function createInternshipProgramService({ repository, contentResolver, evidenceService = null }) {
    if (!repository) throw new Error('repository is required');
    if (!contentResolver || typeof contentResolver.toClientReference !== 'function') {
        throw new Error('contentResolver is required');
    }

    function principal(reqUser) {
        const id = authenticatedUserId(reqUser);
        if (!id) throw new InternshipServiceError('INVALID_PRINCIPAL', 'Authenticated principal has no canonical user ID', 401);
        return { id: Number(id), isAdmin: reqUser.isAdmin === true };
    }

    function authorizeContext(context, actor) {
        if (!context || context.programType !== 'internship') {
            throw new InternshipServiceError('INTERNSHIP_NOT_FOUND', 'Internship program not found', 404);
        }
        if (context.versionStatus !== 'published') {
            throw new InternshipServiceError('PATH_VERSION_UNAVAILABLE', 'Internship learning path is not published', 409);
        }
        if (actor.isAdmin) return 'system_admin';
        if (!context.role || context.enrollmentStatus === 'dropped') {
            throw new InternshipServiceError('INTERNSHIP_NOT_FOUND', 'Internship program not found', 404);
        }
        if (context.role === 'participant' && !PARTICIPANT_VISIBLE_BATCH_STATUSES.has(context.status)) {
            throw new InternshipServiceError('INTERNSHIP_NOT_FOUND', 'Internship program not found', 404);
        }
        if (context.role !== 'participant' && !STAFF_ROLES.has(context.role)) {
            throw new InternshipServiceError('INTERNSHIP_ACCESS_DENIED', 'Internship access denied', 403);
        }
        return context.role;
    }

    async function loadAuthorizedContext(batchId, reqUser) {
        const actor = principal(reqUser);
        const context = await repository.getBatchContext(batchId, actor.id);
        const role = authorizeContext(context, actor);
        return { actor, context, role };
    }

    function programHeader(context, role) {
        return {
            id: context.id,
            code: safeText(context.code),
            title: safeText(context.title, 'Internship Program'),
            description: safeText(context.description),
            startDate: context.startDate || null,
            endDate: context.endDate || null,
            status: context.status,
            programType: 'internship',
            participant: {
                displayName: safeText(context.participantDisplayName, 'BCL participant')
            },
            participantRole: role,
            enrollmentStatus: context.enrollmentStatus || (role === 'system_admin' ? null : 'active'),
            learningPath: {
                id: context.learningPathId,
                title: safeText(context.learningPathTitle, context.learningPathId),
                versionId: context.learningPathVersionId,
                versionNumber: Number(context.versionNumber),
                publishedAt: context.publishedAt || null
            }
        };
    }

    async function listForPrincipal(reqUser) {
        const actor = principal(reqUser);
        const rows = await repository.listEnrollments(actor.id);
        return rows.map((row) => programHeader({ ...row, publishedAt: null }, row.role));
    }

    async function getProgram(batchId, reqUser) {
        const { context, role } = await loadAuthorizedContext(batchId, reqUser);
        const mentors = await repository.listMentors(batchId);
        return {
            ...programHeader(context, role),
            mentors: mentors.map((mentor) => ({
                displayName: safeText(mentor.displayName, 'BCL mentor'),
                role: mentor.role
            }))
        };
    }

    async function buildProjection(batchId, reqUser, authorizedContext = null) {
        const { actor, context, role } = authorizedContext || await loadAuthorizedContext(batchId, reqUser);
        const rawModules = await repository.getPathModules(context.learningPathVersionId);
        const visibleModules = rawModules.filter((module) => module.status === 'active');
        const seenContentIds = new Set();
        const modules = [];

        for (const module of visibleModules) {
            const items = [];
            const visibleItems = (Array.isArray(module.items) ? module.items : [])
                .filter((item) => item.mappingStatus === 'approved' && item.contentStatus === 'active');
            for (const item of visibleItems) {
                if (seenContentIds.has(item.contentId)) {
                    throw new ContentReferenceError(
                        'AMBIGUOUS_CONTENT_REFERENCE',
                        `Canonical content is mapped more than once in the active path: ${item.contentId}`
                    );
                }
                seenContentIds.add(item.contentId);
                const reference = contentResolver.toClientReference(item);
                items.push({
                    itemKind: 'content',
                    ...reference,
                    required: item.requirementType === 'required',
                    sequenceNumber: Number(item.sequenceNumber || 0),
                    evidenceKeys: activityKeysForItem(item, reference)
                });
            }
            modules.push({
                id: module.id,
                moduleKey: module.moduleKey,
                title: safeText(module.title, module.moduleKey),
                outcome: safeText(module.outcome),
                sequenceNumber: Number(module.sequenceNumber || 0),
                items,
                assessments: []
            });
        }

        const assessments = publishedAssessments(context.versionDefinition);
        const moduleByKey = new Map(modules.map((module) => [module.moduleKey, module]));
        for (const assessment of assessments) {
            const target = moduleByKey.get(assessment.moduleKey);
            if (!target) continue;
            target.assessments.push({
                itemKind: 'quiz',
                quizId: String(assessment.quizId),
                title: safeText(assessment.title, assessment.quizId),
                required: assessment.required !== false,
                passingScore: Number(assessment.passingScore || 0),
                href: safeLearningHref(assessment.href)
            });
        }

        const quizIds = [...new Set(assessments.map((item) => String(item.quizId)))];
        const [activities, quizEvidence] = await Promise.all([
            repository.getCompletedActivityEvidence(actor.id),
            repository.getVerifiedQuizEvidence(actor.id, quizIds)
        ]);
        const completedActivityKeys = new Set((activities || []).map((item) =>
            `${normalizeActivityType(item.moduleType)}:${String(item.moduleId || '').trim()}`
        ));
        const passedQuizById = new Map((quizEvidence || []).map((item) => [String(item.quizId), item]));

        let requiredTotal = 0;
        let requiredCompleted = 0;
        const itemProgress = [];

        for (const module of modules) {
            for (const item of module.items) {
                const completed = [...item.evidenceKeys].some((key) => completedActivityKeys.has(key));
                delete item.evidenceKeys;
                item.status = completed ? 'completed' : 'not_started';
                item.provenance = completed ? 'learning_activity_events' : null;
                if (item.required) {
                    requiredTotal += 1;
                    if (completed) requiredCompleted += 1;
                }
                itemProgress.push({ moduleKey: module.moduleKey, itemKind: item.itemKind, itemId: item.contentId, status: item.status });
            }
            for (const assessment of module.assessments) {
                const evidence = passedQuizById.get(assessment.quizId);
                assessment.status = evidence ? 'completed' : 'not_started';
                assessment.bestPercentage = evidence ? Number(evidence.bestPercentage || 0) : null;
                assessment.provenance = evidence ? 'verified_learning_attempts' : null;
                if (assessment.required) {
                    requiredTotal += 1;
                    if (evidence) requiredCompleted += 1;
                }
                itemProgress.push({ moduleKey: module.moduleKey, itemKind: assessment.itemKind, itemId: assessment.quizId, status: assessment.status });
            }

            const requiredItems = [...module.items, ...module.assessments].filter((item) => item.required);
            const completedItems = requiredItems.filter((item) => item.status === 'completed');
            module.progress = {
                required: requiredItems.length,
                completed: completedItems.length,
                percent: numericPercent(completedItems.length, requiredItems.length)
            };
        }

        return {
            program: programHeader(context, role),
            path: {
                id: context.learningPathId,
                title: safeText(context.learningPathTitle, context.learningPathId),
                level: safeText(context.learningPathLevel),
                versionId: context.learningPathVersionId,
                versionNumber: Number(context.versionNumber),
                immutableReference: true,
                modules
            },
            progress: {
                required: requiredTotal,
                completed: requiredCompleted,
                percent: numericPercent(requiredCompleted, requiredTotal),
                items: itemProgress,
                authority: 'server-evidence',
                calculationVersion: CALCULATION_VERSION,
                readOnly: true
            }
        };
    }

    async function getLearningPath(batchId, reqUser) {
        const projection = await buildProjection(batchId, reqUser);
        return { program: projection.program, path: projection.path, progress: projection.progress };
    }

    async function getProgress(batchId, reqUser) {
        const projection = await buildProjection(batchId, reqUser);
        return { programId: projection.program.id, pathVersionId: projection.path.versionId, ...projection.progress };
    }

    async function resolveAssignmentReferences(links, projection) {
        const contentById = new Map();
        const quizById = new Map();
        for (const module of projection.path.modules) {
            for (const item of module.items) contentById.set(item.contentId, item);
            for (const assessment of module.assessments) quizById.set(assessment.quizId, assessment);
        }

        const references = [];
        for (const link of links) {
            const relationship = link.relationship === 'prerequisite' ? 'prerequisite' : 'reference';
            if (link.contentId) {
                if (link.contentStatus && link.contentStatus !== 'active') {
                    throw new ContentReferenceError(
                        'UNKNOWN_CONTENT_REFERENCE',
                        'Assignment learning content is not active'
                    );
                }
                const pathItem = contentById.get(String(link.contentId));
                if (relationship === 'prerequisite' && !pathItem) {
                    throw new ContentReferenceError(
                        'UNKNOWN_CONTENT_REFERENCE',
                        'Assignment prerequisite is not part of the published Internship path'
                    );
                }
                const resolved = pathItem || await contentResolver.resolveCanonical(link.contentId);
                references.push({
                    relationship,
                    contentId: resolved.contentId,
                    type: resolved.type,
                    title: safeText(resolved.title, resolved.contentId),
                    href: resolved.href,
                    completed: pathItem ? pathItem.status === 'completed' : null
                });
                continue;
            }

            const assessment = quizById.get(String(link.quizId || ''));
            if (!assessment) {
                throw new ContentReferenceError(
                    'UNKNOWN_CONTENT_REFERENCE',
                    'Assignment quiz reference is not part of the published Internship path'
                );
            }
            references.push({
                relationship,
                quizId: assessment.quizId,
                type: 'quiz',
                title: safeText(assessment.title, assessment.quizId),
                href: assessment.href || null,
                completed: assessment.status === 'completed'
            });
        }
        return references;
    }

    async function assignmentProjection(batchId, reqUser, assignmentId = null, now = new Date(), authorizedContext = null) {
        const authorized = authorizedContext || await loadAuthorizedContext(batchId, reqUser);
        const projection = await buildProjection(batchId, reqUser, authorized);
        const assignments = await repository.listParticipantAssignments(batchId, assignmentId);
        const links = await repository.listAssignmentLearningLinks(assignments.map((assignment) => assignment.id));
        const linksByAssignment = new Map();
        for (const link of links) {
            if (!linksByAssignment.has(link.classworkId)) linksByAssignment.set(link.classworkId, []);
            linksByAssignment.get(link.classworkId).push(link);
        }

        const visibleAssignments = [];
        for (const assignment of assignments) {
            try {
                const learningReferences = await resolveAssignmentReferences(
                    linksByAssignment.get(assignment.id) || [],
                    projection
                );
                visibleAssignments.push({
                    assignmentId: String(assignment.id),
                    title: safeText(assignment.title, 'Tugas Praktik'),
                    brief: safeText(assignment.brief),
                    topic: assignment.topicId ? {
                        id: String(assignment.topicId),
                        title: safeText(assignment.topicTitle, 'Tahap Program'),
                        description: safeText(assignment.topicDescription)
                    } : null,
                    availableAt: assignment.availableAt || null,
                    dueAt: assignment.dueAt || null,
                    state: deriveAssignmentAvailability(
                        assignment,
                        learningReferences,
                        authorized.context.policy || {},
                        now
                    ),
                    learningReferences,
                    requiredDeliverable: safeText(assignment.requiredDeliverable),
                    visibility: 'participant',
                    order: Number(assignment.sortOrder || 0)
                });
            } catch (error) {
                if (!(error instanceof ContentReferenceError)) throw error;
            }
        }

        if (assignmentId && visibleAssignments.length === 0) {
            throw new InternshipServiceError('ASSIGNMENT_NOT_FOUND', 'Internship assignment not found', 404);
        }

        const summary = { total: visibleAssignments.length, available: 0, upcoming: 0, locked: 0, closed: 0 };
        visibleAssignments.forEach((assignment) => { summary[assignment.state] += 1; });
        return {
            programId: projection.program.id,
            pathVersionId: projection.path.versionId,
            assignments: visibleAssignments,
            summary,
            authority: 'server-derived',
            readOnly: true
        };
    }

    async function getAssignments(batchId, reqUser, options = {}) {
        return assignmentProjection(batchId, reqUser, null, options.now);
    }

    async function getAssignment(batchId, assignmentId, reqUser, options = {}) {
        const result = await assignmentProjection(batchId, reqUser, assignmentId, options.now);
        const { assignments, summary: _summary, ...metadata } = result;
        return { ...metadata, assignment: assignments[0] };
    }

    function requireEvidenceService() {
        if (!evidenceService) {
            throw new InternshipServiceError('INTERNSHIP_SUBMISSIONS_DISABLED', 'Internship submissions are unavailable', 404);
        }
    }

    function submissionPolicy(context) {
        const configured = context.policy && typeof context.policy.submissions === 'object'
            ? context.policy.submissions
            : {};
        const requestedMinimum = Number(configured.minimumEvidenceCount);
        return {
            allowWithdrawal: configured.allowWithdrawal === true,
            minimumEvidenceCount: Number.isInteger(requestedMinimum) && requestedMinimum >= 0
                ? Math.min(requestedMinimum, evidenceService.maxFilesPerSubmission)
                : 1,
            requireComment: configured.requireComment === true
        };
    }

    async function submissionAssignment(batchId, assignmentId, reqUser, { requireAvailable = false, now } = {}) {
        requireEvidenceService();
        const authorized = await loadAuthorizedContext(batchId, reqUser);
        if (authorized.role !== 'participant') {
            throw new InternshipServiceError('SUBMISSION_ACCESS_DENIED', 'Only enrolled participants can use this submission', 403);
        }
        const projection = await assignmentProjection(batchId, reqUser, assignmentId, now, authorized);
        const assignment = projection.assignments[0];
        if (requireAvailable && assignment.state !== 'available') {
            throw new InternshipServiceError(
                'ASSIGNMENT_NOT_AVAILABLE',
                `Internship assignment is ${assignment.state}`,
                409
            );
        }
        return { actor: authorized.actor, assignment, context: authorized.context, policy: submissionPolicy(authorized.context) };
    }

    async function submissionResponse(batchId, assignmentId, userId, submission = undefined) {
        const row = submission === undefined
            ? await repository.getParticipantSubmission(batchId, assignmentId, userId)
            : submission;
        if (!row) return null;
        const evidence = await repository.listSubmissionEvidence(batchId, assignmentId, row.id, userId);
        return {
            submissionId: String(row.id),
            assignmentId: String(row.assignmentId),
            state: row.status,
            revisionNo: Number(row.submissionRevision || 1),
            comment: safeText(row.metadata && row.metadata.comment),
            submittedAt: row.submittedAt || null,
            withdrawnAt: row.withdrawnAt || null,
            createdAt: row.createdAt || null,
            updatedAt: row.updatedAt || null,
            evidence: evidence.map(toSafeEvidenceMetadata)
        };
    }

    async function getSubmission(batchId, assignmentId, reqUser, options = {}) {
        const { actor, assignment, policy } = await submissionAssignment(batchId, assignmentId, reqUser, options);
        return {
            assignmentId: assignment.assignmentId,
            assignmentState: assignment.state,
            submission: await submissionResponse(batchId, assignmentId, actor.id),
            withdrawalAllowed: policy.allowWithdrawal,
            authority: 'server',
            learningProgressUnchanged: true
        };
    }

    async function createDraftSubmission(batchId, assignmentId, reqUser, options = {}) {
        const { actor, context, policy } = await submissionAssignment(
            batchId,
            assignmentId,
            reqUser,
            { ...options, requireAvailable: true }
        );
        const result = await repository.createOrResumeDraft(
            batchId,
            assignmentId,
            actor.id,
            policy.allowWithdrawal
        );
        if (!result.submission || result.outcome === 'conflict') {
            throw new InternshipServiceError(
                'SUBMISSION_STATE_CONFLICT',
                'The existing submission cannot transition to Draft',
                409
            );
        }
        return {
            submission: await submissionResponse(batchId, assignmentId, actor.id, result.submission),
            created: result.outcome === 'created',
            resumed: result.outcome === 'resumed',
            withdrawalAllowed: policy.allowWithdrawal,
            programId: context.id
        };
    }

    async function updateDraftSubmission(batchId, assignmentId, reqUser, payload = {}, options = {}) {
        const { actor } = await submissionAssignment(
            batchId,
            assignmentId,
            reqUser,
            { ...options, requireAvailable: true }
        );
        const comment = String(payload.comment == null ? '' : payload.comment).trim();
        if (comment.length > 5000) {
            throw new InternshipServiceError('SUBMISSION_COMMENT_TOO_LONG', 'Submission comment is too long', 400);
        }
        const updated = await repository.updateDraftMetadata(batchId, assignmentId, actor.id, { ...(comment ? { comment } : {}) });
        if (!updated) {
            throw new InternshipServiceError('SUBMISSION_NOT_EDITABLE', 'Only a Draft submission can be edited', 409);
        }
        return submissionResponse(batchId, assignmentId, actor.id, updated);
    }

    async function evidenceAttachmentContext(batchId, assignmentId, reqUser, options = {}) {
        const { actor } = await submissionAssignment(
            batchId,
            assignmentId,
            reqUser,
            { ...options, requireAvailable: true }
        );
        const submission = await repository.getParticipantSubmission(batchId, assignmentId, actor.id);
        if (!submission || submission.status !== 'draft') {
            throw new InternshipServiceError('SUBMISSION_NOT_EDITABLE', 'Evidence may only be attached to a Draft submission', 409);
        }
        const currentEvidence = await repository.listSubmissionEvidence(batchId, assignmentId, submission.id, actor.id);
        if (currentEvidence.length >= evidenceService.maxFilesPerSubmission) {
            throw new InternshipServiceError('EVIDENCE_FILE_LIMIT', 'Submission evidence file limit reached', 409);
        }
        return { actor, submission };
    }

    async function assertCanAttachEvidence(batchId, assignmentId, reqUser, options = {}) {
        await evidenceAttachmentContext(batchId, assignmentId, reqUser, options);
        return true;
    }

    async function attachEvidence(batchId, assignmentId, reqUser, file, options = {}) {
        const { actor, submission } = await evidenceAttachmentContext(batchId, assignmentId, reqUser, options);

        const record = await evidenceService.quarantineUpload(file, {
            uploadedByUserId: actor.id,
            classification: options.classification || 'internal'
        });
        try {
            const insertion = await repository.addEvidenceToDraft(
                batchId,
                assignmentId,
                submission.id,
                actor.id,
                record,
                evidenceService.maxFilesPerSubmission
            );
            if (insertion.outcome === 'limit') {
                throw new InternshipServiceError('EVIDENCE_FILE_LIMIT', 'Submission evidence file limit reached', 409);
            }
            if (insertion.outcome !== 'inserted' || !insertion.evidence) {
                throw new InternshipServiceError('SUBMISSION_NOT_EDITABLE', 'Evidence set is frozen outside Draft state', 409);
            }
            return toSafeEvidenceMetadata(insertion.evidence);
        } catch (error) {
            await evidenceService.discardQuarantined(record).catch(() => {});
            throw error;
        }
    }

    async function removeDraftEvidence(batchId, assignmentId, evidenceId, reqUser, options = {}) {
        const { actor } = await submissionAssignment(
            batchId,
            assignmentId,
            reqUser,
            { ...options, requireAvailable: true }
        );
        const submission = await repository.getParticipantSubmission(batchId, assignmentId, actor.id);
        if (!submission || submission.status !== 'draft') {
            throw new InternshipServiceError('SUBMISSION_NOT_EDITABLE', 'Submitted evidence cannot be removed by a participant', 409);
        }
        const removed = await repository.softRemoveDraftEvidence(
            batchId,
            assignmentId,
            submission.id,
            evidenceId,
            actor.id
        );
        if (!removed) throw new InternshipServiceError('EVIDENCE_NOT_FOUND', 'Evidence not found', 404);
        return { evidenceId, removed: true, retention: 'metadata-retained' };
    }

    async function submitDraftSubmission(batchId, assignmentId, reqUser, options = {}) {
        const { actor, policy } = await submissionAssignment(
            batchId,
            assignmentId,
            reqUser,
            { ...options, requireAvailable: true }
        );
        const result = await repository.submitDraft(
            batchId,
            assignmentId,
            actor.id,
            policy.minimumEvidenceCount,
            policy.requireComment
        );
        if (result.outcome === 'missing') {
            throw new InternshipServiceError('SUBMISSION_NOT_FOUND', 'Draft submission not found', 404);
        }
        if (result.outcome === 'evidence_required') {
            throw new InternshipServiceError('SUBMISSION_EVIDENCE_REQUIRED', 'Submission does not meet its evidence requirement', 409);
        }
        if (result.outcome === 'comment_required') {
            throw new InternshipServiceError('SUBMISSION_COMMENT_REQUIRED', 'Submission comment is required', 409);
        }
        if (result.outcome !== 'submitted') {
            throw new InternshipServiceError('SUBMISSION_STATE_CONFLICT', 'Only a Draft submission can be submitted', 409);
        }
        return submissionResponse(batchId, assignmentId, actor.id, result.submission);
    }

    async function withdrawParticipantSubmission(batchId, assignmentId, reqUser, options = {}) {
        const { actor, policy } = await submissionAssignment(batchId, assignmentId, reqUser, options);
        if (!policy.allowWithdrawal) {
            throw new InternshipServiceError('SUBMISSION_WITHDRAWAL_NOT_ALLOWED', 'Submission withdrawal is not allowed by program policy', 409);
        }
        const result = await repository.withdrawSubmission(batchId, assignmentId, actor.id);
        if (result.outcome === 'missing') throw new InternshipServiceError('SUBMISSION_NOT_FOUND', 'Submission not found', 404);
        if (result.outcome !== 'withdrawn') {
            throw new InternshipServiceError('SUBMISSION_STATE_CONFLICT', 'Only a Submitted submission can be withdrawn', 409);
        }
        return submissionResponse(batchId, assignmentId, actor.id, result.submission);
    }

    async function createParticipantRevision(batchId, assignmentId, reqUser, options = {}) {
        const { actor } = await submissionAssignment(
            batchId,
            assignmentId,
            reqUser,
            { ...options, requireAvailable: true }
        );
        const result = await repository.createNextRevision(batchId, assignmentId, actor.id);
        if (result.outcome === 'missing') {
            throw new InternshipServiceError('SUBMISSION_NOT_FOUND', 'Submission not found', 404);
        }
        if (result.outcome === 'disabled') {
            throw new InternshipServiceError('SUBMISSION_REVISION_DISABLED', 'Submission revision is not enabled', 404);
        }
        if (result.outcome === 'review_conflict') {
            throw new InternshipServiceError(
                'SUBMISSION_REVISION_NOT_REQUESTED',
                'A new revision requires the latest review decision to request revision',
                409
            );
        }
        if (result.outcome !== 'created') {
            throw new InternshipServiceError('SUBMISSION_REVISION_CONFLICT', 'A new revision could not be created', 409);
        }
        return submissionResponse(batchId, assignmentId, actor.id, result.submission);
    }

    return {
        attachEvidence,
        assertCanAttachEvidence,
        createDraftSubmission,
        createParticipantRevision,
        getAssignment,
        getAssignments,
        getLearningPath,
        getProgram,
        getProgress,
        getSubmission,
        listForPrincipal,
        removeDraftEvidence,
        submitDraftSubmission,
        updateDraftSubmission,
        withdrawParticipantSubmission
    };
}

module.exports = {
    CALCULATION_VERSION,
    InternshipServiceError,
    createInternshipProgramService,
    deriveAssignmentAvailability
};
