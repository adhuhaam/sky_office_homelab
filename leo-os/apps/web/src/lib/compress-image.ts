function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

type CompressOptions = {
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
};

/** Resize and re-encode uploads so settings saves stay within API limits. */
export async function compressImageFile(
  file: File,
  { maxBytes = 750 * 1024, maxWidth = 1600, maxHeight = 600 }: CompressOptions = {},
): Promise<string> {
  const source = await readFileAsDataUrl(file);
  const img = await loadImage(source);
  const preserveAlpha = file.type === "image/png" || file.type === "image/webp";

  let width = img.width;
  let height = img.height;
  let scale = Math.min(1, maxWidth / width, maxHeight / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");

  const encode = (w: number, h: number, quality?: number) => {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    if (preserveAlpha) return canvas.toDataURL("image/png");
    return canvas.toDataURL("image/jpeg", quality ?? 0.88);
  };

  let result = encode(width, height);
  while (dataUrlByteSize(result) > maxBytes && width > 160 && height > 60) {
    width = Math.max(160, Math.round(width * 0.85));
    height = Math.max(60, Math.round(height * 0.85));
    result = encode(width, height, 0.82);
  }

  if (dataUrlByteSize(result) > maxBytes) {
    throw new Error("Image is too large even after compression");
  }

  return result;
}
