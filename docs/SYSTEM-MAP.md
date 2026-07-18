# Sky Office documentation map

Single-page orientation. Deep dives are linked below.

## Product

**Sky Office / LEO OS** — operations platform for Leo Employment Services (Maldives): passport OCR → LOA → Xpat work permits → salary → client billing.

## Surfaces

| Surface | Location | Status |
|---------|----------|--------|
| Web PWA | `leo-os/apps/web` → `react/app/` | Live |
| Mobile (native admin) | `leo-android/` | Building (Expo replacement) |
| SMS gateway | `leo-sms-gateway/` | Building |
| Mobile (Expo) | `leo-os/apps/mobile` | Legacy reference until native parity QA |
| API | `leo-os-dotnet/` → `leo-api-dotnet` | Live (+ Notification / SMS module) |
| Database | Postgres 17 · `leoos` | Live |

## Runtime

| Container | Role |
|-----------|------|
| `leo-proxy` | LAN HTTPS + Tailscale HTTP |
| `react-app` | Static SPA + `/api` → .NET |
| `leo-api-dotnet` | ASP.NET Core `:8080` |
| `postgres` | Data |

Access: LAN `https://192.168.18.150/` · Tailscale `http://100.126.222.96/`

## Auth

Cookie `leo.sid` or Bearer session id · table `session` · scrypt passwords (`salt:hex`).

Roles: `superuser` · `admin` · `company` · `client` · `agent` · `employee`

## Bring-up

```bash
sudo bash /home/adhuhaam/apps/scripts/go-live.sh
cd /home/adhuhaam/apps/leo-os && pnpm deploy:web   # after web changes
cd /home/adhuhaam/apps && docker compose build leo-api-dotnet && docker compose up -d --force-recreate leo-api-dotnet react leo-proxy
```

Android APKs: build on PC after `git pull` — [ANDROID-APPS.md](ANDROID-APPS.md).

## Where to read next

| Need | Doc |
|------|-----|
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Features | [FEATURES.md](FEATURES.md) |
| Workflows | [WORKFLOWS.md](WORKFLOWS.md) |
| Schema | [DATA-MODEL.md](DATA-MODEL.md) |
| REST | [API.md](API.md) |
| Android apps | [ANDROID-APPS.md](ANDROID-APPS.md) |
| SMS gateway | [SMS-GATEWAY.md](SMS-GATEWAY.md) |
| Notifications (agents) | [NOTIFICATIONS.md](NOTIFICATIONS.md) |
| Ops | [OPERATIONS.md](OPERATIONS.md) |
| GitHub | [GITHUB.md](GITHUB.md) |
| Backup / DR | [BACKUP-AND-RESTORE.md](BACKUP-AND-RESTORE.md) · [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md) |
| .NET rewrite | [MIGRATION-DOTNET.md](MIGRATION-DOTNET.md) |
| Agents | [../leo-os/AGENTS.md](../leo-os/AGENTS.md) |
