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
