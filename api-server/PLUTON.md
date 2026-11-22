# PLUTON — local-only execution contract

## Hard rule

PLUTON must not call external AI providers or third-party APIs. There is no automatic provider fallback, no API-key lookup, and no paid inference path in the PLUTON server.

## Local engine

- 100 registered agent IDs: `pluton-agent-001` through `pluton-agent-100`
- 30 deterministic local code modules, shared by the agent profiles
- Up to 3,000 possible agent-to-code assignments
- Tasks execute only when explicitly included in a `fleet` payload
- Unknown agent IDs and unknown code IDs are rejected
- Each task result reports `networkCalls: 0`

The implementations are shared to avoid storing 3,000 duplicate programs. The number 3,000 is assignment capacity, not 3,000 separate running processes.

## Local server routes

- `GET /health` reports that the server is in local-only mode.
- `POST /api/pluton` accepts local PLUTON operations such as `health`, `listCodes`, `fleet`, `normalize`, `deduplicate`, `compare`, `validateTeams`, and `mockApi`.
- Unsupported routes return 404. Unsupported PLUTON operations do not trigger a network request.

## Verify locally

Run:

```sh
npm run test:pluton
npm run build
```

Do not mark this work complete until both commands pass in a real Node.js environment. A missing CI run is not a passing test.

## ZAMKA integrity card

- `POST /api/pluton` with `{ "operation": "zamka", "data": [...] }` runs the ZAMKA card locally.
- It checks duplicate records, missing IDs, and empty fields.
- Results remain `held` by default. A result is marked `released` only when `confirmed: true` is supplied and no integrity issues are found.
- ZAMKA is a deterministic integrity gate, not an AI model; it performs zero network calls.
- The current checks are a first implementation and should be expanded with competition-specific match/data rules as those rules are defined.
