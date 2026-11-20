import { describe, expect, it, vi } from "vitest";
import { db, type Tx } from "@/platform/db";
import { ConflictError, ForbiddenError, ValidationError } from "@/platform/errors";
import { actAs, createUser, snapshot, validRefund } from "@/tests/helpers";
import { decideRefund, requestRefund } from "./actions";

async function pendingRefund() {
  const agent = await createUser("agent");
  actAs(agent);
  const refund = await requestRefund(validRefund(75000));
  const approval = await db.approval.findFirstOrThrow({ where: { resourceId: refund.id } });
  return { agent, refund, approval };
}

describe("refunds: permissions", () => {
  it("viewer cannot request a refund; the denial is audited and nothing is written", async () => {
    const viewer = await createUser("viewer");
    actAs(viewer);
    await expect(requestRefund(validRefund())).rejects.toBeInstanceOf(ForbiddenError);

    const { refunds, approvals, audits } = await snapshot();
    expect(refunds).toHaveLength(0);
    expect(approvals).toHaveLength(0);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: viewer.id, action: "refunds.request", outcome: "denied", before: null, after: null });
  });

  it("approver cannot request a refund", async () => {
    actAs(await createUser("approver"));
    await expect(requestRefund(validRefund())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.refund.count()).toBe(0);
  });

  it("agent cannot approve; the denial is audited and the refund stays pending", async () => {
    const { refund, approval } = await pendingRefund();
    const agent2 = await createUser("agent");
    actAs(agent2);
    const before = await snapshot();

    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const after = await snapshot();
    expect(after.refunds).toEqual(before.refunds);
    expect(after.approvals).toEqual(before.approvals);
    const newAudits = after.audits.slice(before.audits.length);
    expect(newAudits).toHaveLength(1);
    expect(newAudits[0]).toMatchObject({ actorId: agent2.id, action: "refunds.decide", outcome: "denied" });
  });

  it("viewer cannot approve", async () => {
    const { refund, approval } = await pendingRefund();
    actAs(await createUser("viewer"));
    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("pending_approval");
  });

  it("a viewer's denied decide records the target refundId on the denied audit row", async () => {
    const { refund, approval } = await pendingRefund();
    const viewer = await createUser("viewer");
    actAs(viewer);
    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const denied = await db.auditEvent.findMany({ where: { actorId: viewer.id } });
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ action: "refunds.decide", outcome: "denied", resourceType: "refund", resourceId: refund.id });
  });

  it("admin cannot approve a refund they requested themselves", async () => {
    const admin = await createUser("admin");
    actAs(admin);
    const refund = await requestRefund(validRefund(90000));
    const approval = await db.approval.findFirstOrThrow({ where: { resourceId: refund.id } });
    const before = await snapshot();

    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" }),
    ).rejects.toThrow("You cannot decide your own request");

    const after = await snapshot();
    expect(after.refunds).toEqual(before.refunds);
    expect(after.approvals).toEqual(before.approvals);
    const newAudits = after.audits.slice(before.audits.length);
    expect(newAudits).toHaveLength(1);
    expect(newAudits[0]).toMatchObject({ actorId: admin.id, outcome: "denied", resourceType: "refund", resourceId: refund.id });
  });
});

describe("refunds: threshold", () => {
  it("refunds at or under $500 are approved immediately with no approval", async () => {
    actAs(await createUser("agent"));
    const small = await requestRefund(validRefund(500));
    const exact = await requestRefund(validRefund(50000));
    expect(small.status).toBe("approved");
    expect(exact.status).toBe("approved");
    expect(await db.approval.count()).toBe(0);
  });

  it("refunds over $500 go to pending_approval and create an Approval", async () => {
    const agent = await createUser("agent");
    actAs(agent);
    const refund = await requestRefund(validRefund(50001));
    expect(refund.status).toBe("pending_approval");
    const approvals = await db.approval.findMany();
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({ resourceType: "refund", resourceId: refund.id, requestedById: agent.id, decidedAt: null });
  });
});

describe("refunds: audit", () => {
  it("a successful write creates exactly one success AuditEvent with before/after, PII redacted", async () => {
    const agent = await createUser("agent");
    actAs(agent);
    const refund = await requestRefund(validRefund(1234));

    const audits = await db.auditEvent.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: agent.id,
      action: "refunds.request",
      resourceType: "refund",
      resourceId: refund.id,
      outcome: "success",
      before: null,
    });
    const after = JSON.parse(audits[0].after!);
    expect(after).toMatchObject({ id: refund.id, amountCents: 1234, status: "approved", customerName: "[redacted]" });
    expect(audits[0].after).not.toContain("Testy McFakeface");
  });
});

