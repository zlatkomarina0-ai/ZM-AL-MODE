/**
 * JOKER 3 — simulated API-compatible interface for PLUTON.
 * This is a deterministic mock, not a real AI provider or 1,000 live workers.
 * It never makes outbound network calls and must not receive secrets or sensitive data.
 */
const ALLOWED_ORIGINS = new Set([
  'https://zlatkomarina0-ai.github.io',
  'http://localhost:5173',
]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 4000;
const PLANNED_BR = 1000;

const securityHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

function json(body, status = 200, origin = null) {
  const headers = { ...securityHeaders, 'Vary': 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(message, status, origin) {
  return json({ error: { message, type: 'mock_api_error' }, simulated: true }, status, origin);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function modelList(origin) {
  return json({
    object: 'list',
    data: [{ id: 'pluton-mock-chat', object: 'model', owned_by: 'joker-3-simulation' }],
    simulated: true,
    providerCalls: false,
    outboundNetwork: false,
    capacity: { plannedBR: PLANNED_BR, activeWorkers: 0 },
  }, 200, origin);
}

async function chatCompletion(request, origin) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return errorResponse('Content-Type must be application/json.', 415, origin);
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return errorResponse('Request body exceeds 64 KiB.', 413, origin);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return errorResponse('Unable to read request body.', 400, origin);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return errorResponse('Request body exceeds 64 KiB.', 413, origin);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse('Request body must be valid JSON.', 400, origin);
  }
  if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    return errorResponse('messages must be an array containing 1–100 messages.', 400, origin);
  }
  for (const message of body.messages) {
    if (!isRecord(message) || !['system', 'user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || message.content.length > MAX_MESSAGE_CHARS) {
      return errorResponse('Each message needs a valid role and text content of at most 4,000 characters.', 400, origin);
    }
  }

  const lastUserMessage = [...body.messages].reverse().find(message => message.role === 'user');
  const excerpt = lastUserMessage ? lastUserMessage.content.slice(0, 500) : '(no user message)';
  return json({
    id: `joker3-mock-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: typeof body.model === 'string' && body.model.length <= 100 ? body.model : 'pluton-mock-chat',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: `[SIMULATED RESPONSE — NOT REAL AI]\nJOKER 3 received the request. Echo preview: ${excerpt}`,
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated: true },
    simulated: true,
    providerCalls: false,
    outboundNetwork: false,
    capacity: { plannedBR: PLANNED_BR, activeWorkers: 0, simulatedBRForThisRequest: 1 },
    notice: 'Mock response only. No real model was called; do not rely on this output as AI analysis.',
  }, 200, origin);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: 'Origin not allowed', simulated: true }, 403);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...securityHeaders,
          'Vary': 'Origin',
          'Access-Control-Allow-Origin': origin || 'null',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({
        ok: true,
        system: 'JOKER 3',
        component: 'External PLUTON mock API',
        mode: 'simulation-only',
        apiCalls: false,
        providerCalls: false,
        outboundNetwork: false,
        capacity: { plannedBR: PLANNED_BR, activeWorkers: 0 },
        warning: 'Mock API only; no real AI or 1,000 live workers.',
      }, 200, origin);
    }
    if (url.pathname === '/v1/models' && request.method === 'GET') return modelList(origin);
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') return chatCompletion(request, origin);
    if (request.method !== 'GET' && request.method !== 'POST') {
      return errorResponse('Method not allowed.', 405, origin);
    }
    return errorResponse('Not found.', 404, origin);
  },
};
