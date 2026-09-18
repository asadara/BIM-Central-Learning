// Temporary operator-assisted validation against the real local BCL backend.
// Credentials/tokens are used only in memory. No auth bypass, mocks, or secret rotation.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { createPgConfig } = require('../config/runtimeConfig');
const root = path.resolve(__dirname, '../..');
const work = path.join(root, '.tmp', 'p0-1-runtime-20260918');
const evidenceFile = path.join(root, 'docs/architecture/P0_1_Runtime_Validation_Evidence.json');
const backend = 'http://127.0.0.1:5052';
const pool = new Pool(createPgConfig({ options: '-c default_transaction_read_only=on -c statement_timeout=15000', connectionTimeoutMillis: 5000 }));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const auditPaths = ['bcl_access.log', 'bcl_https_access.log'].map(name => path.join(root, 'nginx/nginx-1.28.0/logs', name));
let baseline, nonce, origin, running = false;
let expectedLogins = {};
let state = { phase: 'awaiting_activation', startedAt: new Date().toISOString(), backend, checks: [], expectedSequenceAdvance: 0, localPassed: false, googleOperatorConfirmed: false };

async function snapshot() {
    const result = await pool.query('SELECT * FROM public.users ORDER BY id');
    const sequence = (await pool.query('SELECT last_value::text, is_called FROM public.users_id_seq')).rows[0];
    return { capturedAt: new Date().toISOString(), users: result.rows.map(row => ({
        id: row.id, loginCount: Number(row.login_count || 0), systemRole: row.system_role,
        fields: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, hash(value)]))
    })), sequence };
}
function persist() {
    fs.writeFileSync(evidenceFile, JSON.stringify(state, null, 2));
}
function pass(name, details = {}) {
    state.checks.push({ name, result: 'PASS', at: new Date().toISOString(), ...details });
    persist();
    console.log('PASS: ' + name);
}
async function api(endpoint, { method = 'GET', body, bearer, cookie } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(backend + endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => ({}));
    // Runtime also sends bcl_client_id; select the actual Express session cookie.
    const cookies = response.headers.getSetCookie();
    const sessionCookie = cookies.find(value => value.startsWith('connect.sid='));
    return { status: response.status, data, cookie: sessionCookie?.split(';')[0] };
}
async function integrity() {
    const now = await snapshot();
    const changes = [];
    const missing = [];
    for (const prior of baseline.users) {
        const current = now.users.find(row => row.id === prior.id);
        if (!current) { missing.push(prior.id); continue; }
        const fields = Object.keys(prior.fields).filter(key => prior.fields[key] !== current.fields[key]);
        if (fields.length) changes.push({ id: prior.id, fields, loginCountDelta: current.loginCount - prior.loginCount });
    }
    const added = now.users.filter(row => !baseline.users.some(prior => prior.id === row.id)).map(row => row.id);
    state.integrity = {
        capturedAt: now.capturedAt, originalCount: baseline.users.length, currentCount: now.users.length,
        changedExisting: changes, missingExistingIds: missing, addedIds: added,
        sequenceBefore: baseline.sequence, sequenceAfter: now.sequence,
        sequenceAdvance: Number(now.sequence.last_value) - Number(baseline.sequence.last_value),
        immutableAndProfileFieldsUnchanged: missing.length === 0 && changes.every(change => change.fields.every(field => ['login_count', 'last_login', 'updated_at'].includes(field))),
        expectedLoginDeltas: expectedLogins
    };
    persist();
    return state.integrity;
}
function googleAudit() {
    const matches = [];
    for (const entry of state.auditBaseline) {
        if (!fs.existsSync(entry.path)) continue;
        const size = fs.statSync(entry.path).size;
        if (size <= entry.offset) continue;
        const file = fs.openSync(entry.path, 'r');
        try {
            const buffer = Buffer.alloc(Math.min(size - entry.offset, 8 * 1024 * 1024));
            fs.readSync(file, buffer, 0, buffer.length, entry.offset);
            for (const line of buffer.toString('utf8').split(/\r?\n/)) {
                const match = line.match(/\[([^\]]+)\].*"POST \/api\/auth\/google(?:\?[^ ]*)? HTTP\/[^" ]+" (\d{3})/);
                if (match) matches.push({ time: match[1], status: Number(match[2]), log: path.basename(entry.path) });
            }
        } finally { fs.closeSync(file); }
    }
    state.googleHttpEvidence = matches;
    persist();
    return matches;
}
async function runLocal(credentials) {
    if (!fs.existsSync(path.join(work, 'activation.json'))) throw new Error('Runtime belum dinyatakan siap');
    if (state.localPassed || running) throw new Error('Validasi sudah berjalan atau selesai');
    running = true;
    state.phase = 'running_local';
    delete state.failure;
    let testUser, adminToken, adminCookie;
    try {
        const local = await api('/api/login', { method: 'POST', body: { email: credentials.identifier, password: credentials.password } });
        assert.equal(local.status, 200, 'Local login existing gagal; periksa credential pada BCL');
        assert.ok(baseline.users.some(row => row.id === local.data.id), 'Login harus menggunakan akun existing');
        expectedLogins[local.data.id] = (expectedLogins[local.data.id] || 0) + 1;
        pass('local_login_existing', { userId: local.data.id, httpStatus: local.status });
        const admin = await api('/api/admin/login', { method: 'POST', body: { email: credentials.identifier, password: credentials.password } });
        credentials.password = undefined;
        credentials.identifier = undefined;
        assert.equal(admin.status, 200, 'Admin login gagal; credential harus milik admin existing');
        assert.equal(admin.data.user.id, local.data.id);
        assert.equal(local.data.systemRole, 'system_admin');
        expectedLogins[local.data.id] = (expectedLogins[local.data.id] || 0) + 1;
        adminCookie = admin.cookie;
        adminToken = local.data.token;
        assert.ok(adminCookie, 'Admin response harus memberi cookie sesi connect.sid');
        const session = await api('/api/admin/session', { cookie: adminCookie });
        assert.equal(session.status, 200, 'Sesi admin harus dapat dibaca dengan cookie connect.sid');
        assert.equal(session.data.user?.systemRole, 'system_admin');
        pass('admin_login_existing', { userId: local.data.id, httpStatus: admin.status });

        const suffix = Date.now().toString(36);
        const username = 'p01_runtime_' + suffix;
        const email = username + '@example.invalid';
        const password = ' ' + crypto.randomBytes(24).toString('base64url') + ' ';
        const created = await api('/api/users/create', { method: 'POST', bearer: adminToken, body: { username, email, password, positionLabel: 'Administrator', organization: 'P0-1 temporary runtime validation' } });
        assert.equal(created.status, 201, 'Admin create gagal');
        testUser = { id: created.data.user.id, email, username };
        state.testUserId = testUser.id;
        state.expectedSequenceAdvance++;
        pass('admin_create_user', { userId: testUser.id, httpStatus: created.status });
        const stored = (await pool.query('SELECT id,password,system_role FROM users WHERE id=$1', [testUser.id])).rows[0];
        assert.ok(/^\$2[ab]\$10\$/.test(stored.password));
        assert.ok(stored.password !== password, 'Penyimpanan password harus hash, bukan plaintext');
        assert.equal(await bcrypt.compare(password, stored.password), true);
        assert.equal(stored.system_role, 'employee');
        pass('admin_create_bcrypt_and_employee_role', { userId: testUser.id, bcryptCost: 10 });
        const normal = await api('/api/login', { method: 'POST', body: { email, password } });
        assert.equal(normal.status, 200);
        assert.equal(normal.data.id, testUser.id);
        assert.equal(normal.data.systemRole, 'employee');
        const trimmed = await api('/api/login', { method: 'POST', body: { email, password: password.trim() } });
        assert.equal(trimmed.status, 401);
        pass('new_user_login_and_raw_password_spaces', { userId: testUser.id });
        let bearer = normal.data.token;
        for (const attributes of [{ positionLabel: 'System Administrator' }, { job_role: 'super admin' }]) {
            const updated = await api('/api/update-profile', { method: 'POST', bearer, body: { name: username, email, ...attributes } });
            assert.equal(updated.status, 200, 'Profile update gagal');
            assert.equal(updated.data.user.id, testUser.id);
            assert.equal(updated.data.user.systemRole, 'employee');
            assert.equal(updated.data.user.isAdmin, false);
            bearer = updated.data.token;
            const row = (await pool.query('SELECT id,system_role FROM users WHERE id=$1', [testUser.id])).rows[0];
            assert.equal(row.id, testUser.id);
            assert.equal(row.system_role, 'employee');
            assert.equal((await api('/api/admin/session/bridge', { method: 'POST', bearer, body: {} })).status, 403);
            assert.equal((await api('/api/users/create', { method: 'POST', bearer, body: {} })).status, 403);
            pass('profile_no_admin_escalation_' + Object.keys(attributes)[0], { userId: testUser.id, canonicalIdUnchanged: true });
        }
        assert.equal((await api('/api/admin/login', { method: 'POST', body: { email, password } })).status, 403);
        assert.equal((await api('/api/update-profile', { method: 'POST', bearer, body: { name: username, email, id: 2000000000, system_role: 'system_admin' } })).status, 400);
        pass('canonical_id_and_privilege_mass_assignment_rejected', { userId: testUser.id });
        state.localPassed = true;
        state.phase = 'awaiting_google';
    } catch (error) {
        state.phase = 'local_failed';
        // Assertions contain no credentials because no credential values are compared as messages.
        state.failure = error.message;
        console.error('Runtime validation: ' + error.message);
        throw error;
    } finally {
        credentials.password = undefined;
        if (testUser && adminToken) {
            const own = (await pool.query('SELECT email,username FROM users WHERE id=$1', [testUser.id])).rows[0];
            if (own?.email === testUser.email && own?.username === testUser.username) {
                const cleanup = await api('/api/users/' + testUser.id, { method: 'DELETE', bearer: adminToken });
                state.testUserRemoved = cleanup.status === 200;
                if (state.testUserRemoved) pass('temporary_test_user_cleanup', { userId: testUser.id, sequenceReset: false });
            }
        }
        if (adminCookie) await api('/api/admin/logout', { method: 'POST', cookie: adminCookie, body: {} });
        adminToken = undefined;
        adminCookie = undefined;
        running = false;
        await integrity();
        persist();
    }
}
function page() {
    return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Validasi runtime P0-1 BCL</title><style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:20px;line-height:1.6}label{display:block;margin:16px 0}input{display:block;width:95%;padding:10px;font:inherit}button{padding:10px 18px;font:inherit}pre{white-space:pre-wrap;background:#f1f5f8;padding:16px}</style><h1>Validasi runtime P0-1</h1><p>Masukkan akun admin BCL existing. Credential dikirim hanya ke helper loopback ini dan backend BCL lokal; tidak disimpan ke file atau laporan.</p><p>Akan diuji: login lokal/admin, admin create, hash bcrypt, update profil, dan penolakan privilege escalation. Satu akun uji sementara akan dibuat lalu dihapus. Akun existing tidak diubah selain statistik login normal.</p><form id="login"><label>Email atau username admin<input id="identifier" required autocomplete="username"></label><label>Password<input id="password" type="password" required autocomplete="current-password"></label><button id="run">Jalankan validasi lokal</button></form><p>Sesudah langkah lokal selesai, buka <a href="https://bcl.nke.net/pages/login.html" target="_blank" rel="noopener">login BCL</a>, gunakan tombol Google dengan akun yang sudah terdaftar, lalu kembali dan konfirmasi.</p><button id="google">Saya sudah berhasil login Google existing</button><pre id="result">Memuat status...</pre><script>
const base=location.pathname;async function status(){const r=await fetch(base+'status');document.getElementById('result').textContent=JSON.stringify(await r.json(),null,2)}
document.getElementById('login').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('run');button.disabled=true;const body=JSON.stringify({identifier:document.getElementById('identifier').value,password:document.getElementById('password').value});document.getElementById('password').value='';try{const r=await fetch(base+'run',{method:'POST',headers:{'Content-Type':'application/json'},body});const j=await r.json();if(!r.ok)alert(j.error)}finally{button.disabled=false;await status()}};
document.getElementById('google').onclick=async()=>{await fetch(base+'google-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await status()};status();setInterval(status,10000);
</script></html>`;
}
async function main() {
    fs.mkdirSync(work, { recursive: true });
    const baselineFile = path.join(work, 'baseline.json');
    let resumeControl;
    if (process.argv.includes('--resume')) {
        baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
        state = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
        assert.equal(state.phase, 'local_failed', 'Resume hanya setelah percobaan lokal gagal dan helper lama dihentikan');
        assert.ok(!state.testUserId || state.testUserRemoved, 'Selesaikan cleanup akun uji sebelum resume');
        expectedLogins = state.integrity?.expectedLoginDeltas || {};
        state.previousAttempts = [...(state.previousAttempts || []), { phase: state.phase, failure: state.failure, checks: state.checks, preservedAt: new Date().toISOString() }];
        state.checks = [];
        state.phase = 'awaiting_credentials';
        delete state.failure;
        resumeControl = JSON.parse(fs.readFileSync(path.join(work, 'control.json'), 'utf8'));
        nonce = new URL(resumeControl.url).pathname.split('/')[1];
    } else {
        if (fs.existsSync(baselineFile)) throw new Error('Baseline exists; do not overwrite an active validation run');
        baseline = await snapshot();
        assert.equal(baseline.users.length, 16, 'Expected 16 existing users before activation');
        fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
        state.baseline = { userCount: baseline.users.length, capturedAt: baseline.capturedAt, sequence: baseline.sequence };
        state.auditBaseline = auditPaths.map(file => ({ path: file, offset: fs.existsSync(file) ? fs.statSync(file).size : 0 }));
        nonce = crypto.randomBytes(24).toString('hex');
    }
    persist();
    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        const basePath = '/' + nonce + '/';
        if (req.headers.host !== new URL(origin).host || !req.url.startsWith(basePath)) { res.writeHead(404); return res.end(); }
        if (req.method === 'POST' && req.headers.origin !== origin) { res.writeHead(403); return res.end(); }
        const endpoint = req.url.slice(basePath.length);
        const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
        try {
            if (req.method === 'GET' && endpoint === '') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(page()); }
            if (req.method === 'GET' && endpoint === 'status') {
                state.runtimeReady = fs.existsSync(path.join(work, 'activation.json'));
                googleAudit();
                return json(state);
            }
            let body = '';
            for await (const chunk of req) { body += chunk; if (body.length > 4096) throw new Error('Body too large'); }
            if (req.method === 'POST' && endpoint === 'run') { await runLocal(JSON.parse(body)); return json({ success: true }); }
            if (req.method === 'POST' && endpoint === 'google-confirm') {
                state.googleOperatorConfirmed = true;
                state.googleConfirmedAt = new Date().toISOString();
                googleAudit();
                await integrity();
                return json({ success: true });
            }
            if (req.method === 'POST' && endpoint === 'refresh') { googleAudit(); await integrity(); return json(state); }
            if (req.method === 'POST' && endpoint === 'stop' && !running) {
                await integrity(); googleAudit(); json({ success: true });
                server.close(); await pool.end(); return;
            }
            json({ error: 'Not found' }, 404);
        } catch (error) { json({ error: error.message }, 400); }
    });
    server.listen(resumeControl ? Number(new URL(resumeControl.origin).port) : 0, '127.0.0.1', () => {
        origin = 'http://127.0.0.1:' + server.address().port;
        const url = origin + '/' + nonce + '/';
        fs.writeFileSync(path.join(work, 'control.json'), JSON.stringify({ url, origin, processId: process.pid }, null, 2));
        console.log(JSON.stringify({ validationUrl: url, baselineUserCount: baseline.users.length, sequence: baseline.sequence }));
    });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; pool.end(); });
