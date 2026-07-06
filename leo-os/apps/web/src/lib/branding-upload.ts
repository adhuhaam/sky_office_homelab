const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

export type BrandingImageKind = "letterheadImage" | "signatureImage" | "invoiceLogoImage";

const FIELD_MAP: Record<BrandingImageKind, string> = {
  letterheadImage: "letterhead",
  signatureImage: "signature",
  invoiceLogoImage: "invoiceLogo",
};

function isPngFile(file: File): boolean {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: "image/png" | "image/jpeg",
): Promise<Blob> {
  if (mime === "image/jpeg") {
    return new Promise((resolve, reject) => {
      const step = (q: number) => {
        canvas.toBlob((b) => {
          if (!b) {
            reject(new Error("Encoding failed"));
            return;
          }
          if (b.size <= MAX_IMAGE_BYTES || q <= 0.3) resolve(b);
          else step(Math.round((q - 0.15) * 100) / 100);
        }, "image/jpeg", q);
      };
      step(0.85);
    });
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!blob) throw new Error("Encoding failed");
  if (blob.size <= MAX_IMAGE_BYTES) return blob;

  throw new Error("PNG is too large — use a smaller image or reduce dimensions");
}

async function compressImageFile(file: File): Promise<{ blob: Blob; filename: string }> {
  const png = isPngFile(file);
  const img = await loadImage(file);
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const maxW = 1200;
  const maxH = 800;

  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, maxW / w, maxH / h) * (attempt === 0 ? 1 : 0.85 ** attempt);
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);
    try {
      const blob = await encodeCanvas(canvas, png ? "image/png" : "image/jpeg");
      return { blob, filename: png ? "image.png" : "image.jpg" };
    } catch {
      // PNG too large — retry with smaller dimensions
      if (!png) throw new Error("Image is too large after compression");
    }
  }

  throw new Error("Image is too large — use a smaller PNG");
}

export async function uploadCompanyBranding(
  companyId: number,
  kind: BrandingImageKind,
  file: File,
): Promise<void> {
  const { blob, filename } = await compressImageFile(file);
  const fd = new FormData();
  fd.append(FIELD_MAP[kind], blob, filename);

  const res = await fetch(`/api/companies/${companyId}/branding`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Upload failed";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
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
