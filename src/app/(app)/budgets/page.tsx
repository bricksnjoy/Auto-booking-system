import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, num, pct } from "@/lib/format";
import type { ProjectFinancials } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const [{ data: fin }, { data: budgetLines }, { data: bills }] = await Promise.all([
    supabase.from("project_financials").select("*").order("code"),
    supabase.from("budget_lines").select("*, cost_categories(name), projects(id, code, name)"),
    supabase.from("bills").select("project_id, category_id, total, status"),
  ]);

  const projects = (fin ?? []) as ProjectFinancials[];
  const live = projects.filter((p) => ["won", "in_progress", "on_hold"].includes(p.status));
  const overBudget = live.filter((p) => num(p.budget_variance) < 0);

  // actual cost per project+category
  const actual = new Map<string, number>();
  for (const b of bills ?? []) {
    if (["void", "draft"].includes(b.status) || !b.project_id) continue;
    const key = `${b.project_id}::${b.category_id ?? "none"}`;
    actual.set(key, (actual.get(key) ?? 0) + num(b.total));
  }

  const totalBudget = live.reduce((s, p) => s + num(p.budget_lines_total), 0);
  const totalActual = live.reduce((s, p) => s + num(p.actual_cost), 0);
  const burn = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <div>
      <PageHeader title="Budgets & cost control" subtitle="Where each project is spending against its baseline" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Budgeted (live)" value={money(totalBudget)} hint={`${live.length} projects`} />
        <Stat label="Spent" value={money(totalActual)} hint={`${pct(burn, 0)} of budget`}
          tone={burn > 100 ? "bad" : burn > 85 ? "warn" : "good"} />
        <Stat label="Remaining" value={money(totalBudget - totalActual)}
          tone={totalBudget - totalActual < 0 ? "bad" : "default"} />
        <Stat label="Over budget" value={String(overBudget.length)} hint="Projects exceeding baseline"
          tone={overBudget.length ? "bad" : "good"} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Project burn" subtitle="Actual cost against budget baseline" />
        {live.length === 0 ? <Empty message="No live projects." /> : (
          <Table>
            <thead><tr>
              <Th>Project</Th><Th>Status</Th><Th right>Budget</Th><Th right>Actual</Th>
              <Th right>Variance</Th><Th>Burn</Th>
            </tr></thead>
            <tbody>
              {live.map((p) => {
                const budget = num(p.budget_lines_total);
                const spent = num(p.actual_cost);
                const variance = budget - spent;
                const usage = budget > 0 ? (spent / budget) * 100 : 0;
                return (
                  <tr key={p.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <span className="block font-mono text-xs text-[var(--muted)]">{p.code}</span>
                    </Td>
                    <Td><Badge value={p.status} /></Td>
                    <Td right>{money(budget)}</Td>
                    <Td right>{money(spent)}</Td>
                    <Td right className={variance >= 0 ? "text-emerald-700" : "font-medium text-red-700"}>
                      {money(variance)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--border)]">
                          <div className={`h-full rounded-full ${
                            usage > 100 ? "bg-red-600" : usage > 85 ? "bg-amber-500" : "bg-[var(--brand)]"}`}
                            style={{ width: `${Math.min(100, usage)}%` }} />
                        </div>
                        <span className={`text-xs tabular-nums ${usage > 100 ? "font-medium text-red-700" : "text-[var(--muted)]"}`}>
                          {usage.toFixed(0)}%
                        </span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Budget lines" subtitle="Category-level detail across all projects" />
        {!budgetLines?.length ? <Empty message="No budget lines set." /> : (
          <Table>
            <thead><tr>
              <Th>Project</Th><Th>Category</Th><Th>Description</Th>
              <Th right>Budget</Th><Th right>Actual</Th><Th right>Variance</Th>
            </tr></thead>
            <tbody>
              {budgetLines.map((l) => {
                const proj = l.projects as unknown as { id: string; code: string; name: string } | null;
                const cat = l.cost_categories as unknown as { name: string } | null;
                const spent = actual.get(`${l.project_id}::${l.category_id ?? "none"}`) ?? 0;
                const variance = num(l.budget_amount) - spent;
                return (
                  <tr key={l.id} className="hover:bg-[var(--hover)]">
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                    <Td className="text-xs">{cat?.name ?? "Uncategorised"}</Td>
                    <Td className="text-sm">{l.description}</Td>
                    <Td right>{money(l.budget_amount)}</Td>
                    <Td right>{money(spent)}</Td>
                    <Td right className={variance >= 0 ? "text-emerald-700" : "text-red-700"}>{money(variance)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--muted)]">
          Actual is the total of non-draft bills coded to the same project and category.
        </p>
      </Card>
    </div>
  );
}
