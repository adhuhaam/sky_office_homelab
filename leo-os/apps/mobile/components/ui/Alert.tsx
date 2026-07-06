import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export function Alert({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.alert,
        {
          backgroundColor: "hsl(0, 70%, 97%)",
          borderColor: "hsl(0, 70%, 85%)",
          borderRadius: 8,
        },
      ]}
    >
      <Text style={[styles.text, { color: theme.colors.destructive, fontFamily: theme.fonts.sans }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    borderWidth: 1,
    padding: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});
