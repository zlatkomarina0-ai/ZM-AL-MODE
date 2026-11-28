const ALLOWED_ORIGINS = new Set(['https://zlatkomarina0-ai.github.io']);
const MAX_BODY_BYTES = 32 * 1024;
const MODEL = 'gemini-3.1-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const headersBase = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

function reply(body, status = 200, origin = null) {
  const headers = { ...headersBase, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ ok: false, error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headersBase, 'Vary': 'Origin', 'Access-Control-Allow-Origin': origin || '', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return reply({ ok: true, service: 'zlatko-gemini-free', provider: 'Google Gemini API', model: MODEL, mode: 'free-tier-only', apiKeyConfigured: Boolean(env.GEMINI_API_KEY), rateLimiterConfigured: Boolean(env.GEMINI_RATE_LIMITER) }, 200, origin);
    }
    if (request.method !== 'POST' || url.pathname !== '/v1/chat') return reply({ ok: false, error: 'Not found' }, 404, origin);
    if (!env.GEMINI_API_KEY) return reply({ ok: false, error: 'Gemini API key is not configured on this Worker.' }, 503, origin);
    if (!env.GEMINI_RATE_LIMITER || typeof env.GEMINI_RATE_LIMITER.limit !== 'function') return reply({ ok: false, error: 'Rate limiter is not configured; request blocked.' }, 503, origin);
    const rate = await env.GEMINI_RATE_LIMITER.limit({ key: 'global' });
    if (!rate.success) return reply({ ok: false, error: 'Rate limit reached. Try again later.' }, 429, origin);
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return reply({ ok: false, error: 'Content-Type must be application/json.' }, 415, origin);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return reply({ ok: false, error: 'Request too large.' }, 413, origin);

    let raw;
    try { raw = await request.text(); } catch { return reply({ ok: false, error: 'Could not read request.' }, 400, origin); }
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return reply({ ok: false, error: 'Request too large.' }, 413, origin);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ ok: false, error: 'Invalid JSON.' }, 400, origin); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 30) {
      return reply({ ok: false, error: 'messages must be an array of 1–30 messages.' }, 400, origin);
    }
    const contents = [];
    let total = 0;
    for (const m of body.messages) {
      if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 4000) return reply({ ok: false, error: 'Each message must have role user/assistant and text up to 4000 characters.' }, 400, origin);
      total += m.content.length;
      if (total > 20000) return reply({ ok: false, error: 'Combined message text is too long.' }, 413, origin);
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
    try {
      const upstream = await fetch(ENDPOINT + '?key=' + encodeURIComponent(env.GEMINI_API_KEY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Ти си ZLATKO AI MODE — разговараш природно и паметно со корисникот. Стандардно одговарај на македонски јазик, со природен секојдневен израз и кирилица; ако корисникот пишува на друг јазик, можеш да го следиш. Биди концизен и директен. Разбери го контекстот и тонот пред да одговориш; не измислувај значење на сленг, шеги или двосмислени фрази. Ако не си сигурен што значи нешто, прашај кратко наместо да држиш долг говор или да претпоставуваш дека корисникот има проблем. Не тврди дека извршуваш задачи надвор од разговорот ако навистина не си ги извршил. За спортски анализи оддели факти од процени и никогаш не гарантирај исходи.' }] },
          contents, generationConfig: { maxOutputTokens: 700, temperature: 0.45 }
        }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        return reply({ ok: false, error: upstream.status === 429 ? 'Gemini free-tier quota/rate limit reached.' : 'Gemini API request failed.', upstreamStatus: upstream.status }, upstream.status === 429 ? 429 : 502, origin);
      }
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      if (!text) return reply({ ok: false, error: 'Gemini returned no text.' }, 502, origin);
      return reply({ ok: true, model: MODEL, text }, 200, origin);
    } catch {
      return reply({ ok: false, error: 'Gemini request timed out after 55 seconds or the upstream connection failed.' }, 502, origin);
    }
  },
};
