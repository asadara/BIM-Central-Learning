const express = require('express');
const fs = require('fs');
const path = require('path');
const { getRequestUser, requireAdmin, requireAuthenticated } = require('../utils/auth');
const { ensureAccessColumns } = require('../utils/userAccess');

const MANAGED_TYPES = new Set([
    'library_download',
    'watermark_free_download',
    'general_message'
]);

function createAccessRequestRoutes({
    backendDir,
    ensureDirectoryExists,
    pgPool,
    readUsers,
    writeUsers
}) {
    const router = express.Router();
    const dataFilePath = path.join(backendDir, 'data', 'access-requests.json');

    function readAccessRequests() {
        ensureDirectoryExists(path.dirname(dataFilePath));
        if (!fs.existsSync(dataFilePath)) {
            return [];
        }

        try {
            return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        } catch (error) {
            console.error('Failed to read access requests JSON:', error);
            return [];
        }
    }

    function writeAccessRequests(records) {
        ensureDirectoryExists(path.dirname(dataFilePath));
        fs.writeFileSync(dataFilePath, JSON.stringify(records, null, 2), 'utf8');
    }

    async function ensureAccessRequestsTable() {
        if (!pgPool) return false;

        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS access_requests (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                source_page TEXT,
                subject TEXT,
                message TEXT,
                requester_user_id TEXT,
                requester_username TEXT,
                requester_email TEXT,
                contact_name TEXT,
                contact_email TEXT,
                admin_note TEXT,
                resolution_applied BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_by TEXT,
                reviewed_at TIMESTAMP
            )
        `);

        return true;
    }

    function normalizeRequestType(typeValue) {
        const normalized = String(typeValue || '').trim().toLowerCase();
        return MANAGED_TYPES.has(normalized) ? normalized : '';
    }

    function normalizeStatus(statusValue) {
        const normalized = String(statusValue || '').trim().toLowerCase();
        const allowed = new Set(['pending', 'approved', 'denied', 'reviewed', 'closed']);
        return allowed.has(normalized) ? normalized : '';
    }

    function buildRequestSummary(record) {
        return {
            id: record.id,
            type: record.type,
            status: record.status,
            sourcePage: record.sourcePage || null,
            subject: record.subject || '',
            message: record.message || '',
            requester: {
                userId: record.requesterUserId || '',
                username: record.requesterUsername || '',
                email: record.requesterEmail || ''
            },
            contact: {
                name: record.contactName || '',
                email: record.contactEmail || ''
            },
            adminNote: record.adminNote || '',
            resolutionApplied: !!record.resolutionApplied,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            reviewedBy: record.reviewedBy || '',
            reviewedAt: record.reviewedAt || null
        };
    }

    function recordMatchesUser(record, authUser) {
        if (!authUser) return false;
        const userId = String(authUser.id || '').trim();
        const userEmail = String(authUser.email || '').trim().toLowerCase();

        return (
            (userId && String(record.requesterUserId || '').trim() === userId) ||
            (userEmail && String(record.requesterEmail || '').trim().toLowerCase() === userEmail)
        );
    }

    function findPendingDuplicate(records, requestType, authUser) {
        if (!authUser) return null;

        return records.find((record) => (
            record.type === requestType &&
            record.status === 'pending' &&
            recordMatchesUser(record, authUser)
        )) || null;
    }

    async function readAllRequests() {
        try {
            await ensureAccessRequestsTable();
            const result = await pgPool.query(`
                SELECT id, type, status, source_page, subject, message,
                       requester_user_id, requester_username, requester_email,
                       contact_name, contact_email, admin_note, resolution_applied,
                       created_at, updated_at, reviewed_by, reviewed_at
                FROM access_requests
                ORDER BY created_at DESC
            `);

            return result.rows.map((row) => ({
                id: row.id,
                type: row.type,
                status: row.status,
                sourcePage: row.source_page,
                subject: row.subject,
                message: row.message,
                requesterUserId: row.requester_user_id,
                requesterUsername: row.requester_username,
                requesterEmail: row.requester_email,
                contactName: row.contact_name,
                contactEmail: row.contact_email,
                adminNote: row.admin_note,
                resolutionApplied: !!row.resolution_applied,
                createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
                updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
                reviewedBy: row.reviewed_by,
                reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null
            }));
        } catch (error) {
            return readAccessRequests();
        }
    }

    async function saveRequestRecord(record) {
        try {
            await ensureAccessRequestsTable();
            await pgPool.query(`
                INSERT INTO access_requests (
                    id, type, status, source_page, subject, message,
                    requester_user_id, requester_username, requester_email,
                    contact_name, contact_email, admin_note, resolution_applied,
                    created_at, updated_at, reviewed_by, reviewed_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13,
                    $14, $15, $16, $17
                )
            `, [
                record.id,
                record.type,
                record.status,
                record.sourcePage || null,
                record.subject || null,
                record.message || null,
                record.requesterUserId || null,
                record.requesterUsername || null,
                record.requesterEmail || null,
                record.contactName || null,
                record.contactEmail || null,
                record.adminNote || null,
                !!record.resolutionApplied,
                record.createdAt,
                record.updatedAt,
                record.reviewedBy || null,
                record.reviewedAt || null
            ]);
            return;
        } catch (error) {
            const records = readAccessRequests();
            records.unshift(record);
            writeAccessRequests(records);
        }
    }

    async function updateStoredRequest(recordId, updater) {
        const records = await readAllRequests();
        const recordIndex = records.findIndex((record) => record.id === recordId);
        if (recordIndex === -1) {
            return null;
        }

        const updatedRecord = updater({ ...records[recordIndex] });
        if (!updatedRecord) {
            return null;
        }

        records[recordIndex] = updatedRecord;

        try {
            await ensureAccessRequestsTable();
            await pgPool.query(`
                UPDATE access_requests
                SET status = $1,
                    admin_note = $2,
                    resolution_applied = $3,
                    updated_at = $4,
                    reviewed_by = $5,
                    reviewed_at = $6
                WHERE id = $7
            `, [
                updatedRecord.status,
                updatedRecord.adminNote || null,
                !!updatedRecord.resolutionApplied,
                updatedRecord.updatedAt,
                updatedRecord.reviewedBy || null,
                updatedRecord.reviewedAt || null,
                updatedRecord.id
            ]);
        } catch (error) {
            writeAccessRequests(records);
        }

        return updatedRecord;
    }

    async function applyUserAccessGrant(record) {
        const fieldByType = {
            library_download: 'library_download_access',
            watermark_free_download: 'watermark_free_download_access'
        };

        const dbField = fieldByType[record.type];
        if (!dbField) {
            return true;
        }

        const userId = String(record.requesterUserId || '').trim();
        const userEmail = String(record.requesterEmail || '').trim();

        try {
            if (pgPool) {
                await ensureAccessColumns(pgPool);
                const result = await pgPool.query(`
                    UPDATE users
                    SET ${dbField} = true,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE ($1::text <> '' AND id::text = $1::text)
                       OR ($2::text <> '' AND lower(email) = lower($2))
                    RETURNING id
                `, [userId, userEmail]);

                if (result.rowCount > 0) {
                    return true;
                }
            }
        } catch (error) {
            console.warn('Failed to grant access in PostgreSQL:', error.message);
        }

        const users = readUsers();
        const userIndex = users.findIndex((entry) => (
            (userId && (String(entry.id || '') === userId || String(entry.user_id || '') === userId)) ||
            (userEmail && String(entry.email || '').toLowerCase() === userEmail.toLowerCase())
        ));

        if (userIndex === -1) {
            return false;
        }

        if (record.type === 'library_download') {
            users[userIndex].libraryDownloadAccess = true;
            users[userIndex].library_download_access = true;
        } else if (record.type === 'watermark_free_download') {
            users[userIndex].watermarkFreeDownloadAccess = true;
            users[userIndex].watermark_free_download_access = true;
        }

        return writeUsers(users);
    }

    router.get('/mine', requireAuthenticated, async (req, res) => {
        try {
            const authUser = req.authUser || req.user;
            const records = await readAllRequests();
            const filtered = records
                .filter((record) => recordMatchesUser(record, authUser))
                .map(buildRequestSummary);

            return res.json(filtered);
        } catch (error) {
            console.error('Failed to read user access requests:', error);
            return res.status(500).json({ error: 'Failed to load access requests' });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const requestType = normalizeRequestType(req.body.type);
            if (!requestType) {
                return res.status(400).json({ error: 'Invalid request type' });
            }

            const authUser = getRequestUser(req);
            const isAccessRequest = requestType !== 'general_message';

            if (isAccessRequest && !authUser) {
                return res.status(401).json({ error: 'Authentication required to request access' });
            }

            const subject = String(req.body.subject || '').trim();
            const message = String(req.body.message || '').trim();
            const sourcePage = String(req.body.sourcePage || '').trim();
            const contactName = String(req.body.name || (authUser && authUser.username) || '').trim();
            const contactEmail = String(req.body.email || (authUser && authUser.email) || '').trim();

            if (requestType === 'general_message') {
                if (!contactName || !contactEmail || !subject || !message) {
                    return res.status(400).json({ error: 'Name, email, subject, and message are required' });
                }
            }

            const existingRecords = await readAllRequests();
            const pendingDuplicate = isAccessRequest
                ? findPendingDuplicate(existingRecords, requestType, authUser)
                : null;

            if (pendingDuplicate) {
                return res.status(200).json({
                    success: true,
                    existing: true,
                    request: buildRequestSummary(pendingDuplicate)
                });
            }

            const now = new Date().toISOString();
            const record = {
                id: `req_${Date.now()}`,
                type: requestType,
                status: 'pending',
                sourcePage,
                subject: subject || (
                    requestType === 'library_download'
                        ? 'Permintaan akses download BIM Library'
                        : requestType === 'watermark_free_download'
                            ? 'Permintaan download original tanpa watermark'
                            : 'Pesan dari pengguna'
                ),
                message,
                requesterUserId: authUser ? String(authUser.id || '') : '',
                requesterUsername: authUser ? String(authUser.username || '') : '',
                requesterEmail: authUser ? String(authUser.email || '') : '',
                contactName,
                contactEmail,
                adminNote: '',
                resolutionApplied: false,
                createdAt: now,
                updatedAt: now,
                reviewedBy: '',
                reviewedAt: null
            };

            await saveRequestRecord(record);

            return res.status(201).json({
                success: true,
                request: buildRequestSummary(record)
            });
        } catch (error) {
            console.error('Failed to create access request:', error);
            return res.status(500).json({ error: 'Failed to create access request' });
        }
    });

    router.get('/admin', requireAdmin, async (req, res) => {
        try {
            const records = await readAllRequests();
            return res.json(records.map(buildRequestSummary));
        } catch (error) {
            console.error('Failed to read admin access requests:', error);
            return res.status(500).json({ error: 'Failed to load access requests' });
        }
    });

    router.put('/admin/:id', requireAdmin, async (req, res) => {
        try {
            const recordId = String(req.params.id || '').trim();
            const nextStatus = normalizeStatus(req.body.status);
            const adminNote = String(req.body.adminNote || '').trim();

            if (!recordId || !nextStatus) {
                return res.status(400).json({ error: 'Request ID and valid status are required' });
            }

            const adminUser = req.authUser || req.user;
            const existingRecords = await readAllRequests();
            const existingRecord = existingRecords.find((record) => record.id === recordId);
            if (!existingRecord) {
                return res.status(404).json({ error: 'Request not found' });
            }

            if (nextStatus === 'approved' && existingRecord.type !== 'general_message') {
                const grantApplied = await applyUserAccessGrant(existingRecord);
                if (!grantApplied) {
                    return res.status(404).json({
                        error: 'Request found, but target user could not be updated'
                    });
                }
            }

            const updatedRecord = await updateStoredRequest(recordId, (record) => {
                record.status = nextStatus;
                record.adminNote = adminNote;
                record.updatedAt = new Date().toISOString();
                record.reviewedBy = String(adminUser.email || adminUser.username || 'admin');
                record.reviewedAt = record.updatedAt;
                record.resolutionApplied = nextStatus === 'approved' && record.type !== 'general_message';
                return record;
            });

            if (!updatedRecord) {
                return res.status(404).json({ error: 'Request not found' });
            }

            return res.json({
                success: true,
                request: buildRequestSummary(updatedRecord),
                resolutionApplied: updatedRecord.resolutionApplied
            });
        } catch (error) {
            console.error('Failed to update access request:', error);
            return res.status(500).json({ error: 'Failed to update access request' });
        }
    });

    return router;
}

module.exports = createAccessRequestRoutes;
