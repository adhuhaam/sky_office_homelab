import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Info,
  Loader2,
  RefreshCw,
  Server,
  HeartPulse,
  Code2,
  Layers,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FolderTree,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/lib/api";

type StructureNode = {
  id: string;
  label: string;
  detail?: string | null;
  status?: string | null;
  children?: StructureNode[] | null;
};

type SystemAbout = {
  generatedAt: string;
  pollHintSeconds?: number;
  health: {
    api: "ok";
    database: "ok" | "error";
    databaseLatencyMs: number;
    databaseError: string | null;
    overall: "healthy" | "degraded";
  };
  application: {
    name: string;
    product: string;
    environment: string;
    apiRuntime: string;
    rewriteRuntime: string;
  };
  server: {
    hostname: string;
    platform: string;
    arch: string;
    release: string;
    type: string;
    uptimeSeconds: number;
    processUptimeSeconds: number;
    nodeVersion: string;
    pid: number;
    cwd: string;
    cpuModel: string | null;
    cpuCount: number;
    loadAverage: { "1m": number; "5m": number; "15m": number };
    memory: {
      totalBytes: number;
      freeBytes: number;
      processRssBytes: number;
      processHeapUsedBytes: number;
    };
  };
  stack: {
    languages: { name: string; role: string }[];
    runtimes: { name: string; version: string }[];
    toolchain: { name: string; role: string }[];
  };
  access: {
    lan: string;
    tailscale: string;
    mobileApi: string;
  };
  structure?: StructureNode;
};

const DEFAULT_POLL_MS = 5000;

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  if (m || h || d) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground text-left sm:text-right break-all">
        {value}
      </dd>
    </div>
  );
}

