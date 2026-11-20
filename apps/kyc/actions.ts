import { defineAction } from "@/platform/action";
import type { Tx } from "@/platform/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/platform/errors";
import {
  addNoteInput,
  caseIdInput,
  decideCaseInput,
  ESCALATABLE_STATUSES,
  escalateCaseInput,
  FINAL_STATUSES,
  OPEN_STATUSES,
  type KycStatus,
} from "./schemas";

const RESOURCE = "kyc_case";
// Every PII key on a KycCase. Stored as "[redacted]" in audit JSON.
const SENSITIVE = ["ssn", "dateOfBirth", "customerName"] as const;

async function findOpenCase(tx: Tx, caseId: string) {
  const kycCase = await tx.kycCase.findUnique({ where: { id: caseId } });
  if (!kycCase) throw new NotFoundError("Case not found");
  if (FINAL_STATUSES.includes(kycCase.status as KycStatus)) throw new ConflictError("This case is final and cannot be changed");
  return kycCase;
}

export const assignCaseToMe = defineAction({
  name: "kyc.assign",
  permission: "kyc:work",
  resourceType: RESOURCE,
  input: caseIdInput,
  sensitive: SENSITIVE,
  resourceIdKey: "caseId",
  async run(ctx, input) {
    const before = await findOpenCase(ctx.tx, input.caseId);
    const data = { assigneeId: ctx.user.id, status: "in_review" as const };
    const { count } = await ctx.tx.kycCase.updateMany({
      where: { id: before.id, status: "pending", assigneeId: null },
      data,
    });
    if (count === 0) throw new ConflictError("Only an unassigned pending case can be assigned");
    const after = { ...before, ...data };
    return { resourceId: before.id, before, after, result: { id: before.id, status: after.status } };
  },
});

export const addCaseNote = defineAction({
  name: "kyc.add_note",
  permission: "kyc:work",
  resourceType: RESOURCE,
  input: addNoteInput,
  sensitive: SENSITIVE,
  resourceIdKey: "caseId",
  async run(ctx, input) {
    const kycCase = await findOpenCase(ctx.tx, input.caseId);
    // Conditional touch so a note can't land on a case finalized concurrently.
    const { count } = await ctx.tx.kycCase.updateMany({
      where: { id: kycCase.id, status: { in: OPEN_STATUSES } },
      data: { updatedAt: new Date() },
    });
    if (count === 0) throw new ConflictError("This case is final and cannot be changed");
    const note = await ctx.tx.kycNote.create({
      data: { caseId: kycCase.id, authorId: ctx.user.id, body: input.body },
    });
    return { resourceId: kycCase.id, before: null, after: { note }, result: { id: note.id } };
  },
});

export const escalateCase = defineAction({
  name: "kyc.escalate",
  permission: "kyc:work",
  resourceType: RESOURCE,
  input: escalateCaseInput,
  sensitive: SENSITIVE,
  resourceIdKey: "caseId",
  async run(ctx, input) {
    const before = await findOpenCase(ctx.tx, input.caseId);
    const data = { status: "escalated" as const, escalatedById: ctx.user.id, escalationReason: input.reason };
    const { count } = await ctx.tx.kycCase.updateMany({
      where: { id: before.id, status: { in: ESCALATABLE_STATUSES } },
      data,
    });
    if (count === 0) throw new ConflictError("Only a pending or in-review case can be escalated");
    const after = { ...before, ...data };
    return { resourceId: before.id, before, after, result: { id: before.id, status: after.status } };
  },
});

export const decideCase = defineAction({
  name: "kyc.decide",
  permission: "kyc:decide",
  resourceType: RESOURCE,
  input: decideCaseInput,
  sensitive: SENSITIVE,
  resourceIdKey: "caseId",
  async run(ctx, input) {
    const before = await findOpenCase(ctx.tx, input.caseId);
    // Maker-checker: whoever worked or escalated the case cannot also decide it.
    if (before.assigneeId === ctx.user.id || before.escalatedById === ctx.user.id) {
      throw new ForbiddenError("You cannot decide a case you worked on", before.id);
    }
    const data = { status: input.decision, decidedById: ctx.user.id, decisionReason: input.reason };
    const { count } = await ctx.tx.kycCase.updateMany({
      where: { id: before.id, status: { in: OPEN_STATUSES } },
      data,
    });
    if (count === 0) throw new ConflictError("This case is final and cannot be changed");
    const after = { ...before, ...data };
    return { resourceId: before.id, before, after, result: { id: before.id, status: after.status } };
  },
});

/** An audited read: the full SSN is returned only in this result, never in the audit row. */
export const revealSsn = defineAction({
  name: "kyc.reveal_ssn",
  permission: "kyc:reveal_ssn",
  resourceType: RESOURCE,
  input: caseIdInput,
  sensitive: SENSITIVE,
  resourceIdKey: "caseId",
  async run(ctx, input) {
    const kycCase = await ctx.tx.kycCase.findUnique({ where: { id: input.caseId }, select: { id: true, ssn: true } });
    if (!kycCase) throw new NotFoundError("Case not found");
    return { resourceId: kycCase.id, before: null, after: { revealedField: "ssn" }, result: { ssn: kycCase.ssn } };
  },
});
