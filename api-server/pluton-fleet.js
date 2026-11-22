/**
 * PLUTON — local-only code fleet.
 * No provider SDKs, API keys, network requests, or paid inference.
 * Each of 1,000 agent profiles can select from 30 deterministic local code modules.
 * Modules are shared implementations to conserve storage; execution is on demand.
 */

const MAX_AGENTS = 1000;
const CODES_PER_AGENT = 30;
const MAX_TASKS = 5000;
const cleanText = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const stable = (value) => JSON.stringify(canonical(value));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function asArray(value, name = "data") {
  if (!Array.isArray(value)) throw new TypeError(name + " must be an array");
  if (value.length > MAX_TASKS) throw new RangeError(name + " exceeds " + MAX_TASKS + " items");
  return value;
}
function countBy(items, keyFn) {
  const counts = Object.create(null);
  for (const item of items) {
    const key = String(keyFn(item));
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
function validateNames(items) {
  const seen = new Set();
  const errors = [];
  items.forEach((item, index) => {
    const name = item && typeof item.name === "string" ? cleanText(item.name) : "";
    if (!name) errors.push({ index, error: "Missing name" });
    const key = name.toLocaleLowerCase();
    if (key && seen.has(key)) errors.push({ index, error: "Duplicate name", name });
    if (key) seen.add(key);
  });
  return { valid: errors.length === 0, checkedCount: items.length, errors };
}

/** 30 deterministic local code modules. No module performs network I/O. */
export const PLUTON_CODEBOOK = Object.freeze({
  "code-01-normalize": (data) => typeof data === "string" ? cleanText(data) : asArray(data).map(cleanText),
  "code-02-deduplicate": (data) => [...new Map(asArray(data).map((item) => [stable(item), item])).values()],
  "code-03-sort-text": (data) => asArray(data).slice().sort((a, b) => cleanText(a).localeCompare(cleanText(b))),
  "code-04-count": (data) => ({ count: asArray(data).length }),
  "code-05-unique-count": (data) => ({ count: new Set(asArray(data).map(stable)).size }),
  "code-06-validate-names": (data) => validateNames(asArray(data)),
  "code-07-group-by-name": (data) => {
    const items = asArray(data);
    return Object.groupBy ? Object.groupBy(items, (item) => cleanText(item?.name).toLocaleLowerCase()) :
      items.reduce((groups, item) => { const key = cleanText(item?.name).toLocaleLowerCase() || "(missing)"; (groups[key] ||= []).push(item); return groups; }, {});
  },
  "code-08-find-missing": (data) => asArray(data).filter((item) => item === null || item === undefined || item === ""),
  "code-09-find-empty-text": (data) => asArray(data).filter((item) => typeof item === "string" && !cleanText(item)),
  "code-10-extract-ids": (data) => asArray(data).map((item) => item && typeof item === "object" ? item.id ?? null : null),
  "code-11-extract-names": (data) => asArray(data).map((item) => item && typeof item === "object" ? item.name ?? null : null),
  "code-12-filter-objects": (data) => asArray(data).filter((item) => item !== null && typeof item === "object" && !Array.isArray(item)),
  "code-13-filter-primitives": (data) => asArray(data).filter((item) => item === null || ["string", "number", "boolean"].includes(typeof item)),
  "code-14-compare-counts": (data) => { const x = asArray(data); return { count: x.length, unique: new Set(x.map(stable)).size, duplicates: x.length - new Set(x.map(stable)).size }; },
  "code-15-compare-sets": (data) => {
    if (!data || !Array.isArray(data.left) || !Array.isArray(data.right)) throw new TypeError("data must contain left and right arrays");
    const left = new Map(data.left.map((v) => [stable(v), v])); const right = new Map(data.right.map((v) => [stable(v), v]));
    return { onlyLeft: [...left].filter(([k]) => !right.has(k)).map(([,v]) => v), onlyRight: [...right].filter(([k]) => !left.has(k)).map(([,v]) => v), common: [...left].filter(([k]) => right.has(k)).map(([,v]) => v) };
  },
  "code-16-frequency": (data) => countBy(asArray(data), (item) => typeof item === "object" ? stable(item) : item),
  "code-17-trim-fields": (data) => asArray(data).map((item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).map(([k,v]) => [k, typeof v === "string" ? cleanText(v) : v])) : item),
  "code-18-lowercase-text": (data) => typeof data === "string" ? cleanText(data).toLocaleLowerCase() : asArray(data).map((v) => typeof v === "string" ? cleanText(v).toLocaleLowerCase() : v),
  "code-19-uppercase-text": (data) => typeof data === "string" ? cleanText(data).toLocaleUpperCase() : asArray(data).map((v) => typeof v === "string" ? cleanText(v).toLocaleUpperCase() : v),
  "code-20-filter-by-field": (data) => {
    if (!data || !Array.isArray(data.items) || typeof data.field !== "string") throw new TypeError("data must contain items and field");
    return data.items.filter((item) => item && item[data.field] === data.equals);
  },
  "code-21-project-fields": (data) => {
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.fields)) throw new TypeError("data must contain items and fields");
    return data.items.map((item) => Object.fromEntries(data.fields.map((field) => [field, item?.[field] ?? null])));
  },
  "code-22-summarize-numbers": (data) => {
    const values = asArray(data).filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a,b) => a-b);
    const sum = values.reduce((a,b) => a+b, 0);
    return { count: values.length, sum, min: values[0] ?? null, max: values.at(-1) ?? null, mean: values.length ? sum / values.length : null };
  },
  "code-23-validate-teams": (data) => validateNames(asArray(data).map((item) => ({ name: item?.name }))),
  "code-24-check-required-fields": (data) => {
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.required)) throw new TypeError("data must contain items and required");
    return data.items.flatMap((item, index) => data.required.filter((field) => item?.[field] === undefined || item?.[field] === null || item?.[field] === "").map((field) => ({ index, field, error: "Required field missing" })));
  },
  "code-25-detect-duplicates-by-field": (data) => {
    if (!data || !Array.isArray(data.items) || typeof data.field !== "string") throw new TypeError("data must contain items and field");
    const counts = countBy(data.items, (item) => cleanText(item?.[data.field]).toLocaleLowerCase());
    return data.items.filter((item) => { const key = cleanText(item?.[data.field]).toLocaleLowerCase(); return key && counts[key] > 1; });
  },
  "code-26-chunk": (data) => {
    if (!data || !Array.isArray(data.items) || !Number.isInteger(data.size) || data.size < 1 || data.size > 1000) throw new TypeError("data must contain items and size from 1 to 1000");
    const result = []; for (let i = 0; i < data.items.length; i += data.size) result.push(data.items.slice(i, i + data.size)); return result;
  },
  "code-27-flatten-one-level": (data) => asArray(data).flat(1),
  "code-28-stable-serialize": (data) => stable(data),
  "code-29-dataset-audit": (data) => {
    const items = asArray(data);
    return { itemCount: items.length, objectCount: items.filter((v) => v && typeof v === "object" && !Array.isArray(v)).length, nullCount: items.filter((v) => v == null).length, duplicateCount: items.length - new Set(items.map(stable)).size };
  },
  "code-30-health": () => ({ engine: "PLUTON", mode: "local-only", networkCalls: 0, status: "ready" }),
});

