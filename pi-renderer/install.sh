#!/usr/bin/env bash
set -euo pipefail

# Run on Raspberry Pi OS as a user with sudo access.
APP_DIR=/opt/resonance/pi-renderer
sudo apt-get update
sudo apt-get install -y curl ca-certificates nodejs npm
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
sudo apt-get update
sudo apt-get install -y cloudflared
sudo useradd --system --home /var/lib/resonance-renderer --shell /usr/sbin/nologin resonance 2>/dev/null || true
sudo install -d -o resonance -g resonance "$APP_DIR" /var/lib/resonance-renderer /etc/resonance
sudo install -m 0644 server.mjs "$APP_DIR/server.mjs"
sudo install -m 0644 resonance-renderer.service.example /etc/systemd/system/resonance-renderer.service
sudo install -m 0644 cloudflared.service.example /etc/systemd/system/cloudflared.service
echo "Install complete. Put renderer env in /etc/resonance/pi-renderer.env and tunnel config in /etc/cloudflared/config.yml before enabling services."
