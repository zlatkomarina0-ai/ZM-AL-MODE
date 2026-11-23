import test from 'node:test';
import assert from 'node:assert/strict';
import { DAMA_TREF_MAX_SOURCES, DAMA_TREF_MAX_INPUT_BYTES, appendDamaTrefAudit, authorizeDamaTrefAction, decideDamaTrefRequest, inspectDamaTrefInput, validateDamaTrefSourceUrl } from '../src/pluton-dama-tref.ts';
test('defines source and input limits', () => { assert.equal(DAMA_TREF_MAX_SOURCES, 1000); assert.equal(DAMA_TREF_MAX_INPUT_BYTES, 5000000); });
test('accepts only HTTPS URLs on an exact allowlist', () => {
  assert.equal(validateDamaTrefSourceUrl('https://example.com/news#fragment', ['example.com']), 'https://example.com/news');
  assert.throws(() => validateDamaTrefSourceUrl('http://example.com', ['example.com']), /HTTPS/);
  assert.throws(() => validateDamaTrefSourceUrl('https://example.com.evil.test', ['example.com']), /allowlist/);
  assert.throws(() => validateDamaTrefSourceUrl('https://user:pass@example.com', ['example.com']), /Credentials/);
  assert.throws(() => validateDamaTrefSourceUrl('https://127.0.0.1', ['127.0.0.1']), /DNS hostnames|Private/);\n  assert.throws(() => validateDamaTrefSourceUrl('https://192.0.2.10', ['192.0.2.10']), /DNS hostnames/);\n  assert.throws(() => validateDamaTrefSourceUrl('https://2130706433', ['2130706433']), /DNS hostnames|Private/);\n  assert.throws(() => validateDamaTrefSourceUrl('https://bad..example.com', ['bad..example.com']), /DNS hostnames|allowlist/);\n  assert.throws(() => validateDamaTrefSourceUrl('https://example.123', ['example.123']), /DNS hostnames/);
  assert.throws(() => validateDamaTrefSourceUrl('https://localhost', ['localhost']), /DNS hostnames|Private/);
  assert.throws(() => validateDamaTrefSourceUrl('https://example.com:8443', ['example.com']), /port/);
});
test('default-denies outbound transfer except approved source GET intent', () => {
  assert.equal(decideDamaTrefRequest({ action: 'external-api' }).allowed, false);
  assert.equal(decideDamaTrefRequest({ action: 'export-data' }).allowed, false);
  assert.equal(decideDamaTrefRequest({ action: 'source-fetch', method: 'POST', url: 'https://example.com', allowedHosts: ['example.com'] }).allowed, false);
  assert.equal(decideDamaTrefRequest({ action: 'source-fetch', url: 'https://example.com', allowedHosts: ['example.com'], hasPrivatePayload: true }).allowed, false);
  assert.equal(decideDamaTrefRequest({ action: 'source-fetch', url: 'https://example.com', allowedHosts: ['example.com'] }).allowed, true);
});
test('enforces least-privilege roles and blocks egress even for admin', () => {
  assert.equal(authorizeDamaTrefAction({ id: 'w1', role: 'worker' }, 'submit-local-result').allowed, true);
  assert.equal(authorizeDamaTrefAction({ id: 'w1', role: 'worker' }, 'assign-task').allowed, false);
  assert.equal(authorizeDamaTrefAction({ id: 'c1', role: 'chief' }, 'assign-task').allowed, true);
  assert.equal(authorizeDamaTrefAction({ id: 'a1', role: 'auditor' }, 'read-audit').allowed, true);
  assert.equal(authorizeDamaTrefAction({ id: 'a1', role: 'auditor' }, 'submit-local-result').allowed, false);
  assert.equal(authorizeDamaTrefAction({ id: 'admin', role: 'admin' }, 'export-data').allowed, false);
  assert.equal(authorizeDamaTrefAction({ id: 'w1', role: 'worker' }, 'unknown').allowed, false);
  assert.equal(authorizeDamaTrefAction({ id: 'admin', role: 'admin' }, 'unexpected-runtime-action').allowed, false);
});
test('quarantines active HTML and oversized/unsupported content', () => {
  assert.equal(inspectDamaTrefInput({ content: '{"ok":true}', contentType: 'application/json' }).accepted, true);
  const active = inspectDamaTrefInput({ content: '<script>alert(1)</script>', contentType: 'text/html' });
  assert.equal(active.accepted, false); assert.equal(active.quarantined, true);
  assert.equal(inspectDamaTrefInput({ content: 'x'.repeat(20), contentType: 'text/plain', maxBytes: 10 }).quarantined, true);
  assert.equal(inspectDamaTrefInput({ content: 'x'.repeat(DAMA_TREF_MAX_INPUT_BYTES + 1), contentType: 'text/plain', maxBytes: DAMA_TREF_MAX_INPUT_BYTES * 2 }).quarantined, true);
  assert.equal(inspectDamaTrefInput({ content: 'x', contentType: 'application/octet-stream' }).accepted, false);
});
test('copies and bounds audit history', () => {
  const result = appendDamaTrefAudit([{ id: '1', actorId: 'a', action: 'read', allowed: true, reason: 'ok', target: 'x', timestamp: 't' }], { id: '2', actorId: 'b', action: 'blocked', allowed: false, reason: 'deny', target: 'y', timestamp: 't' }, 1);
  assert.equal(result.length, 1); assert.equal(result[0].id, '2');
});
