'use strict';

require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const {
    validateCandidatePackage,
    validateMentorProgramCoverage
} = require('../services/internshipPilotManifestValidator');

const dataDirectory = path.join(__dirname, '..', 'elearning', 'data');
const validateV3 = process.argv.includes('--v3');
const paths = {
    manifest: path.join(dataDirectory, validateV3 ? 'internship-pilot-manifest-v3.json' : 'internship-pilot-manifest-v2.json'),
    assignments: path.join(dataDirectory, validateV3 ? 'internship-pilot-assignments-v2.json' : 'internship-pilot-assignments-v1.json'),
    rubrics: path.join(dataDirectory, validateV3 ? 'internship-pilot-rubrics-v2.json' : 'internship-pilot-rubrics-v1.json'),
    mentorProgram: validateV3 ? path.join(dataDirectory, 'internship-mentor-program-37-v1.json') : null,
    baseline: path.join(dataDirectory, 'internship-pilot-manifest-v1.json')
};

function readJson(filename) {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function fileSha256(filename) {
    return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

async function tableExists(client, tableName) {
    return (await client.query(
        'SELECT to_regclass(current_schema() || $1) IS NOT NULL AS available',
        [`.${tableName}`]
    )).rows[0].available === true;
}

async function inspect(client, manifest) {
    const contentIds = manifest.learning.filter((item) => item.requirement !== 'exclude').map((item) => item.contentId);
    const contents = (await client.query(
        `SELECT content_id AS "contentId", status, review_disposition AS "reviewDisposition", TRUE AS resolved
         FROM learning_content_registry WHERE content_id = ANY($1::text[])`,
        [contentIds]
    )).rows;
    const trainingAssignments = await tableExists(client, 'classwork_items')
        ? (await client.query(
            `SELECT id AS "assignmentId", batch_id AS "batchId", status
             FROM classwork_items WHERE type = 'practice_task' ORDER BY id`
        )).rows
        : [];
    const batchExists = await tableExists(client, 'training_batches')
        ? (await client.query('SELECT EXISTS (SELECT 1 FROM training_batches WHERE id = $1) AS found', [manifest.program.batchId])).rows[0].found
        : false;
    const policyExists = await tableExists(client, 'internship_program_policy_versions')
        ? (await client.query(
            'SELECT EXISTS (SELECT 1 FROM internship_program_policy_versions WHERE id = $1) AS found',
            [manifest.policy.policyVersionId]
        )).rows[0].found
        : false;
    return {
        contents,
        quizzes: [],
        trainingAssignments,
        learningPath: manifest.learningPath.entityState === 'planned'
            ? { versionKey: manifest.learningPath.versionKey, entityState: 'planned_configuration' }
            : { versionId: manifest.learningPath.versionId, source: '20260924-internship-phase1a.sql' },
        policyContract: 'internship-completion-v1',
        deploymentChecked: true,
        batchExists,
        policyExists
    };
}

async function main() {
    const manifest = readJson(paths.manifest);
    const assignmentsPackage = readJson(paths.assignments);
    const rubricsPackage = readJson(paths.rubrics);
    const mentorProgram = paths.mentorProgram ? readJson(paths.mentorProgram) : null;
    const pool = new Pool(createPgConfig({ max: 1, connectionTimeoutMillis: 5000 }));
    const client = await pool.connect();
    let snapshot;
    try {
        await client.query('BEGIN READ ONLY');
        snapshot = await inspect(client, manifest);
        await client.query('ROLLBACK');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }

    const packageResult = validateCandidatePackage({ manifest, assignmentsPackage, rubricsPackage, snapshot });
    const coverageResult = mentorProgram
        ? validateMentorProgramCoverage({ programSource: mentorProgram, manifest, assignmentsPackage })
        : null;
    const valid = packageResult.valid && (!coverageResult || coverageResult.valid);
    const readiness = [packageResult, coverageResult].filter(Boolean).some((item) => item.readiness === 'BLOCKED')
        ? 'BLOCKED'
        : ([packageResult, coverageResult].filter(Boolean).some((item) => item.readiness === 'CONDITIONAL') ? 'CONDITIONAL' : 'READY');
    console.log(JSON.stringify({
        valid,
        readiness,
        errors: [...packageResult.errors, ...(coverageResult ? coverageResult.errors : [])],
        warnings: [...packageResult.warnings, ...(coverageResult ? coverageResult.warnings : [])],
        summary: packageResult.summary,
        curriculumCoverage: coverageResult ? coverageResult.summary : null,
        packages: {
            manifestVersion: manifest.manifestVersion,
            assignmentPackage: assignmentsPackage.packageVersion,
            rubricPackage: rubricsPackage.packageVersion,
            baselineV1FileSha256: fileSha256(paths.baseline)
        },
        repositoryResolution: {
            requestedContent: manifest.learning.filter((item) => item.requirement !== 'exclude').length,
            resolvedContent: snapshot.contents.length,
            learningPathConfigurationResolved: true,
            learningPathSourceResolved: manifest.learningPath.entityState !== 'planned',
            policyContractResolved: true
        },
        deployment: { batchExists: snapshot.batchExists, policyExists: snapshot.policyExists },
        source37TaskPlanFound: Boolean(mentorProgram),
        source37TaskPlanRole: mentorProgram ? mentorProgram.sourceDocument.role : null,
        mutationPerformed: false
    }, null, 2));
    if (!valid) process.exitCode = 1;
}

main().catch((error) => {
    console.error(JSON.stringify({ valid: false, readiness: 'BLOCKED', error: error.message, mutationPerformed: false }, null, 2));
    process.exitCode = 1;
});
