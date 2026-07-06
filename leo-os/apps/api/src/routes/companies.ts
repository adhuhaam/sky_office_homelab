import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import multer from "multer";
import { z } from "zod";
import { db, companiesTable, billingDocumentsTable, passwordsTable } from "@leo/db";
import { requireRole } from "../middleware/require-auth.js";

const router: IRouter = Router();

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DATA_URL_RE = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/;

function validateImageDataUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return `${label} must be a string`;
  const m = value.match(DATA_URL_RE);
  if (!m) return `${label} must be a data:image/(png|jpeg);base64 URL`;
  const base64Len = m[2].length;
  const padding = m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64Len * 3) / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) {
    return `${label} exceeds ${(MAX_IMAGE_BYTES / 1024).toFixed(0)} KB limit`;
  }
  return null;
}

const CompanyBody = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  signatoryName: z.string().nullable().optional(),
  signatoryDesignation: z.string().nullable().optional(),
  letterheadImage: z.string().nullable().optional(),
  signatureImage: z.string().nullable().optional(),
  invoiceLogoImage: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountHolder: z.string().nullable().optional(),
  bankSwiftCode: z.string().nullable().optional(),
});

function companyCanEdit(role: string, linkedId: number | null, companyId: number): boolean {
  if (["superuser", "admin"].includes(role)) return true;
  if (role === "company" && linkedId != null && !Number.isNaN(linkedId)) {
    return linkedId === companyId;
  }
  return false;
}

function isFkViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

router.get("/companies", async (req, res): Promise<void> => {
  const withBranding = req.query.withBranding === "true";
  const role = req.session?.role ?? "";
  const linkedId = Number(req.session?.linkedEntityId);

  if (["employee", "agent", "client"].includes(role)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const selectFields = {
    id: companiesTable.id,
    name: companiesTable.name,
    address: companiesTable.address,
    email: companiesTable.email,
    phone: companiesTable.phone,
    country: companiesTable.country,
    registrationNumber: companiesTable.registrationNumber,
    signatoryName: companiesTable.signatoryName,
    signatoryDesignation: companiesTable.signatoryDesignation,
    letterheadImage: withBranding ? companiesTable.letterheadImage : companiesTable.id,
    signatureImage: withBranding ? companiesTable.signatureImage : companiesTable.id,
    invoiceLogoImage: withBranding ? companiesTable.invoiceLogoImage : companiesTable.id,
    bankName: companiesTable.bankName,
    bankAccountNumber: companiesTable.bankAccountNumber,
    bankAccountHolder: companiesTable.bankAccountHolder,
    bankSwiftCode: companiesTable.bankSwiftCode,
    createdAt: companiesTable.createdAt,
    updatedAt: companiesTable.updatedAt,
  };

  if (role === "company") {
    if (!req.session?.linkedEntityId || Number.isNaN(linkedId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const rows = await db
      .select(selectFields)
      .from(companiesTable)
      .where(eq(companiesTable.id, linkedId));
    const out = withBranding
      ? rows
      : rows.map((r) => ({ ...r, letterheadImage: null, signatureImage: null, invoiceLogoImage: null }));
    res.json(out);
    return;
  }

  const rows = await db
    .select(selectFields)
    .from(companiesTable)
    .orderBy(asc(companiesTable.name));
  const out = withBranding
    ? rows
    : rows.map((r) => ({ ...r, letterheadImage: null, signatureImage: null, invoiceLogoImage: null }));
  res.json(out);
});

router.post("/companies", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = CompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const lhErr = validateImageDataUrl(parsed.data.letterheadImage, "letterheadImage");
  const sigErr = validateImageDataUrl(parsed.data.signatureImage, "signatureImage");
  const logoErr = validateImageDataUrl(parsed.data.invoiceLogoImage, "invoiceLogoImage");
  if (lhErr || sigErr || logoErr) {
    res.status(400).json({ error: lhErr ?? sigErr ?? logoErr });
    return;
  }
  const [row] = await db
    .insert(companiesTable)
    .values({ ...parsed.data, name: parsed.data.name.trim() })
    .returning();
  await db.insert(passwordsTable).values({ companyId: row!.id });
  res.status(201).json(row);
});

router.patch("/companies/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const role = req.session?.role ?? "";
  const linkedId = req.session?.linkedEntityId ? Number(req.session.linkedEntityId) : null;
  if (!companyCanEdit(role, linkedId, id)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = CompanyBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const lhErr = validateImageDataUrl(parsed.data.letterheadImage, "letterheadImage");
  const sigErr = validateImageDataUrl(parsed.data.signatureImage, "signatureImage");
  const logoErr = validateImageDataUrl(parsed.data.invoiceLogoImage, "invoiceLogoImage");
  if (lhErr || sigErr || logoErr) {
    res.status(400).json({ error: lhErr ?? sigErr ?? logoErr });
    return;
  }
  const patch = { ...parsed.data };
  if (patch.name) patch.name = patch.name.trim();

  const [row] = await db
    .update(companiesTable)
    .set(patch)
    .where(eq(companiesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post(
  "/companies/:id/branding",
  brandingUpload.fields([
    { name: "letterhead", maxCount: 1 },
    { name: "signature", maxCount: 1 },
    { name: "invoiceLogo", maxCount: 1 },
  ]),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid company id" });
      return;
    }

    const role = req.session?.role ?? "";
    const linkedId = req.session?.linkedEntityId ? Number(req.session.linkedEntityId) : null;
    if (!companyCanEdit(role, linkedId, id)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const update: Record<string, string> = {};
    for (const [field, dbKey] of [
      ["letterhead", "letterheadImage"],
      ["signature", "signatureImage"],
      ["invoiceLogo", "invoiceLogoImage"],
    ] as const) {
      const f = files?.[field]?.[0];
      if (f) {
        const mime = f.mimetype.startsWith("image/") ? f.mimetype : "image/png";
        update[dbKey] = `data:${mime};base64,${f.buffer.toString("base64")}`;
      }
    }
    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const [company] = await db
      .update(companiesTable)
      .set(update)
      .where(eq(companiesTable.id, id))
      .returning();
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(company);
  },
);

router.delete("/companies/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const refs = await db
    .select({ id: billingDocumentsTable.id })
    .from(billingDocumentsTable)
    .where(eq(billingDocumentsTable.companyId, id))
    .limit(1);
  if (refs.length > 0) {
    res.status(409).json({ error: "Company has billing documents and cannot be deleted" });
    return;
  }
  try {
    const deleted = await db
      .delete(companiesTable)
      .where(eq(companiesTable.id, id))
      .returning({ id: companiesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    if (isFkViolation(err)) {
      res.status(409).json({
        error: "Company is in use — remove linked users, passports, or LOA records first",
      });
      return;
    }
    throw err;
  }
});

export default router;
