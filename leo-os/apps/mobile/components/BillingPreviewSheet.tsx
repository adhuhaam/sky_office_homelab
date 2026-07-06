import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { fetchBillingPreviewHtml } from "@/lib/billing-preview";

type Props = {
  visible: boolean;
  documentId: number | null;
  title?: string;
  onClose: () => void;
};

export function BillingPreviewSheet({ visible, documentId, title, onClose }: Props) {
  const theme = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || documentId == null) {
      setHtml(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBillingPreviewHtml(documentId)
      .then((content) => {
        if (!cancelled) setHtml(content);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preview");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, documentId]);

  async function handlePrint() {
    if (!html) return;
    setPrinting(true);
    try {
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert("Print failed", err instanceof Error ? err.message : "Could not print document");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
              {title ?? "Preview"}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              Print-ready invoice / quotation
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Feather name="x" size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={[styles.errorText, { color: theme.colors.destructive, fontFamily: theme.fonts.sans }]}>
                {error}
              </Text>
            </View>
          ) : html ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html }}
              style={styles.webview}
              showsVerticalScrollIndicator
              startInLoadingState
            />
          ) : null}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Button variant="outline" onPress={onClose} style={styles.footerBtn}>
            Close
          </Button>
          <Button onPress={handlePrint} disabled={!html || printing} style={styles.footerBtn}>
            {printing ? "Printing…" : "Print"}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: { flex: 1, gap: 2 },
  title: { fontSize: 17 },
  subtitle: { fontSize: 12 },
  closeBtn: { padding: 4 },
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 14, textAlign: "center" },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: { flex: 1 },
});
