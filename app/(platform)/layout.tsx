import { requireUser } from "@/platform/auth";
import { Layout } from "@/platform/ui/Layout";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <Layout user={user}>{children}</Layout>;
}
