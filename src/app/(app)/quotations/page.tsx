import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuotationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotations")
    .select("*, clients(name), projects(id, code)")
    .order("issue_date", { ascending: false });

  const list = data ?? [];
  const accepted = list.filter((q) => q.status === "accepted");
  const outstanding = list.filter((q) => q.status === "sent");
  const today = new Date();

  return (
    <div>
      <PageHeader title="Quotations" subtitle="Priced offers sent to clients" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Quotations" value={String(list.length)} />
        <Stat label="Out with clients" value={money(outstanding.reduce((s, q) => s + num(q.total), 0))}
          hint={`${outstanding.length} awaiting reply`} tone={outstanding.length ? "warn" : "default"} />
        <Stat label="Accepted" value={money(accepted.reduce((s, q) => s + num(q.total), 0))}
          hint={`${accepted.length} quotes`} tone="good" />
        <Stat label="Expiring soon" value={String(list.filter((q) => q.status === "sent" && q.valid_until &&
          new Date(q.valid_until) <= new Date(today.getTime() + 14 * 86400000)).length)} hint="Within 14 days" />
      </div>
      <Card>
        {list.length === 0 ? <Empty message="No quotations yet." /> : (
          <Table>
            <thead><tr>
              <Th>Quote</Th><Th>Title</Th><Th>Client</Th><Th>Project</Th><Th>Status</Th>
              <Th right>Net</Th><Th right>Tax</Th><Th right>Total</Th><Th right>Valid to</Th>
            </tr></thead>
            <tbody>
              {list.map((q) => {
                const client = q.clients as unknown as { name: string } | null;
                const proj = q.projects as unknown as { id: string; code: string } | null;
                const expired = q.status === "sent" && q.valid_until && new Date(q.valid_until) < today;
                return (
                  <tr key={q.id} className="hover:bg-[var(--hover)]">
                    <Td className="font-mono text-xs font-medium">{q.quote_no}</Td>
                    <Td>{q.title}</Td>
                    <Td>{client?.name ?? "—"}</Td>
                    <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                    <Td><Badge value={expired ? "expired" : q.status} /></Td>
                    <Td right>{money(q.subtotal)}</Td>
                    <Td right className="text-[var(--muted)]">{money(q.tax_amount)}</Td>
                    <Td right className="font-medium">{money(q.total)}</Td>
                    <Td right className={`text-xs ${expired ? "text-red-700" : ""}`}>{date(q.valid_until)}</Td>
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
