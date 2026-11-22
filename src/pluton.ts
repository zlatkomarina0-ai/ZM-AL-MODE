/**
 * PLUTON CODE ♠ — deterministic, local-only task engine.
 * No network requests, API keys, remote model calls, or arbitrary code execution.
 */

export type PlutonStatus = 'queued' | 'done' | 'failed';
export type PlutonTaskKind = 'validate_match' | 'normalize_team' | 'json_validate';

export interface PlutonTask {
  id: string;
  title: string;
  kind: PlutonTaskKind;
  payload: Record<string, unknown>;
  chiefId: string;
  status: PlutonStatus;
  attempts: number;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlutonState {
  version: 1;
  tasks: PlutonTask[];
  lastRunAt: string | null;
}

const STORAGE_KEY = 'zlatko.pluton.state.v1';
const MAX_TASKS = 10000;
const MAX_TEXT_LENGTH = 100000;
const MAX_ATTEMPTS = 3;

function now(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function blankState(): PlutonState {
  return { version: 1, tasks: [], lastRunAt: null };
}

function readState(): PlutonState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      'version' in parsed && parsed.version === 1 &&
      'tasks' in parsed && Array.isArray(parsed.tasks) &&
      'lastRunAt' in parsed
    ) return parsed as PlutonState;
  } catch {
    // Storage can be disabled by browser privacy settings.
  }
  return blankState();
}

function writeState(state: PlutonState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The current operation still completes if persistent browser storage is unavailable.
  }
}

export function getPlutonState(): PlutonState {
  return readState();
}

export function normalizeTeamName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function asNonEmptyText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  if (value.length > MAX_TEXT_LENGTH) throw new Error(`${field} exceeds the text limit.`);
  return value.trim();
}

function processTask(task: PlutonTask): Record<string, unknown> {
  if (task.kind === 'normalize_team') {
    const raw = asNonEmptyText(task.payload.text, 'text');
    return { original: raw, normalized: normalizeTeamName(raw) };
  }

  if (task.kind === 'validate_match') {
    const matchId = asNonEmptyText(task.payload.matchId, 'matchId');
    const homeTeam = asNonEmptyText(task.payload.homeTeam, 'homeTeam');
    const awayTeam = asNonEmptyText(task.payload.awayTeam, 'awayTeam');
    const homeNormalized = normalizeTeamName(homeTeam);
    const awayNormalized = normalizeTeamName(awayTeam);
    const errors: string[] = [];
    if (homeNormalized === awayNormalized) errors.push('Home and away teams resolve to the same normalized name.');
    return { matchId, homeTeam, awayTeam, homeNormalized, awayNormalized, valid: errors.length === 0, errors };
  }

  if (task.kind === 'json_validate') {
    const raw = asNonEmptyText(task.payload.text, 'text');
    try {
      return { valid: true, parsed: JSON.parse(raw) as unknown };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
    }
  }

  throw new Error(`Unsupported PLUTON task kind: ${String(task.kind)}`);
}

