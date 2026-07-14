import type { SalaryRecord } from "@leo/api-client-react";

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function fmtSalaryMVR(val: string | number | null | undefined): string {
  const n = Number(val ?? "0");
  if (val == null || val === "" || !Number.isFinite(n)) return "MVR —";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function salaryMonthLabel(month: number, year: number): string {
  return `${MONTHS_LONG[(month - 1) % 12] ?? ""} ${year}`;
}

export function computeBasicEarnings(record: SalaryMoneyFields): number {
  return moneyNum(record.basicSalary) * salaryDays(record.daysWorked);
}

/** Master-list employee daily rate (agencySalary), then salary record basicSalary. */
export function resolveEmployeeDailyRate(
  record: SalaryMoneyFields & { agencySalary?: string | null },
): number {
  const masterRate = moneyNum(record.agencySalary);
  if (masterRate > 0) return masterRate;
  return moneyNum(record.basicSalary);
}

/** Payslip/sheet net using master-list daily rate × days + allowances − deductions. */
export function computePayslipEmployeeNet(
  record: SalaryMoneyFields & { agencySalary?: string | null },
): number {
  const days = salaryDays(record.daysWorked);
  return (
    resolveEmployeeDailyRate(record) * days +
    moneyNum(record.foodAllowance) +
    moneyNum(record.transportAllowance) +
    moneyNum(record.otherAllowances) +
    moneyNum(record.otherExpenses) -
    moneyNum(record.deductions)
  );
}

export function computePayslipBasicEarnings(
  record: SalaryMoneyFields & { agencySalary?: string | null },
): number {
  return resolveEmployeeDailyRate(record) * salaryDays(record.daysWorked);
}

export type SalaryWorkflowStatus = "none" | "draft" | "confirmed" | "invoiced";

export type BillingLineItem = {
  description: string;
  detail?: string;
  qty: string;
  rate: string;
};

export type SalaryMoneyFields = {
  basicSalary?: string | null;
  foodAllowance?: string | null;
  transportAllowance?: string | null;
  otherAllowances?: string | null;
  deductions?: string | null;
  otherExpenses?: string | null;
  clientSalary?: string | null;
  daysWorked?: number | null;
};

function moneyNum(v: string | number | null | undefined): number {
  return Number(v ?? "0") || 0;
}

export function salaryDays(daysWorked?: number | null): number {
  const d = Number(daysWorked ?? 0);
  return d > 0 ? d : 0;
}

export function computeEmployeeNet(data: SalaryMoneyFields): number {
  const days = salaryDays(data.daysWorked);
  return (
    moneyNum(data.basicSalary) * days +
    moneyNum(data.foodAllowance) +
    moneyNum(data.transportAllowance) +
    moneyNum(data.otherAllowances) +
    moneyNum(data.otherExpenses) -
    moneyNum(data.deductions)
  );
}

export function computeClientBillTotal(data: {
  clientSalary?: string | null;
  daysWorked?: number | null;
}): number {
  return moneyNum(data.clientSalary) * salaryDays(data.daysWorked);
}

export function computeDailyMargin(
  basicSalary?: string | null,
  clientSalary?: string | null,
): number {
  return moneyNum(clientSalary) - moneyNum(basicSalary);
}

export function computeTotalMargin(
  basicSalary?: string | null,
  clientSalary?: string | null,
  daysWorked?: number | null,
): number {
  return computeDailyMargin(basicSalary, clientSalary) * salaryDays(daysWorked);
}

export function getSalaryWorkflowStatus(record: SalaryRecord | null | undefined): SalaryWorkflowStatus {
  if (!record) return "none";
  if (record.invoiceId) return "invoiced";
  if (record.status === "confirmed") return "confirmed";
  return "draft";
}

export function isReadyForInvoice(record: SalaryRecord | null | undefined): boolean {
  return getSalaryWorkflowStatus(record) === "confirmed";
}

export function salaryPeriodDetail(record: SalaryRecord): string {
  return `${MONTHS_LONG[(record.month - 1) % 12] ?? ""} ${record.year}${record.passportNumber ? ` · ${record.passportNumber}` : ""}`;
}

export function computeInvoiceLineFromSalary(record: SalaryRecord): BillingLineItem & { amount: number } {
  const days = salaryDays(record.daysWorked);
  const qty = days > 0 ? String(days) : "1";
  const rate =
    moneyNum(record.clientSalary) > 0
      ? String(record.clientSalary)
      : days > 0
        ? (moneyNum(record.netSalary) / days).toFixed(2)
        : String(record.netSalary ?? "0");
  const amount = moneyNum(qty) * moneyNum(rate);
  return {
    description: record.employeeName
      ? `Salary — ${record.employeeName}${record.jobTitle ? ` (${record.jobTitle})` : ""}`
      : "Salary",
    detail: salaryPeriodDetail(record),
    qty,
    rate,
    amount,
  };
}

export function salaryRecordToLineItem(record: SalaryRecord): BillingLineItem {
  const { description, detail, qty, rate } = computeInvoiceLineFromSalary(record);
  return { description, detail, qty, rate };
}

export function salaryIdsFromRecords(records: SalaryRecord[]): number[] {
  return records.filter(isReadyForInvoice).map((r) => r.id);
}

export function formatSalaryImportLabel(record: SalaryRecord): string {
  const days = salaryDays(record.daysWorked);
  const rate = moneyNum(record.clientSalary);
  const total = computeClientBillTotal(record);
  if (days > 0 && rate > 0) {
    return `${days} days × MVR ${rate.toFixed(2)}/day = MVR ${total.toFixed(2)}`;
  }
  return `MVR ${total.toFixed(2)}`;
}
