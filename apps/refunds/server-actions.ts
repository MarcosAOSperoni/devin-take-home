"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { userFacingMessage } from "@/platform/errors";
import { parseDollarsToCents } from "@/platform/ui/format";
import { decideRefund, requestRefund } from "./actions";

export type FormState = { error?: string };

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function requestRefundForm(_prev: FormState, form: FormData): Promise<FormState> {
  const amountCents = parseDollarsToCents(str(form, "amount"));
  if (amountCents === null) return { error: "Enter a valid dollar amount, e.g. 125.50" };
  let id: string;
  try {
    const refund = await requestRefund({
      orderId: str(form, "orderId"),
      customerName: str(form, "customerName"),
      amountCents,
      reason: str(form, "reason"),
    });
    id = refund.id;
  } catch (error) {
    return { error: userFacingMessage(error) };
  }
  revalidatePath("/refunds");
  redirect(`/refunds/${id}`);
}

export async function decideRefundForm(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await decideRefund({
      refundId: str(form, "refundId"),
      approvalId: str(form, "approvalId"),
      decision: str(form, "decision"),
      reason: str(form, "reason") || undefined,
    });
  } catch (error) {
    return { error: userFacingMessage(error) };
  }
  revalidatePath("/refunds", "layout");
  return {};
}
