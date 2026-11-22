# Scheduled bulletin input

The scheduled GitHub Actions runner reads `data/bulletin.json`.

Accepted structure:

```json
{
  "matches": [
    {
      "matchId": "MATCH-0001",
      "homeTeam": "Home team",
      "awayTeam": "Away team",
      "sport": "Football",
      "league": "League name",
      "odds": { "home": 1.8, "draw": 3.4, "away": 4.2 }
    }
  ]
}
```

Use real bulletin records only. Do not commit provider API keys or other secrets. The workflow performs deterministic local validation and creates JSON/CSV artifacts; it does not fetch a live SportLife bulletin and does not call any AI provider. Until this file is supplied or updated, scheduled runs will produce a `skipped_missing_bulletin` report rather than inventing matches.
