# Distributed PLUTON worker architecture

## Intended topology

- **ZLATKO AI MODE / server:** authoritative coordinator. Creates tasks, routes them to a Chief, collects reports, and makes final decisions.
- **Chief computers:** manage worker membership and task assignments for their own team.
- **Worker computers:** heartbeat, claim a compatible task, execute approved local work, and return a result.
- **PLUTON:** local-first task logic. The fleet module itself makes no provider API calls.
- **Fox scout:** turns supplied observations into a structured investigation lead. High-severity signals request independent review; they do not prove misconduct by themselves.

## Task lifecycle

`queued -> leased -> completed|failed`

A lease expires if a worker disappears, making the task available again. Completion is accepted only from the worker holding the lease. Tasks are scoped to a Chief ID and required capabilities, preventing a worker from claiming another Chief's tasks.

## Included code

- `api-server/worker-fleet.js`: development coordinator with worker registration, heartbeat, capability-matched claiming, lease expiry/requeue, report collection, and Fox triage.
- `api-server/worker-fleet-router.js`: optional Express-compatible HTTP adapter for heartbeat, claim, and report submission. It requires an injected authentication middleware that sets `req.workerIdentity = { workerId, chiefId, scopes }`. Do not mount it without real authentication.
- `api-server/worker-fleet.test.js`: dependency-free Node tests for core queue behavior.
- `docs/distributed-pluton-workers.md`: this design and production checklist.

## Integration example

The existing server should create one fleet instance and mount the router only after implementing authentication:

```js
const express = require('express');
const { WorkerFleet } = require('./worker-fleet');
const { createWorkerFleetRouter } = require('./worker-fleet-router');

const fleet = new WorkerFleet();
app.use('/api/workers', createWorkerFleetRouter({
  express,
  fleet,
  authenticateWorker, // your real middleware; never a no-op
}));
```

This example is illustrative; it is not yet wired into `server.js`. The caller must also provide an authenticated Chief/admin-only path for worker registration and task creation. Never trust a client-supplied Chief ID as proof of identity.

## Production requirements before public exposure

1. Replace in-memory maps with a durable database/queue shared by all server instances.
2. Authenticate each computer with a server-issued worker identity; authorize every heartbeat, claim, report, registration, and task-creation action against that identity.
3. Use TLS, rate limits, request-body size limits, schema validation, and strict output redaction.
4. Keep an audit trail for task ownership, approvals, and state transitions. Redact secrets and minimize personal data; do not erase security records to conceal actions.
5. Add bounded retries, idempotency keys, worker concurrency limits, and stale-worker monitoring.
6. Test race conditions and duplicate report submissions before enabling concurrent production workers.
7. Run `npm run test:pluton` and a dedicated worker-fleet test command in CI before merging.

## API independence

The fleet module makes no network calls and does not access provider keys. Web-research workers still need an explicitly approved, permitted search source; local code cannot discover information that is not in its input or accessible sources. Any external AI/API call should be a separate server-side action with per-call approval, not an automatic fallback from PLUTON.
