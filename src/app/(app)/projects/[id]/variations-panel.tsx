"use client";

import { useState } from "react";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import { deleteVariation } from "@/app/actions/project-items";
import { VariationModal, type VariationValues } from "@/components/variation-modal";

export interface VariationRow extends VariationValues {
  id: string;
  ref: string;
  description: string | null;
  cost_impact: number;
  time_impact_days: number;
  raised_date: string | null;
}

export function VariationsPanel({
  projectId,
  rows,
  locked = false,
}: {
  projectId: string;
  rows: VariationRow[];
  locked?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<VariationRow | null>(null);

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
          locked ? undefined : (
            <button type="button" onClick={() => setAdding(true)}
              className="text-xs font-medium text-[var(--brand)] hover:underline">
              + Add variation
            </button>
          )
        }
      />

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
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--hover)]">
                <Td className="font-mono text-xs">{r.ref}</Td>
                <Td>{r.description ?? "—"}</Td>
                <Td right className="text-[var(--accent)]">{money(r.cost_impact)}</Td>
                <Td right className="text-xs">{num(r.time_impact_days) || "—"}</Td>
                <Td right className="text-xs">{date(r.raised_date)}</Td>
                <Td right>
                  {!locked && (
                    <>
                      <button type="button" onClick={() => setEditing(r)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteVariation(r.id, projectId)}
                        className="ml-2 text-xs text-[var(--muted)] hover:text-red-700">
                        Remove
                      </button>
                    </>
                  )}
                </Td>
              </tr>
            ))}
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

      <VariationModal open={adding} onClose={() => setAdding(false)} projectId={projectId} />
      <VariationModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        projectId={projectId}
        values={editing ?? undefined}
        key={editing?.id ?? "none"}
      />
    </Card>
  );
}
