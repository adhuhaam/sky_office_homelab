import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPasswordsQueryKey,
  type ListPasswordsParams,
  type Password,
  useListPasswords,
  useUpdatePassword,
} from "@leo/api-client-react";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface FormState {
  efaasUsername: string;
  efaasPassword: string;
  gmailUsername: string;
  gmailPassword: string;
}

const EMPTY_FORM: FormState = {
  efaasUsername: "",
  efaasPassword: "",
  gmailUsername: "",
  gmailPassword: "",
};

const AVATAR_PALETTE = [
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#E0F2FE", fg: "#0369A1" },
  { bg: "#EDE9FE", fg: "#6D28D9" },
  { bg: "#FCE7F3", fg: "#BE185D" },
];

function colorFor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initialsFor(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function maskPassword(value: string) {
  return "•".repeat(Math.min(Math.max(value.length, 6), 14));
}

function isFilled(entry: Password) {
  return Boolean(
    entry.efaasUsername ||
      entry.efaasPassword ||
      entry.gmailUsername ||
      entry.gmailPassword,
  );
}

export default function PasswordsScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Password | null>(null);

  const params = useMemo<ListPasswordsParams>(() => {
    const p: ListPasswordsParams = {};
    if (search.trim()) p.search = search.trim();
    return p;
  }, [search]);

  const { data, isLoading, isError, error, refetch, isFetching } = useListPasswords(
    params,
    { query: { queryKey: getListPasswordsQueryKey(params) } },
  );

  const entries = (data ?? []) as Password[];
  const qc = useQueryClient();
  const filledCount = useMemo(() => entries.filter(isFilled).length, [entries]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListPasswordsQueryKey() });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.statsRow}>
        <StatCard label="Companies" value={entries.length} colors={colors} />
        <StatCard label="Configured" value={filledCount} colors={colors} />
      </View>

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company or username"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Feather name="alert-triangle" size={28} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            {error instanceof Error ? error.message : "Failed to load"}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={
            entries.length === 0 ? styles.emptyContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.primary + "22" },
                ]}
              >
                <Feather name="key" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No matches" : "No companies yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search
                  ? "Try a different search term."
                  : "Add a company first — a blank password record is created automatically."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CompanyPasswordCard
              entry={item}
              onEdit={() => setEditing(item)}
            />
          )}
        />
      )}

      <PasswordFormModal
        entry={editing}
        visible={editing != null}
        onClose={() => setEditing(null)}
        onSaved={invalidate}
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function CompanyPasswordCard({
  entry,
  onEdit,
}: {
  entry: Password;
  onEdit: () => void;
}) {
  const colors = useColors();
  const palette = colorFor(entry.companyName.toLowerCase());

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.companyAvatar, { backgroundColor: palette.bg }]}>
          <Text style={[styles.companyAvatarText, { color: palette.fg }]}>
            {initialsFor(entry.companyName)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.companyName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {entry.companyName}
          </Text>
          <Text style={[styles.companyMeta, { color: colors.mutedForeground }]}>
            {isFilled(entry) ? "Credentials configured" : "Not configured yet"}
          </Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
          accessibilityLabel="Edit credentials"
        >
          <Feather name="edit-2" size={15} color={colors.foreground} />
        </Pressable>
      </View>

      <CredentialBlock
        title="Efaas"
        username={entry.efaasUsername}
        password={entry.efaasPassword}
      />
      <CredentialBlock
        title="Gmail"
        username={entry.gmailUsername}
        password={entry.gmailPassword}
      />
    </View>
  );
}

