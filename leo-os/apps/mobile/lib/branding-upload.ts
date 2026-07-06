import * as ImageManipulator from "expo-image-manipulator";
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
const TOKEN_KEY = "leo_admin_session_token";

export type BrandingImageKind = "letterheadImage" | "signatureImage" | "invoiceLogoImage";

const FIELD_MAP: Record<BrandingImageKind, string> = {
  letterheadImage: "letterhead",
  signatureImage: "signature",
  invoiceLogoImage: "invoiceLogo",
};

const LABEL_MAP: Record<BrandingImageKind, string> = {
  letterheadImage: "Letterhead",
  signatureImage: "Signature",
  invoiceLogoImage: "Invoice logo",
};

export function brandingLabel(kind: BrandingImageKind): string {
  return LABEL_MAP[kind];
}

function isPngAsset(mimeType?: string, uri?: string): boolean {
  return mimeType === "image/png" || (uri?.toLowerCase().includes(".png") ?? false);
}

export async function uploadCompanyBrandingImage(
  companyId: number,
  kind: BrandingImageKind,
  assetUri: string,
  mimeType?: string,
): Promise<void> {
  const png = isPngAsset(mimeType, assetUri);
  const compressed = await ImageManipulator.manipulateAsync(
    assetUri,
    [{ resize: { width: 1200 } }],
    {
      compress: png ? 1 : 0.75,
      format: png ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
    },
  );

  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  const fd = new FormData();
  fd.append(FIELD_MAP[kind], {
    uri: compressed.uri,
    name: png ? "image.png" : "image.jpg",
    type: png ? "image/png" : "image/jpeg",
  } as unknown as Blob);

  const res = await fetch(`${BASE_URL}/api/companies/${companyId}/branding`, {
    method: "POST",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Upload failed");
    throw new Error(text);
  }
}

export const BRANDING_SLOTS = [
  {
    kind: "letterheadImage" as const,
    label: "Letterhead",
    hint: "Transparent PNG · top of LOA prints",
  },
  {
    kind: "signatureImage" as const,
    label: "Signature",
    hint: "Transparent PNG · above signatory name on LOA",
  },
  {
    kind: "invoiceLogoImage" as const,
    label: "Invoice logo",
    hint: "Transparent PNG · top-right of invoices & quotes",
  },
];
