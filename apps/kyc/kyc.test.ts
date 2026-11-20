import { describe, expect, it } from "vitest";
import type { User } from "@/platform/auth";
import { db } from "@/platform/db";
import { ConflictError, ForbiddenError, ValidationError } from "@/platform/errors";
import { can } from "@/platform/rbac";
import { APPS } from "@/platform/ui/apps";
import { actAs, createUser } from "@/tests/helpers";
import { addCaseNote, assignCaseToMe, decideCase, escalateCase, revealSsn } from "./actions";
import { kycManifest } from "./manifest";
import { loadCase, loadQueue } from "./queries";

const SSN = "900-12-3456";
const DOB = "1980-04-15";
const NAME = "Fakey McTestcase";

let n = 0;
async function createCase(overrides: Partial<{ status: string; riskLevel: string; ssn: string; assigneeId: string | null }> = {}) {
  n += 1;
  return db.kycCase.create({
    data: {
      reference: `KYC-T${n}`,
      customerName: NAME,
      dateOfBirth: DOB,
      country: "US",
      documentType: "passport",
      riskLevel: "medium",
      ssn: SSN,
      status: "pending",
      ...overrides,
    },
  });
}

async function snapshot() {
  const [cases, notes, audits] = await Promise.all([
    db.kycCase.findMany({ orderBy: { id: "asc" } }),
    db.kycNote.findMany({ orderBy: { id: "asc" } }),
    db.auditEvent.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return { cases, notes, audits };
}

/** Asserts the call was denied, nothing changed, and exactly one denied audit row was added. */
async function expectDenied(user: User, action: string, caseId: string, call: () => Promise<unknown>) {
  actAs(user);
  const before = await snapshot();
  await expect(call()).rejects.toBeInstanceOf(ForbiddenError);
  const after = await snapshot();
  expect(after.cases).toEqual(before.cases);
  expect(after.notes).toEqual(before.notes);
  const added = after.audits.slice(before.audits.length);
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ actorId: user.id, action, outcome: "denied", resourceType: "kyc_case", resourceId: caseId, before: null, after: null });
}

