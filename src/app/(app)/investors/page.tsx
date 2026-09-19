import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";
import type { InvestorPosition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvestorsPage() {
  const supabase = await createClient();
  const [{ data: investors }, { data: positions }] = await Promise.all([
    supabase.from("investors").select("*").order("name"),
    supabase.from("investor_positions").select("*"),
  ]);

  const pos = (positions ?? []) as InvestorPosition[];
  const byInvestor = new Map<string, { committed: number; funded: number; distributed: number; projects: Set<string> }>();
  for (const p of pos) {
    const row = byInvestor.get(p.investor_id) ?? {
      committed: 0, funded: 0, distributed: 0, projects: new Set<string>(),
    };
    row.committed += num(p.committed_amount);
    row.funded += num(p.funded_amount);
    row.distributed += num(p.distributed_amount);
    row.projects.add(p.project_id);
    byInvestor.set(p.investor_id, row);
  }

  const totalCommitted = pos.reduce((s, p) => s + num(p.committed_amount), 0);
  const totalFunded = pos.reduce((s, p) => s + num(p.funded_amount), 0);
  const totalProfit = pos.reduce((s, p) => s + num(p.profit_paid), 0);
  const activeCount = (investors ?? []).filter((i) => i.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Investors"
        subtitle="Who backs Spruce & Co, what they've committed and what they're owed"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Investors" value={String(investors?.length ?? 0)} hint={`${activeCount} active`} />
        <Stat label="Total committed" value={money(totalCommitted)} />
        <Stat label="Capital received" value={money(totalFunded)} hint={`${money(totalCommitted - totalFunded)} to draw`} />
        <Stat label="Profit paid out" value={money(totalProfit)} tone="good" />
      </div>

      <Card>
        {!investors?.length ? (
          <Empty message="No investors yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Investor</Th>
                <Th>Status</Th>
                <Th>Contact</Th>
                <Th right>Projects</Th>
                <Th right>Committed</Th>
                <Th right>Funded</Th>
                <Th right>Returned</Th>
                <Th right>KYC</Th>
              </tr>
            </thead>
            <tbody>
              {investors.map((inv) => {
                const r = byInvestor.get(inv.id);
                return (
                  <tr key={inv.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <Link href={`/investors/${inv.id}`} className="font-medium hover:underline">
                        {inv.name}
                      </Link>
                      <p className="text-xs capitalize text-[var(--muted)]">{inv.type}</p>
                    </Td>
                    <Td><Badge value={inv.status} /></Td>
                    <Td className="text-xs text-[var(--muted)]">
                      {inv.email ?? "—"}
                      {inv.phone && <span className="block">{inv.phone}</span>}
                    </Td>
                    <Td right>{r?.projects.size ?? 0}</Td>
                    <Td right>{money(r?.committed ?? 0)}</Td>
                    <Td right>{money(r?.funded ?? 0)}</Td>
                    <Td right>{money(r?.distributed ?? 0)}</Td>
                    <Td right className="text-xs">{date(inv.kyc_verified_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
