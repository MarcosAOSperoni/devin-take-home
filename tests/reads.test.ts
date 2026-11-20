import { describe, expect, it } from "vitest";
import { loadPendingApprovals, loadRefund, loadRefunds, loadRequestForm } from "@/apps/refunds/queries";
import { loadAuditLog } from "@/platform/audit";
import { ForbiddenError } from "@/platform/errors";
import { actAs, createUser } from "./helpers";

describe("server-side read checks", () => {
  it("viewer cannot load the pending approvals page", async () => {
    actAs(await createUser("viewer"));
    await expect(loadPendingApprovals()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("viewer cannot load the audit page", async () => {
    actAs(await createUser("viewer"));
    await expect(loadAuditLog()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("agent and approver cannot load the audit page; admin can", async () => {
    actAs(await createUser("agent"));
    await expect(loadAuditLog()).rejects.toBeInstanceOf(ForbiddenError);
    actAs(await createUser("approver"));
    await expect(loadAuditLog()).rejects.toBeInstanceOf(ForbiddenError);
    actAs(await createUser("admin"));
    await expect(loadAuditLog()).resolves.toHaveProperty("events");
  });

  it("viewer cannot load the request form; agent can", async () => {
    actAs(await createUser("viewer"));
    await expect(loadRequestForm()).rejects.toBeInstanceOf(ForbiddenError);
    actAs(await createUser("agent"));
    await expect(loadRequestForm()).resolves.toEqual({ threshold: 50000 });
  });

  it("viewer can read refunds but gets no request/approve affordances", async () => {
    actAs(await createUser("viewer"));
    await expect(loadRefunds()).resolves.toMatchObject({ refunds: [], canRequest: false, canApprove: false });
    await expect(loadRefund("missing")).resolves.toBeNull();
  });

  it("approver can load pending approvals", async () => {
    actAs(await createUser("approver"));
    await expect(loadPendingApprovals()).resolves.toMatchObject({ items: [] });
  });
});
