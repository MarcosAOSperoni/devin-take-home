import { redirect } from "next/navigation";
import { mockAuthProvider } from "./mock-provider";
import type { AuthProvider, User } from "./provider";

export type { AuthProvider, User };

let provider: AuthProvider = mockAuthProvider;

/** Used by tests, and by a future real provider (e.g. OIDC) at startup. */
export function setAuthProvider(next: AuthProvider): void {
  provider = next;
}

/** The only way code gets the current user. */
export function getCurrentUser(): Promise<User | null> {
  return provider.getCurrentUser();
}

/** For pages and loaders: redirects to /login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
