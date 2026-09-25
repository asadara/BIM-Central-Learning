'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { validateManifest } = require('../services/internshipPilotManifestValidator');

const manifestArgIndex = process.argv.indexOf('--manifest');
const defaultManifest = path.join(__dirname, '..', 'elearning', 'data', 'internship-pilot-manifest-v1.json');
const manifestPath = path.resolve(manifestArgIndex >= 0 ? String(process.argv[manifestArgIndex + 1] || '') : defaultManifest);
const allowBlocked = process.argv.includes('--allow-blocked');

function repositorySnapshot(manifest) {
    const sourceRoot = path.join(__dirname, '..', '..', 'BC-Learning-Main');
    const routeFile = path.join(sourceRoot, String(manifest.learning[0] && manifest.learning[0].route || '').replace(/^\/+/, ''));
    const migration = fs.readFileSync(path.join(__dirname, '20260924-internship-phase1a.sql'), 'utf8');
    const content = manifest.learning[0];
    const seeded = content && migration.includes(`'${content.contentId}'`)
        && migration.includes(`'${manifest.learningPath.versionId}'::uuid`);
    return {
        learningPath: seeded ? {
            versionId: manifest.learningPath.versionId,
            learningPathId: manifest.learningPath.learningPathId,
            versionNumber: manifest.learningPath.versionNumber,
            status: 'published',
            source: 'repository-migration'
        } : null,
        contents: content && seeded ? [{
            contentId: content.contentId,
            contentStatus: 'active',
            mappingStatus: 'approved',
            requirementType: 'required',
            resolved: fs.existsSync(routeFile),
            source: 'repository-migration-and-route'
        }] : [],
        quizzes: []
    };
}

