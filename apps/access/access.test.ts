import { describe, expect, it } from "vitest";
import type { User } from "@/platform/auth";
import { db } from "@/platform/db";
import { AlreadyDecidedError, ConflictError, ForbiddenError, ValidationError } from "@/platform/errors";
import { actAs, createUser } from "@/tests/helpers";
import { decideAccess, requestAccess, revokeAccess } from "./actions";
import { loadList, loadRequest, loadRequestForm } from "./queries";

const VALID = { system: "payments-db", reason: "Investigate INC-1234", durationHours: 4 };
const HOUR = 3600 * 1000;

async function snapshot() {
  const [requests, approvals, audits] = await Promise.all([
    db.accessRequest.findMany({ orderBy: { id: "asc" } }),
    db.approval.findMany({ orderBy: { id: "asc" } }),
    db.auditEvent.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return { requests, approvals, audits };
}

/** Asserts the call was denied, nothing changed, and exactly one denied audit row was added. */
async function expectDenied(user: User, action: string, resourceId: string | null, call: () => Promise<unknown>) {
  actAs(user);
  const before = await snapshot();
  await expect(call()).rejects.toBeInstanceOf(ForbiddenError);
  const after = await snapshot();
  expect(after.requests).toEqual(before.requests);
  expect(after.approvals).toEqual(before.approvals);
  const added = after.audits.slice(before.audits.length);
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ actorId: user.id, action, outcome: "denied", resourceType: "access_request", resourceId });
}

/** Asserts the call fails with `error` and changes nothing, with no audit row. */
async function expectUnchanged(call: () => Promise<unknown>, error: new (...args: never[]) => Error) {
  const before = await snapshot();
  await expect(call()).rejects.toBeInstanceOf(error);
  expect(await snapshot()).toEqual(before);
}

async function pending(requester?: User) {
  const user = requester ?? (await createUser("agent"));
  actAs(user);
  const request = await requestAccess(VALID);
  return { requester: user, request };
}

async function active() {
  const { requester, request } = await pending();
  const approver = await createUser("approver");
  actAs(approver);
  await decideAccess({ requestId: request.id, decision: "approved", reason: "Ticket checks out" });
  return { requester, approver, request };
}

