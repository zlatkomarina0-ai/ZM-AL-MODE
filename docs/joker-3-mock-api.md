# JOKER 3 — External PLUTON API: Mock + Gemini

## Separate routes
- GET /health — configuration state and planned capacity; no secrets returned.
- GET /v1/models — mock model and Gemini route.
- POST /v1/chat/completions — deterministic mock; never calls an AI provider.
- POST /v1/gemini/chat/completions — server-side proxy to Google's Gemini API using the fixed model alias gemini-flash-latest.

The Gemini route converts OpenAI-style messages to Gemini generateContent input and maps the result back to a chat.completion-shaped response. This is a compatibility wrapper, not a private API clone.

## Configure the key safely
After deploying the Worker, run:
```sh
cd joker3-api
npx wrangler secret put GEMINI_API_KEY
```
Enter the key only in Wrangler's secure prompt or the Cloudflare dashboard secret editor. Never put it in index.html, app JavaScript, GitHub source, wrangler.toml, or chat. The browser calls the Worker, not Google directly.

## Free-only controls
- Maximum 64 KiB request body, 20 Gemini messages, 4,000 characters/message, 20,000 total characters, 1,024 output tokens, and 20-second timeout.
- Quota errors are returned clearly; there is no paid fallback or automatic retry.
- Code cannot guarantee a $0 account if the Google project has billing enabled. Confirm free-tier eligibility, quotas and billing controls in Google AI Studio before use. Availability depends on model, project and current Google terms.
- Gemini requests leave Cloudflare and are processed by Google under the account's applicable terms.

## Security limits
- The API key remains a server-side Worker secret and is never returned to callers.
- CORS/origin allowlisting is not authentication. This Worker does not implement robust per-user rate limiting or authentication.
- Before public use, configure Cloudflare edge rate limiting and an appropriate access/authentication layer; otherwise an external caller could consume the Google quota.
- The upstream URL/model are fixed; user input cannot select a proxy target. Provider error bodies are not reflected to callers.
- 1,000 BR is a planned logical label; activeWorkers remains 0. No real worker infrastructure is provisioned.
- Deployment is manual and has not been performed. Gemini stays disabled until GEMINI_API_KEY is configured as a Worker secret.
## Tests
Run npm run test:pluton and npm run build.
