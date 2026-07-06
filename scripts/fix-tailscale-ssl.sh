#!/usr/bin/env bash
# Restart Leo OS proxy and disable Tailscale Serve
# Run on the server:  sudo bash /home/adhuhaam/apps/scripts/fix-tailscale-ssl.sh

set -euo pipefail

APPS_DIR="/home/adhuhaam/apps"
LAN_IP="192.168.18.150"
TS_IP="100.126.222.96"
REAL_USER="${SUDO_USER:-adhuhaam}"

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "==> Restarting leo-proxy..."
cd "${APPS_DIR}"
sudo -u "${REAL_USER}" docker compose up -d --build --force-recreate leo-proxy leo-api 2>&1

echo "==> Disabling Tailscale Serve..."
if command -v tailscale >/dev/null; then
  tailscale serve reset
  echo "    tailscale serve reset — done"
fi

echo ""
echo "==> Verify:"
curl -sk "https://${LAN_IP}/api/health" || true
echo ""
curl -s "http://${TS_IP}/api/health" || true
echo ""

echo "============================================"
echo "  https://${LAN_IP}/   — PC on home Wi‑Fi"
echo "  http://${TS_IP}/     — phone over Tailscale"
echo "  Mobile API:           http://${TS_IP}"
echo "============================================"
