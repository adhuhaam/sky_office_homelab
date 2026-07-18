# Sky Office documentation

Canonical docs for the self-hosted system at `/home/adhuhaam/apps`.

**Start here:** [SYSTEM-MAP.md](SYSTEM-MAP.md)  
**Public splash:** [../README.md](../README.md) (refresh before push when asked)

---

## Index

### Product & architecture

| Doc | Contents |
|-----|----------|
| [SYSTEM-MAP.md](SYSTEM-MAP.md) | One-page orientation |
| [OVERVIEW.md](OVERVIEW.md) | Purpose, surfaces, domain |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Request flow, Docker, packages |
| [REPOSITORY.md](REPOSITORY.md) | Folder layout |
| [FEATURES.md](FEATURES.md) | Modules & roles |
| [WORKFLOWS.md](WORKFLOWS.md) | OCR → LOA, salary → invoice, … |

### Data & API

| Doc | Contents |
|-----|----------|
| [DATA-MODEL.md](DATA-MODEL.md) | Postgres tables |
| [API.md](API.md) | REST map (Node, primary) |
| [AUTH.md](AUTH.md) | Sessions, RBAC |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Env vars |
| [SMS-GATEWAY.md](SMS-GATEWAY.md) | Android SIM SMS relay · SignalR · queue |
| [ANDROID-APPS.md](ANDROID-APPS.md) | Sky Office (`leo-android`) local build |
| [NOTIFICATIONS.md](NOTIFICATIONS.md) | Agent notes for the Notification slice |

### Run & operate

| Doc | Contents |
|-----|----------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build & ship |
| [OPERATIONS.md](OPERATIONS.md) | URLs, scripts, Tailscale |
| [DEVELOPMENT.md](DEVELOPMENT.md) | pnpm + .NET local dev |

### Backup, Git, rewrite

| Doc | Contents |
|-----|----------|
| [GITHUB.md](GITHUB.md) | Remotes; server ↔ GitHub |
| [BACKUP-AND-RESTORE.md](BACKUP-AND-RESTORE.md) | 2026-07-14 freeze & restore |
| [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md) | 3-layer DR (Git / archives / system+Cursor) |
| [MIGRATION-DOTNET.md](MIGRATION-DOTNET.md) | Express → ASP.NET Core |

---

## Quick access

| Device | URL |
|--------|-----|
| PC (LAN) | `https://192.168.18.150/` |
| Phone (Tailscale) | `http://100.126.222.96/` |
| Mobile API | `http://100.126.222.96` |

```bash
sudo bash /home/adhuhaam/apps/scripts/go-live.sh
# Production API + web:
cd /home/adhuhaam/apps && docker compose up -d
cd /home/adhuhaam/apps/leo-os && pnpm deploy:web
# Android: build on PC — docs/ANDROID-APPS.md
```

Older notes under `leo-os/docs/` are superseded by this folder for system truth.
