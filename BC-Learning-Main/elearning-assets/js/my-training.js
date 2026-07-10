const myTrainingState = {
    batches: [],
    selectedBatchId: '',
    trainingPlans: {},
    submissions: {}
};

document.addEventListener('DOMContentLoaded', () => {
    loadMyTrainingBatches();

    document.addEventListener('click', (event) => {
        const planButton = event.target.closest('[data-training-plan-batch-id]');
        if (planButton) {
            loadTrainingPlan(planButton.dataset.trainingPlanBatchId);
            return;
        }

        if (event.target.closest('[data-close-training-plan]')) {
            closeTrainingPlanPanel();
            return;
        }

        const submitButton = event.target.closest('[data-submit-practice-item-id]');
        if (submitButton) {
            showPracticeSubmissionModal(submitButton.dataset.submitPracticeItemId);
            return;
        }

        if (event.target.closest('[data-close-practice-submission]')) {
            closePracticeSubmissionModal();
        }
    });

    document.addEventListener('submit', (event) => {
        if (event.target && event.target.id === 'practiceSubmissionForm') {
            handlePracticeSubmissionSubmit(event);
        }
    });
});

function getMyTrainingToken() {
    const directToken = localStorage.getItem('token');
    if (directToken) return directToken;

    try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return user?.token || '';
    } catch (error) {
        return '';
    }
}

function escapeMyTrainingHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatMyTrainingDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
}

function formatMyTrainingDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getBatchStatusLabel(status) {
    const normalized = String(status || 'draft').toLowerCase();
    const labels = {
        draft: 'Draft',
        active: 'Active',
        completed: 'Completed',
        archived: 'Archived'
    };
    return labels[normalized] || normalized;
}

function getRoleLabel(role) {
    const normalized = String(role || 'participant').toLowerCase();
    const labels = {
        participant: 'Participant',
        mentor: 'Mentor',
        reviewer: 'Reviewer',
        admin: 'Admin',
        hc_observer: 'HC Observer'
    };
    return labels[normalized] || normalized;
}

function getStatusClass(status) {
    const normalized = String(status || 'draft').toLowerCase();
    if (normalized === 'active') return 'status-active';
    if (normalized === 'completed') return 'status-completed';
    if (normalized === 'archived') return 'status-archived';
    return 'status-draft';
}

function getClassworkTypeLabel(type) {
    const normalized = String(type || 'material').toLowerCase();
    const labels = {
        material: 'Material',
        quiz: 'Quiz',
        practice_task: 'Practice',
        exam: 'Exam',
        meeting: 'Meeting',
        announcement: 'Info'
    };
    return labels[normalized] || normalized;
}

function getClassworkIcon(type) {
    const normalized = String(type || 'material').toLowerCase();
    const icons = {
        material: 'fa-book-open',
        quiz: 'fa-circle-question',
        practice_task: 'fa-screwdriver-wrench',
        exam: 'fa-file-pen',
        meeting: 'fa-video',
        announcement: 'fa-bullhorn'
    };
    return icons[normalized] || 'fa-list-check';
}

function getSelectedTrainingBatch() {
    return myTrainingState.batches.find((batch) => batch.id === myTrainingState.selectedBatchId) || null;
}

function isSelectedBatchParticipant() {
    const batch = getSelectedTrainingBatch();
    return String(batch?.myRole || '').toLowerCase() === 'participant';
}

function getSubmissionCacheKey(batchId, itemId) {
    return `${batchId || ''}:${itemId || ''}`;
}

function getSubmissionStatusLabel(status) {
    const normalized = String(status || 'assigned').toLowerCase();
    const labels = {
        assigned: 'Belum submit',
        missing: 'Terlambat belum submit',
        submitted: 'Submitted',
        late: 'Submitted terlambat',
        returned: 'Returned',
        reviewed: 'Reviewed',
        accepted: 'Accepted'
    };
    return labels[normalized] || normalized;
}

function getSubmissionStatusClass(status) {
    const normalized = String(status || 'assigned').toLowerCase();
    if (normalized === 'submitted' || normalized === 'accepted' || normalized === 'reviewed') return 'submission-status-ok';
    if (normalized === 'late' || normalized === 'missing') return 'submission-status-alert';
    if (normalized === 'returned') return 'submission-status-returned';
    return 'submission-status-muted';
}

