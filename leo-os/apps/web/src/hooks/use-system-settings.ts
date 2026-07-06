import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const DEFAULT_HUE = 162;

export interface SystemBrandingMetadata {
  appName: string;
  accentHue: number;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  companyRegistrationNumber: string | null;
  hasLogo: boolean;
  hasLogoDark: boolean;
}

export interface SystemBranding extends SystemBrandingMetadata {
  logoImage: string | null;
  logoImageDark: string | null;
}

function applyAccentHue(hue: number) {
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  set("--ring", `${hue} 38% 42%`);
  set("--primary", `${hue} 38% 38%`);
  set("--accent", `${hue} 45% 92%`);
  set("--accent-foreground", `${hue} 50% 24%`);
  set("--sidebar-primary", `${hue} 42% 58%`);
  set("--sidebar-accent-foreground", `${hue} 45% 75%`);
  set("--sidebar-ring", `${hue} 38% 50%`);
  set("--chart-1", `${hue} 38% 42%`);
  set("--brand-grad-from", `${hue} 45% 55%`);
  set("--brand-grad-via", `${(hue + 3) % 360} 40% 45%`);
  set("--brand-grad-to", `${(hue + 8) % 360} 35% 30%`);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", `hsl(${hue} 38% 38%)`);
}

function applyAppName(appName: string) {
  document.title = appName;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute("content", appName);
}

let brandingCache: SystemBranding | null = null;
let brandingInflight: Promise<SystemBranding> | null = null;
let logosInflight: Promise<Pick<SystemBranding, "logoImage" | "logoImageDark">> | null = null;
const brandingListeners = new Set<() => void>();

function notifyBrandingListeners() {
  brandingListeners.forEach((listener) => listener());
}

export function subscribeBranding(listener: () => void) {
  brandingListeners.add(listener);
  return () => brandingListeners.delete(listener);
}

function defaultBranding(): SystemBranding {
  return {
    appName: "LEO OS",
    accentHue: DEFAULT_HUE,
    companyName: null,
    companyAddress: null,
    companyPhone: null,
    companyEmail: null,
    companyWebsite: null,
    companyRegistrationNumber: null,
    hasLogo: false,
    hasLogoDark: false,
    logoImage: null,
    logoImageDark: null,
  };
}

function mergeMetadata(data: SystemBrandingMetadata): SystemBranding {
  const base = brandingCache ?? defaultBranding();
  brandingCache = {
    ...base,
    ...data,
    logoImage: base.logoImage,
    logoImageDark: base.logoImageDark,
  };
  return brandingCache;
}

/** Fetch lightweight branding metadata (no logo payloads). */
export async function fetchBranding(): Promise<SystemBranding> {
  if (brandingInflight) return brandingInflight;

  brandingInflight = apiFetch<SystemBrandingMetadata>("/system/branding")
    .then((data) => {
      const merged = mergeMetadata({
        appName: data.appName ?? "LEO OS",
        accentHue: data.accentHue ?? DEFAULT_HUE,
        companyName: data.companyName ?? null,
        companyAddress: data.companyAddress ?? null,
        companyPhone: data.companyPhone ?? null,
        companyEmail: data.companyEmail ?? null,
        companyWebsite: data.companyWebsite ?? null,
        companyRegistrationNumber: data.companyRegistrationNumber ?? null,
        hasLogo: data.hasLogo ?? false,
        hasLogoDark: data.hasLogoDark ?? false,
      });
      notifyBrandingListeners();
      return merged;
    })
    .finally(() => {
      brandingInflight = null;
    });

  return brandingInflight;
}

/** Fetch logo data URLs once; skipped when no logos are configured. */
export async function fetchBrandingLogos(): Promise<Pick<SystemBranding, "logoImage" | "logoImageDark">> {
  const meta = brandingCache ?? (await fetchBranding());
  if (!meta.hasLogo && !meta.hasLogoDark) {
    return { logoImage: null, logoImageDark: null };
  }
  if (meta.logoImage != null || meta.logoImageDark != null) {
    return { logoImage: meta.logoImage, logoImageDark: meta.logoImageDark };
  }
  if (logosInflight) return logosInflight;

  logosInflight = apiFetch<Pick<SystemBranding, "logoImage" | "logoImageDark">>("/system/branding/logos")
    .then((logos) => {
      if (brandingCache) {
        brandingCache = {
          ...brandingCache,
          logoImage: logos.logoImage ?? null,
          logoImageDark: logos.logoImageDark ?? null,
        };
        notifyBrandingListeners();
      }
      return logos;
    })
    .finally(() => {
      logosInflight = null;
    });

  return logosInflight;
}

/** Clear caches after settings save so UI picks up new branding. */
export function invalidateBrandingCache() {
  brandingCache = null;
  brandingInflight = null;
  logosInflight = null;
  notifyBrandingListeners();
}

export function useApplySystemSettings() {
  useEffect(() => {
    fetchBranding()
      .then((data) => {
        applyAccentHue(data.accentHue);
        applyAppName(data.appName);
      })
      .catch(() => {
        applyAccentHue(DEFAULT_HUE);
      });
  }, []);
}

export function useSystemBranding() {
  return useSystemSettings();
}

export function useSystemSettings(options?: { includeLogos?: boolean }) {
  const includeLogos = options?.includeLogos ?? false;
  const [branding, setBranding] = useState<SystemBranding>(() => ({
    ...(brandingCache ?? defaultBranding()),
  }));

  useEffect(() => {
    let active = true;
    const syncFromCache = () => {
      if (active && brandingCache) setBranding({ ...brandingCache });
    };

    fetchBranding()
      .then((data) => {
        if (!active) return;
        setBranding(data);
        if (includeLogos && (data.hasLogo || data.hasLogoDark)) {
          return fetchBrandingLogos().then((logos) => {
            if (active && brandingCache) setBranding({ ...brandingCache, ...logos });
          });
        }
      })
      .catch(() => undefined);

    const unsubscribe = subscribeBranding(syncFromCache);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [includeLogos]);

  return branding;
}

export function applyAccentHuePreview(hue: number) {
  applyAccentHue(hue);
}
