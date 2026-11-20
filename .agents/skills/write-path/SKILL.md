---
name: write-path
description: Use when writing or changing any code in internal-tools that creates, updates, or deletes data, including server actions and route handlers.
---

In internal-tools, the only way to change data is `defineAction` in `platform/action.ts`. It authenticates, checks permission, validates input with zod, then makes the change and writes an AuditEvent in one transaction.

- Never call Prisma create/update/delete from a page, component, route handler, or app file.
- If a task seems to need a write that `defineAction` can't express, stop and ask instead of working around it.
- During the session that first builds the platform, this describes what you are building.
