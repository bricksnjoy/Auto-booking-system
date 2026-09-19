import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { date, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

export default async function InspectionsPage() {
  const supabase = await createClient();
  const [{ data: inspections }, { data: snags }] = await Promise.all([
    supabase.from("inspections")
      .select("*, projects(id, code), profiles:inspector_id(full_name)")
      .order("inspected_on", { ascending: false }),
    supabase.from("snags")
      .select("*, projects(id, code), vendors(name), profiles:assigned_to(full_name)")
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const insList = inspections ?? [];
  const snagList = snags ?? [];
  const open = snagList.filter((s) => s.status !== "completed");
  const critical = open.filter((s) => ["high", "critical"].includes(s.severity));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = open.filter((s) => s.due_date && new Date(s.due_date) < today);
  const failed = insList.filter((i) => i.passed === false);

  return (
    <div>
      <PageHeader title="Inspections & snags" subtitle="Quality checks and the defect list they generate" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open snags" value={String(open.length)} hint={`${snagList.length} raised in total`}
          tone={open.length ? "warn" : "good"} />
        <Stat label="High / critical" value={String(critical.length)} tone={critical.length ? "bad" : "good"} />
        <Stat label="Overdue" value={String(overdue.length)} tone={overdue.length ? "bad" : "good"} />
        <Stat label="Failed inspections" value={String(failed.length)} hint={`${insList.length} inspections`}
          tone={failed.length ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Snag list" subtitle="Open defects first" />
          {snagList.length === 0 ? <Empty message="No snags raised." /> : (
            <Table>
              <thead><tr>
                <Th>Defect</Th><Th>Project</Th><Th>Location</Th><Th>Severity</Th>
                <Th>Owner</Th><Th>Status</Th><Th right>Due</Th>
              </tr></thead>
              <tbody>
                {[...snagList].sort((a, b) =>
                  (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0)
                ).map((s) => {
                  const proj = s.projects as unknown as { id: string; code: string } | null;
                  const vendor = s.vendors as unknown as { name: string } | null;
                  const who = s.profiles as unknown as { full_name: string } | null;
                  const late = s.status !== "completed" && s.due_date && new Date(s.due_date) < today;
                  return (
                    <tr key={s.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <span className="font-medium">{s.title}</span>
                        {s.description && <span className="block max-w-xs truncate text-xs text-[var(--muted)]">{s.description}</span>}
                      </Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{s.location ?? "—"}</Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_TONE[s.severity]}`}>
                          {s.severity}
                        </span>
                      </Td>
                      <Td className="text-xs">{vendor?.name ?? who?.full_name ?? "Unassigned"}</Td>
                      <Td><Badge value={s.status} /></Td>
                      <Td right className={`text-xs ${late ? "font-medium text-red-700" : ""}`}>{date(s.due_date)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Inspections" />
          {insList.length === 0 ? <Empty message="No inspections logged." /> : (
            <ul className="divide-y divide-[var(--border)]">
              {insList.map((i) => {
                const proj = i.projects as unknown as { id: string; code: string } | null;
                const who = i.profiles as unknown as { full_name: string } | null;
                return (
                  <li key={i.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{i.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        i.passed === true ? "bg-emerald-50 text-emerald-700"
                        : i.passed === false ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                        {i.passed === true ? "Passed" : i.passed === false ? "Failed" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {proj?.code ?? "—"} · {titleize(i.inspection_type)} · {date(i.inspected_on)}
                      {who && ` · ${who.full_name}`}
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
