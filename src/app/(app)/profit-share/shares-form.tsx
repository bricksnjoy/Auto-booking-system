"use client";

import { useActionState, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { saveProfitShares, type ProfitShare, type ShareResult, type ShareKind } from "@/app/actions/profit-share";

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";

interface Row {
  key: string;
  id: string;
  name: string;
  kind: ShareKind;
  pct: string;
}

const toRow = (s: ProfitShare): Row => ({
  key: s.id,
  id: s.id,
  name: s.name,
  kind: s.kind,
  pct: String(s.pct),
});

export function SharesForm({ shares }: { shares: ProfitShare[] }) {
  const [state, action, pending] = useActionState(saveProfitShares, null as ShareResult | null);
  const [rows, setRows] = useState<Row[]>(() => shares.map(toRow));

  const total = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const balanced = Math.abs(total - 100) < 0.001;

  const set = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={action}>
      <input type="hidden" name="count" value={rows.length} />

      <Card>
        <CardHeader
          title="Profit share"
          subtitle="How the profit on every project divides, unless a project says otherwise"
        />

        <div className="space-y-3 px-5 py-5">
          {rows.map((r, i) => (
            <div key={r.key} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name={`id_${i}`} value={r.id} />
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Share
                </label>
                <input name={`name_${i}`} value={r.name}
                  onChange={(e) => set(r.key, { name: e.target.value })}
                  className={input} placeholder="Name" />
              </div>
              <div className="w-48">
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Kind
                </label>
                <select name={`kind_${i}`} value={r.kind}
                  onChange={(e) => set(r.key, { kind: e.target.value as ShareKind })}
                  className={input}>
                  <option value="person">Person</option>
                  <option value="company">Company (retained)</option>
                  <option value="investors">Investors (pooled)</option>
                </select>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Percent
                </label>
                <input name={`pct_${i}`} type="number" step="0.001" min="0" max="100"
                  value={r.pct} onChange={(e) => set(r.key, { pct: e.target.value })}
                  className={input} />
              </div>
              <button type="button"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="pb-2 text-xs text-[var(--muted)] hover:text-red-700">
                Remove
              </button>
            </div>
          ))}

          <button type="button"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                { key: crypto.randomUUID(), id: "", name: "", kind: "person", pct: "0" },
              ])
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover)]">
            + Add a share
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] px-5 py-4">
          <button type="submit" disabled={pending || !balanced}
            className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50">
            {pending ? "Saving…" : "Save shares"}
          </button>

          <p className={`text-sm font-medium tabular-nums ${
            balanced ? "text-emerald-700" : "text-amber-700"
          }`}>
            {total.toFixed(2)}%
            <span className="ml-2 font-normal text-[var(--muted)]">
              {balanced ? "adds up" : "must add up to 100%"}
            </span>
          </p>

          {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
          {state?.ok && <p className="text-sm text-[var(--muted)]">Saved.</p>}
        </div>
      </Card>
    </form>
  );
}
