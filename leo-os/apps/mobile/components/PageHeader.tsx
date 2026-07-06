import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { pageLayoutStyles } from "@/lib/page-layout-styles";

type PageHeaderProps = {
  brandIcon: keyof typeof Feather.glyphMap;
  brandLabel: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
};

/** Shared tab page header — brand label, title row, subtitle (matches Master / Process tabs). */
export function PageHeader({ brandIcon, brandLabel, title, subtitle, action }: PageHeaderProps) {
  const theme = useTheme();

  return (
    <>
      <View style={pageLayoutStyles.brandRow}>
        <Feather name={brandIcon} size={14} color={theme.colors.mutedForeground} />
        <Text
          style={[
            pageLayoutStyles.brandLabel,
            { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansSemibold },
          ]}
        >
          {brandLabel}
        </Text>
      </View>

      <View style={pageLayoutStyles.titleRow}>
        <Text
          style={[
            pageLayoutStyles.pageTitle,
            { flex: 1, color: theme.colors.foreground, fontFamily: theme.fonts.sansBold },
          ]}
        >
          {title}
        </Text>
        {action}
      </View>

      <Text
        style={[
          pageLayoutStyles.pageSub,
          { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans },
        ]}
      >
        {subtitle}
      </Text>
    </>
  );
}
