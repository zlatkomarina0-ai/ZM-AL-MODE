import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../joker3-api/worker.js';

test('health marks JOKER 3 as simulation only with 1,000 planned BR and zero live workers', async () => {
  const response = await worker.fetch(new Request('https://mock.example/health'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.system, 'JOKER 3');
  assert.equal(body.mode, 'simulation-only');
  assert.equal(body.capacity.plannedBR, 1000);
  assert.equal(body.capacity.activeWorkers, 0);
  assert.equal(body.providerCalls, false);
  assert.equal(body.outboundNetwork, false);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('models endpoint exposes only a clearly labelled mock model', async () => {
  const response = await worker.fetch(new Request('https://mock.example/v1/models'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.simulated, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, 'pluton-mock-chat');
  assert.equal(body.capacity.activeWorkers, 0);
});

test('chat completions returns a mock response with API-compatible structure', async () => {
  const response = await worker.fetch(new Request('https://mock.example/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'pluton-mock-chat', messages: [{ role: 'user', content: 'hello' }] }),
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.object, 'chat.completion');
  assert.equal(body.choices[0].message.role, 'assistant');
  assert.match(body.choices[0].message.content, /SIMULATED RESPONSE/);
  assert.equal(body.simulated, true);
  assert.equal(body.providerCalls, false);
  assert.equal(body.capacity.plannedBR, 1000);
  assert.equal(body.capacity.activeWorkers, 0);
});

test('validates malformed payloads, unsupported roles, and size limits', async () => {
  const send = (body, headers = { 'Content-Type': 'application/json' }) => worker.fetch(new Request('https://mock.example/v1/chat/completions', { method: 'POST', headers, body }));
  assert.equal((await send('{bad')).status, 400);
  assert.equal((await send(JSON.stringify({ messages: [] }))).status, 400);
  assert.equal((await send(JSON.stringify({ messages: [{ role: 'system-admin', content: 'x' }] }))).status, 400);
  assert.equal((await send(JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(4001) }] }))).status, 400);
  assert.equal((await send('x', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await send(JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(66000) }] }))).status, 413);
});

test('blocks unapproved origins and unsupported routes/methods', async () => {
  assert.equal((await worker.fetch(new Request('https://mock.example/health', { headers: { Origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await worker.fetch(new Request('https://mock.example/private'))).status, 404);
  assert.equal((await worker.fetch(new Request('https://mock.example/v1/models', { method: 'DELETE' }))).status, 405);
});

test('mock API has no outbound fetch, proxy, or websocket code', async () => {
  const source = await readFile(new URL('../joker3-api/worker.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:globalThis\.|window\.)fetch\s*\(|\bawait\s+fetch\s*\(/);
  assert.doesNotMatch(source, /WebSocket|connect\s*\(/);
  assert.match(source, /outboundNetwork:\s*false/);
});
