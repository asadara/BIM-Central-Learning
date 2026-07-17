// Authenticated profile page backed by server evidence only.

const profileState = {
    profile: null,
    stats: null,
    achievements: [],
    loadedTabs: new Set()
};

document.addEventListener('DOMContentLoaded', async () => {
    initializeTabs();
    setupModal();
    setupPhotoUpload();
    setupShareAction();

    if (!getProfileAuthToken()) {
        redirectToLogin();
        return;
    }

    await loadProfilePage();
});

function getProfileAuthToken() {
    try {
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        return localStorage.getItem('token') || storedUser?.token || '';
    } catch (error) {
        return localStorage.getItem('token') || '';
    }
}

function redirectToLogin() {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/pages/login.html?redirect=${redirect}`);
}

async function profileFetch(url, options = {}) {
    const token = getProfileAuthToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers
    });

    if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        throw new Error('AUTH_REQUIRED');
    }
    return response;
}

async function fetchJson(url, options) {
    const response = await profileFetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP_${response.status}`);
    return body;
}

async function loadProfilePage() {
    setProfileStatus('Memuat identitas dan evidence belajar dari server...', false, true);
    try {
        const [profile, stats, achievements] = await Promise.all([
            fetchJson('/api/profile'),
            fetchJson('/api/profile/stats'),
            fetchJson('/api/profile/achievements')
        ]);

        profileState.profile = profile;
        profileState.stats = stats;
        profileState.achievements = Array.isArray(achievements) ? achievements : [];

        renderProfile(profile, stats);
        renderAchievements(profileState.achievements, document.getElementById('recent-achievements'), true);
        cacheAuthenticatedProfile(profile);
        setProfileStatus('Data identitas dan aktivitas berasal dari sesi serta evidence server.', false);
    } catch (error) {
        if (error.message === 'AUTH_REQUIRED') return;
        console.error('Failed to load profile:', error);
        renderUnavailableProfile();
        setProfileStatus('Data profil tidak dapat dimuat. Tidak ada data contoh yang digunakan.', true);
    }
}

function renderProfile(profile, stats) {
    setText('profile-name', profile.name || profile.username || 'Nama belum tersedia');
    setText('user-level', profile.bimLevel || 'Belum ditetapkan');

    const context = [profile.role, profile.organization].filter(Boolean);
    setText('profile-bio', context.length ? context.join(' · ') : 'Jabatan dan organisasi belum ditetapkan.');
    setText('join-date', profile.joinDate || '—');
    setText('verified-attempts', formatCount(stats.verifiedAttempts));
    setText('verified-certificates', formatCount(stats.certifications));
    setText('completed-modules', formatCount(stats.coursesCompleted));
    setText('total-assessments', formatCount(stats.verifiedAttempts));
    setText('certificates', formatCount(stats.certifications));
    setText('last-learning-activity', formatDate(stats.lastActivityAt, true));

    const image = normalizeProfileImageUrl(profile.profileImage || profile.photo);
    const imageElement = document.getElementById('profile-image');
    if (imageElement) imageElement.src = image || '/img/user-default.svg';
}

function renderUnavailableProfile() {
    setText('profile-name', 'Profil tidak tersedia');
    setText('user-level', '—');
    setText('profile-bio', 'Server belum mengembalikan data profil.');
    ['join-date', 'verified-attempts', 'verified-certificates', 'completed-modules', 'total-assessments', 'certificates', 'last-learning-activity']
        .forEach((id) => setText(id, '—'));
    renderEmptyState(document.getElementById('recent-achievements'), 'fa-triangle-exclamation', 'Pencapaian tidak dapat dimuat.');
}

function normalizeProfileImageUrl(value) {
    const image = String(value || '').trim();
    if (!image) return '';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:') || image.startsWith('/api/profile-images/')) return image;
    if (image.startsWith('/uploads/profile-images/')) {
        const filename = image.split('/').pop();
        return filename ? `/api/profile-images/${encodeURIComponent(filename)}` : '';
    }
    return image;
}

function cacheAuthenticatedProfile(profile) {
    try {
        const existing = JSON.parse(localStorage.getItem('user') || '{}');
        const merged = {
            ...existing,
            id: profile.id ?? existing.id,
            username: profile.username || profile.name || existing.username,
            name: profile.name || profile.username || existing.name,
            email: profile.email || existing.email,
            role: profile.role || existing.role,
            bimLevel: profile.bimLevel || existing.bimLevel,
            organization: profile.organization || existing.organization,
            photo: profile.photo || existing.photo,
            profileImage: profile.profileImage || existing.profileImage
        };
        localStorage.setItem('user', JSON.stringify(merged));
    } catch (error) {
        console.warn('Unable to refresh local session profile:', error.message);
    }
}

