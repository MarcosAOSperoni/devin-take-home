import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="mb-2 text-xl font-semibold">403 — Not allowed</h1>
      <p className="mb-4 text-sm text-gray-600">Your role does not have permission to view this page.</p>
      <Link href="/" className="text-blue-700 hover:underline">
        Home
      </Link>{" "}
      ·{" "}
      <Link href="/login" className="text-blue-700 hover:underline">
        Switch user
      </Link>
    </main>
  );
}
