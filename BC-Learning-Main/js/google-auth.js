(function () {
    'use strict';
    const messages = {
        INVALID_CREDENTIALS: 'Identifier atau password BCL tidak cocok.',
        USER_INACTIVE_OR_MISSING: 'Akun BCL tidak aktif. Hubungi administrator.',
        GOOGLE_ALREADY_REGISTERED_USE_LOGIN: 'Google sudah terdaftar. Gunakan halaman login.',
        GOOGLE_UNAVAILABLE: 'Google belum tersedia. Anda tetap dapat login menggunakan password BCL.',
        PROVIDER_ALREADY_LINKED: 'Akun Google atau akun BCL sudah memiliki hubungan provider. Hubungi administrator.',
        LINK_APPROVAL_REQUIRED: 'Persetujuan administrator belum tersedia.',
        LINK_REQUEST_EXPIRED: 'Permintaan telah berakhir. Verifikasi Google kembali.',
        GOOGLE_CHALLENGE_INVALID: 'Verifikasi telah berakhir. Muat ulang tombol Google.',
        ACCOUNT_MISMATCH: 'Gunakan credential untuk akun BCL yang sedang login.'
    };
    const message = error => messages[error.data?.code] || error.message || 'Proses belum berhasil. Coba lagi.';
    function button(text, handler) {
        const node = document.createElement('button'); node.type = 'button';
        node.className = 'btn btn-outline-primary my-2 me-2'; node.textContent = text;
        node.onclick = async () => { node.disabled = true; try { await handler(); } finally { node.disabled = false; } };
        return node;
    }
    function linkPanel(parent, data, { authenticated = false, onSuccess = BclAuth.accept } = {}) {
        parent.querySelector('[data-google-link]')?.remove();
        const panel = document.createElement('div'); panel.dataset.googleLink = 'true'; panel.className = 'text-start border rounded p-3 mt-3';
        panel.innerHTML = '<p>Google telah diverifikasi. Hubungkan ke akun BCL Anda untuk melanjutkan. Tidak ada akun BCL baru yang dibuat.</p>' +
            '<label class="d-block">Email atau username BCL<input class="form-control" data-identifier autocomplete="username"></label>' +
            '<label class="d-block mt-2">Password BCL<input class="form-control" data-password type="password" autocomplete="current-password"></label>' +
            '<p class="mt-3">Jika Anda tidak memiliki password BCL, mintalah administrator memverifikasi kepemilikan akun. Sampaikan kode permintaan berikut; jangan kirim password atau token.</p>' +
            '<code data-request></code><p class="small mt-2">Permintaan berlaku 10 menit. Biarkan halaman ini terbuka selama proses verifikasi.</p>' +
            '<p data-status role="status" aria-live="polite"></p>';
        panel.querySelector('[data-request]').textContent = data.requestId;
        const status = panel.querySelector('[data-status]');
        panel.append(button('Konfirmasi dengan password BCL', async () => {
            const password = panel.querySelector('[data-password]');
            try {
                const result = await BclAuth.request('/api/auth/google/link', { linkTicket: data.linkTicket,
                    identifier: panel.querySelector('[data-identifier]').value.trim(), password: password.value }, authenticated);
                panel.remove(); onSuccess(result);
            } catch (error) { status.textContent = message(error); }
            finally { password.value = ''; }
        }));
        panel.append(button('Selesaikan setelah persetujuan admin', async () => {
            try { const result = await BclAuth.request('/api/auth/google/complete-link', { linkTicket: data.linkTicket }); panel.remove(); onSuccess(result); }
            catch (error) { status.textContent = message(error); }
        }));
        parent.append(panel); // Secret ticket is kept only in this closure, never in URL/storage/DOM.
    }
    async function mount({ purpose, container, note, parent = container.parentElement, fields = () => ({}), onSuccess = BclAuth.accept }) {
        const authenticated = ['link', 'password'].includes(purpose);
        let retry;
        async function initialize() {
            note.textContent = 'Memuat Google…'; container.replaceChildren();
            try {
                const config = await BclAuth.request('/api/auth/google/config');
                if (config.authContract !== 'p0-2') throw new Error('Pembaruan autentikasi sedang disiapkan. Login lokal tetap tersedia.');
                if (!config.enabled || !config.clientId) throw new Error('Google belum dikonfigurasi. Gunakan login lokal.');
                const deadline = Date.now() + 12000;
                while (!window.google?.accounts?.id) {
                    if (Date.now() > deadline) throw new Error('Google tidak dapat dimuat. Login lokal tetap tersedia.');
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                const challenge = await BclAuth.request('/api/auth/google/challenge', { purpose }, authenticated);
                google.accounts.id.initialize({ client_id: config.clientId, nonce: challenge.nonce, auto_select: false,
                    cancel_on_tap_outside: true, callback: async response => {
                        note.textContent = 'Memverifikasi Google…';
                        try {
                            const body = { ...fields(), idToken: response.credential, challengeId: challenge.challengeId };
                            let result;
                            if (purpose === 'link') {
                                result = await BclAuth.request('/api/auth/google/link-proof', body, true);
                                linkPanel(parent, result, { authenticated: true, onSuccess });
                            } else if (purpose === 'password') {
                                result = await BclAuth.request('/api/auth/password', { ...body, proof: 'google' }, true);
                                onSuccess(result);
                            } else {
                                result = await BclAuth.request('/api/auth/google', { ...body, action: purpose });
                                onSuccess(result);
                            }
                            note.textContent = purpose === 'link' ? 'Lengkapi konfirmasi kepemilikan akun BCL di bawah.' : 'Verifikasi berhasil.';
                        } catch (error) {
                            if (error.data?.code === 'GOOGLE_LINK_REQUIRED') {
                                linkPanel(parent, error.data, { onSuccess }); note.textContent = 'Konfirmasi hubungan akun diperlukan.';
                            } else note.textContent = message(error);
                        }
                        container.replaceChildren(); // One proof per nonce. Retry obtains a new challenge.
                        retry.hidden = false;
                    } });
                google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', type: 'standard',
                    text: purpose === 'register' ? 'signup_with' : 'signin_with', shape: 'rectangular',
                    width: Math.min(400, Math.max(240, container.clientWidth || 320)) });
                note.textContent = purpose === 'register' ? 'Pendaftaran Google menggunakan nama pengguna di atas. Atribut profil dapat dilengkapi setelah login.' : '';
                retry.hidden = false;
            } catch (error) { note.textContent = message(error); retry.hidden = false; }
        }
        retry = button('Muat ulang tombol Google', initialize); parent.append(retry);
        await initialize();
    }
    window.BclGoogle = { mount, linkPanel, message };
    document.addEventListener('DOMContentLoaded', () => {
        const login = document.getElementById('google-login-wrap'), signup = document.getElementById('google-signup-wrap');
        if (!login && !signup) return;
        const prefix = login ? 'google-login' : 'google-signup';
        for (const suffix of ['section', 'ui']) { const el = document.getElementById(prefix + '-' + suffix); if (el) el.hidden = false; }
        mount({ purpose: login ? 'login' : 'register', container: login || signup, note: document.getElementById(prefix + '-note'),
            fields: () => login ? {} : { username: document.getElementById('username').value.trim() } });
    });
})();
