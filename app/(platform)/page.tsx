import Link from "next/link";
import { requireUser } from "@/platform/auth";
import { can } from "@/platform/rbac";
import { APPS } from "@/platform/ui/apps";
import { h1, link } from "@/platform/ui/styles";

export default async function Home() {
  const user = await requireUser();
  const apps = APPS.filter((app) => can(user, app.readPermission));
  return (
    <div>
      <h1 className={h1}>Apps</h1>
      {apps.length === 0 ? (
        <p className="text-sm text-gray-600">Your role cannot see any apps.</p>
      ) : (
        <ul className="list-disc pl-5">
          {apps.map((app) => (
            <li key={app.route}>
              <Link href={app.route} className={link}>
                {app.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
