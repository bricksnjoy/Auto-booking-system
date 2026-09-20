import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card, CardHeader, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty,
} from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";
import type { ProjectFinancials } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fin } = await supabase
    .from("project_financials")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!fin) notFound();
  const p = fin as ProjectFinancials;

  const [
    { data: project },
    { data: phases },
    { data: tasks },
    { data: budget },
    { data: bills },
    { data: invoices },
    { data: rounds },
    { data: subs },
    { data: docs },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name), profiles:project_manager_id(full_name)")
      .eq("id", id)
      .single(),
    supabase.from("project_phases").select("*").eq("project_id", id).order("sort_order"),
    supabase
      .from("project_tasks")
      .select("*, profiles:assignee_id(full_name)")
      .eq("project_id", id)
      .order("due_date", { nullsFirst: false }),
    supabase
      .from("budget_lines")
      .select("*, cost_categories(name)")
      .eq("project_id", id),
    supabase
      .from("bills")
      .select("*, vendors(name), cost_categories(name)")
      .eq("project_id", id)
      .order("issue_date", { ascending: false }),
    supabase.from("invoices").select("*").eq("project_id", id).order("issue_date", { ascending: false }),
    supabase
      .from("funding_rounds")
      .select("*, commitments(id, amount, status, investors(name))")
      .eq("project_id", id),
    supabase.from("subcontracts").select("*, vendors(name, trade)").eq("project_id", id),
    supabase.from("documents").select("*").eq("project_id", id).order("created_at", { ascending: false }),
  ]);

  const client = project?.clients as unknown as { name: string } | null;
  const pm = project?.profiles as unknown as { full_name: string } | null;

  // actual cost grouped by category, against budget
  const budgetByCat = new Map<string, { budget: number; actual: number }>();
  for (const b of budget ?? []) {
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    const row = budgetByCat.get(cat) ?? { budget: 0, actual: 0 };
    row.budget += num(b.budget_amount);
    budgetByCat.set(cat, row);
  }
  for (const b of bills ?? []) {
    if (["void", "draft"].includes(b.status)) continue;
    const cat = (b.cost_categories as unknown as { name: string } | null)?.name ?? "Uncategorised";
    const row = budgetByCat.get(cat) ?? { budget: 0, actual: 0 };
    row.actual += num(b.total);
    budgetByCat.set(cat, row);
  }
  const costRows = [...budgetByCat.entries()].sort((a, b) => b[1].budget - a[1].budget);

  return (
    <div>
      <div className="mb-2">
        <Link href="/projects" className="text-xs text-[var(--muted)] hover:underline">
          ← Projects
        </Link>
      </div>
      <PageHeader
        title={p.name}
        subtitle={`${p.code} · ${client?.name ?? "No client"} · PM ${pm?.full_name ?? "unassigned"}`}
        action={<Badge value={p.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Contract value" value={money(p.contract_value)} />
        <Stat
          label="Cost to date"
          value={money(p.actual_cost)}
          hint={`Budget ${money(p.budget_lines_total)}`}
          tone={num(p.budget_variance) < 0 ? "bad" : "default"}
        />
        <Stat
          label="Gross margin"
          value={money(p.gross_margin)}
          hint={pct(p.margin_pct)}
          tone={num(p.gross_margin) >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Capital received"
          value={money(p.capital_received)}
          hint={`Target ${money(p.funding_target)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Invoiced" value={money(p.total_invoiced)} />
        <Stat label="Collected" value={money(p.total_collected)} />
        <Stat label="Receivables" value={money(p.receivables)} tone={num(p.receivables) > 0 ? "warn" : "default"} />
        <Stat label="Payables" value={money(p.payables)} tone={num(p.payables) > 0 ? "warn" : "default"} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Cost breakdown" subtitle="Budget vs actual by category" />
          {costRows.length === 0 ? (
            <Empty message="No budget lines or costs recorded." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th right>Budget</Th>
                  <Th right>Actual</Th>
                  <Th right>Variance</Th>
                </tr>
              </thead>
              <tbody>
                {costRows.map(([cat, r]) => {
                  const v = r.budget - r.actual;
                  return (
                    <tr key={cat}>
                      <Td>{cat}</Td>
                      <Td right>{money(r.budget)}</Td>
                      <Td right>{money(r.actual)}</Td>
                      <Td right className={v >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {money(v)}
                      </Td>
                    </tr>
                  );
                })}
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
                <tr>
                  <Th>Phase</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th right>Dates</Th>
                </tr>
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
          <CardHeader title="Funding" subtitle="Rounds and investor commitments" />
          {!rounds?.length ? (
            <Empty message="No funding rounds on this project." />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {rounds.map((r) => {
                const commitments = (r.commitments ?? []) as unknown as {
                  id: string; amount: number; status: string; investors: { name: string } | null;
                }[];
                const raised = commitments
                  .filter((c) => !["withdrawn", "defaulted"].includes(c.status))
                  .reduce((s, c) => s + num(c.amount), 0);
                return (
                  <div key={r.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{r.name}</span>
                      <Badge value={r.status} />
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {money(raised)} committed of {money(r.target_amount)} target ·{" "}
                      {pct(r.offered_return_pct)} return · {r.term_months ?? "—"} months
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)]"
                        style={{
                          width: `${Math.min(100, num(r.target_amount) > 0 ? (raised / num(r.target_amount)) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                    {commitments.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {commitments.map((c) => (
                          <li key={c.id} className="flex justify-between text-xs">
                            <span className="text-[var(--muted)]">{c.investors?.name ?? "—"}</span>
                            <span className="tabular-nums">{money(c.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Subcontract packages" />
          {!subs?.length ? (
            <Empty message="No packages awarded." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Package</Th>
                  <Th>Vendor</Th>
                  <Th>Status</Th>
                  <Th right>Value</Th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const v = s.vendors as unknown as { name: string; trade: string | null } | null;
                  return (
                    <tr key={s.id}>
                      <Td className="font-medium">{s.package_name}</Td>
                      <Td>
                        {v?.name ?? "—"}
                        {v?.trade && (
                          <span className="block text-xs text-[var(--muted)]">{v.trade}</span>
                        )}
                      </Td>
                      <Td><Badge value={s.status} /></Td>
                      <Td right>{money(s.contract_value)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Costs & bills" subtitle="Supplier and subcontractor invoices" />
          {!bills?.length ? (
            <Empty message="No bills recorded." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Vendor</Th>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  <Th right>Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const v = b.vendors as unknown as { name: string } | null;
                  return (
                    <tr key={b.id}>
                      <Td>
                        <span className="font-mono text-xs">{b.bill_no}</span>
                        <span className="block text-xs text-[var(--muted)]">{date(b.issue_date)}</span>
                      </Td>
                      <Td>{v?.name ?? "—"}</Td>
                      <Td><Badge value={b.status} /></Td>
                      <Td right>{money(b.total)}</Td>
                      <Td right>{money(num(b.total) - num(b.amount_paid))}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Client invoices" />
          {!invoices?.length ? (
            <Empty message="Nothing invoiced yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Status</Th>
                  <Th right>Total</Th>
                  <Th right>Outstanding</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <span className="font-mono text-xs">{i.invoice_no}</span>
                      <span className="block text-xs text-[var(--muted)]">due {date(i.due_date)}</span>
                    </Td>
                    <Td><Badge value={i.status} /></Td>
                    <Td right>{money(i.total)}</Td>
                    <Td right>{money(num(i.total) - num(i.amount_paid))}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Tasks" />
          {!tasks?.length ? (
            <Empty message="No tasks." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Task</Th>
                  <Th>Assignee</Th>
                  <Th>Status</Th>
                  <Th right>Due</Th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const a = t.profiles as unknown as { full_name: string } | null;
                  return (
                    <tr key={t.id}>
                      <Td>{t.title}</Td>
                      <Td className="text-[var(--muted)]">{a?.full_name ?? "—"}</Td>
                      <Td><Badge value={t.status} /></Td>
                      <Td right className="text-xs">{date(t.due_date)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Documents" />
          {!docs?.length ? (
            <Empty message="No documents uploaded." />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {d.category ?? "Uncategorised"} · {date(d.created_at)}
                    </p>
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
