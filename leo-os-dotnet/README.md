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
| `LeoOs.Api` | Controllers, session + permissions middleware, OCR, **SmsGatewayHub** |
| `LeoOs.Infrastructure` | EF Core entities, scrypt hasher, money, permissions, **Notifications** (queue, templates, dispatch worker, SQL bootstrap) |

### Notification / SMS slice

- Embedded SQL: `LeoOs.Infrastructure/Sql/001_sms_notifications.sql`
- Hub: `/hubs/sms-gateway`
- REST: `/api/gateway/*`, `/api/sms/*`
- Docs: [SMS-GATEWAY.md](../docs/SMS-GATEWAY.md)

Nginx must proxy `/hubs/` with WebSocket upgrade (react + leo-proxy).

## Docs

[Migration / cutover](../docs/MIGRATION-DOTNET.md) · [System map](../docs/SYSTEM-MAP.md) · [SMS gateway](../docs/SMS-GATEWAY.md) · [Android apps](../docs/ANDROID-APPS.md) · [Development](../docs/DEVELOPMENT.md)
