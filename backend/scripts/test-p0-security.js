// Starts a disposable PostgreSQL cluster. Never uses the operational database.
const fs = require('fs');
const path = require('path');
const net = require('net');
const { execFileSync } = require('child_process');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const parent = path.join(root, '.tmp');
    fs.mkdirSync(parent, { recursive: true });
    const work = fs.mkdtempSync(path.join(parent, 'p0-1-'));
    const data = path.join(work, 'pgdata');
    const bin = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\15\\bin';
    const executable = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    // PostgreSQL children must not inherit pipes that keep execFileSync waiting on Windows.
    const options = { windowsHide: true, stdio: 'ignore', timeout: 30000 };
    let started = false;
    try {
        execFileSync(executable('initdb'), ['-D', data, '-U', 'p0_test', '-A', 'trust', '--encoding=UTF8', '--no-locale'], options);
        execFileSync(executable('pg_ctl'), ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], options);
        started = true;
        Object.assign(process.env, {
            DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: 'postgres', DB_USER: 'p0_test',
            DB_PASSWORD: 'isolated-test-only', JWT_SECRET: 'p0-1-isolated-test-secret',
            SESSION_SECRET: 'p0-1-isolated-session', ADMIN_TOKEN: 'test-legacy-token',
            ADMIN_BEARER_SECRET: 'test-legacy-bearer', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
            P0_TEST_WORKDIR: work, P0_TEST_PORT: String(port)
        });
        await require(process.argv.includes('--p0-2') ? '../tests/p0-2-auth.test' : '../tests/p0-1-security.test')();
    } finally {
        if (started || fs.existsSync(path.join(data, 'postmaster.pid'))) {
            execFileSync(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], options);
        }
        const resolved = path.resolve(work);
        if (!resolved.startsWith(path.resolve(parent) + path.sep + 'p0-1-')) throw new Error('Unsafe test cleanup path');
        fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
