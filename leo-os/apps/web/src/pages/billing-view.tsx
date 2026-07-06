import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BillingDocumentPrintLoading, BillingDocumentPrintView } from "@/components/billing-document-print";
import { apiFetch, type BillingDocument, ApiError } from "@/lib/api";
import { parseBillingViewId } from "@/lib/billing";
import { useHasRole } from "@/lib/auth";

export function BillingViewPage() {
  const [location] = useLocation();
  const id = parseBillingViewId(location);
  const isAdmin = useHasRole("admin", "superuser");
  const [doc, setDoc] = useState<BillingDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Invalid document");
      return;
    }

    let cancelled = false;
    setDoc(null);
    setError("");
    apiFetch<BillingDocument>(`/billing/documents/${id}`)
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load document");
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!doc) return <BillingDocumentPrintLoading />;

  return (
    <BillingDocumentPrintView
      doc={doc}
      backHref="/billing"
      publicView={false}
      showEdit={isAdmin}
    />
  );
}
