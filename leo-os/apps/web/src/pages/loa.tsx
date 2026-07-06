import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Eye,
  Trash2,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { DataTableCard } from "@/components/data-table-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  apiFetch,
  type Company,
  type LoaEntry,
  type LoaOption,
  type Passport,
  ApiError,
} from "@/lib/api";

const STEPS = ["Select Company & Candidate", "Employment Details", "Signatory"] as const;
type Step = 0 | 1 | 2;

interface FormData {
  companyId: string;
  passportId: string;
  candidateEmergencyContact: string;
  jobTitle: string;
  workType: string;
  basicSalary: string;
  salaryPaymentDate: string;
  workSite: string;
  dateOfCommence: string;
  jobDescription: string;
  workingHours: string;
  workStatus: string;
  contractDuration: string;
  signatoryName: string;
  signatoryDesignation: string;
  signatureDate: string;
}

const DEFAULT_FORM: FormData = {
  companyId: "",
  passportId: "",
  candidateEmergencyContact: "",
  jobTitle: "",
  workType: "",
  basicSalary: "",
  salaryPaymentDate: "End of each month",
  workSite: "",
  dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given the time of signing the contract",
  workingHours: "09:00 to 17:00 Saturday to Sunday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
  signatoryName: "",
  signatoryDesignation: "",
  signatureDate: new Date().toLocaleDateString("en-GB"),
};

