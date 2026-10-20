const json = (body, status = 200, cacheControl = 'no-store') => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': cacheControl, 'access-control-allow-origin': '*' },
});

const manifest = {
  id: 'night-transit',
  title: 'Night Transit',
    baseSha: 'af11c3460d2c41c2f20a0f9bb18f98678f5073b2',
  engineCommit: 'b9e8190b8b1a9da3fcac2d7ebf4c0fe9a821fe5b',
  projectPath: 'project/main.od',
  rendererVersion: 'renderer-local-0.1.0',
};
const files = [
  { path: 'project/main.od', type: 'openDAW project', size: '1.8 MB' },
  { path: 'song.json', type: 'manifest', size: '2.1 KB' },
  { path: 'credits.json', type: 'contributors', size: '1.4 KB' },
  { path: 'LICENSE', type: 'CC BY-SA 4.0', size: '1.1 KB' },
];
const commits = [
  { hash: '25af248f', title: 'Document re:sonance platform integration', author: 'ak-2302', date: 'today' },
  { hash: 'b8d42e', title: 'Sketch the main melody', author: 'you', date: '5 days ago' },
  { hash: 'c2f7a1', title: 'Start with a blank canvas', author: 'n.kobayashi', date: '8 days ago' },
];
const proposals = [{ id: '#42', title: 'Bring the bassline forward in verse 2', author: 'Mika Ito', status: 'Ready for review', branch: 'proposal/42-bassline', baseSha: manifest.baseSha, headSha: 'd4c91a', render: 'ready' }];
const renderJobs = new Map();
const MAX_PROPOSAL_BODY_BYTES = 3_000_000;
const MAX_SNAPSHOT_BASE64_BYTES = 2_500_000;
let githubInstallationTokenCache;

function base64url(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToBytes(pem) {
  const isPkcs1 = pem.includes('BEGIN RSA PRIVATE KEY');
  const base64 = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, '');
  const binary = atob(base64);
  const der = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (!isPkcs1) return der;

  // GitHub downloads RSA App keys as PKCS#1. Web Crypto imports RSA private
  // keys as PKCS#8, so wrap the PKCS#1 payload in a PrivateKeyInfo envelope.
  const derLength = (length) => {
    if (length < 0x80) return Uint8Array.of(length);
    const bytes = [];
    for (let value = length; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 0xff);
    return Uint8Array.of(0x80 | bytes.length, ...bytes);
  };
  const derSequence = (tag, value) => Uint8Array.of(tag, ...derLength(value.length), ...value);
  const algorithm = derSequence(0x30, Uint8Array.of(
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ));
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const privateKey = derSequence(0x04, der);
  return derSequence(0x30, Uint8Array.of(...version, ...algorithm, ...privateKey));
}

async function githubToken(env) {
  if (env.GITHUB_APP_TOKEN) return env.GITHUB_APP_TOKEN;
  if (!env.GITHUB_APP_ID || !env.GITHUB_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY) return env.GITHUB_TOKEN || null;
  if (githubInstallationTokenCache && githubInstallationTokenCache.expiresAt > Date.now() + 60_000) return githubInstallationTokenCache.token;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000) - 60, exp: Math.floor(Date.now() / 1000) + 540, iss: env.GITHUB_APP_ID }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(env.GITHUB_APP_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const response = await fetch(`https://api.github.com/app/installations/${encodeURIComponent(env.GITHUB_INSTALLATION_ID)}/access_tokens`, { method: 'POST', headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${signingInput}.${base64url(signature)}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'resonance-api' } });
  if (!response.ok) throw new Error(`GitHub App token ${response.status}`);
  const data = await response.json();
  githubInstallationTokenCache = { token: data.token, expiresAt: Date.parse(data.expires_at) || Date.now() + 3_000_000 };
  return data.token;
}

async function readJsonBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_PROPOSAL_BODY_BYTES) throw new Error('proposal payload is too large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PROPOSAL_BODY_BYTES) throw new Error('proposal payload is too large');
  return JSON.parse(text || '{}');
}

async function loadProposals(env) {
  if (!env.DB) return proposals;
  const result = await env.DB.prepare('SELECT payload FROM proposals WHERE song_id = ?1 ORDER BY created_at DESC').bind(manifest.id).all();
  return result.results.length ? result.results.map((row) => JSON.parse(row.payload)) : proposals;
}

