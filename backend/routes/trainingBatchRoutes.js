const express = require('express');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { requireAuthenticated, requireAdmin } = require('../utils/auth');

const router = express.Router();

const pool = new Pool(createPgConfig({
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in trainingBatchRoutes:', err.message);
});

const BATCH_STATUSES = new Set(['draft', 'active', 'completed', 'archived']);
const MEMBER_ROLES = new Set(['participant', 'mentor', 'reviewer', 'admin', 'hc_observer']);
const MEMBER_STATUSES = new Set(['invited', 'active', 'completed', 'dropped']);
const CLASSWORK_TYPES = new Set(['material', 'quiz', 'practice_task', 'exam', 'meeting', 'announcement']);
const CLASSWORK_STATUSES = new Set(['draft', 'published', 'closed', 'archived']);
const SUBMISSION_STATUSES = new Set(['assigned', 'submitted', 'late', 'missing', 'reviewed', 'returned', 'accepted', 'completed']);
const REVIEW_RESULT_STATUSES = new Set(['reviewed', 'returned', 'accepted', 'completed']);
const EVALUATION_STATUSES = new Set(['in_progress', 'passed', 'completed', 'needs_revision', 'failed', 'dropped']);
const ATTENDANCE_STATUSES = new Set(['present', 'late', 'absent', 'excused']);
const REVIEWER_ROLES = new Set(['mentor', 'reviewer', 'admin', 'hc_observer']);

let ensureTablesPromise = null;

function ensureTables() {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS training_batches (
                    id TEXT PRIMARY KEY,
                    code TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    learning_path_id TEXT,
                    description TEXT,
                    start_date DATE,
                    end_date DATE,
                    status TEXT NOT NULL DEFAULT 'draft',
                    created_by TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS batch_members (
                    id BIGSERIAL PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role TEXT NOT NULL DEFAULT 'participant',
                    enrollment_status TEXT NOT NULL DEFAULT 'active',
                    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(batch_id, user_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS batch_topics (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    description TEXT,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS classwork_items (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
                    topic_id TEXT REFERENCES batch_topics(id) ON DELETE SET NULL,
                    type TEXT NOT NULL DEFAULT 'material',
                    title TEXT NOT NULL,
                    instructions TEXT,
                    linked_resource_type TEXT,
                    linked_resource_id TEXT,
                    due_at TIMESTAMPTZ,
                    points NUMERIC(10,2) DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'draft',
                    sort_order INTEGER DEFAULT 0,
                    created_by TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS assignment_submissions (
                    id TEXT PRIMARY KEY,
                    classwork_item_id TEXT NOT NULL REFERENCES classwork_items(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    status TEXT NOT NULL DEFAULT 'assigned',
                    submitted_at TIMESTAMPTZ,
                    returned_at TIMESTAMPTZ,
                    score NUMERIC(10,2),
                    feedback_summary TEXT,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(classwork_item_id, user_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS submission_files (
                    id TEXT PRIMARY KEY,
                    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
                    file_path TEXT,
                    external_url TEXT,
                    file_name TEXT,
                    file_type TEXT,
                    file_size BIGINT,
                    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS review_criteria (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
                    classwork_item_id TEXT REFERENCES classwork_items(id) ON DELETE CASCADE,
                    template_id TEXT,
                    title TEXT NOT NULL,
                    description TEXT,
                    max_score NUMERIC(10,2) NOT NULL DEFAULT 100,
                    weight NUMERIC(10,2) NOT NULL DEFAULT 1,
                    sort_order INTEGER DEFAULT 0,
                    created_by TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS review_scores (
                    id TEXT PRIMARY KEY,
                    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
                    criterion_id TEXT NOT NULL REFERENCES review_criteria(id) ON DELETE CASCADE,
                    score NUMERIC(10,2) NOT NULL DEFAULT 0,
                    comment TEXT,
                    reviewed_by TEXT,
                    reviewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(submission_id, criterion_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS submission_comments (
                    id TEXT PRIMARY KEY,
                    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
                    sender_user_id TEXT,
                    visibility TEXT NOT NULL DEFAULT 'participant',
                    body TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS batch_evaluations (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    final_status TEXT NOT NULL DEFAULT 'in_progress',
                    final_score NUMERIC(10,2),
                    evaluator_id TEXT,
                    note TEXT,
                    evaluated_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(batch_id, user_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS attendance_sessions (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    scheduled_at TIMESTAMPTZ,
                    meeting_url TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS attendance_records (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    status TEXT NOT NULL DEFAULT 'present',
                    note TEXT,
                    updated_by TEXT,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(session_id, user_id)
                )
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_training_batches_status
                ON training_batches(status)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_training_batches_learning_path
                ON training_batches(learning_path_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_members_batch_id
                ON batch_members(batch_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_members_user_id
                ON batch_members(user_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_members_role
                ON batch_members(role)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_topics_batch_id
                ON batch_topics(batch_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_classwork_items_batch_id
                ON classwork_items(batch_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_classwork_items_topic_id
                ON classwork_items(topic_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_classwork_items_status
                ON classwork_items(status)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_assignment_submissions_item
                ON assignment_submissions(classwork_item_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user
                ON assignment_submissions(user_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status
                ON assignment_submissions(status)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_submission_files_submission
                ON submission_files(submission_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_review_criteria_classwork
                ON review_criteria(classwork_item_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_review_scores_submission
                ON review_scores(submission_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_submission_comments_submission
                ON submission_comments(submission_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_batch_evaluations_batch
                ON batch_evaluations(batch_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch
                ON attendance_sessions(batch_id)
            `);

            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_attendance_records_session
                ON attendance_records(session_id)
            `);
        })().catch((error) => {
            ensureTablesPromise = null;
            throw error;
        });
    }

    return ensureTablesPromise;
}

function trimText(value, maxLength = 255) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.slice(0, maxLength);
}

function toNullableInt(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function toNullableFileSize(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
}

function toNullableScore(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100) / 100;
}

function toNonNegativeNumber(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
}

function normalizeStatus(value, allowed, fallback) {
    const normalized = trimText(value, 64).toLowerCase();
    return allowed.has(normalized) ? normalized : fallback;
}

function normalizeCode(value) {
    return trimText(value, 80)
        .toUpperCase()
        .replace(/[^A-Z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateCode(title) {
    const base = normalizeCode(title).slice(0, 40) || 'BATCH';
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base}-${suffix}`;
}

function getActorId(req) {
    const actor = req.authUser || req.user || {};
    return trimText(actor.id || actor.userId || actor.email || actor.username || 'unknown', 120);
}

function mapBatch(row) {
    if (!row) return null;
    return {
        id: row.id,
        code: row.code,
        title: row.title,
        learningPathId: row.learning_path_id || null,
        description: row.description || '',
        startDate: row.start_date || null,
        endDate: row.end_date || null,
        status: row.status,
        createdBy: row.created_by || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        memberCount: Number(row.member_count || 0),
        participantCount: Number(row.participant_count || 0),
        mentorCount: Number(row.mentor_count || 0),
        reviewerCount: Number(row.reviewer_count || 0)
    };
}

function mapMember(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        batchId: row.batch_id,
        userId: Number(row.user_id),
        username: row.username || null,
        email: row.email || null,
        bimLevel: row.bim_level || null,
        jobRole: row.job_role || null,
        organization: row.organization || null,
        role: row.role,
        enrollmentStatus: row.enrollment_status,
        joinedAt: row.joined_at || null,
        completedAt: row.completed_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null
    };
}

function mapTopic(row) {
    if (!row) return null;
    return {
        id: row.id,
        batchId: row.batch_id,
        title: row.title,
        description: row.description || '',
        sortOrder: Number(row.sort_order || 0),
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        itemCount: Number(row.item_count || 0)
    };
}

function mapClassworkItem(row) {
    if (!row) return null;
    return {
        id: row.id,
        batchId: row.batch_id,
        topicId: row.topic_id || null,
        type: row.type,
        title: row.title,
        instructions: row.instructions || '',
        linkedResourceType: row.linked_resource_type || null,
        linkedResourceId: row.linked_resource_id || null,
        dueAt: row.due_at || null,
        points: Number(row.points || 0),
        status: row.status,
        sortOrder: Number(row.sort_order || 0),
        createdBy: row.created_by || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null
    };
}

function mapSubmission(row) {
    if (!row) return null;
    const submissionId = row.id || row.submission_id || null;
    if (!submissionId) return null;

    return {
        id: submissionId,
        classworkItemId: row.classwork_item_id,
        userId: Number(row.user_id),
        username: row.username || null,
        email: row.email || null,
        bimLevel: row.bim_level || null,
        jobRole: row.job_role || null,
        status: row.status,
        submittedAt: row.submitted_at || null,
        returnedAt: row.returned_at || null,
        score: row.score == null ? null : Number(row.score),
        feedbackSummary: row.feedback_summary || '',
        metadata: row.metadata || {},
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        files: Array.isArray(row.files) ? row.files.map(mapSubmissionFile) : undefined
    };
}

function mapSubmissionFile(row) {
    if (!row) return null;
    return {
        id: row.id,
        submissionId: row.submission_id,
        filePath: row.file_path || null,
        externalUrl: row.external_url || null,
        fileName: row.file_name || '',
        fileType: row.file_type || '',
        fileSize: row.file_size == null ? null : Number(row.file_size),
        uploadedAt: row.uploaded_at || null
    };
}

function mapReviewCriterion(row) {
    if (!row) return null;
    return {
        id: row.id,
        batchId: row.batch_id,
        classworkItemId: row.classwork_item_id || null,
        templateId: row.template_id || null,
        title: row.title,
        description: row.description || '',
        maxScore: Number(row.max_score || 0),
        weight: Number(row.weight || 1),
        sortOrder: Number(row.sort_order || 0),
        createdBy: row.created_by || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null
    };
}

function mapReviewScore(row) {
    if (!row) return null;
    return {
        id: row.id,
        submissionId: row.submission_id,
        criterionId: row.criterion_id,
        score: Number(row.score || 0),
        comment: row.comment || '',
        reviewedBy: row.reviewed_by || null,
        reviewedAt: row.reviewed_at || null,
        updatedAt: row.updated_at || null
    };
}

function mapSubmissionComment(row) {
    if (!row) return null;
    return {
        id: row.id,
        submissionId: row.submission_id,
        senderUserId: row.sender_user_id || null,
        visibility: row.visibility || 'participant',
        body: row.body || '',
        createdAt: row.created_at || null
    };
}

function mapBatchEvaluation(row) {
    if (!row) return null;
    return {
        id: row.id,
        batchId: row.batch_id,
        userId: Number(row.user_id),
        finalStatus: row.final_status || 'in_progress',
        finalScore: row.final_score == null ? null : Number(row.final_score),
        evaluatorId: row.evaluator_id || null,
        note: row.note || '',
        evaluatedAt: row.evaluated_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null
    };
}

function mapAttendanceSession(row) {
    if (!row) return null;
    return {
        id: row.id,
        batchId: row.batch_id,
        title: row.title,
        scheduledAt: row.scheduled_at || null,
        meetingUrl: row.meeting_url || '',
        createdAt: row.created_at || null,
        recordCount: Number(row.record_count || 0),
        presentCount: Number(row.present_count || 0),
        lateCount: Number(row.late_count || 0),
        absentCount: Number(row.absent_count || 0),
        excusedCount: Number(row.excused_count || 0),
        records: Array.isArray(row.records) ? row.records : undefined
    };
}

function mapAttendanceRecord(row) {
    if (!row) return null;
    return {
        id: row.id,
        sessionId: row.session_id,
        userId: Number(row.user_id),
        username: row.username || null,
        email: row.email || null,
        status: row.status || 'present',
        note: row.note || '',
        updatedBy: row.updated_by || null,
        updatedAt: row.updated_at || null
    };
}

async function fetchBatch(batchId) {
    const result = await pool.query(
        `SELECT
            b.*,
            COUNT(bm.id)::int AS member_count,
            COUNT(bm.id) FILTER (WHERE bm.role = 'participant')::int AS participant_count,
            COUNT(bm.id) FILTER (WHERE bm.role = 'mentor')::int AS mentor_count,
            COUNT(bm.id) FILTER (WHERE bm.role = 'reviewer')::int AS reviewer_count
         FROM training_batches b
         LEFT JOIN batch_members bm ON bm.batch_id = b.id
         WHERE b.id = $1
         GROUP BY b.id
         LIMIT 1`,
        [batchId]
    );
    return result.rows[0] || null;
}

async function fetchBatchMember(batchId, userId) {
    const result = await pool.query(
        `SELECT
            bm.*,
            u.username,
            u.email,
            u.bim_level,
            u.job_role,
            u.organization
         FROM batch_members bm
         INNER JOIN users u ON u.id = bm.user_id
         WHERE bm.batch_id = $1
           AND bm.user_id = $2
           AND bm.enrollment_status <> 'dropped'
         LIMIT 1`,
        [batchId, userId]
    );
    return result.rows[0] || null;
}

async function requireBatchAccess(req, res, next) {
    try {
        await ensureTables();

        if (req.authUser && req.authUser.isAdmin) {
            return next();
        }

        const userId = toNullableInt(req.authUser && req.authUser.id);
        if (!userId) {
            return res.status(403).json({ error: 'Batch access denied' });
        }

        const result = await pool.query(
            `SELECT id
             FROM batch_members
             WHERE batch_id = $1
               AND user_id = $2
               AND enrollment_status <> 'dropped'
             LIMIT 1`,
            [req.params.id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Batch access denied' });
        }

        return next();
    } catch (error) {
        console.error('Training batch access error:', error);
        return res.status(500).json({ error: 'Failed to verify batch access' });
    }
}

async function resolveUserReference(reference) {
    const text = trimText(reference, 255);
    if (!text) return null;

    const result = await pool.query(
        `SELECT id, username, email, bim_level, job_role, organization
         FROM users
         WHERE id::text = $1::text
            OR lower(email) = lower($1)
            OR lower(username) = lower($1)
         LIMIT 1`,
        [text]
    );

    return result.rows[0] || null;
}

async function fetchTopic(topicId, batchId) {
    const result = await pool.query(
        `SELECT
            bt.*,
            COUNT(ci.id)::int AS item_count
         FROM batch_topics bt
         LEFT JOIN classwork_items ci ON ci.topic_id = bt.id
         WHERE bt.id = $1
           AND bt.batch_id = $2
         GROUP BY bt.id
         LIMIT 1`,
        [topicId, batchId]
    );
    return result.rows[0] || null;
}

async function fetchClassworkItem(itemId, batchId) {
    const result = await pool.query(
        `SELECT *
         FROM classwork_items
         WHERE id = $1
           AND batch_id = $2
         LIMIT 1`,
        [itemId, batchId]
    );
    return result.rows[0] || null;
}

async function fetchSubmission(classworkItemId, userId) {
    const result = await pool.query(
        `SELECT
            s.*,
            u.username,
            u.email,
            u.bim_level,
            u.job_role
         FROM assignment_submissions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.classwork_item_id = $1
           AND s.user_id = $2
         LIMIT 1`,
        [classworkItemId, userId]
    );
    return result.rows[0] || null;
}

async function fetchSubmissionFiles(submissionIds) {
    const ids = Array.isArray(submissionIds) ? submissionIds.filter(Boolean) : [];
    const filesBySubmission = new Map();
    if (ids.length === 0) return filesBySubmission;

    const result = await pool.query(
        `SELECT *
         FROM submission_files
         WHERE submission_id = ANY($1::text[])
         ORDER BY uploaded_at ASC, id ASC`,
        [ids]
    );

    result.rows.forEach((row) => {
        if (!filesBySubmission.has(row.submission_id)) {
            filesBySubmission.set(row.submission_id, []);
        }
        filesBySubmission.get(row.submission_id).push(mapSubmissionFile(row));
    });

    return filesBySubmission;
}

async function fetchReviewCriteria(batchId, classworkItemId) {
    const result = await pool.query(
        `SELECT *
         FROM review_criteria
         WHERE batch_id = $1
           AND (classwork_item_id = $2 OR classwork_item_id IS NULL)
         ORDER BY sort_order ASC, created_at ASC, id ASC`,
        [batchId, classworkItemId]
    );
    return result.rows;
}

async function fetchReviewScores(submissionId) {
    const result = await pool.query(
        `SELECT *
         FROM review_scores
         WHERE submission_id = $1
         ORDER BY reviewed_at ASC, id ASC`,
        [submissionId]
    );
    return result.rows;
}

async function fetchSubmissionComments(submissionId, includeInternal = false) {
    const result = await pool.query(
        `SELECT *
         FROM submission_comments
         WHERE submission_id = $1
           AND ($2::boolean = true OR visibility <> 'internal')
         ORDER BY created_at ASC, id ASC`,
        [submissionId, includeInternal]
    );
    return result.rows;
}

async function fetchSubmissionById(submissionId, classworkItemId) {
    const result = await pool.query(
        `SELECT
            s.*,
            u.username,
            u.email,
            u.bim_level,
            u.job_role
         FROM assignment_submissions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = $1
           AND s.classwork_item_id = $2
         LIMIT 1`,
        [submissionId, classworkItemId]
    );
    return result.rows[0] || null;
}

async function fetchSubmissionReviewDetail(submissionId, batchId, classworkItemId, includeInternal = false) {
    const submission = await fetchSubmissionById(submissionId, classworkItemId);
    if (!submission) return null;

    const [filesBySubmission, criteriaRows, scoreRows, commentRows] = await Promise.all([
        fetchSubmissionFiles([submissionId]),
        fetchReviewCriteria(batchId, classworkItemId),
        fetchReviewScores(submissionId),
        fetchSubmissionComments(submissionId, includeInternal)
    ]);

    const data = mapSubmission(submission);
    data.files = filesBySubmission.get(submissionId) || [];

    return {
        submission: data,
        criteria: criteriaRows.map(mapReviewCriterion),
        scores: scoreRows.map(mapReviewScore),
        comments: commentRows.map(mapSubmissionComment)
    };
}

function deriveEvaluationStatus(row) {
    if (row.final_status) return row.final_status;
    if (Number(row.task_count || 0) === 0) return 'in_progress';
    if (Number(row.missing_count || 0) > 0) return 'needs_revision';
    if (Number(row.reviewed_count || 0) >= Number(row.task_count || 0)) return 'completed';
    return 'in_progress';
}

async function fetchBatchEvaluationRows(batchId) {
    const result = await pool.query(
        `WITH practice_items AS (
            SELECT id, points
            FROM classwork_items
            WHERE batch_id = $1
              AND type = 'practice_task'
              AND status <> 'archived'
        ),
        participant_rows AS (
            SELECT
                bm.user_id,
                u.username,
                u.email,
                u.bim_level,
                u.job_role,
                bm.enrollment_status,
                COUNT(pi.id)::int AS task_count,
                COUNT(s.id)::int AS submitted_count,
                COUNT(s.id) FILTER (WHERE s.status IN ('reviewed', 'accepted', 'completed'))::int AS reviewed_count,
                COUNT(s.id) FILTER (WHERE s.status = 'returned')::int AS returned_count,
                COUNT(pi.id) FILTER (WHERE s.id IS NULL AND pi.id IS NOT NULL)::int AS missing_count,
                AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS average_score,
                SUM(s.score) FILTER (WHERE s.score IS NOT NULL) AS total_score,
                SUM(pi.points) FILTER (WHERE pi.points IS NOT NULL AND pi.points > 0) AS max_points,
                MAX(s.updated_at) AS last_submission_update
             FROM batch_members bm
             INNER JOIN users u ON u.id = bm.user_id
             LEFT JOIN practice_items pi ON true
             LEFT JOIN assignment_submissions s
                ON s.classwork_item_id = pi.id
               AND s.user_id = bm.user_id
             WHERE bm.batch_id = $1
               AND bm.role = 'participant'
               AND bm.enrollment_status <> 'dropped'
             GROUP BY bm.user_id, u.username, u.email, u.bim_level, u.job_role, bm.enrollment_status
        )
        SELECT
            pr.*,
            be.id AS evaluation_id,
            be.final_status,
            be.final_score,
            be.evaluator_id,
            be.note,
            be.evaluated_at,
            be.created_at AS evaluation_created_at,
            be.updated_at AS evaluation_updated_at
        FROM participant_rows pr
        LEFT JOIN batch_evaluations be
          ON be.batch_id = $1
         AND be.user_id = pr.user_id
        ORDER BY pr.username ASC`,
        [batchId]
    );

    return result.rows.map((row) => {
        const taskCount = Number(row.task_count || 0);
        const submittedCount = Number(row.submitted_count || 0);
        const reviewedCount = Number(row.reviewed_count || 0);
        const averageScore = row.average_score == null ? null : Number(row.average_score);
        const finalScore = row.final_score == null
            ? averageScore
            : Number(row.final_score);

        return {
            userId: Number(row.user_id),
            username: row.username || null,
            email: row.email || null,
            bimLevel: row.bim_level || null,
            jobRole: row.job_role || null,
            enrollmentStatus: row.enrollment_status || 'active',
            taskCount,
            submittedCount,
            reviewedCount,
            returnedCount: Number(row.returned_count || 0),
            missingCount: Number(row.missing_count || 0),
            completionPercent: taskCount ? Math.round((submittedCount / taskCount) * 10000) / 100 : 0,
            reviewPercent: taskCount ? Math.round((reviewedCount / taskCount) * 10000) / 100 : 0,
            averageScore,
            totalScore: row.total_score == null ? null : Number(row.total_score),
            maxPoints: row.max_points == null ? null : Number(row.max_points),
            finalStatus: deriveEvaluationStatus(row),
            finalScore,
            evaluatorId: row.evaluator_id || null,
            note: row.note || '',
            evaluatedAt: row.evaluated_at || null,
            lastSubmissionUpdate: row.last_submission_update || null,
            evaluation: row.evaluation_id ? mapBatchEvaluation({
                id: row.evaluation_id,
                batch_id: batchId,
                user_id: row.user_id,
                final_status: row.final_status,
                final_score: row.final_score,
                evaluator_id: row.evaluator_id,
                note: row.note,
                evaluated_at: row.evaluated_at,
                created_at: row.evaluation_created_at,
                updated_at: row.evaluation_updated_at
            }) : null
        };
    });
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function buildEvaluationCsv(rows) {
    const headers = [
        'user_id',
        'username',
        'email',
        'bim_level',
        'job_role',
        'task_count',
        'submitted_count',
        'reviewed_count',
        'missing_count',
        'completion_percent',
        'review_percent',
        'average_score',
        'final_score',
        'final_status',
        'note'
    ];
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((key) => csvEscape(row[key === 'user_id' ? 'userId'
            : key === 'bim_level' ? 'bimLevel'
                : key === 'job_role' ? 'jobRole'
                    : key === 'task_count' ? 'taskCount'
                        : key === 'submitted_count' ? 'submittedCount'
                            : key === 'reviewed_count' ? 'reviewedCount'
                                : key === 'missing_count' ? 'missingCount'
                                    : key === 'completion_percent' ? 'completionPercent'
                                        : key === 'review_percent' ? 'reviewPercent'
                                            : key === 'average_score' ? 'averageScore'
                                                : key === 'final_score' ? 'finalScore'
                                                    : key === 'final_status' ? 'finalStatus'
                                                        : key] ?? '')).join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
}

function getReadinessReasons(row) {
    const reasons = [];
    if (row.finalStatus === 'failed') reasons.push('Final status failed');
    if (row.finalStatus === 'dropped') reasons.push('Participant dropped');
    if (Number(row.missingCount || 0) > 0) reasons.push(`${Number(row.missingCount)} missing submission`);
    if (Number(row.returnedCount || 0) > 0) reasons.push(`${Number(row.returnedCount)} returned submission`);
    if (row.finalScore != null && Number(row.finalScore) < 70) reasons.push(`Score below threshold (${Number(row.finalScore)})`);
    if (Number(row.taskCount || 0) > 0 && Number(row.completionPercent || 0) < 80) reasons.push(`Completion ${Number(row.completionPercent || 0)}%`);
    return reasons;
}

function deriveReadinessLevel(row) {
    const status = String(row.finalStatus || 'in_progress').toLowerCase();
    if (['passed', 'completed'].includes(status)) return 'ready';
    if (['failed', 'dropped'].includes(status)) return 'blocked';
    if (status === 'needs_revision') return 'at_risk';
    if (getReadinessReasons(row).length > 0) return 'at_risk';
    if (Number(row.completionPercent || 0) >= 80) return 'on_track';
    return 'in_progress';
}

function buildReadinessRows(evaluationRows) {
    return evaluationRows.map((row) => {
        const readinessLevel = deriveReadinessLevel(row);
        const riskReasons = getReadinessReasons(row);
        return {
            ...row,
            readinessLevel,
            riskReasons,
            needsIntervention: ['at_risk', 'blocked'].includes(readinessLevel)
        };
    });
}

function buildRoleReadiness(rows) {
    const byRole = new Map();
    for (const row of rows) {
        const role = row.jobRole || 'Unspecified Role';
        if (!byRole.has(role)) {
            byRole.set(role, {
                jobRole: role,
                participantCount: 0,
                readyCount: 0,
                atRiskCount: 0,
                blockedCount: 0,
                totalScore: 0,
                scoredCount: 0
            });
        }
        const entry = byRole.get(role);
        entry.participantCount += 1;
        if (row.readinessLevel === 'ready') entry.readyCount += 1;
        if (row.readinessLevel === 'at_risk') entry.atRiskCount += 1;
        if (row.readinessLevel === 'blocked') entry.blockedCount += 1;
        if (row.finalScore != null) {
            entry.totalScore += Number(row.finalScore);
            entry.scoredCount += 1;
        }
    }

    return Array.from(byRole.values()).map((entry) => ({
        jobRole: entry.jobRole,
        participantCount: entry.participantCount,
        readyCount: entry.readyCount,
        atRiskCount: entry.atRiskCount,
        blockedCount: entry.blockedCount,
        readinessPercent: entry.participantCount ? Math.round((entry.readyCount / entry.participantCount) * 10000) / 100 : 0,
        averageScore: entry.scoredCount ? Math.round((entry.totalScore / entry.scoredCount) * 100) / 100 : null
    }));
}

async function fetchBatchSkillGaps(batchId) {
    const result = await pool.query(
        `WITH participant_count AS (
            SELECT COUNT(*)::int AS count
            FROM batch_members
            WHERE batch_id = $1
              AND role = 'participant'
              AND enrollment_status <> 'dropped'
        )
        SELECT
            ci.id,
            ci.title,
            ci.points,
            pc.count AS participant_count,
            COUNT(s.id)::int AS submitted_count,
            COUNT(s.id) FILTER (WHERE s.status IN ('reviewed', 'accepted', 'completed'))::int AS reviewed_count,
            COUNT(s.id) FILTER (WHERE s.status = 'returned')::int AS returned_count,
            GREATEST(pc.count - COUNT(s.id), 0)::int AS missing_count,
            AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS average_score
         FROM classwork_items ci
         CROSS JOIN participant_count pc
         LEFT JOIN assignment_submissions s ON s.classwork_item_id = ci.id
         WHERE ci.batch_id = $1
           AND ci.type = 'practice_task'
           AND ci.status <> 'archived'
         GROUP BY ci.id, ci.title, ci.points, pc.count
         ORDER BY
            GREATEST(pc.count - COUNT(s.id), 0) DESC,
            COUNT(s.id) FILTER (WHERE s.status = 'returned') DESC,
            AVG(s.score) ASC NULLS LAST,
            ci.sort_order ASC,
            ci.created_at ASC`,
        [batchId]
    );

    return result.rows.map((row) => {
        const participantCount = Number(row.participant_count || 0);
        const submittedCount = Number(row.submitted_count || 0);
        const reviewedCount = Number(row.reviewed_count || 0);
        const missingCount = Number(row.missing_count || 0);
        const returnedCount = Number(row.returned_count || 0);
        const averageScore = row.average_score == null ? null : Number(row.average_score);
        const gapReasons = [];
        if (missingCount > 0) gapReasons.push(`${missingCount} missing`);
        if (returnedCount > 0) gapReasons.push(`${returnedCount} returned`);
        if (averageScore != null && averageScore < 70) gapReasons.push(`avg score ${Math.round(averageScore * 100) / 100}`);

        return {
            classworkItemId: row.id,
            title: row.title,
            points: Number(row.points || 0),
            participantCount,
            submittedCount,
            reviewedCount,
            missingCount,
            returnedCount,
            averageScore,
            completionPercent: participantCount ? Math.round((submittedCount / participantCount) * 10000) / 100 : 0,
            reviewPercent: participantCount ? Math.round((reviewedCount / participantCount) * 10000) / 100 : 0,
            gapReasons
        };
    });
}

async function fetchBatchParticipants(batchId) {
    const result = await pool.query(
        `SELECT
            bm.user_id,
            u.username,
            u.email,
            u.bim_level,
            u.job_role,
            bm.enrollment_status
         FROM batch_members bm
         INNER JOIN users u ON u.id = bm.user_id
         WHERE bm.batch_id = $1
           AND bm.role = 'participant'
           AND bm.enrollment_status <> 'dropped'
         ORDER BY u.username ASC`,
        [batchId]
    );

    return result.rows.map((row) => ({
        userId: Number(row.user_id),
        username: row.username || null,
        email: row.email || null,
        bimLevel: row.bim_level || null,
        jobRole: row.job_role || null,
        enrollmentStatus: row.enrollment_status || 'active'
    }));
}

async function fetchAttendanceSessions(batchId) {
    const result = await pool.query(
        `SELECT
            s.*,
            COUNT(r.id)::int AS record_count,
            COUNT(r.id) FILTER (WHERE r.status = 'present')::int AS present_count,
            COUNT(r.id) FILTER (WHERE r.status = 'late')::int AS late_count,
            COUNT(r.id) FILTER (WHERE r.status = 'absent')::int AS absent_count,
            COUNT(r.id) FILTER (WHERE r.status = 'excused')::int AS excused_count
         FROM attendance_sessions s
         LEFT JOIN attendance_records r ON r.session_id = s.id
         WHERE s.batch_id = $1
         GROUP BY s.id
         ORDER BY s.scheduled_at DESC NULLS LAST, s.created_at DESC`,
        [batchId]
    );

    const sessions = result.rows.map(mapAttendanceSession);
    const sessionIds = sessions.map((session) => session.id);
    if (sessionIds.length === 0) return sessions;

    const recordsResult = await pool.query(
        `SELECT
            r.*,
            u.username,
            u.email
         FROM attendance_records r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.session_id = ANY($1::text[])
         ORDER BY u.username ASC`,
        [sessionIds]
    );

    const recordsBySession = new Map();
    recordsResult.rows.forEach((row) => {
        if (!recordsBySession.has(row.session_id)) recordsBySession.set(row.session_id, []);
        recordsBySession.get(row.session_id).push(mapAttendanceRecord(row));
    });

    return sessions.map((session) => ({
        ...session,
        records: recordsBySession.get(session.id) || []
    }));
}

async function canReviewBatch(req, batchId) {
    if (req.authUser && req.authUser.isAdmin) return true;

    const userId = toNullableInt(req.authUser && req.authUser.id);
    if (!userId) return false;

    const member = await fetchBatchMember(batchId, userId);
    return Boolean(member && REVIEWER_ROLES.has(member.role));
}

function normalizeMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
}

function getSubmissionFilePayloads(body) {
    if (Array.isArray(body?.files)) return body.files;
    if (body?.file || body?.externalUrl || body?.external_url || body?.filePath || body?.file_path) {
        return [body.file || body];
    }
    return [];
}

function normalizeExternalUrl(value) {
    const text = trimText(value, 2048);
    if (!text) return null;

    try {
        const parsed = new URL(text);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch (error) {
        return null;
    }

    return null;
}

function normalizeSubmissionFiles(body) {
    return getSubmissionFilePayloads(body)
        .slice(0, 20)
        .map((file) => {
            const externalUrl = normalizeExternalUrl(file.externalUrl || file.external_url);
            const filePath = trimText(file.filePath || file.file_path, 2048) || null;
            if (!externalUrl && !filePath) return null;

            return {
                id: trimText(file.id, 120) || generateId('sfile'),
                filePath,
                externalUrl,
                fileName: trimText(file.fileName || file.file_name || file.name, 255) || null,
                fileType: trimText(file.fileType || file.file_type || file.type, 120) || null,
                fileSize: toNullableFileSize(file.fileSize ?? file.file_size ?? file.size)
            };
        })
        .filter(Boolean);
}

function getReviewScorePayloads(body) {
    if (Array.isArray(body?.scores)) return body.scores;
    if (Array.isArray(body?.criteriaScores)) return body.criteriaScores;
    if (body?.criterionId || body?.criterion_id || body?.criterionTitle || body?.title) {
        return [body];
    }
    return [];
}

function normalizeReviewScorePayloads(body) {
    return getReviewScorePayloads(body)
        .slice(0, 50)
        .map((item, index) => {
            const score = toNullableScore(item.score);
            const maxScore = toNullableScore(item.maxScore ?? item.max_score) || 100;
            const weight = toNonNegativeNumber(item.weight, 1) || 1;
            const title = trimText(item.title || item.criterionTitle || item.criterion_title, 255);
            const criterionId = trimText(item.criterionId || item.criterion_id, 120);

            if (score == null || (!criterionId && !title)) return null;

            return {
                criterionId,
                title,
                description: trimText(item.description, 2000),
                maxScore,
                weight,
                sortOrder: Number.isFinite(Number(item.sortOrder ?? item.sort_order))
                    ? Number(item.sortOrder ?? item.sort_order)
                    : index,
                score: Math.min(score, maxScore),
                comment: trimText(item.comment, 5000)
            };
        })
        .filter(Boolean);
}

function calculateReviewTotalScore(criteriaRows, scorePayloads, itemPoints = 0) {
    const criteriaById = new Map((criteriaRows || []).map((criterion) => [criterion.id, criterion]));
    let weightedPercentTotal = 0;
    let totalWeight = 0;

    for (const score of scorePayloads) {
        const criterion = criteriaById.get(score.criterionId);
        const maxScore = Number(criterion?.max_score || score.maxScore || 100);
        const weight = Number(criterion?.weight || score.weight || 1);
        if (!maxScore || !weight) continue;

        weightedPercentTotal += Math.min(Number(score.score || 0), maxScore) / maxScore * weight;
        totalWeight += weight;
    }

    if (!totalWeight) return null;

    const percent = weightedPercentTotal / totalWeight;
    const points = Number(itemPoints || 0);
    const rawScore = points > 0 ? percent * points : percent * 100;
    return Math.round(rawScore * 100) / 100;
}

function deriveSubmissionStatus(item, submission) {
    if (submission && submission.status) return submission.status;
    if (item && item.due_at && new Date(item.due_at).getTime() < Date.now()) return 'missing';
    return 'assigned';
}

function getMemberPayloads(body) {
    if (Array.isArray(body?.members)) return body.members;
    if (Array.isArray(body?.users)) return body.users;
    return [body || {}];
}

router.get('/my-batches', requireAuthenticated, async (req, res) => {
    try {
        await ensureTables();

        const userId = toNullableInt(req.authUser && req.authUser.id);
        if (!userId) {
            return res.json({ success: true, data: [] });
        }

        const result = await pool.query(
            `SELECT
                b.*,
                bm.role AS member_role,
                bm.enrollment_status AS member_status,
                COUNT(all_members.id)::int AS member_count,
                COUNT(all_members.id) FILTER (WHERE all_members.role = 'participant')::int AS participant_count,
                COUNT(all_members.id) FILTER (WHERE all_members.role = 'mentor')::int AS mentor_count,
                COUNT(all_members.id) FILTER (WHERE all_members.role = 'reviewer')::int AS reviewer_count
             FROM batch_members bm
             INNER JOIN training_batches b ON b.id = bm.batch_id
             LEFT JOIN batch_members all_members ON all_members.batch_id = b.id
             WHERE bm.user_id = $1
               AND bm.enrollment_status <> 'dropped'
               AND b.status <> 'archived'
             GROUP BY b.id, bm.role, bm.enrollment_status, bm.joined_at
             ORDER BY b.start_date NULLS LAST, b.created_at DESC`,
            [userId]
        );

        return res.json({
            success: true,
            data: result.rows.map((row) => ({
                ...mapBatch(row),
                myRole: row.member_role,
                myEnrollmentStatus: row.member_status
            }))
        });
    } catch (error) {
        console.error('Training my-batches error:', error);
        return res.status(500).json({ error: 'Failed to load training batches' });
    }
});

router.get('/batches', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const status = trimText(req.query.status, 32).toLowerCase();
        const search = trimText(req.query.search, 120);

        const filters = [];
        const values = [];

        if (BATCH_STATUSES.has(status)) {
            values.push(status);
            filters.push(`b.status = $${values.length}`);
        }

        if (search) {
            values.push(`%${search}%`);
            filters.push(`(b.title ILIKE $${values.length} OR b.code ILIKE $${values.length} OR b.learning_path_id ILIKE $${values.length})`);
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

        const result = await pool.query(
            `SELECT
                b.*,
                COUNT(bm.id)::int AS member_count,
                COUNT(bm.id) FILTER (WHERE bm.role = 'participant')::int AS participant_count,
                COUNT(bm.id) FILTER (WHERE bm.role = 'mentor')::int AS mentor_count,
                COUNT(bm.id) FILTER (WHERE bm.role = 'reviewer')::int AS reviewer_count
             FROM training_batches b
             LEFT JOIN batch_members bm ON bm.batch_id = b.id
             ${whereClause}
             GROUP BY b.id
             ORDER BY
                CASE b.status
                    WHEN 'active' THEN 1
                    WHEN 'draft' THEN 2
                    WHEN 'completed' THEN 3
                    ELSE 4
                END,
                b.start_date NULLS LAST,
                b.created_at DESC`,
            values
        );

        return res.json({
            success: true,
            data: result.rows.map(mapBatch)
        });
    } catch (error) {
        console.error('Training batch list error:', error);
        return res.status(500).json({ error: 'Failed to load training batches' });
    }
});

router.post('/batches', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const title = trimText(req.body.title, 255);
        if (!title) {
            return res.status(400).json({ error: 'Batch title is required' });
        }

        const id = trimText(req.body.id, 120) || generateId('batch');
        const code = normalizeCode(req.body.code) || generateCode(title);
        const learningPathId = trimText(req.body.learningPathId || req.body.learning_path_id, 160) || null;
        const description = trimText(req.body.description, 5000) || null;
        const status = normalizeStatus(req.body.status, BATCH_STATUSES, 'draft');
        const startDate = trimText(req.body.startDate || req.body.start_date, 40) || null;
        const endDate = trimText(req.body.endDate || req.body.end_date, 40) || null;
        const createdBy = getActorId(req);

        const result = await pool.query(
            `INSERT INTO training_batches (
                id,
                code,
                title,
                learning_path_id,
                description,
                start_date,
                end_date,
                status,
                created_by,
                created_at,
                updated_at
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6::date, $7::date, $8, $9,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             RETURNING *`,
            [id, code, title, learningPathId, description, startDate, endDate, status, createdBy]
        );

        return res.status(201).json({
            success: true,
            data: mapBatch(result.rows[0])
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Batch ID or code already exists' });
        }
        console.error('Training batch create error:', error);
        return res.status(500).json({ error: 'Failed to create training batch' });
    }
});

router.get('/batches/:id', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        return res.json({
            success: true,
            data: mapBatch(batch)
        });
    } catch (error) {
        console.error('Training batch detail error:', error);
        return res.status(500).json({ error: 'Failed to load training batch' });
    }
});

router.put('/batches/:id', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const existing = await fetchBatch(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        const title = trimText(req.body.title, 255) || existing.title;
        const code = req.body.code != null ? normalizeCode(req.body.code) : existing.code;
        const learningPathId = req.body.learningPathId != null || req.body.learning_path_id != null
            ? trimText(req.body.learningPathId || req.body.learning_path_id, 160) || null
            : existing.learning_path_id || null;
        const description = req.body.description != null
            ? trimText(req.body.description, 5000) || null
            : existing.description || null;
        const status = req.body.status != null
            ? normalizeStatus(req.body.status, BATCH_STATUSES, existing.status)
            : existing.status;
        const startDate = req.body.startDate != null || req.body.start_date != null
            ? trimText(req.body.startDate || req.body.start_date, 40) || null
            : existing.start_date || null;
        const endDate = req.body.endDate != null || req.body.end_date != null
            ? trimText(req.body.endDate || req.body.end_date, 40) || null
            : existing.end_date || null;

        const result = await pool.query(
            `UPDATE training_batches
             SET
                code = $2,
                title = $3,
                learning_path_id = $4,
                description = $5,
                start_date = $6::date,
                end_date = $7::date,
                status = $8,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [req.params.id, code, title, learningPathId, description, startDate, endDate, status]
        );

        return res.json({
            success: true,
            data: mapBatch(result.rows[0])
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Batch code already exists' });
        }
        console.error('Training batch update error:', error);
        return res.status(500).json({ error: 'Failed to update training batch' });
    }
});

router.get('/batches/:id/members', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        const result = await pool.query(
            `SELECT
                bm.*,
                u.username,
                u.email,
                u.bim_level,
                u.job_role,
                u.organization
             FROM batch_members bm
             INNER JOIN users u ON u.id = bm.user_id
             WHERE bm.batch_id = $1
             ORDER BY
                CASE bm.role
                    WHEN 'mentor' THEN 1
                    WHEN 'reviewer' THEN 2
                    WHEN 'admin' THEN 3
                    WHEN 'participant' THEN 4
                    ELSE 5
                END,
                u.username ASC`,
            [req.params.id]
        );

        return res.json({
            success: true,
            batch: mapBatch(batch),
            data: result.rows.map(mapMember)
        });
    } catch (error) {
        console.error('Training batch members error:', error);
        return res.status(500).json({ error: 'Failed to load batch members' });
    }
});

router.post('/batches/:id/members', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        const payloads = getMemberPayloads(req.body);
        const added = [];
        const skipped = [];

        for (const payload of payloads) {
            const reference = payload.userId || payload.user_id || payload.email || payload.username || payload.identifier;
            const user = await resolveUserReference(reference);

            if (!user) {
                skipped.push({
                    reference: trimText(reference, 255),
                    reason: 'user_not_found'
                });
                continue;
            }

            const role = normalizeStatus(payload.role, MEMBER_ROLES, 'participant');
            const enrollmentStatus = normalizeStatus(
                payload.enrollmentStatus || payload.enrollment_status,
                MEMBER_STATUSES,
                'active'
            );

            const result = await pool.query(
                `INSERT INTO batch_members (
                    batch_id,
                    user_id,
                    role,
                    enrollment_status,
                    joined_at,
                    created_at,
                    updated_at
                 ) VALUES (
                    $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                 )
                 ON CONFLICT (batch_id, user_id) DO UPDATE SET
                    role = EXCLUDED.role,
                    enrollment_status = EXCLUDED.enrollment_status,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [req.params.id, user.id, role, enrollmentStatus]
            );

            added.push(mapMember({
                ...result.rows[0],
                username: user.username,
                email: user.email,
                bim_level: user.bim_level,
                job_role: user.job_role,
                organization: user.organization
            }));
        }

        return res.status(201).json({
            success: true,
            data: added,
            skipped
        });
    } catch (error) {
        console.error('Training batch add member error:', error);
        return res.status(500).json({ error: 'Failed to add batch members' });
    }
});

router.delete('/batches/:id/members/:memberId', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const memberId = toNullableInt(req.params.memberId);
        if (!memberId) {
            return res.status(400).json({ error: 'Invalid member ID' });
        }

        const result = await pool.query(
            `DELETE FROM batch_members
             WHERE id = $1
               AND batch_id = $2
             RETURNING id`,
            [memberId, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Batch member not found' });
        }

        return res.json({
            success: true,
            deletedId: memberId
        });
    } catch (error) {
        console.error('Training batch delete member error:', error);
        return res.status(500).json({ error: 'Failed to delete batch member' });
    }
});

router.get('/batches/:id/training-plan', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        const topicsResult = await pool.query(
            `SELECT
                bt.*,
                COUNT(ci.id)::int AS item_count
             FROM batch_topics bt
             LEFT JOIN classwork_items ci ON ci.topic_id = bt.id
             WHERE bt.batch_id = $1
             GROUP BY bt.id
             ORDER BY bt.sort_order ASC, bt.created_at ASC`,
            [req.params.id]
        );

        const itemsResult = await pool.query(
            `SELECT *
             FROM classwork_items
             WHERE batch_id = $1
             ORDER BY sort_order ASC, due_at NULLS LAST, created_at ASC`,
            [req.params.id]
        );

        const itemsByTopic = new Map();
        const unassignedItems = [];
        itemsResult.rows.map(mapClassworkItem).forEach((item) => {
            if (!item.topicId) {
                unassignedItems.push(item);
                return;
            }
            if (!itemsByTopic.has(item.topicId)) {
                itemsByTopic.set(item.topicId, []);
            }
            itemsByTopic.get(item.topicId).push(item);
        });

        return res.json({
            success: true,
            batch: mapBatch(batch),
            topics: topicsResult.rows.map((row) => ({
                ...mapTopic(row),
                items: itemsByTopic.get(row.id) || []
            })),
            unassignedItems
        });
    } catch (error) {
        console.error('Training plan load error:', error);
        return res.status(500).json({ error: 'Failed to load training plan' });
    }
});

router.post('/batches/:id/topics', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        const title = trimText(req.body.title, 255);
        if (!title) {
            return res.status(400).json({ error: 'Topic title is required' });
        }

        const id = trimText(req.body.id, 120) || generateId('topic');
        const description = trimText(req.body.description, 5000) || null;
        const sortOrder = toNullableInt(req.body.sortOrder ?? req.body.sort_order) || 0;

        const result = await pool.query(
            `INSERT INTO batch_topics (
                id,
                batch_id,
                title,
                description,
                sort_order,
                created_at,
                updated_at
             ) VALUES (
                $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             RETURNING *`,
            [id, req.params.id, title, description, sortOrder]
        );

        return res.status(201).json({
            success: true,
            data: mapTopic(result.rows[0])
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Topic ID already exists' });
        }
        console.error('Training topic create error:', error);
        return res.status(500).json({ error: 'Failed to create training topic' });
    }
});

router.put('/batches/:id/topics/:topicId', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const existing = await fetchTopic(req.params.topicId, req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Training topic not found' });
        }

        const title = trimText(req.body.title, 255) || existing.title;
        const description = req.body.description != null
            ? trimText(req.body.description, 5000) || null
            : existing.description || null;
        const sortOrder = req.body.sortOrder != null || req.body.sort_order != null
            ? toNullableInt(req.body.sortOrder ?? req.body.sort_order) || 0
            : Number(existing.sort_order || 0);

        const result = await pool.query(
            `UPDATE batch_topics
             SET
                title = $3,
                description = $4,
                sort_order = $5,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND batch_id = $2
             RETURNING *`,
            [req.params.topicId, req.params.id, title, description, sortOrder]
        );

        return res.json({
            success: true,
            data: mapTopic(result.rows[0])
        });
    } catch (error) {
        console.error('Training topic update error:', error);
        return res.status(500).json({ error: 'Failed to update training topic' });
    }
});

router.post('/batches/:id/classwork', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        const title = trimText(req.body.title, 255);
        if (!title) {
            return res.status(400).json({ error: 'Classwork title is required' });
        }

        const topicId = trimText(req.body.topicId || req.body.topic_id, 120) || null;
        if (topicId) {
            const topic = await fetchTopic(topicId, req.params.id);
            if (!topic) {
                return res.status(400).json({ error: 'Topic does not belong to this batch' });
            }
        }

        const id = trimText(req.body.id, 120) || generateId('work');
        const type = normalizeStatus(req.body.type, CLASSWORK_TYPES, 'material');
        const instructions = trimText(req.body.instructions, 10000) || null;
        const linkedResourceType = trimText(req.body.linkedResourceType || req.body.linked_resource_type, 80) || null;
        const linkedResourceId = trimText(req.body.linkedResourceId || req.body.linked_resource_id, 255) || null;
        const dueAt = trimText(req.body.dueAt || req.body.due_at, 80) || null;
        const points = toNonNegativeNumber(req.body.points, 0);
        const status = normalizeStatus(req.body.status, CLASSWORK_STATUSES, 'draft');
        const sortOrder = toNullableInt(req.body.sortOrder ?? req.body.sort_order) || 0;
        const createdBy = getActorId(req);

        const result = await pool.query(
            `INSERT INTO classwork_items (
                id,
                batch_id,
                topic_id,
                type,
                title,
                instructions,
                linked_resource_type,
                linked_resource_id,
                due_at,
                points,
                status,
                sort_order,
                created_by,
                created_at,
                updated_at
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9::timestamptz, $10,
                $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             RETURNING *`,
            [
                id,
                req.params.id,
                topicId,
                type,
                title,
                instructions,
                linkedResourceType,
                linkedResourceId,
                dueAt,
                points,
                status,
                sortOrder,
                createdBy
            ]
        );

        return res.status(201).json({
            success: true,
            data: mapClassworkItem(result.rows[0])
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Classwork ID already exists' });
        }
        console.error('Training classwork create error:', error);
        return res.status(500).json({ error: 'Failed to create classwork item' });
    }
});

router.put('/batches/:id/classwork/:itemId', requireAdmin, async (req, res) => {
    try {
        await ensureTables();

        const existing = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        const topicId = req.body.topicId != null || req.body.topic_id != null
            ? trimText(req.body.topicId || req.body.topic_id, 120) || null
            : existing.topic_id || null;

        if (topicId) {
            const topic = await fetchTopic(topicId, req.params.id);
            if (!topic) {
                return res.status(400).json({ error: 'Topic does not belong to this batch' });
            }
        }

        const type = req.body.type != null
            ? normalizeStatus(req.body.type, CLASSWORK_TYPES, existing.type)
            : existing.type;
        const title = trimText(req.body.title, 255) || existing.title;
        const instructions = req.body.instructions != null
            ? trimText(req.body.instructions, 10000) || null
            : existing.instructions || null;
        const linkedResourceType = req.body.linkedResourceType != null || req.body.linked_resource_type != null
            ? trimText(req.body.linkedResourceType || req.body.linked_resource_type, 80) || null
            : existing.linked_resource_type || null;
        const linkedResourceId = req.body.linkedResourceId != null || req.body.linked_resource_id != null
            ? trimText(req.body.linkedResourceId || req.body.linked_resource_id, 255) || null
            : existing.linked_resource_id || null;
        const dueAt = req.body.dueAt != null || req.body.due_at != null
            ? trimText(req.body.dueAt || req.body.due_at, 80) || null
            : existing.due_at || null;
        const points = req.body.points != null
            ? toNonNegativeNumber(req.body.points, 0)
            : Number(existing.points || 0);
        const status = req.body.status != null
            ? normalizeStatus(req.body.status, CLASSWORK_STATUSES, existing.status)
            : existing.status;
        const sortOrder = req.body.sortOrder != null || req.body.sort_order != null
            ? toNullableInt(req.body.sortOrder ?? req.body.sort_order) || 0
            : Number(existing.sort_order || 0);

        const result = await pool.query(
            `UPDATE classwork_items
             SET
                topic_id = $3,
                type = $4,
                title = $5,
                instructions = $6,
                linked_resource_type = $7,
                linked_resource_id = $8,
                due_at = $9::timestamptz,
                points = $10,
                status = $11,
                sort_order = $12,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND batch_id = $2
             RETURNING *`,
            [
                req.params.itemId,
                req.params.id,
                topicId,
                type,
                title,
                instructions,
                linkedResourceType,
                linkedResourceId,
                dueAt,
                points,
                status,
                sortOrder
            ]
        );

        return res.json({
            success: true,
            data: mapClassworkItem(result.rows[0])
        });
    } catch (error) {
        console.error('Training classwork update error:', error);
        return res.status(500).json({ error: 'Failed to update classwork item' });
    }
});

router.get('/batches/:id/classwork/:itemId/submission', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const userId = toNullableInt(req.authUser && req.authUser.id);
        if (!userId) {
            return res.status(403).json({ error: 'Authenticated user is required' });
        }

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        const submission = await fetchSubmission(req.params.itemId, userId);
        if (!submission) {
            return res.json({
                success: true,
                classwork: mapClassworkItem(item),
                data: null,
                status: deriveSubmissionStatus(item, null)
            });
        }

        const filesBySubmission = await fetchSubmissionFiles([submission.id]);
        const data = mapSubmission(submission);
        data.files = filesBySubmission.get(submission.id) || [];

        return res.json({
            success: true,
            classwork: mapClassworkItem(item),
            data,
            status: data.status
        });
    } catch (error) {
        console.error('Training submission detail error:', error);
        return res.status(500).json({ error: 'Failed to load submission' });
    }
});

router.post('/batches/:id/classwork/:itemId/submission', requireAuthenticated, requireBatchAccess, async (req, res) => {
    const client = await pool.connect();

    try {
        await ensureTables();

        const userId = toNullableInt(req.authUser && req.authUser.id);
        if (!userId) {
            return res.status(403).json({ error: 'Authenticated user is required' });
        }

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        if (item.type !== 'practice_task') {
            return res.status(400).json({ error: 'Submission is only available for practice task items' });
        }

        if (item.status === 'draft' || item.status === 'archived') {
            return res.status(400).json({ error: 'Practice task is not open for submission' });
        }

        const member = await fetchBatchMember(req.params.id, userId);
        if (!member || member.role !== 'participant') {
            return res.status(403).json({ error: 'Only participants can submit practice tasks' });
        }

        const files = normalizeSubmissionFiles(req.body);
        if (files.length === 0) {
            return res.status(400).json({ error: 'Submission evidence link or file path is required' });
        }

        const note = trimText(req.body.note || req.body.comment || req.body.feedback, 5000);
        const metadata = {
            ...normalizeMetadata(req.body.metadata),
            ...(note ? { note } : {})
        };
        const status = item.due_at && new Date(item.due_at).getTime() < Date.now()
            ? 'late'
            : 'submitted';

        await client.query('BEGIN');

        const submissionId = trimText(req.body.id, 120) || generateId('sub');
        const submissionResult = await client.query(
            `INSERT INTO assignment_submissions (
                id,
                classwork_item_id,
                user_id,
                status,
                submitted_at,
                metadata,
                created_at,
                updated_at
             ) VALUES (
                $1, $2, $3, $4, CURRENT_TIMESTAMP, $5::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             ON CONFLICT (classwork_item_id, user_id) DO UPDATE SET
                status = EXCLUDED.status,
                submitted_at = CURRENT_TIMESTAMP,
                returned_at = NULL,
                score = NULL,
                feedback_summary = NULL,
                metadata = EXCLUDED.metadata,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                submissionId,
                req.params.itemId,
                userId,
                status,
                JSON.stringify(metadata)
            ]
        );

        const submission = submissionResult.rows[0];

        await client.query(
            `DELETE FROM submission_files
             WHERE submission_id = $1`,
            [submission.id]
        );

        for (const file of files) {
            await client.query(
                `INSERT INTO submission_files (
                    id,
                    submission_id,
                    file_path,
                    external_url,
                    file_name,
                    file_type,
                    file_size,
                    uploaded_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
                 )`,
                [
                    file.id,
                    submission.id,
                    file.filePath,
                    file.externalUrl,
                    file.fileName,
                    file.fileType,
                    file.fileSize
                ]
            );
        }

        await client.query('COMMIT');

        const filesBySubmission = await fetchSubmissionFiles([submission.id]);
        const data = mapSubmission({
            ...submission,
            username: member.username,
            email: member.email,
            bim_level: member.bim_level,
            job_role: member.job_role
        });
        data.files = filesBySubmission.get(submission.id) || [];

        return res.status(201).json({
            success: true,
            classwork: mapClassworkItem(item),
            data
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.warn('Training submission rollback failed:', rollbackError.message);
        }
        console.error('Training submission create error:', error);
        return res.status(500).json({ error: 'Failed to submit practice task' });
    } finally {
        client.release();
    }
});

router.get('/batches/:id/classwork/:itemId/submissions', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Submission review access denied' });
        }

        const statusFilter = normalizeStatus(req.query.status, SUBMISSION_STATUSES, '');
        const result = await pool.query(
            `SELECT
                bm.user_id AS participant_user_id,
                u.username,
                u.email,
                u.bim_level,
                u.job_role,
                s.id AS submission_id,
                s.classwork_item_id,
                s.user_id,
                s.status,
                s.submitted_at,
                s.returned_at,
                s.score,
                s.feedback_summary,
                s.metadata,
                s.created_at,
                s.updated_at
             FROM batch_members bm
             INNER JOIN users u ON u.id = bm.user_id
             LEFT JOIN assignment_submissions s
                ON s.classwork_item_id = $2
               AND s.user_id = bm.user_id
             WHERE bm.batch_id = $1
               AND bm.role = 'participant'
               AND bm.enrollment_status <> 'dropped'
             ORDER BY
                CASE
                    WHEN s.status IS NULL THEN 2
                    WHEN s.status IN ('submitted', 'late') THEN 1
                    ELSE 3
                END,
                s.submitted_at DESC NULLS LAST,
                u.username ASC`,
            [req.params.id, req.params.itemId]
        );

        const submissionIds = result.rows
            .map((row) => row.submission_id)
            .filter(Boolean);
        const filesBySubmission = await fetchSubmissionFiles(submissionIds);

        let data = result.rows.map((row) => {
            const derivedStatus = row.submission_id
                ? row.status
                : deriveSubmissionStatus(item, null);

            const submission = row.submission_id
                ? mapSubmission({
                    id: row.submission_id,
                    classwork_item_id: row.classwork_item_id,
                    user_id: row.user_id,
                    username: row.username,
                    email: row.email,
                    bim_level: row.bim_level,
                    job_role: row.job_role,
                    status: row.status,
                    submitted_at: row.submitted_at,
                    returned_at: row.returned_at,
                    score: row.score,
                    feedback_summary: row.feedback_summary,
                    metadata: row.metadata,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                })
                : null;

            if (submission) {
                submission.files = filesBySubmission.get(row.submission_id) || [];
            }

            return {
                userId: Number(row.participant_user_id),
                username: row.username || null,
                email: row.email || null,
                bimLevel: row.bim_level || null,
                jobRole: row.job_role || null,
                status: derivedStatus,
                submission
            };
        });

        if (statusFilter) {
            data = data.filter((entry) => entry.status === statusFilter);
        }

        return res.json({
            success: true,
            classwork: mapClassworkItem(item),
            data
        });
    } catch (error) {
        console.error('Training submission list error:', error);
        return res.status(500).json({ error: 'Failed to load submissions' });
    }
});

router.get('/batches/:id/classwork/:itemId/review-criteria', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        const criteria = await fetchReviewCriteria(req.params.id, req.params.itemId);
        return res.json({
            success: true,
            classwork: mapClassworkItem(item),
            data: criteria.map(mapReviewCriterion)
        });
    } catch (error) {
        console.error('Training review criteria list error:', error);
        return res.status(500).json({ error: 'Failed to load review criteria' });
    }
});

router.post('/batches/:id/classwork/:itemId/review-criteria', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Review criteria access denied' });
        }

        const payloads = Array.isArray(req.body?.criteria) ? req.body.criteria : [req.body || {}];
        const created = [];

        for (const payload of payloads.slice(0, 50)) {
            const title = trimText(payload.title || payload.criterionTitle || payload.criterion_title, 255);
            if (!title) continue;

            const id = trimText(payload.id, 120) || generateId('crit');
            const result = await pool.query(
                `INSERT INTO review_criteria (
                    id,
                    batch_id,
                    classwork_item_id,
                    template_id,
                    title,
                    description,
                    max_score,
                    weight,
                    sort_order,
                    created_by,
                    created_at,
                    updated_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                 )
                 ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    max_score = EXCLUDED.max_score,
                    weight = EXCLUDED.weight,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [
                    id,
                    req.params.id,
                    req.params.itemId,
                    trimText(payload.templateId || payload.template_id, 120) || null,
                    title,
                    trimText(payload.description, 2000) || null,
                    toNullableScore(payload.maxScore ?? payload.max_score) || 100,
                    toNonNegativeNumber(payload.weight, 1) || 1,
                    Number.isFinite(Number(payload.sortOrder ?? payload.sort_order))
                        ? Number(payload.sortOrder ?? payload.sort_order)
                        : created.length,
                    getActorId(req)
                ]
            );
            created.push(mapReviewCriterion(result.rows[0]));
        }

        if (created.length === 0) {
            return res.status(400).json({ error: 'At least one review criterion title is required' });
        }

        return res.status(201).json({
            success: true,
            classwork: mapClassworkItem(item),
            data: created
        });
    } catch (error) {
        console.error('Training review criteria create error:', error);
        return res.status(500).json({ error: 'Failed to save review criteria' });
    }
});

router.get('/batches/:id/classwork/:itemId/submissions/:submissionId/review', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Submission review access denied' });
        }

        const detail = await fetchSubmissionReviewDetail(req.params.submissionId, req.params.id, req.params.itemId, true);
        if (!detail) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        return res.json({
            success: true,
            classwork: mapClassworkItem(item),
            ...detail
        });
    } catch (error) {
        console.error('Training submission review detail error:', error);
        return res.status(500).json({ error: 'Failed to load submission review' });
    }
});

router.get('/batches/:id/classwork/:itemId/submission/review', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const userId = toNullableInt(req.authUser && req.authUser.id);
        if (!userId) {
            return res.status(403).json({ error: 'Authenticated user is required' });
        }

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        const submission = await fetchSubmission(req.params.itemId, userId);
        if (!submission) {
            return res.json({
                success: true,
                status: deriveSubmissionStatus(item, null),
                classwork: mapClassworkItem(item),
                submission: null,
                criteria: [],
                scores: [],
                comments: []
            });
        }

        const detail = await fetchSubmissionReviewDetail(submission.id, req.params.id, req.params.itemId, false);
        return res.json({
            success: true,
            classwork: mapClassworkItem(item),
            ...detail
        });
    } catch (error) {
        console.error('Training own submission review error:', error);
        return res.status(500).json({ error: 'Failed to load submission review' });
    }
});

router.post('/batches/:id/classwork/:itemId/submissions/:submissionId/review', requireAuthenticated, requireBatchAccess, async (req, res) => {
    const client = await pool.connect();

    try {
        await ensureTables();

        const item = await fetchClassworkItem(req.params.itemId, req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Classwork item not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Submission review access denied' });
        }

        const submission = await fetchSubmissionById(req.params.submissionId, req.params.itemId);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const scorePayloads = normalizeReviewScorePayloads(req.body);
        const reviewStatus = normalizeStatus(req.body.status, REVIEW_RESULT_STATUSES, 'reviewed');
        const feedbackSummary = trimText(req.body.feedbackSummary || req.body.feedback_summary || req.body.feedback || '', 5000);
        const commentBody = trimText(req.body.comment || req.body.reviewComment || req.body.review_comment, 5000);
        const actorId = getActorId(req);

        await client.query('BEGIN');

        for (const score of scorePayloads) {
            if (score.criterionId) {
                const existingCriterion = await client.query(
                    `SELECT id
                     FROM review_criteria
                     WHERE id = $1
                       AND batch_id = $2
                       AND (classwork_item_id = $3 OR classwork_item_id IS NULL)
                     LIMIT 1`,
                    [score.criterionId, req.params.id, req.params.itemId]
                );
                if (existingCriterion.rows.length === 0) {
                    const error = new Error(`Review criterion not found: ${score.criterionId}`);
                    error.statusCode = 400;
                    throw error;
                }
            } else {
                const criterionResult = await client.query(
                    `INSERT INTO review_criteria (
                        id,
                        batch_id,
                        classwork_item_id,
                        title,
                        description,
                        max_score,
                        weight,
                        sort_order,
                        created_by,
                        created_at,
                        updated_at
                     ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                     )
                     RETURNING *`,
                    [
                        generateId('crit'),
                        req.params.id,
                        req.params.itemId,
                        score.title,
                        score.description || null,
                        score.maxScore,
                        score.weight,
                        score.sortOrder,
                        actorId
                    ]
                );
                score.criterionId = criterionResult.rows[0].id;
            }

            await client.query(
                `INSERT INTO review_scores (
                    id,
                    submission_id,
                    criterion_id,
                    score,
                    comment,
                    reviewed_by,
                    reviewed_at,
                    updated_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                 )
                 ON CONFLICT (submission_id, criterion_id) DO UPDATE SET
                    score = EXCLUDED.score,
                    comment = EXCLUDED.comment,
                    reviewed_by = EXCLUDED.reviewed_by,
                    reviewed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    generateId('rscore'),
                    req.params.submissionId,
                    score.criterionId,
                    score.score,
                    score.comment || null,
                    actorId
                ]
            );
        }

        const criteriaResult = await client.query(
            `SELECT *
             FROM review_criteria
             WHERE batch_id = $1
               AND (classwork_item_id = $2 OR classwork_item_id IS NULL)`,
            [req.params.id, req.params.itemId]
        );

        const totalScore = scorePayloads.length
            ? calculateReviewTotalScore(criteriaResult.rows, scorePayloads, item.points)
            : toNullableScore(req.body.score);

        const updatedSubmission = await client.query(
            `UPDATE assignment_submissions
             SET
                status = $2,
                score = COALESCE($3, score),
                feedback_summary = $4,
                returned_at = CASE WHEN $2 = 'returned' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [
                req.params.submissionId,
                reviewStatus,
                totalScore,
                feedbackSummary || submission.feedback_summary || ''
            ]
        );

        if (commentBody) {
            await client.query(
                `INSERT INTO submission_comments (
                    id,
                    submission_id,
                    sender_user_id,
                    visibility,
                    body,
                    created_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, CURRENT_TIMESTAMP
                 )`,
                [
                    generateId('scomment'),
                    req.params.submissionId,
                    actorId,
                    normalizeStatus(req.body.visibility, new Set(['participant', 'internal']), 'participant'),
                    commentBody
                ]
            );
        }

        await client.query('COMMIT');

        const detail = await fetchSubmissionReviewDetail(req.params.submissionId, req.params.id, req.params.itemId, true);
        return res.json({
            success: true,
            classwork: mapClassworkItem(item),
            data: mapSubmission(updatedSubmission.rows[0]),
            ...detail
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.warn('Training review rollback failed:', rollbackError.message);
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }

        console.error('Training submission review save error:', error);
        return res.status(500).json({ error: 'Failed to save submission review' });
    } finally {
        client.release();
    }
});

router.get('/batches/:id/evaluation', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch evaluation access denied' });
        }

        const data = await fetchBatchEvaluationRows(req.params.id);
        const summary = {
            participantCount: data.length,
            completedCount: data.filter((row) => ['completed', 'passed'].includes(row.finalStatus)).length,
            needsRevisionCount: data.filter((row) => row.finalStatus === 'needs_revision').length,
            failedCount: data.filter((row) => row.finalStatus === 'failed').length,
            averageScore: data.length
                ? Math.round((data.reduce((total, row) => total + Number(row.finalScore || 0), 0) / data.length) * 100) / 100
                : null
        };

        return res.json({
            success: true,
            batch: mapBatch(batch),
            summary,
            data
        });
    } catch (error) {
        console.error('Training batch evaluation error:', error);
        return res.status(500).json({ error: 'Failed to load batch evaluation' });
    }
});

router.put('/batches/:id/evaluation/:userId', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch evaluation access denied' });
        }

        const userId = toNullableInt(req.params.userId);
        if (!userId) {
            return res.status(400).json({ error: 'Invalid participant user ID' });
        }

        const member = await fetchBatchMember(req.params.id, userId);
        if (!member || member.role !== 'participant') {
            return res.status(404).json({ error: 'Participant not found in batch' });
        }

        const finalStatus = normalizeStatus(req.body.finalStatus || req.body.final_status || req.body.status, EVALUATION_STATUSES, 'in_progress');
        const finalScore = toNullableScore(req.body.finalScore ?? req.body.final_score ?? req.body.score);
        const note = trimText(req.body.note, 5000);
        const actorId = getActorId(req);
        const evaluationId = trimText(req.body.id, 120) || generateId('beval');

        const result = await pool.query(
            `INSERT INTO batch_evaluations (
                id,
                batch_id,
                user_id,
                final_status,
                final_score,
                evaluator_id,
                note,
                evaluated_at,
                created_at,
                updated_at
             ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             )
             ON CONFLICT (batch_id, user_id) DO UPDATE SET
                final_status = EXCLUDED.final_status,
                final_score = EXCLUDED.final_score,
                evaluator_id = EXCLUDED.evaluator_id,
                note = EXCLUDED.note,
                evaluated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                evaluationId,
                req.params.id,
                userId,
                finalStatus,
                finalScore,
                actorId,
                note
            ]
        );

        return res.json({
            success: true,
            batch: mapBatch(batch),
            data: mapBatchEvaluation(result.rows[0])
        });
    } catch (error) {
        console.error('Training batch evaluation save error:', error);
        return res.status(500).json({ error: 'Failed to save batch evaluation' });
    }
});

router.get('/batches/:id/evaluation/export.csv', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch evaluation export access denied' });
        }

        const data = await fetchBatchEvaluationRows(req.params.id);
        const csv = buildEvaluationCsv(data);
        const fileSafeCode = normalizeCode(batch.code || batch.id || 'BATCH-EVALUATION') || 'BATCH-EVALUATION';

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileSafeCode}-evaluation.csv"`);
        return res.send(csv);
    } catch (error) {
        console.error('Training batch evaluation export error:', error);
        return res.status(500).json({ error: 'Failed to export batch evaluation' });
    }
});

router.get('/batches/:id/readiness', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch readiness access denied' });
        }

        const evaluationRows = await fetchBatchEvaluationRows(req.params.id);
        const readinessRows = buildReadinessRows(evaluationRows);
        const skillGaps = await fetchBatchSkillGaps(req.params.id);
        const atRiskRows = readinessRows.filter((row) => row.needsIntervention);
        const scoredRows = readinessRows.filter((row) => row.finalScore != null);
        const summary = {
            participantCount: readinessRows.length,
            readyCount: readinessRows.filter((row) => row.readinessLevel === 'ready').length,
            onTrackCount: readinessRows.filter((row) => row.readinessLevel === 'on_track').length,
            inProgressCount: readinessRows.filter((row) => row.readinessLevel === 'in_progress').length,
            atRiskCount: readinessRows.filter((row) => row.readinessLevel === 'at_risk').length,
            blockedCount: readinessRows.filter((row) => row.readinessLevel === 'blocked').length,
            averageScore: scoredRows.length
                ? Math.round((scoredRows.reduce((total, row) => total + Number(row.finalScore || 0), 0) / scoredRows.length) * 100) / 100
                : null,
            readinessPercent: readinessRows.length
                ? Math.round((readinessRows.filter((row) => row.readinessLevel === 'ready').length / readinessRows.length) * 10000) / 100
                : 0
        };

        return res.json({
            success: true,
            batch: mapBatch(batch),
            summary,
            atRisk: atRiskRows,
            roleReadiness: buildRoleReadiness(readinessRows),
            skillGaps,
            data: readinessRows
        });
    } catch (error) {
        console.error('Training batch readiness error:', error);
        return res.status(500).json({ error: 'Failed to load batch readiness' });
    }
});

router.get('/batches/:id/attendance', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch attendance access denied' });
        }

        const [participants, sessions] = await Promise.all([
            fetchBatchParticipants(req.params.id),
            fetchAttendanceSessions(req.params.id)
        ]);

        return res.json({
            success: true,
            batch: mapBatch(batch),
            participants,
            sessions,
            summary: {
                participantCount: participants.length,
                sessionCount: sessions.length,
                recordedSessionCount: sessions.filter((session) => Number(session.recordCount || 0) > 0).length
            }
        });
    } catch (error) {
        console.error('Training attendance list error:', error);
        return res.status(500).json({ error: 'Failed to load batch attendance' });
    }
});

router.post('/batches/:id/attendance/sessions', requireAuthenticated, requireBatchAccess, async (req, res) => {
    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch attendance access denied' });
        }

        const title = trimText(req.body.title, 255);
        if (!title) {
            return res.status(400).json({ error: 'Attendance session title is required' });
        }

        const id = trimText(req.body.id, 120) || generateId('asession');
        const scheduledAt = trimText(req.body.scheduledAt || req.body.scheduled_at, 80) || null;
        const meetingUrl = normalizeExternalUrl(req.body.meetingUrl || req.body.meeting_url) || trimText(req.body.meetingUrl || req.body.meeting_url, 2048) || null;

        const result = await pool.query(
            `INSERT INTO attendance_sessions (
                id,
                batch_id,
                title,
                scheduled_at,
                meeting_url,
                created_at
             ) VALUES (
                $1, $2, $3, $4::timestamptz, $5, CURRENT_TIMESTAMP
             )
             RETURNING *`,
            [id, req.params.id, title, scheduledAt, meetingUrl]
        );

        return res.status(201).json({
            success: true,
            batch: mapBatch(batch),
            data: mapAttendanceSession(result.rows[0])
        });
    } catch (error) {
        console.error('Training attendance session create error:', error);
        return res.status(500).json({ error: 'Failed to create attendance session' });
    }
});

router.put('/batches/:id/attendance/sessions/:sessionId/records', requireAuthenticated, requireBatchAccess, async (req, res) => {
    const client = await pool.connect();

    try {
        await ensureTables();

        const batch = await fetchBatch(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Training batch not found' });
        }

        if (!(await canReviewBatch(req, req.params.id))) {
            return res.status(403).json({ error: 'Batch attendance access denied' });
        }

        const sessionResult = await pool.query(
            `SELECT *
             FROM attendance_sessions
             WHERE id = $1
               AND batch_id = $2
             LIMIT 1`,
            [req.params.sessionId, req.params.id]
        );
        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Attendance session not found' });
        }

        const records = Array.isArray(req.body.records) ? req.body.records : [];
        if (records.length === 0) {
            return res.status(400).json({ error: 'Attendance records are required' });
        }

        const actorId = getActorId(req);
        const saved = [];

        await client.query('BEGIN');

        for (const record of records.slice(0, 500)) {
            const userId = toNullableInt(record.userId || record.user_id);
            if (!userId) continue;

            const member = await fetchBatchMember(req.params.id, userId);
            if (!member || member.role !== 'participant') continue;

            const status = normalizeStatus(record.status, ATTENDANCE_STATUSES, 'present');
            const note = trimText(record.note, 2000);
            const recordId = trimText(record.id, 120) || generateId('arecord');

            const result = await client.query(
                `INSERT INTO attendance_records (
                    id,
                    session_id,
                    user_id,
                    status,
                    note,
                    updated_by,
                    updated_at
                 ) VALUES (
                    $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP
                 )
                 ON CONFLICT (session_id, user_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    note = EXCLUDED.note,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [recordId, req.params.sessionId, userId, status, note, actorId]
            );
            saved.push(mapAttendanceRecord({
                ...result.rows[0],
                username: member.username,
                email: member.email
            }));
        }

        await client.query('COMMIT');

        return res.json({
            success: true,
            batch: mapBatch(batch),
            session: mapAttendanceSession(sessionResult.rows[0]),
            data: saved
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.warn('Training attendance rollback failed:', rollbackError.message);
        }
        console.error('Training attendance record save error:', error);
        return res.status(500).json({ error: 'Failed to save attendance records' });
    } finally {
        client.release();
    }
});

module.exports = router;
