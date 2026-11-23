# JOKER 3 — External PLUTON API: Mock + Gemini

## Separate routes
- GET /health — configuration state and planned capacity; no secrets returned.
- GET /v1/models — mock model and Gemini route.
- POST /v1/chat/completions — deterministic mock; never calls an AI provider.
- POST /v1/gemini/chat/completions — server-side proxy to Google's Gemini API using the fixed model alias gemini-3.8-flash.

The Gemini route converts OpenAI-style messages to Gemini generateContent input and maps the result back to a chat.completion-shaped response. It uses the stable model ID `gemini-3.8-flash` rather than a moving `latest` alias. This is a compatibility wrapper, not a private API clone.

## Configure the key safely
After deploying the Worker, run:
```sh
cd joker3-api
npx wrangler secret put GEMINI_API_KEY
```
Enter the key only in Wrangler's secure prompt or the Cloudflare dashboard secret editor. Never put it in index.html, app JavaScript, GitHub source, wrangler.toml, or chat. The browser calls the Worker, not Google directly.

## Free-only controls
- Maximum 64 KiB request body, 20 Gemini messages, 4,000 characters/message, 20,000 total characters, 1,024 output tokens, and 20-second timeout.
- A Cloudflare Rate Limiting binding is required for the Gemini route and is configured for at most 10 Gemini requests per client IP per 60 seconds. The Worker fails closed if this binding is missing. Cloudflare's binding is approximate, not a strict global quota.
- Quota errors are returned clearly; there is no paid fallback or automatic retry.
- Code cannot guarantee a $0 account if the Google project has billing enabled. Confirm free-tier eligibility, quotas and billing controls in Google AI Studio before use. Availability depends on model, project and current Google terms.
- Gemini requests leave Cloudflare and are processed by Google under the account's applicable terms.

## Security limits
- The API key remains a server-side Worker secret and is never returned to callers.
- CORS/origin allowlisting is not authentication. This Worker does not implement robust per-user rate limiting or authentication.
- The Worker has an approximate per-IP rate limit, but still has no user authentication. Before public use, add an access/authentication layer; a public caller could otherwise consume the Google quota up to the configured limits.
- The upstream URL/model are fixed; user input cannot select a proxy target. Provider error bodies are not reflected to callers.
- 1,000 BR is a planned logical label; activeWorkers remains 0. No real worker infrastructure is provisioned.
- Deployment is manual and has not been performed. Gemini stays disabled until GEMINI_API_KEY is configured as a Worker secret.
## Cloudflare rate-limit binding\nThe Wrangler config adds `GEMINI_RATE_LIMITER` with a limit of 10 requests per 60 seconds per key. This is an abuse-reduction layer, not authentication or a strict global quota.\n\n## Tests
Run npm run test:pluton and npm run build.
