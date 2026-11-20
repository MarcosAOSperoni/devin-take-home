import { forbidden } from "next/navigation";
import { ForbiddenError } from "../errors";

/** Runs a server-side loader; a ForbiddenError renders the 403 page. */
export async function orForbidden<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}
