export type VCardInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  org?: string | null;
};

/** Escape special chars inside a single vCard property value. */
function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function splitName(fullName: string): { given: string; family: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { given: "", family: "" };
  if (parts.length === 1) return { given: parts[0], family: "" };
  return { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] };
}

/** Build a vCard 3.0 payload for QR codes — scanners should offer "Save contact". */
export function buildVCard(input: VCardInput): string {
  const name = input.name?.trim() || "Contact";
  const { given, family } = splitName(name);

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(name)}`,
    // N = Family;Given;Middle;Prefix;Suffix — escape each part, not the semicolon separators.
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
  ];

  if (input.org?.trim()) lines.push(`ORG:${escapeVCard(input.org.trim())}`);
  if (input.title?.trim()) lines.push(`TITLE:${escapeVCard(input.title.trim())}`);

  const phone = input.phone?.trim();
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);

  const email = input.email?.trim();
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${email}`);

  lines.push("END:VCARD");
  return lines.join("\r\n");
}
