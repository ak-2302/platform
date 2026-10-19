import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/raspberrypi/deploy/ak-2302/scripts/static-server.mjs';
let source = readFileSync(path, 'utf8');
source = source.replace(
  "if (req.headers.host?.split(':')[0] === 'renderer.xn--o1qu10go4ftz0a.xn--n8jl2g.xn--q9jyb4c') {",
  "const rendererHost = req.headers.host?.split(':')[0] === 'renderer.xn--o1qu10go4ftz0a.xn--n8jl2g.xn--q9jyb4c';\n  const rendererPath = req.url.startsWith('/resonance-renderer') ? req.url.slice('/resonance-renderer'.length) || '/' : req.url;\n  if (rendererHost || req.url.startsWith('/resonance-renderer')) {",
);
source = source.replace("'http://127.0.0.1:8790' + req.url", "'http://127.0.0.1:8790' + rendererPath");
writeFileSync(path, source);
