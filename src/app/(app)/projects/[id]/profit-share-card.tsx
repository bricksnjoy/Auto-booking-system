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
  /** 'Capital Pool' for the pool's members, otherwise null */
  parent_share: string | null;
  /** null until the project is completed and the share is accrued */
  disposition: "withdraw" | "retain" | null;
}

const sum = (rows: ShareLine[], k: "pct" | "share_amount") =>
  rows.reduce((a, r) => a + num(r[k]), 0);

/**
 * The profit split, laid out the way it is actually decided: the investors'
 * portion first, divided between private backers and the capital pool by what
 * each put in, the pool's part divided again among its members — then the
 * company and the directors.
 */
export function ProfitShareCard({
  projectId,
  shares,
  completed,
}: {
  projectId: string;
  shares: ShareLine[];
  completed: boolean;
}) {
  const investors = shares.filter((s) => s.share_kind === "investors");
  const privateInvestors = investors.filter((s) => s.parent_share !== "Capital Pool");
  const pool = investors.filter((s) => s.parent_share === "Capital Pool");
  const others = shares.filter((s) => s.share_kind !== "investors");
  const cols = completed ? 4 : 3;

  return (
    <Card>
      <CardHeader
        title="Profit share"
        subtitle={
          completed
            ? "Investors by what they put in; each director takes theirs or keeps it in the pool"
            : "Investors by what they put in, then the company and directors"
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
            {/* investors' portion */}
            {investors.length > 0 ? (
              <>
                <tr className="bg-[var(--hover)]">
                  <Td className="font-semibold">Investors</Td>
                  <Td right className="font-semibold">{sum(investors, "pct").toFixed(2)}%</Td>
                  <Td right className="font-semibold">{money(sum(investors, "share_amount"))}</Td>
                  {completed && <Td>{""}</Td>}
                </tr>

                {privateInvestors.map((s) => (
                  <tr key={s.share_name}>
                    <Td className="pl-9">
                      {s.share_name}
                      <span className="ml-2 text-[10px] text-[var(--muted)]">private investor</span>
                    </Td>
                    <Td right className="text-[var(--muted)]">{num(s.pct).toFixed(2)}%</Td>
                    <Td right>{money(s.share_amount)}</Td>
                    {completed && <Td right className="text-xs text-[var(--muted)]">paid out</Td>}
                  </tr>
                ))}

                {pool.length > 0 && (
                  <>
                    <tr>
                      <Td className="pl-9 font-medium">
                        Capital Pool
                        <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-normal text-[var(--brand)]">
                          reinvested
                        </span>
                      </Td>
                      <Td right className="font-medium">{sum(pool, "pct").toFixed(2)}%</Td>
                      <Td right className="font-medium">{money(sum(pool, "share_amount"))}</Td>
                      {completed && <Td right className="text-xs text-emerald-700">back to pool</Td>}
                    </tr>
                    {pool.map((s) => (
                      <tr key={s.share_name} className="text-xs">
                        <Td className="pl-16 text-[var(--muted)]">
                          {s.share_name.replace(/^Capital Pool · /, "")}
                        </Td>
                        <Td right className="text-[var(--muted)]">{num(s.pct).toFixed(2)}%</Td>
                        <Td right className="text-[var(--muted)]">{money(s.share_amount)}</Td>
                        {completed && <Td>{""}</Td>}
                      </tr>
                    ))}
                  </>
                )}
              </>
            ) : (
              <tr>
                <Td className="text-xs text-[var(--muted)]">
                  No investors on this project — their share has gone to the company.
                </Td>
                <Td>{""}</Td><Td>{""}</Td>
                {completed && <Td>{""}</Td>}
              </tr>
            )}

            {/* company and directors */}
            {others.map((s) => (
              <tr key={s.share_name}>
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
                    ) : (
                      <span className="text-xs text-emerald-700">to pool</span>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--hover)] font-semibold">
              <Td>Total</Td>
              <Td right>{sum(shares, "pct").toFixed(2)}%</Td>
              <Td right>{money(sum(shares, "share_amount"))}</Td>
              {cols === 4 && <Td>{""}</Td>}
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
        title="Paid to their personal account"
        className={`px-2.5 py-1 transition-colors ${
          current === "withdraw"
            ? "bg-[var(--brand)] font-medium text-white"
            : "bg-[var(--field)] text-[var(--muted)] hover:bg-[var(--hover)]"
        }`}>
        Take
      </button>
      <button type="submit" name="disposition" value="retain" disabled={pending}
        title="Kept in the capital pool under their name"
        className={`px-2.5 py-1 transition-colors ${
          current === "retain"
            ? "bg-emerald-600 font-medium text-white"
            : "bg-[var(--field)] text-[var(--muted)] hover:bg-[var(--hover)]"
        }`}>
        Keep in pool
      </button>
    </form>
  );
}
