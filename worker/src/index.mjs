const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

async function signJob(secret, body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' } });
    if (url.pathname === '/api/health') return json({ ok: true, service: 'resonance-worker', renderer: env.PI_RENDERER_URL ? 'tailscale-pi' : 'unconfigured' });
    if (url.pathname === '/api/render' && request.method === 'POST') {
      if (!env.PI_RENDERER_URL || !env.PI_RENDERER_SECRET) return json({ error: 'Pi renderer is not configured' }, 503);
      const body = await request.text();
      const signature = await signJob(env.PI_RENDERER_SECRET, body);
      const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-resonance-signature': `sha256=${signature}` }, body });
      return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json' } });
    }
    const jobMatch = url.pathname.match(/^\/api\/render\/([^/]+)$/);
    if (jobMatch && request.method === 'GET') {
      if (!env.PI_RENDERER_URL) return json({ error: 'Pi renderer is not configured' }, 503);
      const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}/jobs/${encodeURIComponent(jobMatch[1])}`);
      return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json' } });
    }
    return json({ error: 'not found' }, 404);
  },
};
