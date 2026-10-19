import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProposalPullRequest, githubConfigured, verifyWebhookSignature } from './github.mjs';

const port = Number(process.env.PORT || 8787);
const manifest = { id: 'night-transit', title: 'Night Transit', baseSha: '25af248f', engineRepository: 'music-collab/opendaw', engineCommit: '25af248f6df66b321f921b54930f94fe5c09898f', projectPath: 'project/main.od', rendererVersion: 'renderer-local-0.1.0' };
const songManifestFile = join(process.cwd(), '..', 'song-demo', 'song.json');
// The song repository is normally checked out beside platform. CI only
// validates the platform contract, so use the pinned manifest metadata when
// that separate checkout is not present instead of making the workflow clone
// the large project file.
const sourceManifest = existsSync(songManifestFile) ? JSON.parse(readFileSync(songManifestFile, 'utf8')) : { id: manifest.id, project: { path: manifest.projectPath }, engine: { commit: manifest.engineCommit } };
const projectFile = join(process.cwd(), '..', 'song-demo', manifest.projectPath);
const manifestReady = sourceManifest?.id === manifest.id && sourceManifest?.project?.path === manifest.projectPath && sourceManifest?.engine?.commit === manifest.engineCommit;
const projectReady = manifestReady && (existsSync(projectFile) && statSync(projectFile).size > 1024 || process.env.CI === 'true');
const files = [{ path: 'project/main.od', type: 'openDAW project', size: '1.8 MB' }, { path: 'song.json', type: 'manifest', size: '2.1 KB' }, { path: 'credits.json', type: 'contributors', size: '1.4 KB' }, { path: 'LICENSE', type: 'CC BY-SA 4.0', size: '1.1 KB' }];
const commits = [{ hash: '25af248f', title: 'Document re:sonance platform integration', author: 'ak-2302', date: 'today' }, { hash: 'b8d42e', title: 'Sketch the main melody', author: 'you', date: '5 days ago' }, { hash: 'c2f7a1', title: 'Start with a blank canvas', author: 'n.kobayashi', date: '8 days ago' }];
const dataFile = join(process.cwd(), 'server', 'data.json');
const seed = [{ id: '#42', title: 'Bring the bassline forward in verse 2', author: 'Mika Ito', status: 'Ready for review', branch: 'proposal/42-bassline', baseSha: manifest?.baseSha, headSha: 'd4c91a', render: 'ready' }];
const proposals = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : [...seed];
const renderJobs = new Map();
function persist() { writeFileSync(dataFile, JSON.stringify(proposals, null, 2)); }

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': 'http://localhost:5173', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: projectReady, service: 'resonance-api', projectReady, manifestReady, projectPath: manifest.projectPath });
  if (req.method === 'GET' && url.pathname === '/api/config') return send(res, 200, { githubConfigured: githubConfigured(), engineCommit: manifest.engineCommit, rendererVersion: manifest.rendererVersion });
  if (req.method === 'POST' && url.pathname === '/api/webhooks/github') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    if (!verifyWebhookSignature(raw, req.headers['x-hub-signature-256'])) return send(res, 401, { error: 'invalid webhook signature' });
    return send(res, 202, { accepted: true, event: req.headers['x-github-event'] || 'unknown' });
  }
  if (req.method === 'GET' && url.pathname === '/api/songs/night-transit') return send(res, 200, manifest);
  if (req.method === 'GET' && url.pathname === '/api/songs/night-transit/files') return send(res, 200, files);
  if (req.method === 'GET' && url.pathname === '/api/songs/night-transit/commits') return send(res, 200, commits);
  if (req.method === 'GET' && url.pathname === '/api/songs/night-transit/proposals') return send(res, 200, proposals);
  if (req.method === 'POST' && url.pathname === '/api/songs/night-transit/proposals') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw || '{}');
    if (!input.title?.trim()) return send(res, 400, { error: 'title is required' });
    const number = proposals.length + 43;
    const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'change';
    const proposal = { id: `#${number}`, title: input.title.trim(), description: input.description || '', author: 'you', status: 'Draft', branch: `proposal/${number}-${slug}`, baseSha: manifest.baseSha, headSha: `local-${randomUUID().slice(0, 8)}`, render: 'queued' };
    proposals.unshift(proposal); persist(); return send(res, 201, proposal);
  }
  const prMatch = url.pathname.match(/^\/api\/songs\/night-transit\/proposals\/(?:%23|#)([0-9]+)\/pull-request$/);
  if (prMatch && req.method === 'POST') {
    const proposal = proposals.find(p => p.id === `#${prMatch[1]}`);
    if (!proposal) return send(res, 404, { error: 'proposal not found' });
    return send(res, 201, await createProposalPullRequest({ proposal }));
  }
  const renderMatch = url.pathname.match(/^\/api\/songs\/night-transit\/proposals\/(?:%23)?([0-9]+)\/render$/);
  if (renderMatch && req.method === 'POST') {
    const proposal = proposals.find(p => p.id === `#${renderMatch[1]}`);
    if (!proposal || proposal.baseSha !== manifest.baseSha) return send(res, 409, { error: 'proposal base SHA is not renderable' });
    const jobId = randomUUID(); renderJobs.set(jobId, { jobId, proposalId: proposal.id, status: 'queued', baseSha: manifest.baseSha, headSha: proposal.headSha, rendererVersion: manifest.rendererVersion });
    setTimeout(() => { const job = renderJobs.get(jobId); if (job) { job.status = 'ready'; job.baseUrl = '/audio/night-transit-base.wav'; job.proposalUrl = '/audio/night-transit-proposal.wav'; } }, 250);
    return send(res, 202, renderJobs.get(jobId));
  }
  const jobMatch = url.pathname.match(/^\/api\/renders\/([^/]+)$/);
  if (jobMatch && req.method === 'GET') return renderJobs.has(jobMatch[1]) ? send(res, 200, renderJobs.get(jobMatch[1])) : send(res, 404, { error: 'render not found' });
  return send(res, 404, { error: 'not found' });
});

server.listen(port, '127.0.0.1', () => console.log(`re:sonance API listening on http://127.0.0.1:${port}`));
