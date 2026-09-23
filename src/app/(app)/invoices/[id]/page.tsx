import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { DocumentSheet } from "@/components/document-sheet";
import { loadInvoice } from "@/lib/document-loaders";
import { round2, type InvoiceStatus } from "@/lib/documents";
import { money, date, num } from "@/lib/format";
import { DeleteInvoice, EditInvoiceButton, InvoiceStatusPicker } from "./invoice-controls";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const doc = await loadInvoice(supabase, id);
  if (!doc) notFound();
  const { inv, quotation, project, template, urls, sheet, subtotal } = doc;
  const tax = round2((subtotal * num(inv.tax_rate)) / 100);

  return (
    <div>
      <div className="mb-2">
        <Link href={quotation ? `/quotations/${quotation.id}` : "/invoices"} className="text-xs text-[var(--muted)] hover:underline">
          ← {quotation ? quotation.number : "Invoices"}
        </Link>
      </div>
      <PageHeader
        title={inv.number}
        subtitle={[inv.to_name, inv.title].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {inv.status !== "paid" && <DeleteInvoice id={inv.id} />}
            <EditInvoiceButton invoice={{
              id: inv.id, to_name: inv.to_name, to_details: inv.to_details, title: inv.title,
              issue_date: inv.issue_date, due_date: inv.due_date, terms: inv.terms,
            }} />
            <Link href={`/print/invoices/${inv.id}`} target="_blank"
              className="rounded-lg border border-[var(--border)] bg-[var(--field)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--hover)]">
              Print / PDF
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 overflow-auto rounded-xl border border-[var(--border)] bg-[#e9ecf0] p-4">
          <div style={{ zoom: 0.8 }}>
            <DocumentSheet header={template.header} body={template.body} tail={template.tail}
              stampUrl={urls.stampUrl} signatureUrl={urls.signatureUrl} data={sheet} />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" subtitle={inv.paid_at ? `Paid ${date(inv.paid_at)}` : "Mark it paid when the money is in"} />
            <div className="px-5 py-4">
              <InvoiceStatusPicker id={inv.id} status={inv.status as InvoiceStatus} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2 px-5 py-4 text-sm">
              <Row k="Part of the quotation">{Number(num(inv.portion_pct).toFixed(2))}%</Row>
              <Row k="Sub total">{money(subtotal)}</Row>
              {tax > 0 && <Row k="Tax">{money(tax)}</Row>}
              <Row k="Total"><span className="font-semibold">{money(subtotal + tax)}</span></Row>
              <Row k="Due">{date(inv.due_date)}</Row>
              <Row k="Quotation">
                {quotation ? (
                  <Link href={`/quotations/${quotation.id}`} className="hover:text-[var(--brand)] hover:underline">{quotation.number}</Link>
                ) : "—"}
              </Row>
              <Row k="Project">
                {project ? (
                  <Link href={`/projects/${project.id}`} className="hover:text-[var(--brand)] hover:underline">
                    {project.code} · {project.name}
                  </Link>
                ) : (
                  <span className="text-[var(--muted)]">Not linked</span>
                )}
              </Row>
            </dl>
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
