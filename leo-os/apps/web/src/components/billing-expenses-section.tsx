import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { DollarSign, Loader2, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type BillingDocument, type Expense, type ExpenseCategory, ApiError } from "@/lib/api";
import { billingDocTotal, fmtBillingMoney } from "@/lib/billing";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type ExpenseForm = { categoryId: string; amount: string; expenseDate: string; remarks: string };

export function BillingExpensesSection() {
  const { toast } = useToast();
  const [allDocs, setAllDocs] = useState<BillingDocument[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>({ categoryId: "", amount: "", expenseDate: todayIso(), remarks: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [docs, ex, cats] = await Promise.all([
        apiFetch<BillingDocument[]>("/billing/documents"),
        apiFetch<Expense[]>("/expenses"),
        apiFetch<ExpenseCategory[]>("/expense-categories"),
      ]);
      setAllDocs(docs);
      setExpenses(ex);
      setCategories(cats);
    } catch (err) {
      toast({
        title: "Failed to load finance data",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const revenue = useMemo(
    () =>
      allDocs
        .filter((d) => d.status === "payment_received" || d.status === "completed")
        .reduce((s, d) => s + billingDocTotal(d), 0),
    [allDocs],
  );

  const totalSalaryCost = useMemo(
    () =>
      allDocs
        .filter((d) => d.status === "payment_received" || d.status === "completed")
        .reduce((s, d) => s + Number(d.employeeCost || 0), 0),
    [allDocs],
  );

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const netProfit = revenue - totalSalaryCost - totalExpenses;

  function openCreate() {
    setEditing(null);
    setForm({
      categoryId: categories[0] ? String(categories[0].id) : "",
      amount: "",
      expenseDate: todayIso(),
      remarks: "",
    });
    setAddOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setForm({
      categoryId: String(expense.categoryId),
      amount: expense.amount,
      expenseDate: expense.expenseDate ?? todayIso(),
      remarks: expense.remarks ?? "",
    });
    setAddOpen(true);
  }

  async function saveExpense() {
    const categoryId = Number(form.categoryId);
    if (!form.categoryId || !Number.isFinite(categoryId) || !categories.some((c) => c.id === categoryId)) {
      toast({ title: "Pick a category", variant: "destructive" });
      return;
    }
    const amt = form.amount.replace(/,/g, "").trim();
    if (!amt || Number(amt) < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId,
        amount: amt,
        expenseDate: form.expenseDate || null,
        remarks: form.remarks.trim() || null,
      };
      if (editing) {
        await apiFetch(`/expenses/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast({ title: "Expense updated" });
      } else {
        await apiFetch("/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Expense added" });
      }
      setAddOpen(false);
      void load();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/expenses/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "Expense deleted" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 border-t border-slate-200" />
        <div className="flex items-center gap-2 text-slate-500">
          <Wallet className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Expenses &amp; P&amp;L</span>
        </div>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-emerald-700">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Revenue Received</span>
          </div>
          <p className="text-xl font-bold text-emerald-800">MVR {fmtBillingMoney(revenue)}</p>
          <p className="mt-0.5 text-[10px] text-emerald-600">Paid &amp; completed invoices</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-amber-700">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Employee Costs</span>
          </div>
          <p className="text-xl font-bold text-amber-800">MVR {fmtBillingMoney(totalSalaryCost)}</p>
          <p className="mt-0.5 text-[10px] text-amber-600">Net salaries on paid invoices</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-rose-700">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-medium">Other Expenses</span>
          </div>
          <p className="text-xl font-bold text-rose-800">MVR {fmtBillingMoney(totalExpenses)}</p>
          <p className="mt-0.5 text-[10px] text-rose-600">{expenses.length} entries</p>
        </div>
        <div
          className={`rounded-xl border-2 p-4 ${
            netProfit >= 0 ? "border-indigo-200 bg-indigo-50" : "border-orange-200 bg-orange-50"
          }`}
        >
          <div className={`mb-1 flex items-center gap-2 ${netProfit >= 0 ? "text-indigo-700" : "text-orange-700"}`}>
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Net Profit</span>
          </div>
          <p className={`text-xl font-bold ${netProfit >= 0 ? "text-indigo-800" : "text-orange-800"}`}>
            MVR {fmtBillingMoney(netProfit)}
          </p>
          <p className="mt-0.5 text-[10px] opacity-70">Revenue − costs − expenses</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Expense Ledger</h2>
        <Button size="sm" variant="outline" onClick={openCreate} disabled={categories.length === 0}>
          <Plus className="h-3.5 w-3.5" />
          Add Expense
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-slate-500">
          No expense categories yet —{" "}
          <Link href="/settings" className="font-medium underline">
            add categories in Settings
          </Link>
          .
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {expenses.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No expenses recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium">{e.categoryName}</td>
                    <td className="px-4 py-3">MVR {fmtBillingMoney(Number(e.amount))}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.expenseDate ?? "—"}</td>
                    <td className="max-w-xs px-4 py-3">
                      <span className="line-clamp-2">{e.remarks ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-rose-500"
                          onClick={() => setDeleteTarget(e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (MVR)</Label>
                <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveExpense} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the MVR {fmtBillingMoney(Number(deleteTarget?.amount ?? 0))} entry under{" "}
              {deleteTarget?.categoryName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
