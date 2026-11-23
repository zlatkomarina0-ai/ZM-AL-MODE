# ZLATKO AI MODE — PLUTON CODE ♠

## Current implementation
- PLUTON is added as a fifth tab in the existing app; the original Types/News/Social/Copilot screens are preserved.
- Imports JSON match arrays or objects with a `matches` array, CSV files (including AppSheet/Sheets exports with `homeTeam`/`awayTeam` or `domakin`/`gosti` headers), and the existing local SportLife parser.
- Round-robin assignment to 100, 400, or 1,000 logical chief labels.
- Duplicate match imports are skipped using match ID plus normalized home/away team names, including duplicates within the same imported bulletin.
- Local validation queue, bounded retry (maximum three attempts per task), task history, JSON report and expanded CSV export for manual Google Sheets/AppSheet import. CSV includes a stable UUID `ID`, match/team columns, status, attempts, validation/errors, source metadata, normalized team names, and timestamps.
- No external AI provider requests are made by PLUTON. No API key is required for this local mode.
- Browser storage is local to the current browser/device. It is not a shared server database.

## Run locally
Requirements: Node.js 22+ and npm.
```sh
npm install
npm run dev
npm run build
```

## Free-only and explicit-permission rule
The default is local/mock processing. No paid API fallback exists. Any future real provider request must require a separate, one-time, explicit approval for that exact request; approval must not be cached, reused, or treated as permanent. Do not add automatic provider calls to the queue runner.

## Current external blockers
- Cloudflare Worker deploy is manual-only until the repository secret `CLOUDFLARE_API_TOKEN` is replaced with a valid token having the required Workers permissions. The last deployment failed with Cloudflare authentication error 10000. No secret values should be committed.
- AppSheet is not linked directly to GitHub. CSV export is currently a manual import bridge, not automatic sync.
- Logical chief IDs are labels, not separate computers or running agents. The 200-million-computer target, 1,000 websites per worker, 100 real AI firms and 30 external models are not provisioned by this code.
- A GitHub Actions runner is configured for Tuesday/Friday around 07:30 Europe/Skopje (dual UTC cron slots with a daylight-saving-time guard). It processes `data/bulletin.json` and uploads JSON/CSV report artifacts without provider API calls. It does not fetch a live SportLife feed; until `data/bulletin.json` or `data/bulletin.txt` is supplied or updated with real matches, the run reports `skipped_missing_bulletin`. Raw text parsing depends on the known SportLife team-pair and final-odds pattern and should be checked against the real source.

## Build checks
GitHub Actions runs the PLUTON unit tests (`npm run test:pluton`) and `npm run build` for pull requests. The separate Pages workflow deploys the static site from `main`. The scheduled workflow also runs the local processor tests before processing the bulletin.

## JOKER 2 parallel line
- Added a local coefficient classifier with five non-overlapping bands: [2,5), [5,10), [10,20), [20,30], and >30.
- The target is 500,000 logical workers per band (2,500,000 total), with the AS KARO equipment targets inherited: PLUTON CODE ♠, 1,000 web sources per worker, and a shared target of 200 million computers.
- The PLUTON UI can classify coefficients from imported match tasks, show band counts and export a CSV report.
- These are logical architecture targets only. No live workers/computers/web crawlers are provisioned; no external AI provider calls are made.
- Design details: `docs/joker-2-coefficient-line.md`.


## PIKOVA DAMA ♠ — independent AS PIK secure-workspace upgrade
- Separate from JOKER 2; no dependency on the coefficient classifier.
- Target: 1,000 projects × 100 logical Plutons each = 100,000 logical Plutons. These are planned allocations, not active workers or machines.
- Added src/pluton-pikova-dama.ts: isolated project/task views, owner/operator/viewer roles, input validation, project-scoped idempotency, bounded audit events, local deterministic processing, and retry capped at three attempts.
- Added a PIKOVA DAMA UI panel with local project creation, task queue, project processing, role assignment, and JSON audit/state export. Data stays in this browser's localStorage unless exported manually.
- No paid services, provider API calls, live betting actions, or AI-generated predictions are used.
- Security boundary: browser-side roles are workflow controls, not server-grade authentication. Real multi-user security requires server-side authentication/authorization, persistent shared storage, and server-side audit logging; those are not implemented by this module.
- Tests: scripts/pikova-dama.test.mjs; run via npm run test:pluton. Design: docs/pikova-dama-secure-workspaces.md.


## DAMA TREF ♣ — input-only security policy (initial implementation)
- Added `src/pluton-dama-tref.ts`: exact-host HTTPS URL validation, default-deny outbound decision policy, role/action checks for admin/chief/worker/auditor, input size/type checks, heuristic quarantine of active HTML patterns, and bounded audit helper.
- Added `scripts/dama-tref.test.mjs` and included it in `npm run test:pluton`.
- The module makes no network requests. Source URLs can be validated, but source websites are not downloaded or stored by this change.
- Important boundary: this is client/library policy, not an enforced firewall, malware-signature antivirus, sandbox, or server-side authentication. Production requires trusted server/network enforcement, safe DNS/redirect handling, real file scanning, persistent server-side audit, and adversarial tests.
- Free-only: no new paid dependency or AI API call.
- Design: `docs/dama-tref-input-only-security.md`.



