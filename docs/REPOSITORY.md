# Repository layout

Homelab root: `/home/adhuhaam/apps` (this git repository).

Application source monorepo: `/home/adhuhaam/apps/leo-os`.

## Top-level (`apps/`)

```
apps/
├── README.md                 # Project splash
├── memory_of_project.md      # Homelab operational memory (URLs, history)
├── server_and_mobileapp.md   # Short URL / access card
├── docker-compose.yml        # Production stack (canonical)
├── docs/                     # System documentation (you are here)
├── api/
│   ├── .env                  # Production API secrets (do not commit)
│   ├── .env.example          # Template
│   └── docker-compose.yml    # Legacy / unused fragment
├── postgresql/
│   ├── .env                  # Postgres credentials
│   ├── data/                 # Persist volume (Docker)
│   └── docker-compose.yml    # Legacy fragment
├── react/
│   ├── app/                  # Built web static files (deploy:web output)
│   ├── nginx/default.conf    # Internal SPA + /api proxy
│   └── docker-compose.yml    # Legacy fragment
├── infra/
│   ├── nginx/
│   │   ├── leo-os-docker.conf  # Active public proxy (leo-proxy)
│   │   └── leo-os.conf         # Legacy host nginx (inactive)
│   ├── certs/                # Self-signed TLS for LAN IP
│   └── ssl/                  # Alternate cert path (if present)
├── scripts/
│   ├── go-live.sh            # Primary bring-up
│   ├── fix-tailscale-ssl.sh  # Proxy / Tailscale repair
│   ├── stop-casaos.sh        # Free ports 80/443
│   ├── setup-host.sh         # Legacy host setup (superseded)
│   └── run-dotnet-api.sh     # Local ASP.NET API (:5080)
├── leo-os/                   # pnpm monorepo (web + Expo reference + legacy Express)
├── leo-os-dotnet/            # Primary ASP.NET Core API (+ SMS/Notification)
├── leo-android/              # Native admin Compose app
└── leo-sms-gateway/          # Android SIM SMS gateway
```

See also [ANDROID-APPS.md](ANDROID-APPS.md) and [SMS-GATEWAY.md](SMS-GATEWAY.md).

## Monorepo (`leo-os/`)

```
leo-os/
├── package.json              # Root scripts: build, typecheck, deploy:web, mobile:*
├── pnpm-workspace.yaml       # packages/*, apps/*
├── AGENTS.md                 # Contributor / AI conventions
├── README.md                 # App-oriented readme
├── docs/                     # Older app-focused docs (prefer apps/docs)
├── apps/
│   ├── api/                  # @leo/api — Express (legacy / rollback)
│   ├── web/                  # @leo/web — Vite React PWA
│   └── mobile/               # @leo/mobile — Expo
└── packages/
    ├── db/                   # @leo/db — Drizzle schema + pool
    └── api-client-react/     # Shared React Query client
```

## Primary API (`leo-os-dotnet/`)

```
leo-os-dotnet/
├── Dockerfile
├── LeoOs.sln
├── LeoOs.Api/                # Controllers, session + permissions, OCR
├── LeoOs.Infrastructure/     # EF Core, scrypt, money, permissions
└── README.md
```

## What gets deployed where

| Change in… | Deploy action |
|------------|---------------|
| `leo-os/apps/web` | `pnpm deploy:web` → rsync to `apps/react/app/` |
| `leo-os-dotnet/` | `docker compose build leo-api-dotnet && up -d --force-recreate leo-api-dotnet` |
| `packages/db` schema | push schema + update EF entities + recreate `leo-api-dotnet` |
| nginx / certs | recreate `leo-proxy` |
| mobile | Expo/EAS rebuild with correct `EXPO_PUBLIC_API_URL` |

## Related documentation outside this folder

| File | Role |
|------|------|
| [`leo-os/AGENTS.md`](../leo-os/AGENTS.md) | Coding conventions for assistants |
| [`leo-os/docs/*`](../leo-os/docs/) | Earlier module docs (prefer `apps/docs`) |
| [`memory_of_project.md`](../memory_of_project.md) | Homelab decisions, Tailscale SSL history |
| [GITHUB.md](GITHUB.md) · [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md) | Git remotes & DR |
