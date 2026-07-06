import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  apiFetch,
  type BillingDocument,
  type Client,
  type Company,
  type Passport,
  type SalaryRecord,
  ApiError,
} from "@/lib/api";
import {
  billingViewPath,
  computeBillingTotals,
  emptyBillingForm,
  fmtBillingMoney,
  lineItemAmount,
  MONTHS_LONG,
  parseBillingFormRoute,
  type BillingLineItem,
} from "@/lib/billing";
import { computeClientBillTotal, formatSalaryImportLabel, isReadyForInvoice, salaryRecordToLineItem } from "@/lib/salary-invoice";

const ISSUER_NAME = "LEO EMPLOYMENT SERVICES PVT LTD";

type FormState = ReturnType<typeof emptyBillingForm>;

function formFromDoc(doc: BillingDocument): FormState {
  return {
    clientId: doc.clientId ? String(doc.clientId) : "custom",
    customerName: doc.customerName ?? "",
    customerAddress: doc.customerAddress ?? "",
    customerTin: doc.customerTin ?? "",
    issueDate: doc.issueDate ?? new Date().toISOString().slice(0, 10),
    dueDate: doc.dueDate ?? "",
    terms: doc.terms ?? "Custom",
    gstRate: doc.gstRate ?? "8",
    gstInclusive: doc.gstInclusive ?? true,
    notes: doc.notes ?? emptyBillingForm(doc.kind === "quotation" ? "quotation" : "invoice").notes,
    items:
      doc.items && doc.items.length > 0
        ? doc.items.map((item) => ({
            description: item.description,
            detail: item.detail ?? "",
            qty: item.qty ?? "1",
            rate: item.rate ?? "0",
          }))
        : [{ description: "", detail: "", qty: "1", rate: "0" }],
    linkedSalaryIds: [],
  };
}

function addLineItems(
  current: BillingLineItem[],
  newItems: BillingLineItem[],
): BillingLineItem[] {
  const hasBlank =
    current.length === 1 &&
    !current[0].description.trim() &&
    !current[0].detail.trim() &&
    current[0].qty === "1" &&
    current[0].rate === "0";
  return hasBlank ? newItems : [...current, ...newItems];
}

