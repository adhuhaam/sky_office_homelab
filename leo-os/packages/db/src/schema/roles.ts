export const ROLES = [
  "superuser",
  "admin",
  "client",
  "company",
  "employee",
  "agent",
] as const;

export type Role = (typeof ROLES)[number];
