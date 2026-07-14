# Environment variables

Never commit real secrets. Templates live in `apps/api/.env.example`. Production values: `apps/api/.env` and `apps/postgresql/.env`.

## API (`apps/api/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres URL (e.g. `postgresql://…@postgres:5432/leoos`) |
| `SESSION_SECRET` | Signs session cookies (**required**) |
| `SUPERUSER_EMAIL` | Bootstrap superuser email |
| `SUPERUSER_PASSWORD` | Bootstrap superuser password |
| `NODE_ENV` | `production` in Docker |
| `PORT` | `8080` |
| `CORS_ORIGIN` | Comma-separated origins (LAN HTTPS + Tailscale HTTP) |
| `COOKIE_SECURE` | `true` → cookie `secure: "auto"` |
| `LOG_LEVEL` | pino level (`info`, …) |

### OCR (OpenAI-compatible vision)

OCR accepts either OpenAI-named or DeepSeek-named env vars (`lib/ocr.ts`). Settings UI can override.

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | API key |
| `OPENAI_OCR_BASE_URL` / `DEEPSEEK_OCR_BASE_URL` | Base URL (no trailing slash preferred; code strips) |
| `OPENAI_OCR_MODEL` / `DEEPSEEK_OCR_MODEL` | Model id (default fallback `gpt-4o-mini` if unset) |

Example from `.env.example` (DeepSeek-compatible endpoint):

```env
DEEPSEEK_API_KEY=
DEEPSEEK_OCR_BASE_URL=https://api.deepseek.com
DEEPSEEK_OCR_MODEL=deepseek-v4-flash
```

Official text-only DeepSeek endpoints will not work for images — use a vision-capable OpenAI-compatible endpoint (or self-hosted vision OCR).

## Postgres (`apps/postgresql/.env`)

Credentials for the `postgres` container (`POSTGRES_USER` / password). Must align with `DATABASE_URL` used by the API.

Compose also sets `POSTGRES_DB` / `POSTGRES_USER` in `docker-compose.yml` — ensure they match how `DATABASE_URL` is written.

## Mobile

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | API origin without path, e.g. `http://100.126.222.96` |

Baked in at Metro/EAS build time — rebuild after changes.

## CORS example (production)

```env
CORS_ORIGIN=https://192.168.18.150,http://100.126.222.96
COOKIE_SECURE=true
```

## Compose wiring

`docker-compose.yml`:

- `leo-api-dotnet` → `env_file: ./api/.env`
- `postgres` → `env_file: ./postgresql/.env`

No secrets belong in the compose file itself.
