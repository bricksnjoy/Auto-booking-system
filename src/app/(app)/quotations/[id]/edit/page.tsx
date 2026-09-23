import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { num } from "@/lib/format";
import { QuotationForm } from "../../quotation-form";
import { formData } from "../../form-data";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: q }, { data: items }, { count: invoiced }, data] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("quotation_id", id).neq("status", "cancelled"),
    formData(supabase),
  ]);
  if (!q) notFound();

  return (
    <div>
      <div className="mb-2">
        <Link href={`/quotations/${id}`} className="text-xs text-[var(--muted)] hover:underline">← {q.number}</Link>
      </div>
      <PageHeader title={`Edit ${q.number}`} subtitle={q.to_name} />
      {invoiced ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--hover)] px-4 py-3 text-sm">
          Invoices have been raised from this quotation, so it can no longer be changed.
        </p>
      ) : (
        <QuotationForm {...data} number={q.number}
          initial={{
            id: q.id,
            // one made with a template since removed opens with the default instead
            template_id: q.template_id ?? data.templates[0]?.id ?? null,
            project_id: q.project_id,
            client_id: q.client_id,
            to_name: q.to_name,
            to_details: q.to_details ?? "",
            title: q.title ?? "",
            issue_date: q.issue_date,
            valid_until: q.valid_until,
            duration: q.duration ?? "",
            tax_rate: num(q.tax_rate),
            terms: q.terms ?? "",
            notes: q.notes ?? "",
            items: (items ?? []).map((l) => ({
              title: l.title ?? "",
              description: l.description ?? "",
              unit: l.unit ?? "",
              qty: num(l.qty),
              rate: num(l.rate),
            })),
          }} />
      )}
    </div>
  );
}
