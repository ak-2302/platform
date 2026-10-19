import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const path = '/home/raspberrypi/deploy/ak-2302/scripts/static-server.mjs';
const source = readFileSync(path, 'utf8');
const marker = 'createServer((req, res) => {';
const replacement = `createServer(async (req, res) => {
  if (req.headers.host?.split(':')[0] === 'renderer.xn--o1qu10go4ftz0a.xn--n8jl2g.xn--q9jyb4c') {
    const upstream = await fetch('http://127.0.0.1:8790' + req.url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
    });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    res.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }`;

if (!source.includes(marker)) throw new Error('static server source changed');
copyFileSync(path, `${path}.bak-resonance`);
writeFileSync(path, source.replace(marker, replacement));
