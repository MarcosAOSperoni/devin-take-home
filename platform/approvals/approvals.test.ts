import { describe, expect, it } from "vitest";
import { decideRefund, requestRefund } from "@/apps/refunds/actions";
import type { ActionContext } from "@/platform/action";
import { db, type Tx } from "@/platform/db";
import { AlreadyDecidedError } from "@/platform/errors";
import { actAs, createUser, validRefund } from "@/tests/helpers";
import { decideApproval } from ".";

async function pendingRefund() {
  actAs(await createUser("agent"));
  const refund = await requestRefund(validRefund(80000));
  const approval = await db.approval.findFirstOrThrow({ where: { resourceId: refund.id } });
  return { refund, approval };
}

describe("approvals: race safety", () => {
  it("uses a conditional update: a stale read of an undecided approval still cannot decide it again", async () => {
    const { refund, approval: staleApproval } = await pendingRefund();
    const first = await createUser("approver");
    actAs(first);
    await decideRefund({ refundId: refund.id, approvalId: staleApproval.id, decision: "approved" });

    // Simulate a concurrent decider whose read happened before the first decision committed.
    const second = await createUser("approver");
    const staleTx = {
      approval: {
        findUnique: async () => staleApproval,
        updateMany: (args: Parameters<typeof db.approval.updateMany>[0]) => db.approval.updateMany(args),
      },
    } as unknown as Tx;
    const ctx: ActionContext = { user: second, tx: staleTx, audit: async () => {} };

    await expect(
      decideApproval(ctx, staleApproval.id, "rejected", "Too late", {
        permission: "refunds:approve",
        resourceType: "refund",
        resourceId: refund.id,
      }),
    ).rejects.toBeInstanceOf(AlreadyDecidedError);

    expect(await db.approval.findUniqueOrThrow({ where: { id: staleApproval.id } })).toMatchObject({
      decision: "approved",
      decidedById: first.id,
      reason: null,
    });
  });

  it("two concurrent decisions: exactly one wins", async () => {
    const { refund, approval } = await pendingRefund();
    const a = await createUser("approver");
    const b = await createUser("admin");

    actAs(a);
    const p1 = decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" });
    actAs(b);
    const p2 = decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "rejected", reason: "No" });
    const results = await Promise.allSettled([p1, p2]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await db.auditEvent.count({ where: { action: "approval.decide", outcome: "success" } })).toBe(1);
    const decided = await db.approval.findUniqueOrThrow({ where: { id: approval.id } });
    const finalRefund = await db.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(finalRefund.status).toBe(decided.decision);
  });
});
