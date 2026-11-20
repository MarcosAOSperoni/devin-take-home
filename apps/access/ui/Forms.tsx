"use client";

import { useActionState } from "react";
import { button, input } from "@/platform/ui/styles";
import { DURATIONS, SYSTEMS } from "../schemas";
import { decideAccessForm, requestAccessForm, revokeAccessForm, type FormState } from "../server-actions";

type Fn = (prev: FormState, form: FormData) => Promise<FormState>;

function Error({ state }: { state: FormState }) {
  return state.error ? <p className="text-sm text-red-700">{state.error}</p> : null;
}

export function RequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestAccessForm, {});
  return (
    <form action={action} className="grid max-w-md gap-3">
      <label className="grid gap-1 text-sm">
        System
        <select name="system" required className={input}>
          {SYSTEMS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Duration
        <select name="durationHours" required defaultValue="1" className={input}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} hour{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Reason
        <textarea name="reason" required className={input} rows={3} />
      </label>
      <Error state={state} />
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Submitting…" : "Request access"}
        </button>
      </div>
    </form>
  );
}

function ReasonForm({ requestId, fn, label, decision }: { requestId: string; fn: Fn; label: string; decision?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(fn, {});
  return (
    <form action={action} className="grid gap-1">
      <div className="flex gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        {decision && <input type="hidden" name="decision" value={decision} />}
        <input name="reason" required placeholder={`Reason to ${label.toLowerCase()}`} className={`${input} w-72`} />
        <button type="submit" disabled={pending} className={button}>
          {label}
        </button>
      </div>
      <Error state={state} />
    </form>
  );
}

export function DecideForms({ requestId }: { requestId: string }) {
  return (
    <div className="grid gap-2">
      <ReasonForm requestId={requestId} fn={decideAccessForm} label="Approve" decision="approved" />
      <ReasonForm requestId={requestId} fn={decideAccessForm} label="Deny" decision="rejected" />
    </div>
  );
}

export function RevokeForm({ requestId }: { requestId: string }) {
  return <ReasonForm requestId={requestId} fn={revokeAccessForm} label="Revoke" />;
}