export function importBulletin(input: string, chiefCount = 400): { imported: number; skipped: number } {
  if (input.length > MAX_TEXT_LENGTH * 10) throw new Error('Bulletin is too large (maximum 1,000,000 characters).');
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(`Bulletin is not valid JSON: ${error instanceof Error ? error.message : 'parse error'}`);
  }

  const records: unknown[] = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && 'matches' in parsed && Array.isArray(parsed.matches)
      ? parsed.matches
      : [];
  if (records.length === 0) throw new Error('Expected a JSON array or an object containing a "matches" array.');
  if (!Number.isInteger(chiefCount) || chiefCount < 1 || chiefCount > 1000) {
    throw new Error('Chief count must be an integer from 1 to 1000.');
  }

  const state = readState();
  const room = MAX_TASKS - state.tasks.length;
  const knownMatches = new Set<string>();
  for (const task of state.tasks) {
    const payload = task.payload;
    const matchId = typeof payload.matchId === 'string' ? payload.matchId.trim().toLocaleLowerCase() : '';
    const home = typeof payload.homeTeam === 'string' ? normalizeTeamName(payload.homeTeam) : '';
    const away = typeof payload.awayTeam === 'string' ? normalizeTeamName(payload.awayTeam) : '';
    if (matchId && home && away) knownMatches.add(`${matchId}|${home}|${away}`);
  }

  let imported = 0;
  let skipped = 0;
  const timestamp = now();
  const newTasks: PlutonTask[] = [];

  records.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      skipped += 1;
      return;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.homeTeam !== 'string' || !record.homeTeam.trim() ||
        typeof record.awayTeam !== 'string' || !record.awayTeam.trim()) {
      skipped += 1;
      return;
    }
    const matchId = typeof record.matchId === 'string' && record.matchId.trim()
      ? record.matchId.trim()
      : `MATCH-${String(index + 1).padStart(4, '0')}`;
    const homeTeam = record.homeTeam.trim();
    const awayTeam = record.awayTeam.trim();
    const dedupeKey = `${matchId.toLocaleLowerCase()}|${normalizeTeamName(homeTeam)}|${normalizeTeamName(awayTeam)}`;
    if (knownMatches.has(dedupeKey)) {
      skipped += 1;
      return;
    }
    knownMatches.add(dedupeKey);
    const chiefNumber = (index % chiefCount) + 1;
    newTasks.push({
      id: makeId(),
      title: `${matchId}: ${homeTeam} — ${awayTeam}`,
      kind: 'validate_match',
      payload: { ...record, matchId, homeTeam, awayTeam },
      chiefId: `CHIEF-${String(chiefNumber).padStart(4, '0')}`,
      status: 'queued',
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    imported += 1;
  });

  if (newTasks.length > room) {
    throw new Error(`Only ${room} task slots remain; this import contains ${newTasks.length} new unique matches.`);
  }
  state.tasks.push(...newTasks);
  writeState(state);
  return { imported, skipped };
}

export function runQueue(limit = 1000): { done: number; failed: number; remaining: number } {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TASKS) {
    throw new Error(`Processing limit must be an integer from 1 to ${MAX_TASKS}.`);
  }
  const state = readState();
  let done = 0;
  let failed = 0;

  for (const task of state.tasks) {
    if (done + failed >= limit) break;
    if (task.status !== 'queued') continue;
    task.attempts += 1;
    task.updatedAt = now();
    try {
      task.result = processTask(task);
      task.status = 'done';
      task.error = undefined;
      done += 1;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown local processing error.';
      failed += 1;
    }
  }

  state.lastRunAt = now();
  writeState(state);
  return { done, failed, remaining: state.tasks.filter(task => task.status === 'queued').length };
}

export function retryFailedTasks(): number {
  const state = readState();
  let retried = 0;
  for (const task of state.tasks) {
    if (task.status === 'failed' && task.attempts < MAX_ATTEMPTS) {
      task.status = 'queued';
      task.error = undefined;
      task.updatedAt = now();
      retried += 1;
    }
  }
  writeState(state);
  return retried;
}

export function clearCompletedTasks(): number {
  const state = readState();
  const before = state.tasks.length;
  state.tasks = state.tasks.filter(task => task.status === 'queued');
  writeState(state);
  return before - state.tasks.length;
}

export function exportReport(): string {
  const state = readState();
  const counts = {
    total: state.tasks.length,
    queued: state.tasks.filter(task => task.status === 'queued').length,
    done: state.tasks.filter(task => task.status === 'done').length,
    failed: state.tasks.filter(task => task.status === 'failed').length,
  };
  return JSON.stringify({
    system: 'ZLATKO AI MODE',
    engine: 'PLUTON CODE ♠',
    version: '0.3.0',
    mode: 'local-only / no API calls',
    generatedAt: now(),
    lastRunAt: state.lastRunAt,
    counts,
    tasks: state.tasks,
  }, null, 2);
}
