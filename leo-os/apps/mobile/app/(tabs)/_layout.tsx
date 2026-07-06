import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingTabBar, TAB_BAR_LIFT } from "@/components/FloatingTabBar";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";

/**
 * Tab visibility by role (matches leoOs_system reference):
 *
 *  Tab        superuser  admin  agent  client  company  employee
 *  Dashboard  ✓          ✓      ✓      ✓       ✓        ✓
 *  Master     ✓          ✓      ✓      ✓       ✓        –
 *  Process    ✓          ✓      ✓      –       –        –
 *  Billing    ✓          ✓      –      ✓       ✓        –
 *  Expenses   ✓          ✓      –      –       –        –
 *  Salary     ✓          ✓      –      –       –        ✓
 *  More       ✓          ✓      ✓      ✓       ✓        ✓
 */
const CAN_SEE_MASTER = new Set(["superuser", "admin", "agent", "client", "company"]);
const CAN_SEE_UPLOAD = new Set(["superuser", "admin", "agent"]);
const CAN_SEE_BILLING = new Set(["superuser", "admin", "client", "company"]);
const CAN_SEE_EXPENSES = new Set(["superuser", "admin"]);
const CAN_SEE_SALARY = new Set(["superuser", "admin", "employee"]);

function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: keyof typeof Feather.glyphMap;
  color: string;
  size?: number;
}) {
  return <Feather name={name} color={color} size={size} />;
}

export default function TabLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom + TAB_BAR_LIFT;

  return (
    <Tabs
      tabBar={(props) => (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: bottomOffset,
          }}
        >
          <FloatingTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.primaryForeground,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
        tabBarStyle: {
          position: "absolute",
          height: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          ...(Platform.OS === "ios" ? { shadowRadius: 0 } : null),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="master"
        options={{
          title: "Master",
          href: CAN_SEE_MASTER.has(role) ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="users" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Process",
          href: CAN_SEE_UPLOAD.has(role) ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="zap" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: "Billing",
          href: CAN_SEE_BILLING.has(role) ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="file-text" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          href: CAN_SEE_EXPENSES.has(role) ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="credit-card" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="salary"
        options={{
          title: "Salary",
          href: CAN_SEE_SALARY.has(role) ? undefined : null,
          tabBarIcon: ({ color, size }) => <TabIcon name="dollar-sign" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
