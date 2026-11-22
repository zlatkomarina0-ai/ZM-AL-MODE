/**
 * ZLATKO AI MODE — 12-role / 3-team architecture.
 *
 * This module defines role metadata and the hand-off sequence only.
 * It does not fetch live sports data, make accusations, or call external AI APIs.
 * Suspicious signals are leads for verification, never proof of match-fixing.
 */

export type ZlatkoTeamId = 'team-1-investigation' | 'team-2-processing' | 'team-3-continuous-intake';
export type ZlatkoRoleId =
  | 'eagle' | 'falcon' | 'monkey' | 'rabbit' | 'fox' | 'wolf'
  | 'elephant' | 'bear' | 'turtle' | 'human' | 'computer' | 'leech';

export interface ZlatkoRole {
  id: ZlatkoRoleId;
  name: string;
  teamId: ZlatkoTeamId;
  responsibilities: string[];
  worksWith: ZlatkoRoleId[];
}

export const ZLATKO_TEAMS = [
  {
    id: 'team-1-investigation',
    name: 'Team 1 — Reconnaissance and investigation',
    roleIds: ['eagle', 'falcon', 'monkey', 'rabbit', 'fox', 'wolf'],
    purpose: 'Detect unusual match signals, scout quickly, and verify leads collaboratively.',
  },
  {
    id: 'team-2-processing',
    name: 'Team 2 — Information processing and polishing',
    roleIds: ['elephant', 'bear', 'turtle', 'human', 'computer'],
    purpose: 'Process, cross-check, and polish collected information with continuity and human/computer participation.',
  },
  {
    id: 'team-3-continuous-intake',
    name: 'Team 3 — Continuous information intake',
    roleIds: ['leech'],
    purpose: 'Maintain a persistent, permissioned stream of information about the team and match.',
  },
] as const;

export const ZLATKO_ROLES: Record<ZlatkoRoleId, ZlatkoRole> = {
  eagle: {
    id: 'eagle', name: 'Орел', teamId: 'team-1-investigation',
    responsibilities: ['Scan the broad match landscape from a high-level view', 'Flag unusual signals for further checking'],
    worksWith: ['falcon', 'rabbit', 'fox', 'wolf'],
  },
  falcon: {
    id: 'falcon', name: 'Сокол', teamId: 'team-1-investigation',
    responsibilities: ['Scan for fast-changing or concentrated signals', 'Direct attention to matches that need closer review'],
    worksWith: ['eagle', 'rabbit', 'fox', 'wolf'],
  },
  monkey: {
    id: 'monkey', name: 'Мајмун', teamId: 'team-1-investigation',
    responsibilities: ['Act as the team’s distraction/decoy role in the user-defined workflow', 'Keep watch and signal interruptions while the scout gathers information'],
    worksWith: ['rabbit', 'eagle', 'falcon', 'fox', 'wolf'],
  },
  rabbit: {
    id: 'rabbit', name: 'Зајак', teamId: 'team-1-investigation',
    responsibilities: ['Rapidly scout a flagged match', 'Collect and organize potential evidence for the investigators'],
    worksWith: ['eagle', 'falcon', 'monkey', 'fox', 'wolf'],
  },
  fox: {
    id: 'fox', name: 'Лисица', teamId: 'team-1-investigation',
    responsibilities: ['Investigate leads in detail', 'Cross-check information and identify gaps before reporting'],
    worksWith: ['rabbit', 'wolf', 'eagle', 'falcon'],
  },
  wolf: {
    id: 'wolf', name: 'Волк', teamId: 'team-1-investigation',
    responsibilities: ['Investigate alongside the Fox', 'Independently corroborate evidence and findings'],
    worksWith: ['rabbit', 'fox', 'eagle', 'falcon'],
  },
  elephant: {
    id: 'elephant', name: 'Слон', teamId: 'team-2-processing',
    responsibilities: ['Support high-volume information processing', 'Help maintain continuity when paired with the Bear'],
    worksWith: ['bear', 'turtle', 'human', 'computer'],
  },
  bear: {
    id: 'bear', name: 'Мечка', teamId: 'team-2-processing',
    responsibilities: ['Handle heavy processing workload', 'Back up the Elephant if either partner fails or stalls'],
    worksWith: ['elephant', 'turtle', 'human', 'computer'],
  },
  turtle: {
    id: 'turtle', name: 'Желка', teamId: 'team-2-processing',
    responsibilities: ['Perform deliberately slow, careful processing', 'Allow time for information to be checked and polished'],
    worksWith: ['elephant', 'bear', 'human', 'computer'],
  },
  human: {
    id: 'human', name: 'Човек', teamId: 'team-2-processing',
    responsibilities: ['Human role in the information-processing team; detailed permissions and actions are configured by the system owner'],
    worksWith: ['elephant', 'bear', 'turtle', 'computer'],
  },
  computer: {
    id: 'computer', name: 'Компјутер', teamId: 'team-2-processing',
    responsibilities: ['Computer role in the information-processing team; concrete tools and actions are configured by the system owner'],
    worksWith: ['elephant', 'bear', 'turtle', 'human'],
  },
  leech: {
    id: 'leech', name: 'Пијавица', teamId: 'team-3-continuous-intake',
    responsibilities: ['Maintain continuous, permissioned collection of team and match information', 'Recover the feed when interrupted and mark any data gaps'],
    worksWith: ['eagle', 'falcon', 'rabbit', 'fox', 'wolf', 'elephant', 'bear', 'turtle', 'human', 'computer'],
  },
};

