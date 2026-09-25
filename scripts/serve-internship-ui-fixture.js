'use strict';

const express = require('express');
const crypto = require('node:crypto');
const multer = require('multer');
const path = require('path');

const app = express();
const port = Number(process.env.INTERNSHIP_UI_FIXTURE_PORT || 4173);
const publicRoot = path.join(__dirname, '..', 'BC-Learning-Main');
const submissionsEnabled = process.env.INTERNSHIP_UI_SUBMISSIONS !== 'false';
const phase3bEnabled = process.env.INTERNSHIP_UI_PHASE3B === 'true';
const reviewEnabled = submissionsEnabled && phase3bEnabled;
const completionEnabled = reviewEnabled && process.env.INTERNSHIP_UI_PHASE4B === 'true';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const submissions = new Map();
const reviews = new Map();
const evidenceContent = new Map();
const closeouts = new Map();

app.use(express.json());

const enrollments = [
    {
        id: 'batch-ui-2026',
        code: 'INT-BIM-2026',
        title: 'BIM Internship 2026',
        status: 'active',
        enrollmentStatus: 'active',
        startDate: '2026-09-01',
        endDate: '2026-12-18'
    },
    {
        id: 'batch-ui-alumni',
        code: 'INT-BIM-2025',
        title: 'BIM Internship 2025',
        status: 'completed',
        enrollmentStatus: 'completed',
        startDate: '2025-09-01',
        endDate: '2025-12-19'
    }
];

const modules = [
    {
        id: 'module-foundation',
        moduleKey: 'foundation',
        sequenceNumber: 1,
        title: 'Orientasi BIM Central Learning',
        outcome: 'Kenali alur belajar, standar kerja, dan sumber pengetahuan utama BCL.',
        items: [
            {
                contentId: 'content-welcome',
                type: 'content',
                title: 'Selamat datang di BCL',
                required: true,
                status: 'completed',
                href: '/elearning-assets/about.html',
                sequenceNumber: 1
            }
        ],
        assessments: []
    },
    {
        id: 'module-coordination',
        moduleKey: 'coordination',
        sequenceNumber: 2,
        title: 'Dasar Koordinasi Model',
        outcome: 'Bangun pemahaman awal mengenai koordinasi lintas disiplin pada proyek BIM.',
        items: [
            {
                contentId: 'content-coordination',
                type: 'page',
                title: 'Prinsip koordinasi model',
                required: true,
                status: 'not_started',
                href: '/elearning-assets/courses.html',
                sequenceNumber: 1
            }
        ],
        assessments: [
            {
                quizId: 'assessment-coordination',
                title: 'Cek pemahaman koordinasi',
                required: true,
                status: 'not_started',
                href: '/elearning-assets/exams.html',
                sequenceNumber: 2
            }
        ]
    },
    {
        id: 'module-practice',
        moduleKey: 'practice',
        sequenceNumber: 3,
        title: 'Praktik Terarah',
        outcome: 'Lanjutkan ke materi praktik setelah fondasi koordinasi selesai.',
        items: [
            {
                contentId: 'content-practice',
                type: 'pdf',
                title: 'Materi praktik berikutnya',
                required: true,
                status: 'not_started',
                href: null,
                sequenceNumber: 1
            }
        ],
        assessments: []
    }
];

app.use((request, response, next) => {
    if (request.path.startsWith('/api/training/internships')) {
        response.set('Cache-Control', 'no-store');
    }
    next();
});

app.get('/api/users/me/access', (_request, response) => {
    response.json({ isAdmin: false });
});

app.get('/api/messages', (_request, response) => {
    response.json({ messages: [], unread: 0 });
});

function fixtureRole(request) {
    return String(request.headers.authorization || '').includes('fixture-mentor-token') ? 'mentor' : 'participant';
}

app.get('/api/training/internships/me', (request, response) => {
    const role = fixtureRole(request);
    response.json({ success: true, data: enrollments.map((item) => ({
        ...item, participantRole: role, capabilities: { review: reviewEnabled, completion: completionEnabled }
    })) });
});

