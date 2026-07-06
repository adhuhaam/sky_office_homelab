import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Briefcase,
  Check,
  Hammer,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { apiFetch, ApiError, type Company, type LoaOption } from "@/lib/api";
import { uploadCompanyBranding, BRANDING_SLOTS, type BrandingImageKind } from "@/lib/branding-upload";
import { BrandImage } from "@/components/brand-image";

const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const LOA_CATEGORIES = [
  {
    category: "job_title" as const,
    label: "Job Titles",
    description: "Roles / occupations selectable in the LOA form.",
    icon: Briefcase,
    accent: "from-indigo-500 to-violet-500",
    placeholder: "e.g. Construction Worker",
  },
  {
    category: "work_type" as const,
    label: "Work Types",
    description: "Type of work (manual, technical, supervisory…).",
    icon: Hammer,
    accent: "from-amber-500 to-orange-500",
    placeholder: "e.g. Manual Labour",
  },
  {
    category: "work_site" as const,
    label: "Work Sites",
    description: "Project locations or employment sites.",
    icon: MapPin,
    accent: "from-emerald-500 to-teal-500",
    placeholder: "e.g. Guraidhoo, Maldives",
  },
] as const;

export interface CompanyDetailDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (company: Company) => void;
  onRefresh?: () => void;
}

