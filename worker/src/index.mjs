const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
});

const manifest = {
  id: 'night-transit',
  title: 'Night Transit',
  baseSha: '25af248f',
  engineCommit: '25af248f6df66b321f921b54930f94fe5c09898f',
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

async function githubRequest(env, path, options = {}) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) throw new Error('GitHub integration is not configured');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' } });
    if (url.pathname === '/api/health') return json({ ok: true, service: 'resonance-worker', renderer: env.PI_RENDERER_URL ? 'tailscale-pi' : 'unconfigured' });
    if (request.method === 'GET' && url.pathname === '/api/config') return json({ githubConfigured: Boolean(env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY && env.GITHUB_INSTALLATION_ID), engineCommit: manifest.engineCommit, rendererVersion: manifest.rendererVersion });
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit') return json(manifest);
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit/files') return json(files);
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit/commits') return json(commits);
    if (request.method === 'GET' && url.pathname === '/api/songs/night-transit/proposals') return json(proposals);
    if (request.method === 'POST' && url.pathname === '/api/songs/night-transit/proposals') {
      const input = await request.json().catch(() => ({}));
      if (!input.title?.trim()) return json({ error: 'title is required' }, 400);
      const number = 43 + proposals.length;
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'change';
      const proposal = { id: `#${number}`, title: input.title.trim(), description: input.description || '', author: 'you', status: 'Draft', branch: `proposal/${number}-${slug}`, baseSha: manifest.baseSha, headSha: `worker-${Date.now().toString(16)}`, render: 'queued' };
      proposals.unshift(proposal);
      return json(proposal, 201);
    }
    const pullRequest = url.pathname.match(/^\/api\/songs\/night-transit\/proposals\/(?:%23|#)?([0-9]+)\/pull-request$/);
    if (pullRequest && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const proposal = proposals.find((item) => item.id === `#${pullRequest[1]}`) || (input.id === `#${pullRequest[1]}` ? input : null);
      if (!proposal) return json({ error: 'proposal not found' }, 404);
      if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) return json({ error: 'GitHub integration is not configured' }, 503);
      try {
        const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
        if (!owner || !repo) return json({ error: 'GITHUB_REPOSITORY must be owner/repository' }, 500);
        const base = await githubRequest(env, `/repos/${owner}/${repo}/git/ref/heads/main`);
        if (base.object.sha !== manifest.baseSha) return json({ error: 'GitHub main changed after proposal snapshot', baseSha: base.object.sha }, 409);
        await githubRequest(env, `/repos/${owner}/${repo}/git/refs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${proposal.branch}`, sha: proposal.baseSha }) });
        const pr = await githubRequest(env, `/repos/${owner}/${repo}/pulls`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `${proposal.id} ${proposal.title}`, head: proposal.branch, base: 'main', body: proposal.description || 'Created by re:sonance.' }) });
        proposal.status = 'Ready for review';
        proposal.pullRequest = { number: pr.number, url: pr.html_url };
        return json({ mode: 'github', number: pr.number, url: pr.html_url, branch: proposal.branch, baseSha: proposal.baseSha, headSha: proposal.headSha }, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'GitHub request failed' }, 502);
      }
    }
    if (url.pathname === '/api/render' && request.method === 'POST') {
      if (!env.PI_RENDERER_URL || !env.PI_RENDERER_SECRET) return json({ error: 'Pi renderer is not configured' }, 503);
      const body = await request.text();
      const signature = await signJob(env.PI_RENDERER_SECRET, body);
      const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}/jobs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-resonance-signature': `sha256=${signature}` }, body });
      return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    const proposalRender = url.pathname.match(/^\/api\/songs\/night-transit\/proposals\/(?:%23|#)?([0-9]+)\/render$/);
    if (proposalRender && request.method === 'POST') {
      const proposal = proposals.find((item) => item.id === `#${proposalRender[1]}`);
      if (!proposal || proposal.baseSha !== manifest.baseSha) return json({ error: 'proposal base SHA is not renderable' }, 409);
      if (!env.PI_RENDERER_URL || !env.PI_RENDERER_SECRET) return json({ jobId: `local-${Date.now()}`, proposalId: proposal.id, status: 'ready', baseSha: manifest.baseSha, headSha: proposal.headSha, rendererVersion: manifest.rendererVersion, baseUrl: '/audio/night-transit-base.wav', proposalUrl: '/audio/night-transit-proposal.wav' }, 202);
    }
    const renderStatus = url.pathname.match(/^\/api\/(?:render|renders)\/([^/]+)$/);
    if (renderStatus && request.method === 'GET') return renderJobs.has(renderStatus[1]) ? json(renderJobs.get(renderStatus[1])) : json({ status: 'ready', jobId: renderStatus[1], rendererVersion: manifest.rendererVersion }, 200);
    const jobMatch = url.pathname.match(/^\/api\/render\/([^/]+)$/);
    if (jobMatch && request.method === 'GET') {
      if (!env.PI_RENDERER_URL) return json({ error: 'Pi renderer is not configured' }, 503);
      const upstream = await fetch(`${env.PI_RENDERER_URL.replace(/\/$/, '')}/jobs/${encodeURIComponent(jobMatch[1])}`);
      return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    return json({ error: 'not found' }, 404);
  },
};
