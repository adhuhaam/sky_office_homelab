import { Feather } from "@expo/vector-icons";
import {
  type Expense,
  type ExpenseCategory,
  getListExpenseCategoriesQueryKey,
  getListExpensesQueryKey,
  type ListExpensesParams,
  useListExpenseCategories,
  useListExpenses,
} from "@leo/api-client-react";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/PageHeader";
import { useTheme } from "@/hooks/useTheme";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { fmtMVR } from "@/lib/currency";
import { pageLayoutStyles } from "@/lib/page-layout-styles";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

function SummaryBanner({ count, total }: { count: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.summaryBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Text style={[styles.summaryLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansMedium }]}>
        Expenses
      </Text>
      <Text style={[styles.summaryAmount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
        {fmtMVR(total)}
      </Text>
      <Text style={[styles.summaryMeta, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
        {count} record{count !== 1 ? "s" : ""}
      </Text>
    </View>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.card,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: active ? theme.colors.primaryForeground : theme.colors.foreground,
            fontFamily: theme.fonts.sansSemibold,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ExpenseRow({
  expense,
  onPress,
}: {
  expense: Expense;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordRow,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.rowCategory, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
          {expense.categoryName}
        </Text>
        {expense.remarks ? (
          <Text
            style={[styles.rowRemarks, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}
            numberOfLines={1}
          >
            {expense.remarks}
          </Text>
        ) : null}
        {expense.expenseDate ? (
          <Text style={[styles.rowDate, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
            {fmtDate(expense.expenseDate)}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowAmount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
        {fmtMVR(Number(expense.amount) || 0)}
      </Text>
    </Pressable>
  );
}

export default function ExpensesScreen() {
  const theme = useTheme();
  const tabBarInset = useTabBarInset();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");

  const params = useMemo<ListExpensesParams>(() => {
    const p: ListExpensesParams = {};
    if (search.trim()) p.search = search.trim();
    if (categoryId !== "all") p.categoryId = categoryId;
    return p;
  }, [search, categoryId]);

  const { data, isLoading, isError, error, refetch, isFetching } = useListExpenses(params, {
    query: { queryKey: getListExpensesQueryKey(params) },
  });

  const { data: categories = [] } = useListExpenseCategories({
    query: { queryKey: getListExpenseCategoriesQueryKey() },
  });

  const expenses = (data ?? []) as Expense[];
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const listHeader = (
    <View style={pageLayoutStyles.headerBlock}>
      <PageHeader
        brandIcon="credit-card"
        brandLabel="EXPENSES"
        title="Company expenses"
        subtitle="Track and manage expense records"
        action={
          <Button onPress={() => router.push("/expense/new" as never)} style={pageLayoutStyles.addBtn}>
            <Feather name="plus" size={16} color={theme.colors.primaryForeground} />
          </Button>
        }
      />

      <SummaryBanner count={expenses.length} total={total} />

      <View style={[pageLayoutStyles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <Feather name="search" size={16} color={theme.colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search remarks or amount…"
          placeholderTextColor={theme.colors.mutedForeground}
          style={[pageLayoutStyles.searchInput, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={theme.colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <CategoryChip label="All" active={categoryId === "all"} onPress={() => setCategoryId("all")} />
        {(categories as ExpenseCategory[]).map((c) => (
          <CategoryChip
            key={c.id}
            label={c.name}
            active={categoryId === c.id}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[pageLayoutStyles.safe, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      {isLoading && expenses.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Feather name="alert-triangle" size={28} color={theme.colors.destructive} />
          <Text style={[styles.errorText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
            {error instanceof Error ? error.message : "Failed to load"}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.retryText, { color: theme.colors.primaryForeground, fontFamily: theme.fonts.sansSemibold }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={[pageLayoutStyles.list, { paddingBottom: tabBarInset, gap: 10 }]}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={[pageLayoutStyles.tableEmpty, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <Feather name="credit-card" size={24} color={theme.colors.mutedForeground} />
              <Text style={[pageLayoutStyles.emptyText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                No expenses yet — tap + to log your first expense.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ExpenseRow expense={item} onPress={() => router.push(`/expense/${item.id}` as never)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  summaryLabel: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.35 },
  summaryAmount: { fontSize: 26, letterSpacing: -0.4 },
  summaryMeta: { fontSize: 12 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13 },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowCategory: { fontSize: 15 },
  rowRemarks: { fontSize: 12 },
  rowDate: { fontSize: 11 },
  rowAmount: { fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
});
