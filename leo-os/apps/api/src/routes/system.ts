import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, appSettingsTable } from "@leo/db";
import { requireAuth, requireRole } from "../middleware/require-auth.js";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 1024 * 1024;
const DATA_URL_RE = /^data:image\/(png|jpe?g|svg\+xml|webp);base64,([A-Za-z0-9+/=]+)$/;

function validateImageDataUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return `${label} must be a string`;
  const m = value.match(DATA_URL_RE);
  if (!m) return `${label} must be a data:image URL`;
  const base64Len = m[2]!.length;
  const padding = m[2]!.endsWith("==") ? 2 : m[2]!.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64Len * 3) / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) {
    return `${label} exceeds 1 MB limit`;
  }
  return null;
}

async function readSettings() {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  if (rows.length > 0) return rows[0]!;
  await db.insert(appSettingsTable).values({ id: 1 }).onConflictDoNothing();
  const again = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  return again[0]!;
}

/** Lightweight branding payload — no embedded logo data URLs. */
function brandingMetadataShape(row: typeof appSettingsTable.$inferSelect) {
  return {
    appName: row.appName,
    accentHue: row.accentHue,
    companyName: row.companyName,
    companyAddress: row.companyAddress,
    companyPhone: row.companyPhone,
    companyEmail: row.companyEmail,
    companyWebsite: row.companyWebsite,
    companyRegistrationNumber: row.companyRegistrationNumber,
    hasLogo: row.logoImage != null && row.logoImage.length > 0,
    hasLogoDark: row.logoImageDark != null && row.logoImageDark.length > 0,
  };
}

function brandingLogosShape(row: typeof appSettingsTable.$inferSelect) {
  return {
    logoImage: row.logoImage,
    logoImageDark: row.logoImageDark,
  };
}

function brandingShape(row: typeof appSettingsTable.$inferSelect) {
  return {
    ...brandingMetadataShape(row),
    ...brandingLogosShape(row),
  };
}

function settingsShape(row: typeof appSettingsTable.$inferSelect) {
  return {
    ...brandingShape(row),
    hasCustomPassword: row.passwordHash != null && row.passwordHash.length > 0,
    hasOpenaiApiKey: row.deepseekApiKey != null && row.deepseekApiKey.length > 0,
    openaiOcrBaseUrl: row.deepseekOcrBaseUrl,
    openaiOcrModel: row.deepseekOcrModel,
  };
}

const UpdateBody = z.object({
  appName: z.string().min(1).max(60).optional(),
  accentHue: z.number().int().min(0).max(360).optional(),
  companyName: z.string().max(200).nullable().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  companyPhone: z.string().max(50).nullable().optional(),
  companyEmail: z.string().max(200).nullable().optional(),
  companyWebsite: z.string().max(200).nullable().optional(),
  companyRegistrationNumber: z.string().max(100).nullable().optional(),
  logoImage: z.string().nullable().optional(),
  logoImageDark: z.string().nullable().optional(),
  openaiApiKey: z.string().nullable().optional(),
  openaiOcrBaseUrl: z.string().max(500).nullable().optional(),
  openaiOcrModel: z.string().max(120).nullable().optional(),
});

router.get("/system/branding", async (_req, res): Promise<void> => {
  const row = await readSettings();
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(brandingMetadataShape(row));
});

router.get("/system/branding/logos", async (_req, res): Promise<void> => {
  const row = await readSettings();
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(brandingLogosShape(row));
});

router.get("/system/settings", requireAuth, requireRole("superuser"), async (_req, res): Promise<void> => {
  const row = await readSettings();
  res.json(settingsShape(row));
});

router.patch("/system/settings", requireAuth, requireRole("superuser"), async (req, res): Promise<void> => {
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  const logoErr = validateImageDataUrl(data.logoImage, "logoImage");
  if (logoErr) {
    res.status(400).json({ error: logoErr });
    return;
  }
  const logoDarkErr = validateImageDataUrl(data.logoImageDark, "logoImageDark");
  if (logoDarkErr) {
    res.status(400).json({ error: logoDarkErr });
    return;
  }

  const trimOrNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null;

  const patch: Record<string, unknown> = {};
  if (data.appName !== undefined) patch.appName = data.appName.trim();
  if (data.accentHue !== undefined) patch.accentHue = data.accentHue;
  if (data.companyName !== undefined) patch.companyName = trimOrNull(data.companyName);
  if (data.companyAddress !== undefined) patch.companyAddress = trimOrNull(data.companyAddress);
  if (data.companyPhone !== undefined) patch.companyPhone = trimOrNull(data.companyPhone);
  if (data.companyEmail !== undefined) patch.companyEmail = trimOrNull(data.companyEmail);
  if (data.companyWebsite !== undefined) patch.companyWebsite = trimOrNull(data.companyWebsite);
  if (data.companyRegistrationNumber !== undefined) {
    patch.companyRegistrationNumber = trimOrNull(data.companyRegistrationNumber);
  }
  if (data.logoImage !== undefined) patch.logoImage = data.logoImage ?? null;
  if (data.logoImageDark !== undefined) patch.logoImageDark = data.logoImageDark ?? null;
  if (data.openaiApiKey !== undefined) {
    const key = data.openaiApiKey === null ? null : data.openaiApiKey.trim() || null;
    if (key && !key.startsWith("sk-")) {
      res.status(400).json({ error: 'OpenAI API keys must start with "sk-"' });
      return;
    }
    patch.deepseekApiKey = key;
  }
  if (data.openaiOcrBaseUrl !== undefined) patch.deepseekOcrBaseUrl = trimOrNull(data.openaiOcrBaseUrl);
  if (data.openaiOcrModel !== undefined) patch.deepseekOcrModel = trimOrNull(data.openaiOcrModel);

  await readSettings();

  if (Object.keys(patch).length === 0) {
    res.json(settingsShape(await readSettings()));
    return;
  }

  const [updated] = await db
    .update(appSettingsTable)
    .set(patch)
    .where(eq(appSettingsTable.id, 1))
    .returning();
  res.json(settingsShape(updated!));
});

export default router;
