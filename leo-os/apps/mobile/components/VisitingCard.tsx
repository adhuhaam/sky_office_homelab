import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";

import { useTheme } from "@/hooks/useTheme";
import { APP_NAME } from "@/lib/brand";
import { buildVCard } from "@/lib/vcard";

const FLIP_MS = 520;
const BACK_LOGO = require("@/assets/images/x1.png");

const GOLD_DARK = "#2a1d08";
const GOLD_MID = "#5c4518";
const GOLD_LIGHT = "#f8efd0";

function CardFace({
  children,
  style,
  flush = false,
}: {
  children: ReactNode;
  style?: object;
  flush?: boolean;
}) {
  return (
    <View style={[styles.faceGradient, flush && styles.faceGradientFlush, style]}>
      <LinearGradient
        colors={["#3a2806", "#7a5a14", "#c9a030", "#e8cc6a", "#a67c18"]}
        locations={[0, 0.22, 0.48, 0.72, 1]}
        start={{ x: 0, y: 0.35 }}
        end={{ x: 1, y: 0.65 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(35, 22, 4, 0.55)", "transparent", "rgba(211, 190, 0, 0.63)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(30, 18, 3, 0.4)", "transparent", "rgba(198, 178, 76, 0.56)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", "rgba(255, 248, 215, 0.15)", "rgba(255, 253, 195, 0.35)", "rgba(255, 248, 215, 0.51)", "transparent"]}
        locations={[0, 0.38, 0.46, 0.54, 1]}
        start={{ x: 0.05, y: 1 }}
        end={{ x: 0.95, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(202, 174, 16, 0.45)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.35 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.47)", "transparent", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.25, y: 0.25 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.faceContent, flush && styles.faceGradientFlush]}>{children}</View>
    </View>
  );
}

function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "U").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatRole(role: string | null | undefined): string {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type VisitingCardProps = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  role?: string | null;
  org?: string | null;
};

export function VisitingCard({
  name,
  email,
  phone,
  designation,
  role,
  org,
}: VisitingCardProps) {
  const theme = useTheme();
  const flipped = useSharedValue(0);

  const displayName = name?.trim() || "Team member";
  const organization = org?.trim() || APP_NAME;
  const title = designation?.trim() || formatRole(role);
  const roleLabel = role ? formatRole(role) : null;

  const vcard = useMemo(
    () =>
      buildVCard({
        name: displayName,
        email,
        phone,
        title,
        org: organization,
      }),
    [displayName, email, phone, title, organization],
  );

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipped.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: interpolate(flipped.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0]),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipped.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: interpolate(flipped.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1]),
  }));

  function toggleFlip() {
    flipped.value = withTiming(flipped.value === 0 ? 1 : 0, { duration: FLIP_MS });
  }

  return (
    <Pressable onPress={toggleFlip} style={styles.wrap}>
      <View style={styles.flipStage}>
        <Animated.View style={[styles.face, frontStyle]} pointerEvents="none">
          <CardFace>
            {roleLabel ? (
              <View style={styles.roleBadge}>
                <Text style={[styles.roleText, { fontFamily: theme.fonts.sansSemibold }]}>{roleLabel}</Text>
              </View>
            ) : null}

            <View style={styles.frontTop}>
              <View style={styles.avatar}>
                <Text style={[styles.avatarText, { fontFamily: theme.fonts.sansBold }]}>{getInitials(displayName)}</Text>
              </View>
              <View style={styles.identityCopy}>
                <Text numberOfLines={1} style={[styles.name, { fontFamily: theme.fonts.sansBold }]}>
                  {displayName}
                </Text>
                <Text numberOfLines={1} style={[styles.title, { fontFamily: theme.fonts.sansMedium }]}>
                  {title}
                </Text>
              </View>
            </View>

            <View style={styles.frontMain}>
              <View style={styles.contactList}>
                {phone ? (
                  <View style={styles.contactRow}>
                    <Feather name="phone" size={12} color={"#000000"} />
                    <Text numberOfLines={1} style={[styles.contactText, { fontFamily: theme.fonts.sans }]}>
                      {phone}
                    </Text>
                  </View>
                ) : null}
                {email ? (
                  <View style={styles.contactRow}>
                    <Feather name="mail" size={12} color={"#000000"} />
                    <Text numberOfLines={1} style={[styles.contactText, { fontFamily: theme.fonts.sans }]}>
                      {email}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.qrCorner}>
              <View style={styles.qrFrame}>
                <QRCode value={vcard} size={84} backgroundColor="#ffffff" color={GOLD_DARK} />
              </View>
              
            </View>

            
          </CardFace>
        </Animated.View>

        <Animated.View style={[styles.face, styles.faceBack, backStyle]} pointerEvents="none">
          <CardFace>
            <View style={styles.backCenter}>
              <Image source={BACK_LOGO} style={styles.backLogo} contentFit="contain" />
            </View>
          </CardFace>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 0.1,
    borderColor: "#ededed",
    shadowColor: "#5c4010",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  flipStage: {
    aspectRatio: 1.586,
    width: "100%",
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "hidden",
    borderRadius: 16,
    overflow: "hidden",
  },
  faceBack: {
    zIndex: 1,
  },
  faceGradient: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  faceContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: "relative",
    zIndex: 1,
  },
  faceGradientFlush: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  roleBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(58, 58, 58, 0.8)",
    backgroundColor: "rgba(174, 170, 156, 0.31)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  roleText: {
    color: "#000000",
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  frontTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 72,
    marginTop: 4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(247, 228, 156, 0.33)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#000000",
    fontSize: 20,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    color: "#000000",
    fontSize: 17,
    letterSpacing: -0.2,
  },
  title: {
    color: "#000000",
    fontSize: 12,
  },
  frontMain: {
    flex: 1,
    marginTop: 115,
    paddingRight: 100,
  },
  contactList: {
    gap: 6,
    paddingTop: 4,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  contactText: {
    flex: 1,
    color: "#000000",
    fontSize: 11,
  },
  qrCorner: {
    position: "absolute",
    right: 16,
    bottom: 18,
    alignItems: "center",
    gap: 2,
  },
  qrFrame: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 4,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  
  backCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backLogo: {
    width: 200,
    height: 100,
  },
});
