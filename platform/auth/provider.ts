import type { Role } from "../rbac/permissions";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Swap implementations (e.g. Microsoft Entra ID via OIDC) without touching app code.
 * App code only ever calls getCurrentUser() from platform/auth.
 */
export interface AuthProvider {
  getCurrentUser(): Promise<User | null>;
}
