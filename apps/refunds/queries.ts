// Server-side read loaders. Each one checks permission before touching data.
import { requireUser } from "@/platform/auth";
import { loadResourceHistory } from "@/platform/audit";
import { db } from "@/platform/db";
import { can, requirePermission } from "@/platform/rbac";
import { refundsManifest } from "./manifest";
import type { RefundFilters } from "./schemas";

const READ = refundsManifest.readPermission;

export async function loadRefunds(filters: RefundFilters = {}) {
  const user = await requireUser();
  requirePermission(user, READ);
  const refunds = await db.refund.findMany({
    where: {
      status: filters.status,
      amountCents: { gte: filters.minCents, lte: filters.maxCents },
    },
    include: { requestedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    refunds,
    canRequest: can(user, "refunds:request"),
    canApprove: can(user, "refunds:approve"),
  };
}

export async function loadRefund(id: string) {
  const user = await requireUser();
  requirePermission(user, READ);
  const refund = await db.refund.findUnique({
    where: { id },
    include: { requestedBy: { select: { name: true } } },
  });
  if (!refund) return null;
  const [history, approvals] = await Promise.all([
    loadResourceHistory(READ, "refund", id),
    db.approval.findMany({ where: { resourceType: "refund", resourceId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  return { refund, history, approvals };
}

export async function loadPendingApprovals() {
  const user = await requireUser();
  requirePermission(user, READ);
  requirePermission(user, "refunds:approve");
  const approvals = await db.approval.findMany({
    where: { resourceType: "refund", decidedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const refunds = await db.refund.findMany({
    where: { id: { in: approvals.map((a) => a.resourceId) } },
    include: { requestedBy: { select: { name: true } } },
  });
  const byId = new Map(refunds.map((r) => [r.id, r]));
  return {
    currentUserId: user.id,
    items: approvals.flatMap((approval) => {
      const refund = byId.get(approval.resourceId);
      return refund ? [{ approval, refund }] : [];
    }),
  };
}

/** Page guard for the request form, which loads no data but should still 403. */
export async function loadRequestForm() {
  const user = await requireUser();
  requirePermission(user, "refunds:request");
  return { threshold: refundsManifest.config.approvalThresholdCents };
}
