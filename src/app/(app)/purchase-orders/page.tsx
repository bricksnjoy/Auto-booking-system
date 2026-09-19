import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  const [{ data: pos }, { data: prs }] = await Promise.all([
    supabase.from("purchase_orders")
      .select("*, vendors(id, name), projects(id, code)")
      .order("order_date", { ascending: false }),
    supabase.from("purchase_requests")
      .select("*, projects(id, code), profiles:requested_by(full_name)")
      .order("created_at", { ascending: false }),
  ]);

  const poList = pos ?? [];
  const prList = prs ?? [];
  const awaiting = poList.filter((p) => p.status === "awaiting_approval");
  const openPos = poList.filter((p) => ["approved", "sent", "part_received"].includes(p.status));
  const prPending = prList.filter((p) => p.status === "submitted");

  return (
    <div>
      <PageHeader title="Purchase orders" subtitle="Requests raised on site, orders placed with suppliers" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open orders" value={String(openPos.length)}
          hint={money(openPos.reduce((s, p) => s + num(p.total), 0))} />
        <Stat label="Awaiting approval" value={String(awaiting.length)}
          hint={money(awaiting.reduce((s, p) => s + num(p.total), 0))} tone={awaiting.length ? "warn" : "default"} />
        <Stat label="Committed spend" value={money(poList.filter((p) => !["draft", "cancelled"].includes(p.status))
          .reduce((s, p) => s + num(p.total), 0))} />
        <Stat label="Requests pending" value={String(prPending.length)} hint={`${prList.length} raised`}
          tone={prPending.length ? "warn" : "default"} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Purchase orders" />
          {poList.length === 0 ? <Empty message="No purchase orders yet." /> : (
            <Table>
              <thead><tr>
                <Th>PO</Th><Th>Vendor</Th><Th>Project</Th><Th>Status</Th>
                <Th right>Ordered</Th><Th right>Expected</Th><Th right>Net</Th><Th right>Total</Th>
              </tr></thead>
              <tbody>
                {poList.map((p) => {
                  const v = p.vendors as unknown as { id: string; name: string } | null;
                  const proj = p.projects as unknown as { id: string; code: string } | null;
                  const overdue = ["approved", "sent", "part_received"].includes(p.status)
                    && p.expected_date && new Date(p.expected_date) < new Date();
                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg)]">
                      <Td className="font-mono text-xs font-medium">{p.po_no}</Td>
                      <Td>{v?.name ?? "—"}</Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td><Badge value={p.status} /></Td>
                      <Td right className="text-xs">{date(p.order_date)}</Td>
                      <Td right className={`text-xs ${overdue ? "font-medium text-red-700" : ""}`}>{date(p.expected_date)}</Td>
                      <Td right>{money(p.subtotal)}</Td>
                      <Td right className="font-medium">{money(p.total)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Purchase requests" subtitle="Raised before an order is placed" />
          {prList.length === 0 ? <Empty message="No purchase requests." /> : (
            <Table>
              <thead><tr>
                <Th>Ref</Th><Th>Title</Th><Th>Project</Th><Th>Requested by</Th>
                <Th>Status</Th><Th right>Needed by</Th><Th right>Estimated</Th>
              </tr></thead>
              <tbody>
                {prList.map((p) => {
                  const proj = p.projects as unknown as { id: string; code: string } | null;
                  const who = p.profiles as unknown as { full_name: string } | null;
                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg)]">
                      <Td className="font-mono text-xs">{p.ref}</Td>
                      <Td className="font-medium">{p.title}</Td>
                      <Td>{proj ? <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">{proj.code}</Link> : "—"}</Td>
                      <Td className="text-xs text-[var(--muted)]">{who?.full_name ?? "—"}</Td>
                      <Td><Badge value={p.status} /></Td>
                      <Td right className="text-xs">{date(p.needed_by)}</Td>
                      <Td right>{money(p.estimated_total)}</Td>
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