async function storeProposal(env, proposal) {
  if (!env.DB) return;
  await env.DB.prepare('INSERT OR REPLACE INTO proposals (id, song_id, payload, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(proposal.id, manifest.id, JSON.stringify(proposal), Date.now()).run();
}

async function storeRenderJob(env, job) {
  if (!env.DB || !job?.jobId) return;
  try {
    await env.DB.prepare('INSERT OR REPLACE INTO render_jobs (job_id, proposal_id, payload, updated_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(job.jobId, job.proposalId || '', JSON.stringify(job), Date.now()).run();
  } catch (error) {
    console.error('render job persistence failed', error);
  }
}

async function loadRenderJob(env, jobId) {
  if (!env.DB) return renderJobs.get(jobId) || null;
  try {
    const row = await env.DB.prepare('SELECT payload FROM render_jobs WHERE job_id = ?1').bind(jobId).first();
    return row ? JSON.parse(row.payload) : (renderJobs.get(jobId) || null);
  } catch (error) {
    console.error('render job lookup failed', error);
    return renderJobs.get(jobId) || null;
  }
}

function previewWav(mode) {
  const sampleRate = 22050;
  const seconds = 2;
  const samples = sampleRate * seconds;
  const data = new Uint8Array(44 + samples * 2);
  const view = new DataView(data.buffer);
  const put = (offset, value) => [...value].forEach((byte, index) => view.setUint8(offset + index, byte.charCodeAt(0)));
  put(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); put(8, 'WAVE'); put(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, 'data'); view.setUint32(40, samples * 2, true);
  const root = mode === 'proposal' ? 220 : 196;
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 16) * Math.min(1, (seconds - t) * 16);
    const tone = Math.sin(2 * Math.PI * root * t) * 0.18 + Math.sin(2 * Math.PI * root * 1.5 * t) * (mode === 'proposal' ? 0.1 : 0.04);
    view.setInt16(44 + i * 2, tone * envelope * 32767, true);
  }
  return data;
}

async function githubRequest(env, path, options = {}) {
  const token = await githubToken(env);
  if (!token || !env.GITHUB_REPOSITORY) throw new Error('GitHub integration is not configured');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
}

async function signJob(secret, body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  return cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sessionUser(request, env) {
  if (!env.AUTH_SESSION_SECRET) return null;
  const value = cookieValue(request, 'resonance_session');
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (signature !== await hmacHex(env.AUTH_SESSION_SECRET, payload)) return null;
  try {
    const encoded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))));
    return user.exp > Date.now() ? user : null;
  } catch { return null; }
}

function authSetupResponse() { return json({ error: 'GitHub OAuth is not configured', nextAction: 'configure-github-oauth-secrets' }, 503); }

