# Cloudflare Worker deployment

Install the Worker toolchain from this directory:

```sh
npm install
npx wrangler login
npx wrangler secret put PI_RENDERER_SECRET
npx wrangler secret put PI_RENDERER_URL
npx wrangler secret put GITHUB_APP_TOKEN
npm run deploy
```

`PI_RENDERER_URL` must be the Named Tunnel hostname for the Pi renderer. Do not use the temporary `trycloudflare.com` URL in production. The Worker sends a HMAC signature with every render job; the Pi rejects unsigned or incorrectly pinned jobs.

`GITHUB_REPOSITORY` is the public, non-secret repository target. Store a
short-lived GitHub App installation token as `GITHUB_APP_TOKEN` (preferred),
or use `GITHUB_TOKEN` for a server-side fallback, as encrypted Worker secrets;
never put them in `wrangler.toml` or Vite variables.

## Durable proposal storage

The Worker uses an optional D1 binding named `DB`. Without it, proposals are
ephemeral and are only suitable for local smoke tests. Create a D1 database,
apply `migrations/0001_proposals.sql`, and add the binding in the Cloudflare
Worker dashboard before enabling production proposal creation. The frontend
and renderer do not need to access D1 directly.
