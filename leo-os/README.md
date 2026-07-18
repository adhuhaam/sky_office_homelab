# LEO OS monorepo (web + mobile)

Application packages under `/home/adhuhaam/apps/leo-os`.

| Package | Name | Role |
|---------|------|------|
| `apps/web` | `@leo/web` | React 19 PWA (primary UI) |
| `apps/mobile` | `@leo/mobile` | Expo (legacy reference until `leo-android` parity) |
| `packages/db` | `@leo/db` | Drizzle schema **reference** (live ORM is EF Core in `leo-os-dotnet`) |
| `packages/api-client-react` | `@leo/api-client-react` | Shared React Query hooks / types |

**API:** production is [`leo-os-dotnet`](../leo-os-dotnet/) (`leo-api-dotnet`). The Express `@leo/api` package has been **removed**.

## Commands

```bash
cd /home/adhuhaam/apps/leo-os
pnpm install

# Web
pnpm --filter @leo/web run dev
pnpm deploy:web   # → /home/adhuhaam/apps/react/app/

# Mobile (Expo reference)
pnpm mobile:dev
```

## Production API

```bash
cd /home/adhuhaam/apps
docker compose build leo-api-dotnet
docker compose up -d --force-recreate leo-api-dotnet
```

Stack: **leo-proxy** → **react-app** → **leo-api-dotnet** → **postgres**.

Docs: [`../docs/SYSTEM-MAP.md`](../docs/SYSTEM-MAP.md)
