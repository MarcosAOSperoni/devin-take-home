import { z } from "zod";

export const REFUND_STATUSES = ["approved", "pending_approval", "rejected"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const requestRefundInput = z.object({
  orderId: z.string().trim().min(1).max(64),
  customerName: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive().max(100_000_000),
  reason: z.string().trim().min(1).max(1000),
});

export const decideRefundInput = z
  .object({
    refundId: z.string().min(1),
    approvalId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision === "approved" || !!v.reason, {
    message: "A reason is required when rejecting",
    path: ["reason"],
  });

export const refundFilters = z.object({
  status: z.enum(REFUND_STATUSES).optional().catch(undefined),
  minCents: z.number().int().nonnegative().optional(),
  maxCents: z.number().int().nonnegative().optional(),
});
export type RefundFilters = z.infer<typeof refundFilters>;
