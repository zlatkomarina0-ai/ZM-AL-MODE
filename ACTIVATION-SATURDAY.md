# ZLATKO AI MODE — Saturday activation readiness

## Intended sequence

1. **Server layer:** deploy the JOKER 3 / PLUTON Cloudflare Worker from `joker3-api/`. GitHub Actions is the deployment runner; it is not a permanently running computer.
2. **Gemini API:** store `GEMINI_API_KEY` only as a GitHub Actions secret and Cloudflare Worker secret. The workflow uploads it to the Worker without printing its value.
3. **PLUTON:** run the existing unit/regression tests and production build before deployment. The scheduled local PLUTON bulletin processor remains a separate local/offline processing workflow and does not yet call Gemini.
4. **Verification:** check the Worker health route, then perform a separate, explicitly approved test request to the Gemini route. Activation itself does not make a Gemini inference request.

## Saturday workflow

The workflow `.github/workflows/activate-zlatko-saturday.yml` is scheduled for 07:30 Europe/Skopje on Saturdays. Two UTC cron slots cover daylight-saving changes; a timezone guard skips the unused slot. It can also be run manually from GitHub Actions.

Before the first successful run, the repository owner must add these GitHub repository Actions secrets under Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN`: a valid Cloudflare API token with permission to deploy Workers to the target account.
- `GEMINI_API_KEY`: a Gemini API key from Google AI Studio.

Do not paste either secret into chat, commit it, or put it in a public file. The workflow deliberately fails before deployment if either secret is missing. If the Cloudflare token is invalid or lacks permission, deployment will fail and must not be described as active.

## Free-only boundary

- The Worker code has no paid-provider fallback.
- A free Gemini tier is not a guarantee of unlimited quota or zero cost under every Google project configuration. Verify the project's free-tier eligibility and billing settings before activation.
- The activation workflow runs tests/build and deploys configuration only; it does not send a live Gemini prompt.
- PLUTON scheduled processing still needs a real `data/bulletin.json` or `data/bulletin.txt` source. Without it, the workflow emits `skipped_missing_bulletin`.
- The Worker and the local PLUTON runner are not yet integrated into one automatic end-to-end task pipeline. This workflow prepares and deploys the Worker and validates PLUTON separately; it does not claim otherwise.
- Worker rate limiting is approximate and CORS is not authentication. Add an authentication/access layer before exposing it to untrusted users.

## Expected deployment result

The deployed Worker is named `joker3-pluton-mock-api`. Its health route is `/health`; the Gemini-compatible route is `/v1/gemini/chat/completions`. The exact `workers.dev` hostname depends on the Cloudflare account and must be confirmed from the deployment output before publishing it in the app.
