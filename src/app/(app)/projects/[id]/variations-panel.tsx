"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { addVariation, updateVariation, deleteVariation } from "@/app/actions/project-items";
import type { Result } from "@/app/actions/projects";

export interface VariationRow {
  id: string;
  ref: string;
  description: string | null;
  cost_impact: number;
  time_impact_days: number;
  raised_date: string | null;
}

const input =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]";
const tiny = "mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]";

export function VariationsPanel({
  projectId,
  rows,
}: {
  projectId: string;
  rows: VariationRow[];
}) {
  const [state, action, pending] = useActionState(addVariation, null as Result | null);
  const [open, setOpen] = useState(rows.length === 0);
  const [editing, setEditing] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // clear the form once a variation saves, ready for the next one
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const total = rows.reduce((s, r) => s + num(r.cost_impact), 0);
  const days = rows.reduce((s, r) => s + num(r.time_impact_days), 0);

  return (
    <Card>
      <CardHeader
        title="Variations"
        subtitle={
          rows.length
            ? `${rows.length} · ${money(total)}${days ? ` · +${days} days` : ""}`
            : "Extra work agreed after the contract"
        }
        action={
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-[var(--brand)] hover:underline">
            {open ? "Close" : "+ Add variation"}
          </button>
        }
      />

      {open && (
        <form ref={formRef} action={action} className="space-y-3 border-b border-[var(--border)] px-5 py-4">
          <input type="hidden" name="project_id" value={projectId} />
          <div>
            <label className={tiny}>Description</label>
            <input name="description" required autoFocus className={input}
              placeholder="Kitchen specification upgrade across all units" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={tiny}>Value (MVR)</label>
              <input name="cost_impact" type="number" step="0.01" required className={input} />
            </div>
            <div>
              <label className={tiny}>Duration (days)</label>
              <input name="time_impact_days" type="number" min="0" defaultValue={0} className={input} />
            </div>
            <div>
              <label className={tiny}>Date</label>
              <input name="raised_date" type="date"
                defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
            </div>
          </div>
          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
          )}
          <button type="submit" disabled={pending}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60">
            {pending ? "Adding…" : "Add variation"}
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <Empty message="No variations on this project." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ref</Th><Th>Description</Th><Th right>Value</Th>
              <Th right>Days</Th><Th right>Date</Th><Th right>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              editing === r.id ? (
                <tr key={r.id} className="bg-[var(--hover)]">
                  <Td colSpan={6}>
                    <form action={updateVariation} className="flex flex-wrap items-end gap-2 py-1">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="project_id" value={projectId} />
                      <div className="min-w-[200px] flex-1">
                        <label className={tiny}>Description</label>
                        <input name="description" defaultValue={r.description ?? ""} className={input} />
                      </div>
                      <div className="w-32">
                        <label className={tiny}>Value</label>
                        <input name="cost_impact" type="number" step="0.01"
                          defaultValue={r.cost_impact} className={input} />
                      </div>
                      <div className="w-24">
                        <label className={tiny}>Days</label>
                        <input name="time_impact_days" type="number"
                          defaultValue={r.time_impact_days} className={input} />
                      </div>
                      <div className="w-36">
                        <label className={tiny}>Date</label>
                        <input name="raised_date" type="date"
                          defaultValue={r.raised_date ?? ""} className={input} />
                      </div>
                      <button type="submit"
                        className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditing(null)}
                        className="px-2 py-2 text-xs text-[var(--muted)] hover:underline">
                        Cancel
                      </button>
                    </form>
                  </Td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-[var(--hover)]">
                  <Td className="font-mono text-xs">{r.ref}</Td>
                  <Td>{r.description ?? "—"}</Td>
                  <Td right className="text-[var(--accent)]">{money(r.cost_impact)}</Td>
                  <Td right className="text-xs">{num(r.time_impact_days) || "—"}</Td>
                  <Td right className="text-xs">{date(r.raised_date)}</Td>
                  <Td right>
                    <button type="button" onClick={() => setEditing(r.id)}
                      className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                      Edit
                    </button>
                    <button type="button"
                      onClick={() => deleteVariation(r.id, projectId)}
                      className="ml-2 text-xs text-[var(--muted)] hover:text-red-700">
                      Remove
                    </button>
                  </Td>
                </tr>
              ),
            )}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--hover)] font-semibold">
              <Td>Total</Td><Td>{""}</Td>
              <Td right>{money(total)}</Td>
              <Td right>{days || "—"}</Td>
              <Td>{""}</Td><Td>{""}</Td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Card>
  );
}
