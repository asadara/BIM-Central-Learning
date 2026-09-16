// Run: node scripts/test-bim-kpi-workflow.js
// Uses session-local PostgreSQL temporary tables and always rolls back.
// Production tables are read only to copy schema and the indicator catalog.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Client } = require('pg');
const { createPgConfig } = require('../backend/config/runtimeConfig');

const tables = [
    'bim_kpi_scorecards', 'bim_kpi_indicators', 'bim_kpi_programs',
    'bim_kpi_individual_scorecards', 'bim_kpi_assignments',
    'bim_kpi_assignment_task_claims', 'bim_ops_tasks', 'bim_ops_worklogs'
];

function loadRoutes(client) {
    const routes = new Map();
    const router = { use() {} };
    for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
        router[method] = (url, handler) => routes.set(`${method} ${url}`, handler);
    }
    const filename = path.resolve(__dirname, '../backend/routes/bimWorkspaceRoutes.js');
    const nativeRequire = createRequire(filename);
    const context = {
        module: { exports: {} }, __dirname: path.dirname(filename), console, process,
        require(name) {
            if (name === 'express') return { Router: () => router };
            if (name === 'pg') return { Pool: class { constructor() { return { query: client.query.bind(client), on() {} }; } } };
            return nativeRequire(name);
        }
    };
    // Invoke the real route handlers after authentication, using explicit test roles.
    // Schema bootstrap and audit/event writes are outside this calculation test.
    vm.runInNewContext(fs.readFileSync(filename, 'utf8') + `
        logActivity = async () => {};
        module.exports = { loadKpiOperations, loadKpiGuidance, resolveKpiTaskLink,
            calculateDivisionProgramResult, buildDivisionContributionPackage };
    `, context, { filename });
    return {
        ...context.module.exports,
        invoke(method, url, id, body = {}, role = 'staff_bim') {
            const handler = routes.get(`${method} ${url}`);
            assert.ok(handler, `Missing route ${method} ${url}`);
            return new Promise((resolve, reject) => {
                let status = 200;
                handler({ params: { id }, body, query: { year: 2026 }, workspaceRole: role,
                    workspaceUser: { id: role === 'staff_bim' ? 'test-staff' : 'test-head', username: 'KPI test' } },
                { status(value) { status = value; return this; }, json(data) { resolve({ status, data }); } }, reject);
            });
        }
    };
}

