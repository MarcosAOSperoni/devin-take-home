---
name: fake-data-and-pii
description: Use when writing seed data, fixtures, tests, audit logging, or anything that stores or displays customer data in internal-tools.
---

- Use only obviously fake data: fake names, SSNs in the 900-xx-xxxx range, made-up order IDs. Never use real people, real account numbers, or real-looking production values.
- Show PII (SSNs, account numbers, dates of birth) masked with `mask()` from `platform/pii`.
- Unmasked values must never be sent to the browser unless the user explicitly revealed them through an audited reveal.
- Never write PII or secrets into audit records, logs, or error messages; redact them.
