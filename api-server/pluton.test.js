import test from "node:test";
import assert from "node:assert/strict";
import { runPluton } from "./pluton.js";

test("health declares local-only execution and zero network calls", () => {
  assert.deepEqual(runPluton({ operation: "health" }), {
    ok: true, engine: "PLUTON", mode: "local-only", networkCalls: 0,
  });
});

test("normalize trims and collapses whitespace", () => {
  assert.equal(runPluton({ operation: "normalize", data: "  North   Macedonia  " }).result, "North Macedonia");
});

test("deduplicate preserves first occurrence and order", () => {
  const result = runPluton({ operation: "deduplicate", data: ["A", "B", "A", "C", "B"] });
  assert.deepEqual(result.result, ["A", "B", "C"]);
  assert.equal(result.removedCount, 2);
});

test("compare returns values unique to each side and common values", () => {
  const result = runPluton({ operation: "compare", left: [1, 2, 3], right: [2, 3, 4] });
  assert.deepEqual(result.onlyLeft, [1]);
  assert.deepEqual(result.onlyRight, [4]);
  assert.deepEqual(result.common, [2, 3]);
});

test("team validation reports missing and duplicate names", () => {
  const result = runPluton({ operation: "validateTeams", data: [{ name: "Lions" }, { name: " lions " }, {}] });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test("mock API returns local fixture without calling a provider", () => {
  const result = runPluton({ operation: "mockApi", fixture: { demo: true } });
  assert.equal(result.simulated, true);
  assert.equal(result.providerCalled, false);
  assert.equal(result.networkCalls, 0);
  assert.deepEqual(result.result, { demo: true });
});

test("unsupported operations do not fall back to an API", () => {
  const result = runPluton({ operation: "askAI", data: "hello" });
  assert.equal(result.ok, false);
  assert.equal(result.networkCalls, 0);
});

test("PLUTON fleet runs local code tasks without network calls", () => {
  const result = runPluton({
    operation: "fleet",
    tasks: [
      { id: "dedupe", agentId: "pluton-agent-001", codeId: "code-02-deduplicate", data: ["a", "b", "a"] },
      { id: "audit", agentId: "pluton-agent-1000", codeId: "code-29-dataset-audit", data: [1, 1, null] },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.agentCapacity, 1000);
  assert.equal(result.codesPerAgent, 30);
  assert.equal(result.maxAgentCodeAssignments, 30000);
  assert.equal(result.registeredLocalCodes, 30);
  assert.equal(result.networkCalls, 0);
  assert.deepEqual(result.results[0].result, ["a", "b"]);
  assert.equal(result.results[1].result.duplicateCount, 1);
  assert.ok(result.results.every((item) => item.networkCalls === 0));
});

test("PLUTON fleet rejects unknown agents and code IDs", () => {
  assert.throws(() => runPluton({ operation: "fleet", tasks: [{ agentId: "agent-999", codeId: "code-30-health", data: null }] }), /Unknown PLUTON agent/);
  assert.throws(() => runPluton({ operation: "fleet", tasks: [{ agentId: "pluton-agent-0001", codeId: "api-call", data: null }] }), /Unknown PLUTON code/);
});

test("PLUTON code catalog lists exactly 30 local code modules", () => {
  const result = runPluton({ operation: "listCodes" });
  assert.equal(result.networkCalls, 0);
  assert.equal(result.codes.length, 30);
});

test("ZAMKA holds results until confirmed and clean", () => {
  const held = runPluton({ operation: "zamka", data: [{ id: "m1", score: "2-1" }] });
  assert.equal(held.card, "ZAMKA");
  assert.equal(held.status, "held");
  assert.equal(held.releaseAllowed, false);
  assert.equal(held.networkCalls, 0);

  const released = runPluton({ operation: "zamka", data: [{ id: "m1", score: "2-1" }], confirmed: true });
  assert.equal(released.status, "released");
  assert.equal(released.releaseAllowed, true);
});

test("ZAMKA holds duplicate, missing-ID, and empty-field records", () => {
  const result = runPluton({
    operation: "zamka",
    confirmed: true,
    data: [{ id: "m1", score: "" }, { id: "m1", score: "" }, { score: "1-0" }],
  });
  assert.equal(result.status, "held");
  assert.equal(result.releaseAllowed, false);
  assert.equal(result.duplicateIndexes.length, 1);
  assert.equal(result.missingIdIndexes.length, 1);
  assert.equal(result.emptyFieldIndexes.length, 2);
});


test("AS KARO normalizes and deduplicates matches locally, then releases only after confirmation", () => {
  const data = [
    { id: "m1", home: "  Real   Madrid ", away: "Celta", date: "2026-11-22" },
    { id: "m1", home: "Real Madrid", away: "Celta", date: "2026-11-22" },
    { id: "m2", home: "Barcelona", away: "Villarreal", date: "2026-11-22" },
  ];
  const held = runPluton({ operation: "karo", data });
  assert.equal(held.card, "AS KARO");
  assert.equal(held.symbol, "♦");
  assert.equal(held.inputCount, 3);
  assert.equal(held.uniqueCount, 2);
  assert.deepEqual(held.duplicateIndexes, [1]);
  assert.equal(held.status, "held");
  assert.equal(held.networkCalls, 0);

  const clean = runPluton({
    operation: "karo",
    confirmed: true,
    data: [{ id: "m3", home: " Barcelona ", away: " Villarreal ", date: "2026-11-22" }],
  });
  assert.equal(clean.status, "released");
  assert.equal(clean.releaseAllowed, true);
  assert.equal(clean.matches[0].home, "Barcelona");
  assert.equal(clean.networkCalls, 0);
});

test("AS KARO holds records without both match teams", () => {
  const result = runPluton({
    operation: "karo",
    confirmed: true,
    data: [{ id: "m1", home: "Barcelona", away: "" }],
  });
  assert.equal(result.status, "held");
  assert.equal(result.releaseAllowed, false);
  assert.deepEqual(result.invalidMatchIndexes, [0]);
});


test("ARSENAL reports logical capacity without claiming real computers or internet are active", async () => {
  const { runArsenal, ARSENAL_CONFIG } = await import("./arsenal.js");
  const result = runPluton({ operation: "arsenal" });
  assert.equal(result.arsenal, "ARSENAL ORUZJE");
  assert.equal(result.config.chiefProfiles, 1000);
  assert.equal(result.config.workersPerProfile, 2000000);
  assert.equal(result.config.totalLogicalWorkerUnits, 2000000000);
  assert.equal(result.config.totalLogicalComputerSlots, 200000000);
  assert.equal(result.config.websiteSlotsPerComputer, 1000);
  assert.equal(result.config.totalWebsiteAssignments, 200000000000);
  assert.equal(result.internetReady, false);
  assert.equal(result.searchReady, false);
  assert.equal(result.deepseekEnabled, false);
  assert.equal(result.networkCalls, 0);
  assert.equal(ARSENAL_CONFIG.chiefProfiles, 1000);
});

test("ARSENAL only approves reviewed starter domains for automated fetch", () => {
  const approved = runPluton({ operation: "arsenal", action: "validateDomain", domain: "uefa.com" });
  assert.equal(approved.inStarterAllowlist, true);
  assert.equal(approved.allowedForAutomatedFetch, true);
  const unknown = runPluton({ operation: "arsenal", action: "validateDomain", domain: "random-unknown.example" });
  assert.equal(unknown.inStarterAllowlist, false);
  assert.equal(unknown.allowedForAutomatedFetch, false);
});


test("ZLATKO architecture keeps card capacities and Joker 1 inventory explicit", async () => {
  const result = runPluton({ operation: "architecture" });
  assert.equal(result.ok, true);
  assert.equal(result.networkCalls, 0);
  assert.equal(result.architecture.chiefProfiles.count, 1000);
  assert.equal(result.architecture.aceOfClubs.logicalWorkerUnitsPerProfile, 2000000);
  assert.equal(result.architecture.aceOfClubs.totalLogicalWorkerUnits, 2000000000);
  assert.equal(result.architecture.aceOfDiamonds.logicalComputerSlots, 200000000);
  assert.equal(result.architecture.aceOfDiamonds.websiteSlotsPerComputer, 1000);
  assert.equal(result.architecture.aceOfDiamonds.totalWebsiteAssignments, 200000000000);
  assert.equal(result.architecture.aceOfSpades.sharedLocalCodeModules, 30);
  assert.equal(result.architecture.aceOfSpades.externalApiCalls, false);
  assert.equal(result.architecture.joker1.agentFirmSlots, 100);
  assert.equal(result.architecture.joker1.ordinaryModelSlots, 30);
  assert.equal(result.architecture.joker1.integrationsEnabledByDefault, false);
  assert.equal(result.architecture.joker2.status, "reserved");
});
