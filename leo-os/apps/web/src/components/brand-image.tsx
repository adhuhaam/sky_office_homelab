import { cn } from "@/lib/utils";

type BrandImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

/** Renders uploaded brand assets without adding a background fill. */
export function BrandImage({ src, alt, className }: BrandImageProps) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={cn("brand-image object-contain bg-transparent", className)}
      style={{ backgroundColor: "transparent" }}
    />
  );
}
