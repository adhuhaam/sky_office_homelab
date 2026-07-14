# API reference

Base URL in production (via nginx): `/api/*` → `leo-api-dotnet:8080`.

Health (no auth):

```bash
curl -k https://192.168.18.150/api/health
# {"status":"ok"}
```

Also: `GET /api/healthz` · `GET /api/health/db`.

Implementation: `leo-os-dotnet/LeoOs.Api/Controllers/` (Express routers under `leo-os/apps/api` kept for reference).
## Conventions

- Errors: `{ "error": "message" }` with appropriate HTTP status
- Unique/FK conflicts: friendly `400` / `409` where handled (e.g. expense category delete)
- Auth: cookie `leo.sid` (web) or `Authorization: Bearer <sessionId>` (mobile)
- JSON body limit: 8 MB; multipart uploads limited by nginx (20 MB)

## Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sets session cookie |
| POST | `/api/auth/logout` | Ends session |
| GET | `/api/auth/me` | Current user + role + linked entity |
| GET | `/api/auth/mobile-token` | Session id for Bearer use |

See [AUTH.md](AUTH.md).

## Public (no session)

Examples include branding metadata/logos, billing/LOA public print helpers, public profile reads, and selected read proxies. Mounted before `requireAuth` in `app.ts`:

- `systemRouter` (branding public; settings gated inside)
- `billingPublicRouter`, `loaPublicRouter`
- `publicProfileRouter`, `publicReadsRouter`

## Authenticated routers

All below use `requireAuth` + `permissionsMiddleware` unless noted.

| Router file | Prefix / domain | Extra gates |
|-------------|-----------------|-------------|
| `passports.ts` | `/passports`, upload, stats, work-permit-alerts | Role scope |
| `xpat.ts` | `/xpat/work-permit`, `/photo`, `/card` | Authed |
| `companies.ts` | `/companies` | Permissions |
| `clients.ts` | `/clients` | Permissions |
| `expense-categories.ts` | `/expense-categories` | Admin writes typical |
| `expenses.ts` | `/expenses` | Admin writes typical |
| `billing.ts` | Documents & items | Role-scoped |
| `loa.ts` | LOA CRUD + PDF | Role-scoped |
| `loa-options.ts` | Company dropdown options | Authed |
| `salary-records.ts` | Monthly payroll | Admin write; employee can read own |
| `tasks.ts` | Dashboard tasks | Authed |
| `passwords.ts` | Company credentials | **admin / superuser** |
| `admin-users.ts` | User admin | **admin / superuser** |
| `admin-permissions.ts` | Permission matrix | **superuser** |
| `system.ts` / `SystemController` | Branding / settings / **about** | Settings + about: **superuser** |
| `GatewayController` | `/gateway` | Device key **or** admin/superuser |
| `SmsController` | `/sms` | **admin / superuser** |

## Notification / SMS (dotnet)

Full contract: [SMS-GATEWAY.md](SMS-GATEWAY.md).

| Method | Path | Auth |
|--------|------|------|
| POST | `/gateway/register` | Public (creates device + key) |
| POST | `/gateway/heartbeat` | Gateway key |
| POST | `/gateway/result` | Gateway key |
| GET | `/gateway/config` | Gateway key |
| GET/POST/DELETE | `/gateway`, `/gateway/{id}` | admin/superuser |
| POST | `/sms/send`, `/sms/sendbulk` | admin/superuser |
| GET | `/sms/pending`, `/sms/logs`, `/sms/statistics`, `/sms/templates` | admin/superuser |

**SignalR:** `/hubs/sms-gateway?gatewayId=&gatewayKey=` (not under `/api`).

**About System extras:** `GET /system/about` includes `androidClients` (admin metadata + live SMS gateway/queue status).

## Notable passport endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/passports/upload` | Start OCR pipeline |
| GET | `/passports` | Master list (joins LOA job title) |
| GET | `/passports/stats` | Dashboard KPIs |
| GET | `/passports/work-permit-alerts` | Xpat expiry aggregation |
| GET/PATCH | `/passports/:id` | Profile / edits |

## Xpat proxy

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/xpat/work-permit?workPermitNumber=&passportNumber=` | Status |
| GET | `/xpat/photo?...` | Photo binary/proxy |
| GET | `/xpat/card?...` | Card data |

## LOA & billing prints

- `GET /api/loa/:id/pdf` — PDF download
- Public print helpers support web print pages without full SPA shell

## Shared libraries (not routes)

| File | Responsibility |
|------|----------------|
| `lib/ocr.ts` | Vision OCR |
| `lib/xpat.ts` | Xpat HTTP helpers |
| `lib/money.ts` | Payroll / bill math |
| `lib/emergency-contact.ts` | Format/sync LOA emergency string |
| `lib/session.ts` | Cookie session store |
| `lib/bootstrap.ts` | Schema patches, seeds on startup |
| `lib/permissions.ts` | Module permission middleware |

## Client packages

Mobile (and optionally web) consume typed hooks from `@leo/api-client-react` (`packages/api-client-react`).
