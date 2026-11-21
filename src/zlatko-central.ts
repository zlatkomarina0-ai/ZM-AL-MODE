/**
 * ZLATKO AI MODE — central orchestration core (planning/runtime-independent).
 *
 * This module defines the workflow and validates inputs. It does not start AI
 * processes, fetch sports data, call model APIs, or send reports externally.
 */

export type CentralStage =
  | 'received'
  | 'mapped'
  | 'assigned'
  | 'review'
  | 'voting'
  | 'ready_for_parliament'
  | 'blocked';

export interface CentralMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competitionId?: string;
  kickoff?: string;
  [key: string]: unknown;
}

export interface OperationalTeam {
  teamId: string;
  active: boolean;
  capacity?: number;
}

export interface MatchTask {
  taskId: string;
  matchId: string;
  teamId: string;
  match: CentralMatch;
  status: 'assigned' | 'reported' | 'needs_review';
}

export interface TeamReport {
  reportId: string;
  teamId: string;
  matchId: string;
  status: 'verified' | 'needs_review' | 'rejected';
  summary: string;
  evidence: string[];
  createdAt: string;
}

export interface Vote {
  voterId: string;
  choice: 'approve' | 'reject' | 'abstain';
  valid: boolean;
}

export interface VoteTally {
  validVotes: number;
  approve: number;
  reject: number;
  abstain: number;
  approvePercentOfValid: number;
  configuredWeightPerVoterPercent: number;
  countedWeightPercent: number;
  quorumReached: boolean;
  decision: 'approved' | 'rejected' | 'no_decision';
}

export interface CentralRun {
  runId: string;
  season: string;
  stage: CentralStage;
  receivedMatches: number;
  mappedMatches: CentralMatch[];
  tasks: MatchTask[];
  reports: TeamReport[];
  reviewMatchIds: string[];
  voteTally?: VoteTally;
  blockers: string[];
  createdAt: string;
}

export const CENTRAL_CONFIG = {
  plannedOperationalTeams: 1000,
  plannedWorkersPerTeam: 120,
  plannedChiefs: 1000,
  plannedTotalAgentRoles: 121000,
  plannedVoters: 1000,
  voterWeightPercent: 0.1,
  defaultQuorumPercent: 80,
} as const;

const nonEmpty = (s: string) => s.trim().length > 0;

