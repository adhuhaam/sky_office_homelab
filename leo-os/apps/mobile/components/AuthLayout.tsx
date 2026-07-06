import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppShell, BrandFooter } from "@/components/AppShell";
import { KeyboardForm } from "@/components/KeyboardAvoid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useTheme } from "@/hooks/useTheme";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <AppShell scroll={false}>
      <View style={styles.backdrop}>
        <View style={[styles.orb, styles.orbTop]} />
        <View style={[styles.orb, styles.orbBottom]} />
      </View>

      <KeyboardForm center={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <Text style={[styles.brandTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
              {APP_NAME}
            </Text>
            <Text style={[styles.brandSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              {APP_TAGLINE}
            </Text>
          </View>

          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>

          {footer}
          <BrandFooter />
        </View>
      </KeyboardForm>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.45,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -60,
    right: -40,
    backgroundColor: "hsl(162, 55%, 82%)",
  },
  orbBottom: {
    width: 180,
    height: 180,
    bottom: 80,
    left: -50,
    backgroundColor: "hsl(40, 60%, 88%)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: "center",
  },
  column: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    gap: 16,
  },
  hero: {
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 28,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  brandSub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    width: "100%",
  },
});
