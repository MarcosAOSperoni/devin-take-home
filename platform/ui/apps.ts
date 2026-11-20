import { kycManifest } from "@/apps/kyc/manifest";
import { refundsManifest } from "@/apps/refunds/manifest";
import type { AppManifest } from "./manifest";

const auditManifest: AppManifest = {
  name: "Audit log",
  route: "/admin/audit",
  readPermission: "audit:read",
  config: {},
};

/** Hardcoded on purpose: adding an app means adding its manifest here. */
export const APPS: readonly AppManifest[] = [refundsManifest, kycManifest, auditManifest];
