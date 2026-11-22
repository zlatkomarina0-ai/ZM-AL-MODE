import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIKOVA_PLUTON_TARGET,
  PIKOVA_PROJECT_LIMIT,
  PIKOVA_PLUTONS_PER_PROJECT,
  createPikovaProject,
  createPikovaState,
  enqueuePikovaTask,
  getPikovaProjectView,
  getPikovaOverview,
  grantPikovaRole,
  processPikovaQueue,
  retryPikovaFailures,
  validatePikovaState,
} from '../src/pluton-pikova-dama.ts';

const owner = { id: 'owner-1', role: 'owner' };
const operator = { id: 'operator-1', role: 'operator' };
const viewer = { id: 'viewer-1', role: 'viewer' };

function setup() {
  const state = createPikovaState();
  const project = createPikovaProject(state, owner, 'Project A', { id: () => 'project-a', now: () => '2026-11-22T10:00:00.000Z' });
  return { state, project };
}

test('declares the requested 1,000 projects × 100 Plutons target', () => {
  assert.equal(PIKOVA_PROJECT_LIMIT, 1000);
  assert.equal(PIKOVA_PLUTONS_PER_PROJECT, 100);
  assert.equal(PIKOVA_PLUTON_TARGET, 100000);
});

test('isolates projects and task views', () => {
  const state = createPikovaState();
  const a = createPikovaProject(state, owner, 'A', { id: () => 'A' });
  const b = createPikovaProject(state, owner, 'B', { id: () => 'B' });
  enqueuePikovaTask(state, owner, a.id, 'A task', { tip: 'home' }, 'same-key');
  enqueuePikovaTask(state, owner, b.id, 'B task', { tip: 'away' }, 'same-key');
  assert.equal(getPikovaProjectView(state, owner, a.id).tasks.length, 1);
  assert.equal(getPikovaProjectView(state, owner, b.id).tasks.length, 1);
  assert.equal(getPikovaProjectView(state, owner, a.id).tasks[0].payload.tip, 'home');
});

test('denies non-members and viewers from writing', () => {
  const { state, project } = setup();
  assert.throws(() => getPikovaProjectView(state, operator, project.id), /Access denied/);
  grantPikovaRole(state, owner, project.id, viewer.id, 'viewer');
  assert.throws(() => enqueuePikovaTask(state, viewer, project.id, 'Blocked', {}, 'blocked-key'), /Access denied/);
  assert.equal(getPikovaProjectView(state, viewer, project.id).tasks.length, 0);
});

test('idempotency key prevents duplicate outputs within a project', () => {
  const { state, project } = setup();
  const first = enqueuePikovaTask(state, owner, project.id, 'First', { event: 'M1' }, 'unique-1');
  const second = enqueuePikovaTask(state, owner, project.id, 'Repeated', { event: 'M1' }, 'unique-1');
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.task.id, second.task.id);
  assert.equal(state.tasks.length, 1);
});

test('validates inputs and limits payload size', () => {
  const { state, project } = setup();
  assert.throws(() => enqueuePikovaTask(state, owner, project.id, ' ', {}, 'key'), /Task title/);
  assert.throws(() => enqueuePikovaTask(state, owner, project.id, 'Valid', { value: 'x'.repeat(21000) }, 'key'), /20 KB/);
  assert.throws(() => processPikovaQueue(state, owner, project.id, 101), /Processing limit/);
});

test('processes only the selected project and records audit events', () => {
  const state = createPikovaState();
  const a = createPikovaProject(state, owner, 'A', { id: () => 'A' });
  const b = createPikovaProject(state, owner, 'B', { id: () => 'B' });
  enqueuePikovaTask(state, owner, a.id, 'A task', { event: 'M1' }, 'A-1');
  enqueuePikovaTask(state, owner, b.id, 'B task', { event: 'M2' }, 'B-1');
  const result = processPikovaQueue(state, owner, a.id);
  assert.deepEqual(result, { done: 1, failed: 0, remaining: 0 });
  assert.equal(state.tasks.find(task => task.projectId === b.id).status, 'queued');
  assert.ok(getPikovaProjectView(state, owner, a.id).audit.some(event => event.action === 'task.completed'));
});

