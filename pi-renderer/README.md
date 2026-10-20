# Raspberry Pi renderer

Run `install.sh` on the Pi, then create the named tunnel:

```sh
cloudflared tunnel login
cloudflared tunnel create resonance-renderer
cloudflared tunnel route dns resonance-renderer renderer.example.com
```

Copy `cloudflared-config.yml.example` to `/etc/cloudflared/config.yml`, replace the tunnel UUID and hostname, then create `/etc/resonance/pi-renderer.env`:

```sh
PI_RENDERER_SECRET=the-same-secret-used-by-the-worker
OPENDAW_COMMIT=b9e8190b8b1a9da3fcac2d7ebf4c0fe9a821fe5b
BASE_SHA=af11c3460d2c41c2f20a0f9bb18f98678f5073b2
RENDERER_VERSION=opendaw-pi-0.1.0
RENDERER_READY=false
MAX_JOB_BODY_BYTES=65536
MAX_CONCURRENT_JOBS=1
```

`RENDERER_READY` must remain `false` until the fixed openDAW renderer has been installed and verified on the Pi. The service rejects jobs while it is false instead of leaving them queued indefinitely.

The default one-job concurrency and 64 KiB request limit keep the Pi and tunnel load bounded.

Enable both services only after the config is present:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now resonance-renderer cloudflared
curl http://127.0.0.1:8790/health
```

From the platform repository, create a secret-free transfer bundle with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-pi-renderer.ps1
```

Copy the resulting `dist/resonance-pi-renderer.zip` to the Pi. Secrets stay in `/etc/resonance/pi-renderer.env` and are never included in the bundle.
