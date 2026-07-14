import { useMemo } from "react";
import {
  useListCompanies,
  useListPassports,
  useListSalaryRecords,
  getListCompaniesQueryKey,
  getListPassportsQueryKey,
  getListSalaryRecordsQueryKey,
  type Company,
  type Passport,
  type SalaryRecord,
} from "@leo/api-client-react";

export type SalaryCompanyBranding = {
  companyId: number | null;
  companyName: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  letterheadImage: string | null;
  signatureImage: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
};

export type SalaryRecordEnriched = SalaryRecord & {
  agencySalary?: string | null;
} & SalaryCompanyBranding;

function brandingFromCompany(company: Company | undefined): SalaryCompanyBranding {
  if (!company) {
    return {
      companyId: null,
      companyName: null,
      companyAddress: null,
      companyEmail: null,
      companyPhone: null,
      letterheadImage: null,
      signatureImage: null,
      signatoryName: null,
      signatoryDesignation: null,
    };
  }
  return {
    companyId: company.id,
    companyName: company.name ?? null,
    companyAddress: company.address ?? null,
    companyEmail: company.email ?? null,
    companyPhone: company.phone ?? null,
    letterheadImage: company.letterheadImage ?? null,
    signatureImage: company.signatureImage ?? null,
    signatoryName: company.signatoryName ?? null,
    signatoryDesignation: company.signatoryDesignation ?? null,
  };
}

function brandingFromRecord(record: SalaryRecord, company?: Company): SalaryCompanyBranding {
  const fromCompany = brandingFromCompany(company);
  return {
    companyId: record.companyId ?? fromCompany.companyId,
    companyName: record.companyName ?? fromCompany.companyName,
    companyAddress: record.companyAddress ?? fromCompany.companyAddress,
    companyEmail: record.companyEmail ?? fromCompany.companyEmail,
    companyPhone: record.companyPhone ?? fromCompany.companyPhone,
    letterheadImage: fromCompany.letterheadImage,
    signatureImage: fromCompany.signatureImage,
    signatoryName: record.companySignatoryName ?? fromCompany.signatoryName,
    signatoryDesignation: record.companySignatoryDesignation ?? fromCompany.signatoryDesignation,
  };
}

/** Attach master-list agencySalary and employer company branding to salary records. */
export function enrichSalaryRecords(
  records: SalaryRecord[],
  passports: Passport[],
  companies: Company[],
): SalaryRecordEnriched[] {
  const agencyByPassportId = new Map(passports.map((p) => [p.id, p.agencySalary ?? null]));
  const companyIdByPassportId = new Map(passports.map((p) => [p.id, p.companyId ?? null]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  return records.map((record) => {
    const fromApi = record.agencySalary ?? null;
    const fromPassport =
      record.passportId != null ? agencyByPassportId.get(record.passportId) ?? null : null;
    const agencySalary =
      fromApi && Number(fromApi) > 0
        ? fromApi
        : fromPassport && Number(fromPassport) > 0
          ? fromPassport
          : fromApi ?? fromPassport;

    const passportCompanyId =
      record.passportId != null ? companyIdByPassportId.get(record.passportId) ?? null : null;
    const resolvedCompanyId = record.companyId ?? passportCompanyId;
    const company =
      resolvedCompanyId != null ? companyById.get(resolvedCompanyId) : undefined;

    return {
      ...record,
      agencySalary,
      ...brandingFromRecord(record, company),
    };
  });
}

export function groupSalaryRecordsByCompany(
  records: SalaryRecordEnriched[],
): Array<{ branding: SalaryCompanyBranding; records: SalaryRecordEnriched[] }> {
  const groups = new Map<string, { branding: SalaryCompanyBranding; records: SalaryRecordEnriched[] }>();

  for (const record of records) {
    const key = record.companyId != null ? String(record.companyId) : "unassigned";
    const existing = groups.get(key);
    if (existing) {
      existing.records.push(record);
      continue;
    }
    groups.set(key, {
      branding: {
        companyId: record.companyId,
        companyName: record.companyName,
        companyAddress: record.companyAddress,
        companyEmail: record.companyEmail,
        companyPhone: record.companyPhone,
        letterheadImage: record.letterheadImage,
        signatureImage: record.signatureImage,
        signatoryName: record.signatoryName,
        signatoryDesignation: record.signatoryDesignation,
      },
      records: [record],
    });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    records: [...group.records].sort((a, b) =>
      (a.employeeName ?? "").localeCompare(b.employeeName ?? "", undefined, { sensitivity: "base" }),
    ),
  }));
}

export function useSalaryRecordsWithMasterRates(month: number, year: number) {
  const queryParams = { month, year };
  const companyParams = { withBranding: true as const };

  const salaryQuery = useListSalaryRecords(queryParams, {
    query: { queryKey: getListSalaryRecordsQueryKey(queryParams) },
  });

  const passportQuery = useListPassports(undefined, {
    query: { queryKey: getListPassportsQueryKey() },
  });

  const companyQuery = useListCompanies(companyParams, {
    query: { queryKey: getListCompaniesQueryKey(companyParams) },
  });

  const records = useMemo(
    () =>
      enrichSalaryRecords(
        (salaryQuery.data ?? []) as SalaryRecord[],
        (passportQuery.data ?? []) as Passport[],
        (companyQuery.data ?? []) as Company[],
      ),
    [salaryQuery.data, passportQuery.data, companyQuery.data],
  );

  return {
    records,
    isLoading: salaryQuery.isLoading || passportQuery.isLoading || companyQuery.isLoading,
    isError: salaryQuery.isError || passportQuery.isError || companyQuery.isError,
  };
}

/** @deprecated Use SalaryRecordEnriched */
export type SalaryRecordWithMasterRate = SalaryRecordEnriched;
