/**
 * ZLATKO AI MODE — AI brain routing bridge.
 *
 * Connects the central coordinator's operational tasks to the verified,
 * enabled provider/model/agent catalog. This produces routing plans only:
 * actual API execution requires provider-specific adapters, credentials held
 * securely by a backend, rate-limit handling, and runtime monitoring.
 */

import type { CentralMatch, OperationalTeam } from './zlatko-central';
import { createCentralRun } from './zlatko-central';
import type { FederationRegistry, AgentRecord, ModelRecord, ProviderRecord } from './provider-federation';
import { getEnabledRoutingCatalog } from './provider-federation';

export type BrainRoutingPlan = {
  runId: string;
  centralRun: ReturnType<typeof createCentralRun>;
  routes: Array<{
    taskId: string;
    matchId: string;
    operationalTeamId: string;
    provider: ProviderRecord;
    agent: AgentRecord;
    model: ModelRecord;
    rationale: string;
  }>;
  unassignedTasks: Array<{ taskId: string; matchId: string; reason: string }>;
  registryIssueCount: number;
  executionEnabled: false;
};

function selectAgentForTask(
  agents: AgentRecord[],
  models: ModelRecord[],
  providers: ProviderRecord[],
  usage: Map<string, number>,
) {
  const candidates = agents
    .filter((agent) => agent.status === 'enabled')
    .flatMap((agent) => agent.modelIds.map((modelId) => {
      const model = models.find((item) => item.id.toLowerCase() === modelId.toLowerCase());
      const provider = providers.find((item) => item.id.toLowerCase() === agent.providerId.toLowerCase());
      return model && provider ? { agent, model, provider } : undefined;
    }).filter((item): item is { agent: AgentRecord; model: ModelRecord; provider: ProviderRecord } => Boolean(item)))
    .sort((a, b) =>
      (usage.get(a.agent.id) ?? 0) - (usage.get(b.agent.id) ?? 0) ||
      a.provider.name.localeCompare(b.provider.name) ||
      a.agent.name.localeCompare(b.agent.name),
    );

  // Prefer an agent whose role names a sports/statistics task. Otherwise use
  // the least-used verified enabled route; never invent a provider/model.
  const taskSpecific = candidates.find(({ agent }) =>
    /sport|match|stat|verify|research|monitor|collector/i.test(agent.role + ' ' + agent.name),
  );
  const selected = taskSpecific ?? candidates[0];
  if (selected) usage.set(selected.agent.id, (usage.get(selected.agent.id) ?? 0) + 1);
  return selected;
}

export function createZlatkoBrainRoutingPlan(input: {
  runId: string;
  season: string;
  matches: CentralMatch[];
  operationalTeams: OperationalTeam[];
  registry: FederationRegistry;
  createdAt?: string;
}): BrainRoutingPlan {
  const centralRun = createCentralRun({
    runId: input.runId,
    season: input.season,
    matches: input.matches,
    teams: input.operationalTeams,
    createdAt: input.createdAt,
  });

  const catalog = getEnabledRoutingCatalog(input.registry);
  const usage = new Map<string, number>();
  const routes: BrainRoutingPlan['routes'] = [];
  const unassignedTasks: BrainRoutingPlan['unassignedTasks'] = [];

  for (const task of centralRun.tasks) {
    const selected = selectAgentForTask(
      catalog.agents,
      catalog.models,
      catalog.providers,
      usage,
    );
    if (!selected) {
      unassignedTasks.push({
        taskId: task.taskId,
        matchId: task.matchId,
        reason: 'No verified, enabled provider + agent + model route is available.',
      });
      continue;
    }
    routes.push({
      taskId: task.taskId,
      matchId: task.matchId,
      operationalTeamId: task.teamId,
      provider: selected.provider,
      agent: selected.agent,
      model: selected.model,
      rationale: 'Selected from verified enabled catalog using least-used routing with role relevance preference.',
    });
  }

  return {
    runId: input.runId,
    centralRun,
    routes,
    unassignedTasks,
    registryIssueCount: catalog.validationIssues.length,
    executionEnabled: false,
  };
}
