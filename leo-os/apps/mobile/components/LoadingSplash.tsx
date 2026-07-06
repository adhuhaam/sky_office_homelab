import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { APP_NAME } from "@/lib/brand";

/** Shown while fonts/auth initialize (native splash is still visible until hideAsync). */
export function LoadingSplash() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.brand, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
        {APP_NAME}
      </Text>
      <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  brand: {
    fontSize: 26,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  spinner: {
    marginTop: 28,
  },
});
