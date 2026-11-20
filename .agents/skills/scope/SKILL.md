---
name: scope
description: Use when planning work, adding packages, or deciding whether to build something that wasn't asked for in internal-tools.
---

This is a short proof of concept.

- Stack: Next.js App Router, TypeScript strict, Prisma + SQLite, zod, Vitest, Tailwind. Ask before adding any other dependency.
- Don't build features that weren't asked for (real SSO, deployment, notifications, design polish).
- If a task is taking much longer than expected, stop and ask rather than expanding scope.
- Before opening a PR, run `npm test` and `npm run build`, and list in the PR description anything you simplified or weren't sure about.
