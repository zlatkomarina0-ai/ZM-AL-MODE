# ZLATKO AI MODE — Render API deployment

This deploys the API service only. It does not publish the web frontend or configure a live service automatically.

## 1. Create the Render service

1. Sign in to Render and choose **New → Blueprint**.
2. Connect the GitHub repository `zlatkomarina0-ai/ZM-AL-MODE`.
3. Select branch `feature/first-brain-core` while testing the open pull request.
4. Let Render read `render.yaml` and create the service.
5. In the service's Environment settings, add at least one provider key, for example `OPENAI_API_KEY`. Add keys only in Render's secret environment-variable interface—never commit them to Git or paste them into chat.
6. Wait for deployment to finish and open `https://YOUR-SERVICE.onrender.com/health`. A healthy response includes `"ok":true`. If no keys were configured, `configuredProviders` will be empty.

## 2. Connect the frontend

The current frontend reads `window.ZLATKO_API_URL` before calling `POST /api/ai`. Set it to the deployed service's base URL (no trailing slash), then rebuild/redeploy the frontend. The service URL is not known until Render creates it, so this connection cannot be completed beforehand.

The API's default CORS allowlist includes the project's GitHub Pages origin and local development origins. If the frontend is hosted elsewhere, set `ALLOWED_ORIGINS` in Render to a comma-separated list of exact allowed origins.

## 3. Test the chat

From the deployed frontend, send a short non-sensitive test message. Confirm that the chat displays a provider reply. The `/health` endpoint reports service health and configured provider names; it does not prove that a provider key is valid. A real chat request is needed to test provider authentication.

## Notes

- Keep provider API keys on the server only.
- Do not merge the pull request to `main` until the branch is reviewed and the deployment path is tested.
- This server returns independent provider replies; it does not yet synthesize them into one final report.
- Render free instances may sleep when idle, so the first request can take longer.
