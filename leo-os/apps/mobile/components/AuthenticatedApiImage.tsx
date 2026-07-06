import { getAuthToken } from "@leo/api-client-react";
import { Image, type ImageProps } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { resolveApiUrl } from "@/lib/xpat";

type AuthenticatedApiImageProps = Omit<ImageProps, "source"> & {
  path: string;
  loadingHeight?: number;
};

export function AuthenticatedApiImage({
  path,
  loadingHeight = 160,
  style,
  ...rest
}: AuthenticatedApiImageProps) {
  const theme = useTheme();
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getAuthToken();
      if (cancelled) return;
      setSource({
        uri: resolveApiUrl(path),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!source) {
    return (
      <View style={[styles.loading, { height: loadingHeight, backgroundColor: theme.colors.muted }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return <Image source={source} style={style} {...rest} />;
}

const styles = StyleSheet.create({
  loading: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
