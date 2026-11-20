import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "../auth";
import { can } from "../rbac";
import { APPS } from "./apps";

export function Layout({ user, children }: { user: User; children: ReactNode }) {
  const apps = APPS.filter((app) => can(user, app.readPermission));
  return (
    <div className="min-h-screen">
      <header className="border-b bg-gray-50">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">
            Internal Tools
          </Link>
          <nav className="flex gap-4">
            {apps.map((app) => (
              <Link key={app.route} href={app.route} className="text-blue-700 hover:underline">
                {app.name}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span>
              {user.name} <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">{user.role}</span>
            </span>
            <Link href="/login" className="text-blue-700 hover:underline">
              Switch user
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
