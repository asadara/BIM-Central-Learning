/**
 * Messages Module - Admin inbox and user messaging.
 */
class MessagesModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.users = [];
        this.threads = [];
        this.selectedThreadId = '';
        this.selectedUser = null;
        this.messages = [];
    }

    initialize() {
        console.log('Initializing Messages Module');
    }

    async loadMessages() {
        const content = document.getElementById('messages-content');
        if (!content) return;

        content.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-muted mb-0">Memuat inbox pesan...</p>
            </div>
        `;

        try {
            await Promise.all([
                this.loadUsers(),
                this.loadThreads()
            ]);
            this.renderMessagesShell();
        } catch (error) {
            content.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Gagal memuat pesan: ${this.escapeHtml(error.message)}
                </div>
            `;
        }
    }

    async loadUsers() {
        const response = await fetch('/api/users/get-all', { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Gagal memuat user (${response.status})`);
        }
        const data = await response.json();
        this.users = Array.isArray(data) ? data : (data.users || data.data || []);
    }

    async loadThreads() {
        const response = await fetch('/api/admin/messages/threads', { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Gagal memuat thread pesan (${response.status})`);
        }
        const data = await response.json();
        this.threads = Array.isArray(data.threads) ? data.threads : [];
    }

    renderMessagesShell() {
        const content = document.getElementById('messages-content');
        if (!content) return;

        const unreadCount = this.threads.reduce((sum, thread) => sum + Number(thread.unreadForAdmin || 0), 0);
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-xl-4">
                    <div class="border rounded bg-white">
                        <div class="p-3 border-bottom">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <h6 class="mb-0">Thread User</h6>
                                    <small class="text-muted">${this.threads.length} thread, ${unreadCount} belum dibaca</small>
                                </div>
                                <button class="btn btn-outline-primary btn-sm" onclick="safeCall('messages', 'loadMessages')">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                            <input type="search" class="form-control" id="messageUserSearch"
                                placeholder="Cari user..." oninput="safeCall('messages', 'filterUserList')">
                        </div>
                        <div id="messageUserList" style="max-height: 620px; overflow-y: auto;"></div>
                    </div>
                </div>
                <div class="col-xl-8">
                    <div class="border rounded bg-white">
                        <div class="p-3 border-bottom" id="messageConversationHeader">
                            <h6 class="mb-0">Pilih user untuk mulai chat</h6>
                            <small class="text-muted">Pesan akan tersimpan sebagai inbox BCL user.</small>
                        </div>
                        <div id="messageConversationBody" class="p-3" style="min-height: 360px;">
                            <div class="text-center py-5 text-muted">
                                <i class="fas fa-comments fa-3x mb-3"></i>
                                <p class="mb-0">Belum ada thread yang dipilih.</p>
                            </div>
                        </div>
                        <div class="p-3 border-top">
                            <div class="mb-2">
                                <input type="text" class="form-control" id="messageSubjectInput"
                                    placeholder="Subjek pesan" value="Pesan Admin BCL">
                            </div>
                            <div class="mb-2">
                                <textarea class="form-control" id="messageBodyInput" rows="4"
                                    placeholder="Tulis pesan untuk user..."></textarea>
                            </div>
                            <div class="d-flex justify-content-between align-items-center gap-2">
                                <small class="text-muted" id="messageComposeHint">Pilih user sebelum mengirim pesan.</small>
                                <button class="btn btn-modern-primary" onclick="safeCall('messages', 'sendMessage')">
                                    <i class="fas fa-paper-plane me-2"></i>Kirim Pesan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderUserList();
        if (this.selectedThreadId) {
            const selectedThread = this.threads.find(thread => thread.threadId === this.selectedThreadId);
            if (selectedThread) {
                this.selectThread(this.selectedThreadId);
            }
        }
    }

    renderUserList(filteredUsers = null) {
        const container = document.getElementById('messageUserList');
        if (!container) return;

        const users = filteredUsers || this.users;
        if (!Array.isArray(users) || users.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-muted">
                    <i class="fas fa-user-slash fa-2x mb-2"></i>
                    <p class="mb-0">Tidak ada user ditemukan.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = users.map((user) => {
            const identity = this.getUserIdentity(user);
            const thread = this.findThreadForUser(identity);
            const unread = Number(thread && thread.unreadForAdmin ? thread.unreadForAdmin : 0);
            const latestAt = thread && thread.latestAt ? this.formatDateTime(thread.latestAt) : 'Belum ada pesan';
            const active = thread && thread.threadId === this.selectedThreadId ? 'border-primary bg-light' : '';
            const threadId = thread ? thread.threadId : this.buildThreadId(identity.userId, identity.userEmail);

            return `
                <button type="button" class="w-100 text-start border-0 border-bottom p-3 bg-white ${active}"
                    onclick="safeCall('messages', 'selectUser', '${this.escapeJs(identity.userId)}', '${this.escapeJs(identity.userEmail)}')">
                    <div class="d-flex justify-content-between gap-2">
                        <div class="min-w-0">
                            <div class="fw-semibold text-truncate">${this.escapeHtml(identity.userName)}</div>
                            <div class="small text-muted text-truncate">${this.escapeHtml(identity.userEmail || identity.userId || '-')}</div>
                            <div class="small text-muted mt-1">${this.escapeHtml(latestAt)}</div>
                        </div>
                        <div class="text-end">
                            ${unread > 0 ? `<span class="badge bg-danger">${unread}</span>` : ''}
                            <div class="small text-muted mt-1">${this.escapeHtml(threadId.replace(/^user:|^email:/, ''))}</div>
                        </div>
                    </div>
                </button>
            `;
        }).join('');
    }

    filterUserList() {
        const input = document.getElementById('messageUserSearch');
        const query = String(input && input.value ? input.value : '').trim().toLowerCase();
        if (!query) {
            this.renderUserList();
            return;
        }

        const filtered = this.users.filter((user) => {
            const identity = this.getUserIdentity(user);
            return [
                identity.userName,
                identity.userEmail,
                identity.userId
            ].some(value => String(value || '').toLowerCase().includes(query));
        });

        this.renderUserList(filtered);
    }

    async selectUser(userId, userEmail) {
        const identity = this.users
            .map(user => this.getUserIdentity(user))
            .find(item => item.userId === userId || item.userEmail === userEmail);

        if (!identity) return;

        this.selectedUser = identity;
        this.selectedThreadId = this.buildThreadId(identity.userId, identity.userEmail);
        await this.loadConversation(this.selectedThreadId);
        this.renderUserList();
    }

    async selectThread(threadId) {
        this.selectedThreadId = threadId;
        const thread = this.threads.find(item => item.threadId === threadId);
        if (thread) {
            this.selectedUser = {
                userId: thread.userId,
                userEmail: thread.userEmail,
                userName: thread.userName
            };
        }
        await this.loadConversation(threadId);
        this.renderUserList();
    }

    async loadConversation(threadId) {
        const response = await fetch(`/api/admin/messages/thread/${encodeURIComponent(threadId)}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Gagal memuat conversation (${response.status})`);
        }

        const data = await response.json();
        this.messages = Array.isArray(data.messages) ? data.messages : [];
        await fetch(`/api/admin/messages/thread/${encodeURIComponent(threadId)}/read`, {
            method: 'PATCH',
            credentials: 'include'
        }).catch(() => {});

        await this.loadThreads();
        this.renderConversation();
    }

    renderConversation() {
        const header = document.getElementById('messageConversationHeader');
        const body = document.getElementById('messageConversationBody');
        const hint = document.getElementById('messageComposeHint');
        if (!header || !body) return;

        const user = this.selectedUser || {};
        header.innerHTML = `
            <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                    <h6 class="mb-1">${this.escapeHtml(user.userName || 'User BCL')}</h6>
                    <small class="text-muted">${this.escapeHtml(user.userEmail || user.userId || '-')}</small>
                </div>
                <button class="btn btn-outline-secondary btn-sm" onclick="safeCall('messages', 'loadConversation', '${this.escapeJs(this.selectedThreadId)}')">
                    <i class="fas fa-sync-alt me-1"></i>Refresh
                </button>
            </div>
        `;

        if (hint) {
            hint.textContent = `Mengirim ke ${user.userName || user.userEmail || user.userId || 'user'}.`;
        }

        if (!Array.isArray(this.messages) || this.messages.length === 0) {
            body.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p class="mb-0">Belum ada pesan dengan user ini.</p>
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <div class="d-flex flex-column gap-3">
                ${this.messages.map(message => this.renderMessageBubble(message)).join('')}
            </div>
        `;
        body.scrollTop = body.scrollHeight;
    }

    renderMessageBubble(message) {
        const isAdmin = message.senderType === 'admin';
        const alignClass = isAdmin ? 'align-self-end text-end' : 'align-self-start';
        const colorClass = isAdmin ? 'bg-primary text-white' : 'bg-light border';
        const metaClass = isAdmin ? 'text-white-50' : 'text-muted';

        return `
            <div class="${alignClass}" style="max-width: 78%;">
                <div class="rounded p-3 ${colorClass}">
                    <div class="fw-semibold mb-1">${this.escapeHtml(message.senderName || (isAdmin ? 'Admin BCL' : 'User'))}</div>
                    <div style="white-space: pre-wrap;">${this.escapeHtml(message.body || '')}</div>
                    <div class="small mt-2 ${metaClass}">${this.escapeHtml(this.formatDateTime(message.createdAt))}</div>
                </div>
            </div>
        `;
    }

    async sendMessage() {
        if (!this.selectedUser) {
            alert('Pilih user terlebih dahulu.');
            return;
        }

        const subjectInput = document.getElementById('messageSubjectInput');
        const bodyInput = document.getElementById('messageBodyInput');
        const subject = subjectInput ? subjectInput.value : '';
        const body = bodyInput ? bodyInput.value.trim() : '';

        if (!body) {
            alert('Isi pesan tidak boleh kosong.');
            return;
        }

        const response = await fetch('/api/admin/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                userId: this.selectedUser.userId,
                userEmail: this.selectedUser.userEmail,
                userName: this.selectedUser.userName,
                subject,
                body
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(`Gagal mengirim pesan: ${error.error || response.status}`);
            return;
        }

        if (bodyInput) bodyInput.value = '';
        await this.loadThreads();
        await this.loadConversation(this.selectedThreadId);
    }

    getUserIdentity(user) {
        const userId = String(user.id || user.user_id || user.email || user.username || '').trim();
        const userEmail = String(user.email || '').trim();
        const userName = String(user.username || user.name || user.email || userId || 'User BCL').trim();
        return { userId, userEmail, userName };
    }

    findThreadForUser(identity) {
        const threadId = this.buildThreadId(identity.userId, identity.userEmail);
        return this.threads.find(thread => thread.threadId === threadId)
            || this.threads.find(thread => thread.userEmail && thread.userEmail === identity.userEmail);
    }

    buildThreadId(userId, userEmail) {
        const idPart = String(userId || '').trim().toLowerCase();
        if (idPart) return `user:${idPart}`;

        const emailPart = String(userEmail || '').trim().toLowerCase();
        if (emailPart) return `email:${emailPart}`;

        return '';
    }

    formatDateTime(value) {
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

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeJs(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
    }
}

(function() {
    console.log('Initializing Messages Module...');

    if (!window.adminPanel || !window.adminPanel.modules) {
        console.error('window.adminPanel.modules not found - messages module cannot initialize');
        return;
    }

    try {
        const messagesModule = new MessagesModule(window.adminPanel);
        window.adminPanel.modules.set('messages', {
            loaded: true,
            path: 'modules/messages.js',
            instance: messagesModule
        });
        messagesModule.initialize();
        console.log('Messages module initialized and registered successfully');
    } catch (error) {
        console.error('Failed to initialize messages module:', error);
    }
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessagesModule;
}
