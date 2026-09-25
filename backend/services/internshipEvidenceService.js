'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES_PER_SUBMISSION = 5;
const DEFAULT_CLASSIFICATION = 'internal';

const FILE_TYPES = Object.freeze({
    '.pdf': new Set(['application/pdf']),
    '.docx': new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    '.xlsx': new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
    '.csv': new Set(['text/csv']),
    '.jpg': new Set(['image/jpeg']),
    '.jpeg': new Set(['image/jpeg']),
    '.png': new Set(['image/png'])
});

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const NATIVE_PATH_PATTERN = /(?:\\\\|file:\/\/|[a-z]:[\\/])/i;

class EvidenceValidationError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.name = 'EvidenceValidationError';
        this.code = code;
        this.status = status;
    }
}

function checkedPositiveInteger(value, fallback, label) {
    if (value == null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`${label} must be a positive integer`);
    }
    return parsed;
}

function normalizeFileName(value) {
    const original = String(value || '').normalize('NFC');
    if (!original || original.length > 180) {
        throw new EvidenceValidationError('UNSAFE_EVIDENCE_FILENAME', 'Evidence filename is missing or too long');
    }
    if (original !== original.trim() || original.endsWith('.') || /[\u0000-\u001f\u007f]/.test(original)) {
        throw new EvidenceValidationError('UNSAFE_EVIDENCE_FILENAME', 'Evidence filename is unsafe');
    }
    if (NATIVE_PATH_PATTERN.test(original) || original.includes('/') || original.includes('\\')
        || original === '.' || original === '..' || original.includes('../') || original.includes('..\\')) {
        throw new EvidenceValidationError('UNSAFE_EVIDENCE_FILENAME', 'Evidence filename must not contain a path');
    }
    if (WINDOWS_RESERVED_NAME.test(original) || /[<>:"|?*]/.test(original)) {
        throw new EvidenceValidationError('UNSAFE_EVIDENCE_FILENAME', 'Evidence filename is unsafe');
    }
    return original;
}

function hasPrefix(buffer, bytes) {
    return bytes.every((byte, index) => buffer[index] === byte);
}

function validateSignature(extension, buffer) {
    if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (extension === '.png') return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (extension === '.jpg' || extension === '.jpeg') {
        return buffer.length >= 4 && hasPrefix(buffer, [0xff, 0xd8, 0xff]) && buffer[buffer.length - 2] === 0xff
            && buffer[buffer.length - 1] === 0xd9;
    }
    if (extension === '.docx' || extension === '.xlsx') {
        if (!hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])) return false;
        const archiveIndex = buffer.toString('latin1');
        return archiveIndex.includes('[Content_Types].xml')
            && archiveIndex.includes(extension === '.docx' ? 'word/' : 'xl/');
    }
    if (extension === '.csv') {
        if (buffer.includes(0)) return false;
        try {
            new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            return true;
        } catch (_) {
            return false;
        }
    }
    return false;
}

function validateUpload(file, maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES) {
    if (!file || !Buffer.isBuffer(file.buffer)) {
        throw new EvidenceValidationError('EVIDENCE_FILE_REQUIRED', 'Evidence file is required');
    }
    const originalFileName = normalizeFileName(file.originalname);
    const extension = path.extname(originalFileName).toLowerCase();
    const allowedMimes = FILE_TYPES[extension];
    if (!allowedMimes) {
        throw new EvidenceValidationError('EVIDENCE_TYPE_NOT_ALLOWED', 'Evidence file type is not allowed');
    }
    const mimeType = String(file.mimetype || '').trim().toLowerCase();
    if (!allowedMimes.has(mimeType)) {
        throw new EvidenceValidationError('EVIDENCE_MIME_MISMATCH', 'Evidence MIME type does not match its extension');
    }
    const sizeBytes = file.buffer.length;
    if (sizeBytes === 0) {
        throw new EvidenceValidationError('EMPTY_EVIDENCE_FILE', 'Evidence file must not be empty');
    }
    if (sizeBytes > maxFileSizeBytes) {
        throw new EvidenceValidationError('EVIDENCE_FILE_TOO_LARGE', 'Evidence file exceeds the configured size limit', 413);
    }
    if (!validateSignature(extension, file.buffer)) {
        throw new EvidenceValidationError('EVIDENCE_CONTENT_MISMATCH', 'Evidence content does not match its declared file type');
    }
    return { originalFileName, safeDisplayName: originalFileName, extension, mimeType, sizeBytes };
}

