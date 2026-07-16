const path = require('path');

const candidates = require(path.join(__dirname, '../elearning/learning-mapping-candidates.json'));
const learningPaths = require(path.join(__dirname, '../elearning/learning-paths.json'));

const DECISIONS = new Set(['required', 'elective', 'library_only', 'alternate', 'needs_review', 'retired']);
const REVIEW_STATUSES = new Set(['candidate', 'needs_review', 'approved', 'rejected', 'retired']);
const SOURCE_TYPES = new Set(['video', 'pdf', 'page']);

class QueueError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function cleanText(value, maxLength = 1000) {
    return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function humanize(value) {
    return cleanText(value, 200)
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function buildOptions() {
    const pathTitles = new Map((learningPaths || []).map((item) => [item.id, item.title]));
    pathTitles.set('bim-modeller-core', 'BIM Modeller Core');
    pathTitles.set('civil-infrastructure-modelling', 'Civil Infrastructure Modelling');

    const modulesByPath = new Map();
    for (const candidate of candidates.decisions || []) {
        for (const target of candidate.targets || []) {
            if (!modulesByPath.has(target.pathId)) modulesByPath.set(target.pathId, new Set());
            modulesByPath.get(target.pathId).add(target.moduleKey);
        }
    }

    const paths = [...modulesByPath.entries()]
        .map(([id, moduleKeys]) => ({
            id,
            title: pathTitles.get(id) || humanize(id),
            modules: [...moduleKeys].sort().map((key) => ({ key, title: humanize(key) }))
        }))
        .sort((left, right) => left.title.localeCompare(right.title));

    return {
        decisions: [...DECISIONS],
        reviewStatuses: [...REVIEW_STATUSES],
        sourceTypes: [...SOURCE_TYPES],
        paths
    };
}

const OPTIONS = buildOptions();
const ALLOWED_TARGETS = new Set(OPTIONS.paths.flatMap((learningPath) => (
    learningPath.modules.map((module) => `${learningPath.id}:${module.key}`)
)));

function normalizeQueueRow(row) {
    const candidatePayload = row.candidate_payload || {};
    const registryMetadata = row.registry_metadata || {};
    return {
        contentId: row.content_id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        sourceUrl: row.source_locator || '',
        title: row.title_override || candidatePayload.title || registryMetadata.sourceTitle || row.content_id,
        sourceTitle: candidatePayload.title || registryMetadata.sourceTitle || '',
        category: row.category_override || candidatePayload.category || registryMetadata.sourceCategory || '',
        level: row.level_override || registryMetadata.sourceLevel || '',
        titleOverride: row.title_override || '',
        categoryOverride: row.category_override || '',
        levelOverride: row.level_override || '',
        decision: row.decision,
        targetPathId: row.target_path_id || '',
        targetModuleKey: row.target_module_key || '',
        requirementType: row.requirement_type || '',
        proposedSequence: row.proposed_sequence,
        reviewStatus: row.review_status,
        reviewNotes: row.review_notes || '',
        reviewedBy: row.reviewed_by || '',
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
        revision: row.revision,
        candidateReason: candidatePayload.reason || '',
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
    };
}

function createLearningMappingQueueService({ pgPool }) {
    if (!pgPool) throw new Error('pgPool is required');

    async function getQueue(filters = {}) {
        const params = [];
        const conditions = [];
        const add = (sql, value) => {
            params.push(value);
            conditions.push(sql.replace('?', `$${params.length}`));
        };

        const decision = cleanText(filters.decision, 30).toLowerCase();
        const reviewStatus = cleanText(filters.reviewStatus || filters.status, 30).toLowerCase();
        const sourceType = cleanText(filters.sourceType || filters.type, 20).toLowerCase();
        const pathId = cleanText(filters.pathId, 120);
        const query = cleanText(filters.query || filters.q, 200);

        if (decision) {
            if (!DECISIONS.has(decision)) throw new QueueError('Invalid decision filter');
            add('q.decision = ?', decision);
        }
        if (reviewStatus) {
            if (!REVIEW_STATUSES.has(reviewStatus)) throw new QueueError('Invalid review status filter');
            add('q.review_status = ?', reviewStatus);
        }
        if (sourceType) {
            if (!SOURCE_TYPES.has(sourceType)) throw new QueueError('Invalid source type filter');
            add('r.source_type = ?', sourceType);
        }
        if (pathId) add('q.target_path_id = ?', pathId);
        if (query) {
            params.push(`%${query}%`);
            conditions.push(`(
                q.content_id ILIKE $${params.length} OR
                COALESCE(q.candidate_payload->>'title', '') ILIKE $${params.length} OR
                COALESCE(q.candidate_payload->>'category', '') ILIKE $${params.length} OR
                COALESCE(q.review_notes, '') ILIKE $${params.length}
            )`);
        }

        const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 50, 1), 200);
        const offset = Math.max(Number.parseInt(filters.offset, 10) || 0, 0);
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        params.push(limit, offset);

        const result = await pgPool.query(`
            SELECT q.*, r.source_type, r.source_id, r.source_locator,
                   r.title_override, r.category_override, r.level_override,
                   r.metadata AS registry_metadata,
                   COUNT(*) OVER()::int AS filtered_total
            FROM learning_mapping_review_queue q
            JOIN learning_content_registry r ON r.content_id = q.content_id
            ${where}
            ORDER BY
                CASE q.review_status
                    WHEN 'needs_review' THEN 0
                    WHEN 'candidate' THEN 1
                    WHEN 'rejected' THEN 2
                    WHEN 'approved' THEN 3
                    ELSE 4
                END,
                q.updated_at DESC,
                q.content_id
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `, params);

        return {
            items: result.rows.map(normalizeQueueRow),
            total: result.rows[0]?.filtered_total || 0,
            limit,
            offset
        };
    }

