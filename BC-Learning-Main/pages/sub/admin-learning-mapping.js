(function initLearningMappingQueue(global) {
    'use strict';

    const state = {
        initialized: false,
        loading: false,
        options: null,
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
        selected: null,
        events: [],
        searchTimer: null
    };

    const labels = {
        required: 'Required',
        elective: 'Elective',
        library_only: 'Library only',
        alternate: 'Alternate',
        needs_review: 'Needs review',
        retired: 'Retired',
        candidate: 'Candidate',
        approved: 'Approved',
        rejected: 'Rejected',
        video: 'Video',
        pdf: 'PDF',
        page: 'Page'
    };

    function el(id) { return document.getElementById(id); }
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    function label(value) { return labels[value] || String(value || '').replace(/_/g, ' '); }
    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    }

    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {})
            }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
            const error = new Error(payload.error || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
        }
        return payload;
    }

    function setSelectOptions(select, values, placeholder, valueKey = null, titleKey = null) {
        if (!select) return;
        const current = select.value;
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values.map((item) => {
            const value = valueKey ? item[valueKey] : item;
            const title = titleKey ? item[titleKey] : label(item);
            return `<option value="${escapeHtml(value)}">${escapeHtml(title)}</option>`;
        }).join('');
        if ([...select.options].some((option) => option.value === current)) select.value = current;
    }

    function bindControls() {
        el('lmq-refresh')?.addEventListener('click', () => refresh(true));
        el('lmq-prev')?.addEventListener('click', () => {
            state.offset = Math.max(0, state.offset - state.limit);
            loadQueue();
        });
        el('lmq-next')?.addEventListener('click', () => {
            if (state.offset + state.limit < state.total) {
                state.offset += state.limit;
                loadQueue();
            }
        });
        ['lmq-status-filter', 'lmq-decision-filter', 'lmq-type-filter', 'lmq-path-filter'].forEach((id) => {
            el(id)?.addEventListener('change', () => {
                state.offset = 0;
                loadQueue();
            });
        });
        el('lmq-search')?.addEventListener('input', () => {
            clearTimeout(state.searchTimer);
            state.searchTimer = setTimeout(() => {
                state.offset = 0;
                loadQueue();
            }, 260);
        });
    }

    async function loadOptions() {
        const payload = await request('/api/admin/learning-mapping/options');
        state.options = payload.data;
        setSelectOptions(el('lmq-status-filter'), state.options.reviewStatuses, 'Semua status');
        setSelectOptions(el('lmq-decision-filter'), state.options.decisions, 'Semua keputusan');
        setSelectOptions(el('lmq-type-filter'), state.options.sourceTypes, 'Semua tipe');
        setSelectOptions(el('lmq-path-filter'), state.options.paths, 'Semua jalur', 'id', 'title');
    }

    async function loadSummary() {
        const payload = await request('/api/admin/learning-mapping/summary');
        const summary = payload.data;
        el('lmq-metric-total').textContent = summary.total;
        el('lmq-metric-pending').textContent = summary.pending;
        el('lmq-metric-unresolved').textContent = summary.unresolved;
        el('lmq-metric-approved').textContent = summary.approved;
    }

    function queueQuery() {
        const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
        const filters = {
            query: el('lmq-search')?.value.trim(),
            reviewStatus: el('lmq-status-filter')?.value,
            decision: el('lmq-decision-filter')?.value,
            sourceType: el('lmq-type-filter')?.value,
            pathId: el('lmq-path-filter')?.value
        };
        Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
        return params.toString();
    }

    function renderQueue() {
        const list = el('lmq-list');
        if (!list) return;
        if (!state.items.length) {
            list.innerHTML = '<div class="lmq-loading"><i class="fas fa-filter"></i><p>Tidak ada materi untuk filter ini.</p></div>';
        } else {
            list.innerHTML = state.items.map((item, index) => `
                <button class="lmq-row ${state.selected?.contentId === item.contentId ? 'is-active' : ''}"
                    type="button" role="option" aria-selected="${state.selected?.contentId === item.contentId}"
                    data-content-id="${escapeHtml(item.contentId)}">
                    <span class="lmq-row-index">${state.offset + index + 1}</span>
                    <span class="lmq-row-main">
                        <span class="lmq-row-title">${escapeHtml(item.title)}</span>
                        <span class="lmq-row-meta">
                            <span>${escapeHtml(label(item.sourceType))}</span>
                            <span>${escapeHtml(label(item.decision))}</span>
                            <span>${escapeHtml(item.category || 'Tanpa kategori')}</span>
                        </span>
                    </span>
                    <span class="lmq-row-state"><span class="lmq-status lmq-status-${escapeHtml(item.reviewStatus)}">${escapeHtml(label(item.reviewStatus))}</span></span>
                </button>
            `).join('');
            list.querySelectorAll('.lmq-row').forEach((row) => {
                row.addEventListener('click', () => selectItem(row.dataset.contentId));
            });
        }

        el('lmq-result-count').textContent = `${state.total} materi`;
        el('lmq-prev').disabled = state.offset === 0;
        el('lmq-next').disabled = state.offset + state.items.length >= state.total;
    }

    async function loadQueue() {
        if (state.loading) return;
        state.loading = true;
        const list = el('lmq-list');
        if (list) list.innerHTML = '<div class="lmq-loading"><i class="fas fa-circle-notch fa-spin"></i><p>Memuat mapping queue…</p></div>';
        try {
            const payload = await request(`/api/admin/learning-mapping/queue?${queueQuery()}`);
            state.items = payload.data || [];
            state.total = payload.pagination?.total || 0;
            const selectedId = state.selected?.contentId;
            state.selected = selectedId ? state.items.find((item) => item.contentId === selectedId) || null : null;
            renderQueue();
            if (state.selected) renderInspector();
        } catch (error) {
            if (list) list.innerHTML = `<div class="lmq-feedback lmq-feedback-error">${escapeHtml(error.message)}</div>`;
        } finally {
            state.loading = false;
        }
    }

    function pathOptions(selected) {
        return (state.options?.paths || []).map((item) => (
            `<option value="${escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.title)}</option>`
        )).join('');
    }

    function moduleOptions(pathId, selected) {
        const path = (state.options?.paths || []).find((item) => item.id === pathId);
        return (path?.modules || []).map((item) => (
            `<option value="${escapeHtml(item.key)}" ${item.key === selected ? 'selected' : ''}>${escapeHtml(item.title)}</option>`
        )).join('');
    }

    function decisionOptions(selected) {
        return (state.options?.decisions || []).map((value) => (
            `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`
        )).join('');
    }

    function statusOptions(selected) {
        return (state.options?.reviewStatuses || []).map((value) => (
            `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`
        )).join('');
    }

    function auditMarkup() {
        if (!state.events.length) return '<div class="lmq-audit-item">Belum ada audit event.</div>';
        return state.events.map((event) => `
            <div class="lmq-audit-item">
                <strong>${escapeHtml(label(event.action))}</strong> oleh ${escapeHtml(event.actorLabel || event.actorId)}<br>
                <span>${escapeHtml(formatDate(event.createdAt))}</span>
            </div>
        `).join('');
    }

    function renderInspector(feedback = '') {
        const item = state.selected;
        const inspector = el('lmq-inspector');
        if (!inspector || !item) return;
        const targetEnabled = ['required', 'elective', 'alternate'].includes(item.decision);
        inspector.innerHTML = `
            <div class="lmq-inspector-body">
                <header class="lmq-inspector-head">
                    <div class="lmq-inspector-tags">
                        <span class="lmq-status">${escapeHtml(label(item.sourceType))}</span>
                        <span class="lmq-status lmq-status-${escapeHtml(item.reviewStatus)}">${escapeHtml(label(item.reviewStatus))}</span>
                        <span class="lmq-status">rev ${escapeHtml(item.revision)}</span>
                    </div>
                    <h3>${escapeHtml(item.title)}</h3>
                    <div class="lmq-content-id">${escapeHtml(item.contentId)}</div>
                </header>
                <div class="lmq-preview">
                    <button class="lmq-button lmq-button-secondary" id="lmq-load-preview" type="button">
                        <i class="fas fa-play"></i> Muat preview
                    </button>
                    <span class="lmq-helper ms-2">Source dibuka tanpa mengubah file.</span>
                    <div class="lmq-preview-frame" id="lmq-preview-frame"></div>
                </div>
                <form class="lmq-form" id="lmq-review-form">
                    ${feedback ? `<div class="lmq-feedback lmq-feedback-success">${escapeHtml(feedback)}</div>` : ''}
                    <div class="lmq-form-grid">
                        <div class="lmq-field">
                            <label for="lmq-decision">Keputusan materi</label>
                            <select id="lmq-decision">${decisionOptions(item.decision)}</select>
                        </div>
                        <div class="lmq-field">
                            <label for="lmq-review-status">Status review</label>
                            <select id="lmq-review-status">${statusOptions(item.reviewStatus)}</select>
                        </div>
                        <div class="lmq-field lmq-field-wide">
                            <label for="lmq-target-path">Target Jalur Belajar</label>
                            <select id="lmq-target-path" ${targetEnabled ? '' : 'disabled'}>
                                <option value="">Pilih jalur</option>${pathOptions(item.targetPathId)}
                            </select>
                        </div>
                        <div class="lmq-field">
                            <label for="lmq-target-module">Target module</label>
                            <select id="lmq-target-module" ${targetEnabled ? '' : 'disabled'}>
                                <option value="">Pilih module</option>${moduleOptions(item.targetPathId, item.targetModuleKey)}
                            </select>
                        </div>
                        <div class="lmq-field">
                            <label for="lmq-sequence">Urutan kandidat</label>
                            <input id="lmq-sequence" type="number" min="0" value="${escapeHtml(item.proposedSequence ?? '')}" ${targetEnabled ? '' : 'disabled'}>
                        </div>
                        <div class="lmq-field lmq-field-wide">
                            <label for="lmq-title-override">Judul tampilan</label>
                            <input id="lmq-title-override" maxlength="300" value="${escapeHtml(item.titleOverride)}" placeholder="Kosongkan untuk memakai judul source">
                        </div>
                        <div class="lmq-field">
                            <label for="lmq-category-override">Kategori</label>
                            <input id="lmq-category-override" maxlength="120" value="${escapeHtml(item.categoryOverride)}" placeholder="${escapeHtml(item.category || 'Kategori')}">
                        </div>
                        <div class="lmq-field">
                            <label for="lmq-level-override">BIM level</label>
                            <input id="lmq-level-override" maxlength="120" value="${escapeHtml(item.levelOverride)}" placeholder="${escapeHtml(item.level || 'Belum ditentukan')}">
                        </div>
                        <div class="lmq-field lmq-field-wide">
                            <label for="lmq-review-notes">Catatan review</label>
                            <textarea id="lmq-review-notes" maxlength="4000" placeholder="Tuliskan isi yang diverifikasi dan alasan keputusan.">${escapeHtml(item.reviewNotes)}</textarea>
                            <p class="lmq-helper">Approval/rejection wajib memiliki catatan. Needs-review tidak dapat di-approve.</p>
                        </div>
                    </div>
                    <div class="lmq-actions">
                        <button class="lmq-button lmq-button-danger" id="lmq-reject" type="button">Reject</button>
                        <button class="lmq-button lmq-button-secondary" id="lmq-save" type="submit">Simpan draft</button>
                        <button class="lmq-button lmq-button-primary" id="lmq-approve" type="button" ${item.decision === 'needs_review' ? 'disabled' : ''}>Approve review</button>
                    </div>
                    <details class="lmq-audit" id="lmq-audit">
                        <summary>Audit trail (${state.events.length})</summary>
                        <div class="lmq-audit-list">${auditMarkup()}</div>
                    </details>
                </form>
            </div>
        `;

        el('lmq-decision')?.addEventListener('change', syncTargetControls);
        el('lmq-target-path')?.addEventListener('change', syncModuleOptions);
        el('lmq-load-preview')?.addEventListener('click', renderPreview);
        el('lmq-review-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            saveItem(el('lmq-review-status').value);
        });
        el('lmq-approve')?.addEventListener('click', () => {
            if (global.confirm('Approve keputusan review ini? Mapping tetap draft dan belum dipublish.')) saveItem('approved');
        });
        el('lmq-reject')?.addEventListener('click', () => {
            if (global.confirm('Reject kandidat mapping ini?')) saveItem('rejected');
        });
    }

    function syncTargetControls() {
        const decision = el('lmq-decision')?.value;
        const enabled = ['required', 'elective', 'alternate'].includes(decision);
        ['lmq-target-path', 'lmq-target-module', 'lmq-sequence'].forEach((id) => { if (el(id)) el(id).disabled = !enabled; });
        if (!enabled) {
            el('lmq-target-path').value = '';
            el('lmq-target-module').innerHTML = '<option value="">Pilih module</option>';
            el('lmq-sequence').value = '';
        }
        if (decision === 'needs_review') el('lmq-review-status').value = 'needs_review';
        if (decision === 'retired') el('lmq-review-status').value = 'retired';
        if (el('lmq-approve')) el('lmq-approve').disabled = decision === 'needs_review';
    }

    function syncModuleOptions() {
        const pathId = el('lmq-target-path')?.value || '';
        const select = el('lmq-target-module');
        if (select) select.innerHTML = `<option value="">Pilih module</option>${moduleOptions(pathId, '')}`;
    }

    function renderPreview() {
        const item = state.selected;
        const frame = el('lmq-preview-frame');
        if (!item || !frame) return;
        if (!item.sourceUrl || !item.sourceUrl.startsWith('/')) {
            frame.innerHTML = '<div class="lmq-feedback lmq-feedback-error">Source preview tidak tersedia.</div>';
        } else if (item.sourceType === 'video') {
            frame.innerHTML = `<video controls preload="metadata" src="${escapeHtml(item.sourceUrl)}"></video>`;
        } else {
            frame.innerHTML = `<iframe loading="lazy" src="${escapeHtml(item.sourceUrl)}" title="Preview ${escapeHtml(item.title)}"></iframe>`;
        }
        frame.classList.add('is-open');
        el('lmq-load-preview').disabled = true;
    }

    async function loadEvents(contentId) {
        try {
            const payload = await request(`/api/admin/learning-mapping/queue/${encodeURIComponent(contentId)}/events`);
            state.events = payload.data || [];
        } catch (error) {
            state.events = [];
        }
    }

    async function selectItem(contentId) {
        state.selected = state.items.find((item) => item.contentId === contentId) || null;
        state.events = [];
        renderQueue();
        renderInspector();
        if (state.selected) {
            await loadEvents(state.selected.contentId);
            renderInspector();
        }
    }

    function readForm(reviewStatus) {
        return {
            revision: state.selected.revision,
            decision: el('lmq-decision').value,
            reviewStatus,
            targetPathId: el('lmq-target-path').value,
            targetModuleKey: el('lmq-target-module').value,
            proposedSequence: el('lmq-sequence').value,
            titleOverride: el('lmq-title-override').value,
            categoryOverride: el('lmq-category-override').value,
            levelOverride: el('lmq-level-override').value,
            reviewNotes: el('lmq-review-notes').value
        };
    }

    async function saveItem(reviewStatus) {
        if (!state.selected) return;
        const buttons = el('lmq-review-form')?.querySelectorAll('button');
        buttons?.forEach((button) => { button.disabled = true; });
        try {
            const payload = await request(`/api/admin/learning-mapping/queue/${encodeURIComponent(state.selected.contentId)}`, {
                method: 'PUT',
                body: JSON.stringify(readForm(reviewStatus))
            });
            state.selected = payload.data;
            const index = state.items.findIndex((item) => item.contentId === state.selected.contentId);
            if (index >= 0) state.items[index] = state.selected;
            await Promise.all([loadSummary(), loadEvents(state.selected.contentId)]);
            renderQueue();
            renderInspector('Review tersimpan. Belum ada perubahan pada Jalur Belajar yang dipublish.');
        } catch (error) {
            renderInspector();
            const form = el('lmq-review-form');
            if (form) form.insertAdjacentHTML('afterbegin', `<div class="lmq-feedback lmq-feedback-error">${escapeHtml(error.message)}</div>`);
        }
    }

    async function refresh(resetOffset = false) {
        if (resetOffset) state.offset = 0;
        try {
            await Promise.all([loadSummary(), loadQueue()]);
        } catch (error) {
            const list = el('lmq-list');
            if (list) list.innerHTML = `<div class="lmq-feedback lmq-feedback-error">${escapeHtml(error.message)}</div>`;
        }
    }

    async function open() {
        if (!state.initialized) {
            state.initialized = true;
            bindControls();
            try {
                await loadOptions();
            } catch (error) {
                const list = el('lmq-list');
                if (list) list.innerHTML = `<div class="lmq-feedback lmq-feedback-error">${escapeHtml(error.message)}</div>`;
                return;
            }
        }
        await refresh(false);
    }

    global.learningMappingQueue = { open, refresh };
})(window);
