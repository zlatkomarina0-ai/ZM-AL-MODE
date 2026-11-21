/**
 * ZLATKO AI MODE — seasonal team registry foundation.
 *
 * Team names/rosters are deliberately kept separate from competition metadata:
 * do not treat estimated competition capacities as verified seasonal rosters.
 */

export type Sport = 'football' | 'handball' | 'basketball';

export interface CompetitionDefinition {
  id: string;
  name: string;
  sport: Sport;
  expectedEntries: number | null;
  rosterStatus: 'needs_official_roster' | 'capacity_estimate';
}

export interface Club {
  clubId: string;
  canonicalName: string;
  aliases: string[];
  active: boolean;
}

export interface SeasonMembership {
  season: string;
  competitionId: string;
  clubId: string;
  source: string;
  verified: boolean;
  active: boolean;
}

export interface BulletinMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  [key: string]: unknown;
}

export interface FilteredMatch<T extends BulletinMatch> {
  match: T;
  homeClubId: string;
  awayClubId: string;
}

export const TARGET_SEASON = '2026/27';

/**
 * Counts below are planning estimates, not confirmation that each competition's
 * final 2026/27 roster has been officially published or verified.
 */
export const TARGET_COMPETITIONS: CompetitionDefinition[] = [
  { id: 'football-uefa-champions-league', name: 'UEFA Champions League', sport: 'football', expectedEntries: 36, rosterStatus: 'capacity_estimate' },
  { id: 'football-uefa-europa-league', name: 'UEFA Europa League', sport: 'football', expectedEntries: 36, rosterStatus: 'capacity_estimate' },
  { id: 'football-uefa-conference-league', name: 'UEFA Conference League', sport: 'football', expectedEntries: 36, rosterStatus: 'capacity_estimate' },
  { id: 'football-la-liga', name: 'La Liga', sport: 'football', expectedEntries: 20, rosterStatus: 'capacity_estimate' },
  { id: 'football-segunda-division', name: 'La Liga 2 / Segunda División', sport: 'football', expectedEntries: 22, rosterStatus: 'capacity_estimate' },
  { id: 'handball-ehf-champions-league', name: 'EHF Champions League', sport: 'handball', expectedEntries: 24, rosterStatus: 'capacity_estimate' },
  { id: 'handball-ehf-european-league', name: 'EHF European League', sport: 'handball', expectedEntries: null, rosterStatus: 'needs_official_roster' },
  { id: 'basketball-aba-liga', name: 'ABA Liga', sport: 'basketball', expectedEntries: 20, rosterStatus: 'capacity_estimate' },
  { id: 'basketball-euroleague', name: 'EuroLeague', sport: 'basketball', expectedEntries: 20, rosterStatus: 'capacity_estimate' },
  { id: 'basketball-eurocup', name: 'EuroCup', sport: 'basketball', expectedEntries: 32, rosterStatus: 'capacity_estimate' },
];

export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function validateCompetitionDefinitions(
  competitions: CompetitionDefinition[] = TARGET_COMPETITIONS,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const competition of competitions) {
    if (ids.has(competition.id)) errors.push(`Duplicate competition id: ${competition.id}`);
    ids.add(competition.id);
    if (!competition.id.trim() || !competition.name.trim()) {
      errors.push('Every competition needs a non-empty id and name.');
    }
    if (competition.expectedEntries !== null && competition.expectedEntries < 1) {
      errors.push(`Invalid expectedEntries for ${competition.id}`);
    }
  }
  if (competitions.length !== 10) errors.push(`Expected 10 competitions, found ${competitions.length}`);
  return errors;
}

export function buildClubLookup(clubs: Club[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const club of clubs) {
    if (!club.clubId.trim()) throw new Error('Club_ID must not be empty.');
    const names = [club.canonicalName, ...club.aliases];
    for (const name of names) {
      const key = normalizeTeamName(name);
      if (!key) continue;
      const existing = lookup.get(key);
      if (existing && existing !== club.clubId) {
        throw new Error(`Ambiguous team alias "${name}" maps to both ${existing} and ${club.clubId}`);
      }
      lookup.set(key, club.clubId);
    }
  }
  return lookup;
}

/** Only verified, active memberships in the selected season enter the tracker. */
export function getTrackedClubIds(
  season: string,
  clubs: Club[],
  memberships: SeasonMembership[],
): Set<string> {
  const activeClubIds = new Set(clubs.filter(club => club.active).map(club => club.clubId));
  return new Set(
    memberships
      .filter(row => row.season === season && row.active && row.verified && activeClubIds.has(row.clubId))
      .map(row => row.clubId),
  );
}

/**
 * Keeps a bulletin match only when both sides resolve to registered clubs for
 * this season. Unknown/unverified names are returned separately for review.
 */
export function filterBulletin<T extends BulletinMatch>(
  season: string,
  matches: T[],
  clubs: Club[],
  memberships: SeasonMembership[],
): { included: FilteredMatch<T>[]; review: T[] } {
  const lookup = buildClubLookup(clubs);
  const tracked = getTrackedClubIds(season, clubs, memberships);
  const included: FilteredMatch<T>[] = [];
  const review: T[] = [];

  for (const match of matches) {
    const homeClubId = lookup.get(normalizeTeamName(match.homeTeam));
    const awayClubId = lookup.get(normalizeTeamName(match.awayTeam));
    if (homeClubId && awayClubId && tracked.has(homeClubId) && tracked.has(awayClubId)) {
      included.push({ match, homeClubId, awayClubId });
    } else {
      review.push(match);
    }
  }
  return { included, review };
}

/** Calculates planning capacity only; it never represents unique clubs. */
export function getPlanningCapacity(
  competitions: CompetitionDefinition[] = TARGET_COMPETITIONS,
): { knownEntries: number; unconfirmedCompetitions: string[] } {
  return {
    knownEntries: competitions.reduce((sum, competition) => sum + (competition.expectedEntries ?? 0), 0),
    unconfirmedCompetitions: competitions
      .filter(competition => competition.expectedEntries === null || competition.rosterStatus !== 'capacity_estimate')
      .map(competition => competition.name),
  };
}
