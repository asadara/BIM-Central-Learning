(async function () {
    const status = document.getElementById('account-state');
    const current = document.getElementById('current-password'), next = document.getElementById('new-password'), confirm = document.getElementById('confirm-password');
    function newPassword() {
        if (next.value.length < 8 || new TextEncoder().encode(next.value).length > 72 || next.value !== confirm.value) {
            throw new Error('Password baru harus sesuai batas panjang dan konfirmasinya harus sama.');
        }
        return next.value;
    }
    function passwordUpdated(data) {
        BclAuth.accept(data, false); current.value = next.value = confirm.value = '';
        status.textContent = 'Password tersimpan. Seluruh sesi lama telah diakhiri; sesi browser ini sudah diperbarui.';
        document.getElementById('local-password').hidden = false;
    }
    function mountGoogle(purpose) {
        const parent = document.getElementById('google-controls');
        parent.querySelectorAll('button, [data-google-link]').forEach(el => el.remove());
        return BclGoogle.mount({ purpose, parent, container: document.getElementById('security-google-button'),
            note: document.getElementById('security-google-note'), fields: () => purpose === 'password' ? { newPassword: newPassword() } : {},
            onSuccess: purpose === 'password' ? passwordUpdated : data => { BclAuth.accept(data, false); location.reload(); } });
    }
    try {
        const state = await BclAuth.request('/api/auth/providers', undefined, true);
        status.textContent = 'Akun BCL #' + state.id; document.getElementById('settings').hidden = false;
        const linked = state.providers.some(p => p.provider === 'google');
        document.getElementById('provider-state').textContent = linked ? 'Google terhubung ke akun BCL ini.' : 'Belum ada akun Google yang terhubung.';
        document.getElementById('link-google').hidden = linked;
        document.getElementById('google-password').hidden = !linked;
        document.getElementById('local-password').hidden = !state.localPasswordEnabled;
    } catch (_) { status.textContent = 'Sesi tidak tersedia. Silakan login kembali melalui halaman login BCL.'; return; }
    document.getElementById('password-form').onsubmit = async event => {
        event.preventDefault();
        try { passwordUpdated(await BclAuth.request('/api/auth/password', { proof: 'local', currentPassword: current.value, newPassword: newPassword() }, true)); }
        catch (error) { status.textContent = BclGoogle.message(error); }
        finally { current.value = ''; }
    };
    document.getElementById('link-google').onclick = () => mountGoogle('link');
    document.getElementById('google-password').onclick = () => {
        try { newPassword(); mountGoogle('password'); } catch (error) { status.textContent = error.message; }
    };
    document.getElementById('logout-all').onclick = async () => {
        try { await BclAuth.request('/api/auth/logout-all', {}, true); await BclAuth.logout(); }
        catch (error) { status.textContent = BclGoogle.message(error); }
    };
})();