async function main() {
    const client = new Client(createPgConfig({ connectionTimeoutMillis: 5000 }));
    await client.connect();
    let passed = 0;
    const check = async (name, test) => { await test(); passed++; console.log(`PASS ${name}`); };
    try {
        await client.query('BEGIN');
        await client.query("SET LOCAL search_path TO pg_temp");
        await client.query("SET LOCAL statement_timeout TO '10s'");
        for (const table of tables) {
            await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
        }
        for (const table of tables.slice(0, 3)) {
            await client.query(`INSERT INTO pg_temp.${table} SELECT * FROM public.${table} WHERE ${table === 'bim_kpi_indicators' ? "scorecard_id IN (SELECT id FROM pg_temp.bim_kpi_scorecards)" : 'period_year=2026'}`);
        }
        // Any unqualified query can only see the temporary fixtures, never public tables.
        for (const table of tables) {
            const result = await client.query('SELECT pg_my_temp_schema() = relnamespace AS isolated FROM pg_class WHERE oid=to_regclass($1)', [table]);
            assert.equal(result.rows[0].isolated, true);
        }
        await client.query(`UPDATE bim_kpi_programs SET target_value=10 WHERE id='program-bim-2026-03'`);
        await client.query(`INSERT INTO bim_kpi_individual_scorecards (id,period_year,staff_user_id,staff_name_snapshot)
            VALUES ('test-card',2026,'test-staff','KPI test staff')`);
        await client.query(`INSERT INTO bim_kpi_assignments
            (id,scorecard_id,program_id,division_indicator_id,staff_user_id,staff_name_snapshot,commitment_title,
             target_value,target_unit,approved_weight,status,created_by_user_id,created_by_name_snapshot)
            VALUES ('test-assignment','test-card','program-bim-2026-03','kpi-div-bim-2026-03','test-staff',
                'KPI test staff','Synthetic support contribution',2,'request',0.15,'approved','test-head','KPI test head')`);
        await client.query(`INSERT INTO bim_ops_tasks
            (id,period_month,title,pic_user_id,pic_name_snapshot,intake_status,status,due_date,
             kpi_division_indicator_id,created_by_user_id,created_by_name_snapshot)
            VALUES ('test-task','2026-09','Synthetic tender support','test-staff','KPI test staff','approved','in_progress',
                CURRENT_DATE+1,'kpi-div-bim-2026-03','test-staff','KPI test staff')`);
        const api = loadRoutes(client);
        await check('division-only mapping does not create individual credit', async () => {
            const link = await api.resolveKpiTaskLink({}, 'kpi-div-bim-2026-03', '', 'test-staff', 2026);
            assert.equal(link.assignmentId, null);
            assert.equal((await api.loadKpiOperations(2026)).division.score, 0);
        });
        await check('task completion and approval leave KPI unchanged', async () => {
            assert.equal((await api.invoke('post', '/tasks/:id/submit-completion', 'test-task')).status, 200);
            assert.equal((await api.invoke('post', '/tasks/:id/completion-review', 'test-task', { action: 'approve' }, 'division_head')).status, 200);
            const operations = await api.loadKpiOperations(2026);
            assert.equal(operations.cards[0].score, 0);
            assert.equal(operations.division.score, 0);
        });
        await check('completed unclaimed task appears in staff guidance', async () => {
            const guidance = await api.loadKpiGuidance({ workspaceRole: 'staff_bim', workspaceUser: { id: 'test-staff' } }, 2026, await api.loadKpiOperations(2026));
            assert.ok(guidance.items.some(item => item.action === 'kpi-claim-actual' && item.taskIds.includes('test-task')));
            assert.equal(guidance.workflow, undefined, 'Staff must not receive the division-wide preparation list');
        });
        await check('head sees the preparation bottleneck when no actual awaits verification', async () => {
            const guidance = await api.loadKpiGuidance({ workspaceRole: 'division_head' }, 2026, await api.loadKpiOperations(2026));
            assert.equal(guidance.workflow.pendingVerificationCount, 0);
            assert.equal(guidance.workflow.awaitingSubmissionCount, 1);
            assert.equal(guidance.workflow.unclaimedTaskCount, 1);
            assert.equal(guidance.workflow.unclaimedTasks[0].indicatorCode, 'BIM-03');
            assert.equal(guidance.workflow.unclaimedTasks[0].hasEvidence, false);
        });
        await check('verification preview rejects unsubmitted actual', async () => {
            assert.equal((await api.invoke('get', '/kpi/assignments/:id/verification-preview', 'test-assignment', {}, 'division_head')).status, 409);
        });
        await check('actual submission requires evidence', async () => {
            assert.equal((await api.invoke('post', '/kpi/assignments/:id/submit-actual', 'test-assignment', { actualValue: 2 })).status, 400);
        });
        await check('submitted actual waits for verification before score increases', async () => {
            const result = await api.invoke('post', '/kpi/assignments/:id/submit-actual', 'test-assignment', {
                actualValue: 2, evidenceLink: 'https://example.test/evidence', taskIds: ['test-task']
            });
            assert.equal(result.status, 200);
            assert.equal(result.data.status, 'verification_pending');
            assert.equal((await api.loadKpiOperations(2026)).division.score, 0);
        });
        await check('staff cannot verify own actual', async () => {
            assert.equal((await api.invoke('post', '/kpi/assignments/:id/verify', 'test-assignment', { action: 'approve' })).status, 403);
            assert.equal((await api.invoke('get', '/kpi/assignments/:id/verification-preview', 'test-assignment')).status, 403);
        });
        await check('pending claims move from preparation to the head verification queue', async () => {
            const guidance = await api.loadKpiGuidance({ workspaceRole: 'division_head' }, 2026, await api.loadKpiOperations(2026));
            assert.equal(guidance.workflow.unclaimedTaskCount, 0);
            assert.equal(guidance.workflow.pendingVerificationCount, 1);
            const preview = await api.invoke('get', '/kpi/assignments/:id/verification-preview', 'test-assignment', {}, 'division_head');
            assert.equal(preview.status, 200);
            assert.equal(preview.data.assignment.submittedActual, 2);
            assert.equal(preview.data.performance.tasks[0].title, 'Synthetic tender support');
            assert.equal(preview.data.performance.factor, 0.96);
            assert.equal(preview.data.performance.tasks[0].hoursSpent, undefined);
        });
        await check('unfinished linked task blocks actual verification', async () => {
            await client.query(`UPDATE bim_ops_tasks SET status='in_progress' WHERE id='test-task'`);
            const result = await api.invoke('post', '/kpi/assignments/:id/verify', 'test-assignment', { action: 'approve' }, 'division_head');
            assert.equal(result.status, 409);
            assert.equal(result.data.incompleteTaskCount, 1);
            const preview = await api.invoke('get', '/kpi/assignments/:id/verification-preview', 'test-assignment', {}, 'division_head');
            assert.equal(preview.data.performance.incompleteTaskCount, 1);
            await client.query(`UPDATE bim_ops_tasks SET status='approved_done' WHERE id='test-task'`);
        });
        await check('verified actual increases individual and division scores', async () => {
            const result = await api.invoke('post', '/kpi/assignments/:id/verify', 'test-assignment', { action: 'approve', verifiedActual: 2 }, 'division_head');
            assert.equal(result.status, 200);
            assert.equal(result.data.status, 'achieved');
            // On time, no revisions, no worklog: factor 0.96; individual target 2, division target 10.
            const operations = await api.loadKpiOperations(2026);
            assert.equal(operations.cards[0].score, 0.144);
            assert.equal(operations.division.score, 0.0288);
            assert.equal(operations.division.measuredIndicatorCount, 1);
            const task = (await client.query(`SELECT kpi_assignment_id FROM bim_ops_tasks WHERE id='test-task'`)).rows[0];
            assert.equal(task.kpi_assignment_id, 'test-assignment');
            const guidance = await api.loadKpiGuidance({ workspaceRole: 'division_head' }, 2026, operations);
            assert.equal(guidance.workflow.verifiedCount, 1);
            assert.equal(guidance.workflow.pendingVerificationCount, 0);
            console.log('RESULT individual=14.4%, division=2.88%, taskPerformanceFactor=0.96');
        });
        await check('same task cannot be claimed twice', async () => {
            const result = await api.invoke('post', '/kpi/assignments/:id/submit-actual', 'test-assignment', {
                actualValue: 2, evidenceLink: 'https://example.test/evidence', taskIds: ['test-task']
            });
            assert.equal(result.status, 400);
        });
        await check('department receives contribution package, not an automatic score', async () => {
            const packet = api.buildDivisionContributionPackage(2026, await api.loadKpiOperations(2026));
            assert.ok(packet.contributions.some(item => item.measured));
            assert.ok(packet.contributions.every(item => item.departmentIndicator.score === null));
        });
        await check('missing division denominator is unmeasured and achievement cap is 120%', async () => {
            const assignment = { status: 'achieved', verifiedActual: 100, targetValue: 2, taskPerformanceFactor: 1 };
            const row = { calculation_config: { mode: 'ratio' }, target_value: null, indicator_target_value: 1, indicator_weight: 0.15 };
            assert.equal(api.calculateDivisionProgramResult(row, [assignment]).measured, false);
            row.target_value = 10;
            assert.equal(api.calculateDivisionProgramResult(row, [assignment]).rawAchievement, 1.2);
        });
        console.log(`${passed} checks passed. All fixtures rolled back; production KPI data unchanged.`);
    } finally {
        await client.query('ROLLBACK');
        await client.end();
    }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { loadRoutes };
