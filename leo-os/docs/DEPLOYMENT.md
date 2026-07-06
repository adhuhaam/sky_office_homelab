# Deployment

Production files live under `/home/adhuhaam/apps/`. The leo-os monorepo is the source; built artifacts are copied or containerized from here.

**Production URL (LAN):** `https://192.168.18.150/`

## Prerequisites

- pnpm installed on the host
- Docker Compose stack in `/home/adhuhaam/apps/docker-compose.yml`
- `homelab` Docker network (external)
- API env file at `/home/adhuhaam/apps/api/.env`

## 1. Database

Postgres runs as the `postgres` service in docker-compose. Database name: `leoos`. Schema is applied on API startup via `bootstrap()` and can be pushed manually during development:

```bash
cd /home/adhuhaam/apps/leo-os
# Set DATABASE_URL to your Postgres instance
pnpm --filter @leo/db run push
```

For a fresh production database, starting `leo-api` once runs bootstrap (superuser seed, default permissions, expense categories, column migrations).

## 2. Deploy API

```bash
cd /home/adhuhaam/apps
docker compose build leo-api
docker compose up -d --force-recreate leo-api
```

Verify:

```bash
docker logs leo-api --tail 50
# Should show: LEO API listening on :8080
```

The API Dockerfile builds from `leo-os/apps/api` and bundles `@leo/db`.

## 3. Deploy web

Build and copy static assets to the nginx volume:

```bash
cd /home/adhuhaam/apps/leo-os
pnpm deploy:web
```

This runs `pnpm --filter @leo/web run build` (includes PWA asset generation) and rsyncs `apps/web/dist/` to `/home/adhuhaam/apps/react/app/`.

The `react-app` container serves that directory. No container restart is required for static file updates unless nginx caches aggressively (current config serves from disk).

**PWA:** Service worker and icons are regenerated on each build. Users may need to refresh or reinstall for SW updates.

## 4. Deploy mobile

Mobile is not containerized. After code changes:

```bash
cd /home/adhuhaam/apps/leo-os
pnpm mobile:dev   # Expo dev server
```

For production builds, use EAS or `expo build` per your mobile release process. Mobile talks to the same API URL as web.

## 5. Proxy / TLS

`leo-proxy` terminates HTTPS and forwards to `react-app` and `leo-api`. Config: `/home/adhuhaam/apps/infra/nginx/leo-os-docker.conf`.

Restart proxy only when nginx config or certs change:

```bash
cd /home/adhuhaam/apps
docker compose up -d --force-recreate leo-proxy
```

## 6. Full stack restart

```bash
cd /home/adhuhaam/apps
docker compose up -d
```

## Rollback

- **Web:** redeploy a previous `dist/` from git or backup into `react/app/`
- **API:** `docker compose build leo-api` from a previous git revision, then recreate the container

## Checklist after deploy

1. `docker logs leo-api` shows API listening
2. Login works; session cookie is set
3. `GET /api/system/branding` is small (metadata only, no embedded logos)
4. Key pages load: dashboard, companies, master list, expenses, billing
5. Dashboard: work permit alerts, charts, tasks panel
6. Upload/OCR flow completes and auto-creates LOA
7. Master list shows job titles next to passport/WP numbers
8. Invoice salary import shows job title in line description
9. PWA install prompt works (optional)

## Environment variables

API (`/home/adhuhaam/apps/api/.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Express session signing |
| `SUPERUSER_EMAIL` | Bootstrap admin email |
| `SUPERUSER_PASSWORD` | Bootstrap admin password |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `CORS_ORIGIN` | Allowed origins |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `LOG_LEVEL` | pino log level |
| `OPENAI_API_KEY` | OCR vision API (or set in Settings UI) |
| `OPENAI_OCR_BASE_URL` | Default `https://api.openai.com/v1` |
| `OPENAI_OCR_MODEL` | Default `gpt-4o-mini` |

Never commit `.env` files.

## Docker services

| Service | Image | Role |
|---------|-------|------|
| `leo-proxy` | nginx | TLS termination |
| `react-app` | nginx | Static web (PWA) |
| `leo-api` | apps-leo-api | Express API |
| `postgres` | postgres:17 | Database |
