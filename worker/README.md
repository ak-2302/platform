# Cloudflare Worker deployment

Install the Worker toolchain from this directory:

```sh
npm install
npx wrangler login
npx wrangler secret put PI_RENDERER_SECRET
npx wrangler secret put PI_RENDERER_URL
npm run deploy
```

`PI_RENDERER_URL` must be the Named Tunnel hostname for the Pi renderer. Do not use the temporary `trycloudflare.com` URL in production. The Worker sends a HMAC signature with every render job; the Pi rejects unsigned or incorrectly pinned jobs.
