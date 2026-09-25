const express = require('express');
const multer = require('multer');
const { requireAuthenticated } = require('../utils/auth');
const { ContentReferenceError } = require('../services/canonicalLearningContentResolver');
const { InternshipServiceError } = require('../services/internshipProgramService');
const { InternshipReviewError } = require('../services/internshipReviewService');
const { InternshipProgramProgressError } = require('../services/internshipProgramProgressService');
const {
    DEFAULT_MAX_FILE_SIZE_BYTES,
    EvidenceValidationError
} = require('../services/internshipEvidenceService');

const BATCH_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,119}$/i;
const ASSIGNMENT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,119}$/i;
const EVIDENCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTHORITATIVE_ID_FIELDS = new Set(['participant_user_id', 'participantUserId', 'user_id', 'userId']);
const REVIEWER_ID_FIELDS = new Set(['reviewer_user_id', 'reviewerUserId', 'mentor_user_id', 'mentorUserId', 'reviewed_by', 'reviewedBy']);
const CLOSEOUT_SERVER_FIELDS = new Set([
    ...AUTHORITATIVE_ID_FIELDS,
    ...REVIEWER_ID_FIELDS,
    'requirementsMet', 'requirements_met', 'completed', 'completedAt', 'completed_at',
    'completedBy', 'completed_by', 'policyVersion', 'policy_version', 'policyVersionId', 'policy_version_id',
    'status', 'certificateEligible', 'certificate_eligible'
]);

