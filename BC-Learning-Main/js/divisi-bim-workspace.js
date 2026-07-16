(() => {
    'use strict';

    const state = {
        period: new Date().toISOString().slice(0, 7),
        view: 'dashboard',
        ganttStart: '',
        ganttPeriod: '',
        ganttMode: '2w',
        taskViewMode: 'task',
        taskMineOnly: false,
        taskLoad: null,
        access: null,
        users: [],
        projectContexts: [],
        dashboard: null,
        tasks: [],
        worklogs: [],
        worklogEvents: [],
        worklogSources: [],
        worklogSummary: {},
        worklogSourcesPeriod: '',
        meetings: [],
        legacyMeetings: [],
        issues: [],
        kpiTab: 'overview',
        kpi: null,
        kpiYear: '',
        report: null,
        updateVersions: {},
        latestVersions: {},
        pendingUpdates: new Set(),
        updatePollTimer: null,
        updateSyncTimer: null,
        lastUpdateCheck: ''
    };

    const viewMeta = {
        dashboard: ['Dashboard', 'Ringkasan operasional'],
        tasks: ['Task Scheduler', 'Perencanaan dan register task bulanan'],
        worklogs: ['Worklog', 'Activity feed dan konfirmasi pekerjaan harian'],
        meetings: ['Risalah Rapat', 'Dokumentasi rapat dan tindak lanjut'],
        issues: ['Issues', 'Dokumentasi dan monitoring issue internal'],
        kpi: ['KPI', 'Scorecard dan monitoring kinerja'],
        reports: ['Reports', 'Ringkasan manajemen dan laporan operasional'],
        guide: ['Panduan', 'Petunjuk penggunaan workspace'],
        settings: ['Pengaturan', 'Konfigurasi operasional workspace']
    };

    const statusLabels = {
        planned: 'Planned', in_progress: 'In Progress', on_hold: 'On Hold', blocked: 'Blocked', submitted_for_review: 'Review',
        approved_done: 'Done', rejected_revision: 'Revision', cancelled: 'Cancelled', draft: 'Draft',
        pending_approval: 'Pending Approval', approved: 'Approved', revision_required: 'Revision Required',
        rejected: 'Rejected', replaced: 'Replaced', submitted: 'Submitted', accepted: 'Accepted', action_required: 'Action Required',
        resolved_pending_approval: 'Pending Closure', closed: 'Closed', issued: 'Issued', open: 'Open',
        target_required: 'Target Required', empty: 'Unassigned', partial: 'Partial', covered: 'Covered',
        overallocated: 'Overallocated', active: 'Active', not_started: 'Not Started', verification: 'Verification',
        at_risk: 'At Risk', achieved: 'Achieved', verification_pending: 'Pending Verification',
        auto_draft: 'Perlu Konfirmasi', confirmed: 'Confirmed', planning: 'Planning', execution: 'Execution',
        manual: 'Manual', source_confirmed: 'Source', auto_confirmed: 'Auto + Confirmed',
        legacy_archive: 'Legacy Archive'
    };

    const registerLabels = {
        draft: 'UNREGISTERED',
        pending_approval: 'PENDING',
        approved: 'REGISTERED',
        revision_required: 'REVISION',
        rejected: 'REJECTED',
        replaced: 'REPLACED'
    };

    const taskCategoryLabels = {
        regular: 'Regular',
        routine: 'Rutin',
        flexible: 'Fleksibel',
        urgent: 'Urgent'
    };

    const picColorPalette = [
        { border: '#087f8c', bg: '#dff3f5', fill: 'rgba(8,127,140,.24)', stripe: '#c6e7eb', text: '#075f68' },
        { border: '#7a5af8', bg: '#ebe7ff', fill: 'rgba(122,90,248,.22)', stripe: '#d9d1ff', text: '#4b2fb7' },
        { border: '#16835f', bg: '#dff3ea', fill: 'rgba(22,131,95,.22)', stripe: '#c7e8d8', text: '#116346' },
        { border: '#c11574', bg: '#fce7f3', fill: 'rgba(193,21,116,.18)', stripe: '#f9cfe5', text: '#851651' },
        { border: '#b54708', bg: '#fff0d5', fill: 'rgba(181,71,8,.18)', stripe: '#f8ddb1', text: '#8a4b08' },
        { border: '#175cd3', bg: '#dbeafe', fill: 'rgba(23,92,211,.2)', stripe: '#bfdbfe', text: '#1849a9' },
        { border: '#9f1ab1', bg: '#f4e5f7', fill: 'rgba(159,26,177,.18)', stripe: '#eac7f0', text: '#6f1877' },
        { border: '#667085', bg: '#eaecf0', fill: 'rgba(102,112,133,.2)', stripe: '#d0d5dd', text: '#344054' },
        { border: '#be123c', bg: '#ffe4e8', fill: 'rgba(190,18,60,.17)', stripe: '#fecdd6', text: '#9f1239' },
        { border: '#0f766e', bg: '#ccfbf1', fill: 'rgba(15,118,110,.2)', stripe: '#99f6e4', text: '#115e59' }
    ];

    const guideDetails = {
        dashboard: {
            title: 'Dashboard',
            subtitle: 'Membaca kondisi operasional divisi pada periode aktif.',
            steps: ['Pilih bulan pada toolbar untuk mengganti periode data.', 'Gunakan ringkasan metrik untuk melihat beban task, status penyelesaian, issue, dan action rapat.', 'Baca chart sebagai indikator cepat: mana pekerjaan aktif, tertunda, atau perlu perhatian Kadiv.'],
            note: 'Dashboard bersifat monitoring. Input data tetap dilakukan dari menu sumbernya seperti Task, Worklog, Issues, Risalah, atau KPI.'
        },
        tasks: {
            title: 'Task Scheduler',
            subtitle: 'Mencatat task bulanan, task pendek, task rutin, dan delegasi staff.',
            steps: ['Klik Task Baru, isi nama task, project/context, PIC, start date, due date, prioritas, kategori beban, dan deskripsi.', 'Gunakan Regular untuk task normal, Rutin untuk pekerjaan berulang, Fleksibel untuk pekerjaan yang dapat dikerjakan saat kapasitas tersedia, dan Urgent untuk task sisipan prioritas tinggi.', 'Centang Critical hanya jika task berdampak besar: blocking deliverable, deadline management/project, berpengaruh ke tender/KPI, atau berisiko tinggi bila terlambat.', 'Jika staff membuat task, task masuk sebagai usulan register dan perlu review Kadiv.', 'Kadiv dapat membuat atau mendelegasikan task langsung ke staff, lalu memantau progress dari table dan Gantt.'],
            note: 'Urgent berarti perlu segera dikerjakan; Critical berarti dampaknya besar bila gagal atau terlambat. Task bisa urgent saja, critical saja, atau keduanya. Gunakan project/context yang sama untuk pekerjaan dalam project yang sama agar grouping dan report tetap rapi.'
        },
        worklogs: {
            title: 'Worklog',
            subtitle: 'Mengonfirmasi aktivitas harian dari task, KPI, issue, atau action rapat.',
            steps: ['Pilih sumber aktivitas yang tersedia, atau gunakan manual hanya jika aktivitas belum punya sumber.', 'Isi ringkasan pekerjaan, output, blocker, next action, progress, dan evidence link jika ada.', 'Konfirmasi worklog agar masuk report. Jam kerja hanya terlihat untuk PIC terkait.'],
            note: 'Worklog sebaiknya menjadi rekaman dari aktivitas termonitor, bukan tempat membuat pekerjaan acak.'
        },
        meetings: {
            title: 'Risalah Rapat',
            subtitle: 'Membuat dokumen resmi rapat dan menghubungkannya ke task/worklog.',
            steps: ['Klik Risalah Baru, isi header rapat: perihal, kategori, project/context, tanggal, tempat, pelapor, dan mengetahui.', 'Lengkapi peserta dan isi risalah seperti pembahasan, permasalahan, action plan, dan keputusan.', 'Tambahkan action item; action dapat dibuat menjadi task dan dipantau sebagai sumber worklog.'],
            note: 'Dokumen lama tampil sebagai legacy PDF archive sesuai periode. Dokumen baru ke depan dibuat digital dari Workspace.'
        },
        issues: {
            title: 'Issues',
            subtitle: 'Mencatat hambatan, risiko, atau temuan yang perlu monitoring.',
            steps: ['Klik Issue Baru, isi judul, tanggal, tipe issue, project/context, severity, owner, dan deskripsi.', 'Submit issue untuk direview Kadiv. Issue belum menjadi aktif sebelum disetujui.', 'Jika issue diterima, update action/resolution sampai bisa diajukan closure.'],
            note: 'Gunakan issue untuk hal yang memang perlu dipantau, bukan catatan pekerjaan harian biasa.'
        },
        kpi: {
            title: 'KPI',
            subtitle: 'Menghubungkan KPI Divisi ke program dan kontribusi individu.',
            steps: ['Buka tab Overview, Departemen, Divisi BIM, Individu, atau Program & Aktivitas sesuai kebutuhan.', 'Staff dapat take program, sementara Kadiv dapat delegasikan program ke staff.', 'Pastikan program dan task personal inline dengan KPI agar kontribusi bisa dinilai transparan.'],
            note: 'KPI staff dibuat sederhana: kontribusi harus jelas, terukur, dan bisa diverifikasi outputnya.'
        },
        reports: {
            title: 'Reports',
            subtitle: 'Menyajikan ringkasan manajemen untuk periode aktif.',
            steps: ['Pilih periode bulan yang ingin dibaca.', 'Review task aktif, task selesai, outstanding, issue aktif, action rapat, dan output worklog.', 'Gunakan Print Summary atau Export CSV jika role Anda memiliki akses export.'],
            note: 'Report tidak menampilkan jam kerja private staff kepada manajemen; fokusnya progress, status, dan output.'
        },
        settings: {
            title: 'Pengaturan',
            subtitle: 'Acuan konfigurasi operasional Workspace.',
            steps: ['Menu ini hanya tampil untuk role yang berwenang.', 'Gunakan Admin BCL untuk mengatur akses user dan role Workspace.', 'Jaga default operasional agar workflow task, issue, KPI, dan report tetap konsisten.'],
            note: 'Perubahan akses user tidak dilakukan dari Workspace, tetapi dari Panel Admin BCL.'
        }
    };

    function token() {
        try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            return localStorage.getItem('token') || stored.token || '';
        } catch (_) {
            return localStorage.getItem('token') || '';
        }
    }

    async function api(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        const authToken = token();
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
        const response = await fetch(`/api/bim-workspace${path}`, { credentials: 'include', ...options, headers });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.error || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
        }
        const method = String(options.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD'].includes(method) && !path.startsWith('/updates')) {
            scheduleUpdateVersionSync();
        }
        return data;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }

    function formatDate(value, fallback = '-') {
        if (!value) return fallback;
        const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
        return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }

    function formatDateTime(value, fallback = '-') {
        if (!value) return fallback;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
    }

    function formatMonth(period) {
        const [year, month] = period.split('-').map(Number);
        return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
    }

    function parseDateOnly(value) {
        const text = String(value || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
        const [year, month, day] = text.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function addDays(date, amount) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function dayDifference(start, end) {
        return Math.round((end.getTime() - start.getTime()) / 86400000);
    }

    function startOfWeek(date) {
        const result = new Date(date);
        const offset = (result.getDay() + 6) % 7;
        result.setDate(result.getDate() - offset);
        return result;
    }

    function daysInPeriod(period) {
        const [year, month] = period.split('-').map(Number);
        return new Date(year, month, 0).getDate();
    }

    function resetGanttWindow() {
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const baseDate = state.period === currentPeriod
            ? new Date()
            : parseDateOnly(`${state.period}-01`);
        state.ganttStart = state.ganttMode === 'month'
            ? `${state.period}-01`
            : dateKey(startOfWeek(baseDate || new Date()));
        state.ganttPeriod = state.period;
    }

    function shiftGanttWindow(amount) {
        if (!state.ganttStart || state.ganttPeriod !== state.period) resetGanttWindow();
        if (state.ganttMode === 'month') {
            shiftMonth(amount > 0 ? 1 : -1);
            return;
        }
        state.ganttStart = dateKey(addDays(parseDateOnly(state.ganttStart), amount));
        renderTasks();
    }

    function shiftMonth(offset) {
        const [year, month] = state.period.split('-').map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        state.period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('period-current').textContent = formatMonth(state.period);
        resetUpdateMonitorForPeriod();
        loadView(state.view, true);
    }

    function resetUpdateMonitorForPeriod() {
        state.updateVersions = {};
        state.latestVersions = {};
        state.pendingUpdates.clear();
        state.lastUpdateCheck = '';
        renderUpdateIndicators();
        checkWorkspaceUpdates({ adoptAll: true }).catch(() => {});
    }

    function tone(status) {
        if (['approved_done', 'approved', 'accepted', 'closed', 'issued', 'covered', 'achieved', 'confirmed', 'auto_confirmed'].includes(status)) return 'success';
        if (['blocked', 'rejected', 'cancelled', 'critical', 'at_risk', 'overallocated'].includes(status)) return 'danger';
        if (['on_hold', 'pending_approval', 'submitted_for_review', 'revision_required', 'rejected_revision', 'submitted', 'resolved_pending_approval', 'high', 'target_required', 'partial', 'verification', 'verification_pending', 'auto_draft'].includes(status)) return 'warning';
        return 'info';
    }

    function badge(value) {
        return `<span class="bimws-badge" data-tone="${tone(value)}">${escapeHtml(statusLabels[value] || value || '-')}</span>`;
    }

    function registerBadge(value) {
        return `<span class="bimws-badge" data-tone="${tone(value)}">${escapeHtml(registerLabels[value] || value || '-')}</span>`;
    }

    function emptyState(message, icon = 'fa-inbox') {
        return `<div class="bimws-empty"><i class="fas ${icon}"></i>${escapeHtml(message)}</div>`;
    }

    function toast(message, isError = false) {
        const element = document.getElementById('bimws-toast');
        element.textContent = message;
        element.classList.toggle('is-error', isError);
        element.classList.add('is-visible');
        clearTimeout(element.hideTimer);
        element.hideTimer = setTimeout(() => element.classList.remove('is-visible'), 3000);
    }

    function isDivisionHead() { return state.access?.role === 'division_head'; }
    function isKpiManager() { return ['division_head', 'system_admin'].includes(state.access?.role); }
    function canWrite() { return !!state.access?.permissions?.canWrite; }
    function isOwn(userId) { return String(userId || '') === String(state.access?.user?.id || ''); }

    function actionButton(icon, title, action, id, toneClass = '') {
        return `<button type="button" class="bimws-icon-btn ${toneClass}" data-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i class="fas ${icon}"></i></button>`;
    }

    function showDialog({ eyebrow = '', title, body, submitLabel = 'Simpan', onSubmit, secondary = [] }) {
        const dialog = document.getElementById('bimws-dialog');
        if (dialog.open) dialog.close();
        const form = document.getElementById('bimws-dialog-form');
        document.getElementById('bimws-dialog-eyebrow').textContent = eyebrow;
        document.getElementById('bimws-dialog-title').textContent = title;
        document.getElementById('bimws-dialog-body').innerHTML = body;
        document.getElementById('bimws-dialog-footer').innerHTML = [
            ...secondary.map((button) => `<button type="button" class="bimws-btn ${button.className || 'bimws-btn-secondary'}" data-dialog-action="${escapeHtml(button.action)}">${escapeHtml(button.label)}</button>`),
            `<button type="button" class="bimws-btn bimws-btn-secondary" data-dialog-close>Batal</button>`,
            onSubmit ? `<button type="submit" class="bimws-btn bimws-btn-primary">${escapeHtml(submitLabel)}</button>` : ''
        ].join('');
        form.onsubmit = async (event) => {
            event.preventDefault();
            if (!onSubmit) return;
            const submit = form.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                await onSubmit(new FormData(form));
                dialog.close();
            } catch (error) {
                toast(error.message, true);
            } finally {
                submit.disabled = false;
            }
        };
        form.querySelectorAll('[data-dialog-close]').forEach((button) => button.onclick = () => dialog.close());
        document.getElementById('bimws-dialog-x').onclick = () => dialog.close();
        secondary.forEach((button) => {
            const element = form.querySelector(`[data-dialog-action="${button.action}"]`);
            if (element) element.onclick = () => button.handler(dialog, form);
        });
        dialog.showModal();
        return dialog;
    }

    function field(name, label, value = '', options = {}) {
        const full = options.full ? ' bimws-field-full' : '';
        const required = options.required ? ' required' : '';
        const disabled = options.disabled ? ' disabled' : '';
        const help = options.help ? `<small>${escapeHtml(options.help)}</small>` : '';
        let control;
        if (options.type === 'textarea') {
            control = `<textarea name="${name}"${required}${disabled} placeholder="${escapeHtml(options.placeholder || '')}">${escapeHtml(value)}</textarea>`;
        } else if (options.type === 'select') {
            control = `<select name="${name}"${required}${disabled}>${(options.items || []).map((item) => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(value) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select>`;
        } else if (options.type === 'checkbox') {
            control = `<label class="bimws-check"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}${disabled}> ${escapeHtml(options.checkboxLabel || label)}</label>`;
        } else {
            const suggestions = Array.isArray(options.suggestions) ? options.suggestions : [];
            const listId = suggestions.length ? `${name}-suggestions` : '';
            control = `<input type="${options.type || 'text'}" name="${name}" value="${escapeHtml(value)}"${required}${disabled}${listId ? ` list="${listId}" autocomplete="off"` : ''} ${options.min != null ? `min="${options.min}"` : ''} ${options.max != null ? `max="${options.max}"` : ''} ${options.step ? `step="${options.step}"` : ''} placeholder="${escapeHtml(options.placeholder || '')}">${listId ? `<datalist id="${listId}">${suggestions.map((item) => `<option value="${escapeHtml(item)}"></option>`).join('')}</datalist>` : ''}`;
        }
        return `<div class="bimws-field${full}"><label>${escapeHtml(label)}</label>${control}${help}</div>`;
    }

    function formJson(formData, checkboxNames = []) {
        const value = Object.fromEntries(formData.entries());
        checkboxNames.forEach((name) => { value[name] = formData.has(name); });
        return value;
    }

    function updateVersionSignature(version) {
        return String(version?.signature || `${version?.count ?? 0}:${version?.versionAt || 'none'}`);
    }

    function updateViewLabel(view) {
        return viewMeta[view]?.[0] || view;
    }

    function setStoredVersion(view, version) {
        if (!view || !version) return;
        state.updateVersions[view] = updateVersionSignature(version);
    }

    function markViewFresh(view) {
        if (!view) return;
        const latest = state.latestVersions[view];
        if (latest) setStoredVersion(view, latest);
        state.pendingUpdates.delete(view);
        renderUpdateIndicators();
    }

    function renderUpdateIndicators() {
        document.querySelectorAll('.bimws-nav-item[data-view]').forEach((button) => {
            const view = button.dataset.view;
            let badge = button.querySelector('.bimws-update-dot');
            if (state.pendingUpdates.has(view)) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'bimws-update-dot';
                    badge.textContent = 'Baru';
                    button.appendChild(badge);
                }
            } else if (badge) {
                badge.remove();
            }
        });

        const banner = document.getElementById('bimws-update-banner');
        const refreshButton = document.getElementById('bimws-refresh-view');
        const text = document.getElementById('bimws-update-text');
        if (!banner || !refreshButton || !text) return;

        const currentHasUpdate = state.pendingUpdates.has(state.view);
        const pendingLabels = [...state.pendingUpdates].map(updateViewLabel);
        banner.hidden = !state.pendingUpdates.size;
        banner.classList.toggle('is-active-view', currentHasUpdate);
        refreshButton.hidden = !currentHasUpdate;
        text.textContent = currentHasUpdate
            ? `${updateViewLabel(state.view)} punya update baru.`
            : pendingLabels.length ? `Update baru: ${pendingLabels.slice(0, 3).join(', ')}${pendingLabels.length > 3 ? '...' : ''}.` : 'Data terkini.';
    }

    async function checkWorkspaceUpdates({ adoptAll = false, adoptView = '' } = {}) {
        if (!state.access) return;
        const result = await api(`/updates?period=${state.period}&year=${state.period.slice(0, 4)}`);
        const versions = result.versions || {};
        state.latestVersions = versions;
        state.lastUpdateCheck = result.checkedAt || new Date().toISOString();

        Object.entries(versions).forEach(([view, version]) => {
            const signature = updateVersionSignature(version);
            if (adoptAll || !state.updateVersions[view] || view === adoptView) {
                state.updateVersions[view] = signature;
                state.pendingUpdates.delete(view);
                return;
            }
            if (state.updateVersions[view] !== signature) {
                state.pendingUpdates.add(view);
            }
        });

        if (adoptView) markViewFresh(adoptView);
        renderUpdateIndicators();
    }

    function scheduleUpdateVersionSync() {
        window.clearTimeout(state.updateSyncTimer);
        state.updateSyncTimer = window.setTimeout(() => {
            checkWorkspaceUpdates({ adoptView: state.view }).catch(() => {});
        }, 1200);
    }

    function startUpdateMonitor() {
        window.clearInterval(state.updatePollTimer);
        state.updatePollTimer = window.setInterval(() => {
            if (document.hidden || !state.access) return;
            checkWorkspaceUpdates().catch(() => {});
        }, 30000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.access) checkWorkspaceUpdates().catch(() => {});
        });
    }

    async function init() {
        bindNavigation();
        try {
            const [access, users] = await Promise.all([api('/access/me'), api('/users')]);
            state.access = access;
            state.users = users;
            document.getElementById('bimws-user-name').textContent = access.user.name;
            document.getElementById('bimws-user-role').textContent = roleLabel(access.role);
            document.querySelector('.bimws-settings-nav').hidden = !access.permissions.canConfigure;
            document.getElementById('bimws-access-state').hidden = true;
            document.getElementById('bimws-content').hidden = false;
            document.getElementById('bimws-app').setAttribute('aria-busy', 'false');
            document.getElementById('period-current').textContent = formatMonth(state.period);
            applyWriteVisibility();
            await loadView('dashboard', true);
            await checkWorkspaceUpdates({ adoptAll: true });
            startUpdateMonitor();
        } catch (error) {
            renderAccessError(error);
        }
    }

    function roleLabel(role) {
        return ({ staff_bim: 'Staff BIM', division_head: 'Kepala Divisi BIM', department_head: 'Kepala Departemen', viewer: 'Viewer', system_admin: 'System Administrator' })[role] || role;
    }

    function renderAccessError(error) {
        const element = document.getElementById('bimws-access-state');
        element.innerHTML = error.status === 401
            ? `<i class="fas fa-lock"></i><p>Silakan login untuk membuka Divisi BIM Workspace.</p><a class="bimws-btn bimws-btn-primary" href="/pages/login.html?redirect=${encodeURIComponent(location.href)}">Login</a>`
            : `<i class="fas fa-shield-halved"></i><p>${escapeHtml(error.message || 'Akses Divisi BIM Workspace ditolak.')}</p><a class="bimws-btn bimws-btn-secondary" href="/index.html">Kembali ke BCL</a>`;
    }

    function showGuideList() {
        document.getElementById('guide-card-list').hidden = false;
        document.getElementById('guide-detail').hidden = true;
    }

    function showGuideDetail(key) {
        const detail = guideDetails[key];
        if (!detail) return;
        document.getElementById('guide-detail-title').textContent = detail.title;
        document.getElementById('guide-detail-subtitle').textContent = detail.subtitle;
        document.getElementById('guide-detail-content').innerHTML = `
            <ol class="bimws-guide-detail-steps">
                ${detail.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
            </ol>
            <div class="bimws-guide-note"><strong>Catatan:</strong> ${escapeHtml(detail.note)}</div>
        `;
        document.getElementById('guide-card-list').hidden = true;
        document.getElementById('guide-detail').hidden = false;
        document.getElementById('guide-detail').scrollIntoView({ block: 'start' });
    }

    function applyWriteVisibility() {
        ['task-new-btn', 'worklog-new-btn', 'meeting-new-btn', 'issue-new-btn'].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.hidden = !canWrite();
        });
        document.getElementById('task-carry-btn').hidden = !canWrite();
        const demoMenu = document.getElementById('task-demo-menu');
        if (demoMenu) demoMenu.hidden = !isKpiManager();
        ['task-demo-classify-btn', 'task-demo-clear-btn'].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.hidden = !isKpiManager();
        });
        document.getElementById('report-export-btn').hidden = !state.access.permissions.canExport;
    }

    function syncSidebarCollapseState() {
        const collapsed = document.getElementById('bimws-app').classList.contains('is-collapsed');
        const toggle = document.getElementById('bimws-sidebar-toggle');
        if (toggle) {
            toggle.title = collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar';
            toggle.setAttribute('aria-label', collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar');
            toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
            toggle.innerHTML = `<i class="fas ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}"></i>`;
        }
        document.querySelectorAll('.bimws-nav-item[data-view]').forEach((button) => {
            const label = button.querySelector('span')?.textContent?.trim() || updateViewLabel(button.dataset.view);
            button.title = label;
            button.setAttribute('aria-label', label);
        });
    }

    function bindGanttPan() {
        const wrap = document.getElementById('tasks-gantt');
        if (!wrap) return;
        let activePointer = null;
        let startX = 0;
        let startY = 0;
        let startScrollLeft = 0;
        let startScrollTop = 0;
        let didPan = false;
        let suppressClickUntil = 0;

        const stopPan = () => {
            if (activePointer != null) {
                try { wrap.releasePointerCapture(activePointer); } catch (_) {}
            }
            activePointer = null;
            wrap.classList.remove('is-panning');
            if (didPan) suppressClickUntil = Date.now() + 180;
        };

        wrap.addEventListener('pointerdown', (event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
            const canScroll = wrap.scrollWidth > wrap.clientWidth || wrap.scrollHeight > wrap.clientHeight;
            if (!canScroll) return;
            activePointer = event.pointerId;
            didPan = false;
            startX = event.clientX;
            startY = event.clientY;
            startScrollLeft = wrap.scrollLeft;
            startScrollTop = wrap.scrollTop;
            wrap.setPointerCapture(event.pointerId);
        });

        wrap.addEventListener('pointermove', (event) => {
            if (activePointer !== event.pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (!didPan && Math.hypot(dx, dy) > 4) didPan = true;
            if (!didPan) return;
            wrap.classList.add('is-panning');
            wrap.scrollLeft = startScrollLeft - dx;
            wrap.scrollTop = startScrollTop - dy;
            event.preventDefault();
        });

        wrap.addEventListener('pointerup', stopPan);
        wrap.addEventListener('pointercancel', stopPan);
        wrap.addEventListener('lostpointercapture', stopPan);
        wrap.addEventListener('click', (event) => {
            if (Date.now() > suppressClickUntil) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
    }

    function bindNavigation() {
        syncSidebarCollapseState();
        bindGanttPan();
        document.querySelectorAll('.bimws-nav-item').forEach((button) => button.addEventListener('click', () => loadView(button.dataset.view)));
        document.querySelectorAll('[data-go-view]').forEach((button) => button.addEventListener('click', () => loadView(button.dataset.goView)));
        document.querySelectorAll('[data-kpi-tab]').forEach((button) => button.addEventListener('click', () => {
            state.kpiTab = button.dataset.kpiTab;
            renderKpi();
        }));
        document.getElementById('period-prev').onclick = () => shiftMonth(-1);
        document.getElementById('period-next').onclick = () => shiftMonth(1);
        document.getElementById('period-current').onclick = () => { state.period = new Date().toISOString().slice(0,7); document.getElementById('period-current').textContent = formatMonth(state.period); resetUpdateMonitorForPeriod(); loadView(state.view, true); };
        document.getElementById('bimws-refresh-view').onclick = () => loadView(state.view, true);
        document.getElementById('bimws-sidebar-toggle').onclick = () => {
            document.getElementById('bimws-app').classList.toggle('is-collapsed');
            syncSidebarCollapseState();
        };
        document.getElementById('bimws-mobile-menu').onclick = () => document.getElementById('bimws-sidebar').classList.toggle('is-open');
        document.getElementById('task-new-btn').onclick = () => openTaskForm();
        document.getElementById('worklog-new-btn').onclick = () => openWorklogForm();
        document.getElementById('meeting-new-btn').onclick = () => openMeetingForm();
        document.getElementById('issue-new-btn').onclick = () => openIssueForm();
        document.getElementById('task-carry-btn').onclick = openCarryForward;
        document.getElementById('task-demo-classify-btn').onclick = () => {
            document.getElementById('task-demo-menu')?.removeAttribute('open');
            classifyDemoTasks();
        };
        document.getElementById('task-demo-clear-btn').onclick = () => {
            document.getElementById('task-demo-menu')?.removeAttribute('open');
            clearDemoTasks();
        };
        document.getElementById('report-print-btn').onclick = () => window.print();
        document.getElementById('report-export-btn').onclick = exportReportCsv;
        document.getElementById('task-search').oninput = renderTasks;
        document.getElementById('task-status-filter').onchange = renderTasks;
        document.getElementById('task-intake-filter').onchange = renderTasks;
        document.getElementById('task-mine-filter').onclick = () => {
            state.taskMineOnly = !state.taskMineOnly;
            renderTasks();
        };
        document.querySelectorAll('[data-task-view]').forEach((button) => button.addEventListener('click', () => {
            state.taskViewMode = button.dataset.taskView || 'task';
            renderTasks();
        }));
        document.querySelectorAll('[data-gantt-mode]').forEach((button) => button.addEventListener('click', () => {
            state.ganttMode = button.dataset.ganttMode || '2w';
            resetGanttWindow();
            renderTasks();
        }));
        document.getElementById('task-gantt-prev').onclick = () => shiftGanttWindow(state.ganttMode === 'month' ? -1 : -14);
        document.getElementById('task-gantt-next').onclick = () => shiftGanttWindow(state.ganttMode === 'month' ? 1 : 14);
        document.getElementById('task-gantt-today').onclick = () => { resetGanttWindow(); renderTasks(); };
        document.getElementById('worklog-search').oninput = renderWorklogs;
        document.getElementById('worklog-mine-only').onchange = renderWorklogs;
        document.getElementById('issue-search').oninput = renderIssues;
        document.getElementById('issue-status-filter').onchange = renderIssues;
        document.querySelectorAll('[data-guide-detail]').forEach((button) => button.addEventListener('click', () => showGuideDetail(button.dataset.guideDetail)));
        document.getElementById('guide-back-btn').onclick = showGuideList;
        document.addEventListener('click', handleActionClick);
    }

    async function loadView(view, force = false) {
        state.view = view;
        document.querySelectorAll('.bimws-nav-item').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
        document.querySelectorAll('.bimws-view').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
        document.getElementById('bimws-sidebar').classList.remove('is-open');
        const [title, eyebrow] = viewMeta[view] || viewMeta.dashboard;
        document.getElementById('bimws-view-title').textContent = title;
        document.getElementById('bimws-view-eyebrow').textContent = eyebrow;
        try {
            if (view === 'dashboard') await loadDashboard(force);
            if (view === 'tasks') await loadTasks(force);
            if (view === 'worklogs') await loadWorklogs(force);
            if (view === 'meetings') await loadMeetings(force);
            if (view === 'issues') await loadIssues(force);
            if (view === 'kpi') await loadKpi(force);
            if (view === 'reports') await loadReports(force);
            markViewFresh(view);
            checkWorkspaceUpdates({ adoptView: view }).catch(() => {});
        } catch (error) {
            toast(error.message, true);
        }
    }

    async function loadDashboard() {
        const [dashboard, tasks] = await Promise.all([api(`/dashboard?period=${state.period}`), api(`/tasks?period=${state.period}`)]);
        state.dashboard = dashboard;
        state.tasks = tasks;
        renderDashboard();
    }

    function activeTaskCharts(tasks) {
        const statusConfig = [
            ['in_progress', 'In Progress', '#087f8c'],
            ['planned', 'Planned', '#3b82f6'],
            ['on_hold', 'On Hold', '#b54708'],
            ['blocked', 'Blocked', '#b42318'],
            ['submitted_for_review', 'Review', '#e8752c'],
            ['rejected_revision', 'Revision', '#a15c00']
        ];
        const configuredStatuses = new Set(statusConfig.map(([value]) => value));
        const statusCounts = tasks.reduce((counts, task) => {
            const status = configuredStatuses.has(task.status) ? task.status : 'other';
            counts[status] = (counts[status] || 0) + 1;
            return counts;
        }, {});
        const entries = statusConfig
            .map(([status, label, color]) => ({ status, label, color, count: statusCounts[status] || 0 }))
            .filter((entry) => entry.count);
        if (statusCounts.other) entries.push({ status: 'other', label: 'Lainnya', color: '#667085', count: statusCounts.other });

        let cursor = 0;
        const gradient = entries.map((entry) => {
            const start = cursor;
            cursor += (entry.count / tasks.length) * 100;
            return `${entry.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
        }).join(', ');
        const averageProgress = Math.round(tasks.reduce((sum, task) => {
            return sum + Math.min(100, Math.max(0, Number(task.progressPercent) || 0));
        }, 0) / tasks.length);

        const projects = [...tasks.reduce((groups, task) => {
            const projectName = String(task.projectName || 'Internal').trim() || 'Internal';
            const current = groups.get(projectName) || { name: projectName, count: 0, totalProgress: 0 };
            current.count += 1;
            current.totalProgress += Math.min(100, Math.max(0, Number(task.progressPercent) || 0));
            groups.set(projectName, current);
            return groups;
        }, new Map()).values()]
            .map((project) => ({ ...project, progress: Math.round(project.totalProgress / project.count) }))
            .sort((a, b) => b.count - a.count || b.progress - a.progress || a.name.localeCompare(b.name))
            .slice(0, 6);

        return `<div class="bimws-bi-overview">
            <section class="bimws-donut-section" aria-labelledby="task-status-chart-title">
                <div class="bimws-chart-heading">
                    <div><h4 id="task-status-chart-title">Status Task Aktif</h4><p>${tasks.length} task pada ${escapeHtml(formatMonth(state.period))}</p></div>
                    <div class="bimws-chart-kpi"><span>Avg. progress</span><strong>${averageProgress}%</strong></div>
                </div>
                <div class="bimws-donut-layout">
                    <div class="bimws-donut" style="--chart-gradient:conic-gradient(${gradient})" role="img" aria-label="Distribusi ${tasks.length} task aktif berdasarkan status">
                        <div class="bimws-donut-center"><strong>${tasks.length}</strong><span>Task aktif</span></div>
                    </div>
                    <ul class="bimws-chart-legend">${entries.map((entry) => `<li><span class="bimws-legend-dot" style="--legend-color:${entry.color}"></span><span>${escapeHtml(entry.label)}</span><strong>${entry.count}</strong><small>${Math.round((entry.count / tasks.length) * 100)}%</small></li>`).join('')}</ul>
                </div>
            </section>
            <section class="bimws-project-chart" aria-labelledby="project-progress-chart-title">
                <div class="bimws-chart-heading"><div><h4 id="project-progress-chart-title">Progress per Project</h4><p>Rata-rata dari task aktif</p></div><span class="bimws-chart-count">Top ${projects.length}</span></div>
                <div class="bimws-project-bars">${projects.map((project) => `<div class="bimws-project-bar-row">
                    <div class="bimws-project-bar-label"><strong title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</strong><span>${project.count} task</span></div>
                    <div class="bimws-project-bar-track" role="progressbar" aria-label="Progress ${escapeHtml(project.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${project.progress}"><span style="width:${project.progress}%"></span></div>
                    <strong class="bimws-project-bar-value">${project.progress}%</strong>
                </div>`).join('')}</div>
            </section>
        </div>`;
    }

    function renderDashboard() {
        const data = state.dashboard;
        const i = data.indicators;
        document.getElementById('dashboard-metrics').innerHTML = [
            ['Task Completion', `${i.completionPercent}%`, `${i.completed} dari ${i.total} task`, '#16835f'],
            ['On-Time Completion', `${i.onTimePercent}%`, 'Task selesai tepat waktu', '#087f8c'],
            ['Pending Register', i.pendingApproval, 'Register dan completion review', '#a15c00'],
            ['Overdue', i.overdue, 'Task melewati due date', '#b42318'],
            ['Blocked', i.blocked, 'Task membutuhkan perhatian', '#e8752c']
        ].map(([label,value,help,color]) => `<article class="bimws-metric" style="--metric-color:${color}"><p>${label}</p><strong>${value}</strong><small>${help}</small></article>`).join('');

        document.getElementById('dashboard-quick-actions').innerHTML = canWrite() ? [
            `<button class="bimws-btn bimws-btn-secondary" data-dashboard-action="worklog"><i class="fas fa-clock"></i>Worklog</button>`,
            `<button class="bimws-btn bimws-btn-secondary" data-dashboard-action="issue"><i class="fas fa-triangle-exclamation"></i>Issue</button>`,
            `<button class="bimws-btn bimws-btn-primary" data-dashboard-action="task"><i class="fas fa-plus"></i>Task</button>`
        ].join('') : '';

        const active = state.tasks.filter((task) => task.intakeStatus === 'approved' && !['approved_done','cancelled'].includes(task.status));
        document.getElementById('dashboard-active-tasks').innerHTML = active.length ? activeTaskCharts(active) : emptyState('Belum ada task aktif pada periode ini.', 'fa-chart-pie');

        const attention = [];
        if (i.pendingApproval) attention.push(['fa-user-check','Pending register',`${i.pendingApproval} task menunggu review register`]);
        if (i.overdue) attention.push(['fa-calendar-xmark','Task overdue',`${i.overdue} task melewati due date`]);
        if (i.blocked) attention.push(['fa-ban','Task blocked',`${i.blocked} task membutuhkan tindak lanjut`]);
        if (i.pendingIssues) attention.push(['fa-triangle-exclamation','Issue submitted',`${i.pendingIssues} issue menunggu acceptance`]);
        if (i.overdueMeetingActions) attention.push(['fa-people-group','Action rapat overdue',`${i.overdueMeetingActions} action belum closed`]);
        document.getElementById('dashboard-attention').innerHTML = attention.length ? attention.map(feedItem).join('') : emptyState('Tidak ada item yang memerlukan perhatian.', 'fa-circle-check');

        document.getElementById('dashboard-outputs').innerHTML = data.recentOutputs.length ? data.recentOutputs.map((row) => feedItem(['fa-box-open', row.task_item_text, `${row.pic_name_snapshot}: ${row.output_result}`])).join('') : emptyState('Belum ada output worklog pada periode ini.', 'fa-box-open');
        document.getElementById('dashboard-activity').innerHTML = data.recentActivity.length ? data.recentActivity.map((row) => `<div class="bimws-activity-item"><span class="bimws-feed-icon"><i class="fas fa-clock-rotate-left"></i></span><div><h4>${escapeHtml(row.summary || row.action)}</h4><p>${escapeHtml(row.actor_name_snapshot || '')} / ${formatDateTime(row.created_at)}</p></div></div>`).join('') : emptyState('Belum ada aktivitas workspace.');
    }

    function feedItem(item) {
        return `<div class="bimws-feed-item"><span class="bimws-feed-icon"><i class="fas ${item[0]}"></i></span><div><h4>${escapeHtml(item[1])}</h4><p>${escapeHtml(item[2])}</p></div></div>`;
    }

    async function loadTasks() {
        state.tasks = await api(`/tasks?period=${state.period}`);
        renderTasks();
    }

    function taskPicKey(task) {
        return String(task.picUserId || task.picName || 'unassigned').toLowerCase();
    }

    function taskDateRange(task) {
        let start = parseDateOnly(task.startDate || task.dueDate);
        let end = parseDateOnly(task.dueDate || task.startDate);
        if (!start && !end) return null;
        if (!start) start = new Date(end);
        if (!end) end = new Date(start);
        if (end < start) end = new Date(start);
        return { start, end };
    }

    function taskRangeDays(task, maxDays = 120) {
        const range = taskDateRange(task);
        if (!range) return [];
        const total = Math.min(dayDifference(range.start, range.end), maxDays - 1);
        return Array.from({ length: total + 1 }, (_, index) => addDays(range.start, index));
    }

    function taskWeekKey(date) {
        return dateKey(startOfWeek(date));
    }

    function isLoadActiveTask(task) {
        return !['approved_done', 'cancelled', 'on_hold'].includes(task.status) && !['rejected', 'replaced'].includes(task.intakeStatus);
    }

    function isTaskCritical(task) {
        const today = parseDateOnly(dateKey(new Date()));
        const due = parseDateOnly(task.dueDate);
        const daysToDue = due ? dayDifference(today, due) : null;
        return !!task.isCritical ||
            task.priority === 'urgent' ||
            task.taskCategory === 'urgent' ||
            task.status === 'blocked' ||
            (daysToDue != null && daysToDue <= 2 && Number(task.progressPercent || 0) < 80);
    }

    function analyzeTaskLoad(tasks) {
        const active = tasks.filter((task) => isLoadActiveTask(task) && taskDateRange(task));
        const byId = new Map();
        const byPicDay = new Map();
        const byPicWeek = new Map();
        const addToSetMap = (map, key, id) => {
            if (!map.has(key)) map.set(key, new Set());
            map.get(key).add(id);
        };

        active.forEach((task) => {
            taskRangeDays(task).forEach((date) => {
                const pic = taskPicKey(task);
                addToSetMap(byPicDay, `${pic}|${dateKey(date)}`, task.id);
                addToSetMap(byPicWeek, `${pic}|${taskWeekKey(date)}`, task.id);
            });
        });

        tasks.forEach((task) => {
            const days = taskRangeDays(task);
            const pic = taskPicKey(task);
            let maxDayLoad = 0;
            let maxWeekLoad = 0;
            let clashCount = 0;
            days.forEach((date) => {
                const daySet = byPicDay.get(`${pic}|${dateKey(date)}`) || new Set();
                const weekSet = byPicWeek.get(`${pic}|${taskWeekKey(date)}`) || new Set();
                maxDayLoad = Math.max(maxDayLoad, daySet.size);
                maxWeekLoad = Math.max(maxWeekLoad, weekSet.size);
                if (daySet.has(task.id) && daySet.size > 1) clashCount = Math.max(clashCount, daySet.size - 1);
            });
            const critical = isTaskCritical(task);
            const today = parseDateOnly(dateKey(new Date()));
            const due = parseDateOnly(task.dueDate);
            const daysToDue = due ? dayDifference(today, due) : null;
            const canHold = task.taskCategory === 'flexible' &&
                isLoadActiveTask(task) &&
                !critical &&
                !['high', 'urgent'].includes(task.priority) &&
                (daysToDue == null || daysToDue > 3);
            byId.set(task.id, {
                clash: clashCount > 0,
                clashCount,
                overload: maxDayLoad >= 3 || maxWeekLoad > 6,
                maxDayLoad,
                maxWeekLoad,
                critical,
                canHold
            });
        });

        return {
            byId,
            clash: [...byId.values()].filter((item) => item.clash).length,
            overload: [...byId.values()].filter((item) => item.overload).length,
            critical: [...byId.values()].filter((item) => item.critical).length,
            canHold: [...byId.values()].filter((item) => item.canHold).length
        };
    }

    function taskCategoryBadge(task) {
        return `<span class="bimws-task-chip" data-category="${escapeHtml(task.taskCategory || 'regular')}">${escapeHtml(taskCategoryLabels[task.taskCategory] || 'Regular')}</span>`;
    }

    function taskRiskBadges(task) {
        const risk = state.taskLoad?.byId?.get(task.id) || {};
        const chips = [taskCategoryBadge(task)];
        if (risk.critical) chips.push('<span class="bimws-risk-chip" data-risk="critical">Critical</span>');
        if (risk.clash) chips.push(`<span class="bimws-risk-chip" data-risk="clash">Clash${risk.clashCount ? ` +${risk.clashCount}` : ''}</span>`);
        if (risk.overload) chips.push('<span class="bimws-risk-chip" data-risk="overload">Overload</span>');
        if (risk.canHold) chips.push('<span class="bimws-risk-chip" data-risk="hold">Can Hold</span>');
        return `<div class="bimws-risk-badges">${chips.join('')}</div>`;
    }

    function taskGanttRiskIcons(task) {
        const risk = state.taskLoad?.byId?.get(task.id) || {};
        const icons = [];
        if (risk.critical) icons.push('<span data-risk="critical" title="Critical task">!</span>');
        if (risk.clash) icons.push('<span data-risk="clash" title="Clash task">C</span>');
        if (risk.overload) icons.push('<span data-risk="overload" title="Overload">O</span>');
        if (risk.canHold) icons.push('<span data-risk="hold" title="Flexible / can hold">H</span>');
        return icons.length ? `<span class="bimws-gantt-risk-icons">${icons.join('')}</span>` : '';
    }

    function renderTaskLoadSummary(load) {
        const element = document.getElementById('task-load-summary');
        if (!element) return;
        const items = [
            ['critical', 'Critical', load.critical, 'Task urgent, blocked, manual critical, atau due dekat progress rendah'],
            ['clash', 'Clash', load.clash, 'Task aktif PIC yang overlap tanggal'],
            ['overload', 'Overload', load.overload, 'Beban harian atau mingguan PIC melewati threshold'],
            ['hold', 'Flexible', load.canHold, 'Task fleksibel yang bisa ditunda saat ada urgent']
        ];
        element.innerHTML = items.map(([risk,label,count,help]) => `
            <article class="bimws-load-card" data-load-risk="${risk}" title="${escapeHtml(help)}">
                <span>${escapeHtml(label)}</span><strong>${count}</strong>
            </article>
        `).join('');
    }

    function taskTable(tasks, actions = true) {
        return `<table class="bimws-table"><thead><tr><th>Task</th><th>PIC</th><th>Periode</th><th>Progress</th><th>Risk / Load</th><th>Register</th><th>Status</th>${actions ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${tasks.map((task) => {
            const overdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().toISOString().slice(0,10)) && !['approved_done','cancelled'].includes(task.status);
            const demoPill = task.isDemo ? '<span class="bimws-demo-pill">Demo</span>' : '';
            return `<tr data-status="${escapeHtml(task.status)}" data-priority="${escapeHtml(task.priority)}" data-category="${escapeHtml(task.taskCategory || 'regular')}" data-demo="${task.isDemo ? 'true' : 'false'}"><td><span class="bimws-table-title">${escapeHtml(task.title)}${demoPill}</span><span class="bimws-table-sub">${escapeHtml(task.projectName || 'Internal')} / ${escapeHtml(task.taskType.replaceAll('_',' '))}</span></td><td>${escapeHtml(task.picName || '-')}</td><td>${formatDate(task.startDate)}<span class="bimws-table-sub ${overdue ? 'text-danger' : ''}">Due ${formatDate(task.dueDate)}</span></td><td><div class="bimws-progress"><span style="width:${task.progressPercent}%"></span></div><span class="bimws-table-sub">${task.progressPercent}%</span></td><td>${taskRiskBadges(task)}</td><td>${registerBadge(task.intakeStatus)}</td><td>${badge(task.status)}</td>${actions ? `<td><div class="bimws-row-actions">${taskActions(task)}</div></td>` : ''}</tr>`;
        }).join('')}</tbody></table>`;
    }

    function taskGroupValue(task, mode) {
        if (mode === 'pic') return task.picName || 'Belum ada PIC';
        if (mode === 'project') return task.projectName || 'Internal';
        if (mode === 'status') return statusLabels[task.status] || task.status || '-';
        if (mode === 'approval') return registerLabels[task.intakeStatus] || task.intakeStatus || '-';
        return 'Task';
    }

    function taskGroupLabel(mode) {
        return ({ pic: 'PIC', project: 'Project / Context', status: 'Status Task', approval: 'Register' })[mode] || 'Task';
    }

    function isMyTask(task) {
        return isOwn(task.picUserId) || isOwn(task.createdByUserId);
    }

    function summarizeTaskGroup(tasks) {
        const total = tasks.length;
        const done = tasks.filter((task) => task.status === 'approved_done').length;
        const blocked = tasks.filter((task) => task.status === 'blocked').length;
        const held = tasks.filter((task) => task.status === 'on_hold').length;
        const active = tasks.filter((task) => !['approved_done','cancelled'].includes(task.status)).length;
        const progress = total ? Math.round(tasks.reduce((sum, task) => sum + Math.min(100, Math.max(0, Number(task.progressPercent) || 0)), 0) / total) : 0;
        return { total, done, blocked, held, active, progress };
    }

    function groupedTaskView(tasks, mode) {
        const groups = new Map();
        tasks.forEach((task) => {
            const key = taskGroupValue(task, mode);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(task);
        });
        const groupRows = [...groups.entries()].sort(([leftName,leftTasks],[rightName,rightTasks]) =>
            rightTasks.length - leftTasks.length || leftName.localeCompare(rightName, 'id-ID')
        );
        return `<div class="bimws-task-groups">${groupRows.map(([name,items]) => {
            const summary = summarizeTaskGroup(items);
            return `<section class="bimws-task-group">
                <header>
                    <div><span>${escapeHtml(taskGroupLabel(mode))}</span><h4>${escapeHtml(name)}</h4></div>
                    <div class="bimws-task-group-stats">
                        <strong>${summary.total}</strong><small>task</small>
                        <strong>${summary.progress}%</strong><small>avg</small>
                    </div>
                </header>
                <div class="bimws-task-group-summary">
                    <span>${summary.active} aktif</span><span>${summary.done} selesai</span><span>${summary.blocked} blocked</span><span>${summary.held} hold</span>
                </div>
                <div class="bimws-table-wrap">${taskTable(items)}</div>
            </section>`;
        }).join('')}</div>`;
    }

    function taskActions(task) {
        const buttons = [actionButton('fa-eye','Lihat task','task-view',task.id)];
        const creator = isOwn(task.createdByUserId);
        const pic = isOwn(task.picUserId);
        const manager = isKpiManager();
        if ((creator || pic || manager) && task.intakeStatus !== 'pending_approval' && !['submitted_for_review','approved_done'].includes(task.status) && (manager || task.status !== 'on_hold')) buttons.push(actionButton('fa-pen','Edit task','task-edit',task.id));
        if (creator && ['draft','revision_required'].includes(task.intakeStatus)) buttons.push(actionButton('fa-paper-plane','Ajukan register','task-submit',task.id));
        if (manager && task.intakeStatus === 'pending_approval') buttons.push(actionButton('fa-user-check','Review register task','task-intake-review',task.id));
        if (manager && task.intakeStatus === 'approved' && !['submitted_for_review','approved_done','cancelled','on_hold'].includes(task.status)) buttons.push(actionButton('fa-pause','Hold task','task-hold',task.id,'is-warning'));
        if (manager && task.status === 'on_hold') buttons.push(actionButton('fa-play','Start again','task-resume',task.id,'is-success'));
        if ((creator || pic) && task.intakeStatus === 'approved' && !['submitted_for_review','approved_done','cancelled','on_hold'].includes(task.status)) buttons.push(actionButton('fa-flag-checkered','Ajukan selesai','task-complete-submit',task.id));
        if (manager && task.status === 'submitted_for_review') buttons.push(actionButton('fa-check','Review penyelesaian','task-completion-review',task.id));
        if (manager && !task.isDemo) buttons.push(actionButton('fa-tag','Tandai sebagai demo','task-demo-mark',task.id));
        if (manager && task.isDemo) buttons.push(actionButton('fa-trash','Hapus demo task','task-demo-delete',task.id,'is-danger'));
        return buttons.join('');
    }

    function renderTasks() {
        const query = document.getElementById('task-search').value.toLowerCase();
        const status = document.getElementById('task-status-filter').value;
        const intake = document.getElementById('task-intake-filter').value;
        const mineButton = document.getElementById('task-mine-filter');
        if (mineButton) {
            mineButton.classList.toggle('is-active', state.taskMineOnly);
            mineButton.setAttribute('aria-pressed', state.taskMineOnly ? 'true' : 'false');
        }
        const filtered = state.tasks.filter((task) => (!state.taskMineOnly || isMyTask(task)) && (!query || `${task.title} ${task.projectName} ${task.picName}`.toLowerCase().includes(query)) && (!status || task.status === status) && (!intake || task.intakeStatus === intake));
        state.taskLoad = analyzeTaskLoad(filtered);
        renderTaskLoadSummary(state.taskLoad);
        document.querySelectorAll('[data-task-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.taskView === state.taskViewMode));
        renderTaskGantt(filtered);
        document.getElementById('tasks-table').innerHTML = filtered.length
            ? (state.taskViewMode === 'task' ? taskTable(filtered) : groupedTaskView(filtered, state.taskViewMode))
            : emptyState('Tidak ada task yang sesuai filter.', 'fa-calendar-check');
    }

    function ganttDateLabel(date, options) {
        return new Intl.DateTimeFormat('id-ID', options).format(date);
    }

    function hashPicKey(value) {
        return String(value || 'unassigned').split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
    }

    function getPicTimelineColor(task) {
        const key = task.picUserId || task.picName || 'unassigned';
        return picColorPalette[Math.abs(hashPicKey(key)) % picColorPalette.length];
    }

    function picTimelineStyle(color) {
        return [
            `--task-color:${color.border}`,
            `--task-bg:${color.bg}`,
            `--task-fill:${color.fill}`,
            `--task-hold-stripe:${color.stripe}`,
            `--task-text:${color.text}`
        ].join(';');
    }

    function renderTaskGantt(tasks) {
        if (!state.ganttStart || state.ganttPeriod !== state.period) resetGanttWindow();
        const windowStart = parseDateOnly(state.ganttStart);
        const dayCount = state.ganttMode === 'month' ? daysInPeriod(state.period) : 14;
        const windowEnd = addDays(windowStart, dayCount - 1);
        const todayKey = dateKey(new Date());
        const days = Array.from({ length: dayCount }, (_, index) => addDays(windowStart, index));
        const sortedTasks = [...tasks].sort((left, right) => {
            const leftDate = String(left.startDate || left.dueDate || '9999-12-31');
            const rightDate = String(right.startDate || right.dueDate || '9999-12-31');
            return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
        });

        document.getElementById('task-gantt-title').textContent = state.ganttMode === 'month' ? 'Timeline 1 Bulan' : 'Timeline 2 Minggu';
        document.getElementById('task-gantt-range').textContent = `${ganttDateLabel(windowStart, { day: 'numeric', month: 'short' })} - ${ganttDateLabel(windowEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`;
        document.getElementById('task-gantt-prev').title = state.ganttMode === 'month' ? 'Bulan sebelumnya' : 'Dua minggu sebelumnya';
        document.getElementById('task-gantt-next').title = state.ganttMode === 'month' ? 'Bulan berikutnya' : 'Dua minggu berikutnya';
        document.querySelectorAll('[data-gantt-mode]').forEach((button) => {
            const active = button.dataset.ganttMode === state.ganttMode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        const header = [
            '<div class="bimws-gantt-meta-head" style="grid-column:1;grid-row:1">Task / Project / PIC</div>',
            ...days.map((date, index) => {
                const weekend = [0, 6].includes(date.getDay()) ? ' is-weekend' : '';
                const today = dateKey(date) === todayKey ? ' is-today' : '';
                return `<div class="bimws-gantt-day-head${weekend}${today}" style="grid-column:${index + 2};grid-row:1"><span>${escapeHtml(ganttDateLabel(date, { weekday: 'short' }))}</span><strong>${date.getDate()}</strong></div>`;
            })
        ].join('');

        const rows = sortedTasks.map((task, index) => {
            const gridRow = index + 2;
            const cells = days.map((date, dayIndex) => {
                const weekend = [0, 6].includes(date.getDay()) ? ' is-weekend' : '';
                const today = dateKey(date) === todayKey ? ' is-today' : '';
                return `<div class="bimws-gantt-day-cell${weekend}${today}" style="grid-column:${dayIndex + 2};grid-row:${gridRow}"></div>`;
            }).join('');

            let taskStart = parseDateOnly(task.startDate || task.dueDate);
            let taskEnd = parseDateOnly(task.dueDate || task.startDate);
            if (taskStart && taskEnd && taskEnd < taskStart) taskEnd = new Date(taskStart);
            let bar = '';
            if (taskStart && taskEnd && taskEnd >= windowStart && taskStart <= windowEnd) {
                const visibleStart = taskStart < windowStart ? windowStart : taskStart;
                const visibleEnd = taskEnd > windowEnd ? windowEnd : taskEnd;
                const column = dayDifference(windowStart, visibleStart) + 2;
                const span = dayDifference(visibleStart, visibleEnd) + 1;
                const progress = Math.min(100, Math.max(0, Number(task.progressPercent || 0)));
                const duration = dayDifference(taskStart, taskEnd) + 1;
                const picColor = getPicTimelineColor(task);
                const risk = state.taskLoad?.byId?.get(task.id) || {};
                bar = `<button type="button" class="bimws-gantt-bar" data-action="task-view" data-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}" data-priority="${escapeHtml(task.priority)}" data-category="${escapeHtml(task.taskCategory || 'regular')}" data-intake="${escapeHtml(task.intakeStatus)}" data-critical="${risk.critical ? 'true' : 'false'}" data-clash="${risk.clash ? 'true' : 'false'}" data-overload="${risk.overload ? 'true' : 'false'}" data-can-hold="${risk.canHold ? 'true' : 'false'}" style="grid-column:${column}/span ${span};grid-row:${gridRow};--task-progress:${progress}%;${picTimelineStyle(picColor)}" title="${escapeHtml(`${task.title} / ${task.picName || 'Belum ada PIC'} / ${duration} hari / ${progress}%`)}"><span class="bimws-gantt-progress-fill"></span><span class="bimws-gantt-progress-label">${progress}%</span></button>`;
            }

            const picColor = getPicTimelineColor(task);
            return `<div class="bimws-gantt-task-meta" style="grid-column:1;grid-row:${gridRow};--pic-color:${picColor.border}"><span class="bimws-gantt-index">${index + 1}</span><span class="bimws-gantt-pic-dot" title="${escapeHtml(`PIC: ${task.picName || 'Belum ada PIC'}`)}"></span><span><strong title="${escapeHtml(task.title)}">${escapeHtml(task.title)}${taskGanttRiskIcons(task)}</strong><small>${escapeHtml(task.projectName || 'Internal')} / ${escapeHtml(task.picName || 'Belum ada PIC')} / ${escapeHtml(statusLabels[task.status] || task.status)}</small></span></div>${cells}${bar}`;
        }).join('');

        document.getElementById('tasks-gantt').innerHTML = sortedTasks.length
            ? `<div class="bimws-gantt-grid" style="--gantt-day-count:${dayCount}">${header}${rows}</div>`
            : `<div class="bimws-empty"><i class="fas fa-chart-gantt"></i>Tidak ada task untuk ditampilkan pada timeline.</div>`;
    }

    function userOptions(selected = '') {
        return [{ value: '', label: 'Belum ditentukan' }, ...state.users.map((user) => ({ value: user.id, label: `${user.username}${user.jobRole ? ` / ${user.jobRole}` : ''}` }))]
            .map((item) => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(selected) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
    }

    function staffUserOptions(selected = '') {
        const staff = state.users.filter((user) => user.workspaceRole === 'staff_bim');
        if (!staff.length) return '<option value="" disabled selected>Belum ada user Staff BIM aktif</option>';
        return staff.map((user) => `<option value="${escapeHtml(user.id)}" ${String(user.id) === String(selected) ? 'selected' : ''}>${escapeHtml(`${user.username}${user.jobRole ? ` / ${user.jobRole}` : ''}`)}</option>`).join('');
    }

    function taskTypeItems() {
        return ['project_task','tender_support','routine_monitoring','coordination','review','reporting','support','internal_admin','other'].map((value) => ({ value, label: value.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase()) }));
    }

    function taskCategoryItems() {
        return Object.entries(taskCategoryLabels).map(([value, label]) => ({ value, label }));
    }

    function taskStatusItems(includeHold = false) {
        return ['planned','in_progress',...(includeHold ? ['on_hold'] : []),'blocked','rejected_revision','cancelled'].map((value) => ({ value, label: statusLabels[value] }));
    }

    async function refreshProjectContexts() {
        try {
            state.projectContexts = await api('/task-project-contexts');
        } catch (error) {
            if (!state.projectContexts.length) toast('Daftar project belum dapat dimuat. Nama project tetap bisa diketik manual.', true);
        }
    }

    async function loadKpiTaskOptions(picUserId) {
        if (!picUserId) return [];
        try {
            return await api(`/kpi/task-options?year=${state.period.slice(0,4)}&picUserId=${encodeURIComponent(picUserId)}`);
        } catch (_) {
            return [];
        }
    }

    function kpiTaskOptions(items, selected = '') {
        return [{ id: '', programCode: '', programName: 'Non-KPI / operasional', title: '' }, ...items]
            .map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${escapeHtml(item.id ? `${item.programCode} / ${item.title}` : item.programName)}</option>`).join('');
    }

    async function openTaskForm(task = null) {
        await refreshProjectContexts();
        const definitionLocked = !!task && task.intakeStatus === 'approved' && !isDivisionHead();
        const currentUserId = String(state.access?.user?.id || '');
        const currentUserName = state.access?.user?.name || 'User BCL';
        const delegatedTask = isDivisionHead() && !!task?.picUserId && String(task.picUserId) !== currentUserId;
        const initialPicUserId = delegatedTask ? task.picUserId : currentUserId;
        const initialKpiOptions = await loadKpiTaskOptions(initialPicUserId);
        const assignmentFields = isDivisionHead() ? `
                <div class="bimws-field"><label>Penugasan</label><select name="assignmentMode" id="task-assignment-mode" ${definitionLocked ? 'disabled' : ''}>
                    <option value="self" ${delegatedTask ? '' : 'selected'}>Task saya</option>
                    <option value="delegate" ${delegatedTask ? 'selected' : ''}>Delegasikan ke Staff BIM</option>
                </select><small>Delegasi mencatat pemberi tugas, PIC, dan waktu penugasan.</small></div>
                <div class="bimws-field" id="task-delegate-field" ${delegatedTask ? '' : 'hidden'}><label>Staff BIM</label><select name="delegateUserId" id="task-delegate-user" ${definitionLocked ? 'disabled' : ''}>${staffUserOptions(delegatedTask ? task.picUserId : '')}</select><small>Hanya user aktif dengan role Staff BIM.</small></div>`
            : `<div class="bimws-field"><label>PIC</label><input type="text" value="${escapeHtml(currentUserName)}" disabled><input type="hidden" name="picUserId" value="${escapeHtml(currentUserId)}"><small>Task dari staff menjadi usulan register dan memerlukan review Kepala Divisi.</small></div>`;
        const dialog = showDialog({
            eyebrow: task ? 'Task Scheduler' : formatMonth(state.period),
            title: task ? 'Edit Task' : 'Task Baru',
            body: `<div class="bimws-form-grid">
                ${field('title','Task Item',task?.title||'',{required:true,full:true,disabled:definitionLocked})}
                ${field('projectName','Project / Context',task?.projectName||'',{placeholder:'Ketik atau pilih project yang sudah ada',disabled:definitionLocked,suggestions:state.projectContexts,help:'Pilih nama yang sudah ada agar task lintas staf memakai konteks project yang sama.'})}
                ${field('taskType','Task Type',task?.taskType||'project_task',{type:'select',items:taskTypeItems(),disabled:definitionLocked})}
                ${field('taskCategory','Kategori Beban',task?.taskCategory||'regular',{type:'select',items:taskCategoryItems(),disabled:definitionLocked,help:'Regular = task normal. Rutin = berulang. Fleksibel = dikerjakan saat tidak ada urgent/kapasitas tersedia. Urgent = sisipan prioritas tinggi yang perlu segera dikerjakan.'})}
                ${assignmentFields}
                <div class="bimws-field bimws-field-full"><label>Kontribusi KPI</label><select name="kpiAssignmentId" id="task-kpi-assignment" ${definitionLocked ? 'disabled' : ''}>${kpiTaskOptions(initialKpiOptions,task?.kpiAssignmentId||'')}</select><small>Hanya kontribusi milik PIC yang sudah approved.</small></div>
                ${field('priority','Priority',task?.priority||'normal',{type:'select',items:['low','normal','high','urgent'].map((value)=>({value,label:value[0].toUpperCase()+value.slice(1)})),disabled:definitionLocked})}
                ${field('startDate','Start Date',task?.startDate?String(task.startDate).slice(0,10):'',{type:'date',disabled:definitionLocked})}
                ${field('dueDate','Due Date',task?.dueDate?String(task.dueDate).slice(0,10):'',{type:'date',disabled:definitionLocked})}
                <div class="bimws-task-load-preview bimws-field-full" data-task-load-preview hidden></div>
                ${task ? field('status','Task Status',task.status,{type:'select',items:taskStatusItems(isKpiManager()).filter((item)=>isKpiManager() || !['cancelled','on_hold'].includes(item.value))}) : ''}
                ${task ? field('progressPercent','Progress (%)',task.progressPercent,{type:'number',min:0,max:99,step:'1'}) : ''}
                ${field('description','Description',task?.description||'',{type:'textarea',full:true,disabled:definitionLocked})}
                ${field('evidenceLink','Evidence Link',task?.evidenceLink||'',{type:'url',full:true,placeholder:'https:// atau path referensi'})}
                ${field('isCritical','Critical task',task?.isCritical||false,{type:'checkbox',full:true,checkboxLabel:'Tandai sebagai critical task',disabled:definitionLocked,help:'Critical berarti dampaknya besar bila gagal atau terlambat. Gunakan untuk task blocking deliverable, deadline management/project, tender/KPI penting, atau risiko tinggi. Tidak semua task urgent harus critical.'})}
                ${field('criticalReason','Alasan Critical',task?.criticalReason||'',{type:'textarea',full:true,disabled:definitionLocked,placeholder:'Contoh: blocking deliverable koordinasi, deadline tender besok, output diminta manajemen, berdampak ke KPI divisi.'})}
                ${field('isRoutine','Task rutin',task?.isRoutine||false,{type:'checkbox',full:true,checkboxLabel:'Bisa digenerate ke periode berikutnya',disabled:definitionLocked})}
            </div>`,
            submitLabel: task ? 'Simpan Perubahan' : (isDivisionHead() ? 'Buat Task' : 'Buat Draft Task'),
            onSubmit: async (formData) => {
                const payload = formJson(formData,['isRoutine','isCritical']);
                payload.periodMonth = state.period;
                if (isDivisionHead()) {
                    payload.picUserId = payload.assignmentMode === 'delegate' ? payload.delegateUserId : currentUserId;
                } else {
                    payload.picUserId = currentUserId;
                }
                const selected = state.users.find((user) => String(user.id) === String(payload.picUserId));
                payload.picName = String(payload.picUserId) === currentUserId ? currentUserName : (selected?.username || '');
                const delegatedName = payload.assignmentMode === 'delegate' ? payload.picName : '';
                delete payload.assignmentMode;
                delete payload.delegateUserId;
                if (task) await api(`/tasks/${task.id}`,{method:'PUT',body:JSON.stringify(payload)});
                else await api('/tasks',{method:'POST',body:JSON.stringify(payload)});
                toast(task ? 'Task diperbarui.' : delegatedName ? `Task didelegasikan kepada ${delegatedName}.` : isDivisionHead() ? 'Task dibuat.' : 'Draft task dibuat.');
                await loadTasks(true);
            }
        });
        const assignmentMode = dialog.querySelector('#task-assignment-mode');
        const delegateField = dialog.querySelector('#task-delegate-field');
        const delegateUser = dialog.querySelector('#task-delegate-user');
        const kpiAssignment = dialog.querySelector('#task-kpi-assignment');
        const preview = dialog.querySelector('[data-task-load-preview]');
        const priorityInput = dialog.querySelector('[name="priority"]');
        const categoryInput = dialog.querySelector('[name="taskCategory"]');
        const routineInput = dialog.querySelector('[name="isRoutine"]');
        const criticalInput = dialog.querySelector('[name="isCritical"]');
        const currentPic = () => assignmentMode?.value === 'delegate' ? delegateUser?.value : currentUserId;
        const currentPicName = () => {
            const id = currentPic();
            return String(id) === currentUserId ? currentUserName : (state.users.find((user) => String(user.id) === String(id))?.username || '');
        };
        const refreshKpiAssignment = async () => {
            if (!kpiAssignment) return;
            const picUserId = currentPic();
            const selected = kpiAssignment.value;
            kpiAssignment.innerHTML = kpiTaskOptions(await loadKpiTaskOptions(picUserId), selected);
        };
        const renderLoadPreview = () => {
            if (!preview) return;
            const draft = {
                ...(task || {}),
                id: task?.id || '__draft_task__',
                title: dialog.querySelector('[name="title"]')?.value || 'Task baru',
                picUserId: currentPic(),
                picName: currentPicName(),
                startDate: dialog.querySelector('[name="startDate"]')?.value || '',
                dueDate: dialog.querySelector('[name="dueDate"]')?.value || '',
                priority: priorityInput?.value || 'normal',
                taskCategory: categoryInput?.value || 'regular',
                isCritical: criticalInput?.checked || false,
                status: dialog.querySelector('[name="status"]')?.value || task?.status || 'planned',
                intakeStatus: task?.intakeStatus || 'approved',
                progressPercent: task?.progressPercent || 0
            };
            if (!draft.picUserId || (!draft.startDate && !draft.dueDate)) {
                preview.hidden = true;
                preview.innerHTML = '';
                return;
            }
            const pool = [...state.tasks.filter((item) => item.id !== draft.id), draft];
            const risk = analyzeTaskLoad(pool).byId.get(draft.id) || {};
            const messages = [];
            if (risk.critical) messages.push(['critical', 'Critical', 'Task ini masuk kategori critical/urgent/due dekat atau blocked.']);
            if (risk.clash) messages.push(['clash', 'Clash', `PIC memiliki overlap dengan ${risk.clashCount} task lain pada tanggal yang sama.`]);
            if (risk.overload) messages.push(['overload', 'Overload', `Beban PIC mencapai ${risk.maxDayLoad} task/hari atau ${risk.maxWeekLoad} task/minggu.`]);
            if (risk.canHold) messages.push(['hold', 'Can Hold', 'Task fleksibel ini aman menjadi kandidat hold jika ada urgent task.']);
            preview.hidden = false;
            preview.innerHTML = messages.length
                ? `<strong>Load warning</strong>${messages.map(([riskName,label,text]) => `<span data-risk="${riskName}"><b>${label}</b>${escapeHtml(text)}</span>`).join('')}`
                : '<strong>Load check</strong><span data-risk="clear"><b>Aman</b>Belum terdeteksi clash atau overload untuk PIC dan tanggal ini.</span>';
        };
        const syncDelegation = () => {
            if (!assignmentMode || !delegateField || !delegateUser) return;
            const delegated = assignmentMode.value === 'delegate';
            delegateField.hidden = !delegated;
            delegateUser.required = delegated;
            refreshKpiAssignment();
            renderLoadPreview();
        };
        priorityInput?.addEventListener('change', () => {
            if (priorityInput.value === 'urgent') {
                if (categoryInput) categoryInput.value = 'urgent';
                if (criticalInput) criticalInput.checked = true;
            }
            renderLoadPreview();
        });
        categoryInput?.addEventListener('change', () => {
            if (categoryInput.value === 'routine' && routineInput) routineInput.checked = true;
            if (categoryInput.value === 'urgent') {
                if (priorityInput) priorityInput.value = 'urgent';
                if (criticalInput) criticalInput.checked = true;
            }
            renderLoadPreview();
        });
        ['title','startDate','dueDate','status','isCritical'].forEach((name) => {
            dialog.querySelector(`[name="${name}"]`)?.addEventListener('input', renderLoadPreview);
            dialog.querySelector(`[name="${name}"]`)?.addEventListener('change', renderLoadPreview);
        });
        if (assignmentMode) {
            assignmentMode.addEventListener('change', syncDelegation);
            delegateUser?.addEventListener('change', () => { refreshKpiAssignment(); renderLoadPreview(); });
            syncDelegation();
        }
        renderLoadPreview();
    }

    function urgentTaskOptions(task) {
        const samePicActive = state.tasks.filter((row) =>
            row.id !== task.id &&
            row.picUserId === task.picUserId &&
            row.intakeStatus === 'approved' &&
            !['approved_done','cancelled','on_hold'].includes(row.status)
        );
        const urgentFirst = samePicActive.sort((left, right) => {
            const weight = { urgent: 0, high: 1, normal: 2, low: 3 };
            return (weight[left.priority] ?? 9) - (weight[right.priority] ?? 9) || left.title.localeCompare(right.title, 'id-ID');
        });
        return [{ id: '', title: 'Tidak dikaitkan ke task lain', priority: '', dueDate: '' }, ...urgentFirst]
            .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id ? `${item.priority.toUpperCase()} / ${item.title}${item.dueDate ? ` / Due ${formatDate(item.dueDate)}` : ''}` : item.title)}</option>`)
            .join('');
    }

    function holdUrgentTaskLabel(task) {
        const linked = state.tasks.find((row) => row.id === task.holdUrgentTaskId);
        return linked ? `${linked.title} / ${linked.picName || '-'} / ${statusLabels[linked.status] || linked.status}` : '';
    }

    function openHoldTaskForm(task) {
        const dialog = showDialog({
            eyebrow: 'Task Interruption',
            title: `Hold Task: ${task.title}`,
            body: `<div class="bimws-form-grid">
                <div class="bimws-field bimws-field-full"><label>Task yang ditunda</label><div class="bimws-source-summary"><strong>${escapeHtml(task.title)}</strong><br>${escapeHtml(task.projectName || 'Internal')} / ${escapeHtml(task.picName || '-')} / Progress ${task.progressPercent}%</div></div>
                <div class="bimws-field"><label>Task mendadak</label><select name="urgentTaskMode" id="hold-urgent-mode"><option value="existing">Pilih task urgent yang sudah ada</option><option value="create">Buat task urgent baru</option></select><small>Task baru otomatis masuk Task Scheduler sebagai prioritas Urgent.</small></div>
                <div class="bimws-field" id="hold-existing-urgent"><label>Task urgent existing</label><select name="urgentTaskId">${urgentTaskOptions(task)}</select><small>Opsional. Pilih task urgent/high milik PIC yang sama jika sudah dibuat.</small></div>
                <div class="bimws-field bimws-field-full" data-hold-urgent-create hidden><label>Task Urgent Baru</label><input name="urgentTitle" placeholder="Nama task urgent sisipan"><small>Task ini akan langsung dibuat dan didelegasikan ke PIC yang sama.</small></div>
                ${field('urgentProjectName','Project / Context Urgent',task.projectName||'',{placeholder:'Project/context task urgent',full:true})}
                ${field('urgentDueDate','Due Date Urgent','',{type:'date'})}
                ${field('urgentDescription','Deskripsi Task Urgent','',{type:'textarea',full:true,placeholder:'Instruksi singkat task mendadak yang harus segera dikerjakan.'})}
                ${field('reason','Alasan Hold','',{type:'textarea',full:true,required:true,placeholder:'Contoh: PIC dialihkan sementara untuk task urgent dari Kadiv.'})}
                ${field('resumeTargetDate','Rencana Start Again','',{type:'date'})}
                ${field('impactNote','Dampak / Catatan Due Date','',{type:'textarea',full:true,placeholder:'Catat apakah due date tetap atau perlu disesuaikan.'})}
            </div>`,
            submitLabel: 'Hold Task',
            onSubmit: async (formData) => {
                const payload = formJson(formData);
                let urgentTaskId = payload.urgentTaskId || '';
                if (payload.urgentTaskMode === 'create') {
                    const created = await api('/tasks', {
                        method: 'POST',
                        body: JSON.stringify({
                            periodMonth: state.period,
                            title: payload.urgentTitle,
                            projectName: payload.urgentProjectName || task.projectName || '',
                            taskType: 'support',
                            picUserId: task.picUserId,
                            startDate: dateKey(new Date()),
                            dueDate: payload.urgentDueDate || '',
                            priority: 'urgent',
                            description: payload.urgentDescription || `Task urgent sisipan yang menyebabkan hold pada task: ${task.title}`,
                            sourceType: 'task_interruption',
                            sourceId: task.id,
                            isRoutine: false
                        })
                    });
                    urgentTaskId = created.id;
                }
                await api(`/tasks/${task.id}/hold`, { method: 'POST', body: JSON.stringify({
                    urgentTaskId,
                    reason: payload.reason,
                    resumeTargetDate: payload.resumeTargetDate,
                    impactNote: payload.impactNote
                }) });
                toast(payload.urgentTaskMode === 'create' ? 'Task urgent dibuat dan task lama di-hold.' : 'Task di-hold dan tercatat di activity feed.');
                await loadTasks(true);
            }
        });
        const mode = dialog.querySelector('#hold-urgent-mode');
        const existing = dialog.querySelector('#hold-existing-urgent');
        const createFields = [...dialog.querySelectorAll('[data-hold-urgent-create], [name="urgentProjectName"], [name="urgentDueDate"], [name="urgentDescription"]')];
        const urgentTitle = dialog.querySelector('[name="urgentTitle"]');
        const urgentDueDate = dialog.querySelector('[name="urgentDueDate"]');
        const existingUrgent = dialog.querySelector('[name="urgentTaskId"]');
        const syncUrgentMode = () => {
            const creating = mode?.value === 'create';
            if (existing) existing.hidden = creating;
            if (existingUrgent) existingUrgent.disabled = creating;
            createFields.forEach((fieldElement) => {
                const wrapper = fieldElement.classList?.contains('bimws-field') ? fieldElement : fieldElement.closest('.bimws-field');
                if (wrapper) wrapper.hidden = !creating;
                fieldElement.disabled = !creating;
            });
            if (urgentTitle) {
                urgentTitle.required = creating;
                urgentTitle.disabled = !creating;
            }
            if (urgentDueDate) urgentDueDate.required = creating;
        };
        mode?.addEventListener('change', syncUrgentMode);
        syncUrgentMode();
    }

    function openResumeTaskForm(task) {
        showDialog({
            eyebrow: 'Task Interruption',
            title: `Start Again: ${task.title}`,
            body: `<div class="bimws-form-grid">
                <div class="bimws-field bimws-field-full"><label>Catatan Hold</label><div class="bimws-source-summary"><strong>${escapeHtml(task.holdReason || 'Task sedang On Hold')}</strong>${task.holdResumeTargetDate ? `<br>Target resume: ${formatDate(task.holdResumeTargetDate)}` : ''}${holdUrgentTaskLabel(task) ? `<br>Task urgent: ${escapeHtml(holdUrgentTaskLabel(task))}` : ''}</div></div>
                ${field('dueDate','Due Date Baru',task.dueDate ? String(task.dueDate).slice(0,10) : '',{type:'date',help:'Kosongkan atau biarkan sama jika target penyelesaian tidak berubah.'})}
                ${field('note','Catatan Start Again','',{type:'textarea',full:true,placeholder:'Contoh: Task urgent selesai, PIC kembali melanjutkan pekerjaan ini.'})}
            </div>`,
            submitLabel: 'Start Again',
            onSubmit: async (formData) => {
                await api(`/tasks/${task.id}/resume`, { method: 'POST', body: JSON.stringify(formJson(formData)) });
                toast('Task dimulai kembali.');
                await loadTasks(true);
            }
        });
    }

    function openTaskDetail(task) {
        showDialog({
            eyebrow: 'Task Scheduler', title: task.title,
            body: `<dl class="bimws-detail-grid">
                <div><dt>Project</dt><dd>${escapeHtml(task.projectName||'-')}</dd></div><div><dt>PIC</dt><dd>${escapeHtml(task.picName||'-')}</dd></div><div><dt>Owner</dt><dd>${escapeHtml(task.officialOwnerName)}</dd></div>
                <div><dt>Start</dt><dd>${formatDate(task.startDate)}</dd></div><div><dt>Due</dt><dd>${formatDate(task.dueDate)}</dd></div><div><dt>Priority</dt><dd>${escapeHtml(task.priority)}</dd></div>
                <div><dt>Register</dt><dd>${registerBadge(task.intakeStatus)}</dd></div><div><dt>Status</dt><dd>${badge(task.status)}</dd></div><div><dt>Progress</dt><dd>${task.progressPercent}%</dd></div>
                <div><dt>Penugasan</dt><dd>${task.delegatedByName ? `Delegasi oleh ${escapeHtml(task.delegatedByName)}${task.delegatedAt ? ` / ${formatDateTime(task.delegatedAt)}` : ''}` : 'Task langsung / usulan staff'}</dd></div>
                ${task.holdReason ? `<div><dt>Hold</dt><dd>${escapeHtml(task.holdByName || '-')} ${task.holdAt ? `/ ${formatDateTime(task.holdAt)}` : ''}</dd></div><div><dt>Target Resume</dt><dd>${formatDate(task.holdResumeTargetDate)}</dd></div><div><dt>Start Again</dt><dd>${task.resumedAt ? `${escapeHtml(task.resumedByName || '-')} / ${formatDateTime(task.resumedAt)}` : '-'}</dd></div>` : ''}
            </dl><div class="mt-3"><h3>Deskripsi</h3><p>${escapeHtml(task.description||'-')}</p></div>${task.holdReason?`<div class="mt-3"><h3>Catatan hold</h3><p>${escapeHtml(task.holdReason)}</p>${task.holdImpactNote?`<p><strong>Dampak:</strong> ${escapeHtml(task.holdImpactNote)}</p>`:''}${holdUrgentTaskLabel(task)?`<p><strong>Task urgent:</strong> ${escapeHtml(holdUrgentTaskLabel(task))}</p>`:''}${task.resumeNote?`<p><strong>Start again:</strong> ${escapeHtml(task.resumeNote)}</p>`:''}</div>`:''}${task.intakeReviewNote?`<div class="mt-3"><h3>Catatan register</h3><p>${escapeHtml(task.intakeReviewNote)}</p></div>`:''}${task.reviewNote?`<div class="mt-3"><h3>Catatan review</h3><p>${escapeHtml(task.reviewNote)}</p></div>`:''}`,
            onSubmit: null
        });
    }

    function reviewDialog(title, approveLabel, rejectLabel, handler) {
        showDialog({
            eyebrow:'Review Kepala Divisi', title,
            body:`<div class="bimws-form-grid">${field('note','Catatan review','',{type:'textarea',full:true,required:true})}</div>`,
            onSubmit:null,
            secondary:[
                {action:'reject',label:rejectLabel,className:'bimws-btn-secondary',handler:async(dialog,form)=>{try{await handler('reject',new FormData(form).get('note'));dialog.close();}catch(error){toast(error.message,true);}}},
                {action:'approve',label:approveLabel,className:'bimws-btn-primary',handler:async(dialog,form)=>{try{await handler('approve',new FormData(form).get('note'));dialog.close();}catch(error){toast(error.message,true);}}}
            ]
        });
    }

    function confirmAction({ title, message, confirmLabel = 'Lanjutkan', className = 'bimws-btn-primary', onConfirm }) {
        showDialog({
            eyebrow: 'Konfirmasi',
            title,
            body: `<p>${escapeHtml(message)}</p>`,
            onSubmit: null,
            secondary: [{
                action: 'confirm',
                label: confirmLabel,
                className,
                handler: async (dialog) => {
                    try {
                        await onConfirm();
                        dialog.close();
                    } catch (error) {
                        toast(error.message, true);
                    }
                }
            }]
        });
    }

    function classifyDemoTasks() {
        confirmAction({
            title: 'Tandai Dummy Task Sebagai Demo',
            message: `Sistem akan menandai dummy task seed pada ${formatMonth(state.period)} sebagai Demo. Task operasional biasa tidak dihapus.`,
            confirmLabel: 'Tandai Demo',
            onConfirm: async () => {
                const result = await api('/tasks/demo-classify', { method: 'POST', body: JSON.stringify({ period: state.period }) });
                toast(`${result.count || 0} task demo diklasifikasikan.`);
                await loadTasks(true);
            }
        });
    }

    function clearDemoTasks() {
        const demoCount = state.tasks.filter((task) => task.isDemo).length;
        if (!demoCount) {
            toast('Tidak ada demo task pada periode aktif.');
            return;
        }
        confirmAction({
            title: 'Hapus Semua Demo Task',
            message: `Hapus ${demoCount} demo task pada ${formatMonth(state.period)}? Task operasional non-demo tidak akan ikut terhapus.`,
            confirmLabel: 'Hapus Demo',
            className: 'bimws-btn-danger',
            onConfirm: async () => {
                const result = await api(`/tasks/demo?period=${encodeURIComponent(state.period)}`, { method: 'DELETE' });
                toast(`${result.count || 0} demo task dihapus.`);
                await loadTasks(true);
            }
        });
    }

    function markDemoTask(task) {
        confirmAction({
            title: 'Tandai Task Sebagai Demo',
            message: `Tandai "${task.title}" sebagai demo task? Setelah ditandai, task ini bisa dihapus permanen oleh Kadiv/Admin.`,
            confirmLabel: 'Tandai Demo',
            onConfirm: async () => {
                await api(`/tasks/${task.id}/demo`, { method: 'POST', body: JSON.stringify({ isDemo: true }) });
                toast('Task ditandai sebagai Demo.');
                await loadTasks(true);
            }
        });
    }

    function deleteDemoTask(task) {
        confirmAction({
            title: 'Hapus Demo Task',
            message: `Hapus permanen demo task "${task.title}"? Aksi ini hanya berlaku untuk task berlabel Demo.`,
            confirmLabel: 'Hapus Demo',
            className: 'bimws-btn-danger',
            onConfirm: async () => {
                await api(`/tasks/${task.id}`, { method: 'DELETE' });
                toast('Demo task dihapus.');
                await loadTasks(true);
            }
        });
    }

    function openCarryForward() {
        const [year,month]=state.period.split('-').map(Number);
        const sourceDate=new Date(year,month-2,1);
        const sourcePeriod=`${sourceDate.getFullYear()}-${String(sourceDate.getMonth()+1).padStart(2,'0')}`;
        showDialog({
            eyebrow:'Task Scheduler',title:'Carry Forward Outstanding',
            body:`<p>Salin seluruh outstanding task dari <strong>${formatMonth(sourcePeriod)}</strong> ke <strong>${formatMonth(state.period)}</strong>. Periode baru tetap kosong jika tidak ada outstanding.</p><div class="bimws-form-grid">${field('includeRoutine','Task rutin',false,{type:'checkbox',full:true,checkboxLabel:'Generate juga task rutin dari bulan sebelumnya'})}</div>`,
            submitLabel:'Carry Forward',
            onSubmit:async(formData)=>{const created=await api('/tasks/carry-forward',{method:'POST',body:JSON.stringify({sourcePeriod,targetPeriod:state.period,includeRoutine:formData.has('includeRoutine')})});toast(`${created.length} task dibawa ke periode aktif.`);await loadTasks(true);}
        });
    }

    async function loadWorklogSources() {
        if (!canWrite()) { state.worklogSources=[]; return; }
        state.worklogSources=await api(`/worklog-sources?period=${state.period}`);
        state.worklogSourcesPeriod=state.period;
    }

    async function loadWorklogs() {
        const requests=[api(`/worklogs?period=${state.period}`)];
        if(canWrite()) requests.push(api(`/worklog-sources?period=${state.period}`));
        const [data,sources=[]]=await Promise.all(requests);
        state.worklogs=Array.isArray(data)?data:data.worklogs||[];
        state.worklogEvents=Array.isArray(data)?[]:data.events||[];
        state.worklogSummary=Array.isArray(data)?{}:data.summary||{};
        state.worklogSources=sources;
        state.worklogSourcesPeriod=state.period;
        renderWorklogs();
    }

    function worklogSourceMeta(type) {
        return ({
            task:['Task','fa-list-check'],
            kpi_assignment:['KPI','fa-bullseye'],
            issue:['Issue','fa-triangle-exclamation'],
            meeting_action:['Action MoM','fa-people-group'],
            worklog:['Worklog','fa-clock-rotate-left'],
            meeting:['Risalah','fa-file-lines'],
            kpi_program:['Program KPI','fa-chart-line'],
            manual:['Manual','fa-pen-to-square']
        })[type]||[type||'Activity','fa-circle-dot'];
    }

    function renderWorklogEvent(row) {
        const [sourceLabel,sourceIcon]=worklogSourceMeta(row.sourceType);
        const classIcon=({planning:'fa-calendar-plus',execution:'fa-person-digging',verification:'fa-clipboard-check'})[row.activityClass]||sourceIcon;
        return `<article class="bimws-activity-item bimws-worklog-event">
            <span class="bimws-feed-icon" data-class="${escapeHtml(row.activityClass)}"><i class="fas ${classIcon}"></i></span>
            <div><h4>${escapeHtml(row.summary)}</h4><p>${escapeHtml(row.projectContext||row.picName||'Internal')}</p>
            <div class="bimws-worklog-event-meta"><span class="bimws-source-label"><i class="fas ${sourceIcon}"></i>${escapeHtml(sourceLabel)}</span>${badge(row.activityClass)}<span>${escapeHtml(row.actorName||'-')}</span><span>${formatDateTime(row.occurredAt)}</span>${row.countsAsWork?'<span>Draft tercatat</span>':''}</div></div>
        </article>`;
    }

    function renderWorklogs() {
        const query=document.getElementById('worklog-search').value.toLowerCase();
        const mine=document.getElementById('worklog-mine-only').checked;
        const rows=state.worklogs.filter((row)=>(!mine||row.isOwn)&&(!query||`${row.taskItem} ${row.picName} ${row.outputResult} ${row.workSummary} ${row.projectName}`.toLowerCase().includes(query)));
        const events=state.worklogEvents.filter((row)=>(!mine||isOwn(row.picUserId)||isOwn(row.actorUserId))&&(!query||`${row.summary} ${row.picName} ${row.actorName} ${row.projectContext}`.toLowerCase().includes(query)));
        const summary=state.worklogSummary;
        document.getElementById('worklog-summary').innerHTML=`
            <article class="bimws-metric" style="--metric-color:#087f8c"><p>Execution Event</p><strong>${Number(summary.executionEvents||0)}</strong><small>Update pelaksanaan periode ini</small></article>
            <article class="bimws-metric" style="--metric-color:#b54708"><p>Perlu Konfirmasi</p><strong>${Number(summary.autoDraft||0)}</strong><small>Draft otomatis PIC</small></article>
            <article class="bimws-metric" style="--metric-color:#16835f"><p>Worklog Confirmed</p><strong>${Number(summary.confirmed||0)}</strong><small>Masuk laporan resmi</small></article>
            <article class="bimws-metric" style="--metric-color:#667085"><p>Planning Event</p><strong>${Number(summary.planningEvents||0)}</strong><small>Tercatat, tidak dihitung kerja</small></article>`;
        document.getElementById('worklog-events').innerHTML=events.length?events.map(renderWorklogEvent).join(''):emptyState('Belum ada activity event pada periode ini.','fa-wave-square');
        document.getElementById('worklogs-table').innerHTML=rows.length?`<table class="bimws-table"><thead><tr><th>Tanggal</th><th>Aktivitas / PIC</th><th>Update & Output</th><th>Progress</th><th>Konfirmasi</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>${rows.map((row)=>{const [sourceLabel,sourceIcon]=worklogSourceMeta(row.sourceType);return `<tr class="${row.confirmationStatus==='auto_draft'?'bimws-worklog-draft':''}"><td>${formatDate(row.workDate)}</td><td><span class="bimws-table-title">${escapeHtml(row.taskItem)}</span><span class="bimws-table-sub">${escapeHtml(row.picName)} / ${escapeHtml(row.projectName||'Internal')}</span><span class="bimws-source-label"><i class="fas ${sourceIcon}"></i>${escapeHtml(sourceLabel)}${row.eventCount?` / ${row.eventCount} event`:''}</span></td><td>${escapeHtml(row.workSummary)}${row.outputResult?`<span class="bimws-table-sub"><strong>Output:</strong> ${escapeHtml(row.outputResult)}</span>`:''}${row.blocker?`<span class="bimws-table-sub text-danger"><strong>Blocker:</strong> ${escapeHtml(row.blocker)}</span>`:''}</td><td>${row.progressAfter==null?'-':`${row.progressAfter}%`}<span class="bimws-table-sub">${badge(row.taskStatus)}</span></td><td>${badge(row.confirmationStatus)}</td><td>${row.hoursSpent==null?'Private':`${row.hoursSpent} jam`}</td><td><div class="bimws-row-actions">${row.isOwn&&row.confirmationStatus==='auto_draft'?actionButton('fa-check','Konfirmasi worklog','worklog-confirm',row.id,'is-success'):''}${row.isOwn&&row.confirmationStatus==='confirmed'?actionButton('fa-pen','Edit worklog','worklog-edit',row.id):''}</div></td></tr>`;}).join('')}</tbody></table>`:emptyState('Belum ada daily worklog pada periode ini.','fa-clock-rotate-left');
    }

    async function openWorklogForm(worklog=null) {
        if(!worklog&&state.worklogSourcesPeriod!==state.period) await loadWorklogSources();
        const confirming=worklog?.confirmationStatus==='auto_draft';
        const existingSource=worklog&&worklog.sourceType!=='manual';
        const selectedRef=existingSource?`${worklog.sourceType}:${worklog.sourceId}`:'';
        const sourceOptions=state.worklogSources.map((source)=>{const [label]=worklogSourceMeta(source.sourceType);return `<option value="${escapeHtml(`${source.sourceType}:${source.id}`)}">${escapeHtml(label)} / ${escapeHtml(source.itemText)}</option>`;}).join('');
        const sourceControl=worklog
            ? `<div class="bimws-field bimws-field-full"><label>Sumber Aktivitas</label><div class="bimws-source-summary"><strong>${escapeHtml(worklogSourceMeta(worklog.sourceType)[0])}</strong> / ${escapeHtml(worklog.taskItem)}</div><input type="hidden" name="sourceRef" value="${escapeHtml(selectedRef||'manual')}"></div>`
            : `<div class="bimws-field bimws-field-full"><label>Sumber Aktivitas</label><select name="sourceRef" id="worklog-source-ref" required><option value="">Pilih sumber aktivitas...</option>${sourceOptions}<option value="manual">Aktivitas operasional lain (manual)</option></select><small>Pilih sumber resmi yang menjadi tanggung jawab Anda.</small></div>`;
        const dialog=showDialog({
            eyebrow:'Daily Worklog',title:confirming?'Konfirmasi Draft Worklog':worklog?'Edit Daily Worklog':'Tambah Update Kerja',
            body:`<div class="bimws-form-grid">
                ${sourceControl}
                ${field('workDate','Do Date',worklog?.workDate?String(worklog.workDate).slice(0,10):new Date().toISOString().slice(0,10),{type:'date',required:true,disabled:!!existingSource})}
                ${field('worklogType','Jenis Update',worklog?.worklogType||'progress_update',{type:'select',items:['progress_update','coordination','review','revision','monitoring','reporting','support','issue_followup','other'].map((value)=>({value,label:value.replaceAll('_',' ')}))})}
                <div class="bimws-field bimws-field-full" id="worklog-source-preview" ${worklog?'hidden':''}><label>Konteks Terpilih</label><div class="bimws-source-summary">Pilih sumber untuk melihat konteks.</div></div>
                <div class="bimws-field bimws-field-full" data-worklog-manual ${worklog?.sourceType==='manual'?'':'hidden'}><label>Item Aktivitas</label><input name="taskItem" value="${escapeHtml(worklog?.sourceType==='manual'?worklog.taskItem:'')}"></div>
                <div class="bimws-field" data-worklog-manual ${worklog?.sourceType==='manual'?'':'hidden'}><label>Project / Context</label><input name="projectName" value="${escapeHtml(worklog?.sourceType==='manual'?worklog.projectName:'')}"></div>
                <div class="bimws-field" data-worklog-task ${worklog?.sourceType==='task'?'':'hidden'}><label>Status Task</label><select name="taskStatus">${taskStatusItems().map((item)=>`<option value="${item.value}" ${item.value===(worklog?.taskStatus||'in_progress')?'selected':''}>${escapeHtml(item.label)}</option>`).join('')}</select></div>
                <div class="bimws-field" data-worklog-progress ${worklog?.sourceType==='manual'?'hidden':''}><label>Progress Setelah Update (%)</label><input type="number" name="progressPercent" min="0" max="100" step="1" value="${worklog?.progressAfter??''}"></div>
                ${field('hoursSpent','Durasi Pribadi (jam)',worklog?.hoursSpent??'',{type:'number',min:0,max:24,step:'0.25',required:true,help:'Hanya terlihat oleh Anda.'})}
                ${field('workSummary','Ringkasan Pekerjaan',worklog?.workSummary||'',{type:'textarea',required:true,full:true})}
                ${field('outputResult','Output / Result',worklog?.outputResult||'',{type:'textarea',full:true})}
                ${field('blocker','Blocker',worklog?.blocker||'',{type:'textarea'})}
                ${field('nextAction','Next Action',worklog?.nextAction||'',{type:'textarea'})}
                ${field('evidenceLink','Evidence Link',worklog?.evidenceLink||'',{type:'url',full:true})}
                <div class="bimws-field bimws-field-full" data-worklog-manual ${worklog?.sourceType==='manual'?'':'hidden'}><label>Alasan / Konteks Operasional</label><textarea name="remarks">${escapeHtml(worklog?.sourceType==='manual'?worklog.remarks:'')}</textarea><small>Wajib untuk aktivitas yang tidak berasal dari modul workspace.</small></div>
            </div>`,
            submitLabel:confirming?'Konfirmasi Worklog':worklog?'Simpan Perubahan':'Konfirmasi Update',
            onSubmit:async(formData)=>{
                const payload=formJson(formData);
                const sourceRef=payload.sourceRef||selectedRef||'manual';
                if(sourceRef==='manual'){payload.sourceType='manual';payload.sourceId='';}else{const separator=sourceRef.indexOf(':');payload.sourceType=sourceRef.slice(0,separator);payload.sourceId=sourceRef.slice(separator+1);}
                if(confirming)await api(`/worklogs/${worklog.id}/confirm`,{method:'POST',body:JSON.stringify(payload)});
                else if(worklog)await api(`/worklogs/${worklog.id}`,{method:'PUT',body:JSON.stringify(payload)});
                else await api('/worklogs',{method:'POST',body:JSON.stringify(payload)});
                toast(confirming?'Worklog dikonfirmasi.':'Worklog disimpan.');await loadWorklogs(true);
            }
        });
        const sourceSelect=dialog.querySelector('#worklog-source-ref');
        if(sourceSelect){
            const syncSource=()=>{
                const ref=sourceSelect.value;
                const manual=ref==='manual';
                const separator=ref.indexOf(':');
                const source=separator>0?state.worklogSources.find((item)=>item.sourceType===ref.slice(0,separator)&&item.id===ref.slice(separator+1)):null;
                dialog.querySelectorAll('[data-worklog-manual]').forEach((element)=>element.hidden=!manual);
                dialog.querySelectorAll('[data-worklog-task]').forEach((element)=>element.hidden=source?.sourceType!=='task');
                dialog.querySelectorAll('[data-worklog-progress]').forEach((element)=>element.hidden=manual||!source);
                const preview=dialog.querySelector('#worklog-source-preview');
                preview.hidden=!source;
                if(source)preview.querySelector('.bimws-source-summary').innerHTML=`<strong>${escapeHtml(source.itemText)}</strong><br>${escapeHtml(source.projectContext||'Internal')} / ${escapeHtml(statusLabels[source.status]||source.status)}`;
                dialog.querySelector('[name="taskItem"]').required=manual;
                dialog.querySelector('[name="remarks"]').required=manual;
            };
            sourceSelect.onchange=syncSource;
            syncSource();
        }
    }

    async function loadMeetings(){
        const [meetings, legacy] = await Promise.all([
            api(`/meetings?period=${state.period}`),
            api(`/legacy-risalah?period=${state.period}`)
        ]);
        state.meetings=meetings;
        state.legacyMeetings=legacy.files||[];
        renderMeetings();
    }

    function meetingField(row, snakeName, camelName, fallback = '') {
        return row?.[snakeName] ?? row?.[camelName] ?? fallback;
    }

    function meetingScopeLabel(scope){
        if(scope==='proyek')return 'Project';
        if(scope==='other')return 'External';
        return 'Divisi BIM HO';
    }

    function meetingGroupLabel(row){
        const scope=meetingField(row,'scope_type','scopeType','kantor');
        const project=String(meetingField(row,'project_name','projectName','')).trim();
        if(scope==='proyek')return project||'Project - Tanpa Nama Project';
        if(scope==='other')return project||'External';
        return 'Divisi BIM HO';
    }

    function legacyReaderUrl(row) {
        const params=new URLSearchParams();
        params.set('file', row.pdfUrl);
        params.set('return', `${location.pathname}${location.search}`);
        return `/pages/pdf-viewer.html?${params.toString()}`;
    }

    function renderMeetings(){
        const target=document.getElementById('meetings-table');
        const allMeetings=[...state.meetings,...state.legacyMeetings];
        if(!allMeetings.length){target.innerHTML=emptyState('Belum ada Risalah Rapat pada periode ini.','fa-people-group');return;}
        const groupOrder=['Divisi BIM HO','Project','External'];
        const groups=new Map();
        allMeetings.forEach((row)=>{
            const scope=meetingScopeLabel(meetingField(row,'scope_type','scopeType','kantor'));
            const label=meetingGroupLabel(row);
            const key=`${scope}::${label}`;
            if(!groups.has(key))groups.set(key,{scope,label,items:[]});
            groups.get(key).items.push(row);
        });
        const sortedGroups=[...groups.values()].sort((a,b)=>{
            const scopeDiff=groupOrder.indexOf(a.scope)-groupOrder.indexOf(b.scope);
            return scopeDiff||a.label.localeCompare(b.label,'id-ID');
        });
        sortedGroups.forEach((group)=>group.items.sort((a,b)=>{
            const aDate=meetingField(a,'meeting_date','meetingDate','');
            const bDate=meetingField(b,'meeting_date','meetingDate','');
            return String(bDate).localeCompare(String(aDate));
        }));
        target.innerHTML=`<div class="bimws-meeting-groups">${sortedGroups.map((group)=>`
            <section class="bimws-meeting-group">
                <header>
                    <div><span>${escapeHtml(group.scope)}</span><h4>${escapeHtml(group.label)}</h4></div>
                    <strong>${group.items.length} risalah</strong>
                </header>
                <div class="bimws-meeting-card-grid">
                    ${group.items.map((row)=>{
                        const legacy=row.sourceType==='legacy';
                        const scopeValue=meetingField(row,'scope_type','scopeType','kantor');
                        const status=meetingField(row,'status','status','');
                        const meetingNo=meetingField(row,'meeting_no','meetingNo','')||'Arsip Risalah';
                        const meetingDate=meetingField(row,'meeting_date','meetingDate','');
                        const place=meetingField(row,'place','place',legacy?'PDF Archive':'-');
                        const subject=meetingField(row,'subject','subject','');
                        const openActions=Number(meetingField(row,'open_actions','openActions',0)||0);
                        const creator=meetingField(row,'created_by_name_snapshot','createdByName','-');
                        return `<article class="bimws-meeting-card" data-status="${escapeHtml(status)}">
                            <div class="bimws-meeting-card-top">
                                <span class="bimws-meeting-no">${escapeHtml(meetingNo)}</span>
                                ${badge(status)}
                            </div>
                            <h5>${escapeHtml(subject)}</h5>
                            <dl>
                                <div><dt>Tanggal</dt><dd>${formatDate(meetingDate)}</dd></div>
                                <div><dt>${legacy?'File':'Tempat'}</dt><dd>${legacy?`PDF ${row.fileSizeMb||0} MB`:escapeHtml(place||'-')}</dd></div>
                                <div><dt>Konteks</dt><dd>${escapeHtml(meetingScopeLabel(scopeValue))}</dd></div>
                                <div><dt>${legacy?'Sumber':'Open Action'}</dt><dd>${legacy?'Legacy':openActions}</dd></div>
                            </dl>
                            <div class="bimws-meeting-card-foot">
                                <span>${escapeHtml(creator)}</span>
                                <div class="bimws-row-actions">
                                    ${legacy?`<a class="bimws-icon-btn" href="${escapeHtml(legacyReaderUrl(row))}" target="_blank" rel="noopener" title="Buka PDF" aria-label="Buka PDF"><i class="fas fa-file-pdf"></i></a>`:actionButton('fa-eye','Buka Risalah','meeting-view',row.id)}
                                    ${!legacy&&status==='draft'&&(isOwn(row.created_by_user_id)||isDivisionHead())?actionButton('fa-pen','Edit draft','meeting-edit',row.id):''}
                                </div>
                            </div>
                        </article>`;
                    }).join('')}
                </div>
            </section>
        `).join('')}</div>`;
    }

    function openMeetingForm(meeting=null){
        showDialog({
            eyebrow:'FRM.NKE.01.06',title:meeting?'Edit Draft Risalah':'Risalah Rapat Baru',
            body:`<div class="bimws-form-grid">
                ${field('subject','Perihal',meeting?.subject||'',{required:true,full:true})}
                ${field('scopeType','Kantor / Proyek',meeting?.scope_type||'kantor',{type:'select',items:[{value:'kantor',label:'Kantor Pusat'},{value:'proyek',label:'Proyek'},{value:'other',label:'Lainnya'}]})}
                ${field('projectName','Nama Project / Context',meeting?.project_name||'')}
                ${field('meetingDate','Tanggal',meeting?.meeting_date?String(meeting.meeting_date).slice(0,10):new Date().toISOString().slice(0,10),{type:'date',required:true})}
                ${field('place','Tempat',meeting?.place||'',{required:true})}
                ${field('startTime','Waktu Mulai',meeting?.start_time||'',{type:'time'})}
                ${field('endTime','Waktu Selesai',meeting?.end_time||'',{type:'time'})}
                ${field('reportedByName','Dilaporkan Oleh',meeting?.reported_by_name||state.access.user.name)}
                ${field('reportedByPosition','Jabatan Pelapor',meeting?.reported_by_position||'')}
                ${field('acknowledgedByName','Mengetahui',meeting?.acknowledged_by_name||'')}
                ${field('acknowledgedByPosition','Jabatan',meeting?.acknowledged_by_position||'')}
                ${field('referenceMemoNo','Referensi Memo/Surat',meeting?.reference_memo_no||'')}
                ${field('referenceAgendaNo','Agenda No.',meeting?.reference_agenda_no||'')}
                ${field('referenceArchiveNo','Arsip No.',meeting?.reference_archive_no||'')}
                ${!meeting?field('attendeesText','Peserta Rapat','',{type:'textarea',full:true,placeholder:'Satu peserta per baris. Contoh: Aji Sadara | AS | present'}) : ''}
                ${!meeting?field('carryForward','Outstanding action',true,{type:'checkbox',full:true,checkboxLabel:'Munculkan action risalah sebelumnya yang belum closed'}) : ''}
            </div>`,
            submitLabel:meeting?'Simpan Draft':'Buat Draft Risalah',
            onSubmit:async(formData)=>{
                const payload=formJson(formData,['carryForward']);
                if(payload.attendeesText){
                    payload.attendees=payload.attendeesText.split(/\r?\n/).map((line)=>{
                        const [name,initial,status]=line.split('|').map((part)=>part.trim());
                        return{name,initial,attendanceStatus:status||'present'};
                    }).filter((item)=>item.name);
                }
                const saved=meeting
                    ? await api(`/meetings/${meeting.id}`,{method:'PUT',body:JSON.stringify(payload)})
                    : await api('/meetings',{method:'POST',body:JSON.stringify(payload)});
                toast('Risalah disimpan.');
                await loadMeetings(true);
                if(!meeting&&saved?.id)setTimeout(()=>openMeetingDetail(saved.id),0);
            }
        });
    }

    async function openMeetingDetail(id){
        const meeting=await api(`/meetings/${id}`);
        const actions=meeting.actions||[];
        const attendees=meeting.attendees||[];
        const actionRows=actions.length?`<table class="bimws-table"><thead><tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${actions.map((action)=>`<tr><td>${escapeHtml(action.description)}${action.section_type==='carried_forward'?'<span class="bimws-table-sub">Carry-forward</span>':''}</td><td>${escapeHtml(action.action_owner_name||'-')}</td><td>${formatDate(action.planned_due_date)}</td><td>${badge(action.status)}</td><td><div class="bimws-row-actions">${(isOwn(action.action_owner_user_id)||isDivisionHead())?actionButton('fa-pen','Update action','meeting-action-update',action.id):''}${!action.created_task_id&&canWrite()?actionButton('fa-list-check','Buat task','meeting-action-task',action.id):''}</div></td></tr>`).join('')}</tbody></table>`:emptyState('Belum ada action item.');
        showDialog({
            eyebrow:meeting.meeting_no,title:meeting.subject,
            body:`<dl class="bimws-detail-grid"><div><dt>Tanggal</dt><dd>${formatDate(meeting.meeting_date)}</dd></div><div><dt>Tempat</dt><dd>${escapeHtml(meeting.place||'-')}</dd></div><div><dt>Status</dt><dd>${badge(meeting.status)}</dd></div></dl><div class="mt-3"><h3>Peserta</h3><p>${attendees.length?attendees.map((item)=>`${escapeHtml(item.name)} (${escapeHtml(item.attendance_status)})`).join(', '):'-'}</p></div><div class="mt-3"><div class="bimws-panel-head"><div><h3>Tindak Lanjut</h3></div>${canWrite()&&meeting.status!=='closed'?`<button type="button" class="bimws-btn bimws-btn-secondary" data-meeting-add-action="${meeting.id}"><i class="fas fa-plus"></i>Action</button>`:''}</div><div class="bimws-table-wrap">${actionRows}</div></div>`,
            onSubmit:null,
            secondary:[
                {action:'print',label:'Print',handler:()=>printMeeting(meeting)},
                ...(isDivisionHead()&&meeting.status==='draft'?[{action:'issue',label:'Issue Risalah',className:'bimws-btn-primary',handler:async(dialog)=>{await api(`/meetings/${meeting.id}/status`,{method:'POST',body:JSON.stringify({status:'issued'})});dialog.close();toast('Risalah diterbitkan.');await loadMeetings(true);}}]:[]),
                ...(isDivisionHead()&&meeting.status==='issued'?[{action:'close',label:'Close Risalah',className:'bimws-btn-primary',handler:async(dialog)=>{await api(`/meetings/${meeting.id}/status`,{method:'POST',body:JSON.stringify({status:'closed'})});dialog.close();toast('Risalah ditutup.');await loadMeetings(true);}}]:[])
            ]
        });
        const addButton=document.querySelector(`[data-meeting-add-action="${meeting.id}"]`);
        if(addButton)addButton.onclick=()=>openMeetingActionForm(meeting.id);
    }

    function openMeetingActionForm(meetingId){
        showDialog({eyebrow:'Risalah Rapat',title:'Action Item Baru',body:`<div class="bimws-form-grid">${field('description','Tindak Lanjut','',{type:'textarea',full:true,required:true})}<div class="bimws-field"><label>Owner</label><select name="ownerUserId">${userOptions()}</select></div>${field('dueDate','Rencana Selesai','',{type:'date'})}${field('evidenceLink','Evidence Link','',{type:'url',full:true})}</div>`,submitLabel:'Tambah Action',onSubmit:async(formData)=>{const payload=formJson(formData);const user=state.users.find((item)=>String(item.id)===String(payload.ownerUserId));payload.ownerName=user?.username||'';await api(`/meetings/${meetingId}/actions`,{method:'POST',body:JSON.stringify(payload)});toast('Action item ditambahkan.');await loadMeetings(true);}});
    }

    function printMeeting(meeting){
        const popup=window.open('','_blank','noopener,noreferrer');
        if(!popup)return toast('Popup diblokir browser.',true);
        const attendees=(meeting.attendees||[]).map((item)=>`${escapeHtml(item.name)} (${escapeHtml(item.initial||'-')})`).join(', ');
        const actions=(meeting.actions||[]).map((action,index)=>`<tr><td>${index+1}</td><td>${escapeHtml(action.description)}</td><td>${escapeHtml(action.action_owner_name||'')}</td><td>${formatDate(action.planned_due_date,'')}</td><td>${escapeHtml(statusLabels[action.status]||action.status)}</td></tr>`).join('');
        popup.document.write(`<!doctype html><html><head><title>${escapeHtml(meeting.meeting_no)}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0}.header{border:2px solid #111;padding:14px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:14px}.meta div{border:1px solid #777;padding:7px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #444;padding:7px;text-align:left;font-size:12px}th{background:#eee}.foot{margin-top:16px;font-size:11px}</style></head><body><div class="header"><h1>RISALAH RAPAT</h1><strong>DOK.NO.: FRM.NKE.01.06 / REVISI A</strong><div class="meta"><div>No: ${escapeHtml(meeting.meeting_no)}</div><div>Perihal: ${escapeHtml(meeting.subject)}</div><div>Tanggal: ${formatDate(meeting.meeting_date)}</div><div>Tempat: ${escapeHtml(meeting.place||'')}</div><div>Dilaporkan: ${escapeHtml(meeting.reported_by_name||'')}</div><div>Mengetahui: ${escapeHtml(meeting.acknowledged_by_name||'')}</div></div></div><h2>Peserta Rapat</h2><p>${attendees||'-'}</p><h2>Tindak Lanjut Hasil Rapat</h2><table><thead><tr><th>No</th><th>Tindakan / Action</th><th>Oleh</th><th>Rencana Selesai</th><th>Review</th></tr></thead><tbody>${actions||'<tr><td colspan="5">Belum ada action item.</td></tr>'}</tbody></table><p class="foot">(c) PT NUSA KONSTRUKSI ENJINIRING Tbk / FRM.NKE.01.06</p><script>window.onload=()=>window.print()<\/script></body></html>`);popup.document.close();
    }

    async function loadIssues(){state.issues=await api(`/issues?period=${state.period}`);renderIssues();}

    function renderIssues(){
        const query=document.getElementById('issue-search').value.toLowerCase();const status=document.getElementById('issue-status-filter').value;
        const rows=state.issues.filter((row)=>(!query||`${row.title} ${row.projectContext} ${row.reportedByName}`.toLowerCase().includes(query))&&(!status||row.status===status));
        document.getElementById('issues-table').innerHTML=rows.length?`<table class="bimws-table"><thead><tr><th>Issue</th><th>Reporter / Owner</th><th>Severity</th><th>Due</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><span class="bimws-table-title">${escapeHtml(row.title)}</span><span class="bimws-table-sub">${escapeHtml(row.projectContext||'Internal')} / ${escapeHtml(row.issueType.replaceAll('_',' '))}</span></td><td>${escapeHtml(row.reportedByName)}<span class="bimws-table-sub">Owner: ${escapeHtml(row.ownerName||'-')}</span></td><td>${badge(row.severity)}</td><td>${formatDate(row.dueDate)}</td><td>${badge(row.status)}</td><td><div class="bimws-row-actions">${issueActions(row)}</div></td></tr>`).join('')}</tbody></table>`:emptyState('Tidak ada issue yang sesuai filter.','fa-triangle-exclamation');
    }

    function issueActions(issue){const buttons=[actionButton('fa-eye','Lihat issue','issue-view',issue.id)];const own=isOwn(issue.reportedByUserId)||isOwn(issue.ownerUserId);if((own||isDivisionHead())&&['draft','accepted','action_required'].includes(issue.status))buttons.push(actionButton('fa-pen','Edit issue','issue-edit',issue.id));if(isOwn(issue.reportedByUserId)&&issue.status==='draft')buttons.push(actionButton('fa-paper-plane','Submit issue','issue-submit',issue.id));if(isDivisionHead()&&issue.status==='submitted')buttons.push(actionButton('fa-user-check','Review issue','issue-review',issue.id));if(own&&['accepted','action_required'].includes(issue.status))buttons.push(actionButton('fa-flag-checkered','Request closure','issue-close-request',issue.id));if(isDivisionHead()&&issue.status==='resolved_pending_approval')buttons.push(actionButton('fa-check','Review closure','issue-close-review',issue.id));if(!issue.createdTaskId&&['accepted','action_required'].includes(issue.status)&&canWrite())buttons.push(actionButton('fa-list-check','Buat task','issue-task',issue.id));return buttons.join('');}

    function openIssueForm(issue=null){showDialog({eyebrow:'Issue Register',title:issue?'Edit Issue':'Issue Baru',body:`<div class="bimws-form-grid">${field('title','Issue Title',issue?.title||'',{required:true,full:true})}${field('issueDate','Issue Date',issue?.issueDate?String(issue.issueDate).slice(0,10):new Date().toISOString().slice(0,10),{type:'date',required:true})}${field('issueType','Issue Type',issue?.issueType||'internal_issue',{type:'select',items:['internal_issue','coordination_issue','model_issue','data_issue','drawing_issue','workflow_issue','resource_issue','risk_note','other'].map((value)=>({value,label:value.replaceAll('_',' ')}))})}${field('projectContext','Project / Context',issue?.projectContext||'')}${field('severity','Severity',issue?.severity||'medium',{type:'select',items:['low','medium','high','critical'].map((value)=>({value,label:value[0].toUpperCase()+value.slice(1)}))})}<div class="bimws-field"><label>Owner (optional)</label><select name="ownerUserId">${userOptions(issue?.ownerUserId)}</select></div>${field('dueDate','Due Date',issue?.dueDate?String(issue.dueDate).slice(0,10):'',{type:'date'})}${field('description','Description',issue?.description||'',{type:'textarea',full:true,required:true})}${field('impactNote','Impact Note',issue?.impactNote||'',{type:'textarea'})}${field('actionNote','Action Note',issue?.actionNote||'',{type:'textarea'})}${field('mitigationNote','Mitigation / Escalation Note',issue?.mitigationNote||'',{type:'textarea',full:true})}${field('evidenceLink','Evidence Link',issue?.evidenceLink||'',{type:'url',full:true})}</div>`,submitLabel:issue?'Simpan Perubahan':'Simpan Draft Issue',onSubmit:async(formData)=>{const payload=formJson(formData);const owner=state.users.find((item)=>String(item.id)===String(payload.ownerUserId));payload.ownerName=owner?.username||'';if(issue)await api(`/issues/${issue.id}`,{method:'PUT',body:JSON.stringify(payload)});else await api('/issues',{method:'POST',body:JSON.stringify(payload)});toast('Issue disimpan.');await loadIssues(true);}});}

    function openIssueDetail(issue){showDialog({eyebrow:'Issue Register',title:issue.title,body:`<dl class="bimws-detail-grid"><div><dt>Reporter</dt><dd>${escapeHtml(issue.reportedByName)}</dd></div><div><dt>Owner</dt><dd>${escapeHtml(issue.ownerName||'-')}</dd></div><div><dt>Status</dt><dd>${badge(issue.status)}</dd></div><div><dt>Severity</dt><dd>${badge(issue.severity)}</dd></div><div><dt>Due</dt><dd>${formatDate(issue.dueDate)}</dd></div><div><dt>Project</dt><dd>${escapeHtml(issue.projectContext||'-')}</dd></div></dl><div class="mt-3"><h3>Deskripsi</h3><p>${escapeHtml(issue.description)}</p></div>${issue.impactNote?`<div><h3>Impact</h3><p>${escapeHtml(issue.impactNote)}</p></div>`:''}${issue.actionNote?`<div><h3>Action</h3><p>${escapeHtml(issue.actionNote)}</p></div>`:''}${issue.resolutionNote?`<div><h3>Resolution</h3><p>${escapeHtml(issue.resolutionNote)}</p></div>`:''}`,onSubmit:null});}

    async function loadKpi(force=false){
        const year=state.period.slice(0,4);
        if(force||!state.kpi||state.kpiYear!==year){
            state.kpi=await api(`/kpi?year=${year}`);
            state.kpiYear=year;
        }
        renderKpi();
    }

    function kpiTarget(item){
        const value=item.targetUnit==='percent'?`${Math.round(item.targetValue*100)}%`:String(item.targetValue);
        return `${item.targetOperator||'>='} ${value}`;
    }

    function kpiRelation(type){
        const labels={official:'Official',direct:'Direct',scoped_rollup:'Scoped Rollup',contribution:'Contribution'};
        return `<span class="bimws-kpi-relation" data-relation="${escapeHtml(type)}">${escapeHtml(labels[type]||type)}</span>`;
    }

    function kpiAggregation(method){
        return ({ratio_of_sums:'Ratio of sums',average_components:'Average components',latest_checkpoint:'Latest checkpoint',average_period_scores:'Average period scores',cumulative_count:'Cumulative YTD'})[method]||method;
    }

    function kpiTable(card,isDivision=false){
        if(!card?.indicators?.length)return emptyState('Scorecard belum dikonfigurasi.','fa-bullseye');
        return `<div class="bimws-table-wrap"><table class="bimws-table bimws-kpi-table"><thead><tr><th>KPI</th>${isDivision?'<th>Program / Relasi</th>':''}<th>Formula Pengukuran</th><th>Target</th><th>Bobot</th></tr></thead><tbody>${card.indicators.map((item)=>`<tr><td><span class="bimws-kpi-code">${escapeHtml(item.code)}</span><span class="bimws-table-title">${escapeHtml(item.name)}</span><span class="bimws-table-sub">${escapeHtml(item.perspectiveName)}${isDivision&&item.parentIndicatorName?` / Induk: ${escapeHtml(item.parentIndicatorName)}`:''}</span></td>${isDivision?`<td><strong>${escapeHtml(item.programName||'-')}</strong><span class="bimws-table-sub">${kpiRelation(item.relationType)}</span></td>`:''}<td><code class="bimws-kpi-formula">${escapeHtml(item.measurementFormula)}</code><span class="bimws-table-sub">Achievement: ${escapeHtml(item.achievementFormula)}</span><span class="bimws-table-sub">YTD: ${escapeHtml(kpiAggregation(item.aggregationMethod))}</span></td><td><strong>${escapeHtml(kpiTarget(item))}</strong></td><td><strong>${Math.round(item.weight*100)}%</strong></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="${isDivision?4:3}">Total bobot</td><td><strong>${Math.round(card.totalWeight*100)}%</strong></td></tr></tfoot></table></div>`;
    }

    function renderKpiOverview(data){
        const department=data.scorecards?.department;
        const division=data.scorecards?.division;
        if(!department&&!division)return emptyState(`Belum ada siklus KPI aktif untuk ${data.year}.`,'fa-bullseye');
        const contract=data.calculationContract;
        return `<div class="bimws-kpi-overview"><div class="bimws-kpi-summary"><div><p>KPI Departemen</p><strong>${department?.indicators.length||0}</strong><small>Departemen Engineering</small></div><div><p>KPI Divisi</p><strong>${division?.indicators.length||0}</strong><small>Turunan Divisi BIM</small></div><div><p>Total Bobot</p><strong>${Math.round((division?.totalWeight||0)*100)}%</strong><small>Scorecard Divisi BIM</small></div><div><p>Achievement Maks.</p><strong>${contract.maxAchievementPercent}%</strong><small>Berlaku per indikator</small></div></div><div class="bimws-kpi-contract"><h4>Kontrak Perhitungan</h4><dl><div><dt>Achievement</dt><dd>${escapeHtml(contract.achievement)}</dd></div><div><dt>Weighted Score</dt><dd>${escapeHtml(contract.weightedScore)}</dd></div><div><dt>Pembagi nol</dt><dd>${escapeHtml(contract.zeroDenominator)}</dd></div><div><dt>KPI Individu</dt><dd>KPI Divisi -> Program -> Komitmen Staff -> Task -> Actual terverifikasi.</dd></div></dl></div></div>`;
    }

    function kpiValue(value,unit){return value==null?'-':`${Number(value).toLocaleString('id-ID',{maximumFractionDigits:2})} ${escapeHtml(unit||'')}`;}
    function kpiPercent(value){return `${Math.round(Number(value||0)*100)}%`;}
    function kpiMeasurementItems(){return [{value:'quantity',label:'Quantity'},{value:'milestone',label:'Milestone'},{value:'ratio',label:'Ratio'},{value:'quality_acceptance',label:'Quality Acceptance'},{value:'sla',label:'SLA'}];}
    function safeExternalLink(value){try{const url=new URL(value,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:'#';}catch(_){return '#';}}

    function openKpiProgramForm(program){
        showDialog({eyebrow:'KPI Program',title:program.name,body:`<div class="bimws-form-grid">${field('targetValue','Target Operasional',program.targetValue??'',{type:'number',min:0.0001,step:'0.01',required:true})}${field('targetUnit','Unit',program.targetUnit,{required:true})}${field('availabilityStatus','Staff Claim',program.availabilityStatus,{type:'select',items:[{value:'open',label:'Open'},{value:'closed',label:'Closed'}]})}</div>`,submitLabel:'Simpan Target',onSubmit:async(formData)=>{await api(`/kpi/programs/${program.id}`,{method:'PUT',body:JSON.stringify(formJson(formData))});toast('Konfigurasi program disimpan.');await loadKpi(true);}});
    }

    function openKpiAssignmentForm(program){
        const manager=isKpiManager();
        const staffField=manager?`<div class="bimws-field"><label>Staff BIM</label><select name="staffUserId" required>${staffUserOptions()}</select></div>`:'';
        const programTargetField=manager?field('programTargetValue','Target Program Divisi',program.targetValue??'',{type:'number',min:0.0001,step:'0.01',required:true}):'';
        showDialog({eyebrow:manager?'Delegasi KPI':'Take Program',title:program.name,body:`<div class="bimws-form-grid">${staffField}${programTargetField}${field('title','Komitmen / Program Personal','',{required:true,full:true})}${field('measurementType','Measurement',program.allocationMode==='milestone'?'milestone':'quantity',{type:'select',items:kpiMeasurementItems()})}${field('targetValue','Target Kontribusi Staff','',{type:'number',min:0.0001,step:'0.01',required:true})}${field('targetUnit','Unit',program.targetUnit,{required:true})}${field('proposedWeight','Bobot (%)',Math.round(program.indicatorWeight*100),{type:'number',min:0.01,max:100,step:'0.01',required:true})}${field('dueDate','Due Date','',{type:'date'})}${field('expectedEvidence','Expected Evidence','',{type:'textarea',full:true})}</div>`,submitLabel:manager?'Delegasikan':'Ajukan Kontribusi',onSubmit:async(formData)=>{const payload=formJson(formData);if(manager){await api(`/kpi/programs/${program.id}`,{method:'PUT',body:JSON.stringify({targetValue:payload.programTargetValue,targetUnit:payload.targetUnit,availabilityStatus:program.availabilityStatus})});}delete payload.programTargetValue;payload.programId=program.id;payload.proposedWeight=Number(payload.proposedWeight)/100;await api('/kpi/assignments',{method:'POST',body:JSON.stringify(payload)});toast(manager?'Kontribusi KPI didelegasikan.':'Kontribusi KPI diajukan.');await loadKpi(true);}});
    }

    function openKpiRevisionForm(assignment){showDialog({eyebrow:'Revisi KPI Individu',title:assignment.programName,body:`<div class="bimws-form-grid">${field('title','Komitmen / Program Personal',assignment.title,{required:true,full:true})}${field('measurementType','Measurement',assignment.measurementType,{type:'select',items:kpiMeasurementItems()})}${field('targetValue','Target Kontribusi',assignment.targetValue,{type:'number',min:0.0001,step:'0.01',required:true})}${field('targetUnit','Unit',assignment.targetUnit,{required:true})}${field('proposedWeight','Bobot (%)',Math.round(assignment.proposedWeight*100),{type:'number',min:0.01,max:100,step:'0.01',required:true})}${field('dueDate','Due Date',assignment.dueDate?String(assignment.dueDate).slice(0,10):'',{type:'date'})}${field('expectedEvidence','Expected Evidence',assignment.expectedEvidence,{type:'textarea',full:true})}${assignment.reviewNote?`<div class="bimws-field bimws-field-full"><label>Catatan Review</label><p>${escapeHtml(assignment.reviewNote)}</p></div>`:''}</div>`,submitLabel:'Ajukan Ulang',onSubmit:async(formData)=>{const payload=formJson(formData);payload.proposedWeight=Number(payload.proposedWeight)/100;await api(`/kpi/assignments/${assignment.id}`,{method:'PUT',body:JSON.stringify(payload)});toast('Revisi kontribusi diajukan ulang.');await loadKpi(true);}});}

    function kpiReviewPayload(form){const payload=formJson(new FormData(form));payload.approvedWeight=Number(payload.approvedWeight)/100;return payload;}
    function openKpiReviewForm(assignment){
        const program=state.kpi?.programs?.find((item)=>item.id===assignment.programId);
        const programTargetField=program?.targetValue==null
            ? field('programTargetValue',`Target Program Divisi (${program?.targetUnit||assignment.targetUnit})`,'',{type:'number',min:0.0001,step:'0.01',full:true,help:'Wajib diisi saat kontribusi akan disetujui.'})
            : '';
        const submit=async(action,form)=>{if(!form.reportValidity())return;const payload=kpiReviewPayload(form);payload.action=action;await api(`/kpi/assignments/${assignment.id}/review`,{method:'POST',body:JSON.stringify(payload)});toast('Review kontribusi disimpan.');await loadKpi(true);};
        showDialog({eyebrow:'Approval KPI Individu',title:assignment.staffName,body:`<div class="bimws-form-grid">${programTargetField}${field('title','Komitmen',assignment.title,{required:true,full:true})}${field('measurementType','Measurement',assignment.measurementType,{type:'select',items:kpiMeasurementItems()})}${field('targetValue','Target',assignment.targetValue,{type:'number',min:0.0001,step:'0.01',required:true})}${field('targetUnit','Unit',assignment.targetUnit,{required:true})}${field('approvedWeight','Bobot Approved (%)',Math.round((assignment.approvedWeight??assignment.proposedWeight)*100),{type:'number',min:0.01,max:100,step:'0.01',required:true})}${field('dueDate','Due Date',assignment.dueDate?String(assignment.dueDate).slice(0,10):'',{type:'date'})}${field('expectedEvidence','Expected Evidence',assignment.expectedEvidence,{type:'textarea',full:true})}${field('note','Catatan Review','',{type:'textarea',full:true})}</div>`,submitLabel:'Approve',onSubmit:async(data)=>{const payload=formJson(data);payload.approvedWeight=Number(payload.approvedWeight)/100;payload.action='approve';await api(`/kpi/assignments/${assignment.id}/review`,{method:'POST',body:JSON.stringify(payload)});toast('Kontribusi KPI approved.');await loadKpi(true);},secondary:[{action:'revision',label:'Kembalikan Revisi',handler:async(dialog,form)=>{try{await submit('revision',form);dialog.close();}catch(error){toast(error.message,true);} }},{action:'reject',label:'Reject',className:'bimws-btn-danger',handler:async(dialog,form)=>{try{await submit('reject',form);dialog.close();}catch(error){toast(error.message,true);} }}]});
    }

    function openKpiActualForm(assignment){showDialog({eyebrow:'Realisasi KPI',title:assignment.title,body:`<div class="bimws-form-grid">${field('actualValue',`Actual (${assignment.targetUnit})`,assignment.verifiedActual??'',{type:'number',min:0,step:'0.01',required:true})}${field('evidenceLink','Evidence Link',assignment.actualEvidenceLink,{type:'url',required:true})}${field('note','Catatan Actual',assignment.actualNote,{type:'textarea',full:true})}</div>`,submitLabel:'Ajukan Verifikasi',onSubmit:async(formData)=>{await api(`/kpi/assignments/${assignment.id}/submit-actual`,{method:'POST',body:JSON.stringify(formJson(formData))});toast('Actual diajukan untuk verifikasi.');await loadKpi(true);}});}

    function openKpiVerifyForm(assignment){showDialog({eyebrow:'Verifikasi Actual',title:assignment.title,body:`<div class="bimws-form-grid">${field('verifiedActual',`Actual Terverifikasi (${assignment.targetUnit})`,assignment.submittedActual,{type:'number',min:0,step:'0.01',required:true})}${field('note','Catatan Verifikasi','',{type:'textarea',full:true})}<div class="bimws-field bimws-field-full"><label>Evidence</label><a href="${escapeHtml(safeExternalLink(assignment.actualEvidenceLink))}" target="_blank" rel="noopener noreferrer">Buka evidence <i class="fas fa-arrow-up-right-from-square"></i></a></div></div>`,submitLabel:'Approve Actual',onSubmit:async(formData)=>{const payload=formJson(formData);payload.action='approve';await api(`/kpi/assignments/${assignment.id}/verify`,{method:'POST',body:JSON.stringify(payload)});toast('Actual KPI diverifikasi.');await loadKpi(true);},secondary:[{action:'revision',label:'Kembalikan Revisi',handler:async(dialog,form)=>{try{const payload=formJson(new FormData(form));payload.action='revision';await api(`/kpi/assignments/${assignment.id}/verify`,{method:'POST',body:JSON.stringify(payload)});dialog.close();toast('Actual dikembalikan.');await loadKpi(true);}catch(error){toast(error.message,true);}}}]});}

    function kpiAssignmentActions(item){const actions=[];if(isKpiManager()&&['pending_approval','revision_required'].includes(item.status))actions.push(actionButton('fa-user-check','Review kontribusi','kpi-review',item.id));if(isOwn(item.staffUserId)&&item.status==='revision_required')actions.push(actionButton('fa-pen','Revisi kontribusi','kpi-revise',item.id));if(isOwn(item.staffUserId)&&['approved','achieved'].includes(item.status))actions.push(actionButton('fa-arrow-up-from-bracket','Ajukan actual','kpi-actual',item.id));if(isKpiManager()&&item.status==='verification_pending')actions.push(actionButton('fa-clipboard-check','Verifikasi actual','kpi-verify',item.id));return actions.join('')||'-';}

    function renderKpiPrograms(data){
        const programs=data.programs||[];
        if(!programs.length)return emptyState('Program KPI Divisi BIM belum dikonfigurasi.','fa-diagram-project');
        const missing=programs.filter((item)=>['target_required','empty'].includes(item.coverageStatus)).length;
        const covered=programs.filter((item)=>item.coverageStatus==='covered').length;
        const pending=programs.reduce((sum,item)=>sum+item.assignments.filter((assignment)=>assignment.status==='pending_approval').length,0);
        return `<div class="bimws-kpi-summary bimws-kpi-summary-compact"><div><p>Program</p><strong>${programs.length}</strong><small>Siklus ${data.year}</small></div><div><p>Covered</p><strong>${covered}</strong><small>Target telah teralokasi</small></div><div><p>Gap</p><strong>${missing}</strong><small>Target atau PIC belum lengkap</small></div><div><p>Pending Approval</p><strong>${pending}</strong><small>Usulan staff</small></div></div><div class="bimws-table-wrap"><table class="bimws-table bimws-kpi-program-table bimws-coverage-table"><thead><tr><th>Program / KPI</th><th>Target</th><th>Coverage</th><th>Realization</th><th>Execution</th><th>PIC</th><th>Aksi</th></tr></thead><tbody>${programs.map((program)=>{const canTake=!isKpiManager()&&program.claimPolicy==='staff_proposable'&&program.availabilityStatus==='open'&&!program.assignments.some((item)=>isOwn(item.staffUserId)&&item.status!=='rejected');const actions=[isKpiManager()?actionButton('fa-sliders','Konfigurasi target','kpi-program-config',program.id):'',isKpiManager()?actionButton('fa-user-plus','Delegasikan','kpi-program-assign',program.id):'',canTake?actionButton('fa-hand','Raise hand / Ajukan kontribusi','kpi-program-assign',program.id):''].join('');return `<tr><td><span class="bimws-kpi-code">${escapeHtml(program.code)} / ${escapeHtml(program.indicatorCode)}</span><span class="bimws-table-title">${escapeHtml(program.name)}</span><span class="bimws-table-sub">${escapeHtml(program.indicatorName)}</span></td><td><strong>${kpiValue(program.targetValue,program.targetUnit)}</strong><span class="bimws-table-sub">${escapeHtml(program.allocationMode.replaceAll('_',' '))}</span></td><td>${badge(program.coverageStatus)}<div class="bimws-coverage-meter"><span style="width:${Math.min(program.coveragePercent||0,100)}%"></span></div><small>${kpiValue(program.allocatedValue,program.targetUnit)} allocated</small></td><td><strong>${program.realizationPercent==null?'-':`${program.realizationPercent}%`}</strong><span class="bimws-table-sub">${kpiValue(program.verifiedValue,program.targetUnit)} verified</span></td><td>${badge(program.executionStatus)}</td><td>${program.assignments.length?program.assignments.map((item)=>`<span class="bimws-assignee">${escapeHtml(item.staffName)} ${badge(item.status)}</span>`).join(''):'-'}</td><td><div class="bimws-table-actions">${actions||'-'}</div></td></tr>`;}).join('')}</tbody></table></div>`;
    }

    function renderKpiIndividual(data){
        let cards=data.individual?.cards||[];
        if(!isKpiManager())cards=cards.filter((card)=>isOwn(card.staffUserId));
        if(!cards.length)return emptyState(state.access?.role==='staff_bim'?'KPI individu Anda belum ditetapkan.':'Belum ada scorecard KPI individu.','fa-user-check');
        return `<div class="bimws-kpi-card-list">${cards.map((card)=>`<section class="bimws-individual-card"><header><div><h4>${escapeHtml(card.staffName)}</h4><p>${card.assignments.length} program / ${Math.round(card.approvedWeight*100)}% bobot approved</p></div><div class="bimws-kpi-score"><span>Verified score</span><strong>${kpiPercent(card.score)}</strong></div></header><div class="bimws-table-wrap"><table class="bimws-table bimws-individual-table"><thead><tr><th>Program / Komitmen</th><th>Target</th><th>Bobot</th><th>Task</th><th>Actual</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${card.assignments.map((item)=>`<tr><td><span class="bimws-kpi-code">${escapeHtml(item.programCode)}</span><span class="bimws-table-title">${escapeHtml(item.title)}</span><span class="bimws-table-sub">${escapeHtml(item.programName)}</span></td><td>${kpiValue(item.targetValue,item.targetUnit)}</td><td>${item.approvedWeight==null?kpiPercent(item.proposedWeight):kpiPercent(item.approvedWeight)}</td><td>${item.completedTaskCount}/${item.taskCount}</td><td>${item.verifiedActual==null?'-':kpiValue(item.verifiedActual,item.targetUnit)}${item.achievement!=null?`<span class="bimws-table-sub">Achievement ${kpiPercent(item.achievement)}</span>`:''}</td><td>${badge(item.status)}</td><td><div class="bimws-table-actions">${kpiAssignmentActions(item)}</div></td></tr>`).join('')}</tbody></table></div></section>`).join('')}</div>`;
    }

    function renderKpi(){
        const year=state.period.slice(0,4);
        const data=state.kpi||{year,scorecards:{},individual:{status:'empty',indicators:[]}};
        const tabs={
            overview:{title:'Overview KPI',help:`Kontrak scorecard tahun ${year}.`,content:()=>renderKpiOverview(data)},
            department:{title:'KPI Departemen',help:'Acuan resmi Departemen Engineering dari workbook referensi.',content:()=>kpiTable(data.scorecards?.department)},
            division:{title:'KPI Divisi BIM',help:'Turunan terukur dengan scope dan relasi yang eksplisit.',content:()=>kpiTable(data.scorecards?.division,true)},
            individual:{title:'KPI Individu',help:'Komitmen, task, actual, dan score terverifikasi per staff.',content:()=>renderKpiIndividual(data)},
            programs:{title:'Program & Aktivitas',help:'Coverage Matrix KPI Divisi BIM.',content:()=>renderKpiPrograms(data)}
        };
        const active=tabs[state.kpiTab]||tabs.overview;
        document.querySelectorAll('[data-kpi-tab]').forEach((button)=>{
            const selected=button.dataset.kpiTab===state.kpiTab;
            button.classList.toggle('is-active',selected);
            button.setAttribute('aria-selected',String(selected));
        });
        document.getElementById('kpi-panel-title').textContent=active.title;
        document.getElementById('kpi-panel-help').textContent=active.help;
        document.getElementById('kpi-content').innerHTML=active.content();
    }

    async function loadReports(){state.report=await api(`/reports/summary?period=${state.period}`);renderReports();}

    function renderReports(){
        const r=state.report;
        const active=r.tasks.filter((task)=>!['approved_done','cancelled'].includes(task.status));
        const completed=r.tasks.filter((task)=>task.status==='approved_done');
        const outstanding=[...r.tasks.filter((task)=>['blocked'].includes(task.status)||(task.due_date&&new Date(task.due_date)<new Date()&&!['approved_done','cancelled'].includes(task.status))),...r.issues.filter((issue)=>!['closed','rejected','cancelled'].includes(issue.status)),...r.meetingActions];
        document.getElementById('reports-content').innerHTML=`<div class="bimws-metrics"><article class="bimws-metric" style="--metric-color:#087f8c"><p>Task Periode</p><strong>${r.tasks.length}</strong><small>${active.length} masih aktif</small></article><article class="bimws-metric" style="--metric-color:#16835f"><p>Task Selesai</p><strong>${completed.length}</strong><small>Approved done</small></article><article class="bimws-metric" style="--metric-color:#b42318"><p>Outstanding</p><strong>${outstanding.length}</strong><small>Task, issue, dan action</small></article><article class="bimws-metric" style="--metric-color:#e8752c"><p>Issue Aktif</p><strong>${r.issues.filter((issue)=>!['closed','rejected','cancelled'].includes(issue.status)).length}</strong><small>Perlu monitoring</small></article><article class="bimws-metric" style="--metric-color:#667085"><p>Action Rapat</p><strong>${r.meetingActions.length}</strong><small>Belum closed</small></article></div><div class="bimws-report-grid"><section class="bimws-panel"><div class="bimws-panel-head"><div><h3>Progress Task</h3><p>${formatMonth(state.period)}</p></div></div><div class="bimws-table-wrap">${r.tasks.length?`<table class="bimws-table"><thead><tr><th>Task</th><th>PIC</th><th>Progress</th><th>Status</th></tr></thead><tbody>${r.tasks.map((task)=>`<tr><td>${escapeHtml(task.title)}<span class="bimws-table-sub">${escapeHtml(task.project_name||'Internal')}</span></td><td>${escapeHtml(task.pic_name_snapshot||'-')}</td><td>${Number(task.progress_percent||0)}%</td><td>${badge(task.status)}</td></tr>`).join('')}</tbody></table>`:emptyState('Belum ada task.')}</div></section><section class="bimws-panel"><div class="bimws-panel-head"><div><h3>Outstanding</h3><p>Item yang memerlukan perhatian.</p></div></div><div class="bimws-feed">${outstanding.length?outstanding.slice(0,12).map((item)=>feedItem(['fa-triangle-exclamation',item.title||item.description||item.subject,`${item.status||''} ${item.due_date||item.planned_due_date?`/ Due ${formatDate(item.due_date||item.planned_due_date)}`:''}`])).join(''):emptyState('Tidak ada outstanding.')}</div></section><section class="bimws-panel"><div class="bimws-panel-head"><div><h3>Output Worklog</h3><p>Progress dan output tanpa membuka private hours.</p></div></div><div class="bimws-feed">${r.worklogs.filter((row)=>row.output_result).slice(0,12).map((row)=>feedItem(['fa-box-open',row.task_item_text,`${row.pic_name_snapshot}: ${row.output_result}`])).join('')||emptyState('Belum ada output.')}</div></section><section class="bimws-panel"><div class="bimws-panel-head"><div><h3>Issue & Action Rapat</h3><p>Monitoring koordinasi.</p></div></div><div class="bimws-feed">${[...r.issues,...r.meetingActions].slice(0,12).map((item)=>feedItem(['fa-clipboard-list',item.title||item.description,`${item.status||''} / ${item.owner_name_snapshot||item.action_owner_name||'-'}`])).join('')||emptyState('Belum ada data.')}</div></section></div>`;
    }

    function csvCell(value){const text=String(value==null?'':value).replaceAll('"','""');return `"${text}"`;}
    function exportReportCsv(){if(!state.report)return;const rows=[['Type','Date','Title','Project/Context','PIC/Owner','Status','Progress/Output'],...state.report.tasks.map((row)=>['Task',row.due_date,row.title,row.project_name,row.pic_name_snapshot,row.status,row.progress_percent]),...state.report.issues.map((row)=>['Issue',row.issue_date,row.title,row.project_context,row.owner_name_snapshot,row.status,row.severity]),...state.report.meetingActions.map((row)=>['Meeting Action',row.planned_due_date,row.description,row.meeting_no,row.action_owner_name,row.status,'']),...state.report.worklogs.map((row)=>['Worklog',row.work_date,row.task_item_text,row.project_name,row.pic_name_snapshot,row.task_status,row.output_result])];const blob=new Blob(['\ufeff'+rows.map((row)=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`divisi-bim-workspace-${state.period}.csv`;link.click();URL.revokeObjectURL(link.href);toast('Report CSV dibuat.');}

    async function handleActionClick(event){
        const quick=event.target.closest('[data-dashboard-action]');
        if(quick){const type=quick.dataset.dashboardAction;if(type==='task')openTaskForm();if(type==='worklog')await openWorklogForm();if(type==='issue')openIssueForm();return;}
        const button=event.target.closest('[data-action]');if(!button)return;
        const {action,id}=button.dataset;
        try{
            if(action==='kpi-program-config')openKpiProgramForm(state.kpi.programs.find((row)=>row.id===id));
            if(action==='kpi-program-assign')openKpiAssignmentForm(state.kpi.programs.find((row)=>row.id===id));
            if(action==='kpi-review')openKpiReviewForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-revise')openKpiRevisionForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-actual')openKpiActualForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-verify')openKpiVerifyForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='task-view')openTaskDetail(state.tasks.find((row)=>row.id===id));
            if(action==='task-edit')openTaskForm(state.tasks.find((row)=>row.id===id));
            if(action==='task-hold')openHoldTaskForm(state.tasks.find((row)=>row.id===id));
            if(action==='task-resume')openResumeTaskForm(state.tasks.find((row)=>row.id===id));
            if(action==='task-demo-mark')markDemoTask(state.tasks.find((row)=>row.id===id));
            if(action==='task-demo-delete')deleteDemoTask(state.tasks.find((row)=>row.id===id));
            if(action==='task-submit'){await api(`/tasks/${id}/submit-intake`,{method:'POST',body:'{}'});toast('Task diajukan ke Register.');await loadTasks(true);}
            if(action==='task-intake-review')reviewDialog('Review Register Task','REGISTERED','Kembalikan Revisi',async(decision,note)=>{await api(`/tasks/${id}/intake-review`,{method:'POST',body:JSON.stringify({action:decision==='approve'?'approve':'revision',note})});toast('Review register disimpan.');await loadTasks(true);});
            if(action==='task-complete-submit'){showDialog({eyebrow:'Completion Review',title:'Ajukan Task Selesai',body:`<div class="bimws-form-grid">${field('evidenceLink','Evidence Link','',{type:'url',full:true})}</div>`,submitLabel:'Ajukan Selesai',onSubmit:async(formData)=>{await api(`/tasks/${id}/submit-completion`,{method:'POST',body:JSON.stringify(formJson(formData))});toast('Task diajukan untuk completion review.');await loadTasks(true);}});}
            if(action==='task-completion-review')reviewDialog('Review Penyelesaian Task','Approve Done','Kembalikan Revisi',async(decision,note)=>{await api(`/tasks/${id}/completion-review`,{method:'POST',body:JSON.stringify({action:decision,note})});toast('Completion review disimpan.');await loadTasks(true);});
            if(action==='worklog-edit')await openWorklogForm(state.worklogs.find((row)=>row.id===id));
            if(action==='worklog-confirm')await openWorklogForm(state.worklogs.find((row)=>row.id===id));
            if(action==='meeting-view')await openMeetingDetail(id);
            if(action==='meeting-edit'){const meeting=await api(`/meetings/${id}`);openMeetingForm(meeting);}
            if(action==='meeting-action-update'){showDialog({eyebrow:'Tindak Lanjut',title:'Update Action Item',body:`<div class="bimws-form-grid">${field('status','Status','in_progress',{type:'select',items:['open','in_progress','closed','cancelled'].map((value)=>({value,label:statusLabels[value]||value}))})}${field('reviewNote','Catatan Update','',{type:'textarea',full:true})}${field('evidenceLink','Evidence Link','',{type:'url',full:true})}</div>`,submitLabel:'Simpan Update',onSubmit:async(formData)=>{await api(`/meeting-actions/${id}`,{method:'PUT',body:JSON.stringify(formJson(formData))});toast('Action item diperbarui.');await loadMeetings(true);}});}
            if(action==='meeting-action-task'){await api(`/meeting-actions/${id}/create-task`,{method:'POST',body:JSON.stringify({period:state.period})});toast('Task dibuat dari action item.');await loadMeetings(true);}
            if(action==='issue-view')openIssueDetail(state.issues.find((row)=>row.id===id));
            if(action==='issue-edit')openIssueForm(state.issues.find((row)=>row.id===id));
            if(action==='issue-submit'){await api(`/issues/${id}/submit`,{method:'POST',body:'{}'});toast('Issue diajukan.');await loadIssues(true);}
            if(action==='issue-review')reviewDialog('Review Issue','Accept','Reject',async(decision,note)=>{await api(`/issues/${id}/review`,{method:'POST',body:JSON.stringify({action:decision==='approve'?'accept':'reject',note})});toast('Review issue disimpan.');await loadIssues(true);});
            if(action==='issue-close-request'){showDialog({eyebrow:'Issue Closure',title:'Ajukan Closure',body:`<div class="bimws-form-grid">${field('resolutionNote','Resolution Note','',{type:'textarea',full:true,required:true})}${field('closureNote','Closure Note','',{type:'textarea',full:true})}${field('evidenceLink','Evidence Link','',{type:'url',full:true})}</div>`,submitLabel:'Ajukan Closure',onSubmit:async(formData)=>{await api(`/issues/${id}/request-closure`,{method:'POST',body:JSON.stringify(formJson(formData))});toast('Closure diajukan.');await loadIssues(true);}});}
            if(action==='issue-close-review')reviewDialog('Review Closure Issue','Approve Closure','Reopen',async(decision,note)=>{await api(`/issues/${id}/closure-review`,{method:'POST',body:JSON.stringify({action:decision,note})});toast('Closure review disimpan.');await loadIssues(true);});
            if(action==='issue-task'){await api(`/issues/${id}/create-task`,{method:'POST',body:JSON.stringify({period:state.period})});toast('Task dibuat dari issue.');await loadIssues(true);}
        }catch(error){toast(error.message,true);}
    }

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
