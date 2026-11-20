import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents, formatDate } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { h1, link, table, td, th } from "@/platform/ui/styles";
import { loadRefund } from "../queries";
import { StatusBadge } from "./StatusBadge";

export default async function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await orForbidden(() => loadRefund(id));
  if (!data) notFound();
  const { refund, history, approvals } = data;

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/refunds" className={`${link} text-sm`}>
          ← All refunds
        </Link>
        <h1 className={h1}>Refund {refund.orderId}</h1>
        <dl className="grid max-w-lg grid-cols-[10rem_1fr] gap-1 text-sm">
          <dt className="text-gray-600">Customer</dt>
          <dd>{refund.customerName}</dd>
          <dt className="text-gray-600">Amount</dt>
          <dd>{formatCents(refund.amountCents)}</dd>
          <dt className="text-gray-600">Status</dt>
          <dd>
            <StatusBadge status={refund.status} />
          </dd>
          <dt className="text-gray-600">Reason</dt>
          <dd>{refund.reason}</dd>
          <dt className="text-gray-600">Requested by</dt>
          <dd>{refund.requestedBy.name}</dd>
          <dt className="text-gray-600">Created</dt>
          <dd>{formatDate(refund.createdAt)}</dd>
          {approvals.map((a) => (
            <div key={a.id} className="contents">
              <dt className="text-gray-600">Approval</dt>
              <dd>
                {a.decision ?? "pending"}
                {a.reason ? ` — ${a.reason}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Audit history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-600">No audit events (seeded records are not audited).</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Actor</th>
                <th className={th}>Action</th>
                <th className={th}>Outcome</th>
                <th className={th}>Before</th>
                <th className={th}>After</th>
              </tr>
            </thead>
            <tbody>
              {history.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{formatDate(e.createdAt)}</td>
                  <td className={td}>{e.actorName}</td>
                  <td className={td}>{e.action}</td>
                  <td className={td}>{e.outcome}</td>
                  <td className={`${td} font-mono text-xs break-all`}>{e.before}</td>
                  <td className={`${td} font-mono text-xs break-all`}>{e.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
