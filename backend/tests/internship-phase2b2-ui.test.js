'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ui = require('../../BC-Learning-Main/elearning-assets/js/internship.js');
const submissionUi = require('../../BC-Learning-Main/elearning-assets/js/internship-submission.js');

function assignment(state = 'available') {
    return {
        assignmentId: 'assignment-one', title: 'Federated Model Review', state,
        requiredDeliverable: 'Clash report', learningReferences: []
    };
}

function renderWithSubmission(submission, overrides = {}) {
    return ui.renderAssignmentsMarkup([assignment()], {
        submissionsEnabled: true,
        submissionsByAssignment: new Map([['assignment-one', {
            assignmentId: 'assignment-one', assignmentState: 'available', submission,
            withdrawalAllowed: false, ...overrides
        }]])
    });
}

test('Phase 2A output remains unchanged when participant submissions capability is OFF', () => {
    const markup = ui.renderAssignmentsMarkup([assignment()]);
    assert.match(markup, /Federated Model Review/);
    assert.doesNotMatch(markup, /Mulai Tugas|Status Pengumpulan|type="file"|Kirim Tugas/);
});

test('available assignment explicitly offers Draft creation without creating it on render', () => {
    const markup = renderWithSubmission(null);
    assert.match(markup, /Belum Dikerjakan/);
    assert.match(markup, /data-submission-action="start"/);
    assert.match(markup, /Mulai Tugas/);
    assert.doesNotMatch(markup, /data-evidence-input|Kirim Tugas/);
});

test('Draft renders safe evidence metadata, picker policy, remove, and submit controls', () => {
    const markup = renderWithSubmission({
        submissionId: 'submission-one', assignmentId: 'assignment-one', state: 'draft',
        evidence: [{
            evidenceId: '11111111-1111-4111-8111-111111111111',
            safeDisplayName: 'clash-report.pdf', mimeType: 'application/pdf', sizeBytes: 2457600,
            uploadedAt: '2026-09-25T03:20:00.000Z', scanStatus: 'pending',
            storageKey: '\\\\private-server\\quarantine\\one', filePath: 'G:\\secret\\report.pdf', sha256: 'secret-hash'
        }]
    });
    assert.match(markup, /Status Pengumpulan/);
    assert.match(markup, /Draft/);
    assert.match(markup, /clash-report\.pdf/);
    assert.match(markup, /Menunggu validasi/);
    assert.match(markup, /data-evidence-input/);
    assert.match(markup, /data-submission-action="remove"/);
    assert.match(markup, /data-submission-action="submit"/);
    assert.doesNotMatch(markup, /private-server|G:\\|storageKey|filePath|secret-hash/i);
});

test('Submitted rendering is frozen and has no upload, replace, or remove action', () => {
    const markup = renderWithSubmission({
        submissionId: 'submission-one', assignmentId: 'assignment-one', state: 'submitted',
        submittedAt: '2026-09-25T03:35:00.000Z',
        evidence: [{
            evidenceId: '11111111-1111-4111-8111-111111111111', safeDisplayName: 'report.pdf',
            mimeType: 'application/pdf', sizeBytes: 2048, uploadedAt: '2026-09-25T03:20:00.000Z', scanStatus: 'pending'
        }]
    });
    assert.match(markup, /Terkirim/);
    assert.match(markup, /Pengumpulan telah dikunci/);
    assert.match(markup, /Menunggu proses evaluasi/);
    assert.doesNotMatch(markup, /data-evidence-input|data-submission-action="remove"|data-submission-action="submit"/);
    assert.doesNotMatch(markup, /mentor score|rubric|revision|accepted/i);
});

test('upload state reports progress and disables editing and submit controls', () => {
    const result = {
        assignmentId: 'assignment-one', assignmentState: 'available', withdrawalAllowed: false,
        submission: {
            submissionId: 'submission-one', assignmentId: 'assignment-one', state: 'draft',
            evidence: [{
                evidenceId: '11111111-1111-4111-8111-111111111111', safeDisplayName: 'report.pdf',
                mimeType: 'application/pdf', sizeBytes: 2048, uploadedAt: '2026-09-25T03:20:00.000Z',
                scanStatus: 'pending'
            }]
        }
    };
    const markup = ui.renderAssignmentsMarkup([assignment()], {
        submissionsEnabled: true,
        submissionsByAssignment: new Map([['assignment-one', result]]),
        pendingActions: new Map([['assignment-one', 'upload']]),
        uploadProgress: new Map([['assignment-one', 42]])
    });
    assert.match(markup, /Mengunggah\.\.\. 42%/);
    assert.match(markup, /data-evidence-input[\s\S]*disabled/);
    assert.match(markup, /data-submission-action="submit" disabled/);
    assert.doesNotMatch(markup, /data-submission-action="remove"/);
});

