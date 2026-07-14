import { useCallback, useEffect, useState } from "react";
import { Radio, Loader2, RefreshCw, MessageSquare, Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/lib/api";

type Gateway = {
  id: number;
  name: string;
  description?: string | null;
  phoneNumber?: string | null;
  status: string;
  lastHeartbeat?: string | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  networkType?: string | null;
  simOperator?: string | null;
  androidVersion?: string | null;
  deviceModel?: string | null;
  appVersion?: string | null;
  tailscaleIp?: string | null;
  lastSeen?: string | null;
  queued?: number;
  sentToday?: number;
  failedToday?: number;
};

type SmsLog = {
  id: number;
  queueId?: number | null;
  gatewayId?: number | null;
  recipient: string;
  message: string;
  status: string;
  provider: string;
  sentTime?: string | null;
  response?: string | null;
  createdAt: string;
};

type Stats = {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
  logsToday: number;
};

export function SmsGatewayPage() {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, l, s] = await Promise.all([
        apiFetch<Gateway[]>("/gateway"),
        apiFetch<SmsLog[]>("/sms/logs?take=50"),
        apiFetch<Stats>("/sms/statistics"),
      ]);
      setGateways(g);
      setLogs(l);
      setStats(s);
    } catch (err) {
      toast({
        title: "Failed to load SMS gateway data",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
  }, [load]);

  async function sendTest() {
    if (!recipient.trim() || !message.trim()) return;
    setSending(true);
    try {
      await apiFetch("/sms/send", {
        method: "POST",
        body: JSON.stringify({ recipient: recipient.trim(), message: message.trim() }),
      });
      toast({ title: "SMS queued" });
      setMessage("");
      await load();
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading SMS gateways…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        icon={Radio}
        title="SMS Gateways"
        description="Android SIM gateways, queue health, and delivery logs. Auto-refreshes every 10s."
        action={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["Pending", stats.pending],
              ["Sending", stats.sending],
              ["Sent", stats.sent],
              ["Failed", stats.failed],
              ["Logs today", stats.logsToday],
            ] as const
          ).map(([label, value]) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl font-mono">{value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Gateways</CardTitle>
          </div>
          <CardDescription>Register devices with the leo-sms-gateway Android app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gateways.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gateways registered yet.</p>
          ) : (
            gateways.map((g) => (
              <div
                key={g.id}
                className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{g.name}</span>
                    <Badge variant={g.status === "online" ? "default" : "secondary"}>{g.status}</Badge>
                    <span className="text-xs font-mono text-muted-foreground">#{g.id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[g.phoneNumber, g.simOperator, g.deviceModel, g.tailscaleIp]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-xs font-mono text-muted-foreground text-left sm:text-right">
                  <div>Batt {g.batteryLevel ?? "—"}% · Sig {g.signalStrength ?? "—"}</div>
                  <div>
                    Q {g.queued ?? 0} · Sent today {g.sentToday ?? 0} · Fail {g.failedToday ?? 0}
                  </div>
                  <div>
                    HB{" "}
                    {g.lastHeartbeat ? new Date(g.lastHeartbeat).toLocaleString() : "never"}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Queue a test SMS</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Recipient (e.g. +9607xxxxxxx)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button disabled={sending || !recipient || !message} onClick={() => void sendTest()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent SMS logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border-b border-border/60 py-2 last:border-0 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">{log.status}</Badge>
                  <span className="font-mono">{log.recipient}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.message}</p>
                {log.response ? (
                  <p className="text-xs font-mono text-destructive mt-0.5">{log.response}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