function OptionPicker({
  label,
  value,
  onChange,
  options,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: LoaOption[];
  placeholder: string;
  testId: string;
}) {
  const inList = !value || options.some((o) => o.value === value);
  const [customMode, setCustomMode] = useState(!inList && !!value);
  const showCustom = customMode || options.length === 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {options.length > 0 && (
          <button
            type="button"
            className="text-[10px] text-primary hover:underline"
            onClick={() => {
              setCustomMode((m) => !m);
              if (!customMode) onChange("");
            }}
          >
            {showCustom ? "Pick from list" : "Type custom"}
          </button>
        )}
      </div>
      {showCustom ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            options.length === 0
              ? `${placeholder} (add to Settings to enable dropdown)`
              : placeholder
          }
          data-testid={`input-${testId}`}
        />
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={`select-${testId}`}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.value} data-testid={`option-${testId}-${o.id}`}>
                {o.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function StepOne({
  form,
  setForm,
  companies,
  passports,
  onNewCompany,
}: {
  form: FormData;
  setForm: (f: FormData) => void;
  companies: Company[];
  passports: Passport[];
  onNewCompany: () => void;
}) {
  const selectedPassport = passports.find((p) => String(p.id) === form.passportId);
  const selectedCompany = companies.find((c) => String(c.id) === form.companyId);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Company (Employer)
          </Label>
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={onNewCompany}
            data-testid="button-add-company"
          >
            + Add new
          </button>
        </div>
        <Select
          value={form.companyId}
          onValueChange={(v) => {
            const c = companies.find((x) => String(x.id) === v);
            const prev = companies.find((x) => String(x.id) === form.companyId);
            setForm({
              ...form,
              companyId: v,
              signatoryName:
                form.signatoryName && form.signatoryName !== (prev?.signatoryName ?? "")
                  ? form.signatoryName
                  : c?.signatoryName ?? "",
              signatoryDesignation:
                form.signatoryDesignation &&
                form.signatoryDesignation !== (prev?.signatoryDesignation ?? "")
                  ? form.signatoryDesignation
                  : c?.signatoryDesignation ?? "",
            });
          }}
        >
          <SelectTrigger data-testid="select-company">
            <SelectValue placeholder="Select a company..." />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} data-testid={`option-company-${c.id}`}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCompany && (selectedCompany.address || selectedCompany.country) && (
          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-0.5">
            {selectedCompany.address && <p>{selectedCompany.address}</p>}
            {selectedCompany.country && <p>{selectedCompany.country}</p>}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" /> Candidate (Employee)
        </Label>
        <Select
          value={form.passportId}
          onValueChange={(v) => setForm({ ...form, passportId: v })}
        >
          <SelectTrigger data-testid="select-candidate">
            <SelectValue
              placeholder={
                passports.length === 0
                  ? "No passport records yet — upload one first"
                  : "Select a candidate..."
              }
            />
          </SelectTrigger>
          <SelectContent>
            {passports.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No passport records found. Upload a passport first from the Upload page.
              </div>
            )}
            {passports.map((p) => {
              const label = p.fullName || "(unnamed)";
              const num = p.passportNumber ? ` — ${p.passportNumber}` : "";
              const status = p.status !== "completed" ? ` [${p.status}]` : "";
              return (
                <SelectItem
                  key={p.id}
                  value={String(p.id)}
                  data-testid={`option-candidate-${p.id}`}
                >
                  {label}
                  {num}
                  {status}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedPassport && (
          <div className="rounded-md bg-muted/50 border border-border p-3 text-xs space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>
                Nationality:{" "}
                <span className="text-foreground capitalize">{selectedPassport.nationality}</span>
              </span>
              <span>
                DOB: <span className="text-foreground">{selectedPassport.dateOfBirth}</span>
              </span>
              <span>
                Passport:{" "}
                <span className="text-foreground font-mono">{selectedPassport.passportNumber}</span>
              </span>
            </div>
            {selectedPassport.address && (
              <p className="text-muted-foreground">
                Address: <span className="text-foreground">{selectedPassport.address}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Emergency Contact (name & number)</Label>
        <Input
          placeholder="e.g. Jane Doe, +880-123-456789"
          value={form.candidateEmergencyContact}
          onChange={(e) => setForm({ ...form, candidateEmergencyContact: e.target.value })}
          data-testid="input-emergency-contact"
        />
      </div>
    </div>
  );
}

function StepTwo({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  const companyId = form.companyId ? Number(form.companyId) : 0;
  const enabled = !!form.companyId;
  const [jobTitles, setJobTitles] = useState<LoaOption[]>([]);
  const [workTypes, setWorkTypes] = useState<LoaOption[]>([]);
  const [workSites, setWorkSites] = useState<LoaOption[]>([]);

  useEffect(() => {
    if (!enabled) {
      setJobTitles([]);
      setWorkTypes([]);
      setWorkSites([]);
      return;
    }

    let cancelled = false;

    async function loadOptions() {
      try {
        const [jt, wt, ws] = await Promise.all([
          apiFetch<LoaOption[]>(`/loa-options?companyId=${companyId}&category=job_title`),
          apiFetch<LoaOption[]>(`/loa-options?companyId=${companyId}&category=work_type`),
          apiFetch<LoaOption[]>(`/loa-options?companyId=${companyId}&category=work_site`),
        ]);
        if (!cancelled) {
          setJobTitles(jt);
          setWorkTypes(wt);
          setWorkSites(ws);
        }
      } catch {
        if (!cancelled) {
          setJobTitles([]);
          setWorkTypes([]);
          setWorkSites([]);
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [companyId, enabled]);

  const f = (key: keyof FormData, label: string, placeholder?: string, multiline?: boolean) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea
          rows={2}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      ) : (
        <Input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      )}
    </div>
  );

  const noOptions = jobTitles.length === 0 && workTypes.length === 0 && workSites.length === 0;

  return (
    <div className="space-y-4">
      {noOptions && enabled && (
        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Tip: Add Job Titles, Work Types, and Work Sites for this company in{" "}
          <Link href="/companies" className="text-primary font-medium hover:underline">
            Companies
          </Link>{" "}
          to enable dropdowns here.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <OptionPicker
          label="Job Title / Occupation"
          value={form.jobTitle}
          onChange={(v) => setForm({ ...form, jobTitle: v })}
          options={jobTitles}
          placeholder="e.g. Construction Worker"
          testId="jobTitle"
        />
        <OptionPicker
          label="Work Type"
          value={form.workType}
          onChange={(v) => setForm({ ...form, workType: v })}
          options={workTypes}
          placeholder="e.g. Manual Labour"
          testId="workType"
        />
        {f("basicSalary", "Basic Salary (USD)", "e.g. 500")}
        {f("salaryPaymentDate", "Date of Salary Payment")}
        <OptionPicker
          label="Work Site"
          value={form.workSite}
          onChange={(v) => setForm({ ...form, workSite: v })}
          options={workSites}
          placeholder="e.g. Guraidhoo, Maldives"
          testId="workSite"
        />
        {f("dateOfCommence", "Date of Commence")}
        {f("workStatus", "Work Status")}
        {f("contractDuration", "Contract Duration")}
      </div>
      {f("workingHours", "Working Hours")}
      {f("jobDescription", "Job Description", "", true)}
    </div>
  );
}

function StepThree({ form, setForm }: { form: FormData; setForm: (f: FormData) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Signature Date</Label>
        <Input
          value={form.signatureDate}
          onChange={(e) => setForm({ ...form, signatureDate: e.target.value })}
          placeholder="DD/MM/YYYY"
          data-testid="input-signatureDate"
        />
      </div>
    </div>
  );
}

function AddCompanyDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Company) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [regNum, setRegNum] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const company = await apiFetch<Company>("/companies", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
          registrationNumber: regNum.trim() || null,
          signatoryName: signatoryName.trim() || null,
          signatoryDesignation: signatoryDesignation.trim() || null,
        }),
      });
      toast({ title: "Company saved" });
      onSaved(company);
      onClose();
    } catch (err) {
      toast({
        title: "Failed to save company",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Company</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Company Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-company-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-company-address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-company-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+960 999 0000"
                data-testid="input-company-phone"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} data-testid="input-company-country" />
            </div>
            <div className="space-y-1.5">
              <Label>Registration Number</Label>
              <Input value={regNum} onChange={(e) => setRegNum(e.target.value)} data-testid="input-company-regnum" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <div className="space-y-1.5">
              <Label>Signatory Name</Label>
              <Input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                placeholder="Abdulla Muneeb"
                data-testid="input-company-signatory-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input
                value={signatoryDesignation}
                onChange={(e) => setSignatoryDesignation(e.target.value)}
                placeholder="Managing Director"
                data-testid="input-company-signatory-designation"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving} data-testid="button-save-company">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoaPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [entries, setEntries] = useState<LoaEntry[]>([]);
  const [passports, setPassports] = useState<Passport[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loaList, passportList, companyList] = await Promise.all([
        apiFetch<LoaEntry[]>("/loa"),
        apiFetch<Passport[]>("/passports"),
        apiFetch<Company[]>("/companies"),
      ]);
      setEntries(loaList);
      setPassports(passportList);
      setCompanies(companyList);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load";
      setLoadError(message);
      toast({
        title: "Failed to load",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCompany = companies.find((c) => String(c.id) === form.companyId);
  const selectedPassport = passports.find((p) => String(p.id) === form.passportId);

  const canNext = () => {
    if (step === 0) return !!form.companyId && !!form.passportId;
    if (step === 1) return !!form.jobTitle.trim();
    return true;
  };

  async function handleGenerate() {
    if (!selectedCompany || !selectedPassport) return;
    setGenerating(true);
    try {
      const loa = await apiFetch<LoaEntry>("/loa", {
        method: "POST",
        body: JSON.stringify({
          companyId: Number(form.companyId),
          passportId: Number(form.passportId),
          companyName: selectedCompany.name,
          companyAddress: selectedCompany.address ?? undefined,
          companyEmail: selectedCompany.email ?? undefined,
          companyPhone: selectedCompany.phone ?? undefined,
          companyCountry: selectedCompany.country ?? undefined,
          companyRegistrationNumber: selectedCompany.registrationNumber ?? undefined,
          candidateName: selectedPassport.fullName ?? undefined,
          candidateAddress: selectedPassport.address ?? undefined,
          candidateNationality: selectedPassport.nationality ?? undefined,
          candidateDateOfBirth: selectedPassport.dateOfBirth ?? undefined,
          candidatePassportNumber: selectedPassport.passportNumber ?? undefined,
          candidateEmergencyContact: form.candidateEmergencyContact || undefined,
          jobTitle: form.jobTitle,
          workType: form.workType,
          basicSalary: form.basicSalary,
          salaryPaymentDate: form.salaryPaymentDate,
          workSite: form.workSite,
          dateOfCommence: form.dateOfCommence,
          jobDescription: form.jobDescription,
          workingHours: form.workingHours,
          workStatus: form.workStatus,
          contractDuration: form.contractDuration,
          signatoryName: form.signatoryName,
          signatoryDesignation: form.signatoryDesignation,
          signatureDate: form.signatureDate,
        }),
      });
      setCreateOpen(false);
      setStep(0);
      setForm(DEFAULT_FORM);
      navigate(`/loa/${loa.id}/print`);
    } catch (err) {
      toast({
        title: "Failed to generate LOA",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await apiFetch(`/loa/${id}`, { method: "DELETE" });
      toast({ title: "LOA deleted" });
      setDeleteId(null);
      load();
    } catch (err) {
      toast({
        title: "Failed to delete LOA",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Letter of Appointment"
        description="Generate and manage LOA documents for candidates"
        action={
          <Button
            size="sm"
            onClick={() => {
              setCreateOpen(true);
              setStep(0);
              setForm(DEFAULT_FORM);
            }}
            data-testid="button-create-loa"
          >
            <Plus className="h-4 w-4" />
            Generate LOA
          </Button>
        }
      />

      {loadError && (
        <LoadErrorBanner message={loadError} onRetry={() => void load()} retrying={loading} />
      )}

      <p className="text-sm text-muted-foreground mb-4">
        Total: <strong className="text-foreground">{entries.length}</strong>
      </p>

      <DataTableCard
        loading={loading}
        empty={!loading && entries.length === 0}
        emptyMessage="No LOA entries yet. Click Generate LOA to create your first Letter of Appointment."
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4 uppercase text-[11px] tracking-wider">#</TableHead>
              <TableHead className="px-4 uppercase text-[11px] tracking-wider">Candidate</TableHead>
              <TableHead className="px-4 uppercase text-[11px] tracking-wider hidden md:table-cell">
                Company
              </TableHead>
              <TableHead className="px-4 uppercase text-[11px] tracking-wider hidden sm:table-cell">
                Job Title
              </TableHead>
              <TableHead className="px-4 uppercase text-[11px] tracking-wider hidden lg:table-cell">
                Created
              </TableHead>
              <TableHead className="px-4 text-right uppercase text-[11px] tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((loa) => (
              <TableRow key={loa.id} data-testid={`row-loa-${loa.id}`}>
                <TableCell className="px-4 text-muted-foreground font-mono text-xs">{loa.id}</TableCell>
                <TableCell className="px-4 font-medium">
                  {loa.candidateName ?? <span className="text-muted-foreground italic text-xs">—</span>}
                </TableCell>
                <TableCell className="px-4 text-muted-foreground hidden md:table-cell">
                  {loa.companyName ?? "—"}
                </TableCell>
                <TableCell className="px-4 text-muted-foreground hidden sm:table-cell">
                  {loa.jobTitle ?? "—"}
                </TableCell>
                <TableCell className="px-4 text-muted-foreground text-xs hidden lg:table-cell">
                  {new Date(loa.createdAt).toLocaleDateString("en-GB")}
                </TableCell>
                <TableCell className="px-4 text-right space-x-1">
                  <Link href={`/loa/${loa.id}/print`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      title="View LOA"
                      data-testid={`button-view-loa-${loa.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => setDeleteId(loa.id)}
                    title="Delete"
                    data-testid={`button-delete-loa-${loa.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setStep(0);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Letter of Appointment</DialogTitle>
            <div className="flex items-center gap-1 pt-2">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                      i === step
                        ? "bg-primary text-primary-foreground"
                        : i < step
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                      {i + 1}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="py-2">
            {step === 0 && (
              <StepOne
                form={form}
                setForm={setForm}
                companies={companies}
                passports={passports}
                onNewCompany={() => setAddCompanyOpen(true)}
              />
            )}
            {step === 1 && <StepTwo form={form} setForm={setForm} />}
            {step === 2 && <StepThree form={form} setForm={setForm} />}
          </div>

          <DialogFooter className="gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
                Back
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setStep(0);
              }}
            >
              Cancel
            </Button>
            {step < 2 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={!canNext()}
                data-testid="button-next-step"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!canNext() || generating}
                data-testid="button-generate-loa"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Generating...
                  </>
                ) : (
                  "Generate & View LOA"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddCompanyDialog
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
        onSaved={(c) => {
          setCompanies((prev) => [...prev, c]);
          setForm((f) => ({
            ...f,
            companyId: String(c.id),
            signatoryName: c.signatoryName ?? "",
            signatoryDesignation: c.signatoryDesignation ?? "",
          }));
        }}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete LOA?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this Letter of Appointment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              data-testid="button-confirm-delete-loa"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