function setProfileStatus(message, isError = false, isLoading = false) {
    const element = document.getElementById('profile-data-status');
    if (!element) return;
    element.classList.toggle('is-error', isError);
    const icon = element.querySelector('i');
    const text = element.querySelector('span');
    if (icon) icon.className = isLoading ? 'fas fa-spinner fa-spin' : isError ? 'fas fa-triangle-exclamation' : 'fas fa-shield-halved';
    if (text) text.textContent = message;
}

function initializeTabs() {
    const buttons = [...document.querySelectorAll('.tab-btn')];
    const contents = [...document.querySelectorAll('.tab-content')];
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            buttons.forEach((item) => item.classList.toggle('active', item === button));
            contents.forEach((content) => content.classList.toggle('active', content.id === `${tabId}-tab`));
            loadTabData(tabId);
        });
    });
}

async function loadTabData(tabId) {
    if (profileState.loadedTabs.has(tabId)) return;
    try {
        if (tabId === 'achievements') {
            const achievements = profileState.achievements.length
                ? profileState.achievements
                : await fetchJson('/api/profile/achievements');
            renderAchievements(achievements, document.getElementById('user-badges'));
        } else if (tabId === 'activity') {
            renderActivity(await fetchJson('/api/profile/activity'));
        } else if (tabId === 'courses') {
            renderCourses(await fetchJson('/api/profile/courses'));
        }
        profileState.loadedTabs.add(tabId);
    } catch (error) {
        if (error.message !== 'AUTH_REQUIRED') {
            const container = document.querySelector(`#${tabId}-tab .badges-grid, #${tabId}-tab .timeline, #${tabId}-tab .courses-grid`);
            renderEmptyState(container, 'fa-triangle-exclamation', 'Data tidak dapat dimuat dari server.');
        }
    }
}

function renderAchievements(items, container, compact = false) {
    if (!container) return;
    const achievements = Array.isArray(items) ? items : [];
    if (!achievements.length) {
        renderEmptyState(container, 'fa-medal', 'Belum ada pencapaian berbasis evidence.');
        return;
    }

    const visibleItems = compact ? achievements.slice(0, 3) : achievements;
    container.innerHTML = visibleItems.map((achievement) => compact ? `
        <div class="achievement-item">
            <div class="achievement-icon"><i class="${escapeHtml(achievement.icon || 'fas fa-medal')}"></i></div>
            <div class="achievement-info">
                <h4>${escapeHtml(achievement.title || 'Pencapaian')}</h4>
                <p>${escapeHtml(achievement.description || '')}</p>
                <small>${escapeHtml(formatDate(achievement.dateEarned))}</small>
            </div>
        </div>` : `
        <div class="badge-card">
            <div class="badge-icon"><i class="${escapeHtml(achievement.icon || 'fas fa-medal')}"></i></div>
            <div class="badge-content">
                <h4>${escapeHtml(achievement.title || 'Pencapaian')}</h4>
                <p>${escapeHtml(achievement.description || '')}</p>
                <div class="badge-meta"><span class="badge-date">${escapeHtml(formatDate(achievement.dateEarned))}</span></div>
            </div>
        </div>`).join('');
}

function renderActivity(items) {
    const container = document.getElementById('activity-timeline');
    const activities = Array.isArray(items) ? items : [];
    if (!activities.length) {
        renderEmptyState(container, 'fa-clock-rotate-left', 'Belum ada aktivitas server yang tercatat.');
        return;
    }
    container.innerHTML = activities.map((activity) => `
        <div class="timeline-item">
            <div class="timeline-icon"><i class="${escapeHtml(activity.icon || 'fas fa-circle')}"></i></div>
            <div class="timeline-content">
                <h4>${escapeHtml(activity.title || 'Aktivitas')}</h4>
                <p>${escapeHtml(activity.description || '')}</p>
                <div class="timeline-time">${escapeHtml(formatDate(activity.timestamp, true))}</div>
            </div>
        </div>`).join('');
}

