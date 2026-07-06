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
  label: string;
  dot: string;
  bg: string;
  text: string;
  border: string;
}

/** Static color defs — use inline styles (not dynamic Tailwind classes). */
export const EXPENSE_CATEGORY_COLORS: CategoryColorDef[] = [
  { id: "slate", label: "Slate", dot: "#64748b", bg: "#f1f5f9", text: "#334155", border: "#cbd5e1" },
  { id: "sky", label: "Sky", dot: "#0ea5e9", bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  { id: "amber", label: "Amber", dot: "#f59e0b", bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  { id: "emerald", label: "Emerald", dot: "#10b981", bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  { id: "rose", label: "Rose", dot: "#f43f5e", bg: "#ffe4e6", text: "#be123c", border: "#fda4af" },
  { id: "violet", label: "Violet", dot: "#8b5cf6", bg: "#ede9fe", text: "#6d28d9", border: "#c4b5fd" },
  { id: "indigo", label: "Indigo", dot: "#6366f1", bg: "#e0e7ff", text: "#4338ca", border: "#a5b4fc" },
  { id: "teal", label: "Teal", dot: "#14b8a6", bg: "#ccfbf1", text: "#0f766e", border: "#5eead4" },
];

export function getCategoryColor(id: string | null | undefined): CategoryColorDef {
  return EXPENSE_CATEGORY_COLORS.find((c) => c.id === id) ?? EXPENSE_CATEGORY_COLORS[0];
}

export function categoryCardStyle(id: string | null | undefined): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const c = getCategoryColor(id);
  return { backgroundColor: c.bg, color: c.text, borderColor: c.border };
}

export function categoryDotStyle(id: string | null | undefined): { backgroundColor: string } {
  return { backgroundColor: getCategoryColor(id).dot };
}

export function accentFromHue(hue: number, saturation = 38, lightness = 42): string {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function accentSoftFromHue(hue: number): string {
  return `hsl(${hue} 45% 92%)`;
}

export const ACCENT_HUE_PRESETS = [
  { name: "Teal", hue: 162 },
  { name: "Emerald", hue: 152 },
  { name: "Sky", hue: 200 },
  { name: "Indigo", hue: 235 },
  { name: "Violet", hue: 265 },
  { name: "Rose", hue: 340 },
  { name: "Amber", hue: 38 },
  { name: "Crimson", hue: 0 },
] as const;
