import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Eye,
  Globe,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { CompanyDetailDialog } from "@/components/company-detail-dialog";
import { BrandImage } from "@/components/brand-image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { apiFetch, type Company, ApiError } from "@/lib/api";
import { uploadCompanyBranding, BRANDING_SLOTS, type BrandingImageKind } from "@/lib/branding-upload";
import { useHasRole } from "@/lib/auth";

const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

interface CompanyFormState {
  name: string;
  address: string;
  email: string;
  phone: string;
  country: string;
  registrationNumber: string;
  signatoryName: string;
  signatoryDesignation: string;
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankSwiftCode: string;
}

const EMPTY_FORM: CompanyFormState = {
  name: "",
  address: "",
  email: "",
  phone: "",
  country: "",
  registrationNumber: "",
  signatoryName: "",
  signatoryDesignation: "",
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankSwiftCode: "",
};

const FORM_FIELDS = [
  "address",
  "email",
  "phone",
  "country",
  "registrationNumber",
  "signatoryName",
  "signatoryDesignation",
  "bankName",
  "bankAccountHolder",
  "bankAccountNumber",
  "bankSwiftCode",
] as const;

function companyToForm(c: Company): CompanyFormState {
  return {
    name: c.name ?? "",
    address: c.address ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    country: c.country ?? "",
    registrationNumber: c.registrationNumber ?? "",
    signatoryName: c.signatoryName ?? "",
    signatoryDesignation: c.signatoryDesignation ?? "",
    bankName: c.bankName ?? "",
    bankAccountHolder: c.bankAccountHolder ?? "",
    bankAccountNumber: c.bankAccountNumber ?? "",
    bankSwiftCode: c.bankSwiftCode ?? "",
  };
}