app.get('/api/training/internships/:batchId', (request, response) => {
    const enrollment = enrollments.find((item) => item.id === request.params.batchId);
    if (!enrollment) return response.status(404).json({ error: 'not_found' });

    return response.json({
        data: {
            id: enrollment.id,
            code: enrollment.code,
            title: enrollment.title,
            status: enrollment.status,
            startDate: enrollment.startDate,
            endDate: enrollment.endDate,
            participant: { displayName: 'Ayu Pratama' },
            mentors: [{ id: 'mentor-ui', displayName: 'Rizky Mahendra' }]
        }
    });
});

app.get('/api/training/internships/:batchId/learning-path', (_request, response) => {
    response.json({
        data: {
            path: {
                id: 'path-ui-2026',
                title: 'BIM Coordination Foundation',
                versionNumber: 3,
                modules
            }
        }
    });
});

app.get('/api/training/internships/:batchId/progress', (_request, response) => {
    response.json({
        data: {
            completed: 1,
            required: 4,
            percent: 25
        }
    });
});

function fixtureAssignments(batchId) {
    const isAlumni = batchId === 'batch-ui-alumni';
    return [
        {
            assignmentId: 'assignment-orientation',
            title: isAlumni ? 'Ringkasan Program Alumni' : 'Ringkasan Alur Kerja BCL',
            brief: isAlumni
                ? 'Dokumentasikan pembelajaran utama dari program sebelumnya.'
                : 'Susun ringkasan singkat tentang alur koordinasi informasi yang telah dipelajari.',
            topic: { id: 'topic-foundation', title: 'Foundation' },
            availableAt: '2026-09-15T00:00:00.000Z',
            dueAt: isAlumni ? '2026-12-19T00:00:00.000Z' : '2026-10-10T00:00:00.000Z',
            state: 'available',
            requiredDeliverable: 'Ringkasan alur kerja dan daftar peran utama.',
            learningReferences: [{
                relationship: 'prerequisite', contentId: 'content-welcome', type: 'page',
                title: 'Selamat datang di BCL', href: '/elearning-assets/about.html', completed: true
            }]
        },
        {
            assignmentId: 'assignment-coordination',
            title: 'Federated Model Review',
            brief: 'Tinjau alur koordinasi dan siapkan struktur laporan clash.',
            topic: { id: 'topic-coordination', title: 'Coordination & Clash Detection' },
            availableAt: null,
            dueAt: '2026-10-30T00:00:00.000Z',
            state: 'locked',
            requiredDeliverable: 'Clash report dan ringkasan issue.',
            learningReferences: [{
                relationship: 'prerequisite', contentId: 'content-coordination', type: 'page',
                title: 'Prinsip koordinasi model', href: '/elearning-assets/courses.html', completed: false
            }]
        }
    ];
}

function submissionKey(batchId, assignmentId) {
    return `${batchId}:${assignmentId}`;
}

function reviewKey(submissionId, revisionNo) {
    return `${submissionId}:${revisionNo}`;
}

