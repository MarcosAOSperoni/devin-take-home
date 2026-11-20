"use client";

import { useActionState } from "react";
import { button, input } from "@/platform/ui/styles";
import { requestRefundForm, type FormState } from "../server-actions";

export function RequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestRefundForm, {});
  return (
    <form action={action} className="grid max-w-md gap-3">
      <label className="grid gap-1 text-sm">
        Order ID
        <input name="orderId" required className={input} placeholder="ORD-100123" />
      </label>
      <label className="grid gap-1 text-sm">
        Customer name
        <input name="customerName" required className={input} />
      </label>
      <label className="grid gap-1 text-sm">
        Amount (USD)
        <input name="amount" required inputMode="decimal" className={input} placeholder="125.00" />
      </label>
      <label className="grid gap-1 text-sm">
        Reason
        <textarea name="reason" required className={input} rows={3} />
      </label>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Submitting…" : "Request refund"}
        </button>
      </div>
    </form>
  );
}
