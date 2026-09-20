import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card, CardHeader, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty,
} from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";
import type { ProjectPnl } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: pnl }, { data: upcoming }] = await Promise.all([
    supabase.from("project_pnl").select("*").order("code"),
    supabase
      .from("project_tasks")
      .select("id, title, due_date, status, projects(id, code)")
      .neq("status", "completed")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(6),
  ]);

  const projects = (pnl ?? []) as ProjectPnl[];
  const active = projects.filter((p) =>
    ["won", "in_progress", "on_hold"].includes(p.status),
  );

  const value = projects.reduce((s, p) => s + num(p.value) + num(p.variation), 0);
  const exp = projects.reduce((s, p) => s + num(p.exp), 0);
  const profit = projects.reduce((s, p) => s + num(p.profit), 0);
  const margin = value > 0 ? (profit / value) * 100 : 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Where the projects stand" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Projects"
          value={String(projects.length)}
          hint={`${active.length} active`}
        />
        <Stat label="Project value" value={money(value)} hint="Including variations" />
        <Stat label="Expenditure" value={money(exp)} tone="bad" />
        <Stat
          label="Profit"
          value={money(profit)}
          hint={pct(margin, 1)}
          tone={profit >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Projects"
            subtitle="Value against cost to date"
            action={
              <Link href="/projects" className="text-xs font-medium text-[var(--brand)]">
                View all →
              </Link>
            }
          />
          {projects.length === 0 ? (
            <Empty message="No projects yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th right>Value</Th>
                  <Th right>EXP</Th>
                  <Th right>Profit</Th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const m = num(p.profit);
                  return (
                    <tr key={p.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                          {p.project_name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {p.code}
                          {p.client_name ? ` · ${p.client_name}` : ""}
                        </p>
                      </Td>
                      <Td><Badge value={p.status} /></Td>
                      <Td><Progress value={num(p.progress_pct)} /></Td>
                      <Td right>{money(num(p.value) + num(p.variation))}</Td>
                      <Td right>{money(p.exp)}</Td>
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

        <Card>
          <CardHeader title="Upcoming tasks" />
          {!upcoming?.length ? (
            <Empty message="No scheduled tasks." />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {upcoming.map((t) => {
                const proj = t.projects as unknown as { id: string; code: string } | null;
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
  );
}
