/**
 * ZAMKA card — local integrity gate for ZLATKO AI MODE.
 * Holds a result until an explicit confirmation is supplied.
 * Deterministic local checks only; no network or provider calls.
 */
const stable = (value) => JSON.stringify(canonical(value));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function runZamka(payload = {}) {
  const records = payload.data;
  if (!Array.isArray(records)) throw new TypeError("ZAMKA expects data to be an array");
  if (records.length > 5000) throw new RangeError("ZAMKA accepts at most 5000 records");

  const seen = new Set();
  const duplicateIndexes = [];
  const missingIdIndexes = [];
  const emptyFieldIndexes = [];

  records.forEach((record, index) => {
    const key = stable(record);
    if (seen.has(key)) duplicateIndexes.push(index);
    seen.add(key);

    if (!record || typeof record !== "object" || Array.isArray(record) ||
        record.id === undefined || record.id === null || String(record.id).trim() === "") {
      missingIdIndexes.push(index);
    }

    if (record && typeof record === "object" && !Array.isArray(record)) {
      const emptyFields = Object.entries(record)
        .filter(([, value]) => value === null || value === undefined ||
          (typeof value === "string" && value.trim() === ""))
        .map(([field]) => field);
      if (emptyFields.length) emptyFieldIndexes.push({ index, fields: emptyFields });
    }
  });

  const issues = duplicateIndexes.length + missingIdIndexes.length + emptyFieldIndexes.length;
  const confirmed = payload.confirmed === true;
  const passed = issues === 0;
  return {
    ok: true,
    card: "ZAMKA",
    mode: "local-only",
    status: confirmed && passed ? "released" : "held",
    confirmed,
    passed,
    inputCount: records.length,
    duplicateIndexes,
    missingIdIndexes,
    emptyFieldIndexes,
    issueCount: issues,
    releaseAllowed: confirmed && passed,
    networkCalls: 0,
  };
}
