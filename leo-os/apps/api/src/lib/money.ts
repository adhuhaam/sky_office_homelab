export function normalizeMoney(
  input: string | number | null | undefined,
  scale: 2 | 4 = 2,
  maxIntegerDigits = 12,
): string | null {
  if (input == null) return null;
  const s = String(input).replace(/,/g, "").trim();
  if (!s) return null;
  const re = scale === 4 ? /^(\d+)(?:\.(\d{1,4}))?$/ : /^(\d+)(?:\.(\d{1,2}))?$/;
  const m = re.exec(s);
  if (!m) return null;
  const intPart = m[1]!.replace(/^0+(?=\d)/, "");
  if ((intPart || "0").length > maxIntegerDigits) return null;
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0) return null;
  return num.toFixed(scale);
}

export function normalizeDate(input: string | null | undefined): string | null | "invalid" {
  if (input == null) return null;
  const t = input.trim();
  if (!t || t === "0000-00-00") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return "invalid";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return "invalid";
  }
  return t;
}

export function computeLineAmount(qty: string, rate: string): string {
  const q = Number(qty) || 0;
  const r = Number(rate) || 0;
  return (q * r).toFixed(2);
}

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

/** Effective days for salary math (0 when unset). */
export function salaryDays(daysWorked?: number | null): number {
  const d = Number(daysWorked ?? 0);
  return d > 0 ? d : 0;
}

/** Employee net: (daily rate × days) + flat allowances − deductions. */
export function computeEmployeeNet(data: SalaryMoneyFields): string {
  const days = salaryDays(data.daysWorked);
  const net =
    moneyNum(data.basicSalary) * days +
    moneyNum(data.foodAllowance) +
    moneyNum(data.transportAllowance) +
    moneyNum(data.otherAllowances) +
    moneyNum(data.otherExpenses) -
    moneyNum(data.deductions);
  return net.toFixed(2);
}

/** Client invoice total: client daily rate × days worked. */
export function computeClientBillTotal(data: {
  clientSalary?: string | null;
  daysWorked?: number | null;
}): string {
  const days = salaryDays(data.daysWorked);
  return (moneyNum(data.clientSalary) * days).toFixed(2);
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

/** Stored net salary — same as computeEmployeeNet. */
export function computeNetSalary(data: SalaryMoneyFields): string {
  return computeEmployeeNet(data);
}
