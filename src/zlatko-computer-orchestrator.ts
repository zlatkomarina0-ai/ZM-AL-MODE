/**
 * ZLATKO AI MODE — provider-aware Computer orchestration.
 *
 * Capacity model: 100 central agent slots, each agent can be mapped to one
 * provider and up to 30 verified model adapters from that provider (up to
 * 3,000 agent/model assignments). These are capacity limits, not claims that
 * 100 providers or 3,000 live models are configured. No adapter runs unless
 * explicitly registered. External calls require a fresh, exact-scope approval.
 */
export type ZlatkoModelId = string;
export type ZlatkoAgentId = `agent-${number}`;
export type ExecutionMode = 'local' | 'external-api';

export interface ZlatkoTask {
  id: string;
  caseId: string;
  title: string;
  input: unknown;
  requiredCapabilities?: string[];
}

export interface ZlatkoAgentResult {
  taskId: string;
  agentId: ZlatkoAgentId;
  modelId: ZlatkoModelId;
  status: 'completed' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  startedAt: string;
  finishedAt: string;
}

export interface ZlatkoModelAdapter {
  /** Globally unique ID, preferably namespaced as providerId/modelId. */
  id: ZlatkoModelId;
  /** Provider/company that owns this model. */
  providerId?: string;
  name: string;
  mode: ExecutionMode;
  capabilities: string[];
  run(task: ZlatkoTask, context: {
    agentId: ZlatkoAgentId;
    approval?: ExternalCallApproval;
  }): Promise<unknown>;
}

export interface ZlatkoAgentProviderProfile {
  agentId: ZlatkoAgentId;
  providerId: string;
  /** Model IDs must belong to providerId; maximum 30 per agent. */
  modelIds: string[];
}

export interface ExternalCallApproval {
  approvalId: string;
  approvedBy: string;
  approvedAt: string;
  scope: string;
  oneTime: true;
}

export interface ApprovalRequest {
  caseId: string;
  taskId: string;
  modelId: ZlatkoModelId;
  scope: string;
}

export type ApprovalGate = (request: ApprovalRequest) => Promise<ExternalCallApproval | null>;

export interface OrchestratorOptions {
  concurrency?: number;
  approvalGate?: ApprovalGate;
  now?: () => Date;
}

export interface OrchestrationReport {
  caseId: string;
  taskCount: number;
  agentSlots: 100;
  /** Maximum model choices per agent, not a global pool size. */
  modelSlots: 30;
  maxAgentModelAssignments: 3000;
  configuredModels: number;
  configuredAgentProfiles: number;
  results: ZlatkoAgentResult[];
  summary: { completed: number; failed: number; skipped: number };
  notes: string[];
}

export const ZLATKO_AGENT_IDS: readonly ZlatkoAgentId[] = Array.from(
  { length: 100 }, (_, index) => `agent-${index + 1}` as ZlatkoAgentId,
);
export const ZLATKO_MODELS_PER_AGENT = 30 as const;
export const ZLATKO_MAX_AGENT_MODEL_ASSIGNMENTS = 100 * ZLATKO_MODELS_PER_AGENT;

function timestamp(now: () => Date): string { return now().toISOString(); }
function supportsTask(model: ZlatkoModelAdapter, task: ZlatkoTask): boolean {
  return (task.requiredCapabilities ?? []).every(capability => model.capabilities.includes(capability));
}

export class ZlatkoComputerOrchestrator {
  private readonly models = new Map<ZlatkoModelId, ZlatkoModelAdapter>();
  private readonly agentProfiles = new Map<ZlatkoAgentId, ZlatkoAgentProviderProfile>();
  private readonly usedApprovalIds = new Set<string>();
  private readonly concurrency: number;
  private readonly approvalGate?: ApprovalGate;
  private readonly now: () => Date;

  constructor(options: OrchestratorOptions = {}) {
    this.concurrency = Math.max(1, Math.min(100, Math.floor(options.concurrency ?? 10)));
    this.approvalGate = options.approvalGate;
    this.now = options.now ?? (() => new Date());
  }

  /** Register only a real/verified adapter. Metadata alone does not activate a model. */
  registerModel(adapter: ZlatkoModelAdapter): void {
    if (!adapter.id.trim()) throw new Error('Model ID is required.');
    if (adapter.providerId !== undefined && !adapter.providerId.trim()) throw new Error('Provider ID cannot be empty.');
    if (this.models.has(adapter.id)) throw new Error(`Model already registered: ${adapter.id}`);
    const providerId = adapter.providerId ?? 'legacy-default';
    const providerModelCount = [...this.models.values()].filter(
      model => (model.providerId ?? 'legacy-default') === providerId,
    ).length;
    if (providerModelCount >= ZLATKO_MODELS_PER_AGENT) {
      throw new Error(`Provider ${providerId} exceeds the limit of 30 registered models.`);
    }
    this.models.set(adapter.id, adapter);
    // Prevent a later adapter registration from silently invalidating a profile.
    for (const profile of this.agentProfiles.values()) {
      if (profile.modelIds.includes(adapter.id) && profile.providerId !== providerId) {
        this.models.delete(adapter.id);
        throw new Error(`Model ${adapter.id} does not belong to agent provider ${profile.providerId}.`);
      }
    }
  }

