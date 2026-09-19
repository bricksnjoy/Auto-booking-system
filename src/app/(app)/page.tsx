import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card, CardHeader, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty,
} from "@/components/ui";
import { money, date, num } from "@/lib/format";
import type { ProjectFinancials } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: pf }, { data: cash }, { data: overdue }, { data: upcoming }, { data: rounds }] =
    await Promise.all([
      supabase.from("project_financials").select("*"),
      supabase.from("cash_summary").select("*").single(),
      supabase
        .from("invoices")
        .select("id, invoice_no, total, amount_paid, due_date, status, clients(name)")
        .in("status", ["sent", "part_paid", "overdue"])
        .order("due_date", { ascending: true })
        .limit(6),
      supabase
        .from("project_tasks")
        .select("id, title, due_date, status, projects(code, name)")
        .neq("status", "completed")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(6),
      supabase
        .from("funding_rounds")
        .select("id, name, target_amount, status, projects(code, name)")
        .eq("status", "open")
        .limit(5),
    ]);

  const projects = (pf ?? []) as ProjectFinancials[];
  const active = projects.filter((p) =>
    ["won", "in_progress", "on_hold"].includes(p.status),
  );

  const contractValue = active.reduce((s, p) => s + num(p.contract_value), 0);
  const actualCost = active.reduce((s, p) => s + num(p.actual_cost), 0);
  const capitalRaised = projects.reduce((s, p) => s + num(p.capital_received), 0);
  const capitalCommitted = projects.reduce((s, p) => s + num(p.capital_committed), 0);
  const margin = contractValue - actualCost;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live position across delivery, capital and cash"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active projects"
          value={String(active.length)}
          hint={`${projects.length} total on record`}
        />
        <Stat
          label="Contract value"
          value={money(contractValue)}
          hint="Active projects"
        />
        <Stat
          label="Gross margin"
          value={money(margin)}
          tone={margin >= 0 ? "good" : "bad"}
          hint={`Costs to date ${money(actualCost)}`}
        />
        <Stat
          label="Net cash"
          value={money(num(cash?.net_cash))}
          tone={num(cash?.net_cash) >= 0 ? "good" : "bad"}
          hint={`In ${money(num(cash?.cash_in))} · Out ${money(num(cash?.cash_out))}`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Capital committed"
          value={money(capitalCommitted)}
          hint="Signed & pledged by investors"
        />
        <Stat
          label="Capital received"
          value={money(capitalRaised)}
          hint={`${money(capitalCommitted - capitalRaised)} still to draw`}
        />
        <Stat
          label="Receivables"
          value={money(num(cash?.receivables))}
          tone={num(cash?.receivables) > 0 ? "warn" : "default"}
          hint="Owed by clients"
        />
        <Stat
          label="Payables"
          value={money(num(cash?.payables))}
          tone={num(cash?.payables) > 0 ? "warn" : "default"}
          hint="Owed to suppliers"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Active projects"
            subtitle="Budget vs actual cost and delivery progress"
            action={
              <Link href="/projects" className="text-xs font-medium text-[var(--brand)]">
                View all →
              </Link>
            }
          />
          {active.length === 0 ? (
            <Empty message="No active projects yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th right>Contract</Th>
                  <Th right>Cost</Th>
                  <Th right>Margin</Th>
                </tr>
              </thead>
              <tbody>
                {active.map((p) => {
                  const m = num(p.gross_margin);
                  return (
                    <tr key={p.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {p.code} · {p.client_name ?? "No client"}
                        </p>
                      </Td>
                      <Td><Badge value={p.status} /></Td>
                      <Td><Progress value={num(p.progress_pct)} /></Td>
                      <Td right>{money(p.contract_value)}</Td>
                      <Td right>{money(p.actual_cost)}</Td>
                      <Td right className={m >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {money(m)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Open funding rounds" />
            {!rounds?.length ? (
              <Empty message="No open rounds." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {rounds.map((r) => {
                  const proj = r.projects as unknown as { code: string; name: string } | null;
                  return (
                    <li key={r.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <Link href={`/funding/${r.id}`} className="text-sm font-medium hover:underline">
                          {r.name}
                        </Link>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {proj?.code} · {proj?.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {money(r.target_amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Invoices awaiting payment" />
            {!overdue?.length ? (
              <Empty message="Nothing outstanding." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {overdue.map((i) => {
                  const client = i.clients as unknown as { name: string } | null;
                  return (
                    <li key={i.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{i.invoice_no}</p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {client?.name ?? "—"} · due {date(i.due_date)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {money(num(i.total) - num(i.amount_paid))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Upcoming tasks" />
            {!upcoming?.length ? (
              <Empty message="No scheduled tasks." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {upcoming.map((t) => {
                  const proj = t.projects as unknown as { code: string } | null;
                  return (
                    <li key={t.id} className="px-5 py-3">
                      <p className="text-sm">{t.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {proj?.code} · {date(t.due_date)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
