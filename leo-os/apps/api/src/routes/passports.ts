import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, isNull, and, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, passportsTable, clientsTable, companiesTable, loaTable } from "@leo/db";
import { extractPassportData } from "../lib/ocr.js";
import { formatEmergencyContact } from "../lib/emergency-contact.js";
import { fetchXpatWorkPermit } from "../lib/xpat.js";
import { requireRole } from "../middleware/require-auth.js";
import { fromPath } from "pdf2pic";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import os from "os";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and PDF files are allowed"));
  },
});

const UpdatePassportBody = z.object({
  fullName: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  dateOfIssue: z.string().nullable().optional(),
  dateOfExpiry: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  status: z.string().optional(),
  companyId: z.number().nullable().optional(),
  clientId: z.number().nullable().optional(),
  workPermitNumber: z.string().nullable().optional(),
  agent: z.string().nullable().optional(),
  agencySalary: z.string().nullable().optional(),
  clientSalary: z.string().nullable().optional(),
  agentRate: z.string().nullable().optional(),
  employeeType: z.enum(["casual", "recruitment", "organization_employed"]).optional(),
  submitted: z.boolean().optional(),
});

async function preprocessImageBuffer(
  buffer: Buffer,
  mimetype: string,
): Promise<Buffer> {
  if (mimetype === "application/pdf") {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "passport-"));
    const tmpPdf = path.join(tmpDir, "passport.pdf");
    try {
      await fs.writeFile(tmpPdf, buffer);
      const convert = fromPath(tmpPdf, {
        density: 200,
        saveFilename: "passport",
        savePath: tmpDir,
        format: "png",
        width: 2000,
        height: 1600,
      });
      const result = await convert(1);
      if (!result.path) throw new Error("PDF to image conversion failed");
      return fs.readFile(result.path);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  return sharp(buffer)
    .rotate()
    .resize(2000, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function applyRoleScope(
  role: string,
  linkedEntityId: string | undefined,
  conditions: SQL[],
): { ok: true } | { ok: false; error: string } {
  if (role === "superuser" || role === "admin") return { ok: true };
  if (role === "company") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      return { ok: false, error: "Access denied — no linked company on session" };
    }
    conditions.push(eq(passportsTable.companyId, eid));
    return { ok: true };
  }
  if (role === "client") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      return { ok: false, error: "Access denied — no linked client on session" };
    }
    conditions.push(eq(passportsTable.clientId, eid));
    return { ok: true };
  }
  if (role === "employee") {
    const pid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(pid)) {
      return { ok: false, error: "Access denied — no linked passport on session" };
    }
    conditions.push(eq(passportsTable.id, pid));
    return { ok: true };
  }
  if (role === "agent") {
    if (!linkedEntityId) {
      return { ok: false, error: "Access denied — no linked agent name on session" };
    }
    conditions.push(eq(passportsTable.agent, String(linkedEntityId)));
    return { ok: true };
  }
  return { ok: false, error: "Access denied" };
}

