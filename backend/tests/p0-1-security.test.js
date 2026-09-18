const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

module.exports = async function runSecurityTests() {
    assert.ok(process.env.P0_TEST_WORKDIR, 'Run through scripts/test-p0-security.js');
    const pg = require('pg');
    const OriginalPool = pg.Pool;
    const pools = [];
    pg.Pool = class TestPool extends OriginalPool {
        constructor(config) {
            assert.equal(String(config.port), process.env.P0_TEST_PORT, 'Only isolated PostgreSQL is allowed');
            assert.equal(config.host, '127.0.0.1');
            super(config);
            pools.push(this);
        }
    };
    const { createPgConfig } = require('../config/runtimeConfig');
    const pool = new pg.Pool(createPgConfig());
    const express = require('express');
    const session = require('express-session');
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcrypt');
    const credentials = require('../utils/credentials');
    const identity = require('../utils/canonicalIdentity');
    const auth = require('../utils/auth');
    const { preflight, applyMigration, userSnapshot } = require('../scripts/run-p0-security-migration');
    const secretKey = process.env.JWT_SECRET;
    const app = express();
    const sessions = new (require('../services/adminSessionStore'))(pool);
    let runtime;
    let server;
    let count = 0;
    let failDatabase = false;
    let legacyWrites = 0;
    const legacy = [{ id: 'json_123', email: 'legacy@example.test', username: 'legacy', password: await bcrypt.hash('legacy password', 10), isAdmin: true, systemRole: 'system_admin' }];
    const readUsers = () => structuredClone(legacy);
    const writeUsers = () => { legacyWrites++; throw new Error('Legacy writes forbidden in P0-1'); };
    const routePool = {
        query(...args) {
            if (failDatabase) return Promise.reject(Object.assign(new Error('Fixture database unavailable'), { code: 'ECONNREFUSED' }));
            return pool.query(...args);
        },
        on() {}, connect: (...args) => failDatabase ? Promise.reject(new Error('Fixture database unavailable')) : pool.connect(...args)
    };
    async function check(name, action) {
        await action();
        count++;
        console.log(`PASS ${count}: ${name}`);
    }
    async function token(userId, extra = {}) {
        const issued = await runtime.issue(userId, 'pwd');
        return jwt.sign({ ...jwt.decode(issued), ...extra }, secretKey, { algorithm: 'HS256' });
    }
    const requireAuth = auth.requireAuthenticated;
    let base;
    async function request(url, { method = 'GET', body, bearer, cookie } = {}) {
        const headers = { 'Content-Type': 'application/json', Origin:'https://bcl.nke.net', 'X-Forwarded-Proto':'https' };
        if (bearer) headers.Authorization = `Bearer ${bearer}`;
        if (cookie) headers.Cookie = cookie;
        const result = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
        return { status: result.status, data: await result.json(), cookie: result.headers.get('set-cookie')?.split(';')[0] };
    }
    let adminId, employeeId, otherId, employeeToken, adminToken;
    try {
        await pool.query(fs.readFileSync(path.join(__dirname, '../create-tables.sql'), 'utf8'));
        const oldHash = await bcrypt.hash('old123', 10);
        for (const [username, email, role] of [
            ['explicit_admin', 'admin@example.test', 'system_admin'],
            ['employee', 'employee@example.test', 'employee'],
            ['other', 'other@example.test', 'employee']
        ]) {
            const result = await pool.query(`INSERT INTO users(username,email,password,bim_level,system_role) VALUES($1,$2,$3,'BIM Modeller',$4) RETURNING id`, [username, email, oldHash, role]);
            if (role === 'system_admin') adminId = result.rows[0].id;
            else if (username === 'employee') employeeId = result.rows[0].id;
            else otherId = result.rows[0].id;
        }
        // Reproduce the operational level constraint that blocks signup without an assessment.
        await pool.query(`ALTER TABLE users ALTER COLUMN bim_level SET NOT NULL;
            ALTER TABLE users ADD CONSTRAINT users_bim_level_check CHECK(bim_level IN ('BIM Modeller','BIM Coordinator','BIM Manager'))`);
        const before = (await pool.query('SELECT row_to_json(u) AS row FROM users u ORDER BY id')).rows;
        const migrationClient = await pool.connect();
        try {
            await check('migration preflight, rollback, apply and repeat preserve every existing user field', async () => {
                const report = await preflight(migrationClient);
                const originalSnapshot = await userSnapshot(migrationClient);
                assert.equal(report.unsupported_passwords, 0);
                await migrationClient.query('BEGIN');
                await applyMigration(migrationClient);
                await migrationClient.query('ROLLBACK');
                assert.equal((await preflight(migrationClient)).level.is_nullable, 'NO');
                for (let attempt = 0; attempt < 2; attempt++) {
                    await migrationClient.query('BEGIN');
                    await applyMigration(migrationClient);
                    await migrationClient.query('COMMIT');
                }
                await migrationClient.query('BEGIN');
                await migrationClient.query(fs.readFileSync(path.join(__dirname, '../scripts/p0-1-security-rollback.sql'), 'utf8'));
                await migrationClient.query('COMMIT');
                assert.equal((await preflight(migrationClient)).level.is_nullable, 'NO');
                await migrationClient.query('BEGIN');
                await applyMigration(migrationClient);
                await migrationClient.query('COMMIT');
                assert.deepEqual((await pool.query('SELECT row_to_json(u) AS row FROM users u ORDER BY id')).rows, before);
                assert.deepEqual(await userSnapshot(migrationClient), originalSnapshot);
            });
        } finally { migrationClient.release(); }

        await check('database rejects ID mutation and plaintext password writes', async () => {
            await assert.rejects(pool.query('UPDATE users SET id = 1000 WHERE id=$1', [employeeId]), error => error.code === '23514');
            await assert.rejects(pool.query('UPDATE users SET password=$1 WHERE id=$2', ['plaintext', employeeId]), error => error.code === '23514');
            await assert.rejects(pool.query(`INSERT INTO users(username,email,password) VALUES('plain','plain@example.test','plaintext')`), error => error.code === '23514');
        });

        await require('../scripts/run-p0-auth-migration').applyMigration(pool);
        runtime = require('../services/authRuntime').createAuthRuntime({ pool: routePool, secret: secretKey });
        app.set('trust proxy','loopback');
        app.use(express.json());
        app.use(session({ name:'bcl.admin.sid', secret:process.env.SESSION_SECRET, resave:false, saveUninitialized:false,
            store:sessions, cookie:{secure:true,httpOnly:true,sameSite:'lax',maxAge:1800000} }));
        app.use(runtime.middleware);
        app.use(require('../routes/authLifecycleRoutes').createAuthLifecycleRoutes({auth:runtime,
            google:require('../services/googleIdentityService').createGoogleIdentityService({auth:runtime,clientId:'fixture-client'}),limiter:(req,res,next)=>next()}));
        server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
        base = `http://127.0.0.1:${server.address().port}`;
        const service = require('../services/userAuthService')({ backendDir: process.env.P0_TEST_WORKDIR, googleClientId: 'fixture-client', pgPool: routePool, readUsers, writeUsers });
        const dependencies = { authRuntime:runtime, ...service, ...credentials, googleClientId: 'fixture-client', pgPool: routePool, jwt, secretKey, requireAuth, authLimiter: (req, res, next) => next() };
        app.use(require('../routes/userAuthRoutes')(dependencies));
        app.use(require('../routes/adminSessionRoutes')(dependencies));
        app.use('/api/users', require('../routes/users').createUsersRoutes({ pool: routePool, readUsers }));
        app.use(require('../routes/serverManagementRoutes')({ backendDir: process.env.P0_TEST_WORKDIR, jwt, secretKey, spawn: () => { throw new Error('Never restart a server in tests'); }, videoCache: [] }));
        employeeToken = await token(employeeId, { email: 'employee@example.test' });
        adminToken = await token(adminId, { role: 'system_admin', email: 'admin@example.test' });

        await check('existing short bcrypt password still logs in by email and username', async () => {
            for (const identifier of ['employee@example.test', 'employee']) {
                const result = await request('/api/login', { method: 'POST', body: { email: identifier, password: 'old123' } });
                assert.equal(result.status, 200);
                assert.equal(result.data.id, employeeId);
                assert.equal(jwt.verify(result.data.token, secretKey).userId, String(employeeId));
            }
            assert.equal((await pool.query('SELECT password FROM users WHERE id=$1', [employeeId])).rows[0].password, oldHash);
        });
        let spaceId;
        await check('local signup hashes raw password including both boundary spaces, with stable login policy', async () => {
            const result = await request('/api/signup', { method: 'POST', body: { username: 'spaces', email: 'spaces@example.test', password: '  pass word  ', positionLabel: 'Administrator' } });
            assert.equal(result.status, 201, JSON.stringify(result.data));
            spaceId = result.data.user.id;
            const user = (await pool.query('SELECT * FROM users WHERE id=$1', [spaceId])).rows[0];
            assert.equal(user.system_role, 'employee');
            assert.equal(user.bim_level, null);
            assert.equal(credentials.isPasswordHash(user.password), true);
            assert.equal(await bcrypt.compare('  pass word  ', user.password), true);
            for (const [password, status] of [['  pass word  ', 200], ['pass word', 401]]) {
                assert.equal((await request('/api/login', { method: 'POST', body: { email: user.email, password } })).status, status);
            }
        });
        await check('admin create hashes password and creates only an employee regardless of job title', async () => {
            const result = await request('/api/users/create', { method: 'POST', bearer: adminToken, body: { username: 'admin_created', email: 'created@example.test', password: ' admin space ', jobRole: 'super administrator' } });
            assert.equal(result.status, 201, JSON.stringify(result.data));
            const user = (await pool.query('SELECT password,system_role FROM users WHERE id=$1', [result.data.user.id])).rows[0];
            assert.equal(user.system_role, 'employee');
            assert.equal(await bcrypt.compare(' admin space ', user.password), true);
            assert.equal((await request('/api/login', { method: 'POST', body: { email: 'created@example.test', password: ' admin space ' } })).status, 200);
        });
        await check('new credential policy is shared across signup and admin create, including UTF-8 limit', async () => {
            for (const password of ['short', 'x'.repeat(73), '\u00e9'.repeat(37), { invalid: true }]) {
                for (const url of ['/api/signup', '/api/users/create']) {
                    const result = await request(url, { method: 'POST', bearer: adminToken, body: { username: 'bad', email: 'bad@example.test', password } });
                    assert.equal(result.status, 400, url);
                }
            }
            assert.equal(credentials.passwordValidationError('x'.repeat(72)), null);
        });
        await check('profile job title cannot elevate JWT, system_role, admin login or bridge', async () => {
            const result = await request('/api/update-profile', { method: 'POST', bearer: employeeToken, body: { name: 'employee', email: 'employee@example.test', positionLabel: 'System Administrator' } });
            assert.equal(result.status, 200, JSON.stringify(result.data));
            assert.equal(result.data.user.id, employeeId);
            assert.equal(result.data.user.systemRole, 'employee');
            assert.equal(result.data.user.isAdmin, false);
            assert.equal(jwt.verify(result.data.token, secretKey).role, 'employee');
            assert.equal((await request('/api/admin/session/bridge', { method: 'POST', bearer: result.data.token, body: {} })).status, 403);
            assert.equal((await request('/api/admin/login', { method: 'POST', body: { email: 'employee@example.test', password: 'old123' } })).status, 403);
            assert.equal((await request('/api/users/create', { method: 'POST', bearer: result.data.token, body: { username: 'denied', email: 'denied@example.test', password: 'longpass' } })).status, 403);
        });
        await check('schema initializer never promotes role from job text, metadata or verification status', async () => {
            await pool.query(`UPDATE users SET system_role='employee', job_role='Administrator', position_verification_status='verified', metadata='{"isAdmin":true}' WHERE id=$1`, [employeeId]);
            delete require.cache[require.resolve('../utils/userProfileSchema')];
            await require('../utils/userProfileSchema').ensureUserProfileColumns(pool);
            const user = (await pool.query('SELECT * FROM users WHERE id=$1', [employeeId])).rows[0];
            assert.equal(user.system_role, 'employee');
            assert.equal(service.normalizeUserRecord({ ...user, isAdmin: true, is_admin: true }).is_admin, false);
            assert.equal((await pool.query('SELECT system_role FROM users WHERE id=$1', [adminId])).rows[0].system_role, 'system_admin');
        });
        await check('profile and admin update reject protected identity/privilege mass assignment', async () => {
            for (const [field, value] of Object.entries({ id: otherId, userId: otherId, sub: String(otherId), system_role: 'system_admin', systemRole: 'system_admin', metadata: { isAdmin: true }, isAdmin: true, password: 'plaintext', googleSub: 'spoof' })) {
                assert.equal((await request('/api/update-profile', { method: 'POST', bearer: employeeToken, body: { name: 'employee', email: 'employee@example.test', [field]: value } })).status, 400, field);
                assert.equal((await request('/api/users/' + employeeId, { method: 'PUT', bearer: adminToken, body: { [field]: value } })).status, 400, field);
            }
            assert.equal((await request('/api/signup', { method: 'POST', body: { username: 'spoof', email: 'spoof@example.test', password: 'longpass', id: otherId } })).status, 400);
        });
        await check('service allowlist preserves ID and privilege even with internal mass-assignment input', async () => {
            const current = await service.findUserInPostgresByIdentity(null, employeeId);
            const updated = await service.updateUserProfileInPostgres(current, { id: otherId, system_role: 'system_admin', metadata: { isAdmin: true }, username: 'employee' });
            assert.equal(updated.id, employeeId);
            assert.equal(updated.system_role, 'employee');
            await assert.rejects(service.updateUserProfileInPostgres(current, { passwordHash: 'plaintext' }));
        });
        await check('stale email in signed token cannot resolve another account; aliases cannot authenticate', async () => {
            const result = await request('/api/profile', { bearer: await token(employeeId, { email: 'other@example.test' }) });
            assert.equal(result.status, 200);
            assert.equal(result.data.id, employeeId);
            assert.equal(await service.findUserInPostgresByIdentity('other@example.test', 'missing'), null);
            for (const claims of [{ email: 'employee@example.test' }, { userId: 'json_123' }, { userId: employeeId, id: otherId }, { sub: 'employee' }]) {
                assert.equal(auth.getBearerRequestUser({ headers: { authorization: 'Bearer ' + jwt.sign(claims, secretKey) } }), null);
            }
        });
        await check('admin helper and server controls reject job-role aliases, flags and legacy shared identity', async () => {
            for (const claims of [{ role: 'Administrator' }, { role: 'super_admin' }, { role: 'employee', isAdmin: true }, { jobRole: 'admin', role: '' }]) {
                const bearer = await token(employeeId, claims);
                assert.equal(auth.getBearerRequestUser({ headers: { authorization: 'Bearer ' + bearer } }), null);
                assert.equal((await request('/api/server/restart-full', { method: 'POST', bearer, body: {} })).status, 401);
            }
            assert.equal(auth.getRequestUser({ headers: { 'x-admin-token': 'test-legacy-token' } }), null);
            assert.equal(auth.getRequestUser({ headers: { authorization: 'Bearer test-legacy-bearer' } }), null);
            assert.equal(auth.getRequestUser({ headers: {}, session: { adminUser: { id: adminId, isAdmin: true, role: 'Administrator' } } }), null);
        });
        await check('profile password change uses raw old/new values and preserves canonical ID', async () => {
            const result = await request('/api/update-profile', { method: 'POST', bearer: await token(spaceId), body: { name: 'spaces-renamed', email: 'spaces-new@example.test', old_pass: '  pass word  ', new_pass: ' next password ', c_pass: ' next password ' } });
            assert.equal(result.status, 200);
            assert.equal(result.data.user.id, spaceId);
            assert.equal((await request('/api/login', { method: 'POST', body: { email: 'spaces-new@example.test', password: ' next password ' } })).status, 200);
            assert.equal((await request('/api/login', { method: 'POST', body: { email: 'spaces-new@example.test', password: 'next password' } })).status, 401);
        });
        await check('explicit admin session and password change remain functional', async () => {
            const login = await request('/api/admin/login', { method: 'POST', body: { email: 'admin@example.test', password: 'old123' } });
            assert.equal(login.status, 200);
            const current = await request('/api/admin/session', { cookie: login.cookie });
            assert.equal(current.data.user.systemRole, 'system_admin');
            const changed = await request('/api/admin/change-password', { method: 'POST', cookie: login.cookie, body: { currentPassword: 'old123', newPassword: ' admin next ', confirmPassword: ' admin next ' } });
            assert.equal(changed.status, 200);
            assert.equal((await request('/api/admin/login', { method: 'POST', body: { email: 'admin@example.test', password: ' admin next ' } })).status, 200);
            adminToken = await token(adminId);
        });
        // Google signature, persistent linking and migration are covered by p0-2-auth.test.js.
        await check('database outage cannot authenticate, create, update or authorize legacy JSON users', async () => {
            failDatabase = true;
            try {
                for (const [url, body, bearer, method = 'POST'] of [
                    ['/api/login', { email: 'legacy@example.test', password: 'legacy password' }],
                    ['/api/admin/login', { email: 'legacy@example.test', password: 'legacy password' }],
                    ['/api/signup', { username: 'offline', email: 'offline@example.test', password: 'longpass' }],
                    ['/api/auth/google/challenge', { purpose: 'login' }],
                    ['/api/admin/session/bridge', {}, adminToken],
                    ['/api/update-profile', { name: 'employee', email: 'employee@example.test' }, employeeToken],
                    ['/api/users/create', { username: 'offline', email: 'offline@example.test', password: 'longpass' }, adminToken],
                    ['/api/users/' + employeeId, { username: 'offline' }, adminToken, 'PUT']
                ]) assert.equal((await request(url, { method, body, bearer })).status, 503, url);
                assert.equal(service.findUserInJsonByEmail('legacy@example.test'), null);
                assert.equal(service.findUserInJsonByIdentity('legacy@example.test', 'json_123'), null);
                assert.throws(() => service.updateUserProfileInJson(legacy[0], { id: otherId }));
                assert.throws(() => service.updateProfileImageInJson('json_123', null, 'image'));
                assert.equal(legacyWrites, 0);
                assert.equal(require('../utils/userAccess').fetchAccessProfileFromJson('json_123', 'legacy@example.test'), null);
            } finally { failDatabase = false; }
        });
        await check('case and whitespace-normalized duplicates are rejected without changing existing users', async () => {
            const result = await request('/api/signup', { method: 'POST', body: { username: 'employee', email: 'EMPLOYEE@example.test', password: 'longpass' } });
            assert.equal(result.status, 409);
            await assert.rejects(pool.query(`INSERT INTO users(username,email,password) VALUES(' EMPLOYEE ','unused@example.test',$1)`, [oldHash]), error => error.code === '23505');
        });
        await check('admin profile updates preserve ID and access lookup ignores a stale email claim', async () => {
            const updated = await request('/api/users/' + employeeId, { method: 'PUT', bearer: adminToken, body: { positionLabel: 'Administrator', positionVerificationStatus: 'verified', mappingKompetensiAccess: true } });
            assert.equal(updated.status, 200, JSON.stringify(updated.data));
            const access = require('../utils/userAccess');
            assert.equal((await access.fetchAccessProfileFromDb(employeeId, 'other@example.test')).mappingKompetensiAccess, true);
            assert.equal((await access.fetchAccessProfileFromDb(otherId, 'employee@example.test')).mappingKompetensiAccess, false);
            const row = (await pool.query('SELECT id,system_role,position_verified_by FROM users WHERE id=$1', [employeeId])).rows[0];
            assert.equal(row.id, employeeId);
            assert.equal(row.system_role, 'employee');
            assert.equal(row.position_verified_by, String(adminId));
        });
        await check('profile image route updates only canonical ID, handles outage and rejects identity fields', async () => {
            const imageToken = await token(employeeId, { email:'other@example.test' });
            for (const [protectedField, unavailable, status] of [[false, false, 200], [true, false, 400], [false, true, 503]]) {
                failDatabase = unavailable;
                try {
                    const form = new FormData();
                    form.append('profile-image', new Blob(['fixture-image'], { type: 'image/png' }), 'fixture.png');
                    if (protectedField) form.append('id', String(otherId));
                    const response = await fetch(base + '/api/upload-profile-image', { method: 'POST', headers: { Authorization: 'Bearer ' + imageToken }, body: form });
                    assert.equal(response.status, status);
                    await response.json();
                } finally { failDatabase = false; }
            }
            assert.equal((await pool.query('SELECT profile_image FROM users WHERE id=$1', [otherId])).rows[0].profile_image, null);
            assert.ok((await pool.query('SELECT profile_image FROM users WHERE id=$1', [employeeId])).rows[0].profile_image);
        });
        await check('access approval uses requester ID and cannot reassign to the email owner', async () => {
            app.use('/fixture/access', require('../routes/accessRequests')({ backendDir: process.env.P0_TEST_WORKDIR, ensureDirectoryExists: dir => fs.mkdirSync(dir, { recursive: true }), pgPool: routePool, readUsers, writeUsers }));
            const created = await request('/fixture/access', { method: 'POST', bearer: await token(employeeId, { email: 'other@example.test' }), body: { type: 'library_download', message: 'Fixture request' } });
            assert.equal(created.status, 201, JSON.stringify(created.data));
            const approved = await request('/fixture/access/admin/' + created.data.request.id, { method: 'PUT', bearer: adminToken, body: { status: 'approved' } });
            assert.equal(approved.status, 200, JSON.stringify(approved.data));
            assert.equal((await pool.query('SELECT library_download_access FROM users WHERE id=$1', [employeeId])).rows[0].library_download_access, true);
            assert.equal((await pool.query('SELECT library_download_access FROM users WHERE id=$1', [otherId])).rows[0].library_download_access, false);
            await pool.query(`INSERT INTO access_requests(id,type,status,requester_user_id,requester_email) VALUES('unmapped','library_download','pending','legacy-name','other@example.test')`);
            assert.equal((await request('/fixture/access/admin/unmapped', { method: 'PUT', bearer: adminToken, body: { status: 'approved' } })).status, 404);
            assert.equal(legacyWrites, 0);
        });
        await check('quiz, certificate and activity ownership never follows matching email/name or unmapped aliases', async () => {
            app.use('/fixture/quizzes', require('../elearning/routes/quizRoutes'));
            app.use('/fixture/certificates', require('../elearning/routes/certificateRoutes'));
            app.use('/fixture/activity', require('../elearning/routes/activityRoutes'));
            assert.equal((await request(`/fixture/quizzes/user/${employeeId}/stats`, { bearer: employeeToken })).status, 200);
            for (const [id, label] of [[employeeId, 'own'], [otherId, 'other'], [null, 'unmapped']]) {
                await pool.query(`INSERT INTO learning_attempts(user_id,user_identifier,user_email,user_name,quiz_id,quiz_category,source_type) VALUES($1,$2,'employee@example.test','employee',$3,'fixture','practice')`, [id, label, 'fixture-' + label]);
                await pool.query(`INSERT INTO user_certificates(id,user_id,user_identifier,user_email,user_name,title,is_verified) VALUES($1,$2,$3,'employee@example.test','employee','Fixture',true)`, ['fixture-' + label, id, label]);
            }
            const stats = await request(`/fixture/quizzes/user/${employeeId}/stats`, { bearer: employeeToken });
            assert.equal(stats.status, 200);
            assert.equal(stats.data.totalAttempts, 1);
            assert.equal(stats.data.certificatesEarned, 1);
            const history = await request(`/fixture/quizzes/user/${employeeId}/history`, { bearer: employeeToken });
            assert.equal(history.status, 200);
            assert.equal(history.data.results.length, 1);
            const certificates = await request('/fixture/certificates/' + employeeId, { bearer: employeeToken });
            assert.equal(certificates.status, 200);
            assert.equal(certificates.data.length, 1);
            for (const url of [`/fixture/quizzes/user/${otherId}/stats`, '/fixture/certificates/employee@example.test']) assert.equal((await request(url, { bearer: employeeToken })).status, 403);
            assert.equal((await request('/fixture/certificates/issue', { method: 'POST', bearer: adminToken, body: { email: 'employee@example.test' } })).status, 400);
            for (const id of [employeeId, otherId]) {
                const tracked = await request('/fixture/activity/track', { method: 'POST', bearer: await token(id, { email: 'employee@example.test' }), body: { moduleId: 'shared-module', moduleType: 'pdf', eventType: 'completed' } });
                assert.equal(tracked.status, 200);
                assert.notEqual(tracked.data.deduped, true);
            }
            const summary = await request('/fixture/activity/summary', { bearer: employeeToken });
            assert.equal(summary.status, 200);
            assert.equal(summary.data.summary.completedModules, 1);
            assert.equal((await pool.query('SELECT count(*)::int AS n FROM learning_activity_events')).rows[0].n, 2);
        });
        await check('admin reset hashes raw password, uses token user ID and refuses unmapped reset identity', async () => {
            const requested = await request('/api/admin/password-recovery/request', { method: 'POST', body: { email: 'admin@example.test' } });
            assert.equal(requested.status, 200);
            for (const [id, resetToken, status] of [[String(adminId), 'fixture-reset', 200], ['legacy-admin', 'fixture-unmapped-reset', 400]]) {
                await pool.query(`INSERT INTO admin_password_reset_tokens(user_id,email,token_hash,expires_at) VALUES($1,'other@example.test',$2,CURRENT_TIMESTAMP+INTERVAL '30 minutes')`, [id, crypto.createHash('sha256').update(resetToken).digest('hex')]);
                const reset = await request('/api/admin/password-recovery/reset', { method: 'POST', body: { token: resetToken, newPassword: ' recovered password ', confirmPassword: ' recovered password ' } });
                assert.equal(reset.status, status, JSON.stringify(reset.data));
            }
            assert.equal((await request('/api/admin/login', { method: 'POST', body: { email: 'admin@example.test', password: ' recovered password ' } })).status, 200);
            assert.equal((await pool.query('SELECT password FROM users WHERE id=$1', [otherId])).rows[0].password, oldHash);
            adminToken = await token(adminId);
        });
        await check('all three frontend local login handlers send raw password and retain response ID', async () => {
            for (const file of ['../../BC-Learning-Main/js/user.js', '../../BC-Learning-Main/elearning-assets/js/user.js', '../../BC-Learning-Main/elearning-assets/js/auth-guard.js']) {
                const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
                let sent, saved, submit;
                const storage = new Map();
                const form = { addEventListener: (event, action) => { submit = action; }, querySelector: () => null };
                const context = vm.createContext({
                    console, alert() {}, setTimeout() {}, window: { location: {} },
                    document: { getElementById: name => name === 'login-form' ? form : { value: name.includes('password') ? ' raw password ' : 'employee@example.test' } },
                    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
                    fetch: async (url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ success: true, id: employeeId, token: employeeToken, username: 'employee', email: 'employee@example.test' }) }; },
                    setUserData: user => { saved = user; }, getPostLoginDestination: () => '/', buildLoginEndpointCandidates: () => ['/api/login']
                });
                if (file.endsWith('auth-guard.js')) {
                    const start = source.indexOf('    async handleLogin()');
                    const end = source.indexOf('    async handleSignup()', start);
                    const handler = vm.runInContext('({' + source.slice(start, end) + '})', context);
                    Object.assign(handler, { showLoading() {}, showSuccess() {}, showError(message) { throw new Error(message); } });
                    await handler.handleLogin();
                    saved = JSON.parse(storage.get('user'));
                } else {
                    const start = source.indexOf('function setupLoginForm()');
                    const end = source.indexOf('\n}', start) + 2;
                    vm.runInContext(source.slice(start, end) + ';setupLoginForm();', context);
                    await submit({ preventDefault() {} });
                }
                assert.equal(sent.password, ' raw password ', file);
                assert.equal(saved.id, employeeId, file);
            }
        });
        await check('server bootstrap uses shared hashing and creates an explicit PostgreSQL admin only', async () => {
            const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
            const start = source.indexOf('async function createDefaultAdminUser()');
            const end = source.indexOf('// Serve project media files', start);
            assert.ok(end > start);
            const context = vm.createContext({ console, pgPool: routePool, hashPassword: credentials.hashPassword, getDefaultAdminPassword: () => ' bootstrap password ', ensureUserProfileColumns: require('../utils/userProfileSchema').ensureUserProfileColumns });
            vm.runInContext(source.slice(start, end), context);
            await context.createDefaultAdminUser();
            const created = (await pool.query("SELECT id,password,system_role FROM users WHERE username='admin_bcl'")).rows[0];
            assert.equal(created.system_role, 'system_admin');
            assert.equal(await bcrypt.compare(' bootstrap password ', created.password), true);
            await context.createDefaultAdminUser();
            assert.equal((await pool.query("SELECT id FROM users WHERE username='admin_bcl'")).rows[0].id, created.id);
            failDatabase = true;
            try { await context.createDefaultAdminUser(); } finally { failDatabase = false; }
            assert.equal(legacyWrites, 0);
        });
        await check('legacy backup restore and the shared JSON writer cannot mutate identity or credentials', async () => {
            app.use('/fixture/admin', require('../routes/adminRoutes'));
            const result = await request('/fixture/admin/backups/users.json.backup.fixture/restore', { method: 'POST', bearer: adminToken, body: {} });
            assert.equal(result.status, 503);
            const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
            const start = source.indexOf('function writeUsers(');
            const end = source.indexOf('\n}', start) + 2;
            const context = vm.createContext({ identityStoreUnavailable: identity.identityStoreUnavailable });
            vm.runInContext(source.slice(start, end), context);
            assert.throws(() => context.writeUsers([{ id: 'json_123', password: 'plaintext', systemRole: 'system_admin' }]), error => error.code === 'IDENTITY_STORE_UNAVAILABLE');
        });
        await check('unavailable authority blocks directory fallback before authorization', async () => {
            failDatabase = true;
            try {
                const result = await request('/api/users/get-all', { bearer: adminToken });
                assert.equal(result.status, 503);
            } finally { failDatabase = false; }
        });
        await check('legacy Level Request update cannot change user ID, request ID, or self-approve', async () => {
            app.use('/fixture/levels', require('../routes/levelRequestsPublic').createLevelRequestsPublic({ backendDir: process.env.P0_TEST_WORKDIR }));
            const created = await request('/fixture/levels', { method: 'POST', bearer: employeeToken, body: { targetLevel: 'BIM Coordinator', reason: 'Fixture request' } });
            assert.equal(created.status, 201, JSON.stringify(created.data));
            const id = created.data.data.id;
            for (const fields of [{ userId: String(otherId) }, { id: 'req_reassigned' }, { status: 'approved' }, { reviewedBy: String(adminId) }, { system_role: 'system_admin' }]) {
                const changed = await request('/fixture/levels/' + id, { method: 'PUT', bearer: employeeToken, body: fields });
                assert.equal(changed.status, 400, JSON.stringify(changed.data));
            }
            const changed = await request('/fixture/levels/' + id, { method: 'PUT', bearer: employeeToken, body: { reason: 'Revised fixture request' } });
            assert.equal(changed.status, 200);
            assert.equal(changed.data.data.userId, String(employeeId));
            assert.equal(changed.data.data.id, id);
            assert.equal(changed.data.data.status, 'pending');
            const stored = JSON.parse(fs.readFileSync(path.join(process.env.P0_TEST_WORKDIR, 'level-requests.json'), 'utf8'));
            assert.equal(stored.requests[0].userId, String(employeeId));
        });
        console.log(`P0-1 integration result: ${count}/${count} passed; operational database never connected.`);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        await Promise.all(pools.map(item => item.end()));
        pg.Pool = OriginalPool;
    }
};