describe("refunds: decisions", () => {
  it("approving updates the refund and the approval together, with audit rows for both", async () => {
    const { refund, approval } = await pendingRefund();
    const approver = await createUser("approver");
    actAs(approver);
    const auditsBefore = await db.auditEvent.count();

    const result = await decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" });
    expect(result.status).toBe("approved");

    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("approved");
    expect(await db.approval.findUniqueOrThrow({ where: { id: approval.id } })).toMatchObject({
      decision: "approved",
      decidedById: approver.id,
    });
    const newAudits = (await db.auditEvent.findMany({ orderBy: { createdAt: "asc" } })).slice(auditsBefore);
    expect(newAudits.map((a) => [a.action, a.outcome])).toEqual([
      ["approval.decide", "success"],
      ["refunds.decide", "success"],
    ]);
    const refundAudit = newAudits[1];
    expect(JSON.parse(refundAudit.before!).status).toBe("pending_approval");
    expect(JSON.parse(refundAudit.after!).status).toBe("approved");
  });

  it("the decision and refund status update share one transaction: if the refund update fails, the decision rolls back", async () => {
    const { refund, approval } = await pendingRefund();
    actAs(await createUser("approver"));

    const realTransaction = db.$transaction.bind(db);
    const spy = vi.spyOn(db, "$transaction").mockImplementation(((fn: (tx: Tx) => Promise<unknown>) =>
      realTransaction((tx) => {
        const failingTx = new Proxy(tx, {
          get(target, prop, receiver) {
            if (prop === "refund") {
              return new Proxy(target.refund, {
                get(r, p, rr) {
                  if (p === "updateMany") return async () => ({ count: 0 });
                  return Reflect.get(r, p, rr);
                },
              });
            }
            return Reflect.get(target, prop, receiver);
          },
        });
        return fn(failingTx);
      })) as typeof db.$transaction);

    try {
      await expect(
        decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" }),
      ).rejects.toBeInstanceOf(ConflictError);
    } finally {
      spy.mockRestore();
    }

    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("pending_approval");
    expect((await db.approval.findUniqueOrThrow({ where: { id: approval.id } })).decidedAt).toBeNull();
    expect(await db.auditEvent.count({ where: { action: { in: ["refunds.decide", "approval.decide"] } } })).toBe(0);
  });

  it("rejecting requires a reason", async () => {
    const { refund, approval } = await pendingRefund();
    actAs(await createUser("approver"));
    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "rejected" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "rejected", reason: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("pending_approval");

    const rejected = await decideRefund({
      refundId: refund.id,
      approvalId: approval.id,
      decision: "rejected",
      reason: "Outside policy",
    });
    expect(rejected.status).toBe("rejected");
    expect((await db.approval.findUniqueOrThrow({ where: { id: approval.id } })).reason).toBe("Outside policy");
  });

  it("an approval cannot be decided twice", async () => {
    const { refund, approval } = await pendingRefund();
    actAs(await createUser("approver"));
    await decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "approved" });

    actAs(await createUser("admin"));
    const before = await snapshot();
    await expect(
      decideRefund({ refundId: refund.id, approvalId: approval.id, decision: "rejected", reason: "Changed my mind" }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await snapshot()).toEqual(before);
  });

  it("an approval for a different refund cannot be used", async () => {
    const a = await pendingRefund();
    const b = await pendingRefund();
    actAs(await createUser("approver"));
    const before = await snapshot();
    await expect(
      decideRefund({ refundId: b.refund.id, approvalId: a.approval.id, decision: "approved" }),
    ).rejects.toThrow("Approval does not belong to this record");
    expect(await snapshot()).toEqual(before);
  });

  it("a refund that is not pending approval cannot be decided", async () => {
    const agent = await createUser("agent");
    actAs(agent);
    const small = await requestRefund(validRefund(100));
    const { approval } = await pendingRefund();
    actAs(await createUser("approver"));
    await expect(
      decideRefund({ refundId: small.id, approvalId: approval.id, decision: "approved" }),
    ).rejects.toThrow("Refund is not pending approval");
  });
});
