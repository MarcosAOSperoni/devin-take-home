"use client";

import { useState, useTransition } from "react";
import { link } from "@/platform/ui/styles";
import { revealSsnAction } from "../server-actions";

export function RevealSsn({ caseId, masked }: { caseId: string; masked: string }) {
  const [ssn, setSsn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      const res = await revealSsnAction(caseId);
      setError(res.error ?? null);
      setSsn(res.ssn ?? null);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{ssn ?? masked}</span>
      {ssn ? (
        <button type="button" onClick={() => setSsn(null)} className={`${link} text-xs`}>
          Hide
        </button>
      ) : (
        <button type="button" onClick={reveal} disabled={pending} className={`${link} text-xs`}>
          Reveal (audited)
        </button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
