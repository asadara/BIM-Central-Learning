import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.env.MCP_REVIT_BRIDGE_PORT || 17827);
const host = process.env.MCP_REVIT_BRIDGE_HOST || '127.0.0.1';

const defaultConfig = {
  mcpServers: {
    revit: {
      command: 'C:\\Program Files\\Autodesk\\Revit 2027 MCP Server Technical Preview\\RevitMCPServer.exe',
    },
  },
  openai: {
    model: 'gpt-5.5',
    fallbackModel: 'gpt-5',
  },
  bridge: {
    endpoint: `http://${host}:${port}`,
  },
};

function appDataPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'McpRevit', 'mcp-revit.json');
}

function loadConfig() {
  const configPath = process.env.MCP_REVIT_CONFIG || appDataPath();
  if (!fs.existsSync(configPath)) {
    return { configPath, config: defaultConfig, configExists: false };
  }

  const rawConfig = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
  const config = JSON.parse(rawConfig);
  return { configPath, config: { ...defaultConfig, ...config }, configExists: true };
}

function revitMcpStatus(config) {
  const command = config?.mcpServers?.revit?.command || defaultConfig.mcpServers.revit.command;
  return {
    command,
    exists: fs.existsSync(command),
  };
}

function readRequest(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function extractResponseText(payload) {
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

async function callOpenAI(prompt, config) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'OPENAI_API_KEY is not set.',
    };
  }

  const models = [
    config.openai?.model || defaultConfig.openai.model,
    config.openai?.fallbackModel || defaultConfig.openai.fallbackModel,
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  let lastError = null;
  for (const model of models) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content:
              'You are GPT inside an MCP Revit bridge. Be concise. If Revit MCP server is unavailable, explain the missing prerequisite and do not invent model data.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      return {
        ok: true,
        model,
        text: extractResponseText(payload),
        raw: payload,
      };
    }

    lastError = {
      model,
      status: response.status,
      payload,
    };
  }

  return {
    ok: false,
    status: lastError?.status || 502,
    error: 'OpenAI request failed.',
    detail: lastError,
  };
}

async function handle(req, res) {
  const { configPath, config, configExists } = loadConfig();
  const mcp = revitMcpStatus(config);

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'mcp-revit-bridge',
      configPath,
      configExists,
      bridge: {
        host,
        port,
      },
      openai: {
        apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
        model: config.openai?.model || defaultConfig.openai.model,
        fallbackModel: config.openai?.fallbackModel || defaultConfig.openai.fallbackModel,
      },
      revitMcpServer: mcp,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat') {
    const body = await readRequest(req);
    const parsed = body ? JSON.parse(body) : {};
    const prompt = String(parsed.prompt || '').trim();

    if (!prompt) {
      sendJson(res, 400, { ok: false, error: 'Missing prompt.' });
      return;
    }

    const result = await callOpenAI(prompt, config);
    sendJson(res, result.ok ? 200 : result.status || 502, {
      ...result,
      revitMcpServer: mcp,
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  });
});

server.listen(port, host, () => {
  console.log(`MCP Revit bridge listening on http://${host}:${port}`);
});
