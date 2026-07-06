import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  UploadCloud,
  File as FileIcon,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Building2,
  FileText,
  Download,
  Eye,
  ChevronRight,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { EmploymentField } from "@/components/employment-field";
import { useCompanyLoaOptions } from "@/hooks/use-company-loa-options";
import {
  apiFetch,
  apiUpload,
  type Company,
  type LoaEntry,
  type Passport,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatEmergencyContact } from "@/lib/emergency-contact";

type WizardStep = "upload" | "company" | "details" | "done";

interface AssignForm {
  companyId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  jobTitle: string;
  workType: string;
  workSite: string;
  basicSalary: string;
  salaryPaymentDate: string;
  workingHours: string;
  workStatus: string;
  contractDuration: string;
  dateOfCommence: string;
  jobDescription: string;
  signatoryName: string;
  signatoryDesignation: string;
  signatureDate: string;
}

const DEFAULT_ASSIGN: AssignForm = {
  companyId: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  jobTitle: "",
  workType: "",
  workSite: "",
  basicSalary: "",
  salaryPaymentDate: "End of each month",
  workingHours: "09:00 to 17:00 Saturday to Sunday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
  dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given the time of signing the contract",
  signatoryName: "",
  signatoryDesignation: "",
  signatureDate: new Date().toLocaleDateString("en-GB"),
};

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Upload & Extract" },
  { id: "company", label: "Select Company" },
  { id: "details", label: "Employment Details" },
  { id: "done", label: "Complete" },
];

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors
              ${
                i === idx
                  ? "bg-primary text-primary-foreground"
                  : i < idx
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
          >
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

function CompanyStep({
  form,
  setForm,
  companies,
  companyLocked,
}: {
  form: AssignForm;
  setForm: React.Dispatch<React.SetStateAction<AssignForm>>;
  companies: Company[];
  companyLocked?: boolean;
}) {
  const selectedCompany = companies.find((c) => String(c.id) === form.companyId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-3.5 w-3.5 text-teal-600" />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          Company Assignment
        </span>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Company (Employer) <span className="text-destructive">*</span>
        </Label>
        <Select
          value={form.companyId}
          disabled={companyLocked}
          onValueChange={(v) => {
            const c = companies.find((x) => String(x.id) === v);
            setForm((s) => ({
              ...s,
              companyId: v,
              jobTitle: "",
              workType: "",
              workSite: "",
              signatoryName: c?.signatoryName ?? s.signatoryName,
              signatoryDesignation: c?.signatoryDesignation ?? s.signatoryDesignation,
            }));
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
        {selectedCompany && (
          <div className="rounded-md bg-muted/50 border border-border p-2.5 text-xs text-muted-foreground space-y-0.5">
            {selectedCompany.address && <p>{selectedCompany.address}</p>}
            {selectedCompany.country && <p>{selectedCompany.country}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailsStep({
  form,
  setForm,
  companyName,
}: {
  form: AssignForm;
  setForm: React.Dispatch<React.SetStateAction<AssignForm>>;
  companyName?: string;
}) {
  const companyId = form.companyId ? Number(form.companyId) : undefined;
  const { jobTitleOpts, workTypeOpts, workSiteOpts } = useCompanyLoaOptions(companyId);

  const f = (
    key: keyof AssignForm,
    label: string,
    placeholder?: string,
    multiline?: boolean,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {multiline ? (
        <Textarea
          rows={2}
          value={form[key]}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      ) : (
        <Input
          value={form[key]}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          placeholder={placeholder}
          data-testid={`input-${key}`}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {companyName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          <span>
            Company: <span className="font-medium text-foreground">{companyName}</span>
          </span>
        </div>
      )}

      <div className="pt-1 border-t border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            Employment Details
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EmploymentField
            label="Job Title"
            value={form.jobTitle}
            onChange={(v) => setForm((s) => ({ ...s, jobTitle: v }))}
            options={jobTitleOpts}
            testId="job-title"
          />
          <EmploymentField
            label="Work Type"
            value={form.workType}
            onChange={(v) => setForm((s) => ({ ...s, workType: v }))}
            options={workTypeOpts}
            testId="work-type"
          />
          {f("basicSalary", "Basic Salary (USD)", "e.g. 500")}
          {f("salaryPaymentDate", "Salary Payment Date")}
          <EmploymentField
            label="Work Site"
            value={form.workSite}
            onChange={(v) => setForm((s) => ({ ...s, workSite: v }))}
            options={workSiteOpts}
            testId="work-site"
            className="col-span-1 sm:col-span-2"
          />
          {f("dateOfCommence", "Date of Commence")}
          {f("workStatus", "Work Status")}
          {f("contractDuration", "Contract Duration")}
        </div>
        {f("workingHours", "Working Hours")}
        {f("jobDescription", "Job Description", "", true)}
      </div>

      <div className="pt-1 border-t border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            Candidate &amp; Signatory
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {f("emergencyContactName", "Emergency Contact Name", "e.g. Jane Doe")}
          {f("emergencyContactPhone", "Emergency Contact Phone", "e.g. +880-123-456789")}
          {f("signatoryName", "Signatory Name", "Full name of signing authority")}
          {f("signatoryDesignation", "Signatory Designation", "e.g. Managing Director")}
          {f("signatureDate", "Signature Date", "DD/MM/YYYY")}
        </div>
      </div>
    </div>
  );
}

function DoneStep({
  loaId,
  candidateName,
  companyName,
  onReset,
}: {
  loaId: number;
  candidateName: string | null;
  companyName: string | null;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Passport processed &amp; LOA created
              </h3>
              {candidateName && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {candidateName}
                  {companyName && <> · {companyName}</>}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/loa/${loaId}/print`}>
            <Eye className="h-4 w-4 mr-2" /> View LOA
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a
            href={`/api/loa/${loaId}/pdf`}
            download={`LOA-${candidateName?.replace(/\s+/g, "-") ?? loaId}.pdf`}
          >
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </a>
        </Button>
      </div>

      <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/master-list">
            <Users className="h-4 w-4 mr-2" /> Go to Master List
          </Link>
        </Button>
        <Button variant="ghost" onClick={onReset} data-testid="button-process-another">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Process another document
        </Button>
      </div>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 pb-3 border-b border-border/60">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-foreground ${mono ? "font-mono uppercase tracking-wide" : ""}`}
      >
        {value || (
          <span className="text-muted-foreground/50 italic font-normal normal-case">
            Not detected
          </span>
        )}
      </dd>
    </div>
  );
}

export function UploadPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("upload");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [activePassportId, setActivePassportId] = useState<number | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [passportNotFound, setPassportNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingLoa, setCreatingLoa] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignForm>(DEFAULT_ASSIGN);
  const [createdLoaId, setCreatedLoaId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const companyLocked = user?.role === "company" && !!user.linkedEntityId;

  const loadCompanies = useCallback(async () => {
    try {
      setCompanies(await apiFetch<Company[]>("/companies"));
    } catch {
      // optional
    }
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (user?.role === "company" && user.linkedEntityId) {
      setAssignForm((s) => ({
        ...s,
        companyId: user.linkedEntityId!,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!activePassportId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const p = await apiFetch<Passport>(`/passports/${activePassportId}`);
        if (cancelled) return;
        setPassport(p);
        setPassportNotFound(false);
        if (p.status === "processing") {
          timeoutId = setTimeout(() => void poll(), 2000);
        }
      } catch {
        if (!cancelled) setPassportNotFound(true);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activePassportId]);

  useEffect(() => {
    if (!passport) return;
    setAssignForm((s) => ({
      ...s,
      emergencyContactName: passport.emergencyContactName?.trim() || s.emergencyContactName,
      emergencyContactPhone: passport.emergencyContactPhone?.trim() || s.emergencyContactPhone,
    }));
  }, [passport?.emergencyContactName, passport?.emergencyContactPhone]);

  function reset() {
    setFile(null);
    setActivePassportId(null);
    setPassport(null);
    setPassportNotFound(false);
    setAssignForm({
      ...DEFAULT_ASSIGN,
      companyId: user?.role === "company" && user.linkedEntityId ? user.linkedEntityId : "",
    });
    setCreatedLoaId(null);
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }

  function handleFile(selectedFile: File) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WEBP or PDF file.",
        variant: "destructive",
      });
      return;
    }
    setFile(selectedFile);
    setActivePassportId(null);
    setPassport(null);
    setPassportNotFound(false);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (user?.role === "company" && user.linkedEntityId) {
        fd.append("companyId", user.linkedEntityId);
      }
      const created = await apiUpload<Passport>("/passports/upload", fd);
      setActivePassportId(created.id);
      setPassport(created);
      toast({ title: "Upload successful", description: "Document queued for processing." });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof ApiError ? err.message : "There was an error uploading the document.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateLoa() {
    if (!passport || !activePassportId || !assignForm.companyId) return;

    const selectedCompany = companies.find((c) => String(c.id) === assignForm.companyId);
    const cid = Number(assignForm.companyId);

    setCreatingLoa(true);
    try {
      await apiFetch(`/passports/${activePassportId}`, {
        method: "PATCH",
        body: JSON.stringify({
          companyId: cid,
          emergencyContactName: assignForm.emergencyContactName.trim() || null,
          emergencyContactPhone: assignForm.emergencyContactPhone.trim() || null,
        }),
      });

      const loa = await apiFetch<LoaEntry>("/loa", {
        method: "POST",
        body: JSON.stringify({
          companyId: cid,
          passportId: activePassportId,
          companyName: selectedCompany?.name,
          companyAddress: selectedCompany?.address ?? null,
          companyEmail: selectedCompany?.email ?? null,
          companyPhone: selectedCompany?.phone ?? null,
          companyCountry: selectedCompany?.country ?? null,
          companyRegistrationNumber: selectedCompany?.registrationNumber ?? null,
          candidateName: passport.fullName ?? null,
          candidateAddress: passport.address ?? null,
          candidateNationality: passport.nationality ?? null,
          candidateDateOfBirth: passport.dateOfBirth ?? null,
          candidatePassportNumber: passport.passportNumber ?? null,
          candidateEmergencyContact:
            formatEmergencyContact(
              assignForm.emergencyContactName,
              assignForm.emergencyContactPhone,
            ) || null,
          jobTitle: assignForm.jobTitle || null,
          workType: assignForm.workType || null,
          basicSalary: assignForm.basicSalary || null,
          salaryPaymentDate: assignForm.salaryPaymentDate || null,
          workSite: assignForm.workSite || null,
          dateOfCommence: assignForm.dateOfCommence || null,
          jobDescription: assignForm.jobDescription || null,
          workingHours: assignForm.workingHours || null,
          workStatus: assignForm.workStatus || null,
          contractDuration: assignForm.contractDuration || null,
          signatoryName: assignForm.signatoryName || null,
          signatoryDesignation: assignForm.signatoryDesignation || null,
          signatureDate: assignForm.signatureDate || null,
        }),
      });

      setCreatedLoaId(loa.id);
      setStep("done");
      toast({ title: "LOA created successfully" });
    } catch (err) {
      toast({
        title: err instanceof ApiError && err.message.includes("assign") ? "Failed to assign company" : "Failed to create LOA",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setCreatingLoa(false);
    }
  }

  const selectedCompanyForDone = companies.find((c) => String(c.id) === assignForm.companyId);
  const extractionFailed =
    passportNotFound || passport?.status === "failed";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            AI Vision · OCR
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Process Document</h1>
        <p className="text-muted-foreground mt-2">
          Upload a passport image or PDF — fields are extracted automatically, then assign a company
          and employment details. A Letter of Appointment is created when you complete the wizard.
        </p>
      </div>

      <StepIndicator current={step} />

      {step === "upload" && (
        <div className="space-y-4">
          {!activePassportId ? (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div
                  className={`relative rounded-xl border-2 border-dashed p-10 md:p-16 text-center transition-all duration-200
                    ${
                      dragActive
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border bg-gradient-to-b from-muted/30 to-transparent hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf,.webp"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <div className="mx-auto flex max-w-[460px] flex-col items-center justify-center text-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 blur-xl" />
                      <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <UploadCloud className="h-9 w-9 text-white" />
                      </div>
                    </div>
                    <h3 className="mt-6 text-lg md:text-xl font-semibold tracking-tight">
                      Drop your document here
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      or click to browse · Supports JPEG, PNG, WEBP, PDF · Max 20MB
                    </p>
                    <Button className="mt-5 shadow-sm" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud className="h-4 w-4 mr-2" /> Browse Files
                    </Button>
                    <div className="mt-6 flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" /> Secure
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-violet-500" /> Auto-extract
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-amber-500" /> ~5s avg
                      </span>
                    </div>
                  </div>
                </div>

                {file && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4 border border-border/60 rounded-lg bg-card shadow-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <FileIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={reset}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleUpload()}
                        disabled={uploading}
                        className="shadow-sm"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-3.5 w-3.5" /> Begin Extraction
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm
                        ${
                          passport?.status === "completed"
                            ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                            : extractionFailed
                              ? "bg-gradient-to-br from-rose-500 to-red-500"
                              : "bg-gradient-to-br from-amber-500 to-orange-500"
                        }`}
                    >
                      {passport?.status === "processing" && !extractionFailed && (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      )}
                      {passport?.status === "completed" && (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      )}
                      {extractionFailed && <AlertCircle className="h-5 w-5 text-white" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {passport?.status === "processing" && !extractionFailed && "Extracting data..."}
                        {passport?.status === "completed" && "Extraction complete"}
                        {extractionFailed && "Extraction failed"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {file?.name || passport?.originalFilename}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={reset}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Document
                  </Button>
                </div>

                {extractionFailed && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Extraction Failed</AlertTitle>
                    <AlertDescription>
                      {passportNotFound
                        ? "OCR extraction failed. The document could not be read — please try again with a clearer image."
                        : passport?.errorMessage || "An unknown error occurred during OCR processing."}
                    </AlertDescription>
                  </Alert>
                )}

                {passport?.status === "completed" && (
                  <>
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <DataRow label="Full Name" value={passport.fullName} />
                      <DataRow label="Passport Number" value={passport.passportNumber} mono />
                      <DataRow label="Nationality" value={passport.nationality} />
                      <DataRow label="Date of Birth" value={passport.dateOfBirth} />
                      <DataRow label="Date of Issue" value={passport.dateOfIssue} />
                      <DataRow label="Date of Expiry" value={passport.dateOfExpiry} />
                      <div className="col-span-1 md:col-span-2">
                        <DataRow label="Address" value={passport.address} />
                      </div>
                      <DataRow label="Emergency Contact Name" value={passport.emergencyContactName} />
                      <DataRow label="Emergency Contact Phone" value={passport.emergencyContactPhone} />
                    </div>

                    <div className="mt-5 pt-4 border-t border-border/60 flex justify-end">
                      <Button onClick={() => setStep("company")}>
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </>
                )}

                {passport?.status === "processing" && !extractionFailed && (
                  <div className="mt-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === "company" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            {passport && (
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
                <Badge variant="secondary" className="text-xs">
                  {passport.nationality ?? "Unknown"}
                </Badge>
                <span className="text-sm font-medium">{passport.fullName ?? "(unnamed)"}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {passport.passportNumber}
                </span>
              </div>
            )}

            {companies.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                No companies configured yet. Go to{" "}
                <Link href="/companies" className="text-primary font-medium hover:underline">
                  Companies
                </Link>{" "}
                to add one first.
              </div>
            ) : (
              <CompanyStep
                form={assignForm}
                setForm={setAssignForm}
                companies={companies}
                companyLocked={companyLocked}
              />
            )}

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border/60">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("details")}
                disabled={!assignForm.companyId}
              >
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "details" && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            {passport && (
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/60">
                <Badge variant="secondary" className="text-xs">
                  {passport.nationality ?? "Unknown"}
                </Badge>
                <span className="text-sm font-medium">{passport.fullName ?? "(unnamed)"}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {passport.passportNumber}
                </span>
              </div>
            )}

            <DetailsStep
              form={assignForm}
              setForm={setAssignForm}
              companyName={selectedCompanyForDone?.name}
            />

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border/60">
              <Button variant="outline" onClick={() => setStep("company")}>
                Back
              </Button>
              <Button
                onClick={() => void handleCreateLoa()}
                disabled={!assignForm.companyId || creatingLoa}
              >
                {creatingLoa ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Completing...
                  </>
                ) : (
                  <>
                    Complete <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && createdLoaId != null && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            <DoneStep
              loaId={createdLoaId}
              candidateName={passport?.fullName ?? null}
              companyName={selectedCompanyForDone?.name ?? null}
              onReset={reset}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
