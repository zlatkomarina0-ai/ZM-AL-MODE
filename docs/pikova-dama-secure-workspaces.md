# PIKOVA DAMA ♠ — secure project workspaces

## Capacity model
- Target: 1,000 independent betting/tipping projects.
- Logical allocation: 100 Plutons per project.
- Total target: 100,000 logical Plutons.
- These are software planning figures. This implementation does not provision 100,000 running agents, processes, or computers.

## Implemented local engine
- Project workspaces have separate task lists and project-filtered audit views.
- Each project starts with an allocation of 100 logical Plutons.
- Roles: owner, operator, viewer. Owners manage membership; operators can enqueue and process tasks; viewers can only read their authorized project.
- Inputs validate project names, task titles, idempotency keys, JSON object payloads, and a 20 KB serialized payload limit.
- An idempotency key is unique within a project, preventing repeated submissions from creating duplicate tasks. The same key may be used in a different project.
- Each operation appends an audit event. Audit history is bounded to 50,000 events in the local state.
- Processing is deterministic local validation only. It does not generate betting predictions, place bets, contact providers, or make AI API calls.
- Failed tasks may be retried while attempts are below three. Normal enqueue validation prevents malformed tasks; tests simulate corrupted persisted state to exercise recovery.
- UI state is saved to this browser's localStorage and can be exported as JSON or restored from a JSON backup.
- Backup restore validates the schema, project/task relationships, duplicate IDs and idempotency keys, roles, payload size, retry counts, and audit-event references before replacing local state. Startup also validates saved local state; malformed saved data is not loaded.
- Restore is limited to a 5 MB file and asks for confirmation before replacing non-empty local state. Validation protects against malformed data but does not prove who created a backup.

## Security boundary — important
The current UI and state live in the browser. Role checks are application workflow controls, not a security boundary against a user who can edit localStorage or run modified JavaScript. Browser-local storage is not shared or backed up automatically. Production multi-user security requires server-side authentication, authorization on every request, a persistent database, and server-side audit storage. Those services are not claimed to exist in this module.

## Run and test
```sh
npm install
npm run build
npm run test:pluton
```

The test suite covers the 100,000 target calculation, project isolation, role enforcement, duplicate submission prevention, input validation, selected-project processing, audit events, visibility filtering, retry limits, valid backup restoration, malformed/orphaned records, duplicate idempotency keys, and reserved member keys.

## Independence from JOKER 2
PIKOVA DAMA is an independent AS PIK secure-workspace upgrade. It does not depend on or alter JOKER 2's coefficient scanning logic.
