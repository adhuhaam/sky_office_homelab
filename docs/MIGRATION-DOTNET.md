# Migration: Express → ASP.NET Core

## Status: complete — Express source removed (2026-07-18)

ASP.NET Core is the **only** API. The Express package `leo-os/apps/api` (`@leo/api`) and its Docker fragment have been **deleted** from the tree. Restore from git history if ever needed (`backup/pre-dotnet-20260714` or pre-removal commits).

| Phase | Status |
|-------|--------|
| 0 Backup | Done — [BACKUP-AND-RESTORE.md](BACKUP-AND-RESTORE.md) |
| 1–4 Cutover | Done — `leo-api-dotnet` + nginx `/api/` |
| 5 Remove Express source | Done — `leo-os/apps/api` deleted |

## Production stack

```
react-app nginx  →  leo-api-dotnet:8080  →  postgres (leoos)
```

Compose service: `leo-api-dotnet` (build context `leo-os-dotnet/`).  
Env: `/home/adhuhaam/apps/api/.env` (`DATABASE_URL` host `postgres`, `PORT=8080`, `SESSION_SECRET`, OCR keys).

## Local

```bash
bash /home/adhuhaam/apps/scripts/run-dotnet-api.sh
# http://127.0.0.1:5080/api/health
```

## Location

```
apps/leo-os-dotnet/
  Dockerfile
  LeoOs.sln
  LeoOs.Api/                 # Controllers, session + permissions, OCR, SignalR hub
  LeoOs.Infrastructure/      # EF Core, scrypt, money, permissions, Notifications
```

## Rollback

Express is no longer in the working tree. To restore:

1. `git checkout <commit-before-removal> -- leo-os/apps/api`
2. Re-add a `leo-api` compose service pointing at that Dockerfile
3. Point nginx `proxy_pass` to `http://leo-api:8080` and stop `leo-api-dotnet`

Prefer fixing `.NET` instead of rolling back.

## GitHub

Canonical: `origin` → [sky_office_homelab](https://github.com/adhuhaam/sky_office_homelab). See [GITHUB.md](GITHUB.md).
