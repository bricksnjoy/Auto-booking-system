import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Profitability {
  id: string; code: string; name: string; status: string; client_name: string | null;
  contract_value: number; approved_variations: number; revised_contract_value: number;
  supplier_cost: number; expense_cost: number; labour_cost: number;
  total_cost: number; net_profit: number; net_margin_pct: number;
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const [{ data: prof }, { data: cash }, { data: payments }, { data: bills }, { data: stock }] =
    await Promise.all([
      supabase.from("project_profitability").select("*").order("code"),
      supabase.from("cash_summary").select("*").single(),
      supabase.from("payments").select("amount, direction, paid_date"),
      supabase.from("bills").select("total, status, cost_categories(name)"),
      supabase.from("stock_movements").select("quantity, unit_cost, move_type, moved_on"),
    ]);

  const rows = (prof ?? []) as Profitability[];
  const revenue = rows.reduce((s, r) => s + num(r.revised_contract_value), 0);
  const cost = rows.reduce((s, r) => s + num(r.total_cost), 0);
  const profit = rows.reduce((s, r) => s + num(r.net_profit), 0);
  const labour = rows.reduce((s, r) => s + num(r.labour_cost), 0);

  // cashflow by month
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const p of payments ?? []) {
    const k = String(p.paid_date).slice(0, 7);
    const r = byMonth.get(k) ?? { in: 0, out: 0 };
    if (p.direction === "in") r.in += num(p.amount); else r.out += num(p.amount);
    byMonth.set(k, r);
  }
  const months = [...byMonth.entries()].sort().slice(-12);
  const monthMax = Math.max(1, ...months.map(([, r]) => Math.max(r.in, r.out)));

  // material usage: stock issued to site
  const issued = (stock ?? []).filter((m) => m.move_type === "issue");
  const materialUsed = issued.reduce((s, m) => s + num(m.quantity) * num(m.unit_cost), 0);

  const catSpend = new Map<string, number>();
  for (const b of bills ?? []) {
    if (["void", "draft"].includes(b.status)) continue;
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    catSpend.set(cat, (catSpend.get(cat) ?? 0) + num(b.total));
  }
  const catRows = [...catSpend.entries()].sort((a, b) => b[1] - a[1]);
  const catMax = catRows[0]?.[1] ?? 1;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Profitability, cash flow, labour and material cost across the business" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={money(revenue)} hint="Contracts plus approved variations" />
        <Stat label="Total cost" value={money(cost)} tone="bad" />
        <Stat label="Net profit" value={money(profit)} tone={profit >= 0 ? "good" : "bad"}
          hint={revenue > 0 ? pct((profit / revenue) * 100, 1) : undefined} />
        <Stat label="Net cash" value={money(num(cash?.net_cash))}
          tone={num(cash?.net_cash) >= 0 ? "good" : "bad"} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Project profitability" subtitle="Revenue against every cost charged to the job" />
          {rows.length === 0 ? <Empty message="No projects." /> : (
            <Table>
              <thead><tr>
                <Th>Project</Th><Th right>Contract</Th><Th right>Variations</Th><Th right>Revenue</Th>
                <Th right>Supplier</Th><Th right>Labour</Th><Th right>Expenses</Th>
                <Th right>Profit</Th><Th right>Margin</Th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <Link href={`/projects/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      <span className="block font-mono text-xs text-[var(--muted)]">{r.code}</span>
                    </Td>
                    <Td right>{money(r.contract_value)}</Td>
                    <Td right className={num(r.approved_variations) ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
                      {num(r.approved_variations) ? money(r.approved_variations) : "—"}
                    </Td>
                    <Td right className="font-medium">{money(r.revised_contract_value)}</Td>
                    <Td right className="text-[var(--muted)]">{money(r.supplier_cost)}</Td>
                    <Td right className="text-[var(--muted)]">{money(r.labour_cost)}</Td>
                    <Td right className="text-[var(--muted)]">{money(r.expense_cost)}</Td>
                    <Td right className={num(r.net_profit) >= 0 ? "font-medium text-emerald-700" : "font-medium text-red-700"}>
                      {money(r.net_profit)}
                    </Td>
                    <Td right className={num(r.net_margin_pct) >= 0 ? "text-emerald-700" : "text-red-700"}>
                      {pct(r.net_margin_pct, 1)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--hover)] font-semibold">
                  <Td>Total</Td>
                  <Td right>{money(rows.reduce((s, r) => s + num(r.contract_value), 0))}</Td>
                  <Td right>{money(rows.reduce((s, r) => s + num(r.approved_variations), 0))}</Td>
                  <Td right>{money(revenue)}</Td>
                  <Td right>{money(rows.reduce((s, r) => s + num(r.supplier_cost), 0))}</Td>
                  <Td right>{money(labour)}</Td>
                  <Td right>{money(rows.reduce((s, r) => s + num(r.expense_cost), 0))}</Td>
                  <Td right className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>{money(profit)}</Td>
                  <Td right>{revenue > 0 ? pct((profit / revenue) * 100, 1) : "—"}</Td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Cash flow" subtitle="Last 12 months" />
            {months.length === 0 ? <Empty message="No payment history." /> : (
              <ul className="space-y-3 px-5 py-4">
                {months.map(([month, r]) => {
                  const net = r.in - r.out;
                  return (
                    <li key={month}>
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">
                          {new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" })
                            .format(new Date(`${month}-01`))}
                        </span>
                        <span className={`tabular-nums ${net >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {money(net)}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-1">
                        <div className="h-2 flex-1 overflow-hidden rounded-sm bg-[var(--border)]">
                          <div className="h-full bg-emerald-600" style={{ width: `${(r.in / monthMax) * 100}%` }} />
                        </div>
                        <div className="h-2 flex-1 overflow-hidden rounded-sm bg-[var(--border)]">
                          <div className="h-full bg-red-500" style={{ width: `${(r.out / monthMax) * 100}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-[var(--border)] px-5 py-2 text-xs text-[var(--muted)]">
              Left bar in, right bar out.
            </p>
          </Card>

          <Card>
            <CardHeader title="Cost by category" subtitle="Supplier spend" />
            {catRows.length === 0 ? <Empty message="No costs recorded." /> : (
              <ul className="space-y-3 px-5 py-4">
                {catRows.map(([cat, total]) => (
                  <li key={cat}>
                    <div className="flex justify-between text-xs">
                      <span>{cat}</span>
                      <span className="tabular-nums text-[var(--muted)]">{money(total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(total / catMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Labour cost" value={money(labour)}
            hint={revenue > 0 ? `${pct((labour / revenue) * 100, 1)} of revenue` : undefined} />
          <Stat label="Material issued to site" value={money(materialUsed)} hint={`${issued.length} issues`} />
          <Stat label="Receivables" value={money(num(cash?.receivables))} tone="warn" />
          <Stat label="Payables" value={money(num(cash?.payables))} tone="warn" />
        </div>
      </div>
    </div>
  );
}
