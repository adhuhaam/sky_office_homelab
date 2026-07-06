import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

type ExpoTabOptions = BottomTabNavigationOptions & { href?: string | null };

function isTabVisible(options: BottomTabNavigationOptions) {
  const href = (options as ExpoTabOptions).href;
  return href !== null;
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();

  const visibleRoutes = state.routes.filter((route) =>
    isTabVisible(descriptors[route.key].options),
  );

  function onPress(routeKey: string, routeName: string, isFocused: boolean) {
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: "rgba(255, 255, 255, 0.85)",
          borderColor: "rgba(200, 190, 175, 0.45)",
        },
      ]}
    >
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === routeIndex;
          const label = options.title ?? route.name;
          const iconColor = isFocused ? theme.colors.primaryForeground : theme.colors.mutedForeground;

          const icon =
            options.tabBarIcon?.({
              focused: isFocused,
              color: iconColor,
              size: 22,
            }) ?? null;

          return (
            <Pressable
              key={route.key}
              onPress={() => onPress(route.key, route.name, isFocused)}
              style={styles.tabPressable}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            >
              <View
                style={[
                  styles.iconWrap,
                  isFocused && { backgroundColor: theme.colors.primary },
                ]}
              >
                {icon}
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#14120f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  android: { elevation: 12 },
  default: {},
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    height: 56,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "visible",
    ...shadow,
  },
  tabPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

/** Height of the floating pill bar */
export const FLOATING_TAB_BAR_HEIGHT = 56;

/** Extra lift above the safe-area inset */
export const TAB_BAR_LIFT = 28;
