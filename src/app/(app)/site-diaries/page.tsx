import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { date, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SiteDiariesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_diaries")
    .select("*, projects(id, code, name), profiles:recorded_by(full_name)")
    .order("diary_date", { ascending: false })
    .limit(120);

  const list = data ?? [];
  const last7 = list.filter((d) => new Date(d.diary_date) >= new Date(Date.now() - 7 * 86400000));
  const withDelays = list.filter((d) => d.delays?.trim());

  return (
    <div>
      <PageHeader title="Site diaries" subtitle="Daily record of who was on site, what got done and what held it up" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Entries" value={String(list.length)} hint="Most recent 120" />
        <Stat label="Logged this week" value={String(last7.length)} />
        <Stat label="Labour hours (7d)" value={last7.reduce((s, d) => s + num(d.hours_worked), 0).toFixed(0)} />
        <Stat label="Days with delays" value={String(withDelays.length)} tone={withDelays.length ? "warn" : "good"} />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No diary entries yet." /> : (
          <Table>
            <thead><tr>
              <Th>Date</Th><Th>Project</Th><Th>Weather</Th>
              <Th right>Workers</Th><Th right>Hours</Th><Th>Work done</Th><Th>Delays</Th><Th>By</Th>
            </tr></thead>
            <tbody>
              {list.map((d) => {
                const proj = d.projects as unknown as { id: string; code: string; name: string } | null;
                const by = d.profiles as unknown as { full_name: string } | null;
                return (
                  <tr key={d.id} className="hover:bg-[var(--bg)]">
                    <Td className="whitespace-nowrap text-xs font-medium">{date(d.diary_date)}</Td>
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                    <Td className="text-xs">
                      {titleize(d.weather)}
                      {d.temperature_c !== null && <span className="block text-[var(--muted)]">{d.temperature_c}°C</span>}
                    </Td>
                    <Td right>{d.workers_on_site}</Td>
                    <Td right>{num(d.hours_worked).toFixed(0)}</Td>
                    <Td className="max-w-xs text-xs">{d.work_done ?? "—"}</Td>
                    <Td className={`max-w-xs text-xs ${d.delays ? "text-amber-700" : "text-[var(--muted)]"}`}>{d.delays ?? "None"}</Td>
                    <Td className="text-xs text-[var(--muted)]">{by?.full_name ?? "—"}</Td>
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
