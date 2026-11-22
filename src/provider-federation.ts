/**
 * ZLATKO AI MODE — Provider Federation Registry
 *
 * Planning/runtime module for registering up to 100 AI providers, with up to
 * 30 model entries and 30 agent definitions per provider. A provider, a model,
 * and an agent are distinct entities:
 *   provider = company/platform/API gateway
 *   model    = a specific model exposed by a provider
 *   agent    = a role/workflow operated by ZLATKO AI MODE using a model/tools
 *
 * This registry does not claim that each provider publicly offers 30 agents
 * or 30 models. Entries must be added only when verified. It does not make
 * network calls or store API keys.
 */

export const FEDERATION_LIMITS = {
  providers: 100,
  modelsPerProvider: 30,
  agentsPerProvider: 30,
} as const;

export type ProviderStatus = 'planned' | 'verified' | 'enabled' | 'disabled';
export type ModelStatus = 'unverified' | 'verified' | 'enabled' | 'deprecated';
export type AgentStatus = 'planned' | 'configured' | 'enabled' | 'paused';

export type ProviderRecord = {
  id: string;
  name: string;
  website?: string;
  apiBaseUrl?: string;
  status: ProviderStatus;
  notes?: string;
};

export type ModelRecord = {
  id: string;
  providerId: string;
  name: string;
  modelId?: string;
  capabilities: string[];
  contextWindow?: number;
  status: ModelStatus;
  verifiedAt?: string;
};

export type AgentRecord = {
  id: string;
  providerId: string;
  name: string;
  role: string;
  modelIds: string[];
  allowedTools: string[];
  status: AgentStatus;
};

export type FederationRegistry = {
  providers: ProviderRecord[];
  models: ModelRecord[];
  agents: AgentRecord[];
};

export type RegistryIssue = {
  code:
    | 'provider-limit'
    | 'duplicate-provider'
    | 'unknown-provider'
    | 'model-limit'
    | 'duplicate-model'
    | 'agent-limit'
    | 'duplicate-agent'
    | 'unknown-model'
    | 'model-provider-mismatch'
    | 'unverified-provider';
  message: string;
  recordId?: string;
};

export function createEmptyFederationRegistry(): FederationRegistry {
  return { providers: [], models: [], agents: [] };
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();

export function validateFederationRegistry(
  registry: FederationRegistry,
): RegistryIssue[] {
  const issues: RegistryIssue[] = [];
  const providerIds = new Set<string>();
  const modelIds = new Set<string>();
  const agentIds = new Set<string>();
  const providerNames = new Set<string>();

  if (registry.providers.length > FEDERATION_LIMITS.providers) {
    issues.push({
      code: 'provider-limit',
      message: `Maximum ${FEDERATION_LIMITS.providers} providers allowed.`,
    });
  }

  for (const provider of registry.providers) {
    const id = normalized(provider.id);
    const name = normalized(provider.name);
    if (providerIds.has(id) || providerNames.has(name)) {
      issues.push({
        code: 'duplicate-provider',
        message: `Duplicate provider ID or name: ${provider.name}.`,
        recordId: provider.id,
      });
    }
    providerIds.add(id);
    providerNames.add(name);
  }

  const modelsByProvider = new Map<string, number>();
  for (const model of registry.models) {
    const id = normalized(model.id);
    if (modelIds.has(id)) {
      issues.push({
        code: 'duplicate-model',
        message: `Duplicate model ID: ${model.id}.`,
        recordId: model.id,
      });
    }
    modelIds.add(id);

    if (!providerIds.has(normalized(model.providerId))) {
      issues.push({
        code: 'unknown-provider',
        message: `Model ${model.name} refers to an unknown provider.`,
        recordId: model.id,
      });
    }
    const providerKey = normalized(model.providerId);
    modelsByProvider.set(providerKey, (modelsByProvider.get(providerKey) ?? 0) + 1);
    if (model.status === 'enabled') {
      const provider = registry.providers.find(
        (item) => normalized(item.id) === providerKey,
      );
      if (provider?.status !== 'verified' && provider?.status !== 'enabled') {
        issues.push({
          code: 'unverified-provider',
          message: `Cannot enable model ${model.name} until its provider is verified.`,
          recordId: model.id,
        });
      }
    }
  }

  for (const [providerId, count] of modelsByProvider) {
    if (count > FEDERATION_LIMITS.modelsPerProvider) {
      issues.push({
        code: 'model-limit',
        message: `Provider ${providerId} has more than ${FEDERATION_LIMITS.modelsPerProvider} models.`,
        recordId: providerId,
      });
    }
  }

  const agentsByProvider = new Map<string, number>();
  for (const agent of registry.agents) {
    const id = normalized(agent.id);
    if (agentIds.has(id)) {
      issues.push({
        code: 'duplicate-agent',
        message: `Duplicate agent ID: ${agent.id}.`,
        recordId: agent.id,
      });
    }
    agentIds.add(id);

    const providerKey = normalized(agent.providerId);
    if (!providerIds.has(providerKey)) {
      issues.push({
        code: 'unknown-provider',
        message: `Agent ${agent.name} refers to an unknown provider.`,
        recordId: agent.id,
      });
    }
    agentsByProvider.set(providerKey, (agentsByProvider.get(providerKey) ?? 0) + 1);

    for (const modelId of agent.modelIds) {
      if (!modelIds.has(normalized(modelId))) {
        issues.push({
          code: 'unknown-model',
          message: `Agent ${agent.name} refers to unknown model ${modelId}.`,
          recordId: agent.id,
        });
        continue;
      }
      const model = registry.models.find(
        (item) => normalized(item.id) === normalized(modelId),
      );
      if (model && normalized(model.providerId) !== providerKey) {
        issues.push({
          code: 'model-provider-mismatch',
          message: `Model ${modelId} does not belong to agent provider ${agent.providerId}.`,
          recordId: agent.id,
        });
      }
    }
  }

  for (const [providerId, count] of agentsByProvider) {
    if (count > FEDERATION_LIMITS.agentsPerProvider) {
      issues.push({
        code: 'agent-limit',
        message: `Provider ${providerId} has more than ${FEDERATION_LIMITS.agentsPerProvider} agents.`,
        recordId: providerId,
      });
    }
  }

  return issues;
}

/** Return only provider/model/agent combinations eligible for central routing. */
export function getEnabledRoutingCatalog(registry: FederationRegistry) {
  const issues = validateFederationRegistry(registry);
  const blockedIds = new Set(issues.map((issue) => issue.recordId).filter(Boolean));
  const providers = registry.providers.filter(
    (provider) =>
      (provider.status === 'verified' || provider.status === 'enabled') &&
      !blockedIds.has(provider.id),
  );
  const allowedProviderIds = new Set(providers.map((provider) => normalized(provider.id)));
  const models = registry.models.filter(
    (model) =>
      model.status === 'enabled' &&
      allowedProviderIds.has(normalized(model.providerId)) &&
      !blockedIds.has(model.id),
  );
  const enabledModelIds = new Set(models.map((model) => normalized(model.id)));
  const agents = registry.agents.filter(
    (agent) =>
      agent.status === 'enabled' &&
      allowedProviderIds.has(normalized(agent.providerId)) &&
      agent.modelIds.some((modelId) => enabledModelIds.has(normalized(modelId))) &&
      !blockedIds.has(agent.id),
  );

  return { providers, models, agents, validationIssues: issues };
}
