const http = require('http');
const path = require('path');
const fs = require('fs');

const LISTEN_PORT = parseInt(process.env.LEGACY_PROXY_PORT || '5051', 10);
const TARGET_PORT = parseInt(process.env.LEGACY_PROXY_TARGET_PORT || process.env.BCL_BACKEND_PORT || '5052', 10);
const TARGET_HOST = process.env.LEGACY_PROXY_TARGET_HOST || '127.0.0.1';
const ROOT_DIR = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const ACCESS_LOG = path.join(LOG_DIR, 'legacy-5051-access.log');
const ERROR_LOG = path.join(LOG_DIR, 'legacy-5051-error.log');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendLog(filePath, line) {
    fs.appendFile(filePath, `${line}\n`, () => {});
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '-';
}

function buildForwardHeaders(req) {
    const headers = { ...req.headers };
    const clientIp = getClientIp(req);
    const existingForwarded = headers['x-forwarded-for'];
    headers.host = `${TARGET_HOST}:${TARGET_PORT}`;
    headers['x-forwarded-for'] = existingForwarded ? `${existingForwarded}, ${clientIp}` : clientIp;
    headers['x-forwarded-proto'] = headers['x-forwarded-proto'] || 'http';
    headers['x-bcl-legacy-proxy'] = `${LISTEN_PORT}->${TARGET_PORT}`;
    return headers;
}

const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    const proxyReq = http.request(
        {
            hostname: TARGET_HOST,
            port: TARGET_PORT,
            path: req.url,
            method: req.method,
            headers: buildForwardHeaders(req)
        },
        (proxyRes) => {
            const responseHeaders = { ...proxyRes.headers, 'x-bcl-legacy-proxy': `${LISTEN_PORT}->${TARGET_PORT}` };
            res.writeHead(proxyRes.statusCode || 502, responseHeaders);
            proxyRes.pipe(res);

            res.on('finish', () => {
                appendLog(
                    ACCESS_LOG,
                    [
                        new Date().toISOString(),
                        getClientIp(req),
                        req.method,
                        req.url,
                        res.statusCode,
                        `${Date.now() - startedAt}ms`,
                        JSON.stringify(req.headers['user-agent'] || '-')
                    ].join(' | ')
                );
            });
        }
    );

    proxyReq.on('error', (error) => {
        appendLog(
            ERROR_LOG,
            [
                new Date().toISOString(),
                req.method,
                req.url,
                error.message
            ].join(' | ')
        );

        if (!res.headersSent) {
            res.writeHead(502, {
                'Content-Type': 'application/json',
                'x-bcl-legacy-proxy': `${LISTEN_PORT}->${TARGET_PORT}`
            });
        }

        res.end(
            JSON.stringify({
                success: false,
                error: `Legacy proxy could not reach backend ${TARGET_HOST}:${TARGET_PORT}`
            })
        );
    });

    req.pipe(proxyReq);
});

server.on('clientError', (error, socket) => {
    appendLog(ERROR_LOG, `${new Date().toISOString()} | client-error | ${error.message}`);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
    const message = `${new Date().toISOString()} | listening | ${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`;
    console.log(`Legacy proxy active on ${LISTEN_PORT}, forwarding to ${TARGET_HOST}:${TARGET_PORT}`);
    appendLog(ACCESS_LOG, message);
});
