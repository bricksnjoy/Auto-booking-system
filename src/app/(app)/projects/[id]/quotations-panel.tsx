import Link from "next/link";
import { Card, CardHeader, Table, Th, Td, Empty } from "@/components/ui";
import {
  INVOICE_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  STATUS_TONE,
  type InvoiceStatus,
  type QuoteStatus,
} from "@/lib/documents";
import { money, date } from "@/lib/format";

export interface ProjectDoc {
  id: string;
  kind: "quotation" | "invoice";
  number: string;
  issue_date: string;
  status: string;
  title: string | null;
  total: number;
  /** invoices: which quotation they came from */
  parent: string | null;
}

/** The quotations made for a project, and the invoices raised from them. */
export function QuotationsPanel({ projectId, docs }: { projectId: string; docs: ProjectDoc[] }) {
  const quotes = docs.filter((d) => d.kind === "quotation");
  const invoices = docs.filter((d) => d.kind === "invoice");
  const invoiced = invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.total, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <Card>
      <CardHeader
        title="Quotations & invoices"
        subtitle={
          docs.length
            ? `${quotes.length} quotation${quotes.length === 1 ? "" : "s"} · ${money(invoiced)} invoiced · ${money(paid)} paid`
            : "What was quoted for this project, and what has been billed"
        }
        action={
          <Link href={`/quotations/new?project=${projectId}`} className="text-xs font-medium text-[var(--brand)] hover:underline">
            + New quotation
          </Link>
        }
      />
      {docs.length === 0 ? (
        <Empty message="No quotations for this project yet." />
      ) : (
        <Table>
          <thead>
            <tr><Th>Document</Th><Th>Date</Th><Th>Heading</Th><Th right>Total</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <QuoteRows key={q.id} quote={q} invoices={invoices.filter((i) => i.parent === q.id)} />
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function QuoteRows({ quote, invoices }: { quote: ProjectDoc; invoices: ProjectDoc[] }) {
  return (
    <>
      <tr className="hover:bg-[var(--hover)]">
        <Td className="font-medium">
          <Link href={`/quotations/${quote.id}`} className="hover:text-[var(--brand)] hover:underline">{quote.number}</Link>
          <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">quote</span>
        </Td>
        <Td className="text-xs text-[var(--muted)]">{date(quote.issue_date)}</Td>
        <Td className="text-xs">{quote.title ?? "—"}</Td>
        <Td right className="font-medium">{money(quote.total)}</Td>
        <Td>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[quote.status]}`}>
            {QUOTE_STATUS_LABEL[quote.status as QuoteStatus]}
          </span>
        </Td>
      </tr>
      {invoices.map((i) => (
        <tr key={i.id} className="hover:bg-[var(--hover)]">
          <Td className="pl-9">
            <Link href={`/invoices/${i.id}`} className="hover:text-[var(--brand)] hover:underline">↳ {i.number}</Link>
            <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">invoice</span>
          </Td>
          <Td className="text-xs text-[var(--muted)]">{date(i.issue_date)}</Td>
          <Td className="text-xs">{i.title ?? "—"}</Td>
          <Td right>{money(i.total)}</Td>
          <Td>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[i.status]}`}>
              {INVOICE_STATUS_LABEL[i.status as InvoiceStatus]}
            </span>
          </Td>
        </tr>
      ))}
    </>
  );
}
