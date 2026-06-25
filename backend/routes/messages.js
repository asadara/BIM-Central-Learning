const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuthenticated, requireAdmin } = require('../utils/auth');

const MESSAGES_FILE = path.join(__dirname, '..', 'messages.json');

function ensureMessageStore() {
    if (!fs.existsSync(MESSAGES_FILE)) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify({ messages: [] }, null, 2));
    }
}

function readMessageStore() {
    try {
        ensureMessageStore();
        const raw = fs.readFileSync(MESSAGES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            messages: Array.isArray(parsed.messages) ? parsed.messages : []
        };
    } catch (error) {
        console.error('ERROR: Failed to read messages store:', error);
        return { messages: [] };
    }
}

function writeMessageStore(store) {
    ensureMessageStore();
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify({
        messages: Array.isArray(store.messages) ? store.messages : []
    }, null, 2));
}

function normalizeIdentifier(value) {
    return String(value || '').trim().toLowerCase();
}

function buildThreadId(userId, userEmail) {
    const idPart = normalizeIdentifier(userId);
    if (idPart) return `user:${idPart}`;

    const emailPart = normalizeIdentifier(userEmail);
    if (emailPart) return `email:${emailPart}`;

    return '';
}

function sanitizeMessageBody(value) {
    return String(value || '').trim().slice(0, 5000);
}

function sanitizeSubject(value) {
    const subject = String(value || '').trim().slice(0, 160);
    return subject || 'Pesan Admin BCL';
}

function getUserIdentity(req) {
    const user = req.authUser || req.user || {};
    const userId = user.id || user.userId || user.email || user.username || '';
    return {
        userId: String(userId || '').trim(),
        userEmail: String(user.email || '').trim(),
        userName: String(user.username || user.name || user.email || 'User BCL').trim()
    };
}

function createMessage({
    threadId,
    userId,
    userEmail,
    userName,
    senderType,
    senderId,
    senderName,
    subject,
    body
}) {
    const now = new Date().toISOString();
    return {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        threadId,
        userId: String(userId || '').trim(),
        userEmail: String(userEmail || '').trim(),
        userName: String(userName || '').trim(),
        senderType,
        senderId: String(senderId || '').trim(),
        senderName: String(senderName || '').trim(),
        subject: sanitizeSubject(subject),
        body: sanitizeMessageBody(body),
        createdAt: now,
        readByAdmin: senderType === 'admin',
        readByUser: senderType === 'user'
    };
}

