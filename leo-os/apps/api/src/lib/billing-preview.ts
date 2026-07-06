export type BillingPreviewItem = {
  description: string;
  detail?: string | null;
  qty: string;
  rate: string;
  amount: string;
};

export type BillingPreviewData = {
  kind: "invoice" | "quotation";
  number: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  customerName: string;
  customerAddress?: string | null;
  customerTin?: string | null;
  notes?: string | null;
  gstRate: string;
  gstInclusive: boolean;
  company: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    registrationNumber?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountHolder?: string | null;
    bankSwiftCode?: string | null;
  };
  /** Company invoice logo (transparent PNG), shown at top of document */
  invoiceLogoImage?: string | null;
  items: BillingPreviewItem[];
};

function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? m} ${Number(d)}, ${y}`;
}

export function renderBillingPreviewHtml(data: BillingPreviewData, options?: { autoPrint?: boolean }): string {
  const subtotal = data.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gstRate = Number(data.gstRate || 0);
  const gstAmount = data.gstInclusive ? 0 : subtotal * (gstRate / 100);
  const total = subtotal + gstAmount;
  const title = data.kind === "invoice" ? "Invoice" : "Quotation";
  const c = data.company;

  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td>${esc(item.description)}${item.detail ? `<div class="muted">${esc(item.detail)}</div>` : ""}</td>
        <td class="num">${esc(item.qty)}</td>
        <td class="num">${fmtMoney(Number(item.rate))}</td>
        <td class="num">${fmtMoney(Number(item.amount))}</td>
      </tr>`,
    )
    .join("");

  const autoPrintScript = options?.autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},300)});</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(data.number)} — ${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
    .doc-title h2 { margin: 0 0 8px; font-size: 28px; color: #0f172a; letter-spacing: -0.03em; }
    .doc-title p { margin: 2px 0; font-size: 13px; color: #475569; }
    .issuer { text-align: right; max-width: 320px; margin-left: auto; }
    .issuer-logo { display: flex; justify-content: flex-end; margin-bottom: 10px; }
    .issuer-logo img { max-height: 80px; max-width: 240px; width: auto; object-fit: contain; background: transparent; }
    .issuer h1 { margin: 0 0 6px; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
    .issuer p { margin: 2px 0; color: #64748b; font-size: 12px; line-height: 1.5; }
    .badge { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
    .panel h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .panel p { margin: 2px 0; font-size: 14px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; background: #f8fafc; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .muted { color: #64748b; font-size: 12px; margin-top: 4px; }
    .totals { margin-left: auto; width: min(320px, 100%); }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .totals-row.total { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 10px; font-size: 18px; font-weight: 700; }
    .notes { margin-top: 20px; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; font-size: 13px; line-height: 1.5; color: #92400e; }
    .bank { margin-top: 16px; font-size: 12px; color: #475569; line-height: 1.5; }
    .toolbar { max-width: 820px; margin: 0 auto 16px; display: flex; gap: 8px; }
    .toolbar button { border: 1px solid #cbd5e1; background: #fff; border-radius: 10px; padding: 10px 14px; font-size: 14px; cursor: pointer; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { border: none; border-radius: 0; padding: 0; max-width: none; }
      .toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <div class="page">
    <div class="head">
      <div class="doc-title">
        <h2>${title === "Invoice" ? "TAX INVOICE" : "QUOTATION"}</h2>
        <p><strong>${esc(data.number)}</strong></p>
        <p>Issue: ${fmtDate(data.issueDate)}</p>
        ${data.dueDate ? `<p>Due: ${fmtDate(data.dueDate)}</p>` : ""}
        <span class="badge">${esc(data.status.replace(/_/g, " "))}</span>
      </div>
      <div class="issuer">
        ${
          data.invoiceLogoImage
            ? `<div class="issuer-logo"><img src="${data.invoiceLogoImage.replace(/"/g, "&quot;")}" alt="${esc(c.name)}" /></div>`
            : ""
        }
        <h1>${esc(c.name)}</h1>
        ${c.registrationNumber ? `<p>Reg: ${esc(c.registrationNumber)}</p>` : ""}
        ${c.email ? `<p>${esc(c.email)}</p>` : ""}
        ${c.phone ? `<p>${esc(c.phone)}</p>` : ""}
        ${c.address ? `<p>${esc(c.address).replace(/\n/g, "<br/>")}</p>` : ""}
      </div>
    </div>
    <div class="parties">
      <div class="panel">
        <h3>Bill to</h3>
        <p><strong>${esc(data.customerName)}</strong></p>
        ${data.customerAddress ? `<p>${esc(data.customerAddress).replace(/\n/g, "<br/>")}</p>` : ""}
        ${data.customerTin ? `<p>TIN: ${esc(data.customerTin)}</p>` : ""}
      </div>
      <div class="panel">
        <h3>Document</h3>
        <p>Type: ${title}</p>
        <p>Currency: MVR</p>
        ${gstRate > 0 ? `<p>GST: ${gstRate}%${data.gstInclusive ? " (inclusive)" : ""}</p>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="4">No line items</td></tr>`}
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>MVR ${fmtMoney(subtotal)}</span></div>
      ${gstAmount > 0 ? `<div class="totals-row"><span>GST (${gstRate}%)</span><span>MVR ${fmtMoney(gstAmount)}</span></div>` : ""}
      <div class="totals-row total"><span>Total</span><span>MVR ${fmtMoney(total)}</span></div>
    </div>
    ${data.notes ? `<div class="notes"><strong>Notes</strong><br/>${esc(data.notes).replace(/\n/g, "<br/>")}</div>` : ""}
    ${
      c.bankName || c.bankAccountNumber
        ? `<div class="bank"><strong>Bank details</strong><br/>
        ${c.bankName ? `${esc(c.bankName)}<br/>` : ""}
        ${c.bankAccountHolder ? `${esc(c.bankAccountHolder)}<br/>` : ""}
        ${c.bankAccountNumber ? `Account: ${esc(c.bankAccountNumber)}<br/>` : ""}
        ${c.bankSwiftCode ? `SWIFT: ${esc(c.bankSwiftCode)}` : ""}
      </div>`
        : ""
    }
  </div>
  ${autoPrintScript}
</body>
</html>`;
}
