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

const PROVIDER_CONFIG = [
  { id: "openai", keyName: "OPENAI_API_KEY", modelName: "OPENAI_MODEL", model: "gpt-4o-mini", endpoint: "https://api.openai.com/v1/chat/completions" },
  { id: "claude", keyName: "ANTHROPIC_API_KEY", modelName: "ANTHROPIC_MODEL", model: "claude-3-5-haiku-latest", style: "anthropic", endpoint: "https://api.anthropic.com/v1/messages" },
  { id: "deepseek", keyName: "DEEPSEEK_API_KEY", modelName: "DEEPSEEK_MODEL", model: "deepseek-chat", endpoint: "https://api.deepseek.com/chat/completions" },
  { id: "gemini", keyName: "GEMINI_API_KEY", modelName: "GEMINI_MODEL", model: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" },
  { id: "groq", keyName: "GROQ_API_KEY", modelName: "GROQ_MODEL", model: "llama-3.3-70b-versatile", endpoint: "https://api.groq.com/openai/v1/chat/completions" },
  { id: "mistral", keyName: "MISTRAL_API_KEY", modelName: "MISTRAL_MODEL", model: "mistral-small-latest", endpoint: "https://api.mistral.ai/v1/chat/completions" },
  { id: "xai", keyName: "XAI_API_KEY", modelName: "XAI_MODEL", model: "grok-3-mini", endpoint: "https://api.x.ai/v1/chat/completions" },
  { id: "openrouter", keyName: "OPENROUTER_API_KEY", modelName: "OPENROUTER_MODEL", model: "openai/gpt-4o-mini", endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  { id: "cerebras", keyName: "CEREBRAS_API_KEY", modelName: "CEREBRAS_MODEL", model: "llama-3.3-70b", endpoint: "https://api.cerebras.ai/v1/chat/completions" },
  { id: "together", keyName: "TOGETHER_API_KEY", modelName: "TOGETHER_MODEL", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", endpoint: "https://api.together.xyz/v1/chat/completions" },
];

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
