# DAMA TREF ♣ — input-only security policy

## Purpose
DAMA TREF is the security-policy layer for PLUTON CODE. Approved source material may be admitted for processing; internal data exports and arbitrary outbound communications are denied by default.

## Implemented
- Exact-host HTTPS URL validation; rejects HTTP, URL credentials, non-default ports, unlisted hosts, common private/local IP ranges and metadata hostnames.
- Default-deny outbound decision function. The only approved intent is a body-less GET to an allowlisted source; the module does not perform network requests.
- Least-privilege role checks for administrator, chief, worker and auditor.
- Input size/type checks and heuristic quarantine for active HTML/script patterns.
- Bounded audit-event helper and unit tests.

## Critical limitations
This is a policy library, not a deployed firewall, sandbox, antivirus engine, or server-side identity system. Browser code can be modified and localStorage edited. URL checks do not prevent DNS rebinding and cannot independently verify DNS resolution. Heuristic scanning is not malware signature scanning.

No website fetching is implemented here. No requests are sent to sources and no internal data is transmitted. A production acquisition service must enforce policy server-side, resolve and validate public IPs after DNS and on every redirect, block private/link-local/metadata ranges, restrict redirects and response sizes, scan files in quarantine, and deny arbitrary outbound sockets.

## Production work still required
- Isolated backend/worker with network egress denied by default.
- Permit only GET to reviewed sources; send no cookies, credentials, internal headers, or private payload.
- Server-side authentication, per-project authorization, and server-side audit storage.
- Maintained antivirus scanning in quarantine; never execute downloaded scripts or active content.
- Rate limits, concurrency limits, timeouts, response-size caps, content-type verification, and safe archive handling.
- Adversarial tests and deployment verification.

## Free-only constraint
No paid dependency, external AI API call, or automatic web fetch is added. This change tests the policy locally but does not provision production infrastructure.

## Tests
The npm script test:pluton runs PLUTON, PIKOVA DAMA, and DAMA TREF tests.

## Boundary hardening follow-up
- The health-only Cloudflare Worker now emits no-store and browser security headers, rejects unapproved Origin headers, and advertises that outbound network access is disabled.
- The Worker remains GET/OPTIONS-only and exposes no fetch, proxy, or source-download endpoint.
- Regression tests exercise origin/method/path behavior and scan the Worker source for accidental outbound-network capability.
- This is defense-in-depth, not proof of network-level egress isolation. Cloudflare account/network controls and a deployed endpoint still need independent verification.
