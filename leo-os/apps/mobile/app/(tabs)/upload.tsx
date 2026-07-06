import { Feather } from "@expo/vector-icons";
import {
  getGetPassportQueryKey,
  getGetPassportStatsQueryKey,
  getListCompaniesQueryKey,
  getListLoaQueryKey,
  getListPassportsQueryKey,
  useCreateLoa,
  useGetPassport,
  useListCompanies,
  useUpdatePassport,
  useUploadPassport,
} from "@leo/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEmergencyContact } from "@/lib/emergency-contact";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Alert as UiAlert } from "@/components/ui/Alert";
import { useTheme } from "@/hooks/useTheme";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/lib/auth";
import { pageLayoutStyles } from "@/lib/page-layout-styles";

type Step = "upload" | "processing" | "assign" | "done";

type PickedFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const DEFAULT_LOA_EMPLOYMENT = {
  workType: "Full Time",
  salaryPaymentDate: "End of each month",
  dateOfCommence: "Date of Arrival",
  jobDescription: "Job Description will be given at the time of signing the contract",
  workingHours: "09:00 to 17:00 Saturday to Thursday",
  workStatus: "Contract based",
  contractDuration: "Contract will be for 2 years, Probation period is 3 months",
};

const BASE_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function openLoaView(id: number) {
  if (!BASE_DOMAIN) {
    Alert.alert("View unavailable", "Set EXPO_PUBLIC_DOMAIN to open the LOA view page.");
    return;
  }
  void WebBrowser.openBrowserAsync(`${BASE_DOMAIN}/loa/${id}/print`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function toUploadBlob(file: PickedFile): Blob {
  return { uri: file.uri, name: file.name, type: file.type } as unknown as Blob;
}

function StepIndicator({ step }: { step: Step }) {
  const theme = useTheme();
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "processing", label: "Extract" },
    { key: "assign", label: "Assign" },
    { key: "done", label: "Done" },
  ];
  const order = steps.map((s) => s.key);
  const current = order.indexOf(step === "processing" ? "processing" : step);

  return (
    <View style={styles.stepRow}>
      {steps.map((s, index) => {
        const active = index <= current;
        return (
          <View key={s.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.muted,
                  borderColor: active ? theme.colors.primaryBorder : theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.stepDotText, { color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground }]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, { color: active ? theme.colors.foreground : theme.colors.mutedForeground, fontFamily: theme.fonts.sansMedium }]}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();
  return (
    <View style={[styles.infoField, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
      <Text style={[styles.infoLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

export default function UploadScreen() {
  const theme = useTheme();
  const tabBarInset = useTabBarInset();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [passportId, setPassportId] = useState<number | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [createdLoaId, setCreatedLoaId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companiesQuery = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey(), staleTime: 60_000 },
  });
  const companies = companiesQuery.data ?? [];

  const passportQuery = useGetPassport(passportId ?? 0, {
    query: {
      queryKey: getGetPassportQueryKey(passportId ?? 0),
      enabled: passportId != null && (step === "processing" || step === "assign"),
      refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
    },
  });

  const passport = passportQuery.data;

  const uploadMutation = useUploadPassport({
    mutation: {
      onSuccess: (created) => {
        setPassportId(created.id);
        setStep("processing");
        setError(null);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      },
    },
  });

  const createLoaMutation = useCreateLoa();

  const updateMutation = useUpdatePassport();

  const reset = useCallback(() => {
    setFile(null);
    setPassportId(null);
    setCreatedLoaId(null);
    setCompanyId(user?.role === "company" && user.linkedEntityId ? user.linkedEntityId : "");
    setStep("upload");
    setError(null);
  }, [user?.linkedEntityId, user?.role]);

  useEffect(() => {
    if (step !== "processing" || !passport) return;
    if (passport.status === "completed") {
      setStep("assign");
      if (user?.role === "company" && user.linkedEntityId) {
        setCompanyId(user.linkedEntityId);
      }
    } else if (passport.status === "failed") {
      setFile(null);
      setPassportId(null);
      setStep("upload");
      setError("OCR extraction failed. Try a clearer photo or PDF.");
    }
  }, [passport, step, user?.linkedEntityId, user?.role]);

  useEffect(() => {
    if (user?.role === "company" && user.linkedEntityId) {
      setCompanyId(user.linkedEntityId);
    }
  }, [user?.linkedEntityId, user?.role]);

  const isImage = file?.type.startsWith("image/");

  function setPickedFile(next: PickedFile | null) {
    setFile(next);
    setPassportId(null);
    setError(null);
    if (step !== "upload") setStep("upload");
  }

  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission", "Allow camera access to photograph a passport.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType ?? "image/jpeg";
    if (!ACCEPTED_TYPES.has(type)) {
      setError("Use JPEG, PNG, WEBP, or PDF.");
      return;
    }
    setPickedFile({
      uri: asset.uri,
      name: asset.fileName ?? `passport-${Date.now()}.jpg`,
      type,
      size: asset.fileSize,
    });
  }

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos permission", "Allow photo library access to upload a passport.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType ?? "image/jpeg";
    if (!ACCEPTED_TYPES.has(type)) {
      setError("Use JPEG, PNG, WEBP, or PDF.");
      return;
    }
    setPickedFile({
      uri: asset.uri,
      name: asset.fileName ?? `passport-${Date.now()}.jpg`,
      type,
      size: asset.fileSize,
    });
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType ?? "application/pdf";
    if (!ACCEPTED_TYPES.has(type)) {
      setError("Use JPEG, PNG, WEBP, or PDF.");
      return;
    }
    setPickedFile({
      uri: asset.uri,
      name: asset.name,
      type,
      size: asset.size,
    });
  }

  function handleUpload() {
    if (!file) return;
    setError(null);
    const companyIdNum =
      user?.role === "company" && user.linkedEntityId ? Number(user.linkedEntityId) : undefined;
    uploadMutation.mutate({
      data: {
        file: toUploadBlob(file),
        companyId: Number.isFinite(companyIdNum) ? companyIdNum : undefined,
      },
    });
  }

  async function handleSave() {
    if (!passportId || !companyId || !passport) {
      setError("Select a company before saving.");
      return;
    }
    const company = companies.find((c) => String(c.id) === companyId);
    if (!company) {
      setError("Selected company could not be found.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: passportId,
        data: { companyId: Number(companyId) },
      });

      const loa = await createLoaMutation.mutateAsync({
        data: {
          companyId: Number(companyId),
          passportId,
          companyName: company.name,
          companyAddress: company.address ?? undefined,
          companyEmail: company.email ?? undefined,
          companyPhone: company.phone ?? undefined,
          companyCountry: company.country ?? undefined,
          companyRegistrationNumber: company.registrationNumber ?? undefined,
          candidateName: passport.fullName ?? undefined,
          candidateAddress: passport.address ?? undefined,
          candidateNationality: passport.nationality ?? undefined,
          candidateDateOfBirth: passport.dateOfBirth ?? undefined,
          candidatePassportNumber: passport.passportNumber ?? undefined,
          candidateEmergencyContact:
            formatEmergencyContact(passport.emergencyContactName, passport.emergencyContactPhone) ||
            undefined,
          signatoryName: company.signatoryName ?? undefined,
          signatoryDesignation: company.signatoryDesignation ?? undefined,
          signatureDate: new Date().toLocaleDateString("en-GB"),
          ...DEFAULT_LOA_EMPLOYMENT,
        },
      });

      setCreatedLoaId(loa.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPassportStatsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListLoaQueryKey() }),
      ]);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save candidate.");
    } finally {
      setSaving(false);
    }
  }

  function openCompanyPicker() {
    if (companies.length === 0) {
      Alert.alert("No companies", "Add a company in the web admin before assigning candidates.");
      return;
    }
    Alert.alert(
      "Select company",
      undefined,
      [
        ...companies.map((c) => ({
          text: c.name,
          onPress: () => setCompanyId(String(c.id)),
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }

  const companyLabel = useMemo(
    () => companies.find((c) => String(c.id) === companyId)?.name ?? "Select company…",
    [companies, companyId],
  );

  const hideCompanyPicker = user?.role === "company" && !!user.linkedEntityId;

  return (
    <SafeAreaView style={[pageLayoutStyles.safe, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={pageLayoutStyles.brandRow}>
          <Feather name="zap" size={14} color={theme.colors.mutedForeground} />
          <Text style={[pageLayoutStyles.brandLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansSemibold }]}>
            PROCESSING
          </Text>
        </View>

        <Text style={[pageLayoutStyles.pageTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
          Passport upload
        </Text>
        <Text style={[pageLayoutStyles.pageSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
          Upload a passport image or PDF — fields are extracted automatically, then assign a company. A Letter of Appointment is created when you save.
        </Text>

        <StepIndicator step={step} />

        {error ? <UiAlert>{error}</UiAlert> : null}

        {step === "upload" ? (
          <View style={[styles.card, { borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.card }]}>
            <Pressable
              onPress={pickFromGallery}
              style={[styles.dropZone, { borderColor: theme.colors.border, backgroundColor: theme.colors.muted }]}
            >
              <View style={[styles.dropIcon, { backgroundColor: theme.colors.accent }]}>
                <Feather name="upload-cloud" size={28} color={theme.colors.primary} />
              </View>
              <Text style={[styles.dropTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
                Add passport file
              </Text>
              <Text style={[styles.dropSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                JPEG, PNG, WEBP, PDF · max 20MB
              </Text>
            </Pressable>

            <View style={styles.pickRow}>
              <Pressable onPress={pickFromCamera} style={[styles.pickBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                <Feather name="camera" size={18} color={theme.colors.primary} />
                <Text style={[styles.pickBtnText, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>Camera</Text>
              </Pressable>
              <Pressable onPress={pickFromGallery} style={[styles.pickBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                <Feather name="image" size={18} color={theme.colors.primary} />
                <Text style={[styles.pickBtnText, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>Gallery</Text>
              </Pressable>
              <Pressable onPress={pickDocument} style={[styles.pickBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                <Feather name="file" size={18} color={theme.colors.primary} />
                <Text style={[styles.pickBtnText, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>PDF</Text>
              </Pressable>
            </View>

            {file ? (
              <View style={[styles.fileCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                {isImage ? (
                  <Image source={{ uri: file.uri }} style={styles.preview} resizeMode="cover" />
                ) : (
                  <View style={[styles.pdfPreview, { backgroundColor: theme.colors.muted }]}>
                    <Feather name="file-text" size={28} color={theme.colors.primary} />
                  </View>
                )}
                <View style={styles.fileMeta}>
                  <Text numberOfLines={1} style={[styles.fileName, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
                    {file.name}
                  </Text>
                  <Text style={[styles.fileSize, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                    {formatFileSize(file.size)}
                  </Text>
                </View>
                <View style={styles.fileActions}>
                  <Button variant="outline" onPress={() => setPickedFile(null)}>
                    Remove
                  </Button>
                  <Button onPress={handleUpload} loading={uploadMutation.isPending}>
                    Extract
                  </Button>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === "processing" ? (
          <View style={[styles.card, styles.centerCard, { borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.card }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.processingTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
              Extracting passport data…
            </Text>
            <Text style={[styles.processingSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              This usually takes a few seconds.
            </Text>
          </View>
        ) : null}

        {step === "assign" && passport ? (
          <View style={styles.assignBlock}>
            <View style={[styles.successBanner, { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" }]}>
              <Feather name="check-circle" size={20} color="#059669" />
              <View style={styles.successTextWrap}>
                <Text style={[styles.successTitle, { fontFamily: theme.fonts.sansSemibold }]}>Extraction complete</Text>
                <Text style={[styles.successSub, { fontFamily: theme.fonts.sans }]}>
                  {passport.fullName ?? "—"} · {passport.passportNumber ?? "—"}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.card }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
                Extracted details
              </Text>
              <View style={styles.infoGrid}>
                <InfoField label="Date of birth" value={passport.dateOfBirth} />
                <InfoField label="Expiry" value={passport.dateOfExpiry} />
                <InfoField label="Nationality" value={passport.nationality} />
                <InfoField label="Issue date" value={passport.dateOfIssue} />
                <InfoField label="Emergency contact" value={passport.emergencyContactName} />
                <InfoField label="Emergency phone" value={passport.emergencyContactPhone} />
              </View>

              {!hideCompanyPicker ? (
                <View style={styles.companyBlock}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
                    Company *
                  </Text>
                  <Pressable
                    onPress={openCompanyPicker}
                    style={[styles.companyPicker, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  >
                    <Feather name="briefcase" size={16} color={theme.colors.primary} />
                    <Text
                      numberOfLines={1}
                      style={[styles.companyPickerText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}
                    >
                      {companyLabel}
                    </Text>
                    <Feather name="chevron-down" size={16} color={theme.colors.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.assignActions}>
                <Button variant="outline" onPress={reset} style={styles.flexBtn}>
                  Start over
                </Button>
                <Button onPress={() => void handleSave()} loading={saving} style={styles.flexBtn}>
                  Save to master list
                </Button>
              </View>
            </View>
          </View>
        ) : null}

        {step === "done" ? (
          <View style={[styles.card, styles.centerCard, { borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.card }]}>
            <Feather name="check-circle" size={48} color="#059669" />
            <Text style={[styles.doneTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
              Candidate added
            </Text>
            <Text style={[styles.doneSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              The passport record and Letter of Appointment are now in the master list.
            </Text>
            <View style={styles.doneActions}>
              {createdLoaId != null ? (
                <Button onPress={() => openLoaView(createdLoaId)} style={styles.flexBtn}>
                  View LOA
                </Button>
              ) : null}
              <Button onPress={() => router.push("/(tabs)/master")} style={styles.flexBtn}>
                Open master list
              </Button>
              <Button variant="outline" onPress={reset} style={styles.flexBtn}>
                Upload another
              </Button>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 2,
  },
  stepItem: { flex: 1, alignItems: "center", gap: 6 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontSize: 12, fontWeight: "700" },
  stepLabel: { fontSize: 10, textAlign: "center" },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  centerCard: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  dropZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  dropIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dropTitle: { fontSize: 17 },
  dropSub: { fontSize: 13, textAlign: "center" },
  pickRow: { flexDirection: "row", gap: 8 },
  pickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  pickBtnText: { fontSize: 12 },
  fileCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  pdfPreview: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fileMeta: { gap: 2 },
  fileName: { fontSize: 14 },
  fileSize: { fontSize: 12 },
  fileActions: { flexDirection: "row", gap: 10 },
  processingTitle: { fontSize: 17, marginTop: 8 },
  processingSub: { fontSize: 13, textAlign: "center" },
  assignBlock: { gap: 12 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  successTextWrap: { flex: 1, gap: 2 },
  successTitle: { fontSize: 15, color: "#065f46" },
  successSub: { fontSize: 13, color: "#047857" },
  sectionTitle: { fontSize: 15 },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoField: {
    width: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 13 },
  companyBlock: { gap: 8, marginTop: 4 },
  companyPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  companyPickerText: { flex: 1, fontSize: 14 },
  assignActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  flexBtn: { flex: 1 },
  doneTitle: { fontSize: 22, marginTop: 8 },
  doneSub: { fontSize: 14, textAlign: "center" },
  doneActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, width: "100%" },
});
