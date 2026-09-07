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
        taskPerformanceHistory: [],
        taskTrendMode: 'monthly',
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
        meetingProjectContexts: [],
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
            subtitle: 'Mengelola Master Task, subtask staff, baseline jadwal, dan performa pelaksanaan.',
            steps: ['Kadiv membuat Master Task dengan jadwal induk tanpa menentukan PIC.', 'Staff membuka Master Task lalu menambahkan subtask miliknya sesuai pembagian meeting internal.', 'Master Task bulan sebelumnya tetap tersedia pada bulan aktif selama jadwal induknya masih berjalan.', 'Gunakan Carry pada bulan tujuan untuk membuat kelanjutan Master Task yang masih outstanding; subtask lama tetap menjadi histori bulan asal.', 'Start dan Due subtask wajib berada di dalam jadwal induk; baseline awal tetap tersimpan bila jadwal efektif berubah.', 'Untuk task rutin, pilih hari mingguan. Timeline hanya menampilkan marker pada hari tersebut dan pola dapat digeser melalui Edit Task.', 'Hold yang disetujui Kadiv menambah deadline efektif. Tanpa Hold/perpanjangan resmi, hari lewat deadline dihitung sebagai keterlambatan PIC.', 'Task Performance Score terdiri dari Schedule 45%, Completion 25%, Quality 20%, dan Worklog 10%; grafik tren membandingkan score mingguan atau bulanan per PIC.'],
            note: 'Waktu selesai PIC memakai saat task diajukan untuk completion review, bukan saat Kadiv menekan approve. Master Task tidak memiliki PIC dan tidak diberi score.'
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
            steps: ['Klik Risalah Baru dan isi langsung pada lembar FRM.NKE.01.06: identitas rapat, peserta, pelapor, pihak yang mengetahui, dan referensi.', 'Gunakan Tambah Baris pada Laporan Progress atau Kesepakatan Rapat; setiap baris dapat menyimpan PIC, target selesai, reviewer, hasil, dan tanggal paraf.', 'Pilih konteks Kantor Pusat, satu Proyek, atau Koordinasi Gabungan semua proyek.', 'Bagian terakhir memuat action risalah sebelumnya yang belum closed.', 'Buka detail lalu pilih Print / PDF; output menggunakan data form yang sama tanpa input ulang.'],
            note: 'Nama proyek diambil dari riwayat risalah dan tetap dapat ditambah manual. Form, detail, dan PDF memakai satu sumber data terstruktur.'
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
            steps: ['Buka Langkah Berikutnya untuk melihat task selesai yang direkomendasikan ke salah satu dari 10 KPI Divisi.', 'Staff dapat mengajukan kontribusi atau claim actual beserta evidence; task yang sama tidak dapat diklaim ganda.', 'Kepala Divisi mereview mapping dan memverifikasi actual. Score individu dan Divisi BIM baru bertambah setelah approval tersebut.'],
            note: 'Rekomendasi hanya membantu pengajuan. Nilai actual, evidence, bobot, dan score tetap dikendalikan melalui approval Kepala Divisi.'
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

    function multilineHtml(value,fallback='-'){
        const text=String(value==null?'':value).trim();
        return text?escapeHtml(text).replace(/\r?\n/g,'<br>'):escapeHtml(fallback);
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
        const dialogBody = document.getElementById('bimws-dialog-body');
        dialogBody.innerHTML = body;
        dialogBody.scrollTop = 0;
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
            document.getElementById('bimws-user-role').textContent = roleLabel(access.role, access.staffRole);
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

    function staffRoleLabel(role) {
        return ({ bim_modeller: 'BIM Modeller', bim_specialist: 'BIM Specialist', bim_coordinator: 'BIM Coordinator' })[role] || 'BIM Specialist';
    }

    function roleLabel(role, staffRole = '') {
        if (role === 'staff_bim') return `Staff BIM / ${staffRoleLabel(staffRole)}`;
        return ({ division_head: 'KaDiv BIM', system_admin: 'System Administrator' })[role] || role;
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
        document.getElementById('task-master-new-btn').hidden = !isKpiManager();
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
        document.getElementById('task-master-new-btn').onclick = () => openTaskForm(null, { taskKind: 'master' });
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
        document.getElementById('task-pic-filter').onchange = renderTasks;
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
        document.querySelectorAll('[data-task-trend-mode]').forEach((button) => button.addEventListener('click', () => {
            state.taskTrendMode = button.dataset.taskTrendMode || 'monthly';
            renderTaskPerformanceTrend();
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

    function taskOverviewCharts(monthlyTasks, activeTasks, indicators) {
        const statusConfig = [
            ['in_progress', 'In Progress', '#087f8c'],
            ['planned', 'Planned', '#3b82f6'],
            ['on_hold', 'On Hold', '#b54708'],
            ['blocked', 'Blocked', '#b42318'],
            ['submitted_for_review', 'Review', '#e8752c'],
            ['rejected_revision', 'Revision', '#a15c00']
        ];
        const configuredStatuses = new Set(statusConfig.map(([value]) => value));
        const statusCounts = activeTasks.reduce((counts, task) => {
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
            cursor += (entry.count / activeTasks.length) * 100;
            return `${entry.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
        }).join(', ') || '#e7ebef 0% 100%';
        const averageProgress = activeTasks.length ? Math.round(activeTasks.reduce((sum, task) => {
            return sum + Math.min(100, Math.max(0, Number(task.progressPercent) || 0));
        }, 0) / activeTasks.length) : 0;

        const monthlyConfig = [
            ['completed_on_time', 'Selesai tepat waktu', '#16835f'],
            ['completed_late', 'Selesai terlambat', '#e8752c'],
            ['overdue', 'Aktif terlambat', '#b42318'],
            ['review', 'Menunggu review', '#a15c00'],
            ['blocked', 'Blocked', '#c11574'],
            ['on_hold', 'On Hold', '#b54708'],
            ['active', 'Aktif sesuai jadwal', '#3b82f6'],
            ['cancelled', 'Dibatalkan', '#98a2b3']
        ];
        const monthlyCounts = monthlyTasks.reduce((counts, task) => {
            if (task.status === 'approved_done') return counts;
            let key = 'active';
            if (task.status === 'cancelled') key = 'cancelled';
            else if (task.status === 'submitted_for_review') key = 'review';
            else if (task.status === 'blocked') key = 'blocked';
            else if (task.status === 'on_hold') key = 'on_hold';
            else if (Number(task.performance?.lateDays || 0) > 0) key = 'overdue';
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
        const completedCount = Math.max(0,Number(indicators?.completed||0));
        const onTimeCount = indicators?.onTimeCompleted == null
            ? Math.round((Number(indicators?.onTimePercent||0)/100)*completedCount)
            : Math.max(0,Number(indicators.onTimeCompleted));
        monthlyCounts.completed_on_time = Math.min(completedCount,onTimeCount);
        monthlyCounts.completed_late = Math.max(0,completedCount-monthlyCounts.completed_on_time);
        const monthlyEntries = monthlyConfig.map(([status,label,color]) => ({status,label,color,count:monthlyCounts[status]||0})).filter((entry)=>entry.count);
        cursor = 0;
        const monthlyGradient = monthlyEntries.map((entry) => {
            const start = cursor;
            cursor += (entry.count / monthlyTasks.length) * 100;
            return `${entry.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
        }).join(', ') || '#e7ebef 0% 100%';

        const donutLegend = (chartEntries,total) => `<ul class="bimws-chart-legend">${chartEntries.map((entry) => `<li><span class="bimws-legend-dot" style="--legend-color:${entry.color}"></span><span>${escapeHtml(entry.label)}</span><strong>${entry.count}</strong><small>${total?Math.round((entry.count/total)*100):0}%</small></li>`).join('')}</ul>`;

        const projects = [...activeTasks.reduce((groups, task) => {
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
            <section class="bimws-donut-section bimws-monthly-donut-section" aria-labelledby="task-monthly-chart-title">
                <div class="bimws-chart-heading">
                    <div><h4 id="task-monthly-chart-title">Seluruh Task Bulanan</h4><p>Task selesai dan pekerjaan berjalan</p></div>
                    <div class="bimws-chart-kpi"><span>Completion</span><strong>${Number(indicators?.completionPercent||0)}%</strong></div>
                </div>
                <div class="bimws-donut-layout">
                    <div class="bimws-donut" style="--chart-gradient:conic-gradient(${monthlyGradient})" role="img" aria-label="Distribusi seluruh ${monthlyTasks.length} task pada ${escapeHtml(formatMonth(state.period))}">
                        <div class="bimws-donut-center"><strong>${monthlyTasks.length}</strong><span>Total task</span></div>
                    </div>
                    ${donutLegend(monthlyEntries,monthlyTasks.length)}
                </div>
            </section>
            <section class="bimws-donut-section" aria-labelledby="task-status-chart-title">
                <div class="bimws-chart-heading">
                    <div><h4 id="task-status-chart-title">Status Task Aktif</h4><p>${activeTasks.length} task pada ${escapeHtml(formatMonth(state.period))}</p></div>
                    <div class="bimws-chart-kpi"><span>Avg. progress</span><strong>${averageProgress}%</strong></div>
                </div>
                <div class="bimws-donut-layout">
                    <div class="bimws-donut" style="--chart-gradient:conic-gradient(${gradient})" role="img" aria-label="Distribusi ${activeTasks.length} task aktif berdasarkan status">
                        <div class="bimws-donut-center"><strong>${activeTasks.length}</strong><span>Task aktif</span></div>
                    </div>
                    ${activeTasks.length?donutLegend(entries,activeTasks.length):`<div class="bimws-chart-empty"><i class="fas fa-circle-check"></i><span>Tidak ada task aktif</span></div>`}
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

        const monthlyTasks = state.tasks.filter((task) => task.taskKind !== 'master' && task.intakeStatus === 'approved');
        const active = monthlyTasks.filter((task) => !['approved_done','cancelled'].includes(task.status));
        document.getElementById('dashboard-active-tasks').innerHTML = monthlyTasks.length ? taskOverviewCharts(monthlyTasks,active,i) : emptyState('Belum ada task pada periode ini.', 'fa-chart-pie');

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
        const [tasks, history] = await Promise.all([
            api(`/tasks?period=${state.period}`),
            api(`/task-performance-trend?period=${state.period}`).catch(() => ({ points: [] }))
        ]);
        state.tasks = tasks;
        state.taskPerformanceHistory = Array.isArray(history?.points) ? history.points : [];
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
        if (task.isRoutine || task.taskCategory === 'routine') {
            return routineOccurrenceDates(range.start, range.end, task.routineWeekday).slice(0, maxDays);
        }
        const total = Math.min(dayDifference(range.start, range.end), maxDays - 1);
        return Array.from({ length: total + 1 }, (_, index) => addDays(range.start, index));
    }

    function taskWeekKey(date) {
        return dateKey(startOfWeek(date));
    }

    function isLoadActiveTask(task) {
        return task.taskKind !== 'master' && !!(task.picUserId || task.picName) && !['approved_done', 'cancelled', 'on_hold'].includes(task.status) && !['rejected', 'replaced'].includes(task.intakeStatus);
    }

    function isTaskCritical(task) {
        if (task.taskKind === 'master') return false;
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
        const taskById = new Map(tasks.map((task) => [task.id, task]));
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
            const clashDatesByTask = new Map();
            days.forEach((date) => {
                const daySet = byPicDay.get(`${pic}|${dateKey(date)}`) || new Set();
                const weekSet = byPicWeek.get(`${pic}|${taskWeekKey(date)}`) || new Set();
                maxDayLoad = Math.max(maxDayLoad, daySet.size);
                maxWeekLoad = Math.max(maxWeekLoad, weekSet.size);
                if (daySet.has(task.id) && daySet.size > 1) {
                    daySet.forEach((otherTaskId) => {
                        if (otherTaskId === task.id) return;
                        if (!clashDatesByTask.has(otherTaskId)) clashDatesByTask.set(otherTaskId, new Set());
                        clashDatesByTask.get(otherTaskId).add(dateKey(date));
                    });
                }
            });
            const clashTasks = [...clashDatesByTask.entries()].map(([id, overlapDates]) => ({
                id,
                title: taskById.get(id)?.title || 'Task lain',
                overlapDates: [...overlapDates].sort()
            })).sort((left, right) => left.title.localeCompare(right.title, 'id-ID'));
            const overlapDates = [...new Set(clashTasks.flatMap((item) => item.overlapDates))].sort();
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
                clash: clashTasks.length > 0,
                clashCount: clashTasks.length,
                clashTasks,
                overlapDates,
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

    function taskPicFilterValue(task) {
        return taskPicKey(task);
    }

    function syncTaskPicFilter() {
        const select = document.getElementById('task-pic-filter');
        if (!select) return '';
        const currentValue = select.value;
        const pics = new Map();
        state.tasks.forEach((task) => {
            if (task.taskKind === 'master' || !(task.picUserId || task.picName)) return;
            const value = taskPicFilterValue(task);
            if (!pics.has(value)) pics.set(value, task.picName || 'PIC tanpa nama');
        });
        const options = [...pics.entries()].sort((left, right) => left[1].localeCompare(right[1], 'id-ID'));
        select.innerHTML = `<option value="">Semua PIC</option>${options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('')}`;
        select.value = pics.has(currentValue) ? currentValue : '';
        return select.value;
    }

    function scopedTaskLoad(load, tasks) {
        const risks = tasks.map((task) => load.byId.get(task.id) || {});
        return {
            ...load,
            clash: risks.filter((risk) => risk.clash).length,
            overload: risks.filter((risk) => risk.overload).length,
            critical: risks.filter((risk) => risk.critical).length,
            canHold: risks.filter((risk) => risk.canHold).length
        };
    }

    function taskCategoryBadge(task) {
        return `<span class="bimws-task-chip" data-category="${escapeHtml(task.taskCategory || 'regular')}">${escapeHtml(taskCategoryLabels[task.taskCategory] || 'Regular')}</span>`;
    }

    function formatOverlapDates(values) {
        const dates = [...new Set(values || [])].sort();
        if (!dates.length) return 'tanggal yang sama';
        const ranges = [];
        let start = dates[0];
        let previous = dates[0];
        for (let index = 1; index <= dates.length; index += 1) {
            const current = dates[index];
            const isConsecutive = current && dayDifference(parseDateOnly(previous), parseDateOnly(current)) === 1;
            if (isConsecutive) {
                previous = current;
                continue;
            }
            ranges.push(start === previous ? formatDate(start) : `${formatDate(start)}–${formatDate(previous)}`);
            start = current;
            previous = current;
        }
        return ranges.slice(0, 2).join(', ') + (ranges.length > 2 ? ` +${ranges.length - 2} periode` : '');
    }

    function taskOverlapDetail(task) {
        const risk = state.taskLoad?.byId?.get(task.id) || {};
        if (!risk.clash || !risk.clashTasks?.length) return '';
        const visibleTasks = risk.clashTasks.slice(0, 2).map((item) => item.title);
        const remaining = Math.max(0, risk.clashTasks.length - visibleTasks.length);
        const taskNames = visibleTasks.join(', ') + (remaining ? ` +${remaining} task` : '');
        return `<div class="bimws-overlap-detail" data-risk="clash"><strong><i class="fas fa-code-branch"></i>Overlap ${escapeHtml(formatOverlapDates(risk.overlapDates))}</strong><span>Dengan ${escapeHtml(taskNames)}</span></div>`;
    }

    function taskRiskBadges(task) {
        const risk = state.taskLoad?.byId?.get(task.id) || {};
        const chips = [taskCategoryBadge(task)];
        if (risk.critical) chips.push('<span class="bimws-risk-chip" data-risk="critical">Critical</span>');
        if (risk.clash) chips.push(`<span class="bimws-risk-chip" data-risk="clash">Clash${risk.clashCount ? ` +${risk.clashCount}` : ''}</span>`);
        if (risk.overload) chips.push('<span class="bimws-risk-chip" data-risk="overload">Overload</span>');
        if (risk.canHold) chips.push('<span class="bimws-risk-chip" data-risk="hold">Can Hold</span>');
        return `<div class="bimws-risk-cell"><div class="bimws-risk-badges">${chips.join('')}</div>${taskOverlapDetail(task)}</div>`;
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

    function hierarchicalTasks(tasks) {
        const visibleIds = new Set(tasks.map((task) => task.id));
        const children = new Map();
        tasks.forEach((task) => {
            if (!task.parentTaskId || !visibleIds.has(task.parentTaskId)) return;
            if (!children.has(task.parentTaskId)) children.set(task.parentTaskId, []);
            children.get(task.parentTaskId).push(task);
        });
        const byDate = (left, right) => String(left.startDate || left.dueDate || '9999-12-31').localeCompare(String(right.startDate || right.dueDate || '9999-12-31')) || left.title.localeCompare(right.title, 'id-ID');
        const roots = tasks.filter((task) => !task.parentTaskId || !visibleIds.has(task.parentTaskId)).sort((left, right) => {
            const kindWeight = { master: 0, standalone: 1, subtask: 2 };
            return (kindWeight[left.taskKind] ?? 1) - (kindWeight[right.taskKind] ?? 1) || byDate(left, right);
        });
        return roots.flatMap((root) => [root, ...(children.get(root.id) || []).sort(byDate)]);
    }

    function taskPerformanceBadge(task) {
        if (task.taskKind === 'master') return `<span class="bimws-table-sub">${task.completedChildCount || 0}/${task.childCount || 0} subtask</span>`;
        if (!task.performance) return '-';
        const score = Number(task.performance.totalScore || 0);
        const level = score >= 90 ? 'strong' : score >= 75 ? 'watch' : 'risk';
        const scheduleText = task.performance.lateDays
            ? `${task.performance.lateDays} hari terlambat`
            : task.performance.earlyDays ? `${task.performance.earlyDays} hari lebih cepat` : 'Sesuai jadwal';
        return `<span class="bimws-score-pill" data-score-level="${level}">${score}</span><span class="bimws-table-sub">${scheduleText}</span>`;
    }

    function taskTable(tasks, actions = true) {
        const ordered = hierarchicalTasks(tasks);
        return `<table class="bimws-table"><thead><tr><th>Task</th><th>PIC</th><th>Periode</th><th>Progress</th><th>Score</th><th>Risk / Load</th><th>Register</th><th>Status</th>${actions ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${ordered.map((task) => {
            const overdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().toISOString().slice(0,10)) && !['approved_done','cancelled','on_hold'].includes(task.status);
            const risk = state.taskLoad?.byId?.get(task.id) || {};
            const demoPill = task.isDemo ? '<span class="bimws-demo-pill">Demo</span>' : '';
            const carryPill = task.sourceType === 'carry_forward' ? '<span class="bimws-carry-pill">Carry</span>' : '';
            const kindLabel = task.taskKind === 'master'
                ? `<span class="bimws-task-kind">Master${task.contextOnly ? ` · ${escapeHtml(formatMonth(task.periodMonth))}` : ''}</span>`
                : task.taskKind === 'subtask' ? '<span class="bimws-task-kind is-subtask">Subtask</span>' : '';
            const masterCanAdd = task.taskKind === 'master' && canWrite() && task.intakeStatus === 'approved' && !['approved_done','cancelled'].includes(task.status) && !hasCurrentCarry(task);
            const title = masterCanAdd
                ? `<button type="button" class="bimws-table-title bimws-master-task-link" data-action="task-add-subtask" data-id="${escapeHtml(task.id)}" title="Klik untuk menambah subtask">${kindLabel}${escapeHtml(task.title)}${carryPill}${demoPill}</button>`
                : `<span class="bimws-table-title">${kindLabel}${escapeHtml(task.title)}${carryPill}${demoPill}</span>`;
            return `<tr class="bimws-task-row is-${escapeHtml(task.taskKind || 'standalone')}" data-status="${escapeHtml(task.status)}" data-priority="${escapeHtml(task.priority)}" data-category="${escapeHtml(task.taskCategory || 'regular')}" data-clash="${risk.clash ? 'true' : 'false'}" data-demo="${task.isDemo ? 'true' : 'false'}"><td>${title}<span class="bimws-table-sub">${escapeHtml(task.projectName || 'Internal')} / ${escapeHtml(task.taskType.replaceAll('_',' '))}${masterCanAdd ? ' / Klik nama untuk tambah subtask' : ''}</span></td><td>${escapeHtml(task.taskKind === 'master' ? 'Belum dibagi' : (task.picName || '-'))}</td><td>${formatDate(task.startDate)}<span class="bimws-table-sub ${overdue ? 'text-danger' : ''}">Due ${formatDate(task.dueDate)}</span>${task.baselineDueDate && String(task.baselineDueDate).slice(0,10) !== String(task.dueDate || '').slice(0,10) ? `<span class="bimws-table-sub">Baseline ${formatDate(task.baselineDueDate)}</span>` : ''}</td><td><div class="bimws-progress"><span style="width:${task.progressPercent}%"></span></div><span class="bimws-table-sub">${task.progressPercent}%</span></td><td>${taskPerformanceBadge(task)}</td><td>${taskRiskBadges(task)}</td><td>${registerBadge(task.intakeStatus)}</td><td>${badge(task.status)}</td>${actions ? `<td><div class="bimws-row-actions">${taskActions(task)}</div></td>` : ''}</tr>`;
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
        const clash = tasks.filter((task) => state.taskLoad?.byId?.get(task.id)?.clash).length;
        const progress = total ? Math.round(tasks.reduce((sum, task) => sum + Math.min(100, Math.max(0, Number(task.progressPercent) || 0)), 0) / total) : 0;
        return { total, done, blocked, held, active, clash, progress };
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
                    <span>${summary.active} aktif</span><span>${summary.done} selesai</span><span>${summary.blocked} blocked</span><span>${summary.held} hold</span>${summary.clash ? `<span data-risk="clash">${summary.clash} task overlap</span>` : ''}
                </div>
                <div class="bimws-table-wrap">${taskTable(items)}</div>
            </section>`;
        }).join('')}</div>`;
    }

    function hasCurrentCarry(task) {
        return !!task.contextOnly && state.tasks.some((item) => item.periodMonth === state.period && item.carriedFromTaskId === task.id);
    }

    function taskActions(task) {
        const buttons = [actionButton('fa-eye','Lihat task','task-view',task.id)];
        const creator = isOwn(task.createdByUserId);
        const pic = isOwn(task.picUserId);
        const manager = isKpiManager();
        if (task.taskKind === 'master' && canWrite() && task.intakeStatus === 'approved' && !['approved_done','cancelled'].includes(task.status) && !hasCurrentCarry(task)) buttons.push(actionButton('fa-plus','Tambah subtask','task-add-subtask',task.id,'is-success'));
        if ((creator || pic || manager) && task.intakeStatus !== 'pending_approval' && !['submitted_for_review','approved_done'].includes(task.status) && (manager || task.status !== 'on_hold')) buttons.push(actionButton('fa-pen','Edit task','task-edit',task.id));
        if (creator && ['draft','revision_required'].includes(task.intakeStatus)) buttons.push(actionButton('fa-paper-plane','Ajukan register','task-submit',task.id));
        if (manager && task.intakeStatus === 'pending_approval') buttons.push(actionButton('fa-user-check','Review register task','task-intake-review',task.id));
        if (manager && task.taskKind !== 'master' && task.intakeStatus === 'approved' && !['submitted_for_review','approved_done','cancelled','on_hold'].includes(task.status)) buttons.push(actionButton('fa-pause','Hold task','task-hold',task.id,'is-warning'));
        if (manager && task.status === 'on_hold') buttons.push(actionButton('fa-play','Start again','task-resume',task.id,'is-success'));
        if (task.taskKind !== 'master' && (creator || pic) && task.intakeStatus === 'approved' && !['submitted_for_review','approved_done','cancelled','on_hold'].includes(task.status)) buttons.push(actionButton('fa-flag-checkered','Ajukan selesai','task-complete-submit',task.id));
        if (manager && task.status === 'submitted_for_review') buttons.push(actionButton('fa-check','Review penyelesaian','task-completion-review',task.id));
        if (manager && !task.isDemo) buttons.push(actionButton('fa-tag','Tandai sebagai demo','task-demo-mark',task.id));
        if (manager && task.isDemo) buttons.push(actionButton('fa-trash','Hapus demo task','task-demo-delete',task.id,'is-danger'));
        return buttons.join('');
    }

    function renderTasks() {
        const query = document.getElementById('task-search').value.toLowerCase();
        const pic = syncTaskPicFilter();
        const status = document.getElementById('task-status-filter').value;
        const intake = document.getElementById('task-intake-filter').value;
        const mineButton = document.getElementById('task-mine-filter');
        if (mineButton) {
            mineButton.classList.toggle('is-active', state.taskMineOnly);
            mineButton.setAttribute('aria-pressed', state.taskMineOnly ? 'true' : 'false');
        }
        const filtered = state.tasks.filter((task) => (!state.taskMineOnly || isMyTask(task)) && (!pic || taskPicFilterValue(task) === pic) && (!query || `${task.title} ${task.projectName} ${task.picName}`.toLowerCase().includes(query)) && (!status || task.status === status) && (!intake || task.intakeStatus === intake));
        state.taskLoad = scopedTaskLoad(analyzeTaskLoad(state.tasks), filtered);
        renderTaskLoadSummary(state.taskLoad);
        document.querySelectorAll('[data-task-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.taskView === state.taskViewMode));
        renderTaskGantt(filtered);
        document.getElementById('tasks-table').innerHTML = filtered.length
            ? (state.taskViewMode === 'task' ? taskTable(filtered) : groupedTaskView(filtered, state.taskViewMode))
             : emptyState('Tidak ada task yang sesuai filter.', 'fa-calendar-check');
        renderTaskPerformance(filtered);
        renderTaskPerformanceTrend();
    }

    function renderTaskPerformance(tasks) {
        const element = document.getElementById('task-performance-score');
        if (!element) return;
        const scored = tasks.filter((task) => task.taskKind !== 'master' && task.picUserId && task.performance);
        const groups = new Map();
        scored.forEach((task) => {
            const key = task.picUserId || task.picName;
            const current = groups.get(key) || { name: task.picName || 'PIC', tasks: [], late: 0 };
            current.tasks.push(task);
            current.late += task.performance.lateDays > 0 ? 1 : 0;
            groups.set(key, current);
        });
        const rows = [...groups.values()].map((group) => {
            const average = (field) => Math.round(group.tasks.reduce((sum, task) => sum + Number(task.performance[field] ?? 100), 0) / group.tasks.length);
            return { ...group, total: average('totalScore'), schedule: average('scheduleScore'), completion: average('completionScore'), quality: average('qualityScore'), worklog: average('worklogScore') };
        }).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'id-ID'));
        element.innerHTML = rows.length ? `<table class="bimws-table bimws-performance-table"><thead><tr><th>PIC</th><th>Task</th><th>Schedule 45%</th><th>Completion 25%</th><th>Quality 20%</th><th>Worklog 10%</th><th>Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><span class="bimws-table-sub">${row.late} task terlambat</span></td><td>${row.tasks.length}</td><td>${row.schedule}</td><td>${row.completion}</td><td>${row.quality}</td><td>${row.worklog}</td><td>${taskPerformanceBadge({performance:{totalScore:row.total,lateDays:row.late}})}</td></tr>`).join('')}</tbody></table>` : emptyState('Belum ada task PIC yang dapat dihitung.', 'fa-chart-line');
    }

    function taskTrendBuckets(mode) {
        const [year, month] = state.period.split('-').map(Number);
        if (mode === 'weekly') {
            const periodEnd = new Date(year, month, 0);
            const today = new Date();
            const anchor = state.period === dateKey(today).slice(0, 7) && today < periodEnd ? today : periodEnd;
            const lastWeek = startOfWeek(anchor);
            return Array.from({ length: 8 }, (_, index) => {
                const start = addDays(lastWeek, (index - 7) * 7);
                const end = addDays(start, 6);
                return {
                    key: dateKey(start),
                    start,
                    end,
                    label: ganttDateLabel(start, { day: 'numeric', month: 'short' })
                };
            });
        }
        return Array.from({ length: 6 }, (_, index) => {
            const date = new Date(year, month - 1 + index - 5, 1);
            return {
                key: dateKey(date).slice(0, 7),
                start: date,
                end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
                label: ganttDateLabel(date, { month: 'short', year: '2-digit' })
            };
        });
    }

    function renderTaskPerformanceTrend() {
        const element = document.getElementById('task-performance-trend');
        if (!element) return;
        const mode = state.taskTrendMode === 'weekly' ? 'weekly' : 'monthly';
        document.querySelectorAll('[data-task-trend-mode]').forEach((button) => {
            const active = button.dataset.taskTrendMode === mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        const buckets = taskTrendBuckets(mode);
        const points = Array.isArray(state.taskPerformanceHistory) ? state.taskPerformanceHistory : [];
        const groups = new Map();
        points.forEach((point) => {
            const scoreDate = parseDateOnly(point.scoreDate);
            if (!scoreDate) return;
            const bucketIndex = buckets.findIndex((bucket) => scoreDate >= bucket.start && scoreDate <= bucket.end);
            if (bucketIndex < 0) return;
            const key = point.picUserId || point.picName;
            const group = groups.get(key) || { key, name: point.picName || 'PIC', values: buckets.map(() => []) };
            group.values[bucketIndex].push(Number(point.totalScore || 0));
            groups.set(key, group);
        });
        const series = [...groups.values()].map((group) => ({
            ...group,
            scores: group.values.map((values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null),
            color: picColorPalette[Math.abs(hashPicKey(group.key)) % picColorPalette.length].border
        })).filter((group) => group.scores.some((value) => value != null)).sort((left, right) => left.name.localeCompare(right.name, 'id-ID'));
        if (!series.length) {
            element.innerHTML = emptyState(`Belum ada histori score ${mode === 'weekly' ? 'mingguan' : 'bulanan'} untuk ditampilkan.`, 'fa-chart-line');
            return;
        }

        const width = 940;
        const height = 320;
        const plot = { left: 54, right: 20, top: 22, bottom: 52 };
        const plotWidth = width - plot.left - plot.right;
        const plotHeight = height - plot.top - plot.bottom;
        const xAt = (index) => plot.left + (buckets.length === 1 ? plotWidth / 2 : (index / (buckets.length - 1)) * plotWidth);
        const yAt = (score) => plot.top + ((100 - Math.max(0, Math.min(100, score))) / 100) * plotHeight;
        const grid = [0, 25, 50, 75, 100].map((score) => `<g><line x1="${plot.left}" y1="${yAt(score)}" x2="${width - plot.right}" y2="${yAt(score)}"></line><text x="${plot.left - 10}" y="${yAt(score) + 4}" text-anchor="end">${score}</text></g>`).join('');
        const xLabels = buckets.map((bucket, index) => `<text x="${xAt(index)}" y="${height - 20}" text-anchor="middle">${escapeHtml(bucket.label)}</text>`).join('');
        const paths = series.map((group) => {
            let path = '';
            let connected = false;
            group.scores.forEach((score, index) => {
                if (score == null) { connected = false; return; }
                path += `${connected ? ' L' : ' M'} ${xAt(index).toFixed(1)} ${yAt(score).toFixed(1)}`;
                connected = true;
            });
            const dots = group.scores.map((score, index) => score == null ? '' : `<circle cx="${xAt(index)}" cy="${yAt(score)}" r="5" tabindex="0"><title>${escapeHtml(`${group.name} / ${buckets[index].label}: ${score}`)}</title></circle>`).join('');
            return `<g class="bimws-trend-series" style="--series-color:${group.color}"><path d="${path.trim()}"></path>${dots}</g>`;
        }).join('');
        const legend = series.map((group) => {
            const measured = group.scores.filter((value) => value != null);
            const latest = measured.at(-1);
            const previous = measured.at(-2);
            const delta = previous == null ? null : latest - previous;
            const trend = delta == null || delta === 0 ? 'steady' : delta > 0 ? 'up' : 'down';
            const trendLabel = delta == null ? 'Data awal' : delta === 0 ? 'Konsisten' : `${delta > 0 ? '+' : ''}${delta} poin`;
            return `<div class="bimws-trend-legend-item" data-trend="${trend}"><i style="--series-color:${group.color}"></i><span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(trendLabel)}</small></span><b>${latest}</b></div>`;
        }).join('');
        element.innerHTML = `<div class="bimws-trend-chart-wrap"><svg class="bimws-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik tren Task Performance Score ${mode === 'weekly' ? 'mingguan' : 'bulanan'} per PIC"><g class="bimws-trend-grid">${grid}${xLabels}</g>${paths}</svg></div><div class="bimws-trend-legend">${legend}</div>`;
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

    const routineWeekdayLabels = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

    function taskScheduleVisual(task, taskStart, targetEnd) {
        const performance = task.performance || {};
        const lateDays = Math.max(0, Number(performance.lateDays || 0));
        const earlyDays = Math.max(0, Number(performance.earlyDays || 0));
        let stateName = 'normal';
        let label = 'Sesuai jadwal';
        if (lateDays > 2) { stateName = 'late-critical'; label = `${lateDays} hari terlambat`; }
        else if (lateDays === 2) { stateName = 'late-two'; label = '2 hari terlambat'; }
        else if (lateDays === 1) { stateName = 'late-one'; label = '1 hari terlambat'; }
        else if (earlyDays > 0) { stateName = 'early'; label = `${earlyDays} hari lebih cepat`; }
        const completionDate = parseDateOnly(performance.completionDate);
        const comparisonDate = parseDateOnly(performance.comparisonDate);
        const scheduleDuration = Math.max(1, dayDifference(taskStart, targetEnd) + 1);
        const elapsedToCompletion = completionDate ? Math.max(1, dayDifference(taskStart, completionDate) + 1) : scheduleDuration;
        return {
            state: stateName,
            label,
            earlyCutoff: Math.max(4, Math.min(100, (elapsedToCompletion / scheduleDuration) * 100)),
            displayEnd: lateDays && comparisonDate && comparisonDate > targetEnd ? comparisonDate : targetEnd
        };
    }

    function routineOccurrenceDates(start, end, weekday) {
        const normalizedWeekday = Number.isInteger(Number(weekday)) && Number(weekday) >= 0 && Number(weekday) <= 6
            ? Number(weekday)
            : start.getDay();
        const first = addDays(start, (normalizedWeekday - start.getDay() + 7) % 7);
        const dates = [];
        for (let date = first; date <= end && dates.length < 60; date = addDays(date, 7)) dates.push(date);
        return dates;
    }

    function renderTaskGantt(tasks) {
        if (!state.ganttStart || state.ganttPeriod !== state.period) resetGanttWindow();
        const windowStart = parseDateOnly(state.ganttStart);
        const dayCount = state.ganttMode === 'month' ? daysInPeriod(state.period) : 14;
        const windowEnd = addDays(windowStart, dayCount - 1);
        const todayKey = dateKey(new Date());
        const days = Array.from({ length: dayCount }, (_, index) => addDays(windowStart, index));
        const sortedTasks = hierarchicalTasks(tasks);

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

            const taskStart = parseDateOnly(task.startDate || task.dueDate);
            let targetEnd = parseDateOnly(task.adjustedDueDate || task.dueDate || task.startDate);
            if (taskStart && targetEnd && targetEnd < taskStart) targetEnd = new Date(taskStart);
            let bar = '';
            if (taskStart && targetEnd) {
                const progress = Math.min(100, Math.max(0, Number(task.progressPercent || 0)));
                const picColor = getPicTimelineColor(task);
                const risk = state.taskLoad?.byId?.get(task.id) || {};
                const barAction = task.taskKind === 'master' && canWrite() && task.intakeStatus === 'approved' && !['approved_done','cancelled'].includes(task.status) && !hasCurrentCarry(task) ? 'task-add-subtask' : 'task-view';
                const barHelp = barAction === 'task-add-subtask' ? 'klik untuk tambah subtask' : (task.picName || 'Belum ada PIC');
                const schedule = taskScheduleVisual(task, taskStart, targetEnd);
                const isRoutine = !!task.isRoutine || task.taskCategory === 'routine';
                const commonAttributes = `data-task-kind="${escapeHtml(task.taskKind || 'standalone')}" data-action="${barAction}" data-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}" data-priority="${escapeHtml(task.priority)}" data-category="${escapeHtml(task.taskCategory || 'regular')}" data-intake="${escapeHtml(task.intakeStatus)}" data-schedule-state="${schedule.state}" data-critical="${risk.critical ? 'true' : 'false'}" data-clash="${risk.clash ? 'true' : 'false'}" data-overload="${risk.overload ? 'true' : 'false'}" data-can-hold="${risk.canHold ? 'true' : 'false'}"`;
                const visualStyle = `--task-progress:${progress}%;--schedule-cutoff:${schedule.earlyCutoff.toFixed(1)}%;${picTimelineStyle(picColor)}`;
                if (isRoutine) {
                    const routineDay = task.routineWeekday == null ? taskStart.getDay() : Number(task.routineWeekday);
                    const occurrences = routineOccurrenceDates(taskStart, targetEnd, routineDay).filter((date) => date >= windowStart && date <= windowEnd);
                    bar = occurrences.map((date) => {
                        const column = dayDifference(windowStart, date) + 2;
                        const title = `${task.title} / rutin setiap ${routineWeekdayLabels[routineDay]} / ${ganttDateLabel(date, { day: 'numeric', month: 'short' })} / ${schedule.label}`;
                        return `<button type="button" class="bimws-gantt-bar is-routine" ${commonAttributes} style="grid-column:${column}/span 1;grid-row:${gridRow};${visualStyle}" title="${escapeHtml(title)}"><span class="bimws-gantt-progress-fill"></span><span class="bimws-gantt-progress-label" aria-hidden="true">R</span></button>`;
                    }).join('');
                } else if (schedule.displayEnd >= windowStart && taskStart <= windowEnd) {
                    const visibleStart = taskStart < windowStart ? windowStart : taskStart;
                    const visibleEnd = schedule.displayEnd > windowEnd ? windowEnd : schedule.displayEnd;
                    const column = dayDifference(windowStart, visibleStart) + 2;
                    const span = dayDifference(visibleStart, visibleEnd) + 1;
                    const duration = dayDifference(taskStart, targetEnd) + 1;
                    bar = `<button type="button" class="bimws-gantt-bar" ${commonAttributes} style="grid-column:${column}/span ${span};grid-row:${gridRow};${visualStyle}" title="${escapeHtml(`${task.title} / ${barHelp} / target ${duration} hari / ${schedule.label} / ${progress}%`)}"><span class="bimws-gantt-progress-fill"></span><span class="bimws-gantt-progress-label">${progress}%</span></button>`;
                }
            }

            const picColor = getPicTimelineColor(task);
            const routineMeta = task.isRoutine || task.taskCategory === 'routine'
                ? ` / Rutin ${routineWeekdayLabels[task.routineWeekday == null ? (taskStart?.getDay() ?? 1) : Number(task.routineWeekday)]}`
                : '';
            return `<div class="bimws-gantt-task-meta is-${escapeHtml(task.taskKind || 'standalone')}" style="grid-column:1;grid-row:${gridRow};--pic-color:${picColor.border}"><span class="bimws-gantt-index">${index + 1}</span><span class="bimws-gantt-pic-dot" title="${escapeHtml(`PIC: ${task.picName || 'Belum ada PIC'}`)}"></span><span><strong title="${escapeHtml(task.title)}">${task.taskKind === 'subtask' ? '↳ ' : ''}${escapeHtml(task.title)}${taskGanttRiskIcons(task)}</strong><small>${escapeHtml(task.projectName || 'Internal')} / ${escapeHtml(task.taskKind === 'master' ? 'Belum dibagi' : (task.picName || 'Belum ada PIC'))} / ${escapeHtml(statusLabels[task.status] || task.status)}${escapeHtml(routineMeta)}</small></span></div>${cells}${bar}`;
        }).join('');

        document.getElementById('tasks-gantt').innerHTML = sortedTasks.length
            ? `<div class="bimws-gantt-grid" style="--gantt-day-count:${dayCount}">${header}${rows}</div>`
            : `<div class="bimws-empty"><i class="fas fa-chart-gantt"></i>Tidak ada task untuk ditampilkan pada timeline.</div>`;
    }

    function userOptions(selected = '') {
        return [{ value: '', label: 'Belum ditentukan' }, ...state.users.map((user) => ({ value: user.id, label: `${user.username}${user.workspaceRole === 'staff_bim' ? ` / ${staffRoleLabel(user.workspaceStaffRole)}` : ` / ${roleLabel(user.workspaceRole)}`}` }))]
            .map((item) => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(selected) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
    }

    function staffUserOptions(selected = '') {
        const staff = state.users.filter((user) => user.workspaceRole === 'staff_bim');
        if (!staff.length) return '<option value="" disabled selected>Belum ada user Staff BIM aktif</option>';
        return staff.map((user) => `<option value="${escapeHtml(user.id)}" ${String(user.id) === String(selected) ? 'selected' : ''}>${escapeHtml(`${user.username} / ${staffRoleLabel(user.workspaceStaffRole)}`)}</option>`).join('');
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
        try {
            return await api(`/kpi/task-options?year=${state.period.slice(0,4)}&picUserId=${encodeURIComponent(picUserId)}`);
        } catch (_) {
            return [];
        }
    }

    function kpiDivisionOptions(items, selected = '') {
        return [`<option value="">Pilih salah satu dari 10 KPI Divisi</option>`, ...items
            .map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${escapeHtml(`${item.code} · ${item.name}`)}</option>`)].join('');
    }

    function kpiIndividualOptions(assignments, selected = '') {
        return [`<option value="">Tanpa mapping individu / mapping menyusul</option>`, ...assignments
            .map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${escapeHtml(item.title)}</option>`)].join('');
    }

    function kpiTaskLinkField(items, selectedIndicator = '', selectedAssignment = '', disabled = false) {
        const kpiSelected = !!selectedIndicator || !!selectedAssignment;
        return `<section class="bimws-task-kpi-link bimws-field-full" data-task-kpi-link>
            <header>
                <div><strong>Kontribusi KPI</strong><small>Setiap task KPI wajib dipetakan ke KPI Divisi yang resmi.</small></div>
                <span>10 KPI Divisi</span>
            </header>
            <div class="bimws-task-kpi-modes" role="radiogroup" aria-label="Jenis kontribusi task">
                <label><input type="radio" name="kpiContributionMode" value="operational" ${kpiSelected ? '' : 'checked'} ${disabled ? 'disabled' : ''}><span><b>Non-KPI / Operasional</b><small>Task tetap masuk Task Performance Score, tetapi tidak mengubah KPI.</small></span></label>
                <label><input type="radio" name="kpiContributionMode" value="kpi" ${kpiSelected ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span><b>Kontribusi KPI</b><small>Pilih KPI Divisi, lalu tautkan KPI/program individu PIC bila tersedia.</small></span></label>
            </div>
            <div class="bimws-task-kpi-picker" data-task-kpi-picker ${kpiSelected ? '' : 'hidden'}>
                <label for="task-kpi-indicator">KPI Divisi yang dituju</label>
                <select name="kpiDivisionIndicatorId" id="task-kpi-indicator" ${disabled ? 'disabled' : ''}>${kpiDivisionOptions(items, selectedIndicator)}</select>
                <div class="bimws-task-kpi-individual" data-task-kpi-individual-field hidden>
                    <label for="task-kpi-assignment">KPI / program kerja individu PIC</label>
                    <select name="kpiAssignmentId" id="task-kpi-assignment" ${disabled ? 'disabled' : ''}></select>
                    <small>Opsional. Jika hanya ada satu mapping approved, sistem akan memilihnya otomatis.</small>
                </div>
                <div class="bimws-task-kpi-preview" data-task-kpi-preview hidden></div>
                <div class="bimws-task-kpi-empty" data-task-kpi-empty hidden>
                    <div><strong>Belum ada mapping individu pada KPI Divisi ini.</strong><small>Task tetap tersimpan sebagai kontribusi KPI Divisi. Tambahkan program individu agar task ikut menghitung faktor KPI individu PIC.</small></div>
                    <button type="button" class="bimws-text-btn" data-open-kpi-setup>Buka Program KPI</button>
                </div>
                <small>Daftar utama selalu mengikuti 10 KPI Divisi aktif. Mapping individu tidak menambah KPI baru ke daftar ini.</small>
            </div>
        </section>`;
    }

    async function openTaskForm(task = null, options = {}) {
        await refreshProjectContexts();
        const currentUserId = String(state.access?.user?.id || '');
        const currentUserName = state.access?.user?.name || 'User BCL';
        const parentTaskId = task?.parentTaskId || options.parentTaskId || '';
        const taskKind = task?.taskKind || options.taskKind || (parentTaskId ? 'subtask' : 'standalone');
        const isMaster = taskKind === 'master';
        const parent = state.tasks.find((item) => item.id === parentTaskId);
        const definitionLocked = !!task && task.intakeStatus === 'approved' && !isKpiManager();
        const delegatedTask = isKpiManager() && !isMaster && !!task?.picUserId && String(task.picUserId) !== currentUserId;
        const unassignedSubtask = isKpiManager() && taskKind === 'subtask' && !task?.picUserId;
        const initialPicUserId = isMaster || unassignedSubtask ? '' : delegatedTask ? task.picUserId : currentUserId;
        const initialKpiOptions = isMaster ? [] : await loadKpiTaskOptions(initialPicUserId);
        const initialKpiIndicatorId = task?.kpiDivisionIndicatorId
            || initialKpiOptions.find((item) => item.assignments?.some((assignment) => String(assignment.id) === String(task?.kpiAssignmentId)))?.id
            || '';
        const masters = state.tasks.filter((item) => item.taskKind === 'master' && item.intakeStatus === 'approved' && !['approved_done','cancelled'].includes(item.status) && !hasCurrentCarry(item));
        const parentItems = [{ value: '', label: 'Standalone / tidak memakai induk' }, ...masters.map((item) => ({
            value: item.id,
            label: `${item.title}${item.contextOnly ? ` / Master ${formatMonth(item.periodMonth)}` : ''} / ${formatDate(item.startDate)}-${formatDate(item.adjustedDueDate || item.dueDate)}`
        }))];
        const parentField = !isMaster && (!task || parentTaskId)
            ? field('parentTaskId','Master Task',parentTaskId,{type:'select',items:parentItems,disabled:!!task,help:'Pilih induk hasil meeting internal. Master bulan sebelumnya tetap tersedia bila jadwalnya masih aktif; jadwal subtask wajib berada dalam rentang induk.'})
            : '';
        const assignmentFields = isMaster
            ? '<div class="bimws-field bimws-field-full bimws-master-note"><strong>Master Task tanpa PIC</strong><small>Staff akan mengisi subtask masing-masing setelah pembagian pekerjaan dibahas di meeting internal.</small></div>'
            : isKpiManager() ? `
                <div class="bimws-field"><label>Penugasan</label><select name="assignmentMode" id="task-assignment-mode" ${definitionLocked ? 'disabled' : ''}>
                    <option value="unassigned" ${unassignedSubtask ? 'selected' : ''}>Belum ditentukan</option>
                    <option value="self" ${delegatedTask || unassignedSubtask ? '' : 'selected'}>Task saya</option>
                    <option value="delegate" ${delegatedTask ? 'selected' : ''}>Delegasikan ke Staff BIM</option>
                </select></div>
                <div class="bimws-field" id="task-delegate-field" ${delegatedTask ? '' : 'hidden'}><label>Staff BIM</label><select name="delegateUserId" id="task-delegate-user">${staffUserOptions(delegatedTask ? task.picUserId : '')}</select></div>`
            : `<div class="bimws-field"><label>PIC</label><input type="text" value="${escapeHtml(currentUserName)}" disabled><small>Subtask menjadi tanggung jawab Anda dan memerlukan review register Kadiv.</small></div>`;
        const periodStart = `${state.period}-01`;
        const periodEnd = `${state.period}-${String(daysInPeriod(state.period)).padStart(2, '0')}`;
        const parentStart = parent?.startDate ? String(parent.startDate).slice(0,10) : '';
        const parentDueValue = parent?.adjustedDueDate || parent?.dueDate || '';
        const parentDue = parentDueValue ? String(parentDueValue).slice(0,10) : '';
        const initialStart = task?.startDate ? String(task.startDate).slice(0,10) : parentStart ? (parentStart < periodStart ? periodStart : parentStart) : '';
        const initialDue = task?.dueDate ? String(task.dueDate).slice(0,10) : parentDue ? (parentDue > periodEnd ? periodEnd : parentDue) : '';
        const initialRoutine = !!task?.isRoutine || task?.taskCategory === 'routine';
        const initialRoutineWeekday = task?.routineWeekday == null
            ? (parseDateOnly(initialStart)?.getDay() ?? 1)
            : Number(task.routineWeekday);
        const dialog = showDialog({
            eyebrow: isMaster ? 'Master Task Kadiv' : taskKind === 'subtask' ? 'Subtask Staff' : 'Task Scheduler',
            title: task ? `Edit ${isMaster ? 'Master Task' : taskKind === 'subtask' ? 'Subtask' : 'Task'}` : isMaster ? 'Master Task Baru' : taskKind === 'subtask' ? 'Subtask Baru' : 'Task Baru',
            body: `<div class="bimws-form-grid">
                ${parentField}
                ${field('title',isMaster?'Nama Master Task':'Task Item',task?.title||'',{required:true,full:true,disabled:definitionLocked})}
                ${field('projectName','Project / Context',task?.projectName||parent?.projectName||'',{disabled:definitionLocked,suggestions:state.projectContexts})}
                ${field('taskType','Task Type',task?.taskType||(isMaster?'tender_support':'project_task'),{type:'select',items:taskTypeItems(),disabled:definitionLocked})}
                ${field('taskCategory','Kategori Beban',task?.taskCategory||'regular',{type:'select',items:taskCategoryItems(),disabled:definitionLocked})}
                ${assignmentFields}
                ${!isMaster?kpiTaskLinkField(initialKpiOptions,initialKpiIndicatorId,task?.kpiAssignmentId||'',definitionLocked):''}
                ${field('priority','Priority',task?.priority||'normal',{type:'select',items:['low','normal','high','urgent'].map((value)=>({value,label:value[0].toUpperCase()+value.slice(1)})),disabled:definitionLocked})}
                ${field('startDate','Start Date',initialStart,{type:'date',required:isMaster||taskKind==='subtask',disabled:definitionLocked})}
                ${field('dueDate','Due Date',initialDue,{type:'date',required:isMaster||taskKind==='subtask',disabled:definitionLocked})}
                ${task && isKpiManager() && task.intakeStatus === 'approved' ? field('scheduleChangeReason','Alasan Perubahan Jadwal','',{type:'textarea',full:true,help:'Wajib bila Start/Due diubah. Baseline awal tidak akan ditimpa.'}) : ''}
                <div class="bimws-task-load-preview bimws-field-full" data-task-load-preview hidden></div>
                ${task ? field('status','Task Status',task.status,{type:'select',items:taskStatusItems(isKpiManager()).filter((item)=>isKpiManager() || !['cancelled','on_hold'].includes(item.value)),disabled:isMaster}) : ''}
                ${task ? field('progressPercent','Progress (%)',task.progressPercent,{type:'number',min:0,max:99,step:'1',disabled:isMaster}) : ''}
                ${field('description','Description',task?.description||'',{type:'textarea',full:true,disabled:definitionLocked})}
                ${field('evidenceLink','Evidence Link',task?.evidenceLink||'',{type:'url',full:true})}
                ${field('isCritical','Critical task',task?.isCritical||false,{type:'checkbox',full:true,checkboxLabel:'Tandai sebagai critical task',disabled:definitionLocked})}
                ${field('criticalReason','Alasan Critical',task?.criticalReason||'',{type:'textarea',full:true,disabled:definitionLocked})}
                ${!isMaster?field('isRoutine','Task rutin',initialRoutine,{type:'checkbox',full:true,checkboxLabel:'Jadwalkan berulang setiap minggu dan bisa digenerate ke periode berikutnya',disabled:definitionLocked}):''}
                ${!isMaster?`<div class="bimws-field bimws-field-full" id="task-routine-schedule-field" ${initialRoutine ? '' : 'hidden'}><label>Hari rutin mingguan</label><select name="routineWeekday" id="task-routine-weekday" ${definitionLocked ? 'disabled' : ''}>${routineWeekdayLabels.map((label,index)=>`<option value="${index}" ${index===initialRoutineWeekday?'selected':''}>${label}</option>`).join('')}</select><small>Gantt menampilkan satu marker pada hari ini setiap minggu, bukan bar menerus.</small></div>`:''}
            </div>`,
            submitLabel: task ? 'Simpan Perubahan' : isMaster ? 'Buat Master Task' : (isKpiManager() ? 'Buat Task' : 'Buat Draft Subtask'),
            onSubmit: async (formData) => {
                const payload = formJson(formData,['isRoutine','isCritical']);
                payload.periodMonth = state.period;
                payload.taskKind = isMaster ? 'master' : (payload.parentTaskId || parentTaskId ? 'subtask' : 'standalone');
                payload.parentTaskId = payload.taskKind === 'subtask' ? (payload.parentTaskId || parentTaskId) : '';
                if (isMaster) payload.picUserId = '';
                else if (isKpiManager()) payload.picUserId = payload.assignmentMode === 'unassigned' ? '' : payload.assignmentMode === 'delegate' ? payload.delegateUserId : currentUserId;
                else payload.picUserId = currentUserId;
                if (payload.kpiContributionMode !== 'kpi') {
                    payload.kpiDivisionIndicatorId = '';
                    payload.kpiAssignmentId = '';
                }
                delete payload.kpiContributionMode;
                delete payload.assignmentMode;
                delete payload.delegateUserId;
                if (task) await api(`/tasks/${task.id}`,{method:'PUT',body:JSON.stringify(payload)});
                else await api('/tasks',{method:'POST',body:JSON.stringify(payload)});
                toast(task ? 'Task diperbarui.' : isMaster ? 'Master Task dibuat tanpa PIC.' : payload.taskKind === 'subtask' ? 'Draft subtask dibuat.' : 'Task dibuat.');
                await loadTasks(true);
            }
        });
        const assignmentMode = dialog.querySelector('#task-assignment-mode');
        const delegateField = dialog.querySelector('#task-delegate-field');
        const delegateUser = dialog.querySelector('#task-delegate-user');
        const kpiModeInputs = [...dialog.querySelectorAll('[name="kpiContributionMode"]')];
        const kpiPicker = dialog.querySelector('[data-task-kpi-picker]');
        const kpiIndicator = dialog.querySelector('#task-kpi-indicator');
        const kpiAssignment = dialog.querySelector('#task-kpi-assignment');
        const kpiIndividualField = dialog.querySelector('[data-task-kpi-individual-field]');
        const kpiPreview = dialog.querySelector('[data-task-kpi-preview]');
        const kpiEmpty = dialog.querySelector('[data-task-kpi-empty]');
        const parentSelect = dialog.querySelector('[name="parentTaskId"]');
        const preview = dialog.querySelector('[data-task-load-preview]');
        const routineCheckbox = dialog.querySelector('[name="isRoutine"]');
        const routineScheduleField = dialog.querySelector('#task-routine-schedule-field');
        const routineWeekday = dialog.querySelector('#task-routine-weekday');
        const startDateInput = dialog.querySelector('[name="startDate"]');
        const categorySelect = dialog.querySelector('[name="taskCategory"]');
        let currentKpiOptions = initialKpiOptions;
        const currentPic = () => isMaster || assignmentMode?.value === 'unassigned' ? '' : assignmentMode?.value === 'delegate' ? delegateUser?.value : currentUserId;
        const currentKpiIndicator = () => currentKpiOptions.find((option) => String(option.id) === String(kpiIndicator?.value));
        const renderKpiPreview = () => {
            if (!kpiPreview || !kpiIndicator || !kpiAssignment) return;
            const item = currentKpiIndicator();
            const assignment = item?.assignments?.find((option) => String(option.id) === String(kpiAssignment.value));
            kpiPreview.hidden = !item;
            kpiPreview.innerHTML = item ? `<span><b>${escapeHtml(item.code)}</b>${escapeHtml(item.name)}</span><span><b>${escapeHtml(item.programCode || 'Program Divisi')}</b>${escapeHtml(item.programName || '-')}</span><span><b>Mapping individu</b>${assignment ? `${escapeHtml(assignment.title)}${assignment.approvedWeight == null ? '' : ` · Bobot ${Math.round(Number(assignment.approvedWeight) * 10000) / 100}%`}` : 'Belum dipetakan / mapping menyusul'}</span>` : '';
        };
        const syncKpiIndividualOptions = (preferredAssignment = kpiAssignment?.value || '') => {
            if (!kpiAssignment) return;
            const item = currentKpiIndicator();
            const assignments = item?.assignments || [];
            const selected = assignments.some((option) => String(option.id) === String(preferredAssignment))
                ? preferredAssignment
                : assignments.length === 1 ? assignments[0].id : '';
            kpiAssignment.innerHTML = kpiIndividualOptions(assignments, selected);
            if (kpiIndividualField) kpiIndividualField.hidden = !item || assignments.length === 0;
            const kpiMode = dialog.querySelector('[name="kpiContributionMode"]:checked')?.value === 'kpi';
            kpiAssignment.disabled = definitionLocked || !kpiMode || assignments.length === 0;
            if (kpiEmpty) kpiEmpty.hidden = !kpiMode || !item || assignments.length > 0;
            renderKpiPreview();
        };
        const syncKpiLink = () => {
            if (!kpiPicker || !kpiIndicator || !kpiAssignment) return;
            const kpiMode = dialog.querySelector('[name="kpiContributionMode"]:checked')?.value === 'kpi';
            kpiPicker.hidden = !kpiMode;
            kpiIndicator.disabled = definitionLocked || !kpiMode;
            kpiIndicator.required = kpiMode && !definitionLocked;
            kpiAssignment.disabled = definitionLocked || !kpiMode || !currentKpiIndicator()?.assignments?.length;
            kpiAssignment.required = false;
            syncKpiIndividualOptions();
        };
        const refreshKpiAssignment = async () => {
            if (!kpiIndicator || !kpiAssignment) return;
            const selectedIndicator = kpiIndicator.value;
            const selectedAssignment = kpiAssignment.value;
            currentKpiOptions = await loadKpiTaskOptions(currentPic());
            const nextIndicator = currentKpiOptions.some((option) => String(option.id) === String(selectedIndicator)) ? selectedIndicator : '';
            kpiIndicator.innerHTML = kpiDivisionOptions(currentKpiOptions, nextIndicator);
            syncKpiIndividualOptions(selectedAssignment);
            syncKpiLink();
        };
        const renderLoadPreview = () => {
            if (!preview || isMaster) return;
            const draft = { ...(task||{}), id:task?.id||'__draft_task__', taskKind:parentSelect?.value||parentTaskId?'subtask':'standalone', picUserId:currentPic(), startDate:dialog.querySelector('[name="startDate"]')?.value||'', dueDate:dialog.querySelector('[name="dueDate"]')?.value||'', priority:dialog.querySelector('[name="priority"]')?.value||'normal', taskCategory:dialog.querySelector('[name="taskCategory"]')?.value||'regular', status:task?.status||'planned', intakeStatus:task?.intakeStatus||'approved' };
            if (!draft.picUserId || !draft.startDate || !draft.dueDate) { preview.hidden=true; return; }
            const risk=analyzeTaskLoad([...state.tasks.filter((item)=>item.id!==draft.id),draft]).byId.get(draft.id)||{};
            const messages=[];
            if(risk.clash)messages.push(['clash','Clash',`Overlap dengan ${risk.clashCount} task PIC lain.`]);
            if(risk.overload)messages.push(['overload','Overload',`Beban mencapai ${risk.maxDayLoad} task/hari atau ${risk.maxWeekLoad} task/minggu.`]);
            preview.hidden=false;
            preview.innerHTML=messages.length?`<strong>Load warning</strong>${messages.map(([name,label,text])=>`<span data-risk="${name}"><b>${label}</b>${escapeHtml(text)}</span>`).join('')}`:'<strong>Load check</strong><span data-risk="clear"><b>Aman</b>Belum terdeteksi clash atau overload.</span>';
        };
        const syncDelegation=()=>{if(!assignmentMode)return;const delegated=assignmentMode.value==='delegate';delegateField.hidden=!delegated;delegateUser.required=delegated;refreshKpiAssignment();renderLoadPreview();};
        const syncRoutineSchedule=()=>{
            if(!routineScheduleField||!routineWeekday)return;
            if(categorySelect?.value==='routine'&&routineCheckbox&&!routineCheckbox.disabled)routineCheckbox.checked=true;
            const active=!!routineCheckbox?.checked||categorySelect?.value==='routine';
            routineScheduleField.hidden=!active;
            routineWeekday.required=active;
        };
        assignmentMode?.addEventListener('change',syncDelegation);
        delegateUser?.addEventListener('change',()=>{refreshKpiAssignment();renderLoadPreview();});
        kpiModeInputs.forEach((input)=>input.addEventListener('change',syncKpiLink));
        kpiIndicator?.addEventListener('change',()=>syncKpiIndividualOptions(''));
        kpiAssignment?.addEventListener('change',renderKpiPreview);
        dialog.querySelector('[data-open-kpi-setup]')?.addEventListener('click',()=>{
            dialog.close();
            state.kpiTab='programs';
            loadView('kpi',true);
            toast('Pilih program KPI lalu ajukan atau delegasikan kontribusi untuk PIC.');
        });
        routineCheckbox?.addEventListener('change',syncRoutineSchedule);
        categorySelect?.addEventListener('change',syncRoutineSchedule);
        routineWeekday?.addEventListener('change',()=>{routineWeekday.dataset.userSelected='true';});
        startDateInput?.addEventListener('change',()=>{
            if(!task&&!routineWeekday?.dataset.userSelected&&startDateInput.value){
                const anchor=parseDateOnly(startDateInput.value);
                if(anchor)routineWeekday.value=String(anchor.getDay());
            }
        });
        parentSelect?.addEventListener('change',()=>{
            const selected=state.tasks.find((item)=>item.id===parentSelect.value);
            const start=dialog.querySelector('[name="startDate"]');const due=dialog.querySelector('[name="dueDate"]');
            if(selected){
                const selectedStart=String(selected.startDate).slice(0,10);
                const selectedDue=String(selected.adjustedDueDate||selected.dueDate).slice(0,10);
                start.min=selectedStart;start.max=selectedDue;due.min=selectedStart;due.max=selectedDue;start.required=true;due.required=true;
                if(!task){start.value=selectedStart<periodStart?periodStart:selectedStart;due.value=selectedDue>periodEnd?periodEnd:selectedDue;}
                if(isKpiManager()&&assignmentMode)assignmentMode.value='unassigned';syncDelegation();
            }
            else{start.removeAttribute('min');start.removeAttribute('max');due.removeAttribute('min');due.removeAttribute('max');start.required=isMaster;due.required=isMaster;}
            renderLoadPreview();
        });
        dialog.querySelectorAll('[name="startDate"],[name="dueDate"],[name="priority"],[name="taskCategory"]').forEach((input)=>input.addEventListener('change',renderLoadPreview));
        syncKpiIndividualOptions(task?.kpiAssignmentId || '');
        syncDelegation();
        syncKpiLink();
        syncRoutineSchedule();
        parentSelect?.dispatchEvent(new Event('change'));
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
                ${field('dueDate','Due Date Baru (opsional)','',{type:'date',help:'Kosongkan agar sistem otomatis menambah deadline efektif sesuai jumlah hari Hold yang disetujui.'})}
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
        const parent = state.tasks.find((item) => item.id === task.parentTaskId);
        const performance = task.performance;
        showDialog({
            eyebrow: 'Task Scheduler', title: task.title,
            body: `<dl class="bimws-detail-grid">
                <div><dt>Jenis</dt><dd>${escapeHtml(task.taskKind === 'master' ? 'Master Task' : task.taskKind === 'subtask' ? 'Subtask' : 'Standalone')}</dd></div><div><dt>Master Task</dt><dd>${escapeHtml(parent?.title||'-')}</dd></div><div><dt>Project</dt><dd>${escapeHtml(task.projectName||'-')}</dd></div>
                <div><dt>PIC</dt><dd>${escapeHtml(task.taskKind==='master'?'Belum dibagi':(task.picName||'-'))}</dd></div><div><dt>Start</dt><dd>${formatDate(task.startDate)}</dd></div><div><dt>Due Efektif</dt><dd>${formatDate(task.adjustedDueDate||task.dueDate)}</dd></div>
                <div><dt>Baseline Due</dt><dd>${formatDate(task.baselineDueDate)}</dd></div><div><dt>Hold Disetujui</dt><dd>${task.approvedHoldDays||0} hari</dd></div><div><dt>Priority</dt><dd>${escapeHtml(task.priority)}</dd></div>
                ${task.isRoutine?`<div><dt>Jadwal Rutin</dt><dd>Setiap ${escapeHtml(routineWeekdayLabels[task.routineWeekday==null?(parseDateOnly(task.startDate)?.getDay()??1):Number(task.routineWeekday)])}</dd></div>`:''}
                <div><dt>Register</dt><dd>${registerBadge(task.intakeStatus)}</dd></div><div><dt>Status</dt><dd>${badge(task.status)}</dd></div><div><dt>Progress</dt><dd>${task.progressPercent}%</dd></div>
                <div><dt>Penugasan</dt><dd>${task.delegatedByName ? `Delegasi oleh ${escapeHtml(task.delegatedByName)}${task.delegatedAt ? ` / ${formatDateTime(task.delegatedAt)}` : ''}` : 'Task langsung / usulan staff'}</dd></div>
                ${task.holdReason ? `<div><dt>Hold</dt><dd>${escapeHtml(task.holdByName || '-')} ${task.holdAt ? `/ ${formatDateTime(task.holdAt)}` : ''}</dd></div><div><dt>Target Resume</dt><dd>${formatDate(task.holdResumeTargetDate)}</dd></div><div><dt>Start Again</dt><dd>${task.resumedAt ? `${escapeHtml(task.resumedByName || '-')} / ${formatDateTime(task.resumedAt)}` : '-'}</dd></div>` : ''}
            </dl>${performance?`<div class="bimws-performance-detail"><h3>Task Performance Score: ${performance.totalScore}</h3><div><span>Schedule <b>${performance.scheduleScore??'-'}</b></span><span>Completion <b>${performance.completionScore}</b></span><span>Quality <b>${performance.qualityScore}</b></span><span>Worklog <b>${performance.worklogScore}</b></span></div><p>${performance.lateDays?`${performance.lateDays} hari melewati deadline efektif.`:performance.earlyDays?`Selesai ${performance.earlyDays} hari lebih cepat dari target.`:'Sesuai jadwal efektif.'}</p></div>`:''}<div class="mt-3"><h3>Deskripsi</h3><p>${escapeHtml(task.description||'-')}</p></div>${task.holdReason?`<div class="mt-3"><h3>Catatan hold</h3><p>${escapeHtml(task.holdReason)}</p>${task.holdImpactNote?`<p><strong>Dampak:</strong> ${escapeHtml(task.holdImpactNote)}</p>`:''}${holdUrgentTaskLabel(task)?`<p><strong>Task urgent:</strong> ${escapeHtml(holdUrgentTaskLabel(task))}</p>`:''}${task.resumeNote?`<p><strong>Start again:</strong> ${escapeHtml(task.resumeNote)}</p>`:''}</div>`:''}${task.intakeReviewNote?`<div class="mt-3"><h3>Catatan register</h3><p>${escapeHtml(task.intakeReviewNote)}</p></div>`:''}${task.reviewNote?`<div class="mt-3"><h3>Catatan review</h3><p>${escapeHtml(task.reviewNote)}</p></div>`:''}`,
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
        const masterCarryField = isKpiManager()
            ? field('includeMasters','Master Task outstanding',true,{type:'checkbox',full:true,checkboxLabel:'Bawa juga Master Task yang belum selesai'})
            : '';
        showDialog({
            eyebrow:'Task Scheduler',title:'Carry Forward Outstanding',
            body:`<p>Salin pekerjaan outstanding dari <strong>${formatMonth(sourcePeriod)}</strong> ke <strong>${formatMonth(state.period)}</strong>. Item yang sudah pernah dibawa ke bulan ini tidak akan dibuat ulang.</p><div class="bimws-form-grid">${masterCarryField}${field('includeRoutine','Task rutin',false,{type:'checkbox',full:true,checkboxLabel:'Generate juga task rutin dari bulan sebelumnya'})}</div>${isKpiManager()?'<p class="bimws-dialog-note"><strong>Master Task:</strong> kelanjutan dibuat dengan jadwal satu bulan penuh dan progress awal 0%. Subtask lama tetap tersimpan sebagai histori; buat subtask bulan aktif pada Master hasil carry.</p>':''}`,
            submitLabel:'Carry Forward',
            onSubmit:async(formData)=>{
                const created=await api('/tasks/carry-forward',{method:'POST',body:JSON.stringify({sourcePeriod,targetPeriod:state.period,includeRoutine:formData.has('includeRoutine'),includeMasters:isKpiManager()&&formData.has('includeMasters')})});
                const masterCount=created.filter((task)=>task.taskKind==='master').length;
                const taskCount=created.length-masterCount;
                toast(masterCount?`${masterCount} Master Task dan ${taskCount} task dibawa ke ${formatMonth(state.period)}.`:`${taskCount} task dibawa ke ${formatMonth(state.period)}.`);
                await loadTasks(true);
            }
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
        if(scope==='gabungan')return 'Koordinasi Gabungan';
        if(scope==='other')return 'External';
        return 'Divisi BIM HO';
    }

    function meetingGroupLabel(row){
        const scope=meetingField(row,'scope_type','scopeType','kantor');
        const project=String(meetingField(row,'project_name','projectName','')).trim();
        if(scope==='proyek')return project||'Project - Tanpa Nama Project';
        if(scope==='gabungan')return 'Semua Proyek';
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
        const groupOrder=['Divisi BIM HO','Project','Koordinasi Gabungan','External'];
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

    async function refreshMeetingProjectContexts(){
        try{
            state.meetingProjectContexts=await api('/meeting-project-contexts');
        }catch(error){
            if(!state.meetingProjectContexts.length)toast('Riwayat nama project belum dapat dimuat. Nama project tetap bisa ditulis manual.',true);
        }
    }

    function meetingProjectPicker(projects,selected=[]){
        const selectedKeys=new Set(selected.map((name)=>String(name).toLocaleLowerCase('id-ID')));
        return `<div class="bimws-field bimws-field-full bimws-project-picker" data-meeting-combined hidden>
            <div class="bimws-project-picker-head"><label>Project dalam koordinasi gabungan</label><span>${projects.length} dari riwayat risalah</span></div>
            ${projects.length?`<div class="bimws-project-options">${projects.map((name,index)=>`<label class="bimws-project-option" for="meeting-project-${index}"><input id="meeting-project-${index}" type="checkbox" name="projectNames" value="${escapeHtml(name)}" ${!selected.length||selectedKeys.has(name.toLocaleLowerCase('id-ID'))?'checked':''}><span>${escapeHtml(name)}</span></label>`).join('')}</div>`:'<div class="bimws-project-empty">Belum ada nama project pada riwayat risalah. Tambahkan melalui kolom di bawah.</div>'}
            <label for="meeting-additional-projects">Project tambahan (opsional)</label>
            <textarea id="meeting-additional-projects" name="additionalProjectsText" placeholder="Satu nama project per baris"></textarea>
            <small>Rapat gabungan menyimpan seluruh project terpilih sebagai satu konteks koordinasi pada waktu yang sama.</small>
        </div>`;
    }

    function newMeetingRow(section='progress',rowType='item',value={}){
        const random=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return {key:value.key||`minute-${random}`,section,rowType,...value};
    }

    function meetingRowsFromRecord(meeting={}){
        const stored=Array.isArray(meeting.meeting_rows)?meeting.meeting_rows:[];
        if(stored.length)return stored.map((row,index)=>newMeetingRow(row.section||'progress',row.rowType||row.row_type||'item',{
            key:row.key||`stored-${index}`,
            description:row.description||'',
            actionOwnerName:row.actionOwnerName||row.action_owner_name||'',
            plannedDueDate:String(row.plannedDueDate||row.planned_due_date||'').slice(0,10),
            reviewerName:row.reviewerName||row.reviewer_name||'',
            reviewResult:row.reviewResult||row.review_result||'',
            signatureDate:String(row.signatureDate||row.signature_date||'').slice(0,10)
        }));
        const rows=[];
        const legacy=[
            ['progress','item',meeting.weekly_progress||meeting.meeting_summary||''],
            ['progress','item',meeting.constraints_problems?`Kendala / Permasalahan: ${meeting.constraints_problems}`:''],
            ['progress','item',meeting.meeting_issues?`Issue: ${meeting.meeting_issues}`:''],
            ['progress','item',meeting.action_plan?`Action Plan: ${meeting.action_plan}`:''],
            ['agreement','item',meeting.agreements||meeting.decisions||'']
        ];
        legacy.forEach(([section,rowType,description])=>{if(description)rows.push(newMeetingRow(section,rowType,{description}));});
        return rows;
    }

    function meetingRowControl(row){
        const resultItems=[['','Belum ditetapkan'],['open','Open'],['in_progress','Proses'],['closed','Closed'],['cancelled','Dibatalkan']];
        return `<article class="bimws-minute-entry ${row.rowType==='heading'?'is-heading':''}" data-meeting-row data-section="${escapeHtml(row.section)}" data-row-key="${escapeHtml(row.key)}">
            <div class="bimws-minute-entry-main"><div class="bimws-minute-entry-tools"><select data-minute-field="rowType" aria-label="Jenis baris"><option value="item" ${row.rowType==='item'?'selected':''}>Item tindak lanjut</option><option value="heading" ${row.rowType==='heading'?'selected':''}>Subjudul / kelompok</option></select><button type="button" class="bimws-icon-btn is-danger" data-remove-meeting-row title="Hapus baris" aria-label="Hapus baris"><i class="fas fa-trash"></i></button></div><textarea data-minute-field="description" rows="2" placeholder="Pembahasan, progress, atau kesepakatan...">${escapeHtml(row.description||'')}</textarea></div>
            <input data-minute-field="actionOwnerName" value="${escapeHtml(row.actionOwnerName||'')}" placeholder="Nama / initial" aria-label="Oleh">
            <input type="date" data-minute-field="plannedDueDate" value="${escapeHtml(row.plannedDueDate||'')}" aria-label="Rencana selesai">
            <input data-minute-field="reviewerName" value="${escapeHtml(row.reviewerName||'')}" placeholder="Nama / initial" aria-label="Reviewer">
            <select data-minute-field="reviewResult" aria-label="Hasil review">${resultItems.map(([value,label])=>`<option value="${value}" ${value===(row.reviewResult||'')?'selected':''}>${label}</option>`).join('')}</select>
            <input type="date" data-minute-field="signatureDate" value="${escapeHtml(row.signatureDate||'')}" aria-label="Paraf tanggal">
        </article>`;
    }

    function meetingRowsSection(section,label,rows){
        const sectionRows=rows.filter((row)=>row.section===section);
        const initial=sectionRows.length?sectionRows:[newMeetingRow(section,'item')];
        return `<section class="bimws-minute-editor-section" data-meeting-section="${section}"><div class="bimws-minute-section-label"><strong>${escapeHtml(label)}</strong><button type="button" class="bimws-btn bimws-btn-secondary" data-add-meeting-row="${section}"><i class="fas fa-plus"></i>Tambah Baris</button></div><div class="bimws-minute-entry-list" data-meeting-row-list="${section}">${initial.map(meetingRowControl).join('')}</div></section>`;
    }

    function attendeeText(meeting,status){
        return (meeting?.attendees||[]).filter((item)=>item.attendance_status===status).map((item)=>[item.name,item.initial].filter(Boolean).join(' | ')).join('\n');
    }

    function parseAttendees(value,status){
        return String(value||'').split(/\r?\n/).map((line)=>{const [name,initial]=line.split('|').map((part)=>part.trim());return{name,initial,attendanceStatus:status};}).filter((item)=>item.name);
    }

    function collectMeetingRows(dialog){
        return [...dialog.querySelectorAll('[data-meeting-row]')].map((element,index)=>{
            const value=(name)=>element.querySelector(`[data-minute-field="${name}"]`)?.value?.trim()||'';
            const rowType=value('rowType')||'item';
            return{key:element.dataset.rowKey,section:element.dataset.section,rowType,description:value('description'),actionOwnerName:rowType==='heading'?'':value('actionOwnerName'),plannedDueDate:rowType==='heading'?'':value('plannedDueDate'),reviewerName:rowType==='heading'?'':value('reviewerName'),reviewResult:rowType==='heading'?'':value('reviewResult'),signatureDate:rowType==='heading'?'':value('signatureDate'),order:index};
        }).filter((row)=>row.description);
    }

    function meetingDocumentHtml(meeting,actions=[]){
        const rows=meetingRowsFromRecord(meeting);
        const documentRow=(row)=>`<tr class="${row.rowType==='heading'?'is-heading':''}"><td>${multilineHtml(row.description,'')}</td><td>${escapeHtml(row.actionOwnerName||'')}</td><td>${formatDate(row.plannedDueDate,'')}</td><td>${escapeHtml(row.reviewerName||'')}</td><td>${escapeHtml(statusLabels[row.reviewResult]||row.reviewResult||'')}</td><td>${formatDate(row.signatureDate,'')}</td></tr>`;
        const section=(key,label)=>`<tr class="is-section"><td colspan="6">${escapeHtml(label)}</td></tr>${rows.filter((row)=>row.section===key).map(documentRow).join('')||'<tr><td colspan="6" class="is-empty">Belum diisi</td></tr>'}`;
        const carried=actions.filter((action)=>action.section_type==='carried_forward');
        const outstanding=carried.map((action)=>documentRow({description:action.description,actionOwnerName:action.action_owner_name,plannedDueDate:action.planned_due_date,reviewerName:action.reviewer_name,reviewResult:action.status,signatureDate:action.review_date})).join('')||'<tr><td colspan="6" class="is-empty">Tidak ada outstanding.</td></tr>';
        return `<div class="bimws-minute-detail-table"><table><thead><tr><th>Tindak-lanjut hasil rapat</th><th>Oleh</th><th>Renc. selesai</th><th>Reviewer</th><th>Hasil</th><th>Paraf, Tgl</th></tr></thead><tbody><tr class="is-band"><td colspan="6">RISALAH SAAT INI</td></tr>${section('progress','A. LAPORAN PROGRESS PEKERJAAN STAFF BIM')}${section('agreement','B. KESEPAKATAN RAPAT')}<tr class="is-band"><td colspan="6">RISALAH SEBELUMNYA YANG MASIH DALAM PROSES</td></tr>${outstanding}</tbody></table></div>`;
    }

    function meetingOutstandingFormSection(meeting){
        const carried=(meeting?.actions||[]).filter((action)=>action.section_type==='carried_forward');
        return `<div class="bimws-minute-outstanding">
            <div class="bimws-minute-band">RISALAH SEBELUMNYA YANG MASIH DALAM PROSES</div>
            <p>Harus ditetapkan tindak-lanjut hasil pembahasan rapat hingga risalah ini dalam status "Closed".</p>
            ${meeting
                ?(carried.length?`<div class="bimws-outstanding-list">${carried.map((action)=>`<div><span>${escapeHtml(action.description)}</span><small>${escapeHtml(action.source_meeting_no||'Risalah sebelumnya')} · ${formatDate(action.source_meeting_date)} · ${escapeHtml(statusLabels[action.status]||action.status)}</small></div>`).join('')}</div>`:'<div class="bimws-outstanding-empty"><i class="fas fa-circle-check"></i>Tidak ada outstanding yang dibawa ke draft ini.</div>')
                :`${field('carryForward','Outstanding action Risalah',true,{type:'checkbox',full:true,checkboxLabel:'Bawa action dari risalah sebelumnya yang masih Open / In Progress'})}<div class="bimws-outstanding-preview" data-meeting-outstanding-preview></div>`}
        </div>`;
    }

    async function renderMeetingOutstandingPreview(dialog){
        const checkbox=dialog.querySelector('[name="carryForward"]');
        const preview=dialog.querySelector('[data-meeting-outstanding-preview]');
        if(!checkbox||!preview)return;
        preview.hidden=!checkbox.checked;
        if(!checkbox.checked)return;
        const scopeType=dialog.querySelector('[name="scopeType"]')?.value||'kantor';
        const projectName=dialog.querySelector('[name="projectName"]')?.value.trim()||'';
        if(scopeType==='proyek'&&!projectName){
            preview.innerHTML='<p>Pilih nama project untuk melihat action dari risalah sebelumnya.</p>';
            return;
        }
        const params=new URLSearchParams({
            before:dialog.querySelector('[name="meetingDate"]')?.value||new Date().toISOString().slice(0,10),
            scopeType,
            projectName
        });
        const requestKey=params.toString();
        preview.dataset.requestKey=requestKey;
        preview.innerHTML='<p><i class="fas fa-spinner fa-spin"></i> Memuat action dari riwayat risalah...</p>';
        try{
            const actions=await api(`/meeting-actions/outstanding?${params}`);
            if(preview.dataset.requestKey!==requestKey)return;
            preview.innerHTML=actions.length?`<div class="bimws-outstanding-source"><i class="fas fa-file-lines"></i><div><strong>${actions.length} action dari Risalah Rapat</strong><small>Bukan aktivitas Task Scheduler. Action berikut akan disalin ke draft baru.</small></div></div><div class="bimws-outstanding-list">${actions.map((action)=>`<div><span>${escapeHtml(action.description)}</span><small>${escapeHtml(action.source_meeting_no||'Risalah')} · ${formatDate(action.source_meeting_date)} · ${escapeHtml(action.source_project_name||meetingScopeLabel(action.source_scope_type))}${action.created_task_id?' · sudah terhubung ke task':''}</small></div>`).join('')}</div>`:'<div class="bimws-outstanding-empty"><i class="fas fa-circle-check"></i>Tidak ada action Risalah sebelumnya yang masih Open / In Progress untuk konteks ini.</div>';
        }catch(error){
            if(preview.dataset.requestKey===requestKey)preview.innerHTML=`<p class="text-danger">${escapeHtml(error.message)}</p>`;
        }
    }

    async function openMeetingForm(meeting=null){
        await refreshMeetingProjectContexts();
        const storedProjects=Array.isArray(meeting?.project_names)?meeting.project_names:[];
        const knownProjects=[...new Set([...state.meetingProjectContexts,...storedProjects,meeting?.scope_type==='proyek'?meeting.project_name:''].filter(Boolean))].sort((left,right)=>left.localeCompare(right,'id-ID'));
        const rows=meetingRowsFromRecord(meeting||{});
        const scopeItems=[{value:'kantor',label:'Kantor Pusat / Internal BIM'},{value:'proyek',label:'Satu Proyek'},{value:'gabungan',label:'Koordinasi Gabungan / Semua Proyek'},{value:'other',label:'Lainnya / Eksternal'}];
        const scopeOptions=scopeItems.map((item)=>`<option value="${item.value}" ${item.value===(meeting?.scope_type||'kantor')?'selected':''}>${item.label}</option>`).join('');
        const dialog=showDialog({
            eyebrow:'FRM.NKE.01.06',title:meeting?'Edit Draft Risalah':'Risalah Rapat Baru',
            body:`<div class="bimws-meeting-form">
                <section class="bimws-minute-sheet" aria-label="Form Risalah Rapat FRM.NKE.01.06">
                    <div class="bimws-minute-letterhead">
                        <div class="bimws-minute-logo"><img src="../img/icons/trimmed/logo_nke_trim.png" alt="Nusa Konstruksi Enjiniring"></div>
                        <div class="bimws-minute-title">R I S A L A H</div>
                        <div class="bimws-minute-docmeta"><b>DOK.NO.</b><span>: FRM.NKE.01.06</span><b>REVISI</b><span>: A (27/01/23)</span><b>AMAND.</b><span>: -</span></div>
                        <div class="bimws-minute-note"><b>NOTE:</b> ITEM RISALAH SEBELUMNYA YANG MASIH DALAM PROSES / BELUM CLOSED, HARUS DIMUNCULKAN KEMBALI DALAM ITEM TINDAK-LANJUT RISALAH BERIKUTNYA / SAAT INI</div>
                    </div>
                    <div class="bimws-minute-meta-row is-rapat"><b>RAPAT</b><select name="scopeType">${scopeOptions}</select><b>No</b><div class="bimws-minute-number"><strong>${escapeHtml(meeting?.meeting_no||'Otomatis')}</strong><small>(No urut/Kode Bag./Bl-Th)</small></div><b>HALAMAN: otomatis</b></div>
                    <div class="bimws-minute-meta-row is-subject"><b>PERIHAL</b><input name="subject" value="${escapeHtml(meeting?.subject||'')}" required placeholder="Perihal rapat"><b>Ktr/Proyek</b><div data-meeting-single-project><input name="projectName" value="${escapeHtml(meeting?.scope_type==='gabungan'?'':meeting?.project_name||'')}" list="meeting-project-suggestions" autocomplete="off" placeholder="Nama project / context"><datalist id="meeting-project-suggestions">${knownProjects.map((name)=>`<option value="${escapeHtml(name)}"></option>`).join('')}</datalist></div></div>
                    ${meetingProjectPicker(knownProjects,storedProjects)}
                    <div class="bimws-minute-identity">
                        <div class="bimws-minute-schedule"><label><b>H A R I / TANGGAL</b><input type="date" name="meetingDate" value="${meeting?.meeting_date?String(meeting.meeting_date).slice(0,10):new Date().toISOString().slice(0,10)}" required></label><label><b>WAKTU</b><span><input type="time" name="startTime" value="${escapeHtml(meeting?.start_time||'')}"><i>s.d.</i><input type="time" name="endTime" value="${escapeHtml(meeting?.end_time||'')}"></span></label><label><b>TEMPAT</b><input name="place" value="${escapeHtml(meeting?.place||'')}" required placeholder="Tempat / media rapat"></label></div>
                        <label class="bimws-minute-approval"><b>DILAPORKAN</b><input name="reportedByName" value="${escapeHtml(meeting?.reported_by_name||state.access.user.name)}" placeholder="Nama"><input name="reportedByPosition" value="${escapeHtml(meeting?.reported_by_position||'')}" placeholder="Jabatan"></label>
                        <label class="bimws-minute-approval"><b>MENGETAHUI</b><input name="acknowledgedByName" value="${escapeHtml(meeting?.acknowledged_by_name||'')}" placeholder="Nama"><input name="acknowledgedByPosition" value="${escapeHtml(meeting?.acknowledged_by_position||'')}" placeholder="Jabatan"></label>
                        <div class="bimws-minute-references"><label><b>Dept./Div.</b><input name="departmentDivision" value="${escapeHtml(meeting?.department_division||'Engineering / BIM')}"></label><strong>Referensi:</strong><label><b>MEMO/FAX/SURAT NO.</b><input name="referenceMemoNo" value="${escapeHtml(meeting?.reference_memo_no||'')}"></label><label><b>AGENDA NO.</b><input name="referenceAgendaNo" value="${escapeHtml(meeting?.reference_agenda_no||'')}"></label><label><b>ARSIP NO.</b><input name="referenceArchiveNo" value="${escapeHtml(meeting?.reference_archive_no||'')}"></label></div>
                    </div>
                    <div class="bimws-minute-attendees"><label><b>PESERTA RAPAT :</b><textarea name="presentAttendeesText" rows="3" placeholder="Satu peserta per baris: Nama | Initial">${escapeHtml(attendeeText(meeting,'present'))}</textarea><span>CC:</span><input name="ccText" value="${escapeHtml(meeting?.cc_text||'')}" placeholder="Nama penerima CC"></label><label><b>TIDAK HADIR :</b><textarea name="absentAttendeesText" rows="4" placeholder="Satu peserta per baris: Nama | Initial">${escapeHtml(attendeeText(meeting,'absent'))}</textarea></label></div>
                    <div class="bimws-minute-columns"><b>TINDAK-LANJUT HASIL RAPAT</b><b>Oleh<br><small>(Nama / Initial)</small></b><b>Renc. Waktu<br><small>(selesai)</small></b><b>Oleh<br><small>(Nama / Initial)</small></b><b>Hasil<br><small>(Proses / Closed)</small></b><b>Paraf, Tgl</b></div>
                    <div class="bimws-minute-band">RISALAH SAAT INI</div>
                    ${meetingRowsSection('progress','A. LAPORAN PROGRESS PEKERJAAN STAFF BIM :',rows)}
                    ${meetingRowsSection('agreement','B. KESEPAKATAN RAPAT',rows)}
                    ${meetingOutstandingFormSection(meeting)}
                </section>
            </div>`,
            submitLabel:meeting?'Simpan Draft':'Buat Draft Risalah',
            onSubmit:async(formData)=>{
                const payload=formJson(formData,['carryForward']);
                payload.meetingRows=collectMeetingRows(dialog);
                if(!payload.meetingRows.length)throw new Error('Isi minimal satu baris risalah sebelum menyimpan draft.');
                payload.weeklyProgress=payload.meetingRows.filter((row)=>row.section==='progress').map((row)=>row.description).join('\n');
                payload.agreements=payload.meetingRows.filter((row)=>row.section==='agreement').map((row)=>row.description).join('\n');
                payload.constraintsProblems='';payload.meetingIssues='';payload.actionPlan='';
                const additional=String(payload.additionalProjectsText||'').split(/\r?\n/).map((name)=>name.trim()).filter(Boolean);
                payload.projectNames=payload.scopeType==='gabungan'
                    ?[...new Set([...formData.getAll('projectNames'),...additional])]
                    :[];
                delete payload.additionalProjectsText;
                if(payload.scopeType==='kantor')payload.projectName='';
                if(payload.scopeType==='gabungan'){
                    payload.projectName='';
                    if(!payload.projectNames.length)throw new Error('Pilih minimal satu project untuk rapat koordinasi gabungan.');
                }
                payload.attendees=[...parseAttendees(payload.presentAttendeesText,'present'),...parseAttendees(payload.absentAttendeesText,'absent')];
                delete payload.presentAttendeesText;delete payload.absentAttendeesText;
                const saved=meeting
                    ?await api(`/meetings/${meeting.id}`,{method:'PUT',body:JSON.stringify(payload)})
                    :await api('/meetings',{method:'POST',body:JSON.stringify(payload)});
                toast('Risalah disimpan.');
                await loadMeetings(true);
                if(!meeting&&saved?.id)setTimeout(()=>openMeetingDetail(saved.id),0);
            }
        });
        const scopeSelect=dialog.querySelector('[name="scopeType"]');
        const projectInput=dialog.querySelector('[name="projectName"]');
        const combined=dialog.querySelector('[data-meeting-combined]');
        const single=dialog.querySelector('[data-meeting-single-project]');
        const syncScope=()=>{
            const scope=scopeSelect.value;
            combined.hidden=scope!=='gabungan';
            single.hidden=!['proyek','other'].includes(scope);
            projectInput.required=scope==='proyek';
            renderMeetingOutstandingPreview(dialog);
        };
        scopeSelect.onchange=syncScope;
        projectInput.onchange=()=>renderMeetingOutstandingPreview(dialog);
        projectInput.onblur=()=>renderMeetingOutstandingPreview(dialog);
        dialog.querySelector('[name="meetingDate"]').onchange=()=>renderMeetingOutstandingPreview(dialog);
        const carryForward=dialog.querySelector('[name="carryForward"]');
        if(carryForward)carryForward.onchange=()=>renderMeetingOutstandingPreview(dialog);
        dialog.addEventListener('click',(event)=>{
            const add=event.target.closest('[data-add-meeting-row]');
            if(add){const section=add.dataset.addMeetingRow;dialog.querySelector(`[data-meeting-row-list="${section}"]`).insertAdjacentHTML('beforeend',meetingRowControl(newMeetingRow(section,'item')));return;}
            const remove=event.target.closest('[data-remove-meeting-row]');
            if(remove)remove.closest('[data-meeting-row]').remove();
        });
        dialog.addEventListener('change',(event)=>{
            if(event.target.matches('[data-minute-field="rowType"]'))event.target.closest('[data-meeting-row]').classList.toggle('is-heading',event.target.value==='heading');
        });
        syncScope();
    }

    async function openMeetingDetail(id){
        const meeting=await api(`/meetings/${id}`);
        const actions=meeting.actions||[];
        const attendees=meeting.attendees||[];
        const projectNames=Array.isArray(meeting.project_names)?meeting.project_names:[];
        const contextLabel=meeting.scope_type==='gabungan'?(projectNames.join(', ')||'Semua Proyek'):(meeting.project_name||meetingScopeLabel(meeting.scope_type));
        const actionRows=actions.length?`<table class="bimws-table"><thead><tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${actions.map((action)=>`<tr><td>${escapeHtml(action.description)}${action.section_type==='carried_forward'?`<span class="bimws-table-sub">Dibawa dari ${escapeHtml(action.source_meeting_no||'risalah sebelumnya')}${action.source_meeting_date?` · ${formatDate(action.source_meeting_date)}`:''}</span>`:''}</td><td>${escapeHtml(action.action_owner_name||'-')}</td><td>${formatDate(action.planned_due_date)}</td><td>${badge(action.status)}</td><td><div class="bimws-row-actions">${(isOwn(action.action_owner_user_id)||isDivisionHead())?actionButton('fa-pen','Update action','meeting-action-update',action.id):''}${!action.created_task_id&&canWrite()?actionButton('fa-list-check','Buat task','meeting-action-task',action.id):''}</div></td></tr>`).join('')}</tbody></table>`:emptyState('Belum ada action item.');
        showDialog({
            eyebrow:meeting.meeting_no,title:meeting.subject,
            body:`<dl class="bimws-detail-grid"><div><dt>Tanggal</dt><dd>${formatDate(meeting.meeting_date)}</dd></div><div><dt>Tempat</dt><dd>${escapeHtml(meeting.place||'-')}</dd></div><div><dt>Konteks</dt><dd>${escapeHtml(meetingScopeLabel(meeting.scope_type))}</dd></div><div><dt>Project</dt><dd>${escapeHtml(contextLabel)}</dd></div><div><dt>Status</dt><dd>${badge(meeting.status)}</dd></div><div><dt>Waktu</dt><dd>${escapeHtml([meeting.start_time,meeting.end_time].filter(Boolean).join(' – ')||'-')}</dd></div></dl>${meetingDocumentHtml(meeting,actions)}<div class="mt-3"><h3>Peserta</h3><p>${attendees.length?attendees.map((item)=>`${escapeHtml(item.name)} (${escapeHtml(item.attendance_status)})`).join(', '):'-'}</p></div><div class="mt-3"><div class="bimws-panel-head"><div><h3>Action Item Terstruktur</h3><p>Owner, due date, review, dan closure untuk Action Plan serta outstanding.</p></div>${canWrite()&&meeting.status!=='closed'?`<button type="button" class="bimws-btn bimws-btn-secondary" data-meeting-add-action="${meeting.id}"><i class="fas fa-plus"></i>Action</button>`:''}</div><div class="bimws-table-wrap">${actionRows}</div></div>`,
            onSubmit:null,
            secondary:[
                {action:'print',label:'Print / PDF',handler:()=>printMeeting(meeting)},
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

    function meetingDayLabel(value){if(!value)return'';return new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date(`${String(value).slice(0,10)}T00:00:00+07:00`)).toUpperCase();}
    function meetingLongDate(value){if(!value)return'';return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(`${String(value).slice(0,10)}T00:00:00+07:00`));}
    function meetingPrintTime(value){return value?String(value).slice(0,5).replace(':','.'):' ';}

    function meetingPrintItems(meeting){
        const rows=meetingRowsFromRecord(meeting);
        const manual=(meeting.actions||[]).filter((action)=>action.section_type!=='carried_forward');
        const carried=(meeting.actions||[]).filter((action)=>action.section_type==='carried_forward');
        const known=new Set(rows.map((row)=>row.description.trim().toLocaleLowerCase('id-ID')));
        const actionRows=manual.filter((action)=>!known.has(String(action.description||'').trim().toLocaleLowerCase('id-ID'))).map((action)=>({section:'progress',rowType:'item',description:action.description,actionOwnerName:action.action_owner_name,plannedDueDate:action.planned_due_date,reviewerName:action.reviewer_name,reviewResult:action.status,signatureDate:action.review_date}));
        const item=(row)=>({kind:row.rowType==='heading'?'heading':'item',description:row.description||'',owner:row.actionOwnerName||'',due:row.plannedDueDate||'',reviewer:row.reviewerName||'',result:row.reviewResult||'',signed:row.signatureDate||''});
        return [
            {kind:'band',description:'RISALAH SAAT INI'},
            {kind:'section',description:'A.    LAPORAN PROGRESS PEKERJAAN STAFF BIM :'},
            ...rows.filter((row)=>row.section==='progress').map(item),...actionRows.map(item),
            {kind:'section',description:'B.    KESEPAKATAN RAPAT'},
            ...rows.filter((row)=>row.section==='agreement').map(item),
            {kind:'previousBand',description:'RISALAH SEBELUMNYA YANG MASIH DALAM PROSES'},
            {kind:'instruction',description:'Harus ditetapkan tindak-lanjut hasil pembahasan rapat hingga risalah ini dalam status "Closed"'},
            ...carried.map((action)=>item({description:action.description,actionOwnerName:action.action_owner_name,plannedDueDate:action.planned_due_date,reviewerName:action.reviewer_name,reviewResult:action.status,signatureDate:action.review_date}))
        ];
    }

    function meetingPrintItemHeight(item){if(item.kind==='band'||item.kind==='previousBand')return 7;if(item.kind==='section')return 6;if(item.kind==='instruction')return 6;const lines=Math.max(1,Math.ceil(String(item.description||'').length/82));return Math.max(6.5,3.8*lines+2.2);}

    function paginateMeetingPrint(items){
        const capacities=[169,210];const pages=[[]];let used=0;
        items.forEach((item)=>{
            let pageIndex=pages.length-1;let capacity=capacities[Math.min(pageIndex,1)];const height=meetingPrintItemHeight(item);
            if((item.kind==='previousBand'&&pageIndex===0)||(used+height>capacity&&pages[pageIndex].length)){pages.push([]);used=0;pageIndex++;capacity=capacities[1];}
            pages[pageIndex].push({...item,height});used+=height;
        });
        while(pages.length<2)pages.push([]);
        return pages.map((page,index)=>{
            const capacity=capacities[Math.min(index,1)];let total=page.reduce((sum,item)=>sum+item.height,0);
            while(total+6.4<=capacity){page.push({kind:'blank',description:'',height:6.4});total+=6.4;}
            if(capacity-total>2)page.push({kind:'blank',description:'',height:capacity-total});
            return page;
        });
    }

    function printMeetingRow(item){
        const classes=`print-minute-row is-${item.kind}`;
        const result=statusLabels[item.result]||item.result||'';
        return `<div class="${classes}" style="min-height:${item.height}mm"><div>${multilineHtml(item.description,'')}</div><div>${escapeHtml(item.owner||'')}</div><div>${formatDate(item.due,'')}</div><div>${escapeHtml(item.reviewer||'')}</div><div>${escapeHtml(result)}</div><div>${formatDate(item.signed,'')}</div></div>`;
    }

    function printMeetingHeader(meeting,pageNumber,pageCount){
        const projectNames=Array.isArray(meeting.project_names)?meeting.project_names:[];
        const projectContext=meeting.scope_type==='kantor'?'KANTOR PUSAT':meeting.scope_type==='gabungan'?(projectNames.join(', ')||'SEMUA PROYEK'):(meeting.project_name||'').toUpperCase();
        const meetingContext=meeting.scope_type==='kantor'?'Internal BIM HO':meeting.scope_type==='gabungan'?'Koordinasi Gabungan':meeting.project_name||meetingScopeLabel(meeting.scope_type);
        const time=[meetingPrintTime(meeting.start_time),meetingPrintTime(meeting.end_time)].filter((value)=>value.trim()).join(' - ');
        const logoUrl=new URL('../img/icons/trimmed/logo_nke_trim.png',location.href).href;
        return `<header class="print-minute-header"><div class="print-letterhead"><div class="print-logo"><img src="${logoUrl}" alt="NKE"></div><div class="print-title">R I S A L A H</div><div class="print-docmeta"><span>DOK.NO.</span><b>: FRM.NKE.01.06</b><span>REVISI</span><b>: A (27/01/23)</b><span>AMAND.</span><b>: -</b></div><div class="print-note"><b>NOTE:</b> ITEM RISALAH SEBELUMNYA YANG MASIH DALAM PROSES / BELUM CLOSED, HARUS DIMUNCULKAN<br>KEMBALI DALAM ITEM TINDAK-LANJUT RISALAH BERIKUTNYA/SAAT INI</div></div><div class="print-meta-row is-rapat"><b>RAPAT</b><strong>${escapeHtml(meetingContext)}</strong><b>No</b><span>${escapeHtml(meeting.meeting_no||'')}<i>(No urut/Kode Bag./Bl-Th)</i></span><b>HALAMAN: ${pageNumber} dr ${pageCount}</b></div><div class="print-meta-row is-subject"><b>PERIHAL</b><strong>${escapeHtml(meeting.subject||'')}</strong><b>Ktr/Proyek<small>(Coret/hilangkan<br>yang tidak perlu)</small></b><strong>${escapeHtml(projectContext)}</strong></div><div class="print-identity"><div class="print-schedule"><p><b>H A R I</b><strong>${meetingDayLabel(meeting.meeting_date)}</strong></p><p><b>TANGGAL</b><strong>${escapeHtml(meetingLongDate(meeting.meeting_date))}</strong></p><p><b>WAKTU</b><strong>${escapeHtml(time)}${time?' WIB':''}</strong></p><p><b>TEMPAT</b><strong>${escapeHtml(meeting.place||'')}</strong></p></div><div class="print-approval"><b>DILAPORKAN</b><span>${escapeHtml(meeting.reported_by_name||'')}</span><i>Jab.: ${escapeHtml(meeting.reported_by_position||'')}</i></div><div class="print-approval"><b>MENGETAHUI</b><span>${escapeHtml(meeting.acknowledged_by_name||'')}</span><i>Jab.: ${escapeHtml(meeting.acknowledged_by_position||'')}</i></div><div class="print-references"><p><b>Dept./Div.</b><strong>${escapeHtml(meeting.department_division||'')}</strong></p><h4>Referensi:</h4><p><b>- MEMO/FAX/SURAT NO.</b><strong>${escapeHtml(meeting.reference_memo_no||'')}</strong></p><p><b>- AGENDA NO.</b><strong>${escapeHtml(meeting.reference_agenda_no||'')}</strong></p><p><b>- ARSIP NO.</b><strong>${escapeHtml(meeting.reference_archive_no||'')}</strong></p></div></div></header>`;
    }

    function printMeetingParticipants(meeting){
        const present=(meeting.attendees||[]).filter((item)=>item.attendance_status==='present');
        const absent=(meeting.attendees||[]).filter((item)=>item.attendance_status==='absent');
        const presentText=present.map((item,index)=>`${index+1}. ${escapeHtml(item.name)}${item.initial?` (${escapeHtml(item.initial)})`:''}`).join(', ');
        const absentText=absent.length?absent.map((item,index)=>`<span>${index+1}. ${escapeHtml(item.name)}${item.initial?` (${escapeHtml(item.initial)})`:''}</span>`).join(''):'<span>1.</span><span>3.</span><span>2.</span><span>4.</span>';
        return `<section class="print-participants"><div><b>PESERTA RAPAT :</b><p>${presentText}</p><strong>CC: ${escapeHtml(meeting.cc_text||'')}</strong></div><div><b>TIDAK HADIR :</b><p>${absentText}</p></div></section>`;
    }

    function printMeetingColumnHeader(){return `<div class="print-column-header"><b class="main">TINDAK-LANJUT HASIL RAPAT</b><b class="action">TINDAKAN/ <i>Action</i></b><b class="review">TINJAUAN/ <i>Review</i></b><b class="c2">Oleh<small>(Nama / Initial)</small></b><b class="c3">Renc. Waktu<small>(selesai)</small></b><b class="c4">Oleh<small>(Nama / Initial)</small></b><b class="c5">Hasil<small>(Proses / Closed)</small></b><b class="c6">Paraf, Tgl</b></div>`;}

    function printMeeting(meeting){
        const popup=window.open('','_blank');if(!popup)return toast('Popup diblokir browser.',true);popup.opener=null;
        const pages=paginateMeetingPrint(meetingPrintItems(meeting));
        const pageHtml=pages.map((items,index)=>`<article class="print-page">${printMeetingHeader(meeting,index+1,pages.length)}<main class="print-page-body ${index===0?'is-first':''}">${index===0?`${printMeetingParticipants(meeting)}${printMeetingColumnHeader()}`:''}<div class="print-minute-rows">${items.map(printMeetingRow).join('')}</div></main><footer><span>© PT NUSA KONSTRUKSI ENJINIRING Tbk</span><span>Rec. File: KTR.01N01_0123.doc/HFS:DD</span><span>Dok : FRM.NKE.01.06, Auth : DD</span></footer></article>`).join('');
        popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(meeting.meeting_no||'Risalah Rapat')}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#ddd;color:#000;font-family:Arial,sans-serif}body{counter-reset:page}.print-page{position:relative;width:210mm;height:297mm;margin:0 auto;background:#fff;break-after:page;overflow:hidden}.print-minute-header{position:absolute;top:10mm;left:15.5mm;width:187mm;height:61.5mm;font-size:2.6mm}.print-letterhead{display:grid;grid-template-columns:52mm 108mm 27mm;grid-template-rows:22mm 19.5mm;border:.55mm solid #111}.print-logo{display:grid;place-items:center}.print-logo img{width:43mm;max-height:17mm}.print-title{display:grid;place-items:center;font-size:8mm;font-weight:800;letter-spacing:2.6mm}.print-docmeta{display:grid;grid-template-columns:11mm 1fr;align-content:center;font-size:2.1mm}.print-note{grid-column:1/-1;padding:1.4mm 4.8mm;color:#c00000;font-size:3mm;font-weight:800;line-height:1.2;text-align:left}.print-meta-row{display:grid;border-inline:.55mm solid #111;border-bottom:.3mm solid #111}.print-meta-row>*{display:flex;align-items:center;padding:.8mm 1.5mm;border-right:.25mm solid #777}.print-meta-row>*:last-child{border-right:0}.print-meta-row.is-rapat{grid-template-columns:18.5mm 104mm 7mm 40mm 17.5mm;height:6.5mm}.print-meta-row.is-rapat strong{font-size:4.2mm}.print-meta-row.is-rapat span{font-weight:700}.print-meta-row.is-rapat i{display:block;margin-left:2mm;color:#0070c0;font-size:1.8mm}.print-meta-row.is-subject{grid-template-columns:18.5mm 104mm 22mm 42.5mm;height:25.5mm}.print-meta-row.is-subject>strong{font-size:3.3mm}.print-meta-row.is-subject b small{display:block;color:#0070c0;font-size:1.8mm;font-style:italic}.print-identity{display:grid;grid-template-columns:57mm 32.5mm 32.5mm 65mm;height:42.5mm;border-inline:.55mm solid #111;border-bottom:.55mm solid #111}.print-identity>*{border-right:.25mm solid #777}.print-schedule p,.print-references p{display:grid;grid-template-columns:18.5mm 1fr;align-items:center;height:8mm;margin:0;border-bottom:.2mm dotted #777}.print-schedule b,.print-schedule strong,.print-references b,.print-references strong{padding:0 1.5mm}.print-approval{display:flex;flex-direction:column;padding:1.4mm}.print-approval span{margin-top:auto;font-weight:700}.print-approval i{font-weight:700}.print-references h4{height:7mm;margin:0;padding:1mm 1.5mm;font-size:3.2mm}.print-references p{grid-template-columns:32mm 1fr;height:7.2mm}.print-page-body{position:absolute;top:72.5mm;left:15.5mm;width:187mm}.print-page-body.is-first{top:76mm}.print-participants{display:grid;grid-template-columns:65.5% 34.5%;height:17mm;margin-bottom:2mm;border:.55mm solid #111}.print-participants>div{padding:1.4mm;border-right:.3mm solid #777}.print-participants>div:last-child{padding:.8mm;border-right:0}.print-participants b{display:block;font-size:3.4mm}.print-participants>div:last-child>b{margin:-.2mm 0 1mm;padding:.6mm;background:#111;color:#fff}.print-participants p{margin:1mm 0;font-size:2.6mm}.print-participants>div:last-child p{display:grid;grid-template-columns:1fr 1fr;gap:.7mm}.print-participants strong{display:block;margin-top:auto}.print-column-header{display:grid;grid-template-columns:65.5fr 9.4fr 6.7fr 5.4fr 8fr 5fr;grid-template-rows:6mm 14mm;height:20mm;border:.55mm solid #111}.print-column-header>*{display:grid;place-items:center;border-right:.3mm solid #111;border-bottom:.3mm solid #111;text-align:center;font-size:2.7mm}.print-column-header small{display:block;font-weight:400;font-style:italic}.print-column-header i{font-weight:400}.print-column-header .main{grid-column:1;grid-row:1/3;font-size:4mm}.print-column-header .action{grid-column:2/4}.print-column-header .review{grid-column:4/7}.print-column-header .c2{grid-column:2}.print-column-header .c3{grid-column:3}.print-column-header .c4{grid-column:4}.print-column-header .c5{grid-column:5}.print-column-header .c6{grid-column:6}.print-minute-row{display:grid;grid-template-columns:65.5fr 9.4fr 6.7fr 5.4fr 8fr 5fr;border-inline:.55mm solid #111}.print-minute-row>div{padding:1mm;border-right:.25mm solid #555;border-bottom:.2mm dotted #555;font-size:2.6mm;line-height:1.22}.print-minute-row>div:not(:first-child){display:grid;place-items:center;text-align:center}.print-minute-row.is-band,.print-minute-row.is-previousBand{background:#bfbfbf;font-size:3.5mm;font-weight:800}.print-minute-row.is-section{font-weight:800}.print-minute-row.is-heading{font-weight:800}.print-minute-row.is-instruction>div:first-child{color:#0070c0;font-style:italic;font-weight:700}.print-minute-row.is-blank>div{padding:0}.print-page footer{position:absolute;left:13.3mm;right:8.5mm;bottom:4.8mm;display:flex;justify-content:space-between;font-size:2.1mm;font-style:italic}@media print{html,body{background:#fff}.print-page{margin:0;box-shadow:none}}<\/style></head><body>${pageHtml}<script>window.onload=()=>Promise.all([...document.images].map((img)=>img.complete?Promise.resolve():new Promise((resolve)=>{img.onload=img.onerror=resolve}))).then(()=>setTimeout(()=>window.print(),180))<\/script></body></html>`);popup.document.close();
        const printLayoutFix=popup.document.createElement('style');
        printLayoutFix.textContent=`
            .print-page{break-after:auto;page-break-after:auto}
            .print-minute-header{top:10.5mm;left:15.3mm;width:187.6mm;height:61.7mm;font-size:2.45mm}
            .print-letterhead{grid-template-columns:52mm 108mm 27.6mm;grid-template-rows:11mm 9mm}
            .print-logo img{width:42mm;max-height:10mm}
            .print-title{font-size:7.05mm;letter-spacing:.2mm;white-space:nowrap;transform:translateX(-5.3mm)}
            .print-docmeta{grid-template-columns:11.5mm minmax(0,1fr);font-size:2.1mm;line-height:1.05;white-space:nowrap;overflow:visible}
            .print-docmeta span,.print-docmeta b{min-width:0;padding:0;font-size:2.1mm}
            .print-docmeta b{display:inline-block;width:118%;transform:scaleX(.85);transform-origin:left center}
            .print-note{padding:.7mm 4.8mm;font-size:2.85mm;line-height:1.17}
            .print-meta-row>*{min-width:0;overflow:hidden}
            .print-meta-row>b{font-size:3.17mm;line-height:1}
            .print-meta-row.is-rapat{grid-template-columns:18.5mm 104mm 7mm 40mm 18.1mm;height:6.5mm}
            .print-meta-row.is-rapat strong{font-size:4.23mm;white-space:nowrap}
            .print-meta-row.is-rapat>span{display:grid;grid-template-columns:22mm 16mm;align-items:center;padding:.35mm 1mm;font-size:2.6mm;line-height:1.02;white-space:nowrap}
            .print-meta-row.is-rapat>span i{display:block;margin:0;font-size:1.65mm;line-height:1.05;white-space:normal}
            .print-meta-row.is-rapat>b:last-child{font-size:2.82mm;line-height:1.05;white-space:normal}
            .print-meta-row.is-subject{grid-template-columns:18.5mm 104mm 22mm 43.1mm;height:12.7mm}
            .print-meta-row.is-subject>strong{font-size:3.17mm;line-height:1.05;white-space:normal}
            .print-meta-row.is-subject>b:nth-child(3){display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:.3mm;line-height:1}
            .print-meta-row.is-subject>b:nth-child(3) small{margin:0;font-size:2.1mm;line-height:1.05;white-space:normal}
            .print-identity{grid-template-columns:57mm 32.5mm 32.5mm 65.6mm;height:21.2mm}
            .print-schedule p{grid-template-columns:18.5mm 1fr;height:5.3mm;font-size:2.45mm}
            .print-schedule b{font-size:2.45mm;white-space:nowrap}
            .print-schedule strong{font-size:2.82mm;white-space:nowrap}
            .print-approval{padding:1mm;font-size:2.45mm;line-height:1.05;overflow:hidden}
            .print-approval>b,.print-approval>span{font-size:2.45mm;line-height:1.05;white-space:normal}
            .print-approval>i{font-size:2.1mm;line-height:1.05;white-space:normal}
            .print-references{overflow:hidden}
            .print-references p{grid-template-columns:35mm minmax(0,1fr);height:3.9mm;font-size:2.45mm;line-height:1.02}
            .print-references p:first-child{grid-template-columns:21mm minmax(0,1fr);height:5.1mm;font-size:3.17mm}
            .print-references p:first-child b,.print-references p:first-child strong{font-size:3.17mm;white-space:nowrap}
            .print-references p:not(:first-child) b,.print-references p:not(:first-child) strong{padding:0 1.5mm;font-size:2.45mm;white-space:nowrap}
            .print-references h4{height:4.4mm;padding:.35mm 1.5mm;font-size:3.17mm;line-height:1}
            .print-page-body{left:15.6mm;width:187mm}
            .print-participants{margin-bottom:1mm;font-size:2.45mm}
            .print-participants>div:first-child{display:flex;flex-direction:column;padding:.5mm 1.4mm}
            .print-participants b{font-size:2.84mm}
            .print-participants strong{font-size:2.45mm;line-height:1.05}
            .print-column-header{grid-template-rows:5.5mm 13.5mm;height:19mm}
            .print-column-header .main{font-size:3.5mm}
            .print-page footer{left:13.3mm;right:8.5mm}
        `;
        popup.document.head.appendChild(printLayoutFix);
        const printLogoUrl=new URL('../img/icons/trimmed/logo_nke_trim.png',location.href).href;
        fetch(printLogoUrl,{credentials:'same-origin'}).then((response)=>response.blob()).then((blob)=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);})).then((dataUrl)=>{popup.document.querySelectorAll('.print-logo img').forEach((image)=>{image.src=dataUrl;});}).catch(()=>{});
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
        const divisionResult=data.division||{};
        return `<div class="bimws-kpi-overview"><div class="bimws-kpi-summary"><div><p>KPI Departemen</p><strong>Acuan</strong><small>${department?.indicators.length||0} indikator / score dihitung eksternal</small></div><div><p>Score Divisi BIM</p><strong>${divisionResult.measuredIndicatorCount?kpiPercent(divisionResult.score):'-'}</strong><small>${divisionResult.measuredIndicatorCount||0}/${divisionResult.indicatorCount||0} indikator terukur</small></div><div><p>Kelengkapan</p><strong>${divisionResult.completenessPercent||0}%</strong><small>Bobot KPI Divisi yang sudah terukur</small></div><div><p>Achievement Maks.</p><strong>${contract.maxAchievementPercent}%</strong><small>Berlaku per indikator</small></div></div><div class="bimws-kpi-contract"><h4>Batas Perhitungan</h4><dl><div><dt>KPI Departemen</dt><dd>${escapeHtml(contract.departmentScore)}</dd></div><div><dt>KPI Divisi</dt><dd>${escapeHtml(contract.divisionScore)}</dd></div><div><dt>KPI Individu</dt><dd>${escapeHtml(contract.individualScore)}</dd></div><div><dt>Pembagi nol</dt><dd>${escapeHtml(contract.zeroDenominator)}</dd></div></dl><div class="bimws-table-actions"><button type="button" class="bimws-btn bimws-btn-secondary" data-action="kpi-export-external-json"><i class="fas fa-file-code"></i> Paket External JSON</button><button type="button" class="bimws-btn bimws-btn-secondary" data-action="kpi-export-external-csv"><i class="fas fa-file-csv"></i> Paket External CSV</button></div></div></div>`;
    }

    function renderDivisionPerformance(data){
        const result=data.division;
        if(!result)return emptyState('Perhitungan KPI Divisi belum tersedia.','fa-chart-line');
        const rows=result.indicators||[];
        return `<div class="bimws-kpi-summary bimws-kpi-summary-compact"><div><p>Score Divisi BIM</p><strong>${result.measuredIndicatorCount?kpiPercent(result.score):'-'}</strong><small>Maksimum 120%</small></div><div><p>Indikator Terukur</p><strong>${result.measuredIndicatorCount}/${result.indicatorCount}</strong><small>${result.completenessPercent}% bobot terukur</small></div><div><p>Boundary</p><strong>Divisi</strong><small>Tidak menghitung score Departemen</small></div></div><div class="bimws-table-wrap"><table class="bimws-table"><thead><tr><th>KPI Divisi / Induk Departemen</th><th>Measurement</th><th>Achievement</th><th>Task Factor</th><th>Bobot</th><th>Weighted Score</th></tr></thead><tbody>${rows.map((item)=>`<tr><td><span class="bimws-kpi-code">${escapeHtml(item.indicatorCode)} → ${escapeHtml(item.parentIndicatorCode||'-')}</span><span class="bimws-table-title">${escapeHtml(item.indicatorName)}</span><span class="bimws-table-sub">${escapeHtml(item.relationType)} / ${escapeHtml(item.aggregationMethod)}</span></td><td>${item.result.measurement==null?'-':kpiValue(item.result.measurement,item.targetUnit==='percent'?'ratio':item.targetUnit)}<span class="bimws-table-sub">${item.result.numerator??'-'} / ${item.result.denominator??'-'}</span></td><td>${item.result.adjustedAchievement==null?'-':kpiPercent(item.result.adjustedAchievement)}${item.result.rawAchievement==null?'':`<span class="bimws-table-sub">Raw ${kpiPercent(item.result.rawAchievement)}</span>`}</td><td>${item.result.measured?kpiPercent(item.result.taskPerformanceFactor):'-'}</td><td>${kpiPercent(item.weight)}</td><td><strong>${item.result.weightedScore==null?'-':kpiPercent(item.result.weightedScore)}</strong></td></tr>`).join('')}</tbody></table></div>`;
    }

    function kpiValue(value,unit){return value==null?'-':`${Number(value).toLocaleString('id-ID',{maximumFractionDigits:2})} ${escapeHtml(unit||'')}`;}
    function kpiPercent(value){return `${Math.round(Number(value||0)*100)}%`;}
    function kpiMeasurementItems(){return [{value:'quantity',label:'Quantity'},{value:'milestone',label:'Milestone'},{value:'ratio',label:'Ratio'},{value:'quality_acceptance',label:'Quality Acceptance'},{value:'sla',label:'SLA'}];}
    function safeExternalLink(value){try{const url=new URL(value,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:'#';}catch(_){return '#';}}

    function openKpiProgramForm(program){
        showDialog({eyebrow:'KPI Program',title:program.name,body:`<div class="bimws-form-grid">${field('targetValue','Target Operasional',program.targetValue??'',{type:'number',min:0.0001,step:'0.01',required:true})}${field('targetUnit','Unit',program.targetUnit,{required:true})}${field('availabilityStatus','Staff Claim',program.availabilityStatus,{type:'select',items:[{value:'open',label:'Open'},{value:'closed',label:'Closed'}]})}</div>`,submitLabel:'Simpan Target',onSubmit:async(formData)=>{await api(`/kpi/programs/${program.id}`,{method:'PUT',body:JSON.stringify(formJson(formData))});toast('Konfigurasi program disimpan.');await loadKpi(true);}});
    }

    function kpiClaimTaskPreview(recommendation){
        const titles=recommendation?.taskTitles||[];
        if(!titles.length)return '';
        return `<div class="bimws-field bimws-field-full bimws-claim-task-preview"><label>Task selesai yang diajukan</label><ul>${titles.map((title)=>`<li>${escapeHtml(title)}</li>`).join('')}</ul>${(recommendation.taskIds?.length||0)>titles.length?`<small>+${recommendation.taskIds.length-titles.length} task lainnya</small>`:''}<p><i class="fas fa-lock"></i> Task baru tertaut dan score baru dihitung setelah approval Kepala Divisi.</p></div>`;
    }

    function openKpiAssignmentForm(program,recommendation=null){
        const manager=isKpiManager();
        const staffField=manager?`<div class="bimws-field"><label>Staff BIM</label><select name="staffUserId" required>${staffUserOptions()}</select></div>`:'';
        const programTargetField=manager?field('programTargetValue','Target Program Divisi',program.targetValue??'',{type:'number',min:0.0001,step:'0.01',required:true}):'';
        const suggestedTarget=recommendation?.suggestedActual||'';
        const suggestedTitle=recommendation?`Kontribusi ${program.name}`:'';
        showDialog({eyebrow:manager?'Delegasi KPI':recommendation?'Rekomendasi KPI':'Take Program',title:program.name,body:`<div class="bimws-form-grid">${staffField}${programTargetField}${field('title','Komitmen / Program Personal',suggestedTitle,{required:true,full:true})}${field('measurementType','Measurement',program.allocationMode==='milestone'?'milestone':'quantity',{type:'select',items:kpiMeasurementItems()})}${field('targetValue','Target Kontribusi Staff',suggestedTarget,{type:'number',min:0.0001,step:'0.01',required:true})}${field('targetUnit','Unit',program.targetUnit,{required:true})}${field('proposedWeight','Bobot (%)',Math.round(program.indicatorWeight*100),{type:'number',min:0.01,max:100,step:'0.01',required:true})}${field('dueDate','Due Date','',{type:'date'})}${field('expectedEvidence','Expected Evidence',recommendation?'Lampirkan evidence task dan output yang mendukung klaim.':'',{type:'textarea',full:true})}${kpiClaimTaskPreview(recommendation)}</div>`,submitLabel:manager?'Delegasikan':'Ajukan untuk Approval',onSubmit:async(formData)=>{const payload=formJson(formData);if(manager){await api(`/kpi/programs/${program.id}`,{method:'PUT',body:JSON.stringify({targetValue:payload.programTargetValue,targetUnit:payload.targetUnit,availabilityStatus:program.availabilityStatus})});}delete payload.programTargetValue;payload.programId=program.id;payload.taskIds=recommendation?.taskIds||[];payload.proposedWeight=Number(payload.proposedWeight)/100;await api('/kpi/assignments',{method:'POST',body:JSON.stringify(payload)});toast(manager?'Kontribusi KPI didelegasikan.':'Kontribusi KPI diajukan dan menunggu approval Kepala Divisi.');await loadKpi(true);}});
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

    function openKpiActualForm(assignment,recommendation=null){showDialog({eyebrow:recommendation?'Claim Score KPI':'Realisasi KPI',title:assignment.title,body:`<div class="bimws-form-grid">${field('actualValue',`Actual (${assignment.targetUnit})`,recommendation?.suggestedActual??assignment.verifiedActual??'',{type:'number',min:0,step:'0.01',required:true,help:recommendation?'Nilai ini adalah rekomendasi awal dari task selesai. Periksa sesuai unit KPI.':''})}${field('evidenceLink','Evidence Link',recommendation?.evidenceLink||assignment.actualEvidenceLink,{type:'url',required:true})}${field('note','Catatan Actual',assignment.actualNote,{type:'textarea',full:true})}${kpiClaimTaskPreview(recommendation)}</div>`,submitLabel:'Ajukan ke Kepala Divisi',onSubmit:async(formData)=>{const payload=formJson(formData);payload.taskIds=recommendation?.taskIds||[];await api(`/kpi/assignments/${assignment.id}/submit-actual`,{method:'POST',body:JSON.stringify(payload)});toast('Claim score diajukan; score belum bertambah sebelum approval Kepala Divisi.');await loadKpi(true);}});}

    function openKpiVerifyForm(assignment){showDialog({eyebrow:'Verifikasi Actual',title:assignment.title,body:`<div class="bimws-form-grid">${field('verifiedActual',`Actual Terverifikasi (${assignment.targetUnit})`,assignment.submittedActual,{type:'number',min:0,step:'0.01',required:true})}${field('note','Catatan Verifikasi','',{type:'textarea',full:true})}<div class="bimws-field bimws-field-full"><label>Evidence</label><a href="${escapeHtml(safeExternalLink(assignment.actualEvidenceLink))}" target="_blank" rel="noopener noreferrer">Buka evidence <i class="fas fa-arrow-up-right-from-square"></i></a></div></div>`,submitLabel:'Approve Actual',onSubmit:async(formData)=>{const payload=formJson(formData);payload.action='approve';await api(`/kpi/assignments/${assignment.id}/verify`,{method:'POST',body:JSON.stringify(payload)});toast('Actual KPI diverifikasi.');await loadKpi(true);},secondary:[{action:'revision',label:'Kembalikan Revisi',handler:async(dialog,form)=>{try{const payload=formJson(new FormData(form));payload.action='revision';await api(`/kpi/assignments/${assignment.id}/verify`,{method:'POST',body:JSON.stringify(payload)});dialog.close();toast('Actual dikembalikan.');await loadKpi(true);}catch(error){toast(error.message,true);}}}]});}

    function kpiAssignmentActions(item){const actions=[];if(isDivisionHead()&&['pending_approval','revision_required'].includes(item.status))actions.push(actionButton('fa-user-check','Review kontribusi','kpi-review',item.id));if(isOwn(item.staffUserId)&&item.status==='revision_required')actions.push(actionButton('fa-pen','Revisi kontribusi','kpi-revise',item.id));if(isOwn(item.staffUserId)&&['approved','achieved'].includes(item.status))actions.push(actionButton('fa-arrow-up-from-bracket','Ajukan actual','kpi-actual',item.id));if(isDivisionHead()&&item.status==='verification_pending')actions.push(actionButton('fa-clipboard-check','Verifikasi actual','kpi-verify',item.id));return actions.join('')||'-';}

    function renderKpiGuidance(data){
        const items=data.guidance?.items||[];
        if(!items.length)return `<div class="bimws-kpi-gate"><i class="fas fa-shield-check"></i><div><strong>Score terkunci approval</strong><span>Hanya actual yang disetujui Kepala Divisi yang menambah score KPI individu dan Divisi BIM.</span></div></div>`;
        return `<section class="bimws-kpi-next"><header><div><span>NOTIFIKASI KPI</span><h4>Langkah Berikutnya</h4></div><small><i class="fas fa-shield-halved"></i> Approval Kepala Divisi wajib</small></header><div class="bimws-kpi-next-list">${items.map((item)=>`<article data-tone="${escapeHtml(item.tone||'neutral')}"><i class="fas ${escapeHtml(item.icon||'fa-circle-info')}"></i><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>${item.action?`<button type="button" class="bimws-btn bimws-btn-secondary" data-action="${escapeHtml(item.action)}" data-id="${escapeHtml(item.actionId||'')}">${escapeHtml(item.actionLabel||'Buka')}</button>`:''}</article>`).join('')}</div></section>`;
    }

    function renderKpiPrograms(data){
        const programs=data.programs||[];
        if(!programs.length)return emptyState('Program KPI Divisi BIM belum dikonfigurasi.','fa-diagram-project');
        const missing=programs.filter((item)=>['target_required','empty'].includes(item.coverageStatus)).length;
        const covered=programs.filter((item)=>item.coverageStatus==='covered').length;
        const pending=programs.reduce((sum,item)=>sum+item.assignments.filter((assignment)=>assignment.status==='pending_approval').length,0);
        return `<div class="bimws-kpi-summary bimws-kpi-summary-compact"><div><p>Program</p><strong>${programs.length}</strong><small>Siklus ${data.year}</small></div><div><p>Covered</p><strong>${covered}</strong><small>Target telah teralokasi</small></div><div><p>Gap</p><strong>${missing}</strong><small>Target atau PIC belum lengkap</small></div><div><p>Pending Approval</p><strong>${pending}</strong><small>Usulan staff</small></div></div><div class="bimws-table-wrap"><table class="bimws-table bimws-kpi-program-table bimws-coverage-table"><thead><tr><th>Program / KPI</th><th>Target</th><th>Coverage</th><th>Achievement Divisi</th><th>Execution</th><th>PIC</th><th>Aksi</th></tr></thead><tbody>${programs.map((program)=>{const canTake=!isKpiManager()&&program.claimPolicy==='staff_proposable'&&program.availabilityStatus==='open'&&!program.assignments.some((item)=>isOwn(item.staffUserId)&&item.status!=='rejected');const actions=[isKpiManager()?actionButton('fa-sliders','Konfigurasi target','kpi-program-config',program.id):'',isKpiManager()?actionButton('fa-user-plus','Delegasikan','kpi-program-assign',program.id):'',canTake?actionButton('fa-hand','Raise hand / Ajukan kontribusi','kpi-program-assign',program.id):''].join('');return `<tr><td><span class="bimws-kpi-code">${escapeHtml(program.code)} / ${escapeHtml(program.indicatorCode)}</span><span class="bimws-table-title">${escapeHtml(program.name)}</span><span class="bimws-table-sub">${escapeHtml(program.indicatorName)}</span></td><td><strong>${kpiValue(program.targetValue,program.targetUnit)}</strong><span class="bimws-table-sub">${escapeHtml(program.allocationMode.replaceAll('_',' '))}</span></td><td>${badge(program.coverageStatus)}<div class="bimws-coverage-meter"><span style="width:${Math.min(program.coveragePercent||0,100)}%"></span></div><small>${kpiValue(program.allocatedValue,program.targetUnit)} allocated</small></td><td><strong>${program.result?.adjustedAchievement==null?'-':kpiPercent(program.result.adjustedAchievement)}</strong><span class="bimws-table-sub">Raw ${program.result?.rawAchievement==null?'-':kpiPercent(program.result.rawAchievement)} / Task ${program.result?.measured?kpiPercent(program.result.taskPerformanceFactor):'-'}</span><span class="bimws-table-sub">${kpiValue(program.verifiedValue,program.targetUnit)} verified</span></td><td>${badge(program.executionStatus)}<span class="bimws-table-sub">${Number(program.mappedTaskCount||0)} task mapped</span></td><td>${program.assignments.length?program.assignments.map((item)=>`<span class="bimws-assignee">${escapeHtml(item.staffName)} ${badge(item.status)}</span>`).join(''):'-'}</td><td><div class="bimws-table-actions">${actions||'-'}</div></td></tr>`;}).join('')}</tbody></table></div>`;
    }

    function renderKpiIndividual(data){
        let cards=data.individual?.cards||[];
        if(!isKpiManager())cards=cards.filter((card)=>isOwn(card.staffUserId));
        if(!cards.length)return emptyState(state.access?.role==='staff_bim'?'KPI individu Anda belum ditetapkan.':'Belum ada scorecard KPI individu.','fa-user-check');
        return `<div class="bimws-kpi-card-list">${cards.map((card)=>`<section class="bimws-individual-card"><header><div><h4>${escapeHtml(card.staffName)}</h4><p>${card.assignments.length} program / ${Math.round(card.approvedWeight*100)}% bobot approved</p></div><div class="bimws-kpi-score"><span>Verified score</span><strong>${kpiPercent(card.score)}</strong></div></header><div class="bimws-table-wrap"><table class="bimws-table bimws-individual-table"><thead><tr><th>Program / Komitmen</th><th>Target</th><th>Bobot</th><th>Task</th><th>Actual & Score</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${card.assignments.map((item)=>`<tr><td><span class="bimws-kpi-code">${escapeHtml(item.programCode)}</span><span class="bimws-table-title">${escapeHtml(item.title)}</span><span class="bimws-table-sub">${escapeHtml(item.programName)}</span></td><td>${kpiValue(item.targetValue,item.targetUnit)}</td><td>${item.approvedWeight==null?kpiPercent(item.proposedWeight):kpiPercent(item.approvedWeight)}</td><td>${item.completedTaskCount}/${item.taskCount}${item.taskCount?`<span class="bimws-table-sub">Task factor ${kpiPercent(item.taskPerformanceFactor)}</span>`:''}</td><td>${item.verifiedActual==null?'-':kpiValue(item.verifiedActual,item.targetUnit)}${item.adjustedAchievement!=null?`<span class="bimws-table-sub">Adjusted ${kpiPercent(item.adjustedAchievement)} / Raw ${kpiPercent(item.rawAchievement)}</span>`:''}</td><td>${badge(item.status)}</td><td><div class="bimws-table-actions">${kpiAssignmentActions(item)}</div></td></tr>`).join('')}</tbody></table></div></section>`).join('')}</div>`;
    }

    function renderKpi(){
        const year=state.period.slice(0,4);
        const data=state.kpi||{year,scorecards:{},individual:{status:'empty',indicators:[]}};
        const tabs={
            overview:{title:'Overview KPI',help:`Kontrak scorecard tahun ${year}.`,content:()=>renderKpiOverview(data)},
            department:{title:'KPI Departemen',help:'Acuan resmi Departemen Engineering dari workbook referensi.',content:()=>kpiTable(data.scorecards?.department)},
            division:{title:'KPI Divisi BIM',help:'Score aktif Divisi BIM; KPI Departemen hanya menjadi lineage dan tujuan pelaporan eksternal.',content:()=>renderDivisionPerformance(data)+kpiTable(data.scorecards?.division,true)},
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
        document.getElementById('kpi-content').innerHTML=renderKpiGuidance(data)+active.content();
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

    function downloadFile(content,type,filename){const blob=new Blob([content],{type});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();URL.revokeObjectURL(link.href);}
    async function exportKpiContribution(format){
        const year=state.period.slice(0,4);
        const packet=await api(`/kpi/division-contribution?year=${year}`);
        if(format==='json'){
            downloadFile(JSON.stringify(packet,null,2),'application/json;charset=utf-8',`kpi-divisi-bim-contribution-${year}.json`);
        }else{
            const rows=[['Period','Source Division','Department KPI','Division KPI','Relation','Aggregation','Measurement','Numerator','Denominator','Raw Achievement','Task Performance Factor','Division Achievement','Division Weight','Division Weighted Score','Measured','Evidence'],...packet.contributions.map((item)=>[packet.periodYear,packet.sourceOrgUnit,`${item.departmentIndicator.code} - ${item.departmentIndicator.name}`,`${item.divisionIndicator.code} - ${item.divisionIndicator.name}`,item.divisionIndicator.relationType,item.divisionIndicator.aggregationMethod,item.measurement,item.numerator,item.denominator,item.rawAchievement,item.taskPerformanceFactor,item.divisionAchievement,item.divisionIndicator.weight,item.divisionWeightedScore,item.measured,item.evidenceLinks.join(' | ')])];
            downloadFile('\ufeff'+rows.map((row)=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8',`kpi-divisi-bim-contribution-${year}.csv`);
        }
        toast(`Paket kontribusi KPI Divisi ${format.toUpperCase()} dibuat.`);
    }

    async function handleActionClick(event){
        const quick=event.target.closest('[data-dashboard-action]');
        if(quick){const type=quick.dataset.dashboardAction;if(type==='task')openTaskForm();if(type==='worklog')await openWorklogForm();if(type==='issue')openIssueForm();return;}
        const button=event.target.closest('[data-action]');if(!button)return;
        const {action,id}=button.dataset;
        try{
            if(action==='kpi-program-config')openKpiProgramForm(state.kpi.programs.find((row)=>row.id===id));
            if(action==='kpi-program-assign')openKpiAssignmentForm(state.kpi.programs.find((row)=>row.id===id));
            if(action==='kpi-program-claim'){const recommendation=state.kpi.guidance?.items?.find((item)=>item.action===action&&item.actionId===id);openKpiAssignmentForm(state.kpi.programs.find((row)=>row.id===id),recommendation);}
            if(action==='kpi-review')openKpiReviewForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-revise')openKpiRevisionForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-actual')openKpiActualForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-claim-actual'){const recommendation=state.kpi.guidance?.items?.find((item)=>item.action===action&&item.actionId===id);openKpiActualForm(state.kpi.individual.assignments.find((row)=>row.id===id),recommendation);}
            if(action==='kpi-verify')openKpiVerifyForm(state.kpi.individual.assignments.find((row)=>row.id===id));
            if(action==='kpi-open-programs'){state.kpiTab='programs';renderKpi();}
            if(action==='kpi-export-external-json')await exportKpiContribution('json');
            if(action==='kpi-export-external-csv')await exportKpiContribution('csv');
            if(action==='task-view')openTaskDetail(state.tasks.find((row)=>row.id===id));
            if(action==='task-edit')openTaskForm(state.tasks.find((row)=>row.id===id));
            if(action==='task-add-subtask')openTaskForm(null,{taskKind:'subtask',parentTaskId:id});
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
