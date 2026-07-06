import { Router, type IRouter, type Response } from "express";
import { eq, desc, and } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { db, loaTable, passportsTable, companiesTable } from "@leo/db";
import { requireRole } from "../middleware/require-auth.js";

const router: IRouter = Router();
export const loaPublicRouter: IRouter = Router();

const CreateLoaBody = z.object({
  companyId: z.number().int().optional(),
  passportId: z.number().int().optional(),
  companyName: z.string().nullable().optional(),
  companyAddress: z.string().nullable().optional(),
  companyEmail: z.string().nullable().optional(),
  companyPhone: z.string().nullable().optional(),
  companyCountry: z.string().nullable().optional(),
  companyRegistrationNumber: z.string().nullable().optional(),
  candidateName: z.string().nullable().optional(),
  candidateAddress: z.string().nullable().optional(),
  candidateNationality: z.string().nullable().optional(),
  candidateDateOfBirth: z.string().nullable().optional(),
  candidatePassportNumber: z.string().nullable().optional(),
  candidateEmergencyContact: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  workType: z.string().nullable().optional(),
  basicSalary: z.string().nullable().optional(),
  salaryPaymentDate: z.string().nullable().optional(),
  workSite: z.string().nullable().optional(),
  dateOfCommence: z.string().nullable().optional(),
  jobDescription: z.string().nullable().optional(),
  workingHours: z.string().nullable().optional(),
  workStatus: z.string().nullable().optional(),
  contractDuration: z.string().nullable().optional(),
  signatoryName: z.string().nullable().optional(),
  signatoryDesignation: z.string().nullable().optional(),
  signatureDate: z.string().nullable().optional(),
});

const UpdateLoaBody = CreateLoaBody.partial();

function loaAccessDenied(res: Response): void {
  res.status(403).json({ error: "Access denied" });
}

// Public read for print page (no auth).
loaPublicRouter.get("/loa/public/:id", async (req, res): Promise<void> => {
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

  let letterheadImage: string | null = null;
  let signatureImage: string | null = null;
  if (loa.companyId != null) {
    const [company] = await db
      .select({
        letterheadImage: companiesTable.letterheadImage,
        signatureImage: companiesTable.signatureImage,
        signatoryName: companiesTable.signatoryName,
        signatoryDesignation: companiesTable.signatoryDesignation,
      })
      .from(companiesTable)
      .where(eq(companiesTable.id, loa.companyId));
    if (company) {
      letterheadImage = company.letterheadImage;
      signatureImage = company.signatureImage;
    }
  }

  res.json({
    ...loa,
    letterheadImage,
    signatureImage,
  });
});

router.get("/loa", async (req, res): Promise<void> => {
  const rawPassportId = req.query.passportId;
  const passportId = rawPassportId ? parseInt(String(rawPassportId), 10) : null;
  const loaRole = req.session?.role;
  const linkedEntityId = req.session?.linkedEntityId;

  const conditions = [];
  if (passportId && !Number.isNaN(passportId)) {
    conditions.push(eq(loaTable.passportId, passportId));
  }

  if (loaRole === "superuser" || loaRole === "admin") {
    // unrestricted
  } else if (loaRole === "company") {
    const eid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    conditions.push(eq(loaTable.companyId, eid));
  } else {
    loaAccessDenied(res);
    return;
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const entries = await db
    .select()
    .from(loaTable)
    .where(where)
    .orderBy(desc(loaTable.createdAt));
  res.json(entries);
});

router.post("/loa", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const parsed = CreateLoaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const actorRole = req.session?.role ?? "";
  const actorLinkedId = req.session?.linkedEntityId;
  if (actorRole === "company") {
    const eid = Number(actorLinkedId);
    if (!actorLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    if (parsed.data.companyId !== eid) {
      res.status(403).json({ error: "Access denied — you may only create LOAs for your own company" });
      return;
    }
  }

  if (parsed.data.passportId) {
    const [existing] = await db
      .select()
      .from(loaTable)
      .where(eq(loaTable.passportId, parsed.data.passportId))
      .orderBy(desc(loaTable.createdAt))
      .limit(1);
    if (existing) {
      res.status(200).json(existing);
      return;
    }
  }

  const [loa] = await db.insert(loaTable).values(parsed.data).returning();

  if (parsed.data.passportId) {
    await db
      .update(passportsTable)
      .set({ submitted: true })
      .where(eq(passportsTable.id, parsed.data.passportId));
  }

  res.status(201).json(loa);
});

router.get("/loa/:id", async (req, res): Promise<void> => {
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

  const detailRole = req.session?.role;
  const detailLinkedId = req.session?.linkedEntityId;
  if (detailRole === "superuser" || detailRole === "admin") {
    // ok
  } else if (detailRole === "company") {
    const eid = Number(detailLinkedId);
    if (!detailLinkedId || Number.isNaN(eid) || loa.companyId !== eid) {
      loaAccessDenied(res);
      return;
    }
  } else {
    loaAccessDenied(res);
    return;
  }

  res.json(loa);
});

router.patch("/loa/:id", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = UpdateLoaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const patchRole = req.session?.role ?? "";
  const patchLinkedId = req.session?.linkedEntityId;
  if (patchRole === "company") {
    const eid = Number(patchLinkedId);
    if (!patchLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    const [existing] = await db
      .select({ companyId: loaTable.companyId })
      .from(loaTable)
      .where(eq(loaTable.id, id));
    if (!existing || existing.companyId !== eid) {
      res.status(403).json({ error: "Access denied — LOA not linked to your company" });
      return;
    }
  }

  const [loa] = await db
    .update(loaTable)
    .set(body.data)
    .where(eq(loaTable.id, id))
    .returning();
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }
  res.json(loa);
});

