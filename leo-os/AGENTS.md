# AGENTS.md

Guidance for AI assistants and developers working in this repo.

## Layout

- `apps/web` — Vite React admin UI (primary surface for bug fixes)
- `apps/mobile` — Expo app (legacy reference until `leo-android` parity QA); prefer native admin + SMS gateway for new mobile work
- Sibling apps (outside monorepo): `../leo-android` (Compose admin), `../leo-sms-gateway` (SIM SMS gateway)
- `packages/db` — Drizzle schema **reference only** (live ORM is EF Core)
- `packages/api-client-react` — shared React Query client + generated types
- `../leo-os-dotnet/` — **primary ASP.NET Core API** (`leo-api-dotnet`)

Use **pnpm** only (not npm/yarn) in this monorepo. **All API changes go in `leo-os-dotnet/`.** The Express `@leo/api` package has been removed.

## Documentation

Prefer the system docs at [`/home/adhuhaam/apps/docs/`](../docs/) — start with [SYSTEM-MAP.md](../docs/SYSTEM-MAP.md).

Mobile / SMS: [ANDROID-APPS.md](../docs/ANDROID-APPS.md) · [SMS-GATEWAY.md](../docs/SMS-GATEWAY.md) · [NOTIFICATIONS.md](../docs/NOTIFICATIONS.md)

## Deploy (production)

```bash
# Web → /home/adhuhaam/apps/react/app/
cd /home/adhuhaam/apps/leo-os && pnpm deploy:web

# API Docker container (.NET)
cd /home/adhuhaam/apps && docker compose build leo-api-dotnet && docker compose up -d --force-recreate leo-api-dotnet
```

Stack: leo-proxy → react-app → leo-api-dotnet → postgres. LAN: `https://192.168.18.150/`

## Conventions

- API errors: `{ error: string }` with appropriate HTTP status.
- Web data loading: use `apiFetch`; add `LoadErrorBanner` on major list pages.
- Branding: never embed full logo data URLs in `/system/branding` — use `/system/branding/logos`.
- Session store uses `disableTouch: true` — do not revert without cause.
- No debug instrumentation in production code.
- Employment dropdowns: reuse `EmploymentField` + `useCompanyLoaOptions` (shared with upload wizard).
- Emergency contact: `emergencyContactName` + `emergencyContactPhone` on passport; `candidateEmergencyContact` on LOA.
- Job title: stored on `loa_entries.job_title`; joined in passport and salary-record API responses.
- LOA: auto-created on OCR complete; `POST /loa` deduplicates by `passportId`.
- Invoice salary lines: `Salary — {name} ({jobTitle})` via `computeInvoiceLineFromSalary()`.

## Key shared files

| Area | Path |
|------|------|
| OCR | `leo-os-dotnet/LeoOs.Api/Services/OcrService.cs` |
| Xpat | `leo-os-dotnet/LeoOs.Api/Controllers/XpatController.cs` |
| Salary math | `leo-os-dotnet/LeoOs.Infrastructure/Services/Money.cs` |
| Employment UI | `apps/web/src/components/employment-field.tsx` |
| Salary → invoice | `apps/web/src/lib/salary-invoice.ts` |
| Work permit alerts | `apps/web/src/components/work-permit-alerts-card.tsx` |
| PWA | `apps/web/src/components/pwa-provider.tsx` |
| SMS / notifications | `leo-os-dotnet/LeoOs.Infrastructure/Notifications/` |

## Verification

```bash
pnpm typecheck
pnpm --filter @leo/web run build
cd /home/adhuhaam/apps/leo-os-dotnet && dotnet build
```

After web changes: `pnpm deploy:web`. After API changes: rebuild `leo-api-dotnet`.

## Secrets

Never commit `.env` files. Document variable **names** only in README / DEPLOYMENT. Production API env: `/home/adhuhaam/apps/api/.env`.
