import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost";

type ButtonProps = PressableProps & {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({
  children,
  variant = "default",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle =
    variant === "default"
      ? {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primaryBorder,
        }
      : variant === "secondary"
        ? {
            backgroundColor: theme.colors.secondary,
            borderColor: theme.colors.border,
          }
        : variant === "outline"
          ? {
              backgroundColor: "transparent",
              borderColor: theme.colors.border,
            }
          : {
              backgroundColor: "transparent",
              borderColor: "transparent",
            };

  const textColor =
    variant === "default"
      ? theme.colors.primaryForeground
      : variant === "secondary"
        ? theme.colors.secondaryForeground
        : theme.colors.foreground;

  return (
    <Pressable
      disabled={isDisabled}
      style={(state) => {
        const pressed = state.pressed;
        const extraStyle = typeof style === "function" ? style(state) : style;
        return [
          styles.base,
          { borderRadius: theme.radii.md, opacity: isDisabled ? 0.6 : pressed ? 0.92 : 1 },
          variantStyle,
          extraStyle,
        ];
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontFamily: theme.fonts.sansMedium }]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
  },
});
