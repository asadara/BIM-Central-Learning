// Mengirim pesan umum dari landing page ke inbox admin.
const sendEmailButton = document.getElementById('sendEmail');

if (sendEmailButton) {
    sendEmailButton.addEventListener('click', async function () {
        const name = document.getElementById('name')?.value.trim() || '';
        const email = document.getElementById('email')?.value.trim() || '';
        const subject = document.getElementById('subject')?.value.trim() || '';
        const message = document.getElementById('message')?.value.trim() || '';

        if (!name || !email || !subject || !message) {
            alert('Harap isi semua kolom.');
            return;
        }

        try {
            const response = await fetch('/api/access-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'general_message',
                    name,
                    email,
                    subject,
                    message,
                    sourcePage: '/'
                })
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            alert('Pesan berhasil dikirim ke admin.');
            document.querySelector('form')?.reset();
        } catch (error) {
            console.error('Failed to submit general message:', error);
            alert(`Gagal mengirim pesan: ${error.message}`);
        }
    });
}