function canReadPassport(
  role: string,
  linkedEntityId: string | undefined,
  passport: { id: number; companyId: number | null; clientId: number | null; agent: string | null },
): boolean {
  if (role === "superuser" || role === "admin") return true;
  if (role === "company") {
    const eid = Number(linkedEntityId);
    return !Number.isNaN(eid) && passport.companyId === eid;
  }
  if (role === "client") {
    const eid = Number(linkedEntityId);
    return !Number.isNaN(eid) && passport.clientId === eid;
  }
  if (role === "employee") {
    const pid = Number(linkedEntityId);
    return !Number.isNaN(pid) && passport.id === pid;
  }
  if (role === "agent") {
    return !!linkedEntityId && passport.agent === String(linkedEntityId);
  }
  return false;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseExpiryDate(raw: string): Date | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const passportSelect = {
  id: passportsTable.id,
  fullName: passportsTable.fullName,
  passportNumber: passportsTable.passportNumber,
  dateOfBirth: passportsTable.dateOfBirth,
  dateOfIssue: passportsTable.dateOfIssue,
  dateOfExpiry: passportsTable.dateOfExpiry,
  address: passportsTable.address,
  emergencyContactName: passportsTable.emergencyContactName,
  emergencyContactPhone: passportsTable.emergencyContactPhone,
  nationality: passportsTable.nationality,
  status: passportsTable.status,
  submitted: passportsTable.submitted,
  errorMessage: passportsTable.errorMessage,
  originalFilename: passportsTable.originalFilename,
  companyId: passportsTable.companyId,
  companyName: companiesTable.name,
  clientId: passportsTable.clientId,
  clientName: clientsTable.name,
  workPermitNumber: passportsTable.workPermitNumber,
  agent: passportsTable.agent,
  agencySalary: passportsTable.agencySalary,
  clientSalary: passportsTable.clientSalary,
  agentRate: passportsTable.agentRate,
  employeeType: passportsTable.employeeType,
  jobTitle: loaTable.jobTitle,
  createdAt: passportsTable.createdAt,
  updatedAt: passportsTable.updatedAt,
};

router.get("/passports", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const nationality = typeof req.query.nationality === "string" ? req.query.nationality : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : undefined;

  const conditions: SQL[] = [];
  if (nationality) conditions.push(eq(passportsTable.nationality, nationality));
  if (status) conditions.push(eq(passportsTable.status, status));
  if (clientId === "none") conditions.push(isNull(passportsTable.clientId));
  else if (clientId) {
    const n = Number(clientId);
    if (!Number.isNaN(n)) conditions.push(eq(passportsTable.clientId, n));
  }
  if (companyId === "none") conditions.push(isNull(passportsTable.companyId));
  else if (companyId) {
    const n = Number(companyId);
    if (!Number.isNaN(n)) conditions.push(eq(passportsTable.companyId, n));
  }

  const scope = applyRoleScope(req.session?.role ?? "", req.session?.linkedEntityId, conditions);
  if (!scope.ok) {
    res.status(403).json({ error: scope.error });
    return;
  }

  const results = await db
    .select(passportSelect)
    .from(passportsTable)
    .leftJoin(clientsTable, eq(passportsTable.clientId, clientsTable.id))
    .leftJoin(companiesTable, eq(passportsTable.companyId, companiesTable.id))
    .leftJoin(loaTable, eq(loaTable.passportId, passportsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(passportsTable.createdAt));

  const filtered = search
    ? results.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.fullName?.toLowerCase().includes(q) ||
          p.passportNumber?.toLowerCase().includes(q) ||
          p.workPermitNumber?.toLowerCase().includes(q) ||
          p.agent?.toLowerCase().includes(q)
        );
      })
    : results;

  res.json(filtered);
});

router.get("/passports/stats", async (req, res): Promise<void> => {
  const conditions: SQL[] = [];
  const scope = applyRoleScope(req.session?.role ?? "", req.session?.linkedEntityId, conditions);
  if (!scope.ok) {
    res.status(403).json({ error: scope.error });
    return;
  }

  const all = await db
    .select()
    .from(passportsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(passportsTable.createdAt));

  res.json({
    total: all.length,
    completed: all.filter((p) => p.status === "completed").length,
    processing: all.filter((p) => p.status === "processing").length,
    failed: all.filter((p) => p.status === "failed").length,
    bangladeshi: all.filter((p) => p.nationality === "bangladesh").length,
    indian: all.filter((p) => p.nationality === "india").length,
    recentUploads: all.slice(0, 5),
  });
});

