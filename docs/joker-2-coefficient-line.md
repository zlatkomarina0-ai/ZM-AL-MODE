# JOKER 2 — coefficient scanning line

JOKER 2 is a parallel line alongside the AS KARO / main ZLATKO AI MODE line. It classifies numeric coefficients from the imported bulletin into five non-overlapping bands.

| Coefficient band | Planned logical workers |
| --- | ---: |
| 2 to less than 5 | 500,000 |
| 5 to less than 10 | 500,000 |
| 10 to less than 20 | 500,000 |
| 20 through 30 | 500,000 |
| Greater than 30 | 500,000 |
| **Total** | **2,500,000** |

Boundary rules avoid double-counting: exactly 5 goes to the 5–10 band; 10 to 10–20; 20 to 20–30; 30 stays in 20–30; only values strictly above 30 go into the final band. Values below 2, non-numeric values and non-finite values are excluded.

## Inherited equipment target

- PLUTON CODE ♠ local processing; no provider API calls.
- Target of 1,000 web sources per logical worker.
- Shared project target of 200 million computers from the AS KARO line.
- Coefficients are classified locally from imported data. The JOKER 2 scanner does not crawl websites, provision computers, operate 2.5 million live workers, or produce betting predictions.

## Current implementation

The PLUTON tab contains a JOKER 2 panel that scans odds objects in already-imported tasks, counts coefficients in each band, shows up to 250 classified rows and exports the full classified list to CSV. The worker and computer figures remain architecture targets, not deployed resources. This path is local-only and does not spend money on API calls.