function findTrainingPlanItem(batchId, itemId) {
    const plan = myTrainingState.trainingPlans[batchId];
    if (!plan) return null;

    const topics = Array.isArray(plan.topics) ? plan.topics : [];
    for (const topic of topics) {
        const items = Array.isArray(topic.items) ? topic.items : [];
        const match = items.find((item) => item.id === itemId);
        if (match) return match;
    }

    const looseItems = Array.isArray(plan.unassignedItems) ? plan.unassignedItems : [];
    return looseItems.find((item) => item.id === itemId) || null;
}

async function loadMyTrainingBatches() {
    const content = document.getElementById('my-training-content');
    if (!content) return;

    content.innerHTML = `
        <div class="my-training-empty">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Memuat training batch...</p>
        </div>
    `;

    const token = getMyTrainingToken();
    if (!token) {
        content.innerHTML = `
            <div class="my-training-empty">
                <i class="fas fa-lock"></i>
                <h3>Login diperlukan</h3>
                <p>Silakan login untuk melihat training batch yang Anda ikuti.</p>
                <a href="/pages/login.html" class="training-action">Login</a>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch('/api/training/my-batches', {
            headers: {
                Authorization: `Bearer ${token}`
            },
            credentials: 'include'
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        myTrainingState.batches = Array.isArray(result.data) ? result.data : [];
        if (!myTrainingState.batches.some((batch) => batch.id === myTrainingState.selectedBatchId)) {
            closeTrainingPlanPanel();
        }
        renderMyTrainingBatches();
    } catch (error) {
        content.innerHTML = `
            <div class="my-training-empty error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Gagal memuat training</h3>
                <p>${escapeMyTrainingHtml(error.message)}</p>
                <button class="training-action" onclick="loadMyTrainingBatches()">Coba Lagi</button>
            </div>
        `;
    }
}

function renderMyTrainingBatches() {
    const content = document.getElementById('my-training-content');
    const summary = document.getElementById('my-training-summary');
    if (!content) return;

    const batches = myTrainingState.batches;
    const activeCount = batches.filter((batch) => batch.status === 'active').length;
    const completedCount = batches.filter((batch) => batch.status === 'completed').length;

    if (summary) {
        summary.innerHTML = `
            <div class="summary-tile">
                <span>${batches.length}</span>
                <small>Total Batch</small>
            </div>
            <div class="summary-tile">
                <span>${activeCount}</span>
                <small>Active</small>
            </div>
            <div class="summary-tile">
                <span>${completedCount}</span>
                <small>Completed</small>
            </div>
        `;
    }

    if (batches.length === 0) {
        content.innerHTML = `
            <div class="my-training-empty">
                <i class="fas fa-chalkboard-user"></i>
                <h3>Belum ada training batch</h3>
                <p>Training batch akan tampil di sini setelah Admin BCL menambahkan Anda ke roster.</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="my-training-grid">
            ${batches.map((batch) => `
                <article class="training-batch-card">
                    <div class="batch-card-top">
                        <div>
                            <span class="batch-code">${escapeMyTrainingHtml(batch.code || batch.id)}</span>
                            <h3>${escapeMyTrainingHtml(batch.title)}</h3>
                        </div>
                        <span class="batch-status ${getStatusClass(batch.status)}">${getBatchStatusLabel(batch.status)}</span>
                    </div>
                    <div class="batch-meta">
                        <div>
                            <i class="fas fa-route"></i>
                            <span>${escapeMyTrainingHtml(batch.learningPathId || 'Learning path belum ditentukan')}</span>
                        </div>
                        <div>
                            <i class="fas fa-calendar-alt"></i>
                            <span>${formatMyTrainingDate(batch.startDate)} - ${formatMyTrainingDate(batch.endDate)}</span>
                        </div>
                        <div>
                            <i class="fas fa-user-tag"></i>
                            <span>${getRoleLabel(batch.myRole)} - ${escapeMyTrainingHtml(batch.myEnrollmentStatus || 'active')}</span>
                        </div>
                    </div>
                    <div class="batch-roster-line">
                        <span><i class="fas fa-users"></i>${Number(batch.participantCount || 0)} peserta</span>
                        <span><i class="fas fa-user-tie"></i>${Number(batch.mentorCount || 0)} mentor</span>
                        <span><i class="fas fa-clipboard-check"></i>${Number(batch.reviewerCount || 0)} reviewer</span>
                    </div>
                    <div class="batch-card-footer">
                        <span>${Number(batch.memberCount || 0)} total roster</span>
                        <button class="training-plan-button ${myTrainingState.selectedBatchId === batch.id ? 'is-active' : ''}" type="button" data-training-plan-batch-id="${escapeMyTrainingHtml(batch.id)}">
                            <i class="fas fa-list-check"></i>
                            <span>Plan</span>
                        </button>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

async function loadTrainingPlan(batchId) {
    const panel = document.getElementById('my-training-plan-panel');
    const token = getMyTrainingToken();
    if (!panel || !batchId || !token) return;

    const batch = myTrainingState.batches.find((item) => item.id === batchId);
    myTrainingState.selectedBatchId = batchId;
    renderMyTrainingBatches();

    panel.classList.remove('is-hidden');
    panel.innerHTML = `
        <div class="training-plan-head">
            <div>
                <h2>${escapeMyTrainingHtml(batch?.title || 'Training Plan')}</h2>
                <p>Memuat susunan sesi dan aktivitas batch...</p>
            </div>
            <button class="training-plan-close" type="button" data-close-training-plan aria-label="Tutup Training Plan">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="my-training-empty">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Memuat Training Plan...</p>
        </div>
    `;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/training-plan`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            credentials: 'include'
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        myTrainingState.trainingPlans[batchId] = result;
        renderTrainingPlan(result);
    } catch (error) {
        renderTrainingPlanError(batch, error);
    }
}

function renderTrainingPlan(plan) {
    const panel = document.getElementById('my-training-plan-panel');
    if (!panel) return;

    const batch = plan.batch || myTrainingState.batches.find((item) => item.id === myTrainingState.selectedBatchId) || {};
    const topics = Array.isArray(plan.topics) ? plan.topics : [];
    const unassignedItems = Array.isArray(plan.unassignedItems) ? plan.unassignedItems : [];
    const totalItems = topics.reduce((total, topic) => total + (Array.isArray(topic.items) ? topic.items.length : 0), 0) + unassignedItems.length;

    panel.classList.remove('is-hidden');
    panel.innerHTML = `
        <div class="training-plan-head">
            <div>
                <h2>${escapeMyTrainingHtml(batch.title || 'Training Plan')}</h2>
                <p>${topics.length} sesi - ${totalItems} aktivitas</p>
            </div>
            <button class="training-plan-close" type="button" data-close-training-plan aria-label="Tutup Training Plan">
                <i class="fas fa-times"></i>
            </button>
        </div>
        ${topics.length || unassignedItems.length ? `
            <div class="training-topic-list">
                ${topics.map(renderTrainingTopic).join('')}
                ${unassignedItems.length ? renderTrainingTopic({
                    title: 'Aktivitas tanpa sesi',
                    description: '',
                    items: unassignedItems
                }) : ''}
            </div>
        ` : `
            <div class="my-training-empty">
                <i class="fas fa-list-check"></i>
                <h3>Training Plan belum tersedia</h3>
                <p>Susunan sesi akan tampil setelah Admin BCL menambahkan topic dan item batch.</p>
            </div>
        `}
    `;
}

function renderTrainingTopic(topic) {
    const items = Array.isArray(topic.items) ? topic.items : [];
    return `
        <article class="training-topic">
            <div class="training-topic-title">
                <h3>${escapeMyTrainingHtml(topic.title || 'Sesi Training')}</h3>
                ${topic.description ? `<p>${escapeMyTrainingHtml(topic.description)}</p>` : ''}
            </div>
            ${items.length ? items.map(renderTrainingPlanItem).join('') : `
                <div class="training-plan-item">
                    <div>
                        <h4>Belum ada aktivitas</h4>
                        <p>Item training akan muncul setelah dipublikasikan di batch ini.</p>
                    </div>
                </div>
            `}
        </article>
    `;
}

function renderTrainingPlanItem(item) {
    const batchId = myTrainingState.selectedBatchId;
    const cacheKey = getSubmissionCacheKey(batchId, item.id);
    const cachedSubmission = myTrainingState.submissions[cacheKey];
    const isPracticeTask = String(item.type || '').toLowerCase() === 'practice_task';
    const canSubmit = isPracticeTask && isSelectedBatchParticipant();
    const submissionStatus = cachedSubmission?.status || cachedSubmission?.data?.status || '';

    return `
        <div class="training-plan-item">
            <div>
                <h4>
                    <i class="fas ${getClassworkIcon(item.type)}"></i>
                    ${escapeMyTrainingHtml(item.title || 'Training Item')}
                </h4>
                ${item.instructions ? `<p>${escapeMyTrainingHtml(item.instructions)}</p>` : ''}
                <div class="training-item-meta">
                    <span class="training-item-pill">${getClassworkTypeLabel(item.type)}</span>
                    <span class="training-item-pill">${escapeMyTrainingHtml(item.status || 'draft')}</span>
                    ${item.dueAt ? `<span class="training-item-pill"><i class="fas fa-clock"></i>${formatMyTrainingDate(item.dueAt)}</span>` : ''}
                    ${Number(item.points || 0) > 0 ? `<span class="training-item-pill">${Number(item.points)} poin</span>` : ''}
                </div>
                ${canSubmit && submissionStatus ? `
                    <div class="practice-submission-status ${getSubmissionStatusClass(submissionStatus)}">
                        <i class="fas fa-paperclip"></i>
                        ${getSubmissionStatusLabel(submissionStatus)}
                    </div>
                ` : ''}
            </div>
            ${canSubmit ? `
                <div class="training-item-actions">
                    <button class="training-action training-action-secondary" type="button" data-submit-practice-item-id="${escapeMyTrainingHtml(item.id)}">
                        <i class="fas fa-upload"></i>
                        <span>${submissionStatus && submissionStatus !== 'assigned' && submissionStatus !== 'missing' ? 'Update' : 'Submit'}</span>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function showPracticeSubmissionModal(itemId) {
    const batchId = myTrainingState.selectedBatchId;
    const batch = getSelectedTrainingBatch();
    const item = findTrainingPlanItem(batchId, itemId);
    const token = getMyTrainingToken();

    if (!batchId || !batch || !item || !token) {
        alert('Training plan belum siap. Buka ulang batch, lalu coba submit lagi.');
        return;
    }

    closePracticeSubmissionModal();
    document.body.insertAdjacentHTML('beforeend', `
        <div class="practice-modal-backdrop" id="practiceSubmissionModal">
            <div class="practice-modal" role="dialog" aria-modal="true" aria-labelledby="practiceSubmissionTitle">
                <div class="practice-modal-header">
                    <div>
                        <h3 id="practiceSubmissionTitle">${escapeMyTrainingHtml(item.title || 'Practice Task')}</h3>
                        <p>${escapeMyTrainingHtml(batch.title || 'Training Batch')}</p>
                    </div>
                    <button class="training-plan-close" type="button" data-close-practice-submission aria-label="Tutup submission">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="practice-modal-body">
                    <div class="my-training-empty">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Memuat status submission...</p>
                    </div>
                </div>
            </div>
        </div>
    `);

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/classwork/${encodeURIComponent(itemId)}/submission`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        myTrainingState.submissions[getSubmissionCacheKey(batchId, itemId)] = result;
        renderPracticeSubmissionForm(batch, item, result);
    } catch (error) {
        const body = document.querySelector('#practiceSubmissionModal .practice-modal-body');
        if (body) {
            body.innerHTML = `
                <div class="my-training-empty error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Submission belum bisa dimuat</h3>
                    <p>${escapeMyTrainingHtml(error.message)}</p>
                </div>
            `;
        }
    }
}

function renderPracticeSubmissionForm(batch, item, submissionResult) {
    const body = document.querySelector('#practiceSubmissionModal .practice-modal-body');
    if (!body) return;

    const submission = submissionResult?.data || null;
    const status = submissionResult?.status || submission?.status || 'assigned';
    const files = Array.isArray(submission?.files) ? submission.files : [];
    const firstFile = files[0] || {};
    const note = submission?.metadata?.note || '';

    body.innerHTML = `
        <form id="practiceSubmissionForm" data-batch-id="${escapeMyTrainingHtml(batch.id)}" data-item-id="${escapeMyTrainingHtml(item.id)}">
            <div class="practice-submission-summary">
                <span class="practice-submission-status ${getSubmissionStatusClass(status)}">
                    <i class="fas fa-circle-info"></i>
                    ${getSubmissionStatusLabel(status)}
                </span>
                ${submission?.submittedAt ? `<span>Dikirim: ${formatMyTrainingDateTime(submission.submittedAt)}</span>` : '<span>Belum ada submission tersimpan.</span>'}
                ${submission?.score != null ? `<span>Score: ${Number(submission.score)}</span>` : ''}
            </div>

            ${submission?.feedbackSummary ? `
                <div class="practice-review-feedback">
                    <strong>Feedback Mentor</strong>
                    <p>${escapeMyTrainingHtml(submission.feedbackSummary)}</p>
                </div>
            ` : ''}

            ${item.instructions ? `
                <div class="practice-submission-instructions">
                    ${escapeMyTrainingHtml(item.instructions)}
                </div>
            ` : ''}

            <label class="practice-field">
                <span>Link evidence</span>
                <input type="url" id="practiceExternalUrl" placeholder="https://..." value="${escapeMyTrainingHtml(firstFile.externalUrl || '')}">
            </label>
            <label class="practice-field">
                <span>Path file internal / server</span>
                <input type="text" id="practiceFilePath" placeholder="Contoh: \\\\PC-BIM02\\BCL\\submission\\file.pdf" value="${escapeMyTrainingHtml(firstFile.filePath || '')}">
            </label>
            <label class="practice-field">
                <span>Nama evidence</span>
                <input type="text" id="practiceFileName" placeholder="Nama file atau judul evidence" value="${escapeMyTrainingHtml(firstFile.fileName || '')}">
            </label>
            <label class="practice-field">
                <span>Catatan peserta</span>
                <textarea id="practiceNote" rows="4" placeholder="Ringkas apa yang dikirim dan konteks pengerjaan.">${escapeMyTrainingHtml(note)}</textarea>
            </label>

            ${files.length ? `
                <div class="practice-existing-files">
                    <strong>Evidence tersimpan</strong>
                    ${files.map((file) => `
                        <div>
                            <i class="fas fa-paperclip"></i>
                            ${file.externalUrl ? `<a href="${escapeMyTrainingHtml(file.externalUrl)}" target="_blank" rel="noopener">${escapeMyTrainingHtml(file.fileName || file.externalUrl)}</a>` : escapeMyTrainingHtml(file.fileName || file.filePath || 'Evidence')}
                            ${file.filePath && !file.externalUrl ? `<small>${escapeMyTrainingHtml(file.filePath)}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="practice-modal-footer">
                <button type="button" class="training-action training-action-secondary" data-close-practice-submission>Batal</button>
                <button type="submit" class="training-action">
                    <i class="fas fa-save"></i>
                    <span>Simpan Submission</span>
                </button>
            </div>
        </form>
    `;
}

async function handlePracticeSubmissionSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const batchId = form.dataset.batchId;
    const itemId = form.dataset.itemId;
    const token = getMyTrainingToken();
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.innerHTML : '';

    const externalUrl = document.getElementById('practiceExternalUrl')?.value.trim() || '';
    const filePath = document.getElementById('practiceFilePath')?.value.trim() || '';
    const fileName = document.getElementById('practiceFileName')?.value.trim() || '';
    const note = document.getElementById('practiceNote')?.value.trim() || '';

    if (!externalUrl && !filePath) {
        alert('Isi minimal Link evidence atau Path file internal/server.');
        return;
    }

    const payload = {
        note,
        files: [{
            externalUrl,
            filePath,
            fileName
        }]
    };

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Menyimpan...</span>';
        }

        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/classwork/${encodeURIComponent(itemId)}/submission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        myTrainingState.submissions[getSubmissionCacheKey(batchId, itemId)] = {
            success: true,
            status: result.data?.status || 'submitted',
            data: result.data
        };
        closePracticeSubmissionModal();
        const plan = myTrainingState.trainingPlans[batchId];
        if (plan) renderTrainingPlan(plan);
        alert('Submission practice task berhasil disimpan.');
    } catch (error) {
        alert('Gagal menyimpan submission: ' + error.message);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    }
}

function closePracticeSubmissionModal() {
    const modal = document.getElementById('practiceSubmissionModal');
    if (modal) modal.remove();
}

function renderTrainingPlanError(batch, error) {
    const panel = document.getElementById('my-training-plan-panel');
    if (!panel) return;

    panel.classList.remove('is-hidden');
    panel.innerHTML = `
        <div class="training-plan-head">
            <div>
                <h2>${escapeMyTrainingHtml(batch?.title || 'Training Plan')}</h2>
                <p>Training Plan belum bisa dimuat.</p>
            </div>
            <button class="training-plan-close" type="button" data-close-training-plan aria-label="Tutup Training Plan">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="my-training-empty error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Gagal memuat Training Plan</h3>
            <p>${escapeMyTrainingHtml(error.message)}</p>
        </div>
    `;
}

function closeTrainingPlanPanel() {
    const panel = document.getElementById('my-training-plan-panel');
    myTrainingState.selectedBatchId = '';
    if (panel) {
        panel.classList.add('is-hidden');
        panel.innerHTML = '';
    }
    const content = document.getElementById('my-training-content');
    if (content && myTrainingState.batches.length) {
        renderMyTrainingBatches();
    }
}
