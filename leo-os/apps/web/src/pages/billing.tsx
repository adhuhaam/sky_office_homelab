import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Ban,
  Check,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type BillingDocument, ApiError } from "@/lib/api";
import {
  BILLING_STATUS_OPTIONS,
  BILLING_STATUS_STYLES,
  billingDocTotal,
  billingEditPath,
  billingGstLabel,
  billingNewPath,
  billingViewPath,
  computeBillingStats,
  fmtBillingDate,
  fmtBillingMoney,
  formatBillingStatus,
  isBillingOverdue,
  type BillingStatusFilter,
} from "@/lib/billing";
import { useHasRole } from "@/lib/auth";

type DocKind = "invoice" | "quotation";
type SortBy = "newest" | "oldest" | "amount_high" | "amount_low";

const STATUS_CHANGE_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "completed", label: "Completed" },
  { value: "voided", label: "Void" },
];

function BillingRecordRow({
  doc,
  isAdmin,
  onOpen,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  doc: BillingDocument;
  isAdmin: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  const total = billingDocTotal(doc);
  const profit = Number(doc.profit || 0);
  const employeeCost = Number(doc.employeeCost || 0);
  const kindLabel = doc.kind === "quotation" ? "QUOTATION" : "INVOICE";
  const overdue = isBillingOverdue(doc);
  const isVoided = doc.status === "voided";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`flex cursor-pointer flex-wrap items-center gap-4 border-b border-slate-100 px-1 py-4 last:border-b-0 hover:bg-slate-50/80 ${
        isVoided ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            doc.kind === "quotation" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"
          }`}
        >
          {doc.kind === "quotation" ? <FileText className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{doc.number}</span>
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600">
              {kindLabel}
            </span>
            {overdue && (
              <Badge variant="destructive" className="h-5 gap-1 px-2 text-[10px]">
                <Clock className="h-3 w-3" />
                Overdue
              </Badge>
            )}
          </div>
          <p className="truncate text-sm font-medium text-slate-900">{doc.customerName}</p>
          <p className="text-xs text-slate-500">
            {fmtBillingDate(doc.issueDate)}
            {doc.dueDate ? ` · Due ${fmtBillingDate(doc.dueDate)}` : ""}
            {doc.companyName ? ` · ${doc.companyName}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="text-right">
          <p className={`text-sm font-bold ${isVoided ? "text-slate-400 line-through" : "text-slate-900"}`}>
            MVR {fmtBillingMoney(total)}
          </p>
          <p className="text-[11px] text-slate-500">{billingGstLabel(doc)}</p>
          {employeeCost > 0 ? (
            <p
              className={`text-[11px] font-semibold ${profit >= 0 ? "text-emerald-600" : "text-orange-600"}`}
            >
              Profit MVR {fmtBillingMoney(profit)}
            </p>
          ) : null}
        </div>

        {isAdmin ? (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 min-w-[148px] justify-between gap-1 text-xs font-medium ${
                  BILLING_STATUS_STYLES[doc.status] ?? BILLING_STATUS_STYLES.draft
                }`}
              >
                {formatBillingStatus(doc.status)}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Change status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_CHANGE_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => onStatusChange(opt.value)}>
                  {doc.status === opt.value ? <Check className="h-4 w-4" /> : <span className="w-4" />}
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        ) : (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              BILLING_STATUS_STYLES[doc.status] ?? BILLING_STATUS_STYLES.draft
            }`}
          >
            {formatBillingStatus(doc.status)}
          </span>
        )}

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={onOpen} title="Preview">
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin ? (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={onEdit} title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={onDelete} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone?: "slate" | "emerald" | "blue" | "amber";
}) {
  const tones = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-700",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-700",
    blue: "from-blue-50 to-white border-blue-200 text-blue-700",
    amber: "from-amber-50 to-white border-amber-200 text-amber-700",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 shadow-sm ${tones[tone]}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs opacity-70">{hint}</p>
    </div>
  );
}

function BillingRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 py-4">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-8 w-36" />
    </div>
  );
}

export function BillingPage() {
  const isAdmin = useHasRole("admin", "superuser");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [kind, setKind] = useState<DocKind>("invoice");
  const [docsByKind, setDocsByKind] = useState<Record<DocKind, BillingDocument[]>>({
    invoice: [],
    quotation: [],
  });
  const [loadedKinds, setLoadedKinds] = useState<Record<DocKind, boolean>>({
    invoice: false,
    quotation: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const docs = docsByKind[kind];

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setRefreshing(true);
    else {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const [invoices, quotations] = await Promise.all([
        apiFetch<BillingDocument[]>("/billing/documents?kind=invoice"),
        apiFetch<BillingDocument[]>("/billing/documents?kind=quotation"),
      ]);
      setDocsByKind({ invoice: invoices, quotation: quotations });
      setLoadedKinds({ invoice: true, quotation: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load";
      if (!silent) setLoadError(message);
      toast({
        title: "Failed to load",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => computeBillingStats(docs), [docs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = docs;

    if (statusFilter !== "all") {
      rows = rows.filter((d) => d.status === statusFilter);
    }

    if (q) {
      rows = rows.filter(
        (d) =>
          d.number.toLowerCase().includes(q) ||
          d.customerName.toLowerCase().includes(q) ||
          (d.companyName?.toLowerCase().includes(q) ?? false) ||
          (d.clientName?.toLowerCase().includes(q) ?? false) ||
          d.status.toLowerCase().includes(q),
      );
    }

    return [...rows].sort((a, b) => {
      if (sortBy === "amount_high") return billingDocTotal(b) - billingDocTotal(a);
      if (sortBy === "amount_low") return billingDocTotal(a) - billingDocTotal(b);
      if (sortBy === "oldest") return (a.issueDate ?? "").localeCompare(b.issueDate ?? "");
      return (b.issueDate ?? "").localeCompare(a.issueDate ?? "");
    });
  }, [docs, search, statusFilter, sortBy]);

  const filteredStats = useMemo(() => computeBillingStats(filtered), [filtered]);
  const pendingDelete = deleteId != null ? docs.find((d) => d.id === deleteId) : null;

  async function updateStatus(id: number, status: string) {
    try {
      await apiFetch(`/billing/documents/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast({ title: `Marked as ${formatBillingStatus(status)}` });
      void load({ silent: true });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  }

  async function confirmDelete() {
    if (deleteId == null) return;
    try {
      await apiFetch(`/billing/documents/${deleteId}`, { method: "DELETE" });
      toast({ title: "Deleted" });
      setDeleteId(null);
      void load({ silent: true });
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  }

  const kindLabel = kind === "invoice" ? "Invoice" : "Quotation";
  const kindLabelPlural = kind === "invoice" ? "Invoices" : "Quotations";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-50 via-white to-rose-50 p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <FileText className="h-3.5 w-3.5" />
          Billing
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invoices &amp; Quotations</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Create invoices and quotations on company letterhead. Numbers auto-increment, GST is calculated for you,
              and every document has a print-ready preview you can share publicly.
            </p>
          </div>
          {isAdmin ? (
            <Button className="shrink-0" asChild>
              <Link href={billingNewPath(kind)}>
                <Plus className="h-4 w-4" />
                New {kindLabel}
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {loadError && (
        <LoadErrorBanner message={loadError} onRetry={() => void load()} retrying={loading} />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total value"
          value={`MVR ${fmtBillingMoney(stats.total)}`}
          hint={`${stats.count} ${kindLabelPlural.toLowerCase()}`}
          icon={Wallet}
          tone="slate"
        />
        <StatCard
          label="Received"
          value={`MVR ${fmtBillingMoney(stats.received)}`}
          hint="Paid & completed"
          icon={TrendingUp}
          tone="emerald"
        />
        <StatCard
          label="Outstanding"
          value={`MVR ${fmtBillingMoney(stats.outstanding)}`}
          hint="Sent, awaiting payment"
          icon={Clock}
          tone="blue"
        />
        <StatCard
          label="Draft"
          value={`MVR ${fmtBillingMoney(stats.draft)}`}
          hint="Not yet sent"
          icon={FileText}
          tone="amber"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setKind("invoice");
                setStatusFilter("all");
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                kind === "invoice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Receipt className="h-4 w-4" />
              Invoices
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("quotation");
                setStatusFilter("all");
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                kind === "quotation" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-4 w-4" />
              Quotations
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {filteredStats.count} shown · MVR {fmtBillingMoney(filteredStats.total)} total
            {statusFilter !== "all" || search ? ` (filtered from ${stats.count})` : ""}
            {refreshing ? " · Updating…" : ""}
          </p>
        </div>

        <div className="space-y-3 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${kindLabelPlural}...`}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="amount_high">Amount: high → low</SelectItem>
                <SelectItem value="amount_low">Amount: low → high</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {BILLING_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  statusFilter === opt.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-2">
          {loading && !loadedKinds[kind] ? (
            <div className="py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <BillingRowSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                {kind === "invoice" ? <Receipt className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
              </div>
              <div>
                <p className="font-medium text-slate-900">No {kindLabelPlural.toLowerCase()} found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {search || statusFilter !== "all"
                    ? "Try clearing your search or status filter."
                    : `Click New ${kindLabel} to create your first one.`}
                </p>
              </div>
              {isAdmin && !search && statusFilter === "all" ? (
                <Button asChild>
                  <Link href={billingNewPath(kind)}>
                    <Plus className="h-4 w-4" />
                    New {kindLabel}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            filtered.map((d) => (
              <BillingRecordRow
                key={d.id}
                doc={d}
                isAdmin={isAdmin}
                onOpen={() => navigate(billingViewPath(d.id))}
                onEdit={() => navigate(billingEditPath(d.id))}
                onStatusChange={(status) => updateStatus(d.id, status)}
                onDelete={() => setDeleteId(d.id)}
              />
            ))
          )}
        </div>
      </section>

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-rose-500" />
              Delete {pendingDelete?.kind === "quotation" ? "quotation" : "invoice"} {pendingDelete?.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document and all of its line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
