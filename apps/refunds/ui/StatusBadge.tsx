const COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs ${COLORS[status] ?? "bg-gray-100"}`}>{status}</span>;
}
