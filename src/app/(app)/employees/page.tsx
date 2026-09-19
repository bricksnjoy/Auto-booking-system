import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const [{ data: employees }, { data: crews }] = await Promise.all([
    supabase.from("employees").select("*, crews(name)").order("full_name"),
    supabase.from("crews").select("id, name"),
  ]);

  const list = employees ?? [];
  const active = list.filter((e) => e.status === "active");
  const siteWorkers = active.filter((e) => e.is_site_worker);
  const monthlyWage = active.reduce((s, e) => s + num(e.basic_salary) + num(e.allowances), 0);

  const byTrade = new Map<string, number>();
  for (const e of active) byTrade.set(e.trade ?? "Unassigned", (byTrade.get(e.trade ?? "Unassigned") ?? 0) + 1);

  return (
    <div>
      <PageHeader title="Employees & labour" subtitle="Office staff and site workforce" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active headcount" value={String(active.length)} hint={`${list.length} on record`} />
        <Stat label="Site workers" value={String(siteWorkers.length)}
          hint={`${active.length - siteWorkers.length} office & management`} />
        <Stat label="Monthly wage bill" value={money(monthlyWage)} hint="Basic plus allowances" />
        <Stat label="Crews" value={String((crews ?? []).length)} />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No employees on record." /> : (
          <Table>
            <thead><tr>
              <Th>Employee</Th><Th>Job title</Th><Th>Trade</Th><Th>Type</Th>
              <Th>Crew</Th><Th>Status</Th><Th right>Rate</Th><Th right>Hired</Th>
            </tr></thead>
            <tbody>
              {list.map((e) => {
                const crew = e.crews as unknown as { name: string } | null;
                return (
                  <tr key={e.id} className="hover:bg-[var(--bg)]">
                    <Td>
                      <span className="font-medium">{e.full_name}</span>
                      <span className="block font-mono text-xs text-[var(--muted)]">{e.employee_no}</span>
                    </Td>
                    <Td className="text-xs">{e.job_title ?? "—"}</Td>
                    <Td className="text-xs text-[var(--muted)]">{e.trade ?? "—"}</Td>
                    <Td className="text-xs">{titleize(e.employment_type)}</Td>
                    <Td className="text-xs text-[var(--muted)]">{crew?.name ?? "—"}</Td>
                    <Td><Badge value={e.status === "active" ? "active" : e.status === "terminated" ? "inactive" : "on_hold"} /></Td>
                    <Td right className="text-xs">
                      {num(e.basic_salary) > 0 ? `${money(e.basic_salary)}/mo`
                        : num(e.daily_rate) > 0 ? `${money(e.daily_rate)}/day`
                        : num(e.hourly_rate) > 0 ? `${money(e.hourly_rate)}/hr` : "—"}
                    </Td>
                    <Td right className="text-xs">{date(e.hire_date)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