export const PLUTON_AGENT_COUNT = MAX_AGENTS;
export const PLUTON_CODES_PER_AGENT = CODES_PER_AGENT;
export const PLUTON_MAX_AGENT_CODE_ASSIGNMENTS = MAX_AGENTS * CODES_PER_AGENT;
export const PLUTON_AGENT_IDS = Object.freeze(Array.from({ length: MAX_AGENTS }, (_, i) => "pluton-agent-" + String(i + 1).padStart(4, "0")));
export const PLUTON_CODE_IDS = Object.freeze(Object.keys(PLUTON_CODEBOOK));

export function runPlutonFleet(payload = {}) {
  const tasks = asArray(payload.tasks, "tasks");
  const assignments = tasks.map((task, index) => {
    const agentId = task?.agentId || PLUTON_AGENT_IDS[index % MAX_AGENTS];
    if (!PLUTON_AGENT_IDS.includes(agentId)) throw new TypeError("Unknown PLUTON agent: " + agentId);
    const codeId = task?.codeId;
    if (!Object.hasOwn(PLUTON_CODEBOOK, codeId)) throw new TypeError("Unknown PLUTON code: " + codeId);
    return { task, agentId, codeId, index };
  });
  const results = assignments.map(({ task, agentId, codeId, index }) => {
    try {
      return { taskId: task.id ?? "task-" + (index + 1), agentId, codeId, status: "completed", result: PLUTON_CODEBOOK[codeId](task.data), networkCalls: 0 };
    } catch (error) {
      return { taskId: task.id ?? "task-" + (index + 1), agentId, codeId, status: "failed", error: error instanceof Error ? error.message : String(error), networkCalls: 0 };
    }
  });
  return {
    ok: results.every((result) => result.status === "completed"),
    engine: "PLUTON",
    mode: "local-only",
    agentCapacity: MAX_AGENTS,
    codesPerAgent: CODES_PER_AGENT,
    maxAgentCodeAssignments: PLUTON_MAX_AGENT_CODE_ASSIGNMENTS,
    registeredAgents: MAX_AGENTS,
    registeredLocalCodes: PLUTON_CODE_IDS.length,
    networkCalls: 0,
    taskCount: tasks.length,
    results,
  };
}
