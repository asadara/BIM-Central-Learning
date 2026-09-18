(function () {
    'use strict';
    if (window.BclAuth) return;
    const token = () => localStorage.getItem('token') || '';
    async function request(path, body, authenticated = false) {
        const headers = { 'Content-Type': 'application/json' };
        if (authenticated && token()) headers.Authorization = 'Bearer ' + token();
        const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST',
            credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(20000) });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.error || 'Permintaan gagal.'), { data, status: response.status });
        return data;
    }
    function accept(data, redirect = true) {
        if (!data.token) throw new Error('Sesi tidak tersedia. Silakan login kembali.');
        let previous = {};
        try { previous = JSON.parse(localStorage.getItem('user') || '{}'); } catch (_) { /* no prior user */ }
        const user = { ...previous, ...data, id: data.id, name: data.name || data.username || previous.name,
            photo: data.photo || data.profileImage || previous.photo || '/img/user-default.svg' };
        if (typeof window.setUserData === 'function') window.setUserData(user);
        else {
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('username', user.name || '');
            localStorage.setItem('email', user.email || '');
            localStorage.setItem('role', user.positionLabel || '');
            localStorage.setItem('userimg', user.photo);
        }
        localStorage.setItem('token', data.token);
        if (redirect) {
            const destination = typeof window.getPostLoginDestination === 'function'
                ? window.getPostLoginDestination('/elearning-assets/dashboard.html') : '/elearning-assets/dashboard.html';
            const url = new URL(destination, location.origin);
            location.assign(url.origin === location.origin ? url.href : '/elearning-assets/dashboard.html');
        }
    }
    let logoutInProgress;
    function logout() {
        if (logoutInProgress) return logoutInProgress;
        logoutInProgress = (async () => {
            try {
                // Revoke the bearer before removing it from this browser. Admin cookie is separate.
                await request('/api/auth/logout', {}, true);
                await request('/api/admin/logout', {});
                for (const key of ['token', 'user', 'userData', 'username', 'email', 'role', 'userimg', 'adminUser', 'adminAuthenticated']) localStorage.removeItem(key);
                window.currentUser = null;
                location.assign('/pages/login.html');
                return true;
            } catch (_) {
                alert('Logout belum terkonfirmasi oleh server. Periksa koneksi dan coba lagi.');
                return false;
            } finally { logoutInProgress = null; }
        })();
        return logoutInProgress;
    }
    window.BclAuth = { request, accept, logout, token };
    // Capture prevents legacy page handlers from erasing a token before server revocation.
    document.addEventListener('click', event => {
        if (!event.target.closest?.('#logout-link, #logout-btn, [data-auth-logout]')) return;
        event.preventDefault(); event.stopImmediatePropagation(); logout();
    }, true);
})();
