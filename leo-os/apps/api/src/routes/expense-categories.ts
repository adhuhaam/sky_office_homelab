import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { db, expenseCategoriesTable, expensesTable } from "@leo/db";
import { requireRole } from "../middleware/require-auth.js";

const router: IRouter = Router();

const CategoryBody = z.object({
  name: z.string().min(1),
  color: z.string().nullable().optional(),
});

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

function isFkViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

router.get("/expense-categories", async (_req, res) => {
  const rows = await db
    .select()
    .from(expenseCategoriesTable)
    .orderBy(asc(expenseCategoriesTable.name));
  res.json(rows);
});

router.post("/expense-categories", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = CategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }
  const existing = await db
    .select({ id: expenseCategoriesTable.id })
    .from(expenseCategoriesTable)
    .where(sql`lower(${expenseCategoriesTable.name}) = lower(${name})`);
  if (existing.length > 0) {
    res.status(409).json({ error: "A category with this name already exists" });
    return;
  }
  let row;
  try {
    [row] = await db
      .insert(expenseCategoriesTable)
      .values({ name, color: parsed.data.color ?? null })
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "A category with this name already exists" });
      return;
    }
    throw err;
  }
  res.status(201).json(row);
});

router.patch("/expense-categories/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = CategoryBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch: { name?: string; color?: string | null } = {};
  if (parsed.data.name !== undefined) {
    const trimmed = parsed.data.name.trim();
    if (!trimmed) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }
    const dupes = await db
      .select({ id: expenseCategoriesTable.id })
      .from(expenseCategoriesTable)
      .where(sql`lower(${expenseCategoriesTable.name}) = lower(${trimmed})`);
    if (dupes.some((d) => d.id !== id)) {
      res.status(409).json({ error: "Another category with this name already exists" });
      return;
    }
    patch.name = trimmed;
  }
  if (parsed.data.color !== undefined) {
    patch.color = parsed.data.color;
  }
  let row;
  try {
    [row] = await db
      .update(expenseCategoriesTable)
      .set(patch)
      .where(eq(expenseCategoriesTable.id, id))
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "Another category with this name already exists" });
      return;
    }
    throw err;
  }
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/expense-categories/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const inUse = await db
    .select({ id: expensesTable.id })
    .from(expensesTable)
    .where(eq(expensesTable.categoryId, id))
    .limit(1);
  if (inUse.length > 0) {
    res.status(409).json({
      error: "Category is in use — delete or reassign its expenses first",
    });
    return;
  }
  let row;
  try {
    [row] = await db
      .delete(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.id, id))
      .returning();
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(409).json({
        error: "Category is in use — delete or reassign its expenses first",
      });
      return;
    }
    throw err;
  }
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
