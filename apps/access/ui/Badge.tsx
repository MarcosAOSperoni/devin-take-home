const COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  expired: "bg-gray-100 text-gray-700",
  denied: "bg-red-100 text-red-800",
  revoked: "bg-orange-100 text-orange-800",
};

export function Badge({ value }: { value: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs ${COLORS[value] ?? "bg-gray-100"}`}>{value}</span>;
}
