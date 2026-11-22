/**
 * ARSENAL ORUZJE — web-research capacity and safety policy.
 *
 * This describes logical capacity, not provisioned physical computers.
 * It never launches crawlers or makes network calls by itself.
 */
export const ARSENAL_CONFIG = Object.freeze({
  name: "ARSENAL ORUZJE",
  workers: 100,
  virtualComputersPerWorker: 100,
  websiteSlotsPerComputer: 1000,
  totalLogicalComputerSlots: 10000,
  totalWebsiteAssignments: 10000000,
  internetAccess: { enabled: false, requiresDeploymentConfiguration: true },
  search: {
    enabled: false,
    mode: "allowlisted-search",
    requiresExplicitServerConfiguration: true,
    obeyRobotsTxt: true,
    respectRateLimits: true,
    noLoginBypass: true,
    noPaywallBypass: true,
  },
  ai: {
    defaultProvider: "local",
    deepseek: {
      availableAsOptionalAdapter: true,
      enabledByDefault: false,
      requiresRuntimeApiKey: true,
      keyMustNeverBeStoredInRepository: true,
      automaticFallback: false,
    },
  },
  websiteRegistry: {
    capacity: 1000,
    loadedAndReviewedCount: 0,
    policy: "Only add domains after review; HTTPS, ownership/reputation, privacy, robots and rate-limit checks.",
  },
});

const TRUSTED_STARTER_SITES = [
  { domain: "uefa.com", category: "official-football", trust: "official-organization" },
  { domain: "fifa.com", category: "official-football", trust: "official-organization" },
  { domain: "premierleague.com", category: "official-football", trust: "official-league" },
  { domain: "laliga.com", category: "official-football", trust: "official-league" },
  { domain: "bundesliga.com", category: "official-football", trust: "official-league" },
  { domain: "legaseriea.it", category: "official-football", trust: "official-league" },
  { domain: "ligue1.com", category: "official-football", trust: "official-league" },
  { domain: "eredivisie.nl", category: "official-football", trust: "official-league" },
  { domain: "efl.com", category: "official-football", trust: "official-league" },
  { domain: "thefa.com", category: "official-football", trust: "official-organization" },
  { domain: "basketball-reference.com", category: "basketball-data", trust: "established-reference" },
  { domain: "fiba.basketball", category: "basketball", trust: "official-organization" },
  { domain: "euroleaguebasketball.net", category: "basketball", trust: "official-competition" },
  { domain: "ehfcl.eurohandball.com", category: "handball", trust: "official-competition" },
  { domain: "eurohandball.com", category: "handball", trust: "official-organization" },
  { domain: "olympics.com", category: "multi-sport", trust: "official-organization" },
  { domain: "worldathletics.org", category: "athletics", trust: "official-organization" },
  { domain: "bbc.com/sport", category: "sports-news", trust: "established-newsroom" },
  { domain: "reuters.com", category: "news", trust: "established-newsroom" },
  { domain: "apnews.com", category: "news", trust: "established-newsroom" },
  { domain: "who.int", category: "public-information", trust: "intergovernmental" },
  { domain: "un.org", category: "public-information", trust: "intergovernmental" },
  { domain: "europa.eu", category: "public-information", trust: "official-government" },
  { domain: "data.gov", category: "open-data", trust: "official-government" },
  { domain: "data.europa.eu", category: "open-data", trust: "official-government" },
  { domain: "wikipedia.org", category: "reference", trust: "community-reference-review-needed" },
  { domain: "wikidata.org", category: "open-data", trust: "community-data-review-needed" },
  { domain: "github.com", category: "software", trust: "established-platform" },
  { domain: "developer.mozilla.org", category: "technical-docs", trust: "established-documentation" },
  { domain: "nodejs.org", category: "technical-docs", trust: "official-project" },
  { domain: "docs.python.org", category: "technical-docs", trust: "official-documentation" },
  { domain: "ec.europa.eu", category: "public-information", trust: "official-government" },
];

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/i;

export function listArsenalSites() {
  return TRUSTED_STARTER_SITES.map((site) => ({ ...site }));
}

export function runArsenal(payload = {}) {
  const operation = typeof payload.operation === "string" ? payload.operation : "status";

  if (operation === "status") {
    return {
      ok: true,
      arsenal: ARSENAL_CONFIG.name,
      config: ARSENAL_CONFIG,
      registeredStarterSites: TRUSTED_STARTER_SITES.length,
      remainingReviewSlots: ARSENAL_CONFIG.websiteRegistry.capacity - TRUSTED_STARTER_SITES.length,
      internetReady: false,
      searchReady: false,
      deepseekEnabled: false,
      networkCalls: 0,
      note: "Logical capacity only; computers, internet, search and DeepSeek are not provisioned or activated by this configuration.",
    };
  }

  if (operation === "listSites") {
    return { ok: true, sites: listArsenalSites(), count: TRUSTED_STARTER_SITES.length, networkCalls: 0 };
  }

  if (operation === "validateDomain") {
    const raw = typeof payload.domain === "string" ? payload.domain.trim() : "";
    const candidate = raw.replace(/^https?:\\/\\//i, "").split(/[/?#]/)[0].replace(/:\\d+$/, "");
    const allowed = TRUSTED_STARTER_SITES.some((site) => site.domain === candidate || site.domain.endsWith("/" + candidate));
    return {
      ok: true,
      domain: candidate,
      syntacticallyValid: DOMAIN_RE.test(candidate),
      inStarterAllowlist: allowed,
      allowedForAutomatedFetch: DOMAIN_RE.test(candidate) && allowed,
      networkCalls: 0,
    };
  }

  return { ok: false, arsenal: ARSENAL_CONFIG.name, error: "Unsupported ARSENAL operation", supportedOperations: ["status", "listSites", "validateDomain"], networkCalls: 0 };
}
