/**
 * Minimal Cloudflare Worker health endpoint for ZLATKO AI MODE.
 * PLUTON processing remains in the client and this Worker does not call AI APIs.
 * No secrets, provider APIs, or external network requests are used here.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    const url = new URL(request.url);
    if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed' }, 405);
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        system: 'ZLATKO AI MODE',
        component: 'PLUTON CODE ♠',
        mode: 'local-first',
        apiCalls: false,
        timestamp: new Date().toISOString(),
      });
    }
    return json({ ok: false, error: 'Not found' }, 404);
  },
};
