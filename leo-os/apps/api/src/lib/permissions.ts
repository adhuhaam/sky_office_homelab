import type { Request, Response, NextFunction } from "express";
import { db, rolePermissionsTable } from "@leo/db";

type Action = "view" | "edit" | "delete";
interface PermEntry {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

let cache: Map<string, PermEntry> | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 60_000;

export async function getPermissionsCache(): Promise<Map<string, PermEntry>> {
  const now = Date.now();
  if (cache && now - cacheTs < CACHE_TTL_MS) return cache;
  const rows = await db.select().from(rolePermissionsTable);
  const m = new Map<string, PermEntry>();
  for (const row of rows) {
    m.set(`${row.role}:${row.module}`, {
      canView: row.canView,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
    });
  }
  cache = m;
  cacheTs = now;
  return m;
}

export function invalidatePermissionsCache(): void {
  cache = null;
}

function getModuleAction(method: string, path: string): { module: string; action: Action } | null {
  const m = method.toUpperCase();
  const p = path.replace(/\?.*$/, "");

  if (/^\/passports\/upload$/.test(p) && m === "POST") return { module: "upload", action: "edit" };

  if (/^\/passports(\/\d+|\/stats)?$/.test(p) && m === "GET") return { module: "masterlist", action: "view" };
  if (/^\/passports\/\d+$/.test(p) && m === "PATCH") return { module: "masterlist", action: "edit" };
  if (/^\/passports\/\d+$/.test(p) && m === "DELETE") return { module: "masterlist", action: "delete" };

  if (/^\/companies(\/\d+)?$/.test(p) && m === "GET") return { module: "companies", action: "view" };
  if (/^\/companies$/.test(p) && m === "POST") return { module: "companies", action: "edit" };
  if (/^\/companies\/\d+(\/branding)?$/.test(p) && (m === "PATCH" || m === "PUT" || m === "POST")) {
    return { module: "companies", action: "edit" };
  }
  if (/^\/companies\/\d+$/.test(p) && m === "DELETE") return { module: "companies", action: "delete" };

  if (/^\/clients(\/\d+)?$/.test(p) && m === "GET") return { module: "clients", action: "view" };
  if (/^\/clients$/.test(p) && m === "POST") return { module: "clients", action: "edit" };
  if (/^\/clients\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "clients", action: "edit" };
  if (/^\/clients\/\d+$/.test(p) && m === "DELETE") return { module: "clients", action: "delete" };

  if (/^\/loa(\/\d+)?$/.test(p) && m === "GET") return { module: "loa", action: "view" };
  if (/^\/loa\/\d+\/pdf$/.test(p) && m === "GET") return { module: "loa", action: "view" };
  if (/^\/loa$/.test(p) && m === "POST") return { module: "loa", action: "edit" };
  if (/^\/loa\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "loa", action: "edit" };
  if (/^\/loa\/\d+$/.test(p) && m === "DELETE") return { module: "loa", action: "delete" };

  if (/^\/billing\/documents(\/\d+)?$/.test(p) && m === "GET") return { module: "billing", action: "view" };
  if (/^\/billing\/documents$/.test(p) && m === "POST") return { module: "billing", action: "edit" };
  if (/^\/billing\/documents\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) {
    return { module: "billing", action: "edit" };
  }
  if (/^\/billing\/documents\/\d+$/.test(p) && m === "DELETE") return { module: "billing", action: "delete" };

  if (/^\/expenses(\/\d+)?$/.test(p) && m === "GET") return { module: "expenses", action: "view" };
  if (/^\/expenses$/.test(p) && m === "POST") return { module: "expenses", action: "edit" };
  if (/^\/expenses\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "expenses", action: "edit" };
  if (/^\/expenses\/\d+$/.test(p) && m === "DELETE") return { module: "expenses", action: "delete" };

  if (/^\/passwords(\/\d+)?$/.test(p) && m === "GET") return { module: "passwords", action: "view" };
  if (/^\/passwords$/.test(p) && m === "POST") return { module: "passwords", action: "edit" };
  if (/^\/passwords\/\d+$/.test(p) && (m === "PATCH" || m === "PUT")) return { module: "passwords", action: "edit" };

  return null;
}

export async function permissionsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const role = req.session?.role;
  if (!role || role === "superuser" || role === "admin") {
    next();
    return;
  }

  const target = getModuleAction(req.method, req.path);
  if (!target) {
    next();
    return;
  }

  try {
    const permCache = await getPermissionsCache();
    const perm = permCache.get(`${role}:${target.module}`);
    const allowed =
      target.action === "view"
        ? (perm?.canView ?? false)
        : target.action === "edit"
          ? (perm?.canEdit ?? false)
          : (perm?.canDelete ?? false);

    if (!allowed) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  } catch {
    // If DB unavailable, fail open
  }

  next();
}
