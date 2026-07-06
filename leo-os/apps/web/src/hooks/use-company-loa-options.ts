import { useEffect, useState } from "react";
import { apiFetch, type LoaOption } from "@/lib/api";

export function useCompanyLoaOptions(companyId: number | undefined) {
  const [loaOptions, setLoaOptions] = useState<LoaOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoaOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch<LoaOption[]>(`/loa-options?companyId=${companyId}`)
      .then((data) => {
        if (!cancelled) setLoaOptions(data);
      })
      .catch(() => {
        if (!cancelled) setLoaOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const jobTitleOpts = loaOptions
    .filter((o) => o.category === "job_title")
    .map((o) => o.value);
  const workTypeOpts = loaOptions
    .filter((o) => o.category === "work_type")
    .map((o) => o.value);
  const workSiteOpts = loaOptions
    .filter((o) => o.category === "work_site")
    .map((o) => o.value);

  return { jobTitleOpts, workTypeOpts, workSiteOpts, loading };
}
