import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  apiFetch,
  ApiError,
  type Task,
  type TaskInput,
  type TaskUpdate,
  type PassportStats,
  type BillingDocument,
  type Company,
  type Expense,
} from "@/lib/api";
import { useAuth, useHasRole } from "@/lib/auth";
import { computeBillingStats, billingDocTotal, fmtBillingMoney } from "@/lib/billing";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  ListTodo,
  CalendarDays,
  Flame,
  StickyNote,
  Sparkles,
  Inbox,
  Users,
  Building2,
  Receipt,
  Wallet,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
import { WorkPermitAlertsCard } from "@/components/work-permit-alerts-card";

// Compare due dates as local calendar days, never as instants. Avoids
// timezone- and time-of-day flakiness around midnight (e.g. a task due
// "today" briefly being classified as "overdue" past local midnight UTC).
function dueClassification(
  dueIso: string,
): "overdue" | "today" | "future" {
  const due = startOfDay(parseISO(dueIso));
  const today = startOfDay(new Date());
  if (due.getTime() < today.getTime()) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "future";
}

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

const PRIORITY_META: Record<Priority, { label: string; classes: string; dot: string }> = {
  high: {
    label: "High",
    classes: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    dot: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    classes: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    classes: "bg-sky-500/10 text-sky-700 border-sky-500/20",
    dot: "bg-sky-500",
  },
};

