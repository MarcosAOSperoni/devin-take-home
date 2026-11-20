export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "12.34" -> 1234. Returns null for anything that isn't a positive amount with at most 2 decimals. */
export function parseDollarsToCents(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16);
}
