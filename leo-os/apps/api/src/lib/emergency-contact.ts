export function formatEmergencyContact(
  name: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  const n = name?.trim() || null;
  const p = phone?.trim() || null;
  if (n && p) return `${n}, ${p}`;
  return n || p || null;
}
