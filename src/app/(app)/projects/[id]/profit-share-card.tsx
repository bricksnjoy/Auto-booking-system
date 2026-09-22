"use client";

import { useActionState } from "react";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import { money, num } from "@/lib/format";
import { setShareDisposition, type StatusResult } from "@/app/actions/project-status";

export interface ShareLine {
  share_name: string;
  share_kind: "investors" | "company" | "person";
  pct: number;
  share_amount: number;
  /** null until the project is completed and the share is accrued */
  disposition: "withdraw" | "retain" | null;
}

export function ProfitShareCard({
  projectId,
  shares,
  completed,
}: {
  projectId: string;
  shares: ShareLine[];
  completed: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Profit share"
        subtitle={
          completed
            ? "How this project's profit divides — each director takes theirs or keeps it in the company"
            : "How this project's profit divides"
        }
      />
      {shares.length === 0 ? (
        <Empty message="No profit share set. Add one under Admin." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Share</Th><Th right>%</Th><Th right>Amount</Th>
              {completed && <Th right>Taken / kept</Th>}
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={`${s.share_name}-${s.pct}`}>
                <Td className="font-medium">
                  {s.share_name}
                  {s.share_kind === "company" && (
                    <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--brand)]">
                      retained
                    </span>
                  )}
                </Td>
                <Td right className="text-[var(--muted)]">{num(s.pct).toFixed(2)}%</Td>
                <Td right>{money(s.share_amount)}</Td>
                {completed && (
                  <Td right>
                    {s.share_kind === "person" ? (
                      <Election projectId={projectId} shareName={s.share_name}
                        current={s.disposition ?? "withdraw"} />
                    ) : s.share_kind === "company" ? (
                      <span className="text-xs text-[var(--muted)]">kept</span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--hover)] font-semibold">
              <Td>Total</Td>
              <Td right>{shares.reduce((a, s) => a + num(s.pct), 0).toFixed(2)}%</Td>
              <Td right>{money(shares.reduce((a, s) => a + num(s.share_amount), 0))}</Td>
              {completed && <Td>{""}</Td>}
            </tr>
          </tfoot>
        </Table>
      )}
    </Card>
  );
}

function Election({
  projectId,
  shareName,
  current,
}: {
  projectId: string;
  shareName: string;
  current: "withdraw" | "retain";
}) {
  const [, action, pending] = useActionState(setShareDisposition, null as StatusResult | null);

  return (
    <form action={action} className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] text-xs">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="share_name" value={shareName} />
      <button type="submit" name="disposition" value="withdraw" disabled={pending}
        className={`px-2.5 py-1 transition-colors ${
          current === "withdraw"
            ? "bg-[var(--brand)] font-medium text-white"
            : "bg-[var(--field)] text-[var(--muted)] hover:bg-[var(--hover)]"
        }`}>
        Take
      </button>
      <button type="submit" name="disposition" value="retain" disabled={pending}
        className={`px-2.5 py-1 transition-colors ${
          current === "retain"
            ? "bg-emerald-600 font-medium text-white"
            : "bg-[var(--field)] text-[var(--muted)] hover:bg-[var(--hover)]"
        }`}>
        Keep
      </button>
    </form>
  );
}
