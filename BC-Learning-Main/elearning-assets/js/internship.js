(function initializeInternshipModule(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BCLInternshipPage = api;
    if (!root || !root.document) return;

    const start = () => api.createPageController(root).init();
    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})(typeof window !== 'undefined' ? window : null, function internshipFactory() {
    'use strict';

    const API_BASE = '/api/training/internships';
    const PATH_SENSITIVE_PATTERN = /(?:\\\\|file:\/\/|[a-z]:[\\/])/i;
    const submissionUi = typeof module === 'object' && module.exports
        ? require('./internship-submission.js')
        : window.BCLInternshipSubmission;

    class InternshipApiError extends Error {
        constructor(status, code) {
            super('Internship request failed');
            this.name = 'InternshipApiError';
            this.status = Number(status || 0);
            this.code = String(code || 'INTERNSHIP_REQUEST_FAILED');
        }
    }

    function displayText(value, fallback = '') {
        const text = String(value == null ? '' : value).trim();
        return text && !PATH_SENSITIVE_PATTERN.test(text) ? text : fallback;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeContentHref(value) {
        const href = String(value || '').trim();
        if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\') || /%5c/i.test(href)) return null;

        let decoded = href;
        try { decoded = decodeURIComponent(href); } catch (_) { return null; }
        if (PATH_SENSITIVE_PATTERN.test(decoded) || decoded.includes('..')) return null;

        try {
            const parsed = new URL(href, 'https://bcl.invalid');
            const allowed = parsed.origin === 'https://bcl.invalid' && [
                '/pages/',
                '/elearning-assets/',
                '/public/reader.html'
            ].some((prefix) => parsed.pathname.startsWith(prefix));
            return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
        } catch (_) {
            return null;
        }
    }

    function statusLabel(value) {
        const labels = {
            active: 'Aktif',
            completed: 'Selesai',
            draft: 'Draft',
            archived: 'Diarsipkan'
        };
        const normalized = String(value || '').toLowerCase();
        return labels[normalized] || 'Program';
    }

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return displayText(String(value).slice(0, 10));
        return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(date);
    }

    function formatPeriod(startDate, endDate) {
        const start = formatDate(startDate);
        const end = formatDate(endDate);
        if (start && end) return `${start} – ${end}`;
        return start || end || 'Belum ditentukan';
    }

    function formatAssignmentDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        }).format(date);
    }

    function chooseEnrollment(enrollments, requestedBatchId) {
        const safeEnrollments = Array.isArray(enrollments) ? enrollments.filter((item) => item && item.id) : [];
        if (safeEnrollments.length === 0) return null;
        return safeEnrollments.find((item) => item.id === requestedBatchId) || safeEnrollments[0];
    }

    function entryFromContent(item, index) {
        return {
            id: String(item.contentId || `content-${index}`),
            kind: 'content',
            type: String(item.type || 'page'),
            title: displayText(item.title, 'Materi BCL'),
            href: safeContentHref(item.href),
            required: item.required === true,
            serverStatus: item.status === 'completed' ? 'completed' : 'not_started',
            sequenceNumber: Number(item.sequenceNumber || index)
        };
    }

    function entryFromAssessment(item, index) {
        return {
            id: String(item.quizId || `assessment-${index}`),
            kind: 'quiz',
            type: 'quiz',
            title: displayText(item.title, 'Quiz BCL'),
            href: safeContentHref(item.href),
            required: item.required !== false,
            serverStatus: item.status === 'completed' ? 'completed' : 'not_started',
            sequenceNumber: Number(item.sequenceNumber || (1000 + index))
        };
    }

    function deriveJourney(path, progress) {
        const rawModules = path && Array.isArray(path.modules) ? path.modules : [];
        const modules = rawModules
            .map((module, moduleIndex) => {
                const content = (Array.isArray(module.items) ? module.items : []).map(entryFromContent);
                const assessments = (Array.isArray(module.assessments) ? module.assessments : []).map(entryFromAssessment);
                return {
                    id: String(module.id || module.moduleKey || `module-${moduleIndex}`),
                    moduleKey: String(module.moduleKey || module.id || `module-${moduleIndex}`),
                    title: displayText(module.title, `Tahap ${moduleIndex + 1}`),
                    outcome: displayText(module.outcome, ''),
                    sequenceNumber: Number(module.sequenceNumber || moduleIndex),
                    serverProgress: module.progress || {},
                    entries: [...content, ...assessments].sort((left, right) => left.sequenceNumber - right.sequenceNumber),
                    index: moduleIndex
                };
            })
            .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
            .map((module, index) => ({ ...module, index }));

        const requiredEntries = modules.flatMap((module) => module.entries
            .filter((entry) => entry.required)
            .map((entry) => ({ entry, module })));
        const current = requiredEntries.find(({ entry }) => entry.serverStatus !== 'completed') || null;

        modules.forEach((module) => {
            const required = module.entries.filter((entry) => entry.required);
            const completed = required.filter((entry) => entry.serverStatus === 'completed');
            const contentRequired = required.filter((entry) => entry.kind === 'content');
            const quizRequired = required.filter((entry) => entry.kind === 'quiz');
            const allContentComplete = contentRequired.length > 0 && contentRequired.every((entry) => entry.serverStatus === 'completed');
            const quizPending = quizRequired.some((entry) => entry.serverStatus !== 'completed');
            const isCurrent = current && current.module.id === module.id;

            module.uiStatus = required.length > 0 && completed.length === required.length
                ? 'completed'
                : isCurrent || completed.length > 0 ? 'in_progress' : 'not_started';
            module.quizPending = Boolean(isCurrent && allContentComplete && quizPending);
            module.statusText = module.quizPending
                ? 'Materi selesai · Quiz belum selesai'
                : module.uiStatus === 'completed' ? 'Selesai'
                    : module.uiStatus === 'in_progress' ? 'Sedang Dipelajari' : 'Belum Mulai';
            module.entries.forEach((entry) => {
                entry.uiStatus = entry.serverStatus === 'completed'
                    ? 'completed'
                    : current && current.entry.id === entry.id && current.module.id === module.id
                        ? 'in_progress' : 'not_started';
            });
        });

        const serverPercent = Number(progress && progress.percent);
        const required = Number(progress && progress.required);
        const completed = Number(progress && progress.completed);
        return {
            modules,
            current,
            allComplete: requiredEntries.length > 0 && !current,
            progress: {
                percent: Number.isFinite(serverPercent) ? serverPercent : 0,
                required: Number.isFinite(required) ? required : 0,
                completed: Number.isFinite(completed) ? completed : 0
            }
        };
    }

    function moduleIcon(module) {
        if (module.uiStatus === 'completed') return '<i class="fas fa-check" aria-hidden="true"></i>';
        return String(module.index + 1).padStart(2, '0');
    }

    function itemIcon(type) {
        const icons = { page: 'fa-file-lines', video: 'fa-circle-play', pdf: 'fa-file-pdf', quiz: 'fa-circle-question' };
        return icons[type] || 'fa-book-open';
    }

    function itemStatusText(status) {
        if (status === 'completed') return 'Selesai';
        if (status === 'in_progress') return 'Sedang Dipelajari';
        return 'Belum Mulai';
    }

    function renderEntryMarkup(entry) {
        const tag = entry.href ? 'a' : 'span';
        const href = entry.href ? ` href="${escapeHtml(entry.href)}"` : '';
        const unavailable = entry.href ? '' : ' is-unavailable';
        const stateClass = entry.uiStatus === 'completed' ? ' is-completed'
            : entry.uiStatus === 'in_progress' ? ' is-current' : '';
        return `
            <${tag} class="internship-learning-item${unavailable}"${href}${entry.href ? ' data-canonical-learning-link' : ''}>
                <span class="internship-learning-item-main">
                    <i class="fas ${itemIcon(entry.type)}" aria-hidden="true"></i>
                    <span>${escapeHtml(entry.title)}</span>
                </span>
                <span class="internship-item-state${stateClass}">${entry.href ? itemStatusText(entry.uiStatus) : 'Belum tersedia'}</span>
            </${tag}>`;
    }

    function renderLearningPathMarkup(journey) {
        return journey.modules.map((module) => `
            <article class="internship-module is-${module.uiStatus.replace('_', '-')}${module.quizPending ? ' has-quiz-pending' : ''}">
                <div class="internship-module-number" aria-hidden="true">${moduleIcon(module)}</div>
                <div class="internship-module-copy">
                    <h3>${escapeHtml(module.title)}</h3>
                    ${module.outcome ? `<p>${escapeHtml(module.outcome)}</p>` : ''}
                    <div class="internship-module-items">
                        ${module.entries.map(renderEntryMarkup).join('') || '<span class="internship-learning-item is-unavailable">Materi belum tersedia.</span>'}
                    </div>
                </div>
                <span class="internship-module-status">${escapeHtml(module.statusText)}</span>
            </article>
        `).join('');
    }

    function assignmentStateText(state) {
        const labels = {
            upcoming: 'Akan Datang',
            available: 'Tersedia',
            locked: 'Belum Terbuka',
            closed: 'Ditutup'
        };
        return labels[state] || 'Belum Terbuka';
    }

    function renderAssignmentReference(reference) {
        const href = safeContentHref(reference && reference.href);
        const title = displayText(reference && reference.title, 'Materi BCL');
        const completedClass = reference && reference.completed === true ? ' is-completed' : '';
        const label = `${reference && reference.relationship === 'prerequisite' ? 'Prasyarat' : 'Referensi'}: ${title}`;
        return href
            ? `<a class="internship-assignment-reference${completedClass}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
            : `<span class="internship-assignment-reference${completedClass}">${escapeHtml(label)}</span>`;
    }

    function renderEvidenceMarkup(evidence, editable) {
        const safeName = displayText(evidence && evidence.safeDisplayName, 'Evidence');
        const mimeType = displayText(evidence && evidence.mimeType, 'File');
        const extension = safeName.includes('.') ? safeName.split('.').pop().toUpperCase() : mimeType;
        const uploadedAt = submissionUi.formatServerDateTime(evidence && evidence.uploadedAt);
        const status = submissionUi.scanStatusLabel(evidence && evidence.scanStatus);
        const evidenceId = String(evidence && evidence.evidenceId || '');
        return `
            <li class="internship-evidence-row">
                <span class="internship-evidence-icon" aria-hidden="true"><i class="fas fa-file-lines"></i></span>
                <span class="internship-evidence-copy">
                    <strong>${escapeHtml(safeName)}</strong>
                    <span>${escapeHtml(extension)} &middot; ${escapeHtml(submissionUi.formatEvidenceSize(evidence && evidence.sizeBytes))}${uploadedAt ? ` &middot; ${escapeHtml(uploadedAt)}` : ''}</span>
                </span>
                <span class="internship-evidence-status is-${escapeHtml(String(evidence && evidence.scanStatus || 'pending'))}">
                    <i class="fas fa-circle" aria-hidden="true"></i>${escapeHtml(status)}
                </span>
                ${editable ? `<button type="button" class="internship-text-action" data-submission-action="remove" data-evidence-id="${escapeHtml(evidenceId)}">Hapus</button>` : ''}
            </li>`;
    }

    function participantReviewLabel(review, submission) {
        if (submission && submission.state === 'draft' && Number(submission.revisionNo || 1) > 1) return 'Revisi Disiapkan';
        const labels = {
            not_started: 'Belum Direview',
            under_review: 'Sedang Direview',
            revision_requested: 'Perlu Revisi',
            accepted: 'Diterima'
        };
        return labels[String(review && review.state || 'not_started')] || 'Belum Direview';
    }

    function renderParticipantScores(review) {
        const criteriaRows = review && review['rub' + 'ric'];
        const criteria = new Map((Array.isArray(criteriaRows) ? criteriaRows : [])
            .map((item) => [String(item.criterionId), item]));
        const scores = Array.isArray(review && review.scores) ? review.scores : [];
        if (!scores.length) return '';
        return `<dl class="internship-review-scores">${scores.map((score) => {
            const criterion = criteria.get(String(score.criterionId)) || {};
            return `<div><dt>${escapeHtml(displayText(criterion.title, 'Kriteria'))}</dt><dd>${Number(score.score || 0)} / ${Number(criterion.maxScore || 0)}</dd></div>`;
        }).join('')}</dl>`;
    }

    function renderParticipantReview(submission, reviewPayload, isBusy) {
        if (!submission || !reviewPayload) return '';
        const review = reviewPayload.review || { state: 'not_started' };
        const status = participantReviewLabel(review, submission);
        const terminal = review.state === 'revision_requested' || review.state === 'accepted';
        const history = Array.isArray(reviewPayload.revisionHistory) ? reviewPayload.revisionHistory : [];
        return `
            <section class="internship-participant-review is-${escapeHtml(String(review.state || 'not_started').replace(/_/g, '-'))}" aria-label="Hasil review mentor">
                <div class="internship-review-heading">
                    <div><span>Review Mentor</span><strong>${escapeHtml(status)}</strong></div>
                    <span>Revisi ${Number(submission.revisionNo || reviewPayload.revisionNo || 1)}</span>
                </div>
                ${terminal && review.participantFeedback ? `<div class="internship-review-feedback"><h4>Feedback mentor</h4><p>${escapeHtml(review.participantFeedback)}</p></div>` : ''}
                ${terminal ? renderParticipantScores(review) : ''}
                ${reviewPayload.canCreateRevision ? `<button type="button" class="internship-submission-action" data-submission-action="revision" ${isBusy ? 'disabled' : ''}>
                    ${isBusy ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Menyiapkan Revisi' : 'Buat Revisi Baru'}
                </button>` : ''}
                ${history.length > 1 ? `<details class="internship-revision-history"><summary>Riwayat revisi (${history.length})</summary><ol>${history.map((item) => `
                    <li><strong>Revisi ${Number(item.revisionNo || 1)}</strong><span>${escapeHtml(participantReviewLabel({ state: item.reviewState }, { state: item.submissionState, revisionNo: item.revisionNo }))}</span>${item.participantFeedback ? `<p>${escapeHtml(item.participantFeedback)}</p>` : ''}</li>`).join('')}</ol></details>` : ''}
            </section>`;
    }

    function renderSubmissionPanel(assignment, options) {
        const result = options.submissionsByAssignment.get(String(assignment.assignmentId)) || null;
        const submission = result && result.submission;
        const status = submissionUi.submissionStatusLabel(submission && submission.state);
        const evidence = submission && Array.isArray(submission.evidence) ? submission.evidence : [];
        const action = options.pendingActions.get(String(assignment.assignmentId)) || '';
        const error = options.errors.get(String(assignment.assignmentId)) || '';
        const notice = options.notices.get(String(assignment.assignmentId)) || '';
        const isDraft = submission && submission.state === 'draft';
        const isWithdrawn = submission && submission.state === 'withdrawn';
        const isSubmitted = submission && submission.state === 'submitted';
        const isAvailable = assignment.state === 'available';
        const isBusy = Boolean(action);
        const canSubmit = isDraft && isAvailable && evidence.length > 0 && !isBusy;
        const uploadProgress = Number(options.uploadProgress.get(String(assignment.assignmentId)) || 0);
        const submissionTime = isSubmitted ? submissionUi.formatServerDateTime(submission.submittedAt) : '';
        const reviewPayload = options.reviewsByAssignment.get(String(assignment.assignmentId)) || null;

        return `
            <section class="internship-submission is-${isSubmitted ? 'submitted' : isDraft || isWithdrawn ? 'draft' : 'empty'}" aria-label="Pengumpulan tugas">
                <div class="internship-submission-heading">
                    <div>
                        <span>Status Pengumpulan</span>
                        <strong>${escapeHtml(status)}</strong>
                    </div>
                    ${submissionTime ? `<p>Dikirim ${escapeHtml(submissionTime)}</p>` : ''}
                </div>
                ${!submission ? `
                    <p class="internship-submission-note">Mulai tugas untuk menyiapkan draft dan menambahkan evidence.</p>
                    ${isAvailable ? `<button type="button" class="internship-submission-action" data-submission-action="start" ${isBusy ? 'disabled' : ''}>
                        ${action === 'start' ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Menyiapkan Draft' : 'Mulai Tugas'}
                    </button>` : ''}
                ` : `
                    <div class="internship-evidence">
                        <div class="internship-evidence-heading">
                            <div><h4>Evidence</h4><p>Tambahkan hasil pekerjaan sesuai output tugas.</p></div>
                            <span>${evidence.length} / ${submissionUi.MAX_FILES_PER_SUBMISSION} file</span>
                        </div>
                        ${evidence.length ? `<ul class="internship-evidence-list">${evidence.map((item) => renderEvidenceMarkup(item, isDraft && isAvailable && !isBusy)).join('')}</ul>` : '<p class="internship-evidence-empty">Belum ada evidence pada draft ini.</p>'}
                        ${isDraft ? `
                            ${action === 'upload' ? `<div class="internship-upload-progress" role="status" aria-live="polite">
                                <span>Mengunggah... ${uploadProgress}%</span>
                                <span class="internship-upload-track"><span style="width:${Math.max(4, uploadProgress)}%"></span></span>
                            </div>` : ''}
                            ${isAvailable && evidence.length < submissionUi.MAX_FILES_PER_SUBMISSION ? `
                                <input class="internship-evidence-input" type="file" data-evidence-input
                                    accept=".pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png" aria-label="Pilih file evidence" ${isBusy ? 'disabled' : ''}>
                                <button type="button" class="internship-secondary-action" data-submission-action="choose" ${isBusy ? 'disabled' : ''}>
                                    <i class="fas fa-plus" aria-hidden="true"></i> Pilih File
                                </button>` : ''}
                            <p class="internship-file-policy">PDF, DOCX, XLSX, CSV, JPG, JPEG, PNG &middot; Maks. 10 MiB per file</p>
                            <div class="internship-submission-footer">
                                <button type="button" class="internship-submission-action" data-submission-action="submit" ${canSubmit ? '' : 'disabled'}>
                                    ${action === 'submit' ? '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Mengirim' : Number(submission.revisionNo || 1) > 1 ? 'Kirim Revisi' : 'Kirim Tugas'}
                                </button>
                            </div>
                        ` : isWithdrawn ? `
                            <p class="internship-submission-frozen"><i class="fas fa-rotate-left" aria-hidden="true"></i> Pengumpulan telah ditarik. Lanjutkan kembali sebagai draft sebelum mengubah evidence.</p>
                            <button type="button" class="internship-submission-action" data-submission-action="start" ${isBusy || !isAvailable ? 'disabled' : ''}>Lanjutkan Pengumpulan</button>
                        ` : `
                            <p class="internship-submission-frozen"><i class="fas fa-lock" aria-hidden="true"></i> Pengumpulan telah dikunci. Menunggu proses evaluasi.</p>
                            ${result && result.withdrawalAllowed ? '<button type="button" class="internship-text-action" data-submission-action="withdraw">Tarik Pengumpulan</button>' : ''}
                        `}
                    </div>
                `}
                ${options.reviewEnabled ? renderParticipantReview(submission, reviewPayload, action === 'revision') : ''}
                <p class="internship-submission-feedback${error ? ' is-error' : notice ? ' is-success' : ''}" role="status" aria-live="polite">${escapeHtml(error || notice)}</p>
            </section>`;
    }

    function renderAssignmentsMarkup(assignments, options = {}) {
        const renderOptions = {
            submissionsEnabled: options.submissionsEnabled === true,
            reviewEnabled: options.reviewEnabled === true,
            submissionsByAssignment: options.submissionsByAssignment instanceof Map ? options.submissionsByAssignment : new Map(),
            reviewsByAssignment: options.reviewsByAssignment instanceof Map ? options.reviewsByAssignment : new Map(),
            pendingActions: options.pendingActions instanceof Map ? options.pendingActions : new Map(),
            uploadProgress: options.uploadProgress instanceof Map ? options.uploadProgress : new Map(),
            errors: options.errors instanceof Map ? options.errors : new Map(),
            notices: options.notices instanceof Map ? options.notices : new Map()
        };
        return (Array.isArray(assignments) ? assignments : []).map((assignment) => {
            const state = ['upcoming', 'available', 'locked', 'closed'].includes(assignment.state)
                ? assignment.state : 'locked';
            const references = Array.isArray(assignment.learningReferences) ? assignment.learningReferences : [];
            const dueAt = formatAssignmentDate(assignment.dueAt);
            const availableAt = formatAssignmentDate(assignment.availableAt);
            const requiredDeliverable = displayText(assignment.requiredDeliverable);
            return `
                <article class="internship-assignment is-${state}" data-assignment-id="${escapeHtml(String(assignment.assignmentId || ''))}">
                    <div>
                        <p class="internship-assignment-topic">${escapeHtml(displayText(
                            assignment.topic && assignment.topic.title,
                            'Tugas Praktik'
                        ))}</p>
                        <h3>${escapeHtml(displayText(assignment.title, 'Tugas Praktik'))}</h3>
                        ${assignment.brief ? `<p class="internship-assignment-brief">${escapeHtml(displayText(assignment.brief))}</p>` : ''}
                        <dl class="internship-assignment-detail">
                            ${references.length ? `<div><dt>Materi terkait</dt><dd class="internship-assignment-references">${references.map(renderAssignmentReference).join('')}</dd></div>` : ''}
                            ${requiredDeliverable ? `<div><dt>Output</dt><dd>${escapeHtml(requiredDeliverable)}</dd></div>` : ''}
                            ${availableAt ? `<div><dt>Tersedia mulai</dt><dd>${escapeHtml(availableAt)}</dd></div>` : ''}
                            ${dueAt ? `<div><dt>Deadline</dt><dd>${escapeHtml(dueAt)}</dd></div>` : ''}
                            ${state === 'locked' ? '<div><dt>Catatan</dt><dd>Selesaikan materi prasyarat terlebih dahulu.</dd></div>' : ''}
                        </dl>
                    </div>
                    <span class="internship-assignment-status">${assignmentStateText(state)}</span>
                    ${renderOptions.submissionsEnabled ? renderSubmissionPanel(assignment, renderOptions) : ''}
                </article>`;
        }).join('');
    }

    function classifyFailure(status, stage) {
        if (status === 401) return 'unauthenticated';
        if (status === 403) return 'unauthorized';
        if (status === 404 && stage === 'enrollments') return 'feature_disabled';
        if (status === 404) return 'unavailable';
        return 'error';
    }

    function programStatusLabel(status) {
        return ({
            not_started: 'Belum Dimulai',
            in_progress: 'Sedang Berjalan',
            requirements_met: 'Persyaratan Terpenuhi',
            completed: 'Selesai'
        })[String(status || '')] || 'Dalam proses';
    }

    function renderProgramStatusMarkup(data) {
        const dimensions = data && data.dimensions || {};
        const rows = [
            ['Learning', dimensions.learning && dimensions.learning.required],
            ['Submitted', dimensions.submitted && dimensions.submitted.required],
            ['Accepted', dimensions.accepted && dimensions.accepted.required]
        ];
        const blockers = [
            ...(Array.isArray(data && data.blockers) ? data.blockers : []),
            ...(Array.isArray(data && data.integrityIssues) ? data.integrityIssues : [])
        ];
        return {
            status: programStatusLabel(data && data.status),
            metrics: rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${Number(value && value.completed || 0)} / ${Number(value && value.total || 0)}</dd></div>`).join(''),
            blockers: blockers.length
                ? `<p>Yang masih perlu ditindaklanjuti:</p><ul>${blockers.map((item) => `<li class="${item.scope === 'system' ? 'is-system' : ''}">${escapeHtml(displayText(item.label, 'Persyaratan belum terpenuhi'))}</li>`).join('')}</ul>`
                : data && data.status === 'completed'
                    ? `<dl class="internship-completion-meta"><div><dt>Diselesaikan</dt><dd>${escapeHtml(formatAssignmentDate(data.closeout && data.closeout.completedAt))}</dd></div><div><dt>Status Sertifikat</dt><dd>${data.certificateEligible ? 'Memenuhi Syarat' : 'Belum Memenuhi Syarat'}</dd></div></dl>`
                    : data && data.status === 'requirements_met'
                        ? '<p>Seluruh persyaratan program telah terpenuhi. Program menunggu proses penutupan oleh mentor atau administrator.</p>'
                        : '<p>Tidak ada blocker aktif.</p>'
        };
    }

    function createPageController(windowObject) {
        const document = windowObject.document;
        const state = {
            enrollments: [], selectedId: '', loadSequence: 0,
            assignmentPayload: null,
            submissionsEnabled: false,
            reviewEnabled: false,
            completionEnabled: false,
            submissionsByAssignment: new Map(),
            reviewsByAssignment: new Map(),
            pendingActions: new Map(),
            uploadProgress: new Map(),
            errors: new Map(),
            notices: new Map()
        };
        const byId = (id) => document.getElementById(id);

        function token() {
            if (windowObject.BclAuth && typeof windowObject.BclAuth.token === 'function') {
                return windowObject.BclAuth.token();
            }
            return windowObject.localStorage.getItem('token') || '';
        }

        async function requestJson(path, options = {}) {
            const accessToken = token();
            if (!accessToken) throw new InternshipApiError(401, 'AUTHENTICATION_REQUIRED');

            const controller = new AbortController();
            const timeout = windowObject.setTimeout(() => controller.abort(), 15000);
            try {
                const headers = { Authorization: `Bearer ${accessToken}` };
                if (options.body !== undefined) headers['Content-Type'] = 'application/json';
                const response = await windowObject.fetch(path, {
                    method: options.method || 'GET',
                    headers,
                    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
                    credentials: 'same-origin',
                    cache: 'no-store',
                    signal: controller.signal
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new InternshipApiError(response.status, payload.code);
                return payload;
            } finally {
                windowObject.clearTimeout(timeout);
            }
        }

        function setState(kind) {
            const configurations = {
                loading: ['fa-circle-notch fa-spin', 'Memuat program Anda', 'Menyiapkan learning path dan progress terbaru dari BCL.', ''],
                switching: ['fa-circle-notch fa-spin', 'Mengganti program', 'Memuat konteks program yang dipilih.', ''],
                empty: ['fa-compass', 'Anda belum terdaftar pada program magang aktif.', 'Silakan hubungi mentor atau administrator program.', ''],
                feature_disabled: ['fa-toggle-off', 'Program Magang / Internship belum tersedia.', 'Fitur ini belum diaktifkan pada lingkungan BCL saat ini.', ''],
                unauthenticated: ['fa-lock', 'Login diperlukan', 'Silakan login untuk membuka program magang Anda.', '/pages/login.html'],
                unauthorized: ['fa-shield-halved', 'Akses program tidak tersedia', 'Akun Anda tidak memiliki akses ke program tersebut.', ''],
                unavailable: ['fa-circle-exclamation', 'Program tidak tersedia', 'Program yang dipilih tidak dapat dimuat. Pilih program lain atau hubungi administrator.', ''],
                error: ['fa-triangle-exclamation', 'Data program belum dapat dimuat', 'Periksa koneksi lalu coba kembali beberapa saat lagi.', '']
            };
            const config = configurations[kind] || configurations.error;
            const stateElement = byId('internship-state');
            byId('internship-content').hidden = true;
            hideAssignments();
            stateElement.hidden = false;
            stateElement.innerHTML = `
                <span class="internship-state-icon" aria-hidden="true"><i class="fas ${config[0]}"></i></span>
                <div>
                    <h2>${escapeHtml(config[1])}</h2>
                    <p>${escapeHtml(config[2])}</p>
                    ${config[3] ? `<a class="internship-state-action" href="${config[3]}?redirect=${encodeURIComponent(windowObject.location.href)}">Login ke BCL</a>` : ''}
                </div>`;
        }

        function hideAssignments() {
            const section = byId('internship-assignments');
            if (section) section.hidden = true;
        }

        function hideProgramStatus() {
            const section = byId('internship-program-summary');
            if (section) section.hidden = true;
        }

        function renderProgramStatus(data) {
            const section = byId('internship-program-summary');
            if (!section) return;
            const markup = renderProgramStatusMarkup(data || {});
            byId('internship-completion-status').textContent = markup.status;
            byId('internship-program-metrics').innerHTML = markup.metrics;
            byId('internship-program-blockers').innerHTML = markup.blockers;
            section.hidden = false;
        }

        async function loadProgramStatus(batchId, sequence = state.loadSequence) {
            if (!state.completionEnabled) return hideProgramStatus();
            try {
                const response = await requestJson(`${API_BASE}/${encodeURIComponent(batchId)}/program-status`);
                if (sequence === state.loadSequence) renderProgramStatus(response.data || {});
            } catch (_) {
                if (sequence === state.loadSequence) hideProgramStatus();
            }
        }

        function resetSubmissionState() {
            state.assignmentPayload = null;
            state.submissionsEnabled = false;
            state.reviewEnabled = false;
            state.submissionsByAssignment.clear();
            state.reviewsByAssignment.clear();
            state.pendingActions.clear();
            state.uploadProgress.clear();
            state.errors.clear();
            state.notices.clear();
        }

        function assignmentById(assignmentId) {
            const assignments = state.assignmentPayload && Array.isArray(state.assignmentPayload.assignments)
                ? state.assignmentPayload.assignments : [];
            return assignments.find((item) => String(item.assignmentId) === String(assignmentId)) || null;
        }

        function renderAssignments(payload = state.assignmentPayload) {
            const section = byId('internship-assignments');
            const stateElement = byId('internship-assignment-state');
            const list = byId('internship-assignment-list');
            const assignments = payload && Array.isArray(payload.assignments) ? payload.assignments : [];
            if (!section || !stateElement || !list) return;

            section.hidden = false;
            byId('internship-assignment-summary').textContent = assignments.length
                ? `${Number(payload.summary && payload.summary.available || 0)} tersedia · ${Number(payload.summary && payload.summary.upcoming || 0)} akan datang`
                : '';
            if (assignments.length === 0) {
                list.innerHTML = '';
                stateElement.hidden = false;
                stateElement.textContent = 'Tugas praktik belum tersedia untuk tahap ini.';
                return;
            }
            stateElement.hidden = true;
            list.innerHTML = renderAssignmentsMarkup(assignments, {
                submissionsEnabled: state.submissionsEnabled,
                reviewEnabled: state.reviewEnabled,
                submissionsByAssignment: state.submissionsByAssignment,
                reviewsByAssignment: state.reviewsByAssignment,
                pendingActions: state.pendingActions,
                uploadProgress: state.uploadProgress,
                errors: state.errors,
                notices: state.notices
            });
        }

        async function loadSubmission(assignmentId, sequence = state.loadSequence) {
            const response = await requestJson(submissionUi.submissionPath(state.selectedId, assignmentId));
            if (sequence !== state.loadSequence) return null;
            state.submissionsByAssignment.set(String(assignmentId), response.data || null);
            return response.data || null;
        }

        async function loadParticipantReview(assignmentId, sequence = state.loadSequence) {
            const path = `${submissionUi.submissionPath(state.selectedId, assignmentId)}/review`;
            const response = await requestJson(path);
            if (sequence !== state.loadSequence) return null;
            state.reviewsByAssignment.set(String(assignmentId), response.data || null);
            return response.data || null;
        }

        async function loadAssignments(batchId, sequence) {
            const encoded = encodeURIComponent(batchId);
            try {
                const response = await requestJson(`${API_BASE}/${encoded}/assignments`);
                if (sequence !== state.loadSequence) return;
                resetSubmissionState();
                state.assignmentPayload = response.data || {};
                state.submissionsEnabled = Boolean(
                    state.assignmentPayload.capabilities
                    && state.assignmentPayload.capabilities.participantSubmissions === true
                );
                state.reviewEnabled = Boolean(
                    state.assignmentPayload.capabilities
                    && state.assignmentPayload.capabilities.participantReview === true
                );
                if (state.submissionsEnabled) {
                    const assignments = Array.isArray(state.assignmentPayload.assignments)
                        ? state.assignmentPayload.assignments : [];
                    await Promise.all(assignments.map(async (assignment) => {
                        try {
                            await loadSubmission(assignment.assignmentId, sequence);
                            if (state.reviewEnabled) await loadParticipantReview(assignment.assignmentId, sequence);
                        } catch (error) {
                            if (sequence === state.loadSequence) {
                                state.errors.set(String(assignment.assignmentId), submissionUi.safeSubmissionError(error));
                            }
                        }
                    }));
                    if (sequence === state.loadSequence) renderAssignments();
                } else {
                    renderAssignments();
                }
            } catch (error) {
                if (sequence !== state.loadSequence) return;
                if (error.status === 404) {
                    hideAssignments();
                    return;
                }
                const section = byId('internship-assignments');
                const stateElement = byId('internship-assignment-state');
                if (!section || !stateElement) return;
                section.hidden = false;
                byId('internship-assignment-list').innerHTML = '';
                byId('internship-assignment-summary').textContent = '';
                stateElement.hidden = false;
                stateElement.textContent = 'Tugas praktik belum dapat dimuat. Coba kembali beberapa saat lagi.';
            }
        }

        function setPending(assignmentId, action, progress = 0) {
            const id = String(assignmentId);
            state.errors.delete(id);
            state.notices.delete(id);
            if (action) state.pendingActions.set(id, action);
            else state.pendingActions.delete(id);
            if (action === 'upload') state.uploadProgress.set(id, progress);
            else state.uploadProgress.delete(id);
            renderAssignments();
        }

        async function performSubmissionAction(assignmentId, action, evidenceId = '') {
            const id = String(assignmentId);
            if (!state.submissionsEnabled || state.pendingActions.has(id) || !assignmentById(id)) return;
            const basePath = submissionUi.submissionPath(state.selectedId, id);
            const requests = {
                start: { path: basePath, method: 'POST' },
                submit: { path: `${basePath}/submit`, method: 'POST' },
                withdraw: { path: `${basePath}/withdraw`, method: 'POST' },
                remove: { path: `${basePath}/evidence/${encodeURIComponent(evidenceId)}`, method: 'DELETE' }
                ,revision: { path: `${basePath}/revision`, method: 'POST' }
            };
            const selected = requests[action];
            if (!selected) return;
            if (action === 'submit' && !windowObject.confirm('Kirim tugas ini?\n\nSetelah dikirim, evidence tidak dapat diubah sampai mekanisme revisi dibuka oleh mentor.')) return;
            if (action === 'remove' && !windowObject.confirm('Hapus evidence ini dari draft?')) return;
            if (action === 'withdraw' && !windowObject.confirm('Tarik pengumpulan ini kembali menjadi draft?')) return;
            if (action === 'revision' && !windowObject.confirm('Buat revisi baru? Evidence revisi sebelumnya tetap tersimpan dan draft baru dimulai tanpa file.')) return;

            const sequence = state.loadSequence;
            setPending(id, action);
            try {
                await requestJson(selected.path, { method: selected.method });
                if (sequence !== state.loadSequence) return;
                state.notices.set(id, action === 'remove' ? 'Evidence dihapus dari draft.'
                    : action === 'submit' ? 'Tugas berhasil dikirim.'
                        : action === 'withdraw' ? 'Pengumpulan kembali menjadi draft.' : 'Draft siap digunakan.');
                await loadSubmission(id, sequence);
                if (state.reviewEnabled) await loadParticipantReview(id, sequence);
                await loadProgramStatus(state.selectedId, sequence);
            } catch (error) {
                if (sequence === state.loadSequence) state.errors.set(id, submissionUi.safeSubmissionError(error));
            } finally {
                if (sequence === state.loadSequence) {
                    state.pendingActions.delete(id);
                    renderAssignments();
                }
            }
        }

        async function uploadSelectedEvidence(input) {
            const article = input.closest('[data-assignment-id]');
            const assignmentId = article && article.dataset.assignmentId;
            const file = input.files && input.files[0];
            if (!assignmentId || !file || state.pendingActions.has(String(assignmentId))) return;
            const result = state.submissionsByAssignment.get(String(assignmentId));
            const evidence = result && result.submission && Array.isArray(result.submission.evidence)
                ? result.submission.evidence : [];
            const validation = submissionUi.validateEvidenceFile(file, evidence.length);
            if (!validation.valid) {
                state.errors.set(String(assignmentId), submissionUi.safeSubmissionError(validation));
                input.value = '';
                renderAssignments();
                return;
            }

            const sequence = state.loadSequence;
            setPending(assignmentId, 'upload', 0);
            try {
                await submissionUi.uploadEvidence(windowObject, {
                    url: `${submissionUi.submissionPath(state.selectedId, assignmentId)}/evidence`,
                    token: token(),
                    file,
                    onProgress(percent) {
                        if (sequence !== state.loadSequence) return;
                        state.uploadProgress.set(String(assignmentId), percent);
                        const articleElement = [...byId('internship-assignment-list').querySelectorAll('[data-assignment-id]')]
                            .find((element) => element.dataset.assignmentId === String(assignmentId));
                        const progress = articleElement && articleElement.querySelector('.internship-upload-progress');
                        if (progress) {
                            progress.firstElementChild.textContent = `Mengunggah... ${percent}%`;
                            progress.querySelector('.internship-upload-track span').style.width = `${Math.max(4, percent)}%`;
                        }
                    }
                });
                if (sequence !== state.loadSequence) return;
                state.notices.set(String(assignmentId), 'Berhasil ditambahkan.');
                await loadSubmission(assignmentId, sequence);
            } catch (error) {
                if (sequence === state.loadSequence) {
                    state.errors.set(String(assignmentId), submissionUi.safeSubmissionError(error));
                }
            } finally {
                if (sequence === state.loadSequence) {
                    state.pendingActions.delete(String(assignmentId));
                    state.uploadProgress.delete(String(assignmentId));
                    renderAssignments();
                }
            }
        }

        function handleAssignmentClick(event) {
            const button = event.target.closest('[data-submission-action]');
            if (!button) return;
            const article = button.closest('[data-assignment-id]');
            const assignmentId = article && article.dataset.assignmentId;
            if (!assignmentId) return;
            const action = button.dataset.submissionAction;
            if (action === 'choose') {
                const input = article.querySelector('[data-evidence-input]');
                if (input) input.click();
                return;
            }
            performSubmissionAction(assignmentId, action, button.dataset.evidenceId || '');
        }

        function handleAssignmentChange(event) {
            if (event.target.matches('[data-evidence-input]')) uploadSelectedEvidence(event.target);
        }

        function renderProgramSelector() {
            const picker = byId('internship-program-picker');
            const select = byId('internship-program-select');
            picker.hidden = state.enrollments.length <= 1;
            const reviewEntry = byId('internship-review-entry');
            if (reviewEntry) reviewEntry.hidden = !state.enrollments.some((program) => program.capabilities
                && program.capabilities.review === true
                && ['mentor', 'reviewer', 'admin', 'system_admin'].includes(program.participantRole));
            select.replaceChildren();
            state.enrollments.forEach((program) => {
                const option = document.createElement('option');
                option.value = program.id;
                option.textContent = displayText(program.title, displayText(program.code, 'Program Magang'));
                option.selected = program.id === state.selectedId;
                select.appendChild(option);
            });
        }

        function renderProgram(program, path, progress) {
            const journey = deriveJourney(path, progress);
            const participantName = displayText(program.participant && program.participant.displayName, 'BCL participant');
            const mentors = Array.isArray(program.mentors) ? program.mentors : [];
            const mentorNames = mentors.map((mentor) => displayText(mentor.displayName)).filter(Boolean);
            const percent = journey.progress.percent;
            const progressWidth = Math.max(0, Math.min(100, percent));
            const currentModule = journey.current && journey.current.module;
            const currentEntry = journey.current && journey.current.entry;

            byId('internship-program-code').textContent = displayText(program.code, 'Program Magang');
            byId('internship-program-status').textContent = statusLabel(program.status);
            byId('internship-program-title').textContent = displayText(program.title, 'Program Magang / Internship');
            byId('internship-participant').textContent = participantName;
            byId('internship-track').textContent = displayText(path.title, 'Learning Path BCL');
            byId('internship-mentor').textContent = mentorNames.join(', ') || 'Belum ditentukan';
            byId('internship-period').textContent = formatPeriod(program.startDate, program.endDate);
            byId('internship-progress-value').textContent = `${percent}%`;
            byId('internship-progress-caption').textContent = `${journey.progress.completed} dari ${journey.progress.required} item wajib selesai`;
            byId('internship-progress-fill').style.width = `${progressWidth}%`;
            byId('internship-progress-bar').setAttribute('aria-valuenow', String(progressWidth));

            const focusIndex = byId('internship-focus-index');
            const focusTitle = byId('internship-focus-title');
            const focusDescription = byId('internship-focus-description');
            const focusAction = byId('internship-focus-action');
            if (journey.allComplete) {
                focusIndex.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
                focusTitle.textContent = 'Seluruh learning path telah selesai.';
                focusDescription.textContent = 'Progress learning sudah lengkap. Penyelesaian program final mengikuti fase program berikutnya.';
                focusAction.hidden = true;
            } else if (currentModule && currentEntry) {
                focusIndex.textContent = String(currentModule.index + 1).padStart(2, '0');
                focusTitle.textContent = currentModule.title;
                focusDescription.textContent = currentModule.outcome || currentEntry.title;
                focusAction.hidden = false;
                if (currentEntry.href) {
                    focusAction.href = currentEntry.href;
                    focusAction.classList.remove('is-unavailable');
                    focusAction.querySelector('span').textContent = 'Lanjut belajar';
                } else {
                    focusAction.removeAttribute('href');
                    focusAction.classList.add('is-unavailable');
                    focusAction.querySelector('span').textContent = 'Materi belum tersedia';
                }
            } else {
                focusIndex.textContent = '—';
                focusTitle.textContent = 'Learning path belum memiliki item wajib.';
                focusDescription.textContent = 'Hubungi administrator program untuk informasi kurikulum.';
                focusAction.hidden = true;
            }

            byId('internship-path-version').textContent = `Versi ${Number(path.versionNumber || 1)}`;
            byId('internship-path-list').innerHTML = renderLearningPathMarkup(journey);
            byId('internship-summary-completed').textContent = `${journey.progress.completed} / ${journey.progress.required} item wajib`;
            byId('internship-summary-current').textContent = currentModule ? currentModule.title : (journey.allComplete ? 'Learning path selesai' : 'Belum tersedia');
            byId('internship-summary-next').textContent = currentEntry ? currentEntry.title : 'Tidak ada item berikutnya';

            byId('internship-state').hidden = true;
            const content = byId('internship-content');
            content.hidden = false;
            content.classList.remove('is-ready');
            windowObject.requestAnimationFrame(() => content.classList.add('is-ready'));
        }

        async function loadProgram(batchId, stateKind = 'switching') {
            const allowed = state.enrollments.some((program) => program.id === batchId);
            if (!allowed) {
                setState('unauthorized');
                return;
            }

            const sequence = ++state.loadSequence;
            state.selectedId = batchId;
            resetSubmissionState();
            const selectedProgram = state.enrollments.find((program) => program.id === batchId);
            state.completionEnabled = Boolean(selectedProgram && selectedProgram.capabilities
                && selectedProgram.capabilities.completion === true);
            hideProgramStatus();
            renderProgramSelector();
            setState(stateKind);
            const encoded = encodeURIComponent(batchId);

            try {
                const [programResponse, pathResponse, progressResponse] = await Promise.all([
                    requestJson(`${API_BASE}/${encoded}`),
                    requestJson(`${API_BASE}/${encoded}/learning-path`),
                    requestJson(`${API_BASE}/${encoded}/progress`)
                ]);
                if (sequence !== state.loadSequence) return;
                windowObject.history.replaceState({}, '', `${windowObject.location.pathname}?batch=${encodeURIComponent(batchId)}`);
                renderProgram(programResponse.data || {}, (pathResponse.data && pathResponse.data.path) || {}, progressResponse.data || {});
                await Promise.all([loadAssignments(batchId, sequence), loadProgramStatus(batchId, sequence)]);
            } catch (error) {
                if (sequence !== state.loadSequence) return;
                setState(classifyFailure(error.status, 'program'));
            }
        }

        async function loadEnrollments() {
            setState('loading');
            try {
                if (windowObject.bclAuthReady) await windowObject.bclAuthReady.catch(() => null);
                const response = await requestJson(`${API_BASE}/me`);
                state.enrollments = Array.isArray(response.data) ? response.data : [];
                if (state.enrollments.length === 0) {
                    renderProgramSelector();
                    setState('empty');
                    return;
                }

                const requestedId = new URLSearchParams(windowObject.location.search).get('batch');
                const selected = chooseEnrollment(state.enrollments, requestedId);
                state.selectedId = selected.id;
                renderProgramSelector();
                await loadProgram(selected.id, 'loading');
            } catch (error) {
                setState(classifyFailure(error.status, 'enrollments'));
            }
        }

        function init() {
            const select = byId('internship-program-select');
            if (!select || select.dataset.internshipReady === 'true') return;
            select.dataset.internshipReady = 'true';
            select.addEventListener('change', () => loadProgram(select.value));
            byId('internship-assignment-list').addEventListener('click', handleAssignmentClick);
            byId('internship-assignment-list').addEventListener('change', handleAssignmentChange);
            windowObject.addEventListener('pageshow', (event) => {
                if (event.persisted && state.selectedId) loadProgram(state.selectedId, 'loading');
            });
            loadEnrollments();
        }

        return { init, loadEnrollments, loadProgram };
    }

    return {
        InternshipApiError,
        chooseEnrollment,
        classifyFailure,
        createPageController,
        deriveJourney,
        displayText,
        renderLearningPathMarkup,
        renderAssignmentsMarkup,
        renderProgramStatusMarkup,
        safeContentHref
    };
});
