import { Feather } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AuthLayout } from "@/components/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";

function InputAdornment({
  icon,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.inputWrap, { borderColor: theme.colors.input, backgroundColor: theme.colors.card }]}>
      <Feather name={icon} size={16} color={theme.colors.mutedForeground} style={styles.inputIcon} />
      {children}
    </View>
  );
}

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function onSubmit() {
    if (!email.trim() || !password.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password.trim());
      router.replace("/(tabs)" as Href);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        setError("Your account is pending admin approval.");
      } else if (status === 401) {
        setError("Incorrect email or password. Try again.");
      } else {
        setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !submitting;

  return (
    <AuthLayout title="Sign in" description="Use your work email and password to continue.">
      <View style={styles.form}>
        <Field label="Email">
          <InputAdornment icon="mail">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="you@example.com"
              editable={!submitting}
              style={styles.adornedInput}
            />
          </InputAdornment>
        </Field>

        <Field label="Password">
          <InputAdornment icon="lock">
            <Input
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && onSubmit()}
              placeholder="Enter your password"
              editable={!submitting}
              style={styles.passwordInput}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={theme.colors.mutedForeground}
              />
            </Pressable>
          </InputAdornment>
        </Field>

        {error ? <Alert>{error}</Alert> : null}

        <Button onPress={onSubmit} disabled={!canSubmit} loading={submitting} style={styles.signInBtn}>
          Sign in
        </Button>

        <Text style={[styles.hint, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
          Secure access for authorized {APP_NAME} team members only.
        </Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 8,
  },
  inputIcon: {
    marginRight: 8,
  },
  adornedInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 10,
    fontSize: 16,
  },
  passwordInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingRight: 36,
    paddingVertical: 10,
    fontSize: 16,
  },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: 13,
  },
  signInBtn: {
    minHeight: 48,
    borderRadius: 12,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginTop: -4,
  },
});
