import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSalaryRecords,
  useCreateSalaryRecord,
  useUpdateSalaryRecord,
  useDeleteSalaryRecord,
  useListPassports,
  getListPassportsQueryKey,
  getListSalaryRecordsQueryKey,
  type SalaryRecord,
  type Passport,
} from "@leo/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  getSalaryWorkflowStatus,
  isReadyForInvoice,
  computeEmployeeNet,
  computeClientBillTotal,
  computeDailyMargin,
  computeTotalMargin,
  type SalaryWorkflowStatus,
} from "@/lib/salary-invoice";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function fmtMVR(val: string | number | null | undefined): string {
  const n = Number(val ?? "0");
  if (!val || isNaN(n)) return "MVR —";
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name: string | null | undefined): string {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

type SalaryForm = {
  daysWorked: string;
  basicSalary: string;
  clientSalary: string;
  foodAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  deductions: string;
  otherExpenses: string;
  notes: string;
  status: "draft" | "confirmed";
};

const EMPTY_FORM: SalaryForm = {
  daysWorked: "",
  basicSalary: "",
  clientSalary: "0",
  foodAllowance: "0",
  transportAllowance: "0",
  otherAllowances: "0",
  deductions: "0",
  otherExpenses: "0",
  notes: "",
  status: "draft",
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Please try again.";
}

function formToMoneyFields(f: SalaryForm) {
  return {
    basicSalary: f.basicSalary,
    clientSalary: f.clientSalary,
    foodAllowance: f.foodAllowance,
    transportAllowance: f.transportAllowance,
    otherAllowances: f.otherAllowances,
    deductions: f.deductions,
    otherExpenses: f.otherExpenses,
    daysWorked: parseInt(f.daysWorked, 10) || 0,
  };
}

function StatusBadge({ status }: { status: string }) {
  const confirmed = status === "confirmed";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        confirmed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {confirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {confirmed ? "Confirmed" : "Draft"}
    </Badge>
  );
}

function WorkflowBadge({ workflow }: { workflow: SalaryWorkflowStatus }) {
  if (workflow === "none") {
    return <span className="text-sm text-muted-foreground">No salary</span>;
  }
  if (workflow === "invoiced") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700">
        <FileText className="h-3 w-3" />
        Invoiced
      </Badge>
    );
  }
  if (workflow === "confirmed") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Ready to invoice
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
      <Clock className="h-3 w-3" />
      Draft
    </Badge>
  );
}

function matchesEmployeeSearch(
  q: string,
  name: string | null | undefined,
  passportNumber: string | null | undefined,
): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    (name ?? "").toLowerCase().includes(needle) ||
    (passportNumber ?? "").toLowerCase().includes(needle)
  );
}

