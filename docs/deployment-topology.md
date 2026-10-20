# Low-load deployment topology

The browser serves static assets from GitHub Pages or Cloudflare Pages. Cloudflare Workers handles only lightweight API requests, authentication, proposal metadata, and job dispatch. It does not render audio and it does not keep a long-running server.

The default MVP renderer runs as a dedicated, manually dispatched GitHub Actions workflow on the song repository. It checks out only the requested proposal SHA, validates the pinned engine commit, and runs the fixed renderer; arbitrary PR workflows and dependencies are never executed. The Raspberry Pi renderer remains an optional fallback for local/offline rendering and is not required for production preview jobs.

## Why the split

- Workers are unsuitable for native openDAW/audio rendering and long-running child processes.
- GitHub Actions removes CPU load from the Raspberry Pi while keeping the Worker lightweight.
- The Worker forwards small JSON job descriptions and returns status; rendered WAV files should go to R2 or be served from the Pi only through a signed, short-lived URL.
- GitHub App credentials remain in the Worker or a separate private API. They never enter the browser or the Pi renderer.

## Required production settings

The active production setting is `GITHUB_ACTIONS_RENDERING=true` with workflow `trusted-render.yml`. The GitHub App installation needs Actions workflow-dispatch permission. R2 storage or an equivalent signed object store is required before completed WAVs can be served to the browser; the workflow retains its intermediate artifact for only three days.

The tunnel hostname should have no public application authentication bypass: the Worker supplies the HMAC authentication at the renderer endpoint. Keep the tunnel hostname unlinked from the public site and rotate the HMAC secret if the Pi is reprovisioned.

Deploy the static site separately. Keep the current Node server for local development and tests; it is not required in production once the Worker routes are enabled.
