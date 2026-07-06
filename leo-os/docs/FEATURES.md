# Features

LEO OS is an internal operations platform for employment agencies. This document describes every major module, what it does, who can access it, and where the code lives.

## Roles

| Role | Typical user | Scope |
|------|--------------|-------|
| `superuser` | Platform owner | Full access; settings, permissions, users |
| `admin` | Office staff | CRUD on most modules |
| `company` | Recruiting company | Own company, employees, LOA, upload |
| `client` | Resort / employer client | Master list (scoped), billing view |
| `agent` | Field agent | Master list (scoped) |
| `employee` | Worker | Own passport profile, salary |

Role checks live in `apps/api/src/middleware/` and web `RoleRoute` in `apps/web/src/components/protected-route.tsx`.

---

## Dashboard (`/`)

**Web:** `apps/web/src/pages/dashboard.tsx`

- Personalized greeting and role badge
- **KPI tiles** (role-gated): candidates, processing count, outstanding billing, companies, expenses
- **Work permit alerts** — expired and expiring-within-3-months permits from live Xpat lookups (`WorkPermitAlertsCard`)
- **Charts** — monthly expense and invoicing bar charts (last 12 months, one bar per record)
- **Tasks panel** — compact sidebar with add, filter, complete, subtasks, edit

**API:** `GET /api/passports/stats`, `GET /api/passports/work-permit-alerts`, `GET /api/expenses`, `GET /api/billing/documents`, `GET /api/tasks`

---

## Passport OCR & Upload (`/upload`)

**Web:** `apps/web/src/pages/upload.tsx`  
**Mobile:** `apps/mobile/app/(tabs)/upload.tsx`  
**API:** `POST /api/passports/upload`, `GET /api/passports/:id`  
**OCR:** `apps/api/src/lib/ocr.ts`

### Wizard (web — 4 steps)

1. **Upload & Extract** — JPEG, PNG, WEBP, or PDF; async OCR via vision model
2. **Select Company** — assign recruiting company
3. **Employment Details** — job title, work type, work site (company LOA options), salary fields, emergency contact, signatory
4. **Complete** — saves passport, auto-creates LOA

### Extracted fields

| Field | DB column | Notes |
|-------|-----------|-------|
| Full name | `full_name` | MRZ + vision |
| Passport number | `passport_number` | MRZ checksum validated |
| DOB, issue, expiry | `date_of_*` | |
| Address | `address` | |
| Nationality | `nationality` | Normalized (bangladesh, india, …) |
| Emergency contact name | `emergency_contact_name` | Optional; if not on passport, skip |
| Emergency contact phone | `emergency_contact_phone` | Optional |

OCR model defaults to `gpt-4o-mini` (configurable in Settings or env). Upgrade to `gpt-4o` for better accuracy on printed text / MRZ.

### Employment fields

Uses shared `EmploymentField` + `useCompanyLoaOptions` (`apps/web/src/components/employment-field.tsx`, `apps/web/src/hooks/use-company-loa-options.ts`) — same dropdown UX as master list edit.

---

## Master List (`/master-list`, `/passports`)

**Web:** `apps/web/src/pages/master-list.tsx`  
**Mobile:** `apps/mobile/app/(tabs)/master.tsx`  
**API:** `GET /api/passports`, `PATCH /api/passports/:id`

- Searchable table of all employees (passport records)
- Xpat photo thumbnail when WP + passport numbers are set
- Shows passport number, WP number, **job title** (from LOA join)
- Company → client allocation path
- Work permit status badge and expiry from Xpat
- Edit dialog: passport data, company, client, employment fields, salaries, emergency contact
- Links to employee profile (`/employees/:id`)

---

## Employee Profile (`/employees/:id`)

**Web:** `apps/web/src/pages/employee-profile.tsx`  
**Mobile:** `apps/mobile/app/passport/[id].tsx`

- Full passport + employment details
- Xpat work permit panel (photo, card, status, employer)
- LOA summary with **View** button
- Read-only emergency contact fields

---

## Companies (`/companies`)

**Web:** `apps/web/src/pages/companies.tsx`  
**Mobile:** `apps/mobile/app/companies/`  
**API:** `GET/POST/PATCH/DELETE /api/companies`

- Company CRUD with branding (logo, signatory, bank details)
- **Company detail dialog** — tabs: Info & Branding, Job Titles, Work Types, Work Sites, LOA options
- LOA options stored in `loa_options` table; used by upload wizard and employee edit dropdowns
- **Auto-created password record** on company create (blank Efaas + Gmail credentials)

---

## Clients (`/clients`)

**Web:** `apps/web/src/pages/clients.tsx`  
**API:** `GET/POST/PATCH/DELETE /api/clients`

- Employer clients (resorts, etc.) that employees are allocated to

---

## Letters of Appointment — LOA (`/loa`)

**Web:** `apps/web/src/pages/loa.tsx`, `loa-print.tsx`  
**Mobile:** `apps/mobile/app/loa/`  
**API:** `apps/api/src/routes/loa.ts`

### Auto-generation

LOA is created automatically when completing the passport OCR upload wizard (web and mobile). `POST /api/loa` returns existing LOA if one already exists for the same `passportId` (no duplicates).

### UI

