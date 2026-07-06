import { StyleSheet } from "react-native";

/** Shared list/table page shell — use on tab screens (expenses, master list, etc.). */
export const pageLayoutStyles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: 14, paddingTop: 10 },
  headerBlock: { gap: 12, marginBottom: 0 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandLabel: { fontSize: 11, letterSpacing: 1.4 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: -4,
  },
  pageTitle: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, lineHeight: 18 },
  /** Compact header action — never full-width stretch. */
  addBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 8 },
  toolbar: { flexDirection: "row", gap: 8, alignItems: "center" },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 40,
    maxWidth: 130,
  },
  filterBtnFlex: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  filterBtnText: { fontSize: 12, flexShrink: 1 },
  tableCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  tableEmpty: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});

export const TABLE_HEADER_BG = "#0f172a";