describe("access: request", () => {
  it("a viewer can't request: rejected, nothing written, one denied audit row", async () => {
    const viewer = await createUser("viewer");
    await expectDenied(viewer, "access.request", null, () => requestAccess(VALID));
    await expect(loadRequestForm()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("approvers can't request either", async () => {
    await expectDenied(await createUser("approver"), "access.request", null, () => requestAccess(VALID));
  });

  it("an agent's request is pending with an approval and one success audit row", async () => {
    const { requester, request } = await pending();
    expect(request).toMatchObject({ status: "pending", requesterId: requester.id, expiresAt: null });
    expect(await db.approval.findUniqueOrThrow({ where: { id: request.approvalId! } })).toMatchObject({
      resourceType: "access_request",
      resourceId: request.id,
      decidedAt: null,
    });
    const audits = await db.auditEvent.findMany({ where: { action: "access.request" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ outcome: "success", resourceId: request.id, actorId: requester.id });
  });

  it("rejects unknown systems, other durations and a blank reason", async () => {
    actAs(await createUser("agent"));
    for (const bad of [{ system: "prod-root" }, { durationHours: 2 }, { reason: "  " }]) {
      await expectUnchanged(() => requestAccess({ ...VALID, ...bad }), ValidationError);
    }
  });
});

describe("access: approve / deny", () => {
  it("a requester can't approve their own request (even as admin)", async () => {
    const admin = await createUser("admin");
    const { request } = await pending(admin);
    await expectDenied(admin, "access.decide", request.id, () =>
      decideAccess({ requestId: request.id, decision: "approved", reason: "Self" }),
    );
  });

  it("agents and viewers can't decide", async () => {
    const { request } = await pending();
    for (const role of ["agent", "viewer"] as const) {
      await expectDenied(await createUser(role), "access.decide", request.id, () =>
        decideAccess({ requestId: request.id, decision: "approved", reason: "x" }),
      );
    }
  });

  it("approve sets expiresAt = decidedAt + duration and writes one success audit row", async () => {
    const { request } = await active();
    const row = await db.accessRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe("approved");
    expect(row.expiresAt!.getTime() - row.decidedAt!.getTime()).toBe(4 * HOUR);
    expect(await db.auditEvent.count({ where: { action: "access.decide", outcome: "success" } })).toBe(1);
  });

  it("deny and approve both require a reason", async () => {
    const { request } = await pending();
    actAs(await createUser("approver"));
    for (const decision of ["rejected", "approved"]) {
      await expectUnchanged(() => decideAccess({ requestId: request.id, decision, reason: "" }), ValidationError);
      await expectUnchanged(() => decideAccess({ requestId: request.id, decision, reason: "   " }), ValidationError);
    }
  });

  it("a double decision is race-safe: two concurrent approvers, exactly one wins", async () => {
    const { request } = await pending();
    const a = await createUser("approver");
    const b = await createUser("admin");
    actAs(a);
    const p1 = decideAccess({ requestId: request.id, decision: "approved", reason: "OK" });
    actAs(b);
    const p2 = decideAccess({ requestId: request.id, decision: "rejected", reason: "No" });
    const results = await Promise.allSettled([p1, p2]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ConflictError);
    expect(await db.auditEvent.count({ where: { action: "access.decide", outcome: "success" } })).toBe(1);
    const row = await db.accessRequest.findUniqueOrThrow({ where: { id: request.id } });
    const approval = await db.approval.findUniqueOrThrow({ where: { id: request.approvalId! } });
    expect(row.status).toBe(approval.decision === "approved" ? "approved" : "denied");
    expect(row.decidedById).toBe(approval.decidedById);
  });

  it("a sequential second decision is rejected and changes nothing", async () => {
    const { request } = await active();
    actAs(await createUser("approver"));
    await expectUnchanged(
      () => decideAccess({ requestId: request.id, decision: "rejected", reason: "Late" }),
      ConflictError,
    );
  });

  it("a stale approval that was already decided can't be decided again", async () => {
    const { request } = await active();
    await db.accessRequest.update({ where: { id: request.id }, data: { status: "pending" } }); // simulate stale read
    actAs(await createUser("approver"));
    await expect(
      decideAccess({ requestId: request.id, decision: "rejected", reason: "Late" }),
    ).rejects.toBeInstanceOf(AlreadyDecidedError);
  });
});

describe("access: expiry and revoke", () => {
  it("expired is computed from expiresAt on read, with no stored status change", async () => {
    const { request } = await active();
    await db.accessRequest.update({ where: { id: request.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const data = await loadRequest(request.id);
    expect(data?.request.status).toBe("expired");
    expect(data?.canRevoke).toBe(false);
    expect((await db.accessRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("approved");
  });

  it("the requester can revoke their own active grant; one success audit row", async () => {
    const { requester, request } = await active();
    actAs(requester);
    await revokeAccess({ requestId: request.id, reason: "Done early" });
    const row = await db.accessRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row).toMatchObject({ status: "revoked", revokedById: requester.id, revokeReason: "Done early" });
    expect((await loadRequest(request.id))?.request.status).toBe("revoked");
    expect(await db.auditEvent.count({ where: { action: "access.revoke", outcome: "success" } })).toBe(1);
  });

  it("an approver can revoke anyone's active grant", async () => {
    const { request } = await active();
    actAs(await createUser("approver"));
    await expect(revokeAccess({ requestId: request.id, reason: "Incident closed" })).resolves.toMatchObject({ status: "revoked" });
  });

  it("another agent and a viewer can't revoke", async () => {
    const { request } = await active();
    await expectDenied(await createUser("agent"), "access.revoke", request.id, () =>
      revokeAccess({ requestId: request.id, reason: "Mine now" }),
    );
    await expectDenied(await createUser("viewer"), "access.revoke", request.id, () =>
      revokeAccess({ requestId: request.id, reason: "x" }),
    );
  });

  it("revoke requires a reason", async () => {
    const { requester, request } = await active();
    actAs(requester);
    await expectUnchanged(() => revokeAccess({ requestId: request.id, reason: " " }), ValidationError);
  });

  it("an expired grant can't be revoked", async () => {
    const { approver, request } = await active();
    await db.accessRequest.update({ where: { id: request.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    actAs(approver);
    await expectUnchanged(() => revokeAccess({ requestId: request.id, reason: "Too late" }), ConflictError);
  });

  it("a pending request can't be revoked", async () => {
    const { request } = await pending();
    actAs(await createUser("approver"));
    await expectUnchanged(() => revokeAccess({ requestId: request.id, reason: "x" }), ConflictError);
  });
});

describe("access: final requests can't change", () => {
  async function denied() {
    const { requester, request } = await pending();
    const approver = await createUser("approver");
    actAs(approver);
    await decideAccess({ requestId: request.id, decision: "rejected", reason: "No ticket" });
    return { requester, approver, request };
  }

  async function revoked() {
    const { requester, approver, request } = await active();
    actAs(approver);
    await revokeAccess({ requestId: request.id, reason: "Done" });
    return { requester, approver, request };
  }

  async function expired() {
    const r = await active();
    await db.accessRequest.update({ where: { id: r.request.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    return r;
  }

  for (const [name, make] of [["denied", denied], ["revoked", revoked], ["expired", expired]] as const) {
    it(`a ${name} request can't be decided or revoked`, async () => {
      const { requester, request } = await make();
      actAs(await createUser("admin"));
      await expectUnchanged(() => decideAccess({ requestId: request.id, decision: "approved", reason: "Retry" }), ConflictError);
      await expectUnchanged(() => revokeAccess({ requestId: request.id, reason: "Again" }), ConflictError);
      actAs(requester);
      await expectUnchanged(() => revokeAccess({ requestId: request.id, reason: "Again" }), ConflictError);
      expect((await loadRequest(request.id))?.request.status).toBe(name);
    });
  }
});

describe("access: list", () => {
  it("every role can read; active grants come first; filters by status, system and mine", async () => {
    const { requester: mine } = await active(); // payments-db, active
    actAs(mine);
    await requestAccess({ ...VALID, system: "kyc-db" }); // mine, pending
    const other = await pending(); // someone else's pending payments-db
    void other;
    const exp = await active();
    await db.accessRequest.update({ where: { id: exp.request.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    actAs(await createUser("viewer"));
    const all = await loadList();
    expect(all.canRequest).toBe(false);
    expect(all.requests).toHaveLength(4);
    expect(all.requests[0].status).toBe("active");

    expect((await loadList({ status: "expired" })).requests.map((r) => r.id)).toEqual([exp.request.id]);
    expect((await loadList({ status: "active" })).requests).toHaveLength(1);
    expect((await loadList({ system: "kyc-db" })).requests).toHaveLength(1);

    actAs(mine);
    const minePending = await loadList({ mine: true, status: "pending" });
    expect(minePending.requests).toHaveLength(1);
    expect(minePending.requests[0].system).toBe("kyc-db");
    expect((await loadList({ mine: true })).requests).toHaveLength(2);
  });

  it("loaders require sign-in", async () => {
    await expect(loadList()).rejects.toThrow();
  });
});