- List shows all LOAs with **View** button (opens `/loa/:id/print` for view/print)
- Manual **Generate LOA** remains for legacy employees without one
- Print page includes **Emergency Contact Details (name and contact number)** from `candidate_emergency_contact`

### Emergency contact sync

When passport `emergencyContactName` / `emergencyContactPhone` are updated, linked LOA `candidateEmergencyContact` is updated via `formatEmergencyContact()` (`apps/api/src/lib/emergency-contact.ts`).

---

## Billing (`/billing`)

**Web:** `apps/web/src/pages/billing.tsx`, `billing-form.tsx`, `billing-view.tsx`, `billing-print.tsx`  
**Mobile:** `apps/mobile/app/(tabs)/billing.tsx`, `billing/`  
**API:** `apps/api/src/routes/billing.ts`

- Invoices and quotations with line items, GST, letterhead
- Status workflow: draft → sent → payment_received → completed / voided
- Import confirmed salary records as invoice lines
- Line description format: `Salary — {name} ({jobTitle})` when job title exists
- Employee cost and profit computed from linked salary records

---

## Salary (`/salary`)

**Web:** `apps/web/src/pages/salary.tsx`  
**Mobile:** `apps/mobile/app/(tabs)/salary.tsx`  
**API:** `apps/api/src/routes/salary-records.ts`

- Monthly salary records per employee
- Workflow: draft → confirmed → invoiced
- Net salary = `basicSalary × daysWorked` + flat allowances − deductions + other expenses
- Client bill total = `clientSalary × daysWorked`
- Salary API joins LOA for `jobTitle` (used in invoice import labels)

Shared math: `apps/api/src/lib/money.ts`, mirrored in `apps/web/src/lib/salary-invoice.ts` and `apps/mobile/lib/salary-invoice.ts`.

---

## Expenses (`/expenses`)

**Web:** `apps/web/src/pages/expenses.tsx`  
**Mobile:** `apps/mobile/app/(tabs)/expenses.tsx`, `expense/`  
**API:** `apps/api/src/routes/expenses.ts`, `expense-categories.ts`

- Categorized expense tracking with colored cards
- Voucher print at `/expenses/:id/print`
- Dashboard chart aggregates by month

---

## Passwords (`/passwords`)

**Web:** `apps/web/src/pages/passwords.tsx`  
**Mobile:** `apps/mobile/app/passwords.tsx`  
**API:** `apps/api/src/routes/passwords.ts`

- One password record per company (unique `company_id`)
- Fields: Efaas username/password, Gmail username/password
- Auto-created blank when company is created

---

## Tasks

**Web:** dashboard compact panel  
**API:** `apps/api/src/routes/tasks.ts`

- Personal task list with priorities, due dates, subtasks
- Filters: all, today, upcoming, done

---

## Work Permit Alerts (dashboard)

**Web:** `apps/web/src/components/work-permit-alerts-card.tsx`  
**API:** `GET /api/passports/work-permit-alerts`

- Fetches role-scoped passports with WP + passport numbers
- Live Xpat lookup per record (6 concurrent, 15-minute cache)
- Tabs: **Expired** / **Expiring soon** (within 3 months)
- Each row: photo, name, **employer name** (from Xpat), WP number, expiry date
- Links to `/employees/:id`

**Xpat proxy:** `apps/api/src/routes/xpat.ts`, `apps/api/src/lib/xpat.ts`  
- `GET /api/xpat/work-permit?workPermitNumber=&passportNumber=`
- `GET /api/xpat/photo?photoId=&serviceId=`
- `GET /api/xpat/card?...`

---

## Users & Permissions

**Web:** `users.tsx`, `permissions.tsx`  
**API:** `admin-users.ts`, `admin-permissions.ts`, `auth.ts`

- User CRUD with role assignment and linked entity (company/client/passport)
- Permission matrix per role per module
- Session auth via `leo.sid` cookie; mobile token via `GET /api/auth/mobile-token`

---

## Settings (`/settings`)

**Web:** `apps/web/src/pages/settings.tsx`  
**API:** `apps/api/src/routes/system.ts`

- Superuser only: app name, accent color, company branding, OCR API key/model/base URL
- Branding split: lightweight `GET /system/branding` + separate `GET /system/branding/logos`

---

## PWA (web)

**Config:** `apps/web/vite.config.ts` (`vite-plugin-pwa`)  
**Provider:** `apps/web/src/components/pwa-provider.tsx`

- Installable progressive web app
- Icons in `apps/web/public/`
- Service worker with update prompt
- nginx cache headers for SW in `apps/react/nginx/default.conf`

---

## Mobile app

**Framework:** Expo Router (`apps/mobile/app/`)

| Tab / area | Purpose |
|------------|---------|
| Home | Dashboard stats |
| Upload | Passport OCR + company + auto LOA |
| Master | Employee list |
| Billing | Invoices |
| Salary | Salary records |
| Expenses | Expense tracking |
| More | Companies, clients, LOA, passwords, admin |

Uses `@leo/api-client-react` for typed API hooks. LOA view/print opens web print URL in browser.

---

## Print / public routes

These work without full app shell auth where noted:

| Route | Purpose |
|-------|---------|
| `/loa/:id/print` | LOA print view |
| `/billing/:id/print` | Invoice/quote print |
| `/expenses/:id/print` | Expense voucher |
| `/u/:userId` | Public user profile |

API PDF: `GET /api/loa/:id/pdf`
