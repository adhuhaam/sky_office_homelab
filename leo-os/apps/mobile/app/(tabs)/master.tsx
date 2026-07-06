import { Feather } from "@expo/vector-icons";
import type { Passport } from "@leo/api-client-react";
import {
  getListPassportsQueryKey,
  useDeletePassport,
  useListPassports,
} from "@leo/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useTheme } from "@/hooks/useTheme";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/lib/auth";
import { pageLayoutStyles } from "@/lib/page-layout-styles";

const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  completed: "OCR Done",
  failed: "Failed",
  applied: "Applied",
  approved: "Approved",
  ticket_issued: "Ticket issued",
  arrived: "Arrived",
  handedover: "Handed over",
  return_back_from_worksite: "Returned",
  incomplete: "Incomplete",
  cancelled: "Cancelled",
  terminated: "Terminated",
  lost: "Lost",
  employed: "Employed",
};

const NATIONALITY_OPTIONS = [
  { value: "all", label: "All nationalities" },
  { value: "bangladesh", label: "Bangladesh" },
  { value: "india", label: "India" },
  { value: "nepal", label: "Nepal" },
] as const;

const STATUS_CHIP_OPTIONS = [
  { value: "all", label: "Total" },
  { value: "completed", label: "OCR Done" },
  { value: "processing", label: "Processing" },
  { value: "employed", label: "Employed" },
  { value: "failed", label: "Failed" },
] as const;