    async function getSummary() {
        const [totals, decisions, statuses, types] = await Promise.all([
            pgPool.query(`
                SELECT COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE review_status = 'approved')::int AS approved,
                       COUNT(*) FILTER (WHERE review_status IN ('candidate', 'needs_review'))::int AS pending,
                       COUNT(*) FILTER (WHERE review_status = 'needs_review' OR decision = 'needs_review')::int AS unresolved
                FROM learning_mapping_review_queue
            `),
            pgPool.query(`SELECT decision AS key, COUNT(*)::int AS count FROM learning_mapping_review_queue GROUP BY decision ORDER BY decision`),
            pgPool.query(`SELECT review_status AS key, COUNT(*)::int AS count FROM learning_mapping_review_queue GROUP BY review_status ORDER BY review_status`),
            pgPool.query(`
                SELECT r.source_type AS key, COUNT(*)::int AS count
                FROM learning_mapping_review_queue q
                JOIN learning_content_registry r ON r.content_id = q.content_id
                GROUP BY r.source_type ORDER BY r.source_type
            `)
        ]);
        const base = totals.rows[0] || { total: 0, approved: 0, pending: 0, unresolved: 0 };
        return {
            ...base,
            byDecision: Object.fromEntries(decisions.rows.map((row) => [row.key, row.count])),
            byStatus: Object.fromEntries(statuses.rows.map((row) => [row.key, row.count])),
            byType: Object.fromEntries(types.rows.map((row) => [row.key, row.count])),
            publishEnabled: false,
            publishBlockReason: 'Path draft import dan publish workflow belum diaktifkan.'
        };
    }

    async function getEvents(contentId) {
        const result = await pgPool.query(`
            SELECT id, action, actor_id, actor_label, before_state, after_state, created_at
            FROM learning_mapping_review_events
            WHERE content_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 50
        `, [contentId]);
        return result.rows.map((row) => ({
            id: row.id,
            action: row.action,
            actorId: row.actor_id,
            actorLabel: row.actor_label || '',
            beforeState: row.before_state,
            afterState: row.after_state,
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
        }));
    }

