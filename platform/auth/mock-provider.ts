/**
 * DEMO ONLY. INSECURE BY DESIGN.
 * The session cookie holds a raw user id with no signature, so anyone can
 * impersonate anyone. Replace with a real OIDC provider before any real use.
 */
import { cookies } from "next/headers";
import { db } from "../db";
import { isRole } from "../rbac/permissions";
import type { AuthProvider, User } from "./provider";

export const SESSION_COOKIE = "demo_session";

export async function findUser(id: string): Promise<User | null> {
  const row = await db.user.findUnique({ where: { id } });
  if (!row || !isRole(row.role)) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export const mockAuthProvider: AuthProvider = {
  async getCurrentUser() {
    const userId = (await cookies()).get(SESSION_COOKIE)?.value;
    return userId ? findUser(userId) : null;
  },
};

export async function listDemoUsers(): Promise<User[]> {
  const rows = await db.user.findMany({ orderBy: { name: "asc" } });
  return rows.flatMap((r) => (isRole(r.role) ? [{ id: r.id, name: r.name, email: r.email, role: r.role }] : []));
}

export async function signInAs(userId: string): Promise<void> {
  if (!(await findUser(userId))) throw new Error("Unknown user");
  (await cookies()).set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
