export const ROLES = ["viewer", "agent", "approver", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "refunds:read",
  "refunds:request",
  "refunds:approve",
  "audit:read",
  "kyc:read",
  "kyc:work",
  "kyc:decide",
  "kyc:reveal_ssn",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** The single source of truth for who can do what. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ["refunds:read"],
  agent: ["refunds:read", "refunds:request", "kyc:read", "kyc:work"],
  approver: ["refunds:read", "refunds:approve", "kyc:read", "kyc:decide", "kyc:reveal_ssn"],
  admin: PERMISSIONS,
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
