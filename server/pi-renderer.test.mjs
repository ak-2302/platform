import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const port = 18879;
const base = `http://127.0.0.1:${port}`;
const secret = 'pi-renderer-test-secret';
const engineCommit = 'b9e8190b8b1a9da3fcac2d7ebf4c0fe5b';
const baseSha = 'af11c3460d2c41c2f20a0f9bb18f98678f5073b2';
let child;

function signature(body) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

before(async () => {
  child = spawn(process.execPath, ['pi-renderer/server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PI_RENDERER_SECRET: secret, OPENDAW_COMMIT: engineCommit, BASE_SHA: baseSha, RENDERER_READY: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Pi renderer did not start')), 5000);
    child.stdout.on('data', (data) => { if (String(data).includes('listening')) { clearTimeout(timeout); resolve(); } });
    child.on('error', reject);
  });
});

after(() => child?.kill());

test('Pi renderer enforces HMAC and pinned SHAs', async () => {
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.rendererReady, true);
  assert.equal(health.maxConcurrentJobs, 1);
  assert.equal(health.activeJobs, 0);
  const payload = JSON.stringify({ engineCommit, baseSha, headSha: randomBytes(20).toString('hex') });
  assert.equal((await fetch(`${base}/jobs`, { method: 'POST', body: payload })).status, 401);
  assert.equal((await fetch(`${base}/jobs`, { method: 'POST', body: payload, headers: { 'x-resonance-signature': signature('tampered') } })).status, 401);
  assert.equal((await fetch(`${base}/jobs`, { method: 'POST', body: JSON.stringify({ ...JSON.parse(payload), engineCommit: 'wrong' }), headers: { 'x-resonance-signature': signature(JSON.stringify({ ...JSON.parse(payload), engineCommit: 'wrong' })) } })).status, 409);
  const accepted = await fetch(`${base}/jobs`, { method: 'POST', body: payload, headers: { 'x-resonance-signature': signature(payload) } });
  assert.equal(accepted.status, 202);
  const job = await accepted.json();
  const queued = await fetch(`${base}/jobs`, { method: 'POST', body: payload, headers: { 'x-resonance-signature': signature(payload) } });
  assert.equal(queued.status, 429);
  assert.equal((await fetch(`${base}/jobs/${job.jobId}`)).status, 401);
  const status = await fetch(`${base}/jobs/${job.jobId}`, { headers: { 'x-resonance-signature': signature('') } });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, 'queued');
});
