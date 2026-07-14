# LEO OS — ASP.NET Core API

**Production primary API** (Express retired from the request path). Same Postgres schema (`leoos`).

## Production

Compose service `leo-api-dotnet` · listen `:8080` · nginx `/api/` → `leo-api-dotnet:8080`.

```bash
cd /home/adhuhaam/apps
docker compose build leo-api-dotnet
docker compose up -d --force-recreate leo-api-dotnet react
```

## Local

```bash
bash /home/adhuhaam/apps/scripts/run-dotnet-api.sh
curl -s http://127.0.0.1:5080/api/health
curl -s http://127.0.0.1:5080/api/health/db
```

## Solution layout

| Project | Role |
|---------|------|
| `LeoOs.Api` | Controllers, session + permissions middleware, OCR |
| `LeoOs.Infrastructure` | EF Core entities, scrypt hasher, money, permissions |

## Docs

[Migration / cutover](../docs/MIGRATION-DOTNET.md) · [System map](../docs/SYSTEM-MAP.md) · [Development](../docs/DEVELOPMENT.md)
