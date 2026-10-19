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
OPENDAW_COMMIT=25af248f6df66b321f921b54930f94fe5c09898f
RENDERER_VERSION=opendaw-pi-0.1.0
```

Enable both services only after the config is present:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now resonance-renderer cloudflared
curl http://127.0.0.1:8790/health
```
