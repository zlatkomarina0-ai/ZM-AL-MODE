# ZLATKO AI MODE — PLUTON CODE ♠

## Current implementation
- PLUTON is added as a fifth tab in the existing app; the original Types/News/Social/Copilot screens are preserved.
- Imports JSON match arrays or objects with a `matches` array; the UI also offers the existing local SportLife parser.
- Round-robin assignment to 100, 400, or 1,000 logical chief labels.
- Local validation queue, bounded retry (maximum three attempts per task), task history, JSON report and CSV export for manual Google Sheets/AppSheet import.
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
- Scheduled Tue/Fri 07:30 execution is not active in this browser-only build; it requires a persistent scheduler/server and a source bulletin feed.

## Build checks
GitHub Actions runs `npm run build` and deploys the static site to GitHub Pages. Verify the latest workflow result in the Actions tab after each change.
