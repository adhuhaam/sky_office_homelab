import { useEffect, useState } from "react";
import { useParams } from "wouter";

import {
  BillingDocumentPrintLoading,
  BillingDocumentPrintView,
} from "@/components/billing-document-print";
import { apiFetch, type BillingDocument, ApiError } from "@/lib/api";

export function BillingPrintPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const autoPrint = new URLSearchParams(window.location.search).get("print") === "1";
  const [doc, setDoc] = useState<BillingDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setError("Invalid document");
      return;
    }

    let cancelled = false;

    apiFetch<BillingDocument>(`/billing/public/${id}`)
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load document");
        }
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

  return <BillingDocumentPrintView doc={doc} autoPrint={autoPrint} publicView />;
}