router.delete("/loa/:id", requireRole("superuser", "admin", "company"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const delRole = req.session?.role ?? "";
  const delLinkedId = req.session?.linkedEntityId;
  if (delRole === "company") {
    const eid = Number(delLinkedId);
    if (!delLinkedId || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied — no linked company on session" });
      return;
    }
    const [existing] = await db
      .select({ companyId: loaTable.companyId })
      .from(loaTable)
      .where(eq(loaTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "LOA not found" });
      return;
    }
    if (existing.companyId !== eid) {
      res.status(403).json({ error: "Access denied — LOA not linked to your company" });
      return;
    }
  }

  const [loa] = await db.delete(loaTable).where(eq(loaTable.id, id)).returning();
  if (!loa) {
    res.status(404).json({ error: "LOA not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/loa/:id/pdf", async (req, res): Promise<void> => {
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

  const pdfRole = req.session?.role;
  const pdfLinkedId = req.session?.linkedEntityId;
  if (pdfRole === "superuser" || pdfRole === "admin") {
    // unrestricted
  } else if (pdfRole === "company") {
    const eid = Number(pdfLinkedId);
    if (!pdfLinkedId || Number.isNaN(eid) || loa.companyId !== eid) {
      loaAccessDenied(res);
      return;
    }
  } else {
    loaAccessDenied(res);
    return;
  }

  let letterheadImage: string | null = null;
  let signatureImage: string | null = null;
  if (loa.companyId != null) {
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, loa.companyId));
    if (company) {
      letterheadImage = company.letterheadImage ?? null;
      signatureImage = company.signatureImage ?? null;
    }
  }

  const decodeDataUrl = (dataUrl: string | null): Buffer | null => {
    if (!dataUrl) return null;
    const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m?.[2]) return null;
    try {
      return Buffer.from(m[2], "base64");
    } catch {
      return null;
    }
  };
  const letterheadBuf = decodeDataUrl(letterheadImage);
  const signatureBuf = decodeDataUrl(signatureImage);

  const M = 30;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: M, bottom: M, left: M, right: M },
    info: { Title: "Letter of Appointment" },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="LOA-${loa.candidateName?.replace(/\s+/g, "-") ?? id}.pdf"`,
  );
  doc.pipe(res);

  const pageW = doc.page.width - M * 2;

  const rule = (color = "#CBD5E1", w = 0.4) => {
    doc
      .moveTo(M, doc.y)
      .lineTo(M + pageW, doc.y)
      .strokeColor(color)
      .lineWidth(w)
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);
  };

  const fmtDate = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s || "—";
  };

  const sectionHeader = (label: string) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(label, { lineGap: 1 });
    rule("#CBD5E1", 0.4);
    doc.moveDown(0.2);
  };

  const field = (label: string, value: string | null | undefined) => {
    const val = (value ?? "").trim() || "—";
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#1e293b")
      .text(`${label}: `, { continued: true, lineGap: 1 })
      .font("Helvetica")
      .fillColor("#334155")
      .text(val, { lineGap: 1 });
    doc.fillColor("#000000");
  };

  const gap = () => doc.moveDown(0.12);
  const sectionGap = () => doc.moveDown(0.7);

  if (letterheadBuf) {
    try {
      doc.image(letterheadBuf, M, M, { fit: [pageW, 66] });
      doc.y = M + 66;
    } catch (err) {
      req.log.warn({ err }, "Failed to embed company letterhead — skipping");
    }
  }

  rule("#CBD5E1", 0.5);
  doc.moveDown(0.5);

  const tY = doc.y;
  rule("#94A3B8", 0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#0f172a")
    .text("LETTER OF APPOINTMENT", M, tY + 5, { align: "center", width: pageW });
  doc.moveDown(0.25);
  rule("#94A3B8", 0.5);
  doc.moveDown(0.7);
  doc.fillColor("#000000");

  sectionHeader("1. Details of Employer;");
  field("Name", loa.companyName);
  gap();
  field("Address", loa.companyAddress);
  gap();
  field("Contact Details / Email address", loa.companyEmail);
  gap();
  field("Phone Number", loa.companyPhone);
  gap();
  field("Country of origin", loa.companyCountry);
  gap();
  field("Registration Number / ID Card", loa.companyRegistrationNumber);
  sectionGap();

  sectionHeader("2. Details of Employee;");
  field("Name", loa.candidateName);
  gap();
  field("Permanent Address", loa.candidateAddress);
  gap();
  field("Nationality", loa.candidateNationality);
  gap();
  field("Date of Birth", fmtDate(loa.candidateDateOfBirth));
  gap();
  field("Passport Number", loa.candidatePassportNumber);
  gap();
  field("Emergency Contact Details (name and contact number)", loa.candidateEmergencyContact);
  sectionGap();

  sectionHeader("4. Details of Employment;");
  field("Job Title / Occupation", loa.jobTitle);
  gap();
  field("Work Type", loa.workType);
  gap();
  field("Basic Salary (USD)", loa.basicSalary);
  gap();
  field("Date of Salary payment", loa.salaryPaymentDate?.trim() || "End of each month");
  gap();
  field("Work site", loa.workSite);
  gap();
  field("Date of Commence", loa.dateOfCommence?.trim() || "Date of Arrival");
  gap();
  field(
    "Job Description",
    loa.jobDescription?.trim() || "Job Description will be given the time of signing the contract",
  );
  gap();
  field("Working Hours", loa.workingHours?.trim() || "09:00 to 17:00 Saturday to Sunday");
  gap();
  field("Work Status (Permanent / Contract)", loa.workStatus?.trim() || "Contract based");
  gap();
  field(
    "Contract Duration (if Contracted employee)",
    loa.contractDuration?.trim() || "Contract will be for 2 years, Probation period is 3 months",
  );
  sectionGap();

  sectionHeader("Details of Signatory;");
  field("Name", loa.signatoryName);
  gap();
  field("Designation", loa.signatoryDesignation);
  doc.moveDown(0.7);

  if (signatureBuf) {
    try {
      const sigY = doc.y;
      doc.image(signatureBuf, M, sigY, { fit: [110, 36] });
      doc.y = sigY + 38;
    } catch (err) {
      req.log.warn({ err }, "Failed to embed company signature — skipping");
      doc.moveDown(1.5);
    }
  } else {
    doc
      .moveTo(M, doc.y + 18)
      .lineTo(M + 130, doc.y + 18)
      .strokeColor("#94A3B8")
      .lineWidth(0.5)
      .stroke()
      .strokeColor("#000000")
      .lineWidth(1);
    doc.moveDown(1.6);
  }

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text(loa.signatoryName ?? "");
  doc.font("Helvetica").fontSize(9).fillColor("#334155").text(loa.signatoryDesignation ?? "");
  doc.moveDown(0.3);
  field("Date", fmtDate(loa.signatureDate));
  doc.fillColor("#000000");

  doc.end();
});

export default router;
