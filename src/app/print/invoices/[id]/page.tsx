import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet } from "@/components/document-sheet";
import { loadInvoice } from "@/lib/document-loaders";
import { PrintToolbar } from "../../toolbar";

export const dynamic = "force-dynamic";

export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const doc = await loadInvoice(supabase, id);
  if (!doc) notFound();
  return (
    <>
      <title>{doc.inv.number}</title>
      <PrintToolbar back={`/invoices/${id}`} filename={`${doc.inv.number.replace(/[\\/]+/g, "-")}${doc.inv.title ? ` ${doc.inv.title}` : ""}`} />
      <DocumentSheet header={doc.template.header} body={doc.template.body} tail={doc.template.tail}
        stampUrl={doc.urls.stampUrl} signatureUrl={doc.urls.signatureUrl} data={doc.sheet} />
    </>
  );
}
