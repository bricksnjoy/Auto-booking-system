import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Progress, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: phases }, { data: milestones }] = await Promise.all([
    supabase.from("projects").select("id, code, name, status, progress_pct, start_date, end_date")
      .in("status", ["won", "in_progress", "on_hold"]).order("code"),
    supabase.from("project_phases").select("*").order("sort_order"),
    supabase.from("milestones").select("*, projects(id, code, name)")
      .order("planned_date", { ascending: true, nullsFirst: false }),
  ]);

  const projList = projects ?? [];
  const ms = milestones ?? [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueMs = ms.filter((m) => m.status !== "completed" && m.planned_date && new Date(m.planned_date) < today);
  const paymentMs = ms.filter((m) => m.is_payment_milestone && m.status !== "completed");
  const behind = projList.filter((p) => {
    if (!p.start_date || !p.end_date) return false;
    const start = new Date(p.start_date).getTime(), end = new Date(p.end_date).getTime();
    if (end <= start) return false;
    const expected = Math.min(100, Math.max(0, ((today.getTime() - start) / (end - start)) * 100));
    return num(p.progress_pct) < expected - 10;
  });

  const phasesByProject = new Map<string, typeof phases>();
  for (const ph of phases ?? []) {
    const arr = phasesByProject.get(ph.project_id) ?? [];
    arr.push(ph);
    phasesByProject.set(ph.project_id, arr);
  }

  return (
    <div>
      <PageHeader title="Progress tracking" subtitle="Where every live project actually stands against its programme" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live projects" value={String(projList.length)} />
        <Stat label="Average progress"
          value={`${(projList.reduce((s, p) => s + num(p.progress_pct), 0) / (projList.length || 1)).toFixed(0)}%`} />
        <Stat label="Running behind" value={String(behind.length)} hint="10%+ behind schedule"
          tone={behind.length ? "bad" : "good"} />
        <Stat label="Overdue milestones" value={String(overdueMs.length)}
          hint={`${paymentMs.length} payment milestones open`} tone={overdueMs.length ? "bad" : "good"} />
      </div>

      <div className="space-y-4">
        {projList.length === 0 ? (
          <Card><Empty message="No live projects." /></Card>
        ) : projList.map((p) => {
          const phs = phasesByProject.get(p.id) ?? [];
          const projMs = ms.filter((m) => m.project_id === p.id);
          const start = p.start_date ? new Date(p.start_date).getTime() : null;
          const end = p.end_date ? new Date(p.end_date).getTime() : null;
          const expected = start && end && end > start
            ? Math.min(100, Math.max(0, ((today.getTime() - start) / (end - start)) * 100)) : null;
          const variance = expected !== null ? num(p.progress_pct) - expected : null;

          return (
            <Card key={p.id}>
              <CardHeader
                title={p.name}
                subtitle={`${p.code} · ${date(p.start_date)} → ${date(p.end_date)}`}
                action={
                  <div className="flex items-center gap-3">
                    {variance !== null && (
                      <span className={`text-xs font-medium ${variance >= -10 ? "text-emerald-700" : "text-red-700"}`}>
                        {variance >= 0 ? "+" : ""}{variance.toFixed(0)}% vs plan
                      </span>
                    )}
                    <Progress value={num(p.progress_pct)} />
                  </div>
                }
              />
              <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Phases</p>
                  {phs.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No phases defined.</p>
                  ) : (
                    <ul className="space-y-2">
                      {phs.map((ph) => (
                        <li key={ph.id} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm">{ph.name}</span>
                          <Badge value={ph.status} />
                          <Progress value={num(ph.progress_pct)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Milestones</p>
                  {projMs.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No milestones set.</p>
                  ) : (
                    <ul className="space-y-2">
                      {projMs.map((m) => {
                        const late = m.status !== "completed" && m.planned_date && new Date(m.planned_date) < today;
                        return (
                          <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0 flex-1 truncate">
                              {m.name}
                              {m.is_payment_milestone && (
                                <span className="ml-1.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand)]">
                                  {money(m.payment_amount)}
                                </span>
                              )}
                            </span>
                            <span className={`shrink-0 text-xs ${late ? "font-medium text-red-700" : "text-[var(--muted)]"}`}>
                              {date(m.actual_date ?? m.planned_date)}
                            </span>
                            <Badge value={m.status} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
