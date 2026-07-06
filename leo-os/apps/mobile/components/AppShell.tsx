import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { APP_NAME } from "@/lib/brand";

/** Matches web `.bg-app-shell` — cream base with soft teal/cream radial accents. */
export function AppShell({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const theme = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.scroll}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["hsl(162, 50%, 92%)", "hsl(40, 35%, 98%)", "hsl(40, 60%, 92%)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={[styles.safe, { backgroundColor: "transparent" }]} edges={["top", "bottom"]}>
        {body}
      </SafeAreaView>
    </View>
  );
}

export function BrandFooter() {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.footer,
        { color: theme.colors.mutedForeground, fontFamily: theme.fonts.mono },
      ]}
    >
      {APP_NAME}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "hsl(40, 35%, 98%)",
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
});
