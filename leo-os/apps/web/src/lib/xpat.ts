import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface XpatWorkPermit {
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  isoAlpha3CountryCode?: string | null;
  contactNumber?: string | null;
  occupationName?: string | null;
  isValid?: string | null;
  workPermitStateName?: string | null;
  workPermitIssuedDate?: string | null;
  workPermitExpiry?: string | null;
  employerName?: string | null;
  employerNumber?: string | null;
  employerContactNumber?: string | null;
  photoUrl?: string | null;
  verifyUrl?: string | null;
}

export function parseXpatPhotoParams(
  photoUrl: string | null | undefined,
): { photoId: string; serviceId: string } | null {
  if (!photoUrl) return null;
  try {
    const url = new URL(photoUrl);
    const photoId = url.searchParams.get("photoId")?.trim();
    const serviceId = url.searchParams.get("serviceId")?.trim();
    if (!photoId || !serviceId) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(photoId) || !/^[a-zA-Z0-9_-]+$/.test(serviceId)) {
      return null;
    }
    return { photoId, serviceId };
  } catch {
    return null;
  }
}

export function buildXpatPhotoSrc(photoUrl: string | null | undefined): string | null {
  const params = parseXpatPhotoParams(photoUrl);
  if (!params) return null;
  return `/api/xpat/photo?photoId=${encodeURIComponent(params.photoId)}&serviceId=${encodeURIComponent(params.serviceId)}`;
}

export function buildXpatCardSrc(
  workPermitNumber: string | null | undefined,
  passportNumber: string | null | undefined,
): string | null {
  const wp = workPermitNumber?.trim();
  const pp = passportNumber?.trim();
  if (!wp || !pp) return null;
  return `/api/xpat/card?workPermitNumber=${encodeURIComponent(wp)}&passportNumber=${encodeURIComponent(pp)}`;
}

export function formatXpatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function isWpValid(v: string | null | undefined): boolean {
  return v != null && v.toLowerCase() === "valid";
}

export function isWpInvalid(v: string | null | undefined): boolean {
  return v != null && v.toLowerCase() !== "valid";
}

export function useXpatWorkPermit(
  workPermitNumber: string | null | undefined,
  passportNumber: string | null | undefined,
) {
  const [data, setData] = useState<XpatWorkPermit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wp = workPermitNumber?.trim();
    const pp = passportNumber?.trim();
    if (!wp || !pp) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<XpatWorkPermit>(
      `/xpat/work-permit?workPermitNumber=${encodeURIComponent(wp)}&passportNumber=${encodeURIComponent(pp)}`,
    )
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "Xpat lookup failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workPermitNumber, passportNumber]);

  return { data, loading, error };
}