const NATIONALITY_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  bangladesh: { dot: "#16a34a", bg: "#dcfce7", text: "#166534", border: "#86efac" },
  india: { dot: "#ea580c", bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  nepal: { dot: "#2563eb", bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
};

type SortMode = "newest" | "name";
type ExpiryState = "expired" | "soon" | "ok" | null;

function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(month) - 1] ?? month} ${Number(day)}, ${year}`;
}

function getExpiryState(expiry: string | null | undefined): ExpiryState {
  if (!expiry) return null;
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "soon";
  return "ok";
}

function nationalityColors(key: string) {
  return NATIONALITY_COLORS[key] ?? { dot: "#64748b", bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
}

function statusColors(status: string) {
  if (status === "completed") return { bg: "#ccfbf1", text: "#0f766e", dot: "#14b8a6", border: "#99f6e4" };
  if (status === "processing") return { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6", border: "#93c5fd" };
  if (status === "employed") return { bg: "#d1fae5", text: "#047857", dot: "#10b981", border: "#6ee7b7" };
  if (status === "failed") return { bg: "#ffe4e6", text: "#be123c", dot: "#f43f5e", border: "#fecdd3" };
  return { bg: "#f1f5f9", text: "#475569", dot: "#64748b", border: "#e2e8f0" };
}

function NationalityChip({
  label,
  count,
  nationalityKey,
  active,
  onPress,
}: {
  label: string;
  count: number;
  nationalityKey: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = nationalityKey === "all" ? null : nationalityColors(nationalityKey);
  const accent = colors?.dot ?? theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? (colors?.bg ?? theme.colors.accent) : theme.colors.card,
          borderColor: active ? accent : theme.colors.border,
        },
        active && styles.filterChipActive,
      ]}
    >
      {nationalityKey !== "all" ? <View style={[styles.filterDot, { backgroundColor: accent }]} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.filterChipLabel, { color: colors?.text ?? theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}
      >
        {label}
      </Text>
      <View style={[styles.filterChipBadge, { backgroundColor: active ? accent : theme.colors.muted }]}>
        <Text style={[styles.filterChipBadgeText, { color: active ? "#ffffff" : theme.colors.mutedForeground }]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function MasterStatsRow({
  total,
  allocated,
  unallocated,
  expiring,
}: {
  total: number;
  allocated: number;
  unallocated: number;
  expiring: number;
}) {
  const theme = useTheme();

  return (
    <View style={styles.statsRow}>
      <View style={[styles.statPill, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
        <Text style={[styles.statPillValue, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>{total}</Text>
        <Text style={[styles.statPillLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>Total</Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" }]}>
        <Text style={[styles.statPillValue, { color: "#047857", fontFamily: theme.fonts.sansBold }]}>{allocated}</Text>
        <Text style={[styles.statPillLabel, { color: "#059669", fontFamily: theme.fonts.sans }]}>Allocated</Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: "#fff7ed", borderColor: "#fdba74" }]}>
        <Text style={[styles.statPillValue, { color: "#c2410c", fontFamily: theme.fonts.sansBold }]}>{unallocated}</Text>
        <Text style={[styles.statPillLabel, { color: "#ea580c", fontFamily: theme.fonts.sans }]}>Open</Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: expiring > 0 ? "#fef2f2" : theme.colors.muted, borderColor: expiring > 0 ? "#fecaca" : theme.colors.border }]}>
        <Text style={[styles.statPillValue, { color: expiring > 0 ? "#be123c" : theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>{expiring}</Text>
        <Text style={[styles.statPillLabel, { color: expiring > 0 ? "#e11d48" : theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>Expiry</Text>
      </View>
    </View>
  );
}

function ExpiryPill({ expiry }: { expiry: string | null | undefined }) {
  const state = getExpiryState(expiry);
  if (!state || state === "ok") return null;

  const isExpired = state === "expired";
  return (
    <View style={[styles.expiryPill, { backgroundColor: isExpired ? "#ffe4e6" : "#fffbeb", borderColor: isExpired ? "#fecdd3" : "#fde68a" }]}>
      <Feather name="alert-circle" size={10} color={isExpired ? "#be123c" : "#b45309"} />
      <Text style={[styles.expiryPillText, { color: isExpired ? "#be123c" : "#b45309", fontFamily: "Inter_600SemiBold" }]}>
        {isExpired ? "Expired" : "Expires soon"}
      </Text>
    </View>
  );
}

function CandidateAvatar({ name, status }: { name: string | null | undefined; status: string }) {
  const theme = useTheme();
  const colors = statusColors(status);
  return (
    <View style={[styles.avatar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.avatarText, { color: colors.text, fontFamily: theme.fonts.sansBold }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.statusBadgeText, { color: colors.text }]}>
        {(STATUS_LABELS[status] ?? status).toUpperCase()}
      </Text>
    </View>
  );
}

function StatusChip({
  label,
  count,
  statusKey,
  active,
  onPress,
}: {
  label: string;
  count: number;
  statusKey: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = statusKey === "all" ? null : statusColors(statusKey);
  const accent = colors?.dot ?? theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? (colors?.bg ?? theme.colors.accent) : theme.colors.card,
          borderColor: active ? accent : theme.colors.border,
        },
        active && styles.filterChipActive,
      ]}
    >
      {statusKey !== "all" ? <View style={[styles.filterDot, { backgroundColor: accent }]} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.filterChipLabel, { color: colors?.text ?? theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}
      >
        {label}
      </Text>
      <View style={[styles.filterChipBadge, { backgroundColor: active ? accent : theme.colors.muted }]}>
        <Text style={[styles.filterChipBadgeText, { color: active ? "#ffffff" : theme.colors.mutedForeground }]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function MasterSummaryBanner({
  statusFilter,
  total,
  filteredCount,
  statusLabel,
  statusKey,
}: {
  statusFilter: string;
  total: number;
  filteredCount: number;
  statusLabel: string;
  statusKey: string;
}) {
  const theme = useTheme();
  const isAll = statusFilter === "all";
  const colors = isAll ? null : statusColors(statusKey);

  return (
    <View
      style={[
        styles.summaryBanner,
        {
          backgroundColor: isAll ? theme.colors.card : (colors?.bg ?? theme.colors.card),
          borderColor: isAll ? theme.colors.border : (colors?.border ?? theme.colors.border),
        },
      ]}
    >
      <View style={styles.summaryBannerTop}>
        {!isAll && colors ? <View style={[styles.summaryBannerDot, { backgroundColor: colors.dot }]} /> : null}
        <Text
          style={[
            styles.summaryBannerLabel,
            { color: isAll ? theme.colors.mutedForeground : colors?.text, fontFamily: theme.fonts.sansMedium },
          ]}
        >
          {isAll ? "All candidates" : statusLabel}
        </Text>
      </View>
      <Text style={[styles.summaryBannerCount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
        {isAll ? total : filteredCount}
      </Text>
      <Text style={[styles.summaryBannerMeta, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
        {isAll
          ? `${total} candidate${total !== 1 ? "s" : ""} in list`
          : `${filteredCount} of ${total} candidate${total !== 1 ? "s" : ""}`}
      </Text>
    </View>
  );
}

function MasterRecordRow({ passport, onPress }: { passport: Passport; onPress: () => void }) {
  const theme = useTheme();
  const colors = statusColors(passport.status);
  const nationality = passport.nationality?.trim();
  const workPermit = passport.workPermitNumber?.trim();
  const agent = passport.agent?.trim();
  const isUnallocated = !passport.clientId;

  return (
    <Pressable onPress={onPress} style={[styles.recordRow, { backgroundColor: theme.colors.card }]}>
      <View style={[styles.recordAccent, { backgroundColor: colors.dot }]} />
      <View style={styles.recordContent}>
        <View style={styles.recordTop}>
          <CandidateAvatar name={passport.fullName} status={passport.status} />
          <View style={styles.recordTitleBlock}>
            <Text
              numberOfLines={2}
              style={[styles.recordName, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}
            >
              {passport.fullName?.trim() || "Unnamed candidate"}
            </Text>
            <View style={styles.recordSubRow}>
              <Text style={[styles.recordPassport, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.mono }]}>
                {passport.passportNumber ?? "No passport #"}
              </Text>
              {nationality ? (
                <Text style={[styles.recordNationality, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                  · {capitalize(nationality)}
                </Text>
              ) : null}
            </View>
          </View>
          <StatusBadge status={passport.status} />
        </View>

        <View style={styles.recordMeta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={11} color={theme.colors.mutedForeground} />
            <Text style={[styles.metaText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              DOB {formatShortDate(passport.dateOfBirth)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={11} color={theme.colors.mutedForeground} />
            <Text style={[styles.metaText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              Exp {formatShortDate(passport.dateOfExpiry)}
            </Text>
          </View>
          <ExpiryPill expiry={passport.dateOfExpiry} />
        </View>

        {(workPermit || agent) ? (
          <View style={styles.recordTags}>
            {workPermit ? (
              <View style={[styles.tagPill, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
                <Feather name="file-text" size={10} color={theme.colors.primary} />
                <Text numberOfLines={1} style={[styles.tagText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
                  {workPermit}
                </Text>
              </View>
            ) : null}
            {agent ? (
              <View style={[styles.tagPill, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
                <Feather name="user" size={10} color={theme.colors.primary} />
                <Text numberOfLines={1} style={[styles.tagText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
                  {agent}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.allocationRow, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
          <Feather name="briefcase" size={12} color={theme.colors.primary} />
          <Text
            numberOfLines={1}
            style={[styles.allocationText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}
          >
            {passport.companyName ?? "No company"}
          </Text>
          <Feather name="chevron-right" size={12} color={theme.colors.mutedForeground} />
          <Feather name="home" size={12} color={isUnallocated ? "#ea580c" : theme.colors.primary} />
          <Text
            numberOfLines={1}
            style={[
              styles.allocationText,
              {
                color: isUnallocated ? "#c2410c" : theme.colors.foreground,
                fontFamily: theme.fonts.sans,
              },
            ]}
          >
            {passport.clientName ?? "Unallocated"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function SwipeableMasterRow({
  passport,
  canDelete,
  onPress,
  onEdit,
  onDelete,
}: {
  passport: Passport;
  canDelete: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  function renderDeleteAction() {
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        style={styles.swipeDelete}
      >
        <Feather name="trash-2" size={18} color="#ffffff" />
        <Text style={styles.swipeActionText}>Delete</Text>
      </Pressable>
    );
  }

  function renderEditAction() {
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onEdit();
        }}
        style={styles.swipeEdit}
      >
        <Feather name="edit-2" size={18} color="#ffffff" />
        <Text style={styles.swipeActionText}>Edit</Text>
      </Pressable>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={canDelete ? renderDeleteAction : undefined}
      renderRightActions={renderEditAction}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      <MasterRecordRow passport={passport} onPress={onPress} />
    </Swipeable>
  );
}

export default function MasterScreen() {
  const theme = useTheme();
  const tabBarInset = useTabBarInset();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isAdmin = role === "admin" || role === "superuser";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nationalityFilter, setNationalityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  const listParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      nationality: nationalityFilter !== "all" ? nationalityFilter : undefined,
    }),
    [search, nationalityFilter],
  );

  const passportsQuery = useListPassports(listParams, {
    query: { queryKey: getListPassportsQueryKey(listParams), staleTime: 30_000 },
  });

  const rows = passportsQuery.data ?? [];
  const loading = passportsQuery.isLoading;
  const refreshing = passportsQuery.isRefetching;

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.status, (map.get(row.status) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const nationalityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.nationality?.trim().toLowerCase();
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const listStats = useMemo(() => {
    let allocated = 0;
    let expiring = 0;
    for (const row of rows) {
      if (row.clientId) allocated += 1;
      const expiry = getExpiryState(row.dateOfExpiry);
      if (expiry === "expired" || expiry === "soon") expiring += 1;
    }
    return {
      allocated,
      unallocated: rows.length - allocated,
      expiring,
    };
  }, [rows]);

  const displayed = useMemo(() => {
    let list = statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter);
    list = [...list].sort((a, b) => {
      if (sortBy === "name") {
        return (a.fullName ?? "").localeCompare(b.fullName ?? "", undefined, { sensitivity: "base" });
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [rows, statusFilter, sortBy]);

  const activeStatusLabel =
    STATUS_CHIP_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "Filtered";

  const deleteMutation = useDeletePassport({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListPassportsQueryKey() });
      },
    },
  });

  function openPassport(passport: Passport) {
    router.push(`/passport/${passport.id}` as Href);
  }

  function confirmDelete(passport: Passport) {
    Alert.alert("Delete candidate", "Remove this record permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ id: passport.id }),
      },
    ]);
  }

  function toggleNationalityFilter(value: string) {
    setNationalityFilter((current) => (current === value ? "all" : value));
  }

  function toggleSort() {
    setSortBy((current) => (current === "newest" ? "name" : "newest"));
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setNationalityFilter("all");
    setSortBy("newest");
  }

  function toggleStatusFilter(value: string) {
    setStatusFilter((current) => (current === value ? "all" : value));
  }

  const hasRecords = displayed.length > 0;
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== "all" || nationalityFilter !== "all";

  return (
    <SafeAreaView style={[pageLayoutStyles.safe, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      <FlatList
        data={displayed}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[pageLayoutStyles.list, { paddingBottom: tabBarInset }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => passportsQuery.refetch()} />}
        ListHeaderComponent={
          <View style={pageLayoutStyles.headerBlock}>
            <View style={pageLayoutStyles.brandRow}>
              <Feather name="users" size={14} color={theme.colors.mutedForeground} />
              <Text
                style={[
                  pageLayoutStyles.brandLabel,
                  { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansSemibold },
                ]}
              >
                PEOPLE
              </Text>
            </View>

            <View style={pageLayoutStyles.titleRow}>
              <Text
                style={[pageLayoutStyles.pageTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}
              >
                Master List
              </Text>
              <Button onPress={() => router.push("/(tabs)/upload")} style={pageLayoutStyles.addBtn}>
                + Upload
              </Button>
            </View>
            <Text style={[pageLayoutStyles.pageSub, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              All candidates — passport details, company allocation, and status.
            </Text>

            <MasterSummaryBanner
              statusFilter={statusFilter}
              total={rows.length}
              filteredCount={displayed.length}
              statusLabel={activeStatusLabel}
              statusKey={statusFilter}
            />

            <MasterStatsRow
              total={rows.length}
              allocated={listStats.allocated}
              unallocated={listStats.unallocated}
              expiring={listStats.expiring}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {STATUS_CHIP_OPTIONS.map((option) => (
                <StatusChip
                  key={option.value}
                  label={option.label}
                  count={option.value === "all" ? rows.length : (statusCounts.get(option.value) ?? 0)}
                  statusKey={option.value}
                  active={statusFilter === option.value}
                  onPress={() => toggleStatusFilter(option.value)}
                />
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {NATIONALITY_OPTIONS.map((option) => (
                <NationalityChip
                  key={option.value}
                  label={option.value === "all" ? "All" : option.label}
                  count={option.value === "all" ? rows.length : (nationalityCounts.get(option.value) ?? 0)}
                  nationalityKey={option.value}
                  active={nationalityFilter === option.value}
                  onPress={() => toggleNationalityFilter(option.value)}
                />
              ))}
            </ScrollView>

            <View style={pageLayoutStyles.toolbar}>
              <View
                style={[
                  pageLayoutStyles.searchBox,
                  { flex: 1, backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                <Feather name="search" size={15} color={theme.colors.mutedForeground} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, passport #, work permit…"
                  placeholderTextColor={theme.colors.mutedForeground}
                  style={[pageLayoutStyles.searchInput, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}
                />
                {search ? (
                  <Pressable onPress={() => setSearch("")} hitSlop={8}>
                    <Feather name="x" size={15} color={theme.colors.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={toggleSort}
                style={[pageLayoutStyles.filterBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <Feather name={sortBy === "newest" ? "clock" : "type"} size={14} color={theme.colors.primary} />
                <Text
                  numberOfLines={1}
                  style={[pageLayoutStyles.filterBtnText, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}
                >
                  {sortBy === "newest" ? "Newest" : "A–Z"}
                </Text>
              </Pressable>
            </View>

            {hasActiveFilters ? (
              <Pressable onPress={clearFilters} style={[styles.clearFiltersBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.muted }]}>
                <Feather name="x-circle" size={14} color={theme.colors.mutedForeground} />
                <Text style={[styles.clearFiltersText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansMedium }]}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}

            <View
              style={[
                styles.recordsCard,
                {
                  borderColor: theme.colors.cardBorder,
                  backgroundColor: theme.colors.card,
                  borderBottomLeftRadius: !hasRecords ? 12 : 0,
                  borderBottomRightRadius: !hasRecords ? 12 : 0,
                },
              ]}
            >
              <View style={[styles.recordsHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.recordsHeaderLeft}>
                  <Text style={[styles.recordsTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
                    Candidates
                  </Text>
                  <Text style={[styles.recordsMeta, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                    {loading ? "Loading…" : `${displayed.length} ${displayed.length === 1 ? "record" : "records"}`}
                    {statusFilter !== "all" ? ` · ${activeStatusLabel}` : ""}
                  </Text>
                </View>
                {hasRecords ? (
                  <View style={styles.recordsHeaderActions}>
                    <View style={[styles.swipeHintPill, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
                      <Feather name="chevrons-right" size={11} color={theme.colors.mutedForeground} />
                      <Text style={[styles.swipeHintText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                        Swipe
                      </Text>
                    </View>
                    <View style={[styles.swipeHintPill, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
                      <Feather name="maximize-2" size={11} color={theme.colors.mutedForeground} />
                      <Text style={[styles.swipeHintText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                        Tap
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {!hasRecords ? (
                loading ? (
                  <View style={styles.recordsEmpty}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : (
                  <View style={styles.recordsEmpty}>
                    <Feather name="inbox" size={22} color={theme.colors.mutedForeground} />
                    <Text style={[pageLayoutStyles.emptyText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                      {rows.length === 0
                        ? "No candidates yet — upload a passport to get started."
                        : "No candidates match your search or filters."}
                    </Text>
                    {rows.length === 0 ? (
                      <Button onPress={() => router.push("/(tabs)/upload")} style={styles.emptyBtn}>
                        Upload passport
                      </Button>
                    ) : null}
                  </View>
                )
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={null}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.recordWrap,
              {
                borderColor: theme.colors.cardBorder,
                backgroundColor: theme.colors.card,
                borderBottomLeftRadius: index === displayed.length - 1 ? 12 : 0,
                borderBottomRightRadius: index === displayed.length - 1 ? 12 : 0,
              },
            ]}
          >
            <SwipeableMasterRow
              passport={item}
              canDelete={isAdmin}
              onPress={() => openPassport(item)}
              onEdit={() => openPassport(item)}
              onDelete={() => confirmDelete(item)}
            />
            {index < displayed.length - 1 ? (
              <View style={[styles.recordDivider, { backgroundColor: theme.colors.border }]} />
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 7,
  },
  filterChipActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterChipLabel: {
    fontSize: 12,
    maxWidth: 88,
  },
  filterChipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  summaryBanner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  summaryBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryBannerLabel: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryBannerCount: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  summaryBannerMeta: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  statPillValue: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  statPillLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  clearFiltersText: {
    fontSize: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  expiryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiryPillText: {
    fontSize: 10,
  },
  detailHero: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  detailHeroGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  detailHeroText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  detailHeroName: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  detailHeroSub: {
    fontSize: 12,
  },
  detailAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailAlertText: {
    flex: 1,
    fontSize: 13,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailField: {
    width: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
  },
  detailValue: {
    fontSize: 13,
  },
  detailAllocation: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  detailAllocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailAllocationLabel: {
    fontSize: 12,
    width: 58,
  },
  detailAllocationValue: {
    flex: 1,
    fontSize: 13,
  },
  detailAllocationDivider: {
    height: StyleSheet.hairlineWidth,
  },
  unallocatedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unallocatedText: {
    flex: 1,
    fontSize: 13,
  },
  xpatSection: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  xpatSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  xpatSectionTitle: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  xpatHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  xpatLoader: {
    paddingVertical: 12,
  },
  xpatError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  xpatErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  xpatPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  xpatCardBlock: {
    gap: 8,
  },
  xpatCardLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  xpatCard: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  recordsCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  recordsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recordsHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  recordsTitle: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  recordsMeta: {
    fontSize: 12,
  },
  recordsHeaderActions: {
    flexDirection: "row",
    gap: 6,
  },
  swipeHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  swipeHintText: {
    fontSize: 10,
  },
  recordsEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  recordWrap: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    marginTop: -1,
    overflow: "hidden",
  },
  recordDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  recordAccent: {
    width: 4,
  },
  recordContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  recordTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  recordTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recordName: {
    fontSize: 14,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  recordSubRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 2,
  },
  recordPassport: {
    fontSize: 11,
  },
  recordNationality: {
    fontSize: 11,
  },
  recordTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  tagText: {
    fontSize: 11,
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  recordMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  metaText: {
    fontSize: 12,
  },
  allocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  allocationText: {
    flexShrink: 1,
    fontSize: 12,
  },
  swipeDelete: {
    width: 80,
    backgroundColor: "#e11d48",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeEdit: {
    width: 80,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeActionText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyBtn: { minWidth: 160 },
  footerBtn: { flex: 1 },
  editName: { fontSize: 16, marginBottom: 4 },
  pickerBtn: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
