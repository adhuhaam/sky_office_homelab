#!/usr/bin/env bash
# Leo OS host setup — run once with sudo on the server:
#   sudo bash /home/adhuhaam/apps/scripts/setup-host.sh
#
# What this does:
#   1. Stops CasaOS (frees port 80)
#   2. Installs nginx + ensures openssl is present
#   3. Creates a self-signed TLS cert for LAN + Tailscale IPs
#   4. Configures nginx → https://192.168.18.150/ → Docker :3000
#   5. Enables Tailscale HTTPS serve on the tailnet (port 443)
#   6. Removes unused Nextcloud Docker image (if present)

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

APPS_DIR="/home/adhuhaam/apps"
LAN_IP="192.168.18.150"
TS_IP="100.126.222.96"

echo "==> Stopping CasaOS services (free port 80)..."
for svc in casaos-gateway casaos-message-bus casaos-user-service \
           casaos-local-storage casaos-app-management rclone casaos; do
  systemctl stop "${svc}.service" 2>/dev/null || true
  systemctl disable "${svc}.service" 2>/dev/null || true
done

echo "==> Installing nginx and openssl..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx openssl

echo "==> Generating self-signed certificate..."
install -d -m 0750 /etc/ssl/leo-os
if [[ ! -f /etc/ssl/leo-os/cert.pem ]]; then
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout /etc/ssl/leo-os/key.pem \
    -out /etc/ssl/leo-os/cert.pem \
    -subj "/CN=leo-os/O=LEO Maldives" \
    -addext "subjectAltName=IP:${LAN_IP},IP:${TS_IP},DNS:server"
  chmod 0640 /etc/ssl/leo-os/key.pem
  chmod 0644 /etc/ssl/leo-os/cert.pem
else
  echo "    Certificate already exists — skipping"
fi

echo "==> Installing nginx site config..."
install -m 0644 "${APPS_DIR}/infra/nginx/leo-os.conf" /etc/nginx/sites-available/leo-os
ln -sf /etc/nginx/sites-available/leo-os /etc/nginx/sites-enabled/leo-os
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Configuring Tailscale HTTPS serve (tailnet only)..."
if command -v tailscale >/dev/null; then
  tailscale serve reset 2>/dev/null || true
  tailscale serve --bg --https=443 "http://127.0.0.1:3000"
  echo "    Tailscale HTTPS: https://${TS_IP}/"
else
  echo "    tailscale not found — skip serve setup"
fi

echo "==> Removing unused Nextcloud Docker image (if any)..."
if command -v docker >/dev/null; then
  docker image rm nextcloud:latest 2>/dev/null || true
  docker image rm mariadb:11 redis:7-alpine 2>/dev/null || true
fi

echo ""
echo "Done."
echo "  Web (LAN):       https://${LAN_IP}/"
echo "  Web (Tailscale): https://${TS_IP}/"
echo "  Health:          curl -k https://${LAN_IP}/api/health"
echo ""
echo "Optional — full CasaOS removal (interactive):"
echo "  sudo casaos-uninstall"
echo ""
echo "Restart Leo OS stack after docker-compose changes:"
echo "  cd ${APPS_DIR} && docker compose up -d --build"
