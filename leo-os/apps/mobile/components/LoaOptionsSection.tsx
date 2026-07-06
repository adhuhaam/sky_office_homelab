import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListLoaOptionsQueryKey,
  useCreateLoaOption,
  useDeleteLoaOption,
  useListLoaOptions,
  useUpdateLoaOption,
  type LoaOption,
} from "@leo/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  { category: "job_title" as const, label: "Job titles", placeholder: "e.g. Construction Worker" },
  { category: "work_type" as const, label: "Work types", placeholder: "e.g. Manual Labour" },
  { category: "work_site" as const, label: "Work sites", placeholder: "e.g. Guraidhoo, Maldives" },
];

function OptionGroup({
  companyId,
  category,
  label,
  placeholder,
}: {
  companyId: number;
  category: "job_title" | "work_type" | "work_site";
  label: string;
  placeholder: string;
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: options = [], isLoading } = useListLoaOptions(
    { companyId, category },
    { query: { queryKey: getListLoaOptionsQueryKey({ companyId, category }) } },
  );

  const createMutation = useCreateLoaOption();
  const updateMutation = useUpdateLoaOption();
  const deleteMutation = useDeleteLoaOption();

  async function addOption() {
    const v = value.trim();
    if (!v) return;
    try {
      await createMutation.mutateAsync({
        data: { companyId, category, value: v },
      });
      setValue("");
      await qc.invalidateQueries({ queryKey: getListLoaOptionsQueryKey({ companyId, category }) });
    } catch {
      Alert.alert("Error", "Could not add option.");
    }
  }

  async function saveEdit(id: number) {
    const v = editValue.trim();
    if (!v) return;
    try {
      await updateMutation.mutateAsync({ id, data: { value: v } });
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: getListLoaOptionsQueryKey({ companyId, category }) });
    } catch {
      Alert.alert("Error", "Could not update option.");
    }
  }

  function confirmDelete(opt: LoaOption) {
    Alert.alert("Delete option?", opt.value, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: opt.id });
            await qc.invalidateQueries({ queryKey: getListLoaOptionsQueryKey({ companyId, category }) });
          } catch {
            Alert.alert("Error", "Could not delete option.");
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.group, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.groupTitle, { color: colors.foreground }]}>{label}</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
      ) : (
        <View style={styles.optionList}>
          {(options as LoaOption[]).map((opt) =>
            editingId === opt.id ? (
              <View key={opt.id} style={styles.editRow}>
                <TextInput
                  value={editValue}
                  onChangeText={setEditValue}
                  autoFocus
                  style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
                />
                <Pressable onPress={() => saveEdit(opt.id)} style={[styles.iconBtn, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={16} color={colors.primaryForeground} />
                </Pressable>
                <Pressable
                  onPress={() => setEditingId(null)}
                  style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
                >
                  <Feather name="x" size={16} color={colors.foreground} />
                </Pressable>
              </View>
            ) : (
              <View key={opt.id} style={[styles.optionRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.optionText, { color: colors.foreground }]}>{opt.value}</Text>
                <Pressable
                  onPress={() => {
                    setEditingId(opt.id);
                    setEditValue(opt.value);
                  }}
                  hitSlop={8}
                >
                  <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(opt)} hitSlop={8}>
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </Pressable>
              </View>
            ),
          )}
        </View>
      )}
      <View style={styles.addRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={() => void addOption()}
          style={[styles.addInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        <Pressable
          onPress={() => void addOption()}
          disabled={!value.trim() || createMutation.isPending}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: colors.primary,
              opacity: !value.trim() || createMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

export function LoaOptionsSection({ companyId }: { companyId: number }) {
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Feather name="file-text" size={16} color={colors.mutedForeground} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>LOA options</Text>
      </View>
      <Text style={[styles.headerHint, { color: colors.mutedForeground }]}>
        Presets for job titles, work types, and sites when creating letters of appointment.
      </Text>
      {CATEGORIES.map((cfg) => (
        <OptionGroup key={cfg.category} companyId={companyId} {...cfg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: "600" },
  headerHint: { fontSize: 12, lineHeight: 17, marginTop: -4 },
  group: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  groupTitle: { fontSize: 13, fontWeight: "600" },
  optionList: { gap: 0 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: { flex: 1, fontSize: 14 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
