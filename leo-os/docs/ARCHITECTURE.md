# Architecture

## Request flow

1. Browser hits **leo-proxy** (HTTPS).
2. Static assets (`/`, `/assets/*`) go to **react-app** (nginx).
3. `/api/*` is proxied to **leo-api** (Express on port 8080).
4. API uses **express-session** with **connect-pg-simple** store in Postgres (`disableTouch: true` to avoid session row lock storms).

## Authentication

- **Register / login** — `POST /api/auth/register`, `POST /api/auth/login` set session `leo.sid`.
- **Session check** — `GET /api/auth/me` returns user role and linked entity.
- **Logout** — `POST /api/auth/logout`.
- **Mobile token** — `GET /api/auth/mobile-token` for Expo app.
- **Roles** — `superuser`, `admin`, `company`, `client`, `agent`, `employee`.
- **Middleware** — `requireAuth` + `permissionsMiddleware` on most routes; `requireRole(...)` on admin-only modules.
- **401 recovery (web)** — `apiFetch` retries once after `AuthProvider.refresh()` on non-auth 401s.

Public (no session): `/api/health`, `/api/system/branding`, `/api/system/branding/logos`, billing/LOA print endpoints, public profile reads, Xpat photo proxy.

## API route layout

Routes live in `apps/api/src/routes/` and mount under `/api` in `app.ts`:

| Router | Prefix examples | Auth |
|--------|-----------------|------|
| `auth` | `/auth/*` | Mixed |
| `system` | `/system/branding`, `/system/settings` | Branding public; settings superuser |
| `passports` | `/passports`, `/passports/stats`, `/passports/work-permit-alerts`, upload | Authed + role scope |
| `xpat` | `/xpat/work-permit`, `/xpat/photo`, `/xpat/card` | Authed |
| `companies`, `clients` | CRUD | Authed + permissions |
| `expense-categories`, `expenses` | CRUD | Admin/superuser for writes |
| `billing` | Documents & items | Role-scoped |
| `loa`, `loa-options` | LOA CRUD, PDF | Role-scoped |
| `salary-records` | Monthly payroll | Admin/superuser; employee read own |
| `tasks` | Dashboard tasks | Authed |
| `passwords` | Per-company credentials | Admin/superuser |
| `admin-users`, `admin-permissions` | User admin | Admin/superuser |

## OCR pipeline

`apps/api/src/lib/ocr.ts`:

1. Preprocess image (`sharp` resize, PDF → PNG).
2. Vision model extracts JSON + MRZ lines.
3. MRZ checksum validation via `mrz` package.
4. Merge MRZ-trusted fields with vision fields.
5. Optional: `emergency_contact_name`, `emergency_contact_phone`.
6. Update `passports` row; on failure delete draft record.

Config: env `OPENAI_API_KEY` / `OPENAI_OCR_MODEL` or Settings table.

## Xpat integration

`apps/api/src/lib/xpat.ts` — shared fetch helpers used by:

- Employee profile Xpat panel
- Master list WP status badges
- `GET /passports/work-permit-alerts` (server-side aggregation, 6 concurrent, 15-min cache)

## Shared packages

### `@leo/db`

- Drizzle schema and `getPool()` for Postgres.
- Built to `dist/`; consumed by API at build time.
- Dev schema push: `pnpm --filter @leo/db run push`.

### `@leo/api-client-react`

- TanStack Query hooks for mobile (and available to web).
- Types in `src/generated/api.schemas.ts`.

## Web app

- **Vite + React 19**, **wouter** routing, **TanStack Query** on some pages.
- **PWA** — `vite-plugin-pwa`, install prompt, service worker (`pwa-provider.tsx`).
- **Branding** — lightweight `/system/branding` for theme metadata; logos from `/system/branding/logos`.
- **Charts** — Recharts via shadcn `ChartContainer` (`components/ui/chart.tsx`).
- **Shared components** — `EmploymentField`, `WorkPermitAlertsCard`, `LoadErrorBanner`, `CompanyDetailDialog`.
- **Module pages** — fetch via `apiFetch`; role gates in `App.tsx` and `protected-route.tsx`.

## Mobile app

- **Expo Router** under `apps/mobile/app/`.
- Same API base URL; uses `@leo/api-client-react` hooks.
- LOA/billing print opens web print URLs in browser.
- Reload Expo after mobile code changes (`pnpm mobile:dev`).

## Salary & billing math

Single source of truth: `apps/api/src/lib/money.ts`.

- `netSalary = basicSalary × daysWorked + allowances − deductions + otherExpenses`
- `clientBillTotal = clientSalary × daysWorked`
- Invoice lines: `apps/web/src/lib/salary-invoice.ts` (mirrored in mobile)

## Related docs

- [FEATURES.md](FEATURES.md) — module-by-module reference
- [WORKFLOWS.md](WORKFLOWS.md) — OCR, LOA, salary, billing flows
- [DATA-MODEL.md](DATA-MODEL.md) — database tables and relationships
