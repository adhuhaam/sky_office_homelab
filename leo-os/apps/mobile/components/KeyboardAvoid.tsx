import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type KeyboardEvent,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";

type KeyboardFormProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  center?: boolean;
};

/** Wraps scrollable form screens (login, etc.) so inputs stay above the keyboard. */
export function KeyboardForm({ children, contentContainerStyle, center = true }: KeyboardFormProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          center ? styles.formScrollCentered : styles.formScroll,
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type KeyboardSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  animationType?: ModalProps["animationType"];
};

type FullScreenFormProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

function keyboardOverlapHeight(event: KeyboardEvent): number {
  const windowHeight = Dimensions.get("window").height;
  return Math.max(0, windowHeight - event.endCoordinates.screenY);
}

/** Full-screen modal for add/edit flows (expenses, master list, etc.). */
export function FullScreenForm({ visible, onClose, title, children, footer }: FullScreenFormProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[fullStyles.safe, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
        <View style={[fullStyles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10} style={fullStyles.headerBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={[fullStyles.headerBtnText, { color: theme.colors.mutedForeground }]}>✕</Text>
          </Pressable>
          <Text
            numberOfLines={1}
            style={[fullStyles.headerTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}
          >
            {title}
          </Text>
          <View style={fullStyles.headerBtn} />
        </View>

        <KeyboardAvoidingView
          style={fullStyles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={fullStyles.body}
          >
            {children}
          </ScrollView>

          {footer ? <View style={[fullStyles.footer, { borderTopColor: theme.colors.border }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** Bottom sheet modal that shifts above the software keyboard. */
export function KeyboardSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  animationType = "slide",
}: KeyboardSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardOffset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOffset(keyboardOverlapHeight(event));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const keyboardOpen = keyboardOffset > 0;
  const safeBottom = Math.max(insets.bottom, 12);

  return (
    <Modal visible={visible} animationType={animationType} transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />

        <View style={[styles.sheetLift, { marginBottom: keyboardOpen ? keyboardOffset : 0 }]}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.background,
                paddingBottom: keyboardOpen ? 12 : safeBottom,
                maxHeight: keyboardOpen ? "88%" : "92%",
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text
                style={[styles.sheetTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}
              >
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={[styles.sheetClose, { color: theme.colors.mutedForeground }]}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.sheetBody}
              style={styles.sheetScroll}
            >
              {children}
            </ScrollView>

            {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  formScroll: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  formScrollCentered: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 32,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetLift: {
    width: "100%",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sheetTitle: { fontSize: 18 },
  sheetClose: { fontSize: 20, lineHeight: 22 },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 14,
    flexGrow: 1,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
});

const fullStyles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 22,
    lineHeight: 24,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    textAlign: "center",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
