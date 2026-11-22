/**
 * ZLATKO AI MODE — local-only PLUTON server.
 * No external AI provider configuration or fallback is permitted.
 */
import { createServer } from "node:http";
import { runPluton } from "./pluton.js";

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://zlatkomarina0-ai.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,capacitor://localhost,ionic://localhost")
    .split(",").map((origin) => origin.trim()).filter(Boolean),
);


function send(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

function getCors(req) {
  const origin = req.headers.origin || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return { origin, headers };
}

const server = createServer(async (req, res) => {
  const { origin, headers: cors } = getCors(req);
  if (req.method === "OPTIONS") {
    if (!cors["Access-Control-Allow-Origin"]) return send(res, 403, { error: "Origin not allowed" }, cors);
    res.writeHead(204, cors);
    return res.end();
  }

  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true, service: "zlatko-api",
      mode: "local-only", networkCalls: 0,
    }, cors);
  }
  if (req.method === "POST" && url.pathname === "/api/pluton") {
    if (!origin || !cors["Access-Control-Allow-Origin"]) {
      return send(res, 403, { error: "Origin not allowed" }, cors);
    }

    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 20000) return send(res, 413, { error: "Request body too large" }, cors);
      }
    } catch {
      return send(res, 400, { error: "Could not read request body" }, cors);
    }

    let payload;
    try { payload = JSON.parse(raw); }
    catch { return send(res, 400, { error: "Request body must be valid JSON" }, cors); }

    try {
      const result = runPluton(payload);
      return send(res, result.ok === false ? 400 : 200, result, cors);
    } catch (error) {
      return send(res, 400, {
        error: error instanceof Error ? error.message : "Invalid PLUTON input",
        engine: "PLUTON",
        networkCalls: 0,
      }, cors);
    }
  }

  return send(res, 404, { error: "Only local PLUTON routes are enabled.", engine: "PLUTON", networkCalls: 0 }, cors);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("ZLATKO PLUTON local-only server listening on port " + PORT);
});
