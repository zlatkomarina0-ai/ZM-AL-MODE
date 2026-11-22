'use strict';

/**
 * Local-first coordinator for server-connected Chief and Worker computers.
 * Transport/authentication belongs in the HTTP adapter; this module performs
 * no network requests and never reads provider API keys.
 *
 * The in-memory queue is a development adapter. Production deployments should
 * inject a durable store and authenticate every worker heartbeat/claim/report.
 */

const crypto = require('node:crypto');

const TASK_STATES = Object.freeze({
  QUEUED: 'queued',
  LEASED: 'leased',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

function id(prefix = 'task') {
  return `${prefix}_${crypto.randomUUID()}`;
}

function safeText(value, max = 2000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

function publicWorker(worker) {
  return {
    workerId: worker.workerId,
    chiefId: worker.chiefId,
    capabilities: [...worker.capabilities],
    status: worker.status,
    lastSeenAt: worker.lastSeenAt,
    activeTaskId: worker.activeTaskId || null,
  };
}

class WorkerFleet {
  constructor({ now = () => new Date().toISOString(), leaseMs = 60_000 } = {}) {
    this.now = now;
    this.leaseMs = leaseMs;
    this.workers = new Map();
    this.tasks = new Map();
    this.reports = new Map();
  }

  registerWorker({ workerId, chiefId, capabilities = [] }) {
    if (!workerId || !chiefId) throw new TypeError('workerId and chiefId are required');
    if (!Array.isArray(capabilities) || capabilities.some((x) => typeof x !== 'string')) {
      throw new TypeError('capabilities must be an array of strings');
    }
    const prior = this.workers.get(workerId);
    const worker = {
      workerId: safeText(workerId, 120),
      chiefId: safeText(chiefId, 120),
      capabilities: [...new Set(capabilities.map((x) => safeText(x, 80)))],
      status: 'idle',
      lastSeenAt: this.now(),
      activeTaskId: prior?.activeTaskId || null,
    };
    this.workers.set(worker.workerId, worker);
    return publicWorker(worker);
  }

  heartbeat(workerId) {
    const worker = this.#requireWorker(workerId);
    worker.lastSeenAt = this.now();
    return publicWorker(worker);
  }

  enqueueTask({ chiefId, kind, payload = {}, requiredCapabilities = [], priority = 0, parentTaskId = null }) {
    if (!chiefId || !kind) throw new TypeError('chiefId and kind are required');
    if (!Array.isArray(requiredCapabilities)) throw new TypeError('requiredCapabilities must be an array');
    const task = {
      taskId: id(),
      chiefId: safeText(chiefId, 120),
      kind: safeText(kind, 100),
      payload,
      requiredCapabilities: [...new Set(requiredCapabilities.map((x) => safeText(x, 80)))],
      priority: Number.isFinite(priority) ? priority : 0,
      parentTaskId: parentTaskId ? safeText(parentTaskId, 120) : null,
      state: TASK_STATES.QUEUED,
      createdAt: this.now(),
      leaseUntil: null,
      workerId: null,
      attempt: 0,
    };
    this.tasks.set(task.taskId, task);
    return this.#publicTask(task);
  }

  claimNext(workerId) {
    const worker = this.#requireWorker(workerId);
    this.#requeueExpiredLeases();
    if (worker.activeTaskId) return null;
    const task = [...this.tasks.values()]
      .filter((item) => item.state === TASK_STATES.QUEUED
        && item.chiefId === worker.chiefId
        && item.requiredCapabilities.every((cap) => worker.capabilities.includes(cap)))
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0];
    if (!task) {
      worker.status = 'idle';
      worker.lastSeenAt = this.now();
      return null;
    }
    task.state = TASK_STATES.LEASED;
    task.workerId = worker.workerId;
    task.attempt += 1;
    task.leaseUntil = Date.parse(this.now()) + this.leaseMs;
    worker.status = 'busy';
    worker.activeTaskId = task.taskId;
    worker.lastSeenAt = this.now();
    return this.#publicTask(task);
  }

  completeTask({ workerId, taskId, result, status = 'completed' }) {
    const worker = this.#requireWorker(workerId);
    const task = this.tasks.get(taskId);
    if (!task || task.state !== TASK_STATES.LEASED || task.workerId !== workerId) {
      throw new Error('Task lease not owned by this worker');
    }
    if (!['completed', 'failed'].includes(status)) throw new TypeError('status must be completed or failed');
    task.state = status === 'completed' ? TASK_STATES.COMPLETED : TASK_STATES.FAILED;
    task.leaseUntil = null;
    task.finishedAt = this.now();
    worker.status = 'idle';
    worker.activeTaskId = null;
    worker.lastSeenAt = this.now();
    const report = {
      reportId: id('report'),
      taskId,
      chiefId: task.chiefId,
      workerId,
      kind: task.kind,
      status,
      result,
      createdAt: this.now(),
    };
    this.reports.set(report.reportId, report);
    return { task: this.#publicTask(task), report };
  }

  /**
   * Fox triage only identifies investigation signals. It does not label a
   * person/team guilty or infer match-fixing from odds alone.
   */
  foxTriage({ chiefId, subject, signals = [], evidenceRefs = [] }) {
    if (!chiefId || !subject) throw new TypeError('chiefId and subject are required');
    const normalizedSignals = signals
      .filter((s) => s && typeof s.code === 'string' && typeof s.description === 'string')
      .map((s) => ({
        code: safeText(s.code, 80),
        description: safeText(s.description, 500),
        severity: ['low', 'medium', 'high'].includes(s.severity) ? s.severity : 'low',
        evidenceRef: s.evidenceRef ? safeText(s.evidenceRef, 300) : null,
      }));
    const report = {
      reportId: id('fox'),
      chiefId: safeText(chiefId, 120),
      subject: safeText(subject, 300),
      signals: normalizedSignals,
      evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs.filter((x) => typeof x === 'string').map((x) => safeText(x, 300)).slice(0, 100) : [],
      recommendation: normalizedSignals.some((s) => s.severity === 'high')
        ? 'dispatch_independent_review'
        : normalizedSignals.length
          ? 'request_more_evidence'
          : 'no_anomaly_detected_in_supplied_data',
      caveat: 'Signals are leads for review, not proof of misconduct. Preserve authorized audit records.',
      createdAt: this.now(),
    };
    this.reports.set(report.reportId, report);
    return report;
  }

  listWorkers(chiefId) {
    return [...this.workers.values()]
      .filter((worker) => !chiefId || worker.chiefId === chiefId)
      .map(publicWorker);
  }

  listReports(chiefId) {
    return [...this.reports.values()].filter((report) => !chiefId || report.chiefId === chiefId);
  }

  taskStatus(taskId) {
    const task = this.tasks.get(taskId);
    return task ? this.#publicTask(task) : null;
  }

  #requireWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error('Unknown worker; register it first');
    return worker;
  }

  #requeueExpiredLeases() {
    const current = Date.parse(this.now());
    for (const task of this.tasks.values()) {
      if (task.state === TASK_STATES.LEASED && task.leaseUntil <= current) {
        const worker = this.workers.get(task.workerId);
        if (worker?.activeTaskId === task.taskId) {
          worker.activeTaskId = null;
          worker.status = 'idle';
        }
        task.state = TASK_STATES.QUEUED;
        task.workerId = null;
        task.leaseUntil = null;
      }
    }
  }

  #publicTask(task) {
    return {
      taskId: task.taskId,
      chiefId: task.chiefId,
      kind: task.kind,
      payload: task.payload,
      requiredCapabilities: [...task.requiredCapabilities],
      priority: task.priority,
      parentTaskId: task.parentTaskId,
      state: task.state,
      createdAt: task.createdAt,
      workerId: task.workerId,
      attempt: task.attempt,
    };
  }
}

module.exports = { WorkerFleet, TASK_STATES };
