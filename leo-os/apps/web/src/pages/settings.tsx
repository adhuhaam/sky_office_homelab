import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Settings,
  Building2,
  Palette,
  BrainCircuit,
  Wallet,
  Cog,
  Save,
  Loader2,
  Upload,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Pencil,
  Tag,
  Copy,
  RefreshCw,
  Puzzle,
  KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  apiFetch,
  type SystemSettings,
  type ExpenseCategory,
  type Expense,
  ApiError,
} from "@/lib/api";
import {
  applyAccentHuePreview,
  fetchBranding,
  fetchBrandingLogos,
  invalidateBrandingCache,
} from "@/hooks/use-system-settings";
import { BrandImage } from "@/components/brand-image";
import {
  ACCENT_HUE_PRESETS,
  EXPENSE_CATEGORY_COLORS,
  accentFromHue,
  accentSoftFromHue,
  categoryDotStyle,
  getCategoryColor,
  type CategoryColorId,
} from "@/lib/category-colors";

import { compressImageFile } from "@/lib/compress-image";

function LogoUploadField({
  label,
  description,
  previewClassName,
  value,
  inputRef,
  onPick,
  onClear,
}: {
  label: string;
  description: string;
  previewClassName: string;
  value: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="h-32 rounded-xl border border-dashed border-border overflow-hidden relative">
        <div className="absolute inset-0 logo-checkerboard" aria-hidden />
        <div
          className={`absolute inset-0 flex items-center justify-center ${previewClassName}`}
        >
          {value ? (
            <BrandImage src={value} alt={label} className="max-h-full max-w-full p-2" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo uploaded</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">PNG with transparency recommended. Large files are resized automatically.</p>
    </div>
  );
}

function ColorSwatch({
  color,
  selected,
  onClick,
  size = "md",
}: {
  color: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${dim} rounded-full shrink-0 transition-all ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "ring-2 ring-foreground scale-110" : "ring-1 ring-black/10 hover:scale-105"
      }`}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState("system");
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        icon={Settings}
        title="Settings"
        description="Branding, theme accent, OCR configuration, and expense categories."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 h-auto flex-wrap">
          <TabsTrigger value="system" className="gap-2">
            <Cog className="h-4 w-4" /> System
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-2">
            <Wallet className="h-4 w-4" /> Expense categories
          </TabsTrigger>
        </TabsList>
        <TabsContent value="system">
          <SystemSection />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpenseCategoriesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SystemSection() {
  const { toast } = useToast();
  const [data, setData] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const logoLightRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    appName: "LEO OS",
    accentHue: 162,
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyWebsite: "",
    companyRegistrationNumber: "",
    logoImage: null as string | null,
    logoImageDark: null as string | null,
    openaiOcrBaseUrl: "",
    openaiOcrModel: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await apiFetch<SystemSettings>("/system/settings");
      setData(s);
      setForm({
        appName: s.appName,
        accentHue: s.accentHue,
        companyName: s.companyName ?? "",
        companyAddress: s.companyAddress ?? "",
        companyPhone: s.companyPhone ?? "",
        companyEmail: s.companyEmail ?? "",
        companyWebsite: s.companyWebsite ?? "",
        companyRegistrationNumber: s.companyRegistrationNumber ?? "",
        logoImage: s.logoImage ?? null,
        logoImageDark: s.logoImageDark ?? null,
        openaiOcrBaseUrl: s.openaiOcrBaseUrl ?? "",
        openaiOcrModel: s.openaiOcrModel ?? "",
      });
    } catch (err) {
      toast({
        title: "Failed to load settings",
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

  useEffect(() => {
    applyAccentHuePreview(form.accentHue);
  }, [form.accentHue]);

  async function save() {
    if (!form.appName.trim()) {
      toast({ title: "App name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        appName: form.appName.trim(),
        accentHue: form.accentHue,
        companyName: form.companyName.trim() || null,
        companyAddress: form.companyAddress.trim() || null,
        companyPhone: form.companyPhone.trim() || null,
        companyEmail: form.companyEmail.trim() || null,
        companyWebsite: form.companyWebsite.trim() || null,
        companyRegistrationNumber: form.companyRegistrationNumber.trim() || null,
        logoImage: form.logoImage,
        logoImageDark: form.logoImageDark,
        openaiOcrBaseUrl: form.openaiOcrBaseUrl.trim() || null,
        openaiOcrModel: form.openaiOcrModel.trim() || null,
      };
      if (apiKey.trim()) body.openaiApiKey = apiKey.trim();

      const updated = await apiFetch<SystemSettings>("/system/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setData(updated);
      setApiKey("");
      invalidateBrandingCache();
      await fetchBranding();
      await fetchBrandingLogos();
      toast({ title: "Settings saved" });
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "";
      toast({
        title: "Save failed",
        description: description || "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function clearApiKey() {
    try {
      const updated = await apiFetch<SystemSettings>("/system/settings", {
        method: "PATCH",
        body: JSON.stringify({ openaiApiKey: null }),
      });
      setData(updated);
      toast({ title: "API key removed" });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  }

  async function pickLogoFile(
    file: File,
    field: "logoImage" | "logoImageDark",
  ) {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast({ title: "Use PNG, JPEG, or WebP", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Use a file under 5 MB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      setForm((f) => ({ ...f, [field]: dataUrl }));
    } catch (err) {
      toast({
        title: "Could not process image",
        description: err instanceof Error ? err.message : "Try a smaller PNG or JPEG.",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const accent = accentFromHue(form.accentHue);
  const accentSoft = accentSoftFromHue(form.accentHue);

  return (
    <div className="space-y-6">
      <Card className="border-card-border shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Cog className="h-4 w-4 text-primary" /> App identity
          </CardTitle>
          <CardDescription>
            App name and logos for light and dark surfaces. Use PNG with a transparent background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <LogoUploadField
              label="Light logo"
              description="Shown on login, invoices, and light backgrounds."
              previewClassName="bg-background/95"
              value={form.logoImage}
              inputRef={logoLightRef}
              onPick={(file) => pickLogoFile(file, "logoImage")}
              onClear={() => setForm((f) => ({ ...f, logoImage: null }))}
            />
            <LogoUploadField
              label="Dark logo"
              description="Shown in the sidebar and other dark surfaces."
              previewClassName="bg-sidebar/95"
              value={form.logoImageDark}
              inputRef={logoDarkRef}
              onPick={(file) => pickLogoFile(file, "logoImageDark")}
              onClear={() => setForm((f) => ({ ...f, logoImageDark: null }))}
            />
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="appName">App name</Label>
            <Input
              id="appName"
              value={form.appName}
              onChange={(e) => setForm({ ...form, appName: e.target.value })}
              placeholder="LEO OS"
            />
            <p className="text-xs text-muted-foreground">Displayed in the sidebar header and document title.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Theme accent color
          </CardTitle>
          <CardDescription>Primary color for buttons, links, and sidebar highlights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="rounded-xl border p-4 flex items-center gap-4"
            style={{ backgroundColor: accentSoft, borderColor: accent }}
          >
            <div className="h-14 w-14 rounded-xl shadow-sm shrink-0" style={{ backgroundColor: accent }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: accentFromHue(form.accentHue, 50, 24) }}>
                Live preview
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hue {form.accentHue}° — changes apply instantly; save to persist.
              </p>
              <Button size="sm" className="mt-2 h-8" type="button">
                Sample button
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Presets</Label>
            <div className="flex flex-wrap gap-3">
              {ACCENT_HUE_PRESETS.map((p) => (
                <button
                  key={p.hue}
                  type="button"
                  onClick={() => setForm({ ...form, accentHue: p.hue })}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                    form.accentHue === p.hue
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-transparent hover:bg-muted/50"
                  }`}
                >
                  <ColorSwatch
                    color={accentFromHue(p.hue)}
                    selected={form.accentHue === p.hue}
                    size="lg"
                  />
                  <span className="text-[11px] font-medium text-muted-foreground">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="hueSlider">Custom hue</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {form.accentHue}°
              </Badge>
            </div>
            <div
              className="h-3 rounded-full mb-3"
              style={{
                background:
                  "linear-gradient(to right, hsl(0 70% 50%), hsl(60 70% 50%), hsl(120 70% 50%), hsl(180 70% 50%), hsl(240 70% 50%), hsl(300 70% 50%), hsl(360 70% 50%))",
              }}
            />
            <input
              id="hueSlider"
              type="range"
              min={0}
              max={360}
              value={form.accentHue}
              onChange={(e) => setForm({ ...form, accentHue: Number(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Organization
          </CardTitle>
          <CardDescription>Company details used on printed documents and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company name</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Registration #</Label>
              <Input
                value={form.companyRegistrationNumber}
                onChange={(e) => setForm({ ...form, companyRegistrationNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Website</Label>
              <Input
                value={form.companyWebsite}
                onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })}
                placeholder="https://"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea
              rows={2}
              value={form.companyAddress}
              onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" /> Passport OCR (OpenAI)
          </CardTitle>
          <CardDescription>GPT vision model for automatic passport field extraction.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge
            variant="outline"
            className={data?.hasOpenaiApiKey ? "border-emerald-300 bg-emerald-50 text-emerald-800" : ""}
          >
            {data?.hasOpenaiApiKey ? "Custom API key configured" : "Using environment default"}
          </Badge>
          <div className="relative space-y-2">
            <Label>API key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={data?.hasOpenaiApiKey ? "Enter new key to replace…" : "sk-…"}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>OCR base URL</Label>
              <Input
                value={form.openaiOcrBaseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(e) => setForm({ ...form, openaiOcrBaseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>OCR model</Label>
              <Input
                value={form.openaiOcrModel}
                placeholder="gpt-4o-mini"
                onChange={(e) => setForm({ ...form, openaiOcrModel: e.target.value })}
              />
            </div>
          </div>
          {data?.hasOpenaiApiKey && (
            <Button type="button" variant="outline" size="sm" onClick={clearApiKey}>
              Remove saved API key
            </Button>
          )}
        </CardContent>
      </Card>

      <PasswordCard hasCustomPassword={data?.hasCustomPassword ?? false} />

      <ExtensionTokenCard />

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

function ExtensionTokenCard() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>("/auth/extension-token");
      setToken(res.token);
    } catch (err) {
      toast({
        title: "Failed to load extension token",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function regenerate() {
    setRegenerating(true);
    try {
      const res = await apiFetch<{ token: string }>("/auth/extension-token/regenerate", {
        method: "POST",
      });
      setToken(res.token);
      toast({ title: "Extension token regenerated" });
    } catch (err) {
      toast({
        title: "Failed to regenerate token",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-primary" /> Browser extension
        </CardTitle>
        <CardDescription>
          Token used by the LEO Chrome extension to authenticate API requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input readOnly value={token ?? ""} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => void copyToken()} disabled={!token}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void regenerate()} disabled={regenerating}>
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Regenerate token
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordCard({ hasCustomPassword }: { hasCustomPassword: boolean }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (next.length < 6) {
      toast({
        title: "New password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (next !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ title: "Password updated" });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast({
        title: status === 401 ? "Current password is incorrect" : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-card-border shadow-sm">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Security
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight -mt-3">Change password</h2>
        <p className="text-xs text-muted-foreground -mt-2">
          {hasCustomPassword
            ? "A custom password is currently in use."
            : "You're still using the initial environment password. Set a new one to take ownership."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Current password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New password</Label>
            <div className="relative">
              <Input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNext((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNext ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm new password</Label>
            <Input
              type={showNext ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={!current || !next || !confirm || saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5 mr-1" />
            )}
            Update password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryColorPicker({
  value,
  onChange,
}: {
  value: CategoryColorId;
  onChange: (id: CategoryColorId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {EXPENSE_CATEGORY_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
            value === c.id
              ? "border-foreground/30 shadow-sm scale-[1.02]"
              : "border-transparent hover:bg-background/80"
          }`}
          style={
            value === c.id
              ? { backgroundColor: c.bg, color: c.text, borderColor: c.border }
              : undefined
          }
        >
          <span className="h-4 w-4 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: c.dot }} />
          {c.label}
          {value === c.id && <Check className="h-3.5 w-3.5 ml-0.5" />}
        </button>
      ))}
    </div>
  );
}

function ExpenseCategoriesSection() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ExpenseCategory[]>([]);
  const [expenseCounts, setExpenseCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<CategoryColorId>("slate");
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<CategoryColorId>("slate");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categories, expenses] = await Promise.all([
        apiFetch<ExpenseCategory[]>("/expense-categories"),
        apiFetch<Expense[]>("/expenses"),
      ]);
      setRows(categories);
      const counts: Record<number, number> = {};
      for (const e of expenses) {
        counts[e.categoryId] = (counts[e.categoryId] ?? 0) + 1;
      }
      setExpenseCounts(counts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(category: ExpenseCategory) {
    setEditTarget(category);
    setEditName(category.name);
    setEditColor((category.color as CategoryColorId) ?? "slate");
  }

  async function add() {
    if (!name.trim()) {
      toast({ title: "Enter a category name", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await apiFetch("/expense-categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), color }),
      });
      setName("");
      setColor("slate");
      load();
      toast({ title: "Category added" });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (!editTarget || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/expense-categories/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      setEditTarget(null);
      load();
      toast({ title: "Category updated" });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id: number) {
    const count = expenseCounts[id] ?? 0;
    if (count > 0) {
      toast({
        title: "Cannot delete",
        description: `This category has ${count} expense${count !== 1 ? "s" : ""} attached.`,
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Delete this category?")) return;
    try {
      await apiFetch(`/expense-categories/${id}`, { method: "DELETE" });
      load();
      toast({ title: "Category deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof ApiError ? err.message : "Category may have expenses attached.",
        variant: "destructive",
      });
    }
  }

  const selectedColor = getCategoryColor(color);
  const editPreviewColor = getCategoryColor(editColor);

  return (
    <>
      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Expense categories
          </CardTitle>
          <CardDescription>
            Color-coded labels for expense tracking. Categories with expenses cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-card-border bg-muted/20 p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catName">New category</Label>
              <Input
                id="catName"
                placeholder="e.g. Office supplies, Travel, Utilities"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <CategoryColorPicker value={color} onChange={setColor} />
            </div>

            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
                style={{
                  backgroundColor: selectedColor.bg,
                  color: selectedColor.text,
                  borderColor: selectedColor.border,
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedColor.dot }} />
                Preview: {name.trim() || "Category name"}
              </div>
              <Button onClick={add} disabled={adding || !name.trim()} className="ml-auto">
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add category
              </Button>
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No categories yet. Add one above to get started.
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {rows.map((c) => {
                const def = getCategoryColor(c.color);
                const attached = expenseCounts[c.id] ?? 0;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:shadow-sm"
                    style={{ backgroundColor: def.bg, borderColor: def.border }}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-2.5 font-medium" style={{ color: def.text }}>
                        <span
                          className="h-3.5 w-3.5 rounded-full shrink-0 ring-1 ring-black/10"
                          style={categoryDotStyle(c.color)}
                        />
                        <span className="truncate">{c.name}</span>
                      </span>
                      {attached > 0 && (
                        <p className="text-[11px] mt-1 opacity-70" style={{ color: def.text }}>
                          {attached} expense{attached !== 1 ? "s" : ""} attached
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-current/60 hover:text-foreground hover:bg-black/5"
                        onClick={() => openEdit(c)}
                        title="Edit category"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={attached > 0}
                        className="h-8 w-8 p-0 text-current/60 hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                        onClick={() => remove(c.id)}
                        title={
                          attached > 0
                            ? `Cannot delete — ${attached} expense${attached !== 1 ? "s" : ""} attached`
                            : "Delete category"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editCatName">Name</Label>
              <Input
                id="editCatName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <CategoryColorPicker value={editColor} onChange={setEditColor} />
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium"
              style={{
                backgroundColor: editPreviewColor.bg,
                color: editPreviewColor.text,
                borderColor: editPreviewColor.border,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: editPreviewColor.dot }} />
              Preview: {editName.trim() || "Category name"}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit || !editName.trim()}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
