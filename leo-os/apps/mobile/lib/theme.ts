/** Default brand accent hue — matches web `use-system-settings` default (teal). */
export const DEFAULT_ACCENT_HUE = 162;

export type ThemeColors = {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  primaryBorder: string;
  card: string;
  cardForeground: string;
  cardBorder: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  secondary: string;
  secondaryForeground: string;
  border: string;
  input: string;
  destructive: string;
  destructiveForeground: string;
  sidebar: string;
  sidebarForeground: string;
};

export type ThemeRadii = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

export type Theme = {
  colors: ThemeColors;
  radii: ThemeRadii;
  fonts: {
    sans: string;
    sansMedium: string;
    sansSemibold: string;
    sansBold: string;
    mono: string;
  };
};

/** Mirrors web `index.css` + `applyAccentHue()` token formulas. */
export function createTheme(accentHue = DEFAULT_ACCENT_HUE): Theme {
  return {
    colors: {
      background: "hsl(40, 35%, 98%)",
      foreground: "hsl(30, 12%, 12%)",
      primary: `hsl(${accentHue}, 38%, 38%)`,
      primaryForeground: "hsl(40, 35%, 98%)",
      primaryBorder: `hsl(${accentHue}, 38%, 32%)`,
      card: "hsl(0, 0%, 100%)",
      cardForeground: "hsl(30, 12%, 12%)",
      cardBorder: "hsl(38, 22%, 90%)",
      muted: "hsl(40, 28%, 95%)",
      mutedForeground: "hsl(30, 8%, 42%)",
      accent: `hsl(${accentHue}, 45%, 92%)`,
      accentForeground: `hsl(${accentHue}, 50%, 24%)`,
      secondary: "hsl(40, 30%, 94%)",
      secondaryForeground: "hsl(30, 14%, 18%)",
      border: "hsl(38, 22%, 88%)",
      input: "hsl(38, 22%, 88%)",
      destructive: "hsl(0, 70%, 50%)",
      destructiveForeground: "hsl(0, 0%, 100%)",
      sidebar: "hsl(30, 8%, 12%)",
      sidebarForeground: "hsl(38, 30%, 92%)",
    },
    radii: {
      sm: 6,
      md: 8,
      lg: 10,
      xl: 14,
    },
    fonts: {
      sans: "Inter_400Regular",
      sansMedium: "Inter_500Medium",
      sansSemibold: "Inter_600SemiBold",
      sansBold: "Inter_700Bold",
      mono: "Inter_400Regular",
    },
  };
}

export const theme = createTheme();
