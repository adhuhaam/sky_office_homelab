import React, { createContext, useContext, useMemo } from "react";

import { createTheme, type Theme } from "@/lib/theme";

const ThemeContext = createContext<Theme>(createTheme());

export function ThemeProvider({
  accentHue,
  children,
}: {
  accentHue?: number;
  children: React.ReactNode;
}) {
  const value = useMemo(() => createTheme(accentHue), [accentHue]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
