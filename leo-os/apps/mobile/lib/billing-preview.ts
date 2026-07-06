import { getApiBaseUrl, getWebAppUrl } from "@/lib/config";

export async function fetchBillingPreviewHtml(
  documentId: number,
  options?: { print?: boolean },
): Promise<string> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("API URL is not configured");

  const qs = options?.print ? "?print=1" : "";
  const res = await fetch(`${base}/api/billing/public/${documentId}/preview${qs}`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text.trim() || `Preview failed (${res.status})`);
  }

  return res.text();
}

export function getBillingPrintPageUrl(documentId: number, options?: { print?: boolean }): string | null {
  const web = getWebAppUrl();
  if (!web) return null;
  const suffix = options?.print ? "?print=1" : "";
  return `${web}/billing/${documentId}/print${suffix}`;
}

export function billingPreviewUrl(documentId: number, options?: { print?: boolean }): string {
  const base = getApiBaseUrl();
  const qs = options?.print ? "?print=1" : "";
  return `${base}/api/billing/public/${documentId}/preview${qs}`;
}