test('overview counts only projects visible to the actor', () => {
  const state = createPikovaState();
  const a = createPikovaProject(state, owner, 'A');
  createPikovaProject(state, { id: 'other', role: 'owner' }, 'Private');
  grantPikovaRole(state, owner, a.id, viewer.id, 'viewer');
  const overview = getPikovaOverview(state, viewer);
  assert.equal(overview.projectCount, 1);
  assert.equal(overview.allocatedPlutons, 100);
  assert.equal(overview.targetProjects, 1000);
  assert.equal(overview.targetPlutons, 100000);
});

test('failed tasks can be retried only up to three attempts', () => {
  const { state, project } = setup();
  const { task } = enqueuePikovaTask(state, owner, project.id, 'Will fail', { event: 'M1' }, 'retry-key');
  task.title = '   '; // Simulate corrupted persisted state; normal enqueue rejects this.
  assert.equal(processPikovaQueue(state, owner, project.id).failed, 1);
  assert.equal(retryPikovaFailures(state, owner, project.id), 1);
  assert.equal(processPikovaQueue(state, owner, project.id).failed, 1);
  assert.equal(retryPikovaFailures(state, owner, project.id), 1);
  assert.equal(processPikovaQueue(state, owner, project.id).failed, 1);
  assert.equal(retryPikovaFailures(state, owner, project.id), 0);
  assert.equal(task.attempts, 3);
});


test('validates a complete backup and returns an independent state copy', () => {
  const { state, project } = setup();
  enqueuePikovaTask(state, owner, project.id, 'Backup task', { event: 'M1' }, 'backup-1');
  const restored = validatePikovaState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.projects.length, 1);
  assert.equal(restored.tasks.length, 1);
  assert.notEqual(restored.projects[0], state.projects[0]);
  restored.projects[0].name = 'Restored copy';
  assert.equal(state.projects[0].name, 'Project A');
});

test('rejects malformed backup, orphan tasks, duplicate idempotency keys, and reserved member IDs', () => {
  const { state, project } = setup();
  assert.throws(() => validatePikovaState({ version: 1, projects: [], tasks: 'bad', audit: [] }), /format/);
  const orphan = structuredClone(state);
  orphan.tasks.push({
    id: 'orphan-task', projectId: 'missing-project', idempotencyKey: 'k', title: 'Orphan',
    payload: {}, status: 'queued', attempts: 0, createdAt: 'now', updatedAt: 'now',
  });
  assert.throws(() => validatePikovaState(orphan), /missing project/);
  const duplicate = structuredClone(state);
  duplicate.tasks.push(
    { id: 'task-1', projectId: project.id, idempotencyKey: 'same', title: 'One', payload: {}, status: 'queued', attempts: 0, createdAt: 'now', updatedAt: 'now' },
    { id: 'task-2', projectId: project.id, idempotencyKey: 'same', title: 'Two', payload: {}, status: 'queued', attempts: 0, createdAt: 'now', updatedAt: 'now' },
  );
  assert.throws(() => validatePikovaState(duplicate), /duplicate idempotency keys/);
  const unsafeMembers = structuredClone(state);
  unsafeMembers.projects[0].members = JSON.parse('{"owner-1":"owner","__proto__":"viewer"}');
  assert.throws(() => validatePikovaState(unsafeMembers), /invalid project member/);
});

test('rejects access through inherited member keys and reserved member assignment', () => {
  const { state, project } = setup();
  assert.throws(() => getPikovaProjectView(state, { id: 'toString', role: 'viewer' }, project.id), /Access denied/);
  assert.throws(() => grantPikovaRole(state, owner, project.id, '__proto__', 'viewer'), /reserved object key/);
});
