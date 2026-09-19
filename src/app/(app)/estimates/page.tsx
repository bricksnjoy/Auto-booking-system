import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const supabase = await createClient();
  const [{ data: estimates }, { data: lines }] = await Promise.all([
    supabase.from("estimates")
      .select("*, clients(name), projects(id, code), profiles:prepared_by(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("estimate_lines").select("estimate_id, line_total"),
  ]);

  const list = estimates ?? [];
  const baseCost = new Map<string, number>();
  for (const l of lines ?? []) {
    baseCost.set(l.estimate_id, (baseCost.get(l.estimate_id) ?? 0) + num(l.line_total));
  }
  // sell price = base cost + overhead + margin + contingency
  const sellOf = (e: (typeof list)[number]) => {
    const base = baseCost.get(e.id) ?? 0;
    return base * (1 + num(e.overhead_pct) / 100 + num(e.margin_pct) / 100 + num(e.contingency_pct) / 100);
  };

  const approved = list.filter((e) => e.status === "approved");

  return (
    <div>
      <PageHeader title="Estimates & BOQ" subtitle="Priced bills of quantities behind every bid" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Estimates" value={String(list.length)} hint={`${approved.length} approved`} />
        <Stat label="Value estimated" value={money(list.reduce((s, e) => s + sellOf(e), 0))} />
        <Stat label="Approved value" value={money(approved.reduce((s, e) => s + sellOf(e), 0))} tone="good" />
        <Stat label="In review" value={String(list.filter((e) => e.status === "in_review").length)}
          tone={list.some((e) => e.status === "in_review") ? "warn" : "default"} />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No estimates yet." /> : (
          <Table>
            <thead><tr>
              <Th>Ref</Th><Th>Title</Th><Th>Client</Th><Th>Status</Th>
              <Th right>Base cost</Th><Th right>OH</Th><Th right>Margin</Th>
              <Th right>Sell price</Th><Th right>Valid to</Th>
            </tr></thead>
            <tbody>
              {list.map((e) => {
                const client = e.clients as unknown as { name: string } | null;
                const base = baseCost.get(e.id) ?? 0;
                return (
                  <tr key={e.id} className="hover:bg-[var(--hover)]">
                    <Td className="font-mono text-xs">
                      {e.ref}
                      {e.version > 1 && <span className="ml-1 text-[var(--muted)]">v{e.version}</span>}
                    </Td>
                    <Td className="font-medium">{e.title}</Td>
                    <Td>{client?.name ?? "—"}</Td>
                    <Td><Badge value={e.status} /></Td>
                    <Td right>{money(base)}</Td>
                    <Td right className="text-xs text-[var(--muted)]">{pct(e.overhead_pct, 0)}</Td>
                    <Td right className="text-xs text-[var(--muted)]">{pct(e.margin_pct, 0)}</Td>
                    <Td right className="font-medium">{money(sellOf(e))}</Td>
                    <Td right className="text-xs">{date(e.valid_until)}</Td>
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
