# Adding an internal app

Every app lives in `apps/<name>/` and builds on the shared code in `platform/`. This guide uses the Refunds app (`apps/refunds/`) as the example. Read the team rules in `.agents/skills/` first.

## 1. Permissions

Add the app's permissions to `PERMISSIONS`, and grant them to roles in `ROLE_PERMISSIONS`, in `platform/rbac/permissions.ts`. That file is the single permissions map. Admin gets every permission automatically.

Refunds uses `refunds:read`, `refunds:request` and `refunds:approve`. A viewer can only read, an agent can read and request, and an approver can read and approve.

## 2. Database

Add the app's models to `prisma/schema.prisma`, then create a migration:

```bash
npx prisma migrate dev --name add_<name>
```

Refunds adds one model, `Refund`. It stores money as integer cents (`amountCents`) and status as a string with the allowed values in a comment. Approvals and audit rows use the shared `Approval` and `AuditEvent` tables, so you don't need your own.

## 3. Manifest and registration

`apps/refunds/manifest.ts` exports `name`, `route`, `readPermission` and app config (`approvalThresholdCents: 50000`). Add your manifest to the hardcoded `APPS` list in `platform/ui/apps.ts`. The home page lists only the apps the user can read.

## 4. Input schemas

`apps/refunds/schemas.ts` holds the zod schemas for every action input and for list filters. Validation runs on the server inside `defineAction`.

## 5. Actions: the only way to write

Every create, update or delete is a `defineAction` in `apps/<name>/actions.ts`:

```ts
export const decideRefund = defineAction({
  name: "refunds.decide",
  permission: "refunds:approve",
  resourceType: "refund",
  input: decideRefundInput,
  sensitive: ["customerName"],   // stored as "[redacted]" in audit JSON
  resourceIdKey: "refundId",     // labels the audit row when the call is denied
  async run(ctx, input) {        // ctx = { user, tx, audit }
    // write only through ctx.tx
    return { resourceId, before, after, result };
  },
});
```

`defineAction` authenticates the user, checks the permission (a denied call is audited), validates the input, then runs `run` and writes the success `AuditEvent` in one transaction.

**Approvals.** If a change needs sign-off by a second person, call `requestApproval(ctx, …)` and `decideApproval(ctx, …)` from inside `run`. Refunds requests an approval when the amount is over the threshold. `decideRefund` decides the approval and updates the refund status in one transaction. `decideApproval` blocks self-approval, double decisions and approvals that belong to another record. Your action must still check the record's own status, and should update it with a conditional `updateMany` as refunds does.

## 6. Read loaders

`apps/refunds/queries.ts` has one loader per page. Each loader calls `requireUser()` and `requirePermission(user, READ)` before querying. A page that loads no data still gets a guard loader (see `loadRequestForm`). Hiding a button is not a permission check.

**PII.** Show PII (SSNs, account numbers, dates of birth) through `mask()` from `platform/pii`, and mask it in the loader so the raw value never reaches the browser. Refunds has no masked fields yet. If your app needs a "reveal" button, add a separate reveal permission and a `defineAction` that:

- reads the record,
- returns the value only in its result,
- keeps the value out of `before`/`after`, and lists the field in `sensitive`.

The permission is then checked on the server, denied attempts are audited, and the success audit row records who revealed which field but never the value.

## 7. UI and routes

Page components go in `apps/<name>/ui/` and call loaders through `orForbidden()`, which turns a `ForbiddenError` into a 403 page. Forms call thin `"use server"` wrappers (`apps/refunds/server-actions.ts`). The wrappers call the action and show only `userFacingMessage(error)`. Routes are one-line re-exports under `app/(platform)/<name>/`, for example `app/(platform)/refunds/page.tsx`.

## 8. Seed data

Add obviously fake rows to `prisma/seed.ts` (fake names, SSNs in the 900-xx-xxxx range, made-up IDs). Seeds write directly with Prisma and have no audit history. Delete your tables at the top of `main()`, before `user`, because of foreign keys.

## 9. Tests

Follow `apps/refunds/refunds.test.ts` and `tests/reads.test.ts`:

- For each action: a role without the permission is rejected, nothing changes, and exactly one `denied` audit row exists.
- A successful write creates exactly one success audit row, with PII redacted.
- For approvals: self-approval is denied, a decision cannot be made twice, and rejecting requires a reason.
- Each loader rejects roles without read permission.

Add your tables to the cleanup in `tests/setup.ts`, before `user`.

Then run `npm test` and `npm run build`.