function passportStubFromRecord(record: SalaryRecord): Passport {
  return {
    id: record.passportId ?? record.id,
    fullName: record.employeeName ?? null,
    passportNumber: record.passportNumber ?? null,
    dateOfBirth: null,
    dateOfIssue: null,
    dateOfExpiry: null,
    address: null,
    nationality: null,
    status: "employed",
    submitted: true,
    errorMessage: null,
    originalFilename: null,
    companyId: null,
    clientId: null,
    clientName: null,
    workPermitNumber: null,
    agent: null,
    agencySalary: record.basicSalary,
    clientSalary: record.clientSalary,
    agentRate: null,
    employeeType: (record.employeeType as Passport["employeeType"]) ?? "casual",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

type RosterRow = {
  key: string;
  passport: Passport;
  record: SalaryRecord | null;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </Label>
  );
}

function SalaryFormPanel({
  passport,
  existing,
  form,
  formMonth,
  formYear,
  saving,
  onChange,
  onMonthChange,
  onYearChange,
  onCancel,
  onSave,
}: {
  passport: Passport;
  existing: SalaryRecord | null;
  form: SalaryForm;
  formMonth: number;
  formYear: number;
  saving: boolean;
  onChange: (next: SalaryForm) => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const moneyFields = formToMoneyFields(form);
  const netPreview = computeEmployeeNet(moneyFields);
  const clientBillPreview = computeClientBillTotal(moneyFields);
  const dailyMargin = computeDailyMargin(form.basicSalary, form.clientSalary);
  const totalMargin = computeTotalMargin(form.basicSalary, form.clientSalary, moneyFields.daysWorked);

  const earningsPreview = [
    {
      label: moneyFields.daysWorked > 0 ? `Basic (${moneyFields.daysWorked} days)` : "Basic",
      val: moneyFields.daysWorked > 0
        ? String(Number(form.basicSalary || 0) * moneyFields.daysWorked)
        : form.basicSalary,
    },
    { label: "Food", val: form.foodAllowance },
    { label: "Transport", val: form.transportAllowance },
    { label: "Other Allow.", val: form.otherAllowances },
    { label: "Other Exp.", val: form.otherExpenses },
  ].filter((r) => parseFloat(r.val || "0") !== 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
        <div className="min-w-0 flex-1 px-3 text-center">
          <p className="truncate text-base font-bold">{existing ? "Edit Salary" : "Generate Salary"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {passport.fullName ?? "—"} · {MONTHS_SHORT[formMonth - 1]} {formYear}
          </p>
        </div>
        <Button type="button" size="sm" disabled={saving} onClick={onSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-5 pb-8">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
              {initials(passport.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{passport.fullName ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{passport.passportNumber ?? "No passport number"}</p>
              {passport.clientName ? (
                <p className="text-xs text-muted-foreground">Client: {passport.clientName}</p>
              ) : null}
            </div>
            {existing ? <WorkflowBadge workflow={getSalaryWorkflowStatus(existing)} /> : null}
          </div>

          {(passport.agencySalary || passport.clientSalary) && !existing ? (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Passport employee rate</p>
                <p className="font-semibold">{fmtMVR(passport.agencySalary)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Passport client rate</p>
                <p className="font-semibold">{fmtMVR(passport.clientSalary ?? passport.agencySalary)}</p>
              </div>
            </div>
          ) : null}

          {!existing ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel>Month</FieldLabel>
                <Select value={String(formMonth)} onValueChange={(v) => onMonthChange(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_LONG.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Year</FieldLabel>
                <Select value={String(formYear)} onValueChange={(v) => onYearChange(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel>Month</FieldLabel>
                <Input readOnly value={MONTHS_LONG[formMonth - 1]} className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Year</FieldLabel>
                <Input readOnly value={String(formYear)} className="bg-muted/40" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <FieldLabel>Days worked</FieldLabel>
            <Input
              type="number"
              placeholder="e.g. 26"
              value={form.daysWorked}
              onChange={(e) => onChange({ ...form, daysWorked: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>Employee daily rate (MVR/day)</FieldLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.basicSalary}
                onChange={(e) => onChange({ ...form, basicSalary: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">What you pay per day</p>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Client billing rate (MVR/day)</FieldLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.clientSalary}
                onChange={(e) => onChange({ ...form, clientSalary: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">What you bill per day</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Margin per day</span>
              <span
                className={cn(
                  "text-sm font-bold",
                  dailyMargin > 0 ? "text-emerald-600" : dailyMargin < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {dailyMargin >= 0 ? "+" : ""}{dailyMargin.toFixed(2)} MVR
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Total margin (× days)</span>
              <span
                className={cn(
                  "text-sm font-bold",
                  totalMargin > 0 ? "text-emerald-600" : totalMargin < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {totalMargin >= 0 ? "+" : ""}{totalMargin.toFixed(2)} MVR
              </span>
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Earnings</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>Food allow.</FieldLabel>
              <Input type="number" step="0.01" placeholder="0.00" value={form.foodAllowance} onChange={(e) => onChange({ ...form, foodAllowance: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Transport</FieldLabel>
              <Input type="number" step="0.01" placeholder="0.00" value={form.transportAllowance} onChange={(e) => onChange({ ...form, transportAllowance: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Other allow.</FieldLabel>
              <Input type="number" step="0.01" placeholder="0.00" value={form.otherAllowances} onChange={(e) => onChange({ ...form, otherAllowances: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Other exp.</FieldLabel>
              <Input type="number" step="0.01" placeholder="0.00" value={form.otherExpenses} onChange={(e) => onChange({ ...form, otherExpenses: e.target.value })} />
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">Deductions</p>
          <div className="space-y-1.5">
            <FieldLabel>Total deductions</FieldLabel>
            <Input type="number" step="0.01" placeholder="0.00" value={form.deductions} onChange={(e) => onChange({ ...form, deductions: e.target.value })} />
          </div>

          {earningsPreview.length > 0 || parseFloat(form.deductions || "0") > 0 ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Breakdown preview</p>
              {earningsPreview.map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span>{fmtMVR(r.val)}</span>
                </div>
              ))}
              {parseFloat(form.deductions || "0") > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="text-destructive">− {fmtMVR(form.deductions)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">Employee total</span>
            <span className={cn("text-lg font-bold", netPreview < 0 && "text-destructive")}>
              MVR {netPreview.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm text-muted-foreground">Client bill total</span>
            <span className="text-lg font-bold text-primary">
              MVR {clientBillPreview.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Status</FieldLabel>
            <div className="flex gap-2">
              {(["draft", "confirmed"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={form.status === s ? "default" : "outline"}
                  onClick={() => onChange({ ...form, status: s })}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Notes (optional)</FieldLabel>
            <Textarea
              placeholder="Optional notes…"
              rows={3}
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function SalarySlipCard({ record }: { record: SalaryRecord }) {
  const rows = [
    { label: "Basic Salary", val: record.basicSalary },
    { label: "Food Allowance", val: record.foodAllowance },
    { label: "Transport Allowance", val: record.transportAllowance },
    { label: "Other Allowances", val: record.otherAllowances },
    { label: "Other Expenses", val: record.otherExpenses },
  ].filter((r) => parseFloat(r.val ?? "0") !== 0);
  const hasDeductions = parseFloat(record.deductions ?? "0") > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-4 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Salary Slip</p>
        <p className="mt-1 text-lg font-bold">
          {MONTHS_LONG[(record.month ?? 1) - 1]} {record.year}
        </p>
        {record.daysWorked ? (
          <p className="text-sm text-muted-foreground">
            {record.daysWorked} day{Number(record.daysWorked) !== 1 ? "s" : ""} worked
          </p>
        ) : null}
        <div className="mt-2 flex justify-center">
          <StatusBadge status={record.status} />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Earnings</p>
        {(rows.length > 0 ? rows : [{ label: "Basic Salary", val: record.basicSalary }]).map((r) => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium">{fmtMVR(r.val)}</span>
          </div>
        ))}
      </div>

      {hasDeductions ? (
        <div className="space-y-2 border-t border-border px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">Deductions</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total deductions</span>
            <span className="font-medium text-destructive">− {fmtMVR(record.deductions)}</span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="font-semibold">Net salary</span>
        <span className="text-xl font-bold text-emerald-600">{fmtMVR(record.netSalary)}</span>
      </div>

      {record.notes ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">Note: {record.notes}</p>
      ) : null}
    </div>
  );
}

function EmployeeSalaryView() {
  const now = new Date();
  const { data, isLoading, isError, isFetching, refetch } = useListSalaryRecords(undefined, {
    query: { queryKey: getListSalaryRecordsQueryKey() },
  });

  const records = useMemo(
    () =>
      [...((data ?? []) as SalaryRecord[])].sort((a, b) =>
        b.year !== a.year ? b.year - a.year : b.month - a.month,
      ),
    [data],
  );
  const latest = records[0];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 w-full rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-medium">Could not load salary data</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <>
        <div className="mb-4 rounded-xl bg-primary px-6 py-8 text-primary-foreground">
          <p className="text-sm opacity-90">
            {MONTHS_LONG[now.getMonth()]} {now.getFullYear()}
          </p>
          <p className="mt-1 text-3xl font-bold">Pending</p>
          <p className="mt-1 text-sm opacity-90">Your salary hasn&apos;t been processed yet</p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-card-border bg-card py-16 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Salary not yet generated</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Salaries are processed by your admin once the monthly invoice is marked as paid.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 rounded-xl bg-primary px-6 py-8 text-primary-foreground">
        <p className="text-sm opacity-90">
          {MONTHS_LONG[(latest?.month ?? 1) - 1]} {latest?.year}
        </p>
        <p className="mt-1 text-3xl font-bold">{fmtMVR(latest?.netSalary)}</p>
        <p className="mt-1 text-sm opacity-90">
          {latest?.status === "confirmed" ? "✓ Confirmed" : "Draft — pending confirmation"}
        </p>
      </div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salary history</p>
      <div className="space-y-3">
        {records.map((r) => (
          <SalarySlipCard key={r.id} record={r} />
        ))}
      </div>
      {isFetching && !isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </>
  );
}

export function SalaryPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "superuser" || user?.role === "admin";

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader
          icon={DollarSign}
          title="My salary"
          description="View your monthly salary slips"
        />
        <EmployeeSalaryView />
      </div>
    );
  }

  return <AdminSalaryPage />;
}

function AdminSalaryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");

  const [formTarget, setFormTarget] = useState<{ passport: Passport; existing: SalaryRecord | null } | null>(null);
  const [form, setForm] = useState<SalaryForm>(EMPTY_FORM);
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [deleteTarget, setDeleteTarget] = useState<SalaryRecord | null>(null);

  const queryParams = { month: filterMonth, year: filterYear };
  const {
    data,
    isLoading,
    isFetching,
    isError: recordsError,
    refetch: refetchRecords,
  } = useListSalaryRecords(queryParams, {
    query: { queryKey: getListSalaryRecordsQueryKey(queryParams) },
  });
  const {
    data: passportsRaw = [],
    isLoading: passportsLoading,
    isError: passportsError,
    refetch: refetchPassports,
  } = useListPassports(undefined, {
    query: { queryKey: getListPassportsQueryKey() },
  });

  const createMutation = useCreateSalaryRecord();
  const updateMutation = useUpdateSalaryRecord();
  const deleteMutation = useDeleteSalaryRecord();

  const records = (data ?? []) as SalaryRecord[];
  const allPassports = passportsRaw as Passport[];
  const passports = allPassports.filter((p) => (p.employeeType ?? "casual") === "casual");
  const passportById = useMemo(() => new Map(allPassports.map((p) => [p.id, p])), [allPassports]);

  const salaryMap = useMemo(() => {
    const m = new Map<number, SalaryRecord>();
    for (const r of records) {
      if (r.passportId != null) m.set(r.passportId, r);
    }
    return m;
  }, [records]);

  const totalClientBill = useMemo(
    () => records.reduce((s, r) => s + computeClientBillTotal(r), 0),
    [records],
  );
  const readyForInvoice = useMemo(() => records.filter(isReadyForInvoice), [records]);
  const invoicedCount = useMemo(() => records.filter((r) => r.invoiceId).length, [records]);

  const rosterRows = useMemo(() => {
    const q = search.trim();
    const rows: RosterRow[] = [];
    const seenPassportIds = new Set<number>();

    for (const p of passports) {
      if (!matchesEmployeeSearch(q, p.fullName, p.passportNumber)) continue;
      seenPassportIds.add(p.id);
      rows.push({
        key: `passport-${p.id}`,
        passport: p,
        record: salaryMap.get(p.id) ?? null,
      });
    }

    for (const r of records) {
      if (r.passportId != null && seenPassportIds.has(r.passportId)) continue;
      if (!matchesEmployeeSearch(q, r.employeeName, r.passportNumber)) continue;
      const passport =
        r.passportId != null && passportById.has(r.passportId)
          ? passportById.get(r.passportId)!
          : passportStubFromRecord(r);
      if (r.passportId != null) seenPassportIds.add(r.passportId);
      rows.push({ key: `record-${r.id}`, passport, record: r });
    }

    return rows;
  }, [passports, records, salaryMap, passportById, search]);

  const dataLoading = isLoading || passportsLoading;
  const fetchError = recordsError || passportsError;
  const saving = createMutation.isPending || updateMutation.isPending;

  function openForm(passport: Passport, existing: SalaryRecord | null) {
    setFormMonth(existing ? existing.month : filterMonth);
    setFormYear(existing ? existing.year : filterYear);
    if (existing) {
      setForm({
        daysWorked: String(existing.daysWorked ?? ""),
        basicSalary: existing.basicSalary,
        clientSalary: existing.clientSalary ?? "0",
        foodAllowance: existing.foodAllowance,
        transportAllowance: existing.transportAllowance,
        otherAllowances: existing.otherAllowances,
        deductions: existing.deductions,
        otherExpenses: existing.otherExpenses,
        notes: existing.notes ?? "",
        status: existing.status as "draft" | "confirmed",
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        basicSalary: passport.agencySalary ?? "",
        clientSalary: passport.clientSalary ?? passport.agencySalary ?? "0",
      });
    }
    setFormTarget({ passport, existing });
  }

  async function handleSave() {
    if (!formTarget) return;
    const { passport, existing } = formTarget;
    const days = parseInt(form.daysWorked, 10) || 0;
    if (!form.basicSalary || parseFloat(form.basicSalary) <= 0) {
      toast({
        title: "Daily rate missing",
        description: "Enter the employee daily rate (MVR/day).",
        variant: "destructive",
      });
      return;
    }
    if (form.status === "confirmed" && days <= 0) {
      toast({
        title: "Days worked required",
        description: "Enter days worked before confirming this salary.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      daysWorked: parseInt(form.daysWorked) || 0,
      basicSalary: form.basicSalary,
      clientSalary: form.clientSalary || "0",
      foodAllowance: form.foodAllowance || "0",
      transportAllowance: form.transportAllowance || "0",
      otherAllowances: form.otherAllowances || "0",
      deductions: form.deductions || "0",
      otherExpenses: form.otherExpenses || "0",
      notes: form.notes || null,
      status: form.status,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, data: payload });
        toast({ title: "Salary updated" });
      } else {
        await createMutation.mutateAsync({
          data: {
            passportId: passport.id,
            employeeName: passport.fullName ?? "Unknown",
            month: formMonth,
            year: formYear,
            ...payload,
          },
        });
        setFilterMonth(formMonth);
        setFilterYear(formYear);
        toast({ title: "Salary generated" });
      }
      await qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
      setFormTarget(null);
    } catch (err) {
      const msg = errorMessage(err);
      toast({
        title: "Failed to save",
        description:
          msg.toLowerCase().includes("already exists") || msg.includes("23505")
            ? "A salary record already exists for this employee, month, and year."
            : msg,
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      await qc.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
      toast({ title: "Salary record deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  }

  return (
    <div>
      <PageHeader
        icon={DollarSign}
        title="Monthly salaries"
        description="Generate salaries each month, confirm them, then create invoices in Billing"
        action={
          records.length > 0 ? (
            <Link href={`/salary/sheet?month=${filterMonth}&year=${filterYear}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText className="h-4 w-4" />
                View salary sheet
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-card-border bg-card px-3 py-2.5 text-sm font-medium">
        <span>1. Generate salary</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span>2. Confirm</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span>3. Create invoice</span>
      </div>

      {readyForInvoice.length > 0 ? (
        <Link href={`/billing/new/invoice?salaryIds=${readyForInvoice.map((r) => r.id).join(",")}`}>
          <Button className="mb-4 w-full justify-between gap-2 sm:w-auto">
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Create invoice for {readyForInvoice.length} confirmed salar{readyForInvoice.length === 1 ? "y" : "ies"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : null}

      {/* Month / Year filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS_LONG.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto rounded-xl border border-card-border bg-card px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Client bill total</p>
          <p className="text-base font-bold text-primary">{fmtMVR(totalClientBill)}</p>
        </div>
        {isFetching && !dataLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.length > 0 && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Summary strip */}
      {(records.length > 0 || passports.length > 0) && (
        <div className="mb-4 flex rounded-xl border border-card-border bg-card divide-x divide-border">
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Records</p>
            <p className="text-base font-bold">{records.length} / {Math.max(passports.length, records.length)}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ready</p>
            <p className="text-base font-bold text-emerald-600">{readyForInvoice.length}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Invoiced</p>
            <p className="text-base font-bold text-blue-600">{invoicedCount}</p>
          </div>
        </div>
      )}

      {/* Employee roster */}
      {fetchError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center">
          <p className="font-medium text-destructive">Could not load salary data</p>
          <Button
            variant="outline"
            onClick={() => {
              void refetchRecords();
              void refetchPassports();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : dataLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : rosterRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <DollarSign className="h-8 w-8" />
          <p className="font-medium text-foreground">No employees found</p>
          <p className="max-w-sm text-center text-sm">
            No casual employees or salary records for {MONTHS_LONG[filterMonth - 1]} {filterYear}.
            Try another month or generate salaries on mobile first.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rosterRows.map(({ key, passport: p, record }) => {
            const hasSalary = record !== null;
            const workflow = getSalaryWorkflowStatus(record);

            return (
              <div
                key={key}
                className="rounded-xl border border-card-border bg-card overflow-hidden shadow-sm"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {initials(p.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.fullName ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{p.passportNumber ?? "—"}</p>
                    {p.clientName ? (
                      <p className="text-xs text-muted-foreground">{p.clientName}</p>
                    ) : null}
                  </div>
                  {hasSalary ? (
                    <div className="text-right space-y-1">
                      <p className="font-bold">{fmtMVR(computeClientBillTotal(record!))}</p>
                      <p className="text-xs text-muted-foreground">Employee {fmtMVR(record!.netSalary)}</p>
                      <WorkflowBadge workflow={workflow} />
                    </div>
                  ) : (
                    <WorkflowBadge workflow="none" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => openForm(p, record)}
                  >
                    {hasSalary ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {hasSalary ? "Edit" : "Generate"}
                  </Button>
                  {record && isReadyForInvoice(record) && (
                    <Link href={`/billing/new/invoice?salaryIds=${record.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-blue-700 hover:text-blue-700">
                        <FileText className="h-3.5 w-3.5" />
                        Invoice
                      </Button>
                    </Link>
                  )}
                  {hasSalary ? (
                    <Link
                      href={`/salary/${record!.id}/payslip?month=${filterMonth}&year=${filterYear}`}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>
                  ) : null}
                  {hasSalary && !record?.invoiceId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(record!)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate / Edit sheet — matches mobile full form */}
      <Sheet open={formTarget !== null} onOpenChange={(open) => !open && setFormTarget(null)}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl [&>button]:hidden">
          {formTarget ? (
            <SalaryFormPanel
              passport={formTarget.passport}
              existing={formTarget.existing}
              form={form}
              formMonth={formMonth}
              formYear={formYear}
              saving={saving}
              onChange={setForm}
              onMonthChange={setFormMonth}
              onYearChange={setFormYear}
              onCancel={() => setFormTarget(null)}
              onSave={handleSave}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete salary record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Delete salary for ${deleteTarget.employeeName ?? "this employee"} — ${MONTHS_LONG[deleteTarget.month - 1]} ${deleteTarget.year}?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
