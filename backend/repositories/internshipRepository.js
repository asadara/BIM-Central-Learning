const crypto = require('node:crypto');

function createInternshipRepository({ pgPool, revisionsEnabled = false, completionEnabled = false }) {
    if (!pgPool || typeof pgPool.query !== 'function') throw new Error('pgPool is required');

    async function listEnrollments(userId) {
        const result = await pgPool.query(
            `SELECT
                b.id, b.code, b.title, b.description, b.start_date AS "startDate",
                b.end_date AS "endDate", b.status, b.program_type AS "programType",
                bm.role, bm.enrollment_status AS "enrollmentStatus",
                actor_user.username AS "participantDisplayName",
                lp.id AS "learningPathId", lp.title AS "learningPathTitle",
                lpv.id::text AS "learningPathVersionId", lpv.version_number AS "versionNumber"
             FROM batch_members bm
             INNER JOIN training_batches b ON b.id = bm.batch_id
             INNER JOIN users actor_user ON actor_user.id = bm.user_id
             INNER JOIN internship_batch_config ibc ON ibc.batch_id = b.id
             INNER JOIN learning_path_versions lpv ON lpv.id = ibc.learning_path_version_id
             INNER JOIN learning_paths lp ON lp.id = lpv.learning_path_id
             WHERE bm.user_id = $1
               AND bm.enrollment_status <> 'dropped'
               AND b.program_type = 'internship'
               AND lpv.status = 'published'
               AND (bm.role <> 'participant' OR b.status IN ('active', 'completed'))
             ORDER BY b.start_date NULLS LAST, b.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async function getBatchContext(batchId, userId) {
        const result = await pgPool.query(
            `SELECT
                b.id, b.code, b.title, b.description, b.start_date AS "startDate",
                b.end_date AS "endDate", b.status, b.program_type AS "programType",
                bm.role, bm.enrollment_status AS "enrollmentStatus",
                actor_user.username AS "participantDisplayName",
                ${completionEnabled ? 'ipv.payload_json' : 'ibc.policy_json'} AS policy,
                lp.id AS "learningPathId", lp.title AS "learningPathTitle",
                lp.level AS "learningPathLevel",
                lpv.id::text AS "learningPathVersionId", lpv.version_number AS "versionNumber",
                lpv.status AS "versionStatus", lpv.definition AS "versionDefinition",
                lpv.published_at AS "publishedAt"
             FROM training_batches b
             INNER JOIN internship_batch_config ibc ON ibc.batch_id = b.id
             ${completionEnabled ? 'INNER JOIN internship_program_policy_versions ipv ON ipv.id = ibc.policy_version_id' : ''}
             INNER JOIN learning_path_versions lpv ON lpv.id = ibc.learning_path_version_id
             INNER JOIN learning_paths lp ON lp.id = lpv.learning_path_id
             INNER JOIN users actor_user ON actor_user.id = $2
             LEFT JOIN batch_members bm
               ON bm.batch_id = b.id
              AND bm.user_id = $2
              AND bm.enrollment_status <> 'dropped'
             WHERE b.id = $1
               AND b.program_type = 'internship'
             LIMIT 1`,
            [batchId, userId]
        );
        return result.rows[0] || null;
    }

    async function listMentors(batchId) {
        const result = await pgPool.query(
            `SELECT u.username AS "displayName", bm.role
             FROM batch_members bm
             INNER JOIN users u ON u.id = bm.user_id
             WHERE bm.batch_id = $1
               AND bm.role IN ('mentor', 'reviewer')
               AND bm.enrollment_status <> 'dropped'
             ORDER BY CASE bm.role WHEN 'mentor' THEN 1 ELSE 2 END, u.username`,
            [batchId]
        );
        return result.rows;
    }

    async function getPathModules(pathVersionId, queryable = pgPool) {
        const result = await queryable.query(
            `SELECT
                lpm.id::text AS id,
                lpm.stable_module_key AS "moduleKey",
                lpm.title,
                lpm.outcome,
                lpm.sequence_number AS "sequenceNumber",
                lpm.status,
                lpm.definition,
                COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'mappingId', mcm.id::text,
                        'contentId', lcr.content_id,
                        'sourceType', lcr.source_type,
                        'sourceId', lcr.source_id,
                        'sourceLocator', lcr.source_locator,
                        'titleOverride', lcr.title_override,
                        'contentStatus', lcr.status,
                        'sequenceNumber', mcm.sequence_number,
                        'requirementType', mcm.requirement_type,
                        'completionRule', mcm.completion_rule,
                        'mappingStatus', mcm.mapping_status
                    ) ORDER BY mcm.sequence_number
                ) FILTER (WHERE mcm.id IS NOT NULL), '[]'::jsonb) AS items
             FROM learning_path_modules lpm
             LEFT JOIN module_content_mappings mcm ON mcm.module_id = lpm.id
             LEFT JOIN learning_content_registry lcr ON lcr.content_id = mcm.content_id
             WHERE lpm.path_version_id = $1::uuid
             GROUP BY lpm.id
             ORDER BY lpm.sequence_number`,
            [pathVersionId]
        );
        return result.rows;
    }

    async function getCompletedActivityEvidence(userId, queryable = pgPool) {
        const result = await queryable.query(
            `SELECT DISTINCT module_type AS "moduleType", module_id AS "moduleId"
             FROM learning_activity_events
             WHERE user_id = $1::text
               AND event_type = 'completed'`,
            [userId]
        );
        return result.rows;
    }

    async function getVerifiedQuizEvidence(userId, quizIds, queryable = pgPool) {
        if (!Array.isArray(quizIds) || quizIds.length === 0) return [];
        const result = await queryable.query(
            `SELECT quiz_id AS "quizId", MAX(percentage)::int AS "bestPercentage"
             FROM learning_attempts
             WHERE user_id = $1
               AND quiz_id = ANY($2::text[])
               AND is_verified = true
               AND passed = true
             GROUP BY quiz_id`,
            [userId, quizIds]
        );
        return result.rows;
    }

    async function listParticipantAssignments(batchId, assignmentId = null) {
        const result = await pgPool.query(
            `SELECT
                ci.id, ci.batch_id AS "batchId", ci.topic_id AS "topicId",
                ci.title, ci.instructions AS brief,
                ci.available_at AS "availableAt", ci.due_at AS "dueAt",
                ci.required_deliverable AS "requiredDeliverable",
                ci.status, ci.sort_order AS "sortOrder",
                bt.title AS "topicTitle", bt.description AS "topicDescription",
                bt.sort_order AS "topicSortOrder"
             FROM classwork_items ci
             LEFT JOIN batch_topics bt
               ON bt.id = ci.topic_id
              AND bt.batch_id = ci.batch_id
             WHERE ci.batch_id = $1
               AND ci.type = 'practice_task'
               AND ci.status IN ('published', 'closed')
               AND ci.participant_visibility = 'visible'
               AND ($2::text IS NULL OR ci.id = $2)
             ORDER BY
                bt.sort_order ASC NULLS LAST,
                ci.sort_order ASC,
                ci.available_at NULLS FIRST,
                ci.created_at ASC`,
            [batchId, assignmentId]
        );
        return result.rows;
    }

    async function listAssignmentLearningLinks(classworkIds) {
        const ids = Array.isArray(classworkIds) ? classworkIds.map(String).filter(Boolean) : [];
        if (ids.length === 0) return [];
        const result = await pgPool.query(
            `SELECT
                ccl.classwork_id AS "classworkId",
                ccl.content_id AS "contentId",
                ccl.quiz_id AS "quizId",
                ccl.relationship_type AS relationship,
                lcr.status AS "contentStatus"
             FROM classwork_content_links ccl
             LEFT JOIN learning_content_registry lcr ON lcr.content_id = ccl.content_id
             WHERE ccl.classwork_id = ANY($1::text[])
             ORDER BY
                CASE ccl.relationship_type WHEN 'prerequisite' THEN 1 ELSE 2 END,
                ccl.id ASC`,
            [ids]
        );
        return result.rows;
    }

    async function withTransaction(operation) {
        if (typeof pgPool.connect !== 'function') throw new Error('Transactional PostgreSQL pool is required');
        const client = await pgPool.connect();
        try {
            await client.query('BEGIN');
            const result = await operation(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    async function findParticipantSubmission(queryable, batchId, assignmentId, userId, forUpdate = false) {
        const result = await queryable.query(
            `SELECT
                s.id, s.classwork_item_id AS "assignmentId", s.user_id AS "participantUserId",
                s.status, s.submitted_at AS "submittedAt", s.withdrawn_at AS "withdrawnAt",
                s.metadata, s.created_at AS "createdAt", s.updated_at AS "updatedAt"
                ${revisionsEnabled ? ', s.submission_revision AS "submissionRevision"' : ''}
             FROM assignment_submissions s
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             WHERE ci.batch_id = $1
               AND s.classwork_item_id = $2
               AND s.user_id = $3
             LIMIT 1${forUpdate ? ' FOR UPDATE OF s' : ''}`,
            [batchId, assignmentId, userId]
        );
        return result.rows[0] || null;
    }

    async function getParticipantSubmission(batchId, assignmentId, userId) {
        return findParticipantSubmission(pgPool, batchId, assignmentId, userId);
    }

    async function listSubmissionEvidence(batchId, assignmentId, submissionId, userId) {
        const result = await pgPool.query(
            `SELECT
                sf.id AS "evidenceId", sf.submission_id AS "submissionId",
                sf.original_file_name AS "originalFileName",
                sf.safe_display_name AS "safeDisplayName",
                sf.mime_type AS "mimeType", sf.file_size AS "sizeBytes", sf.sha256,
                sf.uploaded_at AS "uploadedAt", sf.uploaded_by_user_id AS "uploadedByUserId",
                sf.classification, sf.scan_status AS "scanStatus", sf.storage_status AS "storageStatus"
             FROM submission_files sf
             INNER JOIN assignment_submissions s ON s.id = sf.submission_id
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             WHERE ci.batch_id = $1
               AND s.classwork_item_id = $2
               AND s.id = $3
               AND s.user_id = $4
               AND sf.removed_at IS NULL
               ${revisionsEnabled ? 'AND sf.submission_revision = s.submission_revision' : ''}
             ORDER BY sf.uploaded_at ASC, sf.id ASC`,
            [batchId, assignmentId, submissionId, userId]
        );
        return result.rows;
    }

    async function appendStatusHistory(queryable, submissionId, fromStatus, toStatus, userId) {
        await queryable.query(
            `INSERT INTO submission_status_history (
                submission_id, from_status, to_status, changed_by_user_id, changed_at
             ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [submissionId, fromStatus, toStatus, userId]
        );
    }

    async function createOrResumeDraft(batchId, assignmentId, userId, allowResume) {
        return withTransaction(async (client) => {
            let submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            if (submission) {
                if (submission.status === 'draft') return { submission, outcome: 'existing' };
                if (submission.status === 'withdrawn' && allowResume) {
                    const updated = await client.query(
                        `UPDATE assignment_submissions
                         SET status = 'draft', updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1 AND user_id = $2 AND status = 'withdrawn'
                         RETURNING id, classwork_item_id AS "assignmentId", user_id AS "participantUserId",
                             status, submitted_at AS "submittedAt", withdrawn_at AS "withdrawnAt",
                             metadata, created_at AS "createdAt", updated_at AS "updatedAt"
                             ${revisionsEnabled ? ', submission_revision AS "submissionRevision"' : ''}`,
                        [submission.id, userId]
                    );
                    submission = updated.rows[0];
                    if (revisionsEnabled) {
                        await client.query(
                            `UPDATE submission_revisions
                             SET state = 'draft', withdrawn_at = NULL, updated_at = CURRENT_TIMESTAMP
                             WHERE submission_id = $1 AND revision_no = $2 AND is_current = TRUE`,
                            [submission.id, submission.submissionRevision]
                        );
                    }
                    await appendStatusHistory(client, submission.id, 'withdrawn', 'draft', userId);
                    return { submission, outcome: 'resumed' };
                }
                return { submission, outcome: 'conflict' };
            }

            const submissionId = crypto.randomUUID();
            const inserted = await client.query(
                `INSERT INTO assignment_submissions (
                    id, classwork_item_id, user_id, status, metadata, created_at, updated_at
                 ) VALUES ($1, $2, $3, 'draft', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (classwork_item_id, user_id) DO NOTHING
                 RETURNING id, classwork_item_id AS "assignmentId", user_id AS "participantUserId",
                    status, submitted_at AS "submittedAt", withdrawn_at AS "withdrawnAt",
                    metadata, created_at AS "createdAt", updated_at AS "updatedAt"
                    ${revisionsEnabled ? ', submission_revision AS "submissionRevision"' : ''}`,
                [submissionId, assignmentId, userId]
            );
            if (inserted.rows[0]) {
                submission = inserted.rows[0];
                if (revisionsEnabled) {
                    await client.query(
                        `INSERT INTO submission_revisions (
                            id, submission_id, revision_no, state, metadata,
                            created_by_user_id, is_current, created_at, updated_at
                         ) VALUES ($1,$2,1,'draft','{}'::jsonb,$3,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
                        [`${submission.id}:r1`, submission.id, userId]
                    );
                }
                await appendStatusHistory(client, submission.id, null, 'draft', userId);
                return { submission, outcome: 'created' };
            }
            submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            return { submission, outcome: submission && submission.status === 'draft' ? 'existing' : 'conflict' };
        });
    }

    async function updateDraftMetadata(batchId, assignmentId, userId, metadata) {
        return withTransaction(async (client) => {
            const result = await client.query(
                `UPDATE assignment_submissions s
                 SET metadata = $4::jsonb, updated_at = CURRENT_TIMESTAMP
                 FROM classwork_items ci
                 WHERE ci.id = s.classwork_item_id
                   AND ci.batch_id = $1
                   AND s.classwork_item_id = $2
                   AND s.user_id = $3
                   AND s.status = 'draft'
                 RETURNING s.id, s.classwork_item_id AS "assignmentId", s.user_id AS "participantUserId",
                    s.status, s.submitted_at AS "submittedAt", s.withdrawn_at AS "withdrawnAt",
                    s.metadata, s.created_at AS "createdAt", s.updated_at AS "updatedAt"
                    ${revisionsEnabled ? ', s.submission_revision AS "submissionRevision"' : ''}`,
                [batchId, assignmentId, userId, JSON.stringify(metadata)]
            );
            const submission = result.rows[0] || null;
            if (submission && revisionsEnabled) {
                await client.query(
                    `UPDATE submission_revisions
                     SET metadata = $3::jsonb, updated_at = CURRENT_TIMESTAMP
                     WHERE submission_id = $1 AND revision_no = $2 AND is_current = TRUE`,
                    [submission.id, submission.submissionRevision, JSON.stringify(metadata)]
                );
            }
            return submission;
        });
    }

    async function addEvidenceToDraft(batchId, assignmentId, submissionId, userId, record, maxFiles) {
        return withTransaction(async (client) => {
            const submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            if (!submission || submission.id !== submissionId || submission.status !== 'draft') {
                return { outcome: 'state_conflict', evidence: null };
            }
            const countResult = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM submission_files
                 WHERE submission_id = $1 AND removed_at IS NULL
                 ${revisionsEnabled ? 'AND submission_revision = $2' : ''}`,
                revisionsEnabled ? [submissionId, submission.submissionRevision] : [submissionId]
            );
            if (Number(countResult.rows[0].count) >= maxFiles) return { outcome: 'limit', evidence: null };

            const result = await client.query(
                `INSERT INTO submission_files (
                    id, submission_id, file_path, external_url, file_name, file_type, file_size,
                    original_file_name, safe_display_name, mime_type, sha256, storage_key,
                    uploaded_by_user_id, classification, scan_status, storage_status, uploaded_at
                    ${revisionsEnabled ? ', submission_revision' : ''}
                 ) VALUES (
                    $1, $2, NULL, NULL, $3, $4, $5, $6, $7, $4, $8, $9,
                    $10, $11, $12, $13, CURRENT_TIMESTAMP
                    ${revisionsEnabled ? ', $14' : ''}
                 )
                 RETURNING id AS "evidenceId", submission_id AS "submissionId",
                    original_file_name AS "originalFileName", safe_display_name AS "safeDisplayName",
                    mime_type AS "mimeType", file_size AS "sizeBytes", sha256,
                    uploaded_at AS "uploadedAt", uploaded_by_user_id AS "uploadedByUserId",
                    classification, scan_status AS "scanStatus", storage_status AS "storageStatus"`,
                [
                    record.evidenceId, submissionId, record.safeDisplayName, record.mimeType,
                    record.sizeBytes, record.originalFileName, record.safeDisplayName, record.sha256,
                    record.storageKey, userId, record.classification, record.scanStatus, record.storageStatus,
                    ...(revisionsEnabled ? [submission.submissionRevision] : [])
                ]
            );
            return { outcome: 'inserted', evidence: result.rows[0] };
        });
    }

    async function softRemoveDraftEvidence(batchId, assignmentId, submissionId, evidenceId, userId) {
        return withTransaction(async (client) => {
            const submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            if (!submission || submission.id !== submissionId || submission.status !== 'draft') return false;
            const result = await client.query(
                `UPDATE submission_files
                 SET removed_at = CURRENT_TIMESTAMP,
                     removed_by_user_id = $3,
                     storage_status = 'deleted'
                 WHERE submission_id = $1
                   AND id = $2
                   AND removed_at IS NULL
                   ${revisionsEnabled ? 'AND submission_revision = $4' : ''}
                 RETURNING id`,
                revisionsEnabled
                    ? [submissionId, evidenceId, userId, submission.submissionRevision]
                    : [submissionId, evidenceId, userId]
            );
            return Boolean(result.rows[0]);
        });
    }

    async function submitDraft(batchId, assignmentId, userId, minimumEvidenceCount, requireComment) {
        return withTransaction(async (client) => {
            const submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            if (!submission) return { outcome: 'missing', submission: null };
            if (submission.status !== 'draft') return { outcome: 'conflict', submission };
            const evidenceResult = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM submission_files
                 WHERE submission_id = $1
                   AND removed_at IS NULL
                   AND storage_status IN ('quarantined', 'stored')
                   AND scan_status NOT IN ('rejected', 'failed')
                   ${revisionsEnabled ? 'AND submission_revision = $2' : ''}`,
                revisionsEnabled ? [submission.id, submission.submissionRevision] : [submission.id]
            );
            if (Number(evidenceResult.rows[0].count) < minimumEvidenceCount) {
                return { outcome: 'evidence_required', submission };
            }
            const comment = String(submission.metadata?.comment || '').trim();
            if (requireComment && !comment) return { outcome: 'comment_required', submission };
            const updated = await client.query(
                `UPDATE assignment_submissions
                 SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND user_id = $2 AND status = 'draft'
                 RETURNING id, classwork_item_id AS "assignmentId", user_id AS "participantUserId",
                    status, submitted_at AS "submittedAt", withdrawn_at AS "withdrawnAt",
                    metadata, created_at AS "createdAt", updated_at AS "updatedAt"
                    ${revisionsEnabled ? ', submission_revision AS "submissionRevision"' : ''}`,
                [submission.id, userId]
            );
            if (revisionsEnabled) {
                await client.query(
                    `UPDATE submission_revisions
                     SET state = 'submitted', submitted_at = CURRENT_TIMESTAMP,
                         withdrawn_at = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE submission_id = $1 AND revision_no = $2 AND is_current = TRUE`,
                    [submission.id, submission.submissionRevision]
                );
            }
            await appendStatusHistory(client, submission.id, 'draft', 'submitted', userId);
            return { outcome: 'submitted', submission: updated.rows[0] };
        });
    }

    async function withdrawSubmission(batchId, assignmentId, userId) {
        return withTransaction(async (client) => {
            const submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            if (!submission) return { outcome: 'missing', submission: null };
            if (submission.status !== 'submitted') return { outcome: 'conflict', submission };
            const updated = await client.query(
                `UPDATE assignment_submissions
                 SET status = 'withdrawn', withdrawn_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND user_id = $2 AND status = 'submitted'
                 RETURNING id, classwork_item_id AS "assignmentId", user_id AS "participantUserId",
                    status, submitted_at AS "submittedAt", withdrawn_at AS "withdrawnAt",
                    metadata, created_at AS "createdAt", updated_at AS "updatedAt"
                    ${revisionsEnabled ? ', submission_revision AS "submissionRevision"' : ''}`,
                [submission.id, userId]
            );
            if (revisionsEnabled) {
                await client.query(
                    `UPDATE submission_revisions
                     SET state = 'withdrawn', withdrawn_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE submission_id = $1 AND revision_no = $2 AND is_current = TRUE`,
                    [submission.id, submission.submissionRevision]
                );
            }
            await appendStatusHistory(client, submission.id, 'submitted', 'withdrawn', userId);
            return { outcome: 'withdrawn', submission: updated.rows[0] };
        });
    }

    async function createNextRevision(batchId, assignmentId, userId) {
        if (!revisionsEnabled) return { outcome: 'disabled', submission: null };
        return withTransaction(async (client) => {
            const submission = await findParticipantSubmission(client, batchId, assignmentId, userId, true);
            if (!submission) return { outcome: 'missing', submission: null };
            if (submission.status !== 'submitted') return { outcome: 'state_conflict', submission };

            const currentRevision = Number(submission.submissionRevision || 1);
            const reviewResult = await client.query(
                `SELECT state
                 FROM submission_reviews
                 WHERE submission_id = $1 AND submission_revision = $2
                 FOR UPDATE`,
                [submission.id, currentRevision]
            );
            if (reviewResult.rows[0]?.state !== 'revision_requested') {
                return { outcome: 'review_conflict', submission };
            }

            const parentResult = await client.query(
                `SELECT id
                 FROM submission_revisions
                 WHERE submission_id = $1 AND revision_no = $2 AND is_current = TRUE
                 FOR UPDATE`,
                [submission.id, currentRevision]
            );
            const parent = parentResult.rows[0];
            if (!parent) return { outcome: 'lineage_conflict', submission };

            const nextRevision = currentRevision + 1;
            await client.query(
                `UPDATE submission_revisions
                 SET is_current = FALSE, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [parent.id]
            );
            await client.query(
                `INSERT INTO submission_revisions (
                    id, submission_id, revision_no, parent_revision_id, state,
                    metadata, created_by_user_id, is_current, created_at, updated_at
                 ) VALUES ($1,$2,$3,$4,'draft','{}'::jsonb,$5,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
                [`${submission.id}:r${nextRevision}`, submission.id, nextRevision, parent.id, userId]
            );
            const updated = await client.query(
                `UPDATE assignment_submissions
                 SET submission_revision = $3, status = 'draft', metadata = '{}'::jsonb,
                     submitted_at = NULL, withdrawn_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND user_id = $2 AND submission_revision = $3 - 1
                 RETURNING id, classwork_item_id AS "assignmentId", user_id AS "participantUserId",
                    status, submitted_at AS "submittedAt", withdrawn_at AS "withdrawnAt",
                    metadata, created_at AS "createdAt", updated_at AS "updatedAt",
                    submission_revision AS "submissionRevision"`,
                [submission.id, userId, nextRevision]
            );
            if (!updated.rows[0]) throw new Error('Revision pointer changed during transition');
            await appendStatusHistory(client, submission.id, 'submitted', 'draft', userId);
            return { outcome: 'created', submission: updated.rows[0] };
        });
    }

    async function listParticipantRevisionHistory(batchId, assignmentId, userId) {
        if (!revisionsEnabled) return [];
        const result = await pgPool.query(
            `SELECT r.revision_no AS "revisionNo", r.state AS "submissionState",
                    r.submitted_at AS "submittedAt", r.created_at AS "createdAt",
                    r.is_current AS "isCurrent",
                    COALESCE(sr.state, 'not_started') AS "reviewState",
                    sr.decided_at AS "decidedAt",
                    CASE WHEN sr.state IN ('revision_requested', 'accepted')
                         THEN sr.participant_feedback ELSE '' END AS "participantFeedback"
             FROM submission_revisions r
             INNER JOIN assignment_submissions s ON s.id = r.submission_id
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             LEFT JOIN submission_reviews sr
               ON sr.submission_id = r.submission_id
              AND sr.submission_revision = r.revision_no
             WHERE ci.batch_id = $1
               AND s.classwork_item_id = $2
               AND s.user_id = $3
             ORDER BY r.revision_no DESC`,
            [batchId, assignmentId, userId]
        );
        return result.rows;
    }

    async function listReviewQueue(batchId) {
        const result = await pgPool.query(
            `SELECT
                s.id AS "submissionId", s.submitted_at AS "submittedAt",
                s.submission_revision AS "submissionRevision",
                u.username AS "participantDisplayName", ci.title AS "assignmentTitle",
                COALESCE(sr.state, 'not_started') AS "reviewState",
                reviewer.username AS "reviewerDisplayName"
             FROM assignment_submissions s
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             INNER JOIN training_batches b ON b.id = ci.batch_id
             INNER JOIN batch_members bm
               ON bm.batch_id = b.id
              AND bm.user_id = s.user_id
              AND bm.role = 'participant'
              AND bm.enrollment_status = 'active'
             INNER JOIN users u ON u.id = s.user_id
             LEFT JOIN submission_reviews sr
               ON sr.submission_id = s.id
              AND sr.submission_revision = s.submission_revision
             LEFT JOIN users reviewer ON reviewer.id = sr.reviewer_user_id
             WHERE b.id = $1
               AND b.program_type = 'internship'
               AND b.status IN ('active', 'completed')
               AND ci.type = 'practice_task'
               AND ci.status IN ('published', 'closed')
               AND ci.participant_visibility = 'visible'
               AND s.status = 'submitted'
             ORDER BY s.submitted_at ASC, s.id ASC`,
            [batchId]
        );
        return result.rows;
    }

    function mapReviewRow(row) {
        if (!row || !row.review_id) return null;
        return {
            reviewId: row.review_id,
            state: row.review_state,
            decision: row.review_decision,
            reviewerUserId: row.reviewer_user_id,
            reviewerDisplayName: row.reviewer_display_name,
            submissionRevision: row.review_submission_revision,
            reviewVersion: row.review_version,
            participantFeedback: row.participant_feedback,
            internalNote: row.internal_note,
            startedAt: row.review_started_at,
            decidedAt: row.review_decided_at,
            updatedAt: row.review_updated_at
        };
    }

    async function getReviewSubmission(batchId, submissionId, requestedRevision = null) {
        const result = await pgPool.query(
            `SELECT
                s.id AS "submissionId", rev.state AS "submissionStatus",
                s.user_id AS "participantUserId", rev.submitted_at AS "submittedAt",
                rev.revision_no AS "submissionRevision",
                ci.id AS "assignmentId", ci.title AS "assignmentTitle",
                ci.instructions AS "assignmentBrief",
                ci.required_deliverable AS "requiredDeliverable",
                bt.title AS "topicTitle",
                b.code AS "programCode", b.title AS "programTitle",
                u.username AS "participantDisplayName",
                sr.id AS review_id, sr.state AS review_state, sr.decision AS review_decision,
                sr.reviewer_user_id, reviewer.username AS reviewer_display_name,
                sr.submission_revision AS review_submission_revision,
                sr.review_version, sr.participant_feedback, sr.internal_note,
                sr.started_at AS review_started_at, sr.decided_at AS review_decided_at,
                sr.updated_at AS review_updated_at
             FROM assignment_submissions s
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             INNER JOIN training_batches b ON b.id = ci.batch_id
             INNER JOIN batch_members bm
               ON bm.batch_id = b.id
              AND bm.user_id = s.user_id
              AND bm.role = 'participant'
              AND bm.enrollment_status = 'active'
             INNER JOIN users u ON u.id = s.user_id
             LEFT JOIN batch_topics bt ON bt.id = ci.topic_id AND bt.batch_id = ci.batch_id
             INNER JOIN submission_revisions rev
               ON rev.submission_id = s.id
              AND rev.revision_no = COALESCE($3::integer, s.submission_revision)
             LEFT JOIN submission_reviews sr
               ON sr.submission_id = s.id
              AND sr.submission_revision = rev.revision_no
             LEFT JOIN users reviewer ON reviewer.id = sr.reviewer_user_id
             WHERE b.id = $1
               AND b.program_type = 'internship'
               AND b.status IN ('active', 'completed')
               AND ci.type = 'practice_task'
               AND ci.status IN ('published', 'closed')
               AND ci.participant_visibility = 'visible'
               AND s.id = $2
             LIMIT 1`,
            [batchId, submissionId, requestedRevision]
        );
        const row = result.rows[0];
        return row ? { ...row, review: mapReviewRow(row) } : null;
    }

    async function listReviewCriteria(batchId, assignmentId) {
        const result = await pgPool.query(
            `SELECT id AS "criterionId", title, description,
                    max_score AS "maxScore", weight, required,
                    sort_order AS "displayOrder"
             FROM review_criteria
             WHERE batch_id = $1
               AND (classwork_item_id = $2 OR classwork_item_id IS NULL)
             ORDER BY CASE WHEN classwork_item_id = $2 THEN 0 ELSE 1 END,
                      sort_order ASC, created_at ASC, id ASC`,
            [batchId, assignmentId]
        );
        return result.rows;
    }

    async function listReviewLearningContext(assignmentId) {
        const result = await pgPool.query(
            `SELECT ccl.relationship_type AS relationship,
                    COALESCE(lcr.title_override, ccl.content_id, ccl.quiz_id) AS title
             FROM classwork_content_links ccl
             LEFT JOIN learning_content_registry lcr ON lcr.content_id = ccl.content_id
             WHERE ccl.classwork_id = $1
             ORDER BY CASE ccl.relationship_type WHEN 'prerequisite' THEN 1 ELSE 2 END, ccl.id ASC`,
            [assignmentId]
        );
        return result.rows;
    }

    async function listReviewEvidence(batchId, submissionId, submissionRevision) {
        const result = await pgPool.query(
            `SELECT sf.id AS "evidenceId", sf.submission_id AS "submissionId",
                    sf.safe_display_name AS "safeDisplayName", sf.mime_type AS "mimeType",
                    sf.file_size AS "sizeBytes", sf.uploaded_at AS "uploadedAt",
                    sf.classification, sf.scan_status AS "scanStatus",
                    sf.storage_status AS "storageStatus"
             FROM submission_files sf
             INNER JOIN assignment_submissions s ON s.id = sf.submission_id
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             WHERE ci.batch_id = $1
               AND s.id = $2
               AND sf.submission_revision = $3
               AND sf.removed_at IS NULL
             ORDER BY sf.uploaded_at ASC, sf.id ASC`,
            [batchId, submissionId, submissionRevision]
        );
        return result.rows;
    }

    async function getReviewEvidenceRecord(batchId, submissionId, submissionRevision, evidenceId) {
        const result = await pgPool.query(
            `SELECT sf.id AS "evidenceId", sf.submission_id AS "submissionId",
                    sf.safe_display_name AS "safeDisplayName", sf.mime_type AS "mimeType",
                    sf.file_size AS "sizeBytes", sf.storage_key AS "storageKey",
                    sf.scan_status AS "scanStatus", sf.storage_status AS "storageStatus"
             FROM submission_files sf
             INNER JOIN assignment_submissions s ON s.id = sf.submission_id
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             WHERE ci.batch_id = $1
               AND s.id = $2
               AND sf.submission_revision = $3
               AND sf.id = $4
               AND sf.removed_at IS NULL
             LIMIT 1`,
            [batchId, submissionId, submissionRevision, evidenceId]
        );
        return result.rows[0] || null;
    }

    async function getSubmissionReview(submissionId, submissionRevision) {
        const result = await pgPool.query(
            `SELECT sr.id AS "reviewId", sr.state, sr.decision,
                    sr.reviewer_user_id AS "reviewerUserId",
                    sr.submission_revision AS "submissionRevision",
                    sr.review_version AS "reviewVersion",
                    sr.participant_feedback AS "participantFeedback",
                    sr.internal_note AS "internalNote",
                    sr.started_at AS "startedAt", sr.decided_at AS "decidedAt",
                    sr.updated_at AS "updatedAt"
             FROM submission_reviews sr
             WHERE sr.submission_id = $1 AND sr.submission_revision = $2
             LIMIT 1`,
            [submissionId, submissionRevision]
        );
        return result.rows[0] || null;
    }

    async function getParticipantReviewSubmission(batchId, assignmentId, userId) {
        const result = await pgPool.query(
            `SELECT s.id, s.status, s.submitted_at AS "submittedAt",
                    s.submission_revision AS "submissionRevision"
             FROM assignment_submissions s
             INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
             WHERE ci.batch_id = $1
               AND s.classwork_item_id = $2
               AND s.user_id = $3
             LIMIT 1`,
            [batchId, assignmentId, userId]
        );
        return result.rows[0] || null;
    }

    async function listReviewScores(submissionId, submissionRevision) {
        const result = await pgPool.query(
            `SELECT criterion_id AS "criterionId", score, comment,
                    updated_at AS "updatedAt"
             FROM review_scores
             WHERE submission_id = $1 AND submission_revision = $2
               AND review_id IS NOT NULL
             ORDER BY updated_at ASC, id ASC`,
            [submissionId, submissionRevision]
        );
        return result.rows;
    }

    async function listReviewComments(submissionId, submissionRevision, includeInternal) {
        const result = await pgPool.query(
            `SELECT visibility, body, created_at AS "createdAt"
             FROM submission_comments
             WHERE submission_id = $1 AND submission_revision = $2
               AND review_id IS NOT NULL
               AND ($3::boolean = true OR visibility = 'participant')
             ORDER BY created_at ASC, id ASC`,
            [submissionId, submissionRevision, includeInternal === true]
        );
        return result.rows;
    }

    async function appendReviewHistory(client, review, fromState, toState, action, actorUserId, changeSummary = {}) {
        await client.query(
            `INSERT INTO submission_review_history (
                review_id, submission_id, submission_revision, from_state, to_state,
                action, actor_user_id, review_version, change_summary, created_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,CURRENT_TIMESTAMP)`,
            [review.id, review.submission_id, review.submission_revision, fromState, toState,
                action, actorUserId, review.review_version, JSON.stringify(changeSummary)]
        );
    }

    async function startSubmissionReview({ batchId, submissionId, submissionRevision, reviewerUserId }) {
        return withTransaction(async (client) => {
            const target = await client.query(
                `SELECT s.id, s.status, s.submission_revision
                 FROM assignment_submissions s
                 INNER JOIN classwork_items ci ON ci.id = s.classwork_item_id
                 WHERE ci.batch_id = $1 AND s.id = $2
                 FOR UPDATE OF s`,
                [batchId, submissionId]
            );
            const submission = target.rows[0];
            if (!submission || submission.status !== 'submitted'
                || Number(submission.submission_revision) !== Number(submissionRevision)) {
                return { outcome: 'terminal', review: null };
            }
            const inserted = await client.query(
                `INSERT INTO submission_reviews (
                    id, submission_id, submission_revision, state, reviewer_user_id,
                    started_at, review_version, created_at, updated_at
                 ) VALUES ($1,$2,$3,'under_review',$4,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                 ON CONFLICT (submission_id, submission_revision) DO NOTHING
                 RETURNING *`,
                [crypto.randomUUID(), submissionId, submissionRevision, reviewerUserId]
            );
            if (inserted.rows[0]) {
                await appendReviewHistory(client, inserted.rows[0], 'not_started', 'under_review', 'started', reviewerUserId);
                return { outcome: 'started', review: inserted.rows[0] };
            }
            const existing = await client.query(
                `SELECT * FROM submission_reviews
                 WHERE submission_id = $1 AND submission_revision = $2
                 FOR UPDATE`,
                [submissionId, submissionRevision]
            );
            const review = existing.rows[0];
            if (review.state !== 'under_review') return { outcome: 'terminal', review };
            if (Number(review.reviewer_user_id) !== Number(reviewerUserId)) return { outcome: 'claimed', review };
            return { outcome: 'existing', review };
        });
    }

    async function saveSubmissionReview(input) {
        return withTransaction(async (client) => {
            const locked = await client.query(
                `SELECT * FROM submission_reviews
                 WHERE submission_id = $1 AND submission_revision = $2
                 FOR UPDATE`,
                [input.submissionId, input.submissionRevision]
            );
            const review = locked.rows[0];
            if (!review || Number(review.review_version) !== input.expectedVersion) return { outcome: 'stale', review };
            if (review.state !== 'under_review') return { outcome: 'terminal', review };
            if (Number(review.reviewer_user_id) !== Number(input.reviewerUserId)) return { outcome: 'not_owner', review };
            for (const item of input.scores) {
                await client.query(
                    `INSERT INTO review_scores (
                        id, submission_id, criterion_id, score, comment, reviewed_by,
                        review_id, submission_revision, reviewed_at, updated_at
                     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                     ON CONFLICT (review_id, criterion_id) DO UPDATE SET
                        score = EXCLUDED.score, comment = EXCLUDED.comment,
                        reviewed_by = EXCLUDED.reviewed_by,
                        reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
                    [crypto.randomUUID(), input.submissionId, item.criterionId, item.score, item.comment || null,
                        String(input.reviewerUserId), review.id, input.submissionRevision]
                );
            }
            const participantFeedback = input.participantFeedbackPresent
                ? input.participantFeedback : review.participant_feedback;
            const internalNote = input.internalNotePresent ? input.internalNote : review.internal_note;
            const updated = await client.query(
                `UPDATE submission_reviews
                 SET participant_feedback = $2, internal_note = $3,
                     review_version = review_version + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [review.id, participantFeedback || '', internalNote || '']
            );
            for (const [present, visibility, body] of [
                [input.participantFeedbackPresent, 'participant', input.participantFeedback],
                [input.internalNotePresent, 'internal', input.internalNote]
            ]) {
                if (!present) continue;
                await client.query(
                    `INSERT INTO submission_comments (
                        id, submission_id, sender_user_id, visibility, body,
                        review_id, submission_revision, created_at
                     ) VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
                    [crypto.randomUUID(), input.submissionId, String(input.reviewerUserId), visibility,
                        body, review.id, input.submissionRevision]
                );
            }
            const next = updated.rows[0];
            await appendReviewHistory(client, next, 'under_review', 'under_review', 'updated', input.reviewerUserId, {
                criterionIds: input.scores.map((item) => item.criterionId),
                participantFeedbackChanged: input.participantFeedbackPresent,
                internalNoteChanged: input.internalNotePresent
            });
            return { outcome: 'updated', review: next };
        });
    }

    async function decideSubmissionReview(input) {
        return withTransaction(async (client) => {
            const locked = await client.query(
                `SELECT * FROM submission_reviews
                 WHERE submission_id = $1 AND submission_revision = $2
                 FOR UPDATE`,
                [input.submissionId, input.submissionRevision]
            );
            const review = locked.rows[0];
            if (!review || Number(review.review_version) !== input.expectedVersion) return { outcome: 'stale', review };
            if (review.state !== 'under_review') return { outcome: 'terminal', review };
            if (Number(review.reviewer_user_id) !== Number(input.reviewerUserId)) return { outcome: 'not_owner', review };
            const updated = await client.query(
                `UPDATE submission_reviews
                 SET state = $2, decision = $2, decided_at = CURRENT_TIMESTAMP,
                     review_version = review_version + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [review.id, input.decision]
            );
            const next = updated.rows[0];
            await appendReviewHistory(client, next, 'under_review', input.decision, 'decision', input.reviewerUserId, {
                decision: input.decision
            });
            return { outcome: 'decided', review: next };
        });
    }

    async function getProgramProgressContext(batchId, actorUserId, participantUserId, queryable = pgPool, lock = false) {
        const result = await queryable.query(
            `SELECT
                b.id, b.code, b.title, b.start_date AS "startDate", b.end_date AS "endDate",
                b.status, b.program_type AS "programType",
                actor_member.role AS "actorRole",
                actor_member.enrollment_status AS "actorEnrollmentStatus",
                target_member.role AS "participantRole",
                target_member.enrollment_status AS "participantEnrollmentStatus",
                target_user.username AS "participantDisplayName",
                ibc.learning_path_version_id::text AS "learningPathVersionId",
                lpv.definition AS "learningPathDefinition",
                ibc.policy_version_id AS "policyVersionId",
                ipv.status AS "policyStatus", ipv.payload_json AS "policyPayload",
                ipv.checksum AS "policyChecksum",
                (md5(ipv.payload_json::text) = ipv.checksum) AS "policyChecksumValid",
                closeout.id AS "closeoutId", closeout.completed_at AS "completedAt",
                closeout.completed_by_user_id AS "completedByUserId",
                closer.username AS "completedByDisplayName", closeout.closeout_note AS "closeoutNote",
                closeout.requirements_digest AS "requirementsDigest"
             FROM training_batches b
             INNER JOIN internship_batch_config ibc ON ibc.batch_id = b.id
             INNER JOIN learning_path_versions lpv ON lpv.id = ibc.learning_path_version_id
             INNER JOIN internship_program_policy_versions ipv ON ipv.id = ibc.policy_version_id
             LEFT JOIN batch_members actor_member
               ON actor_member.batch_id = b.id AND actor_member.user_id = $2
             INNER JOIN batch_members target_member
               ON target_member.batch_id = b.id AND target_member.user_id = $3
             INNER JOIN users target_user ON target_user.id = target_member.user_id
             LEFT JOIN internship_program_closeouts closeout
               ON closeout.batch_id = b.id AND closeout.participant_user_id = target_member.user_id
             LEFT JOIN users closer ON closer.id = closeout.completed_by_user_id
             WHERE b.id = $1 AND b.program_type = 'internship'
             LIMIT 1${lock ? ' FOR SHARE OF b, ibc, ipv, target_member' : ''}`,
            [batchId, actorUserId, participantUserId]
        );
        return result.rows[0] || null;
    }

    async function listProgramParticipants(batchId) {
        const result = await pgPool.query(
            `SELECT bm.user_id AS "userId", u.username AS "displayName"
             FROM batch_members bm
             INNER JOIN users u ON u.id = bm.user_id
             WHERE bm.batch_id = $1
               AND bm.role = 'participant'
               AND bm.enrollment_status <> 'dropped'
             ORDER BY u.username, bm.user_id`,
            [batchId]
        );
        return result.rows;
    }

    async function listProgramAssignmentStates(batchId, participantUserId, assignmentIds, queryable = pgPool) {
        const ids = Array.isArray(assignmentIds) ? assignmentIds.map(String).filter(Boolean) : [];
        if (ids.length === 0) return [];
        const result = await queryable.query(
            `SELECT
                requested.assignment_id AS "assignmentId",
                ci.id IS NOT NULL AS "assignmentExists",
                ci.status AS "assignmentStatus",
                ci.participant_visibility AS "participantVisibility",
                CASE WHEN ci.id IS NULL THEN NULL ELSE 'md5:' || md5(concat_ws(E'\\x1f',
                    ci.id, COALESCE(ci.title, ''), COALESCE(ci.instructions, ''),
                    COALESCE(ci.required_deliverable, ''), COALESCE(ci.participant_visibility, ''),
                    COALESCE(ci.topic_id, '')
                )) END AS "definitionDigest",
                s.id AS "submissionId",
                current_revision.revision_no AS "revisionNo",
                current_revision.state AS "submissionState",
                current_review.state AS "reviewState",
                current_review.decision AS "reviewDecision",
                COALESCE(revision_count.count, 0)::int AS "revisionCount"
             FROM unnest($3::text[]) WITH ORDINALITY requested(assignment_id, sequence_no)
             LEFT JOIN classwork_items ci
               ON ci.id = requested.assignment_id AND ci.batch_id = $1 AND ci.type = 'practice_task'
             LEFT JOIN assignment_submissions s
               ON s.classwork_item_id = ci.id AND s.user_id = $2
             LEFT JOIN submission_revisions current_revision
               ON current_revision.submission_id = s.id AND current_revision.is_current = TRUE
             LEFT JOIN submission_reviews current_review
               ON current_review.submission_id = s.id
              AND current_review.submission_revision = current_revision.revision_no
             LEFT JOIN LATERAL (
                SELECT COUNT(*) AS count FROM submission_revisions all_revisions
                WHERE all_revisions.submission_id = s.id
             ) revision_count ON TRUE
             ORDER BY requested.sequence_no`,
            [batchId, participantUserId, ids]
        );
        return result.rows;
    }

    async function createProgramCloseout(queryable, input) {
        const id = `internship-closeout:${crypto.randomUUID()}`;
        const inserted = await queryable.query(
            `INSERT INTO internship_program_closeouts (
                id, batch_id, participant_user_id, policy_version_id,
                completed_by_user_id, closeout_note, requirements_digest, requirements_snapshot
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
             ON CONFLICT (batch_id, participant_user_id) DO NOTHING
             RETURNING *`,
            [id, input.batchId, input.participantUserId, input.policyVersionId,
                input.actorUserId, input.closeoutNote, input.requirementsDigest,
                JSON.stringify(input.requirementsSnapshot)]
        );
        if (inserted.rows.length === 0) {
            const existing = await queryable.query(
                `SELECT * FROM internship_program_closeouts
                 WHERE batch_id = $1 AND participant_user_id = $2`,
                [input.batchId, input.participantUserId]
            );
            return { created: false, closeout: existing.rows[0] };
        }
        const closeout = inserted.rows[0];
        for (const action of ['closeout_initiated', 'closeout_completed']) {
            await queryable.query(
                `INSERT INTO internship_program_completion_audit (
                    closeout_id, action, batch_id, participant_user_id,
                    policy_version_id, actor_user_id, metadata
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
                [closeout.id, action, input.batchId, input.participantUserId,
                    input.policyVersionId, input.actorUserId,
                    JSON.stringify({ requirementsDigest: input.requirementsDigest })]
            );
        }
        return { created: true, closeout };
    }

    return {
        addEvidenceToDraft,
        createOrResumeDraft,
        createNextRevision,
        createProgramCloseout,
        getBatchContext,
        getCompletedActivityEvidence,
        getPathModules,
        getProgramProgressContext,
        getParticipantSubmission,
        getParticipantReviewSubmission,
        getReviewEvidenceRecord,
        getReviewSubmission,
        getSubmissionReview,
        getVerifiedQuizEvidence,
        listAssignmentLearningLinks,
        listEnrollments,
        listMentors,
        listParticipantAssignments,
        listParticipantRevisionHistory,
        listProgramAssignmentStates,
        listProgramParticipants,
        listReviewComments,
        listReviewCriteria,
        listReviewEvidence,
        listReviewLearningContext,
        listReviewQueue,
        listReviewScores,
        listSubmissionEvidence,
        decideSubmissionReview,
        saveSubmissionReview,
        softRemoveDraftEvidence,
        startSubmissionReview,
        submitDraft,
        updateDraftMetadata,
        withTransaction,
        withdrawSubmission
    };
}

module.exports = { createInternshipRepository };