async function verifyWebhookSignature(secret, body, signature) {
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const actual = signature.slice(7);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return difference === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' } });
    if (request.method === 'GET' && url.pathname === '/audio/night-transit-base.wav') return new Response(previewWav('base'), { headers: { 'content-type': 'audio/wav', 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } });
    if (request.method === 'GET' && url.pathname === '/audio/night-transit-proposal.wav') return new Response(previewWav('proposal'), { headers: { 'content-type': 'audio/wav', 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } });
    if (url.pathname === '/api/health') return json({ ok: true, service: 'resonance-worker', renderer: env.PI_RENDERER_URL && env.PI_RENDERER_SECRET ? 'tailscale-pi' : 'worker-preview' }, 200, 'public, max-age=30, s-maxage=30');
    if (request.method === 'GET' && url.pathname === '/api/config') {
      const appReady = Boolean(env.GITHUB_APP_ID && env.GITHUB_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY);
      const githubConfigured = Boolean((env.GITHUB_APP_TOKEN || env.GITHUB_TOKEN || appReady) && env.GITHUB_REPOSITORY);
      const authConfigured = Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET && env.GITHUB_OAUTH_REDIRECT_URI && env.AUTH_SESSION_SECRET);
      const githubAuthMode = env.GITHUB_APP_TOKEN ? 'github-app-installation-token' : (appReady ? 'github-app-private-key' : (env.GITHUB_TOKEN ? 'server-token' : 'unconfigured'));
      const githubSetup = { repositoryConfigured: Boolean(env.GITHUB_REPOSITORY), appIdConfigured: Boolean(env.GITHUB_APP_ID), installationIdConfigured: Boolean(env.GITHUB_INSTALLATION_ID), privateKeyConfigured: Boolean(env.GITHUB_APP_PRIVATE_KEY), webhookSecretConfigured: Boolean(env.GITHUB_WEBHOOK_SECRET) };
      const nextAction = !githubSetup.repositoryConfigured ? 'configure-repository' : (!githubSetup.privateKeyConfigured && !env.GITHUB_APP_TOKEN && !env.GITHUB_TOKEN ? 'register-github-app-private-key' : null);
      const authNextAction = authConfigured ? null : 'configure-github-oauth-secrets';
      return json({ githubConfigured, githubAuthMode, githubSetup, nextAction, authConfigured, authNextAction, engineCommit: manifest.engineCommit, rendererVersion: manifest.rendererVersion }, 200, 'public, max-age=60, s-maxage=60');
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/github') {
      if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET || !env.GITHUB_OAUTH_REDIRECT_URI || !env.AUTH_SESSION_SECRET) return authSetupResponse();
      const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
      const state = base64url(bytes);
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', env.GITHUB_OAUTH_REDIRECT_URI);
      authorize.searchParams.set('scope', 'read:user');
      authorize.searchParams.set('state', state);
      return new Response(null, { status: 302, headers: { location: authorize.toString(), 'set-cookie': `resonance_oauth_state=${state}; Max-Age=600; Path=/api/auth; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/github/callback') {
      if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET || !env.GITHUB_OAUTH_REDIRECT_URI || !env.AUTH_SESSION_SECRET) return authSetupResponse();
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      if (!state || state !== cookieValue(request, 'resonance_oauth_state') || !code) return json({ error: 'invalid GitHub OAuth callback' }, 400);
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: env.GITHUB_OAUTH_REDIRECT_URI }) });
      if (!tokenResponse.ok) return json({ error: 'GitHub OAuth token exchange failed' }, 502);
      const token = await tokenResponse.json();
      if (!token.access_token) return json({ error: 'GitHub OAuth token was not returned' }, 502);
      const userResponse = await fetch('https://api.github.com/user', { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token.access_token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'resonance-api' } });
      if (!userResponse.ok) return json({ error: 'GitHub user lookup failed' }, 502);
      const profile = await userResponse.json();
      const session = base64url(JSON.stringify({ id: profile.id, login: profile.login, name: profile.name || profile.login, avatarUrl: profile.avatar_url || null, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
      const signed = `${session}.${await hmacHex(env.AUTH_SESSION_SECRET, session)}`;
      return new Response(null, { status: 302, headers: { location: env.GITHUB_AUTH_SUCCESS_REDIRECT || 'https://resonance.xn--n8jl2g.xn--q9jyb4c/', 'set-cookie': `resonance_session=${signed}; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const user = await sessionUser(request, env);
      return user ? json({ authenticated: true, user }, 200, 'private, max-age=30') : json({ authenticated: false }, 401, 'no-store');
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') return new Response(null, { status: 204, headers: { 'set-cookie': 'resonance_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax', 'access-control-allow-origin': '*' } });
    if (request.method === 'POST' && url.pathname === '/api/webhooks/github') {
      const body = await request.text();
      if (!await verifyWebhookSignature(env.GITHUB_WEBHOOK_SECRET, body, request.headers.get('x-hub-signature-256'))) return json({ error: 'invalid webhook signature' }, 401);
      const delivery = request.headers.get('x-github-delivery');
      if (!delivery) return json({ error: 'missing GitHub delivery id' }, 400);
      if (env.DB) {
        try { await env.DB.prepare('INSERT INTO webhook_events (delivery_id, event_name, received_at) VALUES (?1, ?2, ?3)').bind(delivery, request.headers.get('x-github-event') || 'unknown', Date.now()).run(); }
        catch (error) { if (String(error?.message || error).toLowerCase().includes('unique')) return json({ accepted: true, duplicate: true }); throw error; }
      }
      if (request.headers.get('x-github-event') === 'pull_request') {
        const event = JSON.parse(body || '{}');
        const branch = event.pull_request?.head?.ref;
        const proposalList = await loadProposals(env);
        const proposal = proposalList.find((item) => item.branch === branch);
        if (proposal) {
          if (event.action === 'closed') proposal.status = event.pull_request?.merged ? 'Merged' : 'Closed';
          else if (['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(event.action)) proposal.status = 'Ready for review';
          proposal.pullRequest = { number: event.pull_request.number, url: event.pull_request.html_url };
          await storeProposal(env, proposal);
        }
      }
      return json({ accepted: true, duplicate: false });
    }
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit') return json(manifest, 200, 'public, max-age=300, s-maxage=300');
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit/files') return json(files, 200, 'public, max-age=300, s-maxage=300');
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit/commits') return json(commits, 200, 'public, max-age=60, s-maxage=60');
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit/proposals') return json(await loadProposals(env));
    if (request.method === 'POST' && url.pathname === '/api/songs/night-transit/proposals') {
      const input = await readJsonBody(request).catch((error) => ({ _error: error.message }));
      if (input._error) return json({ error: input._error }, 413);
      if (!input.title?.trim()) return json({ error: 'title is required' }, 400);
      if (input.title.trim().length > 120) return json({ error: 'title is too long' }, 400);
      if (String(input.description || '').length > 5000) return json({ error: 'description is too long' }, 400);
      const snapshot = input.projectSnapshot;
      if (snapshot) {
        if (snapshot.format !== 'opendaw-bundle-v1' || typeof snapshot.contentBase64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(snapshot.contentBase64)) return json({ error: 'invalid openDAW project snapshot' }, 400);
        if (snapshot.contentBase64.length > MAX_SNAPSHOT_BASE64_BYTES) return json({ error: 'openDAW project snapshot is too large' }, 413);
      }
      const current = await loadProposals(env);
      const number = 43 + current.length;
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'change';
      const proposal = { id: `#${number}`, title: input.title.trim(), description: input.description || '', projectSnapshot: input.projectSnapshot || null, author: 'you', status: 'Draft', branch: `proposal/${number}-${slug}`, baseSha: manifest.baseSha, headSha: `worker-${Date.now().toString(16)}`, render: 'queued' };
      proposals.unshift(proposal);
      await storeProposal(env, proposal);
      return json(proposal, 201);
    }
    const pullRequest = url.pathname.match(/^\/api\/songs\/night-transit\/proposals\/(?:%23|#)?([0-9]+)\/pull-request$/);
    if (pullRequest && request.method === 'POST') {
      const input = await readJsonBody(request).catch(() => ({}));
      const current = await loadProposals(env);
      const proposal = current.find((item) => item.id === `#${pullRequest[1]}`) || (input.id === `#${pullRequest[1]}` ? input : null);
      if (!proposal) return json({ error: 'proposal not found' }, 404);
      if (!(env.GITHUB_APP_TOKEN || env.GITHUB_TOKEN || (env.GITHUB_APP_ID && env.GITHUB_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY)) || !env.GITHUB_REPOSITORY) return json({ error: 'GitHub integration is not configured' }, 503);
      if (!proposal.projectSnapshot?.contentBase64) return json({ error: 'openDAW project snapshot is required before creating a pull request' }, 422);
      try {
        const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
        if (!owner || !repo) return json({ error: 'GITHUB_REPOSITORY must be owner/repository' }, 500);
        const base = await githubRequest(env, `/repos/${owner}/${repo}/git/ref/heads/main`);
        if (base.object.sha !== manifest.baseSha) return json({ error: 'GitHub main changed after proposal snapshot', baseSha: base.object.sha }, 409);
        await githubRequest(env, `/repos/${owner}/${repo}/git/refs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${proposal.branch}`, sha: proposal.baseSha }) });
        const existing = await githubRequest(env, `/repos/${owner}/${repo}/contents/${manifest.projectPath}?ref=${encodeURIComponent(proposal.branch)}`);
        await githubRequest(env, `/repos/${owner}/${repo}/contents/${manifest.projectPath}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: `${proposal.id} update openDAW project`, content: proposal.projectSnapshot.contentBase64, branch: proposal.branch, sha: existing.sha }) });
        const pr = await githubRequest(env, `/repos/${owner}/${repo}/pulls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `${proposal.id} ${proposal.title}`, head: proposal.branch, base: 'main', body: proposal.description || 'Created by re:sonance.' }) });
        proposal.status = 'Ready for review';
        proposal.pullRequest = { number: pr.number, url: pr.html_url };
        proposal.headSha = pr.head.sha || proposal.headSha;
        await storeProposal(env, proposal);
        return json({ mode: 'github', number: pr.number, url: pr.html_url, branch: proposal.branch, baseSha: proposal.baseSha, headSha: pr.head.sha }, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'GitHub request failed' }, 502);
      }
    }
    if (url.pathname === '/api/render' && request.method === 'POST') {
      if (!env.PI_RENDERER_URL || !env.PI_RENDERER_SECRET) return json({ error: 'Pi renderer is not configured' }, 503);
      const body = await request.text();
      const signature = await signJob(env.PI_RENDERER_SECRET, body);
      try {
        const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-resonance-signature': `sha256=${signature}` }, body });
        return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
      } catch (error) {
        return json({ error: 'trusted renderer unavailable', detail: error instanceof Error ? error.message : String(error), retryable: true }, 503);
      }
    }
    const proposalRender = url.pathname.match(/^\/api\/songs\/night-transit\/proposals\/(?:%23|#)?([0-9]+)\/render$/);
    if (proposalRender && request.method === 'POST') {
      const current = await loadProposals(env);
      const proposal = current.find((item) => item.id === `#${proposalRender[1]}`);
      if (!proposal || proposal.baseSha !== manifest.baseSha) return json({ error: 'proposal base SHA is not renderable' }, 409);
      if (env.PI_RENDERER_URL && env.PI_RENDERER_SECRET) {
        const body = JSON.stringify({ songId: manifest.id, proposalId: proposal.id, projectPath: manifest.projectPath, engineCommit: manifest.engineCommit, baseSha: proposal.baseSha, headSha: proposal.headSha, rendererVersion: manifest.rendererVersion });
        const signature = await signJob(env.PI_RENDERER_SECRET, body);
        try {
          const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-resonance-signature': `sha256=${signature}` }, body });
          if (upstream.ok) { const job = await upstream.clone().json().catch(() => null); if (job) await storeRenderJob(env, job); }
          return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
        } catch (error) {
          return json({ error: 'trusted renderer unavailable', detail: error instanceof Error ? error.message : String(error), retryable: true }, 503);
        }
      }
      if (!env.PI_RENDERER_URL || !env.PI_RENDERER_SECRET) {
        const job = { jobId: `local-${Date.now()}`, proposalId: proposal.id, status: 'ready', previewOnly: true, baseSha: manifest.baseSha, headSha: proposal.headSha, rendererVersion: 'worker-preview-synth-0.1.0', baseUrl: `${url.origin}/audio/night-transit-base.wav`, proposalUrl: `${url.origin}/audio/night-transit-proposal.wav` };
        renderJobs.set(job.jobId, job); await storeRenderJob(env, job); return json(job, 202);
      }
    }
    const renderStatus = url.pathname.match(/^\/api\/(?:render|renders)\/([^/]+)$/);
    if (renderStatus && request.method === 'GET') {
      if (env.PI_RENDERER_URL && env.PI_RENDERER_SECRET) {
        const path = `/jobs/${encodeURIComponent(renderStatus[1])}`;
        const signature = await signJob(env.PI_RENDERER_SECRET, '');
        try {
          const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}${path}`, { headers: { 'x-resonance-signature': `sha256=${signature}` } });
          if (upstream.ok) { const job = await upstream.clone().json().catch(() => null); if (job) await storeRenderJob(env, job); }
          return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
        } catch (error) {
          return json({ error: 'trusted renderer unavailable', detail: error instanceof Error ? error.message : String(error), retryable: true }, 503);
        }
      }
      return json(await loadRenderJob(env, renderStatus[1]) || { status: 'ready', jobId: renderStatus[1], rendererVersion: manifest.rendererVersion }, 200);
    }
    return json({ error: 'not found' }, 404);
  },
};
