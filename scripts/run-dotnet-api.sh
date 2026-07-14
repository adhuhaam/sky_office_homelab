#!/usr/bin/env bash
# Run the ASP.NET Core API against Docker Postgres (homelab), without replacing Node.
# Usage: bash /home/adhuhaam/apps/scripts/run-dotnet-api.sh
set -euo pipefail

export PATH="${HOME}/.dotnet:${HOME}/.dotnet/tools:${PATH:-}"
export DOTNET_ROOT="${HOME}/.dotnet"

APPS="/home/adhuhaam/apps"
ROOT="${APPS}/leo-os-dotnet"
ENV_FILE="${APPS}/api/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

export DATABASE_HOST_OVERRIDE="${DATABASE_HOST_OVERRIDE:-$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' postgres)}"
export PORT="${PORT:-5080}"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
unset ASPNETCORE_URLS || true

echo "Starting LeoOs.Api on :${PORT} → postgres ${DATABASE_HOST_OVERRIDE}"
cd "${ROOT}"
exec dotnet run --project LeoOs.Api --no-launch-profile
