/**
 * PIKOVA DAMA — isolated, local-first workspaces for the AS PIK secure tipping system.
 * Pluton counts are logical allocation targets, not running agents or machines.
 * Browser-side role checks are workflow controls, not server-grade authentication.
 */

export const PIKOVA_PROJECT_LIMIT = 1_000;
export const PIKOVA_PLUTONS_PER_PROJECT = 100;
export const PIKOVA_PLUTON_TARGET = PIKOVA_PROJECT_LIMIT * PIKOVA_PLUTONS_PER_PROJECT;
export const PIKOVA_MAX_ATTEMPTS = 3;
export const PIKOVA_MAX_TITLE_LENGTH = 160;
export const PIKOVA_MAX_PAYLOAD_LENGTH = 20_000;

export type PikovaRole = 'owner' | 'operator' | 'viewer';
export type PikovaTaskStatus = 'queued' | 'done' | 'failed';

export interface PikovaActor {
  id: string;
  role: PikovaRole;
}

export interface PikovaProject {
  id: string;
  name: string;
  ownerId: string;
  members: Record<string, PikovaRole>;
  plutonAllocation: number;
  createdAt: string;
  updatedAt: string;
}

export interface PikovaTask {
  id: string;
  projectId: string;
  idempotencyKey: string;
  title: string;
  payload: Record<string, unknown>;
  status: PikovaTaskStatus;
  attempts: number;
  result?: { accepted: boolean; summary: string };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PikovaAuditEvent {
  id: string;
  projectId: string;
  actorId: string;
  action: string;
  targetId: string;
  timestamp: string;
  details?: Record<string, string | number | boolean>;
}

export interface PikovaState {
  version: 1;
  projects: PikovaProject[];
  tasks: PikovaTask[];
  audit: PikovaAuditEvent[];
}

export interface PikovaOptions {
  now?: () => string;
  id?: () => string;
}

const defaultId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pd-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

function clock(options?: PikovaOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

function newId(options?: PikovaOptions): string {
  return options?.id?.() ?? defaultId();
}

export function createPikovaState(): PikovaState {
  return { version: 1, projects: [], tasks: [], audit: [] };
}

function requireActor(actor: PikovaActor): void {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim() || actor.id.length > 120) throw new Error('Actor ID must be 1–120 characters.');
  if (!['owner', 'operator', 'viewer'].includes(actor.role)) throw new Error('Unsupported role.');
}

const RESERVED_MEMBER_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate and copy a JSON backup before it replaces local browser state.
 * This is integrity validation, not authentication or a server-side security boundary.
 */
export function validatePikovaState(input: unknown): PikovaState {
  if (!isRecord(input) || input.version !== 1 ||
      !Array.isArray(input.projects) || !Array.isArray(input.tasks) || !Array.isArray(input.audit)) {
    throw new Error('Backup format is invalid or unsupported.');
  }
  if (input.projects.length > PIKOVA_PROJECT_LIMIT) throw new Error('Backup exceeds the 1,000-project limit.');
  if (input.audit.length > 50_000) throw new Error('Backup exceeds the 50,000-event audit limit.');

  const projects: PikovaProject[] = [];
  const projectIds = new Set<string>();
  const projectNames = new Set<string>();
  for (const value of input.projects) {
    if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.name) ||
        value.name.trim().length > PIKOVA_MAX_TITLE_LENGTH || !nonEmptyString(value.ownerId) ||
        !isRecord(value.members) || value.plutonAllocation !== PIKOVA_PLUTONS_PER_PROJECT ||
        !nonEmptyString(value.createdAt) || !nonEmptyString(value.updatedAt)) {
      throw new Error('Backup contains an invalid project record.');
    }
    if (projectIds.has(value.id)) throw new Error('Backup contains duplicate project IDs.');
    const normalizedName = value.name.trim().toLocaleLowerCase();
    if (projectNames.has(normalizedName)) throw new Error('Backup contains duplicate project names.');
    const members: Record<string, PikovaRole> = Object.create(null) as Record<string, PikovaRole>;
    for (const [memberId, role] of Object.entries(value.members)) {
      if (!memberId.trim() || memberId.length > 120 || RESERVED_MEMBER_IDS.has(memberId) ||
          !['owner', 'operator', 'viewer'].includes(String(role))) {
        throw new Error('Backup contains an invalid project member or role.');
      }
      members[memberId] = role as PikovaRole;
    }
    if (members[value.ownerId] !== 'owner') throw new Error('Backup project owner is missing or has an invalid role.');
    projectIds.add(value.id);
    projectNames.add(normalizedName);
    projects.push({
      id: value.id, name: value.name.trim(), ownerId: value.ownerId, members,
      plutonAllocation: PIKOVA_PLUTONS_PER_PROJECT, createdAt: value.createdAt, updatedAt: value.updatedAt,
    });
  }

  const tasks: PikovaTask[] = [];
  const taskIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const value of input.tasks) {
    if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.projectId) ||
        !nonEmptyString(value.idempotencyKey) || value.idempotencyKey.length > 200 ||
        !nonEmptyString(value.title) || value.title.trim().length > PIKOVA_MAX_TITLE_LENGTH ||
        !isRecord(value.payload) || !['queued', 'done', 'failed'].includes(String(value.status)) ||
        !Number.isInteger(value.attempts) || Number(value.attempts) < 0 || Number(value.attempts) > PIKOVA_MAX_ATTEMPTS ||
        !nonEmptyString(value.createdAt) || !nonEmptyString(value.updatedAt)) {
      throw new Error('Backup contains an invalid task record.');
    }
    if (!projectIds.has(value.projectId)) throw new Error('Backup task refers to a missing project.');
    if (taskIds.has(value.id)) throw new Error('Backup contains duplicate task IDs.');
    const compoundKey = JSON.stringify([value.projectId, value.idempotencyKey]);
    if (idempotencyKeys.has(compoundKey)) throw new Error('Backup contains duplicate idempotency keys in a project.');
    const serializedPayload = JSON.stringify(value.payload);
    if (serializedPayload.length > PIKOVA_MAX_PAYLOAD_LENGTH) throw new Error('Backup contains a task payload larger than 20 KB.');
    let result: PikovaTask['result'];
    if (value.result !== undefined) {
      if (!isRecord(value.result) || typeof value.result.accepted !== 'boolean' || typeof value.result.summary !== 'string') {
        throw new Error('Backup contains an invalid task result.');
      }
      result = { accepted: value.result.accepted, summary: value.result.summary };
    }
    if (value.error !== undefined && typeof value.error !== 'string') throw new Error('Backup contains an invalid task error.');
    taskIds.add(value.id);
    idempotencyKeys.add(compoundKey);
    tasks.push({
      id: value.id, projectId: value.projectId, idempotencyKey: value.idempotencyKey,
      title: value.title.trim(), payload: JSON.parse(serializedPayload) as Record<string, unknown>,
      status: value.status as PikovaTaskStatus, attempts: Number(value.attempts),
      ...(result ? { result } : {}), ...(typeof value.error === 'string' ? { error: value.error } : {}),
      createdAt: value.createdAt, updatedAt: value.updatedAt,
    });
  }

  const audit: PikovaAuditEvent[] = [];
  for (const value of input.audit) {
    if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.projectId) ||
        !projectIds.has(value.projectId) || !nonEmptyString(value.actorId) ||
        !nonEmptyString(value.action) || !nonEmptyString(value.targetId) || !nonEmptyString(value.timestamp)) {
      throw new Error('Backup contains an invalid audit event.');
    }
    let details: PikovaAuditEvent['details'];
    if (value.details !== undefined) {
      if (!isRecord(value.details) || Object.values(value.details).some(item =>
        typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean')) {
        throw new Error('Backup contains invalid audit details.');
      }
      details = value.details as PikovaAuditEvent['details'];
    }
    audit.push({
      id: value.id, projectId: value.projectId, actorId: value.actorId,
      action: value.action, targetId: value.targetId, timestamp: value.timestamp,
      ...(details ? { details: { ...details } } : {}),
    });
  }
  return { version: 1, projects, tasks, audit };
}

