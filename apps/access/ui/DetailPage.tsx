import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { h1, link, table, td, th } from "@/platform/ui/styles";
import { loadRequest } from "../queries";
import { Badge } from "./Badge";
import { DecideForms, RevokeForm } from "./Forms";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-gray-600">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export default async function AccessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await orForbidden(() => loadRequest(id));
  if (!data) notFound();
  const { request: r, history, canDecide, canRevoke } = data;

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/access" className={`${link} text-sm`}>
          ← All requests
        </Link>
        <h1 className={h1}>Access to {r.system}</h1>
        <dl className="grid max-w-lg grid-cols-[10rem_1fr] gap-1 text-sm">
          <Row label="Status">
            <Badge value={r.status} />
          </Row>
          <Row label="Requester">{r.requesterName}</Row>
          <Row label="Requested">{formatDate(r.createdAt)}</Row>
          <Row label="Duration">{r.durationHours} hour{r.durationHours === 1 ? "" : "s"}</Row>
          <Row label="Reason">{r.reason}</Row>
          {r.decidedAt && (
            <>
              <Row label="Decided by">{r.decidedByName ?? "—"}</Row>
              <Row label="Decided">{formatDate(r.decidedAt)}</Row>
              <Row label="Decision reason">{r.decisionReason}</Row>
            </>
          )}
          {r.expiresAt && <Row label="Expires">{formatDate(r.expiresAt)}</Row>}
          {r.revokedAt && (
            <>
              <Row label="Revoked by">{r.revokedByName ?? "—"}</Row>
              <Row label="Revoked">{formatDate(r.revokedAt)}</Row>
              <Row label="Revoke reason">{r.revokeReason}</Row>
            </>
          )}
        </dl>
      </div>

      {(canDecide || canRevoke) && (
        <div className="grid gap-3">
          <h2 className="font-semibold">Actions</h2>
          {canDecide && <DecideForms requestId={r.id} />}
          {canRevoke && <RevokeForm requestId={r.id} />}
        </div>
      )}
      {["denied", "expired", "revoked"].includes(r.status) && <p className="text-sm text-gray-600">This request is final.</p>}

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
