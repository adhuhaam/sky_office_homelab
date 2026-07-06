export function billingPrintPath(id: number, print = false): string {
  return `/billing/${id}/print${print ? "?print=1" : ""}`;
}

export function billingViewPath(id: number): string {
  return `/billing/${id}`;
}

export function billingEditPath(id: number): string {
  return `/billing/${id}/edit`;
}

export function billingNewPath(kind: "invoice" | "quotation"): string {
  return `/billing/new/${kind}`;
}

export type BillingDocKind = "invoice" | "quotation";

export function parseBillingFormRoute(location: string): {
  isEdit: boolean;
  editId: number | null;
  kind: BillingDocKind;
} {
  const editMatch = location.match(/^\/billing\/(\d+)\/edit$/);
  if (editMatch) {
    return { isEdit: true, editId: Number(editMatch[1]), kind: "invoice" };
  }
  const newMatch = location.match(/^\/billing\/new\/(invoice|quotation)$/);
  return {
    isEdit: false,
    editId: null,
    kind: newMatch?.[1] === "quotation" ? "quotation" : "invoice",
  };
}

export function parseBillingViewId(location: string): number | null {
  const match = location.match(/^\/billing\/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isNaN(id) ? null : id;
}

export const DEFAULT_BILLING_NOTES = `Thank you.
This invoice is valid without a stamp or signature.
All payments shall be made in favor of Leo E. Services.

Bank: Maldives Islamic Bank
Account Number: 90101480044441000
Currency: MVR`;

export const DEFAULT_QUOTATION_NOTES = `Looking Forward in working with You in the future

All payments shall be made in favor of Leo E. Services.

Bank: Maldives Islamic Bank
Account Number: 90101480044441000`;

export function emptyBillingForm(kind: BillingDocKind) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    clientId: "custom",
    customerName: "",
    customerAddress: "",
    customerTin: "",
    issueDate: today,
    dueDate: kind === "invoice" ? today : "",
    terms: kind === "invoice" ? "Custom" : "",
    gstRate: kind === "invoice" ? "8" : "0",
    gstInclusive: true,
    notes: kind === "invoice" ? DEFAULT_BILLING_NOTES : DEFAULT_QUOTATION_NOTES,
    items: [{ description: "", detail: "", qty: "1", rate: "0" }] as BillingLineItem[],
    linkedSalaryIds: [] as number[],
  };
}

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type BillingLineItem = {
  description: string;
  detail: string;
  qty: string;
  rate: string;
};

export function lineItemAmount(item: BillingLineItem): number {
  return (Number(item.qty) || 0) * (Number(item.rate) || 0);
}

export function computeBillingTotals(input: {
  items: BillingLineItem[];
  gstRate: string | number;
  gstInclusive: boolean;
}) {
  const subtotal = input.items.reduce((sum, item) => sum + lineItemAmount(item), 0);
  const gstRate = Number(input.gstRate) || 0;
  const qtyTotal = input.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  if (gstRate <= 0) {
    return {
      subtotal,
      taxableAmount: subtotal,
      gstAmount: 0,
      total: subtotal,
      qtyTotal,
      gstRate,
    };
  }

  if (input.gstInclusive) {
    const total = subtotal;
    const taxableAmount = total / (1 + gstRate / 100);
    const gstAmount = total - taxableAmount;
    return { subtotal: total, taxableAmount, gstAmount, total, qtyTotal, gstRate };
  }

  const taxableAmount = subtotal;
  const gstAmount = taxableAmount * (gstRate / 100);
  const total = taxableAmount + gstAmount;
  return { subtotal, taxableAmount, gstAmount, total, qtyTotal, gstRate };
}

export function fmtBillingMoney(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtBillingDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? m} ${Number(d)}, ${y}`;
}

export function billingDocTotal(doc: {
  subtotal?: string | null;
  gstRate?: string | null;
  gstInclusive?: boolean | null;
  items?: Array<{ qty?: string; rate?: string; amount?: string }>;
}): number {
  if (doc.items?.length) {
    return computeBillingTotals({
      items: doc.items.map((item) => ({
        description: "",
        detail: "",
        qty: item.qty ?? "0",
        rate: item.rate ?? String(Number(item.amount ?? 0)),
      })),
      gstRate: doc.gstRate ?? 0,
      gstInclusive: doc.gstInclusive ?? true,
    }).total;
  }
  const subtotal = Number(doc.subtotal ?? 0);
  const gstRate = Number(doc.gstRate ?? 0);
  if (doc.gstInclusive) return subtotal;
  return subtotal + subtotal * (gstRate / 100);
}

export function billingGstLabel(doc: { gstRate?: string | null; gstInclusive?: boolean | null }): string {
  const rate = Number(doc.gstRate ?? 0);
  if (rate <= 0) return "No GST";
  return doc.gstInclusive ? `GST ${rate}% incl` : `GST ${rate}% excl`;
}

export const BILLING_STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  payment_received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-teal-50 text-teal-700 border-teal-200",
  voided: "bg-rose-50 text-rose-700 border-rose-200",
};

export function formatBillingStatus(status: string): string {
  if (status === "voided") return "Void";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type BillingStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "payment_received"
  | "completed"
  | "voided";

export const BILLING_STATUS_OPTIONS: { value: BillingStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "completed", label: "Completed" },
  { value: "voided", label: "Void" },
];

export function isBillingOverdue(doc: {
  dueDate?: string | null;
  status: string;
}): boolean {
  if (!doc.dueDate) return false;
  if (["payment_received", "completed", "voided"].includes(doc.status)) return false;
  return doc.dueDate < new Date().toISOString().slice(0, 10);
}

export function computeBillingStats(
  docs: Array<{
    subtotal?: string | null;
    gstRate?: string | null;
    gstInclusive?: boolean | null;
    status: string;
  }>,
) {
  let total = 0;
  let received = 0;
  let outstanding = 0;
  let draft = 0;

  for (const doc of docs) {
    const amount = billingDocTotal(doc);
    total += amount;
    if (doc.status === "draft") draft += amount;
    if (doc.status === "payment_received" || doc.status === "completed") received += amount;
    if (doc.status === "sent") outstanding += amount;
  }

  return {
    count: docs.length,
    total,
    received,
    outstanding,
    draft,
  };
}
