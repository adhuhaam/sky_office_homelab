import { Router, type IRouter } from "express";
import { eq, and, asc, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, salaryRecordsTable, passportsTable, loaTable, companiesTable } from "@leo/db";
import { requireRole } from "../middleware/require-auth.js";
import { normalizeMoney, computeNetSalary, salaryDays } from "../lib/money.js";

const router: IRouter = Router();

function validateConfirmedSalary(data: {
  status?: string;
  daysWorked?: number | null;
  basicSalary?: string | null;
}): string | null {
  if (data.status !== "confirmed") return null;
  if (salaryDays(data.daysWorked) <= 0) {
    return "Days worked is required when confirming a salary record";
  }
  if (Number(data.basicSalary ?? "0") <= 0) {
    return "Employee daily rate is required when confirming a salary record";
  }
  return null;
}

const SalaryBodyFields = z.object({
  employeeName: z.string().min(1).optional(),
  passportId: z.number().int().nullable().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  basicSalary: z.string().optional(),
  foodAllowance: z.string().optional(),
  transportAllowance: z.string().optional(),
  otherAllowances: z.string().optional(),
  deductions: z.string().optional(),
  otherExpenses: z.string().optional(),
  clientSalary: z.string().optional(),
  invoiceId: z.number().int().nullable().optional(),
  daysWorked: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["draft", "confirmed"]).optional(),
});

const SalaryBody = SalaryBodyFields.refine(
  (data) => Boolean(data.employeeName?.trim()) || data.passportId != null,
  { message: "employeeName or passportId is required" },
);

const SalaryPatchBody = SalaryBodyFields.partial();

function shape(
  r: typeof salaryRecordsTable.$inferSelect & {
    passportNumber?: string | null;
    employeeType?: string | null;
    jobTitle?: string | null;
    agencySalary?: string | null;
    companyId?: number | null;
    companyName?: string | null;
    companyAddress?: string | null;
    companyEmail?: string | null;
    companyPhone?: string | null;
    companySignatoryName?: string | null;
    companySignatoryDesignation?: string | null;
  },
) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/salary-records", async (req, res): Promise<void> => {
  const role = req.session?.role ?? "";
  const linkedEntityId = req.session?.linkedEntityId;

  const conds: SQL[] = [];

  if (role === "employee") {
    const pid = Number(linkedEntityId);
    if (!linkedEntityId || Number.isNaN(pid)) {
      res.status(403).json({ error: "Access denied — no linked passport on session" });
      return;
    }
    conds.push(eq(salaryRecordsTable.passportId, pid));
  } else if (role !== "superuser" && role !== "admin") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const month = req.query["month"] ? Number(req.query["month"]) : undefined;
  const year = req.query["year"] ? Number(req.query["year"]) : undefined;
  const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const passportId = req.query["passportId"] ? Number(req.query["passportId"]) : undefined;
  const clientIdRaw = req.query["clientId"];
  const clientId =
    typeof clientIdRaw === "string" && clientIdRaw.trim() ? Number(clientIdRaw) : undefined;
  const unlinked =
    req.query["unlinked"] === "true" ||
    req.query["unlinked"] === "1" ||
    req.query["forInvoice"] === "true" ||
    req.query["forInvoice"] === "1";

  if (month) conds.push(eq(salaryRecordsTable.month, month));
  if (year) conds.push(eq(salaryRecordsTable.year, year));
  if (status) conds.push(eq(salaryRecordsTable.status, status));
  if (passportId) conds.push(eq(salaryRecordsTable.passportId, passportId));
  if (unlinked) conds.push(isNull(salaryRecordsTable.invoiceId));
  if (clientId != null && !Number.isNaN(clientId)) {
    conds.push(eq(passportsTable.clientId, clientId));
    conds.push(eq(passportsTable.employeeType, "casual"));
  }

  const rows = await db
    .select({
      id: salaryRecordsTable.id,
      employeeName: salaryRecordsTable.employeeName,
      passportId: salaryRecordsTable.passportId,
      month: salaryRecordsTable.month,
      year: salaryRecordsTable.year,
      basicSalary: salaryRecordsTable.basicSalary,
      foodAllowance: salaryRecordsTable.foodAllowance,
      transportAllowance: salaryRecordsTable.transportAllowance,
      otherAllowances: salaryRecordsTable.otherAllowances,
      deductions: salaryRecordsTable.deductions,
      otherExpenses: salaryRecordsTable.otherExpenses,
      netSalary: salaryRecordsTable.netSalary,
      clientSalary: salaryRecordsTable.clientSalary,
      invoiceId: salaryRecordsTable.invoiceId,
      daysWorked: salaryRecordsTable.daysWorked,
      notes: salaryRecordsTable.notes,
      status: salaryRecordsTable.status,
      createdAt: salaryRecordsTable.createdAt,
      updatedAt: salaryRecordsTable.updatedAt,
      passportNumber: passportsTable.passportNumber,
      employeeType: passportsTable.employeeType,
      jobTitle: loaTable.jobTitle,
      agencySalary: passportsTable.agencySalary,
      companyId: passportsTable.companyId,
      companyName: companiesTable.name,
      companyAddress: companiesTable.address,
      companyEmail: companiesTable.email,
      companyPhone: companiesTable.phone,
      companySignatoryName: companiesTable.signatoryName,
      companySignatoryDesignation: companiesTable.signatoryDesignation,
    })
    .from(salaryRecordsTable)
    .leftJoin(passportsTable, eq(salaryRecordsTable.passportId, passportsTable.id))
    .leftJoin(companiesTable, eq(passportsTable.companyId, companiesTable.id))
    .leftJoin(loaTable, eq(loaTable.passportId, passportsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(salaryRecordsTable.year), asc(salaryRecordsTable.month));

  res.json(rows.map(shape));
});

