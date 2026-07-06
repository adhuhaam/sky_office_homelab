import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, loaTable, companiesTable } from "@leo/db";

const router: IRouter = Router();

// Public LOA read for print pages opened without a session (e.g. mobile in-app browser).
router.get("/loa/:id", async (req, res, next) => {
  if (req.session?.userId) {
    next();
    return;
  }
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [loa] = await db.select().from(loaTable).where(eq(loaTable.id, id));
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }
  res.json(loa);
});

// Public companies list for LOA print branding when unauthenticated.
router.get("/companies", async (req, res, next) => {
  if (req.session?.userId) {
    next();
    return;
  }
  const withBranding = req.query.withBranding === "true";
  const rows = await db.select().from(companiesTable).orderBy(companiesTable.name);
  const out = withBranding
    ? rows
    : rows.map((r) => ({ ...r, letterheadImage: null, signatureImage: null, invoiceLogoImage: null }));
  res.json(out);
});

export default router;
