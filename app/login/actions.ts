"use server";

import { redirect } from "next/navigation";
import { signInAs } from "@/platform/auth/mock-provider";

// Sets the demo session cookie. Not a data write, so it does not go through defineAction.
export async function signIn(form: FormData) {
  const userId = form.get("userId");
  if (typeof userId !== "string") throw new Error("Missing user");
  await signInAs(userId);
  redirect("/");
}