router.get("/passports/work-permit-alerts", async (req, res): Promise<void> => {
  const conditions: SQL[] = [];
  const scope = applyRoleScope(req.session?.role ?? "", req.session?.linkedEntityId, conditions);
  if (!scope.ok) {
    res.status(403).json({ error: scope.error });
    return;
  }

  const passports = await db
    .select(passportSelect)
    .from(passportsTable)
    .leftJoin(clientsTable, eq(passportsTable.clientId, clientsTable.id))
    .leftJoin(companiesTable, eq(passportsTable.companyId, companiesTable.id))
    .leftJoin(loaTable, eq(loaTable.passportId, passportsTable.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const candidates = passports.filter(
    (p) => p.workPermitNumber?.trim() && p.passportNumber?.trim(),
  );

  const today = startOfDay(new Date());
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  type AlertRow = {
    passportId: number;
    employeeName: string;
    employerName: string | null;
    workPermitNumber: string;
    passportNumber: string;
    expiryDate: string;
    photoUrl: string | null;
    status: "expired" | "expiring_soon";
  };

  const alerts = await mapWithConcurrency(candidates, 6, async (passport) => {
    const wp = passport.workPermitNumber!.trim();
    const pp = passport.passportNumber!.trim();
    const xpat = await fetchXpatWorkPermit(wp, pp);
    if (!xpat?.workPermitExpiry) return null;

    const expiry = parseExpiryDate(xpat.workPermitExpiry);
    if (!expiry) return null;

    let status: AlertRow["status"] | null = null;
    if (expiry.getTime() < today.getTime()) {
      status = "expired";
    } else if (expiry.getTime() <= threeMonthsLater.getTime()) {
      status = "expiring_soon";
    }
    if (!status) return null;

    return {
      passportId: passport.id,
      employeeName: xpat.fullName?.trim() || passport.fullName?.trim() || "Unknown",
      employerName: xpat.employerName?.trim() || null,
      workPermitNumber: wp,
      passportNumber: pp,
      expiryDate: xpat.workPermitExpiry,
      photoUrl: xpat.photoUrl ?? null,
      status,
    } satisfies AlertRow;
  });

  const expired: AlertRow[] = [];
  const expiringSoon: AlertRow[] = [];

  for (const row of alerts) {
    if (!row) continue;
    if (row.status === "expired") expired.push(row);
    else expiringSoon.push(row);
  }

  const byExpiry = (a: AlertRow, b: AlertRow) =>
    new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();

  expired.sort(byExpiry);
  expiringSoon.sort(byExpiry);

  res.setHeader("Cache-Control", "public, max-age=900");
  res.json({ expired, expiringSoon });
});

router.post(
  "/passports/upload",
  requireRole("superuser", "admin", "company"),
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const rawCompanyId = req.body?.companyId;
    const parsedCompanyId = rawCompanyId ? parseInt(String(rawCompanyId), 10) : null;
    let companyId = parsedCompanyId && !Number.isNaN(parsedCompanyId) ? parsedCompanyId : null;

    const uploadRole = req.session?.role ?? "";
    const uploadLinkedId = req.session?.linkedEntityId;
    if (uploadRole === "company") {
      const eid = Number(uploadLinkedId);
      if (!uploadLinkedId || Number.isNaN(eid)) {
        res.status(403).json({ error: "Access denied — no linked company on session" });
        return;
      }
      companyId = eid;
    }

    const [passport] = await db
      .insert(passportsTable)
      .values({
        status: "processing",
        originalFilename: req.file.originalname,
        ...(companyId ? { companyId } : {}),
      })
      .returning();

    req.log.info({ passportId: passport.id }, "Passport record created, starting OCR");

    const fileBuffer = req.file.buffer;
    const fileMime = req.file.mimetype;
    (req.file as { buffer: Buffer | null }).buffer = null as unknown as Buffer;

    const passportId = passport.id;
    const log = req.log;

    void (async () => {
      try {
        const imgBuffer = await preprocessImageBuffer(fileBuffer, fileMime);
        fileBuffer.fill(0);
        const mime = fileMime === "application/pdf" ? "image/png" : "image/jpeg";
        const extracted = await extractPassportData(imgBuffer, mime);
        await db
          .update(passportsTable)
          .set({ ...extracted, status: "completed" })
          .where(eq(passportsTable.id, passportId));
        log.info({ passportId }, "OCR extraction completed");
      } catch (err) {
        log.error({ err, passportId }, "OCR extraction failed — deleting draft record");
        await db.delete(passportsTable).where(eq(passportsTable.id, passportId));
      }
    })();

    res.status(201).json(passport);
  },
);

router.get("/passports/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [passport] = await db
    .select(passportSelect)
    .from(passportsTable)
    .leftJoin(clientsTable, eq(passportsTable.clientId, clientsTable.id))
    .leftJoin(companiesTable, eq(passportsTable.companyId, companiesTable.id))
    .leftJoin(loaTable, eq(loaTable.passportId, passportsTable.id))
    .where(eq(passportsTable.id, id));

  if (!passport) {
    res.status(404).json({ error: "Passport not found" });
    return;
  }

  if (!canReadPassport(req.session?.role ?? "", req.session?.linkedEntityId, passport)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json(passport);
});

router.patch("/passports/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdatePassportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const patchRole = req.session?.role ?? "";
  const patchLinkedId = req.session?.linkedEntityId;
  if (patchRole === "superuser" || patchRole === "admin") {
    // ok
  } else if (patchRole === "company") {
    const eid = Number(patchLinkedId);
    if (!patchLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    const [target] = await db
      .select({ companyId: passportsTable.companyId })
      .from(passportsTable)
      .where(eq(passportsTable.id, id))
      .limit(1);
    if (!target || target.companyId !== eid) {
      res.status(403).json({ error: "Access denied — passport not linked to your company" });
      return;
    }
    if ("clientId" in parsed.data) {
      res.status(403).json({ error: "Company role cannot assign client allocations" });
      return;
    }
  } else {
    res.status(403).json({ error: "Insufficient permissions to update passports" });
    return;
  }

  if (parsed.data.clientId != null) {
    const [exists] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.id, parsed.data.clientId));
    if (!exists) {
      res.status(400).json({ error: "Allocation client does not exist" });
      return;
    }
  }

  if (parsed.data.companyId != null) {
    const [exists] = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .where(eq(companiesTable.id, parsed.data.companyId));
    if (!exists) {
      res.status(400).json({ error: "Company does not exist" });
      return;
    }
  }

  const [passport] = await db
    .update(passportsTable)
    .set(parsed.data)
    .where(eq(passportsTable.id, id))
    .returning();

  if (!passport) {
    res.status(404).json({ error: "Passport not found" });
    return;
  }

  if (
    "emergencyContactName" in parsed.data ||
    "emergencyContactPhone" in parsed.data
  ) {
    await db
      .update(loaTable)
      .set({
        candidateEmergencyContact: formatEmergencyContact(
          passport.emergencyContactName,
          passport.emergencyContactPhone,
        ),
      })
      .where(eq(loaTable.passportId, id));
  }

  if ("companyId" in parsed.data) {
    const companyId = parsed.data.companyId;
    if (companyId != null) {
      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId));
      if (company) {
        await db
          .update(loaTable)
          .set({
            companyId: company.id,
            companyName: company.name,
            companyAddress: company.address ?? null,
            companyEmail: company.email ?? null,
            companyPhone: company.phone ?? null,
            companyCountry: company.country ?? null,
            companyRegistrationNumber: company.registrationNumber ?? null,
          })
          .where(eq(loaTable.passportId, id));
      }
    } else {
      await db
        .update(loaTable)
        .set({
          companyId: null,
          companyName: null,
          companyAddress: null,
          companyEmail: null,
          companyPhone: null,
          companyCountry: null,
          companyRegistrationNumber: null,
        })
        .where(eq(loaTable.passportId, id));
    }
  }

  res.json(passport);
});

router.delete("/passports/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [passport] = await db
    .delete(passportsTable)
    .where(eq(passportsTable.id, id))
    .returning();

  if (!passport) {
    res.status(404).json({ error: "Passport not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