function createLocalEvidenceStorage({ rootDirectory }) {
    if (!rootDirectory) throw new Error('Evidence storage root is required');
    const resolvedRoot = path.resolve(rootDirectory);
    const quarantineRoot = path.join(resolvedRoot, 'quarantine');

    function resolveKey(storageKey) {
        const value = String(storageKey || '');
        if (!/^quarantine\/[0-9a-f-]{36}\.bin$/i.test(value)) {
            throw new Error('Invalid evidence storage key');
        }
        const resolved = path.resolve(resolvedRoot, ...value.split('/'));
        if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Evidence storage key escaped its root');
        return resolved;
    }

    return {
        async putQuarantined(evidenceId, content) {
            const storageKey = `quarantine/${evidenceId}.bin`;
            await fs.mkdir(quarantineRoot, { recursive: true });
            await fs.writeFile(resolveKey(storageKey), content, { flag: 'wx', mode: 0o600 });
            return storageKey;
        },
        async discard(storageKey) {
            await fs.unlink(resolveKey(storageKey)).catch((error) => {
                if (error.code !== 'ENOENT') throw error;
            });
        },
        async read(storageKey) {
            return fs.readFile(resolveKey(storageKey));
        }
    };
}

function createInternshipEvidenceService({
    storage,
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
    maxFilesPerSubmission = DEFAULT_MAX_FILES_PER_SUBMISSION
}) {
    if (!storage || typeof storage.putQuarantined !== 'function' || typeof storage.discard !== 'function') {
        throw new Error('Evidence storage adapter is required');
    }
    const sizeLimit = checkedPositiveInteger(maxFileSizeBytes, DEFAULT_MAX_FILE_SIZE_BYTES, 'maxFileSizeBytes');
    const fileLimit = checkedPositiveInteger(maxFilesPerSubmission, DEFAULT_MAX_FILES_PER_SUBMISSION, 'maxFilesPerSubmission');

    async function quarantineUpload(file, { uploadedByUserId, classification = DEFAULT_CLASSIFICATION } = {}) {
        if (classification !== DEFAULT_CLASSIFICATION) {
            throw new EvidenceValidationError('INVALID_EVIDENCE_CLASSIFICATION', 'Evidence classification is controlled by the server');
        }
        const validated = validateUpload(file, sizeLimit);
        const evidenceId = crypto.randomUUID();
        const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const storageKey = await storage.putQuarantined(evidenceId, file.buffer);
        return {
            evidenceId,
            submissionId: null,
            ...validated,
            sha256,
            uploadedAt: new Date().toISOString(),
            uploadedByUserId: Number(uploadedByUserId),
            classification: DEFAULT_CLASSIFICATION,
            scanStatus: 'pending',
            storageStatus: 'quarantined',
            storageKey
        };
    }

    async function discardQuarantined(record) {
        if (record && record.storageKey) await storage.discard(record.storageKey);
    }

    async function readReleasedEvidence(record) {
        const scanStatus = String(record && (record.scanStatus || record.scan_status) || 'pending');
        const storageStatus = String(record && (record.storageStatus || record.storage_status) || 'quarantined');
        if (scanStatus !== 'clean' || storageStatus !== 'stored') {
            throw new EvidenceValidationError(
                'EVIDENCE_NOT_RELEASED',
                'Evidence is not available until validation is complete',
                423
            );
        }
        if (!record.storageKey || typeof storage.read !== 'function') {
            throw new EvidenceValidationError('EVIDENCE_STORAGE_UNAVAILABLE', 'Evidence storage is unavailable', 503);
        }
        const content = await storage.read(record.storageKey);
        return {
            content,
            mimeType: String(record.mimeType || record.mime_type || 'application/octet-stream'),
            safeDisplayName: normalizeFileName(record.safeDisplayName || record.safe_display_name || 'evidence.bin'),
            sizeBytes: content.length
        };
    }

    return {
        discardQuarantined,
        maxFileSizeBytes: sizeLimit,
        maxFilesPerSubmission: fileLimit,
        quarantineUpload,
        readReleasedEvidence
    };
}

function toSafeEvidenceMetadata(row) {
    if (!row) return null;
    return {
        evidenceId: String(row.evidenceId || row.id),
        submissionId: String(row.submissionId || row.submission_id),
        originalFileName: String(row.originalFileName || row.original_file_name || ''),
        safeDisplayName: String(row.safeDisplayName || row.safe_display_name || row.file_name || ''),
        mimeType: String(row.mimeType || row.mime_type || row.file_type || ''),
        sizeBytes: Number(row.sizeBytes ?? row.file_size ?? 0),
        sha256: String(row.sha256 || ''),
        uploadedAt: row.uploadedAt || row.uploaded_at || null,
        uploadedByUserId: Number(row.uploadedByUserId || row.uploaded_by_user_id),
        classification: row.classification || DEFAULT_CLASSIFICATION,
        scanStatus: row.scanStatus || row.scan_status || 'pending',
        storageStatus: row.storageStatus || row.storage_status || 'quarantined'
    };
}

module.exports = {
    DEFAULT_CLASSIFICATION,
    DEFAULT_MAX_FILES_PER_SUBMISSION,
    DEFAULT_MAX_FILE_SIZE_BYTES,
    EvidenceValidationError,
    FILE_TYPES,
    createInternshipEvidenceService,
    createLocalEvidenceStorage,
    normalizeFileName,
    toSafeEvidenceMetadata,
    validateUpload
};
