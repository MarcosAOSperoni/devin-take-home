import Link from "next/link";
import { formatCents, formatDate } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { h1, link, table, td, th } from "@/platform/ui/styles";
import { loadPendingApprovals } from "../queries";
import { DecisionForm } from "./DecisionForm";

export default async function PendingApprovalsPage() {
  const { items, currentUserId } = await orForbidden(() => loadPendingApprovals());
  return (
    <div>
      <h1 className={h1}>Pending approvals</h1>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing waiting for approval.</p>
      ) : (
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Customer</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Reason</th>
              <th className={th}>Requested by</th>
              <th className={th}>Requested</th>
              <th className={th}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ approval, refund }) => (
              <tr key={approval.id}>
                <td className={td}>
                  <Link href={`/refunds/${refund.id}`} className={link}>
                    {refund.orderId}
                  </Link>
                </td>
                <td className={td}>{refund.customerName}</td>
                <td className={`${td} text-right tabular-nums`}>{formatCents(refund.amountCents)}</td>
                <td className={td}>{refund.reason}</td>
                <td className={td}>{refund.requestedBy.name}</td>
                <td className={td}>{formatDate(approval.createdAt)}</td>
                <td className={td}>
                  {approval.requestedById === currentUserId ? (
                    <span className="text-gray-500">Your request — someone else must decide</span>
                  ) : (
                    <DecisionForm refundId={refund.id} approvalId={approval.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