    async function updateQueueItem(contentId, input, actor) {
        const client = await pgPool.connect();
        try {
            await client.query('BEGIN');
            const currentResult = await client.query(`
                SELECT q.*, r.title_override, r.category_override, r.level_override
                FROM learning_mapping_review_queue q
                JOIN learning_content_registry r ON r.content_id = q.content_id
                WHERE q.content_id = $1
                FOR UPDATE OF q, r
            `, [contentId]);
            if (!currentResult.rowCount) throw new QueueError('Queue item not found', 404);

            const current = currentResult.rows[0];
            const expectedRevision = Number.parseInt(input.revision, 10);
            if (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision) {
                throw new QueueError('Item changed by another reviewer. Reload before saving.', 409);
            }

            const decision = cleanText(input.decision, 30).toLowerCase();
            let reviewStatus = cleanText(input.reviewStatus, 30).toLowerCase();
            let targetPathId = cleanText(input.targetPathId, 120) || null;
            let targetModuleKey = cleanText(input.targetModuleKey, 120) || null;
            const reviewNotes = cleanText(input.reviewNotes, 4000);
            const proposedSequenceRaw = input.proposedSequence;
            let proposedSequence = proposedSequenceRaw === '' || proposedSequenceRaw == null
                ? null
                : Number.parseInt(proposedSequenceRaw, 10);

            if (!DECISIONS.has(decision)) throw new QueueError('Invalid mapping decision');
            if (!REVIEW_STATUSES.has(reviewStatus)) throw new QueueError('Invalid review status');
            if (proposedSequence != null && (!Number.isInteger(proposedSequence) || proposedSequence < 0)) {
                throw new QueueError('Sequence must be a non-negative integer');
            }

            const mappedDecision = ['required', 'elective', 'alternate'].includes(decision);
            if (mappedDecision) {
                if (!targetPathId || !targetModuleKey) throw new QueueError('Target path and module are required');
                if (!ALLOWED_TARGETS.has(`${targetPathId}:${targetModuleKey}`)) {
                    throw new QueueError('Target path/module is not part of the reviewed draft taxonomy');
                }
            } else {
                targetPathId = null;
                targetModuleKey = null;
                proposedSequence = null;
            }

            if (decision === 'needs_review') reviewStatus = 'needs_review';
            if (decision === 'retired') reviewStatus = 'retired';
            if (reviewStatus === 'retired' && decision !== 'retired') {
                throw new QueueError('Retired review status requires a retired decision');
            }
            if (reviewStatus === 'approved' && decision === 'needs_review') {
                throw new QueueError('Needs-review content cannot be approved');
            }
            if (['approved', 'rejected', 'retired'].includes(reviewStatus) && reviewNotes.length < 3) {
                throw new QueueError('Review notes are required for a final review status');
            }

            const requirementType = ['required', 'elective'].includes(decision) ? decision : null;
            const isFinalReview = ['approved', 'rejected', 'retired'].includes(reviewStatus);
            const actorId = cleanText(actor?.id || actor?.email || 'admin', 200);
            const actorLabel = cleanText(actor?.username || actor?.email || actorId, 300);
            const titleOverride = cleanText(input.titleOverride, 300) || null;
            const categoryOverride = cleanText(input.categoryOverride, 120) || null;
            const levelOverride = cleanText(input.levelOverride, 120) || null;

            const updateResult = await client.query(`
                UPDATE learning_mapping_review_queue
                SET decision = $2,
                    target_path_id = $3,
                    target_module_key = $4,
                    requirement_type = $5,
                    proposed_sequence = $6,
                    review_status = $7,
                    review_notes = $8,
                    reviewed_by = $9,
                    reviewed_at = $10,
                    revision = revision + 1,
                    updated_at = NOW()
                WHERE content_id = $1
                RETURNING *
            `, [
                contentId,
                decision,
                targetPathId,
                targetModuleKey,
                requirementType,
                proposedSequence,
                reviewStatus,
                reviewNotes,
                isFinalReview ? actorLabel : null,
                isFinalReview ? new Date() : null
            ]);

            const disposition = reviewStatus === 'rejected'
                ? 'needs_review'
                : decision === 'library_only'
                ? 'library_only'
                : decision === 'needs_review'
                    ? 'needs_review'
                    : decision === 'retired'
                        ? 'retired'
                        : 'mapped';
            await client.query(`
                UPDATE learning_content_registry
                SET title_override = $2,
                    category_override = $3,
                    level_override = $4,
                    review_disposition = $5,
                    status = CASE
                        WHEN $5 = 'retired' THEN 'retired'
                        WHEN status = 'retired' THEN 'active'
                        ELSE status
                    END,
                    updated_at = NOW()
                WHERE content_id = $1
            `, [contentId, titleOverride, categoryOverride, levelOverride, disposition]);

            const updated = updateResult.rows[0];
            const action = reviewStatus === 'approved'
                ? 'approved'
                : reviewStatus === 'rejected'
                    ? 'rejected'
                    : reviewStatus === 'retired'
                        ? 'retired'
                        : (current.review_status === 'approved' ? 'reopened' : 'updated');
            await client.query(`
                INSERT INTO learning_mapping_review_events (
                    content_id, action, actor_id, actor_label, before_state, after_state
                ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
            `, [
                contentId,
                action,
                actorId,
                actorLabel,
                JSON.stringify(current),
                JSON.stringify(updated)
            ]);

            await client.query('COMMIT');
            const refreshed = await getQueue({ query: contentId, limit: 5 });
            return refreshed.items.find((item) => item.contentId === contentId) || null;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    return {
        getEvents,
        getOptions: () => OPTIONS,
        getQueue,
        getSummary,
        updateQueueItem
    };
}

createLearningMappingQueueService.QueueError = QueueError;

module.exports = createLearningMappingQueueService;