  /** Bind an agent to one provider and at most 30 models owned by that provider. */
  registerAgentProvider(profile: ZlatkoAgentProviderProfile): void {
    if (!ZLATKO_AGENT_IDS.includes(profile.agentId)) throw new Error(`Unknown agent slot: ${profile.agentId}`);
    if (!profile.providerId.trim()) throw new Error('Provider ID is required.');
    if (profile.modelIds.length > ZLATKO_MODELS_PER_AGENT) throw new Error('An agent can access at most 30 models.');
    if (new Set(profile.modelIds).size !== profile.modelIds.length) throw new Error('Agent model IDs must be unique.');
    for (const modelId of profile.modelIds) {
      const model = this.models.get(modelId);
      if (!model) throw new Error(`Model must be registered before assignment: ${modelId}`);
      if ((model.providerId ?? 'legacy-default') !== profile.providerId) {
        throw new Error(`Model ${modelId} does not belong to provider ${profile.providerId}.`);
      }
    }
    this.agentProfiles.set(profile.agentId, { ...profile, modelIds: [...profile.modelIds] });
  }

  getConfiguredModelIds(): ZlatkoModelId[] { return [...this.models.keys()]; }
  getConfiguredAgentProfileCount(): number { return this.agentProfiles.size; }

  async runCase(caseId: string, tasks: ZlatkoTask[]): Promise<OrchestrationReport> {
    if (!caseId.trim()) throw new Error('caseId is required.');
    if (tasks.some(task => task.caseId !== caseId)) throw new Error('Every task must belong to the caseId passed to runCase().');
    if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new Error('Task IDs must be unique within a case.');

    const queue = tasks.map((task, index) => ({ task, agentId: ZLATKO_AGENT_IDS[index % 100] }));
    const results: ZlatkoAgentResult[] = [];
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        if (!item) return;
        const profile = this.agentProfiles.get(item.agentId);
        const candidates = profile
          ? profile.modelIds.map(id => this.models.get(id)).filter((model): model is ZlatkoModelAdapter => Boolean(model))
          : [...this.models.values()].filter(model => (model.providerId ?? 'legacy-default') === 'legacy-default');
        const compatible = candidates.filter(model => supportsTask(model, item.task));
        if (!compatible.length) {
          results.push({
            taskId: item.task.id, agentId: item.agentId, modelId: '',
            status: 'skipped',
            error: profile
              ? `No compatible registered model in provider ${profile.providerId} for agent ${item.agentId}.`
              : 'No provider profile or legacy local adapter is configured for this agent; no AI call was made.',
            startedAt: timestamp(this.now), finishedAt: timestamp(this.now),
          });
          continue;
        }
        const model = compatible[queue.indexOf(item) % compatible.length]!;
        const startedAt = timestamp(this.now);
        try {
          let approval: ExternalCallApproval | undefined;
          if (model.mode === 'external-api') {
            if (!this.approvalGate) throw new Error('External API blocked: no approval gate is configured.');
            const expectedScope = `One external call: ${model.name} for task ${item.task.id}`;
            const approved = await this.approvalGate({
              caseId, taskId: item.task.id, modelId: model.id, scope: expectedScope,
            });
            if (!approved || approved.oneTime !== true ||
                !approved.approvalId?.trim() || !approved.approvedBy?.trim() ||
                !approved.approvedAt?.trim() || approved.scope !== expectedScope ||
                this.usedApprovalIds.has(approved.approvalId)) {
              throw new Error('External API blocked: approval is missing, invalid, out of scope, or already used.');
            }
            this.usedApprovalIds.add(approved.approvalId);
            approval = approved;
          }
          const output = await model.run(item.task, { agentId: item.agentId, approval });
          results.push({ taskId: item.task.id, agentId: item.agentId, modelId: model.id, status: 'completed', output, startedAt, finishedAt: timestamp(this.now) });
        } catch (error) {
          results.push({ taskId: item.task.id, agentId: item.agentId, modelId: model.id, status: 'failed', error: error instanceof Error ? error.message : String(error), startedAt, finishedAt: timestamp(this.now) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, Math.max(1, queue.length)) }, () => worker()));
    const completed = results.filter(result => result.status === 'completed').length;
    const failed = results.filter(result => result.status === 'failed').length;
    const skipped = results.filter(result => result.status === 'skipped').length;
    return {
      caseId, taskCount: tasks.length, agentSlots: 100, modelSlots: 30,
      maxAgentModelAssignments: ZLATKO_MAX_AGENT_MODEL_ASSIGNMENTS,
      configuredModels: this.models.size, configuredAgentProfiles: this.agentProfiles.size,
      results: results.sort((a, b) => a.taskId.localeCompare(b.taskId)),
      summary: { completed, failed, skipped },
      notes: [
        'Capacity: 100 agent slots × up to 30 provider-owned model choices per agent = 3,000 possible assignments.',
        'Only explicitly registered adapters execute; configured capacity is not proof of live provider connectivity.',
        'An agent with a provider profile can route only to models registered to that same provider.',
        'Every external API invocation requires a fresh, exact-scope, one-time approval.',
        'Outputs are evidence candidates; model agreement alone is not verification.',
        'A human reviewer remains responsible for consequential final decisions.',
      ],
    };
  }
}