function findProject(state: PikovaState, projectId: string): PikovaProject {
  const project = state.projects.find(item => item.id === projectId);
  if (!project) throw new Error('Project not found.');
  return project;
}

function authorize(state: PikovaState, projectId: string, actor: PikovaActor, required: 'read' | 'work' | 'admin'): PikovaProject {
  requireActor(actor);
  const project = findProject(state, projectId);
  if (!Object.hasOwn(project.members, actor.id)) throw new Error('Access denied: actor is not a member of this project.');
  const role = project.members[actor.id];
  if (!['owner', 'operator', 'viewer'].includes(role)) throw new Error('Access denied: member role is invalid.');
  const allowed = required === 'read'
    ? ['owner', 'operator', 'viewer'].includes(role)
    : required === 'work'
      ? ['owner', 'operator'].includes(role)
      : role === 'owner';
  if (!allowed) throw new Error(`Access denied: ${required} permission required.`);
  return project;
}

function audit(state: PikovaState, projectId: string, actorId: string, action: string, targetId: string, options?: PikovaOptions, details?: PikovaAuditEvent['details']): void {
  state.audit.push({ id: newId(options), projectId, actorId, action, targetId, timestamp: clock(options), ...(details ? { details } : {}) });
  if (state.audit.length > 50_000) state.audit.splice(0, state.audit.length - 50_000);
}

