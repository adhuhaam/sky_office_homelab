export type BrandLogoContext = "light" | "dark";

export function resolveBrandLogo(
  logoImageLight: string | null | undefined,
  logoImageDark: string | null | undefined,
  context: BrandLogoContext,
): string | null {
  if (context === "dark") {
    return logoImageDark ?? logoImageLight ?? null;
  }
  return logoImageLight ?? null;
}
