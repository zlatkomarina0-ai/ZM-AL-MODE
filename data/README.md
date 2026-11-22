# Scheduled bulletin input

The scheduled GitHub Actions runner first reads `data/bulletin.json`. If that file is absent, it falls back to `data/bulletin.txt` and uses the local SportLife text parser.

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

Use real bulletin records only. Do not commit provider API keys or other secrets. The workflow performs deterministic local validation and creates JSON/CSV artifacts; it does not fetch a live SportLife bulletin and does not call any AI provider. Use `data/bulletin.txt` for raw text if that is the format you have. The text parser recognizes team-pair lines with a nearby `Конечен Тип` or `Конечен исход` odds block; review its output because unusual source layouts may not parse. Until either source file is supplied or updated, scheduled runs produce a `skipped_missing_bulletin` report rather than inventing matches.
