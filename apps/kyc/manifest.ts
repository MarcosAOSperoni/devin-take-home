import type { AppManifest } from "@/platform/ui/manifest";

export const kycManifest: AppManifest = {
  name: "KYC review queue",
  route: "/kyc",
  readPermission: "kyc:read",
  config: {},
};
