import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Stat, Badge, Table, Th, Td, Empty } from "@/components/ui";
import { money, moneyExact, date, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(id, name, email, address), projects(id, code, name)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: lines }, { data: payments }] = await Promise.all([
    supabase.from("invoice_lines").select("*").eq("invoice_id", id),
    supabase.from("payments").select("*").eq("invoice_id", id).order("paid_date", { ascending: false }),
  ]);

  const client = invoice.clients as unknown as
    { id: string; name: string; email: string | null; address: string | null } | null;
  const proj = invoice.projects as unknown as { id: string; code: string; name: string } | null;
  const due = num(invoice.total) - num(invoice.amount_paid);

  return (
    <div>
      <div className="mb-2">
        <Link href="/invoices" className="text-xs text-[var(--muted)] hover:underline">
          ← Invoices
        </Link>
      </div>
      <PageHeader
        title={invoice.invoice_no}
        subtitle={`${client?.name ?? "No client"}${proj ? ` · ${proj.code} ${proj.name}` : ""}`}
        action={<Badge value={invoice.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total" value={money(invoice.total)} />
        <Stat label="Paid" value={money(invoice.amount_paid)} tone="good" />
        <Stat label="Outstanding" value={money(due)} tone={due > 0 ? "warn" : "good"} />
        <Stat label="Due date" value={date(invoice.due_date)} hint={`Issued ${date(invoice.issue_date)}`} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Line items" />
          {!lines?.length ? (
            <Empty message="No line items." />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Description</Th><Th right>Qty</Th>
                    <Th right>Unit price</Th><Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <Td>{l.description}</Td>
                      <Td right>{num(l.quantity)}</Td>
                      <Td right>{moneyExact(l.unit_price)}</Td>
                      <Td right>{moneyExact(l.line_total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <dl className="space-y-2 border-t border-[var(--border)] px-5 py-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Subtotal</dt>
                  <dd className="tabular-nums">{moneyExact(invoice.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Tax</dt>
                  <dd className="tabular-nums">{moneyExact(invoice.tax_amount)}</dd>
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{moneyExact(invoice.total)}</dd>
                </div>
              </dl>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Bill to" />
            <div className="px-5 py-4 text-sm">
              <p className="font-medium">{client?.name ?? "—"}</p>
              {client?.address && (
                <p className="mt-1 whitespace-pre-line text-[var(--muted)]">{client.address}</p>
              )}
              {client?.email && <p className="mt-1 text-[var(--muted)]">{client.email}</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payments received" />
            {!payments?.length ? (
              <Empty message="No payments yet." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p>{date(p.paid_date)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {p.method ?? "—"} {p.reference ? `· ${p.reference}` : ""}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {invoice.notes && (
        <Card className="mt-4">
          <CardHeader title="Notes" />
          <p className="px-5 py-4 text-sm text-[var(--muted)]">{invoice.notes}</p>
        </Card>
      )}
    </div>
  );
}
