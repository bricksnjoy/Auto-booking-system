import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Table, Th, Td, Empty } from "@/components/ui";
import { date, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

export default async function SafetyPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("safety_incidents")
    .select("*, projects(id, code), profiles:reported_by(full_name)")
    .order("incident_date", { ascending: false });

  const list = data ?? [];
  const open = list.filter((i) => !i.closed);
  const injuries = list.filter((i) => i.injury);
  const lostTime = list.reduce((s, i) => s + num(i.lost_time_hours), 0);
  const reportable = list.filter((i) => i.reportable_to_authority);

  const yearAgo = new Date(Date.now() - 365 * 86400000);
  const thisYear = list.filter((i) => new Date(i.incident_date) >= yearAgo);
  const lastIncident = list[0];
  const daysSince = lastIncident
    ? Math.floor((Date.now() - new Date(lastIncident.incident_date).getTime()) / 86400000)
    : null;

  return (
    <div>
      <PageHeader title="Safety & incidents" subtitle="Every incident, near miss and the action taken" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Days since last incident" value={daysSince === null ? "—" : String(daysSince)}
          tone={daysSince === null || daysSince > 30 ? "good" : "warn"} />
        <Stat label="Open investigations" value={String(open.length)} tone={open.length ? "warn" : "good"} />
        <Stat label="Injuries (12 months)" value={String(thisYear.filter((i) => i.injury).length)}
          hint={`${injuries.length} all time`} tone={thisYear.some((i) => i.injury) ? "bad" : "good"} />
        <Stat label="Lost time" value={`${lostTime.toFixed(0)} hrs`}
          hint={`${reportable.length} reportable to authority`} />
      </div>
      <Card>
        <CardHeader title="Incident register" />
        {list.length === 0 ? <Empty message="No incidents recorded. Long may it continue." /> : (
          <Table>
            <thead><tr>
              <Th>Date</Th><Th>Type</Th><Th>Project</Th><Th>Severity</Th><Th>Description</Th>
              <Th right>Lost time</Th><Th>Status</Th>
            </tr></thead>
            <tbody>
              {list.map((i) => {
                const proj = i.projects as unknown as { id: string; code: string } | null;
                return (
                  <tr key={i.id} className="hover:bg-[var(--hover)]">
                    <Td className="whitespace-nowrap text-xs">{date(i.incident_date)}</Td>
                    <Td className="text-xs font-medium">
                      {titleize(i.incident_type)}
                      {i.injury && <span className="block text-red-700">Injury</span>}
                    </Td>
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_TONE[i.severity]}`}>
                        {i.severity}
                      </span>
                    </Td>
                    <Td className="max-w-md text-xs">
                      {i.description}
                      {i.action_taken && (
                        <span className="mt-0.5 block text-[var(--muted)]">Action: {i.action_taken}</span>
                      )}
                    </Td>
                    <Td right className="text-xs">{num(i.lost_time_hours) ? `${num(i.lost_time_hours)}h` : "—"}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        i.closed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {i.closed ? "Closed" : "Open"}
                      </span>
                      {i.reportable_to_authority && (
                        <span className="mt-0.5 block text-[10px] text-red-700">Reportable</span>
                      )}
                    </Td>
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
