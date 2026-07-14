import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandImage } from "@/components/brand-image";
import {
  groupSalaryRecordsByCompany,
  useSalaryRecordsWithMasterRates,
} from "@/hooks/use-salary-master-rates";
import {
  fmtSalaryMVR,
  salaryMonthLabel,
  computePayslipEmployeeNet,
  resolveEmployeeDailyRate,
} from "@/lib/salary-invoice";
import {
  SalaryLetterhead,
  SalaryPrintToolbar,
  useSalaryPrintStyles,
} from "@/components/salary-payslip-view";

function parseMonthYear(): { month: number; year: number } {
  const params = new URLSearchParams(window.location.search);
  const now = new Date();
  const month = Number(params.get("month")) || now.getMonth() + 1;
  const year = Number(params.get("year")) || now.getFullYear();
  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

export function SalarySheetViewPage() {
  const { month, year } = parseMonthYear();
  const { records, isLoading, isError } = useSalaryRecordsWithMasterRates(month, year);

  const companyGroups = useMemo(() => groupSalaryRecordsByCompany(records), [records]);

  const grandTotal = useMemo(
    () => records.reduce((sum, r) => sum + computePayslipEmployeeNet(r), 0),
    [records],
  );

  useSalaryPrintStyles();

  useEffect(() => {
    const prev = document.title;
    document.title = `Salary Sheet — ${salaryMonthLabel(month, year)}`;
    return () => {
      document.title = prev;
    };
  }, [month, year]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 py-6">
        <div className="max-w-[900px] mx-auto px-4 space-y-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center text-sm text-red-600">
        Failed to load salary records.
      </div>
    );
  }

  const generatedAt = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="salary-print-outer bg-slate-100 min-h-screen py-4 sm:py-6">
      <SalaryPrintToolbar backHref="/salary" />

      <div className="salary-print-shell max-w-[900px] mx-auto space-y-6">
        {records.length === 0 ? (
          <div className="bg-white shadow-lg rounded-lg px-6 py-16 text-center text-sm text-slate-500">
            No salary records for {salaryMonthLabel(month, year)}.
          </div>
        ) : (
          companyGroups.map((group, groupIndex) => {
            const sectionTotal = group.records.reduce(
              (sum, r) => sum + computePayslipEmployeeNet(r),
              0,
            );

            return (
              <div
                key={group.branding.companyId ?? `group-${groupIndex}`}
                className="salary-company-section bg-white shadow-lg rounded-lg overflow-hidden"
              >
                <div className="px-6 py-8 sm:px-10 sm:py-10">
                  <SalaryLetterhead branding={group.branding} />

                  <div className="text-center mb-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Employee Salary Sheet
                    </p>
                    <h1 className="text-xl font-bold text-slate-900 mt-1">
                      {salaryMonthLabel(month, year)}
                    </h1>
                    {group.branding.companyName ? (
                      <p className="text-sm text-slate-600 mt-1">{group.branding.companyName}</p>
                    ) : null}
                    <p className="text-xs text-slate-500 mt-1">Generated {generatedAt}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
                          <th className="py-2 px-2 font-semibold border border-slate-300 w-8">#</th>
                          <th className="py-2 px-2 font-semibold border border-slate-300">Employee name</th>
                          <th className="py-2 px-2 font-semibold border border-slate-300">Passport no.</th>
                          <th className="py-2 px-2 font-semibold border border-slate-300">Designation</th>
                          <th className="py-2 px-2 font-semibold border border-slate-300 text-right">Days</th>
                          <th className="py-2 px-2 font-semibold border border-slate-300 text-right">
                            Daily rate
                          </th>
                          <th className="py-2 px-2 font-semibold border border-slate-300 text-right">
                            Net salary
                          </th>
                          <th className="py-2 px-2 font-semibold border border-slate-300 no-print">
                            Payslip
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((record, index) => (
                          <tr key={record.id} className="salary-sheet-row">
                            <td className="py-2 px-2 border border-slate-200 text-slate-500 tabular-nums">
                              {index + 1}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 font-medium text-slate-900">
                              {record.employeeName ?? "—"}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-slate-700">
                              {record.passportNumber ?? "—"}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-slate-700">
                              {record.jobTitle ?? "—"}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-right tabular-nums">
                              {record.daysWorked ?? "—"}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-right tabular-nums whitespace-nowrap">
                              {fmtSalaryMVR(resolveEmployeeDailyRate(record))}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-right font-semibold tabular-nums whitespace-nowrap">
                              {fmtSalaryMVR(computePayslipEmployeeNet(record))}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 no-print">
                              <Link
                                href={`/salary/${record.id}/payslip?month=${month}&year=${year}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                View
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold bg-slate-50">
                          <td
                            colSpan={6}
                            className="py-2.5 px-2 border border-slate-300 text-right text-slate-900"
                          >
                            Section total ({group.records.length} employee
                            {group.records.length !== 1 ? "s" : ""})
                          </td>
                          <td className="py-2.5 px-2 border border-slate-300 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                            {fmtSalaryMVR(sectionTotal)}
                          </td>
                          <td className="no-print border border-slate-300" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mt-8 border-t border-slate-200 pt-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div>
                        {group.branding.signatureImage ? (
                          <BrandImage
                            src={group.branding.signatureImage}
                            alt="Signatory"
                            className="max-h-10 max-w-[140px] mb-1"
                          />
                        ) : (
                          <div className="h-10 border-b border-slate-400" />
                        )}
                        <p className="text-[10px] text-slate-600 mt-1">
                          {group.branding.signatoryName ?? "Authorized signatory"}
                        </p>
                      </div>
                      <div>
                        <div className="h-10 border-b border-slate-400" />
                        <p className="text-[10px] text-slate-600 mt-1">Date</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {records.length > 1 && companyGroups.length > 1 ? (
          <div className="bg-white shadow-lg rounded-lg px-6 py-4 text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Grand total (all companies)</p>
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{fmtSalaryMVR(grandTotal)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