function renderCourses(items) {
    const container = document.getElementById('enrolled-courses');
    const courses = Array.isArray(items) ? items : [];
    if (!courses.length) {
        renderEmptyState(container, 'fa-book-open', 'Belum ada materi terdaftar yang dikembalikan server.');
        return;
    }
    container.innerHTML = courses.map((course) => {
        const progress = Math.min(100, Math.max(0, Number(course.progress) || 0));
        return `<div class="course-card">
            <div class="course-info">
                <h4>${escapeHtml(course.title || 'Materi')}</h4>
                <p>${escapeHtml(course.description || '')}</p>
                <div class="course-progress"><div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div><span>${progress}% selesai</span></div>
            </div>
        </div>`;
    }).join('');
}

function renderEmptyState(container, icon, message) {
    if (!container) return;
    container.innerHTML = `<div class="profile-empty-state"><i class="fas ${escapeHtml(icon)}"></i><p>${escapeHtml(message)}</p></div>`;
}

function setupModal() {
    const modal = document.getElementById('edit-profile-modal');
    document.getElementById('edit-profile-btn')?.addEventListener('click', openEditProfileModal);
    document.getElementById('save-profile')?.addEventListener('click', saveProfile);
    modal?.querySelector('.modal-close')?.addEventListener('click', closeEditProfileModal);
    document.getElementById('cancel-edit')?.addEventListener('click', closeEditProfileModal);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) closeEditProfileModal();
    });
}

function openEditProfileModal() {
    const profile = profileState.profile;
    if (!profile) {
        showNotification('Profil belum tersedia dari server.', 'warning');
        return;
    }
    document.getElementById('edit-name').value = profile.name || profile.username || '';
    document.getElementById('edit-email').value = profile.email || '';
    const modal = document.getElementById('edit-profile-modal');
    modal?.classList.add('show');
    modal?.setAttribute('aria-hidden', 'false');
}

function closeEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    modal?.classList.remove('show');
    modal?.setAttribute('aria-hidden', 'true');
}

async function saveProfile() {
    const nameInput = document.getElementById('edit-name');
    const emailInput = document.getElementById('edit-email');
    const button = document.getElementById('save-profile');
    const name = String(nameInput?.value || '').trim();
    const email = String(emailInput?.value || '').trim().toLowerCase();

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Nama dan email valid wajib diisi.', 'error');
        return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Menyimpan...';
    try {
        const result = await fetchJson('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, current_email: profileState.profile?.email || email })
        });

        if (result.token) localStorage.setItem('token', result.token);
        profileState.profile = { ...profileState.profile, ...(result.user || {}), name, username: name, email };
        cacheAuthenticatedProfile(profileState.profile);
        renderProfile(profileState.profile, profileState.stats || {});
        closeEditProfileModal();
        showNotification('Profil berhasil diperbarui.', 'success');
    } catch (error) {
        if (error.message !== 'AUTH_REQUIRED') showNotification(error.message || 'Profil gagal diperbarui.', 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-save"></i>Simpan Perubahan';
    }
}

function setupPhotoUpload() {
    const overlay = document.querySelector('.avatar-overlay');
    const input = document.getElementById('photo-upload');
    overlay?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', uploadProfilePhoto);
}

async function uploadProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        showNotification('Gunakan JPG, PNG, atau WebP maksimal 5 MB.', 'error');
        event.target.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('profileImage', file);
    try {
        const result = await fetchJson('/api/upload-profile-image', { method: 'POST', body: formData });
        const imageUrl = normalizeProfileImageUrl(result.imageUrl);
        if (imageUrl) {
            document.getElementById('profile-image').src = imageUrl;
            profileState.profile = { ...profileState.profile, photo: imageUrl, profileImage: imageUrl };
            cacheAuthenticatedProfile(profileState.profile);
        }
        showNotification('Foto profil berhasil diperbarui.', 'success');
    } catch (error) {
        if (error.message !== 'AUTH_REQUIRED') showNotification(error.message || 'Foto gagal diunggah.', 'error');
    } finally {
        event.target.value = '';
    }
}

function setupShareAction() {
    document.getElementById('share-profile-btn')?.addEventListener('click', async () => {
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Profil BCL', url: window.location.href });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                showNotification('Tautan profil disalin.', 'success');
            }
        } catch (error) {
            if (error.name !== 'AbortError') showNotification('Tautan tidak dapat dibagikan.', 'warning');
        }
    });
}

function formatCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number.toLocaleString('id-ID') : '—';
}

function formatDate(value, includeTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', includeTime
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<div class="notification-content"><i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i><span></span></div>`;
    notification.querySelector('span').textContent = message;
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('show'));
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3200);
}

window.profileSystem = {
    reload: loadProfilePage,
    showNotification
};
