import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, num, titleize } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: projects }, { data: tenders }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("project_financials").select("id, client_name, contract_value, status, total_invoiced, receivables"),
    supabase.from("tenders").select("id, client_id, status, bid_amount"),
  ]);

  const list = clients ?? [];
  const stats = new Map<string, { projects: number; value: number; receivable: number }>();
  for (const p of projects ?? []) {
    if (!p.client_name) continue;
    const row = stats.get(p.client_name) ?? { projects: 0, value: 0, receivable: 0 };
    row.projects += 1;
    row.value += num(p.contract_value);
    row.receivable += num(p.receivables);
    stats.set(p.client_name, row);
  }
  const openTenders = new Map<string, number>();
  for (const t of tenders ?? []) {
    if (!t.client_id || ["won", "lost", "withdrawn"].includes(t.status)) continue;
    openTenders.set(t.client_id, (openTenders.get(t.client_id) ?? 0) + 1);
  }

  const totalValue = [...stats.values()].reduce((s, r) => s + r.value, 0);
  const totalReceivable = [...stats.values()].reduce((s, r) => s + r.receivable, 0);

  return (
    <div>
      <PageHeader title="Leads & clients" subtitle="Everyone Spruce & Co builds for, and who's still in the pipeline" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clients" value={String(list.length)} hint={`${list.filter((c) => c.is_active).length} active`} />
        <Stat label="Lifetime contract value" value={money(totalValue)} />
        <Stat label="Owed to us" value={money(totalReceivable)} tone={totalReceivable > 0 ? "warn" : "default"} />
        <Stat label="Open tenders" value={String((tenders ?? []).filter((t) => !["won", "lost", "withdrawn"].includes(t.status)).length)} />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No clients yet." /> : (
          <Table>
            <thead><tr>
              <Th>Client</Th><Th>Type</Th><Th>Contact</Th><Th>Location</Th>
              <Th right>Projects</Th><Th right>Value</Th><Th right>Receivable</Th><Th right>Open bids</Th>
            </tr></thead>
            <tbody>
              {list.map((c) => {
                const s = stats.get(c.name);
                return (
                  <tr key={c.id} className="hover:bg-[var(--bg)]">
                    <Td>
                      <span className="font-medium">{c.name}</span>
                      {!c.is_active && <Badge value="inactive" />}
                    </Td>
                    <Td className="text-xs">{titleize(c.type)}</Td>
                    <Td className="text-xs text-[var(--muted)]">
                      {c.contact_name ?? "—"}
                      {c.email && <span className="block">{c.email}</span>}
                    </Td>
                    <Td className="text-xs text-[var(--muted)]">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</Td>
                    <Td right>{s?.projects ?? 0}</Td>
                    <Td right>{money(s?.value ?? 0)}</Td>
                    <Td right className={(s?.receivable ?? 0) > 0 ? "text-amber-700" : ""}>{money(s?.receivable ?? 0)}</Td>
                    <Td right>{openTenders.get(c.id) ?? 0}</Td>
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
