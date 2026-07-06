const XPAT_BASE = "https://mobile-xpat.egov.mv/api/v1";
const XPAT_API_KEY = "d110e2a8-5adc-4f7b-90a0-701b4fedf476";

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

function xpatHeaders(accept: string): Record<string, string> {
  return { ApiKey: XPAT_API_KEY, Accept: accept };
}

export async function fetchXpatWorkPermit(
  workPermitNumber: string,
  passportNumber: string,
): Promise<XpatWorkPermit | null> {
  const url =
    `${XPAT_BASE}/WorkPermit?WorkPermitNumber=${encodeURIComponent(workPermitNumber)}` +
    `&PassportNumber=${encodeURIComponent(passportNumber)}`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, { headers: xpatHeaders("application/json") });
  } catch {
    return null;
  }

  if (!upstream.ok) return null;

  return (await upstream.json()) as XpatWorkPermit;
}

export async function fetchXpatPhoto(
  photoId: string,
  serviceId: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url =
    `${XPAT_BASE}/WorkPermit/GetImage?photoId=${encodeURIComponent(photoId)}` +
    `&serviceId=${encodeURIComponent(serviceId)}`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      headers: xpatHeaders("image/jpeg,image/*"),
    });
  } catch {
    return null;
  }

  if (!upstream.ok) return null;

  return {
    buffer: Buffer.from(await upstream.arrayBuffer()),
    contentType: upstream.headers.get("content-type") ?? "image/jpeg",
  };
}

export async function fetchXpatCard(
  workPermitNumber: string,
  passportNumber: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url =
    `${XPAT_BASE}/WorkPermitCard/GetWorkPermitCard?WorkPermitNumber=${encodeURIComponent(workPermitNumber)}` +
    `&PassportNumber=${encodeURIComponent(passportNumber)}`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      headers: xpatHeaders("image/png,image/*"),
    });
  } catch {
    return null;
  }

  if (!upstream.ok) return null;

  return {
    buffer: Buffer.from(await upstream.arrayBuffer()),
    contentType: upstream.headers.get("content-type") ?? "image/png",
  };
}
