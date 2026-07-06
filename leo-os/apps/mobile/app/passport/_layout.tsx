import { Stack } from "expo-router";

import { useTheme } from "@/hooks/useTheme";

export default function PassportLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerTitleStyle: { fontFamily: theme.fonts.sansSemibold, fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: "Passport", headerBackTitle: "Back" }} />
    </Stack>
  );
}
