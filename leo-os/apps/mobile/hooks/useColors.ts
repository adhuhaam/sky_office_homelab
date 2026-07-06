import { useTheme } from "@/hooks/useTheme";

/** Flat color tokens for screens ported from leoOs_system reference. */
export function useColors() {
  const theme = useTheme();
  return {
    ...theme.colors,
    text: theme.colors.foreground,
    tint: theme.colors.primary,
    radius: theme.radii.lg,
  };
}
