import { z } from "zod";

export const KYC_STATUSES = ["pending", "in_review", "escalated", "approved", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];
export const FINAL_STATUSES: readonly KycStatus[] = ["approved", "rejected"];
export const OPEN_STATUSES: KycStatus[] = ["pending", "in_review", "escalated"];
export const ESCALATABLE_STATUSES: KycStatus[] = ["pending", "in_review"];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

const caseId = z.string().min(1).max(200);
const reason = z.string().trim().min(1, "A reason is required").max(1000);

export const caseIdInput = z.object({ caseId });

export const addNoteInput = z.object({
  caseId,
  body: z.string().trim().min(1, "A note cannot be empty").max(2000),
});

export const escalateCaseInput = z.object({ caseId, reason });

export const decideCaseInput = z.object({
  caseId,
  decision: z.enum(["approved", "rejected"]),
  reason,
});

export const kycFilters = z.object({
  status: z.enum(KYC_STATUSES).optional().catch(undefined),
  risk: z.enum(RISK_LEVELS).optional().catch(undefined),
  mine: z.boolean().optional().catch(undefined),
});
export type KycFilters = z.infer<typeof kycFilters>;
