import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CalendarClock, ChevronRight, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiFetch, type WorkPermitAlert, type WorkPermitAlerts } from "@/lib/api";
import { buildXpatPhotoSrc, formatXpatDate } from "@/lib/xpat";
import { XpatPhoto } from "@/components/xpat-panel";

type Tab = "expired" | "expiring_soon";

function AlertRow({ alert }: { alert: WorkPermitAlert }) {
  const photoSrc = buildXpatPhotoSrc(alert.photoUrl);

  return (
    <Link href={`/employees/${alert.passportId}`}>
      <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 transition-colors group">
        {photoSrc ? (
          <XpatPhoto
            xpat={{ photoUrl: alert.photoUrl }}
            name={alert.employeeName}
            size="sm"
          />
        ) : (
          <XpatPhoto xpat={null} name={alert.employeeName} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{alert.employeeName}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {alert.employerName || "—"}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
            {alert.workPermitNumber}
          </p>
        </div>
        <div className="text-right shrink-0">
          <Badge
            variant="outline"
            className={
              alert.status === "expired"
                ? "text-[10px] bg-rose-500/10 text-rose-700 border-rose-500/20"
                : "text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20"
            }
          >
            {formatXpatDate(alert.expiryDate) ?? "—"}
          </Badge>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}

export function WorkPermitAlertsCard() {
  const [tab, setTab] = useState<Tab>("expired");
  const [data, setData] = useState<WorkPermitAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<WorkPermitAlerts>("/passports/work-permit-alerts");
      setData(result);
      if (result.expired.length === 0 && result.expiringSoon.length > 0) {
        setTab("expiring_soon");
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load work permit alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = tab === "expired" ? (data?.expired ?? []) : (data?.expiringSoon ?? []);
  const expiredCount = data?.expired.length ?? 0;
  const expiringCount = data?.expiringSoon.length ?? 0;

  return (
    <Card className="border-border/60 shadow-sm flex flex-col">
      <CardHeader className="pb-2 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              Work permit alerts
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Expired and permits expiring within 3 months
            </p>
          </div>
          <Link href="/master-list">
            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted">
              Master list
            </Badge>
          </Link>
        </div>
        <div className="flex items-center gap-0.5 border-b border-border/60 -mx-1">
          {(
            [
              { key: "expired" as const, label: "Expired", count: expiredCount, icon: AlertTriangle },
              {
                key: "expiring_soon" as const,
                label: "Expiring soon",
                count: expiringCount,
                icon: CalendarClock,
              },
            ] as const
          ).map(({ key, label, count, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  {label}
                  {!loading && count > 0 && (
                    <span
                      className={`tabular-nums text-[10px] ${
                        key === "expired" ? "text-rose-600" : "text-amber-600"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0 p-0 flex-1 min-h-0">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-muted-foreground">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 px-4">
            {tab === "expired" ? (
              <AlertTriangle className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            ) : (
              <CalendarClock className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-xs font-medium">
              {tab === "expired" ? "No expired work permits" : "No permits expiring soon"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
            {rows.map((alert) => (
              <li key={alert.passportId}>
                <AlertRow alert={alert} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