## DAMA TREF ♣ — bodyless source-read policy follow-up
- The request-decision helper now explicitly rejects source GET requests marked as carrying a body, in addition to blocking non-GET methods and private/internal payloads.
- Regression tests cover body-present and body-absent cases. This is still a policy decision helper; a trusted network service must enforce the actual request shape.



## DAMA TREF ♣ — strict allowlist validation follow-up
- Validates every source allowlist entry as a syntactically valid public DNS hostname, not only the requested URL hostname.
- Rejects IP literals, malformed labels, numeric top-level labels, wildcards, and URL-like allowlist entries; accepts case-insensitive names and a trailing DNS dot after normalization.
- Regression tests cover malformed/IP-based allowlist entries. This remains policy validation only and does not prevent DNS rebinding or enforce network isolation.



## DAMA TREF ♣ — boundary hardening follow-up
- Hardened the health-only Cloudflare Worker with restrictive browser security headers, no-store caching, origin allowlisting, and explicit `outboundNetwork: false`.
- Worker remains GET/OPTIONS-only; no website-fetch, proxy, upload, or AI API route is introduced.
- Added regression tests for headers, origin, methods, unknown routes, and accidental outbound-network calls in Worker source.
- This does not establish network-level egress controls or server-side employee authentication; deployment and infrastructure must be independently verified.


## JOKER 3 — External PLUTON mock API
- Added a separate test-only Worker under `joker3-api/`; it does not alter the existing health-only `zlatko-api` Worker.
- API-compatible routes: `GET /health`, `GET /v1/models`, and `POST /v1/chat/completions`.
- The mock response is explicitly labelled as simulated; it does not call a real AI model, external provider, or outbound network.
- Capacity label: 1,000 planned logical BR; `activeWorkers: 0`. No real workers or machines are provisioned.
- Request validation: JSON only, 64 KiB request limit, at most 100 messages and 4,000 characters per message; unapproved browser origins and unsupported routes/methods are rejected.
- No authentication, persistent storage, or real task execution. Do not send secrets or sensitive data; this is test-only and CORS is not authentication.
- Tests added to `npm run test:pluton`. Design: `docs/joker-3-mock-api.md`.
- Not deployed. A public endpoint will not exist until Cloudflare deployment is separately configured and verified; no token values belong in chat or source.

- A separate manual-only deployment workflow is defined at `.github/workflows/deploy-joker3-mock-api.yml`; it has not been run. The existing Cloudflare token was previously invalid, so deployment remains blocked until the repository secret is repaired by the owner.


## JOKER 3 — parallel Gemini API route (implemented in source; deployment still manual)
- Kept POST /v1/chat/completions as an independent deterministic mock; it never calls a provider.
- Added POST /v1/gemini/chat/completions, a server-side proxy to Google's fixed gemini-flash-latest generateContent endpoint. The key is read only from Cloudflare Worker secret GEMINI_API_KEY.
- Added bounded request validation (64 KiB body, up to 20 messages, 4,000 characters/message, 20,000 total characters, 1,024 output tokens), timeout, sanitized provider errors, quota handling, and no paid fallback or automatic retries.
- Zero cost is not guaranteed by code if the Google project has paid billing enabled. Owner must verify free-tier eligibility and quota/billing settings.
- CORS is not authentication and this Worker has no robust per-user rate limit. Configure Cloudflare edge rate limiting and an access/authentication layer before public use.
- Tests cover mock isolation, missing secret, mocked Gemini success, quota errors, validation and fixed upstream endpoint. No live Gemini API call was made during development.
- Not deployed. Owner must fix CLOUDFLARE_API_TOKEN, deploy manually, then configure GEMINI_API_KEY as a Worker secret. The 1,000 BR target is conceptual; activeWorkers is 0.


## JOKER 3 — Gemini route hardening follow-up
- Pinned the Gemini endpoint to the currently documented stable model ID `gemini-3.8-flash` rather than a moving `gemini-flash-latest` alias. Model availability and free quota still depend on Google.
- Added a required Cloudflare Worker Rate Limiting binding for the Gemini route: approximate 10 requests per client IP per 60 seconds. The route fails closed if the binding is absent and does not send the provider request when throttled.
- Normalizes consecutive same-role messages and validates that Gemini conversation history begins and ends with a user message, reducing malformed provider requests.
- This is not user authentication or a strict global quota. No live Gemini request was made. Deployment still requires valid Cloudflare credentials and the server-side GEMINI_API_KEY secret.


## ZM Sports Hub — navy and 24-karat-gold design (UI implementation)
- Added `sports.html` as a separate sports portal with dedicated pages for the worker workspace, Formula 1 news, Formula 1 calendar, Real Madrid news, Real Madrid fixtures, and the ZLATKO AI MODE copilot entry point.
- Applied a dark navy background with a large, low-opacity ZM watermark and gold accents. Added `zm-icon.svg` and `manifest.webmanifest` for the ZM app identity.
- Updated the existing `index.html` branding and added a ZM HUB link to the new portal.
- The worker page can save local notes in that browser's localStorage. Those notes are not sent to workers or a server.
- News and fixture pages link to official external sources. Live schedules, automatic calendar sync, alerts, background AI, and remote-worker distribution are not implemented by this UI change.
- JOKER 4 and AS HERC remain separate future work items and were not changed or merged into this sports UI.
