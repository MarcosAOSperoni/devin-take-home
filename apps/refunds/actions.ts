import { defineAction } from "@/platform/action";
import { decideApproval, requestApproval } from "@/platform/approvals";
import { ConflictError, NotFoundError } from "@/platform/errors";
import { refundsManifest } from "./manifest";
import { decideRefundInput, requestRefundInput, type RefundStatus } from "./schemas";

const RESOURCE = "refund";
const SENSITIVE = ["customerName"] as const;

export const requestRefund = defineAction({
  name: "refunds.request",
  permission: "refunds:request",
  resourceType: RESOURCE,
  input: requestRefundInput,
  sensitive: SENSITIVE,
  async run(ctx, input) {
    const status: RefundStatus =
      input.amountCents <= refundsManifest.config.approvalThresholdCents ? "approved" : "pending_approval";
    const refund = await ctx.tx.refund.create({
      data: { ...input, status, requestedById: ctx.user.id },
    });
    if (status === "pending_approval") {
      await requestApproval(ctx, { resourceType: RESOURCE, resourceId: refund.id });
    }
    return { resourceId: refund.id, before: null, after: refund, result: refund };
  },
});

export const decideRefund = defineAction({
  name: "refunds.decide",
  permission: "refunds:approve",
  resourceType: RESOURCE,
  input: decideRefundInput,
  sensitive: SENSITIVE,
  async run(ctx, input) {
    const before = await ctx.tx.refund.findUnique({ where: { id: input.refundId } });
    if (!before) throw new NotFoundError("Refund not found");
    if (before.status !== "pending_approval") throw new ConflictError("Refund is not pending approval");

    await decideApproval(ctx, input.approvalId, input.decision, input.reason, {
      permission: "refunds:approve",
      resourceType: RESOURCE,
      resourceId: before.id,
    });

    const status: RefundStatus = input.decision === "approved" ? "approved" : "rejected";
    const { count } = await ctx.tx.refund.updateMany({
      where: { id: before.id, status: "pending_approval" },
      data: { status },
    });
    if (count === 0) throw new ConflictError("Refund is not pending approval");

    const after = { ...before, status };
    return { resourceId: before.id, before, after, result: after };
  },
});
