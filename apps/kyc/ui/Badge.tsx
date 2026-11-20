const COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_review: "bg-blue-100 text-blue-800",
  escalated: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export function Badge({ value }: { value: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs ${COLORS[value] ?? "bg-gray-100"}`}>{value}</span>;
}
