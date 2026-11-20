"use client";

import { useActionState } from "react";
import { button, input } from "@/platform/ui/styles";
import { addNoteForm, assignCaseForm, decideCaseForm, escalateCaseForm, type FormState } from "../server-actions";

function useForm(fn: (prev: FormState, form: FormData) => Promise<FormState>) {
  return useActionState<FormState, FormData>(fn, {});
}

function Error({ state }: { state: FormState }) {
  return state.error ? <p className="text-sm text-red-700">{state.error}</p> : null;
}

export function AssignForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useForm(assignCaseForm);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="caseId" value={caseId} />
      <button type="submit" disabled={pending} className={`${button} justify-self-start`}>
        Assign to me
      </button>
      <Error state={state} />
    </form>
  );
}

function ReasonForm({
  caseId,
  fn,
  label,
  decision,
}: {
  caseId: string;
  fn: (prev: FormState, form: FormData) => Promise<FormState>;
  label: string;
  decision?: "approved" | "rejected";
}) {
  const [state, action, pending] = useForm(fn);
  return (
    <form action={action} className="grid gap-1">
      <div className="flex gap-2">
        <input type="hidden" name="caseId" value={caseId} />
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

export function EscalateForm({ caseId }: { caseId: string }) {
  return <ReasonForm caseId={caseId} fn={escalateCaseForm} label="Escalate" />;
}

export function DecideForms({ caseId }: { caseId: string }) {
  return (
    <div className="grid gap-2">
      <ReasonForm caseId={caseId} fn={decideCaseForm} label="Approve" decision="approved" />
      <ReasonForm caseId={caseId} fn={decideCaseForm} label="Reject" decision="rejected" />
    </div>
  );
}

export function NoteForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useForm(addNoteForm);
  return (
    <form action={action} className="grid max-w-lg gap-1">
      <input type="hidden" name="caseId" value={caseId} />
      <textarea name="body" required rows={3} placeholder="Add a note" className={input} />
      <button type="submit" disabled={pending} className={`${button} justify-self-start`}>
        Add note
      </button>
      <Error state={state} />
    </form>
  );
}
