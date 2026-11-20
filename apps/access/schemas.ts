import { z } from "zod";

export const SYSTEMS = ["payments-db", "kyc-db", "admin-console"] as const;
export const DURATIONS = [1, 4, 24] as const;

/** Stored statuses. denied and revoked are final. */
export const STORED_STATUSES = ["pending", "approved", "denied", "revoked"] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];

/** What users see: an approved grant is "active" until expiresAt, then "expired" (also final). */
export const DISPLAY_STATUSES = ["active", "pending", "expired", "denied", "revoked"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export function displayStatus(r: { status: string; expiresAt: Date | null }, now = new Date()): DisplayStatus {
  if (r.status === "approved") return r.expiresAt && r.expiresAt > now ? "active" : "expired";
  return r.status as DisplayStatus;
}

const requestId = z.string().min(1).max(200);
const reason = z.string().trim().min(1, "A reason is required").max(1000);

export const requestAccessInput = z.object({
  system: z.enum(SYSTEMS),
  reason,
  durationHours: z.coerce
    .number()
    .refine((n) => (DURATIONS as readonly number[]).includes(n), "Duration must be 1, 4 or 24 hours"),
});

export const decideAccessInput = z.object({
  requestId,
  decision: z.enum(["approved", "rejected"]),
  reason,
});

export const revokeAccessInput = z.object({ requestId, reason });

export const accessFilters = z.object({
  status: z.enum(DISPLAY_STATUSES).optional().catch(undefined),
  system: z.enum(SYSTEMS).optional().catch(undefined),
  mine: z.boolean().optional().catch(undefined),
});
export type AccessFilters = z.infer<typeof accessFilters>;
