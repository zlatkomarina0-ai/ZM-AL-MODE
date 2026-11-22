/**
 * AS KARO (♦) — local match-data preparation pipeline.
 * First working implementation: normalize, deduplicate, validate, then hold
 * the candidate set at ZAMKA. No external API, provider, or network calls.
 */
import { runPluton } from "./pluton.js";
import { runZamka } from "./zamka.js";

const MAX_MATCHES = 5000;

function cleanText(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim().replace(/\s+/g, " ")
    : value;
}

function matchKey(match) {
  const id = cleanText(match.id ?? match.code ?? "");
  if (id) return "id:" + id.toLocaleLowerCase();
  return [
    cleanText(match.home ?? match.homeTeam ?? "").toLocaleLowerCase(),
    cleanText(match.away ?? match.awayTeam ?? "").toLocaleLowerCase(),
    cleanText(match.date ?? match.matchDate ?? "").toLocaleLowerCase(),
  ].join("|");
}

export function runKaro(payload = {}) {
  if (!Array.isArray(payload.data)) {
    throw new TypeError("AS KARO expects data to be an array of match records");
  }
  if (payload.data.length > MAX_MATCHES) {
    throw new RangeError("AS KARO accepts at most " + MAX_MATCHES + " match records");
  }

  const normalized = payload.data.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { id: "invalid-" + index, invalidRecord: true, sourceValue: item };
    }
    const record = Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, cleanText(value)])
    );
    if (record.id === undefined || record.id === null || record.id === "") {
      record.id = cleanText(record.code) || "karo-row-" + (index + 1);
    }
    return record;
  });

  const seen = new Set();
  const matches = [];
  const duplicateIndexes = [];
  normalized.forEach((match, index) => {
    const key = matchKey(match);
    if (seen.has(key)) duplicateIndexes.push(index);
    else {
      seen.add(key);
      matches.push(match);
    }
  });

  const invalidIndexes = [];
  matches.forEach((match, index) => {
    const home = cleanText(match.home ?? match.homeTeam ?? "");
    const away = cleanText(match.away ?? match.awayTeam ?? "");
    if (match.invalidRecord || !home || !away) invalidIndexes.push(index);
  });

  const gate = runZamka({ data: matches, confirmed: payload.confirmed === true });
  const passed = invalidIndexes.length === 0 && duplicateIndexes.length === 0 && gate.passed;

  return {
    ok: true,
    card: "AS KARO",
    symbol: "♦",
    engine: "local-only",
    status: passed && payload.confirmed === true ? "released" : "held",
    inputCount: payload.data.length,
    normalizedCount: normalized.length,
    uniqueCount: matches.length,
    duplicateIndexes,
    invalidMatchIndexes: invalidIndexes,
    matches,
    zamka: gate,
    releaseAllowed: passed && payload.confirmed === true,
    networkCalls: 0,
  };
}
