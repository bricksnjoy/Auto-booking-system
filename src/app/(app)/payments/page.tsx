import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const [{ data: payments }, { data: cash }] = await Promise.all([
    supabase.from("payments")
      .select("*, invoices(invoice_no), bills(bill_no), projects(id, code)")
      .order("paid_date", { ascending: false }).limit(200),
    supabase.from("cash_summary").select("*").single(),
  ]);

  const list = payments ?? [];
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const p of list) {
    const key = String(p.paid_date).slice(0, 7);
    const row = byMonth.get(key) ?? { in: 0, out: 0 };
    if (p.direction === "in") row.in += num(p.amount); else row.out += num(p.amount);
    byMonth.set(key, row);
  }
  const months = [...byMonth.entries()].sort().slice(-6);
  const monthMax = Math.max(1, ...months.map(([, r]) => Math.max(r.in, r.out)));

  return (
    <div>
      <PageHeader title="Payments" subtitle="Every pound in and out, across projects and investors" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cash in" value={money(num(cash?.cash_in))} tone="good" />
        <Stat label="Cash out" value={money(num(cash?.cash_out))} tone="bad" />
        <Stat label="Net cash" value={money(num(cash?.net_cash))} tone={num(cash?.net_cash) >= 0 ? "good" : "bad"} />
        <Stat label="Investor capital in" value={money(num(cash?.investor_capital_in))}
          hint={`${money(num(cash?.investor_paid_out))} paid back`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader title="Payment history" subtitle="Most recent 200 movements" />
          {list.length === 0 ? <Empty message="No payments recorded." /> : (
            <Table>
              <thead><tr>
                <Th>Date</Th><Th>Direction</Th><Th>Against</Th><Th>Project</Th><Th>Method</Th><Th right>Amount</Th>
              </tr></thead>
              <tbody>
                {list.map((p) => {
                  const inv = p.invoices as unknown as { invoice_no: string } | null;
                  const bill = p.bills as unknown as { bill_no: string } | null;
                  const proj = p.projects as unknown as { id: string; code: string } | null;
                  const isIn = p.direction === "in";
                  return (
                    <tr key={p.id} className="hover:bg-[var(--hover)]">
                      <Td className="text-xs">{date(p.paid_date)}</Td>
                      <Td><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isIn ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{isIn ? "In" : "Out"}</span></Td>
                      <Td className="font-mono text-xs">{inv?.invoice_no ?? bill?.bill_no ?? "—"}</Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{p.method ?? "—"}{p.reference && <span className="block">{p.reference}</span>}</Td>
                      <Td right className={isIn ? "text-emerald-700" : "text-red-700"}>{isIn ? "+" : "−"}{money(p.amount)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent months" subtitle="In vs out" />
          {months.length === 0 ? <Empty message="No data." /> : (
            <ul className="space-y-4 px-5 py-4">
              {months.map(([month, r]) => (
                <li key={month}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">
                      {new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(new Date(`${month}-01`))}
                    </span>
                    <span className={`tabular-nums ${r.in - r.out >= 0 ? "text-emerald-700" : "text-red-700"}`}>{money(r.in - r.out)}</span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(r.in / monthMax) * 100}%` }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${(r.out / monthMax) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
