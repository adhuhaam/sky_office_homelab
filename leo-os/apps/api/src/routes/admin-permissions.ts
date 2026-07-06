import { Router, type IRouter, type Request, type Response } from "express";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db, rolePermissionsTable } from "@leo/db";
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/default-permissions.js";
import { invalidatePermissionsCache } from "../lib/permissions.js";

const router: IRouter = Router();

const PermissionRow = z.object({
  role: z.string().min(1),
  module: z.string().min(1),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const PermissionsUpdateBody = z.array(PermissionRow);

function formatRow(r: typeof rolePermissionsTable.$inferSelect) {
  return {
    role: r.role,
    module: r.module,
    canView: r.canView,
    canEdit: r.canEdit,
    canDelete: r.canDelete,
  };
}

async function upsertPermissions(
  permissions: z.infer<typeof PermissionRow>[],
): Promise<void> {
  for (const p of permissions) {
    await db
      .insert(rolePermissionsTable)
      .values(p)
      .onConflictDoUpdate({
        target: [rolePermissionsTable.role, rolePermissionsTable.module],
        set: {
          canView: p.canView,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        },
      });
  }
  invalidatePermissionsCache();
}

router.get("/admin/permissions", async (_req, res): Promise<void> => {
  let rows = await db.select().from(rolePermissionsTable);
  if (rows.length === 0) {
    await db.insert(rolePermissionsTable).values(DEFAULT_ROLE_PERMISSIONS).onConflictDoNothing();
    rows = await db.select().from(rolePermissionsTable);
  }
  rows.sort(
    (a, b) => a.role.localeCompare(b.role) || a.module.localeCompare(b.module),
  );
  res.json(rows.map(formatRow));
});

router.put("/admin/permissions", async (req: Request, res: Response): Promise<void> => {
  const parsed = PermissionsUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await upsertPermissions(parsed.data);
  const rows = await db
    .select()
    .from(rolePermissionsTable)
    .orderBy(asc(rolePermissionsTable.role), asc(rolePermissionsTable.module));
  res.json(rows.map(formatRow));
});

router.patch("/admin/permissions", async (req: Request, res: Response): Promise<void> => {
  const wrapped = z.object({ permissions: PermissionsUpdateBody.min(1) }).safeParse(req.body);
  if (!wrapped.success) {
    res.status(400).json({ error: wrapped.error.message });
    return;
  }
  await upsertPermissions(wrapped.data.permissions);
  const rows = await db
    .select()
    .from(rolePermissionsTable)
    .orderBy(asc(rolePermissionsTable.role), asc(rolePermissionsTable.module));
  res.json(rows.map(formatRow));
});

export default router;
