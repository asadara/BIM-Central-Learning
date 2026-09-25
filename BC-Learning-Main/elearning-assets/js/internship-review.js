(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BCLInternshipReviewPage = api;
    if (!root || !root.document) return;
    const start = () => api.createReviewController(root).init();
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})(typeof window !== 'undefined' ? window : null, function internshipReviewFactory() {
    'use strict';

    const API_BASE = '/api/training/internships';
    const REVIEW_ROLES = new Set(['mentor', 'reviewer', 'admin', 'system_admin']);

    class ReviewApiError extends Error {
        constructor(status, code) {
            super('Review request failed');
            this.status = Number(status || 0);
            this.code = String(code || 'REVIEW_REQUEST_FAILED');
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function safeText(value, fallback = '') {
        const text = String(value == null ? '' : value).trim();
        return text && !/(?:\\|file:\/\/|[a-z]:[\\/])/i.test(text) ? text : fallback;
    }

    function stateLabel(value) {
        return ({
            not_started: 'Belum dimulai', under_review: 'Sedang direview',
            revision_requested: 'Perlu revisi', accepted: 'Diterima'
        })[String(value || '')] || 'Belum dimulai';
    }

    function formatDateTime(value) {
        const date = new Date(value);
        return value && !Number.isNaN(date.getTime())
            ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
            : '';
    }

    function formatSize(value) {
        const size = Number(value || 0);
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
    }

    function evidenceStateLabel(item) {
        if (item.scanStatus === 'clean' && item.storageStatus === 'stored') return 'Siap Dilihat';
        if (item.scanStatus === 'rejected') return 'Ditolak';
        if (item.scanStatus === 'failed') return 'Validasi Gagal';
        return 'Menunggu Validasi';
    }

    function renderQueue(items, selectedId) {
        if (!items.length) return '<p class="review-queue-empty">Tidak ada submission untuk filter ini.</p>';
        return items.map((item) => `
            <button type="button" class="review-queue-item${String(item.submissionId) === String(selectedId) ? ' is-active' : ''}" data-review-submission="${escapeHtml(item.submissionId)}">
                <strong>${escapeHtml(safeText(item.participant && item.participant.displayName, 'BCL participant'))}</strong>
                <span>${escapeHtml(safeText(item.assignment && item.assignment.title, 'Tugas Praktik'))}</span>
                <span class="review-queue-meta"><span>Rev ${Number(item.revisionNo || 1)} · ${escapeHtml(formatDateTime(item.submittedAt))}${item.reviewer ? ` · ${escapeHtml(safeText(item.reviewer.displayName))}` : ''}</span><span class="review-state-pill is-${escapeHtml(String(item.reviewState || '').replace(/_/g, '-'))}">${escapeHtml(stateLabel(item.reviewState))}</span></span>
            </button>`).join('');
    }

    function renderEvidence(item, revisionNo) {
        const available = item.scanStatus === 'clean' && item.storageStatus === 'stored';
        return `<li class="review-evidence-item"><div><strong>${escapeHtml(safeText(item.safeDisplayName, 'Evidence'))}</strong><span>${escapeHtml(safeText(item.mimeType, 'File'))} · ${escapeHtml(formatSize(item.sizeBytes))} · ${escapeHtml(evidenceStateLabel(item))}</span></div><button type="button" data-review-download="${escapeHtml(item.evidenceId)}" data-revision="${Number(revisionNo)}" ${available ? '' : 'disabled'}>${available ? 'Buka evidence' : 'Belum tersedia'}</button></li>`;
    }

    function programStatusLabel(value) {
        return ({ not_started: 'Belum Dimulai', in_progress: 'Sedang Berjalan', requirements_met: 'Persyaratan Terpenuhi', completed: 'Selesai' })[String(value || '')] || 'Sedang Berjalan';
    }

    function renderProgramStatus(data) {
        if (!data) return '';
        const dimensions = data.dimensions || {};
        const rows = [
            ['Learning', dimensions.learning && dimensions.learning.required],
            ['Submitted', dimensions.submitted && dimensions.submitted.required],
            ['Accepted', dimensions.accepted && dimensions.accepted.required],
            ['Revision Required', { completed: data.assignments && data.assignments.revisionRequired || 0, total: data.assignments && data.assignments.required || 0 }]
        ];
        const issues = [...(Array.isArray(data.blockers) ? data.blockers : []), ...(Array.isArray(data.integrityIssues) ? data.integrityIssues : [])];
        const closeout = data.permissions && data.permissions.canCloseProgram === true
            ? `<div class="review-closeout"><label>Catatan closeout (opsional)<textarea id="review-closeout-note" maxlength="2000"></textarea></label><button type="button" class="review-action is-accept" data-program-closeout>Selesaikan Program</button></div>` : '';
        return `<section class="review-program-status" data-program-status="${escapeHtml(data.status)}">
            <header><div><p>Program progress</p><h3>${escapeHtml(programStatusLabel(data.status))}</h3></div>${data.certificateEligible ? '<strong>Eligible for certificate</strong>' : ''}</header>
            <dl>${rows.map(([label, metric]) => `<div><dt>${label}</dt><dd>${Number(metric && metric.completed || 0)} / ${Number(metric && metric.total || 0)}</dd></div>`).join('')}</dl>
            ${issues.length ? `<ul>${issues.map((item) => `<li class="${item.scope === 'system' ? 'is-system' : ''}">${escapeHtml(safeText(item.label, 'Persyaratan belum terpenuhi'))}</li>`).join('')}</ul>` : '<p>Tidak ada blocker aktif.</p>'}
            ${data.closeout ? `<p class="review-closeout-record">Closeout dicatat ${escapeHtml(formatDateTime(data.closeout.completedAt))} oleh ${escapeHtml(safeText(data.closeout.completedBy && data.closeout.completedBy.displayName, 'BCL administrator'))}.</p>` : closeout}
        </section>`;
    }

    function renderParticipantOverview(data) {
        return `<div class="review-detail-body">
            <header class="review-detail-header"><div><p>${escapeHtml(safeText(data.program && data.program.title, 'Program Internship'))}</p><h2>${escapeHtml(safeText(data.participant && data.participant.displayName, 'BCL participant'))}</h2><p>Ringkasan penyelesaian program</p></div><span>${escapeHtml(programStatusLabel(data.status))}</span></header>
            ${renderProgramStatus(data)}
        </div>`;
    }

    function renderDetail(data, programStatus = null) {
        const submission = data.submission || {};
        const review = data.review || { state: 'not_started', scores: [] };
        const permissions = data.permissions || {};
        const mutable = permissions.canMutateReview === true;
        const scores = new Map((Array.isArray(review.scores) ? review.scores : []).map((item) => [String(item.criterionId), item]));
        const evidence = Array.isArray(submission.evidence) ? submission.evidence : [];
        const rubric = Array.isArray(data.rubric) ? data.rubric : [];
        const assignment = submission.assignment || {};
        const relatedLearning = Array.isArray(assignment.relatedLearning) ? assignment.relatedLearning : [];
        return `<div class="review-detail-body" data-review-version="${Number(review.reviewVersion || 0)}" data-submission-id="${escapeHtml(submission.submissionId)}">
            <header class="review-detail-header"><div><p>${escapeHtml(safeText(submission.program && submission.program.title))}${submission.program && submission.program.code ? ` · ${escapeHtml(safeText(submission.program.code))}` : ''}</p><h2>${escapeHtml(safeText(assignment.title, 'Tugas Praktik'))}</h2><p>${escapeHtml(safeText(submission.participant && submission.participant.displayName, 'BCL participant'))} · Dikirim ${escapeHtml(formatDateTime(submission.submittedAt))} · Revisi ${Number(submission.revisionNo || 1)}</p>${review.reviewer ? `<p>Direview oleh ${escapeHtml(safeText(review.reviewer.displayName, 'BCL reviewer'))}${review.startedAt ? ` · Mulai ${escapeHtml(formatDateTime(review.startedAt))}` : ''}${review.decidedAt ? ` · Keputusan ${escapeHtml(formatDateTime(review.decidedAt))}` : ''}</p>` : ''}</div><span>${escapeHtml(stateLabel(review.state))}</span></header>
            ${renderProgramStatus(programStatus)}
            ${(assignment.brief || assignment.requiredDeliverable || relatedLearning.length) ? `<section class="review-section"><h3>Konteks Assignment</h3>${assignment.topic ? `<p><strong>${escapeHtml(safeText(assignment.topic))}</strong></p>` : ''}${assignment.brief ? `<p>${escapeHtml(safeText(assignment.brief))}</p>` : ''}${assignment.requiredDeliverable ? `<p><strong>Output:</strong> ${escapeHtml(safeText(assignment.requiredDeliverable))}</p>` : ''}${relatedLearning.length ? `<p><strong>Materi terkait:</strong> ${relatedLearning.map((item) => escapeHtml(safeText(item.title, 'Materi BCL'))).join(', ')}</p>` : ''}</section>` : ''}
            <section class="review-section"><h3>Evidence (${evidence.length})</h3>${evidence.length ? `<ul class="review-evidence-list">${evidence.map((item) => renderEvidence(item, submission.revisionNo)).join('')}</ul>` : '<p>Evidence tidak tersedia pada revisi ini.</p>'}</section>
            <section class="review-section"><h3>Rubric</h3><div class="review-rubric">${rubric.length ? rubric.map((criterion) => {
                const score = scores.get(String(criterion.criterionId)) || {};
                return `<article class="review-criterion" data-criterion-id="${escapeHtml(criterion.criterionId)}"><div><h4>${escapeHtml(safeText(criterion.title, 'Kriteria'))}${criterion.required ? ' *' : ''}</h4><p>${escapeHtml(safeText(criterion.description))}</p></div><label>Skor <input type="number" min="0" max="${Number(criterion.maxScore || 0)}" step="0.1" value="${score.score == null ? '' : Number(score.score)}" ${mutable ? '' : 'disabled'} aria-label="Skor ${escapeHtml(safeText(criterion.title, 'kriteria'))}"></label><textarea maxlength="5000" placeholder="Catatan kriteria (opsional)" ${mutable ? '' : 'disabled'}>${escapeHtml(score.comment || '')}</textarea></article>`;
            }).join('') : '<p>Rubric belum dikonfigurasi.</p>'}</div></section>
            <section class="review-section review-copy-fields"><label>Feedback untuk participant <span>Terlihat oleh participant setelah keputusan.</span><textarea id="review-participant-feedback" maxlength="5000" ${mutable ? '' : 'disabled'}>${escapeHtml(review.participantFeedback || '')}</textarea></label><label>Catatan internal <span>Hanya untuk reviewer dan admin.</span><textarea id="review-internal-note" maxlength="5000" ${mutable ? '' : 'disabled'}>${escapeHtml(review.internalNote || '')}</textarea></label></section>
            <footer class="review-actions">
                ${permissions.canStartReview ? '<button type="button" class="review-action is-primary" data-review-action="start">Mulai Review</button>' : ''}
                ${mutable ? '<button type="button" class="review-action is-primary" data-review-action="save">Simpan Review</button><button type="button" class="review-action is-revision" data-review-action="revision_requested">Minta Revisi</button><button type="button" class="review-action is-accept" data-review-action="accepted">Terima Submission</button>' : ''}
                <p class="review-message" id="review-message" role="status" aria-live="polite">${review.state === 'under_review' && !mutable ? 'Review ini sedang dikerjakan reviewer lain.' : ''}</p>
            </footer>
        </div>`;
    }

    function createReviewController(windowObject) {
        const document = windowObject.document;
        const state = { programs: [], batchId: '', queue: [], participantStatuses: [], selectedId: '', selectedParticipantId: '', detail: null, programStatus: null, filter: 'all', busy: false };
        const byId = (id) => document.getElementById(id);

        function token() {
            return windowObject.BclAuth && typeof windowObject.BclAuth.token === 'function'
                ? windowObject.BclAuth.token() : windowObject.localStorage.getItem('token') || '';
        }

        async function request(path, options = {}) {
            const accessToken = token();
            if (!accessToken) throw new ReviewApiError(401, 'AUTHENTICATION_REQUIRED');
            const headers = { Authorization: `Bearer ${accessToken}` };
            if (options.body !== undefined) headers['Content-Type'] = 'application/json';
            const response = await windowObject.fetch(path, {
                method: options.method || 'GET', headers,
                ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
                credentials: 'same-origin', cache: 'no-store'
            });
            if (options.blob) {
                if (!response.ok) throw new ReviewApiError(response.status, 'EVIDENCE_UNAVAILABLE');
                return response.blob();
            }
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new ReviewApiError(response.status, payload.code);
            return payload;
        }

        function setPageState(title, message, icon = 'fa-triangle-exclamation') {
            byId('review-workspace').hidden = true;
            const element = byId('review-page-state');
            element.hidden = false;
            element.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;
        }

        function renderProgramPicker() {
            const select = byId('review-program-select');
            byId('review-program-picker').hidden = state.programs.length <= 1;
            select.replaceChildren(...state.programs.map((program) => {
                const option = document.createElement('option');
                option.value = program.id;
                option.textContent = safeText(program.title, program.code || 'Program Internship');
                option.selected = program.id === state.batchId;
                return option;
            }));
        }

        function renderQueueList() {
            const filtered = state.filter === 'all' ? state.queue : state.queue.filter((item) => item.reviewState === state.filter);
            byId('review-queue-count').textContent = `${filtered.length} submission`;
            byId('review-queue-list').innerHTML = renderQueue(filtered, state.selectedId);
        }

        function renderParticipantStatuses() {
            const section = byId('review-participants');
            const list = byId('review-participant-list');
            if (!section || !list) return;
            section.hidden = state.participantStatuses.length === 0;
            list.innerHTML = state.participantStatuses.map((item) => `<button type="button" class="review-participant-item${String(item.participant.userId) === String(state.selectedParticipantId) ? ' is-active' : ''}" data-program-participant="${escapeHtml(item.participant.userId)}"><span>${escapeHtml(safeText(item.participant.displayName, 'BCL participant'))}</span><small>${escapeHtml(programStatusLabel(item.status))}</small></button>`).join('');
        }

        function showParticipantStatus(userId) {
            const selected = state.participantStatuses.find((item) => String(item.participant.userId) === String(userId));
            if (!selected) return;
            state.selectedId = '';
            state.selectedParticipantId = String(userId);
            state.detail = null;
            state.programStatus = selected;
            renderQueueList();
            renderParticipantStatuses();
            byId('review-detail').innerHTML = renderParticipantOverview(selected);
        }

        async function loadParticipantStatuses() {
            const selectedProgram = state.programs.find((program) => program.id === state.batchId);
            if (!selectedProgram || !selectedProgram.capabilities || selectedProgram.capabilities.completion !== true) {
                state.participantStatuses = [];
                renderParticipantStatuses();
                return;
            }
            try {
                const response = await request(`${API_BASE}/${encodeURIComponent(state.batchId)}/participant-statuses`);
                state.participantStatuses = Array.isArray(response.data && response.data.participants)
                    ? response.data.participants : [];
            } catch (_) { state.participantStatuses = []; }
            renderParticipantStatuses();
        }

        function setMessage(message, kind = '') {
            const element = byId('review-message');
            if (!element) return;
            element.textContent = message;
            element.className = `review-message${kind ? ` is-${kind}` : ''}`;
        }

        async function loadDetail(submissionId) {
            if (!submissionId) return;
            state.selectedId = String(submissionId);
            state.selectedParticipantId = '';
            renderQueueList();
            renderParticipantStatuses();
            byId('review-detail').innerHTML = '<div class="review-detail-empty"><i class="fas fa-circle-notch fa-spin"></i><h2>Memuat submission</h2></div>';
            try {
                const response = await request(`${API_BASE}/${encodeURIComponent(state.batchId)}/submissions/${encodeURIComponent(submissionId)}/review`);
                state.detail = response.data;
                state.programStatus = null;
                const selectedProgram = state.programs.find((program) => program.id === state.batchId);
                if (selectedProgram && selectedProgram.capabilities && selectedProgram.capabilities.completion === true) {
                    const participantId = state.detail && state.detail.submission && state.detail.submission.participant
                        && state.detail.submission.participant.userId;
                    if (participantId) {
                        try {
                            const statusResponse = await request(`${API_BASE}/${encodeURIComponent(state.batchId)}/participants/${encodeURIComponent(participantId)}/program-status`);
                            state.programStatus = statusResponse.data || null;
                        } catch (_) { state.programStatus = null; }
                    }
                }
                byId('review-detail').innerHTML = renderDetail(state.detail, state.programStatus);
            } catch (error) {
                byId('review-detail').innerHTML = '<div class="review-detail-empty"><i class="fas fa-triangle-exclamation"></i><h2>Detail tidak tersedia</h2><p>Muat ulang antrean lalu coba kembali.</p></div>';
            }
        }

        async function loadQueue(preferredId = '') {
            const [response] = await Promise.all([
                request(`${API_BASE}/${encodeURIComponent(state.batchId)}/review-queue`),
                loadParticipantStatuses()
            ]);
            state.queue = Array.isArray(response.data && response.data.data) ? response.data.data : [];
            renderQueueList();
            const selected = preferredId && state.queue.some((item) => String(item.submissionId) === String(preferredId))
                ? preferredId : state.queue[0] && state.queue[0].submissionId;
            if (selected) await loadDetail(selected);
            else {
                state.selectedId = '';
                if (state.participantStatuses[0]) showParticipantStatus(state.participantStatuses[0].participant.userId);
                else byId('review-detail').innerHTML = '<div class="review-detail-empty"><i class="fas fa-check-circle"></i><h2>Antrean kosong</h2><p>Belum ada submission yang perlu ditinjau.</p></div>';
            }
        }

        function scorePayload() {
            return [...byId('review-detail').querySelectorAll('[data-criterion-id]')].flatMap((row) => {
                const input = row.querySelector('input');
                if (!input || input.value === '') return [];
                return [{ criterionId: row.dataset.criterionId, score: Number(input.value), comment: row.querySelector('textarea').value }];
            });
        }

        async function mutate(action) {
            if (state.busy || !state.detail) return;
            const submissionId = state.detail.submission.submissionId;
            const base = `${API_BASE}/${encodeURIComponent(state.batchId)}/submissions/${encodeURIComponent(submissionId)}/review`;
            let path = base;
            let method = 'PATCH';
            let body;
            if (action === 'start') { path += '/start'; method = 'POST'; }
            else if (action === 'save') {
                body = { reviewVersion: state.detail.review.reviewVersion, scores: scorePayload(), participantFeedback: byId('review-participant-feedback').value, internalNote: byId('review-internal-note').value };
            } else {
                if (!windowObject.confirm(action === 'accepted' ? 'Terima submission ini sebagai keputusan final untuk revisi aktif?' : 'Minta participant membuat revisi baru?')) return;
                path += '/decision'; method = 'POST';
                body = { reviewVersion: state.detail.review.reviewVersion, decision: action };
            }
            state.busy = true;
            document.querySelectorAll('[data-review-action]').forEach((button) => { button.disabled = true; });
            setMessage(action === 'start' ? 'Mengambil review…' : 'Menyimpan…');
            try {
                await request(path, { method, ...(body ? { body } : {}) });
                await loadQueue(submissionId);
                setMessage(action === 'save' ? 'Review tersimpan.' : action === 'start' ? 'Review dimulai.' : 'Keputusan tersimpan.', 'success');
            } catch (error) {
                if (error.code === 'REVIEW_VERSION_CONFLICT' || error.code === 'REVIEW_ALREADY_CLAIMED') {
                    await loadDetail(submissionId);
                    setMessage('Data berubah di sesi lain. Detail terbaru sudah dimuat.', 'error');
                } else setMessage('Perubahan belum dapat disimpan. Periksa rubric dan coba kembali.', 'error');
            } finally { state.busy = false; }
        }

        async function downloadEvidence(button) {
            if (!state.detail || button.disabled) return;
            const submission = state.detail.submission;
            const evidence = submission.evidence.find((item) => String(item.evidenceId) === button.dataset.reviewDownload);
            if (!evidence) return;
            button.disabled = true;
            try {
                const path = `${API_BASE}/${encodeURIComponent(state.batchId)}/submissions/${encodeURIComponent(submission.submissionId)}/evidence/${encodeURIComponent(evidence.evidenceId)}/content?revision=${Number(button.dataset.revision || submission.revisionNo)}`;
                const blob = await request(path, { blob: true });
                const url = windowObject.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = safeText(evidence.safeDisplayName, 'evidence');
                document.body.appendChild(link); link.click(); link.remove();
                windowObject.setTimeout(() => windowObject.URL.revokeObjectURL(url), 1000);
            } catch (_) { setMessage('Evidence belum dapat dibuka.', 'error'); }
            finally { button.disabled = false; }
        }

        async function completeProgram() {
            if (state.busy || !state.programStatus
                || !state.programStatus.permissions || state.programStatus.permissions.canCloseProgram !== true) return;
            if (!windowObject.confirm('Selesaikan program magang untuk peserta ini?\n\nSeluruh persyaratan program telah terpenuhi.\n\nTindakan ini akan mencatat penyelesaian program secara resmi. Sertifikat tidak diterbitkan otomatis.')) return;
            const participantId = state.programStatus.participant.userId;
            const note = byId('review-closeout-note');
            state.busy = true;
            document.querySelectorAll('[data-program-closeout]').forEach((button) => { button.disabled = true; });
            try {
                await request(`${API_BASE}/${encodeURIComponent(state.batchId)}/participants/${encodeURIComponent(participantId)}/complete`, {
                    method: 'POST', body: { closeoutNote: note ? note.value : '' }
                });
                if (state.detail && state.selectedId) await loadDetail(state.selectedId);
                else {
                    const response = await request(`${API_BASE}/${encodeURIComponent(state.batchId)}/participants/${encodeURIComponent(participantId)}/program-status`);
                    state.programStatus = response.data;
                    state.participantStatuses = state.participantStatuses.map((item) => String(item.participant.userId) === String(participantId) ? response.data : item);
                    showParticipantStatus(participantId);
                }
                setMessage('Program closeout berhasil dicatat.', 'success');
            } catch (_) {
                setMessage('Program belum dapat diselesaikan. Muat ulang status dan coba kembali.', 'error');
            } finally { state.busy = false; }
        }

        async function switchProgram(batchId) {
            state.batchId = batchId; state.queue = []; state.participantStatuses = []; state.selectedId = ''; state.selectedParticipantId = ''; state.detail = null; state.programStatus = null;
            renderProgramPicker();
            try { await loadQueue(); }
            catch (_) { setPageState('Antrean tidak tersedia', 'Pastikan akun memiliki akses mentor atau reviewer pada program ini.'); }
        }

        async function init() {
            byId('review-program-select').addEventListener('change', (event) => switchProgram(event.target.value));
            byId('review-status-filter').addEventListener('change', (event) => { state.filter = event.target.value; renderQueueList(); });
            byId('review-refresh').addEventListener('click', () => loadQueue(state.selectedId));
            byId('review-queue-list').addEventListener('click', (event) => {
                const button = event.target.closest('[data-review-submission]');
                if (button) loadDetail(button.dataset.reviewSubmission);
            });
            byId('review-participant-list').addEventListener('click', (event) => {
                const button = event.target.closest('[data-program-participant]');
                if (button) showParticipantStatus(button.dataset.programParticipant);
            });
            byId('review-detail').addEventListener('click', (event) => {
                const action = event.target.closest('[data-review-action]');
                const download = event.target.closest('[data-review-download]');
                const closeout = event.target.closest('[data-program-closeout]');
                if (closeout) completeProgram();
                else if (action) mutate(action.dataset.reviewAction);
                else if (download) downloadEvidence(download);
            });
            try {
                const response = await request(`${API_BASE}/me`);
                state.programs = (Array.isArray(response.data) ? response.data : [])
                    .filter((program) => REVIEW_ROLES.has(program.participantRole)
                        && program.capabilities && program.capabilities.review === true);
                if (!state.programs.length) return setPageState('Akses review tidak tersedia', 'Akun ini tidak memiliki lingkup mentor, reviewer, atau admin.', 'fa-shield-halved');
                state.batchId = state.programs[0].id;
                renderProgramPicker();
                byId('review-page-state').hidden = true;
                byId('review-workspace').hidden = false;
                await loadQueue();
            } catch (error) {
                setPageState(error.status === 401 ? 'Login diperlukan' : 'Review belum dapat dimuat', error.status === 401 ? 'Silakan login ke BCL terlebih dahulu.' : 'Periksa koneksi lalu coba kembali.');
            }
        }

        return { init, state };
    }

    return { createReviewController, escapeHtml, evidenceStateLabel, renderDetail, renderParticipantOverview, renderProgramStatus, renderQueue, safeText, stateLabel };
});
