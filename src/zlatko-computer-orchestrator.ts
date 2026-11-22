/**
 * ZLATKO AI MODE — Computer layer orchestration scaffold.
 *
 * Defines 100 agent slots and 30 model slots, task distribution, parallel execution,
 * result aggregation, and an explicit one-time approval gate for external API calls.
 *
 * This is an executable coordinator scaffold, not 100 running processes or 30
 * connected model providers. Register real adapters to activate those integrations.
 * The default mode is local-only; external calls are denied unless approved per call.
 */

export type ZlatkoModelId = `model-${number}`;
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
  id: ZlatkoModelId;
  name: string;
  mode: ExecutionMode;
  capabilities: string[];
  run(task: ZlatkoTask, context: {
    agentId: ZlatkoAgentId;
    approval?: ExternalCallApproval;
  }): Promise<unknown>;
}

export interface ExternalCallApproval {
  approvalId: string;
  approvedBy: string;
  approvedAt: string;
  scope: string;
  /** Must be true only for the exact API call being authorized. */
  oneTime: true;
}

export interface ApprovalRequest {
  caseId: string;
  taskId: string;
  modelId: ZlatkoModelId;
  scope: string;
}

export type ApprovalGate = (
  request: ApprovalRequest,
) => Promise<ExternalCallApproval | null>;

export interface OrchestratorOptions {
  concurrency?: number;
  approvalGate?: ApprovalGate;
  now?: () => Date;
}

export interface OrchestrationReport {
  caseId: string;
  taskCount: number;
  agentSlots: 100;
  modelSlots: 30;
  configuredModels: number;
  results: ZlatkoAgentResult[];
  summary: {
    completed: number;
    failed: number;
    skipped: number;
  };
  notes: string[];
}

export const ZLATKO_AGENT_IDS: readonly ZlatkoAgentId[] = Array.from(
  { length: 100 },
  (_, index) => `agent-${index + 1}` as ZlatkoAgentId,
);

export const ZLATKO_MODEL_IDS: readonly ZlatkoModelId[] = Array.from(
  { length: 30 },
  (_, index) => `model-${index + 1}` as ZlatkoModelId,
);

function timestamp(now: () => Date): string {
  return now().toISOString();
}

function supportsTask(model: ZlatkoModelAdapter, task: ZlatkoTask): boolean {
  const required = task.requiredCapabilities ?? [];
  return required.every(capability => model.capabilities.includes(capability));
}

/**
 * Central Computer agent.
 * - Fans tasks out across available agent slots.
 * - Assigns compatible registered models round-robin.
 * - Requires a fresh one-time approval for every external adapter invocation.
 * - Aggregates raw results without pretending that model agreement proves a claim.
 */
export class ZlatkoComputerOrchestrator {
  private readonly models = new Map<ZlatkoModelId, ZlatkoModelAdapter>();
  private readonly concurrency: number;
  private readonly approvalGate?: ApprovalGate;
  private readonly now: () => Date;

  constructor(options: OrchestratorOptions = {}) {
    this.concurrency = Math.max(1, Math.min(100, Math.floor(options.concurrency ?? 10)));
    this.approvalGate = options.approvalGate;
    this.now = options.now ?? (() => new Date());
  }

  registerModel(adapter: ZlatkoModelAdapter): void {
    if (!ZLATKO_MODEL_IDS.includes(adapter.id)) {
      throw new Error(`Unknown model slot: ${adapter.id}. Valid slots are model-1 through model-30.`);
    }
    if (this.models.has(adapter.id)) {
      throw new Error(`Model slot already registered: ${adapter.id}`);
    }
    this.models.set(adapter.id, adapter);
  }

  getConfiguredModelIds(): ZlatkoModelId[] {
    return [...this.models.keys()];
  }

  async runCase(caseId: string, tasks: ZlatkoTask[]): Promise<OrchestrationReport> {
    if (!caseId.trim()) throw new Error('caseId is required.');
    if (tasks.some(task => task.caseId !== caseId)) {
      throw new Error('Every task must belong to the caseId passed to runCase().');
    }
    if (new Set(tasks.map(task => task.id)).size !== tasks.length) {
      throw new Error('Task IDs must be unique within a case.');
    }

    const queue = tasks.map((task, index) => ({ task, agentId: ZLATKO_AGENT_IDS[index % 100] }));
    const results: ZlatkoAgentResult[] = [];
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        if (!item) return;
        const compatible = [...this.models.values()].filter(model => supportsTask(model, item.task));
        if (!compatible.length) {
          results.push({
            taskId: item.task.id,
            agentId: item.agentId,
            modelId: 'model-1',
            status: 'skipped',
            error: this.models.size
              ? 'No configured model supports the task capabilities.'
              : 'No model adapters are configured; no AI calls were made.',
            startedAt: timestamp(this.now),
            finishedAt: timestamp(this.now),
          });
          continue;
        }

        // The first registered compatible model is used for this task. The report
        // records the assignment; a later expansion can add explicit multi-model voting.
        const model = compatible[(results.length + queue.indexOf(item)) % compatible.length]!;
        const startedAt = timestamp(this.now);
        try {
          let approval: ExternalCallApproval | undefined;
          if (model.mode === 'external-api') {
            if (!this.approvalGate) {
              throw new Error('External API blocked: no approval gate is configured.');
            }
            const approved = await this.approvalGate({
              caseId,
              taskId: item.task.id,
              modelId: model.id,
              scope: `One external call: ${model.name} for task ${item.task.id}`,
            });
            if (!approved || approved.oneTime !== true || !approved.approvalId.trim() || !approved.approvedBy.trim()) {
              throw new Error('External API blocked: one-time approval was not granted.');
            }
            approval = approved;
          }

          const output = await model.run(item.task, { agentId: item.agentId, approval });
          results.push({
            taskId: item.task.id,
            agentId: item.agentId,
            modelId: model.id,
            status: 'completed',
            output,
            startedAt,
            finishedAt: timestamp(this.now),
          });
        } catch (error) {
          results.push({
            taskId: item.task.id,
            agentId: item.agentId,
            modelId: model.id,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            startedAt,
            finishedAt: timestamp(this.now),
          });
        }
      }
    };

    await Promise.all(Array.from(
      { length: Math.min(this.concurrency, Math.max(1, queue.length)) },
      () => worker(),
    ));

    const completed = results.filter(result => result.status === 'completed').length;
    const failed = results.filter(result => result.status === 'failed').length;
    const skipped = results.filter(result => result.status === 'skipped').length;
    return {
      caseId,
      taskCount: tasks.length,
      agentSlots: 100,
      modelSlots: 30,
      configuredModels: this.models.size,
      results: results.sort((a, b) => a.taskId.localeCompare(b.taskId)),
      summary: { completed, failed, skipped },
      notes: [
        '100 agent slots and 30 model slots are defined; only registered adapters execute.',
        'External API calls require a fresh one-time approval for each invocation.',
        'Outputs are evidence candidates; model agreement alone is not verification.',
        'Human reviewer remains responsible for consequential final decisions.',
      ],
    };
  }
}
