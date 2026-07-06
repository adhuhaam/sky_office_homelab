import { getApiBaseUrl } from "@/lib/config";

export type XpatPhotoParams = {
  photoId: string;
  serviceId: string;
};

/** Parse photoId + serviceId from the Xpat JSON `photoUrl` field — never pass the raw URL to the API. */
export function parseXpatPhotoParams(photoUrl: string | null | undefined): XpatPhotoParams | null {
  if (!photoUrl?.trim()) return null;

  try {
    const url = photoUrl.includes("://")
      ? new URL(photoUrl)
      : new URL(photoUrl, "https://mobile-xpat.egov.mv");
    const photoId = url.searchParams.get("photoId")?.trim();
    const serviceId = url.searchParams.get("serviceId")?.trim();
    if (!photoId || !serviceId) return null;
    return { photoId, serviceId };
  } catch {
    return null;
  }
}

export function buildXpatPhotoUrl(photoId: string, serviceId: string): string {
  const q = new URLSearchParams({ photoId, serviceId });
  return `/api/xpat/photo?${q.toString()}`;
}

export function buildXpatCardUrl(workPermitNumber: string, passportNumber: string): string {
  const q = new URLSearchParams({ workPermitNumber, passportNumber });
  return `/api/xpat/card?${q.toString()}`;
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}
