import type { createClient } from "@/lib/supabase/server";
import { round2, toTemplate, type DocKind, type Template } from "@/lib/documents";
import { brandingUrls } from "@/lib/branding";
import type { SheetData } from "@/components/document-sheet";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The template a document was made with, or that kind's default if it has since gone. */
async function templateFor(supabase: Supabase, kind: DocKind, id: string | null): Promise<Template | null> {
  if (id) {
    const { data } = await supabase.from("document_templates").select("*").eq("id", id).maybeSingle();
    if (data) return toTemplate(data);
  }
  const { data } = await supabase
    .from("document_templates")
    .select("*")
    .eq("kind", kind)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toTemplate(data) : null;
}

export async function loadQuotation(supabase: Supabase, id: string) {
  const [{ data: q }, { data: items }] = await Promise.all([
    supabase.from("quotations").select("*, projects(id, code, name)").eq("id", id).maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order"),
  ]);
  if (!q) return null;
  const template = await templateFor(supabase, "quotation", q.template_id);
  if (!template) return null;
  const urls = await brandingUrls(supabase, template.tail);

  const lines = (items ?? []).map((l) => {
    const qty = Number(l.qty);
    const rate = Number(l.rate);
    return { title: l.title, description: l.description, unit: l.unit, qty, rate, amount: round2(qty * rate) };
  });
  const sheet: SheetData = {
    kind: "quotation",
    number: q.number,
    date: q.issue_date,
    untilDate: q.valid_until,
    duration: q.duration,
    toName: q.to_name,
    toDetails: q.to_details,
    title: q.title,
    lines,
    taxRate: Number(q.tax_rate),
    terms: q.terms ?? "",
  };
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const project = q.projects as unknown as { id: string; code: string; name: string } | null;
  return { q, project, template, urls, sheet, subtotal };
}

export async function loadInvoice(supabase: Supabase, id: string) {
  const [{ data: inv }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*, quotations(id, number), projects(id, code, name)").eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
  ]);
  if (!inv) return null;
  const template = await templateFor(supabase, "invoice", inv.template_id);
  if (!template) return null;
  const urls = await brandingUrls(supabase, template.tail);

  const quotation = inv.quotations as unknown as { id: string; number: string } | null;
  const project = inv.projects as unknown as { id: string; code: string; name: string } | null;
  const pct = Number(inv.portion_pct);
  const lines = (items ?? []).map((l) => ({
    title: l.title,
    description: l.description,
    unit: l.unit,
    qty: Number(l.qty),
    rate: Number(l.rate),
    amount: Number(l.amount),
  }));
  const sheet: SheetData = {
    kind: "invoice",
    number: inv.number,
    quotationNumber: quotation?.number ?? null,
    date: inv.issue_date,
    untilDate: inv.due_date,
    toName: inv.to_name,
    toDetails: inv.to_details,
    title: inv.title,
    lines,
    taxRate: Number(inv.tax_rate),
    terms: inv.terms ?? "",
    portionLabel: pct < 99.995 ? `${Number(pct.toFixed(2))}%` : null,
  };
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { inv, quotation, project, template, urls, sheet, subtotal };
}