export function createPikovaProject(
  state: PikovaState,
  actor: PikovaActor,
  name: string,
  options?: PikovaOptions,
): PikovaProject {
  requireActor(actor);
  if (actor.role !== 'owner') throw new Error('Only an owner can create a project.');
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length > PIKOVA_MAX_TITLE_LENGTH) throw new Error('Project name must be 1–160 characters.');
  if (state.projects.length >= PIKOVA_PROJECT_LIMIT) throw new Error('The 1,000-project capacity target has been reached.');
  const normalized = cleanName.toLocaleLowerCase();
  if (state.projects.some(project => project.name.toLocaleLowerCase() === normalized)) throw new Error('A project with this name already exists.');
  const timestamp = clock(options);
  const project: PikovaProject = {
    id: newId(options),
    name: cleanName,
    ownerId: actor.id,
    members: { [actor.id]: 'owner' },
    plutonAllocation: PIKOVA_PLUTONS_PER_PROJECT,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.projects.push(project);
  audit(state, project.id, actor.id, 'project.created', project.id, options, { plutonAllocation: project.plutonAllocation });
  return project;
}

export function grantPikovaRole(
  state: PikovaState,
  actor: PikovaActor,
  projectId: string,
  memberId: string,
  role: PikovaRole,
  options?: PikovaOptions,
): void {
  const project = authorize(state, projectId, actor, 'admin');
  const cleanMember = typeof memberId === 'string' ? memberId.trim() : '';
  if (!cleanMember || cleanMember.length > 120 || RESERVED_MEMBER_IDS.has(cleanMember)) throw new Error('Member ID must be 1–120 characters and cannot be a reserved object key.');
  if (!['owner', 'operator', 'viewer'].includes(role)) throw new Error('Unsupported role.');
  if (cleanMember === project.ownerId && role !== 'owner') throw new Error('The project owner role cannot be downgraded.');
  if (cleanMember !== project.ownerId && role === 'owner') throw new Error('Ownership transfer is not supported in this version.');
  project.members[cleanMember] = role;
  project.updatedAt = clock(options);
  audit(state, projectId, actor.id, 'member.role_granted', cleanMember, options, { role });
}

