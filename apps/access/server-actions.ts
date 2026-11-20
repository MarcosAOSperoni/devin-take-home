"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { userFacingMessage } from "@/platform/errors";
import { decideAccess, requestAccess, revokeAccess } from "./actions";

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
  revalidatePath("/access", "layout");
  return {};
}

export async function requestAccessForm(_prev: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    ({ id } = await requestAccess({
      system: str(form, "system"),
      reason: str(form, "reason"),
      durationHours: str(form, "durationHours"),
    }));
  } catch (error) {
    return { error: userFacingMessage(error) };
  }
  revalidatePath("/access", "layout");
  redirect(`/access/${id}`);
}

export async function decideAccessForm(_prev: FormState, form: FormData): Promise<FormState> {
  return run(() =>
    decideAccess({ requestId: str(form, "requestId"), decision: str(form, "decision"), reason: str(form, "reason") }),
  );
}

export async function revokeAccessForm(_prev: FormState, form: FormData): Promise<FormState> {
  return run(() => revokeAccess({ requestId: str(form, "requestId"), reason: str(form, "reason") }));
}
