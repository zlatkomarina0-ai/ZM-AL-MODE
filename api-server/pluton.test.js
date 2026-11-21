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
