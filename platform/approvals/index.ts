// Generic maker-checker. Helpers run inside the calling action's transaction (via its ctx),
// so the approval change, the underlying record change, and their audit rows commit together.
import type { ActionContext } from "../action";
import { AlreadyDecidedError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { can, type Permission } from "../rbac";

export type Decision = "approved" | "rejected";

const AUDIT_TYPE = "approval";

export async function requestApproval(
  ctx: ActionContext,
  { resourceType, resourceId }: { resourceType: string; resourceId: string },
) {
  const approval = await ctx.tx.approval.create({
    data: { resourceType, resourceId, requestedById: ctx.user.id },
  });
  await ctx.audit({ action: "approval.request", resourceType: AUDIT_TYPE, resourceId: approval.id, before: null, after: approval });
  return approval;
}

export type DecideOptions = {
  /** The owning app's approve permission. */
  permission: Permission;
  /** The record the caller is deciding on; the approval must belong to it. */
  resourceType: string;
  resourceId: string;
};

export async function decideApproval(
  ctx: ActionContext,
  approvalId: string,
  decision: Decision,
  reason: string | undefined,
  opts: DecideOptions,
) {
  if (!can(ctx.user, opts.permission)) throw new ForbiddenError(undefined, opts.resourceId);
  const trimmedReason = reason?.trim() || null;
  if (decision === "rejected" && !trimmedReason) throw new ValidationError("A reason is required when rejecting");

  const approval = await ctx.tx.approval.findUnique({ where: { id: approvalId } });
  if (!approval) throw new NotFoundError("Approval not found");
  if (approval.resourceType !== opts.resourceType || approval.resourceId !== opts.resourceId) {
    throw new ConflictError("Approval does not belong to this record");
  }
  if (approval.requestedById === ctx.user.id) {
    throw new ForbiddenError("You cannot decide your own request", opts.resourceId);
  }

  // Conditional update instead of read-then-write: only one decider can win.
  const decidedAt = new Date();
  const { count } = await ctx.tx.approval.updateMany({
    where: { id: approvalId, decidedAt: null },
    data: { decidedById: ctx.user.id, decision, reason: trimmedReason, decidedAt },
  });
  if (count === 0) throw new AlreadyDecidedError();

  const after = { ...approval, decidedById: ctx.user.id, decision, reason: trimmedReason, decidedAt };
  await ctx.audit({ action: "approval.decide", resourceType: AUDIT_TYPE, resourceId: approvalId, before: approval, after });
  return after;
}
