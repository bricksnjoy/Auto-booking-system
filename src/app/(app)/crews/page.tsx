import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CrewsPage() {
  const supabase = await createClient();
  const [{ data: crews }, { data: employees }] = await Promise.all([
    supabase.from("crews")
      .select("*, vendors(name), projects(id, code, name), employees:supervisor_id(full_name)")
      .order("name"),
    supabase.from("employees").select("id, crew_id, status"),
  ]);

  const list = crews ?? [];
  const actualHeadcount = new Map<string, number>();
  for (const e of employees ?? []) {
    if (!e.crew_id || e.status !== "active") continue;
    actualHeadcount.set(e.crew_id, (actualHeadcount.get(e.crew_id) ?? 0) + 1);
  }

  const active = list.filter((c) => c.is_active);
  const totalHeads = active.reduce((s, c) => s + Math.max(num(c.headcount), actualHeadcount.get(c.id) ?? 0), 0);
  const dailyCost = active.reduce((s, c) => s + num(c.day_rate), 0);

  return (
    <div>
      <PageHeader title="Subcontractor crews" subtitle="Gangs on site, who supervises them and what they cost a day" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active crews" value={String(active.length)} hint={`${list.length} on record`} />
        <Stat label="Total headcount" value={String(totalHeads)} />
        <Stat label="Daily crew cost" value={money(dailyCost)} hint="All active crews" />
        <Stat label="Subcontracted" value={String(active.filter((c) => c.vendor_id).length)}
          hint={`${active.filter((c) => !c.vendor_id).length} in-house`} />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No crews set up." /> : (
          <Table>
            <thead><tr>
              <Th>Crew</Th><Th>Trade</Th><Th>Subcontractor</Th><Th>Project</Th>
              <Th>Supervisor</Th><Th right>Headcount</Th><Th right>Day rate</Th>
            </tr></thead>
            <tbody>
              {list.map((c) => {
                const vendor = c.vendors as unknown as { name: string } | null;
                const proj = c.projects as unknown as { id: string; code: string; name: string } | null;
                const sup = c.employees as unknown as { full_name: string } | null;
                const actual = actualHeadcount.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <span className="font-medium">{c.name}</span>
                      {!c.is_active && <span className="ml-1 text-xs text-[var(--muted)]">(inactive)</span>}
                    </Td>
                    <Td className="text-xs text-[var(--muted)]">{c.trade ?? "—"}</Td>
                    <Td className="text-xs">{vendor?.name ?? "In-house"}</Td>
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                    <Td className="text-xs text-[var(--muted)]">{sup?.full_name ?? "—"}</Td>
                    <Td right>
                      {num(c.headcount)}
                      {actual !== undefined && actual !== num(c.headcount) && (
                        <span className="block text-xs text-[var(--muted)]">{actual} assigned</span>
                      )}
                    </Td>
                    <Td right>{money(c.day_rate)}</Td>
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
