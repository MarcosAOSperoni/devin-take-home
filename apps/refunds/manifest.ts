import type { AppManifest } from "@/platform/ui/manifest";

export type RefundsConfig = { approvalThresholdCents: number };

export const refundsManifest: AppManifest<RefundsConfig> = {
  name: "Refunds",
  route: "/refunds",
  readPermission: "refunds:read",
  config: { approvalThresholdCents: 50000 },
};
