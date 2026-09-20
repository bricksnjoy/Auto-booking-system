import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card, CardHeader, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty,
} from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";
import type { ProjectPnl, InvestorSplit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pnlRow } = await supabase
    .from("project_pnl")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!pnlRow) notFound();
  const p = pnlRow as ProjectPnl;

  const [
    { data: project },
    { data: phases },
    { data: milestones },
    { data: tasks },
    { data: budget },
    { data: bills },
    { data: splits },
  ] = await Promise.all([
    supabase.from("projects").select("*, clients(name)").eq("id", id).single(),
    supabase.from("project_phases").select("*").eq("project_id", id).order("sort_order"),
    supabase.from("milestones").select("*").eq("project_id", id)
      .order("planned_date", { nullsFirst: false }),
    supabase.from("project_tasks").select("*").eq("project_id", id)
      .order("due_date", { nullsFirst: false }),
    supabase.from("budget_lines").select("*, cost_categories(name)").eq("project_id", id),
    supabase.from("bills")
      .select("*, vendors(name), cost_categories(name)")
      .eq("project_id", id)
      .order("issue_date", { ascending: false }),
    supabase.from("project_investor_splits").select("*").eq("project_id", id),
  ]);

  const investors = (splits ?? []) as InvestorSplit[];

  // budget vs actual, by cost category
  const byCat = new Map<string, { budget: number; actual: number }>();
  for (const b of budget ?? []) {
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    const row = byCat.get(cat) ?? { budget: 0, actual: 0 };
    row.budget += num(b.budget_amount);
    byCat.set(cat, row);
  }
  for (const b of bills ?? []) {
    if (["void", "draft"].includes(b.status)) continue;
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    const row = byCat.get(cat) ?? { budget: 0, actual: 0 };
    row.actual += num(b.total);
    byCat.set(cat, row);
  }
  const costRows = [...byCat.entries()].sort((a, b) => b[1].actual - a[1].actual);

  const client = project?.clients as unknown as { name: string } | null;
  const revised = num(p.value) + num(p.variation);

  return (
    <div>
      <div className="mb-2">
        <Link href="/projects" className="text-xs text-[var(--muted)] hover:underline">
          ← Projects
        </Link>
      </div>
      <PageHeader
        title={p.project_name}
        subtitle={`${p.code}${client?.name ? ` · ${client.name}` : ""}`}
        action={<Badge value={p.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Project value" value={money(p.value)} />
        <Stat
          label="Variation"
          value={num(p.variation) ? money(p.variation) : "—"}
          hint={`Revised ${money(revised)}`}
        />
        <Stat label="GST" value={money(p.gst)} hint="Collected for MIRA" />
        <Stat label="EXP" value={money(p.exp)} tone="bad" hint={`${bills?.length ?? 0} bills`} />
        <Stat
          label="Profit"
          value={money(p.profit)}
          tone={num(p.profit) >= 0 ? "good" : "bad"}
          hint={revised > 0 ? pct((num(p.profit) / revised) * 100, 1) : undefined}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Cost breakdown" subtitle="Budget against actual, by category" />
          {costRows.length === 0 ? (
            <Empty message="No costs recorded." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Category</Th><Th right>Budget</Th><Th right>Actual</Th><Th right>Variance</Th></tr>
              </thead>
              <tbody>
                {costRows.map(([cat, r]) => {
                  const v = r.budget - r.actual;
                  return (
                    <tr key={cat}>
                      <Td>{cat}</Td>
                      <Td right>{r.budget ? money(r.budget) : "—"}</Td>
                      <Td right>{money(r.actual)}</Td>
                      <Td right className={r.budget ? (v >= 0 ? "text-emerald-700" : "text-red-700") : "text-[var(--muted)]"}>
                        {r.budget ? money(v) : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Investor split" subtitle="Share of this project's profit" />
          {investors.length === 0 ? (
            <Empty message="Self-funded — no investors on this project." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Investor</Th><Th right>Share</Th><Th right>Profit</Th></tr>
              </thead>
              <tbody>
                {investors.map((s) => (
                  <tr key={s.commitment_id}>
                    <Td className="font-medium">{s.investor_name}</Td>
                    <Td right>
                      {s.share_mode === "fixed"
                        ? "Fixed"
                        : `${num(s.profit_share_pct).toFixed(0)}%`}
                    </Td>
                    <Td right>{money(s.investor_profit)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Programme" subtitle="Phases and progress" />
          {!phases?.length ? (
            <Empty message="No phases defined." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Phase</Th><Th>Status</Th><Th>Progress</Th><Th right>Dates</Th></tr>
              </thead>
              <tbody>
                {phases.map((ph) => (
                  <tr key={ph.id}>
                    <Td className="font-medium">{ph.name}</Td>
                    <Td><Badge value={ph.status} /></Td>
                    <Td><Progress value={num(ph.progress_pct)} /></Td>
                    <Td right className="text-xs text-[var(--muted)]">
                      {date(ph.start_date)} → {date(ph.end_date)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Milestones" />
          {!milestones?.length ? (
            <Empty message="No milestones set." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Milestone</Th><Th>Status</Th><Th right>Planned</Th><Th right>Actual</Th></tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id}>
                    <Td>{m.name}</Td>
                    <Td><Badge value={m.status} /></Td>
                    <Td right className="text-xs">{date(m.planned_date)}</Td>
                    <Td right className="text-xs">{date(m.actual_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Bills"
            subtitle={`${bills?.length ?? 0} bills making up EXP of ${money(p.exp)}`}
          />
          {!bills?.length ? (
            <Empty message="No bills recorded." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th><Th>Shop</Th><Th>Category</Th><Th>Status</Th>
                  <Th right>Net</Th><Th right>GST</Th><Th right>Total</Th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const v = b.vendors as unknown as { name: string } | null;
                  const cat = b.cost_categories as unknown as { name: string } | null;
                  return (
                    <tr key={b.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <span className="font-mono text-xs">{b.bill_no}</span>
                        <span className="block text-xs text-[var(--muted)]">{date(b.issue_date)}</span>
                      </Td>
                      <Td>{v?.name ?? "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{cat?.name ?? "—"}</Td>
                      <Td><Badge value={b.status} /></Td>
                      <Td right>{money(b.subtotal)}</Td>
                      <Td right className="text-[var(--muted)]">{money(b.tax_amount)}</Td>
                      <Td right className="font-medium">{money(b.total)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Tasks" />
          {!tasks?.length ? (
            <Empty message="No tasks." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Task</Th><Th>Status</Th><Th right>Due</Th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.title}</Td>
                    <Td><Badge value={t.status} /></Td>
                    <Td right className="text-xs">{date(t.due_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
