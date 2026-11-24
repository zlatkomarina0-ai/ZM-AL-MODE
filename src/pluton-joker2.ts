/** 
 * JOKER 2 — parallel coefficient-scanning line.
 * Configuration and analysis only; worker counts are logical targets, not provisioned machines.
 */

export interface Joker2Band {
  id: string;
  label: string;
  min: number;
  max: number | null;
  inclusiveMax: boolean;
  plannedWorkers: number;
}

export interface Joker2Coefficient {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  coefficient: number;
  bandId: string;
  bandLabel: string;
}

export const JOKER2_BANDS: readonly Joker2Band[] = [
  { id: '2-5', label: '2 до под 5', min: 2, max: 5, inclusiveMax: false, plannedWorkers: 500_000 },
  { id: '5-10', label: '5 до под 10', min: 5, max: 10, inclusiveMax: false, plannedWorkers: 500_000 },
  { id: '10-20', label: '10 до под 20', min: 10, max: 20, inclusiveMax: false, plannedWorkers: 500_000 },
  { id: '20-30', label: '20 до 30', min: 20, max: 30, inclusiveMax: true, plannedWorkers: 500_000 },
  { id: '30-plus', label: 'над 30', min: 30, max: null, inclusiveMax: false, plannedWorkers: 500_000 },
] as const;

export const JOKER2_TOTAL_PLANNED_WORKERS = JOKER2_BANDS.reduce((sum, band) => sum + band.plannedWorkers, 0);

export function classifyCoefficient(value: number): Joker2Band | null {
  if (!Number.isFinite(value) || value < 2) return null;
  return JOKER2_BANDS.find(band =>
    value >= band.min && (band.max === null || (band.inclusiveMax ? value <= band.max : value < band.max))
  ) ?? null;
}

export function scanMatchCoefficients(matches: unknown[]): Joker2Coefficient[] {
  const results: Joker2Coefficient[] = [];
  for (const item of matches) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const matchId = String(record.matchId ?? record.sifra ?? '').trim();
    const homeTeam = String(record.homeTeam ?? record.domakin ?? '').trim();
    const awayTeam = String(record.awayTeam ?? record.gosti ?? '').trim();

    // Do not classify orphan odds that cannot be traced to a real match row.
    if (!matchId || !homeTeam || !awayTeam) continue;

    const odds = record.odds;
    if (typeof odds !== 'object' || odds === null || Array.isArray(odds)) continue;
    for (const [market, rawValue] of Object.entries(odds as Record<string, unknown>)) {
      const coefficient = typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string' && rawValue.trim() !== ''
          ? Number(rawValue)
          : Number.NaN;
      const band = classifyCoefficient(coefficient);
      if (!band) continue;
      results.push({ matchId, homeTeam, awayTeam, market, coefficient, bandId: band.id, bandLabel: band.label });
    }
  }
  return results;
}

export function countJoker2Bands(rows: Joker2Coefficient[]): Record<string, number> {
  return Object.fromEntries(JOKER2_BANDS.map(band => [band.id, rows.filter(row => row.bandId === band.id).length]));
}
