// Admin Panel JavaScript - Refactored for better organization
// adminbcl.js - Contains all admin panel functionality

// Admin Session Management
let isAdminLoggedIn = false;
let adminUser = null;

// Video Tags Management
let allVideos = [];
let currentSelectedVideo = null;
let savedTags = {};
let customCategories = [];

// Questions Management
let allQuestions = [];

// Users Management
let allUsers = [];

// Training Batch Management
let allTrainingBatches = [];
let currentTrainingBatch = null;
let currentTrainingBatchMembers = [];
let currentSubmissionReviewContext = null;
let currentAttendanceContext = null;

// PDF Management
let allPDFManagementData = [];
let selectedPDFManagementIds = new Set();
let filteredPDFManagementData = [];
let currentPDFManagementPage = 1;
let pdfManagementItemsPerPage = 20;

// PDF Custom Categories
let pdfCustomCategories = [];

// Video Display Management
let allDisplayVideos = [];
let displaySettings = {};
let selectedVideoIds = new Set();
let currentVideoDisplayPage = 1;
let videoDisplayItemsPerPage = 20;
let filteredVideoDisplayData = [];

// BIM Media Management
let currentSelectedFile = null;
let allMediaFiles = [];
let savedBIMTags = {};
let bimCustomCategories = {};
let allBIMTags = [];
let isScanningMedia = false;
let serverControlPollTimer = null;

// PDF Materials Management
let allPDFMaterials = [];
let currentPDFMaterialsPage = 1;
let pdfMaterialsItemsPerPage = 20;
let filteredPDFMaterialsData = [];

// DOM Content Loaded - Initialize the admin panel
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure default state: auth section visible, admin interface hidden
    ensureDefaultUIState();
    initializePasswordRecoveryForm();

    // Load saved data
    loadSavedTags();
    loadCustomCategories();

    // Check admin session
    await checkAdminSession();

    // Handle hash-based navigation
    const hash = window.location.hash.substring(1);
    if (hash && hash !== 'dashboard' && isAdminLoggedIn) {
        setTimeout(() => {
            if (hash === 'bim-media') {
                showSection(hash);
                setTimeout(() => {
                    loadBIMMedia();
                }, 50);
            } else if (hash === 'training-batches') {
                showSection(hash);
                setTimeout(() => {
                    loadTrainingBatches();
                }, 50);
            } else if (hash === 'learning-mapping') {
                showSection(hash);
                setTimeout(() => {
                    window.learningMappingQueue?.open();
                }, 50);
            } else {
                showSection(hash);
            }
        }, 100);
    }
});

function initializePasswordRecoveryForm() {
    const showButton = document.getElementById('show-password-recovery');
    const cancelButton = document.getElementById('cancel-password-recovery');
    const loginForm = document.getElementById('admin-login-form');
    const recoveryForm = document.getElementById('admin-password-recovery-form');
    const recoveryEmail = document.getElementById('recoveryEmail');
    const adminEmail = document.getElementById('adminEmail');

    if (!recoveryForm) {
        return;
    }

    if (showButton) {
        showButton.addEventListener('click', () => {
            if (loginForm) loginForm.classList.add('d-none');
            recoveryForm.classList.remove('d-none');
            if (recoveryEmail && adminEmail && adminEmail.value) {
                recoveryEmail.value = adminEmail.value;
            }
            if (recoveryEmail) recoveryEmail.focus();
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            recoveryForm.classList.add('d-none');
            if (loginForm) loginForm.classList.remove('d-none');
            recoveryForm.reset();
        });
    }

    recoveryForm.addEventListener('submit', handlePasswordRecoverySubmit);
}

async function handlePasswordRecoverySubmit(event) {
    event.preventDefault();

    const recoveryEmail = document.getElementById('recoveryEmail');
    const submitButton = document.getElementById('recovery-submit-button');
    const email = recoveryEmail ? recoveryEmail.value.trim() : '';

    if (!email) {
        alert('Email admin wajib diisi.');
        return;
    }

    const originalLabel = submitButton ? submitButton.textContent : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Mengirim...';
    }

    try {
        const response = await fetch('/api/admin/password-recovery/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            alert('Recovery gagal: ' + (result.error || 'Server tidak bisa memproses request.'));
            return;
        }

        alert(result.message || 'Jika email admin valid, link recovery akan dikirim.');
        event.target.reset();
    } catch (error) {
        alert('Terjadi kesalahan recovery: ' + error.message);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel || 'Kirim Link Recovery';
        }
    }
}

function getStoredAdminToken() {
    try {
        const storedUser = localStorage.getItem('user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const token = parsedUser?.token || localStorage.getItem('token');
        const role = (parsedUser?.role || localStorage.getItem('role') || '').toLowerCase();
        const isAdminRole = role.includes('admin') || role.includes('administrator');
        if (!token || !isAdminRole) {
            return null;
        }
        return token;
    } catch (error) {
        console.warn('Failed to read stored admin token:', error);
        return null;
    }
}

async function bridgeAdminSession() {
    const token = getStoredAdminToken();
    if (!token) {
        return false;
    }

    try {
        const response = await fetch('/api/admin/session/bridge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return !!(data && data.authenticated);
    } catch (error) {
        console.warn('Bridge admin session failed:', error);
        return false;
    }
}

// Ensure proper default UI state
function ensureDefaultUIState() {
    document.getElementById('auth-section').classList.remove('d-none');
    document.getElementById('admin-interface').classList.add('d-none');
}

function syncAdminPanelAuthState() {
    if (!window.adminPanel) {
        return;
    }

    window.adminPanel.isAdminLoggedIn = isAdminLoggedIn;
    window.adminPanel.adminUser = adminUser;

    const videosModule = window.adminPanel.modules?.get('videos')?.instance;
    if (isAdminLoggedIn && videosModule && typeof videosModule.loadPersistentData === 'function') {
        videosModule.loadPersistentData();
    }
}

// Admin login form handler
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    console.log('ðŸ” Attempting admin login:', { email: email ? 'present' : 'empty' });

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        console.log('ðŸ“¡ Admin login response:', response.status, response.statusText);

        if (response.ok) {
            const data = await response.json();
            console.log('âœ… Admin login successful:', data);
            adminUser = data.user;
            isAdminLoggedIn = true;
            syncAdminPanelAuthState();

            document.getElementById('auth-section').classList.add('d-none');
            document.getElementById('admin-interface').classList.remove('d-none');

            if (typeof updateUserUI === 'function') {
                updateUserUI();
            }

            // Show dashboard section by default after login
            showSection('dashboard');
            loadDashboardStats();
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('âŒ Admin login failed:', errorData);
            alert('Login gagal: ' + (errorData.error || 'Kredensial tidak valid'));
        }
    } catch (error) {
        console.error('âŒ Admin login error:', error);
        alert('Terjadi kesalahan login: ' + error.message);
    }
});

// Check if admin is already logged in
async function checkAdminSession() {
    try {
        console.log('ðŸ” Checking admin session...');
        const response = await fetch('/api/admin/session', { credentials: 'include' });

        if (response.ok) {
            const data = await response.json();
            console.log('ðŸ“¡ Session check response:', data);

            if (data.authenticated && data.user) {
                console.log('âœ… Admin session valid for:', data.user.username);
                adminUser = data.user;
                isAdminLoggedIn = true;
                syncAdminPanelAuthState();
                document.getElementById('auth-section').classList.add('d-none');
                document.getElementById('admin-interface').classList.remove('d-none');
                if (typeof updateUserUI === 'function') {
                    updateUserUI();
                }
                loadDashboardStats();
                return true;
            } else {
                console.log('âŒ Admin session not authenticated');
            }
        } else {
            // Handle 401 Unauthorized gracefully - this is normal when not logged in
            if (response.status === 401) {
                console.log('ðŸ”’ No active admin session (401) - this is normal');
            } else {
                console.error('âŒ Session check failed with status:', response.status);
            }
        }
    } catch (error) {
        console.error('âŒ Error checking admin session:', error);
    }
    const bridged = await bridgeAdminSession();
    if (bridged) {
        return checkAdminSession();
    }
    // If we reach here, authentication failed - ensure auth section is visible
    console.log('ðŸ”’ No valid admin session - showing auth section');
    adminUser = null;
    isAdminLoggedIn = false;
    syncAdminPanelAuthState();
    ensureDefaultUIState();
    return false;
}

// Admin logout
function adminLogout() {
    if (confirm('Yakin ingin keluar dari panel admin?')) {
        fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
            .then(() => {
                adminUser = null;
                isAdminLoggedIn = false;
                syncAdminPanelAuthState();
                document.getElementById('auth-section').classList.remove('d-none');
                document.getElementById('admin-interface').classList.add('d-none');
                document.getElementById('admin-login-form').reset();
            })
            .catch(error => console.error('Logout error:', error));
    }
}

// Toggle sidebar visibility
function toggleSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const content = document.getElementById('admin-content');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar.classList.contains('d-none') || sidebar.classList.contains('d-md-block')) {
        // Show sidebar
        sidebar.classList.remove('d-none');
        sidebar.classList.add('d-md-block');
        content.classList.remove('col-md-12');
        content.classList.add('col-md-9');
        toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    } else {
        // Hide sidebar
        sidebar.classList.add('d-none');
        sidebar.classList.remove('d-md-block');
        content.classList.remove('col-md-9');
        content.classList.add('col-md-12');
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
}

// Simple section navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.add('d-none');
    });

    // Remove active class from nav links
    document.querySelectorAll('.nav-link-modern').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    const selectedSection = document.getElementById(sectionName + '-section');
    if (!selectedSection) {
        console.warn('Admin section not found:', sectionName);
        return;
    }
    selectedSection.classList.remove('d-none');
    if (sectionName === 'server-control') {
        setTimeout(() => loadServerControlStatus(), 50);
    }

    // Add active class to clicked nav link
    if (event && event.target) {
        const activeLink = event.target.closest ? event.target.closest('.nav-link-modern') : event.target;
        if (activeLink && activeLink.classList) {
            activeLink.classList.add('active');
        }
    }
}

