# Low-load deployment topology

The browser serves static assets from GitHub Pages or Cloudflare Pages. Cloudflare Workers handles only lightweight API requests, authentication, proposal metadata, and job dispatch. It does not render audio and it does not keep a long-running server.

The Raspberry Pi runs the pinned openDAW renderer on the Tailscale network. It exposes only `/health`, `/jobs`, and `/jobs/:id` on localhost. Cloudflare Tunnel publishes this localhost service to the Worker through a single hostname; the endpoint remains protected by `PI_RENDERER_SECRET` and is never exposed directly to the browser. When the account does not enable Zero Trust tunnel route management, the existing tunnel can safely expose the renderer at `/resonance-renderer/*` on the already-routed domain instead of creating a new hostname route.

## Why the split

- Workers are unsuitable for native openDAW/audio rendering and long-running child processes.
- The Pi keeps the large project files and renderer cache local, minimizing egress and dynamic-hosting load.
- The Worker forwards small JSON job descriptions and returns status; rendered WAV files should go to R2 or be served from the Pi only through a signed, short-lived URL.
- GitHub App credentials remain in the Worker or a separate private API. They never enter the browser or the Pi renderer.

## Required production settings

On the Pi, install `cloudflared`, create a named tunnel, and copy `pi-renderer/cloudflared-config.yml.example` to `/etc/cloudflared/config.yml`. Run the renderer and `cloudflared` as separate systemd services using the example units. Set `PI_RENDERER_URL` to the tunnel hostname and encrypted `PI_RENDERER_SECRET` in Wrangler. On the Pi set `PI_RENDERER_SECRET`, `OPENDAW_COMMIT`, and `RENDERER_VERSION`. Install the exact openDAW commit named in `song-demo/song.json`; reject every other commit.

The tunnel hostname should have no public application authentication bypass: the Worker supplies the HMAC authentication at the renderer endpoint. Keep the tunnel hostname unlinked from the public site and rotate the HMAC secret if the Pi is reprovisioned.

Deploy the static site separately. Keep the current Node server for local development and tests; it is not required in production once the Worker routes are enabled.
