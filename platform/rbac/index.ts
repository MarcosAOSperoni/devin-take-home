import type { User } from "../auth/provider";
import { ForbiddenError } from "../errors";
import { ROLE_PERMISSIONS, type Permission } from "./permissions";

export { ForbiddenError };
export * from "./permissions";

/** The only permission check. Always evaluate on the server. */
export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function requirePermission(user: User | null | undefined, permission: Permission): asserts user is User {
  if (!can(user, permission)) throw new ForbiddenError();
}
