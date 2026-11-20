---
name: new-internal-app
description: "Use when adding a new internal app to this repo"
---

Worked example: `apps/refunds/`. Human guide: `docs/ADDING_AN_APP.md`. Also follow the `scope`, `write-path`, `permissions` and `fake-data-and-pii` skills.

## Procedure
1. Create `apps/<name>/` with `manifest.ts`, `schemas.ts`, `actions.ts`, `queries.ts`, `server-actions.ts`, `ui/` and `<name>.test.ts`.
2. Write the manifest (`name`, `route`, `readPermission`, `config`). Add the permissions to `PERMISSIONS` and `ROLE_PERMISSIONS` in `platform/rbac/permissions.ts`.
3. Add models to `prisma/schema.prisma` and run `npx prisma migrate dev --name add_<name>`. Commit the migration.
4. Write every mutation with `defineAction` and write only through `ctx.tx`. Return `{ resourceId, before, after, result }`.
5. For any maker-checker step, call `requestApproval`/`decideApproval` inside `run`. Also check the record's own status and update it with a conditional `updateMany`, as `decideRefund` does.
6. Show every PII field with `mask()`, masked in the loader. A reveal is a read: write it as a `defineAction` with its own reveal permission. That checks permission on the server and audits denials. Return the value only in `result`. Never put it in `before`/`after`, errors or logs, and list the field in `sensitive` too.
7. On every action, set `sensitive` to every PII key name. Set `resourceIdKey` when the input names an existing record.
8. Start every loader with `requireUser()` + `requirePermission(user, READ)`, including guard loaders for pages that load no data. Pages call loaders via `orForbidden()`.
9. Register the manifest in `APPS` (`platform/ui/apps.ts`). Add routes as one-line re-exports under `app/(platform)/<name>/`.
10. Add fake seed data to `prisma/seed.ts`. Add tests, and add your tables to the cleanup in `tests/setup.ts`.

## Specifications
- Every write goes through `defineAction`. No other file calls Prisma create/update/delete.
- Every read and write checks permission on the server with `can`/`requirePermission`. Hiding UI is not a check.
- New permissions are in the single map in `platform/rbac/permissions.ts`, not inline.
- For each action, tests show that a role without the permission is rejected, data is unchanged, and one `denied` audit row exists.
- Tests show that a success writes one audit row with PII redacted, and cover every approval rule (self-approval, double decide, reject reason).
- `npm test` and `npm run build` pass.

## Advice
- Only `ForbiddenError` thrown in `run` gets a `denied` audit row (pass the resource id as its 2nd arg). Validation and other errors roll back with no audit row.
- `sensitive` matches key names at any depth and also applies to `ctx.audit` rows. Redaction fails silently on a renamed or aliased key.
- Raw values rendered in a server component, or passed to a client component, end up in the browser. Mask in the loader.
- Delete your tables before `user` in `prisma/seed.ts` and `tests/setup.ts`, or foreign keys break the cleanup.
- Money is integer cents. Parse form input with `parseDollarsToCents`, which rejects inputs like `125,50`.
- Server-action wrappers return only `userFacingMessage(error)`, so input values never appear in errors.
- This is Next.js 16: `params`/`searchParams` are Promises. Read `AGENTS.md`.
- Admin gets every new permission, including any reveal permission.

## Forbidden actions
- No new dependencies without asking.
- No direct Prisma writes outside `defineAction` (seed and test setup are the only exceptions).
- No changes to `/platform` unless the task requires it. Adding permissions and the `APPS` entry is expected. For anything else, say why in the PR.

## Required from user
A one-paragraph description of the app: what records it manages, who uses it (roles), which actions each role can take, which fields are PII, and which steps need a second-person approval.