test('withdrawal action appears only when server policy explicitly allows it', () => {
    const submission = {
        submissionId: 'submission-one', assignmentId: 'assignment-one', state: 'submitted',
        submittedAt: '2026-09-25T03:35:00.000Z', evidence: []
    };
    assert.doesNotMatch(renderWithSubmission(submission), /Tarik Pengumpulan/);
    assert.match(renderWithSubmission(submission, { withdrawalAllowed: true }), /Tarik Pengumpulan/);
});

test('client file policy gives early safe validation while preserving backend authority', () => {
    assert.equal(submissionUi.validateEvidenceFile({ name: 'report.pdf', size: 1024 }, 0).valid, true);
    assert.equal(submissionUi.validateEvidenceFile({ name: 'model.ifc', size: 1024 }, 0).code, 'EVIDENCE_TYPE_NOT_ALLOWED');
    assert.equal(submissionUi.validateEvidenceFile({ name: 'report.pdf.exe', size: 1024 }, 0).code, 'EVIDENCE_TYPE_NOT_ALLOWED');
    assert.equal(submissionUi.validateEvidenceFile({ name: '..\\secret.pdf', size: 1024 }, 0).code, 'UNSAFE_EVIDENCE_FILENAME');
    assert.equal(submissionUi.validateEvidenceFile({ name: 'report.pdf', size: 10 * 1024 * 1024 + 1 }, 0).code, 'EVIDENCE_FILE_TOO_LARGE');
    assert.equal(submissionUi.validateEvidenceFile({ name: 'report.pdf', size: 1024 }, 5).code, 'EVIDENCE_FILE_LIMIT');
    assert.equal(submissionUi.safeSubmissionError({ code: 'EVIDENCE_FILE_TOO_LARGE' }), 'Ukuran file melebihi batas 10 MiB.');
    assert.doesNotMatch(submissionUi.safeSubmissionError({ code: 'UNKNOWN', stack: 'G:\\secret' }), /G:\\|stack/i);
});

test('scan states use participant wording and never promote pending evidence to clean', () => {
    assert.equal(submissionUi.scanStatusLabel('pending'), 'Menunggu validasi');
    assert.equal(submissionUi.scanStatusLabel('clean'), 'Siap');
    assert.equal(submissionUi.scanStatusLabel('rejected'), 'Ditolak');
    assert.equal(submissionUi.scanStatusLabel('failed'), 'Validasi gagal');
});

test('API paths carry only batch, assignment, action, and opaque evidence ID', () => {
    assert.equal(
        submissionUi.submissionPath('batch one', 'assignment/one'),
        '/api/training/internships/batch%20one/assignments/assignment%2Fone/submission'
    );
    const source = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/js/internship.js'), 'utf8');
    assert.doesNotMatch(source, /participant_user_id|participantUserId/);
    assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\([^)]*submission/i);
    assert.doesNotMatch(source, /storageKey|filePath|externalUrl|\\\\server|[A-Z]:\\\\/);
});

test('page loads the narrow submission helper before the Internship controller', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../BC-Learning-Main/elearning-assets/internship.html'), 'utf8');
    assert.match(html, /js\/internship-submission\.js/);
    assert.ok(html.indexOf('internship-submission.js') < html.indexOf('js/internship.js'));
    assert.doesNotMatch(html, /drag-and-drop|Projects Explorer|mentor review/i);
});

test('fixture exposes server-backed isolated submission state without storage paths', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../scripts/serve-internship-ui-fixture.js'), 'utf8');
    assert.match(source, /submissionKey\(batchId, assignmentId\)/);
    assert.match(source, /scanStatus: 'pending'/);
    assert.match(source, /storageStatus: 'quarantined'/);
    assert.doesNotMatch(source, /storageKey:|filePath:|externalUrl:/);
});
