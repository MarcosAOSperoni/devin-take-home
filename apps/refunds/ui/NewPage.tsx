import { formatCents } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { h1 } from "@/platform/ui/styles";
import { loadRequestForm } from "../queries";
import { RequestForm } from "./RequestForm";

export default async function NewRefundPage() {
  const { threshold } = await orForbidden(() => loadRequestForm());
  return (
    <div>
      <h1 className={h1}>Request a refund</h1>
      <p className="mb-4 text-sm text-gray-600">
        Refunds over {formatCents(threshold)} need approval from a second person.
      </p>
      <RequestForm />
    </div>
  );
}