const STATUS_META: Record<Status, { label: string; classes: string }> = {
  todo: {
    label: "To do",
    classes: "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "In progress",
    classes: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  },
  done: {
    label: "Done",
    classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
};

type Filter = "all" | "today" | "upcoming" | "done";

interface MonthlyChartPoint {
  id: number;
  monthKey: string;
  label: string;
  recordLabel: string;
  amount: number;
  date: string;
}

interface DashboardInsights {
  passports?: PassportStats;
  billing?: ReturnType<typeof computeBillingStats>;
  billingDocs?: BillingDocument[];
  expenses?: Expense[];
  companyCount?: number;
  expenseTotal?: number;
}

const CHART_MONTHS = 12;

const expenseChartConfig = {
  amount: { label: "Amount", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const invoicingChartConfig = {
  amount: { label: "Amount", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return format(d, "MMM yy");
}

function groupExpensesByMonth(expenses: Expense[]): MonthlyChartPoint[] {
  const sinceKey = lastNMonthKeys(CHART_MONTHS)[0]!;
  return expenses
    .filter((e) => e.expenseDate && e.expenseDate.slice(0, 7) >= sinceKey)
    .map((e) => {
      const monthKey = e.expenseDate!.slice(0, 7);
      return {
        id: e.id,
        monthKey,
        label: monthLabel(monthKey),
        recordLabel: e.categoryName || e.remarks?.trim() || `Expense #${e.id}`,
        amount: Number(e.amount || 0),
        date: e.expenseDate!,
      };
    })
    .sort(
      (a, b) =>
        a.monthKey.localeCompare(b.monthKey) ||
        a.date.localeCompare(b.date) ||
        a.id - b.id,
    );
}

function groupBillingByMonth(docs: BillingDocument[]): MonthlyChartPoint[] {
  const sinceKey = lastNMonthKeys(CHART_MONTHS)[0]!;
  return docs
    .filter(
      (doc) =>
        doc.status !== "voided" &&
        doc.issueDate &&
        doc.issueDate.slice(0, 7) >= sinceKey,
    )
    .map((doc) => {
      const monthKey = doc.issueDate.slice(0, 7);
      return {
        id: doc.id,
        monthKey,
        label: monthLabel(monthKey),
        recordLabel:
          doc.number ||
          doc.customerName?.trim() ||
          `${doc.kind === "quotation" ? "Quote" : "Invoice"} #${doc.id}`,
        amount: billingDocTotal(doc),
        date: doc.issueDate,
      };
    })
    .sort(
      (a, b) =>
        a.monthKey.localeCompare(b.monthKey) ||
        a.date.localeCompare(b.date) ||
        a.id - b.id,
    );
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role ?? "";

  const canPassportStats = useHasRole(
    "superuser",
    "admin",
    "company",
    "client",
    "agent",
  );
  const canBilling = useHasRole("superuser", "admin", "company", "client");
  const canCompanies = useHasRole("superuser", "admin", "company");
  const canExpenses = useHasRole("superuser", "admin");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [insights, setInsights] = useState<DashboardInsights>({});
  const [insightsLoading, setInsightsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<Task[]>("/tasks");
      setTasks(data ?? []);
    } catch (err) {
      toast({
        title: "Failed to load tasks",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    const next: DashboardInsights = {};

    await Promise.all([
      canPassportStats
        ? apiFetch<PassportStats>("/passports/stats")
            .then((data) => {
              next.passports = data;
            })
            .catch(() => undefined)
        : Promise.resolve(),
      canBilling
        ? apiFetch<BillingDocument[]>("/billing/documents")
            .then((docs) => {
              next.billing = computeBillingStats(docs);
              next.billingDocs = docs;
            })
            .catch(() => undefined)
        : Promise.resolve(),
      canCompanies
        ? apiFetch<Company[]>("/companies")
            .then((rows) => {
              next.companyCount = rows.length;
            })
            .catch(() => undefined)
        : Promise.resolve(),
      canExpenses
        ? apiFetch<Expense[]>("/expenses")
            .then((rows) => {
              next.expenses = rows;
              next.expenseTotal = rows.reduce((s, e) => s + Number(e.amount || 0), 0);
            })
            .catch(() => undefined)
        : Promise.resolve(),
    ]);

    setInsights(next);
    setInsightsLoading(false);
  }, [canPassportStats, canBilling, canCompanies, canExpenses]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "there";

  const expenseChartData = useMemo(
    () => groupExpensesByMonth(insights.expenses ?? []),
    [insights.expenses],
  );

  const invoicingChartData = useMemo(
    () => groupBillingByMonth(insights.billingDocs ?? []),
    [insights.billingDocs],
  );

  // Quick add
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<Priority>("medium");
  const [quickDueDate, setQuickDueDate] = useState<string>("");

  // Filter + expand state
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Edit dialog
  const [editingId, setEditingId] = useState<number | null>(null);
  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingId) ?? null,
    [tasks, editingId],
  );

  // Subtask inline composer (open per-parent)
  const [subtaskFor, setSubtaskFor] = useState<number | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");

  // Group tasks: top-level + map of children
  const { topLevel, childrenOf } = useMemo(() => {
    const top: Task[] = [];
    const kids = new Map<number, Task[]>();
    for (const t of tasks) {
      if (t.parentId == null) top.push(t);
      else {
        const arr = kids.get(t.parentId) ?? [];
        arr.push(t);
        kids.set(t.parentId, arr);
      }
    }
    return { topLevel: top, childrenOf: kids };
  }, [tasks]);

  // Filtered top-level for the selected tab. Subtasks render with their parent
  // regardless of the filter so the user always sees full context.
  const visibleTop = useMemo(() => {
    return topLevel.filter((t) => {
      switch (filter) {
        case "today":
          return (
            t.status !== "done" &&
            t.dueDate != null &&
            dueClassification(t.dueDate) === "today"
          );
        case "upcoming":
          return (
            t.status !== "done" &&
            t.dueDate != null &&
            dueClassification(t.dueDate) !== "overdue"
          );
        case "done":
          return t.status === "done";
        case "all":
        default:
          return true;
      }
    });
  }, [topLevel, filter]);

  // Stats — top-level only so big numbers feel meaningful
  const stats = useMemo(() => {
    let open = 0,
      dueToday = 0,
      overdue = 0,
      done = 0;
    for (const t of topLevel) {
      if (t.status === "done") {
        done++;
        continue;
      }
      open++;
      if (t.dueDate) {
        const cls = dueClassification(t.dueDate);
        if (cls === "today") dueToday++;
        else if (cls === "overdue") overdue++;
      }
    }
    return { open, dueToday, overdue, done };
  }, [topLevel]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await apiFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          priority: quickPriority,
          dueDate: quickDueDate || null,
        } satisfies TaskInput),
      });
      setQuickTitle("");
      setQuickDueDate("");
      setQuickPriority("medium");
      await load();
    } catch (err) {
      toast({
        title: "Could not add task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(t: Task) {
    const next: Status = t.status === "done" ? "todo" : "done";
    try {
      await apiFetch<Task>(`/tasks/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next } satisfies TaskUpdate),
      });
      await load();
    } catch (err) {
      toast({
        title: "Could not update task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this task and any subtasks?")) return;
    try {
      await apiFetch(`/tasks/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast({
        title: "Could not delete",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleAddSubtask(parentId: number) {
    const title = subtaskTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await apiFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          parentId,
          priority: "medium",
        } satisfies TaskInput),
      });
      setSubtaskTitle("");
      setSubtaskFor(null);
      setExpanded((s) => new Set([...s, parentId]));
      await load();
    } catch (err) {
      toast({
        title: "Could not add subtask",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const showCharts = canExpenses || canBilling;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-emerald-500/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative px-6 md:px-8 py-6 md:py-7 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-background/60 px-2.5 py-1 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-400">
                {format(new Date(), "EEEE · MMM d, yyyy")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {timeGreeting()}, {displayName}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monthly expense and invoicing trends with your daily tasks.
            </p>
          </div>
          {role && (
            <Badge variant="outline" className="w-fit capitalize text-xs">
              {role.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>

      {/* Operations KPIs */}
      {(canPassportStats || canBilling || canCompanies || canExpenses) && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {canPassportStats &&
            (insightsLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px] rounded-xl" />
              ))
            ) : (
              <>
                <Link href="/master-list">
                  <KpiTile
                    label="Candidates"
                    value={insights.passports?.total ?? 0}
                    sub={`${insights.passports?.completed ?? 0} completed`}
                    icon={Users}
                    accent="emerald"
                  />
                </Link>
                <KpiTile
                  label="Processing"
                  value={insights.passports?.processing ?? 0}
                  sub={`${insights.passports?.failed ?? 0} failed`}
                  icon={Loader2}
                  accent="amber"
                />
              </>
            ))}
          {canBilling &&
            (insightsLoading ? (
              <Skeleton className="h-[104px] rounded-xl" />
            ) : (
              <Link href="/billing">
                <KpiTile
                  label="Outstanding"
                  value={fmtBillingMoney(insights.billing?.outstanding ?? 0)}
                  sub={`${insights.billing?.count ?? 0} documents`}
                  icon={TrendingUp}
                  accent="indigo"
                  isMoney
                />
              </Link>
            ))}
          {canCompanies &&
            (insightsLoading ? (
              <Skeleton className="h-[104px] rounded-xl" />
            ) : (
              <Link href="/companies">
                <KpiTile
                  label="Companies"
                  value={insights.companyCount ?? 0}
                  sub="Active employers"
                  icon={Building2}
                  accent="teal"
                />
              </Link>
            ))}
          {canExpenses &&
            (insightsLoading ? (
              <Skeleton className="h-[104px] rounded-xl" />
            ) : (
              <Link href="/expenses">
                <KpiTile
                  label="Expenses"
                  value={fmtBillingMoney(insights.expenseTotal ?? 0)}
                  sub="Total recorded"
                  icon={Wallet}
                  accent="rose"
                  isMoney
                />
              </Link>
            ))}
        </div>
      )}

      {canPassportStats && (
        <WorkPermitAlertsCard />
      )}

      <div className={`grid gap-6 ${showCharts ? "lg:grid-cols-3" : ""}`}>
        {/* Charts */}
        {showCharts && (
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          {canExpenses && (
            <MonthlyAmountChart
              title="Expenses by month"
              description="Monthly breakdown of expense records"
              href="/expenses"
              icon={Wallet}
              accent="rose"
              loading={insightsLoading}
              data={expenseChartData}
              config={expenseChartConfig}
            />
          )}
          {canBilling && (
            <MonthlyAmountChart
              title="Invoicing by month"
              description="Monthly billing document totals"
              href="/billing"
              icon={Receipt}
              accent="indigo"
              loading={insightsLoading}
              data={invoicingChartData}
              config={invoicingChartConfig}
            />
          )}
        </div>
        )}

        {/* Compact tasks panel */}
        <div className={showCharts ? "lg:col-span-1" : ""}>
          <Card className={`border-border/60 shadow-sm flex flex-col max-h-[calc(100vh-12rem)] ${showCharts ? "lg:sticky lg:top-4" : "max-w-xl"}`}>
            <CardHeader className="pb-2 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <ListTodo className="h-4 w-4 text-indigo-600" />
                    Tasks
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Quick plan for today
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MiniStat label="Open" value={stats.open} accent="indigo" />
                <MiniStat label="Today" value={stats.dueToday} accent="amber" />
                <MiniStat label="Late" value={stats.overdue} accent="rose" />
                <MiniStat label="Done" value={stats.done} accent="emerald" />
              </div>
              <form onSubmit={handleQuickAdd} className="space-y-2">
                <div className="relative">
                  <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder="Add a task…"
                    className="pl-8 h-8 text-sm"
                    data-testid="input-quick-task"
                  />
                </div>
                <div className="flex gap-1.5">
                  <Select
                    value={quickPriority}
                    onValueChange={(v) => setQuickPriority(v as Priority)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={quickDueDate}
                    onChange={(e) => setQuickDueDate(e.target.value)}
                    className="h-8 text-xs flex-1"
                    aria-label="Due date"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!quickTitle.trim() || creating}
                    className="h-8 px-2.5"
                    data-testid="button-add-task"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>
              <div className="flex items-center gap-0.5 border-b border-border/60 -mx-1">
                {(
                  [
                    { key: "all", label: "All", count: topLevel.length },
                    { key: "today", label: "Today", count: stats.dueToday },
                    { key: "upcoming", label: "Soon" },
                    { key: "done", label: "Done", count: stats.done },
                  ] as { key: Filter; label: string; count?: number }[]
                ).map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilter(tab.key)}
                      className={`relative px-2 py-1.5 text-[11px] font-medium transition-colors ${
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`tab-${tab.key}`}
                    >
                      <span className="flex items-center gap-1">
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                          <span className="tabular-nums text-[10px] text-muted-foreground">
                            {tab.count}
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
            <CardContent className="pt-0 flex-1 min-h-0 overflow-y-auto p-0">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading tasks…
                </div>
              ) : visibleTop.length === 0 ? (
                <CompactEmptyState filter={filter} />
              ) : (
                <ul className="divide-y divide-border/60">
                  {visibleTop.map((t) => {
                    const kids = childrenOf.get(t.id) ?? [];
                    const isOpen = expanded.has(t.id);
                    return (
                      <li key={t.id}>
                        <TaskRow
                          task={t}
                          compact
                          hasChildren={kids.length > 0}
                          isOpen={isOpen}
                          childCount={kids.length}
                          doneChildCount={kids.filter((k) => k.status === "done").length}
                          onToggleDone={() => toggleDone(t)}
                          onToggleExpand={() => toggleExpand(t.id)}
                          onEdit={() => setEditingId(t.id)}
                          onDelete={() => handleDelete(t.id)}
                          onAddSubtask={() => {
                            setSubtaskFor(t.id);
                            setSubtaskTitle("");
                          }}
                        />
                        {subtaskFor === t.id && (
                          <div className="bg-muted/30 px-8 py-2 border-t border-border/60">
                            <div className="flex gap-1.5">
                              <Input
                                autoFocus
                                value={subtaskTitle}
                                onChange={(e) => setSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddSubtask(t.id);
                                  }
                                  if (e.key === "Escape") setSubtaskFor(null);
                                }}
                                placeholder="Subtask…"
                                className="h-7 text-xs"
                                data-testid={`input-subtask-${t.id}`}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleAddSubtask(t.id)}
                                disabled={!subtaskTitle.trim() || creating}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        )}
                        {isOpen && kids.length > 0 && (
                          <ul className="bg-muted/20 border-t border-border/60">
                            {kids.map((k) => (
                              <li key={k.id} className="border-b border-border/40 last:border-b-0">
                                <TaskRow
                                  task={k}
                                  compact
                                  isSubtask
                                  onToggleDone={() => toggleDone(k)}
                                  onEdit={() => setEditingId(k.id)}
                                  onDelete={() => handleDelete(k.id)}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <EditTaskDialog
            task={editingTask}
            open={editingTask != null}
            onOpenChange={(o) => !o && setEditingId(null)}
            onSave={async (patch) => {
              if (!editingTask) return;
              try {
                await apiFetch<Task>(`/tasks/${editingTask.id}`, {
                  method: "PATCH",
                  body: JSON.stringify(patch satisfies TaskUpdate),
                });
                await load();
                setEditingId(null);
              } catch (err) {
                toast({
                  title: "Could not save",
                  description: err instanceof Error ? err.message : "Unknown error",
                  variant: "destructive",
                });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  compact = false,
  isSubtask = false,
  hasChildren = false,
  isOpen = false,
  childCount = 0,
  doneChildCount = 0,
  onToggleDone,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: Task;
  compact?: boolean;
  isSubtask?: boolean;
  hasChildren?: boolean;
  isOpen?: boolean;
  childCount?: number;
  doneChildCount?: number;
  onToggleDone: () => void;
  onToggleExpand?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubtask?: () => void;
}) {
  const done = task.status === "done";
  const priority = (task.priority as Priority) ?? "medium";
  const status = (task.status as Status) ?? "todo";

  // Due-date badge with smart coloring
  const dueBadge = task.dueDate
    ? (() => {
        const d = parseISO(task.dueDate);
        const cls = dueClassification(task.dueDate);
        const today = cls === "today";
        const overdue = cls === "overdue" && !done;
        const klass = done
          ? "bg-muted text-muted-foreground border-border"
          : overdue
            ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
            : today
              ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
              : "bg-sky-500/10 text-sky-700 border-sky-500/20";
        return (
          <Badge variant="outline" className={`${klass} gap-1 text-[10px]`}>
            <CalendarDays className="h-3 w-3" />
            {today ? "Today" : format(d, "MMM d")}
          </Badge>
        );
      })()
    : null;

  return (
    <div
      className={`group flex items-start gap-2 ${
        isSubtask
          ? compact
            ? "px-8 py-2"
            : "px-12 py-2.5"
          : compact
            ? "px-3 py-2"
            : "px-4 md:px-5 py-3.5"
      } hover:bg-muted/40 transition-colors`}
    >
      {/* Expand chevron (top-level w/ children only) */}
      {!isSubtask && (
        <button
          type="button"
          onClick={onToggleExpand}
          className={`${compact ? "h-4 w-4" : "h-5 w-5"} mt-0.5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors ${
            hasChildren ? "" : "invisible"
          }`}
          aria-label={isOpen ? "Collapse subtasks" : "Expand subtasks"}
        >
          {isOpen ? (
            <ChevronDown className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          ) : (
            <ChevronRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          )}
        </button>
      )}

      {/* Checkbox */}
      <Checkbox
        checked={done}
        onCheckedChange={onToggleDone}
        className={`mt-0.5 ${compact ? "h-3.5 w-3.5" : ""}`}
        aria-label={done ? "Mark not done" : "Mark done"}
        data-testid={`checkbox-task-${task.id}`}
      />

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center flex-wrap gap-1.5">
          <span
            className={`${compact ? "text-xs" : "text-sm"} font-medium ${
              done ? "line-through text-muted-foreground" : "text-foreground"
            }`}
          >
            {task.title}
          </span>
          {!done && (
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_META[priority].dot}`}
              title={`${PRIORITY_META[priority].label} priority`}
            />
          )}
          {status === "in_progress" && !compact && (
            <Badge variant="outline" className={`${STATUS_META.in_progress.classes} text-[10px]`}>
              {STATUS_META.in_progress.label}
            </Badge>
          )}
          {dueBadge}
          {hasChildren && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 h-4 px-1">
              {doneChildCount}/{childCount}
            </Badge>
          )}
          {priority === "high" && !done && (
            <Flame className="h-3 w-3 text-rose-500 shrink-0" />
          )}
        </div>
        {task.notes && !compact && (
          <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <p className="line-clamp-2 whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-0.5 ${compact ? "opacity-80 group-hover:opacity-100" : ""}`}>
        {onAddSubtask && compact && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onAddSubtask}
            aria-label="Add subtask"
            data-testid={`button-add-subtask-${task.id}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
        {onAddSubtask && !compact && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 text-xs gap-1 hidden md:inline-flex"
            onClick={onAddSubtask}
            data-testid={`button-add-subtask-${task.id}`}
          >
            <Plus className="h-3.5 w-3.5" /> Subtask
          </Button>
        )}
        {onAddSubtask && !compact && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 md:hidden"
            onClick={onAddSubtask}
            aria-label="Add subtask"
            data-testid={`button-add-subtask-mobile-${task.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={compact ? "h-6 w-6" : "h-8 w-8"}
          onClick={onEdit}
          aria-label="Edit task"
          data-testid={`button-edit-task-${task.id}`}
        >
          <Pencil className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={`${compact ? "h-6 w-6" : "h-8 w-8"} text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-300`}
          onClick={onDelete}
          aria-label="Delete task"
          data-testid={`button-delete-task-${task.id}`}
        >
          <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
      </div>
    </div>
  );
}

function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: {
    title?: string;
    notes?: string | null;
    status?: Status;
    priority?: Priority;
    dueDate?: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState<string>("");

  // Sync form when the task changes / dialog opens
  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setStatus((task.status as Status) ?? "todo");
      setPriority((task.priority as Priority) ?? "medium");
      setDueDate(task.dueDate ?? "");
    }
  }, [task]);

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes / remarks</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any details, links or remarks…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                title: title.trim() || undefined,
                notes: notes.trim() ? notes.trim() : null,
                status,
                priority,
                dueDate: dueDate || null,
              })
            }
            disabled={!title.trim()}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACCENT: Record<
  string,
  { iconBg: string; ring: string; glow: string; text: string }
