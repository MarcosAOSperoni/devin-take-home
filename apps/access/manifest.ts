import type { AppManifest } from "@/platform/ui/manifest";

export const accessManifest: AppManifest = {
  name: "Production access requests",
  route: "/access",
  readPermission: "access:read",
  config: {},
};
