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
      { id: "audit", agentId: "pluton-agent-100", codeId: "code-29-dataset-audit", data: [1, 1, null] },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.agentCapacity, 100);
  assert.equal(result.codesPerAgent, 30);
  assert.equal(result.maxAgentCodeAssignments, 3000);
  assert.equal(result.registeredLocalCodes, 30);
  assert.equal(result.networkCalls, 0);
  assert.deepEqual(result.results[0].result, ["a", "b"]);
  assert.equal(result.results[1].result.duplicateCount, 1);
  assert.ok(result.results.every((item) => item.networkCalls === 0));
});

test("PLUTON fleet rejects unknown agents and code IDs", () => {
  assert.throws(() => runPluton({ operation: "fleet", tasks: [{ agentId: "agent-999", codeId: "code-30-health", data: null }] }), /Unknown PLUTON agent/);
  assert.throws(() => runPluton({ operation: "fleet", tasks: [{ agentId: "pluton-agent-001", codeId: "api-call", data: null }] }), /Unknown PLUTON code/);
});

test("PLUTON code catalog lists exactly 30 local code modules", () => {
  const result = runPluton({ operation: "listCodes" });
  assert.equal(result.networkCalls, 0);
  assert.equal(result.codes.length, 30);
});
