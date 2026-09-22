"use client";

import { useState } from "react";
import { InvestorModal, type InvestorValues } from "@/components/investor-modal";

export function InvestorHeaderActions({ investor }: { investor: InvestorValues }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setEditing(true)}
        className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover)]">
        Edit investor
      </button>
      <InvestorModal open={editing} onClose={() => setEditing(false)} values={investor} />
    </>
  );
}