function getAdminFetchHeaders(extraHeaders = {}) {
    const token = getStoredAdminToken();
    return {
        ...extraHeaders,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

function formatServerSeconds(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

function setServerControlBusy(isBusy) {
    ['server-soft-restart-btn', 'server-full-restart-btn'].forEach((id) => {
        const button = document.getElementById(id);
        if (button) button.disabled = isBusy;
    });
}

function renderServerControlStatus(data, transientMessage = '') {
    const stateElement = document.getElementById('server-control-state');
    const metricsElement = document.getElementById('server-control-metrics');
    const messageElement = document.getElementById('server-control-message');
    const logElement = document.getElementById('server-control-log');
    const restart = data?.restart || {};
    const server = data?.server || data || {};
    const state = restart.state || server.status || 'unknown';

    if (stateElement) {
        stateElement.textContent = state;
        stateElement.dataset.state = state;
    }

    if (metricsElement) {
        metricsElement.innerHTML = [
            ['Backend', server.status || 'running'],
            ['Uptime', formatServerSeconds(server.uptime)],
            ['PID', server.pid || '-'],
            ['Restart', restart.requestId || '-']
        ].map(([label, value]) => `<div><span>${bclEscapeHtml(label)}</span><strong>${bclEscapeHtml(value)}</strong></div>`).join('');
    }

    if (messageElement) {
        messageElement.textContent = transientMessage || restart.message || 'Server status terbaca.';
    }

    if (logElement) {
        const lines = Array.isArray(data?.logTail) ? data.logTail : [];
        logElement.textContent = lines.length ? lines.join('\n') : 'Belum ada restart log.';
    }
}

async function fetchServerControlStatus() {
    const response = await fetch('/api/server/restart-status', {
        method: 'GET',
        credentials: 'include',
        headers: getAdminFetchHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Status server gagal (${response.status})`);
    }
    return data;
}

async function loadServerControlStatus() {
    const messageElement = document.getElementById('server-control-message');
    if (messageElement) messageElement.textContent = 'Membaca status server...';
    try {
        const data = await fetchServerControlStatus();
        renderServerControlStatus(data);
    } catch (error) {
        if (messageElement) messageElement.textContent = `Status belum terbaca: ${error.message}`;
    }
}

function startServerRestartPolling() {
    if (serverControlPollTimer) {
        clearInterval(serverControlPollTimer);
    }

    const startedAt = Date.now();
    serverControlPollTimer = setInterval(async () => {
        try {
            const data = await fetchServerControlStatus();
            renderServerControlStatus(data, 'Server kembali merespons. Memverifikasi status restart...');
            const state = data?.restart?.state || '';
            if (['healthy', 'timeout', 'failed'].includes(state) || Date.now() - startedAt > 150000) {
                clearInterval(serverControlPollTimer);
                serverControlPollTimer = null;
                setServerControlBusy(false);
                renderServerControlStatus(data, state === 'healthy' ? 'Restart selesai. Backend sudah sehat.' : (data?.restart?.message || 'Polling restart selesai.'));
            }
        } catch (error) {
            const messageElement = document.getElementById('server-control-message');
            if (messageElement) {
                messageElement.textContent = `Restart sedang berlangsung atau server belum tersedia (${Math.floor((Date.now() - startedAt) / 1000)}s).`;
            }
            if (Date.now() - startedAt > 150000) {
                clearInterval(serverControlPollTimer);
                serverControlPollTimer = null;
                setServerControlBusy(false);
                if (messageElement) messageElement.textContent = 'Polling restart timeout. Cek log/server manual jika halaman belum kembali.';
            }
        }
    }, 4000);
}

async function requestBclServerRestart(mode = 'full') {
    const fullRestart = mode === 'full';
    const confirmed = confirm(fullRestart
        ? 'Full Restart BCL akan menghentikan dan menyalakan ulang backend/nginx. Lanjutkan?'
        : 'Soft Reload hanya membersihkan cache proses backend. Lanjutkan?');
    if (!confirmed) return;

    setServerControlBusy(true);
    renderServerControlStatus({ server: { status: 'requesting', uptime: 0 }, restart: { state: 'requesting', message: 'Mengirim request restart...' }, logTail: [] });

    try {
        const response = await fetch(fullRestart ? '/api/server/restart-full' : '/api/server/restart', {
            method: 'POST',
            credentials: 'include',
            headers: getAdminFetchHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ source: 'adminbcl-server-control' })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.error || `Restart gagal (${response.status})`);
        }

        renderServerControlStatus({
            server: { status: 'scheduled', uptime: 0 },
            restart: data.restartState || { state: fullRestart ? 'scheduled' : 'soft_restart', message: data.message, requestId: data.requestId },
            logTail: []
        }, data.message || 'Restart dijadwalkan.');

        if (fullRestart) {
            startServerRestartPolling();
        } else {
            setTimeout(async () => {
                setServerControlBusy(false);
                await loadServerControlStatus();
            }, 1200);
        }
    } catch (error) {
        setServerControlBusy(false);
        const messageElement = document.getElementById('server-control-message');
        if (messageElement) messageElement.textContent = `Restart gagal: ${error.message}`;
    }
}

function bclEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatTrainingDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
}

function formatTrainingDateTime(value) {
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

function getTrainingStatusBadge(status) {
    const normalized = String(status || 'draft').toLowerCase();
    const classes = {
        draft: 'bg-secondary',
        active: 'bg-success',
        completed: 'bg-primary',
        archived: 'bg-dark'
    };
    return `<span class="badge ${classes[normalized] || 'bg-secondary'}">${bclEscapeHtml(normalized)}</span>`;
}

async function loadTrainingBatches() {
    const container = document.getElementById('training-batches-content');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mb-0">Memuat training batches...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/training/batches', {
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Request failed (${response.status})`);
        }

        const result = await response.json();
        allTrainingBatches = Array.isArray(result.data) ? result.data : [];
        renderTrainingBatches();
    } catch (error) {
        console.error('Failed to load training batches:', error);
        container.innerHTML = `
            <div class="alert alert-danger mb-0">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Gagal memuat training batches: ${bclEscapeHtml(error.message)}
            </div>
        `;
    }
}

function renderTrainingBatches() {
    const container = document.getElementById('training-batches-content');
    if (!container) return;

    if (!Array.isArray(allTrainingBatches) || allTrainingBatches.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-chalkboard-user fa-3x mb-3"></i>
                <h5>Belum ada training batch</h5>
                <p class="mb-3">Buat batch pertama untuk mulai mengikat peserta, mentor, dan learning path.</p>
                <button class="btn btn-modern-primary" onclick="showTrainingBatchModal()">
                    <i class="fas fa-plus me-2"></i>Buat Batch Baru
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Batch</th>
                        <th>Learning Path</th>
                        <th>Periode</th>
                        <th>Status</th>
                        <th>Roster</th>
                        <th>Updated</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${allTrainingBatches.map((batch) => `
                        <tr>
                            <td>
                                <div class="fw-bold">${bclEscapeHtml(batch.title)}</div>
                                <small class="text-muted">${bclEscapeHtml(batch.code || batch.id)}</small>
                            </td>
                            <td>${bclEscapeHtml(batch.learningPathId || '-')}</td>
                            <td>
                                <small>${formatTrainingDate(batch.startDate)} - ${formatTrainingDate(batch.endDate)}</small>
                            </td>
                            <td>${getTrainingStatusBadge(batch.status)}</td>
                            <td>
                                <div class="small">
                                    <span class="me-2"><i class="fas fa-users me-1"></i>${Number(batch.participantCount || 0)} peserta</span>
                                    <span class="me-2"><i class="fas fa-user-tie me-1"></i>${Number(batch.mentorCount || 0)} mentor</span>
                                    <span><i class="fas fa-clipboard-check me-1"></i>${Number(batch.reviewerCount || 0)} reviewer</span>
                                </div>
                            </td>
                            <td><small class="text-muted">${formatTrainingDate(batch.updatedAt || batch.createdAt)}</small></td>
                            <td>
                                <button class="btn btn-outline-primary btn-sm training-roster-btn" data-batch-id="${bclEscapeHtml(batch.id)}">
                                    <i class="fas fa-users me-1"></i>Roster
                                </button>
                                <button class="btn btn-outline-success btn-sm training-plan-btn" data-batch-id="${bclEscapeHtml(batch.id)}">
                                    <i class="fas fa-list-check me-1"></i>Plan
                                </button>
                                <button class="btn btn-outline-dark btn-sm training-evaluation-btn" data-batch-id="${bclEscapeHtml(batch.id)}">
                                    <i class="fas fa-table-list me-1"></i>Evaluation
                                </button>
                                <button class="btn btn-outline-warning btn-sm training-readiness-btn" data-batch-id="${bclEscapeHtml(batch.id)}">
                                    <i class="fas fa-chart-line me-1"></i>Readiness
                                </button>
                                <button class="btn btn-outline-info btn-sm training-attendance-btn" data-batch-id="${bclEscapeHtml(batch.id)}">
                                    <i class="fas fa-calendar-check me-1"></i>Attendance
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.querySelectorAll('.training-roster-btn').forEach((button) => {
        button.addEventListener('click', () => loadTrainingBatchMembers(button.dataset.batchId));
    });
    container.querySelectorAll('.training-plan-btn').forEach((button) => {
        button.addEventListener('click', () => loadTrainingPlan(button.dataset.batchId));
    });
    container.querySelectorAll('.training-evaluation-btn').forEach((button) => {
        button.addEventListener('click', () => loadBatchEvaluation(button.dataset.batchId));
    });
    container.querySelectorAll('.training-readiness-btn').forEach((button) => {
        button.addEventListener('click', () => loadBatchReadiness(button.dataset.batchId));
    });
    container.querySelectorAll('.training-attendance-btn').forEach((button) => {
        button.addEventListener('click', () => loadBatchAttendance(button.dataset.batchId));
    });
}

function showTrainingBatchModal() {
    const modalHtml = `
        <div class="modal fade" id="trainingBatchModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-chalkboard-user me-2"></i>Buat Training Batch
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="trainingBatchForm">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label">Nama Batch *</label>
                                    <input type="text" class="form-control" id="trainingBatchTitle"
                                        placeholder="Contoh: BIM Modeller Batch 01 - 2026" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Kode Batch</label>
                                    <input type="text" class="form-control" id="trainingBatchCode"
                                        placeholder="Auto jika kosong">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Learning Path</label>
                                    <select class="form-select" id="trainingBatchLearningPath">
                                        <option value="">Pilih learning path</option>
                                        <option value="bim-mindset-foundation">BIM Mindset Foundation</option>
                                        <option value="bim-governance-foundation">BIM Governance Foundation</option>
                                        <option value="bim-delivery-workflow-foundation">BIM Delivery Workflow Foundation</option>
                                        <option value="autocad-certified-user">AutoCAD Certified User</option>
                                        <option value="revit-architecture-professional">Revit Architecture Professional</option>
                                        <option value="bim-manager-certification">BIM Manager Certification</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Status</label>
                                    <select class="form-select" id="trainingBatchStatus">
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Tanggal Mulai</label>
                                    <input type="date" class="form-control" id="trainingBatchStartDate">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Tanggal Selesai</label>
                                    <input type="date" class="form-control" id="trainingBatchEndDate">
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Deskripsi</label>
                                    <textarea class="form-control" id="trainingBatchDescription" rows="3"
                                        placeholder="Tujuan batch, target peserta, atau catatan training..."></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Simpan Batch
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('trainingBatchModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('trainingBatchForm').addEventListener('submit', handleTrainingBatchSubmit);

    const modal = new bootstrap.Modal(document.getElementById('trainingBatchModal'));
    modal.show();
}

async function handleTrainingBatchSubmit(event) {
    event.preventDefault();

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';
    submitButton.disabled = true;

    const payload = {
        title: document.getElementById('trainingBatchTitle').value.trim(),
        code: document.getElementById('trainingBatchCode').value.trim(),
        learningPathId: document.getElementById('trainingBatchLearningPath').value,
        status: document.getElementById('trainingBatchStatus').value,
        startDate: document.getElementById('trainingBatchStartDate').value,
        endDate: document.getElementById('trainingBatchEndDate').value,
        description: document.getElementById('trainingBatchDescription').value.trim()
    };

    try {
        const response = await fetch('/api/training/batches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('trainingBatchModal'));
        if (modal) modal.hide();

        await loadTrainingBatches();
        alert('Training batch berhasil dibuat.');
    } catch (error) {
        console.error('Failed to create training batch:', error);
        alert('Gagal membuat training batch: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

async function loadTrainingBatchMembers(batchId) {
    const container = document.getElementById('training-batches-content');
    if (!container || !batchId) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mb-0">Memuat roster batch...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/members`, {
            credentials: 'include'
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        currentTrainingBatch = result.batch || allTrainingBatches.find((batch) => batch.id === batchId) || null;
        currentTrainingBatchMembers = Array.isArray(result.data) ? result.data : [];
        renderTrainingBatchRoster();
    } catch (error) {
        console.error('Failed to load training batch members:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Gagal memuat roster batch: ${bclEscapeHtml(error.message)}
            </div>
            <button class="btn btn-outline-secondary" onclick="loadTrainingBatches()">
                <i class="fas fa-arrow-left me-2"></i>Kembali ke daftar batch
            </button>
        `;
    }
}

function renderTrainingBatchRoster() {
    const container = document.getElementById('training-batches-content');
    if (!container || !currentTrainingBatch) return;

    const batch = currentTrainingBatch;
    const members = currentTrainingBatchMembers;

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <button class="btn btn-outline-secondary btn-sm mb-3" onclick="loadTrainingBatches()">
                    <i class="fas fa-arrow-left me-1"></i>Daftar Batch
                </button>
                <h4 class="mb-1">${bclEscapeHtml(batch.title)}</h4>
                <div class="text-muted">
                    <span class="me-3">${bclEscapeHtml(batch.code || batch.id)}</span>
                    <span class="me-3">${bclEscapeHtml(batch.learningPathId || 'No learning path')}</span>
                    ${getTrainingStatusBadge(batch.status)}
                </div>
            </div>
            <button class="btn btn-modern-primary" onclick="showBatchMemberModal()">
                <i class="fas fa-user-plus me-2"></i>Tambah Member
            </button>
            <button class="btn btn-outline-success" onclick="loadTrainingPlan('${bclEscapeHtml(batch.id)}')">
                <i class="fas fa-list-check me-2"></i>Training Plan
            </button>
        </div>

        ${members.length === 0 ? `
            <div class="text-center py-5 text-muted border rounded">
                <i class="fas fa-users fa-3x mb-3"></i>
                <h5>Roster masih kosong</h5>
                <p class="mb-3">Tambahkan participant, mentor, reviewer, atau HC observer untuk batch ini.</p>
                <button class="btn btn-modern-primary" onclick="showBatchMemberModal()">
                    <i class="fas fa-user-plus me-2"></i>Tambah Member
                </button>
            </div>
        ` : `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>User</th>
                            <th>BIM Level</th>
                            <th>Role Batch</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${members.map((member) => `
                            <tr>
                                <td>
                                    <div class="fw-bold">${bclEscapeHtml(member.username || `User #${member.userId}`)}</div>
                                    <small class="text-muted">${bclEscapeHtml(member.email || '-')}</small>
                                    <div class="small text-muted">${bclEscapeHtml(member.jobRole || '')}${member.organization ? ` - ${bclEscapeHtml(member.organization)}` : ''}</div>
                                </td>
                                <td>${bclEscapeHtml(member.bimLevel || '-')}</td>
                                <td>${getTrainingMemberRoleBadge(member.role)}</td>
                                <td>${getTrainingMemberStatusBadge(member.enrollmentStatus)}</td>
                                <td><small class="text-muted">${formatTrainingDate(member.joinedAt)}</small></td>
                                <td>
                                    <button class="btn btn-outline-danger btn-sm batch-member-delete-btn"
                                        data-member-id="${Number(member.id)}"
                                        data-member-name="${bclEscapeHtml(member.username || member.email || member.userId)}">
                                        <i class="fas fa-trash me-1"></i>Hapus
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
    `;

    container.querySelectorAll('.batch-member-delete-btn').forEach((button) => {
        button.addEventListener('click', () => deleteTrainingBatchMember(button.dataset.memberId, button.dataset.memberName));
    });
}

function getTrainingMemberRoleBadge(role) {
    const normalized = String(role || 'participant').toLowerCase();
    const classes = {
        participant: 'bg-primary',
        mentor: 'bg-success',
        reviewer: 'bg-info',
        admin: 'bg-dark',
        hc_observer: 'bg-warning text-dark'
    };
    const labels = {
        participant: 'Participant',
        mentor: 'Mentor',
        reviewer: 'Reviewer',
        admin: 'Admin',
        hc_observer: 'HC Observer'
    };
    return `<span class="badge ${classes[normalized] || 'bg-secondary'}">${labels[normalized] || bclEscapeHtml(normalized)}</span>`;
}

function getTrainingMemberStatusBadge(status) {
    const normalized = String(status || 'active').toLowerCase();
    const classes = {
        invited: 'bg-secondary',
        active: 'bg-success',
        completed: 'bg-primary',
        dropped: 'bg-danger'
    };
    return `<span class="badge ${classes[normalized] || 'bg-secondary'}">${bclEscapeHtml(normalized)}</span>`;
}

function showBatchMemberModal() {
    if (!currentTrainingBatch) {
        alert('Pilih batch lebih dulu.');
        return;
    }

    const modalHtml = `
        <div class="modal fade" id="batchMemberModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-user-plus me-2"></i>Tambah Member Batch
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="batchMemberForm">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">User ID / Email / Username *</label>
                                <input type="text" class="form-control" id="batchMemberIdentifier"
                                    placeholder="contoh: user@bcl.local atau username" required>
                                <small class="text-muted">User harus sudah terdaftar di BCL.</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Role Batch</label>
                                <select class="form-select" id="batchMemberRole">
                                    <option value="participant">Participant</option>
                                    <option value="mentor">Mentor</option>
                                    <option value="reviewer">Reviewer</option>
                                    <option value="admin">Admin</option>
                                    <option value="hc_observer">HC Observer</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Enrollment Status</label>
                                <select class="form-select" id="batchMemberStatus">
                                    <option value="active">Active</option>
                                    <option value="invited">Invited</option>
                                    <option value="completed">Completed</option>
                                    <option value="dropped">Dropped</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Simpan Member
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('batchMemberModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('batchMemberForm').addEventListener('submit', handleBatchMemberSubmit);

    const modal = new bootstrap.Modal(document.getElementById('batchMemberModal'));
    modal.show();
}

async function handleBatchMemberSubmit(event) {
    event.preventDefault();

    if (!currentTrainingBatch) return;

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';
    submitButton.disabled = true;

    const identifier = document.getElementById('batchMemberIdentifier').value.trim();
    const payload = {
        identifier,
        role: document.getElementById('batchMemberRole').value,
        enrollmentStatus: document.getElementById('batchMemberStatus').value
    };

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        if (Array.isArray(result.skipped) && result.skipped.length > 0) {
            throw new Error(`User tidak ditemukan: ${identifier}`);
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('batchMemberModal'));
        if (modal) modal.hide();

        await loadTrainingBatchMembers(currentTrainingBatch.id);
        alert('Member batch berhasil disimpan.');
    } catch (error) {
        console.error('Failed to save batch member:', error);
        alert('Gagal menyimpan member batch: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

async function deleteTrainingBatchMember(memberId, memberName) {
    if (!currentTrainingBatch || !memberId) return;

    const confirmed = confirm(`Hapus ${memberName || 'member'} dari batch ini?`);
    if (!confirmed) return;

    try {
        const response = await fetch(
            `/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/members/${encodeURIComponent(memberId)}`,
            {
                method: 'DELETE',
                credentials: 'include'
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        await loadTrainingBatchMembers(currentTrainingBatch.id);
    } catch (error) {
        console.error('Failed to delete batch member:', error);
        alert('Gagal menghapus member batch: ' + error.message);
    }
}

async function loadTrainingPlan(batchId) {
    const container = document.getElementById('training-batches-content');
    if (!container || !batchId) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mb-0">Memuat training plan...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/training-plan`, {
            credentials: 'include'
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status})`);
        }

        currentTrainingBatch = result.batch || allTrainingBatches.find((batch) => batch.id === batchId) || null;
        renderTrainingPlan(result.topics || [], result.unassignedItems || []);
    } catch (error) {
        console.error('Failed to load training plan:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Gagal memuat training plan: ${bclEscapeHtml(error.message)}
            </div>
            <button class="btn btn-outline-secondary" onclick="loadTrainingBatches()">
                <i class="fas fa-arrow-left me-2"></i>Kembali ke daftar batch
            </button>
        `;
    }
}

async function loadBatchAttendance(batchId, selectedSessionId = '') {
    const container = document.getElementById('training-batches-content');
    if (!container || !batchId) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mb-0">Memuat attendance batch...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/attendance`, {
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        currentTrainingBatch = result.batch || allTrainingBatches.find((batch) => batch.id === batchId) || null;
        currentAttendanceContext = {
            batch: result.batch,
            participants: Array.isArray(result.participants) ? result.participants : [],
            sessions: Array.isArray(result.sessions) ? result.sessions : [],
            selectedSessionId: selectedSessionId || (Array.isArray(result.sessions) && result.sessions[0] ? result.sessions[0].id : '')
        };
        renderBatchAttendance(result);
    } catch (error) {
        console.error('Failed to load batch attendance:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Gagal memuat attendance: ${bclEscapeHtml(error.message)}
            </div>
            <button class="btn btn-outline-secondary" onclick="loadTrainingBatches()">
                <i class="fas fa-arrow-left me-2"></i>Kembali ke daftar batch
            </button>
        `;
    }
}

function renderBatchAttendance(result) {
    const container = document.getElementById('training-batches-content');
    if (!container) return;

    const batch = result.batch || currentTrainingBatch || {};
    const participants = Array.isArray(result.participants) ? result.participants : [];
    const sessions = Array.isArray(result.sessions) ? result.sessions : [];
    const selectedSessionId = currentAttendanceContext?.selectedSessionId || (sessions[0] ? sessions[0].id : '');
    const selectedSession = sessions.find((session) => session.id === selectedSessionId) || sessions[0] || null;
    if (currentAttendanceContext) currentAttendanceContext.selectedSessionId = selectedSession ? selectedSession.id : '';

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <button class="btn btn-outline-secondary btn-sm mb-3" onclick="loadTrainingBatches()">
                    <i class="fas fa-arrow-left me-1"></i>Daftar Batch
                </button>
                <h4 class="mb-1">${bclEscapeHtml(batch.title || 'Batch Attendance')}</h4>
                <div class="text-muted">
                    <span class="me-3">${bclEscapeHtml(batch.code || batch.id || '')}</span>
                    ${getTrainingStatusBadge(batch.status)}
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-dark" onclick="loadBatchEvaluation('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-table-list me-2"></i>Evaluation
                </button>
                <button class="btn btn-outline-warning" onclick="loadBatchReadiness('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-chart-line me-2"></i>Readiness
                </button>
                <button class="btn btn-modern-primary" onclick="showAttendanceSessionModal()">
                    <i class="fas fa-plus me-2"></i>Tambah Session
                </button>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-4">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Participants</div>
                    <div class="fs-4 fw-bold">${participants.length}</div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Sessions</div>
                    <div class="fs-4 fw-bold">${sessions.length}</div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Recorded Sessions</div>
                    <div class="fs-4 fw-bold">${sessions.filter((session) => Number(session.recordCount || 0) > 0).length}</div>
                </div>
            </div>
        </div>

        ${sessions.length ? `
            <div class="d-flex flex-wrap gap-2 mb-3">
                ${sessions.map((session) => `
                    <button class="btn ${selectedSession && selectedSession.id === session.id ? 'btn-primary' : 'btn-outline-primary'} btn-sm"
                        onclick="selectAttendanceSession('${bclEscapeHtml(session.id)}')">
                        ${bclEscapeHtml(session.title)}
                    </button>
                `).join('')}
            </div>
            ${renderAttendanceRecordsTable(selectedSession, participants)}
        ` : `
            <div class="text-center py-5 text-muted border rounded bg-white">
                <i class="fas fa-calendar-check fa-2x mb-3"></i>
                <h5>Belum ada attendance session</h5>
                <p class="mb-3">Buat session attendance untuk mulai mencatat kehadiran peserta.</p>
                <button class="btn btn-modern-primary" onclick="showAttendanceSessionModal()">
                    <i class="fas fa-plus me-2"></i>Tambah Session
                </button>
            </div>
        `}
    `;
}

function renderAttendanceRecordsTable(session, participants) {
    if (!session) return '';
    const recordsByUser = new Map((Array.isArray(session.records) ? session.records : []).map((record) => [Number(record.userId), record]));

    return `
        <div class="content-card">
            <div class="card-header-modern">
                <div>
                    <div class="card-title-modern">
                        <i class="fas fa-calendar-check"></i>${bclEscapeHtml(session.title)}
                    </div>
                    <small class="text-muted">${formatTrainingDateTime(session.scheduledAt)} | Present ${Number(session.presentCount || 0)}, Late ${Number(session.lateCount || 0)}, Absent ${Number(session.absentCount || 0)}, Excused ${Number(session.excusedCount || 0)}</small>
                </div>
                <button class="btn btn-success btn-sm" onclick="saveAttendanceRecords()">
                    <i class="fas fa-save me-1"></i>Simpan Attendance
                </button>
            </div>
            <div class="card-body-modern">
                ${participants.length ? `
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead>
                                <tr>
                                    <th>Participant</th>
                                    <th>Status</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${participants.map((participant) => {
                                    const record = recordsByUser.get(Number(participant.userId)) || {};
                                    const status = record.status || 'present';
                                    return `
                                        <tr data-attendance-user-id="${Number(participant.userId)}">
                                            <td>
                                                <div class="fw-semibold">${bclEscapeHtml(participant.username || participant.email || participant.userId || '-')}</div>
                                                <small class="text-muted">${bclEscapeHtml(participant.email || '')}</small>
                                            </td>
                                            <td>
                                                <select class="form-select form-select-sm attendance-status">
                                                    <option value="present" ${status === 'present' ? 'selected' : ''}>Present</option>
                                                    <option value="late" ${status === 'late' ? 'selected' : ''}>Late</option>
                                                    <option value="absent" ${status === 'absent' ? 'selected' : ''}>Absent</option>
                                                    <option value="excused" ${status === 'excused' ? 'selected' : ''}>Excused</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input class="form-control form-control-sm attendance-note" value="${bclEscapeHtml(record.note || '')}" placeholder="Catatan attendance">
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="text-muted py-4">Belum ada participant aktif pada batch ini.</div>
                `}
            </div>
        </div>
    `;
}

function selectAttendanceSession(sessionId) {
    if (!currentAttendanceContext) return;
    currentAttendanceContext.selectedSessionId = sessionId;
    renderBatchAttendance({
        batch: currentAttendanceContext.batch || currentTrainingBatch,
        participants: currentAttendanceContext.participants || [],
        sessions: currentAttendanceContext.sessions || []
    });
}

function showAttendanceSessionModal() {
    if (!currentTrainingBatch) {
        alert('Pilih batch lebih dulu.');
        return;
    }

    const existingModal = document.getElementById('attendanceSessionModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="attendanceSessionModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-calendar-plus me-2"></i>Tambah Attendance Session
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="attendanceSessionForm">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Judul Session *</label>
                                <input type="text" class="form-control" id="attendanceSessionTitle" required placeholder="Contoh: Session 01 - BIM Mindset">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Jadwal</label>
                                <input type="datetime-local" class="form-control" id="attendanceSessionScheduledAt">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Meeting URL / Lokasi</label>
                                <input type="text" class="form-control" id="attendanceSessionMeetingUrl" placeholder="https://... atau ruang training">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Simpan Session
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `);

    document.getElementById('attendanceSessionForm').addEventListener('submit', handleAttendanceSessionSubmit);
    new bootstrap.Modal(document.getElementById('attendanceSessionModal')).show();
}

async function handleAttendanceSessionSubmit(event) {
    event.preventDefault();
    if (!currentTrainingBatch) return;

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';

    const payload = {
        title: document.getElementById('attendanceSessionTitle').value.trim(),
        scheduledAt: document.getElementById('attendanceSessionScheduledAt').value,
        meetingUrl: document.getElementById('attendanceSessionMeetingUrl').value.trim()
    };

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/attendance/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        const modal = bootstrap.Modal.getInstance(document.getElementById('attendanceSessionModal'));
        if (modal) modal.hide();
        await loadBatchAttendance(currentTrainingBatch.id, result.data?.id || '');
    } catch (error) {
        alert('Gagal menyimpan attendance session: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

async function saveAttendanceRecords() {
    if (!currentTrainingBatch || !currentAttendanceContext?.selectedSessionId) {
        alert('Pilih attendance session lebih dulu.');
        return;
    }

    const rows = Array.from(document.querySelectorAll('[data-attendance-user-id]'));
    const records = rows.map((row) => ({
        userId: Number(row.dataset.attendanceUserId),
        status: row.querySelector('.attendance-status')?.value || 'present',
        note: row.querySelector('.attendance-note')?.value.trim() || ''
    }));

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/attendance/sessions/${encodeURIComponent(currentAttendanceContext.selectedSessionId)}/records`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ records })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        await loadBatchAttendance(currentTrainingBatch.id, currentAttendanceContext.selectedSessionId);
        alert('Attendance berhasil disimpan.');
    } catch (error) {
        alert('Gagal menyimpan attendance: ' + error.message);
    }
}

async function loadBatchEvaluation(batchId) {
    const container = document.getElementById('training-batches-content');
    if (!container || !batchId) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mb-0">Memuat batch evaluation...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/evaluation`, {
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        currentTrainingBatch = result.batch || allTrainingBatches.find((batch) => batch.id === batchId) || null;
        renderBatchEvaluation(result);
    } catch (error) {
        console.error('Failed to load batch evaluation:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Gagal memuat batch evaluation: ${bclEscapeHtml(error.message)}
            </div>
            <button class="btn btn-outline-secondary" onclick="loadTrainingBatches()">
                <i class="fas fa-arrow-left me-2"></i>Kembali ke daftar batch
            </button>
        `;
    }
}

async function loadBatchReadiness(batchId) {
    const container = document.getElementById('training-batches-content');
    if (!container || !batchId) return;

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mb-0">Memuat readiness insight...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/readiness`, {
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        currentTrainingBatch = result.batch || allTrainingBatches.find((batch) => batch.id === batchId) || null;
        renderBatchReadiness(result);
    } catch (error) {
        console.error('Failed to load batch readiness:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Gagal memuat readiness insight: ${bclEscapeHtml(error.message)}
            </div>
            <button class="btn btn-outline-secondary" onclick="loadTrainingBatches()">
                <i class="fas fa-arrow-left me-2"></i>Kembali ke daftar batch
            </button>
        `;
    }
}

function getReadinessBadge(level) {
    const normalized = String(level || 'in_progress').toLowerCase();
    const classes = {
        ready: 'bg-success',
        on_track: 'bg-primary',
        in_progress: 'bg-secondary',
        at_risk: 'bg-warning text-dark',
        blocked: 'bg-danger'
    };
    const labels = {
        ready: 'Ready',
        on_track: 'On Track',
        in_progress: 'In Progress',
        at_risk: 'At Risk',
        blocked: 'Blocked'
    };
    return `<span class="badge ${classes[normalized] || 'bg-secondary'}">${bclEscapeHtml(labels[normalized] || normalized)}</span>`;
}

function renderBatchReadiness(result) {
    const container = document.getElementById('training-batches-content');
    if (!container) return;

    const batch = result.batch || currentTrainingBatch || {};
    const summary = result.summary || {};
    const atRisk = Array.isArray(result.atRisk) ? result.atRisk : [];
    const roleReadiness = Array.isArray(result.roleReadiness) ? result.roleReadiness : [];
    const skillGaps = Array.isArray(result.skillGaps) ? result.skillGaps : [];

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <button class="btn btn-outline-secondary btn-sm mb-3" onclick="loadTrainingBatches()">
                    <i class="fas fa-arrow-left me-1"></i>Daftar Batch
                </button>
                <h4 class="mb-1">${bclEscapeHtml(batch.title || 'Readiness Insight')}</h4>
                <div class="text-muted">
                    <span class="me-3">${bclEscapeHtml(batch.code || batch.id || '')}</span>
                    ${getTrainingStatusBadge(batch.status)}
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-dark" onclick="loadBatchEvaluation('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-table-list me-2"></i>Evaluation
                </button>
                <button class="btn btn-outline-info" onclick="loadBatchAttendance('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-calendar-check me-2"></i>Attendance
                </button>
                <button class="btn btn-outline-success" onclick="loadTrainingPlan('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-list-check me-2"></i>Plan
                </button>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-2">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Ready</div>
                    <div class="fs-4 fw-bold text-success">${Number(summary.readyCount || 0)}</div>
                    <small>${Number(summary.readinessPercent || 0)}%</small>
                </div>
            </div>
            <div class="col-md-2">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">On Track</div>
                    <div class="fs-4 fw-bold text-primary">${Number(summary.onTrackCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-2">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">In Progress</div>
                    <div class="fs-4 fw-bold">${Number(summary.inProgressCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-2">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">At Risk</div>
                    <div class="fs-4 fw-bold text-warning">${Number(summary.atRiskCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-2">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Blocked</div>
                    <div class="fs-4 fw-bold text-danger">${Number(summary.blockedCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-2">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Avg Score</div>
                    <div class="fs-4 fw-bold">${summary.averageScore == null ? '-' : Number(summary.averageScore)}</div>
                </div>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-7">
                <div class="content-card h-100">
                    <div class="card-header-modern">
                        <div class="card-title-modern">
                            <i class="fas fa-triangle-exclamation"></i>At-risk Participants
                        </div>
                    </div>
                    <div class="card-body-modern">
                        ${atRisk.length ? `
                            <div class="table-responsive">
                                <table class="table table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Participant</th>
                                            <th>Readiness</th>
                                            <th>Score</th>
                                            <th>Reasons</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${atRisk.map((row) => `
                                            <tr>
                                                <td>
                                                    <div class="fw-semibold">${bclEscapeHtml(row.username || row.email || row.userId || '-')}</div>
                                                    <small class="text-muted">${bclEscapeHtml(row.email || '')}</small>
                                                </td>
                                                <td>${getReadinessBadge(row.readinessLevel)}</td>
                                                <td>${row.finalScore == null ? '-' : Number(row.finalScore)}</td>
                                                <td class="small text-muted">${Array.isArray(row.riskReasons) && row.riskReasons.length ? row.riskReasons.map(bclEscapeHtml).join('<br>') : '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="text-center py-5 text-muted">
                                <i class="fas fa-circle-check fa-2x mb-3"></i>
                                <p class="mb-0">Belum ada participant yang terdeteksi at-risk.</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="content-card h-100">
                    <div class="card-header-modern">
                        <div class="card-title-modern">
                            <i class="fas fa-user-gear"></i>Readiness by Role
                        </div>
                    </div>
                    <div class="card-body-modern">
                        ${roleReadiness.length ? roleReadiness.map((role) => `
                            <div class="border rounded p-3 mb-2">
                                <div class="d-flex justify-content-between gap-2">
                                    <strong>${bclEscapeHtml(role.jobRole || 'Unspecified Role')}</strong>
                                    <span>${Number(role.readinessPercent || 0)}% ready</span>
                                </div>
                                <div class="small text-muted">
                                    ${Number(role.participantCount || 0)} participant, ${Number(role.atRiskCount || 0)} at-risk, ${Number(role.blockedCount || 0)} blocked
                                    ${role.averageScore == null ? '' : `, avg score ${Number(role.averageScore)}`}
                                </div>
                            </div>
                        `).join('') : `
                            <div class="text-muted py-4">Belum ada data role readiness.</div>
                        `}
                    </div>
                </div>
            </div>
            <div class="col-12">
                <div class="content-card">
                    <div class="card-header-modern">
                        <div class="card-title-modern">
                            <i class="fas fa-chart-simple"></i>Skill / Activity Gap
                        </div>
                    </div>
                    <div class="card-body-modern">
                        ${skillGaps.length ? `
                            <div class="table-responsive">
                                <table class="table table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Practice Task</th>
                                            <th>Completion</th>
                                            <th>Review</th>
                                            <th>Avg Score</th>
                                            <th>Gap Signals</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${skillGaps.map((gap) => `
                                            <tr>
                                                <td class="fw-semibold">${bclEscapeHtml(gap.title || gap.classworkItemId)}</td>
                                                <td>${Number(gap.submittedCount || 0)} / ${Number(gap.participantCount || 0)} <small class="text-muted">(${Number(gap.completionPercent || 0)}%)</small></td>
                                                <td>${Number(gap.reviewedCount || 0)} reviewed</td>
                                                <td>${gap.averageScore == null ? '-' : Number(gap.averageScore)}</td>
                                                <td class="small text-muted">${Array.isArray(gap.gapReasons) && gap.gapReasons.length ? gap.gapReasons.map(bclEscapeHtml).join('<br>') : 'No major gap'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="text-muted py-4">Belum ada practice task untuk dianalisis.</div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderBatchEvaluation(result) {
    const container = document.getElementById('training-batches-content');
    if (!container) return;

    const batch = result.batch || currentTrainingBatch || {};
    const summary = result.summary || {};
    const rows = Array.isArray(result.data) ? result.data : [];

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <button class="btn btn-outline-secondary btn-sm mb-3" onclick="loadTrainingBatches()">
                    <i class="fas fa-arrow-left me-1"></i>Daftar Batch
                </button>
                <h4 class="mb-1">${bclEscapeHtml(batch.title || 'Batch Evaluation')}</h4>
                <div class="text-muted">
                    <span class="me-3">${bclEscapeHtml(batch.code || batch.id || '')}</span>
                    ${getTrainingStatusBadge(batch.status)}
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-success" onclick="loadTrainingPlan('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-list-check me-2"></i>Plan
                </button>
                <button class="btn btn-outline-warning" onclick="loadBatchReadiness('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-chart-line me-2"></i>Readiness
                </button>
                <button class="btn btn-outline-info" onclick="loadBatchAttendance('${bclEscapeHtml(batch.id || '')}')">
                    <i class="fas fa-calendar-check me-2"></i>Attendance
                </button>
                <a class="btn btn-modern-primary" href="/api/training/batches/${encodeURIComponent(batch.id || '')}/evaluation/export.csv" target="_blank" rel="noopener">
                    <i class="fas fa-file-csv me-2"></i>Export CSV
                </a>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-3">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Participants</div>
                    <div class="fs-4 fw-bold">${Number(summary.participantCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Completed/Passed</div>
                    <div class="fs-4 fw-bold text-success">${Number(summary.completedCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Needs Revision</div>
                    <div class="fs-4 fw-bold text-warning">${Number(summary.needsRevisionCount || 0)}</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="border rounded p-3 bg-white">
                    <div class="text-muted small">Average Score</div>
                    <div class="fs-4 fw-bold">${summary.averageScore == null ? '-' : Number(summary.averageScore)}</div>
                </div>
            </div>
        </div>

        ${rows.length ? `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Participant</th>
                            <th>Submission</th>
                            <th>Review</th>
                            <th>Score</th>
                            <th>Final Status</th>
                            <th>Note</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(renderBatchEvaluationRow).join('')}
                    </tbody>
                </table>
            </div>
        ` : `
            <div class="text-center py-5 text-muted border rounded">
                <i class="fas fa-users fa-2x mb-3"></i>
                <p class="mb-0">Belum ada participant aktif pada batch ini.</p>
            </div>
        `}
    `;
}

function renderBatchEvaluationRow(row) {
    const status = String(row.finalStatus || 'in_progress');
    return `
        <tr data-evaluation-user-id="${Number(row.userId)}">
            <td>
                <div class="fw-semibold">${bclEscapeHtml(row.username || row.email || row.userId || '-')}</div>
                <small class="text-muted">${bclEscapeHtml(row.email || '')}</small>
            </td>
            <td>
                <div class="fw-semibold">${Number(row.submittedCount || 0)} / ${Number(row.taskCount || 0)}</div>
                <small class="text-muted">${Number(row.completionPercent || 0)}% complete</small>
            </td>
            <td>
                <div class="fw-semibold">${Number(row.reviewedCount || 0)} reviewed</div>
                <small class="text-muted">${Number(row.missingCount || 0)} missing, ${Number(row.returnedCount || 0)} returned</small>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm evaluation-final-score"
                    value="${row.finalScore == null ? '' : Number(row.finalScore)}" min="0" step="0.01">
                <small class="text-muted">Avg: ${row.averageScore == null ? '-' : Number(row.averageScore)}</small>
            </td>
            <td>
                <select class="form-select form-select-sm evaluation-final-status">
                    <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="passed" ${status === 'passed' ? 'selected' : ''}>Passed</option>
                    <option value="needs_revision" ${status === 'needs_revision' ? 'selected' : ''}>Needs Revision</option>
                    <option value="failed" ${status === 'failed' ? 'selected' : ''}>Failed</option>
                    <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
                </select>
            </td>
            <td>
                <textarea class="form-control form-control-sm evaluation-note" rows="2" placeholder="Catatan final...">${bclEscapeHtml(row.note || '')}</textarea>
            </td>
            <td>
                <button class="btn btn-outline-primary btn-sm" onclick="saveBatchEvaluation(${Number(row.userId)})">
                    <i class="fas fa-save me-1"></i>Simpan
                </button>
            </td>
        </tr>
    `;
}

async function saveBatchEvaluation(userId) {
    if (!currentTrainingBatch || !userId) {
        alert('Konteks batch evaluation belum siap.');
        return;
    }

    const row = document.querySelector(`[data-evaluation-user-id="${Number(userId)}"]`);
    if (!row) return;

    const button = row.querySelector('button');
    const originalText = button ? button.innerHTML : '';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Simpan';
    }

    const payload = {
        finalStatus: row.querySelector('.evaluation-final-status')?.value || 'in_progress',
        finalScore: row.querySelector('.evaluation-final-score')?.value || null,
        note: row.querySelector('.evaluation-note')?.value.trim() || ''
    };

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/evaluation/${encodeURIComponent(userId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        await loadBatchEvaluation(currentTrainingBatch.id);
    } catch (error) {
        alert('Gagal menyimpan evaluation: ' + error.message);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

function renderTrainingPlan(topics, unassignedItems) {
    const container = document.getElementById('training-batches-content');
    if (!container || !currentTrainingBatch) return;

    const batch = currentTrainingBatch;
    const allTopics = Array.isArray(topics) ? topics : [];
    const looseItems = Array.isArray(unassignedItems) ? unassignedItems : [];

    container.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <button class="btn btn-outline-secondary btn-sm mb-3" onclick="loadTrainingBatches()">
                    <i class="fas fa-arrow-left me-1"></i>Daftar Batch
                </button>
                <h4 class="mb-1">${bclEscapeHtml(batch.title)}</h4>
                <div class="text-muted">
                    <span class="me-3">${bclEscapeHtml(batch.code || batch.id)}</span>
                    <span class="me-3">${bclEscapeHtml(batch.learningPathId || 'No learning path')}</span>
                    ${getTrainingStatusBadge(batch.status)}
                </div>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-primary" onclick="loadTrainingBatchMembers('${bclEscapeHtml(batch.id)}')">
                    <i class="fas fa-users me-2"></i>Roster
                </button>
                <button class="btn btn-outline-dark" onclick="loadBatchEvaluation('${bclEscapeHtml(batch.id)}')">
                    <i class="fas fa-table-list me-2"></i>Evaluation
                </button>
                <button class="btn btn-outline-warning" onclick="loadBatchReadiness('${bclEscapeHtml(batch.id)}')">
                    <i class="fas fa-chart-line me-2"></i>Readiness
                </button>
                <button class="btn btn-outline-info" onclick="loadBatchAttendance('${bclEscapeHtml(batch.id)}')">
                    <i class="fas fa-calendar-check me-2"></i>Attendance
                </button>
                <button class="btn btn-outline-success" onclick="showTrainingTopicModal()">
                    <i class="fas fa-layer-group me-2"></i>Tambah Topic
                </button>
                <button class="btn btn-modern-primary" onclick="showClassworkModal()">
                    <i class="fas fa-plus me-2"></i>Tambah Item
                </button>
            </div>
        </div>

        ${allTopics.length === 0 && looseItems.length === 0 ? `
            <div class="text-center py-5 text-muted border rounded">
                <i class="fas fa-list-check fa-3x mb-3"></i>
                <h5>Training Plan masih kosong</h5>
                <p class="mb-3">Tambahkan topic/session, lalu isi dengan material, quiz, exam, meeting, atau practice task.</p>
                <button class="btn btn-outline-success me-2" onclick="showTrainingTopicModal()">
                    <i class="fas fa-layer-group me-2"></i>Tambah Topic
                </button>
                <button class="btn btn-modern-primary" onclick="showClassworkModal()">
                    <i class="fas fa-plus me-2"></i>Tambah Item
                </button>
            </div>
        ` : `
            <div class="training-plan-list">
                ${allTopics.map((topic) => renderTrainingTopicCard(topic)).join('')}
                ${looseItems.length > 0 ? `
                    <div class="content-card mb-3">
                        <div class="card-header-modern">
                            <div class="card-title-modern">
                                <i class="fas fa-inbox"></i>Unassigned Items
                            </div>
                        </div>
                        <div class="card-body-modern">
                            ${looseItems.map(renderClassworkItemRow).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `}
    `;

    window.currentTrainingPlanTopics = allTopics;
}

function renderTrainingTopicCard(topic) {
    const items = Array.isArray(topic.items) ? topic.items : [];
    return `
        <div class="content-card mb-3">
            <div class="card-header-modern">
                <div>
                    <div class="card-title-modern">
                        <i class="fas fa-layer-group"></i>
                        ${bclEscapeHtml(topic.title)}
                    </div>
                    ${topic.description ? `<small class="text-muted">${bclEscapeHtml(topic.description)}</small>` : ''}
                </div>
                <button class="btn btn-outline-primary btn-sm" onclick="showClassworkModal('${bclEscapeHtml(topic.id)}')">
                    <i class="fas fa-plus me-1"></i>Item
                </button>
            </div>
            <div class="card-body-modern">
                ${items.length === 0 ? `
                    <div class="text-muted py-3">
                        <i class="fas fa-info-circle me-2"></i>Belum ada item pada topic ini.
                    </div>
                ` : items.map(renderClassworkItemRow).join('')}
            </div>
        </div>
    `;
}

function renderClassworkItemRow(item) {
    const isPracticeTask = String(item.type || '').toLowerCase() === 'practice_task';

    return `
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 border rounded p-3 mb-2 bg-white">
            <div>
                <div class="fw-bold">${bclEscapeHtml(item.title)}</div>
                <small class="text-muted">
                    ${getClassworkTypeLabel(item.type)}
                    ${item.linkedResourceType ? ` - ${bclEscapeHtml(item.linkedResourceType)}:${bclEscapeHtml(item.linkedResourceId || '')}` : ''}
                </small>
                ${item.instructions ? `<div class="small text-muted mt-1">${bclEscapeHtml(item.instructions)}</div>` : ''}
            </div>
            <div class="text-end">
                ${getClassworkStatusBadge(item.status)}
                <div class="small text-muted mt-1">Due: ${formatTrainingDate(item.dueAt)}</div>
                <div class="small text-muted">Points: ${Number(item.points || 0)}</div>
                ${isPracticeTask ? `
                    <button class="btn btn-outline-primary btn-sm mt-2" onclick="showClassworkSubmissions('${bclEscapeHtml(item.id)}')">
                        <i class="fas fa-inbox me-1"></i>Submissions
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function getSubmissionStatusBadge(status) {
    const normalized = String(status || 'assigned').toLowerCase();
    const classes = {
        assigned: 'bg-secondary',
        missing: 'bg-warning text-dark',
        submitted: 'bg-success',
        late: 'bg-warning text-dark',
        returned: 'bg-danger',
        reviewed: 'bg-info text-dark',
        accepted: 'bg-primary'
    };
    const labels = {
        assigned: 'Belum Submit',
        missing: 'Missing',
        submitted: 'Submitted',
        late: 'Late',
        returned: 'Returned',
        reviewed: 'Reviewed',
        accepted: 'Accepted'
    };
    return `<span class="badge ${classes[normalized] || 'bg-secondary'}">${bclEscapeHtml(labels[normalized] || normalized)}</span>`;
}

async function showClassworkSubmissions(itemId) {
    if (!currentTrainingBatch || !itemId) {
        alert('Pilih batch dan practice task lebih dulu.');
        return;
    }

    const existingModal = document.getElementById('classworkSubmissionsModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div class="modal fade" id="classworkSubmissionsModal" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title">
                                <i class="fas fa-inbox me-2"></i>Practice Submissions
                            </h5>
                            <small class="text-muted">${bclEscapeHtml(currentTrainingBatch.title || currentTrainingBatch.id)}</small>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="classworkSubmissionsContent">
                        <div class="text-center py-5 text-muted">
                            <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                            <p class="mb-0">Memuat submission peserta...</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('classworkSubmissionsModal'));
    modal.show();

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/classwork/${encodeURIComponent(itemId)}/submissions`, {
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        renderClassworkSubmissions(result.classwork || {}, result.data || []);
    } catch (error) {
        const content = document.getElementById('classworkSubmissionsContent');
        if (content) {
            content.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Gagal memuat submission: ${bclEscapeHtml(error.message)}
                </div>
            `;
        }
    }
}

function renderClassworkSubmissions(classwork, entries) {
    const content = document.getElementById('classworkSubmissionsContent');
    if (!content) return;

    const rows = Array.isArray(entries) ? entries : [];
    currentSubmissionReviewContext = {
        batchId: currentTrainingBatch ? currentTrainingBatch.id : '',
        classwork
    };
    const submittedCount = rows.filter((entry) => ['submitted', 'late', 'returned', 'reviewed', 'accepted'].includes(String(entry.status || '').toLowerCase())).length;
    const missingCount = rows.filter((entry) => ['assigned', 'missing'].includes(String(entry.status || '').toLowerCase())).length;

    content.innerHTML = `
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
                <h6 class="mb-1">${bclEscapeHtml(classwork.title || 'Practice Task')}</h6>
                <div class="text-muted small">
                    Due: ${formatTrainingDateTime(classwork.dueAt)} | Points: ${Number(classwork.points || 0)}
                </div>
            </div>
            <div class="d-flex gap-2">
                <span class="badge bg-success">${submittedCount} submitted</span>
                <span class="badge bg-secondary">${missingCount} pending/missing</span>
                <span class="badge bg-light text-dark">${rows.length} peserta</span>
            </div>
        </div>

        ${rows.length ? `
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Peserta</th>
                            <th>Status</th>
                            <th>Dikirim</th>
                            <th>Evidence</th>
                            <th>Catatan</th>
                            <th>Review</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(renderSubmissionRow).join('')}
                    </tbody>
                </table>
            </div>
        ` : `
            <div class="text-center py-5 text-muted border rounded">
                <i class="fas fa-users fa-2x mb-3"></i>
                <p class="mb-0">Belum ada participant pada batch ini.</p>
            </div>
        `}
    `;
}

function renderSubmissionRow(entry) {
    const submission = entry.submission || null;
    const files = Array.isArray(submission?.files) ? submission.files : [];
    const note = submission?.metadata?.note || '';

    return `
        <tr>
            <td>
                <div class="fw-semibold">${bclEscapeHtml(entry.username || entry.email || entry.userId || '-')}</div>
                <small class="text-muted">${bclEscapeHtml(entry.email || '')}</small>
            </td>
            <td>${getSubmissionStatusBadge(entry.status)}</td>
            <td>${formatTrainingDateTime(submission?.submittedAt)}</td>
            <td>
                ${files.length ? files.map((file) => `
                    <div class="small mb-1">
                        <i class="fas fa-paperclip me-1"></i>
                        ${file.externalUrl ? `
                            <a href="${bclEscapeHtml(file.externalUrl)}" target="_blank" rel="noopener">
                                ${bclEscapeHtml(file.fileName || file.externalUrl)}
                            </a>
                        ` : `
                            <span>${bclEscapeHtml(file.fileName || file.filePath || 'Evidence')}</span>
                        `}
                        ${file.filePath ? `<div class="text-muted">${bclEscapeHtml(file.filePath)}</div>` : ''}
                    </div>
                `).join('') : '<span class="text-muted small">Belum ada evidence</span>'}
            </td>
            <td class="small text-muted">${note ? bclEscapeHtml(note) : '-'}</td>
            <td>
                ${submission ? `
                    <button class="btn btn-outline-success btn-sm" onclick="showSubmissionReview('${bclEscapeHtml(submission.id)}')">
                        <i class="fas fa-pen-to-square me-1"></i>Review
                    </button>
                ` : '<span class="text-muted small">Menunggu submit</span>'}
            </td>
        </tr>
    `;
}

async function showSubmissionReview(submissionId) {
    const context = currentSubmissionReviewContext || {};
    const batchId = context.batchId;
    const classwork = context.classwork || {};

    if (!batchId || !classwork.id || !submissionId) {
        alert('Konteks review belum siap. Buka ulang submission list.');
        return;
    }

    currentSubmissionReviewContext = {
        ...context,
        submissionId
    };

    const existingModal = document.getElementById('submissionReviewModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div class="modal fade" id="submissionReviewModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title">
                                <i class="fas fa-pen-to-square me-2"></i>Review Submission
                            </h5>
                            <small class="text-muted">${bclEscapeHtml(classwork.title || 'Practice Task')}</small>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="submissionReviewContent">
                        <div class="text-center py-5 text-muted">
                            <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                            <p class="mb-0">Memuat detail review...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('submissionReviewModal')).show();

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/classwork/${encodeURIComponent(classwork.id)}/submissions/${encodeURIComponent(submissionId)}/review`, {
            credentials: 'include'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        renderSubmissionReviewForm(result);
    } catch (error) {
        const content = document.getElementById('submissionReviewContent');
        if (content) {
            content.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Gagal memuat review: ${bclEscapeHtml(error.message)}
                </div>
            `;
        }
    }
}

function renderSubmissionReviewForm(result) {
    const content = document.getElementById('submissionReviewContent');
    if (!content) return;

    const submission = result.submission || {};
    const criteria = Array.isArray(result.criteria) && result.criteria.length
        ? result.criteria
        : [{
            id: '',
            title: 'Kualitas Evidence',
            description: 'Kelengkapan, kesesuaian instruksi, dan kualitas hasil praktik.',
            maxScore: 100,
            weight: 1
        }];
    const scores = Array.isArray(result.scores) ? result.scores : [];
    const scoreByCriterion = new Map(scores.map((score) => [score.criterionId, score]));
    const existingStatus = String(submission.status || 'reviewed').toLowerCase();

    content.innerHTML = `
        <form id="submissionReviewForm">
            <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
                <div>
                    <div class="fw-semibold">${bclEscapeHtml(submission.username || submission.email || submission.userId || '-')}</div>
                    <small class="text-muted">${bclEscapeHtml(submission.email || '')}</small>
                </div>
                <div class="text-end">
                    ${getSubmissionStatusBadge(existingStatus)}
                    <div class="small text-muted mt-1">Current score: ${submission.score == null ? '-' : Number(submission.score)}</div>
                </div>
            </div>

            <div class="border rounded p-3 mb-3">
                <div class="fw-semibold mb-2">Criteria Score</div>
                ${criteria.map((criterion, index) => {
                    const score = scoreByCriterion.get(criterion.id) || {};
                    return `
                        <div class="review-score-row border rounded p-3 mb-2"
                            data-criterion-id="${bclEscapeHtml(criterion.id || '')}"
                            data-title="${bclEscapeHtml(criterion.title)}"
                            data-max-score="${Number(criterion.maxScore || 100)}"
                            data-weight="${Number(criterion.weight || 1)}"
                            data-sort-order="${index}">
                            <div class="row g-2 align-items-start">
                                <div class="col-md-7">
                                    <label class="form-label fw-semibold mb-1">${bclEscapeHtml(criterion.title)}</label>
                                    ${criterion.description ? `<div class="small text-muted mb-2">${bclEscapeHtml(criterion.description)}</div>` : ''}
                                    <textarea class="form-control review-score-comment" rows="2" placeholder="Komentar per criteria...">${bclEscapeHtml(score.comment || '')}</textarea>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Score</label>
                                    <input type="number" class="form-control review-score-value"
                                        min="0" max="${Number(criterion.maxScore || 100)}" step="0.01"
                                        value="${score.score == null ? '' : Number(score.score)}" required>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">Max</label>
                                    <input type="text" class="form-control" value="${Number(criterion.maxScore || 100)}" disabled>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="row g-3 mb-3">
                <div class="col-md-4">
                    <label class="form-label">Status Review</label>
                    <select class="form-select" id="reviewStatus">
                        <option value="reviewed" ${existingStatus === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                        <option value="returned" ${existingStatus === 'returned' ? 'selected' : ''}>Returned for Revision</option>
                        <option value="accepted" ${existingStatus === 'accepted' ? 'selected' : ''}>Accepted</option>
                        <option value="completed" ${existingStatus === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="col-md-8">
                    <label class="form-label">Feedback Summary</label>
                    <textarea class="form-control" id="reviewFeedbackSummary" rows="3" placeholder="Ringkasan feedback untuk participant...">${bclEscapeHtml(submission.feedbackSummary || '')}</textarea>
                </div>
                <div class="col-12">
                    <label class="form-label">Komentar Baru</label>
                    <textarea class="form-control" id="reviewComment" rows="3" placeholder="Opsional. Komentar ini akan terlihat oleh participant."></textarea>
                </div>
            </div>

            ${Array.isArray(result.comments) && result.comments.length ? `
                <div class="border-top pt-3 mb-3">
                    <div class="fw-semibold mb-2">Riwayat Komentar</div>
                    ${result.comments.map((comment) => `
                        <div class="small text-muted mb-2">
                            <i class="fas fa-comment me-1"></i>
                            ${bclEscapeHtml(comment.body)}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="modal-footer px-0 pb-0">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-save me-2"></i>Simpan Review
                </button>
            </div>
        </form>
    `;

    document.getElementById('submissionReviewForm').addEventListener('submit', handleSubmissionReviewSubmit);
}

async function handleSubmissionReviewSubmit(event) {
    event.preventDefault();
    const context = currentSubmissionReviewContext || {};
    const batchId = context.batchId;
    const classwork = context.classwork || {};
    const submissionId = context.submissionId;

    if (!batchId || !classwork.id || !submissionId) {
        alert('Konteks review belum siap.');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';

    const scores = Array.from(event.target.querySelectorAll('.review-score-row')).map((row) => ({
        criterionId: row.dataset.criterionId || '',
        title: row.dataset.title || 'Kualitas Evidence',
        maxScore: Number(row.dataset.maxScore || 100),
        weight: Number(row.dataset.weight || 1),
        sortOrder: Number(row.dataset.sortOrder || 0),
        score: row.querySelector('.review-score-value')?.value,
        comment: row.querySelector('.review-score-comment')?.value.trim() || ''
    }));

    const payload = {
        status: document.getElementById('reviewStatus').value,
        feedbackSummary: document.getElementById('reviewFeedbackSummary').value.trim(),
        comment: document.getElementById('reviewComment').value.trim(),
        scores
    };

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(batchId)}/classwork/${encodeURIComponent(classwork.id)}/submissions/${encodeURIComponent(submissionId)}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        renderSubmissionReviewForm(result);
        alert('Review submission berhasil disimpan.');
    } catch (error) {
        alert('Gagal menyimpan review: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

function getClassworkTypeLabel(type) {
    const labels = {
        material: 'Material',
        quiz: 'Quiz',
        practice_task: 'Practice Task',
        exam: 'Exam',
        meeting: 'Meeting',
        announcement: 'Announcement'
    };
    return labels[String(type || 'material')] || type;
}

function getClassworkStatusBadge(status) {
    const normalized = String(status || 'draft').toLowerCase();
    const classes = {
        draft: 'bg-secondary',
        published: 'bg-success',
        closed: 'bg-primary',
        archived: 'bg-dark'
    };
    return `<span class="badge ${classes[normalized] || 'bg-secondary'}">${bclEscapeHtml(normalized)}</span>`;
}

function showTrainingTopicModal() {
    if (!currentTrainingBatch) {
        alert('Pilih batch lebih dulu.');
        return;
    }

    const modalHtml = `
        <div class="modal fade" id="trainingTopicModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-layer-group me-2"></i>Tambah Topic / Session
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="trainingTopicForm">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Judul Topic *</label>
                                <input type="text" class="form-control" id="trainingTopicTitle"
                                    placeholder="Contoh: Session 01 - BIM Mindset" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Deskripsi</label>
                                <textarea class="form-control" id="trainingTopicDescription" rows="3"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Urutan</label>
                                <input type="number" class="form-control" id="trainingTopicSortOrder" value="0" min="0">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Simpan Topic
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('trainingTopicModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('trainingTopicForm').addEventListener('submit', handleTrainingTopicSubmit);
    new bootstrap.Modal(document.getElementById('trainingTopicModal')).show();
}

async function handleTrainingTopicSubmit(event) {
    event.preventDefault();
    if (!currentTrainingBatch) return;

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';
    submitButton.disabled = true;

    const payload = {
        title: document.getElementById('trainingTopicTitle').value.trim(),
        description: document.getElementById('trainingTopicDescription').value.trim(),
        sortOrder: Number(document.getElementById('trainingTopicSortOrder').value || 0)
    };

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        const modal = bootstrap.Modal.getInstance(document.getElementById('trainingTopicModal'));
        if (modal) modal.hide();
        await loadTrainingPlan(currentTrainingBatch.id);
    } catch (error) {
        alert('Gagal menyimpan topic: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

function showClassworkModal(topicId = '') {
    if (!currentTrainingBatch) {
        alert('Pilih batch lebih dulu.');
        return;
    }

    const topics = Array.isArray(window.currentTrainingPlanTopics) ? window.currentTrainingPlanTopics : [];
    const topicOptions = topics.map((topic) => `
        <option value="${bclEscapeHtml(topic.id)}" ${topic.id === topicId ? 'selected' : ''}>${bclEscapeHtml(topic.title)}</option>
    `).join('');

    const modalHtml = `
        <div class="modal fade" id="classworkModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-list-check me-2"></i>Tambah Training Plan Item
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="classworkForm">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label">Judul Item *</label>
                                    <input type="text" class="form-control" id="classworkTitle" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Type</label>
                                    <select class="form-select" id="classworkType">
                                        <option value="material">Material</option>
                                        <option value="quiz">Quiz</option>
                                        <option value="practice_task">Practice Task</option>
                                        <option value="exam">Exam</option>
                                        <option value="meeting">Meeting</option>
                                        <option value="announcement">Announcement</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Topic</label>
                                    <select class="form-select" id="classworkTopicId">
                                        <option value="">Unassigned</option>
                                        ${topicOptions}
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Status</label>
                                    <select class="form-select" id="classworkStatus">
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="closed">Closed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Points</label>
                                    <input type="number" class="form-control" id="classworkPoints" value="0" min="0">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Linked Resource Type</label>
                                    <input type="text" class="form-control" id="classworkResourceType" placeholder="page, pdf, quiz, url">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Linked Resource ID / URL</label>
                                    <input type="text" class="form-control" id="classworkResourceId" placeholder="/pages/bim-mindset.html">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Due At</label>
                                    <input type="datetime-local" class="form-control" id="classworkDueAt">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Urutan</label>
                                    <input type="number" class="form-control" id="classworkSortOrder" value="0" min="0">
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Instruksi</label>
                                    <textarea class="form-control" id="classworkInstructions" rows="3"></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Simpan Item
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('classworkModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('classworkForm').addEventListener('submit', handleClassworkSubmit);
    new bootstrap.Modal(document.getElementById('classworkModal')).show();
}

async function handleClassworkSubmit(event) {
    event.preventDefault();
    if (!currentTrainingBatch) return;

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...';
    submitButton.disabled = true;

    const payload = {
        title: document.getElementById('classworkTitle').value.trim(),
        type: document.getElementById('classworkType').value,
        topicId: document.getElementById('classworkTopicId').value,
        status: document.getElementById('classworkStatus').value,
        points: Number(document.getElementById('classworkPoints').value || 0),
        linkedResourceType: document.getElementById('classworkResourceType').value.trim(),
        linkedResourceId: document.getElementById('classworkResourceId').value.trim(),
        dueAt: document.getElementById('classworkDueAt').value,
        sortOrder: Number(document.getElementById('classworkSortOrder').value || 0),
        instructions: document.getElementById('classworkInstructions').value.trim()
    };

    try {
        const response = await fetch(`/api/training/batches/${encodeURIComponent(currentTrainingBatch.id)}/classwork`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);

        const modal = bootstrap.Modal.getInstance(document.getElementById('classworkModal'));
        if (modal) modal.hide();
        await loadTrainingPlan(currentTrainingBatch.id);
    } catch (error) {
        alert('Gagal menyimpan item: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// Load dashboard statistics with better error handling
async function loadDashboardStats() {
    console.log('ðŸ”„ Loading dashboard statistics...');
    try {
        // Use Promise.allSettled to handle partial failures gracefully
        const [usersRes, questionsRes, videosRes, mediaRes] = await Promise.allSettled([
            fetch('/api/users/get-all').then(res => res.ok ? res.json() : Promise.reject(res.status)),
            fetch('/api/questions').then(res => res.ok ? res.json() : Promise.reject(res.status)),
            fetch('/api/tutorials').then(res => res.ok ? res.json() : Promise.reject(res.status)),
            fetch('/api/admin/bim-media/stats').then(res => res.ok ? res.json() : Promise.reject(res.status))
        ]);

        console.log('ðŸ“Š API responses:', {
            users: usersRes.status === 'fulfilled' ? 'success' : 'failed',
            questions: questionsRes.status === 'fulfilled' ? 'success' : 'failed',
            videos: videosRes.status === 'fulfilled' ? 'success' : 'failed',
            media: mediaRes.status === 'fulfilled' ? 'success' : 'failed'
        });

        // Update user count
        if (usersRes.status === 'fulfilled') {
            const users = usersRes.value;
            console.log('âœ… Users loaded:', users.length);
            document.getElementById('user-count').textContent = users.length;
        } else {
            console.error('âŒ Users API failed:', usersRes.reason);
            document.getElementById('user-count').textContent = 'N/A';
        }

        // Update question count
        if (questionsRes.status === 'fulfilled') {
            const questions = questionsRes.value;
            console.log('âœ… Questions loaded:', questions.length);
            document.getElementById('question-count').textContent = questions.length;
        } else {
            console.error('âŒ Questions API failed:', questionsRes.reason);
            document.getElementById('question-count').textContent = 'N/A';
        }

        // Update video count
        if (videosRes.status === 'fulfilled') {
            const videos = videosRes.value;
            console.log('âœ… Videos loaded:', videos.length);
            document.getElementById('video-count').textContent = videos.length;
        } else {
            console.error('âŒ Videos API failed:', videosRes.reason);
            document.getElementById('video-count').textContent = 'N/A';
        }

        // Update media count
        if (mediaRes.status === 'fulfilled') {
            const mediaStats = mediaRes.value;
            console.log('âœ… Media stats loaded:', mediaStats);
            document.getElementById('media-count').textContent = mediaStats.totalTagged || 0;
        } else {
            console.error('âŒ Media API failed:', mediaRes.reason);
            document.getElementById('media-count').textContent = 'N/A';
        }

        console.log('âœ… Dashboard statistics loaded (with error handling)');
    } catch (error) {
        console.error('âŒ Critical error loading dashboard stats:', error);
        // Set all counts to N/A on critical error
        document.getElementById('user-count').textContent = 'N/A';
        document.getElementById('question-count').textContent = 'N/A';
        document.getElementById('video-count').textContent = 'N/A';
        document.getElementById('media-count').textContent = 'N/A';
    }
}

// Load saved tags from localStorage on page load
function loadSavedTags() {
    try {
        const saved = localStorage.getItem('bcl_video_tags');
        if (saved) {
            savedTags = JSON.parse(saved);
            console.log('ðŸ“‚ Loaded saved tags from localStorage:', Object.keys(savedTags).length, 'videos');
        } else {
            savedTags = {};
            console.log('ðŸ“‚ No saved tags found in localStorage');
        }
    } catch (error) {
        console.error('âŒ Error loading saved tags:', error);
        savedTags = {};
    }
}

// Get all previously used tags
function getPreviouslyUsedTags() {
    const allTags = new Set();

    // Collect tags from all saved videos
    Object.values(savedTags).forEach(videoTags => {
        if (videoTags.tags && Array.isArray(videoTags.tags)) {
            videoTags.tags.forEach(tag => {
                if (tag && tag.trim()) {
                    allTags.add(tag.trim().toLowerCase());
                }
            });
        }
    });

    // Convert to sorted array
    return Array.from(allTags).sort();
}

// Display previously used tags in modal
function displayPreviouslyUsedTags() {
    const previousTags = getPreviouslyUsedTags();
    const container = document.getElementById('previousTagsContainer');
    const section = document.getElementById('previousTagsSection');

    if (previousTags.length === 0) {
        section.classList.add('d-none');
        return;
    }

    let html = '';
    previousTags.forEach(tag => {
        html += `<button type="button" class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="addTagToInput('${tag}')">${tag}</button>`;
    });

    container.innerHTML = html;
    section.classList.remove('d-none');
}

// Add tag to input field
function addTagToInput(tag) {
    const input = document.getElementById('videoTags');
    const currentValue = input.value.trim();

    // Check if tag is already in the input
    const currentTags = currentValue ? currentValue.split(',').map(t => t.trim().toLowerCase()) : [];
    if (currentTags.includes(tag.toLowerCase())) {
        return; // Tag already exists
    }

    // Add tag to input
    const newValue = currentValue ? currentValue + ', ' + tag : tag;
    input.value = newValue;

    // Focus input
    input.focus();
}

// Load custom categories from localStorage
function loadCustomCategories() {
    try {
        const saved = localStorage.getItem('bcl_custom_categories');
        if (saved) {
            customCategories = JSON.parse(saved);
            console.log('ðŸ“‚ Loaded custom categories from localStorage:', customCategories.length, 'categories');
            // Apply custom categories to the dropdown
            applyCustomCategoriesToDropdown();
        } else {
            customCategories = [];
            console.log('ðŸ“‚ No custom categories found in localStorage');
        }
    } catch (error) {
        console.error('âŒ Error loading custom categories:', error);
        customCategories = [];
    }
}

// Save custom categories to localStorage
function saveCustomCategoriesToStorage() {
    try {
        localStorage.setItem('bcl_custom_categories', JSON.stringify(customCategories));
        console.log('ðŸ’¾ Saved custom categories to localStorage:', customCategories.length, 'categories');
    } catch (error) {
        console.error('âŒ Error saving custom categories to localStorage:', error);
    }
}

// Apply custom categories to dropdown
function applyCustomCategoriesToDropdown() {
    const select = document.getElementById('videoCategory');
    if (select) {
        // Remove existing custom categories first
        const existingCustomOptions = select.querySelectorAll('option[data-custom="true"]');
        existingCustomOptions.forEach(option => option.remove());

        // Add custom categories
        customCategories.forEach(category => {
            const newOption = document.createElement('option');
            newOption.value = category.value;
            newOption.textContent = category.displayName;
            newOption.setAttribute('data-custom', 'true');
            select.appendChild(newOption);
        });
    }

    // Also update the video category filter dropdown
    updateVideoCategoryFilter();

    console.log('âœ… Applied', customCategories.length, 'custom categories to dropdowns');
}

// Update video category filter dropdown with custom categories
function updateVideoCategoryFilter() {
    const filterSelect = document.getElementById('videoCategoryFilter');
    if (!filterSelect) return;

    // Remove existing custom categories from filter
    const existingCustomOptions = filterSelect.querySelectorAll('option[data-custom="true"]');
    existingCustomOptions.forEach(option => option.remove());

    // Add custom categories to filter
    customCategories.forEach(category => {
        const newOption = document.createElement('option');
        newOption.value = category.value;
        newOption.textContent = category.displayName;
        newOption.setAttribute('data-custom', 'true');
        filterSelect.appendChild(newOption);
    });

    console.log('âœ… Updated video category filter with', customCategories.length, 'custom categories');
}

// Save tags to localStorage
function saveTagsToStorage() {
    try {
        localStorage.setItem('bcl_video_tags', JSON.stringify(savedTags));
        console.log('ðŸ’¾ Saved tags to localStorage:', Object.keys(savedTags).length, 'videos');
    } catch (error) {
        console.error('âŒ Error saving tags to localStorage:', error);
    }
}

// Apply saved tags to videos
function applySavedTagsToVideos(videos) {
    console.log('ðŸ”„ Applying saved tags to videos...');
    let taggedCount = 0;

    videos.forEach(video => {
        const videoTags = savedTags[video.id];
        if (videoTags) {
            // Apply saved tags to video object
            Object.assign(video, videoTags);
            video.tagged = true;
            video.localSave = true; // Mark as locally saved
            taggedCount++;
            console.log('âœ… Applied tags to video:', video.id, video.name);
        } else {
            // Ensure video has default values if no tags saved
            video.category = video.category || 'general';
            video.bimLevel = video.bimLevel || 'beginner';
            video.tagged = false;
        }
    });

    console.log('ðŸ“Š Applied saved tags to', taggedCount, 'videos');
    return videos;
}

// Video scanning and management functions
async function scanVideoSources() {
    console.log('ðŸ”„ Scanning video sources...');

    const gridContainer = document.getElementById('videosGrid');
    gridContainer.innerHTML = `
        <div class="col-12">
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-muted">Scanning video sources...</p>
            </div>
        </div>`;

    try {
        // Try to get videos from the tutorials API
        const response = await fetch('/api/tutorials');
        console.log('ðŸ“¡ Video scan API response:', response.status, response.statusText);

        if (response.ok) {
            const videos = await response.json();
            console.log('âœ… Videos scanned successfully:', videos.length, 'videos');

            // Transform video data for tagging
            const transformedVideos = videos.map(video => ({
                id: video.id || Math.random().toString(36).substr(2, 9),
                name: video.name || video.title || 'Unknown Video',
                path: video.path || video.url || '',
                size: video.size || 'Unknown',
                category: video.category || 'general',
                tags: video.tags || [],
                bimLevel: video.bimLevel || 'beginner',
                duration: video.duration || 0,
                language: video.language || 'id',
                description: video.description || '',
                views: video.viewCount || video.views || 0,
                tagged: video.tags && video.tags.length > 0,
                thumbnail: video.thumbnail || '',
                created_at: video.created_at,
                date: video.date
            }));

            allVideos = transformedVideos;

            // Apply saved tags to videos
            const videosWithSavedTags = applySavedTagsToVideos(transformedVideos);

            displayVideos(videosWithSavedTags);

            // Update total videos count badge
            updateTotalVideosCount(transformedVideos.length);

            console.log('âœ… Video sources scanned and displayed');
        } else {
            const errorText = await response.text();
            console.error('âŒ Video scan API failed:', response.status, errorText);
            gridContainer.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Failed to scan video sources: ${response.status} ${response.statusText}
                        </div>
                    </div>
                </div>`;
        }
    } catch (error) {
        console.error('âŒ Error scanning video sources:', error);
        gridContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error scanning video sources: ${error.message}
                    </div>
                </div>`;
    }
}

async function refreshVideos() {
    if (allVideos.length === 0) {
        await scanVideoSources();
    } else {
        displayVideos(allVideos);
    }
}

function displayVideos(videos) {
    const gridContainer = document.getElementById('videosGrid');

    if (videos.length === 0) {
        gridContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <i class="fas fa-video fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No videos found</p>
                    <button class="btn btn-primary" onclick="scanVideoSources()">
                        <i class="fas fa-search me-2"></i>Scan Video Sources
                    </button>
                </div>
            </div>`;
        return;
    }

    let html = '';

    videos.forEach((video, index) => {
        const videoId = video.id;
        const videoName = video.name;
        const videoCategory = video.category;
        const videoTags = video.tags || [];
        const videoViews = video.views || 0;
        const isTagged = video.tagged || videoTags.length > 0;

        // Category badge color
        const categoryColors = {
            'autocad': 'primary',
            'revit': 'info',
            'sketchup': 'success',
            '3dsmax': 'warning',
            'lumion': 'danger',
            'general': 'secondary',
            'tutorial': 'dark',
            'advanced': 'light'
        };
        const categoryColor = categoryColors[videoCategory.toLowerCase()] || 'secondary';

        // BIM level badge
        const bimLevelColors = {
            'beginner': 'success',
            'intermediate': 'warning',
            'advanced': 'danger',
            'expert': 'dark'
        };
        const bimLevelColor = bimLevelColors[video.bimLevel.toLowerCase()] || 'secondary';

        html += `
            <div class="col-md-6 col-lg-6 mb-4">
                <div class="card video-card ${isTagged ? 'border-success' : ''}" style="height: 100%;">
                    <div class="card-body p-3">
                        <div class="row align-items-center">
                            <!-- Left Column: Video Information -->
                            <div class="col-md-8">
                                <div class="d-flex align-items-start mb-3">
                                    <i class="fas fa-video text-warning me-3 fa-lg"></i>
                                    <div class="flex-grow-1">
                                        <h6 class="card-title mb-2" title="${videoName}">${videoName}</h6>
                                        <div class="mb-2">
                                            <span class="badge bg-${categoryColor} me-2">${videoCategory}</span>
                                            <span class="badge bg-${bimLevelColor}">${video.bimLevel}</span>
                                            ${isTagged ? '<span class="badge bg-success ms-2"><i class="fas fa-check me-1"></i>Tagged</span>' : '<span class="badge bg-secondary ms-2">Untagged</span>'}
                                        </div>
                                        <small class="text-muted d-block mb-2">
                                            <i class="fas fa-eye me-1"></i>${videoViews} views
                                        </small>

                                        ${videoTags.length > 0 ? `
                                            <div class="mb-2">
                                                <small class="text-muted d-block mb-1">Tags:</small>
                                                <div>
                                                    ${videoTags.slice(0, 4).map(tag => `<span class="badge bg-light text-dark me-1 mb-1">${tag}</span>`).join('')}
                                                    ${videoTags.length > 4 ? `<span class="badge bg-light text-dark">+${videoTags.length - 4}</span>` : ''}
                                                </div>
                                            </div>
                                        ` : '<small class="text-muted d-block">No tags assigned</small>'}
                                    </div>
                                </div>
                            </div>

                            <!-- Right Column: Thumbnail Preview -->
                            <div class="col-md-4 text-center">
                                <div class="video-preview-container mx-auto" onclick="openVideoPreviewModal('${videoId}', '${videoName.replace(/'/g, "\\'")}', '${JSON.stringify(video).replace(/'/g, "\\'")}')" style="cursor: pointer;">
                                    ${video.thumbnail ? `<img src="${video.thumbnail}" class="video-thumbnail" alt="${videoName}" onerror="this.style.display='none'">` : ''}
                                    <div class="video-overlay">
                                        <i class="fas fa-play-circle fa-2x text-white"></i>
                                    </div>
                                </div>
                                <small class="text-muted d-block mt-2">Click to preview</small>
                            </div>
                        </div>

                        <!-- Bottom: Action Buttons -->
                        <div class="row mt-3">
                            <div class="col-12">
                                <hr class="my-2">
                                <div class="d-flex justify-content-center gap-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="openVideoTagModal('${videoId}')" title="Tag Video">
                                        <i class="fas fa-tag me-1"></i> Tag Video
                                    </button>
                                    <button class="btn btn-sm btn-outline-info" onclick="viewVideoDetails('${videoId}')" title="View Details">
                                        <i class="fas fa-eye me-1"></i> Details
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="removeVideoTags('${videoId}')" title="Remove Tags">
                                        <i class="fas fa-times me-1"></i> Remove Tags
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    gridContainer.innerHTML = html;
}

function openVideoPreviewModal(videoId, videoName, videoDataStr) {
    console.log('Opening video preview modal for:', videoName);
    try {
        const videoData = JSON.parse(videoDataStr);
        console.log('Video data:', videoData);

        // Create video preview modal HTML
        let modalHtml = '<div class="modal fade" id="videoPreviewModal" tabindex="-1">';
        modalHtml += '<div class="modal-dialog modal-xl">';
        modalHtml += '<div class="modal-content">';
        modalHtml += '<div class="modal-header">';
        modalHtml += '<h5 class="modal-title">';
        modalHtml += '<i class="fas fa-video me-2"></i>Video Preview: ' + videoName;
        modalHtml += '</h5>';
        modalHtml += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>';
        modalHtml += '</div>';
        modalHtml += '<div class="modal-body">';
        modalHtml += '<div class="text-center">';

        // Add thumbnail if available
        if (videoData.thumbnail) {
            modalHtml += '<img src="' + videoData.thumbnail + '" class="img-fluid mb-3" alt="' + videoName + '" style="max-height: 300px;">';
        }

        // Add video player
        modalHtml += '<div class="video-player-container bg-dark rounded p-2">';
        modalHtml += '<video id="videoPlayer" controls class="w-100" style="max-height: 500px;"';
        if (videoData.thumbnail) {
            modalHtml += ' poster="' + videoData.thumbnail + '"';
        }
        modalHtml += '>';

        // Use constructTaggedMediaUrl for consistent URL construction
        const videoUrl = constructTaggedMediaUrl(videoData.name || 'video', 'video', videoData.path || videoData.url);
        // Add debug info
        modalHtml += '<div class="mt-2 small text-muted">';
        modalHtml += '<strong>Debug URL:</strong> ' + videoUrl;
        modalHtml += '</div>';
        modalHtml += '<source src="' + videoUrl + '" type="video/mp4">';
        modalHtml += '<source src="' + videoUrl + '" type="video/webm">';
        modalHtml += '<source src="' + videoUrl + '" type="video/ogg">';
        modalHtml += 'Your browser does not support the video tag.';
        modalHtml += '</video>';
        modalHtml += '</div>';

        // Add debug info
        modalHtml += '<div class="mt-2 small text-muted">';
        modalHtml += '<strong>Debug:</strong> URL: ' + videoUrl;
        modalHtml += '</div>';

        // Add metadata
        modalHtml += '<div class="mt-3">';
        modalHtml += '<p class="text-muted mb-2">' + (videoData.description || 'No description available') + '</p>';
        modalHtml += '<div class="row text-center">';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">Category</small><br>';
        modalHtml += '<strong>' + (videoData.category || 'N/A') + '</strong>';
        modalHtml += '</div>';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">BIM Level</small><br>';
        modalHtml += '<strong>' + (videoData.bimLevel || 'N/A') + '</strong>';
        modalHtml += '</div>';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">Views</small><br>';
        modalHtml += '<strong>' + (videoData.views || 0) + '</strong>';
        modalHtml += '</div>';
        modalHtml += '<div class="col-md-3">';
        modalHtml += '<small class="text-muted">Tags</small><br>';
        modalHtml += '<strong>' + ((videoData.tags || []).length) + ' tags</strong>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';

        // Add footer with buttons
        modalHtml += '<div class="modal-footer">';
        modalHtml += '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">';
        modalHtml += '<i class="fas fa-times me-1"></i>Close';
        modalHtml += '</button>';
        modalHtml += '<button type="button" class="btn btn-primary" onclick="openVideoTagModal(\'' + videoId + '\', \'' + videoName.replace(/'/g, '\\\'') + '\', \'' + videoDataStr.replace(/'/g, '\\\'') + '\')">';
        modalHtml += '<i class="fas fa-tag me-1"></i>Tag This Video';
        modalHtml += '</button>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';
        modalHtml += '</div>';

        // Remove existing modal if any
        const existingModal = document.getElementById('videoPreviewModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('Modal HTML added to body');

        // Show modal
        const modalElement = document.getElementById('videoPreviewModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            console.log('Modal shown successfully');

            // Auto-load video when modal opens
            modal._element.addEventListener('shown.bs.modal', function () {
                const video = document.getElementById('videoPlayer');
                if (video) {
                    console.log('Loading video:', video.src);
                    video.load();
                } else {
                    console.error('Video player element not found');
                }
            });

            // Stop video when modal closes
            modal._element.addEventListener('hidden.bs.modal', function () {
                const video = document.getElementById('videoPlayer');
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        } else {
            console.error('Modal element not found after creation');
        }

    } catch (error) {
        console.error('Error opening video preview modal:', error);
        alert('Error loading video preview: ' + error.message);
    }
}

// Category Management Functions
function toggleCustomCategory() {
    const customDiv = document.getElementById('customCategoryDiv');
    const input = document.getElementById('customCategoryInput');

    if (customDiv.classList.contains('d-none')) {
        // Show custom category input
        customDiv.classList.remove('d-none');
        input.focus();
        input.value = '';
    } else {
        // Hide custom category input
        customDiv.classList.add('d-none');
        input.value = '';
    }
}

function addCustomCategory() {
    const input = document.getElementById('customCategoryInput');
    const categoryName = input.value.trim();

    if (!categoryName) {
        alert('Please enter a category name');
        input.focus();
        return;
    }

    // Check if category already exists
    const select = document.getElementById('videoCategory');
    const existingOptions = Array.from(select.options).map(opt => opt.value.toLowerCase());

    if (existingOptions.includes(categoryName.toLowerCase())) {
        alert('This category already exists');
        input.focus();
        return;
    }

    // Validate category name (no special characters, reasonable length)
    if (categoryName.length < 2 || categoryName.length > 50) {
        alert('Category name must be between 2 and 50 characters');
        input.focus();
        return;
    }

    if (!/^[a-zA-Z0-9\s\-&()]+$/.test(categoryName)) {
        alert('Category name can only contain letters, numbers, spaces, hyphens, ampersands, and parentheses');
        input.focus();
        return;
    }

    // Create category object
    const newCategory = {
        value: categoryName.toLowerCase().replace(/\s+/g, '-'),
        displayName: categoryName
    };

    // Add to custom categories array
    customCategories.push(newCategory);

    // Save to localStorage
    saveCustomCategoriesToStorage();

    // Add new category to dropdown
    const newOption = document.createElement('option');
    newOption.value = newCategory.value;
    newOption.textContent = newCategory.displayName;
    newOption.setAttribute('data-custom', 'true');
    select.appendChild(newOption);

    // Select the new category
    select.value = newCategory.value;

    // Hide custom category input and show success
    document.getElementById('customCategoryDiv').classList.add('d-none');
    input.value = '';

    // Show success message
    alert('âœ… New category "' + categoryName + '" added successfully and saved!');

    console.log('New category added and saved:', newCategory);
}

function cancelCustomCategory() {
    const customDiv = document.getElementById('customCategoryDiv');
    const input = document.getElementById('customCategoryInput');

    customDiv.classList.add('d-none');
    input.value = '';
}

function openVideoTagModal(videoId) {
    console.log('Opening video tag modal for ID:', videoId);
    console.log('Available videos in allVideos:', allVideos.length);

    try {
        // Find video data from global array
        const videoData = allVideos.find(v => v.id == videoId);
        console.log('Found video data:', videoData);

        if (!videoData) {
            console.error('Video not found in allVideos array');
            console.log('Available video IDs:', allVideos.map(v => v.id));
            alert('Video not found. Please refresh the page and try again.');
            return;
        }

        currentSelectedVideo = videoData;

        // Populate the tagging modal
        document.getElementById('selectedVideoName').textContent = videoData.name || 'Unknown Video';
        document.getElementById('selectedVideoPath').textContent = videoData.path || videoData.url || 'N/A';

        // Pre-fill form with existing data
        document.getElementById('videoCategory').value = videoData.category || '';
        document.getElementById('videoBimLevel').value = videoData.bimLevel || '';
        document.getElementById('videoDuration').value = videoData.duration || '';
        document.getElementById('videoLanguage').value = videoData.language || 'id';
        document.getElementById('videoDescription').value = videoData.description || '';
        document.getElementById('videoTags').value = (videoData.tags || []).join(', ');

        // Display previously used tags
        displayPreviouslyUsedTags();

        // Hide custom category input when opening modal
        document.getElementById('customCategoryDiv').classList.add('d-none');
        document.getElementById('customCategoryInput').value = '';

        // Close video details modal if it's open
        const detailsModal = document.getElementById('videoDetailsModal');
        if (detailsModal && detailsModal.classList.contains('show')) {
            const bsDetailsModal = bootstrap.Modal.getInstance(detailsModal);
            if (bsDetailsModal) {
                bsDetailsModal.hide();
            }
        }

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('videoTagModal'));
        modal.show();
        console.log('Video tag modal opened successfully');

        // Highlight selected card (only if event context exists)
        if (event && event.currentTarget) {
            const selectedCard = event.currentTarget.closest('.video-card');
            if (selectedCard) {
                document.querySelectorAll('.video-card').forEach(card => {
                    card.classList.remove('border-primary', 'bg-light');
                });
                selectedCard.classList.add('border-primary', 'bg-light');
            }
        }

    } catch (error) {
        console.error('Error opening video tag modal:', error);
        alert('Error loading video data for tagging: ' + error.message);
    }
}

async function saveVideoTags() {
    if (!currentSelectedVideo) {
        alert('No video selected');
        return;
    }

    const tagData = {
        videoId: currentSelectedVideo.id,
        category: document.getElementById('videoCategory').value,
        bimLevel: document.getElementById('videoBimLevel').value,
        duration: document.getElementById('videoDuration').value,
        language: document.getElementById('videoLanguage').value,
        description: document.getElementById('videoDescription').value.trim(),
        tags: document.getElementById('videoTags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
    };

    // Validation
    if (!tagData.category || !tagData.bimLevel) {
        alert('Please fill in at least Category and BIM Level');
        return;
    }

    try {
        console.log('ðŸ’¾ Saving video tags:', tagData);

        // Try to save to server API
        const response = await fetch('/api/admin/videos/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tagData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('âœ… Server save successful:', result);
            alert('âœ… Video tags saved successfully to server!');

            // Update local video data
            const videoIndex = allVideos.findIndex(v => v.id === currentSelectedVideo.id);
            if (videoIndex !== -1) {
                allVideos[videoIndex] = {
                    ...allVideos[videoIndex],
                    ...tagData,
                    tagged: true
                };
            }

            // Close modal and refresh display
            bootstrap.Modal.getInstance(document.getElementById('videoTagModal')).hide();
            displayVideos(allVideos);

            // Clear selection
            currentSelectedVideo = null;

        } else {
            // Check if it's an HTML error response (API not found)
            const responseText = await response.text();
            console.error('âŒ Server response error:', response.status, responseText);

            if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>')) {
                console.log('ðŸ“ API endpoint not available, saving locally...');

                // Save locally since server endpoint doesn't exist
                console.log('Server endpoint not available - saving locally');

                // Update local video data and save to localStorage
                const videoIndex = allVideos.findIndex(v => v.id === currentSelectedVideo.id);
                if (videoIndex !== -1) {
                    allVideos[videoIndex] = {
                        ...allVideos[videoIndex],
                        ...tagData,
                        tagged: true,
                        localSave: true // Mark as locally saved
                    };

                    // Save tags to localStorage
                    savedTags[currentSelectedVideo.id] = tagData;
                    saveTagsToStorage();

                    console.log('âœ… Tags saved to localStorage for video:', currentSelectedVideo.id);
                }

                // Close modal and refresh display
                bootstrap.Modal.getInstance(document.getElementById('videoTagModal')).hide();
                displayVideos(allVideos);

                // Clear selection
                currentSelectedVideo = null;

                console.log('âœ… Tags saved locally');
                return;
            }

            // Try to parse as JSON error
            try {
                const error = JSON.parse(responseText);
                alert('âŒ Failed to save video tags: ' + (error.error || 'Unknown error'));
            } catch (jsonError) {
                alert('âŒ Server returned invalid response. Tags saved locally.');
            }
        }

    } catch (error) {
        console.error('âŒ Network error saving video tags:', error);

        // Fallback: save locally
        console.log('ðŸ“ Network error, saving locally...');
        alert('âš ï¸ Network error. Tags saved locally for now.\n\nNote: Tags will be lost on page refresh until connection is restored.');

        // Update local video data
        const videoIndex = allVideos.findIndex(v => v.id === currentSelectedVideo.id);
        if (videoIndex !== -1) {
            allVideos[videoIndex] = {
                ...allVideos[videoIndex],
                ...tagData,
                tagged: true,
                localSave: true // Mark as locally saved
            };
        }

        // Close modal and refresh display
        bootstrap.Modal.getInstance(document.getElementById('videoTagModal')).hide();
        displayVideos(allVideos);

        // Clear selection
        currentSelectedVideo = null;

        console.log('âœ… Tags saved locally due to network error');
    }
}

function filterVideos() {
    const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('videoCategoryFilter').value;
    const tagStatusFilter = document.getElementById('videoTagStatusFilter').value;
    const sortFilter = document.getElementById('videoSortFilter').value;

    let filteredVideos = allVideos.filter(video => {
        const videoName = video.name.toLowerCase();
        const videoCategory = video.category.toLowerCase();
        const videoTags = video.tags || [];
        const isTagged = video.tagged || videoTags.length > 0;

        // Search filter
        const matchesSearch = !searchTerm ||
            videoName.includes(searchTerm) ||
            videoTags.some(tag => tag.toLowerCase().includes(searchTerm));

        // Category filter
        const matchesCategory = !categoryFilter || videoCategory === categoryFilter;

        // Tag status filter
        let matchesTagStatus = true;
        if (tagStatusFilter === 'tagged') {
            matchesTagStatus = isTagged;
        } else if (tagStatusFilter === 'untagged') {
            matchesTagStatus = !isTagged;
        }

        return matchesSearch && matchesCategory && matchesTagStatus;
    });

    // Sort videos
    filteredVideos.sort((a, b) => {
        switch (sortFilter) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'category':
                return a.category.localeCompare(b.category);
            case 'views':
                return (b.views || 0) - (a.views || 0);
            case 'newest':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            default:
                return 0;
        }
    });

    displayVideos(filteredVideos);
}

function clearVideoFilters() {
    document.getElementById('videoSearchInput').value = '';
    document.getElementById('videoCategoryFilter').value = '';
    document.getElementById('videoTagStatusFilter').value = '';
    document.getElementById('videoSortFilter').value = 'name';

    displayVideos(allVideos);
}

// Filter videos in the video tags section
function filterVideoTags() {
    const searchTerm = document.getElementById('videoSearchInput').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('videoCategoryFilter').value;
    const tagStatusFilter = document.getElementById('videoTagStatusFilter').value;
    const sortFilter = document.getElementById('videoSortFilter').value;

    let filteredVideos = allVideos.filter(video => {
        const videoName = (video.name || '').toLowerCase();
        const videoCategory = video.category || '';
        const videoTags = video.tags || [];
        const isTagged = video.tagged || videoTags.length > 0;

        // Search filter
        const matchesSearch = !searchTerm ||
            videoName.includes(searchTerm) ||
            videoTags.some(tag => tag.toLowerCase().includes(searchTerm));

        // Category filter
        const matchesCategory = !categoryFilter || videoCategory === categoryFilter;

        // Tag status filter
        let matchesTagStatus = true;
        if (tagStatusFilter === 'tagged') {
            matchesTagStatus = isTagged;
        } else if (tagStatusFilter === 'untagged') {
            matchesTagStatus = !isTagged;
        }

        return matchesSearch && matchesCategory && matchesTagStatus;
    });

    // Sort videos
    filteredVideos.sort((a, b) => {
        switch (sortFilter) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'category':
                return (a.category || '').localeCompare(b.category || '');
            case 'views':
                return (b.views || 0) - (a.views || 0);
            case 'newest':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            default:
                return 0;
        }
    });

    displayVideos(filteredVideos);

    // Update filter results count
    updateVideoFilterResults(filteredVideos.length, allVideos.length);
}

// Update video filter results information
function updateVideoFilterResults(filteredCount, totalCount) {
    let resultsInfo = '';
    if (filteredCount !== totalCount) {
        resultsInfo = `<div class="alert alert-info py-2 mt-3">
            <i class="fas fa-filter me-2"></i>
            Showing ${filteredCount} of ${totalCount} videos
        </div>`;
    }

    // Insert results info before the videos grid
    const container = document.getElementById('videosGrid');
    const existingAlert = container.querySelector('.alert');

    if (existingAlert) {
        existingAlert.remove();
    }

    if (resultsInfo) {
        container.insertAdjacentHTML('afterbegin', resultsInfo);
    }
}

function updateTotalVideosCount(count) {
    const badge = document.getElementById('totalVideosCount');
    if (badge) {
        badge.innerHTML = `<i class="fas fa-video me-1"></i>Total: ${count} videos`;
    }
}

function viewVideoDetails(videoId) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) {
        alert('Video not found');
        return;
    }

    // Create details modal
    const modalHtml = `
        <div class="modal fade" id="videoDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-video me-2"></i>Video Details
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <h6>Video Information</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>ID:</strong></td><td style="word-wrap: break-word; max-width: 200px;">${video.id}</td></tr>
                                    <tr><td><strong>Name:</strong></td><td style="word-wrap: break-word; max-width: 200px;">${video.name}</td></tr>
                                    <tr><td><strong>Category:</strong></td><td><span class="badge bg-primary">${video.category}</span></td></tr>
                                    <tr><td><strong>BIM Level:</strong></td><td><span class="badge bg-info">${video.bimLevel}</span></td></tr>
                                    <tr><td><strong>Views:</strong></td><td>${video.views || 0}</td></tr>
                                    <tr><td><strong>Duration:</strong></td><td>${video.duration || 'N/A'} min</td></tr>
                                    <tr><td><strong>Language:</strong></td><td>${video.language || 'N/A'}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Tags & Description</h6>
                                ${video.tags && video.tags.length > 0 ? `
                                    <div class="mb-3">
                                        <strong>Tags:</strong>
                                        <div class="mt-1">
                                            ${video.tags.map(tag => `<span class="badge bg-light text-dark me-1">${tag}</span>`).join('')}
                                        </div>
                                    </div>
                                ` : '<p class="text-muted">No tags assigned</p>'}

                                ${video.description ? `
                                    <div>
                                        <strong>Description:</strong>
                                        <p class="mt-1">${video.description}</p>
                                    </div>
                                ` : '<p class="text-muted">No description available</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="openVideoTagModal('${videoId}')">Edit Tags</button>
                    </div>
                </div>
            </div>
        </div>`;

    // Remove existing modal if any
    const existingModal = document.getElementById('videoDetailsModal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('videoDetailsModal'));
    modal.show();
}

async function removeVideoTags(videoId) {
    if (!confirm('Are you sure you want to remove all tags from this video?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/videos/tags/${videoId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('âœ… Video tags removed successfully!');

            // Update local video data
            const videoIndex = allVideos.findIndex(v => v.id === videoId);
            if (videoIndex !== -1) {
                allVideos[videoIndex].tags = [];
                allVideos[videoIndex].tagged = false;
                allVideos[videoIndex].category = 'general';
                allVideos[videoIndex].bimLevel = 'beginner';
            }

            displayVideos(allVideos);

        } else {
            const error = await response.json();
            alert('âŒ Failed to remove video tags: ' + (error.error || 'Unknown error'));
        }

    } catch (error) {
        console.error('Error removing video tags:', error);
        alert('âŒ Error removing video tags: ' + error.message);
    }
}

function exportTaggedVideos() {
    const taggedVideos = allVideos.filter(video => video.tagged || (video.tags && video.tags.length > 0));

    if (taggedVideos.length === 0) {
        alert('No tagged videos to export');
        return;
    }

    // Create CSV content
    const headers = ['ID', 'Name', 'Category', 'BIM Level', 'Duration', 'Language', 'Views', 'Tags', 'Description'];
    const csvContent = [
        headers.join(','),
        ...taggedVideos.map(video => [
            video.id,
            `"${video.name.replace(/"/g, '""')}"`,
            video.category,
            video.bimLevel,
            video.duration || '',
            video.language || '',
            video.views || 0,
            `"${(video.tags || []).join('; ')}"`,
            `"${(video.description || '').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tagged-videos-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    alert(`âœ… Exported ${taggedVideos.length} tagged videos successfully!`);
}

// Missing functions called in HTML - BIM Media, PDF Management, Video Display Management

async function loadBIMMedia() {
    try {
        console.log('Starting BIM Media load...');

        // Create content step by step to avoid template literal issues
        let content = '';

        // Add search controls
        content += `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="content-card">
                        <div class="card-body-modern">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-4">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-search me-2"></i>Cari Video
                                    </label>
                                    <input type="text" class="form-control" id="videoSearchInput"
                                           placeholder="Cari berdasarkan nama, tahun, atau lokasi..."
                                           onkeyup="filterVideos()">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-filter me-2"></i>Filter Tahun
                                    </label>
                                    <select class="form-select" id="yearFilter" onchange="filterVideos()">
                                        <option value="">All Years</option>
                                        <option value="2023">2023</option>
                                        <option value="2024">2024</option>
                                        <option value="2025">2025</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-map-marker-alt me-2"></i>Location
                                    </label>
                                    <select class="form-select" id="locationFilter" onchange="filterVideos()">
                                        <option value="">All Locations</option>
                                        <option value="Jawa">Jawa</option>
                                        <option value="Sumatra">Sumatra</option>
                                        <option value="Kalimantan">Kalimantan</option>
                                        <option value="Nusa Tenggara">Nusa Tenggara</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label fw-semibold">
                                        <i class="fas fa-file me-2"></i>Media Type
                                    </label>
                                    <select class="form-select" id="mediaTypeFilter" onchange="filterVideos()">
                                        <option value="">All Media</option>
                                        <option value="video">Videos Only</option>
                                        <option value="image">Images Only</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-modern-primary" onclick="scanMediaSources()">
                                            <i class="fas fa-sync-alt me-2"></i>Scan Sources
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        // Add main content area
        content += `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Media Files</h6>
                        </div>
                        <div class="card-body">
                            <div id="media-files-list">
                                <div class="text-center text-muted">
                                    <i class="fas fa-images fa-3x mb-3"></i>
                                    <p>Click "Scan Media Sources" to load available media files</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        console.log('Setting BIM media content...');
        document.getElementById('bim-media-content').innerHTML = content;
        console.log('BIM Media interface loaded successfully');

    } catch (error) {
        console.error('Error loading BIM media:', error);
        document.getElementById('bim-media-content').innerHTML = '<div class="alert alert-danger">Error loading BIM media management interface</div>';
    }
}

async function scanMediaSources() {
    try {
        console.log('Scanning media sources...');
        // Placeholder implementation
        alert('Media scanning functionality will be implemented here');
    } catch (error) {
        console.error('Error scanning media sources:', error);
    }
}

async function loadPDFManagement() {
    try {
        console.log('ðŸ”„ Loading PDF management...');

        // Check if content management module is available
        if (window.adminPanel && window.adminPanel.modules &&
            window.adminPanel.modules.get('contentManagement') &&
            window.adminPanel.modules.get('contentManagement').instance) {

            // Delegate to the content management module
            console.log('ðŸ“„ Delegating to ContentManagementModule...');
            await window.adminPanel.modules.get('contentManagement').instance.loadPDFManagement();
            return;
        }

        // Fallback implementation if module not available yet
        console.log('ðŸ“„ ContentManagementModule not available, using fallback...');

        const tableBody = document.getElementById('pdfManagementTableBody');
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0">Memuat materi PDF...</p>
                    </div>
                </td>
            </tr>`;

        // Fetch PDF materials from API
        const response = await fetch('/api/admin/learning-materials');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('âœ… PDF materials loaded:', data.data.length, 'materials');

        allPDFManagementData = data.data || [];

        // Update badges - check if functions are available
        if (typeof updateTotalPDFManagementCount === 'function') {
            updateTotalPDFManagementCount(allPDFManagementData.length);
        } else {
            console.warn('âš ï¸ updateTotalPDFManagementCount function not available');
            // Fallback: update badge directly
            const badge = document.getElementById('totalPDFManagementCount');
            if (badge) {
                badge.innerHTML = `<i class="fas fa-file-pdf me-1"></i>Total: ${allPDFManagementData.length} PDFs`;
            }
        }

        if (typeof updateSelectedPDFManagementCount === 'function') {
            updateSelectedPDFManagementCount(selectedPDFManagementIds.size);
        } else {
            console.warn('âš ï¸ updateSelectedPDFManagementCount function not available');
            // Fallback: update badge directly
            const badge = document.getElementById('selectedPDFManagementCount');
            if (badge) {
                badge.innerHTML = `<i class="fas fa-check me-1"></i>Displayed: ${selectedPDFManagementIds.size} PDFs`;
            }
        }

        // Render table - check if function is available
        if (typeof displayPDFManagementTable === 'function') {
            displayPDFManagementTable(allPDFManagementData);
        } else {
            console.warn('âš ï¸ displayPDFManagementTable function not available');
            // Basic fallback table
            let html = '';
            allPDFManagementData.slice(0, 10).forEach((pdf, index) => {
                html += `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td class="text-center">-</td>
                        <td>${pdf.title || pdf.name || 'Unknown'}</td>
                        <td><span class="badge bg-info">${pdf.category || 'general'}</span></td>
                        <td><span class="badge bg-warning">${pdf.level || 'beginner'}</span></td>
                        <td class="text-center">${pdf.pageCount || 'N/A'}</td>
                        <td class="text-center">${pdf.fileSize ? formatFileSize(pdf.fileSize) : 'N/A'}</td>
                        <td>${pdf.description || 'No description'}</td>
                        <td>-</td>
                    </tr>`;
            });
            tableBody.innerHTML = html;
        }

        // Initialize filters - check if function is available
        if (typeof initializePDFFilters === 'function') {
            initializePDFFilters();
        }

        console.log('âœ… PDF management loaded successfully (fallback mode)');

    } catch (error) {
        console.error('âŒ Error loading PDF management:', error);
        document.getElementById('pdfManagementTableBody').innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="alert alert-danger mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Gagal memuat materi PDF: ${error.message}
                    </div>
                </td>
            </tr>`;
    }
}

async function loadVideoDisplayManagement() {
    try {
        console.log('Loading video display management...');
        // Placeholder implementation
        document.getElementById('videoDisplayTableBody').innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0">Memuat pengaturan tampilan video...</p>
                    </div>
                </td>
            </tr>`;

        // Simulate loading
        setTimeout(() => {
            document.getElementById('videoDisplayTableBody').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="text-muted">
                            <i class="fas fa-tv fa-3x mb-3"></i>
                            <p>Video display management functionality is under development</p>
                        </div>
                    </td>
                </tr>`;
        }, 1000);

    } catch (error) {
        console.error('Error loading video display management:', error);
    }
}

// Additional placeholder functions for sections that haven't been fully implemented yet
function loadNews() {
    document.getElementById('news-content').innerHTML = '<div class="text-center"><div class="spinner-border text-info" role="status"><span class="visually-hidden">Loading...</span></div><p>Memuat manajemen berita...</p></div>';
    setTimeout(() => {
        document.getElementById('news-content').innerHTML = '<div class="alert alert-info">News management functionality will be implemented here.</div>';
    }, 1000);
}

function loadPlugins() {
    document.getElementById('plugins-content').innerHTML = '<div class="text-center"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Loading...</span></div><p>Memuat plugin...</p></div>';
    setTimeout(() => {
        document.getElementById('plugins-content').innerHTML = '<div class="alert alert-info">Plugins management functionality will be implemented here.</div>';
    }, 1000);
}

function loadLibrary() {
    document.getElementById('library-content').innerHTML = '<div class="text-center"><div class="spinner-border text-dark" role="status"><span class="visually-hidden">Loading...</span></div><p>Memuat file pustaka...</p></div>';
    setTimeout(() => {
        document.getElementById('library-content').innerHTML = '<div class="alert alert-info">Library management functionality will be implemented here.</div>';
    }, 1000);
}

function loadSystem() {
    document.getElementById('system-content').innerHTML = '<div class="text-center"><div class="spinner-border text-danger" role="status"><span class="visually-hidden">Loading...</span></div><p>Memuat informasi sistem...</p></div>';
    setTimeout(() => {
        document.getElementById('system-content').innerHTML = '<div class="alert alert-info">System information functionality will be implemented here.</div>';
    }, 1000);
}

// Global utility functions
function constructTaggedMediaUrl(filename, type, fullPath) {
    const sourcePath = String(fullPath || filename || '').trim();
    if (!sourcePath) {
        return '';
    }

    let normalizedPath = sourcePath.replace(/\//g, '\\');
    if (/^PC-BIM02[\\/]/i.test(normalizedPath)) {
        normalizedPath = `\\\\pc-bim02\\PROJECT BIM 2025\\${normalizedPath.replace(/^PC-BIM02[\\/]+/i, '')}`;
    }

    if (/^\\\\pc-bim02\\/i.test(normalizedPath)) {
        return `/api/bim-media/file?path=${encodeURIComponent(normalizedPath.replace(/\\/g, '/'))}`;
    }

    if (/^G:[\\/]/i.test(normalizedPath)) {
        return `/api/admin/preview-media?path=${encodeURIComponent(normalizedPath.replace(/\\/g, '/'))}`;
    }

    return '';
}

// PDF Management Functions

function displayPDFManagementTable(pdfs) {
    const tableBody = document.getElementById('pdfManagementTableBody');

    if (pdfs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <i class="fas fa-file-pdf fa-3x text-muted mb-3"></i>
                        <p class="text-muted mb-2">No PDF materials found</p>
                        <button class="btn btn-primary" onclick="showPDFUploadModal()">
                            <i class="fas fa-plus me-2"></i>Tambah PDF Pertama
                        </button>
                    </div>
                </td>
            </tr>`;
        return;
    }

    let html = '';
    pdfs.forEach((pdf, index) => {
        const pdfId = pdf.id;
        const title = pdf.title || pdf.name || 'Unknown';
        const category = pdf.category || 'general';
        const level = pdf.level || 'beginner';
        const pages = pdf.pageCount || 'Unknown';
        const size = pdf.fileSize ? formatFileSize(pdf.fileSize) : 'Unknown';
        const description = pdf.description || '';
        const isSelected = selectedPDFManagementIds.has(pdfId.toString());
        const actualIndex = index + 1;

        html += `
            <tr>
                <td class="text-center fw-bold">${actualIndex}</td>
                <td class="text-center">
                    <div class="form-check">
                        <input class="form-check-input pdf-display-checkbox"
                               type="checkbox"
                               id="pdf_display_${pdfId}"
                               value="${pdfId}"
                               ${isSelected ? 'checked' : ''}
                               onchange="updatePDFManagementSelection()">
                        <label class="form-check-label" for="pdf_display_${pdfId}"></label>
                    </div>
                </td>
                <td>
                    <div class="fw-bold text-truncate" style="max-width: 250px;" title="${title}">${title}</div>
                </td>
                <td><span class="badge bg-info">${category}</span></td>
                <td><span class="badge bg-warning">${level}</span></td>
                <td class="text-center">${pages}</td>
                <td class="text-center">${size}</td>
                <td>
                    <div class="text-truncate" style="max-width: 200px;" title="${description}">
                        ${description || '<em>No description</em>'}
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-info" onclick="previewPDFManagement('${pdfId}')" title="Pratinjau PDF">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-primary" onclick="editPDFManagement('${pdfId}')" title="Edit PDF">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deletePDFManagement('${pdfId}', '${title.replace(/'/g, "\\'")}')" title="Hapus PDF">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tableBody.innerHTML = html;
}

function initializePDFFilters() {
    // Add event listeners for filters
    const searchInput = document.getElementById('pdfManagementSearchInput');
    const categoryFilter = document.getElementById('pdfManagementCategoryFilter');
    const levelFilter = document.getElementById('pdfManagementLevelFilter');
    const sortFilter = document.getElementById('pdfManagementSortFilter');

    if (searchInput) searchInput.addEventListener('keyup', filterPDFManagement);
    if (categoryFilter) categoryFilter.addEventListener('change', filterPDFManagement);
    if (levelFilter) levelFilter.addEventListener('change', filterPDFManagement);
    if (sortFilter) sortFilter.addEventListener('change', filterPDFManagement);
}

function filterPDFManagement() {
    const searchTerm = document.getElementById('pdfManagementSearchInput')?.value.toLowerCase().trim() || '';
    const categoryFilter = document.getElementById('pdfManagementCategoryFilter')?.value || '';
    const levelFilter = document.getElementById('pdfManagementLevelFilter')?.value || '';
    const sortFilter = document.getElementById('pdfManagementSortFilter')?.value || 'title';

    let filteredPDFs = allPDFManagementData.filter(pdf => {
        const title = (pdf.title || pdf.name || '').toLowerCase();
        const description = (pdf.description || '').toLowerCase();
        const category = pdf.category || '';
        const level = pdf.level || '';

        const matchesSearch = !searchTerm ||
            title.includes(searchTerm) ||
            description.includes(searchTerm) ||
            category.includes(searchTerm);

        const matchesCategory = !categoryFilter || category === categoryFilter;
        const matchesLevel = !levelFilter || level === levelFilter;

        return matchesSearch && matchesCategory && matchesLevel;
    });

    // Sort PDFs
    filteredPDFs.sort((a, b) => {
        switch (sortFilter) {
            case 'title':
                return (a.title || a.name || '').localeCompare(b.title || b.name || '');
            case 'category':
                return (a.category || '').localeCompare(b.category || '');
            case 'level':
                const levelOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3, 'expert': 4 };
                return levelOrder[a.level] - levelOrder[b.level];
            case 'pages':
                return (b.pageCount || 0) - (a.pageCount || 0);
            case 'newest':
                return new Date(b.createdAt || b.uploadedAt || 0) - new Date(a.createdAt || a.uploadedAt || 0);
            default:
                return 0;
        }
    });

    filteredPDFManagementData = filteredPDFs;
    displayPDFManagementTable(filteredPDFs);
}

function updatePDFManagementSelection() {
    try {
        const checkboxes = document.querySelectorAll('.pdf-display-checkbox');
        const previousCount = selectedPDFManagementIds.size;
        selectedPDFManagementIds.clear();

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedPDFManagementIds.add(checkbox.value.toString());
            }
        });

        const newCount = selectedPDFManagementIds.size;
        console.log(`ðŸ”„ Updated PDF selection: ${previousCount} â†’ ${newCount} PDFs selected`);

        updateSelectedPDFManagementCount(newCount);

    } catch (error) {
        console.error('âŒ Error updating PDF selection:', error);
    }
}

function previewPDFManagement(pdfId) {
    const pdf = allPDFManagementData.find(p => p.id == pdfId);
    if (!pdf) {
        alert('PDF not found');
        return;
    }

    // Open PDF in the reader (same as courses page)
    window.open(`/public/reader.html?material=${encodeURIComponent(pdfId)}`, '_blank');
}

function editPDFManagement(pdfId) {
    const pdf = allPDFManagementData.find(p => p.id == pdfId);
    if (!pdf) {
        alert('PDF not found');
        return;
    }

    // Create edit modal
    const modalHtml = `
        <div class="modal fade" id="pdfEditModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-edit me-2"></i>Edit Materi PDF
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="pdfEditForm">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-8">
                                    <label class="form-label">Title *</label>
                                    <input type="text" class="form-control" id="editPdfTitle" value="${pdf.title || pdf.name || ''}" required>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Category *</label>
                                    <select class="form-select" id="editPdfCategory" required>
                                        <option value="autocad" ${pdf.category === 'autocad' ? 'selected' : ''}>AutoCAD</option>
                                        <option value="revit" ${pdf.category === 'revit' ? 'selected' : ''}>Revit BIM</option>
                                        <option value="sketchup" ${pdf.category === 'sketchup' ? 'selected' : ''}>SketchUp</option>
                                        <option value="3dsmax" ${pdf.category === '3dsmax' ? 'selected' : ''}>3ds Max</option>
                                        <option value="general" ${pdf.category === 'general' ? 'selected' : ''}>General BIM</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">BIM Level *</label>
                                    <select class="form-select" id="editPdfLevel" required>
                                        <option value="beginner" ${pdf.level === 'beginner' ? 'selected' : ''}>Beginner</option>
                                        <option value="intermediate" ${pdf.level === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                                        <option value="advanced" ${pdf.level === 'advanced' ? 'selected' : ''}>Advanced</option>
                                        <option value="expert" ${pdf.level === 'expert' ? 'selected' : ''}>Expert</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Language</label>
                                    <select class="form-select" id="editPdfLanguage">
                                        <option value="id" ${pdf.language === 'id' ? 'selected' : ''}>Bahasa Indonesia</option>
                                        <option value="en" ${pdf.language === 'en' ? 'selected' : ''}>English</option>
                                        <option value="mixed" ${pdf.language === 'mixed' ? 'selected' : ''}>Mixed</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" id="editPdfDescription" rows="3">${pdf.description || ''}</textarea>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Cover Image (optional)</label>
                                    ${pdf.thumbnailPath ? `
                                        <div class="mb-2">
                                            <img src="${pdf.thumbnailPath}" alt="Current cover" style="max-width: 180px; border-radius: 6px; border: 1px solid #e5e7eb;">
                                        </div>
                                    ` : '<small class="text-muted d-block mb-2">No cover image uploaded</small>'}
                                    <input type="file" class="form-control" id="editPdfCoverImage" accept="image/png,image/jpeg,image/webp">
                                    <small class="text-muted">Unggah untuk mengganti sampul saat ini (JPG/PNG/WEBP, maks 10MB)</small>
                                </div>
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="editPdfDisplayOnCourses" ${pdf.displayOnCourses ? 'checked' : ''}>
                                        <label class="form-check-label" for="editPdfDisplayOnCourses">
                                            Display on Courses page
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Update PDF
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;

    // Remove existing modal
    const existingModal = document.getElementById('pdfEditModal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup form submission
    document.getElementById('pdfEditForm').addEventListener('submit', (e) => handlePDFUpdate(e, pdfId));

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('pdfEditModal'));
    modal.show();
}

async function handlePDFUpdate(e, pdfId) {
    e.preventDefault();

    const updateData = {
        title: document.getElementById('editPdfTitle').value.trim(),
        category: document.getElementById('editPdfCategory').value,
        level: document.getElementById('editPdfLevel').value,
        language: document.getElementById('editPdfLanguage').value,
        description: document.getElementById('editPdfDescription').value.trim(),
        displayOnCourses: document.getElementById('editPdfDisplayOnCourses').checked
    };

    try {
        const coverFile = document.getElementById('editPdfCoverImage')?.files?.[0];
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';
        submitBtn.disabled = true;

        const response = await fetch(`/api/admin/learning-materials/${pdfId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            if (coverFile) {
                const coverResult = await uploadPDFCoverImage(pdfId, coverFile);
                if (!coverResult) {
                    alert('âš ï¸ PDF updated, but cover image upload failed.');
                }
            }
            alert('âœ… PDF updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('pdfEditModal')).hide();
            loadPDFManagement();
        } else {
            const error = await response.json();
            alert('Gagal memperbarui PDF: ' + (error.error || 'Kesalahan tidak dikenal'));
        }

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error updating PDF:', error);
        alert('âŒ Error updating PDF: ' + error.message);
        e.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Update PDF';
        e.target.querySelector('button[type="submit"]').disabled = false;
    }
}

function deletePDFManagement(pdfId, title) {
    const confirmMsg = `Are you sure you want to permanently delete "${title}"?\n\nThis action cannot be undone!`;

    if (confirm(confirmMsg)) {
        const doubleConfirm = `FINAL CONFIRMATION: Delete "${title}"?\n\nThe PDF file and all associated data will be permanently lost!`;

        if (confirm(doubleConfirm)) {
            handlePDFDelete(pdfId, title);
        }
    }
}

async function handlePDFDelete(pdfId, title) {
    try {
        const response = await fetch(`/api/admin/learning-materials/${pdfId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert(`âœ… PDF "${title}" deleted successfully!`);
            loadPDFManagement();
        } else {
            const error = await response.json();
            alert('Gagal menghapus PDF: ' + (error.error || 'Kesalahan tidak dikenal'));
        }

    } catch (error) {
        console.error('Error deleting PDF:', error);
        alert('âŒ Error deleting PDF: ' + error.message);
    }
}

function showPDFUploadModal() {
    const modalHtml = `
        <div class="modal fade" id="pdfUploadModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-plus me-2"></i>Tambah Materi PDF Baru
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="pdfUploadForm" enctype="multipart/form-data">
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-12">
                                    <label class="form-label">PDF File *</label>
                                    <input type="file" class="form-control" id="pdfFile" accept=".pdf" required>
                                    <small class="text-muted">Select a PDF file to upload (max 100MB)</small>
                                </div>
                                <div class="col-md-8">
                                    <label class="form-label">Title *</label>
                                    <input type="text" class="form-control" id="pdfTitle" required placeholder="Enter PDF title">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Category *</label>
                                    <select class="form-select" id="pdfCategory" required>
                                        <option value="">Select Category</option>
                                        <option value="autocad">AutoCAD</option>
                                        <option value="revit">Revit BIM</option>
                                        <option value="sketchup">SketchUp</option>
                                        <option value="3dsmax">3ds Max</option>
                                        <option value="general">General BIM</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">BIM Level *</label>
                                    <select class="form-select" id="pdfLevel" required>
                                        <option value="">Select Level</option>
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Language</label>
                                    <select class="form-select" id="pdfLanguage">
                                        <option value="id">Bahasa Indonesia</option>
                                        <option value="en">English</option>
                                        <option value="mixed">Mixed</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" id="pdfDescription" rows="3" placeholder="Brief description of the PDF content..."></textarea>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Cover Image (optional)</label>
                                    <input type="file" class="form-control" id="pdfCoverImage" accept="image/png,image/jpeg,image/webp">
                                    <small class="text-muted">JPG/PNG/WEBP, max 10MB</small>
                                </div>
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="pdfDisplayOnCourses" checked>
                                        <label class="form-check-label" for="pdfDisplayOnCourses">
                                            Display on Courses page
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-upload me-2"></i>Unggah PDF
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;

    // Remove existing modal
    const existingModal = document.getElementById('pdfUploadModal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup form submission
    document.getElementById('pdfUploadForm').addEventListener('submit', handlePDFUpload);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('pdfUploadModal'));
    modal.show();
}

async function handlePDFUpload(e) {
    e.preventDefault();

    const fileInput = document.getElementById('pdfFile');
    const file = fileInput.files[0];
    const coverFile = document.getElementById('pdfCoverImage')?.files?.[0];

    if (!file) {
        alert('Please select a PDF file');
        return;
    }

    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file');
        return;
    }

    if (file.size > 100 * 1024 * 1024) {
        alert('File size must be less than 100MB');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', document.getElementById('pdfTitle').value.trim());
    formData.append('category', document.getElementById('pdfCategory').value);
    formData.append('level', document.getElementById('pdfLevel').value);
    formData.append('language', document.getElementById('pdfLanguage').value);
    formData.append('description', document.getElementById('pdfDescription').value.trim());
    formData.append('displayOnCourses', document.getElementById('pdfDisplayOnCourses').checked);

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Mengunggah...';
        submitBtn.disabled = true;

        const response = await fetch('/api/admin/learning-materials/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const materialId = result.data?.id;
            let coverUploaded = true;

            if (coverFile && materialId) {
                coverUploaded = await uploadPDFCoverImage(materialId, coverFile);
            }

            if (coverFile && materialId && !coverUploaded) {
                alert('âš ï¸ PDF uploaded, but cover image upload failed.');
            } else {
                alert('âœ… PDF uploaded and material created successfully!');
            }

            bootstrap.Modal.getInstance(document.getElementById('pdfUploadModal')).hide();
            loadPDFManagement();
        } else {
            const errorMessage = result.error || result.message || 'Unknown error';
            console.error('Upload failed:', result);
            alert('Gagal mengunggah PDF: ' + errorMessage);
        }

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error uploading PDF:', error);
        alert('âŒ Error uploading PDF: ' + error.message);
        e.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-upload me-2"></i>Unggah PDF';
        e.target.querySelector('button[type="submit"]').disabled = false;
    }
}

async function uploadPDFCoverImage(pdfId, coverFile) {
    try {
        if (!pdfId || !coverFile) return true;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(coverFile.type)) {
            alert('âŒ Cover image must be JPG, PNG, or WEBP.');
            return false;
        }

        if (coverFile.size > 10 * 1024 * 1024) {
            alert('âŒ Cover image must be less than 10MB.');
            return false;
        }

        const formData = new FormData();
        formData.append('cover', coverFile);

        const response = await fetch(`/api/admin/learning-materials/${pdfId}/cover`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            return false;
        }

        const result = await response.json();
        return !!result.success;
    } catch (error) {
        console.error('Error uploading cover image:', error);
        return false;
    }
}



function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
