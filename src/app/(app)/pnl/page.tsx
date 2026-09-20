import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Pnl {
  id: string;
  code: string;
  project_name: string;
  client_name: string | null;
  status: string;
  value: number;
  variation: number;
  gst: number;
  exp: number;
  profit: number;
}

interface Split {
  project_id: string;
  investor_id: string;
  investor_name: string;
  share_mode: "percentage" | "fixed";
  profit_share_pct: number | null;
  profit_share_amount: number | null;
  investor_profit: number;
}

export default async function PnlPage() {
  const supabase = await createClient();
  const [{ data: pnlData }, { data: splitData }] = await Promise.all([
    supabase.from("project_pnl").select("*").order("code"),
    supabase.from("project_investor_splits").select("*"),
  ]);

  const rows = (pnlData ?? []) as Pnl[];
  const splits = (splitData ?? []) as Split[];

  // investor columns, ordered by total share across all projects (largest first)
  const investorTotals = new Map<string, { name: string; total: number }>();
  for (const s of splits) {
    const e = investorTotals.get(s.investor_id) ?? { name: s.investor_name, total: 0 };
    e.total += num(s.investor_profit);
    investorTotals.set(s.investor_id, e);
  }
  const investors = [...investorTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([id, v]) => ({ id, name: v.name }));

  // project -> investor -> split
  const byProject = new Map<string, Map<string, Split>>();
  for (const s of splits) {
    if (!byProject.has(s.project_id)) byProject.set(s.project_id, new Map());
    byProject.get(s.project_id)!.set(s.investor_id, s);
  }

  const t = {
    value: rows.reduce((a, r) => a + num(r.value), 0),
    variation: rows.reduce((a, r) => a + num(r.variation), 0),
    gst: rows.reduce((a, r) => a + num(r.gst), 0),
    exp: rows.reduce((a, r) => a + num(r.exp), 0),
    profit: rows.reduce((a, r) => a + num(r.profit), 0),
  };
  const investorTotalOf = (id: string) =>
    rows.reduce((a, r) => a + num(byProject.get(r.id)?.get(id)?.investor_profit), 0);
  const distributed = investors.reduce((a, i) => a + investorTotalOf(i.id), 0);
  const retained = t.profit - distributed;

  const shareLabel = (s: Split | undefined) => {
    if (!s) return null;
    return s.share_mode === "fixed" ? "fixed" : `${num(s.profit_share_pct).toFixed(0)}%`;
  };

  return (
    <div>
      <PageHeader
        title="Project P&amp;L"
        subtitle="Value, variation, GST, expenditure and profit — with each investor's share"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Project value" value={money(t.value)} hint={`+ ${money(t.variation)} variation`} />
        <Stat label="GST" value={money(t.gst)} hint="Collected for MIRA, not deducted" />
        <Stat label="Expenditure" value={money(t.exp)} tone="bad" />
        <Stat label="Profit" value={money(t.profit)} tone={t.profit >= 0 ? "good" : "bad"} />
        <Stat
          label="Distributed to investors"
          value={money(distributed)}
          hint={Math.abs(retained) < 1 ? "Fully distributed" : `${money(retained)} retained`}
        />
      </div>

      <Card>
        <CardHeader
          title="Per project"
          subtitle="Profit = (Value + Variation) − EXP. GST is reported but not deducted."
        />
        {rows.length === 0 ? (
          <Empty message="No projects yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th right>Project Value</Th>
                <Th right>Variation</Th>
                <Th right>GST</Th>
                <Th right>EXP</Th>
                <Th right>Profit</Th>
                {investors.map((i) => (
                  <Th key={i.id} right>{i.name}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mine = byProject.get(r.id);
                const profit = num(r.profit);
                return (
                  <tr key={r.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <Link href={`/projects/${r.id}`} className="font-medium hover:underline">
                        {r.project_name}
                      </Link>
                      <span className="block text-xs text-[var(--muted)]">
                        <span className="font-mono">{r.code}</span>
                        {r.client_name ? ` · ${r.client_name}` : ""}
                      </span>
                    </Td>
                    <Td right>{money(r.value)}</Td>
                    <Td right className={num(r.variation) ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                      {num(r.variation) ? money(r.variation) : "—"}
                    </Td>
                    <Td right className="text-[var(--muted)]">{money(r.gst)}</Td>
                    <Td right className="text-red-700">{money(r.exp)}</Td>
                    <Td right className={`font-medium ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {money(profit)}
                    </Td>
                    {investors.map((i) => {
                      const s = mine?.get(i.id);
                      return (
                        <Td key={i.id} right>
                          {s ? (
                            <>
                              {money(s.investor_profit)}
                              <span className="block text-[10px] text-[var(--muted)]">{shareLabel(s)}</span>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--hover)] font-semibold">
                <Td>Total</Td>
                <Td right>{money(t.value)}</Td>
                <Td right>{money(t.variation)}</Td>
                <Td right>{money(t.gst)}</Td>
                <Td right>{money(t.exp)}</Td>
                <Td right className={t.profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                  {money(t.profit)}
                </Td>
                {investors.map((i) => (
                  <Td key={i.id} right>{money(investorTotalOf(i.id))}</Td>
                ))}
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {investors.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Investor totals" subtitle="Share of profit across every project" />
          <Table>
            <thead>
              <tr><Th>Investor</Th><Th right>Share of profit</Th><Th right>% of total</Th></tr>
            </thead>
            <tbody>
              {investors.map((i) => {
                const total = investorTotalOf(i.id);
                return (
                  <tr key={i.id}>
                    <Td className="font-medium">{i.name}</Td>
                    <Td right>{money(total)}</Td>
                    <Td right className="text-[var(--muted)]">
                      {t.profit > 0 ? pct((total / t.profit) * 100, 1) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
