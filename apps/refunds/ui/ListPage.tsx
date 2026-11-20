import Link from "next/link";
import { formatCents, formatDate, parseDollarsToCents } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { button, input, link, table, td, th } from "@/platform/ui/styles";
import { loadRefunds } from "../queries";
import { REFUND_STATUSES, refundFilters } from "../schemas";
import { StatusBadge } from "./StatusBadge";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function RefundsListPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = first(sp.status);
  const min = first(sp.min);
  const max = first(sp.max);
  const filters = refundFilters.parse({
    status: status || undefined,
    minCents: parseDollarsToCents(min) ?? undefined,
    maxCents: parseDollarsToCents(max) ?? undefined,
  });
  const { refunds, canRequest, canApprove } = await orForbidden(() => loadRefunds(filters));

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-xl font-semibold">Refunds</h1>
        {canRequest && (
          <Link href="/refunds/new" className={link}>
            Request refund
          </Link>
        )}
        {canApprove && (
          <Link href="/refunds/approvals" className={link}>
            Pending approvals
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          Status
          <select name="status" defaultValue={status} className={input}>
            <option value="">All</option>
            {REFUND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Min $
          <input name="min" defaultValue={min} className={input} size={8} />
        </label>
        <label className="grid gap-1">
          Max $
          <input name="max" defaultValue={max} className={input} size={8} />
        </label>
        <button type="submit" className={button}>
          Filter
        </button>
        <Link href="/refunds" className={link}>
          Clear
        </Link>
      </form>

      <p className="mb-2 text-sm text-gray-600">{refunds.length} refunds</p>
      <table className={table}>
        <thead>
          <tr>
            <th className={th}>Order</th>
            <th className={th}>Customer</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={th}>Status</th>
            <th className={th}>Requested by</th>
            <th className={th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {refunds.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                <Link href={`/refunds/${r.id}`} className={link}>
                  {r.orderId}
                </Link>
              </td>
              <td className={td}>{r.customerName}</td>
              <td className={`${td} text-right tabular-nums`}>{formatCents(r.amountCents)}</td>
              <td className={td}>
                <StatusBadge status={r.status} />
              </td>
              <td className={td}>{r.requestedBy.name}</td>
              <td className={td}>{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

