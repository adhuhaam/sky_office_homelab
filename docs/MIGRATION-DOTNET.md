# Migration: Express → ASP.NET Core

## Status: cut over (2026-07-14)

ASP.NET Core is the **primary API**. Express `leo-api` is retired from the request path (Dockerfile retained for rollback).

| Phase | Status |
|-------|--------|
| 0 Backup | Done — [BACKUP-AND-RESTORE.md](BACKUP-AND-RESTORE.md) |
| 1 Docs | Done |
| 2 Scaffold + health | Done — `leo-os-dotnet/` |
| 3 Auth parity | Done |
| 3+ Domain ports | Done — companies, clients, passports/OCR, LOA, billing, salary, expenses, tasks, admin, system, Xpat, public |
| 4 Compose cutover | Done — `leo-api-dotnet` + nginx `/api/` |

## Production stack

```
react-app nginx  →  leo-api-dotnet:8080  →  postgres (leoos)
```

Compose service: `leo-api-dotnet` (build context `leo-os-dotnet/`).  
Env: same `api/.env` (`DATABASE_URL` host `postgres`, `PORT=8080`, `SESSION_SECRET`, OCR keys).

## Local / side-by-side

```bash
bash /home/adhuhaam/apps/scripts/run-dotnet-api.sh
# http://127.0.0.1:5080/api/health
```

## Location

```
apps/leo-os-dotnet/
  Dockerfile
  LeoOs.sln
  LeoOs.Api/                 # Controllers, session + permissions middleware, OCR
  LeoOs.Infrastructure/      # EF Core entities, scrypt, money, permissions
```

## Rollback to Express

1. Point `react/nginx/default.conf` `proxy_pass` back to `http://leo-api:8080`.
2. Restore `leo-api` service in `docker-compose.yml` (build `leo-os` / `apps/api/Dockerfile`).
3. `docker compose up -d --build --force-recreate leo-api react` and stop `leo-api-dotnet`.

Backup tag: `backup/pre-dotnet-20260714`.

## GitHub

Canonical: `origin` → [sky_office_homelab](https://github.com/adhuhaam/sky_office_homelab). See [GITHUB.md](GITHUB.md).
