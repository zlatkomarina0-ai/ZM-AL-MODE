import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../cloudflare-worker/worker.js';

test('health endpoint declares local-first mode and security headers', async () => {
  const response = await worker.fetch(new Request('https://worker.example/health'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'local-first');
  assert.equal(body.apiCalls, false);
  assert.equal(body.outboundNetwork, false);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
});

test('rejects unapproved browser origins', async () => {
  const response = await worker.fetch(new Request('https://worker.example/health', { headers: { Origin: 'https://evil.example' } }));
  assert.equal(response.status, 403);
});

test('only exposes GET and OPTIONS and has no unknown routes', async () => {
  assert.equal((await worker.fetch(new Request('https://worker.example/health', { method: 'POST' }))).status, 405);
  assert.equal((await worker.fetch(new Request('https://worker.example/not-a-route'))).status, 404);
  assert.equal((await worker.fetch(new Request('https://worker.example/health', { method: 'OPTIONS' }))).status, 204);
});

test('health worker has no outbound network or proxy capability in source', async () => {
  const source = await readFile(new URL('../cloudflare-worker/worker.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:globalThis\.|window\.)fetch\s*\(|\bawait\s+fetch\s*\(/);
  assert.doesNotMatch(source, /WebSocket|connect\s*\(/);
  assert.match(source, /outboundNetwork:\s*false/);
});
