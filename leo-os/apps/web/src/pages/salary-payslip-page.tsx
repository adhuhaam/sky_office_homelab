import { useMemo } from "react";
import { useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { SalaryPayslipDocument } from "@/components/salary-payslip-view";
import { useSalaryRecordsWithMasterRates } from "@/hooks/use-salary-master-rates";

function parseQuery(): { month: number; year: number } {
  const params = new URLSearchParams(window.location.search);
  const now = new Date();
  const month = Number(params.get("month")) || now.getMonth() + 1;
  const year = Number(params.get("year")) || now.getFullYear();
  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

export function SalaryPayslipPage() {
  const [, params] = useRoute("/salary/:id/payslip");
  const id = params?.id ? Number(params.id) : 0;
  const { month, year } = parseQuery();

  const { records, isLoading, isError } = useSalaryRecordsWithMasterRates(month, year);

  const record = useMemo(() => records.find((r) => r.id === id) ?? null, [records, id]);

  if (!id || Number.isNaN(id)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center text-sm text-red-600">
        Invalid salary record.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 py-6">
        <div className="max-w-[820px] mx-auto px-4 space-y-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[540px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center text-sm text-red-600">
        Failed to load salary record.
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-600">
        Salary record not found for this month.
      </div>
    );
  }

  return (
    <SalaryPayslipDocument
      record={record}
      backHref="/salary"
      invoiceHref={record.invoiceId ? `/billing/${record.invoiceId}` : null}
    />
  );
}
