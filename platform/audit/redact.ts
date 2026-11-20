export const REDACTED = "[redacted]";

/** Deep-copies `value`, replacing any key listed in `sensitive` with "[redacted]". */
export function redact(value: unknown, sensitive: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, sensitive));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sensitive.includes(k) ? REDACTED : redact(v, sensitive)]),
    );
  }
  return value;
}
