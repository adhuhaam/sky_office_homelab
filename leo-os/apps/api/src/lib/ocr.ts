import { parse as parseMRZ, type ParseResult } from "mrz";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@leo/db";
import pino from "pino";

const logger = pino({ level: process.env["LOG_LEVEL"] ?? "info" });

interface OcrConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

async function getOcrConfig(): Promise<OcrConfig> {
  const envKey =
    process.env["OPENAI_API_KEY"]?.trim() ?? process.env["DEEPSEEK_API_KEY"]?.trim();
  const envBase =
    process.env["OPENAI_OCR_BASE_URL"]?.replace(/\/$/, "") ??
    process.env["DEEPSEEK_OCR_BASE_URL"]?.replace(/\/$/, "");
  const envModel =
    process.env["OPENAI_OCR_MODEL"]?.trim() ?? process.env["DEEPSEEK_OCR_MODEL"]?.trim();

  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: envBase ?? "https://api.openai.com/v1",
      model: envModel ?? "gpt-4o-mini",
    };
  }

  try {
    const rows = await db
      .select({
        apiKey: appSettingsTable.deepseekApiKey,
        ocrBaseUrl: appSettingsTable.deepseekOcrBaseUrl,
        ocrModel: appSettingsTable.deepseekOcrModel,
      })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.id, 1))
      .limit(1);
    const row = rows[0];
    if (row?.apiKey) {
      return {
        apiKey: row.apiKey,
        baseUrl: (row.ocrBaseUrl ?? envBase ?? "https://api.openai.com/v1").replace(/\/$/, ""),
        model: row.ocrModel ?? envModel ?? "gpt-4o-mini",
      };
    }
  } catch (err) {
    logger.warn({ err }, "Could not read OpenAI OCR settings from DB");
  }

  throw new Error(
    "OpenAI API key is not configured. Set OPENAI_API_KEY in the API environment or add a key in Settings.",
  );
}

export interface ExtractedPassportData {
  fullName: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  nationality: string | null;
}

const NATIONALITY_MAP: Record<string, string> = {
  BGD: "bangladesh",
  IND: "india",
  PAK: "pakistan",
  MDV: "maldives",
  LKA: "sri lanka",
  NPL: "nepal",
};

const DEMONYM_MAP: Record<string, string> = {
  bangladeshi: "bangladesh",
  indian: "india",
  nepali: "nepal",
  nepalese: "nepal",
  maldivian: "maldives",
  pakistani: "pakistan",
  "sri lankan": "sri lanka",
  srilankan: "sri lanka",
};

const SYSTEM_PROMPT = `You are a passport OCR assistant. Extract all visible data from the passport image and return it as a single JSON object with these exact keys (use null for anything not visible or unclear):

{
  "mrz_line1": "First MRZ line, exactly 44 uppercase chars (A-Z, 0-9, <). Example: P<BGDBISWAS<<ANTU<ANTOR<<<<<<<<<<<<<<<<<<",
  "mrz_line2": "Second MRZ line, exactly 44 uppercase chars. Example: A190016636BGD9205103M2502286<<<<<<<<<<<<<<<8",
  "full_name": "Full name as printed on the biographical page (not MRZ format)",
  "date_of_birth": "Date of birth as printed, e.g. 10 May 1992",
  "date_of_issue": "Date of issue as printed, e.g. 01 Mar 2020",
  "date_of_expiry": "Date of expiry as printed, e.g. 28 Feb 2025",
  "nationality": "Nationality as printed (country name), e.g. Bangladeshi",
  "passport_number": "Passport number as printed on the biographical page",
  "address": "Permanent address if visible on the page, otherwise null",
  "emergency_contact_name": "Emergency contact person name if printed on the passport (often on bio page), otherwise null",
  "emergency_contact_phone": "Emergency contact telephone number if printed on the passport, otherwise null"
}

Copy the MRZ lines character-for-character from the Machine Readable Zone at the bottom of the passport. Use only A-Z, 0-9, and < — no spaces or other characters.

Return ONLY the JSON object. No markdown, no explanation.`;

function fieldValid(res: ParseResult, field: string): boolean {
  return res.details.some((d) => d.field === field && d.valid);
}

function scoreMrz(res: ParseResult): number {
  if (res.valid) return 100;
  let score = 0;
  for (const d of res.details) {
    if (
      d.valid &&
      (d.field === "documentNumberCheckDigit" ||
        d.field === "birthDateCheckDigit" ||
        d.field === "expirationDateCheckDigit" ||
        d.field === "compositeCheckDigit")
    ) {
      score += 1;
    }
  }
  return score;
}

