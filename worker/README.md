# Cloudflare Worker deployment

Install the Worker toolchain from this directory:

```sh
npm install
npx wrangler login
npx wrangler secret put GITHUB_APP_TOKEN
npm run deploy
```

`GITHUB_REPOSITORY` is the public, non-secret repository target. Store a
short-lived GitHub App installation token as `GITHUB_APP_TOKEN` (preferred),
or use `GITHUB_TOKEN` for a server-side fallback, as encrypted Worker secrets;
never put them in `wrangler.toml` or Vite variables.

For automatic installation-token refresh, set `GITHUB_APP_ID` and
`GITHUB_INSTALLATION_ID` as variables or secrets and store the PEM private key
as the encrypted `GITHUB_APP_PRIVATE_KEY` secret instead of using
`GITHUB_APP_TOKEN`.

## Durable proposal storage

The Worker uses an optional D1 binding named `DB`. Without it, proposals are
ephemeral and are only suitable for local smoke tests. Create a D1 database,
apply `migrations/0001_proposals.sql`, and add the binding in the Cloudflare
Worker dashboard before enabling production proposal creation. The frontend
and renderer do not need to access D1 directly.

## GitHub user login

Configure `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_REDIRECT_URI` as
non-secret variables, and register the redirect URI in the GitHub App. Store
`GITHUB_OAUTH_CLIENT_SECRET` and `AUTH_SESSION_SECRET` as encrypted Worker
secrets. The Worker keeps only a signed HttpOnly session cookie and never
returns the GitHub access token to the browser. Start login at
`/api/auth/github`; inspect the session at `/api/auth/me`.
