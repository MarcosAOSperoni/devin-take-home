import Link from "next/link";
import { formatDate } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { button, h1, input, link, table, td, th } from "@/platform/ui/styles";
import { loadList } from "../queries";
import { accessFilters, DISPLAY_STATUSES, SYSTEMS } from "../schemas";
import { Badge } from "./Badge";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AccessListPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = first(sp.status);
  const system = first(sp.system);
  const mine = first(sp.mine) === "1";
  const filters = accessFilters.parse({ status: status || undefined, system: system || undefined, mine });
  const { requests, canRequest } = await orForbidden(() => loadList(filters));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className={h1}>Production access requests</h1>
        {canRequest && (
          <Link href="/access/new" className={button}>
            Request access
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          Status
          <select name="status" defaultValue={status} className={input}>
            <option value="">All</option>
            {DISPLAY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          System
          <select name="system" defaultValue={system} className={input}>
            <option value="">All</option>
            {SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-1">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
          Mine
        </label>
        <button type="submit" className={button}>
          Filter
        </button>
        <Link href="/access" className={link}>
          Clear
        </Link>
      </form>

      <p className="mb-2 text-sm text-gray-600">{requests.length} requests</p>
      <table className={table}>
        <thead>
          <tr>
            <th className={th}>System</th>
            <th className={th}>Requester</th>
            <th className={th}>Duration</th>
            <th className={th}>Status</th>
            <th className={th}>Requested</th>
            <th className={th}>Expires</th>
            <th className={th}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td className={td}>
                <Link href={`/access/${r.id}`} className={link}>
                  {r.system}
                </Link>
              </td>
              <td className={td}>{r.requesterName}</td>
              <td className={td}>{r.durationHours}h</td>
              <td className={td}>
                <Badge value={r.status} />
              </td>
              <td className={td}>{formatDate(r.createdAt)}</td>
              <td className={td}>{r.expiresAt ? formatDate(r.expiresAt) : "—"}</td>
              <td className={td}>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