async function inspectDatabase(client, manifest) {
    const names = [
        'training_batches', 'batch_members', 'learning_path_versions', 'learning_path_modules',
        'module_content_mappings', 'learning_content_registry', 'internship_batch_config',
        'internship_program_policy_versions', 'classwork_items', 'classwork_content_links', 'review_criteria'
    ];
    const availability = (await client.query(
        `SELECT name, to_regclass(current_schema() || '.' || name) IS NOT NULL AS available
         FROM unnest($1::text[]) AS name`, [names]
    )).rows;
    const available = new Set(availability.filter((item) => item.available).map((item) => item.name));
    const columnRows = (await client.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`, [names]
    )).rows;
    const columns = new Set(columnRows.map((item) => `${item.table_name}.${item.column_name}`));
    const hasColumn = (table, column) => columns.has(`${table}.${column}`);
    const requiredSchema = ['training_batches', 'batch_members', 'learning_path_versions', 'learning_path_modules',
        'module_content_mappings', 'learning_content_registry', 'internship_batch_config',
        'internship_program_policy_versions', 'classwork_items', 'classwork_content_links', 'review_criteria'];
    const snapshot = {
        databaseChecked: true,
        missingSchemas: [
            ...requiredSchema.filter((name) => !available.has(name)),
            ...(available.has('training_batches') && !hasColumn('training_batches', 'program_type')
                ? ['training_batches.program_type'] : []),
            ...(available.has('classwork_items') && !hasColumn('classwork_items', 'participant_visibility')
                ? ['classwork_items.participant_visibility'] : []),
            ...(available.has('classwork_items') && !hasColumn('classwork_items', 'required_deliverable')
                ? ['classwork_items.required_deliverable'] : [])
        ],
        assignments: [],
        quizzes: [],
        learningContractChecked: true,
        members: []
    };
    const audit = { tables: Object.fromEntries(availability.map((item) => [item.name, item.available])), practiceTasks: null };

    if (available.has('training_batches')) {
        snapshot.batch = (await client.query(
            `SELECT id, code, status,
                    ${hasColumn('training_batches', 'program_type') ? 'program_type' : "'legacy_untyped'::text"} AS "programType",
                    start_date AS "startDate", end_date AS "endDate"
             FROM training_batches WHERE id = $1`, [manifest.program.batchId]
        )).rows[0] || null;
    }
    if (available.has('learning_path_versions')) {
        const deployed = (await client.query(
            `SELECT id::text AS "versionId", learning_path_id AS "learningPathId", version_number AS "versionNumber", status
             FROM learning_path_versions WHERE id = $1::uuid`, [manifest.learningPath.versionId]
        )).rows[0];
        if (deployed) snapshot.learningPath = deployed;
    }
    if (['learning_path_modules', 'module_content_mappings', 'learning_content_registry'].every((name) => available.has(name))) {
        const deployedContents = (await client.query(
            `SELECT mcm.content_id AS "contentId", lcr.status AS "contentStatus",
                    mcm.mapping_status AS "mappingStatus", mcm.requirement_type AS "requirementType", TRUE AS resolved
             FROM learning_path_modules lpm
             JOIN module_content_mappings mcm ON mcm.module_id = lpm.id
             JOIN learning_content_registry lcr ON lcr.content_id = mcm.content_id
             WHERE lpm.path_version_id = $1::uuid`, [manifest.learningPath.versionId]
        )).rows;
        if (deployedContents.length) snapshot.contents = deployedContents;
    }
    if (available.has('classwork_items')) {
        audit.practiceTasks = (await client.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'published')::int AS published,
                    COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
             FROM classwork_items WHERE type = 'practice_task'`
        )).rows[0];
        audit.practiceTaskCandidates = (await client.query(
            `SELECT id AS "assignmentId", batch_id AS "batchId", title, topic_id AS "topicId", status,
                    due_at AS "dueAt",
                    ${hasColumn('classwork_items', 'participant_visibility') ? 'participant_visibility' : "'unknown'::text"} AS "participantVisibility",
                    ${hasColumn('classwork_items', 'required_deliverable') ? 'required_deliverable' : 'NULL::text'} AS "requiredDeliverable"
             FROM classwork_items WHERE type = 'practice_task'
             ORDER BY batch_id, sort_order, created_at, id`
        )).rows;
        snapshot.assignments = (await client.query(
            `SELECT id AS "assignmentId", batch_id AS "batchId", title, status,
                    ${hasColumn('classwork_items', 'participant_visibility') ? 'participant_visibility' : "'unknown'::text"} AS "participantVisibility",
                    ${hasColumn('classwork_items', 'required_deliverable') ? 'required_deliverable' : 'NULL::text'} AS "requiredDeliverable",
                    ${hasColumn('classwork_items', 'available_at') ? 'available_at' : 'NULL::timestamptz'} AS "availableAt",
                    due_at AS "dueAt"
             FROM classwork_items WHERE batch_id = $1 AND type = 'practice_task'
             ORDER BY sort_order, created_at, id`, [manifest.program.batchId]
        )).rows;
    }
    if (snapshot.batch && available.has('batch_members')) {
        snapshot.members = (await client.query(
            `SELECT user_id AS "canonicalUserId", role, enrollment_status AS "enrollmentStatus"
             FROM batch_members WHERE batch_id = $1 ORDER BY role, user_id`, [manifest.program.batchId]
        )).rows;
        audit.roles = snapshot.members.map((item) => ({ role: item.role, enrollmentStatus: item.enrollmentStatus }));
    }
    if (available.has('internship_program_policy_versions')) {
        const policy = (await client.query(
            `SELECT id, status, payload_json->>'manifestVersion' AS "manifestVersion",
                    payload_json->>'manifestDigest' AS "manifestDigest"
             FROM internship_program_policy_versions WHERE id = $1`, [manifest.policy.policyVersionId]
        )).rows[0];
        snapshot.policy = policy || null;
    }
    return { snapshot, audit };
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const source = repositorySnapshot(manifest);
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    const client = await pool.connect();
    let inspected;
    try {
        await client.query('BEGIN READ ONLY');
        inspected = await inspectDatabase(client, manifest);
        await client.query('ROLLBACK');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }

    const snapshot = {
        ...inspected.snapshot,
        learningPath: inspected.snapshot.learningPath || source.learningPath,
        contents: inspected.snapshot.contents || source.contents,
        quizzes: inspected.snapshot.quizzes || source.quizzes
    };
    const result = validateManifest(manifest, snapshot);
    const output = {
        manifestPath,
        manifestVersion: manifest.manifestVersion,
        valid: result.valid,
        readiness: result.readiness,
        errors: result.errors,
        warnings: result.warnings,
        summary: result.summary,
        repositoryResolution: {
            learningPath: Boolean(source.learningPath),
            requiredContent: source.contents.filter((item) => item.resolved).map((item) => item.contentId)
        },
        databaseAudit: inspected.audit,
        mutationPerformed: false
    };
    console.log(JSON.stringify(output, null, 2));
    if (!result.valid && !allowBlocked) process.exitCode = 1;
}

main().catch((error) => {
    console.error(JSON.stringify({ valid: false, readiness: 'BLOCKED', error: error.message, mutationPerformed: false }, null, 2));
    process.exitCode = 1;
});