function seedPhase3bSubmission(batchId, participantName) {
    const assignmentId = 'assignment-orientation';
    const evidenceId = crypto.randomUUID();
    const pendingId = crypto.randomUUID();
    const evidence = [
        {
            evidenceId, safeDisplayName: `${batchId}-coordination-report.pdf`, mimeType: 'application/pdf',
            sizeBytes: 12840, uploadedAt: '2026-09-24T08:15:00.000Z', classification: 'internal',
            scanStatus: 'clean', storageStatus: 'stored'
        },
        {
            evidenceId: pendingId, safeDisplayName: `${batchId}-model-export.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            sizeBytes: 4230, uploadedAt: '2026-09-24T08:16:00.000Z', classification: 'internal',
            scanStatus: 'pending', storageStatus: 'quarantined'
        }
    ];
    const submission = {
        submissionId: crypto.randomUUID(), assignmentId, participantName,
        state: 'submitted', revisionNo: 1, submittedAt: '2026-09-24T08:20:00.000Z',
        createdAt: '2026-09-24T08:00:00.000Z', updatedAt: '2026-09-24T08:20:00.000Z',
        comment: '', evidence
    };
    submission.revisions = [{ revisionNo: 1, state: 'submitted', submittedAt: submission.submittedAt, evidence, isCurrent: true }];
    submissions.set(submissionKey(batchId, assignmentId), submission);
    evidenceContent.set(evidenceId, Buffer.from('BCL internship fixture evidence'));
}

if (reviewEnabled) {
    seedPhase3bSubmission('batch-ui-2026', 'Ayu Pratama');
    seedPhase3bSubmission('batch-ui-alumni', 'Dimas Akbar');
}

function safeSubmissionData(batchId, assignmentId) {
    const submission = submissions.get(submissionKey(batchId, assignmentId)) || null;
    return {
        assignmentId,
        assignmentState: fixtureAssignments(batchId).find((item) => item.assignmentId === assignmentId)?.state || 'locked',
        submission: submission ? publicSubmission(submission) : null,
        withdrawalAllowed: false,
        authority: 'server',
        learningProgressUnchanged: true
    };
}

function publicSubmission(submission) {
    const { revisions: _revisions, participantName: _participantName, ...safe } = submission;
    return { ...safe, evidence: submission.evidence.map((item) => ({ ...item })) };
}

if (process.env.INTERNSHIP_UI_ASSIGNMENTS !== 'false') app.get('/api/training/internships/:batchId/assignments', (request, response) => {
    response.json({
        data: {
            assignments: fixtureAssignments(request.params.batchId),
            summary: { total: 2, available: 1, upcoming: 0, locked: 1, closed: 0 },
            authority: 'server-derived',
            readOnly: true,
            capabilities: {
                participantSubmissions: submissionsEnabled,
                participantReview: reviewEnabled,
                controlledRevision: reviewEnabled,
                programCompletion: completionEnabled
            }
        }
    });
});

if (submissionsEnabled) {
    app.get('/api/training/internships/:batchId/assignments/:assignmentId/submission', (request, response) => {
        response.json({ success: true, data: safeSubmissionData(request.params.batchId, request.params.assignmentId) });
    });

    app.post('/api/training/internships/:batchId/assignments/:assignmentId/submission', (request, response) => {
        const key = submissionKey(request.params.batchId, request.params.assignmentId);
        const existing = submissions.get(key);
        if (existing && existing.state === 'submitted') {
            return response.status(409).json({ code: 'SUBMISSION_STATE_CONFLICT' });
        }
        if (!existing) {
            submissions.set(key, {
                submissionId: crypto.randomUUID(), assignmentId: request.params.assignmentId,
                state: 'draft', comment: '', submittedAt: null,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), evidence: []
            });
        }
        return response.status(existing ? 200 : 201).json({
            success: true,
            data: { submission: submissions.get(key), created: !existing, resumed: false, withdrawalAllowed: false }
        });
    });

    app.post(
        '/api/training/internships/:batchId/assignments/:assignmentId/submission/evidence',
        (request, response, next) => upload.single('evidence')(request, response, (error) => {
            if (!error) return next();
            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return response.status(413).json({ code: 'EVIDENCE_FILE_TOO_LARGE' });
            }
            return response.status(400).json({ code: 'EVIDENCE_UPLOAD_INVALID' });
        }),
        (request, response) => {
            const key = submissionKey(request.params.batchId, request.params.assignmentId);
            const submission = submissions.get(key);
            if (!submission || submission.state !== 'draft') {
                return response.status(409).json({ code: 'SUBMISSION_NOT_EDITABLE' });
            }
            if (!request.file) return response.status(400).json({ code: 'EVIDENCE_FILE_REQUIRED' });
            if (submission.evidence.length >= 5) return response.status(409).json({ code: 'EVIDENCE_FILE_LIMIT' });
            const extension = path.extname(request.file.originalname).toLowerCase();
            if (!['.pdf', '.docx', '.xlsx', '.csv', '.jpg', '.jpeg', '.png'].includes(extension)) {
                return response.status(400).json({ code: 'EVIDENCE_TYPE_NOT_ALLOWED' });
            }
            const evidence = {
                evidenceId: crypto.randomUUID(), submissionId: submission.submissionId,
                originalFileName: request.file.originalname, safeDisplayName: request.file.originalname,
                mimeType: request.file.mimetype, sizeBytes: request.file.size,
                sha256: crypto.createHash('sha256').update(request.file.buffer).digest('hex'),
                uploadedAt: new Date().toISOString(), uploadedByUserId: 1,
                classification: 'internal', scanStatus: 'pending', storageStatus: 'quarantined'
            };
            submission.evidence.push(evidence);
            submission.updatedAt = new Date().toISOString();
            return response.status(201).json({ success: true, data: evidence });
        }
    );

    app.delete('/api/training/internships/:batchId/assignments/:assignmentId/submission/evidence/:evidenceId', (request, response) => {
        const submission = submissions.get(submissionKey(request.params.batchId, request.params.assignmentId));
        if (!submission || submission.state !== 'draft') {
            return response.status(409).json({ code: 'SUBMISSION_NOT_EDITABLE' });
        }
        const index = submission.evidence.findIndex((item) => item.evidenceId === request.params.evidenceId);
        if (index < 0) return response.status(404).json({ code: 'EVIDENCE_NOT_FOUND' });
        submission.evidence.splice(index, 1);
        return response.json({ success: true, data: { evidenceId: request.params.evidenceId, removed: true } });
    });

    app.post('/api/training/internships/:batchId/assignments/:assignmentId/submission/submit', (request, response) => {
        const submission = submissions.get(submissionKey(request.params.batchId, request.params.assignmentId));
        if (!submission || submission.state !== 'draft') {
            return response.status(409).json({ code: 'SUBMISSION_STATE_CONFLICT' });
        }
        if (submission.evidence.length === 0) return response.status(409).json({ code: 'SUBMISSION_EVIDENCE_REQUIRED' });
        submission.state = 'submitted';
        submission.submittedAt = new Date().toISOString();
        submission.updatedAt = submission.submittedAt;
        const revision = Array.isArray(submission.revisions)
            ? submission.revisions.find((item) => item.revisionNo === submission.revisionNo) : null;
        if (revision) {
            revision.state = 'submitted';
            revision.submittedAt = submission.submittedAt;
        }
        return response.json({ success: true, data: submission });
    });
}

const rubric = [
    { criterionId: 'criterion-quality', title: 'Kualitas output', description: 'Ketepatan struktur dan mutu deliverable.', maxScore: 5, required: true, displayOrder: 1 },
    { criterionId: 'criterion-coordination', title: 'Pemahaman koordinasi', description: 'Kemampuan menghubungkan evidence dengan alur kerja BIM.', maxScore: 5, required: true, displayOrder: 2 }
];

function findSubmission(batchId, submissionId) {
    return [...submissions.entries()].find(([key, value]) => key.startsWith(`${batchId}:`) && value.submissionId === submissionId)?.[1] || null;
}

function participantReviewDto(batchId, assignmentId) {
    const submission = submissions.get(submissionKey(batchId, assignmentId));
    if (!submission) return { submissionId: null, review: { state: 'not_started', decision: null, reviewVersion: 0 }, revisionHistory: [] };
    const current = reviews.get(reviewKey(submission.submissionId, submission.revisionNo)) || null;
    const terminal = current && ['accepted', 'revision_requested'].includes(current.state);
    return {
        submissionId: submission.submissionId,
        submissionState: submission.state,
        revisionNo: submission.revisionNo,
        canCreateRevision: Boolean(current && current.state === 'revision_requested' && submission.state === 'submitted'),
        review: current ? {
            reviewId: current.reviewId, state: current.state, decision: current.decision,
            submissionRevision: submission.revisionNo, reviewVersion: current.reviewVersion,
            participantFeedback: terminal ? current.participantFeedback : '',
            rubric: terminal ? rubric : [], scores: terminal ? current.scores.map(({ criterionId, score }) => ({ criterionId, score })) : []
        } : { state: 'not_started', decision: null, reviewVersion: 0 },
        revisionHistory: (submission.revisions || []).slice().reverse().map((revision) => {
            const review = reviews.get(reviewKey(submission.submissionId, revision.revisionNo));
            const decided = review && ['accepted', 'revision_requested'].includes(review.state);
            return {
                revisionNo: revision.revisionNo, submissionState: revision.state,
                reviewState: review ? review.state : 'not_started', submittedAt: revision.submittedAt || null,
                decidedAt: review && review.decidedAt || null, isCurrent: revision.isCurrent,
                participantFeedback: decided ? review.participantFeedback : '',
                rubric: decided ? rubric : [], scores: decided ? review.scores.map(({ criterionId, score }) => ({ criterionId, score })) : []
            };
        })
    };
}

if (reviewEnabled) {
    app.get('/api/training/internships/:batchId/review-queue', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        const data = [...submissions.entries()].filter(([key, submission]) => key.startsWith(`${request.params.batchId}:`) && submission.state === 'submitted').map(([, submission]) => {
            const review = reviews.get(reviewKey(submission.submissionId, submission.revisionNo));
            const assignment = fixtureAssignments(request.params.batchId).find((item) => item.assignmentId === submission.assignmentId);
            return {
                submissionId: submission.submissionId, participant: { displayName: submission.participantName },
                assignment: { title: assignment && assignment.title || 'Tugas Praktik' }, submittedAt: submission.submittedAt,
                reviewState: review ? review.state : 'not_started', revisionNo: submission.revisionNo,
                reviewer: review ? { displayName: 'Rizky Mahendra' } : null
            };
        });
        response.json({ success: true, data: { batchId: request.params.batchId, data, authority: 'server' } });
    });

    app.get('/api/training/internships/:batchId/submissions/:submissionId/review', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        const submission = findSubmission(request.params.batchId, request.params.submissionId);
        if (!submission) return response.status(404).json({ code: 'REVIEW_SUBMISSION_NOT_FOUND' });
        const requestedRevision = Number(request.query.revision || submission.revisionNo);
        const revision = (submission.revisions || []).find((item) => item.revisionNo === requestedRevision);
        if (!revision) return response.status(404).json({ code: 'REVIEW_SUBMISSION_NOT_FOUND' });
        const review = reviews.get(reviewKey(submission.submissionId, requestedRevision)) || null;
        const assignment = fixtureAssignments(request.params.batchId).find((item) => item.assignmentId === submission.assignmentId);
        response.json({ success: true, data: {
            submission: {
                submissionId: submission.submissionId, state: revision.state, revisionNo: requestedRevision,
                submittedAt: revision.submittedAt, participant: { userId: '1', displayName: submission.participantName },
                assignment: {
                    assignmentId: submission.assignmentId, title: assignment && assignment.title || 'Tugas Praktik',
                    topic: assignment && assignment.topic && assignment.topic.title || '',
                    brief: assignment && assignment.brief || '', requiredDeliverable: assignment && assignment.requiredDeliverable || '',
                    relatedLearning: (assignment && assignment.learningReferences || []).map((item) => ({ relationship: item.relationship, title: item.title }))
                },
                program: {
                    code: enrollments.find((item) => item.id === request.params.batchId)?.code || '',
                    title: enrollments.find((item) => item.id === request.params.batchId)?.title || ''
                },
                evidence: revision.evidence.map((item) => ({ ...item }))
            },
            rubric,
            review: review ? { ...review, submissionRevision: requestedRevision } : { state: 'not_started', decision: null, reviewVersion: 0, scores: [], participantFeedback: '', internalNote: '' },
            permissions: {
                canStartReview: !review && revision.state === 'submitted',
                canMutateReview: Boolean(review && review.state === 'under_review' && review.reviewerUserId === 2)
            }, authority: 'server', learningProgressUnchanged: true
        } });
    });

    app.post('/api/training/internships/:batchId/submissions/:submissionId/review/start', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        const submission = findSubmission(request.params.batchId, request.params.submissionId);
        if (!submission || submission.state !== 'submitted') return response.status(409).json({ code: 'REVIEW_STATE_CONFLICT' });
        const key = reviewKey(submission.submissionId, submission.revisionNo);
        const existing = reviews.get(key);
        if (existing) return response.status(409).json({ code: existing.state === 'under_review' ? 'REVIEW_ALREADY_CLAIMED' : 'REVIEW_STATE_CONFLICT' });
        const review = {
            reviewId: crypto.randomUUID(), state: 'under_review', decision: null, reviewerUserId: 2,
            reviewer: { userId: '2', displayName: 'Rizky Mahendra' }, submissionRevision: submission.revisionNo,
            reviewVersion: 1, participantFeedback: '', internalNote: '', scores: [], feedbackHistory: [],
            startedAt: new Date().toISOString(), decidedAt: null, updatedAt: new Date().toISOString()
        };
        reviews.set(key, review);
        response.status(201).json({ success: true, data: { review, created: true } });
    });

    app.patch('/api/training/internships/:batchId/submissions/:submissionId/review', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        const submission = findSubmission(request.params.batchId, request.params.submissionId);
        const review = submission && reviews.get(reviewKey(submission.submissionId, submission.revisionNo));
        if (!review || review.state !== 'under_review') return response.status(409).json({ code: 'REVIEW_STATE_CONFLICT' });
        if (Number(request.body.reviewVersion) !== review.reviewVersion) return response.status(409).json({ code: 'REVIEW_VERSION_CONFLICT' });
        const scores = Array.isArray(request.body.scores) ? request.body.scores : [];
        if (scores.some((score) => !rubric.some((item) => item.criterionId === score.criterionId && Number(score.score) >= 0 && Number(score.score) <= item.maxScore))) {
            return response.status(400).json({ code: 'REVIEW_SCORE_OUT_OF_RANGE' });
        }
        review.scores = scores.map((item) => ({ criterionId: item.criterionId, score: Number(item.score), comment: String(item.comment || '') }));
        review.participantFeedback = String(request.body.participantFeedback || '');
        review.internalNote = String(request.body.internalNote || '');
        review.reviewVersion += 1;
        review.updatedAt = new Date().toISOString();
        response.json({ success: true, data: { review } });
    });

    app.post('/api/training/internships/:batchId/submissions/:submissionId/review/decision', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        const submission = findSubmission(request.params.batchId, request.params.submissionId);
        const review = submission && reviews.get(reviewKey(submission.submissionId, submission.revisionNo));
        if (!review || review.state !== 'under_review') return response.status(409).json({ code: 'REVIEW_STATE_CONFLICT' });
        if (Number(request.body.reviewVersion) !== review.reviewVersion) return response.status(409).json({ code: 'REVIEW_VERSION_CONFLICT' });
        if (!['accepted', 'revision_requested'].includes(request.body.decision)) return response.status(400).json({ code: 'REVIEW_DECISION_INVALID' });
        if (rubric.some((criterion) => criterion.required && !review.scores.some((score) => score.criterionId === criterion.criterionId))) {
            return response.status(409).json({ code: 'REVIEW_REQUIRED_SCORES_MISSING' });
        }
        review.state = request.body.decision;
        review.decision = request.body.decision;
        review.reviewVersion += 1;
        review.decidedAt = new Date().toISOString();
        review.updatedAt = review.decidedAt;
        response.json({ success: true, data: { review } });
    });

    app.get('/api/training/internships/:batchId/assignments/:assignmentId/submission/review', (request, response) => {
        if (fixtureRole(request) !== 'participant') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        response.json({ success: true, data: participantReviewDto(request.params.batchId, request.params.assignmentId) });
    });

    app.post('/api/training/internships/:batchId/assignments/:assignmentId/submission/revision', (request, response) => {
        if (fixtureRole(request) !== 'participant') return response.status(403).json({ code: 'SUBMISSION_ACCESS_DENIED' });
        if (Object.hasOwn(request.body || {}, 'revisionNo')) return response.status(400).json({ code: 'REVISION_NUMBER_NOT_ALLOWED' });
        const submission = submissions.get(submissionKey(request.params.batchId, request.params.assignmentId));
        const review = submission && reviews.get(reviewKey(submission.submissionId, submission.revisionNo));
        if (!submission || submission.state !== 'submitted' || !review || review.state !== 'revision_requested') {
            return response.status(409).json({ code: 'SUBMISSION_REVISION_NOT_REQUESTED' });
        }
        const old = submission.revisions.find((item) => item.revisionNo === submission.revisionNo);
        old.isCurrent = false;
        submission.revisionNo += 1;
        submission.state = 'draft'; submission.submittedAt = null; submission.evidence = [];
        submission.updatedAt = new Date().toISOString();
        submission.revisions.push({ revisionNo: submission.revisionNo, state: 'draft', submittedAt: null, evidence: submission.evidence, isCurrent: true });
        response.status(201).json({ success: true, data: publicSubmission(submission) });
    });

    app.get('/api/training/internships/:batchId/submissions/:submissionId/evidence/:evidenceId/content', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'REVIEW_ACCESS_DENIED' });
        const submission = findSubmission(request.params.batchId, request.params.submissionId);
        const revision = submission && submission.revisions.find((item) => item.revisionNo === Number(request.query.revision || submission.revisionNo));
        const evidence = revision && revision.evidence.find((item) => item.evidenceId === request.params.evidenceId);
        if (!evidence || evidence.scanStatus !== 'clean' || evidence.storageStatus !== 'stored') return response.status(409).json({ code: 'REVIEW_EVIDENCE_UNAVAILABLE' });
        response.type(evidence.mimeType).set('Content-Disposition', `attachment; filename="${path.basename(evidence.safeDisplayName)}"`).send(evidenceContent.get(evidence.evidenceId));
    });
}

function fixtureProgramStatus(batchId) {
    const complete = closeouts.get(batchId) || null;
    const ready = batchId === 'batch-ui-2026';
    return {
        program: { id: batchId, code: ready ? 'INT-BIM-2026' : 'INT-BIM-2025', title: ready ? 'BIM Internship 2026' : 'BIM Internship 2025' },
        participant: { userId: '1', displayName: ready ? 'Ayu Pratama' : 'Dimas Akbar' },
        status: complete ? 'completed' : ready ? 'requirements_met' : 'in_progress',
        requirementsMet: Boolean(complete || ready),
        dimensions: {
            learning: { required: { total: ready ? 1 : 2, completed: 1, remaining: ready ? 0 : 1 }, optional: { total: 0, completed: 0, remaining: 0 } },
            submitted: { required: { total: 1, completed: 1, remaining: 0 }, optional: { total: 0, completed: 0, remaining: 0 } },
            accepted: { required: { total: 1, completed: ready ? 1 : 0, remaining: ready ? 0 : 1 }, optional: { total: 0, completed: 0, remaining: 0 } }
        },
        assignments: { required: 1, submitted: 1, accepted: ready ? 1 : 0, revisionRequired: 0, notSubmitted: 0 },
        revisionCount: 0,
        blockers: complete || ready ? [] : [
            { code: 'required_learning_incomplete', scope: 'participant', label: '1 required learning item remains.' },
            { code: 'required_assignment_not_accepted', scope: 'participant', label: 'Ringkasan Program Alumni is awaiting acceptance.' }
        ],
        integrityIssues: [], periodElapsed: false,
        policy: { versionId: `fixture-policy:${batchId}`, calculationVersion: 'internship-completion-v1', immutable: true },
        closeout: complete,
        certificateEligible: Boolean(complete),
        permissions: { canReadProgramStatus: true, canCloseProgram: fixtureRole({ headers: { authorization: 'fixture-mentor-token' } }) === 'mentor' && ready && !complete },
        authority: 'server-derived', readOnly: true
    };
}

if (completionEnabled) {
    app.get('/api/training/internships/:batchId/participant-statuses', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'PROGRAM_STATUS_ACCESS_DENIED' });
        response.json({ success: true, data: {
            batchId: request.params.batchId,
            participants: [fixtureProgramStatus(request.params.batchId)],
            authority: 'server-derived'
        } });
    });

    app.get('/api/training/internships/:batchId/program-status', (request, response) => {
        if (fixtureRole(request) !== 'participant') return response.status(403).json({ code: 'PROGRAM_STATUS_ACCESS_DENIED' });
        response.json({ success: true, data: { ...fixtureProgramStatus(request.params.batchId), permissions: { canReadProgramStatus: true, canCloseProgram: false } } });
    });

    app.get('/api/training/internships/:batchId/participants/:userId/program-status', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'PROGRAM_STATUS_ACCESS_DENIED' });
        response.json({ success: true, data: fixtureProgramStatus(request.params.batchId) });
    });

    app.post('/api/training/internships/:batchId/participants/:userId/complete', (request, response) => {
        if (fixtureRole(request) !== 'mentor') return response.status(403).json({ code: 'PROGRAM_CLOSEOUT_ACCESS_DENIED' });
        if (Object.keys(request.body || {}).some((key) => key !== 'closeoutNote')) {
            return response.status(400).json({ code: 'CLOSEOUT_AUTHORITY_NOT_ALLOWED' });
        }
        if (request.params.batchId !== 'batch-ui-2026') return response.status(409).json({ code: 'PROGRAM_REQUIREMENTS_NOT_MET' });
        const existing = closeouts.get(request.params.batchId);
        if (!existing) {
            closeouts.set(request.params.batchId, {
                closeoutId: crypto.randomUUID(), completedAt: new Date().toISOString(),
                completedBy: { displayName: 'Rizky Mahendra' }, note: String(request.body.closeoutNote || '')
            });
        }
        response.status(existing ? 200 : 201).json({ success: true, data: { ...fixtureProgramStatus(request.params.batchId), idempotent: Boolean(existing) } });
    });
}

app.use(express.static(publicRoot));

app.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Internship UI fixture available at http://127.0.0.1:${port}\n`);
});
