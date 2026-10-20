# Low-load deployment topology

The browser serves static assets from GitHub Pages. A small Cloudflare Worker handles only lightweight API requests, authentication, proposal metadata, and job dispatch. It does not render audio and it does not keep a long-running server.

The default MVP renderer runs as a dedicated, manually dispatched GitHub Actions workflow on the song repository. It checks out only the requested proposal SHA, validates the pinned engine commit, and runs the fixed renderer; arbitrary PR workflows and dependencies are never executed.

## Why the split

- Workers are unsuitable for native openDAW/audio rendering and long-running child processes.
- GitHub Actions handles the CPU-heavy preview job while keeping the Worker lightweight.
- The Worker forwards small JSON job descriptions and returns status; rendered WAV files should go to R2 or another signed object store.
- GitHub App credentials remain in the Worker and never enter the browser or Actions job inputs.

## Required production settings

The active production setting is `GITHUB_ACTIONS_RENDERING=true` with workflow `trusted-render.yml`. The GitHub App installation needs Actions workflow-dispatch permission. R2 storage or an equivalent signed object store is required before completed WAVs can be served to the browser; the workflow retains its intermediate artifact for only three days.

Deploy the static site through the repository's GitHub Pages workflow. Keep the current Node server for local development and tests; it is not required in production once the Worker routes are enabled.
