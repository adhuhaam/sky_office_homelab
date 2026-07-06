import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { db, clientsTable } from "@leo/db";
import { requireRole } from "../middleware/require-auth.js";

const router: IRouter = Router();

const ClientBody = z.object({
  name: z.string().min(1),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function isFkViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

router.get("/clients", async (req, res): Promise<void> => {
  const role = req.session?.role ?? "";
  const search = typeof req.query["search"] === "string" ? req.query["search"].toLowerCase() : "";

  let rows;
  if (role === "superuser" || role === "admin") {
    rows = await db.select().from(clientsTable).orderBy(asc(clientsTable.name));
  } else if (role === "client") {
    const linkedId = Number(req.session?.linkedEntityId);
    if (!req.session?.linkedEntityId || Number.isNaN(linkedId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    rows = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, linkedId))
      .orderBy(asc(clientsTable.name));
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const filtered = search
    ? rows.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.contactPerson?.toLowerCase().includes(search) ?? false) ||
          (c.email?.toLowerCase().includes(search) ?? false),
      )
    : rows;
  res.json(filtered);
});

router.post("/clients", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = ClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(clientsTable)
    .values({ ...parsed.data, name: parsed.data.name.trim() })
    .returning();
  res.status(201).json(row);
});

router.patch("/clients/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = ClientBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch = { ...parsed.data };
  if (patch.name) patch.name = patch.name.trim();
  const [row] = await db.update(clientsTable).set(patch).where(eq(clientsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/clients/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  try {
    const deleted = await db.delete(clientsTable).where(eq(clientsTable.id, id)).returning({ id: clientsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(409).json({
        error: "Client is in use — remove linked passports or billing records first",
      });
      return;
    }
    throw err;
  }
});

export default router;
