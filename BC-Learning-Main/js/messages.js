(function () {
    function readJsonStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || '{}');
        } catch (error) {
            return {};
        }
    }

    function getAuthToken() {
        const storedUser = readJsonStorage('user');
        return localStorage.getItem('token') || storedUser.token || '';
    }

    function isTokenExpired(token) {
        if (!token) return true;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp < Date.now() / 1000;
        } catch (error) {
            return true;
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateTime(value) {
        if (!value) return '-';
        try {
            return new Date(value).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        } catch (error) {
            return String(value);
        }
    }

    function setStatus(unread) {
        const status = document.getElementById('messagesUnreadStatus');
        if (!status) return;

        const count = Number(unread || 0);
        status.innerHTML = count > 0
            ? `<i class="fas fa-envelope"></i><span>${count} pesan belum dibaca</span>`
            : '<i class="fas fa-envelope-open-text"></i><span>Tidak ada pesan baru</span>';
    }

    function renderEmpty(message) {
        const list = document.getElementById('messagesList');
        if (!list) return;

        list.className = 'messages-empty';
        list.innerHTML = `
            <div>
                <i class="fas fa-inbox fa-3x mb-3"></i>
                <p class="mb-0">${escapeHtml(message)}</p>
            </div>
        `;
    }

    function renderMessages(messages) {
        const list = document.getElementById('messagesList');
        if (!list) return;

        if (!messages.length) {
            renderEmpty('Belum ada pesan dari admin.');
            return;
        }

        list.className = 'messages-list';
        list.innerHTML = messages.map((message) => {
            const isUser = message.senderType === 'user';
            const sender = isUser ? 'Anda' : (message.senderName || 'Admin BCL');
            return `
                <article class="message-row ${isUser ? 'is-user' : 'is-admin'}">
                    <div class="message-bubble">
                        <div class="message-meta">
                            <span>${escapeHtml(sender)}</span>
                            <span>${escapeHtml(formatDateTime(message.createdAt))}</span>
                        </div>
                        <div class="message-body">${escapeHtml(message.body)}</div>
                    </div>
                </article>
            `;
        }).join('');

        list.scrollTop = list.scrollHeight;
    }

    async function loadMessages() {
        const token = getAuthToken();
        if (!token || isTokenExpired(token)) {
            localStorage.setItem('lastPage', window.location.pathname + window.location.search + window.location.hash);
            window.location.href = '/pages/login.html';
            return;
        }

        const response = await fetch('/api/messages', {
            headers: {
                Authorization: `Bearer ${token}`
            },
            credentials: 'include',
            cache: 'no-store'
        });

        if (!response.ok) {
            renderEmpty(`Gagal memuat pesan (${response.status}).`);
            return;
        }

        const data = await response.json();
        const messages = Array.isArray(data.messages) ? data.messages : [];
        setStatus(data.unread || 0);
        renderMessages(messages);

        if (Number(data.unread || 0) > 0) {
            await fetch('/api/messages/read', {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                credentials: 'include'
            }).catch(() => {});

            setStatus(0);
            if (typeof window.BCLRefreshMessageIndicator === 'function') {
                window.BCLRefreshMessageIndicator();
            }
        }
    }

    async function submitReply(event) {
        event.preventDefault();

        const token = getAuthToken();
        if (!token || isTokenExpired(token)) {
            window.location.href = '/pages/login.html';
            return;
        }

        const subjectInput = document.getElementById('messageSubject');
        const bodyInput = document.getElementById('messageBody');
        const body = bodyInput ? bodyInput.value.trim() : '';

        if (!body) {
            alert('Isi pesan tidak boleh kosong.');
            return;
        }

        const submitButton = event.target.querySelector('button[type="submit"]');
        const originalHtml = submitButton ? submitButton.innerHTML : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Mengirim...';
        }

        try {
            const response = await fetch('/api/messages/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    subject: subjectInput ? subjectInput.value : 'Balasan User BCL',
                    body
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            if (bodyInput) bodyInput.value = '';
            await loadMessages();
        } catch (error) {
            alert(`Gagal mengirim pesan: ${error.message}`);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalHtml;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('messageReplyForm');
        if (form) {
            form.addEventListener('submit', submitReply);
        }

        loadMessages();
    });
})();
