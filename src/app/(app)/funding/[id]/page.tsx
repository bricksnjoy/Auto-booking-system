import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";
import type { InvestorPosition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: round } = await supabase
    .from("funding_rounds")
    .select("*, projects(id, code, name, contract_value)")
    .eq("id", id)
    .maybeSingle();

  if (!round) notFound();

  const { data: positions } = await supabase
    .from("investor_positions")
    .select("*")
    .eq("round_id", id);

  const pos = (positions ?? []) as InvestorPosition[];
  const proj = round.projects as unknown as
    { id: string; code: string; name: string; contract_value: number } | null;

  const committed = pos.reduce((s, p) => s + num(p.committed_amount), 0);
  const funded = pos.reduce((s, p) => s + num(p.funded_amount), 0);
  const distributed = pos.reduce((s, p) => s + num(p.distributed_amount), 0);
  const coverage = num(round.target_amount) > 0 ? (committed / num(round.target_amount)) * 100 : 0;

  return (
    <div>
      <div className="mb-2">
        <Link href="/funding" className="text-xs text-[var(--muted)] hover:underline">
          ← Funding rounds
        </Link>
      </div>
      <PageHeader
        title={round.name}
        subtitle={
          proj
            ? `${proj.code} · ${proj.name}`
            : "Unlinked round"
        }
        action={<Badge value={round.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Target" value={money(round.target_amount)} hint={`Min ticket ${money(round.min_ticket)}`} />
        <Stat
          label="Committed"
          value={money(committed)}
          hint={`${pct(coverage, 0)} of target`}
          tone={coverage >= 100 ? "good" : "warn"}
        />
        <Stat label="Capital received" value={money(funded)} hint={`${money(committed - funded)} to draw`} />
        <Stat label="Distributed" value={money(distributed)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Investors in this round" />
          {pos.length === 0 ? (
            <Empty message="No commitments yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Investor</Th>
                  <Th>Status</Th>
                  <Th right>Committed</Th>
                  <Th right>Funded</Th>
                  <Th right>Outstanding</Th>
                  <Th right>Returned</Th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.commitment_id}>
                    <Td>
                      <Link href={`/investors/${p.investor_id}`} className="font-medium hover:underline">
                        {p.investor_name}
                      </Link>
                    </Td>
                    <Td><Badge value={p.status} /></Td>
                    <Td right>{money(p.committed_amount)}</Td>
                    <Td right>{money(p.funded_amount)}</Td>
                    <Td right className={num(p.outstanding_amount) > 0 ? "text-amber-700" : ""}>
                      {money(p.outstanding_amount)}
                    </Td>
                    <Td right>{money(p.distributed_amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Terms" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            {[
              ["Offered return", pct(round.offered_return_pct)],
              ["Equity offered", round.equity_offered_pct > 0 ? pct(round.equity_offered_pct) : "—"],
              ["Term", round.term_months ? `${round.term_months} months` : "—"],
              ["Minimum ticket", money(round.min_ticket)],
              ["Opens", date(round.open_date)],
              ["Closes", date(round.close_date)],
              ["Project contract value", proj ? money(proj.contract_value) : "—"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="text-right font-medium">{value as string}</dd>
              </div>
            ))}
          </dl>
          {round.notes && (
            <p className="border-t border-[var(--border)] px-5 py-4 text-sm text-[var(--muted)]">
              {round.notes}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
