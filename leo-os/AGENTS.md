# AGENTS.md

Guidance for AI assistants and developers working in this repo.

## Layout

- `apps/web` — Vite React admin UI (primary surface for bug fixes)
- `apps/api` — Express 5 API; routes in `src/routes/`, middleware in `src/middleware/`
- `apps/mobile` — Expo app; touch when the task is mobile-specific
- `packages/db` — Drizzle schema; run `pnpm --filter @leo/db run push` for schema changes
- `packages/api-client-react` — shared React Query client + generated types

Use **pnpm** only (not npm/yarn).

## Documentation

Read before large changes:

| Doc | When to use |
|-----|-------------|
| [docs/FEATURES.md](docs/FEATURES.md) | What each module does, roles, file paths |
| [docs/WORKFLOWS.md](docs/WORKFLOWS.md) | OCR → LOA, salary → invoice, Xpat alerts |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Tables, FKs, computed fields |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Auth, routes, OCR, packages |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deploy steps |

## Deploy (production)

```bash
# Web → /home/adhuhaam/apps/react/app/
cd /home/adhuhaam/apps/leo-os && pnpm deploy:web

# API Docker container
cd /home/adhuhaam/apps && docker compose build leo-api && docker compose up -d --force-recreate leo-api
```

Stack: leo-proxy → react-app → leo-api → postgres. LAN: `https://192.168.18.150/`

## Conventions

- API errors: `{ error: string }` with appropriate HTTP status.
- FK/unique violations: return friendly 409/400 messages (see `expense-categories.ts`).
- Web data loading: use `apiFetch`; add `LoadErrorBanner` on major list pages.
- Branding: never embed full logo data URLs in `/system/branding` — use `/system/branding/logos`.
- Session store uses `disableTouch: true` — do not revert without cause.
- No debug instrumentation in production code.
- Employment dropdowns: reuse `EmploymentField` + `useCompanyLoaOptions` (shared with upload wizard).
- Emergency contact: `emergencyContactName` + `emergencyContactPhone` on passport; `candidateEmergencyContact` on LOA via `formatEmergencyContact()`.
- Job title: stored on `loa_entries.job_title`; joined in passport and salary-record API responses.
- LOA: auto-created on OCR complete; `POST /loa` deduplicates by `passportId`.
- Invoice salary lines: `Salary — {name} ({jobTitle})` via `computeInvoiceLineFromSalary()`.

## Key shared files

| Area | Path |
|------|------|
| OCR | `apps/api/src/lib/ocr.ts` |
| Xpat | `apps/api/src/lib/xpat.ts` |
| Salary math | `apps/api/src/lib/money.ts` |
| Emergency contact | `apps/api/src/lib/emergency-contact.ts` |
| Employment UI | `apps/web/src/components/employment-field.tsx` |
| Salary → invoice | `apps/web/src/lib/salary-invoice.ts` |
| Work permit alerts | `apps/web/src/components/work-permit-alerts-card.tsx` |
| PWA | `apps/web/src/components/pwa-provider.tsx` |

## Verification

```bash
pnpm typecheck
pnpm --filter @leo/web run build
pnpm --filter @leo/api run typecheck
```

After web changes: `pnpm deploy:web`. After API changes: rebuild `leo-api` container.

## Secrets

Never commit `.env` files. Document variable **names** only in README / DEPLOYMENT.
