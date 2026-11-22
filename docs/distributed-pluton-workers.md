# Distributed PLUTON worker architecture

## Intended topology

- **ZLATKO AI MODE / server:** authoritative coordinator. Creates tasks, routes them to a Chief, collects reports, and makes final decisions.
- **Chief computers:** register workers under a Chief identity, assign task capabilities, and review reports from their own workers.
- **Worker computers:** heartbeat, claim a compatible task, execute approved local work, and return a result.
- **PLUTON:** local-first task logic. No provider API is called by the fleet module.
- **Fox scout:** turns supplied observations into a structured investigation lead. High-severity signals request independent review; they do not prove misconduct by themselves.

## Task lifecycle

`queued -> leased -> completed|failed`

A lease expires if a worker disappears, making the task available again. Completion is accepted only from the worker holding the lease. Tasks are scoped to a Chief ID and required capabilities, preventing a worker from claiming another Chief's tasks.

## Current implementation

`api-server/worker-fleet.js` is a dependency-free in-memory coordinator intended for development and integration. It includes worker registration, heartbeat, capability-matched claiming, lease expiry/requeue, report collection, and Fox triage. Unit tests are in `api-server/worker-fleet.test.js`.

## Production requirements before exposing endpoints

1. Replace the in-memory maps with a durable queue/store (e.g. a database already used by the application).
2. Authenticate every computer with a server-issued worker identity; never trust a client-supplied Chief ID by itself.
3. Authorize task claim, heartbeat, and report submission against that identity.
4. Use TLS, rate limits, payload size limits, and schema validation.
5. Keep an audit trail for task ownership, approvals, and state transitions. Redact secrets and minimize personal data; do not erase security records to conceal actions.
6. Add bounded retries, idempotency keys, worker concurrency limits, and stale-worker monitoring.
7. Connect to the existing HTTP server only after reviewing its current routing and authentication code. Do not expose this in-memory adapter directly to the public internet.

## API independence

This module makes no network calls and does not access provider keys. Web-research workers still need an explicitly approved, permitted search source; local code cannot discover information that is not in its input or accessible sources. Any external AI/API call should be a separate server-side action with per-call approval, not an automatic fallback from PLUTON.
