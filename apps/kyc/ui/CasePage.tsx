import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/platform/ui/format";
import { orForbidden } from "@/platform/ui/guard";
import { h1, link, table, td, th } from "@/platform/ui/styles";
import { loadCase } from "../queries";
import { ESCALATABLE_STATUSES, FINAL_STATUSES, type KycStatus } from "../schemas";
import { Badge } from "./Badge";
import { AssignForm, DecideForms, EscalateForm, NoteForm } from "./CaseForms";
import { RevealSsn } from "./RevealSsn";

export default async function KycCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await orForbidden(() => loadCase(id));
  if (!data) notFound();
  const { kycCase: c, notes, history, canWork, canDecide, canReveal } = data;
  const status = c.status as KycStatus;
  const isFinal = FINAL_STATUSES.includes(status);

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/kyc" className={`${link} text-sm`}>
          ← Queue
        </Link>
        <h1 className={h1}>Case {c.reference}</h1>
        <dl className="grid max-w-lg grid-cols-[10rem_1fr] gap-1 text-sm">
          <dt className="text-gray-600">Customer</dt>
          <dd>{c.customerName}</dd>
          <dt className="text-gray-600">Date of birth</dt>
          <dd className="font-mono">{c.dateOfBirthMasked}</dd>
          <dt className="text-gray-600">Country</dt>
          <dd>{c.country}</dd>
          <dt className="text-gray-600">Document</dt>
          <dd>{c.documentType}</dd>
          <dt className="text-gray-600">SSN</dt>
          <dd>{canReveal ? <RevealSsn caseId={c.id} masked={c.ssnMasked} /> : <span className="font-mono">{c.ssnMasked}</span>}</dd>
          <dt className="text-gray-600">Risk</dt>
          <dd>
            <Badge value={c.riskLevel} />
          </dd>
          <dt className="text-gray-600">Status</dt>
          <dd>
            <Badge value={c.status} />
          </dd>
          <dt className="text-gray-600">Assignee</dt>
          <dd>{c.assigneeName ?? "Unassigned"}</dd>
          {c.escalationReason && (
            <>
              <dt className="text-gray-600">Escalation reason</dt>
              <dd>{c.escalationReason}</dd>
            </>
          )}
          {c.decisionReason && (
            <>
              <dt className="text-gray-600">Decision reason</dt>
              <dd>{c.decisionReason}</dd>
            </>
          )}
        </dl>
      </div>

      {isFinal ? (
        <p className="text-sm text-gray-600">This case is final.</p>
      ) : (
        (canWork || canDecide) && (
          <div className="grid gap-3">
            <h2 className="font-semibold">Actions</h2>
            {canWork && status === "pending" && !c.assigneeId && <AssignForm caseId={c.id} />}
            {canWork && ESCALATABLE_STATUSES.includes(status) && <EscalateForm caseId={c.id} />}
            {canDecide && <DecideForms caseId={c.id} />}
          </div>
        )
      )}

      <div className="grid gap-2">
        <h2 className="font-semibold">Notes</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-600">No notes.</p>
        ) : (
          <ul className="grid max-w-2xl gap-2 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded border px-3 py-2">
                <div className="text-xs text-gray-600">
                  {n.authorName} · {formatDate(n.createdAt)}
                </div>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        {canWork && !isFinal && <NoteForm caseId={c.id} />}
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
