import { getCurrentUser } from "@/platform/auth";
import { listDemoUsers } from "@/platform/auth/mock-provider";
import { signIn } from "./actions";

export default async function LoginPage() {
  const [users, current] = await Promise.all([listDemoUsers(), getCurrentUser()]);
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-xl font-semibold">Sign in (demo)</h1>
      <p className="mb-6 rounded border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-900">
        Mock auth for demo only. Insecure by design: anyone can pick any user. Replace with real SSO (e.g. Entra
        ID) before real use.
      </p>
      <ul className="grid gap-2">
        {users.map((u) => (
          <li key={u.id}>
            <form action={signIn}>
              <input type="hidden" name="userId" value={u.id} />
              <button
                type="submit"
                className="flex w-full justify-between rounded border px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span>
                  {u.name}
                  {current?.id === u.id ? " (current)" : ""}
                </span>
                <span className="text-gray-600">{u.role}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
