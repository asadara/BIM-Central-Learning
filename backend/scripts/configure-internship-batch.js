'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { validateManifest, toPolicyPayload } = require('../services/internshipPilotManifestValidator');

const apply = process.argv.includes('--apply');
const batchArgIndex = process.argv.indexOf('--batch-id');
const manifestArgIndex = process.argv.indexOf('--manifest');
const batchId = batchArgIndex >= 0 ? String(process.argv[batchArgIndex + 1] || '').trim() : '';
const defaultManifest = path.join(__dirname, '..', 'elearning', 'data', 'internship-pilot-manifest-v1.json');
const manifestPath = path.resolve(manifestArgIndex >= 0 ? String(process.argv[manifestArgIndex + 1] || '') : defaultManifest);

if (!/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(batchId)) {
    console.error('Usage: node backend/scripts/configure-internship-batch.js --batch-id <id> [--manifest <json>] [--apply]');
    process.exit(1);
}

async function loadTargetSnapshot(client, manifest) {
    const batch = (await client.query(
        'SELECT id, code, title, status, program_type AS "programType" FROM training_batches WHERE id = $1',
        [batchId]
    )).rows[0] || null;
    const learningPath = (await client.query(
        `SELECT id::text AS "versionId", learning_path_id AS "learningPathId", version_number AS "versionNumber", status
         FROM learning_path_versions WHERE id = $1::uuid`,
        [manifest.learningPath.versionId]
    )).rows[0] || null;
    const contents = (await client.query(
        `SELECT mcm.content_id AS "contentId", lcr.status AS "contentStatus",
                mcm.mapping_status AS "mappingStatus", mcm.requirement_type AS "requirementType", TRUE AS resolved
         FROM learning_path_modules lpm
         JOIN module_content_mappings mcm ON mcm.module_id = lpm.id
         JOIN learning_content_registry lcr ON lcr.content_id = mcm.content_id
         WHERE lpm.path_version_id = $1::uuid`,
        [manifest.learningPath.versionId]
    )).rows;
    const assignments = (await client.query(
        `SELECT ci.id AS "assignmentId", ci.batch_id AS "batchId", ci.status,
                ci.participant_visibility AS "participantVisibility",
                'md5:' || md5(concat_ws(E'\\x1f', ci.id, COALESCE(ci.title, ''), COALESCE(ci.instructions, ''),
                    COALESCE(ci.required_deliverable, ''), COALESCE(ci.participant_visibility, ''), COALESCE(ci.topic_id, '')))
                    AS "definitionDigest"
         FROM classwork_items ci WHERE ci.batch_id = $1`,
        [batchId]
    )).rows;
    return { batch, learningPath, contents, assignments, quizzes: [], learningContractChecked: true };
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.program.batchId !== batchId) {
        throw new Error(`Manifest batchId ${manifest.program.batchId} does not match --batch-id ${batchId}`);
    }

    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const snapshot = await loadTargetSnapshot(client, manifest);
        const validation = validateManifest(manifest, snapshot);
        if (!snapshot.batch) validation.errors.push({ code: 'pilot_batch_unresolved', message: `Training batch not found: ${batchId}.` });
        if (snapshot.batch && snapshot.batch.code !== manifest.program.programCode) {
            validation.errors.push({ code: 'program_code_mismatch', message: 'Batch code does not match frozen manifest programCode.' });
        }
        validation.valid = validation.errors.length === 0;
        validation.readiness = validation.valid ? (validation.warnings.length ? 'CONDITIONAL' : 'READY') : 'BLOCKED';

        if (apply && !validation.valid) throw new Error(`Manifest validation blocked apply: ${validation.errors.map((item) => item.code).join(', ')}`);
        if (apply) {
            const payload = toPolicyPayload(manifest);
            await client.query("UPDATE training_batches SET program_type = 'internship', updated_at = NOW() WHERE id = $1", [batchId]);
            await client.query(
                `INSERT INTO internship_program_policy_versions (
                    id, policy_key, version_number, status, payload_json, checksum,
                    created_by, frozen_by, frozen_at
                 ) VALUES ($1, $2, $3, 'frozen', $4::jsonb, md5($4::jsonb::text), $5, $5, CURRENT_TIMESTAMP)`,
                [manifest.policy.policyVersionId, `internship-batch:${batchId}`, manifest.policy.versionNumber,
                    JSON.stringify(payload), 'script:configure-internship-batch']
            );
            await client.query(
                `INSERT INTO internship_batch_config (
                    batch_id, learning_path_version_id, policy_json, policy_version_id
                 ) VALUES ($1, $2::uuid, $3::jsonb, $4)`,
                [batchId, manifest.learningPath.versionId,
                    JSON.stringify({ calculationVersion: 'internship-progress-v1', manifestVersion: manifest.manifestVersion }),
                    manifest.policy.policyVersionId]
            );
            await client.query('COMMIT');
        } else {
            await client.query('ROLLBACK');
        }

        console.log(JSON.stringify({
            mode: apply ? 'applied' : 'dry-run',
            manifestPath,
            manifestVersion: manifest.manifestVersion,
            batch: snapshot.batch,
            validation,
            assignmentAuthority: 'frozen-manifest-only',
            inferredAssignments: 0
        }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
