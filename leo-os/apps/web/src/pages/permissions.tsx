import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type RolePermission, ApiError } from "@/lib/api";

const ROLES = ["superuser", "admin", "client", "company", "employee", "agent"] as const;

const MODULES = [
  { id: "masterlist", label: "Master List" },
  { id: "companies", label: "Companies" },
  { id: "clients", label: "Clients" },
  { id: "loa", label: "LOA" },
  { id: "billing", label: "Billing" },
  { id: "expenses", label: "Expenses" },
  { id: "passwords", label: "Passwords" },
  { id: "upload", label: "Upload" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  superuser: "Superuser",
  admin: "Admin",
  client: "Client",
  company: "Company",
  employee: "Employee",
  agent: "Agent",
};

const ROLE_COLORS: Record<string, string> = {
  superuser: "bg-violet-100 text-violet-700 border-violet-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  client: "bg-cyan-100 text-cyan-700 border-cyan-200",
  company: "bg-teal-100 text-teal-700 border-teal-200",
  employee: "bg-lime-100 text-lime-700 border-lime-200",
  agent: "bg-amber-100 text-amber-700 border-amber-200",
};

export function PermissionsPage() {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<RolePermission[]>("/admin/permissions");
      setPermissions(data);
      setDirty(false);
    } catch (err) {
      toast({
        title: "Failed to load permissions",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const permMap = useMemo(() => {
    const map = new Map<string, RolePermission>();
    for (const p of permissions) {
      map.set(`${p.role}:${p.module}`, p);
    }
    return map;
  }, [permissions]);

  function getPerm(role: string, module: string): RolePermission {
    return (
      permMap.get(`${role}:${module}`) ?? {
        role,
        module,
        canView: false,
        canEdit: false,
        canDelete: false,
      }
    );
  }

  function toggle(
    role: string,
    module: string,
    field: "canView" | "canEdit" | "canDelete",
  ) {
    setPermissions((prev) => {
      const key = `${role}:${module}`;
      const existing = prev.find((p) => `${p.role}:${p.module}` === key);
      if (existing) {
        return prev.map((p) =>
          `${p.role}:${p.module}` === key ? { ...p, [field]: !p[field] } : p,
        );
      }
      return [
        ...prev,
        {
          role,
          module,
          canView: field === "canView",
          canEdit: field === "canEdit",
          canDelete: field === "canDelete",
        },
      ];
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await apiFetch<RolePermission[]>("/admin/permissions", {
        method: "PATCH",
        body: JSON.stringify({ permissions }),
      });
      setPermissions(updated);
      setDirty(false);
      toast({ title: "Permissions saved", description: "Access rules are now live." });
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    load();
  }

  return (
    <div className="max-w-full">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Permissions</h1>
            <p className="text-sm text-muted-foreground">
              Configure module access per role. Superuser always has full access.
            </p>
          </div>
        </div>
        {dirty && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={discard} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save changes
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-700">
            <Eye className="h-3 w-3" />
          </span>
          View
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-blue-700">
            <Pencil className="h-3 w-3" />
          </span>
          Edit / Create
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-rose-100 text-rose-700">
            <Trash2 className="h-3 w-3" />
          </span>
          Delete
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase text-[11px] tracking-wider sticky left-0 bg-muted/40 z-10 min-w-[120px]">
                  Role
                </th>
                {MODULES.map((mod) => (
                  <th
                    key={mod.id}
                    className="px-2 py-3 text-center font-semibold text-muted-foreground uppercase text-[11px] tracking-wider min-w-[90px]"
                  >
                    {mod.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROLES.map((role) => (
                <tr key={role} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-4 sticky left-0 bg-card z-10 border-r border-border">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${ROLE_COLORS[role]}`}
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  </td>
                  {MODULES.map(({ id: module }) => {
                    const e = getPerm(role, module);
                    return (
                      <td key={module} className="px-2 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {(["canView", "canEdit", "canDelete"] as const).map((field, i) => {
                            const icons = [Eye, Pencil, Trash2];
                            const Icon = icons[i]!;
                            const activeClasses = [
                              "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                              "bg-blue-100 text-blue-700 hover:bg-blue-200",
                              "bg-rose-100 text-rose-700 hover:bg-rose-200",
                            ];
                            return (
                              <button
                                key={field}
                                type="button"
                                title={field}
                                onClick={() => toggle(role, module, field)}
                                className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
                                  e[field]
                                    ? activeClasses[i]
                                    : "bg-muted text-muted-foreground/25 hover:bg-muted/70"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
