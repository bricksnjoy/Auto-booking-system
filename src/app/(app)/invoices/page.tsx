import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, clients(name), projects(id, code)")
    .order("issue_date", { ascending: false });

  const list = invoices ?? [];
  const outstanding = list
    .filter((i) => !["paid", "void", "draft"].includes(i.status))
    .reduce((s, i) => s + (num(i.total) - num(i.amount_paid)), 0);
  const overdue = list.filter(
    (i) => i.due_date && new Date(i.due_date) < new Date() && !["paid", "void"].includes(i.status),
  );
  const collected = list.reduce((s, i) => s + num(i.amount_paid), 0);
  const invoiced = list.filter((i) => i.status !== "void").reduce((s, i) => s + num(i.total), 0);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Money owed to Spruce & Co by clients" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total invoiced" value={money(invoiced)} hint={`${list.length} invoices`} />
        <Stat label="Collected" value={money(collected)} tone="good" />
        <Stat label="Outstanding" value={money(outstanding)} tone={outstanding > 0 ? "warn" : "default"} />
        <Stat
          label="Overdue"
          value={money(overdue.reduce((s, i) => s + (num(i.total) - num(i.amount_paid)), 0))}
          hint={`${overdue.length} invoices`}
          tone={overdue.length ? "bad" : "default"}
        />
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty message="No invoices yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th><Th>Client</Th><Th>Project</Th><Th>Status</Th>
                <Th right>Issued</Th><Th right>Due</Th>
                <Th right>Total</Th><Th right>Outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const client = i.clients as unknown as { name: string } | null;
                const proj = i.projects as unknown as { id: string; code: string } | null;
                const due = num(i.total) - num(i.amount_paid);
                return (
                  <tr key={i.id} className="hover:bg-[var(--hover)]">
                    <Td>
                      <Link href={`/invoices/${i.id}`} className="font-mono text-xs font-medium hover:underline">
                        {i.invoice_no}
                      </Link>
                    </Td>
                    <Td>{client?.name ?? "—"}</Td>
                    <Td>
                      {proj ? (
                        <Link href={`/projects/${proj.id}`} className="font-mono text-xs hover:underline">
                          {proj.code}
                        </Link>
                      ) : "—"}
                    </Td>
                    <Td><Badge value={i.status} /></Td>
                    <Td right className="text-xs">{date(i.issue_date)}</Td>
                    <Td right className="text-xs">{date(i.due_date)}</Td>
                    <Td right>{money(i.total)}</Td>
                    <Td right className={due > 0 ? "font-medium text-amber-700" : ""}>{money(due)}</Td>
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
