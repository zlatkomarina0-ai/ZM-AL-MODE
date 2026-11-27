/**
 * Minimal health endpoint for ZLATKO AI MODE.
 * Deliberately has no outbound fetch, proxy, website-download, or AI API capability.
 * Do not add outbound network calls without a separately reviewed security design.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://zlatkomarina0-ai.github.io',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
};
const securityHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, ...securityHeaders },
  });
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const headers = { ...corsHeaders, ...securityHeaders };
    if (origin && origin !== 'https://zlatkomarina0-ai.github.io') {
      return json({ ok: false, error: 'Origin not allowed' }, 403);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405);
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        system: 'ZLATKO AI MODE',
        component: 'PLUTON CODE ♠',
        mode: 'local-first',
        apiCalls: false,
        outboundNetwork: false,
        timestamp: new Date().toISOString(),
      });
    }
    return json({ ok: false, error: 'Not found' }, 404);
  },
};
