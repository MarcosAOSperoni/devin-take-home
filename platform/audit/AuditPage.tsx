import Link from "next/link";
import { formatDate } from "../ui/format";
import { orForbidden } from "../ui/guard";
import { button, h1, input, link, table, td, th } from "../ui/styles";
import { loadAuditLog } from ".";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const resourceType = typeof sp.resourceType === "string" ? sp.resourceType : "";
  const actorId = typeof sp.actorId === "string" ? sp.actorId : "";
  const { events, resourceTypes, actors } = await orForbidden(() => loadAuditLog({ resourceType, actorId }));

  return (
    <div>
      <h1 className={h1}>Audit log</h1>
      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          Resource type
          <select name="resourceType" defaultValue={resourceType} className={input}>
            <option value="">All</option>
            {resourceTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Actor
          <select name="actorId" defaultValue={actorId} className={input}>
            <option value="">All</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={button}>
          Filter
        </button>
        <Link href="/admin/audit" className={link}>
          Clear
        </Link>
      </form>
      <p className="mb-2 text-sm text-gray-600">Showing the latest {events.length} events.</p>
      <table className={table}>
        <thead>
          <tr>
            <th className={th}>When</th>
            <th className={th}>Actor</th>
            <th className={th}>Action</th>
            <th className={th}>Resource</th>
            <th className={th}>Outcome</th>
            <th className={th}>Before</th>
            <th className={th}>After</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className={td}>{formatDate(e.createdAt)}</td>
              <td className={td}>{e.actorName}</td>
              <td className={td}>{e.action}</td>
              <td className={td}>
                {e.resourceType === "refund" && e.resourceId ? (
                  <Link href={`/refunds/${e.resourceId}`} className={link}>
                    refund {e.resourceId.slice(-6)}
                  </Link>
                ) : (
                  `${e.resourceType} ${e.resourceId?.slice(-6) ?? ""}`
                )}
              </td>
              <td className={td}>{e.outcome}</td>
              <td className={`${td} font-mono text-xs break-all`}>{e.before}</td>
              <td className={`${td} font-mono text-xs break-all`}>{e.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
