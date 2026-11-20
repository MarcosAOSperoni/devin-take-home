"use client";

import { useActionState } from "react";
import { button, input } from "@/platform/ui/styles";
import { decideRefundForm, type FormState } from "../server-actions";

export function DecisionForm({ refundId, approvalId }: { refundId: string; approvalId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideRefundForm, {});
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-start gap-2">
        <form action={action}>
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="approvalId" value={approvalId} />
          <input type="hidden" name="decision" value="approved" />
          <button type="submit" disabled={pending} className={button}>
            Approve
          </button>
        </form>
        <form action={action} className="flex gap-2">
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="approvalId" value={approvalId} />
          <input type="hidden" name="decision" value="rejected" />
          <input name="reason" required placeholder="Reason for rejecting" className={input} />
          <button type="submit" disabled={pending} className={button}>
            Reject
          </button>
        </form>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
    </div>
  );
}
