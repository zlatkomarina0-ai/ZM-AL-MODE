/**
 * JOKER 3 — independent mock route plus optional server-side Gemini proxy.
 * The mock endpoint never calls a provider. Gemini key must be a Worker secret.
 */
const ALLOWED_ORIGINS = new Set(['https://zlatkomarina0-ai.github.io', 'http://localhost:5173']);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 20000;
const PLANNED_BR = 1000;
const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
const securityHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};
function json(body, status = 200, origin = null) {
  const headers = { ...securityHeaders, Vary: 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  return new Response(JSON.stringify(body), { status, headers });
}
function errorResponse(message, status, origin, type = 'joker3_api_error') {
  return json({ error: { message, type } }, status, origin);
}
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function readMessages(request, origin, maxMessages) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    return { response: errorResponse('Content-Type must be application/json.', 415, origin) };
  }
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) {
    return { response: errorResponse('Request body exceeds 64 KiB.', 413, origin) };
  }
  let raw;
  try { raw = await request.text(); } catch {
    return { response: errorResponse('Unable to read request body.', 400, origin) };
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { response: errorResponse('Request body exceeds 64 KiB.', 413, origin) };
  }
  let body;
  try { body = JSON.parse(raw); } catch {
    return { response: errorResponse('Request body must be valid JSON.', 400, origin) };
  }
  if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > maxMessages) {
    return { response: errorResponse('messages must contain 1–' + maxMessages + ' messages.', 400, origin) };
  }
  let totalChars = 0;
  for (const message of body.messages) {
    if (!isRecord(message) || !['system', 'user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || message.content.length > MAX_MESSAGE_CHARS) {
      return { response: errorResponse('Each message needs role system/user/assistant and text of at most 4,000 characters.', 400, origin) };
    }
    totalChars += message.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return { response: errorResponse('Combined message text exceeds 20,000 characters.', 413, origin) };
  }
  return { body };
}
async function mockChatCompletion(request, origin) {
  const parsed = await readMessages(request, origin, 100);
  if (parsed.response) return parsed.response;
  const lastUser = [...parsed.body.messages].reverse().find(message => message.role === 'user');
  const excerpt = lastUser ? lastUser.content.slice(0, 500) : '(no user message)';
  return json({
    id: 'joker3-mock-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000),
    model: typeof parsed.body.model === 'string' && parsed.body.model.length <= 100 ? parsed.body.model : 'pluton-mock-chat',
    choices: [{ index: 0, message: { role: 'assistant', content: '[SIMULATED RESPONSE — NOT REAL AI]\nJOKER 3 echo preview: ' + excerpt }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated: true },
    simulated: true, providerCalls: false, outboundNetwork: false,
    capacity: { plannedBR: PLANNED_BR, activeWorkers: 0 },
    notice: 'Mock response only. No real model was called.',
  }, 200, origin);
}
async function geminiChatCompletion(request, origin, env) {
  if (!env || typeof env.GEMINI_API_KEY !== 'string' || env.GEMINI_API_KEY.trim().length < 10) {
    return errorResponse('Gemini is not configured. Set the GEMINI_API_KEY Worker secret; no provider request was sent.', 503, origin, 'gemini_not_configured');
  }
  const parsed = await readMessages(request, origin, 20);
  if (parsed.response) return parsed.response;
  const messages = parsed.body.messages;
  const systemText = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n').slice(0, MAX_MESSAGE_CHARS);
  const rawContents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  if (!rawContents.some(m => m.role === 'user')) {
    return errorResponse('At least one user message is required for Gemini.', 400, origin);
  }
  if (rawContents[0].role !== 'user' || rawContents[rawContents.length - 1].role !== 'user') {
    return errorResponse('Gemini chat history must start and end with a user message (system instructions are separate).', 400, origin);
  }
  // Gemini chat history alternates user/model turns. Merge adjacent same-role
  // entries rather than sending an invalid sequence to the provider.
  const contents = [];
  for (const item of rawContents) {
    const previous = contents[contents.length - 1];
    if (previous && previous.role === item.role) {
      previous.parts[0].text += '\\n\\n' + item.parts[0].text;
    } else {
      contents.push({ role: item.role, parts: [{ text: item.parts[0].text }] });
    }
  }
  const payload = { contents, generationConfig: { maxOutputTokens: 1024, temperature: 0.7 } };
  if (systemText) payload.systemInstruction = { parts: [{ text: systemText }] };
  let upstream;
  try {
    if (!env.GEMINI_RATE_LIMITER || typeof env.GEMINI_RATE_LIMITER.limit !== 'function') {
      return errorResponse('Gemini route is disabled until the Cloudflare rate-limit binding is configured.', 503, origin, 'gemini_rate_limit_not_configured');
    }
    const clientKey = request.headers.get('cf-connecting-ip') || 'unknown-client';
    let allowance;
    try {
      allowance = await env.GEMINI_RATE_LIMITER.limit({ key: 'gemini:' + clientKey });
    } catch {
      return errorResponse('Gemini rate-limit check failed. Request blocked; no provider request was sent.', 503, origin, 'gemini_rate_limit_unavailable');
    }
    if (!allowance || allowance.success !== true) {
      return errorResponse('Gemini request limit reached. Wait before trying again; no provider request was sent.', 429, origin, 'gemini_edge_rate_limited');
    }
    upstream = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return errorResponse('Gemini request failed or timed out. Check connectivity and try again.', 502, origin, 'gemini_upstream_error');
  }
  if (!upstream.ok) {
    if (upstream.status === 429) return errorResponse('Gemini quota/rate limit reached. No paid fallback is configured.', 429, origin, 'gemini_quota_exceeded');
    if (upstream.status === 401 || upstream.status === 403) return errorResponse('Gemini rejected the key or project access. Check the Worker secret and Google quota settings.', 502, origin, 'gemini_configuration_error');
    if (upstream.status === 400) return errorResponse('Gemini rejected the request. Check message format or model availability.', 400, origin, 'gemini_bad_request');
    return errorResponse('Gemini provider returned HTTP ' + upstream.status + '.', 502, origin, 'gemini_upstream_error');
  }
  let result;
  try { result = await upstream.json(); } catch {
    return errorResponse('Gemini returned an unreadable response.', 502, origin, 'gemini_upstream_error');
  }
  const parts = result && result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts;
  const answer = Array.isArray(parts) ? parts.filter(p => typeof p.text === 'string').map(p => p.text).join('') : '';
  if (!answer) return errorResponse('Gemini returned no text. The response may have been blocked or empty.', 502, origin, 'gemini_empty_response');
  const usage = result.usageMetadata || {};
  return json({
    id: 'joker3-gemini-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000),
    model: GEMINI_MODEL,
    choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: result.candidates[0].finishReason || 'stop' }],
    usage: { prompt_tokens: Number(usage.promptTokenCount || 0), completion_tokens: Number(usage.candidatesTokenCount || 0), total_tokens: Number(usage.totalTokenCount || 0) },
    simulated: false, provider: 'google-gemini-api', providerCalls: true, outboundNetwork: true,
    costPolicy: 'No paid fallback in this Worker; Google account quota and billing must be configured separately.',
  }, 200, origin);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') {
      const headers = { ...securityHeaders, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
      if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
      return new Response(null, { status: 204, headers });
    }
    if (url.pathname === '/health' && request.method === 'GET') return json({
      ok: true, system: 'JOKER 3', component: 'External PLUTON API',
      mode: 'mock-plus-optional-gemini-proxy', mockRouteProviderCalls: false,
      geminiRoute: '/v1/gemini/chat/completions', geminiConfigured: Boolean(env && env.GEMINI_API_KEY), geminiRateLimitConfigured: Boolean(env && env.GEMINI_RATE_LIMITER),
      capacity: { plannedBR: PLANNED_BR, activeWorkers: 0 },
      warning: '1,000 BR is a planned label, not deployed compute. CORS is not authentication; configure edge rate limits/auth before public use.',
    }, 200, origin);
    if (url.pathname === '/v1/models' && request.method === 'GET') return json({
      object: 'list',
      data: [
        { id: 'pluton-mock-chat', object: 'model', owned_by: 'joker-3-simulation' },
        { id: GEMINI_MODEL, object: 'model', owned_by: 'google', route: '/v1/gemini/chat/completions' },
      ],
      note: 'Gemini requires the server-side GEMINI_API_KEY secret and available Google quota.',
      capacity: { plannedBR: PLANNED_BR, activeWorkers: 0 },
    }, 200, origin);
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') return mockChatCompletion(request, origin);
    if (url.pathname === '/v1/gemini/chat/completions' && request.method === 'POST') return geminiChatCompletion(request, origin, env);
    if (request.method !== 'GET' && request.method !== 'POST') return errorResponse('Method not allowed.', 405, origin);
    return errorResponse('Not found.', 404, origin);
  },
};
