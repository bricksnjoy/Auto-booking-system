import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

const ATT_TONE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700",
  absent: "bg-red-50 text-red-700",
  half_day: "bg-amber-50 text-amber-700",
  leave: "bg-blue-50 text-blue-700",
  sick: "bg-orange-50 text-orange-700",
  holiday: "bg-slate-100 text-slate-600",
  rest_day: "bg-slate-100 text-slate-600",
};

export default async function AttendancePage() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: attendance }, { data: timesheets }] = await Promise.all([
    supabase.from("attendance")
      .select("*, employees(employee_no, full_name, trade), projects(id, code)")
      .gte("work_date", since)
      .order("work_date", { ascending: false })
      .limit(200),
    supabase.from("timesheets")
      .select("*, profiles(full_name), projects(id, code)")
      .gte("work_date", since)
      .order("work_date", { ascending: false })
      .limit(100),
  ]);

  const att = attendance ?? [];
  const ts = timesheets ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayAtt = att.filter((a) => String(a.work_date).slice(0, 10) === today);
  const totalHours = att.reduce((s, a) => s + num(a.hours_worked), 0);
  const overtime = att.reduce((s, a) => s + num(a.overtime_hours), 0);
  const unapproved = ts.filter((t) => !t.approved);

  return (
    <div>
      <PageHeader title="Attendance & timesheets" subtitle="Last 30 days of site attendance and logged hours" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="On site today" value={String(todayAtt.filter((a) => a.status === "present").length)}
          hint={`${todayAtt.length} records today`} />
        <Stat label="Hours logged (30d)" value={totalHours.toFixed(0)} />
        <Stat label="Overtime (30d)" value={`${overtime.toFixed(0)} hrs`}
          tone={overtime > 0 ? "warn" : "default"} />
        <Stat label="Timesheets unapproved" value={String(unapproved.length)}
          hint={money(unapproved.reduce((s, t) => s + num(t.hours) * num(t.hourly_rate), 0))}
          tone={unapproved.length ? "warn" : "good"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attendance register" subtitle="Site workforce, most recent first" />
          {att.length === 0 ? <Empty message="No attendance recorded in the last 30 days." /> : (
            <Table>
              <thead><tr>
                <Th>Date</Th><Th>Employee</Th><Th>Project</Th><Th>Status</Th>
                <Th right>In</Th><Th right>Out</Th><Th right>Hours</Th><Th right>OT</Th>
              </tr></thead>
              <tbody>
                {att.map((a) => {
                  const emp = a.employees as unknown as { employee_no: string; full_name: string; trade: string | null } | null;
                  const proj = a.projects as unknown as { id: string; code: string } | null;
                  return (
                    <tr key={a.id} className="hover:bg-[var(--bg)]">
                      <Td className="whitespace-nowrap text-xs">{date(a.work_date)}</Td>
                      <Td>
                        <span className="text-sm">{emp?.full_name ?? "—"}</span>
                        {emp?.trade && <span className="block text-xs text-[var(--muted)]">{emp.trade}</span>}
                      </Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ATT_TONE[a.status]}`}>
                          {titleize(a.status)}
                        </span>
                      </Td>
                      <Td right className="text-xs text-[var(--muted)]">{a.clock_in?.slice(0, 5) ?? "—"}</Td>
                      <Td right className="text-xs text-[var(--muted)]">{a.clock_out?.slice(0, 5) ?? "—"}</Td>
                      <Td right>{num(a.hours_worked).toFixed(1)}</Td>
                      <Td right className={num(a.overtime_hours) > 0 ? "text-amber-700" : "text-[var(--muted)]"}>
                        {num(a.overtime_hours) ? num(a.overtime_hours).toFixed(1) : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Staff timesheets" subtitle="Hours booked by app users" />
          {ts.length === 0 ? <Empty message="No timesheets." /> : (
            <ul className="divide-y divide-[var(--border)]">
              {ts.map((t) => {
                const who = t.profiles as unknown as { full_name: string } | null;
                const proj = t.projects as unknown as { code: string } | null;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{who?.full_name ?? "—"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {date(t.work_date)}{proj ? ` · ${proj.code}` : ""}
                        {!t.approved && <span className="ml-1 text-amber-700">unapproved</span>}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">{num(t.hours).toFixed(1)}h</span>
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