> = {
  indigo: {
    iconBg: "bg-gradient-to-br from-indigo-500 to-violet-500",
    ring: "ring-indigo-500/15",
    glow: "from-indigo-500/10",
    text: "text-indigo-600",
  },
  emerald: {
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500",
    ring: "ring-emerald-500/15",
    glow: "from-emerald-500/10",
    text: "text-emerald-600",
  },
  amber: {
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    ring: "ring-amber-500/15",
    glow: "from-amber-500/10",
    text: "text-amber-600",
  },
  rose: {
    iconBg: "bg-gradient-to-br from-rose-500 to-red-500",
    ring: "ring-rose-500/15",
    glow: "from-rose-500/10",
    text: "text-rose-600",
  },
  teal: {
    iconBg: "bg-gradient-to-br from-teal-500 to-emerald-600",
    ring: "ring-teal-500/15",
    glow: "from-teal-500/10",
    text: "text-teal-600",
  },
  violet: {
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-500",
    ring: "ring-violet-500/15",
    glow: "from-violet-500/10",
    text: "text-violet-600",
  },
};

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  isMoney = false,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ElementType;
  accent: keyof typeof ACCENT;
  isMoney?: boolean;
}) {
  const a = ACCENT[accent]!;
  return (
    <Card className="border-border/60 shadow-sm overflow-hidden relative group hover:shadow-md hover:-translate-y-0.5 transition-all h-full cursor-pointer">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${a.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
      />
      <CardContent className="p-4 relative">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div
            className={`h-8 w-8 rounded-lg ${a.iconBg} flex items-center justify-center shadow-sm`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <div
          className={`font-bold tracking-tight tabular-nums ${
            isMoney ? "text-lg md:text-xl" : "text-2xl md:text-3xl"
          }`}
        >
          {value}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MonthlyAmountChart({
  title,
  description,
  href,
  icon: Icon,
  accent,
  loading,
  data,
  config,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  accent: keyof typeof ACCENT;
  loading: boolean;
  data: MonthlyChartPoint[];
  config: ChartConfig;
}) {
  const a = ACCENT[accent]!;
  const hasData = data.some((d) => d.amount > 0);

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <div className={`h-6 w-6 rounded-md ${a.iconBg} flex items-center justify-center`}>
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              {title}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
          </div>
          <Link href={href}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="h-[220px] w-full rounded-lg" />
        ) : !hasData ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
            No data for the last {CHART_MONTHS} months
          </div>
        ) : (
          <ChartContainer config={config} className="h-[220px] w-full aspect-auto">
            <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="12%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={48}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as MonthlyChartPoint | undefined;
                      return row?.recordLabel ?? _label;
                    }}
                    formatter={(value, _name, item) => (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-medium">
                          {fmtBillingMoney(Number(value))}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {(item.payload as MonthlyChartPoint).label} ·{" "}
                          {format(
                            parseISO((item.payload as MonthlyChartPoint).date),
                            "MMM d, yyyy",
                          )}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: keyof typeof ACCENT;
}) {
  const a = ACCENT[accent]!;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 text-[10px] tabular-nums ${a.text}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function CompactEmptyState({ filter }: { filter: Filter }) {
  const map: Record<Filter, { title: string; icon: React.ElementType }> = {
    all: { title: "No tasks yet", icon: Inbox },
    today: { title: "Nothing due today", icon: CheckCircle2 },
    upcoming: { title: "No upcoming tasks", icon: CalendarDays },
    done: { title: "Nothing completed", icon: Circle },
  };
  const { title, icon: Icon } = map[filter];
  return (
    <div className="text-center py-10 px-4">
      <Icon className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
      <p className="text-xs font-medium">{title}</p>
    </div>
  );
}
