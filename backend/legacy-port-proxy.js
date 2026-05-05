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

function isHtmlNavigationRequest(req) {
    if (req.method !== 'GET') {
        return false;
    }

    const accept = String(req.headers.accept || '').toLowerCase();
    return accept.includes('text/html');
}

function sendBackendUnavailableResponse(req, res) {
    if (isHtmlNavigationRequest(req)) {
        if (!res.headersSent) {
            res.writeHead(502, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Retry-After': '5',
                'x-bcl-legacy-proxy': `${LISTEN_PORT}->${TARGET_PORT}`
            });
        }

        const safeUrl = JSON.stringify(req.url || '/');
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BCL Restart In Progress</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; }
    .panel { width: min(92vw, 560px); background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 18px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0 0 12px; line-height: 1.5; color: #cbd5e1; }
    .spinner { width: 22px; height: 22px; border: 3px solid rgba(148,163,184,0.25); border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
    .meta { font-size: 13px; color: #94a3b8; margin-top: 18px; }
    .btn { display: inline-block; margin-top: 16px; padding: 10px 14px; border-radius: 10px; background: #1d4ed8; color: #fff; text-decoration: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="panel">
    <div class="spinner" aria-hidden="true"></div>
    <h1>BCL sedang restart</h1>
    <p>Legacy proxy 5051 belum bisa menjangkau backend ${TARGET_HOST}:${TARGET_PORT}.</p>
    <p>Halaman akan mencoba memuat ulang otomatis dalam beberapa detik.</p>
    <a class="btn" href=${safeUrl}>Coba lagi sekarang</a>
    <div class="meta">Proxy ${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}</div>
  </div>
  <script>
    setTimeout(function () { window.location.reload(); }, 5000);
  </script>
</body>
</html>`);
        return;
    }

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

        sendBackendUnavailableResponse(req, res);
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
