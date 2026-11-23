import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../joker3-api/worker.js';

test('health reports planned capacity and Gemini secret state without revealing secret', async () => {
  const response = await worker.fetch(new Request('https://mock.example/health'), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.system, 'JOKER 3');
  assert.equal(body.mode, 'mock-plus-optional-gemini-proxy');
  assert.equal(body.capacity.plannedBR, 1000);
  assert.equal(body.capacity.activeWorkers, 0);
  assert.equal(body.geminiConfigured, false);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('models list keeps the mock and Gemini routes separate', async () => {
  const body = await (await worker.fetch(new Request('https://mock.example/v1/models'), {})).json();
  assert.equal(body.data[0].id, 'pluton-mock-chat');
  assert.equal(body.data[1].id, 'gemini-flash-latest');
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

test('Gemini route fails closed when secret is missing', async () => {
  const response = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.type, 'gemini_not_configured');
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
    }), { GEMINI_API_KEY: 'test-secret-gemini-key' });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.choices[0].message.content, 'Gemini test response');
    assert.equal(body.provider, 'google-gemini-api');
    assert.equal(body.simulated, false);
    assert.equal(body.usage.total_tokens, 7);
    assert.match(captured.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-flash-latest:generateContent$/);
    assert.equal(captured.init.headers['x-goog-api-key'], 'test-secret-gemini-key');
    assert.equal(captured.init.body.includes('test-secret-gemini-key'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('Gemini quota errors are sanitized and do not trigger paid fallback', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('private upstream diagnostic', { status: 429 });
  try {
    const response = await worker.fetch(new Request('https://mock.example/v1/gemini/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    }), { GEMINI_API_KEY: 'test-secret-gemini-key' });
    const text = await response.text();
    assert.equal(response.status, 429);
    assert.match(text, /No paid fallback/);
    assert.doesNotMatch(text, /private upstream diagnostic/);
  } finally { globalThis.fetch = originalFetch; }
});

test('request validation, CORS, methods and fixed upstream boundary are enforced', async () => {
  const send = (path, body, headers = { 'Content-Type': 'application/json' }) => worker.fetch(new Request('https://mock.example' + path, { method: 'POST', headers, body }), { GEMINI_API_KEY: 'test-secret-gemini-key' });
  assert.equal((await send('/v1/chat/completions', '{bad')).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [{ role: 'system-admin', content: 'x' }] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(4001) }] }))).status, 400);
  assert.equal((await send('/v1/gemini/chat/completions', 'x', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await worker.fetch(new Request('https://mock.example/health', { headers: { Origin: 'https://evil.example' } }), {})).status, 403);
  assert.equal((await worker.fetch(new Request('https://mock.example/private'), {})).status, 404);
  assert.equal((await worker.fetch(new Request('https://mock.example/v1/models', { method: 'DELETE' }), {})).status, 405);
  const source = await readFile(new URL('../joker3-api/worker.js', import.meta.url), 'utf8');
  assert.equal((source.match(/\bfetch\(GEMINI_ENDPOINT/g) || []).length, 1);
  assert.match(source, /const GEMINI_ENDPOINT = 'https:\/\/generativelanguage\.googleapis\.com/);
  assert.doesNotMatch(source, /WebSocket|connect\s*\(/);
});
