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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
