import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyRound,
  Search,
  Pencil,
  Eye,
  EyeOff,
  Copy,
  Check,
  Loader2,
  Building2,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type PasswordEntry, ApiError } from "@/lib/api";

interface PasswordFormState {
  efaasUsername: string;
  efaasPassword: string;
  gmailUsername: string;
  gmailPassword: string;
}

const EMPTY_FORM: PasswordFormState = {
  efaasUsername: "",
  efaasPassword: "",
  gmailUsername: "",
  gmailPassword: "",
};

const AVATAR_PALETTE = [
  { bg: "bg-rose-100 dark:bg-rose-950/40", fg: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/40", fg: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-950/40", fg: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-sky-100 dark:bg-sky-950/40", fg: "text-sky-700 dark:text-sky-300" },
  { bg: "bg-violet-100 dark:bg-violet-950/40", fg: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-950/40", fg: "text-fuchsia-700 dark:text-fuchsia-300" },
];

function colorFor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initialsFor(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function maskPassword(value: string) {
  return "•".repeat(Math.min(Math.max(value.length, 6), 14));
}

function pwdToForm(p: PasswordEntry): PasswordFormState {
  return {
    efaasUsername: p.efaasUsername,
    efaasPassword: p.efaasPassword,
    gmailUsername: p.gmailUsername,
    gmailPassword: p.gmailPassword,
  };
}

function isFilled(entry: PasswordEntry) {
  return Boolean(
    entry.efaasUsername ||
      entry.efaasPassword ||
      entry.gmailUsername ||
      entry.gmailPassword,
  );
}

export function PasswordsPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PasswordEntry[]>("/passwords");
      setEntries(data);
    } catch (err) {
      toast({
        title: "Failed to load passwords",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.companyName.toLowerCase().includes(q) ||
        e.efaasUsername.toLowerCase().includes(q) ||
        e.gmailUsername.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const filledCount = useMemo(() => entries.filter(isFilled).length, [entries]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6 md:p-8">
        <div className="relative flex items-start gap-4">
          <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <KeyRound className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Password Vault</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-xl">
              Efaas and Gmail credentials for each company. Records are created automatically when a
              company is added.
            </p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <StatTile icon={Building2} label="Companies" value={entries.length} />
          <StatTile icon={ShieldCheck} label="Configured" value={filledCount} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by company or username…"
          className="pl-10 pr-10 h-12 text-base shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-passwords"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasEntries={entries.length > 0} />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <CompanyPasswordCard
              key={entry.id}
              entry={entry}
              onEdit={() => setEditEntry(entry)}
            />
          ))}
        </div>
      )}

      {editEntry && (
        <PasswordFormDialog
          entry={editEntry}
          open={!!editEntry}
          onOpenChange={(o) => !o && setEditEntry(null)}
          onSaved={() => {
            setEditEntry(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof KeyRound;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur px-3 py-3 md:px-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function EmptyState({ hasEntries }: { hasEntries: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-14 text-center flex flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base">
            {hasEntries ? "No matches" : "No companies yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {hasEntries
              ? "Try a different search term."
              : "Add a company first — a blank password record will be created automatically."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyPasswordCard({
  entry,
  onEdit,
}: {
  entry: PasswordEntry;
  onEdit: () => void;
}) {
  const palette = colorFor(entry.companyName.toLowerCase())!;

  return (
    <div
      className="rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
      data-testid={`row-password-${entry.id}`}
    >
      <div className="flex items-center gap-3 p-4 border-b">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${palette.bg} ${palette.fg}`}
        >
          {initialsFor(entry.companyName)}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{entry.companyName}</h3>
          <p className="text-xs text-muted-foreground">
            {isFilled(entry) ? "Credentials configured" : "Not configured yet"}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          data-testid={`button-edit-password-${entry.id}`}
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4">
        <CredentialSection
          title="Efaas"
          icon={ShieldCheck}
          username={entry.efaasUsername}
          password={entry.efaasPassword}
          entryId={entry.id}
          prefix="efaas"
        />
        <CredentialSection
          title="Gmail"
          icon={Mail}
          username={entry.gmailUsername}
          password={entry.gmailPassword}
          entryId={entry.id}
          prefix="gmail"
        />
      </div>
    </div>
  );
}

function CredentialSection({
  title,
  icon: Icon,
  username,
  password,
  entryId,
  prefix,
}: {
  title: string;
  icon: typeof ShieldCheck;
  username: string;
  password: string;
  entryId: number;
  prefix: string;
}) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  const copy = async (value: string, kind: "username" | "password") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1200);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <FieldDisplay
        label="Username"
        value={username || "—"}
        onCopy={username ? () => copy(username, "username") : undefined}
        copied={copied === "username"}
        testId={`button-copy-${prefix}-username-${entryId}`}
      />
      <FieldDisplay
        label="Password"
        value={password ? (revealed ? password : maskPassword(password)) : "—"}
        mono={Boolean(password)}
        onCopy={password ? () => copy(password, "password") : undefined}
        copied={copied === "password"}
        testId={`button-copy-${prefix}-password-${entryId}`}
        extra={
          password ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => setRevealed((r) => !r)}
              data-testid={`button-toggle-${prefix}-password-${entryId}`}
              title={revealed ? "Hide" : "Show"}
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

function FieldDisplay({
  label,
  value,
  mono,
  onCopy,
  copied,
  testId,
  extra,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied: boolean;
  testId?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={`text-sm truncate ${mono ? "font-mono tracking-tight" : ""}`}>
          {value}
        </span>
        {extra}
        {onCopy && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={onCopy}
            data-testid={testId}
            title={`Copy ${label.toLowerCase()}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function PasswordFormDialog({
  entry,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: PasswordEntry;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PasswordFormState>(EMPTY_FORM);
  const [showEfaasPassword, setShowEfaasPassword] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(pwdToForm(entry));
    setShowEfaasPassword(false);
    setShowGmailPassword(false);
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/passwords/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          efaasUsername: form.efaasUsername.trim(),
          efaasPassword: form.efaasPassword,
          gmailUsername: form.gmailUsername.trim(),
          gmailPassword: form.gmailPassword,
        }),
      });
      toast({ title: "Passwords updated" });
      onSaved();
    } catch (err) {
      toast({
        title: "Failed to update",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit credentials — {entry.companyName}</DialogTitle>
          <DialogDescription>
            Update Efaas and Gmail login details for this company.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <CredentialFormSection
            title="Efaas"
            username={form.efaasUsername}
            password={form.efaasPassword}
            showPassword={showEfaasPassword}
            onTogglePassword={() => setShowEfaasPassword((v) => !v)}
            onUsernameChange={(v) => setForm((s) => ({ ...s, efaasUsername: v }))}
            onPasswordChange={(v) => setForm((s) => ({ ...s, efaasPassword: v }))}
            usernameId="efaas-username"
            passwordId="efaas-password"
          />
          <CredentialFormSection
            title="Gmail"
            username={form.gmailUsername}
            password={form.gmailPassword}
            showPassword={showGmailPassword}
            onTogglePassword={() => setShowGmailPassword((v) => !v)}
            onUsernameChange={(v) => setForm((s) => ({ ...s, gmailUsername: v }))}
            onPasswordChange={(v) => setForm((s) => ({ ...s, gmailPassword: v }))}
            usernameId="gmail-username"
            passwordId="gmail-password"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="button-save-password">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialFormSection({
  title,
  username,
  password,
  showPassword,
  onTogglePassword,
  onUsernameChange,
  onPasswordChange,
  usernameId,
  passwordId,
}: {
  title: string;
  username: string;
  password: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  usernameId: string;
  passwordId: string;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="space-y-1.5">
        <Label htmlFor={usernameId}>Username</Label>
        <Input
          id={usernameId}
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Username or email"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={passwordId}>Password</Label>
        <div className="flex gap-2">
          <Input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoComplete="new-password"
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onTogglePassword}
            title={showPassword ? "Hide" : "Show"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
