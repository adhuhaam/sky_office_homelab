#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

get_tailscale_ip() {
  ip -4 -o addr show tailscale0 2>/dev/null | awk '{print $4}' | cut -d/ -f1
}

detect_host() {
  if [[ -n "${EXPO_DEV_HOST:-}" ]]; then
    echo "$EXPO_DEV_HOST"
    return
  fi

  local ts_ip
  ts_ip="$(get_tailscale_ip)"
  if [[ -n "$ts_ip" ]]; then
    echo "$ts_ip"
    return
  fi

  local ip
  for ip in $(hostname -I); do
    if [[ "$ip" =~ ^192\.168\. ]]; then
      echo "$ip"
      return
    fi
  done
  for ip in $(hostname -I); do
    if [[ "$ip" =~ ^10\. ]]; then
      echo "$ip"
      return
    fi
  done

  hostname -I | awk '{print $1}'
}

detect_web_url() {
  local host="$1"

  if [[ -n "${EXPO_PUBLIC_WEB_URL:-}" ]]; then
    echo "${EXPO_PUBLIC_WEB_URL%/}"
    return
  fi

  # Vite dev server — only when running locally (not exposed on Tailscale).
  if curl -fsS --connect-timeout 1 "http://127.0.0.1:5173/" >/dev/null 2>&1; then
    echo "http://${host}:5173"
    return
  fi

  # Production nginx on port 80 (Tailscale + LAN proxy).
  echo "http://${host}"
}

HOST="$(detect_host)"
WEB_URL="$(detect_web_url "$HOST")"

export EXPO_PUBLIC_API_URL="http://${HOST}"
export EXPO_PUBLIC_WEB_URL="${WEB_URL}"
export REACT_NATIVE_PACKAGER_HOSTNAME="$HOST"
export EXPO_NO_TELEMETRY=1
export EXPO_NO_METRO_WORKSPACE_ROOT=1

CLEAR_FLAG=()
if [[ "${1:-}" == "--clear" ]]; then
  CLEAR_FLAG=(--clear)
fi

echo "Expo dev host: ${HOST}"
echo "API URL: ${EXPO_PUBLIC_API_URL}"
echo "Web URL: ${EXPO_PUBLIC_WEB_URL}"
echo "Expo Go URL: exp://${HOST}:8081"

exec npx expo start --lan --port 8081 "${CLEAR_FLAG[@]}"
