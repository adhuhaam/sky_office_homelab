import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FLOATING_TAB_BAR_HEIGHT, TAB_BAR_LIFT } from "@/components/FloatingTabBar";

/** Scroll padding so content clears the floating tab bar */
export function useTabBarInset(extra = 16) {
  const insets = useSafeAreaInsets();
  return FLOATING_TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_LIFT + extra;
}
