import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

const EQUIP_TONE: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700",
  in_use: "bg-blue-50 text-blue-700",
  maintenance: "bg-amber-50 text-amber-700",
  out_of_service: "bg-red-50 text-red-700",
  rented_out: "bg-indigo-50 text-indigo-700",
};

export default async function EquipmentPage() {
  const supabase = await createClient();
  const [{ data: equipment }, { data: allocations }, { data: maintenance }] = await Promise.all([
    supabase.from("equipment").select("*, vendors:rental_vendor_id(name)").order("asset_code"),
    supabase.from("equipment_allocations")
      .select("*, equipment(asset_code, name), projects(id, code, name)")
      .is("allocated_to", null),
    supabase.from("equipment_maintenance")
      .select("*, equipment(asset_code, name)")
      .order("performed_on", { ascending: false }).limit(20),
  ]);

  const list = equipment ?? [];
  const soon = new Date(Date.now() + 30 * 86400000);
  const inUse = list.filter((e) => e.status === "in_use");
  const downtime = list.filter((e) => ["maintenance", "out_of_service"].includes(e.status));
  const dueChecks = list.filter((e) =>
    [e.inspection_due, e.insurance_expiry].some((d) => d && new Date(d) <= soon));
  const rentalsEnding = list.filter((e) => e.ownership !== "owned" && e.rental_end_date && new Date(e.rental_end_date) <= soon);

  return (
    <div>
      <PageHeader title="Equipment & machinery" subtitle="Fleet, where it's allocated, and what's due for service" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assets" value={String(list.length)} hint={`${inUse.length} on site`} />
        <Stat label="Fleet value" value={money(list.reduce((s, e) => s + num(e.current_value), 0))} />
        <Stat label="Down" value={String(downtime.length)} hint="Maintenance or out of service"
          tone={downtime.length ? "warn" : "good"} />
        <Stat label="Checks due" value={String(dueChecks.length)}
          hint={`${rentalsEnding.length} rentals ending`} tone={dueChecks.length ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Fleet register" />
          {list.length === 0 ? <Empty message="No equipment recorded." /> : (
            <Table>
              <thead><tr>
                <Th>Asset</Th><Th>Category</Th><Th>Ownership</Th><Th>Status</Th>
                <Th right>Day rate</Th><Th right>Value</Th><Th right>Inspection due</Th>
              </tr></thead>
              <tbody>
                {list.map((e) => {
                  const dueSoon = e.inspection_due && new Date(e.inspection_due) <= soon;
                  return (
                    <tr key={e.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <span className="font-medium">{e.name}</span>
                        <span className="block font-mono text-xs text-[var(--muted)]">
                          {e.asset_code}{e.make_model ? ` · ${e.make_model}` : ""}
                        </span>
                      </Td>
                      <Td className="text-xs text-[var(--muted)]">{e.category ?? "—"}</Td>
                      <Td className="text-xs">{titleize(e.ownership)}</Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${EQUIP_TONE[e.status]}`}>
                          {e.status.replace(/_/g, " ")}
                        </span>
                      </Td>
                      <Td right>{money(e.daily_rate)}</Td>
                      <Td right>{money(e.current_value)}</Td>
                      <Td right className={`text-xs ${dueSoon ? "font-medium text-red-700" : ""}`}>{date(e.inspection_due)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="On allocation" subtitle="Currently out on projects" />
            {!allocations?.length ? <Empty message="Nothing allocated." /> : (
              <ul className="divide-y divide-[var(--border)]">
                {allocations.map((a) => {
                  const eq = a.equipment as unknown as { asset_code: string; name: string } | null;
                  const proj = a.projects as unknown as { id: string; code: string; name: string } | null;
                  return (
                    <li key={a.id} className="px-5 py-3">
                      <p className="text-sm font-medium">{eq?.name ?? "—"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {proj?.code ?? "Unassigned"} · since {date(a.allocated_from)} · {num(a.hours_used).toFixed(0)}h
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent maintenance" />
            {!maintenance?.length ? <Empty message="No maintenance logged." /> : (
              <ul className="divide-y divide-[var(--border)]">
                {maintenance.map((m) => {
                  const eq = m.equipment as unknown as { asset_code: string; name: string } | null;
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{eq?.name ?? "—"}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {m.maintenance_type} · {date(m.performed_on)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums">{money(m.cost)}</span>
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
