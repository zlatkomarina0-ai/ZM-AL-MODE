# JOKER 3 — External PLUTON Mock API

## Purpose
JOKER 3 is an isolated, API-compatible mock interface for testing integrations with the planned external PLUTON system. It uses familiar JSON shapes at `GET /v1/models` and `POST /v1/chat/completions`.

## Explicit limits
- This is a deterministic mock, not a copy of a private or proprietary API implementation.
- Responses are marked as simulated and echo a short preview of the last user message. No real AI model is called.
- 1,000 BR is a planned logical capacity label. `activeWorkers: 0` is returned intentionally; no workers, machines, or compute capacity are provisioned.
- No provider API calls, outbound network calls, proxying, website fetching, persistence, or real task execution.
- Request bodies are limited to 64 KiB; up to 100 messages and 4,000 characters per message.
- CORS permits only the GitHub Pages app origin and local Vite development origin. CORS is not authentication. The mock must not receive secrets, credentials, private data, or production workloads.
- No authentication is implemented. Treat it as a test-only interface and do not expose sensitive data.

## Routes
- `GET /health` — simulation status and planned capacity.
- `GET /v1/models` — one clearly labelled mock model.
- `POST /v1/chat/completions` — API-compatible response envelope with a deterministic simulation notice.

## Local validation
Run `npm run test:pluton` and `npm run build`.

## Separate deployment
The worker and `wrangler.toml` are separate from the existing health-only `zlatko-api` Worker. It is not deployed automatically. A deployment requires a valid Cloudflare Workers token configured in repository secrets; never commit or paste the token into source code or chat. Until a deployment is verified, no public JOKER 3 endpoint exists.
