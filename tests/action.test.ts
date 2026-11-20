import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAction } from "@/platform/action";
import { db } from "@/platform/db";
import { UnauthenticatedError, ValidationError } from "@/platform/errors";
import { actAs, createUser, snapshot, validRefund } from "./helpers";

const createThenThrow = defineAction({
  name: "test.createThenThrow",
  permission: "refunds:request",
  resourceType: "refund",
  input: z.object({ orderId: z.string() }),
  async run(ctx, input) {
    await ctx.tx.refund.create({
      data: { ...validRefund(), orderId: input.orderId, status: "approved", requestedById: ctx.user.id },
    });
    await ctx.audit({ action: "test.extra", resourceType: "refund", resourceId: "x", after: { ok: true } });
    throw new Error("boom");
  },
});

const createWithSecret = defineAction({
  name: "test.createWithSecret",
  permission: "refunds:request",
  resourceType: "refund",
  input: z.object({ apiKey: z.string() }),
  sensitive: ["apiKey", "customerName"],
  async run(ctx, input) {
    const refund = await ctx.tx.refund.create({
      data: { ...validRefund(), status: "approved", requestedById: ctx.user.id },
    });
    return { resourceId: refund.id, before: null, after: { ...refund, apiKey: input.apiKey, nested: { apiKey: input.apiKey } }, result: refund };
  },
});

describe("defineAction", () => {
  it("if run() throws, no data changes and no audit rows (success or otherwise) exist", async () => {
    actAs(await createUser("agent"));
    const before = await snapshot();
    await expect(createThenThrow({ orderId: "ORD-THROW" })).rejects.toThrow("boom");
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(await db.auditEvent.count({ where: { outcome: "success" } })).toBe(0);
  });

  it("rejects unauthenticated calls without writing anything", async () => {
    await expect(createThenThrow({ orderId: "x" })).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("validates input before running", async () => {
    actAs(await createUser("agent"));
    await expect(createThenThrow({ orderId: 123 })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.refund.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);
  });

  it("checks permission before validating, and audits the denial", async () => {
    const viewer = await createUser("viewer");
    actAs(viewer);
    await expect(createThenThrow({ orderId: 123 })).rejects.toThrow("permission");
    const audits = await db.auditEvent.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ outcome: "denied", action: "test.createThenThrow", actorId: viewer.id });
    expect(await db.refund.count()).toBe(0);
  });

  it("stores sensitive fields as [redacted], including nested ones", async () => {
    actAs(await createUser("agent"));
    await createWithSecret({ apiKey: "sk-test-not-a-real-key" });
    const [audit] = await db.auditEvent.findMany();
    expect(audit.after).not.toContain("sk-test-not-a-real-key");
    expect(audit.after).not.toContain("Testy McFakeface");
    const after = JSON.parse(audit.after!);
    expect(after.apiKey).toBe("[redacted]");
    expect(after.nested.apiKey).toBe("[redacted]");
    expect(after.customerName).toBe("[redacted]");
  });
});
