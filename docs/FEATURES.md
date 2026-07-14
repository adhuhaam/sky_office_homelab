# Features

LEO OS modules: what they do, who can use them, and where the code lives.

## Roles

| Role | Typical user | Scope |
|------|--------------|-------|
| `superuser` | Platform owner | Full access; settings, permission matrix, users |
| `admin` | Office staff | CRUD on most operational modules |
| `company` | Recruiting company user | Own company, employees, LOA, upload |
| `client` | Resort / employer | Scoped master list / billing view |
| `agent` | Field agent | Scoped master list |
| `employee` | Worker | Own passport profile and salary |

Checks: API `middleware/require-auth.ts` + `lib/permissions.js`; web `protected-route.tsx`.

---

## Dashboard (`/`)

**Web:** `apps/web/src/pages/dashboard.tsx`

- Greeting + role badge
- KPI tiles (role-gated): candidates, processing, outstanding billing, companies, expenses
- Work permit alerts (expired / expiring ≤ 3 months) via live Xpat
- Expense & invoicing charts (Recharts, last 12 months)
- Compact tasks panel (add, filter, complete, subtasks)

**API:** passport stats & alerts, expenses, billing documents, tasks

---

## Passport OCR & upload (`/upload`)

**Web / mobile / API:** `pages/upload.tsx`, mobile `(tabs)/upload`, `POST /api/passports/upload`  
**OCR:** `apps/api/src/lib/ocr.ts`

### Wizard (web — 4 steps)

1. Upload & extract (JPEG, PNG, WEBP, PDF)
2. Select recruiting company
3. Employment details (LOA options, salaries, emergency contact, signatory)
4. Complete → saves passport + auto-creates LOA

Extracted fields include name, passport number (MRZ-validated), DOB/issue/expiry, address, nationality, optional emergency contact.

---

## Master list (`/master-list`)

Searchable employee table: passport #, WP #, **job title** (from LOA join), company → client allocation, Xpat photo/status badges. Edit dialog updates passport + employment fields.

---

## Employee profile (`/employees/:id`)

Full passport + employment, Xpat panel (photo, card, status, employer), LOA summary with view/print, emergency contact (read-only on profile).

---

## Companies (`/companies`)

CRUD with branding, signatory, bank details. Detail dialog tabs for Job Titles / Work Types / Work Sites (`loa_options`). Creating a company auto-creates a blank **passwords** row.

---

## Clients (`/clients`)

Employer clients (resorts, etc.) employees are allocated to.

---

## Letters of Appointment — LOA (`/loa`)

- Auto-created when OCR upload completes (`POST /api/loa` dedupes by `passportId`)
- List → **View** opens print page; PDF via `GET /api/loa/:id/pdf`
- Emergency contact sync: passport name/phone → LOA `candidate_emergency_contact` via `formatEmergencyContact()`
- Manual **Generate LOA** for legacy employees without one

---

## Billing (`/billing`)

Invoices & quotations with line items, GST, letterhead. Status: `draft` → `sent` → `payment_received` → `completed` / `voided`. Import confirmed salary records; line label `Salary — {name} ({jobTitle})`. Profit from linked salary costs.

---

## Salary (`/salary`)

Monthly records per employee. Workflow: draft → confirmed → invoiced. Net and client bill computed server-side (`money.ts`). API joins LOA for `jobTitle` used on invoice import.

---

## Expenses (`/expenses`)

Categorized expenses with colored UI pills, MVR totals, voucher print. Categories protected from delete when expenses attached (409).

---

## Passwords (`/passwords`)

Admin/superuser. One record per company: Efaas + Gmail credentials. Blank row auto-created with company.

---

## Tasks

Dashboard panel. Priorities, due dates, parent/subtask tree. Filters: all, today, upcoming, done.

---

## Work permit alerts

`WorkPermitAlertsCard` → `GET /api/passports/work-permit-alerts`. Requires WP + passport numbers. Shows employer from Xpat (not internal company name).

---

## Users & permissions

**Users** (`/users`): CRUD, role, linked entity (company/client/passport), phone, designation.  
**Permissions** (`/permissions`): superuser matrix per role per module.

---

## Settings (`/settings`)

Superuser: app name, accent color, branding logos (≤ 1 MB), OCR API key / model / base URL. Branding metadata vs logos split into separate endpoints (keep branding payload small).

---

## About System (`/about-system`)

Superuser live page (auto-refresh ~5s): health, host metrics, structure tree, stack, access URLs, plus:

- **Android admin** status (`leo-android` packaging / shipping)
- **SMS gateway** live device + queue status

API: `GET /api/system/about`.

---

## SMS Gateways (`/sms-gateways`)

Superuser ops UI: gateway list, queue statistics, recent logs, test send. See [SMS-GATEWAY.md](SMS-GATEWAY.md).

---

## PWA

Installable web app (`vite-plugin-pwa`). SW / workbox / manifest served with no-cache from react-app nginx.

---

## Mobile — Leo Admin (native)

Kotlin Compose app at `leo-android/` (`com.leo.admin`). Replaces Expo for field use.

| Area | Purpose |
|------|---------|
| Home | Dashboard stats / tasks |
| Upload | OCR multipart |
| Master | Employee list + detail |
| Billing / Salary / Expenses | Finance lists |
| More | LOA, companies, clients, passwords, admin users, profile (API base URL) |

Parity checklist: `leo-android/PARITY-QA.md`. Full build notes: [ANDROID-APPS.md](ANDROID-APPS.md).

Expo (`leo-os/apps/mobile`) = legacy reference only.

---

## SMS Gateway (Android)

Separate app `leo-sms-gateway/` (`com.leo.smsgateway`) — SIM relay, not the admin UI. See [SMS-GATEWAY.md](SMS-GATEWAY.md) · [ANDROID-APPS.md](ANDROID-APPS.md).

---

## Print / public UI routes

| Route | Purpose |
|-------|---------|
| `/loa/:id/print` | LOA print |
| `/billing/:id/print` | Invoice/quote print |
| `/expenses/:id/print` | Expense voucher |
| `/u/:userId` | Public user profile |

See [WORKFLOWS.md](WORKFLOWS.md) for step-by-step flows and [API.md](API.md) for endpoints.
