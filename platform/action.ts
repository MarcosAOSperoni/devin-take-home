import type { z } from "zod";
import { getCurrentUser, type User } from "./auth";
import { insertAuditEvent } from "./audit/write";
import { db, type Tx } from "./db";
import { ForbiddenError, UnauthenticatedError, ValidationError } from "./errors";
import { can, type Permission } from "./rbac";

export type ExtraAuditEvent = {
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  sensitive?: readonly string[];
};

export type ActionContext = {
  user: User;
  tx: Tx;
  /** Record an additional success audit row in the same transaction (e.g. an approval). */
  audit(event: ExtraAuditEvent): Promise<void>;
};

export type ActionResult<T> = {
  resourceId: string;
  before: unknown;
  after: unknown;
  result: T;
};

export type ActionDefinition<S extends z.ZodType, T> = {
  name: string;
  permission: Permission;
  resourceType: string;
  input: S;
  /** Field names stored as "[redacted]" in audit before/after JSON. */
  sensitive?: readonly string[];
  /** Raw-input key holding the target resource id. Read unvalidated, only to label denied audit rows. */
  resourceIdKey?: string;
  run: (ctx: ActionContext, input: z.infer<S>) => Promise<ActionResult<T>>;
};

/**
 * The only way to write data.
 * authenticate -> authorize -> validate -> run + success audit in one transaction -> commit.
 * Denials (from authorize, or a ForbiddenError thrown by run) are audited outside the
 * rolled-back transaction. Any other error from run rolls everything back, audit included.
 */
export function defineAction<S extends z.ZodType, T>(def: ActionDefinition<S, T>) {
  const sensitive = def.sensitive ?? [];

  async function recordDenied(user: User, resourceId?: string) {
    await insertAuditEvent(db, {
      actor: user,
      action: def.name,
      resourceType: def.resourceType,
      resourceId,
      outcome: "denied",
    });
  }

  function rawResourceId(rawInput: unknown): string | undefined {
    if (!def.resourceIdKey || typeof rawInput !== "object" || rawInput === null) return undefined;
    const value = (rawInput as Record<string, unknown>)[def.resourceIdKey];
    return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : undefined;
  }

  return async function action(rawInput: unknown): Promise<T> {
    const user = await getCurrentUser();
    if (!user) throw new UnauthenticatedError();

    if (!can(user, def.permission)) {
      await recordDenied(user, rawResourceId(rawInput));
      throw new ForbiddenError();
    }

    const parsed = def.input.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
    }

    try {
      return await db.$transaction(async (tx) => {
        const ctx: ActionContext = {
          user,
          tx,
          audit: (event) =>
            insertAuditEvent(tx, {
              ...event,
              actor: user,
              outcome: "success",
              sensitive: [...sensitive, ...(event.sensitive ?? [])],
            }),
        };
        const out = await def.run(ctx, parsed.data);
        await insertAuditEvent(tx, {
          actor: user,
          action: def.name,
          resourceType: def.resourceType,
          resourceId: out.resourceId,
          before: out.before,
          after: out.after,
          outcome: "success",
          sensitive,
        });
        return out.result;
      });
    } catch (error) {
      if (error instanceof ForbiddenError) await recordDenied(user, error.resourceId ?? rawResourceId(rawInput));
      throw error;
    }
  };
}
