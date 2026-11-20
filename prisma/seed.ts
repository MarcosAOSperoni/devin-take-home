// Fake data only. Seeds write directly with Prisma (bypassing defineAction) and create no audit rows.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Deterministic PRNG so every seed run produces the same data.
let state = 42;
function rand(): number {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

const FIRST = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank", "Grace", "Heidi", "Ivan", "Judy"];
const LAST = ["Example", "Sample", "Placeholder", "Testerson", "Fakename", "Demo", "Mockley"];
const REASONS = ["Item damaged", "Late delivery", "Duplicate charge", "Wrong item shipped", "Service not provided"];

async function main() {
  await db.auditEvent.deleteMany();
  await db.approval.deleteMany();
  await db.refund.deleteMany();
  await db.kycNote.deleteMany();
  await db.kycCase.deleteMany();
  await db.accessRequest.deleteMany();
  await db.user.deleteMany();

  const mk = (name: string, email: string, role: string) => db.user.create({ data: { name, email, role } });
  const viewer = await mk("Vera Viewer", "viewer@example.test", "viewer");
  const agent = await mk("Andy Agent", "agent@example.test", "agent");
  const agent2 = await mk("Abby Agent", "agent2@example.test", "agent");
  const approver = await mk("Pat Approver", "approver@example.test", "approver");
  const admin = await mk("Ada Admin", "admin@example.test", "admin");
  void viewer;

  const threshold = 50000;
  const now = Date.now();
  for (let i = 0; i < 50; i++) {
    // $5.00 to $2,000.00
    const amountCents = 500 + Math.floor(rand() * (200000 - 500 + 1));
    const requester = pick([agent, agent2, admin]);
    const createdAt = new Date(now - Math.floor(rand() * 30 * 24 * 3600 * 1000));
    let status = "approved";
    if (amountCents > threshold) status = pick(["approved", "pending_approval", "pending_approval", "rejected"]);
    else if (rand() < 0.1) status = "rejected";

    const refund = await db.refund.create({
      data: {
        orderId: `ORD-${100000 + i}`,
        customerName: `${pick(FIRST)} ${pick(LAST)}`,
        amountCents,
        reason: pick(REASONS),
        status,
        requestedById: requester.id,
        createdAt,
      },
    });

    if (amountCents > threshold) {
      const decided = status !== "pending_approval";
      await db.approval.create({
        data: {
          resourceType: "refund",
          resourceId: refund.id,
          requestedById: requester.id,
          createdAt,
          ...(decided && {
            decidedById: approver.id,
            decision: status,
            reason: status === "rejected" ? "Outside refund policy" : null,
            decidedAt: new Date(createdAt.getTime() + 3600 * 1000),
          }),
        },
      });
    }
  }

  const counts = await db.refund.groupBy({ by: ["status"], _count: true });
  console.log("Seeded 5 users and 50 refunds:", counts.map((c) => `${c.status}=${c._count}`).join(", "));

  // KYC: 30 cases. i % 5 and i % 3 cover every status x risk combination twice.
  const KYC_STATUSES = ["pending", "in_review", "escalated", "approved", "rejected"];
  const RISKS = ["low", "medium", "high"];
  const COUNTRIES = ["US", "CA", "GB", "DE", "BR", "MX", "IN", "JP"];
  const DOCS = ["passport", "drivers_license", "national_id"];
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  for (let i = 0; i < 30; i++) {
    const status = KYC_STATUSES[i % 5];
    const assignee = status === "pending" ? null : pick([agent, agent2]);
    const createdAt = new Date(now - Math.floor(rand() * 14 * 24 * 3600 * 1000));
    const kycCase = await db.kycCase.create({
      data: {
        reference: `KYC-${1001 + i}`,
        customerName: `${pick(FIRST)} ${pick(LAST)}`,
        dateOfBirth: `${1950 + Math.floor(rand() * 55)}-${pad(1 + Math.floor(rand() * 12), 2)}-${pad(1 + Math.floor(rand() * 28), 2)}`,
        country: pick(COUNTRIES),
        documentType: pick(DOCS),
        riskLevel: RISKS[i % 3],
        // Fake SSNs only: 9xx area numbers are never issued.
        ssn: `9${pad(i, 2)}-${pad(10 + Math.floor(rand() * 90), 2)}-${pad(Math.floor(rand() * 10000), 4)}`,
        status,
        assigneeId: assignee?.id ?? null,
        escalatedById: status === "escalated" ? assignee?.id : null,
        escalationReason: status === "escalated" ? "Document photo does not match selfie" : null,
        decidedById: status === "approved" || status === "rejected" ? approver.id : null,
        decisionReason:
          status === "approved" ? "Documents verified" : status === "rejected" ? "Document appears altered" : null,
        createdAt,
      },
    });
    if (assignee) {
      await db.kycNote.create({
        data: { caseId: kycCase.id, authorId: assignee.id, body: "Checked document expiry and address.", createdAt },
      });
    }
  }
  const kycCounts = await db.kycCase.groupBy({ by: ["status"], _count: true });
  console.log("Seeded 30 KYC cases:", kycCounts.map((c) => `${c.status}=${c._count}`).join(", "));

  // Production access: 20 requests. "expired" is an approved grant whose expiresAt has passed.
  const SYSTEMS = ["payments-db", "kyc-db", "admin-console"];
  const DURATIONS = [1, 4, 24];
  const ACCESS_PLAN = [
    ...Array(5).fill("active"),
    ...Array(5).fill("pending"),
    ...Array(4).fill("expired"),
    ...Array(3).fill("denied"),
    ...Array(3).fill("revoked"),
  ];
  const ACCESS_REASONS = [
    "Investigate failed settlement batch (INC-4821)",
    "Backfill missing KYC flags for test cohort",
    "Rotate config for fake merchant M-0042",
    "Debug slow query reported in TICKET-9001",
    "Verify migration on staging-like replica",
  ];
  const HOUR = 3600 * 1000;
  for (let i = 0; i < ACCESS_PLAN.length; i++) {
    const plan = ACCESS_PLAN[i];
    const durationHours = DURATIONS[i % 3];
    const requester = pick([agent, agent2, admin]);
    const decidedAt =
      plan === "active" ? new Date(now - 10 * 60 * 1000)
      : plan === "expired" ? new Date(now - (durationHours + 2 + i) * HOUR)
      : plan === "pending" ? null
      : new Date(now - (i + 1) * HOUR);
    const createdAt = new Date((decidedAt?.getTime() ?? now) - (15 + i) * 60 * 1000);
    const approved = plan === "active" || plan === "expired" || plan === "revoked";
    const status = plan === "pending" ? "pending" : plan === "denied" ? "denied" : plan === "revoked" ? "revoked" : "approved";
    const request = await db.accessRequest.create({
      data: {
        requesterId: requester.id,
        system: SYSTEMS[i % 3],
        reason: pick(ACCESS_REASONS),
        durationHours,
        status,
        createdAt,
        ...(decidedAt && {
          decidedById: approver.id,
          decisionReason: approved ? "Linked ticket checks out" : "No linked incident or ticket",
          decidedAt,
          expiresAt: approved ? new Date(decidedAt.getTime() + durationHours * HOUR) : null,
        }),
        ...(plan === "revoked" && {
          revokedById: approver.id,
          revokeReason: "Work finished early",
          revokedAt: new Date(decidedAt!.getTime() + 5 * 60 * 1000),
        }),
      },
    });
    const approval = await db.approval.create({
      data: {
        resourceType: "access_request",
        resourceId: request.id,
        requestedById: requester.id,
        createdAt,
        ...(decidedAt && {
          decidedById: approver.id,
          decision: approved ? "approved" : "rejected",
          reason: approved ? "Linked ticket checks out" : "No linked incident or ticket",
          decidedAt,
        }),
      },
    });
    await db.accessRequest.update({ where: { id: request.id }, data: { approvalId: approval.id } });
  }
  console.log("Seeded 20 access requests: active=5, pending=5, expired=4, denied=3, revoked=3");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
