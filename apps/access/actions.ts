import { defineAction } from "@/platform/action";
import { decideApproval, requestApproval } from "@/platform/approvals";
import type { Tx } from "@/platform/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/platform/errors";
import { can } from "@/platform/rbac";
import { decideAccessInput, displayStatus, requestAccessInput, revokeAccessInput } from "./schemas";

const RESOURCE = "access_request";
const HOUR_MS = 3600 * 1000;

async function findRequest(tx: Tx, id: string) {
  const request = await tx.accessRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Request not found");
  return request;
}

export const requestAccess = defineAction({
  name: "access.request",
  permission: "access:request",
  resourceType: RESOURCE,
  input: requestAccessInput,
  async run(ctx, input) {
    const created = await ctx.tx.accessRequest.create({
      data: { ...input, requesterId: ctx.user.id, status: "pending" },
    });
    const approval = await requestApproval(ctx, { resourceType: RESOURCE, resourceId: created.id });
    const after = await ctx.tx.accessRequest.update({ where: { id: created.id }, data: { approvalId: approval.id } });
    return { resourceId: after.id, before: null, after, result: after };
  },
});

/** Approve or deny. Self-decision and double decisions are blocked by decideApproval plus a conditional update. */
export const decideAccess = defineAction({
  name: "access.decide",
  permission: "access:approve",
  resourceType: RESOURCE,
  input: decideAccessInput,
  resourceIdKey: "requestId",
  async run(ctx, input) {
    const before = await findRequest(ctx.tx, input.requestId);
    if (before.status !== "pending" || !before.approvalId) throw new ConflictError("This request has already been decided");

    await decideApproval(ctx, before.approvalId, input.decision, input.reason, {
      permission: "access:approve",
      resourceType: RESOURCE,
      resourceId: before.id,
    });

    const decidedAt = new Date();
    const approved = input.decision === "approved";
    const data = {
      status: approved ? "approved" : "denied",
      decidedById: ctx.user.id,
      decisionReason: input.reason,
      decidedAt,
      expiresAt: approved ? new Date(decidedAt.getTime() + before.durationHours * HOUR_MS) : null,
    };
    const { count } = await ctx.tx.accessRequest.updateMany({ where: { id: before.id, status: "pending" }, data });
    if (count === 0) throw new ConflictError("This request has already been decided");

    const after = { ...before, ...data };
    return { resourceId: before.id, before, after, result: after };
  },
});

/** Ends an active grant early. The requester may revoke their own grant; approvers may revoke any. */
export const revokeAccess = defineAction({
  name: "access.revoke",
  permission: "access:revoke",
  resourceType: RESOURCE,
  input: revokeAccessInput,
  resourceIdKey: "requestId",
  async run(ctx, input) {
    const before = await findRequest(ctx.tx, input.requestId);
    if (before.requesterId !== ctx.user.id && !can(ctx.user, "access:approve")) {
      throw new ForbiddenError("You can only revoke your own grants", before.id);
    }
    const now = new Date();
    const status = displayStatus(before, now);
    if (status === "expired") throw new ConflictError("This grant has expired and cannot be revoked");
    if (status !== "active") throw new ConflictError("Only an active grant can be revoked");

    const data = { status: "revoked", revokedById: ctx.user.id, revokeReason: input.reason, revokedAt: now };
    const { count } = await ctx.tx.accessRequest.updateMany({
      where: { id: before.id, status: "approved", expiresAt: { gt: now } },
      data,
    });
    if (count === 0) throw new ConflictError("Only an active grant can be revoked");

    const after = { ...before, ...data };
    return { resourceId: before.id, before, after, result: after };
  },
});
