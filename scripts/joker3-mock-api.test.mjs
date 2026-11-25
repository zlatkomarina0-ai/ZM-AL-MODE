import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../joker3-api/worker.js';

test('health reports planned capacity and Gemini secret state without revealing secret', async () => {
  const response = await worker.fetch(new Request('https://mock.example/health'), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.system, 'JOKER 3');
  assert.equal(body.mode, 'mock-plus-free-provider-fallback');
  assert.equal(body.capacity.plannedBR, 1000);
  assert.equal(body.capacity.activeWorkers, 0);
  assert.equal(body.geminiConfigured, false);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('models list keeps the mock and Gemini routes separate', async () => {
  const body = await (await worker.fetch(new Request('https://mock.example/v1/models'), {})).json();
  assert.equal(body.data[0].id, 'pluton-mock-chat');
  assert.equal(body.data[1].id, 'gemini-3.8-flash');
  assert.equal(body.data[1].route, '/v1/gemini/chat/completions');
});

test('mock route stays simulated and makes no provider request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('mock route must not call fetch'); };
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), {});
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.simulated, true);
    assert.equal(body.providerCalls, false);
    assert.match(body.choices[0].message.content, /SIMULATED RESPONSE/);
  } finally { globalThis.fetch = originalFetch; }
});

test('Gemini route fails closed when secret or rate limiter is missing', async () => {
  const response = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.type, 'ai_rate_limit_not_configured');
  const noLimiter = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  }), { GEMINI_API_KEY: 'test-secret-gemini-key' });
  assert.equal(noLimiter.status, 503);
  assert.equal((await noLimiter.json()).error.type, 'ai_rate_limit_not_configured');
});

test('Gemini proxy uses fixed Google endpoint and returns compatible response', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Gemini test response' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'system', content: 'Be concise' }, { role: 'user', content: 'hello' }] }),
    }), { GEMINI_API_KEY: 'test-secret-gemini-key', GEMINI_RATE_LIMITER: { limit: async () => ({ success: true }) } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.choices[0].message.content, 'Gemini test response');
    assert.equal(body.provider, 'google-gemini-api');
    assert.equal(body.simulated, false);
    assert.equal(body.usage.total_tokens, 7);
    assert.match(captured.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3.8-flash:generateContent$/);
    assert.equal(captured.init.headers['x-goog-api-key'], 'test-secret-gemini-key');
    assert.equal(captured.init.body.includes('test-secret-gemini-key'), false);
    assert.equal(JSON.parse(captured.init.body).contents.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('Gemini quota errors are sanitized and do not trigger paid fallback', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('private upstream diagnostic', { status: 429, headers: { 'Retry-After': '30' } });
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), { GEMINI_API_KEY: 'test-secret-gemini-key', GEMINI_RATE_LIMITER: { limit: async () => ({ success: true }) } });
    const text = await response.text();
    assert.equal(response.status, 503);
    assert.match(text, /No paid fallback/);
    assert.doesNotMatch(text, /private upstream diagnostic/);
    const body = JSON.parse(text);
    assert.equal(body.error.providerDiagnostics[0].provider, 'google-gemini-api');
    assert.equal(body.error.providerDiagnostics[0].category, 'rate_limit_or_quota');
    assert.equal(body.error.providerDiagnostics[0].httpStatus, 429);
    assert.equal(body.error.providerDiagnostics[0].retryAfterSeconds, 30);
    assert.equal(body.error.providerDiagnostics[0].retryTimeKnown, true);
    assert.equal(body.limitStatus.providerQuotaNumbersKnown, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('request validation, CORS, methods and fixed upstream boundary are enforced', async () => {
  const send = (path, body, headers = { 'Content-Type': 'application/json' }) => worker.fetch(new Request('https://mock.example' + path, { method: 'POST', headers, body }), { GEMINI_API_KEY: 'test-secret-gemini-key' });
  assert.equal((await send('/v1/chat/completions', '{bad')).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [{ role: 'system-admin', content: 'x' }] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(4001) }] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [{ role: 'assistant', content: 'hello' }, { role: 'user', content: 'hi' }] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', 'x', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await worker.fetch(new Request('https://mock.example/health', { headers: { Origin: 'https://evil.example' } }), {})).status, 403);
  assert.equal((await worker.fetch(new Request('https://mock.example/private'), {})).status, 404);
  assert.equal((await worker.fetch(new Request('https://mock.example/v1/models', { method: 'DELETE' }), {})).status, 405);
  const limited = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  }), { GEMINI_API_KEY: 'test-secret-gemini-key', GEMINI_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.type, 'ai_edge_rate_limited');
  const brokenLimiter = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  }), { GEMINI_API_KEY: 'test-secret-gemini-key', GEMINI_RATE_LIMITER: { limit: async () => { throw new Error('internal detail'); } } });
  assert.equal(brokenLimiter.status, 503);
  assert.doesNotMatch(await brokenLimiter.text(), /internal detail/);
  const source = await readFile(new URL('../joker3-api/worker.js', import.meta.url), 'utf8');
  assert.equal((source.match(/\bfetch\(GEMINI_ENDPOINT/g) || []).length, 1);
  assert.match(source, /const GEMINI_ENDPOINT = 'https:\/\/generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(source, /WebSocket|connect\s*\(/);
});

test('Gemini proxy joins consecutive same-role messages with real line breaks', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [
        { role: 'user', content: 'first' },
        { role: 'user', content: 'second' },
      ] }),
    }), { GEMINI_API_KEY: 'test-secret-gemini-key', GEMINI_RATE_LIMITER: { limit: async () => ({ success: true }) } });
    assert.equal(response.status, 200);
    assert.equal(captured.contents.length, 1);
    assert.equal(captured.contents[0].parts[0].text, 'first\n\nsecond');
  } finally { globalThis.fetch = originalFetch; }
});

test('JOKER 4 fallback tries Gemini then OpenRouter free router and stops on success', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('generativelanguage.googleapis.com')) return new Response('quota', { status: 429 });
    if (String(url).includes('openrouter.ai')) {
      assert.equal(JSON.parse(init.body).model, 'openrouter/free');
      assert.equal(init.headers.Authorization, 'Bearer test-openrouter-key');
      return new Response(JSON.stringify({
        model: 'openrouter/free',
        choices: [{ message: { content: 'Free fallback answer' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('Unexpected provider call: ' + url);
  };
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/copilot/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), {
      GEMINI_API_KEY: 'test-secret-gemini-key', OPENROUTER_API_KEY: 'test-openrouter-key',
      GROQ_API_KEY: 'test-groq-key', GROQ_MODEL: 'test-model', GROQ_FREE_TIER_CONFIRMED: 'true',
      GEMINI_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.provider, 'openrouter-free');
    assert.equal(body.choices[0].message.content, 'Free fallback answer');
    assert.deepEqual(calls, [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      'https://openrouter.ai/api/v1/chat/completions',
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test('Groq fallback is skipped unless free tier is explicitly confirmed and model configured', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response('provider unavailable', { status: 503 });
  };
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/copilot/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), {
      GEMINI_API_KEY: 'test-secret-gemini-key', GROQ_API_KEY: 'test-groq-key', GROQ_MODEL: 'some-model',
      GEMINI_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    assert.equal(response.status, 503);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].includes('generativelanguage.googleapis.com'), true);
    assert.match(await response.text(), /No paid fallback was used/);
  } finally { globalThis.fetch = originalFetch; }
});
