import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, Table, Th, Td } from "@/components/ui";
import { DocumentSheet } from "@/components/document-sheet";
import { loadQuotation } from "@/lib/document-loaders";
import { INVOICE_STATUS_LABEL, STATUS_TONE, toTemplate, type InvoiceStatus, type QuoteStatus } from "@/lib/documents";
import { money, date, num } from "@/lib/format";
import { ConvertButton, DeleteQuotation, StatusPicker } from "./quotation-controls";

export const dynamic = "force-dynamic";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [doc, { data: totals }, { data: invoices }, { data: invTemplates }] = await Promise.all([
    loadQuotation(supabase, id),
    supabase.from("quotation_totals").select("*").eq("quotation_id", id).maybeSingle(),
    supabase
      .from("invoices")
      .select("id, number, issue_date, status, portion_pct, title")
      .eq("quotation_id", id)
      .order("seq"),
    supabase.from("document_templates").select("*").eq("kind", "invoice").order("is_default", { ascending: false }),
  ]);
  if (!doc) notFound();
  const { q, project, template, urls, sheet } = doc;

  const { data: invTotals } = invoices?.length
    ? await supabase.from("invoice_totals").select("*").in("invoice_id", invoices.map((i) => i.id))
    : { data: [] };
  const totalOf = new Map((invTotals ?? []).map((t) => [t.invoice_id, num(t.total)]));

  const subtotal = num(totals?.subtotal);
  const invoiced = num(totals?.invoiced);
  const live = (invoices ?? []).filter((i) => i.status !== "cancelled");
  const status = q.status as QuoteStatus;

  return (
    <div>
      <div className="mb-2">
        <Link href="/quotations" className="text-xs text-[var(--muted)] hover:underline">← Quotations</Link>
      </div>
      <PageHeader
        title={q.number}
        subtitle={[q.to_name, q.title].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {!live.length && <DeleteQuotation id={q.id} />}
            {!live.length && (
              <Link href={`/quotations/${q.id}/edit`}
                className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--hover)]">
                Edit
              </Link>
            )}
            <Link href={`/print/quotations/${q.id}`} target="_blank"
              className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--hover)]">
              Print / PDF
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 overflow-auto rounded-xl border border-[var(--border)] bg-[#e9ecf0] p-4">
          <div style={{ zoom: 0.8 }}>
            <DocumentSheet header={template.header} body={template.body} tail={template.tail}
              stampUrl={urls.stampUrl} signatureUrl={urls.signatureUrl} data={sheet} />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" subtitle={q.status_changed_at ? `Changed ${date(q.status_changed_at)}` : "Set as it moves along"} />
            <div className="space-y-4 px-5 py-4">
              <StatusPicker id={q.id} status={status} />
              {status === "won" ? (
                <ConvertButton quotationId={q.id} subtotal={subtotal} invoiced={invoiced} taxRate={num(q.tax_rate)}
                  templates={(invTemplates ?? []).map(toTemplate).map((t) => ({
                    id: t.id, name: t.name, is_default: t.is_default, due_days: t.body.due_days ?? 0,
                  }))} />
              ) : (
                <p className="text-xs text-[var(--muted)]">Mark it won to turn it into invoices.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <Row k="Total">{money(num(totals?.total))}</Row>
              <Row k="Invoiced">
                {money(invoiced)}
                <span className="ml-1 text-xs text-[var(--muted)]">
                  ({subtotal ? Number(((invoiced / subtotal) * 100).toFixed(2)) : 0}%)
                </span>
              </Row>
              <Row k="Left to invoice">{money(Math.max(subtotal - invoiced, 0))}</Row>
              <Row k="Project">
                {project ? (
                  <Link href={`/projects/${project.id}`} className="hover:text-[var(--brand)] hover:underline">
                    {project.code} · {project.name}
                  </Link>
                ) : (
                  <span className="text-[var(--muted)]">Not linked</span>
                )}
              </Row>
              <Row k="Valid until">{date(q.valid_until)}</Row>
            </dl>
            {q.notes && (
              <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">{q.notes}</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Invoices" subtitle="Raised from this quotation" />
            {!invoices?.length ? (
              <p className="px-5 py-6 text-center text-sm text-[var(--muted)]">None yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr><Th>Invoice</Th><Th right>Part</Th><Th right>Total</Th></tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="hover:bg-[var(--hover)]">
                      <Td>
                        <Link href={`/invoices/${i.id}`} className="font-medium hover:text-[var(--brand)] hover:underline">
                          {i.number}
                        </Link>
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[i.status]}`}>
                          {INVOICE_STATUS_LABEL[i.status as InvoiceStatus]}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">{date(i.issue_date)}</span>
                      </Td>
                      <Td right className="text-[var(--muted)]">{Number(Number(i.portion_pct).toFixed(2))}%</Td>
                      <Td right>{money(totalOf.get(i.id) ?? 0)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{k}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
