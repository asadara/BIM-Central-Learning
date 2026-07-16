const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');

const candidates = require(path.join(__dirname, '../elearning/learning-mapping-candidates.json'));
const apply = process.argv.includes('--apply');

function queueRow(candidate) {
    const primaryTarget = Array.isArray(candidate.targets) ? candidate.targets[0] : null;
    const decision = candidate.decision;
    return {
        contentId: candidate.contentId,
        decision,
        targetPathId: primaryTarget?.pathId || null,
        targetModuleKey: primaryTarget?.moduleKey || null,
        requirementType: ['required', 'elective'].includes(decision) ? decision : null,
        proposedSequence: primaryTarget?.proposedSequence || null,
        reviewStatus: decision === 'needs_review' ? 'needs_review' : 'candidate',
        reviewNotes: candidate.reason || '',
        payload: candidate
    };
}

async function main() {
    const rows = candidates.decisions.map(queueRow);
    if (!apply) {
        console.log(JSON.stringify({
            mode: 'dry-run',
            candidates: rows.length,
            writes: 0,
            autoApproved: 0
        }, null, 2));
        return;
    }

    const pool = new Pool(createPgConfig({ max: 2 }));
    const client = await pool.connect();
    let inserted = 0;
    let refreshed = 0;
    try {
        await client.query('BEGIN');
        for (const row of rows) {
            const result = await client.query(`
                INSERT INTO learning_mapping_review_queue (
                    content_id, decision, target_path_id, target_module_key,
                    requirement_type, proposed_sequence, review_status,
                    review_notes, candidate_payload
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
                ON CONFLICT (content_id) DO UPDATE SET
                    candidate_payload = EXCLUDED.candidate_payload,
                    updated_at = CASE
                        WHEN learning_mapping_review_queue.candidate_payload IS DISTINCT FROM EXCLUDED.candidate_payload
                        THEN NOW()
                        ELSE learning_mapping_review_queue.updated_at
                    END
                RETURNING (xmax = 0) AS inserted
            `, [
                row.contentId,
                row.decision,
                row.targetPathId,
                row.targetModuleKey,
                row.requirementType,
                row.proposedSequence,
                row.reviewStatus,
                row.reviewNotes,
                JSON.stringify(row.payload)
            ]);
            if (result.rows[0].inserted) {
                inserted += 1;
                await client.query(`
                    INSERT INTO learning_mapping_review_events (
                        content_id, action, actor_id, actor_label, after_state
                    ) VALUES ($1, 'seeded', 'system-seed', 'Phase 0 candidate import', $2::jsonb)
                `, [row.contentId, JSON.stringify(row)]);
            } else {
                refreshed += 1;
            }
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }

    console.log(JSON.stringify({
        mode: 'apply',
        total: rows.length,
        inserted,
        refreshed,
        autoApproved: 0
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
