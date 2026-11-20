// Read-only API for the append-only audit log. No update/delete functions are exported.
import { requireUser } from "../auth";
import { db } from "../db";
import { requirePermission, type Permission } from "../rbac";

export { REDACTED, redact } from "./redact";

export type AuditFilters = { resourceType?: string; actorId?: string };

/** Loader for /admin/audit. Requires audit:read. */
export async function loadAuditLog(filters: AuditFilters = {}) {
  const user = await requireUser();
  requirePermission(user, "audit:read");
  const [events, resourceTypes, actors] = await Promise.all([
    db.auditEvent.findMany({
      where: {
        resourceType: filters.resourceType || undefined,
        actorId: filters.actorId || undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.auditEvent.findMany({ distinct: ["resourceType"], select: { resourceType: true } }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { events, resourceTypes: resourceTypes.map((r) => r.resourceType), actors };
}

/** History for one resource. Callers pass the read permission of the app that owns the resource. */
export async function loadResourceHistory(readPermission: Permission, resourceType: string, resourceId: string) {
  const user = await requireUser();
  requirePermission(user, readPermission);
  return db.auditEvent.findMany({
    where: { resourceType, resourceId },
    orderBy: { createdAt: "asc" },
  });
}