describe("kyc: read access", () => {
  it("a viewer can't read the app: hidden from the home page and both loaders 403", async () => {
    const viewer = await createUser("viewer");
    const c = await createCase();
    actAs(viewer);
    expect(can(viewer, kycManifest.readPermission)).toBe(false);
    expect(APPS.filter((a) => can(viewer, a.readPermission)).map((a) => a.route)).not.toContain("/kyc");
    await expect(loadQueue()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(loadCase(c.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("agents, approvers and admins can read the queue", async () => {
    await createCase();
    for (const role of ["agent", "approver", "admin"] as const) {
      actAs(await createUser(role));
      await expect(loadQueue()).resolves.toMatchObject({ cases: [expect.objectContaining({ status: "pending" })] });
    }
  });

  it("the SSN and DOB never appear unmasked in the queue page's data", async () => {
    const ssns = ["900-11-1111", "901-22-2222", "902-33-3333"];
    for (const ssn of ssns) await createCase({ ssn });
    for (const role of ["agent", "approver", "admin"] as const) {
      actAs(await createUser(role));
      const data = await loadQueue();
      const json = JSON.stringify(data);
      for (const ssn of ssns) {
        expect(json).not.toContain(ssn);
        expect(json).not.toContain(ssn.replace(/-/g, ""));
      }
      expect(json).not.toContain(DOB);
      expect(data.cases.map((c) => c.ssnMasked).sort()).toEqual(["*******1111", "*******2222", "*******3333"]);
      expect(data.cases.every((c) => !("ssn" in c) && !("dateOfBirth" in c))).toBe(true);
    }
  });

  it("the case page data is masked too, even for approvers", async () => {
    const c = await createCase();
    actAs(await createUser("approver"));
    const data = await loadCase(c.id);
    const json = JSON.stringify(data);
    expect(json).not.toContain(SSN);
    expect(json).not.toContain(DOB);
    expect(data?.kycCase.ssnMasked).toBe("*******3456");
    expect(data).toMatchObject({ canReveal: true, canDecide: true, canWork: false });
  });

  it("filters by status, risk and assigned to me", async () => {
    const agent = await createUser("agent");
    const other = await createUser("agent");
    await createCase({ status: "pending", riskLevel: "low" });
    await createCase({ status: "in_review", riskLevel: "high", assigneeId: agent.id });
    await createCase({ status: "in_review", riskLevel: "high", assigneeId: other.id });
    await createCase({ status: "escalated", riskLevel: "high", assigneeId: agent.id });
    actAs(agent);
    expect((await loadQueue({ status: "in_review" })).cases).toHaveLength(2);
    expect((await loadQueue({ risk: "high" })).cases).toHaveLength(3);
    expect((await loadQueue({ mine: true })).cases).toHaveLength(2);
    expect((await loadQueue({ status: "in_review", risk: "high", mine: true })).cases).toHaveLength(1);
    expect((await loadQueue({ risk: "low", mine: true })).cases).toHaveLength(0);
  });
});

describe("kyc: permissions on actions", () => {
  it("an agent can't approve or reject; denials are audited and nothing changes", async () => {
    const c = await createCase();
    const agent = await createUser("agent");
    await expectDenied(agent, "kyc.decide", c.id, () => decideCase({ caseId: c.id, decision: "approved", reason: "Looks fine" }));
    await expectDenied(agent, "kyc.decide", c.id, () => decideCase({ caseId: c.id, decision: "rejected", reason: "Bad doc" }));
  });

  it("an agent can't reveal the SSN; the denial is audited without the SSN", async () => {
    const c = await createCase();
    await expectDenied(await createUser("agent"), "kyc.reveal_ssn", c.id, () => revealSsn({ caseId: c.id }));
    expect(JSON.stringify(await db.auditEvent.findMany())).not.toContain(SSN);
  });

  it("a viewer can't do anything", async () => {
    const c = await createCase();
    const viewer = await createUser("viewer");
    await expectDenied(viewer, "kyc.assign", c.id, () => assignCaseToMe({ caseId: c.id }));
    await expectDenied(viewer, "kyc.add_note", c.id, () => addCaseNote({ caseId: c.id, body: "hi" }));
    await expectDenied(viewer, "kyc.escalate", c.id, () => escalateCase({ caseId: c.id, reason: "why" }));
    await expectDenied(viewer, "kyc.decide", c.id, () => decideCase({ caseId: c.id, decision: "approved", reason: "ok" }));
    await expectDenied(viewer, "kyc.reveal_ssn", c.id, () => revealSsn({ caseId: c.id }));
  });

  it("an approver can't assign, add notes or escalate", async () => {
    const c = await createCase();
    const approver = await createUser("approver");
    await expectDenied(approver, "kyc.assign", c.id, () => assignCaseToMe({ caseId: c.id }));
    await expectDenied(approver, "kyc.add_note", c.id, () => addCaseNote({ caseId: c.id, body: "hi" }));
    await expectDenied(approver, "kyc.escalate", c.id, () => escalateCase({ caseId: c.id, reason: "why" }));
  });

  it("an admin can't decide a case they are assigned to or escalated", async () => {
    const admin = await createUser("admin");
    const assigned = await createCase({ status: "in_review", assigneeId: admin.id });
    await expectDenied(admin, "kyc.decide", assigned.id, () => decideCase({ caseId: assigned.id, decision: "approved", reason: "ok" }));

    const c = await createCase();
    actAs(admin);
    await escalateCase({ caseId: c.id, reason: "Needs a second look" });
    await expectDenied(admin, "kyc.decide", c.id, () => decideCase({ caseId: c.id, decision: "approved", reason: "ok" }));
  });
});

describe("kyc: reveal", () => {
  it("an approver can reveal the SSN; the reveal is audited with who and which case, never the SSN", async () => {
    const c = await createCase();
    const approver = await createUser("approver");
    actAs(approver);
    const before = await snapshot();

    await expect(revealSsn({ caseId: c.id })).resolves.toEqual({ ssn: SSN });

    const after = await snapshot();
    expect(after.cases).toEqual(before.cases);
    const added = after.audits.slice(before.audits.length);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      actorId: approver.id,
      actorName: approver.name,
      action: "kyc.reveal_ssn",
      resourceType: "kyc_case",
      resourceId: c.id,
      outcome: "success",
      before: null,
    });
    expect(JSON.parse(added[0].after!)).toEqual({ revealedField: "ssn" });
    const json = JSON.stringify(added);
    expect(json).not.toContain(SSN);
    expect(json).not.toContain("3456");
  });

  it("an admin can reveal, including on a final case", async () => {
    const c = await createCase({ status: "approved" });
    actAs(await createUser("admin"));
    await expect(revealSsn({ caseId: c.id })).resolves.toEqual({ ssn: SSN });
  });
});

describe("kyc: decisions and escalation", () => {
  it("reject, approve and escalate all require a reason", async () => {
    const c = await createCase();
    const before = await snapshot();
    actAs(await createUser("approver"));
    for (const decision of ["rejected", "approved"] as const) {
      await expect(decideCase({ caseId: c.id, decision })).rejects.toBeInstanceOf(ValidationError);
      await expect(decideCase({ caseId: c.id, decision, reason: "   " })).rejects.toBeInstanceOf(ValidationError);
    }
    actAs(await createUser("agent"));
    await expect(escalateCase({ caseId: c.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(escalateCase({ caseId: c.id, reason: "" })).rejects.toBeInstanceOf(ValidationError);
    const after = await snapshot();
    expect(after.cases).toEqual(before.cases);
    expect(after.audits).toEqual(before.audits);
  });

  it("an agent escalates; an approver then approves the escalated case; both are audited with PII redacted", async () => {
    const c = await createCase();
    const agent = await createUser("agent");
    actAs(agent);
    await escalateCase({ caseId: c.id, reason: "Selfie mismatch" });
    const approver = await createUser("approver");
    actAs(approver);
    await expect(decideCase({ caseId: c.id, decision: "approved", reason: "Verified by video call" })).resolves.toEqual({
      id: c.id,
      status: "approved",
    });

    expect(await db.kycCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
      status: "approved",
      escalatedById: agent.id,
      escalationReason: "Selfie mismatch",
      decidedById: approver.id,
      decisionReason: "Verified by video call",
    });
    const audits = await db.auditEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => [a.action, a.outcome, a.actorId])).toEqual([
      ["kyc.escalate", "success", agent.id],
      ["kyc.decide", "success", approver.id],
    ]);
    expect(JSON.parse(audits[1].before!)).toMatchObject({ status: "escalated", ssn: "[redacted]", dateOfBirth: "[redacted]", customerName: "[redacted]" });
    expect(JSON.parse(audits[1].after!)).toMatchObject({ status: "approved", decisionReason: "Verified by video call" });
    const json = JSON.stringify(audits);
    for (const pii of [SSN, DOB, NAME]) expect(json).not.toContain(pii);
  });

  it("an approver can reject with a reason", async () => {
    const c = await createCase({ status: "in_review" });
    actAs(await createUser("approver"));
    await decideCase({ caseId: c.id, decision: "rejected", reason: "Document appears altered" });
    expect(await db.kycCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ status: "rejected", decisionReason: "Document appears altered" });
  });

  it("an escalated case can't be escalated again", async () => {
    const c = await createCase({ status: "escalated" });
    actAs(await createUser("agent"));
    await expect(escalateCase({ caseId: c.id, reason: "again" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("kyc: final cases", () => {
  it.each(["approved", "rejected"])("a %s case can't be changed by any action", async (status) => {
    const agent = await createUser("agent");
    const admin = await createUser("admin");
    const c = await createCase({ status });
    const before = await snapshot();

    actAs(agent);
    await expect(assignCaseToMe({ caseId: c.id })).rejects.toBeInstanceOf(ConflictError);
    await expect(addCaseNote({ caseId: c.id, body: "late note" })).rejects.toBeInstanceOf(ConflictError);
    await expect(escalateCase({ caseId: c.id, reason: "too late" })).rejects.toBeInstanceOf(ConflictError);
    actAs(admin);
    await expect(decideCase({ caseId: c.id, decision: "approved", reason: "flip" })).rejects.toBeInstanceOf(ConflictError);
    await expect(decideCase({ caseId: c.id, decision: "rejected", reason: "flip" })).rejects.toBeInstanceOf(ConflictError);

    expect(await snapshot()).toEqual(before);
  });
});

describe("kyc: notes and assign-to-me", () => {
  it("an agent assigns an unassigned pending case to themselves; it moves to in_review", async () => {
    const c = await createCase();
    const agent = await createUser("agent");
    actAs(agent);
    await expect(assignCaseToMe({ caseId: c.id })).resolves.toEqual({ id: c.id, status: "in_review" });
    expect(await db.kycCase.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ assigneeId: agent.id, status: "in_review" });
    const audits = await db.auditEvent.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "kyc.assign", outcome: "success", actorId: agent.id, resourceId: c.id });
    expect(audits[0].after).not.toContain(SSN);
    const saved = await db.kycCase.findUniqueOrThrow({ where: { id: c.id } });
    expect(JSON.parse(audits[0].after!).updatedAt).toBe(saved.updatedAt.toISOString());
    expect((await loadQueue({ mine: true })).cases.map((x) => x.id)).toEqual([c.id]);
  });

  it("an already-assigned case can't be taken", async () => {
    const owner = await createUser("agent");
    const c = await createCase({ status: "in_review", assigneeId: owner.id });
    actAs(await createUser("agent"));
    const before = await snapshot();
    await expect(assignCaseToMe({ caseId: c.id })).rejects.toBeInstanceOf(ConflictError);
    expect(await snapshot()).toEqual(before);
  });

  it("an agent adds a note; the case page shows it and its audit history", async () => {
    const c = await createCase();
    const agent = await createUser("agent");
    actAs(agent);
    await addCaseNote({ caseId: c.id, body: "Called customer, awaiting utility bill" });

    const data = await loadCase(c.id);
    expect(data?.notes).toEqual([
      expect.objectContaining({ body: "Called customer, awaiting utility bill", authorName: agent.name }),
    ]);
    expect(data?.history).toHaveLength(1);
    expect(data?.history[0]).toMatchObject({ action: "kyc.add_note", outcome: "success", actorId: agent.id });
  });

  it("an empty note is rejected", async () => {
    const c = await createCase();
    actAs(await createUser("agent"));
    await expect(addCaseNote({ caseId: c.id, body: "   " })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.kycNote.count()).toBe(0);
  });
});
