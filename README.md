# re:sonance — music collaboration platform

re:sonance is a browser-first collaborative music platform that applies GitHub's branch, pull request, and history model to music production.

The browser experience is designed around one song first: Night Transit. Users can listen to the latest render, inspect every branch and commit as a visual history graph, open the project in openDAW, and submit an edited project as a proposal.

## Project repositories

```text
music-collab/
├── platform   # this web experience, API contracts, and renderer boundary
├── opendaw    # pinned openDAW fork with platform integration notes
└── song-demo  # one song per repository; project + manifest + credits
```

`platform` is the project-level source for the website, API boundary, deployment configuration, architecture, product requirements, and roadmap. `song-demo` remains the source of truth for the song project and its contribution history. `opendaw` remains the DAW engine repository.

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

## Product requirements and roadmap

The product is intentionally scoped to one song for the MVP. The complete requirements and current gap analysis are in `docs/`:

- `docs/resonance-architecture.md` — system architecture and trust boundaries
- `docs/resonance-component-requirements.md` — role and required function of each system component
- `docs/resonance-app-function-spec.md` — user-facing application behavior
- `docs/resonance-gap-analysis-and-roadmap.md` — current implementation gaps and development plan
- `docs/mvp-status.md` — deployment and acceptance status

### MVP acceptance flow

The MVP is complete when a user can perform the following entirely from the browser:

1. Listen to Night Transit.
2. Sign in with GitHub.
3. Edit the project in openDAW.
4. Create a proposal and its GitHub pull request.
5. Render the base and changed versions with the trusted renderer.
6. Compare both versions using A/B playback.
7. Inspect the pull request, commits, contributor, and material information.

### Development order

1. Fix the supported platform, openDAW commit, browser, and song data.
2. Complete the openDAW project bridge and snapshot flow.
3. Keep GitHub credentials behind the smallest server-side API boundary.
4. Complete proposal branch, commit, and pull request creation.
5. Run trusted rendering and store render metadata and previews.
6. Add A/B playback and render-state feedback.
7. Enforce repository rules, webhook verification, licensing, and asset handling.
8. Run the browser-only MVP acceptance test.

After MVP, prioritize voting and review, adoption rules, MIDI diffs, derivative works, contribution history, credits and badges, and Discord notifications.

## Proof-of-concept flow

The demo supports the product path visually: browse a song, play the preview, inspect proposals/history/files, and create a proposal that represents a GitHub PR. The actual GitHub App, D1/R2 persistence, and trusted renderer are intentionally represented by the UI boundary and should be wired behind the same actions in the next slice.

## Project rules

- Keep song changes and platform changes in separate repositories.
- Treat the project file as the song's source of truth.
- Never commit rendered audio to the song repository.
- Bind every preview to its source commit SHA and renderer version.
- Never expose GitHub App keys, tokens, webhook secrets, or Cloudflare credentials to the browser.
- Keep dynamic hosting and rendering costs minimal; use static hosting for the browser and short-lived jobs for rendering.
- Record material licenses and contributors in the song repository.
