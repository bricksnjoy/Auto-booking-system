import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const supabase = await createClient();
  const { data: bills } = await supabase
    .from("bills")
    .select("*, vendors(id, name), projects(id, code), cost_categories(name)")
    .order("issue_date", { ascending: false });

  const list = bills ?? [];
  const totalCost = list.filter((b) => !["void", "draft"].includes(b.status))
    .reduce((s, b) => s + num(b.total), 0);
  const outstanding = list.filter((b) => ["approved", "part_paid"].includes(b.status))
    .reduce((s, b) => s + (num(b.total) - num(b.amount_paid)), 0);
  const awaiting = list.filter((b) => b.status === "awaiting_approval");

  const byCategory = new Map<string, number>();
  for (const b of list) {
    if (["void", "draft"].includes(b.status)) continue;
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + num(b.total));
  }
  const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const catMax = catRows[0]?.[1] ?? 1;

  return (
    <div>
      <PageHeader title="Bills & costs" subtitle="Supplier and subcontractor invoices — the actual-cost ledger" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total cost" value={money(totalCost)} hint={`${list.length} bills`} />
        <Stat label="Outstanding" value={money(outstanding)} tone={outstanding > 0 ? "warn" : "default"} />
        <Stat label="Awaiting approval" value={String(awaiting.length)}
          hint={money(awaiting.reduce((s, b) => s + num(b.total), 0))}
          tone={awaiting.length ? "warn" : "default"} />
        <Stat label="Paid" value={money(list.reduce((s, b) => s + num(b.amount_paid), 0))} tone="good" />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader title="All bills" />
          {list.length === 0 ? <Empty message="No bills recorded." /> : (
            <Table>
              <thead><tr>
                <Th>Bill</Th><Th>Vendor</Th><Th>Project</Th><Th>Category</Th>
                <Th>Status</Th><Th right>Total</Th><Th right>Outstanding</Th>
              </tr></thead>
              <tbody>
                {list.map((b) => {
                  const v = b.vendors as unknown as { id: string; name: string } | null;
                  const proj = b.projects as unknown as { id: string; code: string } | null;
                  const cat = b.cost_categories as unknown as { name: string } | null;
                  const due = num(b.total) - num(b.amount_paid);
                  return (
                    <tr key={b.id} className="hover:bg-[var(--bg)]">
                      <Td>
                        <span className="font-mono text-xs font-medium">{b.bill_no}</span>
                        <span className="block text-xs text-[var(--muted)]">{date(b.issue_date)}</span>
                      </Td>
                      <Td>{v?.name ?? "—"}</Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{cat?.name ?? "—"}</Td>
                      <Td><Badge value={b.status} /></Td>
                      <Td right>{money(b.total)}</Td>
                      <Td right className={due > 0 ? "text-amber-700" : ""}>{money(due)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Cost by category" />
          {catRows.length === 0 ? <Empty message="No costs yet." /> : (
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
    </div>
  );
}
