import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export function IconBox({
  children,
  size = 36,
}: {
  children: ReactNode;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.accent,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
});