function sortByCreatedAsc(left, right) {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function createThreadSummary(messages) {
    const ordered = [...messages].sort(sortByCreatedAsc);
    const first = ordered[0] || {};
    const latest = ordered[ordered.length - 1] || {};
    return {
        threadId: latest.threadId || first.threadId,
        userId: latest.userId || first.userId || '',
        userEmail: latest.userEmail || first.userEmail || '',
        userName: latest.userName || first.userName || 'User BCL',
        subject: latest.subject || first.subject || 'Pesan Admin BCL',
        latestMessage: latest.body || '',
        latestSenderType: latest.senderType || '',
        latestAt: latest.createdAt || first.createdAt || null,
        totalMessages: ordered.length,
        unreadForAdmin: ordered.filter(message => message.senderType === 'user' && !message.readByAdmin).length,
        unreadForUser: ordered.filter(message => message.senderType === 'admin' && !message.readByUser).length
    };
}

const router = express.Router();

router.get('/api/admin/messages/threads', requireAdmin, (req, res) => {
    const store = readMessageStore();
    const grouped = new Map();

    store.messages.forEach((message) => {
        if (!message.threadId) return;
        if (!grouped.has(message.threadId)) {
            grouped.set(message.threadId, []);
        }
        grouped.get(message.threadId).push(message);
    });

    const threads = Array.from(grouped.values())
        .map(createThreadSummary)
        .sort((left, right) => new Date(right.latestAt || 0).getTime() - new Date(left.latestAt || 0).getTime());

    res.json({
        threads,
        unreadForAdmin: threads.reduce((sum, thread) => sum + thread.unreadForAdmin, 0)
    });
});

router.get('/api/admin/messages/thread/:threadId', requireAdmin, (req, res) => {
    const threadId = String(req.params.threadId || '').trim();
    const store = readMessageStore();
    const messages = store.messages
        .filter(message => message.threadId === threadId)
        .sort(sortByCreatedAsc);

    res.json({ threadId, messages });
});

router.post('/api/admin/messages/send', requireAdmin, (req, res) => {
    const body = sanitizeMessageBody(req.body.body);
    const userId = String(req.body.userId || '').trim();
    const userEmail = String(req.body.userEmail || '').trim();
    const userName = String(req.body.userName || userEmail || userId || 'User BCL').trim();
    const threadId = buildThreadId(userId, userEmail);

    if (!threadId) {
        return res.status(400).json({ error: 'Target user is required' });
    }

    if (!body) {
        return res.status(400).json({ error: 'Message body is required' });
    }

    const admin = req.authUser || req.user || {};
    const message = createMessage({
        threadId,
        userId,
        userEmail,
        userName,
        senderType: 'admin',
        senderId: admin.id || admin.email || 'admin',
        senderName: admin.username || admin.email || 'Admin BCL',
        subject: req.body.subject,
        body
    });

    const store = readMessageStore();
    store.messages.push(message);
    writeMessageStore(store);

    res.status(201).json({ message });
});

router.patch('/api/admin/messages/thread/:threadId/read', requireAdmin, (req, res) => {
    const threadId = String(req.params.threadId || '').trim();
    const store = readMessageStore();
    let updated = 0;

    store.messages = store.messages.map((message) => {
        if (message.threadId === threadId && message.senderType === 'user' && !message.readByAdmin) {
            updated += 1;
            return { ...message, readByAdmin: true };
        }
        return message;
    });

    writeMessageStore(store);
    res.json({ updated });
});

router.get('/api/messages', requireAuthenticated, (req, res) => {
    const identity = getUserIdentity(req);
    const threadId = buildThreadId(identity.userId, identity.userEmail);
    const store = readMessageStore();
    const messages = store.messages
        .filter(message => message.threadId === threadId)
        .sort(sortByCreatedAsc);

    res.json({
        threadId,
        messages,
        unread: messages.filter(message => message.senderType === 'admin' && !message.readByUser).length
    });
});

router.post('/api/messages/reply', requireAuthenticated, (req, res) => {
    const body = sanitizeMessageBody(req.body.body);
    if (!body) {
        return res.status(400).json({ error: 'Message body is required' });
    }

    const identity = getUserIdentity(req);
    const threadId = buildThreadId(identity.userId, identity.userEmail);
    if (!threadId) {
        return res.status(400).json({ error: 'User identity is required' });
    }

    const message = createMessage({
        threadId,
        userId: identity.userId,
        userEmail: identity.userEmail,
        userName: identity.userName,
        senderType: 'user',
        senderId: identity.userId || identity.userEmail,
        senderName: identity.userName,
        subject: req.body.subject,
        body
    });

    const store = readMessageStore();
    store.messages.push(message);
    writeMessageStore(store);

    res.status(201).json({ message });
});

router.patch('/api/messages/read', requireAuthenticated, (req, res) => {
    const identity = getUserIdentity(req);
    const threadId = buildThreadId(identity.userId, identity.userEmail);
    const store = readMessageStore();
    let updated = 0;

    store.messages = store.messages.map((message) => {
        if (message.threadId === threadId && message.senderType === 'admin' && !message.readByUser) {
            updated += 1;
            return { ...message, readByUser: true };
        }
        return message;
    });

    writeMessageStore(store);
    res.json({ updated });
});

module.exports = router;
