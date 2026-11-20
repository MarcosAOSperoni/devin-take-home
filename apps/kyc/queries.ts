// Server-side read loaders. Each one checks permission before touching data.
// PII (SSN, date of birth) is masked here so raw values never reach the browser.
import { requireUser } from "@/platform/auth";
import { loadResourceHistory } from "@/platform/audit";
import { db } from "@/platform/db";
import { mask } from "@/platform/pii";
import { can, requirePermission } from "@/platform/rbac";
import { kycManifest } from "./manifest";
import type { KycFilters } from "./schemas";

const READ = kycManifest.readPermission;

type CaseRow = {
  id: string;
  reference: string;
  customerName: string;
  dateOfBirth: string;
  country: string;
  documentType: string;
  riskLevel: string;
  ssn: string;
  status: string;
  assigneeId: string | null;
  escalationReason: string | null;
  decisionReason: string | null;
  createdAt: Date;
  assignee: { name: string } | null;
};

/** Builds the browser-safe view of a case. Raw ssn/dateOfBirth are not copied. */
function toCaseView(c: CaseRow) {
  return {
    id: c.id,
    reference: c.reference,
    customerName: c.customerName,
    dateOfBirthMasked: mask(c.dateOfBirth, { showLast: 0 }),
    country: c.country,
    documentType: c.documentType,
    riskLevel: c.riskLevel,
    ssnMasked: mask(c.ssn, { showLast: 4 }),
    status: c.status,
    assigneeId: c.assigneeId,
    assigneeName: c.assignee?.name ?? null,
    escalationReason: c.escalationReason,
    decisionReason: c.decisionReason,
    createdAt: c.createdAt,
  };
}
export type CaseView = ReturnType<typeof toCaseView>;

export async function loadQueue(filters: KycFilters = {}) {
  const user = await requireUser();
  requirePermission(user, READ);
  const rows = await db.kycCase.findMany({
    where: {
      status: filters.status,
      riskLevel: filters.risk,
      assigneeId: filters.mine ? user.id : undefined,
    },
    include: { assignee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { cases: rows.map(toCaseView), currentUserId: user.id };
}

export async function loadCase(id: string) {
  const user = await requireUser();
  requirePermission(user, READ);
  const row = await db.kycCase.findUnique({
    where: { id },
    include: {
      assignee: { select: { name: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  const history = await loadResourceHistory(READ, "kyc_case", id);
  return {
    kycCase: toCaseView(row),
    notes: row.notes.map((n) => ({ id: n.id, body: n.body, authorName: n.author.name, createdAt: n.createdAt })),
    history,
    currentUserId: user.id,
    canWork: can(user, "kyc:work"),
    canDecide: can(user, "kyc:decide"),
    canReveal: can(user, "kyc:reveal_ssn"),
  };
}
