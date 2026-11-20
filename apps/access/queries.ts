// Server-side read loaders. Each one checks permission before touching data.
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/platform/auth";
import { loadResourceHistory } from "@/platform/audit";
import { db } from "@/platform/db";
import { can, requirePermission } from "@/platform/rbac";
import { accessManifest } from "./manifest";
import { displayStatus, type AccessFilters, type DisplayStatus } from "./schemas";

const READ = accessManifest.readPermission;

function statusWhere(status: DisplayStatus | undefined, now: Date): Prisma.AccessRequestWhereInput {
  if (status === "active") return { status: "approved", expiresAt: { gt: now } };
  if (status === "expired") return { status: "approved", expiresAt: { lte: now } };
  return status ? { status } : {};
}

const RANK: Record<DisplayStatus, number> = { active: 0, pending: 1, expired: 2, denied: 2, revoked: 2 };

export async function loadList(filters: AccessFilters = {}) {
  const user = await requireUser();
  requirePermission(user, READ);
  const now = new Date();
  const rows = await db.accessRequest.findMany({
    where: {
      ...statusWhere(filters.status, now),
      system: filters.system,
      requesterId: filters.mine ? user.id : undefined,
    },
    include: { requester: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const requests = rows
    .map((r) => ({
      id: r.id,
      system: r.system,
      reason: r.reason,
      durationHours: r.durationHours,
      status: displayStatus(r, now),
      requesterName: r.requester.name,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }))
    .sort((a, b) => RANK[a.status] - RANK[b.status]);
  return { requests, canRequest: can(user, "access:request") };
}

export async function loadRequest(id: string) {
  const user = await requireUser();
  requirePermission(user, READ);
  const row = await db.accessRequest.findUnique({ where: { id }, include: { requester: { select: { name: true } } } });
  if (!row) return null;
  const ids = [row.decidedById, row.revokedById].filter((v): v is string => !!v);
  const names = new Map((await db.user.findMany({ where: { id: { in: ids } } })).map((u) => [u.id, u.name]));
  const status = displayStatus(row);
  const history = await loadResourceHistory(READ, "access_request", id);
  const isOwn = row.requesterId === user.id;
  return {
    request: {
      id: row.id,
      system: row.system,
      reason: row.reason,
      durationHours: row.durationHours,
      status,
      requesterName: row.requester.name,
      createdAt: row.createdAt,
      decidedByName: row.decidedById ? (names.get(row.decidedById) ?? null) : null,
      decisionReason: row.decisionReason,
      decidedAt: row.decidedAt,
      expiresAt: row.expiresAt,
      revokedByName: row.revokedById ? (names.get(row.revokedById) ?? null) : null,
      revokeReason: row.revokeReason,
      revokedAt: row.revokedAt,
    },
    history,
    canDecide: status === "pending" && !isOwn && can(user, "access:approve"),
    canRevoke:
      status === "active" && can(user, "access:revoke") && (isOwn || can(user, "access:approve")),
  };
}

/** Page guard for the request form, which loads no data but should still 403. */
export async function loadRequestForm() {
  const user = await requireUser();
  requirePermission(user, "access:request");
  return {};
}
