export type CategoryColorId =
  | "slate"
  | "sky"
  | "amber"
  | "emerald"
  | "rose"
  | "violet"
  | "indigo"
  | "teal";

export interface CategoryColorDef {
  id: CategoryColorId;
  dot: string;
  bg: string;
  text: string;
  border: string;
}

export const EXPENSE_CATEGORY_COLORS: CategoryColorDef[] = [
  { id: "slate", dot: "#64748b", bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" },
  { id: "sky", dot: "#0ea5e9", bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  { id: "amber", dot: "#f59e0b", bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  { id: "emerald", dot: "#10b981", bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  { id: "rose", dot: "#f43f5e", bg: "#ffe4e6", text: "#be123c", border: "#fda4af" },
  { id: "violet", dot: "#8b5cf6", bg: "#ede9fe", text: "#6d28d9", border: "#c4b5fd" },
  { id: "indigo", dot: "#6366f1", bg: "#e0e7ff", text: "#4338ca", border: "#a5b4fc" },
  { id: "teal", dot: "#14b8a6", bg: "#ccfbf1", text: "#0f766e", border: "#5eead4" },
];

export function getCategoryColor(id: string | null | undefined): CategoryColorDef {
  return EXPENSE_CATEGORY_COLORS.find((c) => c.id === id) ?? EXPENSE_CATEGORY_COLORS[0];
}

/** Bold filled pill colors for category summary chips (matches expense manager UI). */
export interface CategoryPillDef {
  bg: string;
  text: string;
  badgeBg: string;
}

const CATEGORY_PILL_COLORS: Record<CategoryColorId, CategoryPillDef> = {
  slate: { bg: "#1c1917", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
  sky: { bg: "#0284c7", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
  amber: { bg: "#eab308", text: "#1c1917", badgeBg: "rgba(0,0,0,0.14)" },
  emerald: { bg: "#059669", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
  rose: { bg: "#e11d48", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
  violet: { bg: "#7c3aed", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
  indigo: { bg: "#4f46e5", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
  teal: { bg: "#db2777", text: "#ffffff", badgeBg: "rgba(255,255,255,0.22)" },
};

export const TOTAL_PILL: CategoryPillDef = {
  bg: "#0f172a",
  text: "#ffffff",
  badgeBg: "rgba(255,255,255,0.22)",
};

export function getCategoryPill(id: string | null | undefined): CategoryPillDef {
  const color = getCategoryColor(id);
  return CATEGORY_PILL_COLORS[color.id];
}
