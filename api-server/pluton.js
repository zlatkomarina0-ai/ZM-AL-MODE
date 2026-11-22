/**
 * PLUTON — local-first deterministic task engine.
 * This module never makes network requests and never calls an AI provider.
 */
import { runPlutonFleet, PLUTON_CODE_IDS, PLUTON_AGENT_COUNT, PLUTON_CODES_PER_AGENT, PLUTON_MAX_AGENT_CODE_ASSIGNMENTS } from "./pluton-fleet.js";

const MAX_ITEMS = 5000;
const MAX_TEXT = 12000;

function requireArray(value, label = "data") {
  if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
  if (value.length > MAX_ITEMS) throw new RangeError(label + " exceeds the " + MAX_ITEMS + " item limit");
  return value;
}

function normalize(value) {
  if (typeof value !== "string" && typeof value !== "number") return value;
  return String(value).trim().replace(/\s+/g, " ");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableKey(value) {
  if (value && typeof value === "object") return JSON.stringify(canonicalize(value));
  return String(value);
}

export function runPluton(payload = {}) {
  const operation = typeof payload.operation === "string" ? payload.operation : "";
  const data = payload.data;

  switch (operation) {
    case "health":
      return { ok: true, engine: "PLUTON", mode: "local-only", networkCalls: 0 };

    case "listCodes":
      return { ok: true, engine: "PLUTON", mode: "local-only", codes: PLUTON_CODE_IDS, networkCalls: 0 };

    case "fleet":
      return runPlutonFleet(payload);

    case "normalize":
      if (typeof data === "string") {
        if (data.length > MAX_TEXT) throw new RangeError("Text exceeds the " + MAX_TEXT + " character limit");
        return { operation, result: normalize(data) };
      }
      if (Array.isArray(data)) {
        requireArray(data);
        return { operation, result: data.map(normalize) };
      }
      throw new TypeError("normalize expects a string or an array");

    case "deduplicate": {
      const items = requireArray(data);
      const seen = new Set();
      const result = [];
      for (const item of items) {
        const key = stableKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      }
      return { operation, inputCount: items.length, outputCount: result.length, removedCount: items.length - result.length, result };
    }

    case "compare": {
      const left = requireArray(payload.left, "left");
      const right = requireArray(payload.right, "right");
      const rightKeys = new Set(right.map(stableKey));
      const leftKeys = new Set(left.map(stableKey));
      return {
        operation,
        onlyLeft: left.filter((item) => !rightKeys.has(stableKey(item))),
        onlyRight: right.filter((item) => !leftKeys.has(stableKey(item))),
        common: left.filter((item) => rightKeys.has(stableKey(item))),
      };
    }

    case "validateTeams": {
      const teams = requireArray(data, "data");
      const errors = [];
      const seen = new Set();
      teams.forEach((team, index) => {
        if (!team || typeof team !== "object" || Array.isArray(team)) {
          errors.push({ index, error: "Team must be an object" });
          return;
        }
        const name = typeof team.name === "string" ? team.name.trim() : "";
        if (!name) errors.push({ index, error: "Missing team name" });
        const key = name.toLocaleLowerCase();
        if (key && seen.has(key)) errors.push({ index, error: "Duplicate team name", name });
        if (key) seen.add(key);
      });
      return { operation, valid: errors.length === 0, checkedCount: teams.length, errors };
    }

    case "mockApi":
      // Deliberately local fixture: no HTTP request, provider, key, or API cost.
      return {
        operation,
        simulated: true,
        providerCalled: false,
        networkCalls: 0,
        result: payload.fixture ?? { ok: true, message: "PLUTON mock response", source: "local-fixture" },
      };

    default:
      return {
        ok: false,
        engine: "PLUTON",
        operation: operation || null,
        error: "Unsupported local operation. No API was called.",
        supportedOperations: ["health", "listCodes", "fleet", "normalize", "deduplicate", "compare", "validateTeams", "mockApi"],
        networkCalls: 0,
      };
  }
}
