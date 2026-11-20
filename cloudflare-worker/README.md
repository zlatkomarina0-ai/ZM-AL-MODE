# ZLATKO AI MODE API gateway

This Cloudflare Worker exposes a small multi-provider endpoint for the First Brain.

## Endpoints

- `GET /health` — reports the service name and which provider secrets are configured. It never returns secret values.
- `POST /api/ai` — asks all configured providers by default, or only the requested providers.

Example request:

```json
{
  "message": "Review this plan and identify its biggest risks.",
  "context": "ZLATKO AI MODE first prototype",
  "providers": ["openai", "claude", "deepseek"]
}
```

The `providers` field is optional. Unknown provider names are ignored. The response preserves each provider's reply and any per-provider failures; this endpoint does not yet perform synthesis.

## Configure secrets

In Cloudflare Dashboard → Workers & Pages → `zlatko-api` → Settings → Variables and Secrets, add only the keys you have:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`

Optional model overrides:

- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `ANTHROPIC_MODEL` (default: `claude-3-5-haiku-latest`)
- `DEEPSEEK_MODEL` (default: `deepseek-chat`)

Use the secret type for API keys. Never put provider keys in `index.html`, `src/`, GitHub commits, or the Android application.

## Deploy

The repository workflow deploys this folder when a commit affecting `cloudflare-worker/**` reaches `main`, or when the workflow is manually run. It requires the GitHub Actions secret `CLOUDFLARE_API_TOKEN`.

After deployment, open `https://YOUR-WORKER-SUBDOMAIN.workers.dev/health` and confirm the service is reachable. The actual hostname depends on the Cloudflare account and must be copied from its dashboard.

## Security and limits

The worker has a message-size limit, provider timeout, and a small CORS allowlist for the current GitHub Pages and local/Capacitor origins. CORS is not authentication and does not prevent direct server requests. Before public production use, add an application-level access mechanism and rate limiting (for example, Cloudflare rate limiting / Turnstile or authenticated sessions), review expected API costs, and configure only the providers you intend to use.