export function CompaniesPage() {
  const isAdmin = useHasRole("admin", "superuser");
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [viewCompany, setViewCompany] = useState<Company | null>(null);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await apiFetch<Company[]>("/companies");
      setCompanies(rows);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load companies";
      setLoadError(message);
      toast({
        title: "Failed to load companies",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.registrationNumber?.toLowerCase().includes(q),
    );
  }, [companies, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Companies
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage employer companies, their LOA options (job titles, work types, sites) and branding.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add company
          </Button>
        )}
      </div>

      {loadError && (
        <LoadErrorBanner message={loadError} onRetry={() => void load()} retrying={loading} />
      )}

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, reg. number…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground shrink-0">
              <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{companies.length}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden xl:table-cell">Country</TableHead>
                  <TableHead className="hidden xl:table-cell">Reg. No.</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {companies.length === 0
                        ? "No companies yet — click Add company to get started."
                        : "No companies match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setViewCompany(c)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Building2 className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            {c.signatoryName && (
                              <p className="text-xs text-muted-foreground">{c.signatoryName}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {c.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {c.country ? (
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {c.country}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground font-mono">
                        {c.registrationNumber || <span className="font-sans">—</span>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => setEditCompany(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setViewCompany(c)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setEditCompany(c)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(c)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewCompany && (
        <CompanyDetailDialog
          company={companies.find((c) => c.id === viewCompany.id) ?? viewCompany}
          open={!!viewCompany}
          onOpenChange={(o) => !o && setViewCompany(null)}
          onEdit={(c) => {
            setViewCompany(null);
            setEditCompany(c);
          }}
          onRefresh={load}
        />
      )}

      {isAdmin && (
        <CompanyFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      )}
      {editCompany && (
        <CompanyFormDialog
          mode="edit"
          company={editCompany}
          open={!!editCompany}
          onOpenChange={(o) => !o && setEditCompany(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && isAdmin && (
        <DeleteCompanyDialog
          company={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          onDeleted={load}
        />
      )}
    </div>
  );
}

function CompanyFormDialog(
  props:
    | {
        mode: "create";
        open: boolean;
        onOpenChange: (o: boolean) => void;
        onSaved: () => Promise<void>;
      }
    | {
        mode: "edit";
        company: Company;
        open: boolean;
        onOpenChange: (o: boolean) => void;
        onSaved: () => Promise<void>;
      },
) {
  const { mode, open, onOpenChange, onSaved } = props;
  const { toast } = useToast();
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [brandingData, setBrandingData] = useState<Company | null>(null);
  const [brandingUploading, setBrandingUploading] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const companyId = mode === "edit" ? props.company.id : createdId;

  useEffect(() => {
    if (!open) {
      setCreatedId(null);
      return;
    }
    if (mode === "edit") {
      setForm(companyToForm(props.company));
    } else {
      setForm(EMPTY_FORM);
      setCreatedId(null);
    }
  }, [open, mode, mode === "edit" ? props.company.id : 0]);

  const loadBranding = useCallback(async () => {
    if (!companyId) return;
    try {
      const branded = await apiFetch<Company[]>("/companies?withBranding=true");
      setBrandingData(branded.find((c) => c.id === companyId) ?? null);
    } catch {
      setBrandingData(null);
    }
  }, [companyId]);

  useEffect(() => {
    if (open && companyId) void loadBranding();
  }, [open, companyId, loadBranding]);

  const f = (key: keyof CompanyFormState) => (v: string) =>
    setForm((s) => ({ ...s, [key]: v }));

  async function handleImageUpload(kind: BrandingImageKind, file: File | null) {
    if (!file || !companyId) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "PNG or JPG only", variant: "destructive" });
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      toast({ title: "Image must be under 10 MB", variant: "destructive" });
      return;
    }
    setBrandingUploading(true);
    try {
      await uploadCompanyBranding(companyId, kind, file);
      await loadBranding();
      toast({ title: `${BRANDING_SLOTS.find((s) => s.kind === kind)?.label ?? "Image"} saved` });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save image",
        variant: "destructive",
      });
    } finally {
      setBrandingUploading(false);
    }
  }

  async function handleImageClear(kind: BrandingImageKind) {
    if (!companyId) return;
    setBrandingUploading(true);
    try {
      await apiFetch(`/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify({ [kind]: null }),
      });
      await loadBranding();
      toast({ title: "Image removed" });
    } catch (err) {
      toast({
        title: "Failed to remove",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setBrandingUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const body: Record<string, string> = { name };
        FORM_FIELDS.forEach((k) => {
          const v = form[k].trim();
          if (v) body[k] = v;
        });
        const created = await apiFetch<Company>("/companies", { method: "POST", body: JSON.stringify(body) });
        setCreatedId(created.id);
        toast({ title: "Company added — upload branding below (optional)" });
        await onSaved();
      } else {
        const body: Record<string, string | null> = { name };
        FORM_FIELDS.forEach((k) => {
          const v = form[k].trim();
          body[k] = v === "" ? null : v;
        });
        await apiFetch(`/companies/${props.company.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast({ title: "Company updated" });
        onOpenChange(false);
        await onSaved();
      }
    } catch (err) {
      toast({
        title: mode === "create" ? "Failed to add company" : "Failed to update",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add company" : "Edit company"}</DialogTitle>
          <DialogDescription>
            Companies are employers you generate Letters of Appointment for.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Company name *</Label>
              <Input value={form.name} onChange={(e) => f("name")(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => f("phone")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => f("email")(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => f("address")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={(e) => f("country")(e.target.value)}
                placeholder="e.g. Maldives"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Registration number</Label>
              <Input
                value={form.registrationNumber}
                onChange={(e) => f("registrationNumber")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Signatory name</Label>
              <Input value={form.signatoryName} onChange={(e) => f("signatoryName")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Signatory designation</Label>
              <Input
                value={form.signatoryDesignation}
                onChange={(e) => f("signatoryDesignation")(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 pt-1">
              Bank details
              <span className="text-[11px] text-muted-foreground font-normal">
                Shown on invoices &amp; quotes
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Bank name</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) => f("bankName")(e.target.value)}
                  placeholder="e.g. Bank of Maldives"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Account holder</Label>
                <Input
                  value={form.bankAccountHolder}
                  onChange={(e) => f("bankAccountHolder")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account number</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => f("bankAccountNumber")(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>SWIFT / BIC</Label>
                <Input
                  value={form.bankSwiftCode}
                  onChange={(e) => f("bankSwiftCode")(e.target.value)}
                  placeholder="e.g. BMLIMVMV"
                />
              </div>
            </div>
          </div>

          {companyId && (
            <div className="space-y-3 pt-2 border-t">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 pt-1">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Branding
                {brandingUploading && (
                  <span className="text-[10px] text-muted-foreground animate-pulse ml-1">
                    Saving…
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {BRANDING_SLOTS.map((slot) => (
                  <ImageSlot
                    key={slot.kind}
                    label={slot.label}
                    hint={slot.hint}
                    dataUrl={brandingData?.[slot.kind] ?? null}
                    onPick={(file) => void handleImageUpload(slot.kind, file)}
                    onClear={() => void handleImageClear(slot.kind)}
                    previewClass="h-28"
                    disabled={brandingUploading}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Transparent PNG recommended. Images save immediately when selected.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {mode === "create" && createdId ? "Done" : "Cancel"}
            </Button>
            <Button type="submit" disabled={saving || (mode === "create" && !!createdId)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? (createdId ? "Saved" : "Add company") : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
  onDeleted,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function onConfirm() {
    setDeleting(true);
    try {
      await apiFetch(`/companies/${company.id}`, { method: "DELETE" });
      toast({ title: `${company.name} deleted` });
      onOpenChange(false);
      await onDeleted();
    } catch (err) {
      toast({
        title: "Failed to delete",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{company.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Any candidates assigned to this company will be unlinked (their passport data is kept).
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ImageSlot({
  label,
  hint,
  dataUrl,
  onPick,
  onClear,
  previewClass,
  disabled,
}: {
  label: string;
  hint: string;
  dataUrl: string | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
  previewClass: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        {dataUrl && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
      <div
        className={`relative rounded-md border border-dashed border-border logo-checkerboard overflow-hidden flex items-center justify-center ${previewClass}`}
      >
        {dataUrl ? (
          <BrandImage src={dataUrl} alt={label} className="max-h-full max-w-full" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
            <ImageIcon className="h-5 w-5 opacity-40" />
            <span>No image</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground flex-1 truncate">{hint}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" /> {dataUrl ? "Replace" : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>
    </div>
  );
}
