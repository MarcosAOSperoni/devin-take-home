---
name: permissions
description: Use when adding or changing an action, a page, a data loader, or the permissions map in internal-tools.
---

Permission checks happen on the server with `can(user, permission)` from `platform/rbac`, for reads as well as writes.

- Every page, data loader, and route handler checks the read permission before loading data. Hiding a button is not a permission check.
- New permissions go in the single permissions map, not inline.
- Every new action needs a test showing a role without the permission is rejected and that the denied attempt is audited.
- Any approval step must not let a user approve their own request.
