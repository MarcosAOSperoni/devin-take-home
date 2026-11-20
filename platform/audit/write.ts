// Internal to the platform: only platform/action.ts (and helpers it hands a ctx to) write audit rows.
// There are deliberately no update or delete functions for AuditEvent.
import type { User } from "../auth/provider";
import type { Tx } from "../db";
import { redact } from "./redact";

export type AuditOutcome = "success" | "denied";

export type AuditInput = {
  actor: User | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  outcome: AuditOutcome;
  sensitive?: readonly string[];
};

function toJson(value: unknown, sensitive: readonly string[]): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(redact(value, sensitive));
}

export async function insertAuditEvent(client: Pick<Tx, "auditEvent">, event: AuditInput): Promise<void> {
  const sensitive = event.sensitive ?? [];
  await client.auditEvent.create({
    data: {
      actorId: event.actor?.id ?? null,
      actorName: event.actor?.name ?? null,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      before: toJson(event.before, sensitive),
      after: toJson(event.after, sensitive),
      outcome: event.outcome,
    },
  });
}
