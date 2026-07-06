import { Router, type IRouter } from "express";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, expensesTable, expenseCategoriesTable } from "@leo/db";
import { requireRole } from "../middleware/require-auth.js";
import { normalizeMoney, normalizeDate } from "../lib/money.js";

const router: IRouter = Router();

const ExpenseBody = z.object({
  categoryId: z.coerce.number().int().positive(),
  amount: z.preprocess((v) => (v == null ? v : String(v)), z.string().min(1)),
  expenseDate: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
});

function validationError(parsed: z.SafeParseError<unknown>): string {
  const issue = parsed.error.issues[0];
  if (!issue) return "Invalid request";
  if (issue.path.join(".") === "categoryId") return "Pick a valid category";
  if (issue.path.join(".") === "amount") return "Enter a valid amount";
  return issue.message;
}

function isFkViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

router.get("/expenses", async (req, res): Promise<void> => {
  const role = req.session?.role ?? "";
  if (role !== "superuser" && role !== "admin") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const categoryId = req.query["categoryId"] ? Number(req.query["categoryId"]) : undefined;
  const search = typeof req.query["search"] === "string" ? req.query["search"].toLowerCase() : "";
  const conds: SQL[] = [];
  if (categoryId && !Number.isNaN(categoryId)) {
    conds.push(eq(expensesTable.categoryId, categoryId));
  }

  const rows = await db
    .select({
      id: expensesTable.id,
      categoryId: expensesTable.categoryId,
      categoryName: expenseCategoriesTable.name,
      categoryColor: expenseCategoriesTable.color,
      amount: expensesTable.amount,
      expenseDate: expensesTable.expenseDate,
      remarks: expensesTable.remarks,
      createdAt: expensesTable.createdAt,
    })
    .from(expensesTable)
    .innerJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(expensesTable.createdAt));

  const filtered = search
    ? rows.filter(
        (r) =>
          r.categoryName.toLowerCase().includes(search) ||
          (r.remarks?.toLowerCase().includes(search) ?? false),
      )
    : rows;
  res.json(filtered);
});

router.post("/expenses", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = ExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: validationError(parsed) });
    return;
  }
  const amount = normalizeMoney(parsed.data.amount);
  if (!amount) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }
  const date = normalizeDate(parsed.data.expenseDate);
  if (date === "invalid") {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  try {
    const [row] = await db
      .insert(expensesTable)
      .values({
        categoryId: parsed.data.categoryId,
        amount,
        expenseDate: date,
        remarks: parsed.data.remarks?.trim() || null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(400).json({ error: "Pick a valid category" });
      return;
    }
    throw err;
  }
});

router.patch("/expenses/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = ExpenseBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: validationError(parsed) });
    return;
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.categoryId !== undefined) patch["categoryId"] = parsed.data.categoryId;
  if (parsed.data.amount !== undefined) {
    const amount = normalizeMoney(parsed.data.amount);
    if (!amount) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }
    patch["amount"] = amount;
  }
  if (parsed.data.expenseDate !== undefined) {
    const date = normalizeDate(parsed.data.expenseDate);
    if (date === "invalid") {
      res.status(400).json({ error: "Invalid date" });
      return;
    }
    patch["expenseDate"] = date;
  }
  if (parsed.data.remarks !== undefined) patch["remarks"] = parsed.data.remarks?.trim() || null;

  try {
    const [row] = await db.update(expensesTable).set(patch).where(eq(expensesTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(400).json({ error: "Pick a valid category" });
      return;
    }
    throw err;
  }
});

router.delete("/expenses/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const deleted = await db.delete(expensesTable).where(eq(expensesTable.id, id)).returning({ id: expensesTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
