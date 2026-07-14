import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import type { SalaryRecordEnriched, SalaryCompanyBranding } from "@/hooks/use-salary-master-rates";
import {
  computePayslipBasicEarnings,
  computePayslipEmployeeNet,
  fmtSalaryMVR,
  MONTHS_LONG,
  resolveEmployeeDailyRate,
  salaryDays,
  salaryMonthLabel,
} from "@/lib/salary-invoice";

export function useSalaryPrintStyles() {
  useEffect(() => {
    const css = `
      @page { size: A4 portrait; margin: 10mm; }
      @media print {
        html, body {
          background: white !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .no-print { display: none !important; }
        .salary-print-outer {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
        }
        .salary-print-shell {
          box-shadow: none !important;
          border: none !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
        .salary-sheet-row { break-inside: avoid; page-break-inside: avoid; }
        .salary-company-section { break-inside: avoid; page-break-inside: avoid; }
        .salary-letterhead img {
          max-height: 72pt !important;
        }
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
}

export function SalaryLetterhead({ branding }: { branding: SalaryCompanyBranding }) {
  const { letterheadImage, companyName, companyAddress, companyPhone, companyEmail } = branding;

  return (
    <div className="salary-letterhead border-b border-slate-300 pb-4 mb-5">
      {letterheadImage ? (
        <div className="flex justify-center mb-3">
          <BrandImage
            src={letterheadImage}
            alt={companyName ?? "Company letterhead"}
            className="max-h-28 w-full max-w-full object-contain"
          />
        </div>
      ) : companyName ? (
        <div className="text-center mb-2">
          <p className="text-lg font-bold uppercase tracking-wide text-slate-900">{companyName}</p>
          {companyAddress ? (
            <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-line">{companyAddress}</p>
          ) : null}
          {(companyPhone || companyEmail) && (
            <p className="text-[11px] text-slate-600 mt-0.5">
              {[companyPhone, companyEmail].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500 italic">Employer company not assigned</p>
      )}
    </div>
  );
}

type PayslipTableRow = {
  key: string;
  description: string;
  qty: string;
  rate: string;
  amount: number;
  deduction?: boolean;
};

function buildPayslipRows(record: SalaryRecordEnriched): {
  earnings: PayslipTableRow[];
  deductions: PayslipTableRow[];
} {
  const days = salaryDays(record.daysWorked);
  const dailyRate = resolveEmployeeDailyRate(record);
  const earnings: PayslipTableRow[] = [];

  if (dailyRate > 0) {
    earnings.push({
      key: "basic",
      description: "Basic Salary",
      qty: days > 0 ? String(days) : "—",
      rate: dailyRate.toFixed(2),
      amount: computePayslipBasicEarnings(record),
    });
  }

  const extras: Array<{ key: string; label: string; val: string | null | undefined }> = [
    { key: "food", label: "Food Allowance", val: record.foodAllowance },
    { key: "transport", label: "Transport Allowance", val: record.transportAllowance },
    { key: "other-allow", label: "Other Allowances", val: record.otherAllowances },
    { key: "other-exp", label: "Other Expenses", val: record.otherExpenses },
  ];

  for (const { key, label, val } of extras) {
    const n = Number(val ?? "0") || 0;
    if (n !== 0) {
      earnings.push({ key, description: label, qty: "—", rate: "—", amount: n });
    }
  }

  const deductions: PayslipTableRow[] = [];
  const ded = Number(record.deductions ?? "0") || 0;
  if (ded > 0) {
    deductions.push({
      key: "deductions",
      description: "Total Deductions",
      qty: "—",
      rate: "—",
      amount: ded,
      deduction: true,
    });
  }

  return { earnings, deductions };
}

function PayslipTable({
  title,
  rows,
  showNegative,
}: {
  title: string;
  rows: PayslipTableRow[];
  showNegative?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-2 border-b border-slate-300 pb-1">
        {title}
      </p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="text-left font-semibold py-1.5 px-2 border border-slate-300">Description</th>
            <th className="text-right font-semibold py-1.5 px-2 border border-slate-300 w-16">Days</th>
            <th className="text-right font-semibold py-1.5 px-2 border border-slate-300 w-24">Rate (MVR)</th>
            <th className="text-right font-semibold py-1.5 px-2 border border-slate-300 w-28">Amount (MVR)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="py-1.5 px-2 border border-slate-200 text-slate-800">{row.description}</td>
              <td className="py-1.5 px-2 border border-slate-200 text-right tabular-nums">{row.qty}</td>
              <td className="py-1.5 px-2 border border-slate-200 text-right tabular-nums">{row.rate}</td>
              <td
                className={`py-1.5 px-2 border border-slate-200 text-right tabular-nums font-medium ${
                  row.deduction ? "text-red-700" : "text-slate-900"
                }`}
              >
                {showNegative && row.deduction ? "− " : ""}
                {row.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-[11px] font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

export function SalaryPayslipBody({ record }: { record: SalaryRecordEnriched }) {
  const days = salaryDays(record.daysWorked);
  const net = computePayslipEmployeeNet(record);
  const { earnings, deductions } = buildPayslipRows(record);
  const payslipNo = `PS-${String(record.id).padStart(5, "0")}`;

  return (
    <div className="salary-payslip-body text-slate-800">
      <div className="text-center border-y border-slate-400 py-2 mb-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-slate-900">Salary Payslip</h2>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-5 text-[11px]">
        <div className="space-y-3">
          <MetaField label="Pay period" value={salaryMonthLabel(record.month, record.year)} />
          <MetaField label="Employee name" value={record.employeeName ?? "—"} />
          <MetaField label="Passport number" value={record.passportNumber ?? "—"} />
          <MetaField label="Designation" value={record.jobTitle ?? "—"} />
        </div>
        <div className="space-y-3 text-right sm:text-right">
          <MetaField label="Payslip no." value={payslipNo} />
          <MetaField label="Days worked" value={days > 0 ? String(days) : "—"} />
          <MetaField
            label="Daily rate (master list)"
            value={fmtSalaryMVR(resolveEmployeeDailyRate(record))}
          />
          <MetaField label="Status" value={record.status ?? "—"} />
        </div>
      </div>

      <PayslipTable title="Earnings" rows={earnings} />
      <PayslipTable title="Deductions" rows={deductions} showNegative />

      <div className="mt-5 mb-6 rounded border-2 border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-widest">Net pay</span>
          <span className="text-xl font-bold tabular-nums">{fmtSalaryMVR(net)}</span>
        </div>
      </div>

      {record.notes ? (
        <div className="mb-6 border border-slate-200 px-3 py-2 text-[11px]">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Remarks</p>
          <p className="text-slate-700 whitespace-pre-wrap">{record.notes}</p>
        </div>
      ) : null}

      <div className="border-t border-slate-300 pt-6 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          <div>
            <div className="h-12 border-b border-slate-500" />
            <p className="text-[10px] text-slate-600 mt-1.5 font-medium">Employee signature</p>
            <p className="text-[9px] text-slate-500">Proof of salary received</p>
            <div className="mt-4 h-6 border-b border-slate-400 w-32" />
            <p className="text-[9px] text-slate-500 mt-1">Date</p>
          </div>
          <div>
            {record.signatureImage ? (
              <BrandImage
                src={record.signatureImage}
                alt="Authorized signature"
                className="max-h-12 max-w-[160px] mb-1"
              />
            ) : (
              <div className="h-12 border-b border-slate-500" />
            )}
            <p className="text-[10px] text-slate-600 mt-1.5 font-medium">
              {record.signatoryName ?? "Authorized signatory"}
            </p>
            {record.signatoryDesignation ? (
              <p className="text-[9px] text-slate-500">{record.signatoryDesignation}</p>
            ) : null}
            <p className="text-[9px] text-slate-500 mt-1">For {record.companyName ?? "employer"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

type ToolbarProps = {
  backHref: string;
  backLabel?: string;
  extra?: React.ReactNode;
};

export function SalaryPrintToolbar({ backHref, backLabel = "Back to Salaries", extra }: ToolbarProps) {
  return (
    <div className="no-print max-w-[820px] mx-auto px-3 sm:px-4 mb-4 flex flex-wrap items-center justify-between gap-2">
      <Link href={backHref}>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Button>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <Button size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>
    </div>
  );
}

export function SalaryPayslipDocument({
  record,
  backHref = "/salary",
  invoiceHref,
}: {
  record: SalaryRecordEnriched;
  backHref?: string;
  invoiceHref?: string | null;
}) {
  useSalaryPrintStyles();

  const branding: SalaryCompanyBranding = {
    companyId: record.companyId,
    companyName: record.companyName,
    companyAddress: record.companyAddress,
    companyEmail: record.companyEmail,
    companyPhone: record.companyPhone,
    letterheadImage: record.letterheadImage,
    signatureImage: record.signatureImage,
    signatoryName: record.signatoryName,
    signatoryDesignation: record.signatoryDesignation,
  };

  useEffect(() => {
    const prev = document.title;
    document.title = `Payslip — ${record.employeeName ?? "Employee"} — ${MONTHS_LONG[(record.month - 1) % 12]} ${record.year}`;
    return () => {
      document.title = prev;
    };
  }, [record]);

  return (
    <div className="salary-print-outer bg-slate-100 min-h-screen py-4 sm:py-6">
      <SalaryPrintToolbar
        backHref={backHref}
        extra={
          invoiceHref ? (
            <Link href={invoiceHref}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                View invoice
              </Button>
            </Link>
          ) : null
        }
      />
      <div className="salary-print-shell max-w-[820px] mx-auto bg-white shadow-lg overflow-hidden">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <SalaryLetterhead branding={branding} />
          <SalaryPayslipBody record={record} />
        </div>
      </div>
    </div>
  );
}