export function enqueuePikovaTask(
  state: PikovaState,
  actor: PikovaActor,
  projectId: string,
  title: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  options?: PikovaOptions,
): { task: PikovaTask; duplicate: boolean } {
  const project = authorize(state, projectId, actor, 'work');
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!cleanTitle || cleanTitle.length > PIKOVA_MAX_TITLE_LENGTH) throw new Error('Task title must be 1–160 characters.');
  if (!cleanKey || cleanKey.length > 200) throw new Error('Idempotency key must be 1–200 characters.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Task payload must be a JSON object.');
  const serialized = JSON.stringify(payload);
  if (serialized.length > PIKOVA_MAX_PAYLOAD_LENGTH) throw new Error('Task payload exceeds the 20 KB limit.');
  const duplicate = state.tasks.find(task => task.projectId === projectId && task.idempotencyKey === cleanKey);
  if (duplicate) return { task: duplicate, duplicate: true };
  const timestamp = clock(options);
  const task: PikovaTask = {
    id: newId(options),
    projectId,
    idempotencyKey: cleanKey,
    title: cleanTitle,
    payload: JSON.parse(serialized) as Record<string, unknown>,
    status: 'queued',
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.tasks.push(task);
  project.updatedAt = timestamp;
  audit(state, projectId, actor.id, 'task.queued', task.id, options, { idempotencyKey: cleanKey });
  return { task, duplicate: false };
}

/** Local deterministic validation only. It does not generate betting predictions or place bets. */
export function processPikovaQueue(
  state: PikovaState,
  actor: PikovaActor,
  projectId: string,
  limit = 100,
  options?: PikovaOptions,
): { done: number; failed: number; remaining: number } {
  authorize(state, projectId, actor, 'work');
  if (!Number.isInteger(limit) || limit < 1 || limit > PIKOVA_PLUTONS_PER_PROJECT) {
    throw new Error(`Processing limit must be an integer from 1 to ${PIKOVA_PLUTONS_PER_PROJECT}.`);
  }
  let done = 0;
  let failed = 0;
  for (const task of state.tasks) {
    if (task.projectId !== projectId || task.status !== 'queued') continue;
    if (done + failed >= limit) break;
    task.attempts += 1;
    task.updatedAt = clock(options);
    const summary = JSON.stringify(task.payload);
    if (summary.length > PIKOVA_MAX_PAYLOAD_LENGTH || !task.title.trim()) {
      task.status = 'failed';
      task.error = 'Task failed local validation.';
      failed += 1;
      audit(state, projectId, actor.id, 'task.failed', task.id, options, { attempts: task.attempts });
    } else {
      task.status = 'done';
      task.error = undefined;
      task.result = { accepted: true, summary: `Validated locally: ${task.title}` };
      done += 1;
      audit(state, projectId, actor.id, 'task.completed', task.id, options, { attempts: task.attempts });
    }
  }
  return { done, failed, remaining: state.tasks.filter(task => task.projectId === projectId && task.status === 'queued').length };
}

export function retryPikovaFailures(state: PikovaState, actor: PikovaActor, projectId: string, options?: PikovaOptions): number {
  authorize(state, projectId, actor, 'work');
  let count = 0;
  for (const task of state.tasks) {
    if (task.projectId !== projectId || task.status !== 'failed' || task.attempts >= PIKOVA_MAX_ATTEMPTS) continue;
    task.status = 'queued';
    task.error = undefined;
    task.updatedAt = clock(options);
    count += 1;
    audit(state, projectId, actor.id, 'task.retry_queued', task.id, options, { attempts: task.attempts });
  }
  return count;
}

export function getPikovaProjectView(state: PikovaState, actor: PikovaActor, projectId: string): {
  project: PikovaProject;
  tasks: PikovaTask[];
  audit: PikovaAuditEvent[];
} {
  const project = authorize(state, projectId, actor, 'read');
  return {
    project: structuredClone(project),
    tasks: structuredClone(state.tasks.filter(task => task.projectId === projectId)),
    audit: structuredClone(state.audit.filter(event => event.projectId === projectId)),
  };
}

export function getPikovaOverview(state: PikovaState, actor: PikovaActor): {
  projects: PikovaProject[];
  projectCount: number;
  allocatedPlutons: number;
  targetProjects: number;
  targetPlutons: number;
} {
  requireActor(actor);
  const projects = state.projects.filter(project => Boolean(project.members[actor.id])).map(project => structuredClone(project));
  return {
    projects,
    projectCount: projects.length,
    allocatedPlutons: projects.reduce((sum, project) => sum + project.plutonAllocation, 0),
    targetProjects: PIKOVA_PROJECT_LIMIT,
    targetPlutons: PIKOVA_PLUTON_TARGET,
  };
}
