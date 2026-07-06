import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export function Card({ style, children, ...props }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          borderRadius: theme.radii.xl,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <View style={styles.header}>{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.title, { color: theme.colors.cardForeground, fontFamily: theme.fonts.sansSemibold }]}>
      {children}
    </Text>
  );
}

export function CardDescription({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.description,
        { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans },
      ]}
    >
      {children}
    </Text>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return <View style={styles.content}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    shadowColor: "#14120f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    gap: 12,
  },
});
