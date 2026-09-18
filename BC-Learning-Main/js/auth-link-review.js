(function () {
    const status = document.getElementById('status');
    async function refresh() {
        try {
            const data = await BclAuth.request('/api/admin/auth/google-link-requests');
            const list = document.getElementById('requests'); list.replaceChildren();
            for (const request of data.requests) {
                const item = document.createElement('li');
                item.textContent = request.id + ' — ' + request.provider_email + ' — berakhir ' + new Date(request.expires_at).toLocaleString();
                list.append(item);
            }
            status.textContent = data.requests.length ? 'Pilih kode yang disampaikan pemilik akun. Email merupakan informasi, bukan bukti kepemilikan.' : 'Tidak ada permintaan aktif.';
        } catch (_) { status.textContent = 'Sesi admin diperlukan. Login admin kembali sebelum melakukan verifikasi.'; }
    }
    document.getElementById('refresh-requests').onclick = refresh;
    document.getElementById('approval-form').onsubmit = async event => {
        event.preventDefault(); const password = document.getElementById('admin-password');
        try {
            const id = document.getElementById('request-id').value.trim();
            await BclAuth.request('/api/admin/auth/google-link-requests/' + encodeURIComponent(id) + '/approve', {
                userId: document.getElementById('target-id').value, currentPassword: password.value,
                verificationMethod: document.getElementById('verification-method').value, reason: document.getElementById('reason').value.trim()
            });
            status.textContent = 'Persetujuan tersimpan. Pemilik Google harus menyelesaikan permintaan dari browser tempat verifikasi Google dilakukan.';
            document.getElementById('confirmed').checked = false;
        } catch (error) { status.textContent = error.message; }
        finally { password.value = ''; }
    };
    refresh();
})();
