import { useSystemSettings } from "@/hooks/use-system-settings";
import { resolveBrandLogo, type BrandLogoContext } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { BrandImage } from "@/components/brand-image";

type BrandLogoSize = "sidebar" | "sidebar-small" | "auth";

const sizeClasses: Record<BrandLogoSize, string> = {
  sidebar: "w-full max-h-10 object-left",
  "sidebar-small": "w-full max-h-8 object-left",
  auth: "w-full h-auto max-h-24",
};

const fallbackTextClasses: Record<BrandLogoSize, string> = {
  sidebar: "text-base font-bold tracking-tight text-sidebar-foreground",
  "sidebar-small": "text-sm font-bold tracking-tight text-sidebar-foreground",
  auth: "text-lg font-bold tracking-tight text-foreground",
};

export function BrandLogo({
  context = "light",
  size = "sidebar",
  className,
}: {
  context?: BrandLogoContext;
  size?: BrandLogoSize;
  className?: string;
}) {
  const { appName, logoImage, logoImageDark } = useSystemSettings({ includeLogos: true });
  const src = resolveBrandLogo(logoImage, logoImageDark, context);

  if (!src) {
    return <span className={cn(fallbackTextClasses[size], className)}>{appName}</span>;
  }

  return (
    <BrandImage
      src={src}
      alt={appName}
      className={cn(sizeClasses[size], className)}
    />
  );
}
