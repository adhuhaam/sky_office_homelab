import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@leo/api-client-react";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LoadingSplash } from "@/components/LoadingSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useColors } from "@/hooks/useColors";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/config";

SplashScreen.preventAutoHideAsync();

const apiBaseUrl = getApiBaseUrl();
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthed } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const seg = String(segments[0]);
    const authPage = seg === "login" || seg === "signup";
    if (!isAuthed && !authPage) {
      router.replace("/login" as Href);
    } else if (isAuthed && authPage) {
      router.replace("/(tabs)" as Href);
    }
  }, [isLoading, isAuthed, segments, router]);

  return <>{children}</>;
}

function RootNavigator() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 17, color: colors.foreground },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="passport" options={{ headerShown: false }} />
      <Stack.Screen name="clients/index" options={{ title: "Clients", headerBackTitle: "Back" }} />
      <Stack.Screen name="clients/[id]" options={{ title: "Client", headerBackTitle: "Back" }} />
      <Stack.Screen name="clients/new" options={{ title: "New Client", presentation: "modal" }} />
      <Stack.Screen name="companies/index" options={{ title: "Companies", headerBackTitle: "Back" }} />
      <Stack.Screen name="companies/[id]" options={{ title: "Company", headerBackTitle: "Back" }} />
      <Stack.Screen name="companies/new" options={{ title: "New Company", presentation: "modal" }} />
      <Stack.Screen name="billing/[id]" options={{ title: "Document", headerBackTitle: "Back" }} />
      <Stack.Screen name="billing/new" options={{ title: "New Document", presentation: "modal" }} />
      <Stack.Screen name="billing/edit/[id]" options={{ title: "Edit Document", headerBackTitle: "Back" }} />
      <Stack.Screen name="expenses" options={{ title: "Expenses", headerBackTitle: "Back" }} />
      <Stack.Screen name="expense/new" options={{ title: "New expense", presentation: "modal" }} />
      <Stack.Screen name="expense/[id]" options={{ title: "Expense", headerBackTitle: "Back" }} />
      <Stack.Screen name="passwords" options={{ title: "Passwords", headerBackTitle: "Back" }} />
      <Stack.Screen name="loa/index" options={{ title: "Letters of Appointment", headerBackTitle: "More" }} />
      <Stack.Screen name="loa/new" options={{ title: "New Appointment Letter", presentation: "modal" }} />
      <Stack.Screen name="loa/[id]" options={{ title: "Appointment Letter", headerBackTitle: "LOA" }} />
      <Stack.Screen name="admin/users" options={{ title: "User Management", headerBackTitle: "More" }} />
      <Stack.Screen name="admin/permissions" options={{ title: "Permissions", headerBackTitle: "More" }} />
      <Stack.Screen name="admin/system-settings" options={{ title: "System Settings", headerBackTitle: "More" }} />
      <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
    </Stack>
  );
}

function AppReadyGate({ children }: { children: React.ReactNode }) {
  const [fontsLoaded] = useAppFonts();
  const { isLoading: authLoading } = useAuth();
  const ready = fontsLoaded && !authLoading;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    if (!fontsLoaded) return;
    const TextWithDefaults = Text as typeof Text & {
      defaultProps?: { style?: object | object[] };
    };
    TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
    TextWithDefaults.defaultProps.style = [
      { fontFamily: "Inter_400Regular" },
      TextWithDefaults.defaultProps.style,
    ].flat();
  }, [fontsLoaded]);

  if (!ready) {
    return fontsLoaded ? <LoadingSplash /> : null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
                <AuthProvider>
                  <AppReadyGate>
                    <AuthGate>
                      <RootNavigator />
                    </AuthGate>
                  </AppReadyGate>
                </AuthProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
