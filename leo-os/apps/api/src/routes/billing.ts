import { Router, type IRouter } from "express";
import { eq, desc, and, sql, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  billingDocumentsTable,
  billingItemsTable,
  companiesTable,
  clientsTable,
  salaryRecordsTable,
  passportsTable,
  appSettingsTable,
} from "@leo/db";
import { requireAuth, requireRole } from "../middleware/require-auth.js";
import { normalizeMoney, normalizeDate, computeLineAmount } from "../lib/money.js";
import { renderBillingPreviewHtml } from "../lib/billing-preview.js";
import type { Request } from "express";

const router: IRouter = Router();
export const billingPublicRouter: IRouter = Router();

const ISSUER_NAME = "LEO EMPLOYMENT SERVICES PVT LTD";

const ItemBody = z.object({
  description: z.string().min(1),
  detail: z.string().nullable().optional(),
  qty: z.string().optional(),
  rate: z.string().optional(),
});

const DocumentBody = z.object({
  kind: z.enum(["invoice", "quotation"]),
  companyId: z.number().int().optional(),
  clientId: z.number().int().nullable().optional(),
  customerName: z.string().min(1),
  customerAddress: z.string().nullable().optional(),
  customerTin: z.string().nullable().optional(),
  issueDate: z.string(),
  dueDate: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  gstRate: z.string().optional(),
  gstInclusive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
  items: z.array(ItemBody).min(1),
  linkedSalaryIds: z.array(z.number().int()).optional(),
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DocAccess = { companyId: number; clientId: number | null };

function canAccessDocument(req: Request, doc: DocAccess): boolean {
  const role = req.session?.role ?? "";
  if (role === "superuser" || role === "admin") return true;
  const eid = Number(req.session?.linkedEntityId);
  if (!eid || Number.isNaN(eid)) return false;
  if (role === "company") return doc.companyId === eid;
  if (role === "client") return doc.clientId === eid;
  return false;
}

async function replaceDocumentItems(tx: Tx, documentId: number, items: z.infer<typeof ItemBody>[]) {
  await tx.delete(billingItemsTable).where(eq(billingItemsTable.documentId, documentId));
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const qty = normalizeMoney(item.qty ?? "1", 4, 10) ?? "1.0000";
    const rate = normalizeMoney(item.rate ?? "0", 4, 10) ?? "0.0000";
    const amount = computeLineAmount(qty, rate);
    const [row] = await tx
      .insert(billingItemsTable)
      .values({
        documentId,
        position: i,
        description: item.description.trim(),
        detail: item.detail ?? null,
        qty,
        rate,
        amount,
      })
      .returning();
    rows.push(row);
  }
  return rows;
}

function pad(n: number): string {
  return String(n).padStart(6, "0");
}

async function getOrCreateIssuerId(tx: Tx): Promise<number> {
  const existing = await tx
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(sql`LOWER(${companiesTable.name}) = LOWER(${ISSUER_NAME})`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [inserted] = await tx
    .insert(companiesTable)
    .values({ name: ISSUER_NAME, registrationNumber: "C20542025" })
    .returning({ id: companiesTable.id });
  return inserted!.id;
}

async function allocateNumber(kind: "invoice" | "quotation", tx: Tx): Promise<string> {
  const prefix = kind === "invoice" ? "INV-" : "QT-";
  const rows = await tx
    .select({ number: billingDocumentsTable.number })
    .from(billingDocumentsTable)
    .where(eq(billingDocumentsTable.kind, kind));
  let max = 0;
  for (const r of rows) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(r.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${pad(max + 1)}`;
}

function docGrandTotal(subtotal: number, gstRate: number, gstInclusive: boolean): number {
  return gstInclusive ? subtotal : subtotal + (subtotal * gstRate) / 100;
}

async function fetchSalaryCostMap(docIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (docIds.length === 0) return map;
  const salaryRows = await db
    .select({
      invoiceId: salaryRecordsTable.invoiceId,
      employeeCost: sql<string>`COALESCE(SUM(
        COALESCE(${salaryRecordsTable.basicSalary}::numeric, 0)
          * COALESCE(${salaryRecordsTable.daysWorked}, 0)::numeric
        + COALESCE(${salaryRecordsTable.foodAllowance}::numeric, 0)
        + COALESCE(${salaryRecordsTable.transportAllowance}::numeric, 0)
        + COALESCE(${salaryRecordsTable.otherAllowances}::numeric, 0)
        + COALESCE(${salaryRecordsTable.otherExpenses}::numeric, 0)
        - COALESCE(${salaryRecordsTable.deductions}::numeric, 0)
      ), 0)::text`,
    })
    .from(salaryRecordsTable)
    .where(inArray(salaryRecordsTable.invoiceId, docIds))
    .groupBy(salaryRecordsTable.invoiceId);
  for (const row of salaryRows) {
    if (row.invoiceId != null) map.set(row.invoiceId, row.employeeCost);
  }
  return map;
}

function enrichDocFinancials<T extends {
  id: number;
  gstRate: string | null;
  gstInclusive: boolean | null;
  subtotal: string;
}>(
  doc: T,
  employeeCost: string,
): T & { employeeCost: string; profit: string } {
  const subtotal = Number(doc.subtotal || 0);
  const gstRate = Number(doc.gstRate || 0);
  const grand = docGrandTotal(subtotal, gstRate, doc.gstInclusive ?? true);
  const cost = Number(employeeCost || 0);
  return {
    ...doc,
    employeeCost: cost.toFixed(2),
    profit: (grand - cost).toFixed(2),
  };
}

async function linkSalaryRecords(tx: Tx, invoiceId: number, salaryIds: number[]) {
  if (salaryIds.length === 0) return;
  await tx
    .update(salaryRecordsTable)
    .set({ invoiceId })
    .where(inArray(salaryRecordsTable.id, salaryIds));
}

async function loadBillingDocumentById(id: number) {
  const [doc] = await db
    .select({
      id: billingDocumentsTable.id,
      kind: billingDocumentsTable.kind,
      number: billingDocumentsTable.number,
      companyId: billingDocumentsTable.companyId,
      companyName: companiesTable.name,
      companyAddress: companiesTable.address,
      companyEmail: companiesTable.email,
      companyPhone: companiesTable.phone,
      companyRegistrationNumber: companiesTable.registrationNumber,
      companyBankName: companiesTable.bankName,
      companyBankAccountNumber: companiesTable.bankAccountNumber,
      companyBankAccountHolder: companiesTable.bankAccountHolder,
      companyBankSwiftCode: companiesTable.bankSwiftCode,
      letterheadImage: companiesTable.letterheadImage,
      invoiceLogoImage: companiesTable.invoiceLogoImage,
      signatoryName: companiesTable.signatoryName,
      signatoryDesignation: companiesTable.signatoryDesignation,
      signatureImage: companiesTable.signatureImage,
      clientId: billingDocumentsTable.clientId,
      clientName: clientsTable.name,
      customerName: billingDocumentsTable.customerName,
      customerAddress: billingDocumentsTable.customerAddress,
      customerTin: billingDocumentsTable.customerTin,
      issueDate: billingDocumentsTable.issueDate,
      dueDate: billingDocumentsTable.dueDate,
      terms: billingDocumentsTable.terms,
      gstRate: billingDocumentsTable.gstRate,
      gstInclusive: billingDocumentsTable.gstInclusive,
      notes: billingDocumentsTable.notes,
      status: billingDocumentsTable.status,
      createdAt: billingDocumentsTable.createdAt,
    })
    .from(billingDocumentsTable)
    .innerJoin(companiesTable, eq(billingDocumentsTable.companyId, companiesTable.id))
    .leftJoin(clientsTable, eq(billingDocumentsTable.clientId, clientsTable.id))
    .where(eq(billingDocumentsTable.id, id))
    .limit(1);
  if (!doc) return null;

  const [items, settingsRows] = await Promise.all([
    db
      .select()
      .from(billingItemsTable)
      .where(eq(billingItemsTable.documentId, id))
      .orderBy(billingItemsTable.position),
    db.select().from(appSettingsTable).limit(1),
  ]);
  const settings = settingsRows[0];
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2);
  const salaryMap = await fetchSalaryCostMap([id]);
  return enrichDocFinancials(
    {
      ...doc,
      items,
      subtotal,
      systemLogoImage: settings?.logoImage ?? null,
      systemAddress: settings?.companyAddress ?? null,
      systemPhone: settings?.companyPhone ?? null,
      systemEmail: settings?.companyEmail ?? null,
    },
    salaryMap.get(id) ?? "0",
  );
}

async function loadBillingPrintPayload(id: number) {
  const [docRows, items, settingsRows] = await Promise.all([
    db
      .select({
        id: billingDocumentsTable.id,
        kind: billingDocumentsTable.kind,
        number: billingDocumentsTable.number,
        companyId: billingDocumentsTable.companyId,
        companyName: companiesTable.name,
        companyAddress: companiesTable.address,
        companyEmail: companiesTable.email,
        companyPhone: companiesTable.phone,
        companyRegistrationNumber: companiesTable.registrationNumber,
        companyBankName: companiesTable.bankName,
        companyBankAccountNumber: companiesTable.bankAccountNumber,
        companyBankAccountHolder: companiesTable.bankAccountHolder,
        companyBankSwiftCode: companiesTable.bankSwiftCode,
        letterheadImage: companiesTable.letterheadImage,
        invoiceLogoImage: companiesTable.invoiceLogoImage,
        signatoryName: companiesTable.signatoryName,
        signatoryDesignation: companiesTable.signatoryDesignation,
        signatureImage: companiesTable.signatureImage,
        clientId: billingDocumentsTable.clientId,
        customerName: billingDocumentsTable.customerName,
        customerAddress: billingDocumentsTable.customerAddress,
        customerTin: billingDocumentsTable.customerTin,
        issueDate: billingDocumentsTable.issueDate,
        dueDate: billingDocumentsTable.dueDate,
        terms: billingDocumentsTable.terms,
        gstRate: billingDocumentsTable.gstRate,
        gstInclusive: billingDocumentsTable.gstInclusive,
        notes: billingDocumentsTable.notes,
        status: billingDocumentsTable.status,
        createdAt: billingDocumentsTable.createdAt,
      })
      .from(billingDocumentsTable)
      .innerJoin(companiesTable, eq(billingDocumentsTable.companyId, companiesTable.id))
      .leftJoin(clientsTable, eq(billingDocumentsTable.clientId, clientsTable.id))
      .where(eq(billingDocumentsTable.id, id))
      .limit(1),
    db
      .select()
      .from(billingItemsTable)
      .where(eq(billingItemsTable.documentId, id))
      .orderBy(billingItemsTable.position),
    db.select().from(appSettingsTable).limit(1),
  ]);

  if (!docRows[0]) return null;
  const settings = settingsRows[0];
  const doc = docRows[0];
  return {
    ...doc,
    items,
    systemLogoImage: settings?.logoImage ?? null,
    systemAddress: settings?.companyAddress ?? null,
    systemPhone: settings?.companyPhone ?? null,
    systemEmail: settings?.companyEmail ?? null,
  };
}

function resolveInvoiceLogoImage(doc: {
  invoiceLogoImage?: string | null;
}): string | null {
  return doc.invoiceLogoImage ?? null;
}

function billingDocToPreviewPayload(
  doc: Awaited<ReturnType<typeof loadBillingDocumentById>> & { systemLogoImage?: string | null },
) {
  if (!doc) return null;
  const docKind = doc.kind === "quotation" ? "quotation" as const : "invoice" as const;
  return {
    kind: docKind,
    number: doc.number,
    status: doc.status,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    customerName: doc.customerName,
    customerAddress: doc.customerAddress,
    customerTin: doc.customerTin,
    notes: doc.notes,
    gstRate: doc.gstRate,
    gstInclusive: doc.gstInclusive,
    invoiceLogoImage: resolveInvoiceLogoImage(doc),
    company: {
      name: doc.companyName ?? ISSUER_NAME,
      address: doc.companyAddress,
      email: doc.companyEmail,
      phone: doc.companyPhone,
      registrationNumber: doc.companyRegistrationNumber,
      bankName: doc.companyBankName,
      bankAccountNumber: doc.companyBankAccountNumber,
      bankAccountHolder: doc.companyBankAccountHolder,
      bankSwiftCode: doc.companyBankSwiftCode,
    },
    items: (doc.items ?? []).map((item) => ({
      description: item.description,
      detail: item.detail,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
    })),
  };
}

billingPublicRouter.get("/billing/public/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const doc = await loadBillingPrintPayload(id);
  if (!doc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { employeeCost: _ec, profit: _p, ...safe } = doc as Record<string, unknown>;
  res.json(safe);
});

billingPublicRouter.get("/billing/public/:id/print", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const doc = await loadBillingPrintPayload(id);
  if (!doc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(doc);
});

billingPublicRouter.get("/billing/public/:id/preview", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).send("Invalid document id");
    return;
  }
  const doc = await loadBillingDocumentById(id);
  if (!doc) {
    res.status(404).send("Not found");
    return;
  }
  const settingsRows = await db.select().from(appSettingsTable).limit(1);
  const settings = settingsRows[0];
  const autoPrint = req.query["print"] === "1" || req.query["print"] === "true";
  const payload = billingDocToPreviewPayload({
    ...doc,
    systemLogoImage: settings?.logoImage ?? null,
  });
  if (!payload) {
    res.status(404).send("Not found");
    return;
  }
  const html = renderBillingPreviewHtml(payload, { autoPrint });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

router.get("/billing/documents", requireAuth, async (req, res): Promise<void> => {
  const role = req.session?.role ?? "";
  const kindRaw = req.query["kind"];
  const kind = kindRaw === "invoice" || kindRaw === "quotation" ? kindRaw : undefined;
  const searchRaw = req.query["search"];
  const search =
    typeof searchRaw === "string" && searchRaw.trim() ? searchRaw.trim() : undefined;
  const conds: SQL[] = [];
  if (kind) conds.push(eq(billingDocumentsTable.kind, kind));

  if (role === "superuser" || role === "admin") {
    // unrestricted
  } else if (role === "company") {
    const eid = Number(req.session?.linkedEntityId);
    if (!eid || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    conds.push(eq(billingDocumentsTable.companyId, eid));
  } else if (role === "client") {
    const eid = Number(req.session?.linkedEntityId);
    if (!eid || Number.isNaN(eid)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    conds.push(eq(billingDocumentsTable.clientId, eid));
  } else {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const rows = await db
    .select({
      id: billingDocumentsTable.id,
      kind: billingDocumentsTable.kind,
      number: billingDocumentsTable.number,
      companyId: billingDocumentsTable.companyId,
      companyName: companiesTable.name,
      clientId: billingDocumentsTable.clientId,
      clientName: clientsTable.name,
      customerName: billingDocumentsTable.customerName,
      issueDate: billingDocumentsTable.issueDate,
      dueDate: billingDocumentsTable.dueDate,
      gstRate: billingDocumentsTable.gstRate,
      gstInclusive: billingDocumentsTable.gstInclusive,
      status: billingDocumentsTable.status,
    })
    .from(billingDocumentsTable)
    .innerJoin(companiesTable, eq(billingDocumentsTable.companyId, companiesTable.id))
    .leftJoin(clientsTable, eq(billingDocumentsTable.clientId, clientsTable.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(billingDocumentsTable.createdAt));

  const docIds = rows.map((r) => r.id);
  const totalsMap = new Map<number, string>();
  const salaryMap = new Map<number, string>();

  if (docIds.length > 0) {
    const [totals, salaryRows] = await Promise.all([
      db
        .select({
          documentId: billingItemsTable.documentId,
          total: sql<string>`COALESCE(SUM(${billingItemsTable.amount}), 0)::text`,
        })
        .from(billingItemsTable)
        .where(inArray(billingItemsTable.documentId, docIds))
        .groupBy(billingItemsTable.documentId),
      db
        .select({
          invoiceId: salaryRecordsTable.invoiceId,
          employeeCost: sql<string>`COALESCE(SUM(
            COALESCE(${salaryRecordsTable.basicSalary}::numeric, 0)
              * COALESCE(${salaryRecordsTable.daysWorked}, 0)::numeric
            + COALESCE(${salaryRecordsTable.foodAllowance}::numeric, 0)
            + COALESCE(${salaryRecordsTable.transportAllowance}::numeric, 0)
            + COALESCE(${salaryRecordsTable.otherAllowances}::numeric, 0)
            + COALESCE(${salaryRecordsTable.otherExpenses}::numeric, 0)
            - COALESCE(${salaryRecordsTable.deductions}::numeric, 0)
          ), 0)::text`,
        })
        .from(salaryRecordsTable)
        .where(inArray(salaryRecordsTable.invoiceId, docIds))
        .groupBy(salaryRecordsTable.invoiceId),
    ]);
    for (const t of totals) totalsMap.set(t.documentId, t.total);
    for (const row of salaryRows) {
      if (row.invoiceId != null) salaryMap.set(row.invoiceId, row.employeeCost);
    }
  }

  const result = rows.map((r) =>
    enrichDocFinancials(
      { ...r, subtotal: totalsMap.get(r.id) ?? "0.00" },
      salaryMap.get(r.id) ?? "0",
    ),
  );

  const filtered = search
    ? result.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.number.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          (r.companyName ?? "").toLowerCase().includes(q)
        );
      })
    : result;

  res.json(filtered);
});

router.get("/billing/documents/:id/preview", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const doc = await loadBillingDocumentById(id);
  if (!doc) {
    res.status(404).send("Not found");
    return;
  }
  if (!canAccessDocument(req, doc)) {
    res.status(403).send("Access denied");
    return;
  }
  const settingsRows = await db.select().from(appSettingsTable).limit(1);
  const settings = settingsRows[0];
  const autoPrint = req.query["print"] === "1" || req.query["print"] === "true";
  const payload = billingDocToPreviewPayload({
    ...doc,
    systemLogoImage: settings?.logoImage ?? null,
  });
  if (!payload) {
    res.status(404).send("Not found");
    return;
  }
  const html = renderBillingPreviewHtml(payload, { autoPrint });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

router.get("/billing/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const doc = await loadBillingDocumentById(id);
  if (!doc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessDocument(req, doc)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  res.json(doc);
});

router.post("/billing/documents", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const parsed = DocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const issueDate = normalizeDate(parsed.data.issueDate);
  if (issueDate === "invalid" || !issueDate) {
    res.status(400).json({ error: "Invalid issue date" });
    return;
  }
  const dueDate = normalizeDate(parsed.data.dueDate);
  if (dueDate === "invalid") {
    res.status(400).json({ error: "Invalid due date" });
    return;
  }
  const gstRate = normalizeMoney(parsed.data.gstRate ?? "0", 2, 3) ?? "0.00";

  const linkedSalaryIds = parsed.data.linkedSalaryIds ?? [];

  try {
    const result = await db.transaction(async (tx) => {
      const companyId = parsed.data.companyId ?? (await getOrCreateIssuerId(tx));
      const number = await allocateNumber(parsed.data.kind, tx);
      const [doc] = await tx
        .insert(billingDocumentsTable)
        .values({
          kind: parsed.data.kind,
          number,
          companyId,
          clientId: parsed.data.clientId ?? null,
          customerName: parsed.data.customerName.trim(),
          customerAddress: parsed.data.customerAddress ?? null,
          customerTin: parsed.data.customerTin ?? null,
          issueDate,
          dueDate,
          terms: parsed.data.terms ?? null,
          gstRate,
          gstInclusive: parsed.data.gstInclusive ?? true,
          notes: parsed.data.notes ?? null,
          status: parsed.data.status ?? "draft",
        })
        .returning();

      const items = [];
      for (let i = 0; i < parsed.data.items.length; i++) {
        const item = parsed.data.items[i]!;
        const qty = normalizeMoney(item.qty ?? "1", 4, 10) ?? "1.0000";
        const rate = normalizeMoney(item.rate ?? "0", 4, 10) ?? "0.0000";
        const amount = computeLineAmount(qty, rate);
        const [row] = await tx
          .insert(billingItemsTable)
          .values({
            documentId: doc!.id,
            position: i,
            description: item.description.trim(),
            detail: item.detail ?? null,
            qty,
            rate,
            amount,
          })
          .returning();
        items.push(row);
      }
      await linkSalaryRecords(tx, doc!.id, linkedSalaryIds);
      return { ...doc, items };
    });
    const full = await loadBillingDocumentById(result.id);
    res.status(201).json(full ?? result);
  } catch (err) {
    req.log.error({ err }, "Create billing document failed");
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.patch("/billing/documents/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = DocumentBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items: nextItems, linkedSalaryIds, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { ...rest };
  delete patch["kind"];
  if (parsed.data.issueDate) {
    const d = normalizeDate(parsed.data.issueDate);
    if (d === "invalid" || !d) {
      res.status(400).json({ error: "Invalid issue date" });
      return;
    }
    patch["issueDate"] = d;
  }
  if (parsed.data.dueDate !== undefined) {
    const d = normalizeDate(parsed.data.dueDate);
    if (d === "invalid") {
      res.status(400).json({ error: "Invalid due date" });
      return;
    }
    patch["dueDate"] = d;
  }
  if (parsed.data.gstRate !== undefined) {
    patch["gstRate"] = normalizeMoney(parsed.data.gstRate ?? "0", 2, 3) ?? "0.00";
  }
  if (parsed.data.customerName) {
    patch["customerName"] = parsed.data.customerName.trim();
  }
  try {
    const result = await db.transaction(async (tx) => {
      if (parsed.data.status === "voided") {
        await tx
          .update(salaryRecordsTable)
          .set({ invoiceId: null })
          .where(eq(salaryRecordsTable.invoiceId, id));
      }
      const [row] = await tx
        .update(billingDocumentsTable)
        .set(patch)
        .where(eq(billingDocumentsTable.id, id))
        .returning();
      if (!row) return null;
      const items =
        nextItems && nextItems.length > 0
          ? await replaceDocumentItems(tx, id, nextItems)
          : await tx
              .select()
              .from(billingItemsTable)
              .where(eq(billingItemsTable.documentId, id))
              .orderBy(billingItemsTable.position);
      if (linkedSalaryIds && linkedSalaryIds.length > 0) {
        await linkSalaryRecords(tx, id, linkedSalaryIds);
      }
      return { ...row, items };
    });
    if (!result) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const full = await loadBillingDocumentById(id);
    res.json(full ?? result);
  } catch (err) {
    req.log.error({ err }, "Update billing document failed");
    res.status(500).json({ error: "Failed to update document" });
  }
});

router.delete("/billing/documents/:id", requireRole("superuser", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  await db
    .update(salaryRecordsTable)
    .set({ invoiceId: null })
    .where(eq(salaryRecordsTable.invoiceId, id));
  const deleted = await db
    .delete(billingDocumentsTable)
    .where(eq(billingDocumentsTable.id, id))
    .returning({ id: billingDocumentsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
