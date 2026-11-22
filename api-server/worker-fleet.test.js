'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { WorkerFleet, TASK_STATES } = require('./worker-fleet');

test('workers only claim tasks for their chief and capabilities', () => {
  const fleet = new WorkerFleet();
  fleet.registerWorker({ workerId: 'w1', chiefId: 'chief-a', capabilities: ['web-research'] });
  fleet.registerWorker({ workerId: 'w2', chiefId: 'chief-b', capabilities: ['web-research', 'sports'] });
  fleet.enqueueTask({ chiefId: 'chief-a', kind: 'research', requiredCapabilities: ['web-research'] });
  fleet.enqueueTask({ chiefId: 'chief-a', kind: 'sports-check', requiredCapabilities: ['sports'] });
  assert.equal(fleet.claimNext('w1').kind, 'research');
  assert.equal(fleet.claimNext('w2'), null);
});

test('a leased task can only be completed by its assigned worker', () => {
  const fleet = new WorkerFleet();
  fleet.registerWorker({ workerId: 'w1', chiefId: 'chief-a', capabilities: ['check'] });
  fleet.registerWorker({ workerId: 'w2', chiefId: 'chief-a', capabilities: ['check'] });
  const task = fleet.enqueueTask({ chiefId: 'chief-a', kind: 'check', requiredCapabilities: ['check'] });
  fleet.claimNext('w1');
  assert.throws(() => fleet.completeTask({ workerId: 'w2', taskId: task.taskId, result: {} }), /lease not owned/);
  const completed = fleet.completeTask({ workerId: 'w1', taskId: task.taskId, result: { ok: true } });
  assert.equal(completed.task.state, TASK_STATES.COMPLETED);
  assert.equal(completed.report.chiefId, 'chief-a');
});

test('expired lease is returned to queue for another worker', () => {
  let ms = Date.parse('2026-01-01T00:00:00.000Z');
  const fleet = new WorkerFleet({ now: () => new Date(ms).toISOString(), leaseMs: 1000 });
  fleet.registerWorker({ workerId: 'w1', chiefId: 'chief-a', capabilities: ['check'] });
  fleet.registerWorker({ workerId: 'w2', chiefId: 'chief-a', capabilities: ['check'] });
  const task = fleet.enqueueTask({ chiefId: 'chief-a', kind: 'check', requiredCapabilities: ['check'] });
  fleet.claimNext('w1');
  ms += 1001;
  assert.equal(fleet.claimNext('w2').taskId, task.taskId);
});

test('fox triage asks for independent review on high severity signal without asserting guilt', () => {
  const fleet = new WorkerFleet();
  const report = fleet.foxTriage({
    chiefId: 'chief-a',
    subject: 'sample event',
    signals: [{ code: 'data-mismatch', description: 'Two trusted sources conflict', severity: 'high' }],
  });
  assert.equal(report.recommendation, 'dispatch_independent_review');
  assert.match(report.caveat, /not proof/);
});
