import type { AuthProvider, User } from "@/platform/auth";
import { db } from "@/platform/db";
import type { Role } from "@/platform/rbac";

let current: User | null = null;

export const testAuthProvider: AuthProvider = {
  getCurrentUser: async () => current,
};

export function actAs(user: User): void {
  current = user;
}

export function signOut(): void {
  current = null;
}

let n = 0;
export async function createUser(role: Role): Promise<User> {
  n += 1;
  const row = await db.user.create({
    data: { name: `Test ${role} ${n}`, email: `${role}${n}@example.test`, role },
  });
  return { id: row.id, name: row.name, email: row.email, role };
}

export const validRefund = (amountCents = 1000) => ({
  orderId: "ORD-TEST-1",
  customerName: "Testy McFakeface",
  amountCents,
  reason: "Item damaged",
});

export async function snapshot() {
  const [refunds, approvals, audits] = await Promise.all([
    db.refund.findMany({ orderBy: { id: "asc" } }),
    db.approval.findMany({ orderBy: { id: "asc" } }),
    db.auditEvent.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return { refunds, approvals, audits };
}
