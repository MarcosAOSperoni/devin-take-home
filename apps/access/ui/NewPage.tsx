import { orForbidden } from "@/platform/ui/guard";
import { h1 } from "@/platform/ui/styles";
import { loadRequestForm } from "../queries";
import { RequestForm } from "./Forms";

export default async function NewAccessRequestPage() {
  await orForbidden(() => loadRequestForm());
  return (
    <div>
      <h1 className={h1}>Request production access</h1>
      <p className="mb-4 text-sm text-gray-600">A second person must approve before access is granted.</p>
      <RequestForm />
    </div>
  );
}
