#!/usr/bin/env bash
# One command to put Leo OS live
# Run on the server:  sudo bash /home/adhuhaam/apps/scripts/go-live.sh

set -euo pipefail

APPS_DIR="/home/adhuhaam/apps"
LAN_IP="192.168.18.150"
TS_IP="100.126.222.96"
REAL_USER="${SUDO_USER:-adhuhaam}"

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "==> Stopping CasaOS (free ports 80 and 443)..."
for svc in casaos-gateway casaos-message-bus casaos-user-service \
           casaos-local-storage casaos-app-management rclone casaos; do
  systemctl stop "${svc}.service" 2>/dev/null || true
  systemctl disable "${svc}.service" 2>/dev/null || true
done

echo "==> Generating TLS certificate for LAN (if missing)..."
SSL_DIR="${APPS_DIR}/infra/certs"
install -d -m 0755 "${SSL_DIR}"
if [[ ! -f "${SSL_DIR}/cert.pem" ]]; then
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/key.pem" \
    -out "${SSL_DIR}/cert.pem" \
    -subj "/CN=leo-os/O=LEO Maldives" \
    -addext "subjectAltName=IP:${LAN_IP}"
  chown "${REAL_USER}:${REAL_USER}" "${SSL_DIR}/cert.pem" "${SSL_DIR}/key.pem"
  chmod 0644 "${SSL_DIR}/cert.pem"
  chmod 0600 "${SSL_DIR}/key.pem"
fi

echo "==> Starting Leo OS Docker stack..."
cd "${APPS_DIR}"
sudo -u "${REAL_USER}" docker compose up -d --build --force-recreate leo-proxy react leo-api-dotnet 2>&1

echo "==> Disabling Tailscale Serve (not used — plain HTTP on tailnet IP)..."
if command -v tailscale >/dev/null; then
  tailscale serve reset 2>/dev/null || true
fi

echo ""
echo "============================================"
echo "  Leo OS is live at:"
echo "    https://${LAN_IP}/   (PC on home Wi‑Fi)"
echo "    http://${TS_IP}/     (phone over Tailscale)"
echo ""
echo "  Mobile app API: http://${TS_IP}"
echo "============================================"
echo ""
sleep 3
curl -sk "https://${LAN_IP}/api/health" || true
echo ""
curl -s "http://${TS_IP}/api/health" || true
echo ""
