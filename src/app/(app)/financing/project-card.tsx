"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { Card, Table, Th, Td, Empty } from "@/components/ui";
import { money, num } from "@/lib/format";
import { computeFinancing, type FinancingSourceInput } from "@/lib/financing";
import { FinancingModal, type SourceValues } from "@/components/financing-modal";
import type { SourceType } from "@/app/actions/financing";
import { deleteFinancingSource, setRepayPct, type FinancingResult } from "@/app/actions/financing";

export interface FinancingProject {
  id: string;
  code: string;
  name: string;
  cost: number;
  profit: number;
  repay_pct: number;
  sources: FinancingSourceInput[];
  /** completed and paid: shown, not changeable */
  locked?: boolean;
}

export function ProjectFinancingCard({ project }: { project: FinancingProject }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SourceValues | null>(null);
  const [editingPct, setEditingPct] = useState(false);
  const [pctState, pctAction, pctPending] = useActionState(setRepayPct, null as FinancingResult | null);

  const f = computeFinancing(project.sources, project.cost, project.profit, project.repay_pct);
  const matches = Math.abs(f.variance) < 0.01;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <Link href={`/projects/${project.id}`}
            className="text-sm font-semibold hover:text-[var(--brand)] hover:underline">
            {project.name}
          </Link>
          <p className="text-xs text-[var(--muted)]">
            <span className="font-mono">{project.code}</span> · cost {money(f.totalCost)} ·
            financed {money(f.totalFinancing)}
            {!matches && (
              <span className="ml-1 text-amber-700">
                ({f.variance > 0 ? "over by " : "short by "}{money(Math.abs(f.variance))})
              </span>
            )}
          </p>
        </div>
        {project.locked ? (
          <span className="text-xs text-[var(--muted)]">Locked — completed and paid</span>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--hover)]">
            + Add source
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-[var(--border)] px-5 py-3 text-sm">
        <span><span className="text-[var(--muted)]">Profit</span>{" "}
          <span className={num(project.profit) >= 0 ? "text-emerald-700" : "text-red-700"}>
            {money(project.profit)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[var(--muted)]">Profit to repayment</span>
          {project.locked ? (
            <span className="font-medium">
              {num(project.repay_pct).toFixed(project.repay_pct % 1 ? 2 : 0)}%
            </span>
          ) : editingPct ? (
            <form action={pctAction} className="flex items-center gap-1">
              <input type="hidden" name="project_id" value={project.id} />
              <input name="financing_repay_pct" type="number" step="0.001" min="0" max="100"
                defaultValue={project.repay_pct}
                className="w-20 rounded border border-[var(--border)] bg-[var(--field)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]" />
              <button type="submit" disabled={pctPending}
                className="rounded bg-[var(--brand)] px-2 py-1 text-xs font-medium text-white">
                {pctPending ? "…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditingPct(false)}
                className="text-xs text-[var(--muted)] hover:underline">Cancel</button>
            </form>
          ) : (
            <button type="button" onClick={() => setEditingPct(true)}
              className="font-medium text-[var(--brand)] hover:underline">
              {num(project.repay_pct).toFixed(project.repay_pct % 1 ? 2 : 0)}%
            </button>
          )}
        </span>
        <span><span className="text-[var(--muted)]">Repayment pool</span>{" "}
          <span className="font-medium">{money(f.repaymentPool)}</span>
        </span>
      </div>
      {pctState?.error && <p className="px-5 pt-2 text-xs text-red-700">{pctState.error}</p>}

      {f.sources.length === 0 ? (
        <Empty message="No financing sources yet. This project is self-funded until one is added." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Source</Th><Th>Type</Th>
              <Th right>Contributed</Th><Th right>Share</Th><Th right>Repayment</Th>
            </tr>
          </thead>
          <tbody>
            {f.sources.map((s) => (
              <SourceRows key={s.id} source={s} projectId={project.id}
                locked={project.locked}
                onEdit={
                  s.source_type === "investor"
                    ? undefined
                    : () => setEditing({
                        id: s.id,
                        name: s.name,
                        source_type: s.source_type as SourceType,
                        amount: s.amount,
                        pool: s.pool,
                      })
                } />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--hover)] font-semibold">
              <Td>Total</Td><Td>{""}</Td>
              <Td right>{money(f.totalFinancing)}</Td>
              <Td right>{f.totalFinancing > 0 ? "100%" : "—"}</Td>
              <Td right>{money(f.repaymentPool)}</Td>
            </tr>
          </tfoot>
        </Table>
      )}

      <FinancingModal open={adding} onClose={() => setAdding(false)} projectId={project.id} />
      <FinancingModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        projectId={project.id}
        values={editing ?? undefined}
        key={editing?.id ?? "none"}
      />
    </Card>
  );
}

function SourceRows({
  source,
  projectId,
  onEdit,
  locked = false,
}: {
  source: ReturnType<typeof computeFinancing>["sources"][number];
  projectId: string;
  onEdit?: () => void;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPool = source.source_type === "capital_pool";

  return (
    <>
      <tr className="hover:bg-[var(--hover)]">
        <Td className="font-medium">
          {isPool ? (
            <button type="button" onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 hover:text-[var(--brand)]">
              <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
              {source.name}
            </button>
          ) : (
            source.name
          )}
        </Td>
        <Td className="text-xs text-[var(--muted)]">
          {isPool
            ? "Capital pool"
            : source.source_type === "investor"
              ? "Investor"
              : "External loan"}
        </Td>
        <Td right>{money(source.amount)}</Td>
        <Td right className="text-[var(--muted)]">{(source.share * 100).toFixed(2)}%</Td>
        <Td right>
          {money(source.repayment)}
          {!locked && (
          <span className="ml-2 inline-flex gap-1.5 align-middle text-xs">
            {onEdit && (
              <button type="button" onClick={onEdit}
                className="text-[var(--muted)] hover:text-[var(--brand)] hover:underline">Edit</button>
            )}
            <button type="button" onClick={() => deleteFinancingSource(source.id, projectId)}
              className="text-[var(--muted)] hover:text-red-700">Remove</button>
          </span>
          )}
        </Td>
      </tr>
      {isPool && open &&
        source.contributors.map((c) => (
          <tr key={c.contributor_name} className="bg-[var(--hover)] text-xs">
            <Td className="pl-10 text-[var(--muted)]">{c.contributor_name}</Td>
            <Td>{""}</Td>
            <Td right className="text-[var(--muted)]">{c.ratio.toFixed(2)}% of pool</Td>
            <Td>{""}</Td>
            <Td right className="text-[var(--muted)]">{money(c.repayment)}</Td>
          </tr>
        ))}
    </>
  );
}
