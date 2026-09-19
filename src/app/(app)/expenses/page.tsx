import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*, projects(id, code), cost_categories(name), employees(full_name), profiles:submitted_by(full_name)")
    .order("expense_date", { ascending: false });

  const list = data ?? [];
  const submitted = list.filter((e) => e.status === "submitted");
  const approved = list.filter((e) => ["approved", "reimbursed"].includes(e.status));
  const toReimburse = list.filter((e) => e.status === "approved");
  const billable = approved.filter((e) => e.is_billable);

  const byCategory = new Map<string, number>();
  for (const e of approved) {
    const cat = (e.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + num(e.amount));
  }
  const catRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const catMax = catRows[0]?.[1] ?? 1;

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Out-of-pocket spend, approvals and reimbursements" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Approved spend" value={money(approved.reduce((s, e) => s + num(e.amount), 0))}
          hint={`${approved.length} claims`} />
        <Stat label="Awaiting approval" value={String(submitted.length)}
          hint={money(submitted.reduce((s, e) => s + num(e.amount), 0))}
          tone={submitted.length ? "warn" : "good"} />
        <Stat label="To reimburse" value={money(toReimburse.reduce((s, e) => s + num(e.amount), 0))}
          hint={`${toReimburse.length} claims`} tone={toReimburse.length ? "warn" : "default"} />
        <Stat label="Rebillable to clients" value={money(billable.reduce((s, e) => s + num(e.amount), 0))}
          tone="good" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader title="Expense claims" />
          {list.length === 0 ? <Empty message="No expenses claimed." /> : (
            <Table>
              <thead><tr>
                <Th>Date</Th><Th>Description</Th><Th>Claimed by</Th><Th>Project</Th>
                <Th>Category</Th><Th>Status</Th><Th right>Amount</Th>
              </tr></thead>
              <tbody>
                {list.map((e) => {
                  const proj = e.projects as unknown as { id: string; code: string } | null;
                  const cat = e.cost_categories as unknown as { name: string } | null;
                  const emp = e.employees as unknown as { full_name: string } | null;
                  const who = e.profiles as unknown as { full_name: string } | null;
                  return (
                    <tr key={e.id} className="hover:bg-[var(--hover)]">
                      <Td className="whitespace-nowrap text-xs">{date(e.expense_date)}</Td>
                      <Td>
                        <span className="text-sm">{e.description}</span>
                        {e.is_billable && (
                          <span className="ml-1.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand)]">
                            billable
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs text-[var(--muted)]">{emp?.full_name ?? who?.full_name ?? "—"}</Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{cat?.name ?? "—"}</Td>
                      <Td><Badge value={e.status === "reimbursed" ? "paid" : e.status} /></Td>
                      <Td right>{money(e.amount)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="By category" subtitle="Approved only" />
          {catRows.length === 0 ? <Empty message="—" /> : (
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
