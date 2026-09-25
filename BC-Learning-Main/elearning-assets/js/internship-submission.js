(function initializeInternshipSubmissionModule(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BCLInternshipSubmission = api;
})(typeof window !== 'undefined' ? window : null, function internshipSubmissionFactory() {
    'use strict';

    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
    const MAX_FILES_PER_SUBMISSION = 5;
    const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'jpg', 'jpeg', 'png']);
    const UNSAFE_FILE_NAME = /(?:[\\/]|\.\.|[\u0000-\u001f\u007f]|[<>:"|?*])/;

    class SubmissionUiError extends Error {
        constructor(status, code) {
            super('Submission request failed');
            this.name = 'SubmissionUiError';
            this.status = Number(status || 0);
            this.code = String(code || 'SUBMISSION_REQUEST_FAILED');
        }
    }

    function submissionPath(batchId, assignmentId, suffix = '') {
        const batch = encodeURIComponent(String(batchId || ''));
        const assignment = encodeURIComponent(String(assignmentId || ''));
        return `/api/training/internships/${batch}/assignments/${assignment}/submission${suffix}`;
    }

    function extensionOf(fileName) {
        const match = String(fileName || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/);
        return match ? match[1] : '';
    }

    function validateEvidenceFile(file, currentCount = 0) {
        if (!file || !file.name) return { valid: false, code: 'EVIDENCE_FILE_REQUIRED' };
        const name = String(file.name).normalize('NFC');
        if (!name || name.length > 180 || name !== name.trim() || UNSAFE_FILE_NAME.test(name)) {
            return { valid: false, code: 'UNSAFE_EVIDENCE_FILENAME' };
        }
        if (!ALLOWED_EXTENSIONS.has(extensionOf(name))) {
            return { valid: false, code: 'EVIDENCE_TYPE_NOT_ALLOWED' };
        }
        if (Number(file.size) <= 0) return { valid: false, code: 'EMPTY_EVIDENCE_FILE' };
        if (Number(file.size) > MAX_FILE_SIZE_BYTES) return { valid: false, code: 'EVIDENCE_FILE_TOO_LARGE' };
        if (Number(currentCount) >= MAX_FILES_PER_SUBMISSION) return { valid: false, code: 'EVIDENCE_FILE_LIMIT' };
        return { valid: true, code: '' };
    }

    function safeSubmissionError(error) {
        const code = String(error && error.code || '');
        const messages = {
            EVIDENCE_TYPE_NOT_ALLOWED: 'Jenis file tidak didukung.',
            EVIDENCE_MIME_MISMATCH: 'Jenis file tidak sesuai dengan isinya.',
            EVIDENCE_CONTENT_MISMATCH: 'Isi file tidak sesuai dengan jenis file.',
            UNSAFE_EVIDENCE_FILENAME: 'Nama file tidak aman. Ubah nama file lalu coba kembali.',
            EMPTY_EVIDENCE_FILE: 'File kosong tidak dapat ditambahkan.',
            EVIDENCE_FILE_TOO_LARGE: 'Ukuran file melebihi batas 10 MiB.',
            EVIDENCE_FILE_LIMIT: 'Maksimum 5 file evidence.',
            EVIDENCE_FILE_REQUIRED: 'Pilih file evidence terlebih dahulu.',
            ASSIGNMENT_NOT_AVAILABLE: 'Tugas ini belum tersedia atau sudah ditutup.',
            SUBMISSION_NOT_EDITABLE: 'Pengumpulan sudah terkirim dan tidak dapat diubah.',
            SUBMISSION_STATE_CONFLICT: 'Status pengumpulan telah berubah. Muat ulang data lalu coba kembali.',
            SUBMISSION_EVIDENCE_REQUIRED: 'Tambahkan evidence sebelum mengirim tugas.',
            SUBMISSION_COMMENT_REQUIRED: 'Catatan pengumpulan wajib diisi.',
            INTERNSHIP_SUBMISSIONS_DISABLED: 'Pengumpulan tugas belum diaktifkan.',
            EVIDENCE_STORAGE_UNAVAILABLE: 'Penyimpanan evidence sedang tidak tersedia.'
        };
        if (messages[code]) return messages[code];
        if (Number(error && error.status) === 401) return 'Sesi Anda berakhir. Silakan login kembali.';
        if (Number(error && error.status) === 404) return 'Data pengumpulan tidak tersedia.';
        return 'File atau pengumpulan belum berhasil diproses. Silakan coba kembali.';
    }

    function submissionStatusLabel(status) {
        if (status === 'submitted') return 'Terkirim';
        if (status === 'draft' || status === 'withdrawn') return 'Draft';
        return 'Belum Dikerjakan';
    }

    function scanStatusLabel(status) {
        const labels = {
            pending: 'Menunggu validasi',
            clean: 'Siap',
            rejected: 'Ditolak',
            failed: 'Validasi gagal'
        };
        return labels[status] || 'Menunggu validasi';
    }

    function formatEvidenceSize(bytes) {
        const value = Number(bytes);
        if (!Number.isFinite(value) || value < 0) return '0 KB';
        if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
        return `${Math.max(1, Math.round(value / 1024))} KB`;
    }

    function formatServerDateTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    function uploadEvidence(windowObject, { url, token, file, onProgress }) {
        return new Promise((resolve, reject) => {
            const request = new windowObject.XMLHttpRequest();
            const form = new windowObject.FormData();
            form.append('evidence', file, file.name);
            request.open('POST', url, true);
            request.withCredentials = true;
            request.timeout = 60000;
            request.setRequestHeader('Authorization', `Bearer ${token}`);
            request.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && typeof onProgress === 'function') {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            });
            request.addEventListener('load', () => {
                let payload = {};
                try { payload = JSON.parse(request.responseText || '{}'); } catch (_) { payload = {}; }
                if (request.status >= 200 && request.status < 300) return resolve(payload);
                return reject(new SubmissionUiError(request.status, payload.code));
            });
            request.addEventListener('timeout', () => reject(new SubmissionUiError(408, 'EVIDENCE_UPLOAD_TIMEOUT')));
            request.addEventListener('error', () => reject(new SubmissionUiError(0, 'EVIDENCE_UPLOAD_FAILED')));
            request.send(form);
        });
    }

    return {
        ALLOWED_EXTENSIONS,
        MAX_FILES_PER_SUBMISSION,
        MAX_FILE_SIZE_BYTES,
        SubmissionUiError,
        formatEvidenceSize,
        formatServerDateTime,
        safeSubmissionError,
        scanStatusLabel,
        submissionPath,
        submissionStatusLabel,
        uploadEvidence,
        validateEvidenceFile
    };
});
