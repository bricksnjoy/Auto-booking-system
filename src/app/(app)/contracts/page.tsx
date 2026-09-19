import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("*, clients(name), vendors(name), projects(id, code, name)")
    .order("start_date", { ascending: false, nullsFirst: false });

  const list = data ?? [];
  const active = list.filter((c) => c.status === "active");
  const clientSide = list.filter((c) => c.client_id);
  const supplySide = list.filter((c) => c.vendor_id);
  const retentionHeld = list.reduce((s, c) => s + num(c.contract_value) * (num(c.retention_pct) / 100), 0);
  const soon = new Date(Date.now() + 30 * 86400000);

  return (
    <div>
      <PageHeader title="Contracts" subtitle="Client contracts and subcontract agreements" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active contracts" value={String(active.length)} hint={`${list.length} total`} />
        <Stat label="Client-side value" value={money(clientSide.reduce((s, c) => s + num(c.contract_value), 0))} />
        <Stat label="Supply-side value" value={money(supplySide.reduce((s, c) => s + num(c.contract_value), 0))} />
        <Stat label="Retention at stake" value={money(retentionHeld)} hint="Across all contracts" />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No contracts on file." /> : (
          <Table>
            <thead><tr>
              <Th>Ref</Th><Th>Title</Th><Th>Counterparty</Th><Th>Project</Th><Th>Status</Th>
              <Th right>Value</Th><Th right>Retention</Th><Th right>Start</Th><Th right>End</Th>
            </tr></thead>
            <tbody>
              {list.map((c) => {
                const client = c.clients as unknown as { name: string } | null;
                const vendor = c.vendors as unknown as { name: string } | null;
                const proj = c.projects as unknown as { id: string; code: string } | null;
                const endingSoon = c.status === "active" && c.end_date && new Date(c.end_date) <= soon;
                return (
                  <tr key={c.id} className="hover:bg-[var(--hover)]">
                    <Td className="font-mono text-xs">{c.ref}</Td>
                    <Td className="font-medium">{c.title}</Td>
                    <Td>
                      {client?.name ?? vendor?.name ?? "—"}
                      <span className="block text-xs text-[var(--muted)]">{client ? "Client" : vendor ? "Supplier" : ""}</span>
                    </Td>
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                    <Td><Badge value={c.status} /></Td>
                    <Td right>{money(c.contract_value)}</Td>
                    <Td right className="text-xs text-[var(--muted)]">{pct(c.retention_pct, 0)}</Td>
                    <Td right className="text-xs">{date(c.start_date)}</Td>
                    <Td right className={`text-xs ${endingSoon ? "font-medium text-amber-700" : ""}`}>{date(c.end_date)}</Td>
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