export type InvestigationStage =
  | 'received'
  | 'scanned'
  | 'scouting'
  | 'joint-investigation'
  | 'processing'
  | 'review-required'
  | 'verified'
  | 'rejected';

export interface InvestigationCase {
  caseId: string;
  matchId: string;
  stage: InvestigationStage;
  signals: string[];
  scoutFindings: string[];
  evidence: string[];
  assignedRoles: ZlatkoRoleId[];
  notes: string[];
}

/** Start the user-defined sequence after the Eagle/Falcon scan finds an anomaly. */
export function startInvestigation(input: {
  caseId: string;
  matchId: string;
  scanSignals: string[];
}): InvestigationCase {
  const signals = input.scanSignals.map(s => s.trim()).filter(Boolean);
  if (!input.caseId.trim() || !input.matchId.trim()) {
    throw new Error('caseId and matchId are required.');
  }
  return {
    caseId: input.caseId,
    matchId: input.matchId,
    stage: signals.length ? 'scouting' : 'received',
    signals,
    scoutFindings: [],
    evidence: [],
    assignedRoles: signals.length
      ? ['eagle', 'falcon', 'rabbit', 'monkey']
      : ['leech'],
    notes: signals.length
      ? ['Rabbit scouts first; Monkey keeps watch in the defined workflow. Signals are leads, not proof.']
      : ['No scan signal supplied; continuous intake may keep collecting permitted data.'],
  };
}

/** Promote the case to a joint investigation only after scout findings are recorded. */
export function escalateToJointInvestigation(
  investigation: InvestigationCase,
  scoutFindings: string[],
): InvestigationCase {
  const findings = scoutFindings.map(s => s.trim()).filter(Boolean);
  if (!findings.length) {
    return {
      ...investigation,
      stage: 'review-required',
      notes: [...investigation.notes, 'Escalation held: no scout findings were supplied.'],
    };
  }
  return {
    ...investigation,
    stage: 'joint-investigation',
    scoutFindings: [...investigation.scoutFindings, ...findings],
    assignedRoles: ['eagle', 'falcon', 'rabbit', 'monkey', 'fox', 'wolf'],
    notes: [...investigation.notes, 'Fox and Wolf join; all six roles collaborate and cross-check evidence.'],
  };
}

/** Add evidence and send it to Team 2 for polishing; never labels suspicion as confirmed by itself. */
export function submitForProcessing(
  investigation: InvestigationCase,
  evidence: string[],
): InvestigationCase {
  const cleanEvidence = evidence.map(s => s.trim()).filter(Boolean);
  if (!cleanEvidence.length) {
    return {
      ...investigation,
      stage: 'review-required',
      notes: [...investigation.notes, 'Processing held: no evidence items were supplied.'],
    };
  }
  return {
    ...investigation,
    stage: 'processing',
    evidence: [...investigation.evidence, ...cleanEvidence],
    assignedRoles: ['elephant', 'bear', 'turtle', 'human', 'computer', 'leech'],
    notes: [...investigation.notes, 'Team 2 polishes and cross-checks the material; Team 3 maintains the permitted information feed.'],
  };
}

/** Mark a case verified only after an explicit reviewer decision and evidence references. */
export function finalizeInvestigation(
  investigation: InvestigationCase,
  decision: 'verified' | 'rejected',
  reviewer: string,
): InvestigationCase {
  if (!reviewer.trim()) throw new Error('A reviewer identity is required.');
  if (!investigation.evidence.length) {
    return {
      ...investigation,
      stage: 'review-required',
      notes: [...investigation.notes, 'Finalization blocked: evidence is required.'],
    };
  }
  return {
    ...investigation,
    stage: decision,
    notes: [...investigation.notes, `Final decision ${decision} recorded by reviewer: ${reviewer.trim()}.`],
  };
}
