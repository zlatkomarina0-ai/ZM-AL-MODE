/**
 * ZLATKO AI MODE — portable Node.js API server (Render / Railway / similar)
 * Provider API keys are environment variables and must never be shipped to clients.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);
const MAX_MESSAGE_CHARS = 12000;
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

function getProviders(requested) {
  const available = PROVIDER_CONFIG.map((config) => ({
    ...config,
    key: process.env[config.keyName],
    model: process.env[config.modelName] || config.model,
  })).filter((provider) => Boolean(provider.key));
  if (!Array.isArray(requested) || requested.length === 0) return available;
  const selected = new Set(requested.filter((id) => PROVIDER_CONFIG.some((provider) => provider.id === id)));
  return available.filter((provider) => selected.has(provider.id));
}

async function callProvider(provider, message, context) {
  const system = [
    "You are a specialist agent in ZLATKO AI MODE.",
    "Answer clearly and distinguish facts from assumptions.",
    "If information is missing, say so. Do not claim other agents were consulted.",
    context ? "Additional task context:\n" + context : "",
  ].filter(Boolean).join("\n\n");

  let headers;
  let body;
  if (provider.style === "anthropic") {
    headers = { "x-api-key": provider.key, "anthropic-version": "2023-06-01", "content-type": "application/json" };
    body = { model: provider.model, max_tokens: 1200, system, messages: [{ role: "user", content: message }] };
  } else {
    headers = { Authorization: "Bearer " + provider.key, "Content-Type": "application/json" };
    body = { model: provider.model, max_tokens: 1200, messages: [{ role: "system", content: system }, { role: "user", content: message }] };
  }

  const response = await fetch(provider.endpoint, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(provider.id + " provider returned HTTP " + response.status);
  const data = await response.json();
  const content = provider.style === "anthropic"
    ? (data.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n").trim()
    : data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(provider.id + " returned an empty response");
  return { agentId: provider.id, provider: provider.id, model: provider.model, content };
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
      configuredProviders: getProviders().map((provider) => provider.id),
    }, cors);
  }
  if (req.method !== "POST" || url.pathname !== "/api/ai") {
    return send(res, 404, { error: "Not found" }, cors);
  }
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

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const context = typeof payload.context === "string" ? payload.context.slice(0, 4000) : "";
  if (!message) return send(res, 400, { error: "A non-empty message is required" }, cors);
  if (message.length > MAX_MESSAGE_CHARS) return send(res, 413, { error: "Message exceeds the 12000 character limit" }, cors);

  const providers = getProviders(payload.providers);
  if (!providers.length) {
    return send(res, 503, { error: "No provider API keys configured on the server.", replies: [], failures: [] }, cors);
  }
  const settled = await Promise.allSettled(providers.map((provider) => callProvider(provider, message, context)));
  const replies = [];
  const failures = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") replies.push(result.value);
    else failures.push({ agentId: providers[index].id, error: result.reason instanceof Error ? result.reason.message : "Provider request failed" });
  });
  return send(res, replies.length ? 200 : 502, {
    status: replies.length === 0 ? "failed" : failures.length ? "partial" : "completed",
    replies, failures, note: "Independent provider responses; no synthesis has been performed.",
  }, cors);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("ZLATKO AI API listening on port " + PORT);
});
