"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addFinancingSource, updateFinancingSource, type FinancingResult, type SourceType } from "@/app/actions/financing";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const label = "mb-1.5 block text-sm font-medium";

export interface SourceValues {
  id?: string;
  name?: string;
  source_type?: SourceType;
  amount?: number;
  note?: string | null;
  pool?: { contributor_name: string; ratio: number }[];
}

interface PoolRow {
  key: string;
  contributor_name: string;
  ratio: string;
}

const DEFAULT_POOL = ["Mujahid", "Muaz", "Mushahid", "Mariyam Zahir"];

export function FinancingModal({
  open,
  onClose,
  projectId,
  values,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  values?: SourceValues;
}) {
  const editing = Boolean(values?.id);
  const [state, action, pending] = useActionState(
    editing ? updateFinancingSource : addFinancingSource,
    null as FinancingResult | null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [type, setType] = useState<SourceType>(values?.source_type ?? "external_loan");
  const [pool, setPool] = useState<PoolRow[]>(() =>
    (values?.pool && values.pool.length
      ? values.pool
      : DEFAULT_POOL.map((n) => ({ contributor_name: n, ratio: 25 }))
    ).map((p) => ({
      key: crypto.randomUUID(),
      contributor_name: p.contributor_name,
      ratio: String(p.ratio),
    })),
  );

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const poolTotal = pool.reduce((s, p) => s + (Number(p.ratio) || 0), 0);
  const poolBalanced = Math.abs(poolTotal - 100) < 0.001;

  const setRow = (key: string, patch: Partial<PoolRow>) =>
    setPool((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div role="dialog" aria-modal="true"
      aria-label={editing ? "Edit financing source" : "Add financing source"}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--field)] shadow-[0_24px_60px_-20px_rgba(13,27,42,0.4)]"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? "Edit financing source" : "Add financing source"}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Who fronted the money for this project&apos;s cost
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="text-[var(--muted)] transition-colors hover:text-[var(--text)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form ref={formRef} action={action} className="space-y-4 px-5 py-5">
          <input type="hidden" name="project_id" value={projectId} />
          {values?.id && <input type="hidden" name="id" value={values.id} />}
          <input type="hidden" name="source_type" value={type} />
          <input type="hidden" name="pool_count" value={pool.length} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="f-name" className={label}>Source name</label>
              <input id="f-name" name="name" required autoFocus
                defaultValue={values?.name ?? ""} className={input}
                placeholder={type === "capital_pool" ? "Capital Pool" : "Ahmed (loan)"} />
            </div>
            <div>
              <label htmlFor="f-amount" className={label}>Amount contributed</label>
              <input id="f-amount" name="amount" type="number" step="0.01" required
                defaultValue={values?.amount ?? ""} className={input} />
            </div>
          </div>

          <div>
            <label className={label}>Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType("external_loan")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  type === "external_loan"
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)] bg-[var(--field)] hover:bg-[var(--hover)]"
                }`}>
                External loan
              </button>
              <button type="button" onClick={() => setType("capital_pool")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  type === "capital_pool"
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border)] bg-[var(--field)] hover:bg-[var(--hover)]"
                }`}>
                Capital pool
              </button>
            </div>
          </div>

          {type === "capital_pool" && (
            <div className="rounded-lg border border-[var(--border)] p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Who is in the pool, and their split of it
              </p>
              <div className="space-y-2">
                {pool.map((r, i) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <input name={`pool_name_${i}`} value={r.contributor_name}
                      onChange={(e) => setRow(r.key, { contributor_name: e.target.value })}
                      className={input} placeholder="Name" />
                    <div className="relative w-28 shrink-0">
                      <input name={`pool_ratio_${i}`} type="number" step="0.001" min="0" max="100"
                        value={r.ratio} onChange={(e) => setRow(r.key, { ratio: e.target.value })}
                        className={`${input} pr-6`} />
                      <span className="pointer-events-none absolute right-2 top-2 text-xs text-[var(--muted)]">%</span>
                    </div>
                    <button type="button"
                      onClick={() => setPool((rs) => rs.filter((x) => x.key !== r.key))}
                      className="shrink-0 text-xs text-[var(--muted)] hover:text-red-700">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button type="button"
                  onClick={() =>
                    setPool((rs) => [
                      ...rs,
                      { key: crypto.randomUUID(), contributor_name: "", ratio: "0" },
                    ])
                  }
                  className="text-xs font-medium text-[var(--brand)] hover:underline">
                  + Add person
                </button>
                <span className={`text-xs font-medium tabular-nums ${
                  poolBalanced ? "text-emerald-700" : "text-amber-700"
                }`}>
                  {poolTotal.toFixed(2)}% {poolBalanced ? "" : "— must be 100%"}
                </span>
              </div>
            </div>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={pending || (type === "capital_pool" && !poolBalanced)}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50">
              {pending ? "Saving…" : editing ? "Save changes" : "Add source"}
            </button>
            <button type="button" onClick={onClose}
              className="text-sm text-[var(--muted)] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