export function CompanyDetailDialog({
  company,
  open,
  onOpenChange,
  onEdit,
  onRefresh,
}: CompanyDetailDialogProps) {
  const [tab, setTab] = useState("info");
  const [brandingData, setBrandingData] = useState<Company | null>(null);

  const loadBranding = useCallback(async () => {
    try {
      const branded = await apiFetch<Company[]>("/companies?withBranding=true");
      setBrandingData(branded.find((c) => c.id === company.id) ?? null);
    } catch {
      setBrandingData(null);
    }
  }, [company.id]);

  useEffect(() => {
    if (open) {
      void loadBranding();
    }
  }, [open, loadBranding]);

  const handleRefresh = () => {
    void loadBranding();
    onRefresh?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col gap-0 p-0">
        <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow flex-shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold leading-tight">{company.name}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {[company.address, company.country].filter(Boolean).join(" · ") || "No address on record"}
            </DialogDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit(company)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-0 w-fit">
            <TabsTrigger value="info">Info &amp; Branding</TabsTrigger>
            <TabsTrigger value="job_title">Job Titles</TabsTrigger>
            <TabsTrigger value="work_type">Work Types</TabsTrigger>
            <TabsTrigger value="work_site">Work Sites</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <TabsContent value="info" className="mt-0 space-y-6">
              <CompanyInfoPanel
                company={company}
                brandingData={brandingData}
                onRefresh={handleRefresh}
              />
            </TabsContent>

            {LOA_CATEGORIES.map((cfg) => (
              <TabsContent key={cfg.category} value={cfg.category} className="mt-0">
                <OptionList companyId={company.id} cfg={cfg} open={open && tab === cfg.category} />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CompanyInfoPanel({
  company,
  brandingData,
  onRefresh,
}: {
  company: Company;
  brandingData: Company | null;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [brandingUploading, setBrandingUploading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleBrandingUpload = async (
    kind: BrandingImageKind,
    file: File | null,
  ) => {
    if (!file) return;
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
      await uploadCompanyBranding(company.id, kind, file);
      onRefresh();
      toast({ title: "Image saved" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save image",
        variant: "destructive",
      });
    } finally {
      setBrandingUploading(false);
    }
  };

  const handleBrandingClear = async (kind: BrandingImageKind) => {
    setClearing(true);
    try {
      await apiFetch(`/companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [kind]: null }),
      });
      onRefresh();
      toast({ title: "Image removed" });
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Failed to remove",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Phone", value: company.phone },
    { label: "Email", value: company.email },
    { label: "Country", value: company.country },
    { label: "Registration No.", value: company.registrationNumber },
    { label: "Signatory Name", value: company.signatoryName },
    { label: "Signatory Designation", value: company.signatoryDesignation },
  ];

  const disabled = brandingUploading || clearing;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              {label}
            </p>
            <p className="text-sm font-medium truncate">
              {value || <span className="text-muted-foreground font-normal">—</span>}
            </p>
          </div>
        ))}
        {company.address && (
          <div className="col-span-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              Address
            </p>
            <p className="text-sm">{company.address}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-muted-foreground" /> Branding
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BRANDING_SLOTS.map((slot) => (
            <ImageSlot
              key={slot.kind}
              label={slot.label}
              hint={slot.hint}
              dataUrl={brandingData?.[slot.kind] ?? null}
              onPick={(f) => void handleBrandingUpload(slot.kind, f)}
              onClear={() => void handleBrandingClear(slot.kind)}
              previewClass="h-28"
              testId={`${slot.kind}-${company.id}`}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageSlot({
  label,
  hint,
  dataUrl,
  onPick,
  onClear,
  previewClass,
  testId,
  disabled,
}: {
  label: string;
  hint: string;
  dataUrl: string | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
  previewClass: string;
  testId: string;
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
          data-testid={`button-upload-${testId}`}
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

function OptionList({
  companyId,
  cfg,
  open,
}: {
  companyId: number;
  cfg: (typeof LOA_CATEGORIES)[number];
  open: boolean;
}) {
  const Icon = cfg.icon;
  const { toast } = useToast();
  const [options, setOptions] = useState<LoaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<LoaOption[]>(
        `/loa-options?companyId=${companyId}&category=${cfg.category}`,
      );
      setOptions(rows);
    } catch (err) {
      toast({
        title: "Failed to load options",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, cfg.category, toast]);

  useEffect(() => {
    if (open) void loadOptions();
  }, [open, loadOptions]);

  const handleAdd = async () => {
    const v = value.trim();
    if (!v) return;
    setSaving(true);
    try {
      await apiFetch<LoaOption>("/loa-options", {
        method: "POST",
        body: JSON.stringify({ companyId, category: cfg.category, value: v }),
      });
      setValue("");
      await loadOptions();
      toast({ title: `Added "${v}"` });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast({
        title: status === 409 ? "Already exists" : "Failed to add",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (opt: LoaOption) => {
    const v = editValue.trim();
    if (!v || v === opt.value) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/loa-options/${opt.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value: v }),
      });
      await loadOptions();
      cancelEdit();
      toast({ title: `Renamed to "${v}"` });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast({
        title: status === 409 ? "Already exists" : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const opt = options.find((o) => o.id === id);
    setSaving(true);
    try {
      await apiFetch(`/loa-options/${id}`, { method: "DELETE" });
      await loadOptions();
      setConfirmDeleteId(null);
      if (opt) toast({ title: `Removed "${opt.value}"` });
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Failed to remove",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const pendingDelete = confirmDeleteId != null ? options.find((o) => o.id === confirmDeleteId) : null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`h-9 w-9 rounded-lg bg-gradient-to-br ${cfg.accent} flex items-center justify-center shadow-sm flex-shrink-0`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{cfg.label}</h3>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                {options.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={cfg.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <Button size="sm" onClick={() => void handleAdd()} disabled={!value.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : options.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            No {cfg.label.toLowerCase()} yet. Add one above.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {options.map((opt) => {
              const isEditing = editingId === opt.id;
              return (
                <li
                  key={opt.id}
                  className="group flex items-center gap-2 rounded-md border border-border/60 bg-card pl-3 pr-1.5 py-1.5 hover:border-primary/40 transition-colors"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveEdit(opt);
                          } else if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="h-7 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                        onClick={() => void saveEdit(opt)}
                        disabled={!editValue.trim() || saving}
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={cancelEdit}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="truncate flex-1 text-sm py-0.5">{opt.value}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        onClick={() => {
                          setEditingId(opt.id);
                          setEditValue(opt.value);
                        }}
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        onClick={() => setConfirmDeleteId(opt.id)}
                        disabled={saving}
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={confirmDeleteId != null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{pendingDelete?.value}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the option from {cfg.label}. Existing LOAs that referenced it are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId != null && void handleDelete(confirmDeleteId)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