function HealthBadge({ overall }: { overall: "healthy" | "degraded" }) {
  if (overall === "healthy") {
    return (
      <Badge className="gap-1.5 bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Healthy
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1.5">
      <AlertTriangle className="h-3.5 w-3.5" />
      Degraded
    </Badge>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "live" || s === "healthy") {
    return (
      <Badge className="font-mono text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
        {status}
      </Badge>
    );
  }
  if (s === "legacy") {
    return (
      <Badge variant="secondary" className="font-mono text-[10px]">
        {status}
      </Badge>
    );
  }
  if (s === "degraded" || s === "error") {
    return (
      <Badge variant="destructive" className="font-mono text-[10px]">
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-mono text-[10px]">
      {status}
    </Badge>
  );
}

function StructureTreeNode({
  node,
  depth = 0,
  defaultOpen = true,
}: {
  node: StructureNode;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const kids = node.children?.filter(Boolean) ?? [];
  const hasKids = kids.length > 0;
  const [open, setOpen] = useState(defaultOpen || depth < 2);

  return (
    <div className={depth === 0 ? "" : "ml-3 border-l border-border/70 pl-3"}>
      <div className="flex items-start gap-2 py-1.5">
        {hasKids ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="mt-0.5 w-3.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium font-mono">{node.label}</span>
            <StatusPill status={node.status} />
          </div>
          {node.detail ? (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{node.detail}</p>
          ) : null}
        </div>
      </div>
      {hasKids && open
        ? kids.map((child) => (
            <StructureTreeNode key={child.id} node={child} depth={depth + 1} defaultOpen={depth < 1} />
          ))
        : null}
    </div>
  );
}

export function AboutSystemPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SystemAbout | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const inFlight = useRef(false);

  const load = useCallback(async (soft = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const about = await apiFetch<SystemAbout>("/system/about");
      setData(about);
      setLastError(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unknown error";
      setLastError(msg);
      if (!soft) {
        toastRef.current({
          title: "Failed to load system info",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const ms = Math.max(3000, (data?.pollHintSeconds ?? 5) * 1000);
    const id = window.setInterval(() => {
      void load(true);
    }, ms);
    return () => window.clearInterval(id);
  }, [live, load, data?.pollHintSeconds]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading live system information…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
        <XCircle className="h-8 w-8" />
        <p>Could not load system information.</p>
        {lastError ? <p className="text-xs text-destructive font-mono">{lastError}</p> : null}
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const memUsedPct =
    data.server.memory.totalBytes > 0
      ? Math.round(
          ((data.server.memory.totalBytes - data.server.memory.freeBytes) /
            data.server.memory.totalBytes) *
            100,
        )
      : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        icon={Info}
        title="About System"
        description="Live server status, project structure, and runtime details for this Sky Office instance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={live ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setLive((v) => !v)}
            >
              <span
                className={`h-2 w-2 rounded-full ${live ? "bg-emerald-300 animate-pulse" : "bg-muted-foreground/40"}`}
              />
              {live ? "Live" : "Paused"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={refreshing}
              onClick={() => void load(true)}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <HealthBadge overall={data.health.overall} />
        <span className="text-xs text-muted-foreground font-mono">
          Updated {new Date(data.generatedAt).toLocaleString()}
          {live ? " · auto-refreshing" : ""}
        </span>
        {lastError ? (
          <span className="text-xs text-destructive font-mono">Last poll error: {lastError}</span>
        ) : null}
      </div>

      {data.structure ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">System structure</CardTitle>
            </div>
            <CardDescription>
              Project tree, runtime containers, API modules, and office workflows — status reflects
              the live probe on each refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StructureTreeNode node={data.structure} defaultOpen />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Health</CardTitle>
            </div>
            <CardDescription>Live probes from the API process</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <StatRow
                label="API"
                value={
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    OK
                  </span>
                }
              />
              <StatRow
                label="Database"
                value={
                  data.health.database === "ok" ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      OK · {data.health.databaseLatencyMs} ms
                    </span>
                  ) : (
                    <span className="text-destructive">
                      Error
                      {data.health.databaseError
                        ? ` — ${data.health.databaseError}`
                        : ""}
                    </span>
                  )
                }
              />
              <StatRow label="Overall" value={data.health.overall} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Application</CardTitle>
            </div>
            <CardDescription>Product identity and runtime mode</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <StatRow label="App name" value={data.application.name} />
              <StatRow label="Product" value={data.application.product} />
              <StatRow label="Environment" value={data.application.environment} />
              <StatRow label="Primary API" value={data.application.apiRuntime} />
              <StatRow label="Mode" value={data.application.rewriteRuntime} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Server</CardTitle>
          </div>
          <CardDescription>Host where leo-api-dotnet is running</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 md:grid-cols-2">
            <StatRow label="Hostname" value={data.server.hostname} />
            <StatRow
              label="Platform"
              value={`${data.server.type} ${data.server.release} (${data.server.platform}/${data.server.arch})`}
            />
            <StatRow label="Runtime" value={data.server.nodeVersion} />
            <StatRow label="PID" value={String(data.server.pid)} />
            <StatRow label="Host uptime" value={formatUptime(data.server.uptimeSeconds)} />
            <StatRow
              label="Process uptime"
              value={formatUptime(data.server.processUptimeSeconds)}
            />
            <StatRow label="CPU" value={data.server.cpuModel ?? "—"} />
            <StatRow label="CPU cores" value={String(data.server.cpuCount)} />
            <StatRow
              label="Load average"
              value={`${data.server.loadAverage["1m"]} / ${data.server.loadAverage["5m"]} / ${data.server.loadAverage["15m"]}`}
            />
            <StatRow
              label="Memory"
              value={`${formatBytes(data.server.memory.totalBytes - data.server.memory.freeBytes)} used / ${formatBytes(data.server.memory.totalBytes)} (${memUsedPct}%)`}
            />
            <StatRow
              label="Process RSS"
              value={formatBytes(data.server.memory.processRssBytes)}
            />
            <StatRow
              label="Heap used"
              value={formatBytes(data.server.memory.processHeapUsedBytes)}
            />
            <div className="md:col-span-2">
              <StatRow label="Working directory" value={data.server.cwd} />
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Languages</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.stack.languages.map((lang) => (
              <div key={lang.name}>
                <div className="text-sm font-medium">{lang.name}</div>
                <div className="text-xs text-muted-foreground">{lang.role}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Runtimes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.stack.runtimes.map((rt) => (
              <div key={rt.name} className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{rt.name}</span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {rt.version}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Toolchain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.stack.toolchain.map((t) => (
              <div key={t.name}>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Access URLs</CardTitle>
          </div>
          <CardDescription>Homelab endpoints used by clients</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <StatRow label="LAN (HTTPS)" value={data.access.lan} />
            <StatRow label="Tailscale" value={data.access.tailscale} />
            <StatRow label="Mobile API" value={data.access.mobileApi} />
          </dl>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Superuser-only live diagnostic. Production traffic goes through{" "}
            <span className="font-mono">leo-api-dotnet</span> (ASP.NET Core). Express{" "}
            <span className="font-mono">leo-api</span> is retired from the request path.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