function SalaryPickerDialog({
  open,
  onOpenChange,
  clientId,
  linkedSalaryIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number | null | undefined;
  linkedSalaryIds: number[];
  onAdd: (items: BillingLineItem[], salaryIds: number[]) => void;
}) {
  const { toast } = useToast();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    if (clientId == null) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setSelected(new Set());
    const qs = new URLSearchParams({
      status: "confirmed",
      clientId: String(clientId),
      unlinked: "true",
    });
    apiFetch<SalaryRecord[]>(`/salary-records?${qs.toString()}`)
      .then((rows) => {
        const linked = new Set(linkedSalaryIds);
        setRecords(
          rows.filter(
            (r) =>
              !r.invoiceId &&
              !linked.has(r.id) &&
              (r.employeeType ?? "casual") === "casual",
          ),
        );
      })
      .catch((err) => {
        toast({
          title: "Failed to load salary records",
          description: err instanceof ApiError ? err.message : "",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [open, clientId, linkedSalaryIds, toast]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    const chosen = records.filter((r) => selected.has(r.id));
    if (chosen.length === 0) return;
    onAdd(chosen.map(salaryRecordToLineItem), chosen.map((r) => r.id));
    onOpenChange(false);
    setSelected(new Set());
  }

  const allSelected = records.length > 0 && selected.size === records.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import salaries</DialogTitle>
        </DialogHeader>
        {clientId == null ? (
          <p className="py-6 text-sm text-muted-foreground">
            Select a client on this invoice first. Only confirmed, un-invoiced salary records for that
            client&apos;s casual employees will appear here (May, June, etc. — each month separately until invoiced).
          </p>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No confirmed, un-invoiced salary records for this client. Generate and confirm salaries first,
            or they may already be on an invoice.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-2 border-b pb-2 text-xs font-semibold uppercase text-slate-500">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() =>
                  setSelected(allSelected ? new Set() : new Set(records.map((r) => r.id)))
                }
              />
              {allSelected ? "Deselect all" : "Select all"} ({records.length})
            </label>
            <ScrollArea className="max-h-64 pr-2">
              <div className="space-y-1">
                {records.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"
                  >
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {MONTHS_LONG[(r.month - 1) % 12]} {r.year}
                        {r.passportNumber ? ` · ${r.passportNumber}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatSalaryImportLabel(r)}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">
                      MVR {fmtBillingMoney(computeClientBillTotal(r))}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={selected.size === 0} className="bg-emerald-600 hover:bg-emerald-700">
            Add {selected.size > 0 ? `${selected.size} record${selected.size === 1 ? "" : "s"}` : "records"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeePickerDialog({
  clientId,
  open,
  onOpenChange,
  onAdd,
}: {
  clientId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (items: BillingLineItem[]) => void;
}) {
  const { toast } = useToast();
  const [passports, setPassports] = useState<Passport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("0");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    apiFetch<Passport[]>(`/passports?clientId=${clientId}`)
      .then((rows) => setPassports(rows.filter((p) => p.employeeType === "casual")))
      .catch((err) => {
        toast({
          title: "Failed to load employees",
          description: err instanceof ApiError ? err.message : "",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [open, clientId, toast]);

  function apply() {
    const chosen = passports.filter((p) => selected.has(p.id));
    if (chosen.length === 0) return;
    onAdd(
      chosen.map((p) => ({
        description: description.trim() || "Service",
        detail: p.fullName ?? p.passportNumber ?? String(p.id),
        qty: "1",
        rate,
      })),
    );
    onOpenChange(false);
    setSelected(new Set());
  }

  const allSelected = passports.length > 0 && selected.size === passports.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Casual Employees</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Service description</Label>
            <Input placeholder="Visa Processing Fee" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Rate (MVR)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : passports.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No casual employees linked to this client.</p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 border-b pb-2 text-xs font-semibold uppercase text-slate-500">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() =>
                  setSelected(allSelected ? new Set() : new Set(passports.map((p) => p.id)))
                }
              />
              {allSelected ? "Deselect all" : "Select all"} ({passports.length})
            </label>
            <ScrollArea className="max-h-64 pr-2">
              {passports.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{p.passportNumber ?? "No passport number"}</p>
                  </div>
                </label>
              ))}
            </ScrollArea>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={selected.size === 0}>
            Add {selected.size || ""} employee{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BillingFormPage() {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isEdit, editId, kind: routeKind } = parseBillingFormRoute(location);
  const [docKind, setDocKind] = useState<"invoice" | "quotation">(routeKind);
  const kind = isEdit ? docKind : routeKind;

  const [form, setForm] = useState<FormState>(() => emptyBillingForm(routeKind));
  const [clients, setClients] = useState<Client[]>([]);
  const [issuer, setIssuer] = useState<Company | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);

  const totals = useMemo(
    () =>
      computeBillingTotals({
        items: form.items,
        gstRate: form.gstRate,
        gstInclusive: form.gstInclusive,
      }),
    [form.items, form.gstRate, form.gstInclusive],
  );

  useEffect(() => {
    Promise.all([
      apiFetch<Client[]>("/clients").catch(() => [] as Client[]),
      apiFetch<Company[]>("/companies").catch(() => [] as Company[]),
    ]).then(([cls, companies]) => {
      setClients(cls);
      const found =
        companies.find((c) => c.name.trim().toLowerCase() === ISSUER_NAME.toLowerCase()) ?? companies[0] ?? null;
      setIssuer(found);
    });
  }, []);

  useEffect(() => {
    if (isEdit) return;
    setForm(emptyBillingForm(routeKind));
    setDocKind(routeKind);
  }, [routeKind, isEdit]);

  useEffect(() => {
    if (isEdit || routeKind !== "invoice") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("salaryIds");
    if (!raw?.trim()) return;
    const ids = raw
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return;

    apiFetch<SalaryRecord[]>("/salary-records?status=confirmed")
      .then((records) => {
        const chosen = records.filter((r) => ids.includes(r.id) && isReadyForInvoice(r));
        if (chosen.length === 0) return;
        setForm((f) => ({
          ...f,
          kind: "invoice",
          items: chosen.map(salaryRecordToLineItem),
          linkedSalaryIds: chosen.map((r) => r.id),
        }));
      })
      .catch(() => {
        /* salary prefill is optional */
      });
  }, [isEdit, routeKind]);

  useEffect(() => {
    if (!isEdit || !editId) return;
    setLoading(true);
    apiFetch<BillingDocument>(`/billing/documents/${editId}`)
      .then((doc) => {
        setDocKind(doc.kind === "quotation" ? "quotation" : "invoice");
        setForm(formFromDoc(doc));
      })
      .catch((err) => {
        toast({
          title: "Failed to load document",
          description: err instanceof ApiError ? err.message : "",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [isEdit, editId, toast]);

  function onClientPick(clientId: string) {
    if (clientId === "custom") {
      setForm((f) => ({ ...f, clientId }));
      return;
    }
    const client = clients.find((c) => String(c.id) === clientId);
    setForm((f) => ({
      ...f,
      clientId,
      customerName: client?.name ?? f.customerName,
      customerAddress: client?.address ?? f.customerAddress,
      customerTin: client?.tin ?? f.customerTin,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const validItems = form.items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    if (!form.customerName.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      clientId: form.clientId === "custom" ? null : Number(form.clientId),
      customerName: form.customerName.trim(),
      customerAddress: form.customerAddress || null,
      customerTin: form.customerTin || null,
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      terms: form.terms || null,
      gstRate: form.gstRate,
      gstInclusive: form.gstInclusive,
      notes: form.notes || null,
      items: validItems,
      linkedSalaryIds: form.linkedSalaryIds.length ? form.linkedSalaryIds : undefined,
    };

    try {
      if (isEdit && editId) {
        await apiFetch(`/billing/documents/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast({ title: "Document updated" });
        navigate(billingViewPath(editId));
      } else {
        const created = await apiFetch<BillingDocument>("/billing/documents", {
          method: "POST",
          body: JSON.stringify({ kind, ...payload }),
        });
        toast({ title: `${kind === "invoice" ? "Invoice" : "Quotation"} created` });
        navigate(billingViewPath(created.id));
      }
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit
    ? `Edit ${kind === "invoice" ? "Invoice" : "Quotation"}`
    : `New ${kind === "invoice" ? "Invoice" : "Quotation"}`;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <form onSubmit={save} className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Fill in the customer details, add line items, and we&apos;ll calculate totals automatically.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" asChild>
              <Link href="/billing">
                <X className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
            <section className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <Label className="text-[11px] uppercase tracking-wide text-slate-500">Issued by</Label>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {issuer?.name ?? ISSUER_NAME}
                </p>
              </div>
              <div>
                <Label>Issue date</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                  required
                />
              </div>
              {kind === "invoice" ? (
                <div>
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              ) : null}
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Bill to</h2>
              <div>
                <Label>Client</Label>
                <Select value={form.clientId || "custom"} onValueChange={onClientPick}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom (type details below)</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer name *</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>TIN (optional)</Label>
                  <Input
                    value={form.customerTin}
                    onChange={(e) => setForm({ ...form, customerTin: e.target.value })}
                  />
                </div>
                {kind === "invoice" ? (
                  <div>
                    <Label>Terms (optional)</Label>
                    <Input value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
                  </div>
                ) : null}
              </div>
              <div>
                <Label>Address (optional)</Label>
                <Textarea
                  value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                  rows={2}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Line items</h2>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-emerald-600"
                    disabled={!form.clientId || form.clientId === "custom"}
                    onClick={() => {
                      if (!form.clientId || form.clientId === "custom") {
                        toast({
                          title: "Select a client",
                          description: "Choose a client before importing salary records.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setSalaryOpen(true);
                    }}
                  >
                    Import salaries
                  </Button>
                  {form.clientId && form.clientId !== "custom" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-blue-600"
                      onClick={() => setEmployeeOpen(true)}
                    >
                      <Users className="h-4 w-4" />
                      Add Casual
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        ...form,
                        items: [...form.items, { description: "", detail: "", qty: "1", rate: "0" }],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add line
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {form.items.map((item, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">{i + 1}</span>
                      {form.items.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3">
                      <Input
                        placeholder="Item / description"
                        value={item.description}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[i] = { ...item, description: e.target.value };
                          setForm({ ...form, items });
                        }}
                      />
                      <Textarea
                        placeholder="Optional sub-description (employee name, scope, etc.)"
                        value={item.detail}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[i] = { ...item, detail: e.target.value };
                          setForm({ ...form, items });
                        }}
                        rows={2}
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase">Qty</Label>
                          <Input
                            value={item.qty}
                            onChange={(e) => {
                              const items = [...form.items];
                              items[i] = { ...item, qty: e.target.value };
                              setForm({ ...form, items });
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase">Rate</Label>
                          <Input
                            value={item.rate}
                            onChange={(e) => {
                              const items = [...form.items];
                              items[i] = { ...item, rate: e.target.value };
                              setForm({ ...form, items });
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase">Amount</Label>
                          <Input
                            readOnly
                            value={fmtBillingMoney(lineItemAmount(item))}
                            className="bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>GST rate (%)</Label>
                  <Input
                    value={form.gstRate}
                    onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Pricing</Label>
                  <Select
                    value={form.gstInclusive ? "inclusive" : "exclusive"}
                    onValueChange={(v) => setForm({ ...form, gstInclusive: v === "inclusive" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">Tax Inclusive</SelectItem>
                      <SelectItem value="exclusive">Tax Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">
                      Sub Total ({form.gstInclusive ? "Tax Inclusive" : "Tax Exclusive"})
                    </span>
                    <span className="font-medium">{fmtBillingMoney(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Total Taxable</span>
                    <span className="font-medium">{fmtBillingMoney(totals.taxableAmount)}</span>
                  </div>
                  {totals.gstAmount > 0 ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">GST ({totals.gstRate}%)</span>
                      <span className="font-medium">{fmtBillingMoney(totals.gstAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 text-lg font-bold">
                    <span>Total</span>
                    <span>MVR {fmtBillingMoney(totals.total)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <Label>Notes (printed on the document)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={5}
                className="mt-2"
              />
            </section>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/billing">Cancel</Link>
            </Button>
            {isEdit && editId ? (
              <Button type="button" variant="outline" asChild>
                <Link href={billingViewPath(editId)}>
                  <Eye className="h-4 w-4" />
                  Preview
                </Link>
              </Button>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>

      <SalaryPickerDialog
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
        clientId={
          form.clientId && form.clientId !== "custom" ? Number(form.clientId) : null
        }
        linkedSalaryIds={form.linkedSalaryIds}
        onAdd={(items, salaryIds) =>
          setForm((f) => ({
            ...f,
            items: addLineItems(f.items.filter((i) => i.description.trim()), items),
            linkedSalaryIds: [...f.linkedSalaryIds, ...salaryIds],
          }))
        }
      />

      {form.clientId && form.clientId !== "custom" ? (
        <EmployeePickerDialog
          clientId={Number(form.clientId)}
          open={employeeOpen}
          onOpenChange={setEmployeeOpen}
          onAdd={(items) => setForm((f) => ({ ...f, items: addLineItems(f.items, items) }))}
        />
      ) : null}
    </div>
  );
}
