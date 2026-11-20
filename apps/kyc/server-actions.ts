"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/platform/errors";
import { addCaseNote, assignCaseToMe, decideCase, escalateCase, revealSsn } from "./actions";

export type FormState = { error?: string };

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

async function run(write: () => Promise<unknown>): Promise<FormState> {
  try {
    await write();
  } catch (error) {
    return { error: userFacingMessage(error) };
  }
  revalidatePath("/kyc", "layout");
  return {};
}

export async function assignCaseForm(_prev: FormState, form: FormData): Promise<FormState> {
  return run(() => assignCaseToMe({ caseId: str(form, "caseId") }));
}

export async function addNoteForm(_prev: FormState, form: FormData): Promise<FormState> {
  return run(() => addCaseNote({ caseId: str(form, "caseId"), body: str(form, "body") }));
}

export async function escalateCaseForm(_prev: FormState, form: FormData): Promise<FormState> {
  return run(() => escalateCase({ caseId: str(form, "caseId"), reason: str(form, "reason") }));
}

export async function decideCaseForm(_prev: FormState, form: FormData): Promise<FormState> {
  return run(() =>
    decideCase({ caseId: str(form, "caseId"), decision: str(form, "decision"), reason: str(form, "reason") }),
  );
}

/** Returns the full SSN only in this response. Not cached or revalidated. */
export async function revealSsnAction(caseId: string): Promise<{ ssn?: string; error?: string }> {
  try {
    return await revealSsn({ caseId });
  } catch (error) {
    return { error: userFacingMessage(error) };
  }
}
