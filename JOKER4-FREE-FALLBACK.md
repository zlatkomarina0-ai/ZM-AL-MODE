# JOKER 4 — free-provider AI fallback

The Worker exposes `POST /v1/copilot/chat/completions`. The existing `POST /v1/gemini/chat/completions` route remains as a compatibility alias. The mock endpoint `/v1/chat/completions` stays simulated and never calls an AI provider.

## Provider order

1. Google Gemini, using the server-side `GEMINI_API_KEY`.
2. OpenRouter, pinned to the free-only `openrouter/free` router.
3. Groq, only if all of `GROQ_API_KEY`, `GROQ_MODEL`, and `GROQ_FREE_TIER_CONFIRMED=true` are configured. Groq is deliberately skipped by default because model pricing and account terms can vary; confirm the selected model and account are genuinely free before enabling it.

Provider timeouts, quota errors, HTTP errors, and empty responses move to the next configured provider. Error bodies and secrets are never returned to the browser. The response identifies the successful provider. If all configured providers fail, the API returns a sanitized `503 all_free_ai_providers_failed` error. No paid fallback is configured.

## GitHub Actions secrets

Add these as repository Actions secrets; never commit or paste their values into chat:

- Required for Gemini-first operation: `GEMINI_API_KEY`
- Optional: `OPENROUTER_API_KEY`
- Optional: `GROQ_API_KEY`

The Saturday activation workflow uploads the optional provider keys only when they are present. For Groq, configure Worker variables `GROQ_MODEL` and `GROQ_FREE_TIER_CONFIRMED=true` only after verifying free-tier eligibility. The Google account's Gemini quota and eligibility must also be checked separately.

## Endpoints and limits

- `GET /health` reports whether provider secrets/bindings are configured, without exposing values.
- `GET /v1/models` lists the compatibility and fallback routes.
- `POST /v1/copilot/chat/completions` is the preferred JOKER 4 route.
- `POST /v1/gemini/chat/completions` is retained as an alias.

All requests use the existing Cloudflare rate-limit binding. Automated tests mock provider responses; they do not make live API requests or consume provider quota. Free-provider availability and rate limits are not guaranteed.
