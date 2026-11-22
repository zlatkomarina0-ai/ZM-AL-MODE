/**
 * ZLATKO AI MODE — explicit logical architecture manifest.
 * Capacity targets are not claims that physical infrastructure is provisioned.
 * Joker 1 slots are registry placeholders; no firm/model API is called here.
 */
export const ZLATKO_ARCHITECTURE = Object.freeze({
  system: "ZLATKO AI MODE",
  chiefProfiles: {
    count: 1000,
    idPrefix: "zlatko-sef-",
    role: "chief-profile",
  },
  aceOfClubs: {
    symbol: "♣",
    logicalWorkerUnitsPerProfile: 2000000,
    profileCount: 1000,
    totalLogicalWorkerUnits: 2000000000,
    isProvisionedInfrastructure: false,
  },
  aceOfDiamonds: {
    symbol: "♦",
    logicalComputerSlots: 200000000,
    websiteSlotsPerComputer: 1000,
    totalWebsiteAssignments: 200000000000,
    websiteRegistryCapacity: 1000,
    reviewedWebsiteCount: 32,
    internetSearchEnabledByDefault: false,
    isProvisionedInfrastructure: false,
  },
  aceOfSpades: {
    symbol: "♠",
    name: "PLUTON",
    mode: "local-code-execution",
    registeredAgentProfiles: 1000,
    sharedLocalCodeModules: 30,
    externalApiCalls: false,
    automaticProviderFallback: false,
  },
  joker1: {
    agentFirmSlots: 100,
    ordinaryModelSlots: 30,
    registryOnly: true,
    integrationsEnabledByDefault: false,
    externalApiCalls: false,
    note: "Slots describe intended inventory; actual firm and model integrations require explicit selection and configuration.",
  },
  joker2: {
    status: "reserved",
    role: null,
  },
});

export function getZlatkoArchitecture() {
  return {
    ok: true,
    architecture: ZLATKO_ARCHITECTURE,
    networkCalls: 0,
  };
}