router.post("/salary-records", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = SalaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const daysWorked = parsed.data.daysWorked ?? 0;
  const moneyFields = {
    basicSalary: normalizeMoney(parsed.data.basicSalary ?? "0") ?? "0.00",
    foodAllowance: normalizeMoney(parsed.data.foodAllowance ?? "0") ?? "0.00",
    transportAllowance: normalizeMoney(parsed.data.transportAllowance ?? "0") ?? "0.00",
    otherAllowances: normalizeMoney(parsed.data.otherAllowances ?? "0") ?? "0.00",
    deductions: normalizeMoney(parsed.data.deductions ?? "0") ?? "0.00",
    otherExpenses: normalizeMoney(parsed.data.otherExpenses ?? "0") ?? "0.00",
    clientSalary: normalizeMoney(parsed.data.clientSalary ?? "0") ?? "0.00",
    daysWorked,
  };
  const status = parsed.data.status ?? "draft";
  const confirmError = validateConfirmedSalary({ status, daysWorked, basicSalary: moneyFields.basicSalary });
  if (confirmError) {
    res.status(400).json({ error: confirmError });
    return;
  }
  const netSalary = computeNetSalary(moneyFields);

  let employeeName = parsed.data.employeeName?.trim() ?? "";
  if (!employeeName && parsed.data.passportId != null) {
    const [passport] = await db
      .select({ fullName: passportsTable.fullName })
      .from(passportsTable)
      .where(eq(passportsTable.id, parsed.data.passportId))
      .limit(1);
    if (!passport?.fullName?.trim()) {
      res.status(400).json({ error: "Passport not found or has no full name" });
      return;
    }
    employeeName = passport.fullName.trim();
  }

  try {
    const [row] = await db
      .insert(salaryRecordsTable)
      .values({
        employeeName,
        passportId: parsed.data.passportId ?? null,
        month: parsed.data.month,
        year: parsed.data.year,
        ...moneyFields,
        netSalary,
        invoiceId: parsed.data.invoiceId ?? null,
        daysWorked,
        notes: parsed.data.notes ?? null,
        status,
      })
      .returning();
    res.status(201).json(shape(row!));
  } catch {
    res.status(409).json({ error: "Salary record already exists for this employee/month/year" });
  }
});

router.patch("/salary-records/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = SalaryPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(salaryRecordsTable)
    .where(eq(salaryRecordsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.employeeName) patch["employeeName"] = parsed.data.employeeName.trim();
  if (parsed.data.passportId !== undefined) patch["passportId"] = parsed.data.passportId;
  if (parsed.data.month !== undefined) patch["month"] = parsed.data.month;
  if (parsed.data.year !== undefined) patch["year"] = parsed.data.year;
  if (parsed.data.invoiceId !== undefined) patch["invoiceId"] = parsed.data.invoiceId;
  if (parsed.data.daysWorked !== undefined) patch["daysWorked"] = parsed.data.daysWorked;
  if (parsed.data.notes !== undefined) patch["notes"] = parsed.data.notes;
  if (parsed.data.status !== undefined) patch["status"] = parsed.data.status;

  for (const field of [
    "basicSalary",
    "foodAllowance",
    "transportAllowance",
    "otherAllowances",
    "deductions",
    "otherExpenses",
    "clientSalary",
  ] as const) {
    if (parsed.data[field] !== undefined) {
      patch[field] = normalizeMoney(parsed.data[field] ?? "0") ?? "0.00";
    }
  }

  const merged = { ...existing, ...patch };
  const confirmError = validateConfirmedSalary({
    status: (merged.status as string) ?? "draft",
    daysWorked: merged.daysWorked as number,
    basicSalary: String(merged.basicSalary ?? "0"),
  });
  if (confirmError) {
    res.status(400).json({ error: confirmError });
    return;
  }
  patch["netSalary"] = computeNetSalary({
    basicSalary: String(merged.basicSalary ?? "0"),
    foodAllowance: String(merged.foodAllowance ?? "0"),
    transportAllowance: String(merged.transportAllowance ?? "0"),
    otherAllowances: String(merged.otherAllowances ?? "0"),
    deductions: String(merged.deductions ?? "0"),
    otherExpenses: String(merged.otherExpenses ?? "0"),
    daysWorked: merged.daysWorked as number,
  });

  const [row] = await db
    .update(salaryRecordsTable)
    .set(patch)
    .where(eq(salaryRecordsTable.id, id))
    .returning();
  res.json(shape(row!));
});

router.delete("/salary-records/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const deleted = await db
    .delete(salaryRecordsTable)
    .where(eq(salaryRecordsTable.id, id))
    .returning({ id: salaryRecordsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
