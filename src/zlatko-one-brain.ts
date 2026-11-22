/**
 * ZLATKO AI MODE — One Brain facade.
 *
 * Connects the 12-role workflow to the Computer orchestrator behind one public
 * control surface. Provider adapters remain opt-in; no external API is called
 * unless an adapter is registered and the per-call approval gate approves it.
 */

import {
  startInvestigation,
  escalateToJointInvestigation,
  submitForProcessing,
  finalizeInvestigation,
  type InvestigationCase,
} from './zlatko-animal-teams';
import {
  ZlatkoComputerOrchestrator,
  type ZlatkoTask,
  type ZlatkoAgentResult,
  type OrchestratorOptions,
  type ZlatkoModelAdapter,
} from './zlatko-computer-orchestrator';

export interface StartCaseInput {
  caseId: string;
  matchId: string;
  scanSignals: string[];
}

export interface BrainCaseSnapshot {
  investigation: InvestigationCase;
  processingResults: ZlatkoAgentResult[];
}

export class ZlatkoOneBrain {
  readonly computer: ZlatkoComputerOrchestrator;
  private readonly cases = new Map<string, BrainCaseSnapshot>();

  constructor(options: OrchestratorOptions = {}) {
    this.computer = new ZlatkoComputerOrchestrator(options);
  }

  registerModel(adapter: ZlatkoModelAdapter): void {
    this.computer.registerModel(adapter);
  }

  startCase(input: StartCaseInput): BrainCaseSnapshot {
    if (this.cases.has(input.caseId)) {
      throw new Error(`Case already exists: ${input.caseId}`);
    }
    const snapshot: BrainCaseSnapshot = {
      investigation: startInvestigation(input),
      processingResults: [],
    };
    this.cases.set(input.caseId, snapshot);
    return this.copy(snapshot);
  }

  recordScoutFindings(caseId: string, findings: string[]): BrainCaseSnapshot {
    const current = this.requireCase(caseId);
    const investigation = escalateToJointInvestigation(current.investigation, findings);
    return this.save({ ...current, investigation });
  }

  submitEvidence(caseId: string, evidence: string[]): BrainCaseSnapshot {
    const current = this.requireCase(caseId);
    const investigation = submitForProcessing(current.investigation, evidence);
    return this.save({ ...current, investigation });
  }

  /**
   * Assigns the evidence-processing tasks to the central Computer layer.
   * With no registered adapters, tasks are recorded as skipped rather than
   * pretending that analysis happened.
   */
  async processEvidence(
    caseId: string,
    taskInputs: Array<{ id: string; title: string; input: unknown; requiredCapabilities?: string[] }>,
  ): Promise<BrainCaseSnapshot> {
    const current = this.requireCase(caseId);
    if (current.investigation.stage !== 'processing') {
      throw new Error('Submit evidence before running Team 2 processing.');
    }
    const tasks: ZlatkoTask[] = taskInputs.map(task => ({
      ...task,
      caseId,
    }));
    const report = await this.computer.runCase(caseId, tasks);
    return this.save({
      ...current,
      processingResults: [...current.processingResults, ...report.results],
      investigation: {
        ...current.investigation,
        notes: [
          ...current.investigation.notes,
          `Computer orchestrator finished: ${report.summary.completed} completed, ${report.summary.failed} failed, ${report.summary.skipped} skipped; ${report.configuredModels}/30 model slots configured.`,
        ],
      },
    });
  }

  finalizeCase(
    caseId: string,
    decision: 'verified' | 'rejected',
    reviewer: string,
  ): BrainCaseSnapshot {
    const current = this.requireCase(caseId);
    const investigation = finalizeInvestigation(current.investigation, decision, reviewer);
    return this.save({ ...current, investigation });
  }

  getCase(caseId: string): BrainCaseSnapshot {
    return this.copy(this.requireCase(caseId));
  }

  getSystemStatus(): {
    brain: 'ready';
    teams: 3;
    roles: 12;
    agentSlots: 100;
    modelSlots: 30;
    configuredModels: number;
    mode: 'local-first';
    externalCallsRequireOneTimeApproval: true;
  } {
    return {
      brain: 'ready',
      teams: 3,
      roles: 12,
      agentSlots: 100,
      modelSlots: 30,
      configuredModels: this.computer.getConfiguredModelIds().length,
      mode: 'local-first',
      externalCallsRequireOneTimeApproval: true,
    };
  }

  private requireCase(caseId: string): BrainCaseSnapshot {
    const snapshot = this.cases.get(caseId);
    if (!snapshot) throw new Error(`Unknown case: ${caseId}`);
    return snapshot;
  }

  private save(snapshot: BrainCaseSnapshot): BrainCaseSnapshot {
    this.cases.set(snapshot.investigation.caseId, snapshot);
    return this.copy(snapshot);
  }

  private copy(snapshot: BrainCaseSnapshot): BrainCaseSnapshot {
    return {
      investigation: {
        ...snapshot.investigation,
        signals: [...snapshot.investigation.signals],
        scoutFindings: [...snapshot.investigation.scoutFindings],
        evidence: [...snapshot.investigation.evidence],
        assignedRoles: [...snapshot.investigation.assignedRoles],
        notes: [...snapshot.investigation.notes],
      },
      processingResults: snapshot.processingResults.map(result => ({ ...result })),
    };
  }
}

/** One import point for the complete ZLATKO brain. */
export function createZlatkoOneBrain(options: OrchestratorOptions = {}): ZlatkoOneBrain {
  return new ZlatkoOneBrain(options);
}

/** Explicitly re-export the one-time approval contract for external provider adapters. */
export type { ExternalCallApproval };
