export function formatEmergencyContact(
  name: string | null | undefined,
  phone: string | null | undefined,
): string {
  const n = name?.trim() || "";
  const p = phone?.trim() || "";
  if (n && p) return `${n}, ${p}`;
  return n || p;
}
