# Salary views (master sheet & individual payslips)

Web salary documents for admins: a **monthly master salary sheet** and **per-employee payslips**, styled like invoice/LOA views with optional print-to-PDF.

## Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/salary/sheet?month={1-12}&year={YYYY}` | `salary-sheet-view.tsx` | Master roster for all salary records in the selected month |
| `/salary/{recordId}/payslip?month={m}&year={y}` | `salary-payslip-page.tsx` | Individual employee payslip |

Both routes are registered in `App.tsx` outside `AppLayout` (standalone document views). Access is enforced by the salary-records API (`GET /api/salary-records`).

## Entry points (Salaries admin page)

| UI location | Action |
|-------------|--------|
| Page header (top right) | **View salary sheet** → master sheet for current month/year filters |
| Row **View** button | Individual payslip for that employee (replaces previous link to billing invoice) |

Invoiced records still expose **View invoice** on the payslip toolbar when `invoiceId` is set. The row **Invoice** button (when status is confirmed) is unchanged.

## Master salary sheet

**File:** `apps/web/src/pages/salary-sheet-view.tsx`

Displays:

- **Employer company letterhead** (from the employee's recruiting company in Master List / Companies — not platform logo)
- Grouped **by company** when employees belong to different employers
- Title: **Employee Salary Sheet — {Month} {Year}**
- Table per company section (sorted by employee name):

  - #, Employee name, Passport no., Designation, Days worked, Daily rate, Net salary
  - Per-row link to individual payslip (hidden when printing)
  - Section total; grand total when multiple companies

- Company signatory signature block (printed copies)
- Toolbar: Back to Salaries, Print / Save as PDF

## Individual payslip

**Files:**

- `apps/web/src/pages/salary-payslip-page.tsx` — loads record by id from monthly list
- `apps/web/src/components/salary-payslip-view.tsx` — shared letterhead, standard payslip layout, toolbar

Standard payslip format:

- Full-width **company letterhead** image (or company name/address fallback)
- **SALARY PAYSLIP** title bar
- Two-column meta: pay period, employee details | payslip no., days, daily rate
- **Earnings table**: Description | Days | Rate (MVR) | Amount (MVR)
- **Deductions table** (when applicable)
- **Net pay** highlighted bar
- Remarks (notes)
- Signatures: employee (proof of receipt) + employer signatory (with company signature image when set)
- Optional **View invoice** link when record is invoiced

## Letterhead source

Uses the employee's **recruiting company** (`passport.companyId` → Companies):

- `letterheadImage` — same asset used on LOA documents
- `signatureImage`, `signatoryName`, `signatoryDesignation`
- Loaded via `GET /companies?withBranding=true` in `useSalaryRecordsWithMasterRates`

## Salary calculation

Logic lives in `apps/web/src/lib/salary-invoice.ts`:

**Employee daily rate** always comes from the **master list** — passport `agencySalary` (Employee Salary MVR/day in Master List). Falls back to the salary record’s `basicSalary` only if master rate is missing.

```
Daily rate     = agencySalary (master list)  e.g. MVR 180.00
Days worked    = daysWorked from salary record
Basic earnings = daily rate × daysWorked
Net salary     = computePayslipEmployeeNet() = daily rate × days + allowances + other expenses − deductions
```

`resolveEmployeeDailyRate`, `computePayslipBasicEarnings`, and `computePayslipEmployeeNet` are used on sheet and payslip views (not the stored `netSalary` when master rate differs).

Master rates are loaded via `useSalaryRecordsWithMasterRates` (`apps/web/src/hooks/use-salary-master-rates.ts`), which merges `agencySalary` from the salary-records API and/or passport list.

## Print

`useSalaryPrintStyles()` injects A4 portrait print CSS. The `.no-print` class hides the toolbar and payslip column links when printing. Users save as PDF via the browser print dialog.

## Related files

| File | Role |
|------|------|
| `apps/web/src/pages/salary.tsx` | Admin list; header button and row View links |
| `apps/web/src/App.tsx` | Route registration |
| `apps/api/src/routes/salary-records.ts` | Data API (no changes required) |
| `packages/api-client-react/.../api.schemas.ts` | `SalaryRecord` type |

## Deploy

From repo root:

```bash
pnpm deploy:web
```

Output is copied to `apps/react/app/` for the production web host.