export function createCentralRun(input: {
  runId: string;
  season: string;
  matches: CentralMatch[];
  teams: OperationalTeam[];
  createdAt?: string;
}): CentralRun {
  const blockers: string[] = [];
  const ids = new Set<string>();
  for (const match of input.matches) {
    if (!nonEmpty(match.matchId)) blockers.push('A match has an empty matchId.');
    else if (ids.has(match.matchId)) blockers.push(`Duplicate matchId: ${match.matchId}`);
    ids.add(match.matchId);
    if (!nonEmpty(match.homeTeam) || !nonEmpty(match.awayTeam)) {
      blockers.push(`Match ${match.matchId || '(unknown)'} is missing a team name.`);
    }
  }
  if (!nonEmpty(input.runId)) blockers.push('runId is required.');
  if (!nonEmpty(input.season)) blockers.push('season is required.');

  const activeTeams = input.teams.filter(t => t.active && nonEmpty(t.teamId));
  if (!activeTeams.length && input.matches.length) blockers.push('No active operational teams are configured.');
  if (new Set(activeTeams.map(t => t.teamId)).size !== activeTeams.length) {
    blockers.push('Duplicate active teamId values exist.');
  }

  if (blockers.length) {
    return {
      runId: input.runId,
      season: input.season,
      stage: 'blocked',
      receivedMatches: input.matches.length,
      mappedMatches: [],
      tasks: [],
      reports: [],
      reviewMatchIds: [],
      blockers,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
  }

  // In this first version, mapping is the intake validation boundary. Official
  // team/season resolution is supplied by the separate team registry.
  const mappedMatches = [...input.matches];
  const load = new Map(activeTeams.map(t => [t.teamId, 0]));
  const tasks: MatchTask[] = [];
  for (const match of mappedMatches) {
    const team = [...activeTeams].sort((a, b) =>
      (load.get(a.teamId) ?? 0) - (load.get(b.teamId) ?? 0) ||
      a.teamId.localeCompare(b.teamId),
    )[0];
    if (!team) continue;
    const capacity = team.capacity ?? Number.POSITIVE_INFINITY;
    if ((load.get(team.teamId) ?? 0) >= capacity) {
      blockers.push(`All active teams are at capacity; could not assign match ${match.matchId}.`);
      continue;
    }
    tasks.push({
      taskId: `${input.runId}:${match.matchId}`,
      matchId: match.matchId,
      teamId: team.teamId,
      match,
      status: 'assigned',
    });
    load.set(team.teamId, (load.get(team.teamId) ?? 0) + 1);
  }

  return {
    runId: input.runId,
    season: input.season,
    stage: blockers.length ? 'blocked' : 'assigned',
    receivedMatches: input.matches.length,
    mappedMatches,
    tasks,
    reports: [],
    reviewMatchIds: blockers.length ? input.matches.filter(m => !tasks.some(t => t.matchId === m.matchId)).map(m => m.matchId) : [],
    blockers,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function aggregateTeamReports(
  run: CentralRun,
  reports: TeamReport[],
): CentralRun {
  const blockers = [...run.blockers];
  const taskByMatch = new Map(run.tasks.map(task => [task.matchId, task]));
  const seen = new Set<string>();
  const accepted: TeamReport[] = [];
  const review = new Set(run.reviewMatchIds);

  for (const report of reports) {
    const task = taskByMatch.get(report.matchId);
    if (!task || task.teamId !== report.teamId) {
      blockers.push(`Report ${report.reportId} does not match an assigned task/team.`);
      review.add(report.matchId);
      continue;
    }
    if (seen.has(report.matchId)) {
      blockers.push(`Multiple reports received for match ${report.matchId}; manual review required.`);
      review.add(report.matchId);
      continue;
    }
    seen.add(report.matchId);
    if (!nonEmpty(report.summary) || !report.evidence.length || report.status !== 'verified') {
      review.add(report.matchId);
    }
    accepted.push(report);
  }

  for (const task of run.tasks) {
    if (!seen.has(task.matchId)) review.add(task.matchId);
  }

  const complete = accepted.length === run.tasks.length &&
    accepted.every(r => r.status === 'verified' && nonEmpty(r.summary) && r.evidence.length > 0) &&
    review.size === 0 && blockers.length === 0;

  return {
    ...run,
    stage: complete ? 'voting' : 'review',
    reports: accepted,
    reviewMatchIds: [...review],
    blockers,
  };
}

export function tallyVotes(
  votes: Vote[],
  options: { expectedVoters?: number; quorumPercent?: number } = {},
): VoteTally {
  const expectedVoters = options.expectedVoters ?? CENTRAL_CONFIG.plannedVoters;
  const quorumPercent = options.quorumPercent ?? CENTRAL_CONFIG.defaultQuorumPercent;
  const seen = new Set<string>();
  let approve = 0, reject = 0, abstain = 0;

  for (const vote of votes) {
    if (!vote.valid || !nonEmpty(vote.voterId) || seen.has(vote.voterId)) continue;
    seen.add(vote.voterId);
    if (vote.choice === 'approve') approve++;
    else if (vote.choice === 'reject') reject++;
    else abstain++;
  }

  const validVotes = approve + reject + abstain;
  const countedWeightPercent = validVotes * CENTRAL_CONFIG.voterWeightPercent;
  const approvePercentOfValid = validVotes ? approve / validVotes * 100 : 0;
  const quorumReached = expectedVoters > 0 && validVotes / expectedVoters * 100 >= quorumPercent;
  const decision = !quorumReached ? 'no_decision' : approve > reject ? 'approved' : 'rejected';

  return {
    validVotes, approve, reject, abstain,
    approvePercentOfValid,
    configuredWeightPerVoterPercent: CENTRAL_CONFIG.voterWeightPercent,
    countedWeightPercent,
    quorumReached,
    decision,
  };
}

export function prepareParliamentHandoff(run: CentralRun, tally?: VoteTally): {
  ready: boolean;
  payload: Record<string, unknown>;
  blockers: string[];
} {
  const blockers = [...run.blockers];
  if (run.stage !== 'voting' && run.stage !== 'ready_for_parliament') {
    blockers.push(`Run stage must be voting before handoff; current stage is ${run.stage}.`);
  }
  if (run.reviewMatchIds.length) blockers.push(`${run.reviewMatchIds.length} match(es) still require review.`);
  if (!tally || tally.decision === 'no_decision') blockers.push('A valid vote with quorum is required.');
  if (tally?.decision === 'rejected') blockers.push('The proposal was rejected by the vote.');

  return {
    ready: blockers.length === 0,
    payload: {
      runId: run.runId,
      season: run.season,
      stage: blockers.length === 0 ? 'ready_for_parliament' : run.stage,
      receivedMatches: run.receivedMatches,
      assignedTasks: run.tasks.length,
      verifiedReports: run.reports.filter(r => r.status === 'verified').length,
      reviewMatchIds: run.reviewMatchIds,
      voteTally: tally ?? null,
      reports: run.reports,
      generatedAt: new Date().toISOString(),
    },
    blockers,
  };
}
