export const ROLES = ["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"] as const;
export type RoleName = (typeof ROLES)[number];

export function isRole(value: unknown): value is RoleName {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
