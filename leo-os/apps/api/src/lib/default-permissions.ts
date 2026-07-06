/** Default RBAC matrix — matches leoOs_system reference. */
export const DEFAULT_ROLE_PERMISSIONS = [
  ...["masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload"].map(
    (module) => ({ role: "admin" as const, module, canView: true, canEdit: true, canDelete: true }),
  ),
  { role: "company" as const, module: "masterlist", canView: true, canEdit: true, canDelete: false },
  { role: "company" as const, module: "companies", canView: true, canEdit: false, canDelete: false },
  { role: "company" as const, module: "clients", canView: false, canEdit: false, canDelete: false },
  { role: "company" as const, module: "loa", canView: true, canEdit: true, canDelete: false },
  { role: "company" as const, module: "billing", canView: true, canEdit: false, canDelete: false },
  { role: "company" as const, module: "expenses", canView: false, canEdit: false, canDelete: false },
  { role: "company" as const, module: "passwords", canView: false, canEdit: false, canDelete: false },
  { role: "company" as const, module: "upload", canView: true, canEdit: true, canDelete: false },
  { role: "client" as const, module: "masterlist", canView: true, canEdit: false, canDelete: false },
  { role: "client" as const, module: "companies", canView: false, canEdit: false, canDelete: false },
  { role: "client" as const, module: "clients", canView: false, canEdit: false, canDelete: false },
  { role: "client" as const, module: "loa", canView: false, canEdit: false, canDelete: false },
  { role: "client" as const, module: "billing", canView: true, canEdit: false, canDelete: false },
  { role: "client" as const, module: "expenses", canView: false, canEdit: false, canDelete: false },
  { role: "client" as const, module: "passwords", canView: false, canEdit: false, canDelete: false },
  { role: "client" as const, module: "upload", canView: false, canEdit: false, canDelete: false },
  ...["masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload"].map(
    (module) => ({
      role: "employee" as const,
      module,
      canView: module === "masterlist",
      canEdit: false,
      canDelete: false,
    }),
  ),
  ...["masterlist", "companies", "clients", "loa", "billing", "expenses", "passwords", "upload"].map(
    (module) => ({
      role: "agent" as const,
      module,
      canView: module === "masterlist",
      canEdit: false,
      canDelete: false,
    }),
  ),
];
