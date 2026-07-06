import { ArrowLeft, Copy, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import type { BillingDocument } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  billingEditPath,
  billingPrintPath,
  computeBillingTotals,
  fmtBillingMoney,
  formatBillingStatus,
  lineItemAmount,
} from "@/lib/billing";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? m} ${Number(d).toString().padStart(2, "0")}, ${y}`;
}

type Props = {
  doc: BillingDocument;
  backHref?: string;
  autoPrint?: boolean;
  publicView?: boolean;
  showEdit?: boolean;
};

export function BillingDocumentPrintView({
  doc,
  backHref,
  autoPrint = false,
  publicView = false,
  showEdit = !publicView,
}: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const isInvoice = doc.kind === "invoice";
  const title = isInvoice ? "TAX INVOICE" : "QUOTATION";
  const docLabel = isInvoice ? "Invoice#" : "Quote#";
  const resolvedBack = backHref ?? (publicView ? "/billing" : "/billing");
  const invoiceLogo = doc.invoiceLogoImage ?? null;
  const headerAddress = doc.companyAddress ?? doc.systemAddress;
  const headerPhone = doc.companyPhone ?? doc.systemPhone;
  const headerEmail = doc.companyEmail ?? doc.systemEmail;

  const items = doc.items ?? [];
  const totals = useMemo(
    () =>
      computeBillingTotals({
        items: items.map((item) => ({
          description: item.description,
          detail: item.detail ?? "",
          qty: item.qty,
          rate: item.rate,
        })),
        gstRate: doc.gstRate ?? "0",
        gstInclusive: doc.gstInclusive ?? true,
      }),
    [items, doc.gstRate, doc.gstInclusive],
  );

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, doc.id]);

  async function copyShareLink() {
    const url = `${window.location.origin}${billingPrintPath(doc.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Public link copied" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f5] print:bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          {!publicView ? (
            <Button variant="outline" asChild>
              <Link href={resolvedBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {!publicView ? (
              <Button type="button" variant="outline" onClick={copyShareLink}>
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Share link"}
              </Button>
            ) : null}
            {showEdit ? (
              <Button variant="outline" asChild>
                <Link href={billingEditPath(doc.id)}>Edit</Link>
              </Button>
            ) : null}
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        <div className="rounded-sm bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-8 border-b border-slate-200 pb-8">
            <div className="min-w-[240px] space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
                {!publicView && doc.status ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {formatBillingStatus(doc.status)}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">
                {docLabel} <span className="font-semibold text-slate-900">{doc.number}</span>
              </p>
              <div>
                <p className="text-sm font-medium text-slate-700">Balance Due</p>
                <p className="text-3xl font-bold text-slate-900">MVR {fmtBillingMoney(totals.total)}</p>
              </div>
            </div>

            <div className="max-w-sm text-right">
              {invoiceLogo ? (
                <BrandImage
                  src={invoiceLogo}
                  alt={doc.companyName ?? "Company logo"}
                  className="ml-auto mb-3 max-h-20 w-auto object-contain"
                />
              ) : null}
              <p className="text-sm font-semibold text-slate-900">
                {doc.companyName ?? "LEO EMPLOYMENT SERVICES PVT LTD"}
              </p>
              {doc.companyRegistrationNumber ? (
                <p className="text-xs text-slate-600">{doc.companyRegistrationNumber}</p>
              ) : null}
              {headerEmail ? <p className="text-xs text-slate-600">{headerEmail}</p> : null}
              {headerPhone ? <p className="text-xs text-slate-600">{headerPhone}</p> : null}
              {headerAddress ? (
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{headerAddress}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-8 border-b border-slate-200 py-8 md:grid-cols-2">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-slate-500">{isInvoice ? "Invoice Date" : "Quote Date"}</p>
                <p className="font-medium text-slate-900">{fmtDate(doc.issueDate)}</p>
              </div>
              {isInvoice && doc.terms ? (
                <div>
                  <p className="text-slate-500">Terms</p>
                  <p className="font-medium text-slate-900">{doc.terms}</p>
                </div>
              ) : null}
              {isInvoice && doc.dueDate ? (
                <div>
                  <p className="text-slate-500">Due Date</p>
                  <p className="font-medium text-slate-900">{fmtDate(doc.dueDate)}</p>
                </div>
              ) : null}
            </div>

            <div className="text-sm">
              <p className="mb-2 font-semibold text-blue-700">Bill To</p>
              <p className="font-medium text-slate-900">{doc.customerName}</p>
              {doc.customerAddress ? (
                <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{doc.customerAddress}</p>
              ) : null}
              {doc.customerTin ? <p className="mt-1 text-slate-700">TIN: {doc.customerTin}</p> : null}
            </div>
          </div>

          <div className="overflow-x-auto py-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#2f3f5a] text-white">
                  <th className="px-3 py-3 text-left font-semibold">#</th>
                  <th className="px-3 py-3 text-left font-semibold">Item &amp; Description</th>
                  <th className="px-3 py-3 text-right font-semibold">Qty</th>
                  <th className="px-3 py-3 text-right font-semibold">Rate</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id ?? index} className="border-b border-slate-200">
                    <td className="px-3 py-4 align-top text-slate-700">{index + 1}</td>
                    <td className="px-3 py-4 align-top">
                      <p className="font-medium text-slate-900">{item.description}</p>
                      {item.detail ? <p className="mt-1 text-slate-600">{item.detail}</p> : null}
                    </td>
                    <td className="px-3 py-4 text-right align-top text-slate-700">
                      {Number(item.qty).toFixed(2)}
                    </td>
                    <td className="px-3 py-4 text-right align-top text-slate-700">
                      {fmtBillingMoney(Number(item.rate))}
                    </td>
                    <td className="px-3 py-4 text-right align-top font-medium text-slate-900">
                      {fmtBillingMoney(lineItemAmount({
                        description: item.description,
                        detail: item.detail ?? "",
                        qty: item.qty,
                        rate: item.rate,
                      }))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-slate-600">Items in Total {totals.qtyTotal.toFixed(2)}</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div>
              {doc.notes ? (
                <div className="text-sm leading-relaxed text-slate-700">
                  <p className="mb-2 font-semibold text-slate-900">Notes</p>
                  <p className="whitespace-pre-line">{doc.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="md:ml-auto md:w-full md:max-w-sm">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">
                    Sub Total ({doc.gstInclusive ? "Tax Inclusive" : "Tax Exclusive"})
                  </span>
                  <span className="font-medium text-slate-900">{fmtBillingMoney(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Total Taxable Amount</span>
                  <span className="font-medium text-slate-900">{fmtBillingMoney(totals.taxableAmount)}</span>
                </div>
                {totals.gstAmount > 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">GST ({totals.gstRate}%)</span>
                    <span className="font-medium text-slate-900">{fmtBillingMoney(totals.gstAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
                  <span>Total</span>
                  <span>MVR {fmtBillingMoney(totals.total)}</span>
                </div>
              </div>

              <div className="mt-4 rounded-sm bg-[#e8f1fb] px-4 py-3">
                <div className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-900">
                  <span>Balance Due</span>
                  <span>MVR {fmtBillingMoney(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {(doc.companyBankName || doc.companyBankAccountNumber) && (
            <div className="mt-8 border-t border-slate-200 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">Payment Details</p>
              <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                {doc.companyBankName ? (
                  <p>
                    <span className="text-slate-500">Bank: </span>
                    {doc.companyBankName}
                  </p>
                ) : null}
                {doc.companyBankAccountHolder ? (
                  <p>
                    <span className="text-slate-500">Account Name: </span>
                    {doc.companyBankAccountHolder}
                  </p>
                ) : null}
                {doc.companyBankAccountNumber ? (
                  <p>
                    <span className="text-slate-500">Account No.: </span>
                    {doc.companyBankAccountNumber}
                  </p>
                ) : null}
                {doc.companyBankSwiftCode ? (
                  <p>
                    <span className="text-slate-500">SWIFT: </span>
                    {doc.companyBankSwiftCode}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {!isInvoice && doc.signatoryName ? (
            <div className="mt-10">
              {doc.signatureImage ? (
                <BrandImage src={doc.signatureImage} alt="Signature" className="mb-1 max-h-16" />
              ) : null}
              <p className="text-sm font-semibold text-slate-900">{doc.signatoryName}</p>
              {doc.signatoryDesignation ? (
                <p className="text-xs text-slate-600">{doc.signatoryDesignation}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BillingDocumentPrintLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5]">
      <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
    </div>
  );
}
