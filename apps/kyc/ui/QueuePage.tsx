import Link from "next/link";
import { orForbidden } from "@/platform/ui/guard";
import { button, input, link, table, td, th } from "@/platform/ui/styles";
import { loadQueue } from "../queries";
import { KYC_STATUSES, kycFilters, RISK_LEVELS } from "../schemas";
import { Badge } from "./Badge";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function KycQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = first(sp.status);
  const risk = first(sp.risk);
  const mine = first(sp.mine) === "1";
  const filters = kycFilters.parse({ status: status || undefined, risk: risk || undefined, mine });
  const { cases } = await orForbidden(() => loadQueue(filters));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">KYC review queue</h1>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          Status
          <select name="status" defaultValue={status} className={input}>
            <option value="">All</option>
            {KYC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Risk
          <select name="risk" defaultValue={risk} className={input}>
            <option value="">All</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-1">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
          Assigned to me
        </label>
        <button type="submit" className={button}>
          Filter
        </button>
        <Link href="/kyc" className={link}>
          Clear
        </Link>
      </form>

      <p className="mb-2 text-sm text-gray-600">{cases.length} cases</p>
      <table className={table}>
        <thead>
          <tr>
            <th className={th}>Case</th>
            <th className={th}>Customer</th>
            <th className={th}>Country</th>
            <th className={th}>Document</th>
            <th className={th}>SSN</th>
            <th className={th}>Risk</th>
            <th className={th}>Status</th>
            <th className={th}>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id}>
              <td className={td}>
                <Link href={`/kyc/${c.id}`} className={link}>
                  {c.reference}
                </Link>
              </td>
              <td className={td}>{c.customerName}</td>
              <td className={td}>{c.country}</td>
              <td className={td}>{c.documentType}</td>
              <td className={`${td} font-mono`}>{c.ssnMasked}</td>
              <td className={td}>
                <Badge value={c.riskLevel} />
              </td>
              <td className={td}>
                <Badge value={c.status} />
              </td>
              <td className={td}>{c.assigneeName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
