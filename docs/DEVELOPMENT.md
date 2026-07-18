# Development

Work on application code inside the pnpm monorepo:

```bash
cd /home/adhuhaam/apps/leo-os
pnpm install
```

Use **pnpm only** (root `preinstall` rejects npm/yarn).

## Packages

| Filter | Dev command |
|--------|-------------|
| `@leo/web` | `pnpm --filter @leo/web run dev` |
| `@leo/mobile` | `pnpm mobile:dev` |
| `@leo/db` | schema reference only — prefer EF entities in `leo-os-dotnet` for live schema |

Root scripts (`leo-os/package.json`):

| Script | Action |
|--------|--------|
| `pnpm build` | Build all packages with a build script |
| `pnpm typecheck` | Typecheck all |
| `pnpm deploy:web` | Production web → `apps/react/app/` |
| `pnpm mobile:dev` | Expo dev (reference) |
| `pnpm mobile:build:android` | Android build script |

## ASP.NET Core API (primary)

Production: compose `leo-api-dotnet`. Local side-by-side on `:5080`:

```bash
bash /home/adhuhaam/apps/scripts/run-dotnet-api.sh
cd /home/adhuhaam/apps/leo-os-dotnet && dotnet build
```

Includes Notification/SMS module (SignalR hub + queue). See [SMS-GATEWAY.md](SMS-GATEWAY.md) · [MIGRATION-DOTNET.md](MIGRATION-DOTNET.md).

## Android (local workstation)

Do **not** expect Gradle builds on the homelab. On your PC:

```bash
git pull origin main   # repo: sky_office_homelab
# Android Studio → open leo-android/ or leo-sms-gateway/
```

Details: [ANDROID-APPS.md](ANDROID-APPS.md). Expo (`pnpm mobile:dev`) is legacy reference only.

## Local web

Vite dev server proxies `/api` to the API in typical setups — confirm `apps/web/vite.config.ts` for the proxy target.

## Local mobile

```bash
EXPO_PUBLIC_API_URL=http://100.126.222.96
pnpm mobile:dev
```

## Schema changes

1. Edit `packages/db/src/schema/*.ts` (source of truth for table shapes)
2. `pnpm --filter @leo/db run push`
3. Mirror new columns in `leo-os-dotnet` EF entities
4. Rebuild: `docker compose build leo-api-dotnet && docker compose up -d --force-recreate leo-api-dotnet`

## Conventions (from AGENTS.md)

- Prefer `apiFetch` + `LoadErrorBanner` on major web list pages
- Reuse `EmploymentField` + `useCompanyLoaOptions`
- Branding: `/system/branding` metadata only; logos separate
- Session `disableTouch: true` on Node
- Salary math: `lib/money.ts`

## Verification

```bash
cd /home/adhuhaam/apps/leo-os && pnpm typecheck
cd /home/adhuhaam/apps/leo-os-dotnet && dotnet build
```

Docs: this `apps/docs/` tree. Agents: [`leo-os/AGENTS.md`](../leo-os/AGENTS.md).