/**
 * ZLATKO AI MODE — Cloudflare API gateway
 *
 * Configure OPENAI_API_KEY, ANTHROPIC_API_KEY and/or DEEPSEEK_API_KEY as
 * Cloudflare Worker secrets. Provider credentials must never be shipped to
 * the browser or Android app.
 */

const MAX_MESSAGE_CHARS = 12000;
const ALLOWED_ORIGINS = new Set([
  "https://zlatkomarina0-ai.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function providerList(env, requested) {
  const available = [
    { id: "openai", key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || "gpt-4o-mini" },
    { id: "claude", key: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest" },
    { id: "deepseek", key: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || "deepseek-chat" },
  ].filter((p) => Boolean(p.key));

  if (!Array.isArray(requested) || requested.length === 0) return available;
  const allowed = new Set(["openai", "claude", "deepseek"]);
  const selected = [...new Set(requested.filter((id) => typeof id === "string" && allowed.has(id)))];
  return available.filter((p) => selected.includes(p.id));
}

async function callProvider(provider, message, context) {
  const system = [
    "You are a specialist agent in ZLATKO AI MODE.",
    "Answer the task clearly and distinguish facts from assumptions.",
    "If information is missing, say so. Do not claim other agents were consulted.",
    context ? "Additional task context:\n" + context : "",
  ].filter(Boolean).join("\n\n");

  let url;
  let headers;
  let body;

  if (provider.id === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": provider.key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    body = {
      model: provider.model,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: message }],
    };
  } else {
    url = provider.id === "deepseek"
      ? "https://api.deepseek.com/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    headers = {
      Authorization: "Bearer " + provider.key,
      "Content-Type": "application/json",
    };
    body = {
      model: provider.model,
      max_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    // Do not return provider response bodies: they can contain diagnostic details.
    throw new Error(provider.id + " provider returned HTTP " + response.status);
  }

  const data = await response.json();
  const content = provider.id === "claude"
    ? (data.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n").trim()
    : data.choices?.[0]?.message?.content?.trim();

  if (!content) throw new Error(provider.id + " returned an empty response");
  return { agentId: provider.id, provider: provider.id, model: provider.model, content };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!cors["Access-Control-Allow-Origin"]) {
        return new Response(null, { status: 403, headers: cors });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "zlatko-api",
        configuredProviders: [
          env.OPENAI_API_KEY ? "openai" : null,
          env.ANTHROPIC_API_KEY ? "claude" : null,
          env.DEEPSEEK_API_KEY ? "deepseek" : null,
        ].filter(Boolean),
      }, 200, cors);
    }

    if (url.pathname !== "/api/ai" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, cors);
    }

    if (!cors["Access-Control-Allow-Origin"]) {
      return json({ error: "Origin not allowed" }, 403, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400, cors);
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const context = typeof payload.context === "string" ? payload.context.slice(0, 4000) : "";
    if (!message) return json({ error: "A non-empty message is required" }, 400, cors);
    if (message.length > MAX_MESSAGE_CHARS) {
      return json({ error: "Message exceeds the 12000 character limit" }, 413, cors);
    }

    const providers = providerList(env, payload.providers);
    if (providers.length === 0) {
      return json({
        error: "No requested providers are configured. Add provider API keys as Cloudflare Worker secrets.",
        replies: [],
        failures: [],
      }, 503, cors);
    }

    const results = await Promise.allSettled(
      providers.map((provider) => callProvider(provider, message, context)),
    );
    const replies = [];
    const failures = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") replies.push(result.value);
      else failures.push({
        agentId: providers[index].id,
        error: result.reason instanceof Error ? result.reason.message : "Provider request failed",
      });
    });

    return json({
      status: replies.length === 0 ? "failed" : failures.length ? "partial" : "completed",
      replies,
      failures,
      note: "Independent provider responses; no synthesis has been performed.",
    }, replies.length ? 200 : 502, cors);
  },
};
