import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8790);
const secret = process.env.PI_RENDERER_SECRET;
const jobs = new Map();

function validSignature(body, header) {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const a = Buffer.from(expected); const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, value) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, service: 'resonance-pi-renderer', rendererVersion: process.env.RENDERER_VERSION || 'opendaw-pi-0.1.0' });
  if (req.method === 'POST' && req.url === '/jobs') {
    let body = ''; for await (const chunk of req) body += chunk;
    if (!validSignature(body, req.headers['x-resonance-signature'])) return send(res, 401, { error: 'invalid signature' });
    let input; try { input = JSON.parse(body); } catch { return send(res, 400, { error: 'invalid JSON' }); }
    if (input.engineCommit !== process.env.OPENDAW_COMMIT) return send(res, 409, { error: 'engine commit is not pinned on renderer' });
    if (process.env.BASE_SHA && input.baseSha !== process.env.BASE_SHA) return send(res, 409, { error: 'base SHA is not pinned on renderer' });
    if (typeof input.headSha !== 'string' || !/^[0-9a-f]{7,64}$/i.test(input.headSha)) return send(res, 400, { error: 'head SHA is required' });
    const jobId = randomUUID(); jobs.set(jobId, { jobId, status: 'queued', rendererVersion: process.env.RENDERER_VERSION || 'opendaw-pi-0.1.0' });
    // The actual fixed openDAW CLI invocation is intentionally isolated here.
    // It must read only the verified base/head SHAs and never execute repository code.
    return send(res, 202, jobs.get(jobId));
  }
  const match = req.url?.match(/^\/jobs\/([^/]+)$/);
  if (req.method === 'GET' && match) return jobs.has(match[1]) ? send(res, 200, jobs.get(match[1])) : send(res, 404, { error: 'job not found' });
  return send(res, 404, { error: 'not found' });
});

server.listen(port, '127.0.0.1', () => console.log(`Pi renderer listening on http://127.0.0.1:${port}`));
