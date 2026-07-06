#!/usr/bin/env bash
# Stop CasaOS so Leo OS can use port 80.
# Run ONCE on the server (needs your sudo password):
#   sudo bash /home/adhuhaam/apps/scripts/stop-casaos.sh
#
# Then start Leo OS on port 80 (no sudo):
#   cd /home/adhuhaam/apps && docker compose up -d

set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "Stopping and disabling CasaOS services..."
for svc in casaos-gateway casaos-message-bus casaos-user-service \
           casaos-local-storage casaos-app-management rclone casaos; do
  systemctl stop "${svc}.service" 2>/dev/null || true
  systemctl disable "${svc}.service" 2>/dev/null || true
done

echo ""
echo "CasaOS stopped. Port 80 is free."
echo ""
echo "Now run (as your normal user, no sudo):"
echo "  cd /home/adhuhaam/apps && docker compose up -d"
echo ""
echo "Then open: http://192.168.18.150/"
echo "Health:    curl http://192.168.18.150/api/health"
