import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VariationsPage() {
  const supabase = await createClient();
  const [{ data: variations }, { data: rfis }] = await Promise.all([
    supabase.from("variations").select("*, projects(id, code, name)").order("raised_date", { ascending: false }),
    supabase.from("rfis").select("*, projects(id, code), profiles:raised_by(full_name)").order("raised_date", { ascending: false }),
  ]);

  const vList = variations ?? [];
  const rList = rfis ?? [];
  const approved = vList.filter((v) => v.status === "approved");
  const pending = vList.filter((v) => ["draft", "submitted"].includes(v.status));
  const openRfis = rList.filter((r) => r.status === "open");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lateRfis = openRfis.filter((r) => r.required_by && new Date(r.required_by) < today);

  return (
    <div>
      <PageHeader title="RFIs & variations" subtitle="Questions to the client and the change orders they turn into" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Approved variations" value={money(approved.reduce((s, v) => s + num(v.cost_impact), 0))}
          hint={`${approved.length} approved`} tone="good" />
        <Stat label="Awaiting decision" value={money(pending.reduce((s, v) => s + num(v.cost_impact), 0))}
          hint={`${pending.length} submitted or drafted`} tone={pending.length ? "warn" : "default"} />
        <Stat label="Time impact" value={`${approved.reduce((s, v) => s + num(v.time_impact_days), 0)} days`}
          hint="From approved variations" />
        <Stat label="Open RFIs" value={String(openRfis.length)} hint={`${lateRfis.length} past the date needed`}
          tone={lateRfis.length ? "bad" : openRfis.length ? "warn" : "good"} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Variations / change orders" />
          {vList.length === 0 ? <Empty message="No variations raised." /> : (
            <Table>
              <thead><tr>
                <Th>Ref</Th><Th>Title</Th><Th>Project</Th><Th>Status</Th>
                <Th right>Cost impact</Th><Th right>Time</Th><Th right>Raised</Th><Th right>Approved</Th>
              </tr></thead>
              <tbody>
                {vList.map((v) => {
                  const proj = v.projects as unknown as { id: string; code: string } | null;
                  const cost = num(v.cost_impact);
                  return (
                    <tr key={v.id} className="hover:bg-[var(--hover)]">
                      <Td className="font-mono text-xs">{v.ref}</Td>
                      <Td>
                        <span className="font-medium">{v.title}</span>
                        {v.description && <span className="block max-w-sm truncate text-xs text-[var(--muted)]">{v.description}</span>}
                      </Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td><Badge value={v.status} /></Td>
                      <Td right className={cost >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {cost >= 0 ? "+" : ""}{money(cost)}
                      </Td>
                      <Td right className="text-xs">{v.time_impact_days ? `${v.time_impact_days}d` : "—"}</Td>
                      <Td right className="text-xs">{date(v.raised_date)}</Td>
                      <Td right className="text-xs">{date(v.approved_date)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="RFIs" subtitle="Requests for information" />
          {rList.length === 0 ? <Empty message="No RFIs raised." /> : (
            <Table>
              <thead><tr>
                <Th>Ref</Th><Th>Subject</Th><Th>Project</Th><Th>Status</Th>
                <Th right>Cost impact</Th><Th right>Raised</Th><Th right>Needed by</Th>
              </tr></thead>
              <tbody>
                {rList.map((r) => {
                  const proj = r.projects as unknown as { id: string; code: string } | null;
                  const late = r.status === "open" && r.required_by && new Date(r.required_by) < today;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--hover)]">
                      <Td className="font-mono text-xs">{r.ref}</Td>
                      <Td>
                        <span className="font-medium">{r.subject}</span>
                        <span className="block max-w-sm truncate text-xs text-[var(--muted)]">{r.question}</span>
                      </Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td><Badge value={r.status} /></Td>
                      <Td right>{num(r.cost_impact) ? money(r.cost_impact) : "—"}</Td>
                      <Td right className="text-xs">{date(r.raised_date)}</Td>
                      <Td right className={`text-xs ${late ? "font-medium text-red-700" : ""}`}>{date(r.required_by)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
