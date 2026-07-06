import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { db, passwordsTable, companiesTable } from "@leo/db";

const router: IRouter = Router();

const UpdatePasswordBody = z.object({
  efaasUsername: z.string().optional(),
  efaasPassword: z.string().optional(),
  gmailUsername: z.string().optional(),
  gmailPassword: z.string().optional(),
});

const BackfillPasswordBody = z.object({
  companyId: z.number().int().positive(),
});

router.get("/passwords", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const rows = await db
    .select({
      id: passwordsTable.id,
      companyId: passwordsTable.companyId,
      companyName: companiesTable.name,
      efaasUsername: passwordsTable.efaasUsername,
      efaasPassword: passwordsTable.efaasPassword,
      gmailUsername: passwordsTable.gmailUsername,
      gmailPassword: passwordsTable.gmailPassword,
      createdAt: passwordsTable.createdAt,
      updatedAt: passwordsTable.updatedAt,
    })
    .from(passwordsTable)
    .innerJoin(companiesTable, eq(passwordsTable.companyId, companiesTable.id))
    .orderBy(asc(companiesTable.name));

  const filtered = search
    ? rows.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.companyName.toLowerCase().includes(q) ||
          p.efaasUsername.toLowerCase().includes(q) ||
          p.gmailUsername.toLowerCase().includes(q)
        );
      })
    : rows;
  res.json(filtered);
});

router.post("/passwords", async (req, res): Promise<void> => {
  const parsed = BackfillPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { companyId } = parsed.data;

  const [company] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const [existing] = await db
    .select({ id: passwordsTable.id })
    .from(passwordsTable)
    .where(eq(passwordsTable.companyId, companyId))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Password record already exists for this company" });
    return;
  }

  const [row] = await db
    .insert(passwordsTable)
    .values({ companyId })
    .returning();
  if (!row) {
    res.status(500).json({ error: "Failed to create password record" });
    return;
  }
  const [withName] = await db
    .select({
      id: passwordsTable.id,
      companyId: passwordsTable.companyId,
      companyName: companiesTable.name,
      efaasUsername: passwordsTable.efaasUsername,
      efaasPassword: passwordsTable.efaasPassword,
      gmailUsername: passwordsTable.gmailUsername,
      gmailPassword: passwordsTable.gmailPassword,
      createdAt: passwordsTable.createdAt,
      updatedAt: passwordsTable.updatedAt,
    })
    .from(passwordsTable)
    .innerJoin(companiesTable, eq(passwordsTable.companyId, companiesTable.id))
    .where(eq(passwordsTable.id, row.id));
  res.status(201).json(withName);
});

router.patch("/passwords/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdatePasswordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const patch: {
    efaasUsername?: string;
    efaasPassword?: string;
    gmailUsername?: string;
    gmailPassword?: string;
  } = {};
  if (body.data.efaasUsername !== undefined) patch.efaasUsername = body.data.efaasUsername.trim();
  if (body.data.efaasPassword !== undefined) patch.efaasPassword = body.data.efaasPassword;
  if (body.data.gmailUsername !== undefined) patch.gmailUsername = body.data.gmailUsername.trim();
  if (body.data.gmailPassword !== undefined) patch.gmailPassword = body.data.gmailPassword;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [updated] = await db
    .update(passwordsTable)
    .set(patch)
    .where(eq(passwordsTable.id, id))
    .returning({ id: passwordsTable.id });
  if (!updated) {
    res.status(404).json({ error: "Password entry not found" });
    return;
  }
  const [row] = await db
    .select({
      id: passwordsTable.id,
      companyId: passwordsTable.companyId,
      companyName: companiesTable.name,
      efaasUsername: passwordsTable.efaasUsername,
      efaasPassword: passwordsTable.efaasPassword,
      gmailUsername: passwordsTable.gmailUsername,
      gmailPassword: passwordsTable.gmailPassword,
      createdAt: passwordsTable.createdAt,
      updatedAt: passwordsTable.updatedAt,
    })
    .from(passwordsTable)
    .innerJoin(companiesTable, eq(passwordsTable.companyId, companiesTable.id))
    .where(eq(passwordsTable.id, id));
  res.json(row);
});

export default router;
