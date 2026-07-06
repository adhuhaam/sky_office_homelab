import type { ReactNode } from "react";
import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export function Label({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.label, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>
      {children}
    </Text>
  );
}

export const Input = forwardRef<TextInput, TextInputProps>(function Input(props, ref) {
  const theme = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.colors.mutedForeground}
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.input,
          color: theme.colors.foreground,
          borderRadius: theme.radii.md,
          fontFamily: theme.fonts.sans,
        },
        props.style,
      ]}
      {...props}
    />
  );
});

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14 },
  input: {
    minHeight: 36,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
});
