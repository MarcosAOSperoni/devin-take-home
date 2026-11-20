import type { Permission } from "../rbac/permissions";

export type AppManifest<Config = Record<string, unknown>> = {
  name: string;
  route: string;
  readPermission: Permission;
  config: Config;
};
