export type MaskOptions = { showLast?: number; maskChar?: string };

/** mask("900-12-3456", { showLast: 4 }) -> "*******3456". Short values are fully masked. */
export function mask(value: string | null | undefined, { showLast = 4, maskChar = "*" }: MaskOptions = {}): string {
  if (!value) return "";
  const keep = Math.max(0, Math.floor(showLast));
  if (value.length <= keep) return maskChar.repeat(value.length);
  return maskChar.repeat(value.length - keep) + value.slice(value.length - keep);
}
