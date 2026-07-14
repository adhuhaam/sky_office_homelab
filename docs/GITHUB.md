# GitHub and remotes

This server’s project tree is **one git repository**: `/home/adhuhaam/apps`.

## Current remotes

| Remote | URL | Role |
|--------|-----|------|
| **`origin`** | `git@github.com:adhuhaam/sky_office_homelab.git` | **Canonical** — matches this homelab layout (compose, `leo-os/`, docs, infra) |
| **`sky-office`** | `https://github.com/adhuhaam/sky-office.git` | Extra remote — historically a **different** monorepo layout (`apps/` + `packages/` at repo root). Do **not** assume a normal push of this tree will match that history |

Local `leo-os/` is **not** a separate git repo; it is a folder inside the homelab repo.

## Goal: server and GitHub match

Desired state:

1. One primary GitHub repo that mirrors `/home/adhuhaam/apps` (minus gitignored secrets/data).  
2. Regular `git push origin main` after commits.  
3. Before push when asked: refresh root [README.md](../README.md).

**Today:** local `main` tracks `origin/main` (`sky_office_homelab`). Uncommitted local work may still exist — commit before assuming cloud == disk.

**`sky-office` on GitHub** is a separate project history. Options if you want a single brand name:

| Option | Meaning |
|--------|---------|
| A — Homelab only | Use only `sky_office_homelab`; remove or ignore `sky-office` remote |
| B — Rename / replace | Make [sky-office](https://github.com/adhuhaam/sky-office) contain **this** homelab tree and point `origin` there (overwrites old monorepo history if force-replaced) |

Until that consolidation is done, treat **`origin` / sky_office_homelab** as the backup remote for this server.

## What belongs in Git vs not

### Commit

- Source under `leo-os/`, `leo-os-dotnet/`, `leo-android/`, `leo-sms-gateway/`
- `docs/` (including ANDROID-APPS.md, SMS-GATEWAY.md), README, scripts, `docker-compose.yml`
- nginx **configs** (not private key material if ignored)
- Gradle project files (`*.kts`, wrapper properties)
- `.env.example` files

### Never commit (use Layer 2 archives)

- `api/.env`, `postgresql/.env`
- `infra/certs/*.pem` / `*.key`
- `postgresql/data/`
- Production passwords, API keys
- `*.apk`, `*.aab`, keystores, `local.properties`, `.gradle/`

### Rebuild instead of storing

- `node_modules/` → `pnpm install`
- `react/app/` → `pnpm deploy:web`
- Docker images → `docker compose build`
- Android APKs → build on PC (see [ANDROID-APPS.md](ANDROID-APPS.md))

## Day-to-day backup via Git

```bash
cd /home/adhuhaam/apps
git status
# Update README if user asked before push
git add -A   # review: no .env
git commit -m "…"
git push origin main
```

That backs up **code**. For DB + secrets + Cursor + full disk, see [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md).

## Tag useful freezes

Example already created: `backup/pre-dotnet-20260714`  
Also stored as `…/backups/sky-office-*/git/apps-pre-dotnet.bundle`.