function CredentialBlock({
  title,
  username,
  password,
}: {
  title: string;
  username: string;
  password: string;
}) {
  const colors = useColors();
  const [revealed, setRevealed] = useState(false);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} copied to clipboard.`);
  };

  return (
    <View
      style={[
        styles.credentialBlock,
        { backgroundColor: colors.muted + "55", borderColor: colors.border },
      ]}
    >
      <Text style={[styles.credentialTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <FieldRow
        label="Username"
        value={username || "—"}
        onCopy={username ? () => copy(username, "Username") : undefined}
      />
      <FieldRow
        label="Password"
        value={password ? (revealed ? password : maskPassword(password)) : "—"}
        mono={Boolean(password)}
        onCopy={password ? () => copy(password, "Password") : undefined}
        extra={
          password ? (
            <Pressable onPress={() => setRevealed((r) => !r)} hitSlop={10} style={styles.iconBtn}>
              <Feather
                name={revealed ? "eye-off" : "eye"}
                size={16}
                color={colors.primary}
              />
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

function FieldRow({
  label,
  value,
  mono,
  onCopy,
  extra,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  extra?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.fieldValueRow}>
        <Text
          style={[
            styles.fieldValue,
            mono && styles.mono,
            { color: colors.foreground },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {extra}
        {onCopy && (
          <Pressable onPress={onCopy} hitSlop={10} style={styles.iconBtn}>
            <Feather name="copy" size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PasswordFormModal({
  entry,
  visible,
  onClose,
  onSaved,
}: {
  entry: Password | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useColors();
  const updateMutation = useUpdatePassword();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showEfaasPassword, setShowEfaasPassword] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);

  useEffect(() => {
    if (!visible || !entry) return;
    setForm({
      efaasUsername: entry.efaasUsername,
      efaasPassword: entry.efaasPassword,
      gmailUsername: entry.gmailUsername,
      gmailPassword: entry.gmailPassword,
    });
    setShowEfaasPassword(false);
    setShowGmailPassword(false);
  }, [visible, entry?.id]);

  const handleSave = () => {
    if (!entry) return;
    updateMutation.mutate(
      {
        id: entry.id,
        data: {
          efaasUsername: form.efaasUsername.trim(),
          efaasPassword: form.efaasPassword,
          gmailUsername: form.gmailUsername.trim(),
          gmailPassword: form.gmailPassword,
        },
      },
      {
        onSuccess: () => {
          onSaved();
          onClose();
        },
        onError: () => Alert.alert("Failed to update"),
      },
    );
  };

  if (!entry) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.modalCancel, { color: colors.primary }]}>
              Cancel
            </Text>
          </Pressable>
          <Text
            style={[styles.modalTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {entry.companyName}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={updateMutation.isPending}
            hitSlop={10}
          >
            <Text
              style={[
                styles.modalSave,
                { color: colors.primary, opacity: updateMutation.isPending ? 0.4 : 1 },
              ]}
            >
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalBody}
          keyboardShouldPersistTaps="handled"
        >
          <CredentialFormSection
            title="Efaas"
            username={form.efaasUsername}
            password={form.efaasPassword}
            showPassword={showEfaasPassword}
            onTogglePassword={() => setShowEfaasPassword((v) => !v)}
            onUsernameChange={(v) => setForm((s) => ({ ...s, efaasUsername: v }))}
            onPasswordChange={(v) => setForm((s) => ({ ...s, efaasPassword: v }))}
          />
          <CredentialFormSection
            title="Gmail"
            username={form.gmailUsername}
            password={form.gmailPassword}
            showPassword={showGmailPassword}
            onTogglePassword={() => setShowGmailPassword((v) => !v)}
            onUsernameChange={(v) => setForm((s) => ({ ...s, gmailUsername: v }))}
            onPasswordChange={(v) => setForm((s) => ({ ...s, gmailPassword: v }))}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CredentialFormSection({
  title,
  username,
  password,
  showPassword,
  onTogglePassword,
  onUsernameChange,
  onPasswordChange,
}: {
  title: string;
  username: string;
  password: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.formSection,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <Text style={[styles.formSectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <FormField
        label="Username"
        value={username}
        onChangeText={onUsernameChange}
        placeholder="Username or email"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
          Password
        </Text>
        <View
          style={[
            styles.passwordInputRow,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <TextInput
            value={password}
            onChangeText={onPasswordChange}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.passwordInput, { color: colors.foreground }]}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={onTogglePassword} hitSlop={8}>
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FormField({
  label,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const colors = useColors();
  return (
    <View style={styles.formField}>
      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  statValue: { fontSize: 22, lineHeight: 26 },
  statLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  listContent: { padding: 16, paddingBottom: 32, gap: 12 },
  emptyContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  emptyBox: { alignItems: "center", gap: 12, paddingVertical: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  companyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  companyAvatarText: { fontSize: 13 },
  companyName: { fontSize: 16 },
  companyMeta: { fontSize: 12, marginTop: 2 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  credentialBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  credentialTitle: { fontSize: 14, fontWeight: "600" },
  fieldBlock: { gap: 4 },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fieldValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldValue: { flex: 1, fontSize: 14 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  iconBtn: { padding: 6, borderRadius: 6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 17 },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  modalTitle: { fontSize: 16, flex: 1, textAlign: "center" },
  modalCancel: { fontSize: 15, width: 56 },
  modalSave: { fontSize: 15, width: 56, textAlign: "right" },
  modalBody: { padding: 16, gap: 14 },
  formSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  formSectionTitle: { fontSize: 15, fontWeight: "600" },
  formField: { gap: 6 },
  formLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
});