function cleanMrzName(raw: string): string {
  const words = raw
    .replace(/</g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  while (words.length > 0) {
    const last = words[words.length - 1]!;
    const isFillerRun = /(.)\1{2,}/.test(last) || (last.length === 1 && words.length > 1);
    if (isFillerRun) words.pop();
    else break;
  }

  return words.join(" ");
}

function formatMRZDate(mrzDate: string, preferFuture = false): string | null {
  if (!mrzDate || mrzDate.length !== 6 || /[^0-9]/.test(mrzDate)) return null;
  const yy = parseInt(mrzDate.slice(0, 2), 10);
  const mm = parseInt(mrzDate.slice(2, 4), 10);
  const dd = parseInt(mrzDate.slice(4, 6), 10);
  if (!mm || mm > 12 || !dd || dd > 31) return null;
  const fullYear = preferFuture || yy < 30 ? 2000 + yy : 1900 + yy;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(dd).padStart(2, "0")} ${months[mm - 1]} ${fullYear}`;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function normalizeNationality(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return (DEMONYM_MAP[lower] ?? lower) || null;
}

function parseModelJson(raw: string): Record<string, unknown> {
  const json = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(json) as Record<string, unknown>;
}

function findMrzInText(text: string): [string, string] | null {
  const compact = text.replace(/\s/g, "").toUpperCase();
  for (let i = 0; i <= compact.length - 88; i++) {
    const a = compact.slice(i, i + 44);
    const b = compact.slice(i + 44, i + 88);
    if (a.startsWith("P<") && /^[A-Z0-9<]{44}$/.test(a) && /^[A-Z0-9<]{44}$/.test(b)) {
      return [a, b];
    }
  }
  return null;
}

function buildFromGptAndMrz(gpt: Record<string, unknown>, mrzResult: ParseResult | null): ExtractedPassportData {
  const res = mrzResult;
  const mrzFields = (res?.fields ?? {}) as Record<string, string | null>;
  const wholeValid = res?.valid === true;
  const trust = (checkField: string): boolean =>
    !!res && (wholeValid || fieldValid(res, checkField));
  const nameTrust = wholeValid || (!!res && fieldValid(res, "documentNumberCheckDigit"));

  const fullName: string | null =
    str(gpt.full_name) ??
    (nameTrust
      ? [cleanMrzName(mrzFields.lastName ?? ""), cleanMrzName(mrzFields.firstName ?? "")]
          .filter(Boolean)
          .join(" ") || null
      : null);

  const passportNumber: string | null =
    (trust("documentNumberCheckDigit") && mrzFields.documentNumber
      ? mrzFields.documentNumber.replace(/</g, "").trim() || null
      : null) ?? str(gpt.passport_number);

  const dateOfBirth: string | null =
    (trust("birthDateCheckDigit") && mrzFields.birthDate
      ? formatMRZDate(mrzFields.birthDate, false)
      : null) ?? str(gpt.date_of_birth);

  const dateOfExpiry: string | null =
    (trust("expirationDateCheckDigit") && mrzFields.expirationDate
      ? formatMRZDate(mrzFields.expirationDate, true)
      : null) ?? str(gpt.date_of_expiry);

  let nationality: string | null = null;
  if (nameTrust && mrzFields.nationality) {
    nationality = NATIONALITY_MAP[mrzFields.nationality] ?? mrzFields.nationality.toLowerCase();
  } else {
    nationality = normalizeNationality(str(gpt.nationality));
  }

  return {
    fullName,
    passportNumber,
    dateOfBirth,
    dateOfIssue: str(gpt.date_of_issue),
    dateOfExpiry,
    address: str(gpt.address)?.substring(0, 200) ?? null,
    emergencyContactName: str(gpt.emergency_contact_name)?.substring(0, 120) ?? null,
    emergencyContactPhone: str(gpt.emergency_contact_phone)?.substring(0, 40) ?? null,
    nationality,
  };
}

type ChatMessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

async function callVisionChat(
  config: OcrConfig,
  messages: Array<{ role: string; content: ChatMessageContent }>,
) {
  const url = `${config.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 800,
      temperature: 0,
      messages,
    }),
  });

  const body = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    const msg = body.error?.message ?? `OpenAI API error (${response.status})`;
    throw new Error(msg);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI API returned an empty response");
  }
  return content;
}

async function callVisionModel(
  config: OcrConfig,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const content: ChatMessageContent = [
    { type: "text", text: SYSTEM_PROMPT },
    { type: "image_url", image_url: { url: dataUrl } },
  ];

  return callVisionChat(config, [{ role: "user", content }]);
}

function parseMrzFromModel(gpt: Record<string, unknown>, rawResponse: string): ParseResult | null {
  const line1 = str(gpt.mrz_line1);
  const line2 = str(gpt.mrz_line2);
  if (line1 && line2) {
    try {
      return parseMRZ([line1, line2], { autocorrect: true });
    } catch {
      // fall through
    }
  }

  const found = findMrzInText(rawResponse);
  if (found) {
    try {
      return parseMRZ(found, { autocorrect: true });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extract passport data from an image using an OpenAI-compatible vision API.
 */
export async function extractPassportData(
  imageBuffer: Buffer,
  mimeType = "image/jpeg",
): Promise<ExtractedPassportData> {
  const config = await getOcrConfig();
  logger.info({ model: config.model, baseUrl: config.baseUrl }, "Starting OpenAI OCR extraction");

  const raw = await callVisionModel(config, imageBuffer, mimeType);

  let gpt: Record<string, unknown>;
  try {
    gpt = parseModelJson(raw);
  } catch (parseErr) {
    logger.warn(
      { parseError: (parseErr as Error).message, responseLength: raw.length },
      "Failed to parse OpenAI JSON — using MRZ fallback",
    );
    gpt = {};
  }

  const mrzResult = parseMrzFromModel(gpt, raw);
  if (mrzResult) {
    logger.info(
      { valid: mrzResult.valid, score: scoreMrz(mrzResult) },
      "MRZ checksum validation result",
    );
  }

  const result = buildFromGptAndMrz(gpt, mrzResult);

  if (!result.passportNumber && !result.fullName) {
    throw new Error("OCR could not extract passport number or name");
  }

  logger.info(
    {
      fullName: result.fullName,
      passportNumber: result.passportNumber,
      nationality: result.nationality,
      mrzValid: mrzResult?.valid === true,
    },
    "OpenAI OCR extraction complete",
  );

  return result;
}
