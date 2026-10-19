# re:sonance — music collaboration platform

This workspace is a browser-first proof of concept for collaborative music projects built around GitHub's branch, pull request, and history model.

## Repository layout

The intended GitHub organization is split into three repositories:

```text
music-collab/
├── platform   # this web experience, API contracts, and renderer boundary
├── opendaw    # pinned openDAW fork with platform integration notes
└── song-demo  # one song per repository; project + manifest + credits
```

The current proof of concept is dependency-free at runtime so it can be opened directly as `index.html`. `src/main.jsx` contains the React implementation used when the Vite toolchain is available; `src/app.js` is the no-build demo entry used for local review in restricted environments.

## Local development

```powershell
npm install
npm run api       # terminal 1: http://127.0.0.1:8787
npm run dev       # terminal 2: Vite app
```

The app uses the API when it is available and falls back to browser-local proposal storage when it is not. Copy `.env.example` to `.env` only for server configuration; GitHub credentials must never be placed in Vite-exposed variables.

## Verification

```powershell
npm run test      # server security tests
npm run build     # production bundle
npm run check     # both
npm audit --omit=dev --audit-level=high
```

The API includes health, manifest, files, commits, proposals, render jobs, and signed GitHub webhook endpoints. See `docs/integration-contract.md` and `docs/github-setup.md` before wiring a GitHub App.

## Proof-of-concept flow

The demo supports the product path visually: browse a song, play the preview, inspect proposals/history/files, and create a proposal that represents a GitHub PR. The actual GitHub App, D1/R2 persistence, and trusted renderer are intentionally represented by the UI boundary and should be wired behind the same actions in the next slice.
