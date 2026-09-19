import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
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
  investor_name: string | null;
  investor_id: string | null;
  share_mode: "percentage" | "fixed" | null;
  profit_share_pct: number | null;
  profit_share_amount: number | null;
  invested_amount: number | null;
  investor_profit: number | null;
}

export default async function PnlPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("project_pnl").select("*").order("code");
  const rows = (data ?? []) as Pnl[];

  const t = {
    value: rows.reduce((s, r) => s + num(r.value), 0),
    variation: rows.reduce((s, r) => s + num(r.variation), 0),
    gst: rows.reduce((s, r) => s + num(r.gst), 0),
    exp: rows.reduce((s, r) => s + num(r.exp), 0),
    profit: rows.reduce((s, r) => s + num(r.profit), 0),
    investorProfit: rows.reduce((s, r) => s + num(r.investor_profit), 0),
    invested: rows.reduce((s, r) => s + num(r.invested_amount), 0),
  };
  const companyProfit = t.profit - t.investorProfit;

  const shareLabel = (r: Pnl) => {
    if (!r.investor_name) return "—";
    if (r.share_mode === "fixed") return money(r.profit_share_amount, "GBP");
    return pct(r.profit_share_pct, 0);
  };

  return (
    <div>
      <PageHeader
        title="Project P&amp;L"
        subtitle="Value, variation, GST, expenditure and profit — with each project's investor and their share"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Total value" value={money(t.value)} hint={`+ ${money(t.variation)} variations`} />
        <Stat label="GST" value={money(t.gst)} />
        <Stat label="Expenditure" value={money(t.exp)} tone="bad" />
        <Stat label="Profit" value={money(t.profit)} tone={t.profit >= 0 ? "good" : "bad"} />
        <Stat
          label="Spruce &amp; Co share"
          value={money(companyProfit)}
          hint={`${money(t.investorProfit)} to investors`}
          tone={companyProfit >= 0 ? "good" : "bad"}
        />
      </div>

      <Card>
        <CardHeader
          title="Per project"
          subtitle="Profit = (value + variation) − GST − expenditure"
        />
        {rows.length === 0 ? (
          <Empty message="No projects yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th right>Value</Th>
                <Th right>Variation</Th>
                <Th right>GST</Th>
                <Th right>EXP</Th>
                <Th right>Profit</Th>
                <Th>Investor</Th>
                <Th right>Invested</Th>
                <Th right>Share</Th>
                <Th right>Investor profit</Th>
                <Th right>Spruce keeps</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const profit = num(r.profit);
                const invProfit = num(r.investor_profit);
                const keeps = profit - invProfit;
                return (
                  <tr key={r.id} className="hover:bg-[var(--bg)]">
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
                    <Td>
                      {r.investor_name && r.investor_id ? (
                        <Link href={`/investors/${r.investor_id}`} className="hover:underline">
                          {r.investor_name}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">Self-funded</span>
                      )}
                    </Td>
                    <Td right>{r.invested_amount ? money(r.invested_amount) : "—"}</Td>
                    <Td right>
                      {r.investor_name ? (
                        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
                          {shareLabel(r)}
                        </span>
                      ) : "—"}
                    </Td>
                    <Td right className={invProfit ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                      {r.investor_name ? money(invProfit) : "—"}
                    </Td>
                    <Td right className={`font-medium ${keeps >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {money(keeps)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--bg)] font-semibold">
                <Td>Total</Td>
                <Td right>{money(t.value)}</Td>
                <Td right>{money(t.variation)}</Td>
                <Td right>{money(t.gst)}</Td>
                <Td right>{money(t.exp)}</Td>
                <Td right className={t.profit >= 0 ? "text-emerald-700" : "text-red-700"}>{money(t.profit)}</Td>
                <Td>—</Td>
                <Td right>{money(t.invested)}</Td>
                <Td right>—</Td>
                <Td right>{money(t.investorProfit)}</Td>
                <Td right className={companyProfit >= 0 ? "text-emerald-700" : "text-red-700"}>{money(companyProfit)}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      <p className="mt-4 text-xs text-[var(--muted)]">
        EXP combines supplier bills, approved expenses and payroll charged to the project. GST uses the
        figure set on the project, falling back to tax on issued invoices. The investor shown is the
        largest live commitment on the project; a share can be a percentage of profit or a fixed amount.
      </p>
    </div>
  );
}
