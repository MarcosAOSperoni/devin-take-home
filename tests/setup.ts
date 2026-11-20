import { beforeEach } from "vitest";
import { setAuthProvider } from "@/platform/auth";
import { db } from "@/platform/db";
import { testAuthProvider, signOut } from "./helpers";

setAuthProvider(testAuthProvider);

beforeEach(async () => {
  signOut();
  // Test-only cleanup. App code has no way to delete audit rows.
  await db.auditEvent.deleteMany();
  await db.approval.deleteMany();
  await db.refund.deleteMany();
  await db.kycNote.deleteMany();
  await db.kycCase.deleteMany();
  await db.accessRequest.deleteMany();
  await db.user.deleteMany();
});