function createInternshipRoutes({
    internshipService,
    reviewService = null,
    assignmentsEnabled = false,
    submissionsEnabled = false,
    reviewEnabled = false,
    completionEnabled = false,
    progressService = null
}) {
    if (!internshipService) throw new Error('internshipService is required');
    const router = express.Router();
    const evidenceUpload = multer({
        storage: multer.memoryStorage(),
        limits: { files: 1, fileSize: DEFAULT_MAX_FILE_SIZE_BYTES, fields: 5, parts: 6 }
    });

    router.use(requireAuthenticated);

    function batchId(req, res) {
        const value = String(req.params.batchId || '');
        if (!BATCH_ID_PATTERN.test(value)) {
            res.status(400).json({ success: false, code: 'INVALID_BATCH_ID', error: 'Invalid Internship batch ID' });
            return null;
        }
        return value;
    }

    function handleError(error, res) {
        if (error instanceof InternshipServiceError || error instanceof InternshipReviewError
            || error instanceof InternshipProgramProgressError
            || error instanceof ContentReferenceError
            || error instanceof EvidenceValidationError) {
            return res.status(error.status || 500).json({ success: false, code: error.code, error: error.message });
        }
        console.error('Internship API error:', error && error.name ? error.name : 'UnexpectedError');
        return res.status(500).json({ success: false, code: 'INTERNSHIP_SERVICE_ERROR', error: 'Unable to load Internship data' });
    }

    function evidenceId(req, res) {
        const value = String(req.params.evidenceId || '');
        if (!EVIDENCE_ID_PATTERN.test(value)) {
            res.status(400).json({ success: false, code: 'INVALID_EVIDENCE_ID', error: 'Invalid evidence ID' });
            return null;
        }
        return value;
    }

    function rejectAuthoritativeIdentity(req, res) {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        if (Object.keys(payload).some((key) => AUTHORITATIVE_ID_FIELDS.has(key))) {
            res.status(400).json({
                success: false,
                code: 'AUTHORITATIVE_ID_NOT_ALLOWED',
                error: 'Participant identity is derived from the authenticated principal'
            });
            return true;
        }
        return false;
    }

    function rejectReviewerIdentity(req, res) {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        if (Object.keys(payload).some((key) => REVIEWER_ID_FIELDS.has(key))) {
            res.status(400).json({
                success: false,
                code: 'REVIEWER_ID_NOT_ALLOWED',
                error: 'Reviewer identity is derived from the authenticated principal'
            });
            return true;
        }
        return false;
    }

    function submissionId(req, res) {
        const value = String(req.params.submissionId || '');
        if (!ASSIGNMENT_ID_PATTERN.test(value)) {
            res.status(400).json({ success: false, code: 'INVALID_SUBMISSION_ID', error: 'Invalid submission ID' });
            return null;
        }
        return value;
    }

    function participantId(req, res) {
        const value = Number(req.params.userId);
        if (!Number.isInteger(value) || value <= 0) {
            res.status(400).json({ success: false, code: 'INVALID_PARTICIPANT_ID', error: 'Invalid participant ID' });
            return null;
        }
        return value;
    }

    function rejectCloseoutAuthority(req, res) {
        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        const keys = Object.keys(payload);
        if (keys.some((key) => CLOSEOUT_SERVER_FIELDS.has(key))
            || keys.some((key) => key !== 'closeoutNote')) {
            res.status(400).json({
                success: false,
                code: 'CLOSEOUT_AUTHORITY_NOT_ALLOWED',
                error: 'Program status and closeout authority are derived by the server'
            });
            return true;
        }
        return false;
    }

    function runEvidenceUpload(req, res, next) {
        evidenceUpload.single('evidence')(req, res, (error) => {
            if (!error) return next();
            if (error instanceof multer.MulterError) {
                const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
                return res.status(status).json({
                    success: false,
                    code: error.code === 'LIMIT_FILE_SIZE' ? 'EVIDENCE_FILE_TOO_LARGE' : 'EVIDENCE_UPLOAD_INVALID',
                    error: 'Evidence upload violates the file policy'
                });
            }
            return next(error);
        });
    }

    async function authorizeEvidenceUpload(req, res, next) {
        const id = batchId(req, res);
        const selectedAssignmentId = assignmentId(req, res);
        if (!id || !selectedAssignmentId) return undefined;
        try {
            await internshipService.assertCanAttachEvidence(id, selectedAssignmentId, req.authUser);
            req.internshipEvidenceTarget = { batchId: id, assignmentId: selectedAssignmentId };
            return next();
        } catch (error) {
            return handleError(error, res);
        }
    }

    function assignmentId(req, res) {
        const value = String(req.params.assignmentId || '');
        if (!ASSIGNMENT_ID_PATTERN.test(value)) {
            res.status(400).json({ success: false, code: 'INVALID_ASSIGNMENT_ID', error: 'Invalid Internship assignment ID' });
            return null;
        }
        return value;
    }

    router.get('/me', async (req, res) => {
        try {
            const programs = await internshipService.listForPrincipal(req.authUser);
            return res.json({
                success: true,
                data: programs.map((program) => ({
                    ...program,
                    capabilities: {
                        review: reviewEnabled === true,
                        completion: completionEnabled === true
                    }
                }))
            });
        } catch (error) {
            return handleError(error, res);
        }
    });

    if (assignmentsEnabled) {
        router.get('/:batchId/assignments', async (req, res) => {
            const id = batchId(req, res);
            if (!id) return undefined;
            try {
                const data = await internshipService.getAssignments(id, req.authUser);
                return res.json({
                    success: true,
                    data: {
                        ...data,
                        capabilities: {
                            participantSubmissions: submissionsEnabled === true,
                            participantReview: reviewEnabled === true,
                            controlledRevision: reviewEnabled === true,
                            programCompletion: completionEnabled === true
                        }
                    }
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.get('/:batchId/assignments/:assignmentId', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await internshipService.getAssignment(id, selectedAssignmentId, req.authUser)
                });
            } catch (error) {
                return handleError(error, res);
            }
        });
    }

    if (completionEnabled) {
        if (!progressService) throw new Error('progressService is required when Internship completion is enabled');

        router.get('/:batchId/program-status', async (req, res) => {
            const id = batchId(req, res);
            if (!id) return undefined;
            try {
                return res.json({ success: true, data: await progressService.getOwnStatus(id, req.authUser) });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.get('/:batchId/participant-statuses', async (req, res) => {
            const id = batchId(req, res);
            if (!id) return undefined;
            try {
                return res.json({ success: true, data: await progressService.listParticipantStatuses(id, req.authUser) });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.get('/:batchId/participants/:userId/program-status', async (req, res) => {
            const id = batchId(req, res);
            const selectedParticipantId = participantId(req, res);
            if (!id || !selectedParticipantId) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await progressService.getParticipantStatus(id, selectedParticipantId, req.authUser)
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/participants/:userId/complete', async (req, res) => {
            const id = batchId(req, res);
            const selectedParticipantId = participantId(req, res);
            if (!id || !selectedParticipantId || rejectCloseoutAuthority(req, res)) return undefined;
            try {
                const data = await progressService.completeProgram(
                    id, selectedParticipantId, req.authUser, req.body || {}
                );
                return res.status(data.idempotent ? 200 : 201).json({ success: true, data });
            } catch (error) {
                return handleError(error, res);
            }
        });
    }

    if (assignmentsEnabled && submissionsEnabled) {
        router.get('/:batchId/assignments/:assignmentId/submission', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await internshipService.getSubmission(id, selectedAssignmentId, req.authUser)
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/assignments/:assignmentId/submission', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId || rejectAuthoritativeIdentity(req, res)) return undefined;
            try {
                const data = await internshipService.createDraftSubmission(id, selectedAssignmentId, req.authUser);
                return res.status(data.created ? 201 : 200).json({ success: true, data });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.patch('/:batchId/assignments/:assignmentId/submission', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId || rejectAuthoritativeIdentity(req, res)) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await internshipService.updateDraftSubmission(
                        id,
                        selectedAssignmentId,
                        req.authUser,
                        req.body || {}
                    )
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/assignments/:assignmentId/submission/submit', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId || rejectAuthoritativeIdentity(req, res)) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await internshipService.submitDraftSubmission(id, selectedAssignmentId, req.authUser)
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/assignments/:assignmentId/submission/withdraw', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId || rejectAuthoritativeIdentity(req, res)) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await internshipService.withdrawParticipantSubmission(id, selectedAssignmentId, req.authUser)
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post(
            '/:batchId/assignments/:assignmentId/submission/evidence',
            authorizeEvidenceUpload,
            runEvidenceUpload,
            async (req, res) => {
                const { batchId: id, assignmentId: selectedAssignmentId } = req.internshipEvidenceTarget;
                if (rejectAuthoritativeIdentity(req, res)) return undefined;
                try {
                    return res.status(201).json({
                        success: true,
                        data: await internshipService.attachEvidence(
                            id,
                            selectedAssignmentId,
                            req.authUser,
                            req.file,
                            { classification: req.body && req.body.classification }
                        )
                    });
                } catch (error) {
                    return handleError(error, res);
                }
            }
        );

        router.delete('/:batchId/assignments/:assignmentId/submission/evidence/:evidenceId', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            const selectedEvidenceId = evidenceId(req, res);
            if (!id || !selectedAssignmentId || !selectedEvidenceId) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await internshipService.removeDraftEvidence(
                        id,
                        selectedAssignmentId,
                        selectedEvidenceId,
                        req.authUser
                    )
                });
            } catch (error) {
                return handleError(error, res);
            }
        });
    }

    if (assignmentsEnabled && submissionsEnabled && reviewEnabled) {
        if (!reviewService) throw new Error('reviewService is required when Internship review is enabled');

        router.get('/:batchId/review-queue', async (req, res) => {
            const id = batchId(req, res);
            if (!id) return undefined;
            try {
                return res.json({ success: true, data: await reviewService.listReviewQueue(id, req.authUser) });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.get('/:batchId/submissions/:submissionId/review', async (req, res) => {
            const id = batchId(req, res);
            const selectedSubmissionId = submissionId(req, res);
            if (!id || !selectedSubmissionId) return undefined;
            const requestedRevision = req.query.revision == null ? null : Number(req.query.revision);
            if (requestedRevision != null && (!Number.isInteger(requestedRevision) || requestedRevision <= 0)) {
                return res.status(400).json({ success: false, code: 'INVALID_REVISION', error: 'Invalid revision number' });
            }
            try {
                return res.json({
                    success: true,
                    data: await reviewService.getReviewDetail(
                        id,
                        selectedSubmissionId,
                        req.authUser,
                        { revisionNo: requestedRevision }
                    )
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/submissions/:submissionId/review/start', async (req, res) => {
            const id = batchId(req, res);
            const selectedSubmissionId = submissionId(req, res);
            if (!id || !selectedSubmissionId || rejectAuthoritativeIdentity(req, res)
                || rejectReviewerIdentity(req, res)) return undefined;
            try {
                const data = await reviewService.startReview(id, selectedSubmissionId, req.authUser);
                return res.status(data.created ? 201 : 200).json({ success: true, data });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.patch('/:batchId/submissions/:submissionId/review', async (req, res) => {
            const id = batchId(req, res);
            const selectedSubmissionId = submissionId(req, res);
            if (!id || !selectedSubmissionId || rejectAuthoritativeIdentity(req, res)
                || rejectReviewerIdentity(req, res)) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await reviewService.saveReview(id, selectedSubmissionId, req.authUser, req.body || {})
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/submissions/:submissionId/review/decision', async (req, res) => {
            const id = batchId(req, res);
            const selectedSubmissionId = submissionId(req, res);
            if (!id || !selectedSubmissionId || rejectAuthoritativeIdentity(req, res)
                || rejectReviewerIdentity(req, res)) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await reviewService.makeDecision(id, selectedSubmissionId, req.authUser, req.body || {})
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.get('/:batchId/assignments/:assignmentId/submission/review', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId) return undefined;
            try {
                return res.json({
                    success: true,
                    data: await reviewService.getParticipantReview(id, selectedAssignmentId, req.authUser)
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.post('/:batchId/assignments/:assignmentId/submission/revision', async (req, res) => {
            const id = batchId(req, res);
            const selectedAssignmentId = assignmentId(req, res);
            if (!id || !selectedAssignmentId || rejectAuthoritativeIdentity(req, res)) return undefined;
            const payload = req.body && typeof req.body === 'object' ? req.body : {};
            if (Object.hasOwn(payload, 'revisionNo') || Object.hasOwn(payload, 'submissionRevision')) {
                return res.status(400).json({
                    success: false,
                    code: 'REVISION_NUMBER_NOT_ALLOWED',
                    error: 'Revision number is generated by the server'
                });
            }
            try {
                return res.status(201).json({
                    success: true,
                    data: await internshipService.createParticipantRevision(
                        id,
                        selectedAssignmentId,
                        req.authUser
                    )
                });
            } catch (error) {
                return handleError(error, res);
            }
        });

        router.get('/:batchId/submissions/:submissionId/evidence/:evidenceId/content', async (req, res) => {
            const id = batchId(req, res);
            const selectedSubmissionId = submissionId(req, res);
            const selectedEvidenceId = evidenceId(req, res);
            if (!id || !selectedSubmissionId || !selectedEvidenceId) return undefined;
            const requestedRevision = req.query.revision == null ? null : Number(req.query.revision);
            if (requestedRevision != null && (!Number.isInteger(requestedRevision) || requestedRevision <= 0)) {
                return res.status(400).json({ success: false, code: 'INVALID_REVISION', error: 'Invalid revision number' });
            }
            try {
                const file = await reviewService.getReviewerEvidence(
                    id,
                    selectedSubmissionId,
                    selectedEvidenceId,
                    req.authUser,
                    { revisionNo: requestedRevision }
                );
                const encodedName = encodeURIComponent(file.safeDisplayName).replace(/'/g, '%27');
                res.setHeader('Content-Type', file.mimeType);
                res.setHeader('Content-Length', String(file.sizeBytes));
                res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', 'private, no-store');
                return res.send(file.content);
            } catch (error) {
                return handleError(error, res);
            }
        });
    }

    router.get('/:batchId/learning-path', async (req, res) => {
        const id = batchId(req, res);
        if (!id) return undefined;
        try {
            return res.json({ success: true, data: await internshipService.getLearningPath(id, req.authUser) });
        } catch (error) {
            return handleError(error, res);
        }
    });

    router.get('/:batchId/progress', async (req, res) => {
        const id = batchId(req, res);
        if (!id) return undefined;
        try {
            return res.json({ success: true, data: await internshipService.getProgress(id, req.authUser) });
        } catch (error) {
            return handleError(error, res);
        }
    });

    router.get('/:batchId', async (req, res) => {
        const id = batchId(req, res);
        if (!id) return undefined;
        try {
            return res.json({ success: true, data: await internshipService.getProgram(id, req.authUser) });
        } catch (error) {
            return handleError(error, res);
        }
    });

    return router;
}

module.exports = {
    ASSIGNMENT_ID_PATTERN,
    BATCH_ID_PATTERN,
    EVIDENCE_ID_PATTERN,
    CLOSEOUT_SERVER_FIELDS,
    REVIEWER_ID_FIELDS,
    createInternshipRoutes
};
