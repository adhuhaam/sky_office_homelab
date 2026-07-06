import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import type { Client, Company, Passport, PassportStatus } from "@leo/api-client-react";
import {
  getGetPassportQueryKey,
  getGetXpatWorkPermitQueryKey,
  getListClientsQueryKey,
  getListCompaniesQueryKey,
  getListPassportsQueryKey,
  useDeletePassport,
  useGetPassport,
  useGetXpatWorkPermit,
  useListClients,
  useListCompanies,
  useUpdatePassport,
} from "@leo/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthenticatedApiImage } from "@/components/AuthenticatedApiImage";
import { KeyboardForm } from "@/components/KeyboardAvoid";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/theme";
import { buildXpatCardUrl, buildXpatPhotoUrl, parseXpatPhotoParams } from "@/lib/xpat";

// ─── Status definitions ──────────────────────────────────────────────────────

type StatusMeta = {
  label: string;
  bg: string;
  text: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const STATUS_LIST: PassportStatus[] = [
  "processing",
  "completed",
  "failed",
  "applied",
  "approved",
  "ticket_issued",
  "arrived",
  "handedover",
  "return_back_from_worksite",
  "incomplete",
  "cancelled",
  "terminated",
  "lost",
  "employed",
];

const STATUS_META: Record<PassportStatus, StatusMeta> = {
  processing: { label: "Processing", bg: "#EFF6FF", text: "#1D4ED8", icon: "loader" },
  completed: { label: "OCR Done", bg: "#F0FDF4", text: "#15803D", icon: "check-circle" },
  failed: { label: "OCR Failed", bg: "#FEF2F2", text: "#DC2626", icon: "alert-octagon" },
  applied: { label: "Applied", bg: "#FAF5FF", text: "#7C3AED", icon: "send" },
  approved: { label: "Approved", bg: "#F0FDF4", text: "#166534", icon: "check-square" },
  ticket_issued: { label: "Ticket Issued", bg: "#ECFEFF", text: "#0E7490", icon: "credit-card" },
  arrived: { label: "Arrived", bg: "#ECFDF5", text: "#065F46", icon: "map-pin" },
  handedover: { label: "Handed Over", bg: "#EEF2FF", text: "#4338CA", icon: "user-check" },
  return_back_from_worksite: { label: "Returned", bg: "#FFF7ED", text: "#C2410C", icon: "corner-up-left" },
  incomplete: { label: "Incomplete", bg: "#FEFCE8", text: "#A16207", icon: "alert-triangle" },
  cancelled: { label: "Cancelled", bg: "#F8FAFC", text: "#475569", icon: "x-circle" },
  terminated: { label: "Terminated", bg: "#FFF1F2", text: "#BE123C", icon: "slash" },
  lost: { label: "Lost", bg: "#FEF2F2", text: "#991B1B", icon: "help-circle" },
  employed: { label: "Employed", bg: "#F0FDF4", text: "#14532D", icon: "briefcase" },
};

function getStatusMeta(s: string): StatusMeta {
  return STATUS_META[s as PassportStatus] ?? { label: s, bg: "#F8FAFC", text: "#475569", icon: "circle" };
}

function fmtXpatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

// ─── Picker modal ─────────────────────────────────────────────────────────────

function PickerModal<T extends { id?: number }>({
  visible,
  title,
  items,
  selected,
  labelKey,
  onSelect,
  onClose,
  allowNone,
  noneLabel,
  searchPlaceholder,
}: {
  visible: boolean;
  title: string;
  items: T[];
  selected: string | number | null;
  labelKey: keyof T;
  onSelect: (item: T | null) => void;
  onClose: () => void;
  allowNone?: boolean;
  noneLabel?: string;
  searchPlaceholder?: string;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) => String(it[labelKey] ?? "").toLowerCase().includes(q));
  }, [items, search, labelKey]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={[pickerStyles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <View style={[pickerStyles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[pickerStyles.title, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={theme.colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[pickerStyles.searchWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Feather name="search" size={16} color={theme.colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder ?? "Search…"}
              placeholderTextColor={theme.colors.mutedForeground}
              style={[pickerStyles.searchInput, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item, i) => String(item.id ?? i)}
            style={{ maxHeight: 340 }}
            ListHeaderComponent={
              allowNone ? (
                <Pressable
                  onPress={() => {
                    onSelect(null);
                    onClose();
                    setSearch("");
                  }}
                  style={[
                    pickerStyles.option,
                    selected == null && { backgroundColor: theme.colors.secondary },
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <Text style={[pickerStyles.optionLabel, { color: theme.colors.mutedForeground, fontStyle: "italic", fontFamily: theme.fonts.sans }]}>
                    {noneLabel ?? "None"}
                  </Text>
                  {selected == null ? <Feather name="check" size={16} color={theme.colors.primary} /> : null}
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => {
              const label = String(item[labelKey] ?? "");
              const isSelected = String(item.id) === String(selected);
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                    setSearch("");
                  }}
                  style={[
                    pickerStyles.option,
                    isSelected && { backgroundColor: theme.colors.secondary },
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <Text style={[pickerStyles.optionLabel, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
                    {label}
                  </Text>
                  {isSelected ? <Feather name="check" size={16} color={theme.colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function StatusPickerModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (s: PassportStatus) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={[pickerStyles.sheet, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <View style={[pickerStyles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[pickerStyles.title, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
              Set Status
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={theme.colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 440 }}>
            {STATUS_LIST.map((s) => {
              const m = STATUS_META[s];
              const isSelected = s === current;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    onSelect(s);
                    onClose();
                  }}
                  style={[
                    pickerStyles.option,
                    isSelected && { backgroundColor: theme.colors.secondary },
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <View style={[pickerStyles.statusDot, { backgroundColor: m.bg }]}>
                    <Feather name={m.icon} size={14} color={m.text} />
                  </View>
                  <Text style={[pickerStyles.optionLabel, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
                    {m.label}
                  </Text>
                  {isSelected ? <Feather name="check" size={16} color={theme.colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { flex: 1, fontSize: 15 },
  statusDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ─── Form state ───────────────────────────────────────────────────────────────

type OcrField =
  | "fullName"
  | "passportNumber"
  | "dateOfBirth"
  | "dateOfIssue"
  | "dateOfExpiry"
  | "nationality"
  | "address"
  | "emergencyContactName"
  | "emergencyContactPhone";
const OCR_FIELDS: { key: OcrField; label: string; multiline?: boolean }[] = [
  { key: "fullName", label: "Full name" },
  { key: "passportNumber", label: "Passport number" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "dateOfIssue", label: "Date of issue" },
  { key: "dateOfExpiry", label: "Date of expiry" },
  { key: "nationality", label: "Nationality" },
  { key: "address", label: "Address", multiline: true },
  { key: "emergencyContactName", label: "Emergency contact name" },
  { key: "emergencyContactPhone", label: "Emergency contact phone" },
];

interface FormState {
  fullName: string;
  passportNumber: string;
  dateOfBirth: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  nationality: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: string;
  companyId: number | null;
  clientId: number | null;
  workPermitNumber: string;
  agent: string;
  agencySalary: string;
  clientSalary: string;
  agentRate: string;
  employeeType: string;
}

type EmployeeTypeOption = { value: string; label: string; detail: string };
const EMPLOYEE_TYPES: EmployeeTypeOption[] = [
  { value: "casual", label: "Casual", detail: "Profit = billing − salary" },
  { value: "recruitment", label: "Recruitment", detail: "Profit = agent amt − client rate" },
  { value: "organization_employed", label: "Org. Employed", detail: "Profit = amount billed" },
];

function toForm(p: Passport): FormState {
  return {
    fullName: p.fullName ?? "",
    passportNumber: p.passportNumber ?? "",
    dateOfBirth: p.dateOfBirth ?? "",
    dateOfIssue: p.dateOfIssue ?? "",
    dateOfExpiry: p.dateOfExpiry ?? "",
    nationality: p.nationality ?? "",
    address: p.address ?? "",
    emergencyContactName: p.emergencyContactName ?? "",
    emergencyContactPhone: p.emergencyContactPhone ?? "",
    status: p.status ?? "processing",
    companyId: p.companyId ?? null,
    clientId: p.clientId ?? null,
    workPermitNumber: p.workPermitNumber ?? "",
    agent: p.agent ?? "",
    agencySalary: p.agencySalary ?? "",
    clientSalary: p.clientSalary ?? "",
    agentRate: p.agentRate ?? "",
    employeeType: p.employeeType ?? "casual",
  };
}

const EMPTY_FORM: FormState = {
  fullName: "",
  passportNumber: "",
  dateOfBirth: "",
  dateOfIssue: "",
  dateOfExpiry: "",
  nationality: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  status: "processing",
  companyId: null,
  clientId: null,
  workPermitNumber: "",
  agent: "",
  agencySalary: "",
  clientSalary: "",
  agentRate: "",
  employeeType: "casual",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PassportDetailScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [statusPicker, setStatusPicker] = useState(false);
  const [companyPicker, setCompanyPicker] = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const [cardModal, setCardModal] = useState(false);

  const { data, isLoading, isError, error, refetch } = useGetPassport(id, {
    query: {
      enabled: !Number.isNaN(id),
      queryKey: getGetPassportQueryKey(id),
      refetchInterval: (q) => {
        const p = q.state.data as Passport | undefined;
        return p?.status === "processing" ? 2000 : false;
      },
    },
  });

  const { data: companies = [] } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey() },
  });

  const { data: clients = [] } = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey() },
  });

  const updateMutation = useUpdatePassport();
  const deleteMutation = useDeletePassport();

  const xpatParams = {
    workPermitNumber: data?.workPermitNumber ?? "",
    passportNumber: data?.passportNumber ?? "",
  };
  const hasXpat = !!(data?.workPermitNumber && data?.passportNumber);
  const { data: xpat, isLoading: xpatLoading } = useGetXpatWorkPermit(xpatParams, {
    query: {
      enabled: hasXpat,
      staleTime: 15 * 60 * 1000,
      queryKey: getGetXpatWorkPermitQueryKey(xpatParams),
    },
  });

  const photoParams = xpat ? parseXpatPhotoParams(xpat.photoUrl) : null;
  const cardPath = hasXpat ? buildXpatCardUrl(data!.workPermitNumber!, data!.passportNumber!) : null;

  useEffect(() => {
    if (data && !dirty) setForm(toForm(data));
  }, [data, dirty]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const selectedCompany = useMemo(
    () => (companies as Company[]).find((c) => c.id === form.companyId) ?? null,
    [companies, form.companyId],
  );
  const selectedClient = useMemo(
    () => (clients as Client[]).find((c) => c.id === form.clientId) ?? null,
    [clients, form.clientId],
  );

  const statusMeta = getStatusMeta(form.status);

  function toggleEditing() {
    if (editing && dirty) {
      Alert.alert("Discard changes?", "You have unsaved edits.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            if (data) setForm(toForm(data));
            setDirty(false);
            setEditing(false);
          },
        },
      ]);
      return;
    }
    setEditing((v) => !v);
  }

  async function handleSave() {
    if (!data || !dirty) return;
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          fullName: form.fullName || undefined,
          passportNumber: form.passportNumber || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          dateOfIssue: form.dateOfIssue || undefined,
          dateOfExpiry: form.dateOfExpiry || undefined,
          address: form.address || undefined,
          emergencyContactName: form.emergencyContactName || null,
          emergencyContactPhone: form.emergencyContactPhone || null,
          nationality: form.nationality || undefined,
          status: form.status || undefined,
          companyId: form.companyId,
          clientId: form.clientId,
          workPermitNumber: form.workPermitNumber || null,
          agent: form.agent || null,
          agencySalary: form.agencySalary || null,
          clientSalary: form.clientSalary || null,
          agentRate: form.agentRate || null,
          employeeType: (form.employeeType || "casual") as "casual" | "recruitment" | "organization_employed",
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
      setDirty(false);
      setEditing(false);
      router.back();
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  function handleDelete() {
    Alert.alert("Delete record?", "This will permanently remove this passport record.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id });
            await queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
            router.back();
          } catch (err) {
            Alert.alert("Delete failed", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: "Employee" }} />
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: "Employee" }} />
        <Feather name="alert-triangle" size={28} color={theme.colors.destructive} />
        <Text style={[styles.errorText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
          {error instanceof Error ? error.message : "Record not found"}
        </Text>
        <Button onPress={() => refetch()}>Retry</Button>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: form.fullName || "Employee",
          headerRight: () => (
            <Pressable onPress={toggleEditing} hitSlop={10} style={{ paddingHorizontal: 4 }}>
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.sansSemibold, fontSize: 15 }}>
                {editing ? "Cancel" : "Edit"}
              </Text>
            </Pressable>
          ),
        }}
      />

      <StatusPickerModal
        visible={statusPicker}
        current={form.status}
        onSelect={(s) => setField("status", s)}
        onClose={() => setStatusPicker(false)}
      />

      <PickerModal<Company>
        visible={companyPicker}
        title="Select Company"
        items={companies as Company[]}
        selected={form.companyId}
        labelKey="name"
        allowNone
        noneLabel="No company"
        searchPlaceholder="Search companies…"
        onSelect={(c) => setField("companyId", c?.id ?? null)}
        onClose={() => setCompanyPicker(false)}
      />

      <PickerModal<Client>
        visible={clientPicker}
        title="Select Client"
        items={clients as Client[]}
        selected={form.clientId}
        labelKey="name"
        allowNone
        noneLabel="No client"
        searchPlaceholder="Search clients…"
        onSelect={(c) => setField("clientId", c?.id ?? null)}
        onClose={() => setClientPicker(false)}
      />

      {cardPath ? (
        <Modal visible={cardModal} animationType="fade" transparent onRequestClose={() => setCardModal(false)} statusBarTranslucent>
          <Pressable style={xpatStyles.cardModalOverlay} onPress={() => setCardModal(false)}>
            <View style={xpatStyles.cardModalInner}>
              <AuthenticatedApiImage path={cardPath} style={xpatStyles.cardModalImage} contentFit="contain" loadingHeight={260} />
              <Pressable onPress={() => setCardModal(false)} style={xpatStyles.cardModalClose} hitSlop={12}>
                <Feather name="x" size={20} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      <KeyboardForm center={false} contentContainerStyle={styles.container}>
        <HeroHeader
          theme={theme}
          form={form}
          statusMeta={statusMeta}
          photoParams={photoParams}
          xpatName={xpat?.fullName}
        />

        <Pressable
          onPress={() => editing && setStatusPicker(true)}
          disabled={!editing}
          style={({ pressed }) => [
            styles.statusCard,
            { backgroundColor: statusMeta.bg, borderColor: theme.colors.border, opacity: !editing ? 0.92 : pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.statusIconWrap, { backgroundColor: "rgba(0,0,0,0.06)" }]}>
            <Feather name={statusMeta.icon} size={18} color={statusMeta.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: statusMeta.text, fontFamily: theme.fonts.sansSemibold }]}>
              {statusMeta.label}
            </Text>
            <Text style={[styles.statusHint, { color: statusMeta.text, opacity: 0.7, fontFamily: theme.fonts.sans }]}>
              {editing ? "Tap to change status" : "Status"}
            </Text>
          </View>
          {editing ? <Feather name="chevron-right" size={18} color={statusMeta.text} style={{ opacity: 0.6 }} /> : null}
        </Pressable>

        <SectionHeader label="Passport Data" icon="file-text" theme={theme} />

        {OCR_FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              {field.label.toUpperCase()}
            </Text>
            {editing ? (
              <TextInput
                value={form[field.key]}
                onChangeText={(v) => setField(field.key, v)}
                placeholder={data.status === "processing" ? "Extracting…" : `Enter ${field.label.toLowerCase()}`}
                placeholderTextColor={theme.colors.mutedForeground}
                multiline={field.multiline}
                autoCapitalize={field.key === "passportNumber" ? "characters" : "words"}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.card,
                    color: theme.colors.foreground,
                    borderColor: theme.colors.border,
                    fontFamily: theme.fonts.sans,
                    minHeight: field.multiline ? 80 : 48,
                    textAlignVertical: field.multiline ? "top" : "center",
                  },
                ]}
              />
            ) : (
              <ReadOnlyValue value={form[field.key]} theme={theme} multiline={field.multiline} />
            )}
          </View>
        ))}

        <SectionHeader label="Operational" icon="briefcase" theme={theme} />

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>COMPANY</Text>
          {editing ? (
            <Pressable
              onPress={() => setCompanyPicker(true)}
              style={({ pressed }) => [
                styles.selectRow,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.selectText,
                  { color: selectedCompany ? theme.colors.foreground : theme.colors.mutedForeground, fontFamily: theme.fonts.sans },
                ]}
                numberOfLines={1}
              >
                {selectedCompany?.name ?? "Select company…"}
              </Text>
              <Feather name="chevron-down" size={16} color={theme.colors.mutedForeground} />
            </Pressable>
          ) : (
            <ReadOnlyValue value={selectedCompany?.name ?? "No company"} theme={theme} />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
            CLIENT / EMPLOYER
          </Text>
          {editing ? (
            <Pressable
              onPress={() => setClientPicker(true)}
              style={({ pressed }) => [
                styles.selectRow,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.selectText,
                  { color: selectedClient ? theme.colors.foreground : theme.colors.mutedForeground, fontFamily: theme.fonts.sans },
                ]}
                numberOfLines={1}
              >
                {selectedClient?.name ?? "Select client…"}
              </Text>
              <Feather name="chevron-down" size={16} color={theme.colors.mutedForeground} />
            </Pressable>
          ) : (
            <ReadOnlyValue value={selectedClient?.name ?? "No client"} theme={theme} />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
            WORK PERMIT NUMBER
          </Text>
          {editing ? (
            <TextInput
              value={form.workPermitNumber}
              onChangeText={(v) => setField("workPermitNumber", v)}
              placeholder="e.g. WP-123456"
              placeholderTextColor={theme.colors.mutedForeground}
              autoCapitalize="characters"
              style={[
                styles.input,
                { backgroundColor: theme.colors.card, color: theme.colors.foreground, borderColor: theme.colors.border, fontFamily: theme.fonts.sans, minHeight: 48 },
              ]}
            />
          ) : (
            <ReadOnlyValue value={form.workPermitNumber} theme={theme} />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>AGENT</Text>
          {editing ? (
            <TextInput
              value={form.agent}
              onChangeText={(v) => setField("agent", v)}
              placeholder="Agent name"
              placeholderTextColor={theme.colors.mutedForeground}
              autoCapitalize="words"
              style={[
                styles.input,
                { backgroundColor: theme.colors.card, color: theme.colors.foreground, borderColor: theme.colors.border, fontFamily: theme.fonts.sans, minHeight: 48 },
              ]}
            />
          ) : (
            <ReadOnlyValue value={form.agent} theme={theme} />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>EMPLOYEE TYPE</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {EMPLOYEE_TYPES.map((opt) => {
              const active = form.employeeType === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => editing && setField("employeeType", opt.value)}
                  disabled={!editing}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    alignItems: "center",
                    backgroundColor: active ? theme.colors.primary + "18" : theme.colors.card,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    opacity: editing ? 1 : 0.85,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: active ? theme.fonts.sansBold : theme.fonts.sans,
                      color: active ? theme.colors.primary : theme.colors.foreground,
                      textAlign: "center",
                    }}
                  >
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 9, color: theme.colors.mutedForeground, textAlign: "center", marginTop: 2, fontFamily: theme.fonts.sans }}>
                    {opt.detail}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {form.employeeType !== "recruitment" ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              EMPLOYEE SALARY (MVR / day)
            </Text>
            {editing ? (
              <TextInput
                value={form.agencySalary}
                onChangeText={(v) => setField("agencySalary", v)}
                placeholder="0.00"
                placeholderTextColor={theme.colors.mutedForeground}
                keyboardType="decimal-pad"
                returnKeyType="done"
                style={[
                  styles.input,
                  { backgroundColor: theme.colors.card, color: theme.colors.foreground, borderColor: theme.colors.border, fontFamily: theme.fonts.sans, minHeight: 48 },
                ]}
              />
            ) : (
              <ReadOnlyValue value={form.agencySalary ? `${form.agencySalary} MVR` : null} theme={theme} />
            )}
          </View>
        ) : null}

        {form.employeeType === "recruitment" ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              AGENT AMOUNT (MVR, one-time)
            </Text>
            {editing ? (
              <>
                <TextInput
                  value={form.agentRate}
                  onChangeText={(v) => setField("agentRate", v)}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.mutedForeground}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  style={[
                    styles.input,
                    { backgroundColor: theme.colors.card, color: theme.colors.foreground, borderColor: theme.colors.border, fontFamily: theme.fonts.sans, minHeight: 48 },
                  ]}
                />
                <Text style={{ fontSize: 10, color: theme.colors.mutedForeground, marginTop: 3, fontFamily: theme.fonts.sans }}>
                  One-time recruitment fee received from the client — used as the revenue basis
                </Text>
              </>
            ) : (
              <ReadOnlyValue value={form.agentRate ? `${form.agentRate} MVR` : null} theme={theme} />
            )}
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
            {form.employeeType === "recruitment" ? "CLIENT RATE (MVR, one-time)" : "CLIENT BILLING RATE (MVR / day)"}
          </Text>
          {editing ? (
            <>
              <TextInput
                value={form.clientSalary}
                onChangeText={(v) => setField("clientSalary", v)}
                placeholder="0.00"
                placeholderTextColor={theme.colors.mutedForeground}
                keyboardType="decimal-pad"
                returnKeyType="done"
                style={[
                  styles.input,
                  { backgroundColor: theme.colors.card, color: theme.colors.foreground, borderColor: theme.colors.border, fontFamily: theme.fonts.sans, minHeight: 48 },
                ]}
              />
              <Text style={{ fontSize: 10, color: theme.colors.mutedForeground, marginTop: 3, fontFamily: theme.fonts.sans }}>
                What you charge the client — used as billing rate on invoices
              </Text>
            </>
          ) : (
            <ReadOnlyValue value={form.clientSalary ? `${form.clientSalary} MVR` : null} theme={theme} />
          )}
        </View>

        <MarginHint form={form} theme={theme} />

        {hasXpat ? (
          <>
            <SectionHeader label="Xpat Work Permit" icon="globe" theme={theme} />

            {xpatLoading && !xpat ? (
              <View style={xpatStyles.loadingRow}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[xpatStyles.loadingText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                  Fetching Xpat data…
                </Text>
              </View>
            ) : null}

            {xpat ? (
              <>
                <View style={[xpatStyles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {photoParams ? (
                    <AuthenticatedApiImage
                      path={buildXpatPhotoUrl(photoParams.photoId, photoParams.serviceId)}
                      style={xpatStyles.photo}
                      contentFit="cover"
                      loadingHeight={80}
                    />
                  ) : (
                    <View style={[xpatStyles.photoPlaceholder, { backgroundColor: theme.colors.secondary }]}>
                      <Feather name="user" size={28} color={theme.colors.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[xpatStyles.empName, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]} numberOfLines={2}>
                      {xpat.fullName ?? "—"}
                    </Text>
                    {xpat.occupationName ? (
                      <Text style={[xpatStyles.empSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]} numberOfLines={1}>
                        {xpat.occupationName}
                      </Text>
                    ) : null}
                    <View
                      style={[
                        xpatStyles.validBadge,
                        { backgroundColor: xpat.isValid?.toLowerCase() === "valid" ? "#DCFCE7" : "#FEE2E2" },
                      ]}
                    >
                      <Feather
                        name={xpat.isValid?.toLowerCase() === "valid" ? "check-circle" : "x-circle"}
                        size={12}
                        color={xpat.isValid?.toLowerCase() === "valid" ? "#15803D" : "#DC2626"}
                      />
                      <Text
                        style={[
                          xpatStyles.validText,
                          {
                            color: xpat.isValid?.toLowerCase() === "valid" ? "#15803D" : "#DC2626",
                            fontFamily: theme.fonts.sansMedium,
                          },
                        ]}
                      >
                        {xpat.workPermitStateName ?? xpat.isValid ?? "Unknown"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[xpatStyles.detailCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  {[
                    { label: "Employer", value: xpat.employerName },
                    { label: "Employer No.", value: xpat.employerNumber },
                    { label: "Contact", value: xpat.employerContactNumber },
                    { label: "Date of Birth", value: fmtXpatDate(xpat.dateOfBirth) },
                    { label: "Nationality", value: xpat.nationality },
                    { label: "Gender", value: xpat.gender },
                    { label: "Contact No.", value: xpat.contactNumber },
                    { label: "WP Issued", value: fmtXpatDate(xpat.workPermitIssuedDate) },
                    { label: "WP Expiry", value: fmtXpatDate(xpat.workPermitExpiry) },
                  ]
                    .filter((r) => r.value)
                    .map((row, i, arr) => (
                      <View
                        key={row.label}
                        style={[
                          xpatStyles.detailRow,
                          i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                        ]}
                      >
                        <Text style={[xpatStyles.detailLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                          {row.label}
                        </Text>
                        <Text style={[xpatStyles.detailValue, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]} numberOfLines={2}>
                          {row.value}
                        </Text>
                      </View>
                    ))}
                </View>

                {cardPath ? (
                  <View style={{ gap: 6 }}>
                    <Text style={[xpatStyles.cardLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                      WORK PERMIT CARD
                    </Text>
                    <Pressable
                      onPress={() => setCardModal(true)}
                      style={({ pressed }) => [xpatStyles.cardThumbWrap, { borderColor: theme.colors.border, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <AuthenticatedApiImage path={cardPath} style={xpatStyles.cardThumb} contentFit="contain" loadingHeight={120} />
                      <View style={[xpatStyles.cardOverlay, { backgroundColor: "rgba(0,0,0,0.32)" }]}>
                        <Feather name="maximize-2" size={18} color="#fff" />
                        <Text style={[xpatStyles.cardOverlayText, { fontFamily: theme.fonts.sans }]}>Tap to enlarge</Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {(data.originalFilename || data.errorMessage) && (
          <>
            <SectionHeader label="Details" icon="info" theme={theme} />
            {data.originalFilename ? <InfoRow label="Original file" value={data.originalFilename} theme={theme} /> : null}
            {data.errorMessage ? <InfoRow label="Error" value={data.errorMessage} theme={theme} isError /> : null}
          </>
        )}

        {editing ? (
          <>
            <Button onPress={handleSave} loading={updateMutation.isPending} disabled={!dirty} style={{ marginTop: 8 }}>
              Save changes
            </Button>
            <Button variant="outline" onPress={handleDelete} loading={deleteMutation.isPending}>
              Delete record
            </Button>
          </>
        ) : (
          <Button variant="outline" onPress={handleDelete} loading={deleteMutation.isPending} style={{ marginTop: 8 }}>
            Delete record
          </Button>
        )}
      </KeyboardForm>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function HeroHeader({
  theme,
  form,
  statusMeta,
  photoParams,
  xpatName,
}: {
  theme: Theme;
  form: FormState;
  statusMeta: StatusMeta;
  photoParams: ReturnType<typeof parseXpatPhotoParams>;
  xpatName?: string | null;
}) {
  return (
    <View style={[heroStyles.wrap, { borderColor: theme.colors.border }]}>
      <LinearGradient colors={[statusMeta.bg, theme.colors.card]} style={heroStyles.gradient}>
        {photoParams ? (
          <AuthenticatedApiImage
            path={buildXpatPhotoUrl(photoParams.photoId, photoParams.serviceId)}
            style={heroStyles.avatar}
            contentFit="cover"
            loadingHeight={64}
          />
        ) : (
          <View style={[heroStyles.avatarPlaceholder, { backgroundColor: statusMeta.bg, borderColor: statusMeta.text + "33" }]}>
            <Text style={[heroStyles.initials, { color: statusMeta.text, fontFamily: theme.fonts.sansBold }]}>
              {getInitials(form.fullName || xpatName)}
            </Text>
          </View>
        )}
        <View style={heroStyles.textBlock}>
          <Text style={[heroStyles.name, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]} numberOfLines={2}>
            {form.fullName || xpatName || "Unnamed candidate"}
          </Text>
          <Text style={[heroStyles.sub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.mono }]}>
            {form.passportNumber || "No passport #"}
          </Text>
          <View style={[heroStyles.badge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.text + "40" }]}>
            <Text style={[heroStyles.badgeText, { color: statusMeta.text, fontFamily: theme.fonts.sansSemibold }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function ReadOnlyValue({ value, theme, multiline }: { value?: string | null; theme: Theme; multiline?: boolean }) {
  return (
    <View style={[styles.readOnly, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border, minHeight: multiline ? 80 : 48 }]}>
      <Text
        style={[
          styles.readOnlyText,
          { color: value?.trim() ? theme.colors.foreground : theme.colors.mutedForeground, fontFamily: theme.fonts.sans },
        ]}
      >
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

function MarginHint({ form, theme }: { form: FormState; theme: Theme }) {
  const clientRate = Number(form.clientSalary || 0);
  if (clientRate <= 0) return null;

  if (form.employeeType === "recruitment") {
    const cost = Number(form.clientSalary || 0);
    const agentAmount = Number(form.agentRate || 0);
    const margin = agentAmount - cost;
    const color = margin > 0 ? "#059669" : margin < 0 ? "#DC2626" : theme.colors.mutedForeground;
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 12, color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }}>
          One-time profit (agent amount − client rate)
        </Text>
        <Text style={{ fontSize: 14, fontFamily: theme.fonts.sansBold, color }}>
          {margin >= 0 ? "+" : ""}
          {margin.toFixed(2)} MVR
        </Text>
      </View>
    );
  }

  if (form.employeeType === "casual") {
    const cost = Number(form.agencySalary || 0);
    const margin = clientRate - cost;
    const color = margin > 0 ? "#059669" : margin < 0 ? "#DC2626" : theme.colors.mutedForeground;
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: theme.colors.card,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 12, color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }}>
          Daily margin (billing − salary)
        </Text>
        <Text style={{ fontSize: 14, fontFamily: theme.fonts.sansBold, color }}>
          {margin >= 0 ? "+" : ""}
          {margin.toFixed(2)} MVR
        </Text>
      </View>
    );
  }

  return null;
}

function SectionHeader({ label, icon, theme }: { label: string; icon: React.ComponentProps<typeof Feather>["name"]; theme: Theme }) {
  return (
    <View style={[sectionHeaderStyles.row, { borderBottomColor: theme.colors.border }]}>
      <Feather name={icon} size={14} color={theme.colors.mutedForeground} />
      <Text style={[sectionHeaderStyles.text, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansSemibold }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, theme, isError }: { label: string; value: string; theme: Theme; isError?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 11, color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 13, color: isError ? theme.colors.destructive : theme.colors.foreground, lineHeight: 18, fontFamily: theme.fonts.sans }}>
        {value}
      </Text>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  gradient: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  avatar: { width: 64, height: 80, borderRadius: 10, backgroundColor: "#E2E8F0" },
  avatarPlaceholder: {
    width: 64,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 20 },
  textBlock: { flex: 1, gap: 4, minWidth: 0 },
  name: { fontSize: 17, letterSpacing: -0.2 },
  sub: { fontSize: 12 },
  badge: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  badgeText: { fontSize: 11 },
});

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 6,
  },
  text: { fontSize: 11, letterSpacing: 0.8 },
});

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 15 },
  statusHint: { fontSize: 11, marginTop: 1 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  readOnly: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  readOnlyText: { fontSize: 15 },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  selectText: { flex: 1, fontSize: 15 },
  errorText: { fontSize: 14, textAlign: "center" },
});

const xpatStyles = StyleSheet.create({
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13 },
  heroCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  photo: { width: 64, height: 80, borderRadius: 10, backgroundColor: "#E2E8F0" },
  photoPlaceholder: { width: 64, height: 80, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empName: { fontSize: 15, lineHeight: 20 },
  empSub: { fontSize: 13 },
  validBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 2,
  },
  validText: { fontSize: 12 },
  detailCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  detailLabel: { fontSize: 12, flex: 1 },
  detailValue: { fontSize: 13, flex: 2, textAlign: "right" },
  cardLabel: { fontSize: 11, letterSpacing: 0.5 },
  cardThumbWrap: { borderRadius: 12, borderWidth: 1, overflow: "hidden", height: 120 },
  cardThumb: { width: "100%", height: "100%" },
  cardOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 6 },
  cardOverlayText: { color: "#fff", fontSize: 12 },
  cardModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  cardModalInner: { width: "100%", position: "relative" },
  cardModalImage: { width: "100%", height: 260, borderRadius: 12 },
  cardModalClose: {
    position: "absolute",
    top: -14,
    right: -14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
